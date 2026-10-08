import { describe, expect, it } from 'vitest';
import { assinarToken, verificarToken } from '../src/utils/jwt';
import { calcularTotal, transicaoValida } from '../src/utils/pedido';
import { escapar, templateAprovado, templateNovaSolicitacao, templateRejeitado } from '../src/utils/emailTemplates';
import { criarInteracaoSchema, produtoSchema } from '../src/schemas';

describe('cálculo do pedido', () => {
  it('soma preço x quantidade sem erro de ponto flutuante', () => {
    expect(calcularTotal([{ precoUnitario: 0.1, quantidade: 3 }])).toBe(0.3);
    expect(
      calcularTotal([
        { precoUnitario: 49.9, quantidade: 2 },
        { precoUnitario: 24.5, quantidade: 1 },
      ]),
    ).toBe(124.3);
  });

  it('valida transições de status', () => {
    expect(transicaoValida('PENDENTE', 'ACEITO')).toBe(true);
    expect(transicaoValida('PENDENTE', 'ENTREGUE')).toBe(false);
    expect(transicaoValida('ENTREGUE', 'CANCELADO')).toBe(false);
  });
});

describe('JWT', () => {
  it('assina e verifica o payload', () => {
    const token = assinarToken({ sub: 'abc', tipo: 'USUARIO', role: 'ADMIN' });
    const payload = verificarToken(token);
    expect(payload.sub).toBe('abc');
    expect(payload.role).toBe('ADMIN');
  });

  it('rejeita token adulterado', () => {
    const token = assinarToken({ sub: 'abc', tipo: 'USUARIO', role: 'CLIENTE' });
    expect(() => verificarToken(token + 'x')).toThrow();
  });
});

describe('templates de e-mail', () => {
  it('usa os assuntos exigidos', () => {
    const dados = { nome: 'X', decididoEm: new Date(), loginUrl: 'http://x' };
    expect(templateAprovado(dados).assunto).toBe('Seu restaurante foi aprovado!');
    expect(templateRejeitado({ nome: 'X', decididoEm: new Date() }).assunto).toBe(
      'Sua solicitação de restaurante foi rejeitada',
    );
    expect(
      templateNovaSolicitacao({ nome: 'X', responsavel: 'Y', email: 'a@b.c', telefone: '1', endereco: 'z', painelUrl: 'http://x' })
        .assunto,
    ).toBe('Nova solicitação de restaurante');
  });

  it('escapa HTML para evitar injeção', () => {
    expect(escapar('<script>"a"</script>')).not.toContain('<script>');
    const html = templateRejeitado({ nome: '<b>x</b>', decididoEm: new Date(), motivo: '<img src=x>' }).html;
    expect(html).not.toContain('<img src=x>');
  });
});

describe('validações Zod', () => {
  it('avaliação exige nota', () => {
    expect(criarInteracaoSchema.safeParse({ tipo: 'AVALIACAO', mensagem: 'ok bom' }).success).toBe(false);
    expect(criarInteracaoSchema.safeParse({ tipo: 'AVALIACAO', mensagem: 'ok bom', nota: 5 }).success).toBe(true);
    expect(criarInteracaoSchema.safeParse({ tipo: 'PERGUNTA', mensagem: 'tem sem glúten?' }).success).toBe(true);
  });

  it('produto rejeita preço negativo', () => {
    expect(produtoSchema.safeParse({ nome: 'Pizza', preco: -1, categoriaId: 1 }).success).toBe(false);
  });
});
