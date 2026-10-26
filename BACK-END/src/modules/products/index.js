const express = require('express');
const { z } = require('zod');
const { query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

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

module.exports = router;