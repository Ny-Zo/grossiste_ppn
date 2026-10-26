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
		SELECT id, date_ecriture, type, libelle, montant, mode, reference_type,
				 (reference_type = 'manual') AS modifiable
			FROM journal_entries WHERE deleted_at IS NULL
		 ORDER BY date_ecriture DESC, created_at DESC LIMIT 200`);
	return res.json({ data: rows });
}));

const updateSchema = z.object({
	libelle: z.string().trim().min(2).max(240).optional(),
	montant: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
	mode: z.enum(['especes', 'mvola', 'orange_money', 'airtel_money', 'cheque', 'virement']).nullable().optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'Aucun champ à modifier.' });

registerCrudRoutes(router, {
	table: 'journal_entries',
	fields: { libelle: 'libelle', montant: 'montant', mode: 'mode' },
	schema: updateSchema,
	roles: ['admin', 'gerant'],
	patchCondition: "reference_type = 'manual'",
	deleteCondition: "reference_type = 'manual'"
});

module.exports = router;