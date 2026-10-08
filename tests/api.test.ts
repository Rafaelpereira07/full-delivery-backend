import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { criarPrismaMock } from './helpers';

const prismaMock = criarPrismaMock();
vi.mock('../src/lib/prisma', () => ({ prisma: prismaMock }));

const { app } = await import('../src/app');
const { assinarToken } = await import('../src/utils/jwt');

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const tokenCliente = assinarToken({ sub: 'c1', tipo: 'USUARIO', role: 'CLIENTE' });
const tokenAdmin = assinarToken({ sub: 'a1', tipo: 'USUARIO', role: 'ADMIN' });
const tokenRestaurante = assinarToken({ sub: 'r1', tipo: 'RESTAURANTE' });

describe('autenticação e autorização HTTP', () => {
  it('rota protegida sem token retorna 401', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });

  it('token inválido retorna 401', async () => {
    const r = await request(app).get('/api/auth/me').set(bearer('lixo'));
    expect(r.status).toBe(401);
  });

  it('cliente não acessa área admin (403)', async () => {
    const r = await request(app).get('/api/admin/dashboard').set(bearer(tokenCliente));
    expect(r.status).toBe(403);
  });

  it('restaurante não acessa área admin (403)', async () => {
    const r = await request(app).put('/api/admin/restaurantes/11111111-1111-4111-8111-111111111111/aprovar').set(bearer(tokenRestaurante));
    expect(r.status).toBe(403);
  });

  it('admin acessa a lista de restaurantes', async () => {
    prismaMock.restaurante.findMany.mockResolvedValue([]);
    const r = await request(app).get('/api/admin/restaurantes?status=PENDENTE').set(bearer(tokenAdmin));
    expect(r.status).toBe(200);
  });

  it('visitante não pode interagir com produto (401)', async () => {
    const r = await request(app)
      .post('/api/produtos/11111111-1111-4111-8111-111111111111/interacoes')
      .send({ tipo: 'PERGUNTA', mensagem: 'Oi, tudo bem?' });
    expect(r.status).toBe(401);
  });

  it('restaurante não aprovado é barrado no painel (403)', async () => {
    prismaMock.restaurante.findUnique.mockResolvedValue({ status: 'BLOQUEADO' });
    const r = await request(app).get('/api/restaurante/produtos').set(bearer(tokenRestaurante));
    expect(r.status).toBe(403);
  });

  it('cliente não cria produto (403)', async () => {
    const r = await request(app).post('/api/restaurante/produtos').set(bearer(tokenCliente)).send({});
    expect(r.status).toBe(403);
  });

  it('cadastro com dados inválidos retorna 422', async () => {
    const r = await request(app).post('/api/auth/usuario/registrar').send({ nome: 'A', email: 'x', senha: '1' });
    expect(r.status).toBe(422);
  });

  it('rota inexistente retorna 404 em JSON', async () => {
    const r = await request(app).get('/api/nada');
    expect(r.status).toBe(404);
    expect(r.body.erro).toBeTruthy();
  });
});
