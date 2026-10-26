const express = require('express');
const { z } = require('zod');
const { query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { registerCrudRoutes } = require('../../utils/registerCrudRoutes');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);
router.get('/movements', asyncHandler(async (req, res) => {
	const { rows } = await query(`
		SELECT movement.id, movement.product_id, product.nom, movement.type,
					 movement.quantite_base, movement.motif, movement.mouvement_le,
					 movement.reference_type, stock.stock_base AS stock_actuel
			FROM stock_movements movement
			JOIN products product ON product.id = movement.product_id
			JOIN v_stock_actuel stock ON stock.product_id = movement.product_id
		 WHERE movement.deleted_at IS NULL
		 ORDER BY movement.mouvement_le DESC LIMIT 200`);
	return res.json({ data: rows });
}));

router.get('/', asyncHandler(async (req, res) => {
	const { rows } = await query(`
		SELECT stock.product_id, product.code, stock.nom, category.nom AS categorie,
					 stock.unite_base, stock.stock_base, stock.seuil_alerte, stock.en_alerte
			FROM v_stock_actuel stock
			JOIN products product ON product.id = stock.product_id
			LEFT JOIN categories category ON category.id = product.category_id
		 ORDER BY stock.en_alerte DESC, stock.nom LIMIT 200`);
	return res.json({ data: rows });
}));

const movementSchema = z.object({
	type: z.enum(['achat', 'vente', 'retour_client', 'retour_fournisseur', 'ajustement', 'perte', 'inventaire']).optional(),
	quantite_base: z.coerce.number().refine((value) => value !== 0, { message: 'La quantité ne peut pas être nulle.' }).optional(),
	motif: z.string().trim().max(1000).nullable().optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'Aucun champ à modifier.' });

registerCrudRoutes(router, {
	table: 'stock_movements',
	fields: { type: 'type', quantite_base: 'quantite_base', motif: 'motif' },
	schema: movementSchema,
	roles: ['admin', 'gerant', 'magasinier'],
	patchCondition: "reference_type IN ('demo', 'inventaire')",
	deleteCondition: "reference_type IN ('demo', 'inventaire')"
});

module.exports = router;