import { z } from 'zod';

const texto = (min: number, max = 255) => z.string().trim().min(min).max(max);

export const registrarUsuarioSchema = z.object({
  nome: texto(2, 120),
  email: z.string().trim().toLowerCase().email().max(180),
  senha: z.string().min(6).max(72),
  telefone: z.string().trim().max(30).optional(),
  endereco: z.string().trim().max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1).max(72),
});

export const solicitarRestauranteSchema = z.object({
  nome: texto(2, 120),
  responsavel: texto(2, 120),
  email: z.string().trim().toLowerCase().email().max(180),
  telefone: texto(8, 30),
  endereco: texto(5, 255),
  descricao: z.string().trim().max(2000).optional(),
  senha: z.string().min(6).max(72),
});

export const atualizarPerfilUsuarioSchema = z.object({
  nome: texto(2, 120).optional(),
  telefone: z.string().trim().max(30).optional(),
  endereco: z.string().trim().max(255).optional(),
});

export const atualizarPerfilRestauranteSchema = z.object({
  nome: texto(2, 120).optional(),
  responsavel: texto(2, 120).optional(),
  telefone: texto(8, 30).optional(),
  endereco: texto(5, 255).optional(),
  descricao: z.string().trim().max(2000).optional(),
});

export const produtoSchema = z.object({
  nome: texto(2, 120),
  descricao: z.string().trim().max(2000).optional(),
  preco: z.coerce.number().positive().max(99999),
  imagem: z.string().trim().url().max(500).optional().or(z.literal('')),
  disponivel: z.boolean().optional(),
  destaque: z.boolean().optional(),
  categoriaId: z.coerce.number().int().positive(),
});

export const produtoParcialSchema = produtoSchema.partial();

export const buscaProdutosSchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  precoMin: z.coerce.number().min(0).optional(),
  precoMax: z.coerce.number().min(0).optional(),
  destaque: z.enum(['true', 'false']).optional(),
  restauranteId: z.string().uuid().optional(),
});

export const criarPedidoSchema = z.object({
  restauranteId: z.string().uuid(),
  enderecoEntrega: texto(5, 255),
  itens: z
    .array(z.object({ produtoId: z.string().uuid(), quantidade: z.coerce.number().int().min(1).max(50) }))
    .min(1)
    .max(50),
});

export const statusPedidoSchema = z.object({
  status: z.enum(['PENDENTE', 'ACEITO', 'EM_PREPARACAO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO']),
});

export const criarInteracaoSchema = z
  .object({
    tipo: z.enum(['PERGUNTA', 'AVALIACAO']),
    mensagem: texto(2, 1000),
    nota: z.coerce.number().int().min(1).max(5).optional(),
  })
  .refine((d) => d.tipo !== 'AVALIACAO' || d.nota !== undefined, {
    message: 'Informe a nota (1 a 5) para avaliações',
    path: ['nota'],
  });

export const responderInteracaoSchema = z.object({ resposta: texto(2, 2000) });

export const emailInteracaoSchema = z.object({ mensagem: texto(2, 2000) });

export const rejeitarRestauranteSchema = z.object({ motivo: z.string().trim().max(1000).optional() });

export const idSchema = z.object({ id: z.string().uuid() });

export const statusRestauranteQuerySchema = z.object({
  status: z.enum(['PENDENTE', 'APROVADO', 'REJEITADO', 'BLOQUEADO']).optional(),
});
