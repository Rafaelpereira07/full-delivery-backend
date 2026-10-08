import { Prisma } from '@prisma/client';

/** Converte Decimal do Prisma em number para o JSON da API. */
export function numero(valor: Prisma.Decimal | number | string): number {
  return Number(valor);
}
