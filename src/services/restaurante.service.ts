import { Prisma, StatusRestaurante } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { restaurantePublicoSelect, restauranteSelect } from "../lib/selects";
import { AppError } from "../utils/AppError";
import { numero } from "../utils/serializar";
import {
  notificarRestauranteAprovado,
  notificarRestauranteRejeitado,
} from "./email.service";

export function listarAprovados(q?: string) {
  const where: Prisma.RestauranteWhereInput = { status: "APROVADO" };
  if (q) where.nome = { contains: q };
  return prisma.restaurante.findMany({
    where,
    select: restaurantePublicoSelect,
    orderBy: { nome: "asc" },
  });
}

export async function buscarAprovado(id: string) {
  const restaurante = await prisma.restaurante.findFirst({
    where: { id, status: "APROVADO" },
    select: restaurantePublicoSelect,
  });
  if (!restaurante) throw new AppError("Restaurante não encontrado", 404);
  return restaurante;
}

export function listarParaAdmin(status?: StatusRestaurante) {
  return prisma.restaurante.findMany({
    where: status ? { status } : undefined,
    select: restauranteSelect,
    orderBy: { createdAt: "desc" },
  });
}

async function obterOuFalhar(id: string) {
  const restaurante = await prisma.restaurante.findUnique({ where: { id } });
  if (!restaurante) throw new AppError("Restaurante não encontrado", 404);
  return restaurante;
}

export async function aprovar(id: string) {
  const atual = await obterOuFalhar(id);
  if (atual.status === "APROVADO")
    throw new AppError("Restaurante já está aprovado", 409);
  if (atual.status === "BLOQUEADO")
    throw new AppError('Restaurante bloqueado: use "desbloquear"', 409);

  const decididoEm = new Date();
  const restaurante = await prisma.restaurante.update({
    where: { id },
    data: { status: "APROVADO", decididoEm, motivoRejeicao: null },
    select: restauranteSelect,
  });
  const emailEnviado = await notificarRestauranteAprovado(restaurante, decididoEm);
  return { restaurante, emailEnviado };
}

export async function rejeitar(id: string, motivo?: string) {
  const atual = await obterOuFalhar(id);
  if (atual.status !== "PENDENTE")
    throw new AppError("Apenas solicitações pendentes podem ser rejeitadas", 409);

  const decididoEm = new Date();
  const restaurante = await prisma.restaurante.update({
    where: { id },
    data: { status: "REJEITADO", decididoEm, motivoRejeicao: motivo || null },
    select: restauranteSelect,
  });
  const emailEnviado = await notificarRestauranteRejeitado(
    restaurante,
    decididoEm,
    motivo,
  );
  return { restaurante, emailEnviado };
}

export async function bloquear(id: string) {
  const atual = await obterOuFalhar(id);
  if (atual.status !== "APROVADO")
    throw new AppError("Apenas restaurantes aprovados podem ser bloqueados", 409);
  return prisma.restaurante.update({
    where: { id },
    data: { status: "BLOQUEADO" },
    select: restauranteSelect,
  });
}

export async function desbloquear(id: string) {
  const atual = await obterOuFalhar(id);
  if (atual.status !== "BLOQUEADO")
    throw new AppError("Restaurante não está bloqueado", 409);
  return prisma.restaurante.update({
    where: { id },
    data: { status: "APROVADO" },
    select: restauranteSelect,
  });
}

export async function resumoDoRestaurante(restauranteId: string) {
  const [pedidosRecebidos, pedidosPendentes, produtosCadastrados, soma, pedidos] =
    await Promise.all([
      prisma.pedido.count({ where: { restauranteId } }),
      prisma.pedido.count({ where: { restauranteId, status: "PENDENTE" } }),
      prisma.produto.count({ where: { restauranteId } }),
      prisma.pedido.aggregate({
        where: { restauranteId, status: { not: "CANCELADO" } },
        _sum: { valorTotal: true },
      }),
      prisma.pedido.groupBy({
        by: ["status"],
        where: { restauranteId },
        _count: { _all: true },
      }),
    ]);
  return {
    pedidosRecebidos,
    pedidosPendentes,
    produtosCadastrados,
    valorVendido: soma._sum.valorTotal ? numero(soma._sum.valorTotal) : 0,
    pedidosPorStatus: pedidos.map((p) => ({ status: p.status, total: p._count._all })),
  };
}
