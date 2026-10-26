import { useQuery } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader.jsx';
import { apiRequest } from '../../api/client.js';
import { formatAriary } from '../../lib/formatAriary.js';

export default function Dashboard() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => apiRequest('/health'), retry: false });
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await apiRequest('/dashboard/summary')).data,
    enabled: Boolean(localStorage.getItem('grossiste.token')),
    retry: false
  });
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date()).toLocaleUpperCase('fr-FR');
  const metrics = summary.data;

  return (
    <>
      <PageHeader eyebrow={`${today} · ESPACE DE GESTION`} title="Vue d’ensemble">
        <span className="date-chip">Aujourd’hui <strong>›</strong></span>
      </PageHeader>
      <section className="welcome-band">
        <div><p className="welcome-kicker">GROSSISTE PPN <span>·</span> CAISSE PRINCIPALE</p><h2>Votre activité,<br />en un coup d’œil.</h2><p className="welcome-note">Les indicateurs apparaîtront ici à mesure que vos opérations seront enregistrées.</p></div>
        <div className="welcome-stamp"><span>ARIARY</span><strong>MGA</strong><span>MADAGASCAR</span></div>
        <div className="band-index">01 <span>/</span> 04</div>
      </section>
      <section className="metrics-grid" aria-label="Indicateurs">
        <article className="metric-panel metric-primary"><div className="metric-top"><span>VENTES DU JOUR</span><span className="metric-arrow">↗</span></div><strong className="metric-value">{metrics ? formatAriary(metrics.ventes_du_jour) : '—'}</strong><div className="metric-foot">{metrics ? 'Ventes validées' : 'Connexion requise'} <span>01</span></div></article>
        <article className="metric-panel"><div className="metric-top"><span>ARTICLES EN CATALOGUE</span><span className="metric-symbol">▤</span></div><strong className="metric-value">{metrics?.nombre_produits ?? '—'}</strong><div className="metric-foot">{metrics ? `${metrics.nombre_alertes_stock} alerte(s) de stock` : 'Connexion requise'} <span>02</span></div></article>
        <article className="metric-panel"><div className="metric-top"><span>CRÉANCES CLIENTS</span><span className="metric-symbol">◷</span></div><strong className="metric-value">{metrics ? formatAriary(metrics.creances_clients) : '—'}</strong><div className="metric-foot">{metrics ? `${metrics.achats_en_cours} achat(s) en cours` : 'Connexion requise'} <span>03</span></div></article>
        <article className="metric-panel metric-dark"><div className="metric-top"><span>ÉTAT DE L’API</span><span className="api-light" /></div><strong className="metric-value metric-api">{health.isSuccess ? 'En ligne' : health.isPending ? 'Connexion…' : 'Hors ligne'}</strong><div className="metric-foot">{health.isSuccess ? 'Serveur accessible' : 'Données locales disponibles'} <span>04</span></div></article>
      </section>
      <section className="lower-grid">
        <div className="section-block"><div className="section-heading"><div><p className="eyebrow">ACTIVITÉ RÉCENTE</p><h2>Opérations</h2></div><span className="section-count">0 ENREGISTREMENT</span></div><div className="empty-state"><span className="empty-rule" /><strong>La journée commence ici.</strong><p>Les ventes, achats et mouvements de stock s’afficheront dans ce fil.</p></div></div>
        <aside className="side-note"><span className="note-label">REPÈRE DU JOUR</span><strong>Une base saine<br />pour bien gérer.</strong><p>Les données restent sur cet appareil lorsque la connexion est interrompue.</p><span className="note-foot">STOCKAGE LOCAL <i>DEXIE / INDEXEDDB</i></span></aside>
      </section>
      <span className="sr-only">Exemple de format monétaire : {formatAriary(0)}</span>
    </>
  );
}