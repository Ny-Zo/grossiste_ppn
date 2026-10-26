import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { apiRequest } from '../api/client.js';
import { formatAriary } from '../lib/formatAriary.js';

const views = {
  pos: {
    endpoint: '/sales',
    description: 'Ventes enregistrées dans PostgreSQL.',
    roles: ['admin', 'gerant', 'caissier'],
    fields: [['remise', 'Remise (Ar)', 'number'], ['notes', 'Notes', 'textarea']],
    columns: [['numero', 'N° VENTE'], ['client', 'CLIENT'], ['statut', 'STATUT'], ['total', 'TOTAL', 'money'], ['montant_paye', 'PAYÉ', 'money'], ['vendu_le', 'DATE', 'date']]
  },
  stock: {
    endpoint: '/stock/movements',
    mutationEndpoint: '/stock',
    description: 'Mouvements de stock et niveau actuel calculé.',
    roles: ['admin', 'gerant', 'magasinier'],
    fields: [['type', 'Type', 'select', ['achat', 'vente', 'retour_client', 'retour_fournisseur', 'ajustement', 'perte', 'inventaire']], ['quantite_base', 'Quantité (+ entrée, - sortie)', 'number'], ['motif', 'Motif', 'textarea']],
    columns: [['nom', 'PRODUIT'], ['type', 'MOUVEMENT'], ['quantite_base', 'QUANTITÉ', 'quantity'], ['stock_actuel', 'STOCK ACTUEL', 'quantity'], ['motif', 'MOTIF'], ['mouvement_le', 'DATE', 'date']]
  },
  purchases: {
    endpoint: '/purchases',
    description: 'Commandes et réceptions fournisseurs.',
    roles: ['admin', 'gerant', 'magasinier'],
    fields: [['statut', 'Statut', 'select', ['brouillon', 'envoye', 'partiel', 'annule']], ['notes', 'Notes', 'textarea']],
    columns: [['numero', 'N° COMMANDE'], ['fournisseur', 'FOURNISSEUR'], ['statut', 'STATUT'], ['reception', 'RÉCEPTION'], ['total', 'TOTAL', 'money'], ['date_document', 'DATE', 'date']]
  },
  customers: {
    endpoint: '/customers',
    description: 'Clients, plafonds de crédit et soldes.',
    roles: ['admin', 'gerant'],
    fields: [['nom', 'Nom', 'text'], ['telephone', 'Téléphone', 'text'], ['adresse', 'Adresse', 'textarea'], ['plafond_credit', 'Plafond de crédit (Ar)', 'number']],
    columns: [['nom', 'CLIENT'], ['telephone', 'TÉLÉPHONE'], ['plafond_credit', 'PLAFOND', 'money'], ['total_ventes', 'ACHATS', 'money'], ['total_paye', 'PAYÉ', 'money'], ['solde_du', 'SOLDE', 'money']]
  },
  cash: {
    endpoint: '/cash',
    description: 'Sessions de caisse et montants attendus.',
    roles: ['admin', 'gerant', 'caissier'],
    fields: [['montant_compte', 'Montant compté (Ar)', 'number'], ['notes', 'Notes', 'textarea']],
    columns: [['appareil', 'APPAREIL'], ['statut', 'STATUT'], ['montant_ouverture', 'FOND INITIAL', 'money'], ['montant_attendu', 'ATTENDU', 'money'], ['montant_compte', 'COMPTÉ', 'money'], ['ouverte_le', 'OUVERTE LE', 'date']]
  },
  expenses: {
    endpoint: '/expenses',
    description: 'Dépenses enregistrées dans le journal.',
    roles: ['admin', 'gerant', 'caissier'],
    fields: [['libelle', 'Libellé', 'text'], ['montant', 'Montant (Ar)', 'number'], ['mode', 'Mode de paiement', 'select', ['especes', 'mvola', 'orange_money', 'airtel_money', 'cheque', 'virement']]],
    columns: [['libelle', 'DÉPENSE'], ['categorie', 'CATÉGORIE'], ['montant', 'MONTANT', 'money'], ['mode', 'MODE'], ['depense_le', 'DATE', 'date']]
  },
  accounting: {
    endpoint: '/accounting',
    description: 'Journal comptable des recettes et dépenses.',
    roles: ['admin', 'gerant'],
    fields: [['libelle', 'Libellé', 'text'], ['montant', 'Montant (Ar)', 'number'], ['mode', 'Mode de paiement', 'select', ['especes', 'mvola', 'orange_money', 'airtel_money', 'cheque', 'virement']]],
    columns: [['date_ecriture', 'DATE', 'date'], ['type', 'TYPE'], ['libelle', 'LIBELLÉ'], ['montant', 'MONTANT', 'money'], ['mode', 'MODE'], ['reference_type', 'SOURCE']]
  }
};

function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money') return formatAriary(value);
  if (type === 'quantity') return Number(value).toLocaleString('fr-FR');
  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
  }
  if (type === 'alert') return value ? 'À réapprovisionner' : 'Normal';
  return String(value).replaceAll('_', ' ');
}

function getSessionUser() {
  try { return JSON.parse(localStorage.getItem('grossiste.user') || 'null'); }
  catch { return null; }
}

function RowDialog({ dialog, view, onClose, onSave, onDelete, busy, error }) {
  if (!dialog) return null;
  const { mode, row } = dialog;
  const heading = mode === 'edit' ? 'Modifier' : mode === 'delete' ? 'Supprimer' : 'Détails';

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="row-dialog-title">
      <div className="dialog-heading"><div><p className="eyebrow">{view.endpoint.toUpperCase()}</p><h2 id="row-dialog-title">{heading}</h2></div><button className="icon-button" type="button" aria-label="Fermer" onClick={onClose}>×</button></div>
      {mode === 'view' && <><dl className="product-detail-list">{view.columns.filter(([key]) => key in row).map(([key, label, type]) => <div key={key}><dt>{label}</dt><dd>{formatCell(row[key], type)}</dd></div>)}</dl><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Fermer</button></div></>}
      {mode === 'delete' && <div className="delete-confirmation"><p>Confirmer la suppression de cet enregistrement ?</p><p>Il sera archivé logiquement afin de conserver l’historique des opérations liées.</p><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="danger-button" type="button" disabled={busy} onClick={onDelete}>Supprimer</button></div></div>}
      {mode === 'edit' && <form className="product-form" onSubmit={onSave}>{view.fields.filter(([key]) => key in row || key === 'notes' || key === 'adresse').map(([key, label, type, options]) => <label key={key}>{label}{type === 'select' ? <select name={key} defaultValue={row[key] ?? options[0]}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : type === 'textarea' ? <textarea name={key} rows="3" defaultValue={row[key] || ''} /> : <input name={key} type={type} min={type === 'number' && key !== 'quantite_base' ? '0' : undefined} step={type === 'number' ? '1' : undefined} defaultValue={row[key] ?? ''} />}</label>)}{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'} <span>→</span></button></div></form>}
    </section>
  </div>;
}

export default function FeaturePage({ title, feature }) {
  const view = views[feature];
  const authenticated = Boolean(localStorage.getItem('grossiste.token'));
  const user = getSessionUser();
  const canManage = Boolean(user && view.roles.includes(user.role));
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [feature],
    queryFn: () => apiRequest(view.endpoint),
    enabled: authenticated,
    retry: false
  });
  const rows = query.data?.data || [];

  function canChangeRow(row) {
    if (!canManage) return false;
    if (user.role === 'caissier' && row.user_id !== user.id) return false;
    if (feature === 'purchases' && row.statut === 'recu') return false;
    if (feature === 'stock' && !['demo', 'inventaire'].includes(row.reference_type)) return false;
    if (feature === 'accounting' && !row.modifiable) return false;
    return true;
  }

  function canDeleteRow(row) {
    if (!canChangeRow(row)) return false;
    if (feature === 'purchases' && row.statut === 'recu') return false;
    if (feature === 'cash' && row.statut !== 'cloturee') return false;
    return true;
  }

  async function saveRow(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    const patch = Object.fromEntries(view.fields
      .filter(([key]) => formData.has(key))
      .map(([key, , type]) => [key, type === 'number' ? Number(formData.get(key)) : formData.get(key)]));
    try {
      await apiRequest(`${view.mutationEndpoint || view.endpoint}/${dialog.row.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: [feature] });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function deleteRow() {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`${view.mutationEndpoint || view.endpoint}/${dialog.row.id}`, { method: 'DELETE' });
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: [feature] });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader eyebrow="GESTION COMMERCIALE · POSTGRESQL" title={title} />
    <div className="table-toolbar"><div><strong>{rows.length}</strong> enregistrement{rows.length === 1 ? '' : 's'} {query.isError && <span className="cache-hint">· API indisponible</span>}</div><span className="data-source-label">SOURCE <strong>BASE DE DONNÉES</strong></span></div>
    {!authenticated ? <section className="module-placeholder"><span className="module-index">SESSION REQUISE</span><h2>Connecte-toi pour voir les données.</h2><p>Les exemples sont dans la base PostgreSQL et nécessitent un compte actif.</p><Link className="primary-button" to="/login">Se connecter <span>→</span></Link></section> : null}
    {authenticated && query.isError ? <section className="module-placeholder"><span className="module-index">ERREUR DE LECTURE</span><h2>Impossible de charger {title.toLocaleLowerCase('fr')}.</h2><p>{query.error.message}</p></section> : null}
    {authenticated && !query.isError ? <><p className="data-description">{views[feature].description}</p><div className="data-table-wrap"><table className="data-table"><thead><tr>{view.columns.map(([, label]) => <th key={label}>{label}</th>)}<th>ACTIONS</th></tr></thead><tbody>{query.isPending ? <tr><td className="table-empty" colSpan={view.columns.length + 1}>Chargement des données…</td></tr> : rows.length ? rows.map((row, index) => <tr key={row.id || row.numero || `${feature}-${index}`}>{view.columns.map(([key, label, type]) => <td key={`${label}-${key}`}>{formatCell(row[key], type)}</td>)}<td><div className="row-actions"><button type="button" onClick={() => { setError(''); setDialog({ mode: 'view', row }); }}>Voir</button>{canChangeRow(row) && <button type="button" onClick={() => { setError(''); setDialog({ mode: 'edit', row }); }}>Modifier</button>}{canDeleteRow(row) && <button type="button" className="delete-action" onClick={() => { setError(''); setDialog({ mode: 'delete', row }); }}>Supprimer</button>}</div></td></tr>) : <tr><td className="table-empty" colSpan={view.columns.length + 1}>Aucun enregistrement pour le moment.</td></tr>}</tbody></table></div></> : null}
    <RowDialog dialog={dialog} view={view} onClose={() => setDialog(null)} onSave={saveRow} onDelete={deleteRow} busy={busy} error={error} canManage={dialog ? canChangeRow(dialog.row) : false} />
  </>;
}