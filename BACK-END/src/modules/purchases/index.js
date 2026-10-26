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
		SELECT po.id, po.numero, supplier.nom AS fournisseur, po.statut::text AS statut, po.notes,
				 po.commande_le::timestamptz AS date_document, COALESCE(receipt.numero, '') AS reception,
				 COALESCE(items.total_lignes, po.total) AS total
			FROM purchase_orders po JOIN suppliers supplier ON supplier.id = po.supplier_id
			LEFT JOIN goods_receipts receipt ON receipt.purchase_order_id = po.id AND receipt.deleted_at IS NULL
			LEFT JOIN (SELECT purchase_order_id, SUM(quantite * prix_unitaire) AS total_lignes
						 FROM purchase_order_items WHERE deleted_at IS NULL GROUP BY purchase_order_id) items ON items.purchase_order_id = po.id
		 WHERE po.deleted_at IS NULL ORDER BY po.commande_le DESC LIMIT 100`);
	return res.json({ data: rows });
}));

const updateSchema = z.object({
	statut: z.enum(['brouillon', 'envoye', 'partiel', 'annule']).optional(),
	notes: z.string().trim().max(1000).nullable().optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'Aucun champ à modifier.' });

registerCrudRoutes(router, {
	table: 'purchase_orders',
	fields: { statut: 'statut', notes: 'notes' },
	schema: updateSchema,
	roles: ['admin', 'gerant', 'magasinier'],
	patchCondition: "statut <> 'recu'",
	deleteCondition: "statut <> 'recu'"
});

module.exports = router;