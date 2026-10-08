import { prisma } from '../lib/prisma';
import { usuarioSelect } from '../lib/selects';
import { numero } from '../utils/serializar';

const DIAS = 14;

function chaveDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export async function visaoGeral() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - (DIAS - 1));

  const [totais, pedidosRecentes, porCategoria, categorias, topItens, porStatus, soma, avaliacoes] = await Promise.all([
    Promise.all([
      prisma.usuario.count({ where: { role: 'CLIENTE' } }),
      prisma.restaurante.count({ where: { status: 'APROVADO' } }),
      prisma.restaurante.count({ where: { status: 'PENDENTE' } }),
      prisma.produto.count(),
      prisma.pedido.count(),
      prisma.interacao.count({ where: { status: 'ABERTA', tipo: 'PERGUNTA' } }),
    ]),
    prisma.pedido.findMany({
      where: { createdAt: { gte: inicio } },
      select: { createdAt: true, valorTotal: true },
    }),
    prisma.produto.groupBy({ by: ['categoriaId'], _count: { _all: true } }),
    prisma.categoria.findMany(),
    prisma.itemPedido.groupBy({
      by: ['produtoId'],
      _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: 'desc' } },
      take: 5,
    }),
    prisma.restaurante.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.pedido.aggregate({ where: { status: { not: 'CANCELADO' } }, _sum: { valorTotal: true } }),
    prisma.interacao.aggregate({ where: { tipo: 'AVALIACAO' }, _avg: { nota: true } }),
  ]);

  // Pedidos por dia (últimos 14 dias, incluindo dias sem pedidos).
  const dias = new Map<string, { pedidos: number; valor: number }>();
  for (let i = 0; i < DIAS; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.set(chaveDia(d), { pedidos: 0, valor: 0 });
  }
  for (const p of pedidosRecentes) {
    const atual = dias.get(chaveDia(p.createdAt));
    if (atual) {
      atual.pedidos += 1;
      atual.valor += numero(p.valorTotal);
    }
  }

  const nomesCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
  const produtosTop = await prisma.produto.findMany({
    where: { id: { in: topItens.map((t) => t.produtoId) } },
    select: { id: true, nome: true },
  });
  const nomesProduto = new Map(produtosTop.map((p) => [p.id, p.nome]));

  const [clientes, restaurantesAprovados, solicitacoesPendentes, produtos, pedidos, perguntasAbertas] = totais;
  return {
    totais: {
      clientes,
      restaurantesAprovados,
      solicitacoesPendentes,
      produtos,
      pedidos,
      perguntasAbertas,
      faturamento: soma._sum.valorTotal ? numero(soma._sum.valorTotal) : 0,
      notaMedia: avaliacoes._avg.nota !== null ? Number(avaliacoes._avg.nota.toFixed(1)) : null,
    },
    pedidosPorDia: [...dias.entries()].map(([dia, v]) => ({
      dia,
      pedidos: v.pedidos,
      valor: Number(v.valor.toFixed(2)),
    })),
    produtosPorCategoria: porCategoria.map((c) => ({
      categoria: nomesCategoria.get(c.categoriaId) ?? 'Outras',
      total: c._count._all,
    })),
    topProdutos: topItens.map((t) => ({
      produto: nomesProduto.get(t.produtoId) ?? 'Produto',
      quantidade: t._sum.quantidade ?? 0,
    })),
    restaurantesPorStatus: porStatus.map((s) => ({ status: s.status, total: s._count._all })),
  };
}

export function listarClientes() {
  return prisma.usuario.findMany({ select: usuarioSelect, orderBy: { createdAt: 'desc' } });
}
