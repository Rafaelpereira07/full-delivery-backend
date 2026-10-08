import { Prisma } from '@prisma/client';

export const usuarioSelect = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  endereco: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UsuarioSelect;

export const restauranteSelect = {
  id: true,
  nome: true,
  responsavel: true,
  email: true,
  telefone: true,
  descricao: true,
  endereco: true,
  status: true,
  motivoRejeicao: true,
  decididoEm: true,
  createdAt: true,
} satisfies Prisma.RestauranteSelect;

export const restaurantePublicoSelect = {
  id: true,
  nome: true,
  telefone: true,
  descricao: true,
  endereco: true,
} satisfies Prisma.RestauranteSelect;
