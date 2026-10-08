import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { criarInteracaoSchema } from "../schemas";
import { AppError } from "../utils/AppError";
import { templateRespostaCliente } from "../utils/emailTemplates";
import { TokenPayload } from "../utils/jwt";
import { enviarEmail } from "./email.service";

const include = {
  usuario: { select: { id: true, nome: true, email: true } },
  produto: { select: { id: true, nome: true, restauranteId: true } },
} satisfies Prisma.InteracaoInclude;

export async function criar(
  usuarioId: string,
  produtoId: string,
  dados: z.infer<typeof criarInteracaoSchema>,
) {
  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, restaurante: { status: "APROVADO" } },
    select: { id: true },
  });
  if (!produto) throw new AppError("Produto não encontrado", 404);

  if (dados.tipo === "AVALIACAO") {
    const jaAvaliou = await prisma.interacao.findFirst({
      where: { usuarioId, produtoId, tipo: "AVALIACAO" },
    });
    if (jaAvaliou) throw new AppError("Você já avaliou este produto", 409);
  }
  return prisma.interacao.create({
    data: {
      tipo: dados.tipo,
      mensagem: dados.mensagem,
      nota: dados.tipo === "AVALIACAO" ? dados.nota : null,
      usuarioId,
      produtoId,
    },
    include,
  });
}

export function listarDoUsuario(usuarioId: string) {
  return prisma.interacao.findMany({
    where: { usuarioId },
    include,
    orderBy: { createdAt: "desc" },
  });
}

function filtroPorAuth(auth: TokenPayload): Prisma.InteracaoWhereInput {
  if (auth.tipo === "RESTAURANTE") return { produto: { restauranteId: auth.sub } };
  return {};
}

export function listarParaGestao(auth: TokenPayload) {
  return prisma.interacao.findMany({
    where: filtroPorAuth(auth),
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

async function obterGerenciavel(id: string, auth: TokenPayload) {
  const interacao = await prisma.interacao.findFirst({
    where: { id, ...filtroPorAuth(auth) },
    include,
  });
  if (!interacao) throw new AppError("Interação não encontrada", 404);
  return interacao;
}

export async function responder(id: string, auth: TokenPayload, resposta: string) {
  await obterGerenciavel(id, auth);
  return prisma.interacao.update({
    where: { id },
    data: { resposta, respondidaEm: new Date(), status: "RESPONDIDA" },
    include,
  });
}

export async function confirmar(id: string, auth: TokenPayload) {
  await obterGerenciavel(id, auth);
  return prisma.interacao.update({
    where: { id },
    data: { status: "CONFIRMADA" },
    include,
  });
}

export async function excluir(id: string, auth: TokenPayload) {
  await obterGerenciavel(id, auth);
  await prisma.interacao.delete({ where: { id } });
}

export async function enviarEmailAoCliente(
  id: string,
  auth: TokenPayload,
  mensagem: string,
) {
  const interacao = await obterGerenciavel(id, auth);
  const enviado = await enviarEmail(
    interacao.usuario.email,
    templateRespostaCliente({
      nomeCliente: interacao.usuario.nome,
      produto: interacao.produto.nome,
      pergunta: interacao.mensagem,
      mensagem,
    }),
  );
  if (!enviado)
    throw new AppError(
      "Não foi possível enviar o e-mail (serviço de e-mail não configurado ou indisponível)",
      502,
    );
}
