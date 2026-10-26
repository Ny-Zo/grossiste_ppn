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
		SELECT session.id, session.user_id, device.nom AS appareil, session.statut, session.ouverte_le, session.cloturee_le,
					 session.montant_ouverture, expected.montant_attendu, session.montant_compte, session.ecart,
					 session.notes, session.user_id
			FROM cash_sessions session JOIN devices device ON device.id = session.device_id
			JOIN v_caisse_attendue expected ON expected.cash_session_id = session.id
		 WHERE session.deleted_at IS NULL AND ($1::uuid IS NULL OR session.user_id = $1)
		 ORDER BY session.ouverte_le DESC LIMIT 100`,
		[req.user.role === 'caissier' ? req.user.id : null]);
	return res.json({ data: rows });
}));

const updateSchema = z.object({
	montant_compte: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
	notes: z.string().trim().max(1000).nullable().optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'Aucun champ à modifier.' });

registerCrudRoutes(router, {
	table: 'cash_sessions',
	fields: { montant_compte: 'montant_compte', notes: 'notes' },
	schema: updateSchema,
	roles: ['admin', 'gerant', 'caissier'],
	scopeToUser: true,
	deleteCondition: "statut = 'cloturee'"
});

module.exports = router;