import { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { TokenPayload, verificarToken } from '../utils/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: TokenPayload;
  }
}

export function autenticar(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Autenticação necessária', 401));
  }
  try {
    req.auth = verificarToken(header.slice(7));
    next();
  } catch {
    next(new AppError('Token inválido ou expirado', 401));
  }
}

export function exigirUsuario(...roles: Array<'CLIENTE' | 'ADMIN'>): RequestHandler {
  return (req, _res, next) => {
    const auth = req.auth;
    if (!auth || auth.tipo !== 'USUARIO' || !auth.role) {
      return next(new AppError('Acesso negado', 403));
    }
    if (roles.length > 0 && !roles.includes(auth.role)) {
      return next(new AppError('Acesso negado', 403));
    }
    next();
  };
}

export function exigirTipo(...tipos: Array<'USUARIO' | 'RESTAURANTE'>): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth || !tipos.includes(req.auth.tipo)) {
      return next(new AppError('Acesso negado', 403));
    }
    next();
  };
}

/** Restaurante autenticado e com status APROVADO (consulta o banco a cada chamada). */
export const exigirRestauranteAprovado: RequestHandler = async (req, _res, next) => {
  try {
    const auth = req.auth;
    if (!auth || auth.tipo !== 'RESTAURANTE') {
      throw new AppError('Acesso negado', 403);
    }
    const restaurante = await prisma.restaurante.findUnique({
      where: { id: auth.sub },
      select: { status: true },
    });
    if (!restaurante || restaurante.status !== 'APROVADO') {
      throw new AppError('Restaurante não está aprovado', 403);
    }
    next();
  } catch (erro) {
    next(erro);
  }
};
