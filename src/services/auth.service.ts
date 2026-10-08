import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { restauranteSelect, usuarioSelect } from '../lib/selects';
import {
  atualizarPerfilRestauranteSchema,
  atualizarPerfilUsuarioSchema,
  loginSchema,
  registrarUsuarioSchema,
  solicitarRestauranteSchema,
} from '../schemas';
import { AppError } from '../utils/AppError';
import { assinarToken, TokenPayload } from '../utils/jwt';
import { notificarAdminsNovaSolicitacao } from './email.service';

const SALT_ROUNDS = 10;
const CREDENCIAIS_INVALIDAS = 'E-mail ou senha incorretos';

export async function registrarUsuario(dados: z.infer<typeof registrarUsuarioSchema>) {
  const existente = await prisma.usuario.findUnique({ where: { email: dados.email } });
  if (existente) throw new AppError('E-mail já cadastrado', 409);

  const usuario = await prisma.usuario.create({
    data: { ...dados, senha: await bcrypt.hash(dados.senha, SALT_ROUNDS), role: 'CLIENTE' },
    select: usuarioSelect,
  });
  const token = assinarToken({ sub: usuario.id, tipo: 'USUARIO', role: usuario.role });
  return { token, tipo: 'USUARIO' as const, usuario };
}

export async function loginUsuario(dados: z.infer<typeof loginSchema>) {
  const registro = await prisma.usuario.findUnique({ where: { email: dados.email } });
  if (!registro || !(await bcrypt.compare(dados.senha, registro.senha))) {
    throw new AppError(CREDENCIAIS_INVALIDAS, 401);
  }
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: registro.id }, select: usuarioSelect });
  const token = assinarToken({ sub: usuario.id, tipo: 'USUARIO', role: usuario.role });
  return { token, tipo: 'USUARIO' as const, usuario };
}

export async function solicitarRestaurante(dados: z.infer<typeof solicitarRestauranteSchema>) {
  const existente = await prisma.restaurante.findUnique({ where: { email: dados.email } });
  if (existente) throw new AppError('E-mail já cadastrado', 409);

  const criado = await prisma.restaurante.create({
    data: { ...dados, senha: await bcrypt.hash(dados.senha, SALT_ROUNDS), status: 'PENDENTE' },
  });
  const emailEnviado = await notificarAdminsNovaSolicitacao(criado);
  const restaurante = await prisma.restaurante.findUniqueOrThrow({
    where: { id: criado.id },
    select: restauranteSelect,
  });
  return { restaurante, emailEnviado };
}

export async function loginRestaurante(dados: z.infer<typeof loginSchema>) {
  const registro = await prisma.restaurante.findUnique({ where: { email: dados.email } });
  if (!registro || !(await bcrypt.compare(dados.senha, registro.senha))) {
    throw new AppError(CREDENCIAIS_INVALIDAS, 401);
  }
  if (registro.status === 'PENDENTE') {
    throw new AppError('Sua solicitação ainda está em análise. Você receberá um e-mail com a decisão.', 403);
  }
  if (registro.status === 'REJEITADO') {
    throw new AppError('Sua solicitação foi rejeitada. Verifique o e-mail enviado com o motivo.', 403);
  }
  if (registro.status === 'BLOQUEADO') {
    throw new AppError('Este restaurante está bloqueado. Entre em contato com o suporte.', 403);
  }
  const restaurante = await prisma.restaurante.findUniqueOrThrow({
    where: { id: registro.id },
    select: restauranteSelect,
  });
  const token = assinarToken({ sub: restaurante.id, tipo: 'RESTAURANTE' });
  return { token, tipo: 'RESTAURANTE' as const, restaurante };
}

export async function obterSessao(auth: TokenPayload) {
  if (auth.tipo === 'USUARIO') {
    const usuario = await prisma.usuario.findUnique({ where: { id: auth.sub }, select: usuarioSelect });
    if (!usuario) throw new AppError('Sessão inválida', 401);
    return { tipo: 'USUARIO' as const, usuario };
  }
  const restaurante = await prisma.restaurante.findUnique({ where: { id: auth.sub }, select: restauranteSelect });
  if (!restaurante || restaurante.status !== 'APROVADO') throw new AppError('Sessão inválida', 401);
  return { tipo: 'RESTAURANTE' as const, restaurante };
}

export function atualizarPerfilUsuario(id: string, dados: z.infer<typeof atualizarPerfilUsuarioSchema>) {
  return prisma.usuario.update({ where: { id }, data: dados, select: usuarioSelect });
}

export function atualizarPerfilRestaurante(id: string, dados: z.infer<typeof atualizarPerfilRestauranteSchema>) {
  return prisma.restaurante.update({ where: { id }, data: dados, select: restauranteSelect });
}
