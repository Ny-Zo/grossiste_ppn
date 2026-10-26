import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader.jsx';
import { apiRequest } from '../../api/client.js';
import { localDb } from '../../db/local.js';
import { enqueueOperation, removeOperation } from '../../db/outbox.js';
import { formatAriary } from '../../lib/formatAriary.js';

const categories = ['Riz', 'Huiles', 'Sucre et sel', 'Farines', 'Savons et détergents', 'Conserves', 'Boissons', 'Autres'];

function ProductDialog({ dialog, onClose, onSave, onDelete, saving, error, canManage }) {
  if (!dialog) return null;
  const { mode, product } = dialog;
  const isView = mode === 'view';
  const isDelete = mode === 'delete';
  const title = mode === 'create' ? 'Nouveau produit' : mode === 'edit' ? 'Modifier le produit' : isDelete ? 'Supprimer le produit' : 'Fiche produit';

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">CATALOGUE PRODUITS</p><h2 id="product-dialog-title">{title}</h2></div>
          <button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}>×</button>
        </div>
        {isDelete && <div className="delete-confirmation"><p>Voulez-vous supprimer <strong>{product.nom}</strong> du catalogue ?</p><p>Le produit sera masqué du catalogue sans effacer les opérations enregistrées.</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="danger-button" type="button" disabled={saving} onClick={() => onDelete(product)}>Supprimer</button></div></div>}
        {isView && <><dl className="product-detail-list"><div><dt>Nom</dt><dd>{product.nom}</dd></div><div><dt>Code article</dt><dd>{product.code || 'Aucun code'}</dd></div><div><dt>Catégorie</dt><dd>{product.categorie || 'Autres'}</dd></div><div><dt>Unité de base</dt><dd>{product.unite_base}</dd></div><div><dt>Prix d’achat moyen</dt><dd>{formatAriary(product.prix_achat_moyen)}</dd></div><div><dt>Seuil d’alerte</dt><dd>{product.seuil_alerte} {product.unite_base}</dd></div>{product.stock_demo !== undefined && <div><dt>Stock de démonstration</dt><dd>{product.stock_demo} {product.unite_base}</dd></div>}<div><dt>Péremption suivie</dt><dd>{product.gere_peremption ? 'Oui' : 'Non'}</dd></div></dl><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Fermer</button>{canManage && <button className="primary-button" type="button" onClick={() => onSave(product)}>Modifier <span>→</span></button>}</div></>}
        {canManage && (mode === 'create' || mode === 'edit') && <form className="product-form" onSubmit={onSave}>
          <label>Nom du produit<input name="nom" required minLength="2" maxLength="160" defaultValue={product?.nom || ''} autoFocus /></label>
          <div className="form-two-columns"><label>Code article<input name="code" maxLength="60" defaultValue={product?.code || ''} placeholder="Ex. PPN-RIZ-001" /></label><label>Catégorie<select name="categorie" defaultValue={product?.categorie || 'Autres'}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
          <div className="form-two-columns"><label>Unité de base<select name="unite_base" defaultValue={product?.unite_base || 'kg'}><option value="kg">Kilogramme (kg)</option><option value="litre">Litre</option><option value="pièce">Pièce</option><option value="carton">Carton</option></select></label><label>Prix d’achat moyen (Ar)<input name="prix_achat_moyen" type="number" min="0" step="1" required defaultValue={product?.prix_achat_moyen ?? 0} /></label></div>
          <div className="form-two-columns"><label>Seuil d’alerte<input name="seuil_alerte" type="number" min="0" step="0.001" required defaultValue={product?.seuil_alerte ?? 0} /></label><label className="checkbox-field"><input name="gere_peremption" type="checkbox" defaultChecked={product?.gere_peremption || false} /><span>Suivre les dates de péremption</span></label></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'} <span>→</span></button></div>
        </form>}
      </section>
    </div>
  );
}

export default function Products() {
  const [search, setSearch] = useState('');
  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem('grossiste.user') || 'null'); } catch { currentUser = null; }
  const authenticated = Boolean(localStorage.getItem('grossiste.token'));
  const canManage = ['admin', 'gerant', 'magasinier'].includes(currentUser?.role);
  const cached = useLiveQuery(() => localDb.products.orderBy('nom').toArray(), [], []);
  const query = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const result = await apiRequest('/products');
      await localDb.products.bulkPut(result.data.map((product) => ({ ...product, sync_status: 'synced' })));
      return result;
    },
    enabled: Boolean(localStorage.getItem('grossiste.token')),
    retry: false
  });
  const categoryQuery = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => apiRequest('/products/categories'),
    enabled: Boolean(localStorage.getItem('grossiste.token')),
    retry: false
  });
    const [dialog, setDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const pendingCount = useLiveQuery(() => localDb.outbox.where('status').equals('pending').count(), [], 0);
    const demoProducts = [
      { id: 'demo-ppn-riz-001', nom: 'Riz Makalioka', code: 'PPN-RIZ-001', categorie: 'Riz', unite_base: 'kg', prix_achat_moyen: 3200, seuil_alerte: 50, gere_peremption: false, stock_demo: 186, data_demo: true },
      { id: 'demo-ppn-huile-002', nom: 'Huile végétale', code: 'PPN-HUI-002', categorie: 'Huiles', unite_base: 'litre', prix_achat_moyen: 7800, seuil_alerte: 24, gere_peremption: false, stock_demo: 42, data_demo: true },
      { id: 'demo-ppn-sucre-003', nom: 'Sucre blanc', code: 'PPN-SUC-003', categorie: 'Sucre et sel', unite_base: 'kg', prix_achat_moyen: 4100, seuil_alerte: 30, gere_peremption: false, stock_demo: 21, data_demo: true },
      { id: 'demo-ppn-farine-004', nom: 'Farine de blé T55', code: 'PPN-FAR-004', categorie: 'Farines', unite_base: 'kg', prix_achat_moyen: 2900, seuil_alerte: 40, gere_peremption: true, stock_demo: 73, data_demo: true },
      { id: 'demo-ppn-savon-005', nom: 'Savon de ménage', code: 'PPN-SAV-005', categorie: 'Savons et détergents', unite_base: 'pièce', prix_achat_moyen: 1800, seuil_alerte: 20, gere_peremption: false, stock_demo: 64, data_demo: true },
      { id: 'demo-ppn-lait-006', nom: 'Lait concentré', code: 'PPN-CON-006', categorie: 'Conserves', unite_base: 'pièce', prix_achat_moyen: 5400, seuil_alerte: 18, gere_peremption: true, stock_demo: 35, data_demo: true }
    ].map((product) => ({
      ...product,
      category_id: null,
      updated_at: '2026-10-26T08:00:00.000Z',
      sync_status: 'synced'
    }));

    async function ensureDemoProducts() {
      await localDb.transaction('rw', localDb.products, localDb.syncMeta, async () => {
        if (await localDb.syncMeta.get('demoProductsSeeded')) return;
        if (await localDb.products.count() === 0) {
          await localDb.products.bulkAdd(demoProducts);
        }
        await localDb.syncMeta.put({ key: 'demoProductsSeeded', value: true });
      });
    }

    useEffect(() => { ensureDemoProducts().catch(() => {}); }, []);

    const serverProducts = query.data?.data || [];
    const serverProductIds = new Set(serverProducts.map((product) => product.id));
    const localPendingProducts = (cached || []).filter((product) =>
      product.sync_status === 'pending' && !serverProductIds.has(product.id)
    );
    const catalogue = query.isSuccess ? [...serverProducts, ...localPendingProducts] : cached || [];
    const normalizedSearch = search.trim().toLocaleLowerCase('fr');
    const products = catalogue.filter((product) =>
      [product.nom, product.code, product.categorie].some((value) =>
        String(value || '').toLocaleLowerCase('fr').includes(normalizedSearch)
      )
    );

    function openDialog(mode, product = null) {
      setError('');
      setDialog({ mode, product });
    }

    async function saveProduct(eventOrProduct) {
      if (dialog.mode === 'view') {
        openDialog('edit', eventOrProduct);
        return;
      }
      eventOrProduct.preventDefault();
      setSaving(true);
      setError('');

      const form = new FormData(eventOrProduct.currentTarget);
      const previous = dialog.product;
      const isDemo = Boolean(previous?.data_demo);
      const categoryName = String(form.get('categorie'));
      const selectedCategory = categoryQuery.data?.data?.find((category) => category.nom === categoryName);
      const id = previous?.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const product = {
        ...previous,
        id,
        category_id: selectedCategory?.id || (previous?.categorie === categoryName ? previous.category_id : null),
        nom: String(form.get('nom')).trim(),
        code: String(form.get('code') || '').trim() || null,
        categorie: categoryName,
        unite_base: String(form.get('unite_base')),
        prix_achat_moyen: Number(form.get('prix_achat_moyen')),
        seuil_alerte: Number(form.get('seuil_alerte')),
        gere_peremption: form.get('gere_peremption') === 'on',
        data_demo: isDemo,
        sync_status: isDemo ? 'synced' : 'pending',
        updated_at: now
      };
      const operationId = isDemo ? null : await enqueueOperation(previous ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT', {
        id: product.id,
        nom: product.nom,
        code: product.code,
        category_id: product.category_id,
        unite_base: product.unite_base,
        prix_achat_moyen: product.prix_achat_moyen,
        seuil_alerte: product.seuil_alerte,
        gere_peremption: product.gere_peremption
      });

      try {
        await localDb.products.put(product);
        setDialog(null);
        setNotice('Produit enregistré sur cet appareil.');

        if (navigator.onLine && localStorage.getItem('grossiste.token') && !isDemo) {
          try {
            const payload = {
              nom: product.nom,
              code: product.code,
              category_id: product.category_id,
              unite_base: product.unite_base,
              prix_achat_moyen: product.prix_achat_moyen,
              seuil_alerte: product.seuil_alerte,
              gere_peremption: product.gere_peremption
            };
            const result = await apiRequest(previous ? `/products/${id}` : '/products', {
              method: previous ? 'PATCH' : 'POST',
              body: JSON.stringify(previous ? payload : { ...payload, id })
            });
            await localDb.products.put({ ...product, ...result.data, categorie: product.categorie, sync_status: 'synced' });
            if (operationId) await removeOperation(operationId);
            setNotice('Produit enregistré et synchronisé.');
          } catch {
            setNotice('Produit enregistré localement ; synchronisation en attente.');
          }
        }
      } catch {
        if (operationId) await removeOperation(operationId);
        setError('Impossible d’enregistrer ce produit dans la base locale.');
      } finally {
        setSaving(false);
      }
    }

    async function deleteProduct(product) {
      setSaving(true);
      const relatedOperations = (await localDb.outbox.toArray()).filter((operation) => operation.payload?.id === product.id);
      const localOnly = product.data_demo || relatedOperations.some((operation) => operation.type === 'CREATE_PRODUCT');
      const operationsToRemove = localOnly ? relatedOperations : relatedOperations.filter((operation) => operation.type === 'UPDATE_PRODUCT');
      await Promise.all(operationsToRemove.map((operation) => removeOperation(operation.id)));
      const operationId = localOnly ? null : await enqueueOperation('DELETE_PRODUCT', { id: product.id });
      try {
        await localDb.products.delete(product.id);
        setDialog(null);
        setNotice('Produit supprimé de cet appareil.');

        if (operationId && navigator.onLine && localStorage.getItem('grossiste.token')) {
          try {
            await apiRequest(`/products/${product.id}`, { method: 'DELETE' });
            await removeOperation(operationId);
            setNotice('Produit supprimé et synchronisé.');
          } catch {
            setNotice('Suppression locale effectuée ; synchronisation en attente.');
          }
        }
      } catch {
        if (operationId) await removeOperation(operationId);
        setError('Impossible de supprimer ce produit localement.');
      } finally {
        setSaving(false);
      }
    }

    return <>
      <PageHeader eyebrow="CATALOGUE" title="Produits">
        {canManage && <button className="primary-button compact-button" type="button" onClick={() => openDialog('create')}><span>+</span> Nouveau produit</button>}
      </PageHeader>
      <div className="catalogue-summary"><span>CATALOGUE LOCAL <strong>{products.length} PRODUIT{products.length === 1 ? '' : 'S'}</strong></span><span className="demo-label"><i /> DONNÉES DE DÉMONSTRATION</span></div>
      <div className="table-toolbar"><div><strong>{products.length}</strong> article{products.length === 1 ? '' : 's'} {query.isError && <span className="cache-hint">· mode local</span>}</div><label className="search-field"><span>⌕</span><input aria-label="Rechercher un produit" placeholder="Rechercher un article" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {notice && <div className="catalogue-notice" role="status"><span>{notice}</span><button type="button" aria-label="Fermer le message" onClick={() => setNotice('')}>×</button></div>}
      <div className="data-table-wrap"><table className="data-table product-table"><thead><tr><th>PRODUIT</th><th>CATÉGORIE</th><th>UNITÉ</th><th>PRIX D’ACHAT MOYEN</th><th>SEUIL D’ALERTE</th>{authenticated && <th>ACTIONS</th>}</tr></thead><tbody>{products.length ? products.map((product) => <tr key={product.id}><td><strong>{product.nom}</strong><small>{product.code || 'Sans code'} {product.data_demo && <span className="demo-row-tag">DÉMO</span>}</small></td><td>{product.categorie || 'Autres'}</td><td>{product.unite_base || '—'}</td><td>{formatAriary(product.prix_achat_moyen)}</td><td>{product.seuil_alerte ?? '—'} {product.unite_base}</td>{authenticated && <td><div className="row-actions"><button type="button" onClick={() => openDialog('view', product)}>Voir</button>{canManage && <><button type="button" onClick={() => openDialog('edit', product)}>Modifier</button><button type="button" className="delete-action" onClick={() => openDialog('delete', product)}>Supprimer</button></>}</div></td>}</tr>) : <tr><td colSpan={authenticated ? 6 : 5} className="table-empty">{search ? 'Aucun produit ne correspond à cette recherche.' : 'Chargement du catalogue local…'}</td></tr>}</tbody></table></div>
      <ProductDialog dialog={dialog} onClose={() => setDialog(null)} onSave={saveProduct} onDelete={deleteProduct} saving={saving} error={error} canManage={canManage} />
      {pendingCount > 0 && <p className="sync-footnote">{pendingCount} modification{pendingCount > 1 ? 's' : ''} en attente de synchronisation avec le serveur.</p>}
    </>;
}