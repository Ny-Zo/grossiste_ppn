function toDateOnly(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Date invalide.');
  return date.toISOString().slice(0, 10);
}

module.exports = { toDateOnly };