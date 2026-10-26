const test = require('node:test');
const assert = require('node:assert/strict');
const { productSchema, updateProductSchema } = require('../modules/products/schema');

test('product schema applies safe defaults and normalizes an empty code', () => {
  const product = productSchema.parse({ nom: 'Riz rouge', code: '' });

  assert.equal(product.unite_base, 'kg');
  assert.equal(product.actif, true);
  assert.equal(product.code, null);
});

test('product schema rejects negative prices and alert thresholds', () => {
  assert.equal(productSchema.safeParse({ nom: 'Huile', prix_achat_moyen: -1 }).success, false);
  assert.equal(productSchema.safeParse({ nom: 'Huile', seuil_alerte: -1 }).success, false);
});

test('product update accepts partial changes but rejects an empty patch', () => {
  assert.equal(updateProductSchema.safeParse({ nom: 'Huile de tournesol' }).success, true);
  assert.equal(updateProductSchema.safeParse({}).success, false);
});