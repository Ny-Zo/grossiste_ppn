const { pool } = require('../config/db');

const ids = {
  products: {
    rice: '90000000-0000-4000-8000-000000000001',
    oil: '90000000-0000-4000-8000-000000000002',
    sugar: '90000000-0000-4000-8000-000000000003',
    flour: '90000000-0000-4000-8000-000000000004',
    soap: '90000000-0000-4000-8000-000000000005',
    milk: '90000000-0000-4000-8000-000000000006'
  },
  units: {
    riceKg: '90000000-0000-4000-8000-000000001001',
    riceSack: '90000000-0000-4000-8000-000000001002',
    oilLitre: '90000000-0000-4000-8000-000000001003',
    oilCarton: '90000000-0000-4000-8000-000000001004',
    sugarKg: '90000000-0000-4000-8000-000000001005',
    flourKg: '90000000-0000-4000-8000-000000001006',
    soapPiece: '90000000-0000-4000-8000-000000001007',
    milkCan: '90000000-0000-4000-8000-000000001008'
  },
  suppliers: {
    tanjona: '90000000-0000-4000-8000-000000002001',
    tsarasaotra: '90000000-0000-4000-8000-000000002002'
  },
  customers: {
    tsena: '90000000-0000-4000-8000-000000003001',
    rija: '90000000-0000-4000-8000-000000003002',
    feno: '90000000-0000-4000-8000-000000003003'
  },
  orders: {
    first: '90000000-0000-4000-8000-000000004001',
    second: '90000000-0000-4000-8000-000000004002'
  },
  receipts: { first: '90000000-0000-4000-8000-000000005001' },
  sessions: {
    closed: '90000000-0000-4000-8000-000000006001',
    open: '90000000-0000-4000-8000-000000006002'
  },
  sales: {
    first: '90000000-0000-4000-8000-000000007001',
    second: '90000000-0000-4000-8000-000000007002',
    third: '90000000-0000-4000-8000-000000007003'
  }
};

const productRows = [
  ['rice', 'Riz Makalioka démo', 'DEMO-RIZ-001', 'Riz', 'kg', 30, 3300, false],
  ['oil', 'Huile végétale démo', 'DEMO-HUI-001', 'Huiles', 'litre', 24, 7800, false],
  ['sugar', 'Sucre blanc démo', 'DEMO-SUC-001', 'Sucre et sel', 'kg', 40, 3900, false],
  ['flour', 'Farine de blé démo', 'DEMO-FAR-001', 'Farines', 'kg', 25, 2700, true],
  ['soap', 'Savon de ménage démo', 'DEMO-SAV-001', 'Savons et détergents', 'pièce', 20, 1600, false],
  ['milk', 'Lait concentré démo', 'DEMO-CON-001', 'Conserves', 'pièce', 18, 5200, true]
];

async function insertById(client, table, columns, values) {
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  await client.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
    values
  );
}

async function seedDemoData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: users } = await client.query(
      `SELECT id FROM users WHERE role = 'admin' AND actif = TRUE AND deleted_at IS NULL ORDER BY created_at LIMIT 1`
    );
    if (!users[0]) throw new Error('Créez d’abord le compte administrateur depuis le frontend.');
    const userId = users[0].id;

    const categoryNames = [...new Set(productRows.map(([, , , category]) => category))];
    const { rows: categories } = await client.query(
      'SELECT id, nom FROM categories WHERE nom = ANY($1::varchar[]) AND deleted_at IS NULL',
      [categoryNames]
    );
    const categoryIds = new Map(categories.map(({ id, nom }) => [nom, id]));
    if (categoryIds.size !== categoryNames.length) throw new Error('Les catégories de base sont absentes. Exécutez database/schema.sql.');

    let { rows: devices } = await client.query(
      'SELECT id FROM devices WHERE prefixe_facture = $1 AND actif = TRUE LIMIT 1',
      ['C1']
    );
    if (!devices[0]) {
      const result = await client.query(
        `INSERT INTO devices (id, nom, prefixe_facture) VALUES ($1, $2, $3)
         ON CONFLICT (prefixe_facture) DO UPDATE SET actif = TRUE RETURNING id`,
        ['90000000-0000-4000-8000-000000000101', 'Caisse démo', 'C1']
      );
      devices = result.rows;
    }
    const deviceId = devices[0].id;

    for (const [key, nom, code, category, unit, threshold, cost, perishable] of productRows) {
      await insertById(client, 'products',
        ['id', 'category_id', 'nom', 'code', 'unite_base', 'seuil_alerte', 'prix_achat_moyen', 'gere_peremption'],
        [ids.products[key], categoryIds.get(category), nom, code, unit, threshold, cost, perishable]);
    }

    const units = [
      ['riceKg', 'rice', 'kg', 1, 4200, 4800], ['riceSack', 'rice', 'sac', 50, 195000, 220000],
      ['oilLitre', 'oil', 'litre', 1, 9500, 11000], ['oilCarton', 'oil', 'carton', 12, 108000, 126000],
      ['sugarKg', 'sugar', 'kg', 1, 4800, 5500], ['flourKg', 'flour', 'kg', 1, 3500, 4100],
      ['soapPiece', 'soap', 'pièce', 1, 2200, 2800], ['milkCan', 'milk', 'pièce', 1, 6800, 7900]
    ];
    for (const [unitKey, productKey, nom, factor, wholesale, retail] of units) {
      await insertById(client, 'product_units',
        ['id', 'product_id', 'nom', 'facteur_conversion', 'prix_gros', 'prix_detail'],
        [ids.units[unitKey], ids.products[productKey], nom, factor, wholesale, retail]);
    }

    await insertById(client, 'suppliers', ['id', 'nom', 'telephone', 'adresse'],
      [ids.suppliers.tanjona, 'Grossiste Tanjona (démo)', '034 00 000 11', 'Analakely, Antananarivo']);
    await insertById(client, 'suppliers', ['id', 'nom', 'telephone', 'adresse'],
      [ids.suppliers.tsarasaotra, 'Distribution Tsarasaotra (démo)', '033 00 000 22', 'Ankorondrano, Antananarivo']);

    await insertById(client, 'customers', ['id', 'nom', 'telephone', 'adresse', 'plafond_credit'],
      [ids.customers.tsena, 'Épicerie Tsena Soa (démo)', '034 11 222 33', 'Isotry, Antananarivo', 500000]);
    await insertById(client, 'customers', ['id', 'nom', 'telephone', 'adresse', 'plafond_credit'],
      [ids.customers.rija, 'Rija Rakoto (démo)', '032 22 333 44', 'Ambohijatovo, Antananarivo', 250000]);
    await insertById(client, 'customers', ['id', 'nom', 'telephone', 'adresse', 'plafond_credit'],
      [ids.customers.feno, 'Feno Market (démo)', '038 33 444 55', 'Behoririka, Antananarivo', 750000]);

    await insertById(client, 'purchase_orders',
      ['id', 'numero', 'supplier_id', 'user_id', 'statut', 'total', 'commande_le', 'notes'],
      [ids.orders.first, 'DEMO-ACH-001', ids.suppliers.tanjona, userId, 'recu', 1320000, new Date().toISOString().slice(0, 10), 'Commande de démonstration']);
    await insertById(client, 'purchase_orders',
      ['id', 'numero', 'supplier_id', 'user_id', 'statut', 'total', 'commande_le', 'notes'],
      [ids.orders.second, 'DEMO-ACH-002', ids.suppliers.tsarasaotra, userId, 'envoye', 660000, new Date().toISOString().slice(0, 10), 'Commande en attente (démo)']);

    const purchaseItems = [
      ['90000000-0000-4000-8000-000000004101', ids.orders.first, ids.products.rice, ids.units.riceSack, 4, 195000],
      ['90000000-0000-4000-8000-000000004102', ids.orders.first, ids.products.oil, ids.units.oilCarton, 5, 108000],
      ['90000000-0000-4000-8000-000000004103', ids.orders.second, ids.products.sugar, ids.units.sugarKg, 100, 4800],
      ['90000000-0000-4000-8000-000000004104', ids.orders.second, ids.products.flour, ids.units.flourKg, 50, 3600]
    ];
    for (const [id, orderId, productId, unitId, quantity, price] of purchaseItems) {
      await insertById(client, 'purchase_order_items',
        ['id', 'purchase_order_id', 'product_id', 'unit_id', 'quantite', 'prix_unitaire'],
        [id, orderId, productId, unitId, quantity, price]);
    }

    await insertById(client, 'goods_receipts',
      ['id', 'numero', 'purchase_order_id', 'supplier_id', 'device_id', 'recu_par', 'total', 'recu_le', 'notes'],
      [ids.receipts.first, 'DEMO-REC-001', ids.orders.first, ids.suppliers.tanjona, deviceId, userId, 1320000, new Date().toISOString(), 'Réception complète (démo)']);
    await client.query(
      'UPDATE goods_receipts SET total = $2 WHERE id = $1 AND deleted_at IS NULL',
      [ids.receipts.first, 1320000]
    );
    const receiptItems = [
      ['90000000-0000-4000-8000-000000005101', ids.products.rice, ids.units.riceSack, 4, 195000, null],
      ['90000000-0000-4000-8000-000000005102', ids.products.oil, ids.units.oilCarton, 5, 108000, null]
    ];
    for (const [id, productId, unitId, quantity, price, expiry] of receiptItems) {
      await insertById(client, 'goods_receipt_items',
        ['id', 'goods_receipt_id', 'product_id', 'unit_id', 'quantite', 'prix_unitaire', 'date_peremption'],
        [id, ids.receipts.first, productId, unitId, quantity, price, expiry]);
    }

    await insertById(client, 'cash_sessions',
      ['id', 'device_id', 'user_id', 'statut', 'ouverte_le', 'montant_ouverture', 'cloturee_le', 'montant_attendu', 'montant_compte', 'ecart', 'notes'],
      [ids.sessions.closed, deviceId, userId, 'cloturee', new Date(Date.now() - 86400000).toISOString(), 200000, new Date(Date.now() - 86400000 + 28800000).toISOString(), 86000, 83000, -3000, 'Clôture de démonstration']);
    await client.query(
      'UPDATE cash_sessions SET montant_attendu = $2, montant_compte = $3, ecart = $4 WHERE id = $1 AND deleted_at IS NULL',
      [ids.sessions.closed, 86000, 83000, -3000]
    );
    await insertById(client, 'cash_sessions',
      ['id', 'device_id', 'user_id', 'statut', 'ouverte_le', 'montant_ouverture', 'notes'],
      [ids.sessions.open, deviceId, userId, 'ouverte', new Date().toISOString(), 150000, 'Session ouverte de démonstration']);

    const sales = [
      [ids.sales.first, 'DEMO-C1-2026-001', ids.customers.tsena, ids.sessions.closed, 90000, 0, 90000, -86400000],
      [ids.sales.second, 'DEMO-C1-2026-002', ids.customers.rija, ids.sessions.closed, 95000, 5000, 90000, -82800000],
      [ids.sales.third, 'DEMO-C1-2026-003', ids.customers.feno, ids.sessions.open, 62000, 2000, 60000, 0]
    ];
    for (const [id, number, customerId, sessionId, subtotal, discount, total, offset] of sales) {
      await insertById(client, 'sales',
        ['id', 'numero', 'customer_id', 'device_id', 'user_id', 'cash_session_id', 'statut', 'sous_total', 'remise', 'total', 'vendu_le', 'notes'],
        [id, number, customerId, deviceId, userId, sessionId, 'validee', subtotal, discount, total, new Date(Date.now() + offset).toISOString(), 'Vente de démonstration']);
    }

    const saleItems = [
      ['90000000-0000-4000-8000-000000007101', ids.sales.first, ids.products.rice, ids.units.riceKg, 20, 4500, 3300],
      ['90000000-0000-4000-8000-000000007102', ids.sales.second, ids.products.oil, ids.units.oilLitre, 10, 9500, 7800],
      ['90000000-0000-4000-8000-000000007103', ids.sales.third, ids.products.soap, ids.units.soapPiece, 20, 2500, 1600],
      ['90000000-0000-4000-8000-000000007104', ids.sales.third, ids.products.milk, ids.units.milkCan, 4, 3000, 5200]
    ];
    for (const [id, saleId, productId, unitId, quantity, price, cost] of saleItems) {
      await insertById(client, 'sale_items',
        ['id', 'sale_id', 'product_id', 'unit_id', 'quantite', 'prix_unitaire', 'cout_unitaire'],
        [id, saleId, productId, unitId, quantity, price, cost]);
    }

    const payments = [
      ['90000000-0000-4000-8000-000000007201', ids.sales.first, ids.customers.tsena, ids.sessions.closed, 90000, 'especes'],
      ['90000000-0000-4000-8000-000000007202', ids.sales.second, ids.customers.rija, ids.sessions.closed, 50000, 'mvola'],
      ['90000000-0000-4000-8000-000000007203', ids.sales.third, ids.customers.feno, ids.sessions.open, 60000, 'especes']
    ];
    for (const [id, saleId, customerId, sessionId, amount, method] of payments) {
      await insertById(client, 'payments',
        ['id', 'sale_id', 'customer_id', 'cash_session_id', 'montant', 'mode', 'user_id'],
        [id, saleId, customerId, sessionId, amount, method, userId]);
    }

    const movements = [
      ['90000000-0000-4000-8000-000000008001', ids.products.rice, 'achat', 200, 'goods_receipt', ids.receipts.first, 'Réception démo'],
      ['90000000-0000-4000-8000-000000008002', ids.products.rice, 'vente', -20, 'sale', ids.sales.first, 'Vente démo'],
      ['90000000-0000-4000-8000-000000008003', ids.products.oil, 'achat', 60, 'goods_receipt', ids.receipts.first, 'Réception démo'],
      ['90000000-0000-4000-8000-000000008004', ids.products.oil, 'vente', -10, 'sale', ids.sales.second, 'Vente démo'],
      ['90000000-0000-4000-8000-000000008005', ids.products.sugar, 'achat', 100, 'purchase_order', ids.orders.second, 'Stock initial démo'],
      ['90000000-0000-4000-8000-000000008006', ids.products.flour, 'achat', 50, 'purchase_order', ids.orders.second, 'Stock initial démo'],
      ['90000000-0000-4000-8000-000000008007', ids.products.soap, 'ajustement', 120, 'demo', null, 'Stock initial démo'],
      ['90000000-0000-4000-8000-000000008008', ids.products.milk, 'achat', 48, 'demo', null, 'Stock initial démo'],
      ['90000000-0000-4000-8000-000000008009', ids.products.soap, 'vente', -20, 'sale', ids.sales.third, 'Vente démo'],
      ['90000000-0000-4000-8000-000000008010', ids.products.milk, 'vente', -4, 'sale', ids.sales.third, 'Vente démo'],
      ['90000000-0000-4000-8000-000000008011', ids.products.sugar, 'perte', -80, 'demo', null, 'Perte de stock démo']
    ];
    for (const [id, productId, type, quantity, referenceType, referenceId, motif] of movements) {
      await insertById(client, 'stock_movements',
        ['id', 'product_id', 'type', 'quantite_base', 'reference_type', 'reference_id', 'device_id', 'user_id', 'motif'],
        [id, productId, type, quantity, referenceType, referenceId, deviceId, userId, motif]);
    }

    const cashMovements = [
      ['90000000-0000-4000-8000-000000006101', ids.sessions.closed, 'entree', 'Fond de caisse supplémentaire (démo)', 30000],
      ['90000000-0000-4000-8000-000000006102', ids.sessions.closed, 'sortie', 'Transport livraison (démo)', 12000],
      ['90000000-0000-4000-8000-000000006103', ids.sessions.open, 'entree', 'Apport caisse (démo)', 20000]
    ];
    for (const [id, sessionId, type, reason, amount] of cashMovements) {
      await insertById(client, 'cash_movements',
        ['id', 'cash_session_id', 'type', 'motif', 'montant', 'user_id'],
        [id, sessionId, type, reason, amount, userId]);
    }

    const { rows: expenseCategories } = await client.query(
      'SELECT id, nom FROM expense_categories WHERE nom = ANY($1::varchar[]) AND deleted_at IS NULL',
      [['Loyer', 'Transport', 'Électricité et eau']]
    );
    const expenseCategoryIds = new Map(expenseCategories.map(({ id, nom }) => [nom, id]));
    const expenseRows = [
      ['90000000-0000-4000-8000-000000009001', 'Loyer', 'Loyer magasin (démo)', 180000, 'especes'],
      ['90000000-0000-4000-8000-000000009002', 'Transport', 'Livraison fournisseur (démo)', 25000, 'mvola'],
      ['90000000-0000-4000-8000-000000009003', 'Électricité et eau', 'Facture JIRAMA (démo)', 42000, 'especes']
    ];
    for (const [id, category, label, amount, method] of expenseRows) {
      const categoryId = expenseCategoryIds.get(category);
      if (!categoryId) throw new Error(`Catégorie de dépense absente: ${category}`);
      await insertById(client, 'expenses',
        ['id', 'expense_category_id', 'cash_session_id', 'libelle', 'montant', 'mode', 'user_id'],
        [id, categoryId, ids.sessions.closed, label, amount, method, userId]);
    }

    await insertById(client, 'supplier_payments',
      ['id', 'supplier_id', 'goods_receipt_id', 'cash_session_id', 'montant', 'mode', 'reference', 'user_id'],
      ['90000000-0000-4000-8000-000000009101', ids.suppliers.tanjona, ids.receipts.first, ids.sessions.closed, 600000, 'virement', 'DEMO-REG-001', userId]);

    const journalRows = [
      ['90000000-0000-4000-8000-000000010001', 'recette', 'Ventes comptoir (démo)', 90000, 'especes', 'sale', ids.sales.first],
      ['90000000-0000-4000-8000-000000010002', 'recette', 'Vente client Rija (démo)', 50000, 'mvola', 'payment', '90000000-0000-4000-8000-000000007202'],
      ['90000000-0000-4000-8000-000000010003', 'depense', 'Loyer magasin (démo)', 180000, 'especes', 'expense', '90000000-0000-4000-8000-000000009001'],
      ['90000000-0000-4000-8000-000000010004', 'depense', 'Paiement fournisseur partiel (démo)', 600000, 'virement', 'supplier_payment', '90000000-0000-4000-8000-000000009101'],
      ['90000000-0000-4000-8000-000000010005', 'recette', 'Apport de démonstration', 250000, null, 'manual', null]
    ];
    for (const [id, type, label, amount, method, referenceType, referenceId] of journalRows) {
      await insertById(client, 'journal_entries',
        ['id', 'date_ecriture', 'type', 'libelle', 'montant', 'mode', 'reference_type', 'reference_id'],
        [id, new Date().toISOString().slice(0, 10), type, label, amount, method, referenceType, referenceId]);
    }

    await client.query('COMMIT');
    console.log('Données démo ajoutées ou déjà présentes.');
    console.log('Produits: 6 · ventes: 3 · clients: 3 · commandes: 2 · réceptions: 1 · mouvements de stock: 11 · dépenses: 3 · écritures comptables: 5');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoData().catch((error) => {
  console.error('Seed de démonstration annulé:', error.message);
  process.exitCode = 1;
});