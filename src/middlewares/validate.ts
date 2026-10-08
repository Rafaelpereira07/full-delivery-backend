import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

type Alvo = 'body' | 'query' | 'params';

export function validar(schema: ZodSchema, alvo: Alvo = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const resultado = schema.safeParse(req[alvo]);
    if (!resultado.success) {
      const mensagem = resultado.error.issues
        .map((i) => `${i.path.join('.') || alvo}: ${i.message}`)
        .join('; ');
      return next(new AppError(mensagem, 422));
    }
    Object.defineProperty(req, alvo, { value: resultado.data, writable: true, configurable: true });
    next();
  };
}
