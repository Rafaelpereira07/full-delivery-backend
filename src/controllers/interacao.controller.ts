import { Request, Response } from 'express';
import * as interacaoService from '../services/interacao.service';
import { authDe, paramId } from '../utils/requestAuth';

export async function minhas(req: Request, res: Response) {
  res.json(await interacaoService.listarDoUsuario(authDe(req).sub));
}

export async function listar(req: Request, res: Response) {
  res.json(await interacaoService.listarParaGestao(authDe(req)));
}

export async function responder(req: Request, res: Response) {
  res.json(await interacaoService.responder(paramId(req), authDe(req), req.body.resposta));
}

export async function confirmar(req: Request, res: Response) {
  res.json(await interacaoService.confirmar(paramId(req), authDe(req)));
}

export async function excluir(req: Request, res: Response) {
  await interacaoService.excluir(paramId(req), authDe(req));
  res.status(204).send();
}

export async function enviarEmail(req: Request, res: Response) {
  await interacaoService.enviarEmailAoCliente(paramId(req), authDe(req), req.body.mensagem);
  res.json({ mensagem: 'E-mail enviado' });
}
