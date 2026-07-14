import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { storedToken } from '../../lib/game.js';
import { QUESTIONS, allAnswered } from '../../lib/questions.js';
import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px, p } from '../../theme/participant.js';

// /checkin/:number - de vier stemrondes. Staan alle vier tegelijk open, de
// deelnemer doet ze in willekeurige volgorde bij de opdrachtstations.
// Eén stem per check-in, niet terug te draaien.
export default function Checkin() {
  const { number } = useParams();
  const checkin = parseInt(number, 10);

  const [state, setState] = useState('loading');
  // loading | no_token | invalid | not_open | closed | form | already | done | error
  const [answers, setAnswers] = useState({});
  const [previous, setPrevious] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (Number.isNaN(checkin) || checkin < 1 || checkin > 4) {
        if (active) setState('invalid');
        return;
      }
      const token = storedToken();
      if (!token) { if (active) setState('no_token'); return; }

      const { data, error } = await supabase.rpc('mol_get_checkin', {
        p_token: token, p_checkin: checkin,
      });
      if (!active) return;

      if (error || !data) { setState('error'); return; }
      if (data.error === 'not_found') { setState('no_token'); return; }
      if (data.error) { setState('error'); return; }

      if (data.active_phase === 0) { setState('not_open'); return; }
      if (data.active_phase >= 5) { setState('closed'); return; }
      if (data.existing_answers) { setPrevious(data.existing_answers); setState('already'); return; }
      setState('form');
    })();
    return () => { active = false; };
  }, [checkin]);

  function setAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!allAnswered(answers) || busy) return;
    setBusy(true);

    const { data, error } = await supabase.rpc('mol_cast_vote', {
      p_token: storedToken(), p_checkin: checkin, p_answers: answers,
    });
    setBusy(false);

    if (error || !data) { setState('error'); return; }
    if (data.error === 'already_voted') { setPrevious(data.answers); setState('already'); return; }
    if (data.error) { setState('error'); return; }
    setState('done');
  }

  if (state === 'loading') {
    return <ParticipantScreen><div style={{ ...px.spinner, margin: '0 auto' }} /></ParticipantScreen>;
  }

  const messages = {
    no_token: ['Je doet nog niet mee', 'Scan eerst de QR-code op jouw teamtafel.'],
    invalid: ['Onbekende check-in', 'Scan een van de vier check-in codes bij de stations.'],
    not_open: ['Nog niet open', 'De check-ins zijn nog niet gestart. Wacht op de facilitator.'],
    closed: ['Check-ins zijn gesloten', 'Kijk op het grote scherm voor de uitslag.'],
    error: ['Er ging iets mis', 'Ververs de pagina en probeer opnieuw.'],
  };

  if (messages[state]) {
    return (
      <ParticipantScreen>
        <h1 style={px.title}>{messages[state][0]}</h1>
        <p style={px.sub}>{messages[state][1]}</p>
      </ParticipantScreen>
    );
  }

  if (state === 'done') {
    return (
      <ParticipantScreen>
        <div style={s.check}>✓</div>
        <h1 style={px.title}>Opgeslagen</h1>
        <p style={px.sub}>
          Check-in {checkin} is binnen. Doe de andere drie ook, de volgorde maakt niet uit.
        </p>
      </ParticipantScreen>
    );
  }

  if (state === 'already') {
    return (
      <ParticipantScreen>
        <div style={s.check}>✓</div>
        <h1 style={px.title}>Al ingevuld</h1>
        <p style={px.sub}>Dit gaf je op bij check-in {checkin}:</p>
        <div style={{ textAlign: 'left' }}>
          {QUESTIONS.map((q) => (
            <div key={q.key} style={s.row}>
              <span style={{ color: p.muted, fontSize: 13 }}>{q.mol}</span>
              <strong style={{ whiteSpace: 'nowrap' }}>{previous?.[q.key] ?? '—'}</strong>
            </div>
          ))}
        </div>
      </ParticipantScreen>
    );
  }

  const canSubmit = allAnswered(answers) && !busy;

  return (
    <ParticipantScreen>
      <div style={{ textAlign: 'left' }}>
        <div style={{ ...px.eyebrow, textAlign: 'center' }}>Check-in {checkin} van 4</div>
        <h1 style={{ ...px.title, fontSize: 32, textAlign: 'center' }}>Wie is de mol?</h1>
        <p style={{ ...px.sub, textAlign: 'center', fontSize: 15 }}>
          Beschrijf de persoon in jouw team die jij verdenkt. Je kunt dit maar één keer invullen.
        </p>

        {QUESTIONS.map((q) => (
          <div style={px.field} key={q.key}>
            <label style={px.label} htmlFor={q.key}>{q.mol}</label>
            <select
              id={q.key}
              style={px.select}
              value={answers[q.key] || ''}
              onChange={(e) => setAnswer(q.key, e.target.value)}
              disabled={busy}
              required
            >
              <option value="" disabled>Kies…</option>
              {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}

        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{ ...px.btn, ...(canSubmit ? {} : px.btnDisabled) }}
        >
          {busy ? 'Versturen…' : 'Versturen'}
        </button>
      </div>
    </ParticipantScreen>
  );
}

const s = {
  check: {
    width: 68, height: 68, borderRadius: '50%',
    background: p.teal, color: '#fff',
    fontSize: 36, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 18px',
  },
  row: {
    display: 'flex', justifyContent: 'space-between', gap: 14,
    fontSize: 14, padding: '10px 0', borderBottom: `1px solid ${p.line}`,
  },
};
