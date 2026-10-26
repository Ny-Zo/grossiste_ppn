import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client.js';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest('/auth/setup-status')
      .then((result) => {
        if (active) setSetupRequired(result.setup_required);
      })
      .catch(() => {
        if (active) setError('Impossible de vérifier la configuration du compte.');
      })
      .finally(() => {
        if (active) setCheckingSetup(false);
      });

    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (setupRequired && password !== form.get('password_confirmation')) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setBusy(true);
    try {
      const result = await apiRequest(setupRequired ? '/auth/setup' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          ...(setupRequired ? { nom: form.get('nom') } : {}),
          email: form.get('email'),
          mot_de_passe: password
        })
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
      <section className="login-panel"><p className="eyebrow">{setupRequired ? 'PREMIÈRE CONFIGURATION' : 'ESPACE SÉCURISÉ'}</p><h1>{checkingSetup ? 'Vérification…' : setupRequired ? 'Créer l’administrateur.' : 'Bon retour.'}</h1><p className="login-intro">{setupRequired ? 'Administrateur principal' : 'Connectez-vous à votre espace de gestion.'}</p>
        <form onSubmit={handleSubmit} className="login-form">
          {setupRequired && <label>Nom complet<input type="text" name="nom" autoComplete="name" minLength="2" maxLength="120" required /></label>}
          <label>Adresse e-mail<input type="email" name="email" autoComplete="username" required /></label>
          <label>Mot de passe<input type="password" name="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} minLength={setupRequired ? 12 : 1} maxLength="200" required /></label>
          {setupRequired && <label>Confirmer le mot de passe<input type="password" name="password_confirmation" autoComplete="new-password" minLength="12" maxLength="200" required /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy || checkingSetup}>{busy ? 'Enregistrement…' : setupRequired ? 'Créer l’administrateur' : 'Se connecter'} <span>→</span></button>
        </form><p className="login-foot">GROSSISTE PPN <span>·</span> MADAGASCAR</p>
      </section>
    </main>
  );
}