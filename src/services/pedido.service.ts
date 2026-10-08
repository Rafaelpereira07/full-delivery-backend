import { Prisma, StatusPedido } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { criarPedidoSchema } from '../schemas';
import { AppError } from '../utils/AppError';
import { TokenPayload } from '../utils/jwt';
import { calcularTotal, transicaoValida } from '../utils/pedido';
import { numero } from '../utils/serializar';

const include = {
  restaurante: { select: { id: true, nome: true } },
  cliente: { select: { id: true, nome: true, telefone: true } },
  itens: { include: { produto: { select: { id: true, nome: true, imagem: true } } } },
} satisfies Prisma.PedidoInclude;

type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof include }>;

function serializar(pedido: PedidoCompleto) {
  return {
    ...pedido,
    valorTotal: numero(pedido.valorTotal),
    itens: pedido.itens.map((i) => ({ ...i, precoUnitario: numero(i.precoUnitario) })),
  };
}

export async function criar(clienteId: string, dados: z.infer<typeof criarPedidoSchema>) {
  const restaurante = await prisma.restaurante.findFirst({
    where: { id: dados.restauranteId, status: 'APROVADO' },
    select: { id: true },
  });
  if (!restaurante) throw new AppError('Restaurante indisponível', 400);

  // Agrupa produtos repetidos somando as quantidades.
  const quantidades = new Map<string, number>();
  for (const item of dados.itens) {
    quantidades.set(item.produtoId, (quantidades.get(item.produtoId) ?? 0) + item.quantidade);
  }

  // Preços SEMPRE vêm do banco, nunca do frontend.
  const produtos = await prisma.produto.findMany({
    where: { id: { in: [...quantidades.keys()] }, restauranteId: restaurante.id, disponivel: true },
    select: { id: true, preco: true },
  });
  if (produtos.length !== quantidades.size) {
    throw new AppError('Há produtos indisponíveis ou de outro restaurante no carrinho', 400);
  }

  const itens = produtos.map((p) => ({
    produtoId: p.id,
    quantidade: quantidades.get(p.id) as number,
    precoUnitario: numero(p.preco),
  }));
  const valorTotal = calcularTotal(itens);

  const pedido = await prisma.pedido.create({
    data: {
      clienteId,
      restauranteId: restaurante.id,
      enderecoEntrega: dados.enderecoEntrega,
      valorTotal,
      itens: { create: itens },
    },
    include,
  });
  return serializar(pedido);
}

function filtroPorAuth(auth: TokenPayload): Prisma.PedidoWhereInput {
  if (auth.tipo === 'RESTAURANTE') return { restauranteId: auth.sub };
  if (auth.role === 'ADMIN') return {};
  return { clienteId: auth.sub };
}

export async function listar(auth: TokenPayload) {
  const pedidos = await prisma.pedido.findMany({
    where: filtroPorAuth(auth),
    include,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return pedidos.map(serializar);
}

export async function buscar(id: string, auth: TokenPayload) {
  const pedido = await prisma.pedido.findFirst({ where: { id, ...filtroPorAuth(auth) }, include });
  if (!pedido) throw new AppError('Pedido não encontrado', 404);
  return serializar(pedido);
}

export async function atualizarStatus(id: string, auth: TokenPayload, novo: StatusPedido) {
  const pedido = await prisma.pedido.findFirst({ where: { id, ...filtroPorAuth(auth) } });
  if (!pedido) throw new AppError('Pedido não encontrado', 404);

  const ehCliente = auth.tipo === 'USUARIO' && auth.role === 'CLIENTE';
  if (ehCliente && !(novo === 'CANCELADO' && pedido.status === 'PENDENTE')) {
    throw new AppError('Clientes só podem cancelar pedidos pendentes', 403);
  }
  if (!transicaoValida(pedido.status, novo)) {
    throw new AppError(`Não é possível mudar de ${pedido.status} para ${novo}`, 409);
  }
  const atualizado = await prisma.pedido.update({ where: { id }, data: { status: novo }, include });
  return serializar(atualizado);
}
