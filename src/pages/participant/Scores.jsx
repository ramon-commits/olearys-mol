import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { fetchLatestGame } from '../../lib/game.js';
import { px, p, P_KEYFRAMES } from '../../theme/participant.js';

// /scores - grootbeeld, publiek. Werkt pas zodra de facilitator de fase op 5 zet;
// daarvoor weigert de database de aanvraag, zodat de mollen niet vroegtijdig lekken.
//
// Drie borden:
//   1. Teamranking     iPad-score min mol-aftrek = eindscore
//   2. De mollen       hoeveel punten hun team kwijtraakte doordat ze verborgen bleven
//   3. De speurders    hoeveel van de 32 antwoorden ze goed hadden
export default function Scores() {
  const [state, setState] = useState('loading'); // loading | empty | notready | error | ok
  const [scores, setScores] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const game = await fetchLatestGame();
      if (!active) return;
      if (!game) { setState('empty'); return; }

      const { data, error } = await supabase.rpc('mol_calculate_scores', { p_game_id: game.id });
      if (!active) return;
      if (error || !data) { setState('error'); return; }
      if (data.error === 'not_ready') { setState('notready'); return; }
      if (data.error) { setState('error'); return; }

      setScores(data);
      setState('ok');
    })();
    return () => { active = false; };
  }, []);

  if (state !== 'ok') {
    const copy = {
      loading: null,
      empty: ['Nog geen spel', 'Zodra de facilitator een spel start, verschijnt hier de stand.'],
      notready: ['De uitslag komt eraan', 'De facilitator geeft de scores zo vrij.'],
      error: ['Er ging iets mis', 'Ververs de pagina.'],
    }[state];

    return (
      <div style={px.screen}>
        <style>{P_KEYFRAMES}</style>
        <div style={px.center}>
          {copy ? (
            <>
              <h1 style={px.title}>{copy[0]}</h1>
              <p style={px.sub}>{copy[1]}</p>
            </>
          ) : (
            <div style={{ ...px.spinner, margin: '0 auto' }} />
          )}
        </div>
      </div>
    );
  }

  const teams = [...(scores.team_ranking || [])].sort((a, b) => b.final_score - a.final_score);
  const moles = [...(scores.mole_ranking || [])].sort((a, b) => b.mole_score - a.mole_score);
  const dets = [...(scores.detective_ranking || [])].sort((a, b) => b.correct - a.correct);

  return (
    <div style={{ ...px.screen, alignItems: 'flex-start', overflowY: 'auto' }}>
      <style>{P_KEYFRAMES}{SCORE_CSS}</style>

      <div style={s.page}>
        <div style={s.eyebrow}>I mol O&apos;Learys</div>
        <h1 style={{ ...px.title, fontSize: 52, textAlign: 'center', marginBottom: 40 }}>
          De uitslag
        </h1>

        <Board title="Teamranking" hint="iPad-score min mol-aftrek">
          {teams.length === 0 ? <Empty /> : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={{ ...s.th, textAlign: 'left' }}>Team</th>
                  <th style={s.th}>iPad</th>
                  <th style={s.th}>Mol-aftrek</th>
                  <th style={s.th}>Eindscore</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.team_number} style={i === 0 ? s.trWin : undefined}>
                    <td style={s.td}>{i + 1}</td>
                    <td style={{ ...s.td, textAlign: 'left', fontWeight: 700 }}>Team {t.team_number}</td>
                    <td style={s.td}>{t.ipad_score}</td>
                    <td style={{ ...s.td, color: '#8a1f1f' }}>−{t.mol_penalty}</td>
                    <td style={{ ...s.td, fontWeight: 800, fontSize: 22 }}>{t.final_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Board>

        <div className="score-two" style={s.two}>
          <Board title="De mollen" hint="Hoeveel punten hun team verloor">
            {moles.length === 0 ? <Empty /> : (
              <ol style={s.list}>
                {moles.map((m, i) => (
                  <li key={m.id} style={{ ...s.item, ...(i === 0 ? s.itemTop : {}) }}>
                    <span style={s.rank}>{i + 1}</span>
                    <span style={s.name}>{m.name}</span>
                    <span style={s.meta}>Team {m.team_number}</span>
                    <span style={{ ...s.value, color: p.ink }}>{m.mole_score}</span>
                  </li>
                ))}
              </ol>
            )}
          </Board>

          <Board title="De speurders" hint="Goede antwoorden van 32">
            {dets.length === 0 ? <Empty /> : (
              <ol style={s.list}>
                {dets.slice(0, 10).map((d, i) => (
                  <li key={d.id} style={{ ...s.item, ...(i === 0 ? s.itemTop : {}) }}>
                    <span style={s.rank}>{i + 1}</span>
                    <span style={s.name}>{d.name}</span>
                    <span style={s.meta}>Team {d.team_number}</span>
                    <span style={{ ...s.value, color: p.teal }}>{d.correct}</span>
                  </li>
                ))}
              </ol>
            )}
          </Board>
        </div>

        <img src="/olearys-logo.png" alt="O'Learys" style={px.footerLogo} />
      </div>
    </div>
  );
}

function Board({ title, hint, children }) {
  return (
    <section style={s.board}>
      <div style={s.boardHead}>
        <h2 style={s.boardTitle}>{title}</h2>
        <span style={s.boardHint}>{hint}</span>
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <p style={{ color: p.muted, fontSize: 14 }}>Geen gegevens.</p>;
}

const SCORE_CSS = `
@media (max-width: 820px) { .score-two { grid-template-columns: 1fr !important; } }
`;

const s = {
  page: { maxWidth: 1000, width: '100%', margin: '0 auto', padding: '20px 0 50px' },
  eyebrow: {
    fontFamily: 'var(--font-head)',
    fontSize: 12, fontWeight: 600, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: p.teal,
    textAlign: 'center', marginBottom: 14,
  },
  board: {
    background: 'rgba(255,255,255,0.55)',
    border: `1px solid ${p.line}`,
    borderRadius: 14,
    padding: '22px 24px',
    marginBottom: 18,
  },
  boardHead: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, marginBottom: 16, flexWrap: 'wrap',
  },
  boardTitle: { fontFamily: 'var(--font-head)', fontSize: 21, fontWeight: 700 },
  boardHint: { fontSize: 12, color: p.muted },
  two: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 },

  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: p.muted, textAlign: 'center', padding: '0 10px 12px',
  },
  td: {
    fontSize: 17, textAlign: 'center', padding: '13px 10px',
    borderTop: `1px solid ${p.line}`,
  },
  trWin: { background: 'rgba(46,107,90,0.14)' },

  list: { listStyle: 'none', margin: 0, padding: 0 },
  item: {
    display: 'grid',
    gridTemplateColumns: '26px 1fr auto auto',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderTop: `1px solid ${p.line}`,
  },
  itemTop: { borderTop: 'none' },
  rank: { fontSize: 13, color: p.muted, fontWeight: 700 },
  name: { fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: 12, color: p.muted, whiteSpace: 'nowrap' },
  value: { fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 800, minWidth: 34, textAlign: 'right' },
};
