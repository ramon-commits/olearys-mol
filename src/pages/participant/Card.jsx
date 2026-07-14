import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { storedToken } from '../../lib/game.js';
import { HOUSE_RULES, ROLE_COPY } from '../../lib/roleCopy.js';
import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px, p, P_KEYFRAMES } from '../../theme/participant.js';

// /card - je persoonlijke kaart.
//
// Standaard staat er een NEUTRAAL scherm: naam, team, spelregels. Voor iedereen
// exact hetzelfde. De rol en de bijbehorende tips zitten achter een knop, en
// je kunt ze weer verbergen. Zo kun je je rol tijdens het spel gewoon
// terugkijken zonder dat je buurman iets opvangt.
//
// De onthulling zelf is voor beide rollen hetzelfde frame: zwart, gele kop,
// vier tips. Alleen de woorden verschillen. Wie hier ooit een kleur of icoon
// per rol aan toevoegt, sloopt het spel.
export default function Card() {
  const [state, setState] = useState('loading'); // loading | none | error | ok
  const [role, setRole] = useState(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = storedToken();
      if (!token) { if (active) setState('none'); return; }

      const { data, error } = await supabase.rpc('mol_get_my_role', { p_token: token });
      if (!active) return;
      if (error || !data || data.error) {
        setState(data?.error === 'not_found' ? 'none' : 'error');
        return;
      }
      setRole(data);
      setState('ok');
    })();
    return () => { active = false; };
  }, []);

  if (state === 'loading') {
    return <ParticipantScreen><div style={{ ...px.spinner, margin: '0 auto' }} /></ParticipantScreen>;
  }

  if (state === 'none') {
    return (
      <ParticipantScreen>
        <h1 style={px.title}>Je doet nog niet mee</h1>
        <p style={px.sub}>Scan de QR-code op jouw teamtafel om je te registreren.</p>
      </ParticipantScreen>
    );
  }

  if (state === 'error') {
    return (
      <ParticipantScreen>
        <h1 style={px.title}>Er ging iets mis</h1>
        <p style={px.sub}>Ververs de pagina en probeer opnieuw.</p>
      </ParticipantScreen>
    );
  }

  if (revealed) {
    return <RoleCard role={role} onHide={() => setRevealed(false)} />;
  }

  // Neutraal scherm. Iedereen ziet exact dit, ongeacht zijn rol.
  return (
    <ParticipantScreen>
      <div style={px.eyebrow}>Team {role.team_number}</div>
      <h1 style={{ ...px.title, fontSize: 36 }}>Hallo {role.name}</h1>
      <p style={px.sub}>
        Je doet mee. Iedereen ziet nu hetzelfde scherm, dus aan de kleur valt niets af te lezen.
      </p>

      <ul style={s.rules}>
        {HOUSE_RULES.map((r) => (
          <li key={r} style={s.rule}>
            <span style={s.dot} aria-hidden="true" />
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <button style={px.btn} onClick={() => setRevealed(true)}>Toon mijn rol</button>
      <p style={s.warn}>Kijk eerst om je heen.</p>
    </ParticipantScreen>
  );
}

function RoleCard({ role, onHide }) {
  const copy = role.is_mole ? ROLE_COPY.mole : ROLE_COPY.player;

  return (
    <div style={{ ...px.screen, background: p.ink, color: p.white }}>
      <style>{P_KEYFRAMES}</style>
      <div style={{ ...px.center, textAlign: 'left' }}>
        <div style={{ ...px.eyebrow, color: p.yellow, textAlign: 'center' }}>
          {role.name} · Team {role.team_number}
        </div>

        <h1 style={{ ...px.title, fontSize: 46, color: p.yellow, textAlign: 'center', minHeight: 100 }}>
          {copy.heading}
        </h1>

        <p style={{ ...px.sub, color: 'rgba(255,255,255,0.78)', fontSize: 16, minHeight: 116, textAlign: 'center' }}>
          {copy.body}
        </p>

        <div style={s.tipsHead}>Tips</div>
        <ul style={s.tips}>
          {copy.tips.map((t) => (
            <li key={t} style={s.tip}>
              <span style={s.tipDot} aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <button style={s.hideBtn} onClick={onHide}>Verberg mijn rol</button>

        <img src="/olearys-logo.png" alt="O'Learys" className="logo-invert" style={px.footerLogo} />
      </div>
    </div>
  );
}

const s = {
  // Neutraal scherm
  rules: { listStyle: 'none', margin: '0 0 28px', padding: 0, textAlign: 'left' },
  rule: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    fontSize: 15, lineHeight: 1.45, padding: '9px 0',
    borderBottom: `1px solid ${p.line}`,
  },
  dot: {
    width: 6, height: 6, borderRadius: '50%', background: p.teal,
    flexShrink: 0, marginTop: 8,
  },
  warn: { fontSize: 13, color: p.muted, textAlign: 'center', marginTop: 12 },

  // Rolkaart
  tipsHead: {
    fontFamily: 'var(--font-head)',
    fontSize: 12, fontWeight: 700, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: p.yellow,
    paddingTop: 20, marginBottom: 10,
    borderTop: '1px solid rgba(255,255,255,0.16)',
  },
  tips: { listStyle: 'none', margin: 0, padding: 0 },
  tip: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    fontSize: 15, lineHeight: 1.45,
    color: 'rgba(255,255,255,0.86)',
    padding: '9px 0',
  },
  tipDot: {
    width: 6, height: 6, borderRadius: '50%', background: p.yellow,
    flexShrink: 0, marginTop: 8,
  },
  hideBtn: {
    width: '100%', marginTop: 22, padding: '14px 20px', borderRadius: 12,
    background: 'transparent', color: p.yellow,
    border: '1px solid rgba(250,204,21,0.45)',
    fontSize: 16, fontWeight: 700, cursor: 'pointer',
  },
};
