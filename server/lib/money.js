/** Todos os valores trafegam em centavos (inteiros) para evitar erros de arredondamento. */
export const brl = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
