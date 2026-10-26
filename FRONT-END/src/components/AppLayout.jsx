import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useOnlineStatus } from '../sync/useOnlineStatus.js';

const navigation = [
  { to: '/', label: 'Vue d’ensemble', mark: '01' },
  { to: '/pos', label: 'Ventes', mark: '02' },
  { to: '/products', label: 'Produits', mark: '03' },
  { to: '/stock', label: 'Stock', mark: '04' },
  { to: '/purchases', label: 'Achats', mark: '05' },
  { to: '/customers', label: 'Clients', mark: '06' },
  { to: '/cash', label: 'Caisse', mark: '07' },
  { to: '/expenses', label: 'Dépenses', mark: '08' },
  { to: '/accounting', label: 'Comptabilité', mark: '09' }
];

export default function AppLayout() {
  const online = useOnlineStatus();
  const navigate = useNavigate();
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('grossiste.user') || 'null');
  } catch {
    localStorage.removeItem('grossiste.user');
  }

  function handleAccountAction() {
    if (!user) return navigate('/login');
    localStorage.removeItem('grossiste.token');
    localStorage.removeItem('grossiste.user');
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Grossiste PPN, accueil">
          <span className="brand-mark">G.</span>
          <span className="brand-copy"><strong>Grossiste</strong><small>GESTION PPN</small></span>
        </a>
        <div className="shop-switch"><span className="shop-dot" /> MAGASIN PRINCIPAL <span className="shop-chevron">⌄</span></div>
        <p className="nav-label">ESPACE DE TRAVAIL</p>
        <nav className="nav-list" aria-label="Navigation principale">
          {navigation.map(({ to, label, mark }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-mark">{mark}</span><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`connection-status ${online ? 'online' : 'offline'}`}>
            <span className="connection-dot" />
            <span>{online ? 'Connecté' : 'Mode hors ligne'}</span>
          </div>
          <button className="profile-link" type="button" onClick={handleAccountAction}><span className="avatar">{user?.nom?.slice(0, 2).toUpperCase() || 'GP'}</span><span><strong>{user?.nom || 'Mon espace'}</strong><small>{user ? 'Se déconnecter' : 'Se connecter'}</small></span><span className="profile-more">···</span></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <span>GESTION COMMERCIALE <span className="topbar-divider">/</span> MADAGASCAR</span>
          <span className="today-label">Ariary <span className="currency-dot">MGA</span></span>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}