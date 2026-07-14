// Deelnemerschermen: O'Learys Sunburst Yellow.
// Bewust een ANDER palet dan het facilitator-dashboard: de deelnemer stapt een
// spel binnen, niet een beheertool. Fel, luid, onmiskenbaar O'Learys.
//
// De twee rolkaarten breken juist WEG van dat geel, want dat is het moment:
//   speler -> teal
//   mol    -> jet black
// Op een felgele wereld is een volledig zwart scherm de sterkste onthulling
// die je kunt geven.

export const p = {
  yellow: '#facc15',   // achtergrond deelnemerwereld
  ink: '#000000',      // tekst, knoppen, de mol
  teal: '#2e6b5a',     // speler, accenten
  white: '#ffffff',
  muted: 'rgba(0, 0, 0, 0.62)',
  line: 'rgba(0, 0, 0, 0.14)',
  field: 'rgba(255, 255, 255, 0.55)',
};

export const px = {
  screen: {
    minHeight: '100vh',
    background: p.yellow,
    color: p.ink,
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
    background: p.ink,
    color: p.yellow,
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.35, cursor: 'not-allowed' },

  field: { textAlign: 'left', marginBottom: 18 },
  label: { display: 'block', fontSize: 14, fontWeight: 700, marginBottom: 8, color: p.ink },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    fontSize: 16,
    border: `1px solid ${p.line}`,
    background: p.field,
    color: p.ink,
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    fontSize: 16,
    border: `1px solid ${p.line}`,
    background: p.field,
    color: p.ink,
    boxSizing: 'border-box',
    outline: 'none',
    appearance: 'none',
  },

  spinner: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: `4px solid ${p.line}`,
    borderTopColor: p.ink,
    animation: 'p-spin 0.8s linear infinite',
  },

  // Logo staat DONKER op geel: geen invert.
  footerLogo: {
    width: 92,
    height: 'auto',
    opacity: 0.75,
    margin: '38px auto 0',
    display: 'block',
  },

  eyebrow: {
    fontFamily: 'var(--font-head)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: p.teal,
    marginBottom: 12,
  },
};

export const P_KEYFRAMES = '@keyframes p-spin { to { transform: rotate(360deg); } }';
