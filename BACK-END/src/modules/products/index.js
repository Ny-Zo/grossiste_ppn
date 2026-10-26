const express = require('express');
const { z } = require('zod');
const { query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/roles');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { productSchema, updateProductSchema, productIdSchema } = require('./schema');

const router = express.Router();
const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

router.use(authenticate);

router.get('/categories', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT id, nom FROM categories WHERE deleted_at IS NULL ORDER BY nom'
  );
  return res.json({ data: rows });
}));

router.get('/', validate(listSchema, 'query'), asyncHandler(async (req, res) => {
  const { search = '', category_id: categoryId, limit } = req.validated.query;
  const { rows } = await query(
    `SELECT p.id, p.nom, p.code, p.unite_base, p.seuil_alerte, p.prix_achat_moyen,
            p.category_id, c.nom AS categorie
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.actif = TRUE
        AND ($1 = '' OR p.nom ILIKE '%' || $1 || '%' OR p.code ILIKE '%' || $1 || '%')
        AND ($2::uuid IS NULL OR p.category_id = $2)
      ORDER BY p.nom LIMIT $3`,
    [search, categoryId || null, limit]
  );
  return res.json({ data: rows });
}));

router.get('/:id', validate(productIdSchema, 'params'), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { rows } = await query(
    `SELECT p.id, p.nom, p.code, p.unite_base, p.seuil_alerte, p.prix_achat_moyen,
            p.gere_peremption, p.category_id, c.nom AS categorie
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
      WHERE p.id = $1 AND p.deleted_at IS NULL LIMIT 1`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Produit introuvable.' });
  return res.json({ data: rows[0] });
}));

router.post('/', requireRoles('admin', 'gerant', 'magasinier'), validate(productSchema), asyncHandler(async (req, res) => {
  const product = req.validated.body;
  const { rows } = await query(
    `INSERT INTO products (id, category_id, nom, code, unite_base, seuil_alerte,
                           prix_achat_moyen, gere_peremption, actif)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, nom, code, unite_base, seuil_alerte, prix_achat_moyen,
               gere_peremption, category_id, actif, created_at, updated_at`,
    [product.id || null, product.category_id ?? null, product.nom, product.code ?? null,
      product.unite_base, product.seuil_alerte, product.prix_achat_moyen,
      product.gere_peremption, product.actif]
  );
  return res.status(201).json({ data: rows[0] });
}));

router.patch('/:id', requireRoles('admin', 'gerant', 'magasinier'), validate(productIdSchema, 'params'), validate(updateProductSchema), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const product = req.validated.body;
  const fields = {
    category_id: 'category_id',
    nom: 'nom',
    code: 'code',
    unite_base: 'unite_base',
    seuil_alerte: 'seuil_alerte',
    prix_achat_moyen: 'prix_achat_moyen',
    gere_peremption: 'gere_peremption',
    actif: 'actif'
  };
  const entries = Object.entries(product);
  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${fields[key]} = $${index + 1}`);
  values.push(id);

  const { rows } = await query(
    `UPDATE products SET ${assignments.join(', ')}
      WHERE id = $${values.length} AND deleted_at IS NULL
      RETURNING id, nom, code, unite_base, seuil_alerte, prix_achat_moyen,
                gere_peremption, category_id, actif, created_at, updated_at`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: 'Produit introuvable.' });
  return res.json({ data: rows[0] });
}));

router.delete('/:id', requireRoles('admin', 'gerant', 'magasinier'), validate(productIdSchema, 'params'), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { rows } = await query(
    `UPDATE products SET deleted_at = now(), actif = FALSE
      WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Produit introuvable.' });
  return res.status(204).end();
}));

module.exports = router;