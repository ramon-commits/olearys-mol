import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

// Poort voor alle facilitator-pagina's. Wacht tot de sessie bekend is,
// stuurt daarna door naar de login als er niemand is ingelogd.
export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={styles.wait}>
        <div style={styles.spinner} />
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;

  return children;
}

const styles = {
  wait: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--black)',
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--teal)',
    animation: 'spin 0.8s linear infinite',
  },
};
