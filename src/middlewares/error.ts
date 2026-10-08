import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export function rotaNaoEncontrada(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Rota não encontrada', 404));
}

export function tratarErros(erro: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (erro instanceof AppError) {
    res.status(erro.status).json({ erro: erro.message });
    return;
  }
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === 'P2002') {
      res.status(409).json({ erro: 'Registro duplicado' });
      return;
    }
    if (erro.code === 'P2025') {
      res.status(404).json({ erro: 'Registro não encontrado' });
      return;
    }
    if (erro.code === 'P2003') {
      res.status(409).json({ erro: 'Registro possui vínculos e não pode ser alterado/removido' });
      return;
    }
  }
  if (!env.isTest) {
    console.error(erro);
  }
  res.status(500).json({
    erro: 'Erro interno do servidor',
    ...(env.isProd ? {} : { detalhe: erro instanceof Error ? erro.message : String(erro) }),
  });
}
