import "dotenv/config";

function obrigatoria(nome: string, padraoDev?: string): string {
  const valor = process.env[nome] ?? padraoDev;
  if (!valor) {
    throw new Error(
      `Variavel de ambiente ${nome} nao definida. Veja o arquivo .env.example`,
    );
  }
  return valor;
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  isProd,
  isTest: process.env.NODE_ENV === "test",
  port: Number(process.env.PORT ?? 3333),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  jwtSecret: obrigatoria(
    "JWT_SECRET",
    isProd ? undefined : "segredo-apenas-para-desenvolvimento",
  ),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  mail: {
    host: process.env.MAIL_HOST ?? "",
    port: Number(process.env.MAIL_PORT ?? 587),
    user: process.env.MAIL_USER ?? "",
    password: process.env.MAIL_PASSWORD ?? "",
    from: process.env.MAIL_FROM ?? "Delivery <nao-responda@delivery.local>",
  },
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: "gemini-3.6-flash",
};
