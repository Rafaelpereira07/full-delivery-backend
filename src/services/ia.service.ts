import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

export interface DadosIA {
  curiosidade: string;
  harmonizacao: string;
  origem: "IA";
  modelo: string;
  geradoEm: Date | null;
}

const respostaSchema = z.object({
  curiosidade: z.string().min(1).max(600),
  harmonizacao: z.string().min(1).max(600),
});

const cliente = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;
const emAndamento = new Map<string, Promise<DadosIA | null>>();

async function gerar(produtoId: string): Promise<DadosIA | null> {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    include: { categoria: true },
  });
  if (!produto) return null;

  if (produto.iaCuriosidade && produto.iaHarmonizacao) {
    return {
      curiosidade: produto.iaCuriosidade,
      harmonizacao: produto.iaHarmonizacao,
      origem: "IA",
      modelo: env.geminiModel,
      geradoEm: produto.iaGeradoEm,
    };
  }
  if (!cliente) return null;

  try {
    const completion = await cliente.models.generateContent({
      model: env.geminiModel,
      contents: `Prato: ${produto.nome}\nCategoria: ${produto.categoria.nome}\nDescrição: ${produto.descricao ?? "sem descrição"}\n\n"curiosidade": uma curiosidade verdadeira sobre o prato ou sua origem.\n"harmonizacao": uma sugestão de bebida ou acompanhamento que combine.`,
      config: {
        systemInstruction:
          'Você é um especialista em gastronomia. Responda SEMPRE em português do Brasil, apenas com um JSON no formato {"curiosidade": string, "harmonizacao": string}. Cada campo deve ter no máximo 2 frases curtas.',
        temperature: 0.7,
        maxOutputTokens: 800,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            curiosidade: { type: Type.STRING },
            harmonizacao: { type: Type.STRING },
          },
          required: ["curiosidade", "harmonizacao"],
        },
      },
    });
    const conteudo = completion.text;
    if (!conteudo) return null;
    let dados: z.infer<typeof respostaSchema>;
    try {
      dados = respostaSchema.parse(JSON.parse(conteudo));
    } catch (erro) {
      console.error("[ia] Resposta JSON inválida do Gemini.", {
        finishReason: completion.candidates?.[0]?.finishReason,
        finishMessage: completion.candidates?.[0]?.finishMessage,
        outputTokens: completion.usageMetadata?.candidatesTokenCount,
        erro: erro instanceof Error ? erro.message : String(erro),
      });
      return null;
    }
    const geradoEm = new Date();
    await prisma.produto.update({
      where: { id: produtoId },
      data: {
        iaCuriosidade: dados.curiosidade,
        iaHarmonizacao: dados.harmonizacao,
        iaGeradoEm: geradoEm,
      },
    });
    return { ...dados, origem: "IA", modelo: env.geminiModel, geradoEm };
  } catch (erro) {
    console.error(
      "[ia] Falha ao consultar o Gemini.",
      erro instanceof Error ? erro.message : String(erro),
    );
    return null;
  }
}

/** Retorna dados do cache ou consulta o Gemini. Nunca lança erro: null = IA indisponível. */
export function obterDadosIA(produtoId: string): Promise<DadosIA | null> {
  const existente = emAndamento.get(produtoId);
  if (existente) return existente;
  const promessa = gerar(produtoId).finally(() => emAndamento.delete(produtoId));
  emAndamento.set(produtoId, promessa);
  return promessa;
}
