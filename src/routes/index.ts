import { NextFunction, Request, Response, Router } from 'express';
import * as admin from '../controllers/admin.controller';
import * as auth from '../controllers/auth.controller';
import * as catalogo from '../controllers/catalogo.controller';
import * as interacao from '../controllers/interacao.controller';
import * as pedido from '../controllers/pedido.controller';
import * as painel from '../controllers/restaurantePainel.controller';
import { autenticar, exigirRestauranteAprovado, exigirUsuario } from '../middlewares/auth';
import { limitarAutenticacao } from '../middlewares/rateLimit';
import { validar } from '../middlewares/validate';
import {
  atualizarPerfilRestauranteSchema,
  atualizarPerfilUsuarioSchema,
  buscaProdutosSchema,
  criarInteracaoSchema,
  criarPedidoSchema,
  emailInteracaoSchema,
  idSchema,
  loginSchema,
  produtoParcialSchema,
  produtoSchema,
  registrarUsuarioSchema,
  rejeitarRestauranteSchema,
  responderInteracaoSchema,
  solicitarRestauranteSchema,
  statusPedidoSchema,
  statusRestauranteQuerySchema,
} from '../schemas';
import { asyncHandler as h } from '../utils/asyncHandler';

export const routes = Router();

// ---------- Autenticação ----------
const authRouter = Router();
authRouter.post('/usuario/registrar', limitarAutenticacao, validar(registrarUsuarioSchema), h(auth.registrarUsuario));
authRouter.post('/usuario/login', limitarAutenticacao, validar(loginSchema), h(auth.loginUsuario));
authRouter.post('/restaurante/solicitar', limitarAutenticacao, validar(solicitarRestauranteSchema), h(auth.solicitarRestaurante));
authRouter.post('/restaurante/login', limitarAutenticacao, validar(loginSchema), h(auth.loginRestaurante));
authRouter.get('/me', autenticar, h(auth.me));
authRouter.put(
  '/perfil',
  autenticar,
  (req: Request, res: Response, next: NextFunction) =>
    validar(req.auth?.tipo === 'RESTAURANTE' ? atualizarPerfilRestauranteSchema : atualizarPerfilUsuarioSchema)(req, res, next),
  h(auth.atualizarPerfil),
);
routes.use('/auth', authRouter);

// ---------- Catálogo público ----------
routes.get('/categorias', h(catalogo.categorias));
routes.get('/restaurantes', h(catalogo.listarRestaurantes));
routes.get('/restaurantes/:id', validar(idSchema, 'params'), h(catalogo.buscarRestaurante));
routes.get('/produtos/home', h(catalogo.home));
routes.get('/produtos', validar(buscaProdutosSchema, 'query'), h(catalogo.buscarProdutos));
routes.get('/produtos/:id', validar(idSchema, 'params'), h(catalogo.detalheProduto));
routes.get('/produtos/:id/ia', validar(idSchema, 'params'), h(catalogo.dadosIA));
// Interagir exige login (requisito 6)
routes.post(
  '/produtos/:id/interacoes',
  autenticar,
  exigirUsuario('CLIENTE'),
  validar(idSchema, 'params'),
  validar(criarInteracaoSchema),
  h(catalogo.criarInteracao),
);

// ---------- Painel do restaurante ----------
const painelRouter = Router();
painelRouter.use(autenticar, exigirRestauranteAprovado);
painelRouter.get('/resumo', h(painel.resumo));
painelRouter.get('/produtos', h(painel.listarProdutos));
painelRouter.post('/produtos', validar(produtoSchema), h(painel.criarProduto));
painelRouter.put('/produtos/:id', validar(idSchema, 'params'), validar(produtoParcialSchema), h(painel.atualizarProduto));
painelRouter.delete('/produtos/:id', validar(idSchema, 'params'), h(painel.excluirProduto));
routes.use('/restaurante', painelRouter);

// ---------- Pedidos ----------
const pedidosRouter = Router();
pedidosRouter.use(autenticar);
pedidosRouter.post('/', exigirUsuario('CLIENTE'), validar(criarPedidoSchema), h(pedido.criar));
pedidosRouter.get('/', h(pedido.listar));
pedidosRouter.get('/:id', validar(idSchema, 'params'), h(pedido.buscar));
pedidosRouter.put('/:id/status', validar(idSchema, 'params'), validar(statusPedidoSchema), h(pedido.atualizarStatus));
routes.use('/pedidos', pedidosRouter);

// ---------- Interações ----------
function gestaoDeInteracoes(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.tipo === 'RESTAURANTE') return void exigirRestauranteAprovado(req, res, next);
  return exigirUsuario('ADMIN')(req, res, next);
}
const interacoesRouter = Router();
interacoesRouter.use(autenticar);
interacoesRouter.get('/minhas', exigirUsuario('CLIENTE'), h(interacao.minhas));
interacoesRouter.get('/', gestaoDeInteracoes, h(interacao.listar));
interacoesRouter.put('/:id/responder', gestaoDeInteracoes, validar(idSchema, 'params'), validar(responderInteracaoSchema), h(interacao.responder));
interacoesRouter.put('/:id/confirmar', gestaoDeInteracoes, validar(idSchema, 'params'), h(interacao.confirmar));
interacoesRouter.post('/:id/email', gestaoDeInteracoes, validar(idSchema, 'params'), validar(emailInteracaoSchema), h(interacao.enviarEmail));
interacoesRouter.delete('/:id', gestaoDeInteracoes, validar(idSchema, 'params'), h(interacao.excluir));
routes.use('/interacoes', interacoesRouter);

// ---------- Área restrita do administrador ----------
const adminRouter = Router();
adminRouter.use(autenticar, exigirUsuario('ADMIN'));
adminRouter.get('/dashboard', h(admin.dashboard));
adminRouter.get('/restaurantes', validar(statusRestauranteQuerySchema, 'query'), h(admin.listarRestaurantes));
adminRouter.put('/restaurantes/:id/aprovar', validar(idSchema, 'params'), h(admin.aprovar));
adminRouter.put('/restaurantes/:id/rejeitar', validar(idSchema, 'params'), validar(rejeitarRestauranteSchema), h(admin.rejeitar));
adminRouter.put('/restaurantes/:id/bloquear', validar(idSchema, 'params'), h(admin.bloquear));
adminRouter.put('/restaurantes/:id/desbloquear', validar(idSchema, 'params'), h(admin.desbloquear));
adminRouter.get('/usuarios', h(admin.usuarios));
adminRouter.get('/produtos', h(admin.produtos));
adminRouter.get('/pedidos', h(admin.pedidos));
routes.use('/admin', adminRouter);
