const express = require('express');
const { z } = require('zod');
const { query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { registerCrudRoutes } = require('../../utils/registerCrudRoutes');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);
router.get('/', asyncHandler(async (req, res) => {
	const { rows } = await query(`
		SELECT expense.id, expense.user_id, expense.libelle, expense.expense_category_id, category.nom AS categorie,
				 expense.montant, expense.mode, expense.depense_le, expense.user_id
			FROM expenses expense JOIN expense_categories category ON category.id = expense.expense_category_id
		 WHERE expense.deleted_at IS NULL AND ($1::uuid IS NULL OR expense.user_id = $1)
		 ORDER BY expense.depense_le DESC LIMIT 100`,
		[req.user.role === 'caissier' ? req.user.id : null]);
	return res.json({ data: rows });
}));

const updateSchema = z.object({
	libelle: z.string().trim().min(2).max(200).optional(),
	montant: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
	mode: z.enum(['especes', 'mvola', 'orange_money', 'airtel_money', 'cheque', 'virement']).optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'Aucun champ à modifier.' });

registerCrudRoutes(router, {
	table: 'expenses',
	fields: { libelle: 'libelle', montant: 'montant', mode: 'mode' },
	schema: updateSchema,
	roles: ['admin', 'gerant', 'caissier'],
	scopeToUser: true,
	afterDelete: async (client, id) => {
		await client.query("UPDATE journal_entries SET deleted_at = now() WHERE reference_type = 'expense' AND reference_id = $1 AND deleted_at IS NULL", [id]);
	}
});

module.exports = router;