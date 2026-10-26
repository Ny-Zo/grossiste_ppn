import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader.jsx';
import { apiRequest } from '../../api/client.js';
import { localDb } from '../../db/local.js';
import { formatAriary } from '../../lib/formatAriary.js';

export default function Products() {
  const [search, setSearch] = useState('');
  const cached = useLiveQuery(() => localDb.products.orderBy('nom').toArray(), [], []);
  const query = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const result = await apiRequest('/products');
      await localDb.products.bulkPut(result.data);
      return result;
    },
    enabled: Boolean(localStorage.getItem('grossiste.token')),
    retry: false
  });
  const allProducts = query.data?.data || cached || [];
  const normalizedSearch = search.trim().toLocaleLowerCase('fr');
  const products = allProducts.filter((product) =>
    [product.nom, product.code, product.categorie].some((value) =>
      String(value || '').toLocaleLowerCase('fr').includes(normalizedSearch)
    )
  );

  return <>
    <PageHeader eyebrow="CATALOGUE" title="Produits" />
    <div className="table-toolbar"><div><strong>{products.length}</strong> article{products.length === 1 ? '' : 's'} {query.isError && <span className="cache-hint">· affichage du cache local</span>}</div><label className="search-field"><span>⌕</span><input aria-label="Rechercher un produit" placeholder="Rechercher un article" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>PRODUIT</th><th>CATÉGORIE</th><th>UNITÉ</th><th>PRIX D’ACHAT MOYEN</th><th>STOCK D’ALERTE</th></tr></thead><tbody>{products.length ? products.map((product) => <tr key={product.id}><td><strong>{product.nom}</strong><small>{product.code || 'Sans code'}</small></td><td>{product.categorie || '—'}</td><td>{product.unite_base || '—'}</td><td>{formatAriary(product.prix_achat_moyen)}</td><td>{product.seuil_alerte ?? '—'}</td></tr>) : <tr><td colSpan="5" className="table-empty">{query.isPending && localStorage.getItem('grossiste.token') ? 'Chargement du catalogue…' : 'Aucun produit. Connectez-vous au serveur ou ajoutez des données pour commencer.'}</td></tr>}</tbody></table></div>
  </>;
}