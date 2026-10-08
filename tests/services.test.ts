import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock } from './helpers';

const prismaMock = criarPrismaMock();
const emailMock = {
  notificarAdminsNovaSolicitacao: vi.fn().mockResolvedValue(true),
  notificarRestauranteAprovado: vi.fn().mockResolvedValue(true),
  notificarRestauranteRejeitado: vi.fn().mockResolvedValue(true),
  enviarEmail: vi.fn().mockResolvedValue(true),
};

vi.mock('../src/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('../src/services/email.service', () => emailMock);

const authService = await import('../src/services/auth.service');
const restauranteService = await import('../src/services/restaurante.service');
const pedidoService = await import('../src/services/pedido.service');
const produtoService = await import('../src/services/produto.service');

beforeEach(() => {
  vi.clearAllMocks();
  emailMock.notificarAdminsNovaSolicitacao.mockResolvedValue(true);
  emailMock.notificarRestauranteAprovado.mockResolvedValue(true);
  emailMock.notificarRestauranteRejeitado.mockResolvedValue(true);
});

describe('cadastro e login de usuário', () => {
  it('cadastra com senha em hash e nunca retorna a senha', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockImplementation(async ({ data }: { data: { senha: string } }) => {
      expect(data.senha).not.toBe('segredo123');
      expect(await bcrypt.compare('segredo123', data.senha)).toBe(true);
      return { id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'CLIENTE' };
    });
    const r = await authService.registrarUsuario({ nome: 'Ana', email: 'ana@x.com', senha: 'segredo123' });
    expect(r.token).toBeTruthy();
    expect(JSON.stringify(r)).not.toContain('senha');
  });

  it('recusa e-mail duplicado', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      authService.registrarUsuario({ nome: 'Ana', email: 'ana@x.com', senha: 'segredo123' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('login com senha correta devolve token', async () => {
    const hash = await bcrypt.hash('segredo123', 4);
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', senha: hash });
    prismaMock.usuario.findUniqueOrThrow.mockResolvedValue({ id: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'CLIENTE' });
    const r = await authService.loginUsuario({ email: 'ana@x.com', senha: 'segredo123' });
    expect(r.token).toBeTruthy();
  });

  it('login com senha incorreta retorna 401', async () => {
    const hash = await bcrypt.hash('segredo123', 4);
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 'u1', senha: hash });
    await expect(authService.loginUsuario({ email: 'ana@x.com', senha: 'errada' })).rejects.toMatchObject({ status: 401 });
  });
});

describe('fluxo de restaurante', () => {
  it('solicitação cria PENDENTE e avisa os admins', async () => {
    prismaMock.restaurante.findUnique.mockResolvedValue(null);
    prismaMock.restaurante.create.mockResolvedValue({ id: 'r1', nome: 'Bar', email: 'bar@x.com' });
    prismaMock.restaurante.findUniqueOrThrow.mockResolvedValue({ id: 'r1', status: 'PENDENTE' });
    const r = await authService.solicitarRestaurante({
      nome: 'Bar', responsavel: 'Zé', email: 'bar@x.com', telefone: '53999999999', endereco: 'Rua A, 1', senha: 'segredo123',
    });
    expect(prismaMock.restaurante.create.mock.calls[0][0].data.status).toBe('PENDENTE');
    expect(emailMock.notificarAdminsNovaSolicitacao).toHaveBeenCalled();
    expect(r.restaurante.status).toBe('PENDENTE');
  });

  it('restaurante pendente não consegue logar', async () => {
    const hash = await bcrypt.hash('segredo123', 4);
    prismaMock.restaurante.findUnique.mockResolvedValue({ id: 'r1', senha: hash, status: 'PENDENTE' });
    await expect(authService.loginRestaurante({ email: 'bar@x.com', senha: 'segredo123' })).rejects.toMatchObject({ status: 403 });
  });

  it('aprovar muda o status e envia e-mail', async () => {
    prismaMock.restaurante.findUnique.mockResolvedValue({ id: 'r1', status: 'PENDENTE' });
    prismaMock.restaurante.update.mockResolvedValue({ id: 'r1', nome: 'Bar', email: 'bar@x.com', status: 'APROVADO' });
    const r = await restauranteService.aprovar('r1');
    expect(prismaMock.restaurante.update.mock.calls[0][0].data.status).toBe('APROVADO');
    expect(emailMock.notificarRestauranteAprovado).toHaveBeenCalledTimes(1);
    expect(r.emailEnviado).toBe(true);
  });

  it('rejeitar grava o motivo e envia e-mail', async () => {
    prismaMock.restaurante.findUnique.mockResolvedValue({ id: 'r1', status: 'PENDENTE' });
    prismaMock.restaurante.update.mockResolvedValue({ id: 'r1', nome: 'Bar', email: 'bar@x.com', status: 'REJEITADO' });
    await restauranteService.rejeitar('r1', 'Documentação incompleta');
    const data = prismaMock.restaurante.update.mock.calls[0][0].data;
    expect(data.status).toBe('REJEITADO');
    expect(data.motivoRejeicao).toBe('Documentação incompleta');
    expect(emailMock.notificarRestauranteRejeitado).toHaveBeenCalledWith(expect.anything(), expect.any(Date), 'Documentação incompleta');
  });

  it('não rejeita restaurante que não está pendente', async () => {
    prismaMock.restaurante.findUnique.mockResolvedValue({ id: 'r1', status: 'APROVADO' });
    await expect(restauranteService.rejeitar('r1')).rejects.toMatchObject({ status: 409 });
  });

  it('falha de e-mail não impede a aprovação', async () => {
    emailMock.notificarRestauranteAprovado.mockResolvedValue(false);
    prismaMock.restaurante.findUnique.mockResolvedValue({ id: 'r1', status: 'PENDENTE' });
    prismaMock.restaurante.update.mockResolvedValue({ id: 'r1', nome: 'Bar', email: 'bar@x.com', status: 'APROVADO' });
    const r = await restauranteService.aprovar('r1');
    expect(r.restaurante.status).toBe('APROVADO');
    expect(r.emailEnviado).toBe(false);
  });
});

describe('pedidos', () => {
  const dto = {
    restauranteId: '11111111-1111-4111-8111-111111111111',
    enderecoEntrega: 'Rua A, 1',
    itens: [
      { produtoId: '22222222-2222-4222-8222-222222222222', quantidade: 2 },
      { produtoId: '33333333-3333-4333-8333-333333333333', quantidade: 1 },
    ],
  };

  it('calcula o total com preços do banco', async () => {
    prismaMock.restaurante.findFirst.mockResolvedValue({ id: dto.restauranteId });
    prismaMock.produto.findMany.mockResolvedValue([
      { id: dto.itens[0].produtoId, preco: '49.90' },
      { id: dto.itens[1].produtoId, preco: '24.50' },
    ]);
    prismaMock.pedido.create.mockImplementation(async ({ data }: { data: { valorTotal: number } }) => ({
      id: 'p1', valorTotal: data.valorTotal, itens: [], restaurante: {}, cliente: {},
    }));
    const pedido = await pedidoService.criar('c1', dto);
    expect(pedido.valorTotal).toBe(124.3);
  });

  it('recusa produtos de outro restaurante ou indisponíveis', async () => {
    prismaMock.restaurante.findFirst.mockResolvedValue({ id: dto.restauranteId });
    prismaMock.produto.findMany.mockResolvedValue([{ id: dto.itens[0].produtoId, preco: '49.90' }]);
    await expect(pedidoService.criar('c1', dto)).rejects.toMatchObject({ status: 400 });
  });

  it('recusa restaurante não aprovado', async () => {
    prismaMock.restaurante.findFirst.mockResolvedValue(null);
    await expect(pedidoService.criar('c1', dto)).rejects.toMatchObject({ status: 400 });
  });

  it('restaurante não acessa pedido de outro (404)', async () => {
    prismaMock.pedido.findFirst.mockResolvedValue(null);
    await expect(pedidoService.buscar('p1', { sub: 'outro', tipo: 'RESTAURANTE' })).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.pedido.findFirst.mock.calls[0][0].where).toMatchObject({ restauranteId: 'outro' });
  });

  it('cliente só cancela pedido pendente', async () => {
    const cliente = { sub: 'c1', tipo: 'USUARIO', role: 'CLIENTE' } as const;
    prismaMock.pedido.findFirst.mockResolvedValue({ id: 'p1', status: 'ACEITO' });
    await expect(pedidoService.atualizarStatus('p1', cliente, 'CANCELADO')).rejects.toMatchObject({ status: 403 });
    prismaMock.pedido.findFirst.mockResolvedValue({ id: 'p1', status: 'PENDENTE' });
    await expect(pedidoService.atualizarStatus('p1', cliente, 'ACEITO')).rejects.toMatchObject({ status: 403 });
    prismaMock.pedido.update.mockResolvedValue({ id: 'p1', status: 'CANCELADO', valorTotal: '10', itens: [] });
    const ok = await pedidoService.atualizarStatus('p1', cliente, 'CANCELADO');
    expect(ok.status).toBe('CANCELADO');
  });

  it('restaurante não pula etapas do pedido (409)', async () => {
    prismaMock.pedido.findFirst.mockResolvedValue({ id: 'p1', status: 'PENDENTE' });
    await expect(
      pedidoService.atualizarStatus('p1', { sub: 'r1', tipo: 'RESTAURANTE' }, 'ENTREGUE'),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('isolamento entre restaurantes', () => {
  it('não edita nem exclui produto de outro restaurante', async () => {
    prismaMock.produto.findFirst.mockResolvedValue(null);
    await expect(produtoService.atualizar('rA', 'p1', { nome: 'Novo' })).rejects.toMatchObject({ status: 404 });
    await expect(produtoService.excluir('rA', 'p1')).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.produto.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'p1', restauranteId: 'rA' });
    expect(prismaMock.produto.update).not.toHaveBeenCalled();
  });
});
