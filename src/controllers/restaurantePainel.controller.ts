import { Request, Response } from 'express';
import * as produtoService from '../services/produto.service';
import * as restauranteService from '../services/restaurante.service';
import { authDe, paramId } from '../utils/requestAuth';

// O id do restaurante SEMPRE vem do token, nunca do body/params.

export async function resumo(req: Request, res: Response) {
  res.json(await restauranteService.resumoDoRestaurante(authDe(req).sub));
}

export async function listarProdutos(req: Request, res: Response) {
  res.json(await produtoService.listarDoRestaurante(authDe(req).sub));
}

export async function criarProduto(req: Request, res: Response) {
  res.status(201).json(await produtoService.criar(authDe(req).sub, req.body));
}

export async function atualizarProduto(req: Request, res: Response) {
  res.json(await produtoService.atualizar(authDe(req).sub, paramId(req), req.body));
}

export async function excluirProduto(req: Request, res: Response) {
  await produtoService.excluir(authDe(req).sub, paramId(req));
  res.status(204).send();
}
