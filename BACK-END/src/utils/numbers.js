function formatInvoiceNumber(prefix, date, sequence) {
  if (!/^[A-Za-z0-9]{1,10}$/.test(prefix)) throw new TypeError('Préfixe de caisse invalide.');
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Date invalide.');
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new TypeError('Séquence invalide.');

  const year = date.getFullYear();
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

module.exports = { formatInvoiceNumber };