import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { authDe } from '../utils/requestAuth';

export async function registrarUsuario(req: Request, res: Response) {
  res.status(201).json(await authService.registrarUsuario(req.body));
}

export async function loginUsuario(req: Request, res: Response) {
  res.json(await authService.loginUsuario(req.body));
}

export async function solicitarRestaurante(req: Request, res: Response) {
  const { restaurante, emailEnviado } = await authService.solicitarRestaurante(req.body);
  res.status(201).json({
    restaurante,
    emailEnviado,
    mensagem: 'Solicitação enviada! Você receberá um e-mail quando ela for analisada.',
  });
}

export async function loginRestaurante(req: Request, res: Response) {
  res.json(await authService.loginRestaurante(req.body));
}

export async function me(req: Request, res: Response) {
  res.json(await authService.obterSessao(authDe(req)));
}

export async function atualizarPerfil(req: Request, res: Response) {
  const auth = authDe(req);
  if (auth.tipo === 'USUARIO') {
    res.json({ tipo: 'USUARIO', usuario: await authService.atualizarPerfilUsuario(auth.sub, req.body) });
  } else {
    res.json({ tipo: 'RESTAURANTE', restaurante: await authService.atualizarPerfilRestaurante(auth.sub, req.body) });
  }
}
