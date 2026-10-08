export interface ItemParaCalculo {
  precoUnitario: number;
  quantidade: number;
}

/** Calcula o total usando centavos para evitar erros de ponto flutuante. */
export function calcularTotal(itens: ItemParaCalculo[]): number {
  const centavos = itens.reduce(
    (soma, item) => soma + Math.round(item.precoUnitario * 100) * item.quantidade,
    0,
  );
  return centavos / 100;
}

const TRANSICOES: Record<string, string[]> = {
  PENDENTE: ['ACEITO', 'CANCELADO'],
  ACEITO: ['EM_PREPARACAO', 'CANCELADO'],
  EM_PREPARACAO: ['SAIU_PARA_ENTREGA', 'CANCELADO'],
  SAIU_PARA_ENTREGA: ['ENTREGUE', 'CANCELADO'],
  ENTREGUE: [],
  CANCELADO: [],
};

export function transicaoValida(atual: string, novo: string): boolean {
  return (TRANSICOES[atual] ?? []).includes(novo);
}
