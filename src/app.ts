import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { rotaNaoEncontrada, tratarErros } from './middlewares/error';
import { routes } from './routes';

export const app = express();

app.use(helmet());
const origensPermitidas = env.isProd ? [env.frontendUrl] : [env.frontendUrl, 'http://127.0.0.1:5173'];
app.use(cors({ origin: origensPermitidas }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api', routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);
