import { vi } from 'vitest';

/** Cria um mock de PrismaClient com os métodos usados nos services. */
export function criarPrismaMock() {
  const modelo = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  });
  return {
    usuario: modelo(),
    restaurante: modelo(),
    produto: modelo(),
    pedido: modelo(),
    itemPedido: modelo(),
    interacao: modelo(),
    categoria: modelo(),
  };
}
