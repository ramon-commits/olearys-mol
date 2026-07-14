// Deelnemerschermen: donkere noir mol-sfeer.
// Bewust een ANDER palet dan het facilitator-dashboard: de deelnemer moet het
// gevoel krijgen dat hij een spel binnenstapt, niet een beheertool.
// O'Learys blijft aanwezig via het logo onderaan en het geel van de mol.

export const p = {
  ink: '#041214',        // achtergrond
  green: '#00995f',      // speler, bevestiging, primaire knop
  yellow: '#facc15',     // de mol, highlights
  white: '#ffffff',
  muted: 'rgba(255, 255, 255, 0.62)',
  line: 'rgba(255, 255, 255, 0.14)',
  field: 'rgba(255, 255, 255, 0.06)',
};

export const px = {
  screen: {
    minHeight: '100vh',
    background: p.ink,
    color: p.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 22px',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-body)',
  },
  center: { textAlign: 'center', maxWidth: 460, width: '100%' },

  title: {
    fontFamily: 'var(--font-head)',
    fontSize: 40,
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    margin: '0 0 10px',
  },
  sub: { fontSize: 17, color: p.muted, margin: '0 0 26px', lineHeight: 1.45 },

  btn: {
    width: '100%',
    padding: '16px 20px',
    borderRadius: 12,
    border: 'none',
    background: p.green,
    color: p.white,
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },

  field: { textAlign: 'left', marginBottom: 18 },
  label: { display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: p.white },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    fontSize: 16,
    border: `1px solid ${p.line}`,
    background: p.field,
    color: p.white,
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    fontSize: 16,
    border: `1px solid ${p.line}`,
    background: '#0b2024',
    color: p.white,
    boxSizing: 'border-box',
    outline: 'none',
    appearance: 'none',
  },

  spinner: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: `4px solid ${p.line}`,
    borderTopColor: p.white,
    animation: 'p-spin 0.8s linear infinite',
  },

  footerLogo: {
    width: 92,
    height: 'auto',
    opacity: 0.5,
    margin: '38px auto 0',
    display: 'block',
  },
};

export const P_KEYFRAMES = '@keyframes p-spin { to { transform: rotate(360deg); } }';
