import PageHeader from '../components/PageHeader.jsx';

const descriptions = {
  pos: 'Enregistrement des ventes et paiements.',
  stock: 'Mouvements, niveaux et inventaires physiques.',
  purchases: 'Commandes fournisseurs et réceptions.',
  customers: 'Fiches clients et suivi des créances.',
  cash: 'Ouverture, clôture et mouvements de caisse.',
  expenses: 'Suivi des dépenses de l’activité.',
  accounting: 'Journal comptable et synthèses.'
};

export default function FeaturePage({ title, feature }) {
  return <><PageHeader eyebrow="GESTION COMMERCIALE" title={title} /><section className="module-placeholder"><span className="module-index">{feature.toUpperCase()}</span><h2>{title}</h2><p>{descriptions[feature]}</p><div className="module-status"><span /> Module en cours d’implémentation</div></section></>;
}