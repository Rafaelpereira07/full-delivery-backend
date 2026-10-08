import { Request, Response } from 'express';
import * as pedidoService from '../services/pedido.service';
import { authDe, paramId } from '../utils/requestAuth';

export async function criar(req: Request, res: Response) {
  res.status(201).json(await pedidoService.criar(authDe(req).sub, req.body));
}

export async function listar(req: Request, res: Response) {
  res.json(await pedidoService.listar(authDe(req)));
}

export async function buscar(req: Request, res: Response) {
  res.json(await pedidoService.buscar(paramId(req), authDe(req)));
}

export async function atualizarStatus(req: Request, res: Response) {
  res.json(await pedidoService.atualizarStatus(paramId(req), authDe(req), req.body.status));
}
