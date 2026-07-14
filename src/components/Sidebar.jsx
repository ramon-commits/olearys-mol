import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const IconGames = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session, signOut } = useAuth();

  const items = [
    { to: '/dashboard', label: 'Spellen', icon: <IconGames />, matches: ['/dashboard', '/qr-codes'] },
  ];

  async function logout() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <aside style={s.sidebar}>
      <div style={s.brand}>
        <img src="/olearys-logo.png" alt="O'Learys" style={s.logo} />
        <div style={s.wordmark}>I mol O&apos;Learys</div>
      </div>

      <nav style={s.nav}>
        <div style={s.sectionLabel}>Facilitator</div>
        {items.map((item) => {
          const active = item.matches.some((m) => pathname.startsWith(m));
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={s.footer}>
        <div style={s.email} title={session?.user?.email}>{session?.user?.email}</div>
        <button onClick={logout} style={s.logoutBtn}>
          <IconLogout /> Uitloggen
        </button>
      </div>
    </aside>
  );
}

const s = {
  sidebar: {
    width: 230,
    minWidth: 230,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    height: '100vh',
    position: 'sticky',
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 14px 18px',
  },
  brand: { padding: '0 8px 24px' },
  logo: { display: 'block', width: 120, height: 'auto' },
  wordmark: {
    fontFamily: 'var(--font-head)',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginTop: 10,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    padding: '0 8px 8px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 500,
    fontSize: 14,
    padding: '0.6rem 0.7rem',
    borderRadius: 'var(--radius)',
    width: '100%',
    textAlign: 'left',
  },
  navItemActive: {
    background: 'var(--teal-soft)',
    color: 'var(--teal)',
    fontWeight: 600,
    boxShadow: 'inset 2px 0 0 var(--teal)',
  },
  footer: { borderTop: '1px solid var(--border)', paddingTop: 14 },
  email: {
    fontSize: 12,
    color: 'var(--text-muted)',
    padding: '0 6px 10px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 500,
    padding: '0.5rem 0.7rem',
    borderRadius: 'var(--radius)',
    width: '100%',
  },
};
