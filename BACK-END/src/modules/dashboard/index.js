const express = require('express');
const { query } = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);
router.get('/summary', asyncHandler(async (req, res) => {
	const { rows } = await query(`
		SELECT
			(SELECT COALESCE(SUM(total), 0) FROM sales WHERE statut = 'validee' AND deleted_at IS NULL AND vendu_le::date = CURRENT_DATE) AS ventes_du_jour,
			(SELECT count(*)::int FROM products WHERE deleted_at IS NULL AND actif = TRUE) AS nombre_produits,
			(SELECT count(*)::int FROM v_stock_actuel WHERE en_alerte) AS nombre_alertes_stock,
			(SELECT COALESCE(SUM(solde_du), 0) FROM v_solde_clients WHERE solde_du > 0) AS creances_clients,
			(SELECT count(*)::int FROM purchase_orders WHERE statut IN ('brouillon', 'envoye', 'partiel') AND deleted_at IS NULL) AS achats_en_cours`);
	return res.json({ data: rows[0] });
}));
module.exports = router;