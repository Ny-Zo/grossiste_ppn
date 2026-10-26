const ariaryFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'MGA',
  maximumFractionDigits: 0
});

export function formatAriary(amount = 0) {
  return ariaryFormatter.format(Number(amount) || 0);
}