import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import * as pedidoService from '../services/pedido.service';
import * as produtoService from '../services/produto.service';
import * as restauranteService from '../services/restaurante.service';
import { authDe, paramId } from '../utils/requestAuth';

export async function listarRestaurantes(req: Request, res: Response) {
  const status = req.query.status as 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'BLOQUEADO' | undefined;
  res.json(await restauranteService.listarParaAdmin(status));
}

export async function aprovar(req: Request, res: Response) {
  res.json(await restauranteService.aprovar(paramId(req)));
}

export async function rejeitar(req: Request, res: Response) {
  res.json(await restauranteService.rejeitar(paramId(req), req.body.motivo));
}

export async function bloquear(req: Request, res: Response) {
  res.json({ restaurante: await restauranteService.bloquear(paramId(req)) });
}

export async function desbloquear(req: Request, res: Response) {
  res.json({ restaurante: await restauranteService.desbloquear(paramId(req)) });
}

export async function usuarios(_req: Request, res: Response) {
  res.json(await dashboardService.listarClientes());
}

export async function produtos(_req: Request, res: Response) {
  res.json(await produtoService.listarTodosParaAdmin());
}

export async function pedidos(req: Request, res: Response) {
  res.json(await pedidoService.listar(authDe(req)));
}

export async function dashboard(_req: Request, res: Response) {
  res.json(await dashboardService.visaoGeral());
}
