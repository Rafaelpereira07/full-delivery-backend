export interface EmailMensagem {
  assunto: string;
  html: string;
  texto: string;
}

export function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moldura(titulo: string, corpo: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<div style="background:#d6361f;color:#fff;padding:16px 24px;font-size:18px;font-weight:bold">${escapar(titulo)}</div>
<div style="padding:24px;color:#1b2a34;line-height:1.5">${corpo}</div></div>`;
}

function dataBR(data: Date): string {
  return data.toLocaleString('pt-BR');
}

export function templateNovaSolicitacao(dados: {
  nome: string;
  responsavel: string;
  email: string;
  telefone: string;
  endereco: string;
  descricao?: string | null;
  painelUrl: string;
}): EmailMensagem {
  const html = moldura(
    'Nova solicitação de restaurante',
    `<p>Um novo restaurante aguarda aprovação.</p>
<ul>
<li><b>Restaurante:</b> ${escapar(dados.nome)}</li>
<li><b>Responsável:</b> ${escapar(dados.responsavel)}</li>
<li><b>E-mail:</b> ${escapar(dados.email)}</li>
<li><b>Telefone:</b> ${escapar(dados.telefone)}</li>
<li><b>Endereço:</b> ${escapar(dados.endereco)}</li>
<li><b>Descrição:</b> ${escapar(dados.descricao ?? '-')}</li>
</ul>
<p><a href="${escapar(dados.painelUrl)}">Abrir painel de solicitações</a></p>`,
  );
  const texto = `Nova solicitação de restaurante: ${dados.nome} (${dados.email}). Acesse ${dados.painelUrl}`;
  return { assunto: 'Nova solicitação de restaurante', html, texto };
}

export function templateAprovado(dados: { nome: string; decididoEm: Date; loginUrl: string }): EmailMensagem {
  const html = moldura(
    'Seu restaurante foi aprovado!',
    `<p>Olá! O restaurante <b>${escapar(dados.nome)}</b> foi <b style="color:#1f7a4d">APROVADO</b>.</p>
<p>Data da decisão: ${escapar(dataBR(dados.decididoEm))}</p>
<p>Você já pode entrar no painel e cadastrar seus produtos.</p>
<p><a href="${escapar(dados.loginUrl)}">Entrar no painel do restaurante</a></p>`,
  );
  const texto = `O restaurante ${dados.nome} foi APROVADO em ${dataBR(dados.decididoEm)}. Entre em ${dados.loginUrl}`;
  return { assunto: 'Seu restaurante foi aprovado!', html, texto };
}

export function templateRejeitado(dados: { nome: string; decididoEm: Date; motivo?: string | null }): EmailMensagem {
  const motivo = dados.motivo?.trim() || 'Nenhum motivo foi informado.';
  const html = moldura(
    'Sua solicitação de restaurante foi rejeitada',
    `<p>Olá! A solicitação do restaurante <b>${escapar(dados.nome)}</b> foi <b style="color:#d6361f">REJEITADA</b>.</p>
<p>Data da decisão: ${escapar(dataBR(dados.decididoEm))}</p>
<p><b>Motivo:</b> ${escapar(motivo)}</p>`,
  );
  const texto = `A solicitação do restaurante ${dados.nome} foi REJEITADA em ${dataBR(dados.decididoEm)}. Motivo: ${motivo}`;
  return { assunto: 'Sua solicitação de restaurante foi rejeitada', html, texto };
}

export function templateRespostaCliente(dados: {
  nomeCliente: string;
  produto: string;
  pergunta: string;
  mensagem: string;
}): EmailMensagem {
  const html = moldura(
    'Resposta sobre ' + dados.produto,
    `<p>Olá, ${escapar(dados.nomeCliente)}!</p>
<p><b>Sua mensagem:</b> ${escapar(dados.pergunta)}</p>
<p><b>Resposta:</b> ${escapar(dados.mensagem)}</p>`,
  );
  const texto = `Olá, ${dados.nomeCliente}! Sobre "${dados.produto}": ${dados.mensagem}`;
  return { assunto: `Resposta sobre ${dados.produto}`, html, texto };
}
