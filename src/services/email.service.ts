import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import {
  EmailMensagem,
  templateAprovado,
  templateNovaSolicitacao,
  templateRejeitado,
} from '../utils/emailTemplates';

let transporter: Transporter | null = null;

function obterTransporter(): Transporter | null {
  if (!env.mail.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
    });
  }
  return transporter;
}

/** Envia e-mail sem nunca lançar erro nem expor credenciais. Retorna se foi enviado. */
export async function enviarEmail(para: string | string[], mensagem: EmailMensagem): Promise<boolean> {
  const t = obterTransporter();
  if (!t) {
    if (!env.isTest) console.warn('[email] MAIL_HOST não configurado: e-mail não enviado.');
    return false;
  }
  try {
    await t.sendMail({
      from: env.mail.from,
      to: para,
      subject: mensagem.assunto,
      html: mensagem.html,
      text: mensagem.texto,
    });
    return true;
  } catch (erro) {
    const codigo = erro instanceof Error && 'code' in erro ? String((erro as { code: unknown }).code) : 'DESCONHECIDO';
    console.error(`[email] Falha ao enviar e-mail (código ${codigo}).`);
    return false;
  }
}

export async function notificarAdminsNovaSolicitacao(restaurante: {
  nome: string;
  responsavel: string;
  email: string;
  telefone: string;
  endereco: string;
  descricao: string | null;
}): Promise<boolean> {
  const admins = await prisma.usuario.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
  if (admins.length === 0) return false;
  const mensagem = templateNovaSolicitacao({
    ...restaurante,
    painelUrl: `${env.frontendUrl}/admin/restaurantes?status=PENDENTE`,
  });
  return enviarEmail(
    admins.map((a) => a.email),
    mensagem,
  );
}

export function notificarRestauranteAprovado(restaurante: { nome: string; email: string }, decididoEm: Date) {
  return enviarEmail(
    restaurante.email,
    templateAprovado({ nome: restaurante.nome, decididoEm, loginUrl: `${env.frontendUrl}/restaurante/login` }),
  );
}

export function notificarRestauranteRejeitado(
  restaurante: { nome: string; email: string },
  decididoEm: Date,
  motivo?: string | null,
) {
  return enviarEmail(restaurante.email, templateRejeitado({ nome: restaurante.nome, decididoEm, motivo }));
}
