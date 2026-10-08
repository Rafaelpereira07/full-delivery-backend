import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { rotaNaoEncontrada, tratarErros } from "./middlewares/error";
import { routes } from "./routes";

export const app = express();

app.use(helmet());
const origemFrontend = new URL(env.frontendUrl).origin;
const hostnameFrontend = new URL(origemFrontend).hostname;
const projetoVercel = hostnameFrontend.endsWith(".vercel.app")
  ? hostnameFrontend.slice(0, -".vercel.app".length)
  : null;
const regexProjetoVercel = projetoVercel
  ? new RegExp(
      `^https://${projetoVercel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[a-z0-9-]+\\.vercel\\.app$`,
      "i",
    )
  : null;
const origensPermitidas = new Set([
  origemFrontend,
  ...(!env.isProd ? ["http://127.0.0.1:5173"] : []),
]);

app.use(
  cors({
    origin: (origin, callback) => {
      const permitido =
        !origin ||
        origensPermitidas.has(origin) ||
        Boolean(regexProjetoVercel?.test(origin));
      callback(null, permitido);
    },
  }),
);
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api", routes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);
