import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client.js';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), mot_de_passe: form.get('password') })
      });
      localStorage.setItem('grossiste.token', result.token);
      localStorage.setItem('grossiste.user', JSON.stringify(result.user));
      navigate('/');
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page"><a className="brand login-brand" href="/"><span className="brand-mark">G.</span><span className="brand-copy"><strong>Grossiste</strong><small>GESTION PPN</small></span></a>
      <section className="login-panel"><p className="eyebrow">ESPACE SÉCURISÉ</p><h1>Bon retour.</h1><p className="login-intro">Connectez-vous à votre espace de gestion.</p>
        <form onSubmit={handleSubmit} className="login-form"><label>Adresse e-mail<input type="email" name="email" autoComplete="username" required /></label><label>Mot de passe<input type="password" name="password" autoComplete="current-password" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'} <span>→</span></button>
        </form><p className="login-foot">GROSSISTE PPN <span>·</span> MADAGASCAR</p>
      </section>
    </main>
  );
}