-- =====================================================================
--  GESTION GROSSISTE PPN : schéma PostgreSQL (13+)
--  Devise : Ariary (montants en BIGINT, sans décimales)
--  Quantités : NUMERIC(14,3) exprimées dans l'unité de base du produit
--  Offline-first : UUID générés côté client, server_seq pour le pull
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. TYPES ÉNUMÉRÉS
-- ---------------------------------------------------------------------
CREATE TYPE user_role          AS ENUM ('admin', 'gerant', 'caissier', 'magasinier');
CREATE TYPE po_status          AS ENUM ('brouillon', 'envoye', 'partiel', 'recu', 'annule');
CREATE TYPE movement_type      AS ENUM ('achat', 'vente', 'retour_client', 'retour_fournisseur',
                                        'ajustement', 'perte', 'inventaire');
CREATE TYPE sale_status        AS ENUM ('brouillon', 'validee', 'annulee');
CREATE TYPE payment_method     AS ENUM ('especes', 'mvola', 'orange_money', 'airtel_money',
                                        'cheque', 'virement');
CREATE TYPE cash_session_status AS ENUM ('ouverte', 'cloturee');
CREATE TYPE cash_movement_type AS ENUM ('entree', 'sortie');
CREATE TYPE journal_type       AS ENUM ('recette', 'depense');
CREATE TYPE count_status       AS ENUM ('en_cours', 'valide', 'annule');
CREATE TYPE sync_status        AS ENUM ('applique', 'rejete');

-- Séquence globale : chaque modification reçoit un numéro croissant.
-- Les appareils font GET /sync/pull?since=<dernier server_seq connu>.
CREATE SEQUENCE sync_seq;

-- ---------------------------------------------------------------------
-- 2. ACCÈS ET SÉCURITÉ
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                VARCHAR(120) NOT NULL,
    email              VARCHAR(160) NOT NULL UNIQUE,
    mot_de_passe_hash  TEXT         NOT NULL,
    role               user_role    NOT NULL,
    actif              BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            INTEGER      NOT NULL DEFAULT 1,
    server_seq         BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);

CREATE TABLE devices (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                VARCHAR(80)  NOT NULL,                 -- ex. "Caisse 1"
    prefixe_facture    VARCHAR(10)  NOT NULL UNIQUE,          -- ex. "C1"
    dernier_sync       TIMESTAMPTZ,
    dernier_server_seq BIGINT       NOT NULL DEFAULT 0,
    actif              BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id   UUID REFERENCES devices(id) ON DELETE SET NULL,
    action      VARCHAR(60)  NOT NULL,                        -- ex. 'PRIX_MODIFIE'
    entite      VARCHAR(60)  NOT NULL,                        -- nom de la table concernée
    entite_id   UUID,
    avant       JSONB,
    apres       JSONB,
    cree_le     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entite ON audit_logs (entite, entite_id);
CREATE INDEX idx_audit_user   ON audit_logs (user_id, cree_le DESC);

-- ---------------------------------------------------------------------
-- 3. CATALOGUE
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    version     INTEGER      NOT NULL DEFAULT 1,
    server_seq  BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);

CREATE TABLE products (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
    nom                VARCHAR(160) NOT NULL,
    code               VARCHAR(60)  UNIQUE,                   -- code interne ou code-barres
    unite_base         VARCHAR(20)  NOT NULL DEFAULT 'kg',    -- kg, litre, piece...
    seuil_alerte       NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (seuil_alerte >= 0),
    prix_achat_moyen   BIGINT       NOT NULL DEFAULT 0 CHECK (prix_achat_moyen >= 0), -- par unité de base
    gere_peremption    BOOLEAN      NOT NULL DEFAULT FALSE,
    actif              BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            INTEGER      NOT NULL DEFAULT 1,
    server_seq         BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_nom      ON products (nom);

-- Unités de vente/achat : 1 sac = 50 kg, 1 carton = 12 litres, etc.
CREATE TABLE product_units (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    nom                VARCHAR(40)  NOT NULL,                 -- sac, carton, kg, pièce
    facteur_conversion NUMERIC(14,3) NOT NULL CHECK (facteur_conversion > 0), -- nb d'unités de base
    prix_gros          BIGINT       NOT NULL DEFAULT 0 CHECK (prix_gros >= 0),
    prix_detail        BIGINT       NOT NULL DEFAULT 0 CHECK (prix_detail >= 0),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    version            INTEGER      NOT NULL DEFAULT 1,
    server_seq         BIGINT       NOT NULL DEFAULT nextval('sync_seq'),
    UNIQUE (product_id, nom)
);

-- ---------------------------------------------------------------------
-- 4. FOURNISSEURS ET ACHATS
-- ---------------------------------------------------------------------
CREATE TABLE suppliers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(160) NOT NULL,
    telephone   VARCHAR(40),
    adresse     TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    version     INTEGER      NOT NULL DEFAULT 1,
    server_seq  BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);

CREATE TABLE purchase_orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero       VARCHAR(40)  NOT NULL UNIQUE,
    supplier_id  UUID         NOT NULL REFERENCES suppliers(id),
    user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    statut       po_status    NOT NULL DEFAULT 'brouillon',
    total        BIGINT       NOT NULL DEFAULT 0 CHECK (total >= 0),
    commande_le  DATE         NOT NULL DEFAULT CURRENT_DATE,
    notes        TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    version      INTEGER      NOT NULL DEFAULT 1,
    server_seq   BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_po_supplier ON purchase_orders (supplier_id);

CREATE TABLE purchase_order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    unit_id         UUID NOT NULL REFERENCES product_units(id),
    quantite        NUMERIC(14,3) NOT NULL CHECK (quantite > 0),   -- dans l'unité choisie
    prix_unitaire   BIGINT        NOT NULL CHECK (prix_unitaire >= 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    version         INTEGER       NOT NULL DEFAULT 1,
    server_seq      BIGINT        NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_poi_po ON purchase_order_items (purchase_order_id);

CREATE TABLE goods_receipts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero            VARCHAR(40)  NOT NULL UNIQUE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id       UUID NOT NULL REFERENCES suppliers(id),
    device_id         UUID REFERENCES devices(id) ON DELETE SET NULL,
    recu_par          UUID REFERENCES users(id) ON DELETE SET NULL,
    total             BIGINT       NOT NULL DEFAULT 0 CHECK (total >= 0),
    recu_le           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    notes             TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,
    version           INTEGER      NOT NULL DEFAULT 1,
    server_seq        BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_gr_supplier ON goods_receipts (supplier_id);

CREATE TABLE goods_receipt_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES products(id),
    unit_id          UUID NOT NULL REFERENCES product_units(id),
    quantite         NUMERIC(14,3) NOT NULL CHECK (quantite > 0),
    prix_unitaire    BIGINT        NOT NULL CHECK (prix_unitaire >= 0),
    date_peremption  DATE,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    version          INTEGER       NOT NULL DEFAULT 1,
    server_seq       BIGINT        NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_gri_gr ON goods_receipt_items (goods_receipt_id);

-- ---------------------------------------------------------------------
-- 5. CLIENTS
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom            VARCHAR(160) NOT NULL,
    telephone      VARCHAR(40),
    adresse        TEXT,
    plafond_credit BIGINT       NOT NULL DEFAULT 0 CHECK (plafond_credit >= 0),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ,
    version        INTEGER      NOT NULL DEFAULT 1,
    server_seq     BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);

-- ---------------------------------------------------------------------
-- 6. CAISSE
-- ---------------------------------------------------------------------
CREATE TABLE cash_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id         UUID NOT NULL REFERENCES devices(id),
    user_id           UUID NOT NULL REFERENCES users(id),
    statut            cash_session_status NOT NULL DEFAULT 'ouverte',
    ouverte_le        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    montant_ouverture BIGINT       NOT NULL DEFAULT 0 CHECK (montant_ouverture >= 0),
    cloturee_le       TIMESTAMPTZ,
    montant_attendu   BIGINT,                                  -- calculé à la clôture
    montant_compte    BIGINT,                                  -- saisi par le caissier
    ecart             BIGINT,                                  -- compté - attendu
    notes             TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,
    version           INTEGER      NOT NULL DEFAULT 1,
    server_seq        BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);
-- Une seule session ouverte à la fois par appareil
CREATE UNIQUE INDEX uq_cash_session_ouverte
    ON cash_sessions (device_id) WHERE statut = 'ouverte' AND deleted_at IS NULL;

CREATE TABLE cash_movements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_session_id  UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    type             cash_movement_type NOT NULL,
    motif            VARCHAR(200) NOT NULL,
    montant          BIGINT       NOT NULL CHECK (montant > 0),
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    cree_le          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    version          INTEGER      NOT NULL DEFAULT 1,
    server_seq       BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_cash_mov_session ON cash_movements (cash_session_id);

-- ---------------------------------------------------------------------
-- 7. VENTES ET PAIEMENTS
-- ---------------------------------------------------------------------
CREATE TABLE sales (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero           VARCHAR(40)  NOT NULL UNIQUE,             -- ex. C1-2026-00042
    customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL, -- NULL = client de passage
    device_id        UUID NOT NULL REFERENCES devices(id),
    user_id          UUID NOT NULL REFERENCES users(id),
    cash_session_id  UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
    statut           sale_status  NOT NULL DEFAULT 'brouillon',
    sous_total       BIGINT       NOT NULL DEFAULT 0 CHECK (sous_total >= 0),
    remise           BIGINT       NOT NULL DEFAULT 0 CHECK (remise >= 0),
    total            BIGINT       NOT NULL DEFAULT 0 CHECK (total >= 0),
    vendu_le         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    notes            TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    version          INTEGER      NOT NULL DEFAULT 1,
    server_seq       BIGINT       NOT NULL DEFAULT nextval('sync_seq'),
    CHECK (total = sous_total - remise)
);
CREATE INDEX idx_sales_customer ON sales (customer_id);
CREATE INDEX idx_sales_date     ON sales (vendu_le);
CREATE INDEX idx_sales_session  ON sales (cash_session_id);

CREATE TABLE sale_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id        UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products(id),
    unit_id        UUID NOT NULL REFERENCES product_units(id),
    quantite       NUMERIC(14,3) NOT NULL CHECK (quantite > 0),
    prix_unitaire  BIGINT        NOT NULL CHECK (prix_unitaire >= 0),
    cout_unitaire  BIGINT        NOT NULL DEFAULT 0 CHECK (cout_unitaire >= 0), -- pour calculer la marge
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ,
    version        INTEGER       NOT NULL DEFAULT 1,
    server_seq     BIGINT        NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_sale_items_sale    ON sale_items (sale_id);
CREATE INDEX idx_sale_items_product ON sale_items (product_id);

-- Encaissements : lié à une vente, ou à un client (remboursement de dette)
CREATE TABLE payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id          UUID REFERENCES sales(id) ON DELETE SET NULL,
    customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
    cash_session_id  UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
    montant          BIGINT         NOT NULL CHECK (montant > 0),
    mode             payment_method NOT NULL,
    reference        VARCHAR(100),                             -- n° chèque, ID transaction mobile money
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    paye_le          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    version          INTEGER        NOT NULL DEFAULT 1,
    server_seq       BIGINT         NOT NULL DEFAULT nextval('sync_seq'),
    CHECK (sale_id IS NOT NULL OR customer_id IS NOT NULL)
);
CREATE INDEX idx_payments_sale     ON payments (sale_id);
CREATE INDEX idx_payments_customer ON payments (customer_id);
CREATE INDEX idx_payments_session  ON payments (cash_session_id);

-- Règlements fournisseurs
CREATE TABLE supplier_payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id      UUID NOT NULL REFERENCES suppliers(id),
    goods_receipt_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
    cash_session_id  UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
    montant          BIGINT         NOT NULL CHECK (montant > 0),
    mode             payment_method NOT NULL,
    reference        VARCHAR(100),
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    paye_le          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    version          INTEGER        NOT NULL DEFAULT 1,
    server_seq       BIGINT         NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_sp_supplier ON supplier_payments (supplier_id);

-- ---------------------------------------------------------------------
-- 8. STOCK (table centrale : le stock = somme des mouvements)
-- ---------------------------------------------------------------------
CREATE TABLE stock_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    type            movement_type NOT NULL,
    quantite_base   NUMERIC(14,3) NOT NULL CHECK (quantite_base <> 0), -- + entrée, - sortie
    reference_type  VARCHAR(40),                                -- 'sale', 'goods_receipt', 'stock_count'...
    reference_id    UUID,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    date_peremption DATE,
    motif           TEXT,
    mouvement_le    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    version         INTEGER       NOT NULL DEFAULT 1,
    server_seq      BIGINT        NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_sm_product   ON stock_movements (product_id, mouvement_le);
CREATE INDEX idx_sm_reference ON stock_movements (reference_type, reference_id);

-- Inventaire physique
CREATE TABLE stock_counts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero      VARCHAR(40)  NOT NULL UNIQUE,
    statut      count_status NOT NULL DEFAULT 'en_cours',
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    commence_le TIMESTAMPTZ  NOT NULL DEFAULT now(),
    valide_le   TIMESTAMPTZ,
    notes       TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    version     INTEGER      NOT NULL DEFAULT 1,
    server_seq  BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);

CREATE TABLE stock_count_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_count_id  UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantite_theorique NUMERIC(14,3) NOT NULL,                  -- stock système au moment du comptage
    quantite_comptee   NUMERIC(14,3) NOT NULL CHECK (quantite_comptee >= 0),
    ecart              NUMERIC(14,3) GENERATED ALWAYS AS (quantite_comptee - quantite_theorique) STORED,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    version         INTEGER       NOT NULL DEFAULT 1,
    server_seq      BIGINT        NOT NULL DEFAULT nextval('sync_seq'),
    UNIQUE (stock_count_id, product_id)
);

-- ---------------------------------------------------------------------
-- 9. COMPTABILITÉ
-- ---------------------------------------------------------------------
CREATE TABLE expense_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom         VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    version     INTEGER      NOT NULL DEFAULT 1,
    server_seq  BIGINT       NOT NULL DEFAULT nextval('sync_seq')
);

CREATE TABLE expenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_category_id UUID NOT NULL REFERENCES expense_categories(id),
    cash_session_id     UUID REFERENCES cash_sessions(id) ON DELETE SET NULL,
    libelle             VARCHAR(200)   NOT NULL,
    montant             BIGINT         NOT NULL CHECK (montant > 0),
    mode                payment_method NOT NULL DEFAULT 'especes',
    justificatif_url    TEXT,
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    depense_le          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    version             INTEGER        NOT NULL DEFAULT 1,
    server_seq          BIGINT         NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_expenses_date ON expenses (depense_le);

-- Journal des recettes/dépenses, alimenté par ventes, paiements, achats, dépenses
CREATE TABLE journal_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_ecriture   DATE          NOT NULL DEFAULT CURRENT_DATE,
    type            journal_type  NOT NULL,
    libelle         VARCHAR(240)  NOT NULL,
    montant         BIGINT        NOT NULL CHECK (montant > 0),
    mode            payment_method,
    reference_type  VARCHAR(40),
    reference_id    UUID,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    version         INTEGER       NOT NULL DEFAULT 1,
    server_seq      BIGINT        NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX idx_journal_date ON journal_entries (date_ecriture, type);

-- ---------------------------------------------------------------------
-- 10. SYNCHRONISATION (idempotence des opérations hors ligne)
-- ---------------------------------------------------------------------
CREATE TABLE sync_operations (
    op_id       UUID PRIMARY KEY,                               -- généré par le client
    device_id   UUID NOT NULL REFERENCES devices(id),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    type        VARCHAR(60)  NOT NULL,                          -- 'CREATE_SALE', 'RECEIVE_GOODS'...
    payload     JSONB        NOT NULL,
    statut      sync_status  NOT NULL,
    erreur      TEXT,
    cree_le_client TIMESTAMPTZ NOT NULL,                        -- heure sur l'appareil
    recu_le     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_device ON sync_operations (device_id, recu_le);

-- ---------------------------------------------------------------------
-- 11. TRIGGERS
-- ---------------------------------------------------------------------

-- 11.1 À chaque insertion/modification : updated_at, version, server_seq
CREATE FUNCTION trg_sync_touch() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    NEW.server_seq := nextval('sync_seq');
    IF TG_OP = 'UPDATE' THEN
        NEW.version := OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users','categories','products','product_units','suppliers',
        'purchase_orders','purchase_order_items','goods_receipts','goods_receipt_items',
        'customers','cash_sessions','cash_movements','sales','sale_items','payments',
        'supplier_payments','stock_movements','stock_counts','stock_count_items',
        'expense_categories','expenses','journal_entries'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_touch BEFORE INSERT OR UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION trg_sync_touch()', t, t);
    END LOOP;
END $$;

-- 11.2 Un paiement lié à une vente hérite automatiquement du client de la vente
CREATE FUNCTION trg_payment_fill_customer() RETURNS trigger AS $$
BEGIN
    IF NEW.sale_id IS NOT NULL AND NEW.customer_id IS NULL THEN
        SELECT customer_id INTO NEW.customer_id FROM sales WHERE id = NEW.sale_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_fill_customer
    BEFORE INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION trg_payment_fill_customer();

-- ---------------------------------------------------------------------
-- 12. VUES (soldes et stock calculés, jamais stockés)
-- ---------------------------------------------------------------------

-- Stock actuel par produit (en unité de base)
CREATE VIEW v_stock_actuel AS
SELECT p.id AS product_id,
       p.nom,
       p.unite_base,
       p.seuil_alerte,
       COALESCE(SUM(m.quantite_base), 0) AS stock_base,
       COALESCE(SUM(m.quantite_base), 0) <= p.seuil_alerte AS en_alerte
FROM products p
LEFT JOIN stock_movements m
       ON m.product_id = p.id AND m.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id;

-- Créances clients = ventes validées - encaissements
CREATE VIEW v_solde_clients AS
SELECT c.id AS customer_id,
       c.nom,
       c.plafond_credit,
       COALESCE(v.total_ventes, 0)  AS total_ventes,
       COALESCE(p.total_paye, 0)    AS total_paye,
       COALESCE(v.total_ventes, 0) - COALESCE(p.total_paye, 0) AS solde_du
FROM customers c
LEFT JOIN (SELECT customer_id, SUM(total) AS total_ventes
           FROM sales
           WHERE statut = 'validee' AND deleted_at IS NULL
           GROUP BY customer_id) v ON v.customer_id = c.id
LEFT JOIN (SELECT customer_id, SUM(montant) AS total_paye
           FROM payments
           WHERE deleted_at IS NULL
           GROUP BY customer_id) p ON p.customer_id = c.id
WHERE c.deleted_at IS NULL;

-- Dettes fournisseurs = réceptions - règlements
CREATE VIEW v_solde_fournisseurs AS
SELECT s.id AS supplier_id,
       s.nom,
       COALESCE(r.total_recu, 0)  AS total_recu,
       COALESCE(p.total_paye, 0)  AS total_paye,
       COALESCE(r.total_recu, 0) - COALESCE(p.total_paye, 0) AS solde_du
FROM suppliers s
LEFT JOIN (SELECT supplier_id, SUM(total) AS total_recu
           FROM goods_receipts
           WHERE deleted_at IS NULL
           GROUP BY supplier_id) r ON r.supplier_id = s.id
LEFT JOIN (SELECT supplier_id, SUM(montant) AS total_paye
           FROM supplier_payments
           WHERE deleted_at IS NULL
           GROUP BY supplier_id) p ON p.supplier_id = s.id
WHERE s.deleted_at IS NULL;

-- Montant attendu en caisse par session (espèces uniquement)
CREATE VIEW v_caisse_attendue AS
SELECT cs.id AS cash_session_id,
       cs.montant_ouverture
         + COALESCE((SELECT SUM(montant) FROM payments
                      WHERE cash_session_id = cs.id AND mode = 'especes' AND deleted_at IS NULL), 0)
         + COALESCE((SELECT SUM(montant) FROM cash_movements
                      WHERE cash_session_id = cs.id AND type = 'entree' AND deleted_at IS NULL), 0)
         - COALESCE((SELECT SUM(montant) FROM cash_movements
                      WHERE cash_session_id = cs.id AND type = 'sortie' AND deleted_at IS NULL), 0)
         - COALESCE((SELECT SUM(montant) FROM expenses
                      WHERE cash_session_id = cs.id AND mode = 'especes' AND deleted_at IS NULL), 0)
         - COALESCE((SELECT SUM(montant) FROM supplier_payments
                      WHERE cash_session_id = cs.id AND mode = 'especes' AND deleted_at IS NULL), 0)
         AS montant_attendu
FROM cash_sessions cs;

-- Marge par produit (ventes validées)
CREATE VIEW v_marge_produits AS
SELECT pr.id AS product_id,
       pr.nom,
       SUM(si.quantite * pu.facteur_conversion)                          AS quantite_vendue_base,
       SUM(si.quantite * si.prix_unitaire)                               AS chiffre_affaires,
       SUM(si.quantite * si.cout_unitaire)                               AS cout_total,
       SUM(si.quantite * (si.prix_unitaire - si.cout_unitaire))          AS marge
FROM sale_items si
JOIN sales s          ON s.id = si.sale_id AND s.statut = 'validee' AND s.deleted_at IS NULL
JOIN products pr      ON pr.id = si.product_id
JOIN product_units pu ON pu.id = si.unit_id
WHERE si.deleted_at IS NULL
GROUP BY pr.id;

-- ---------------------------------------------------------------------
-- 13. DONNÉES DE DÉPART
-- ---------------------------------------------------------------------
INSERT INTO categories (nom) VALUES
    ('Riz'), ('Huiles'), ('Sucre et sel'), ('Farines'),
    ('Savons et détergents'), ('Conserves'), ('Boissons'), ('Autres');

INSERT INTO expense_categories (nom) VALUES
    ('Loyer'), ('Électricité et eau'), ('Salaires'), ('Transport'),
    ('Entretien et réparations'), ('Fournitures'), ('Taxes et impôts'), ('Autres');

INSERT INTO devices (nom, prefixe_facture) VALUES ('Caisse 1', 'C1');

COMMIT;
