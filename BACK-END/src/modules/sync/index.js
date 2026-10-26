const express = require('express');
const { z } = require('zod');
const { query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
const pullSchema = z.object({ since: z.coerce.number().int().min(0).default(0) });

router.get('/pull', authenticate, validate(pullSchema, 'query'), asyncHandler(async (req, res) => {
	const { since } = req.validated.query;
	const { rows } = await query(
		`SELECT p.id, p.category_id, p.nom, p.code, p.unite_base, p.seuil_alerte,
						p.prix_achat_moyen, p.gere_peremption, p.actif, p.updated_at,
						c.nom AS categorie, p.server_seq
			 FROM products p
			 LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
			WHERE p.server_seq > $1 AND p.deleted_at IS NULL
			ORDER BY p.server_seq LIMIT 500`,
		[since]
	);
	const { rows: sequence } = await query('SELECT COALESCE(MAX(server_seq), 0) AS server_seq FROM products');
	return res.json({ products: rows, server_seq: Number(sequence[0].server_seq) });
}));

module.exports = router;