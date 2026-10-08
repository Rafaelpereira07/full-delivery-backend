import { Request } from 'express';
import { AppError } from './AppError';
import { TokenPayload } from './jwt';

/** Retorna o token já validado pelo middleware `autenticar`. */
export function authDe(req: Request): TokenPayload {
  if (!req.auth) throw new AppError('Autenticação necessária', 401);
  return req.auth;
}

export function paramId(req: Request): string {
  return String(req.params.id);
}
