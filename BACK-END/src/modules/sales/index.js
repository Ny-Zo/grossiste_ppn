const express = require('express');
const { z } = require('zod');
const { pool, query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { requireRoles } = require('../../middleware/roles');
const { validate } = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);
router.get('/', asyncHandler(async (req, res) => {
	const { rows } = await query(`
		SELECT s.id, s.numero, COALESCE(c.nom, 'Client de passage') AS client,
					 s.statut, s.sous_total, s.remise, s.total, s.vendu_le, s.notes, s.user_id,
					 COALESCE(p.montant_paye, 0) AS montant_paye,
					 s.total - COALESCE(p.montant_paye, 0) AS solde
			FROM sales s
			LEFT JOIN customers c ON c.id = s.customer_id
			LEFT JOIN (SELECT sale_id, SUM(montant) AS montant_paye FROM payments WHERE deleted_at IS NULL GROUP BY sale_id) p ON p.sale_id = s.id
		 WHERE s.deleted_at IS NULL AND ($1::uuid IS NULL OR s.user_id = $1)
		 ORDER BY s.vendu_le DESC LIMIT 100`,
		[req.user.role === 'caissier' ? req.user.id : null]);
	return res.json({ data: rows });
}));

const idSchema = z.object({ id: z.string().uuid() });
const updateSchema = z.object({
	notes: z.string().trim().max(1000).nullable().optional(),
	remise: z.coerce.number().int().min(0).optional()
}).refine((patch) => Object.keys(patch).length > 0, { message: 'Aucun champ à modifier.' });

router.patch('/:id', requireRoles('admin', 'gerant', 'caissier'), validate(idSchema, 'params'), validate(updateSchema), asyncHandler(async (req, res) => {
	const { id } = req.validated.params;
	const patch = req.validated.body;
	const ownership = req.user.role === 'caissier' ? ' AND user_id = $2' : '';
	const values = req.user.role === 'caissier' ? [id, req.user.id] : [id];
	const existing = await query(
		`SELECT sous_total, remise FROM sales WHERE id = $1 AND deleted_at IS NULL${ownership} LIMIT 1`,
		values
	);
	if (!existing.rows[0]) return res.status(404).json({ error: 'Vente introuvable ou accès refusé.' });

	const currentDiscount = Number(existing.rows[0].remise);
	const discount = patch.remise ?? currentDiscount;
	if (discount > Number(existing.rows[0].sous_total)) {
		return res.status(400).json({ error: 'La remise ne peut pas dépasser le sous-total.' });
	}

	const { rows } = await query(
		`UPDATE sales SET remise = $1, total = sous_total - $1,
						notes = CASE WHEN $2::boolean THEN $3 ELSE notes END
			WHERE id = $4 AND deleted_at IS NULL${req.user.role === 'caissier' ? ' AND user_id = $5' : ''}
			RETURNING id, numero, remise, total, notes`,
		req.user.role === 'caissier'
			? [discount, Object.hasOwn(patch, 'notes'), patch.notes ?? null, id, req.user.id]
			: [discount, Object.hasOwn(patch, 'notes'), patch.notes ?? null, id]
	);
	if (!rows[0]) return res.status(404).json({ error: 'Vente introuvable ou accès refusé.' });
	return res.json({ data: rows[0] });
}));

router.delete('/:id', requireRoles('admin', 'gerant', 'caissier'), validate(idSchema, 'params'), asyncHandler(async (req, res) => {
	const { id } = req.validated.params;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const ownership = req.user.role === 'caissier' ? ' AND user_id = $2' : '';
		const values = req.user.role === 'caissier' ? [id, req.user.id] : [id];
		const sale = await client.query(`SELECT id FROM sales WHERE id = $1 AND deleted_at IS NULL${ownership} FOR UPDATE`, values);
		if (!sale.rows[0]) {
			await client.query('ROLLBACK');
			return res.status(404).json({ error: 'Vente introuvable ou accès refusé.' });
		}

		const payments = await client.query('SELECT id FROM payments WHERE sale_id = $1 AND deleted_at IS NULL', [id]);
		const paymentIds = payments.rows.map((row) => row.id);
		await client.query("UPDATE sales SET deleted_at = now(), statut = 'annulee' WHERE id = $1", [id]);
		await client.query('UPDATE sale_items SET deleted_at = now() WHERE sale_id = $1 AND deleted_at IS NULL', [id]);
		await client.query('UPDATE payments SET deleted_at = now() WHERE sale_id = $1 AND deleted_at IS NULL', [id]);
		await client.query("UPDATE stock_movements SET deleted_at = now() WHERE reference_type = 'sale' AND reference_id = $1 AND deleted_at IS NULL", [id]);
		await client.query(
			`UPDATE journal_entries SET deleted_at = now()
				WHERE deleted_at IS NULL AND (reference_type = 'sale' AND reference_id = $1
					OR reference_type = 'payment' AND reference_id = ANY($2::uuid[]))`,
			[id, paymentIds]
		);
		await client.query('COMMIT');
		return res.status(204).end();
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
	}
}));

module.exports = router;