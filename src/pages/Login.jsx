import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

// Facilitator-login. Echte Supabase Auth: geen wachtwoord in de bundle.
export default function Login() {
  const navigate = useNavigate();
  const { session, loading, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    const message = await signIn(email.trim(), password);
    if (message) {
      setError(
        message.toLowerCase().includes('invalid')
          ? 'E-mailadres of wachtwoord klopt niet.'
          : message,
      );
      setBusy(false);
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  return (
    <div style={s.page}>
      <form style={s.card} onSubmit={submit}>
        <img src="/olearys-logo.png" alt="O'Learys" className="logo-invert" style={s.logo} />

        <h1 style={s.title}>I mol O&apos;Learys</h1>
        <p style={s.sub}>Log in om een spel te starten.</p>

        <label style={s.label} htmlFor="email">E-mailadres</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          disabled={busy}
          required
          autoFocus
        />

        <label style={{ ...s.label, marginTop: 14 }} htmlFor="password">Wachtwoord</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          disabled={busy}
          required
        />

        {error && <div style={s.error}>{error}</div>}

        <button type="submit" disabled={busy} style={s.button}>
          {busy ? 'Bezig…' : 'Inloggen'}
        </button>
      </form>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--black)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    padding: '40px 32px',
    textAlign: 'left',
  },
  logo: { display: 'block', width: 150, height: 'auto', margin: '0 auto 26px' },
  title: {
    fontFamily: 'var(--font-head)',
    fontSize: 30,
    fontWeight: 700,
    textAlign: 'center',
    color: 'var(--yellow)',
    letterSpacing: '-0.02em',
  },
  sub: {
    fontSize: 14,
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 },
  error: {
    marginTop: 14,
    color: '#fca5a5',
    background: 'var(--danger-soft)',
    border: '1px solid rgba(229,72,77,0.35)',
    borderRadius: 'var(--radius)',
    padding: '0.6rem 0.75rem',
    fontSize: 13,
  },
  button: { width: '100%', marginTop: 22, padding: '0.75rem' },
};
