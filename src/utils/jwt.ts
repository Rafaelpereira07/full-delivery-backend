import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type TipoToken = 'USUARIO' | 'RESTAURANTE';

export interface TokenPayload {
  sub: string;
  tipo: TipoToken;
  role?: 'CLIENTE' | 'ADMIN';
}

export function assinarToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verificarToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === 'string' || !decoded.sub || !('tipo' in decoded)) {
    throw new Error('Token invalido');
  }
  return decoded as unknown as TokenPayload;
}
