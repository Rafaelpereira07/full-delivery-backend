import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { buscaProdutosSchema, produtoParcialSchema, produtoSchema } from '../schemas';
import { AppError } from '../utils/AppError';
import { numero } from '../utils/serializar';

const include = {
  restaurante: { select: { id: true, nome: true } },
  categoria: true,
} satisfies Prisma.ProdutoInclude;

type ProdutoComRelacoes = Prisma.ProdutoGetPayload<{ include: typeof include }>;

/** Produto visível para clientes: disponível e de restaurante aprovado. */
const visivel: Prisma.ProdutoWhereInput = { disponivel: true, restaurante: { status: 'APROVADO' } };

async function anexarAvaliacoes(produtos: ProdutoComRelacoes[]) {
  if (produtos.length === 0) return [];
  const grupos = await prisma.interacao.groupBy({
    by: ['produtoId'],
    where: { tipo: 'AVALIACAO', produtoId: { in: produtos.map((p) => p.id) } },
    _avg: { nota: true },
    _count: { _all: true },
  });
  const mapa = new Map(
    grupos.map((g) => [
      g.produtoId,
      { media: g._avg.nota !== null ? Number(g._avg.nota.toFixed(1)) : null, total: g._count._all },
    ]),
  );
  return produtos.map((p) => ({
    ...p,
    preco: numero(p.preco),
    avaliacao: mapa.get(p.id) ?? { media: null, total: 0 },
  }));
}

export async function home() {
  const [destaques, ultimos, grupos] = await Promise.all([
    prisma.produto.findMany({
      where: { ...visivel, destaque: true },
      include,
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.produto.findMany({ where: visivel, include, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.interacao.groupBy({
      by: ['produtoId'],
      where: { tipo: 'AVALIACAO', produto: visivel },
      _avg: { nota: true },
      _count: { _all: true },
      orderBy: [{ _avg: { nota: 'desc' } }, { _count: { produtoId: 'desc' } }],
      take: 8,
    }),
  ]);

  const idsMelhores = grupos.map((g) => g.produtoId);
  const melhoresBrutos = await prisma.produto.findMany({ where: { id: { in: idsMelhores } }, include });
  const ordenados = idsMelhores
    .map((id) => melhoresBrutos.find((p) => p.id === id))
    .filter((p): p is ProdutoComRelacoes => p !== undefined);

  const [d, u, m] = await Promise.all([
    anexarAvaliacoes(destaques),
    anexarAvaliacoes(ultimos),
    anexarAvaliacoes(ordenados),
  ]);
  return { destaques: d, ultimos: u, melhoresAvaliados: m };
}

export async function buscar(filtros: z.infer<typeof buscaProdutosSchema>) {
  const where: Prisma.ProdutoWhereInput = { ...visivel };
  if (filtros.q) {
    where.OR = [{ nome: { contains: filtros.q } }, { descricao: { contains: filtros.q } }];
  }
  if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
  if (filtros.destaque) where.destaque = filtros.destaque === 'true';
  if (filtros.restauranteId) where.restauranteId = filtros.restauranteId;
  if (filtros.precoMin !== undefined || filtros.precoMax !== undefined) {
    where.preco = {
      ...(filtros.precoMin !== undefined ? { gte: filtros.precoMin } : {}),
      ...(filtros.precoMax !== undefined ? { lte: filtros.precoMax } : {}),
    };
  }
  const produtos = await prisma.produto.findMany({ where, include, orderBy: { nome: 'asc' }, take: 60 });
  return anexarAvaliacoes(produtos);
}

export async function detalhe(id: string) {
  const produto = await prisma.produto.findFirst({
    where: { id, restaurante: { status: 'APROVADO' } },
    include,
  });
  if (!produto) throw new AppError('Produto não encontrado', 404);
  const [comAvaliacao] = await anexarAvaliacoes([produto]);

  const interacoes = await prisma.interacao.findMany({
    where: { produtoId: id, OR: [{ tipo: 'AVALIACAO' }, { status: { not: 'ABERTA' } }] },
    select: {
      id: true,
      tipo: true,
      mensagem: true,
      nota: true,
      resposta: true,
      createdAt: true,
      usuario: { select: { nome: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return { ...comAvaliacao, interacoes };
}

export function listarCategorias() {
  return prisma.categoria.findMany({ orderBy: { nome: 'asc' } });
}

// ---------- Painel do restaurante ----------

export async function listarDoRestaurante(restauranteId: string) {
  const produtos = await prisma.produto.findMany({
    where: { restauranteId },
    include,
    orderBy: { createdAt: 'desc' },
  });
  return anexarAvaliacoes(produtos);
}

async function garantirCategoria(categoriaId: number) {
  const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria) throw new AppError('Categoria inválida', 422);
}

export async function criar(restauranteId: string, dados: z.infer<typeof produtoSchema>) {
  await garantirCategoria(dados.categoriaId);
  const produto = await prisma.produto.create({
    data: { ...dados, imagem: dados.imagem || null, restauranteId },
    include,
  });
  return { ...produto, preco: numero(produto.preco) };
}

export async function atualizar(restauranteId: string, id: string, dados: z.infer<typeof produtoParcialSchema>) {
  const existente = await prisma.produto.findFirst({ where: { id, restauranteId } });
  if (!existente) throw new AppError('Produto não encontrado', 404);
  if (dados.categoriaId) await garantirCategoria(dados.categoriaId);

  // Se o conteúdo que alimenta a IA mudou, o cache é descartado.
  const mudouConteudo =
    (dados.nome !== undefined && dados.nome !== existente.nome) ||
    (dados.descricao !== undefined && dados.descricao !== existente.descricao) ||
    (dados.categoriaId !== undefined && dados.categoriaId !== existente.categoriaId);

  const produto = await prisma.produto.update({
    where: { id },
    data: {
      ...dados,
      ...(dados.imagem !== undefined ? { imagem: dados.imagem || null } : {}),
      ...(mudouConteudo ? { iaCuriosidade: null, iaHarmonizacao: null, iaGeradoEm: null } : {}),
    },
    include,
  });
  return { ...produto, preco: numero(produto.preco) };
}

export async function excluir(restauranteId: string, id: string) {
  const existente = await prisma.produto.findFirst({ where: { id, restauranteId } });
  if (!existente) throw new AppError('Produto não encontrado', 404);
  const usos = await prisma.itemPedido.count({ where: { produtoId: id } });
  if (usos > 0) {
    throw new AppError('Este produto já foi pedido e não pode ser excluído. Desative-o.', 409);
  }
  await prisma.produto.delete({ where: { id } });
}

export async function listarTodosParaAdmin() {
  const produtos = await prisma.produto.findMany({ include, orderBy: { createdAt: 'desc' } });
  return produtos.map((p) => ({ ...p, preco: numero(p.preco) }));
}
