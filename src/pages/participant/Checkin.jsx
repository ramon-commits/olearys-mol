import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { storedToken } from '../../lib/game.js';
import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px, p } from '../../theme/participant.js';

// /checkin/:number - de vier rondes.
//   1, 2, 3 : kenmerken van de mol invullen (vragen komen uit de database,
//             en welke vragen precies is per check-in ingesteld).
//   4       : de ontmaskering. Wijs aan wie jij de mol vindt.
export default function Checkin() {
  const { number } = useParams();
  const checkin = parseInt(number, 10);

  const [state, setState] = useState('loading');
  // loading | no_token | invalid | not_open | closed | form | unmask | already | done | error
  const [data, setData] = useState(null);      // get_checkin resultaat
  const [teammates, setTeammates] = useState([]);
  const [answers, setAnswers] = useState({});
  const [guess, setGuess] = useState('');
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

      const { data: d, error } = await supabase.rpc('mol_get_checkin', {
        p_token: token, p_checkin: checkin,
      });
      if (!active) return;

      if (error || !d) { setState('error'); return; }
      if (d.error === 'not_found') { setState('no_token'); return; }
      if (d.error) { setState('error'); return; }

      setData(d);

      if (d.active_phase === 0) { setState('not_open'); return; }
      if (d.active_phase >= 5) { setState('closed'); return; }
      if (d.existing_answers) { setPrevious(d.existing_answers); setState('already'); return; }

      if (checkin === 4) {
        const { data: tm } = await supabase.rpc('mol_get_teammates', { p_token: token });
        if (!active) return;
        setTeammates(tm?.teammates ?? []);
        setState('unmask');
      } else {
        setState('form');
      }
    })();
    return () => { active = false; };
  }, [checkin]);

  function setAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submitVote() {
    const questions = data?.questions ?? [];
    if (!questions.every((q) => answers[q.qkey]) || busy) return;
    setBusy(true);
    const { data: r, error } = await supabase.rpc('mol_cast_vote', {
      p_token: storedToken(), p_checkin: checkin, p_answers: answers,
    });
    setBusy(false);
    if (error || !r) { setState('error'); return; }
    if (r.error === 'already_voted') { setPrevious(r.answers); setState('already'); return; }
    if (r.error) { setState('error'); return; }
    setState('done');
  }

  async function submitUnmask() {
    if (!guess || busy) return;
    setBusy(true);
    const { data: r, error } = await supabase.rpc('mol_cast_unmask', {
      p_token: storedToken(), p_guess_player_id: guess,
    });
    setBusy(false);
    if (error || !r) { setState('error'); return; }
    if (r.error === 'already_voted') { setState('done'); return; }
    if (r.error) { setState('error'); return; }
    setState('done');
  }

  if (state === 'loading') {
    return <ParticipantScreen><div style={{ ...px.spinner, margin: '0 auto' }} /></ParticipantScreen>;
  }

  const messages = {
    no_token: ['Je doet nog niet mee', 'Scan eerst de QR-code op jouw teamtafel.'],
    invalid: ['Onbekende check-in', 'Scan een van de check-in codes bij de stations.'],
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
          {checkin === 4
            ? 'Je gok is binnen. Kijk straks op het grote scherm wie de mol was.'
            : `Check-in ${checkin} is binnen. Doe de andere ook, de volgorde maakt niet uit.`}
        </p>
      </ParticipantScreen>
    );
  }

  if (state === 'already') {
    // Ontmaskering al gedaan
    if (checkin === 4) {
      return (
        <ParticipantScreen>
          <div style={s.check}>✓</div>
          <h1 style={px.title}>Al gestemd</h1>
          <p style={px.sub}>Je hebt je gok voor de mol al doorgegeven.</p>
        </ParticipantScreen>
      );
    }
    const questions = data?.questions ?? [];
    return (
      <ParticipantScreen>
        <div style={s.check}>✓</div>
        <h1 style={px.title}>Al ingevuld</h1>
        <p style={px.sub}>Dit gaf je op bij check-in {checkin}:</p>
        <div style={{ textAlign: 'left' }}>
          {questions.map((q) => (
            <div key={q.qkey} style={s.row}>
              <span style={{ color: p.muted, fontSize: 13 }}>{q.mol_text}</span>
              <strong style={{ whiteSpace: 'nowrap' }}>{previous?.[q.qkey] ?? '—'}</strong>
            </div>
          ))}
        </div>
      </ParticipantScreen>
    );
  }

  // CHECK-IN 4: ONTMASKERING
  if (state === 'unmask') {
    const canSubmit = guess && !busy;
    return (
      <ParticipantScreen>
        <div style={{ ...px.eyebrow, textAlign: 'center' }}>De ontmaskering</div>
        <h1 style={{ ...px.title, fontSize: 34 }}>Wie is de mol?</h1>
        <p style={px.sub}>
          Kies wie jij de mol vindt van jouw team. Goed geraden levert je team
          {' '}{data?.unmask_points ?? 50} punten op.
        </p>

        <div style={{ textAlign: 'left' }}>
          {teammates.length === 0 ? (
            <p style={px.sub}>Er zijn geen teamgenoten om aan te wijzen.</p>
          ) : teammates.map((t) => {
            const selected = guess === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setGuess(t.id)}
                style={{ ...s.pick, ...(selected ? s.pickOn : {}) }}
              >
                <span style={{ ...s.radio, ...(selected ? s.radioOn : {}) }} />
                {t.name}
              </button>
            );
          })}
        </div>

        <button
          onClick={submitUnmask}
          disabled={!canSubmit}
          style={{ ...px.btn, ...(canSubmit ? {} : px.btnDisabled) }}
        >
          {busy ? 'Versturen…' : 'Dit is mijn keuze'}
        </button>
      </ParticipantScreen>
    );
  }

  // CHECK-IN 1-3: KENMERKEN
  const questions = data?.questions ?? [];
  const canSubmit = questions.length > 0 && questions.every((q) => answers[q.qkey]) && !busy;

  return (
    <ParticipantScreen>
      <div style={{ textAlign: 'left' }}>
        <div style={{ ...px.eyebrow, textAlign: 'center' }}>Check-in {checkin} van 4</div>
        <h1 style={{ ...px.title, fontSize: 32, textAlign: 'center' }}>Wie is de mol?</h1>
        <p style={{ ...px.sub, textAlign: 'center', fontSize: 15 }}>
          Beschrijf de persoon in jouw team die jij verdenkt. Je kunt dit maar één keer invullen.
        </p>

        {questions.map((q) => (
          <div style={px.field} key={q.qkey}>
            <label style={px.label} htmlFor={q.qkey}>{q.mol_text}</label>
            <select
              id={q.qkey}
              style={px.select}
              value={answers[q.qkey] || ''}
              onChange={(e) => setAnswer(q.qkey, e.target.value)}
              disabled={busy}
              required
            >
              <option value="" disabled>Kies…</option>
              {(q.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}

        <button
          onClick={submitVote}
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
  pick: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    background: p.field, border: `1px solid ${p.line}`, borderRadius: 12,
    padding: '14px 16px', marginBottom: 10, fontSize: 17, fontWeight: 600,
    color: p.ink, cursor: 'pointer', textAlign: 'left',
  },
  pickOn: { border: `2px solid ${p.ink}`, background: '#fff' },
  radio: {
    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${p.ink}`, background: 'transparent',
  },
  radioOn: { background: p.ink, boxShadow: 'inset 0 0 0 3px #fff' },
};
