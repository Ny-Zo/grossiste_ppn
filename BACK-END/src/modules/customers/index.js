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
		SELECT balance.customer_id AS id, balance.nom, customer.telephone, balance.plafond_credit,
				 customer.adresse,
					 balance.total_ventes, balance.total_paye, balance.solde_du
			FROM v_solde_clients balance JOIN customers customer ON customer.id = balance.customer_id
		 ORDER BY balance.nom LIMIT 200`);
	return res.json({ data: rows });
}));

const updateSchema = z.object({
	nom: z.string().trim().min(2).max(160).optional(),
	telephone: z.string().trim().max(40).nullable().optional(),
	adresse: z.string().trim().max(1000).nullable().optional(),
	plafond_credit: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'Aucun champ à modifier.' });

registerCrudRoutes(router, {
	table: 'customers',
	fields: { nom: 'nom', telephone: 'telephone', adresse: 'adresse', plafond_credit: 'plafond_credit' },
	schema: updateSchema,
	roles: ['admin', 'gerant']
});

module.exports = router;