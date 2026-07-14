import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { fetchActiveGame, storedToken, rememberPlayer } from '../../lib/game.js';
import { QUESTIONS, allAnswered } from '../../lib/questions.js';
import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px } from '../../theme/participant.js';

// /scan/:team - deelnemer scant de QR op zijn teamtafel.
// Fase 0: naam + 8 vragen over jezelf -> mol_claim_position -> rolkaart.
export default function Scan() {
  const { team } = useParams();
  const navigate = useNavigate();
  const teamNumber = parseInt(team, 10);

  const [phase, setPhase] = useState('loading');
  // loading | waiting | closed | invalid | welcome | form | full | error
  const [game, setGame] = useState(null);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (Number.isNaN(teamNumber) || teamNumber < 1) {
        if (active) setPhase('invalid');
        return;
      }
      const g = await fetchActiveGame();
      if (!active) return;
      if (!g) { setPhase('waiting'); return; }
      if (teamNumber > g.num_teams) { setPhase('invalid'); return; }

      setGame(g);
      if (storedToken(g.id)) { navigate('/card', { replace: true }); return; }
      setPhase(g.active_phase === 0 ? 'welcome' : 'closed');
    })();
    return () => { active = false; };
  }, [teamNumber, navigate]);

  function setAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !allAnswered(answers) || busy) return;
    setBusy(true);

    const { data, error } = await supabase.rpc('mol_claim_position', {
      p_game_id: game.id,
      p_team_number: teamNumber,
      p_max_per_team: game.max_per_team,
      p_name: name.trim(),
      p_appearance: answers,
    });

    if (error || !data || data.error) {
      setBusy(false);
      if (data?.error === 'team_full') setPhase('full');
      else if (data?.error === 'registration_closed') setPhase('closed');
      else setPhase('error');
      return;
    }

    rememberPlayer(game.id, data.player_token);
    navigate('/card', { replace: true });
  }

  if (phase === 'loading') {
    return <ParticipantScreen><div style={{ ...px.spinner, margin: '0 auto' }} /></ParticipantScreen>;
  }

  if (phase !== 'welcome' && phase !== 'form') {
    const copy = {
      waiting: ['Nog even geduld', 'De facilitator heeft het spel nog niet gestart.'],
      closed: ['Registratie is gesloten', 'Het spel loopt al. Ga naar een check-in station.'],
      invalid: ['Deze QR hoort niet bij dit spel', 'Scan de code op jouw eigen teamtafel.'],
      full: [`Team ${teamNumber} zit vol`, 'Vraag de facilitator waar je terechtkunt.'],
      error: ['Er ging iets mis', 'Ververs de pagina en scan opnieuw.'],
    }[phase];
    return (
      <ParticipantScreen>
        <h1 style={px.title}>{copy[0]}</h1>
        <p style={px.sub}>{copy[1]}</p>
      </ParticipantScreen>
    );
  }

  if (phase === 'welcome') {
    return (
      <ParticipantScreen>
        <div style={px.eyebrow}>Team {teamNumber}</div>
        <h1 style={{ ...px.title, fontSize: 46 }}>I mol O&apos;Learys</h1>
        <p style={px.sub}>
          Eén van jullie is de mol. Vul eerst acht vragen over jezelf in, dan hoor je wie je bent.
        </p>
        <button style={px.btn} onClick={() => setPhase('form')}>Ik doe mee</button>
      </ParticipantScreen>
    );
  }

  const canSubmit = name.trim() && allAnswered(answers) && !busy;

  return (
    <ParticipantScreen>
      <form onSubmit={submit} style={{ textAlign: 'left' }}>
        <div style={{ ...px.eyebrow, textAlign: 'center' }}>Team {teamNumber}</div>
        <h1 style={{ ...px.title, fontSize: 30, textAlign: 'center' }}>Vertel iets over jezelf</h1>
        <p style={{ ...px.sub, textAlign: 'center', fontSize: 15 }}>
          Je teamgenoten krijgen deze vragen straks over de mol.
        </p>

        <div style={px.field}>
          <label style={px.label} htmlFor="naam">Naam</label>
          <input
            id="naam"
            style={px.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
          />
        </div>

        {QUESTIONS.map((q) => (
          <div style={px.field} key={q.key}>
            <label style={px.label} htmlFor={q.key}>{q.self}</label>
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
          type="submit"
          disabled={!canSubmit}
          style={{ ...px.btn, ...(canSubmit ? {} : px.btnDisabled) }}
        >
          {busy ? 'Versturen…' : 'Versturen'}
        </button>
      </form>
    </ParticipantScreen>
  );
}

