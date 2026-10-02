export const STATUS = {
  NOVO: { label: 'Novo', emoji: '🆕' },
  EM_PREPARACAO: { label: 'Em preparação', emoji: '👩‍🍳' },
  PRONTO: { label: 'Pronto', emoji: '✅' },
  SAIU_PARA_ENTREGA: { label: 'Saiu para entrega', emoji: '🛵' },
  ENTREGUE: { label: 'Entregue', emoji: '💜' },
  CANCELADO: { label: 'Cancelado', emoji: '❌' },
};
export const FLOW_DELIVERY = ['NOVO', 'EM_PREPARACAO', 'PRONTO', 'SAIU_PARA_ENTREGA', 'ENTREGUE'];
export const FLOW_PICKUP = ['NOVO', 'EM_PREPARACAO', 'PRONTO', 'ENTREGUE'];
export const flowFor = (fulfillment) => (fulfillment === 'pickup' ? FLOW_PICKUP : FLOW_DELIVERY);
export const isFinal = (s) => s === 'ENTREGUE' || s === 'CANCELADO';
export const PAYMENT_LABELS = { pix: 'PIX', cash: 'Dinheiro', credit: 'Cartão de crédito', debit: 'Cartão de débito' };
