import { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import * as iaService from '../services/ia.service';
import * as interacaoService from '../services/interacao.service';
import * as produtoService from '../services/produto.service';
import * as restauranteService from '../services/restaurante.service';
import { authDe, paramId } from '../utils/requestAuth';

export async function categorias(_req: Request, res: Response) {
  res.json(await produtoService.listarCategorias());
}

export async function listarRestaurantes(req: Request, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : undefined;
  res.json(await restauranteService.listarAprovados(q || undefined));
}

export async function buscarRestaurante(req: Request, res: Response) {
  res.json(await restauranteService.buscarAprovado(paramId(req)));
}

export async function home(_req: Request, res: Response) {
  res.json(await produtoService.home());
}

export async function buscarProdutos(req: Request, res: Response) {
  res.json(await produtoService.buscar(req.query));
}

export async function detalheProduto(req: Request, res: Response) {
  res.json(await produtoService.detalhe(paramId(req)));
}

export async function dadosIA(req: Request, res: Response) {
  const dados = await iaService.obterDadosIA(paramId(req));
  if (!dados) throw new AppError('Dados de IA indisponíveis para este produto', 404);
  res.json(dados);
}

export async function criarInteracao(req: Request, res: Response) {
  res.status(201).json(await interacaoService.criar(authDe(req).sub, paramId(req), req.body));
}
