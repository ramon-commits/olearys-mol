import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { fetchGameOverview } from '../lib/game.js';

// /dashboard - facilitator. Spel aanmaken, live volgen, fases doorzetten,
// iPad-scores invoeren. Dit is het enige scherm waar de mol zichtbaar is.
export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [view, setView] = useState('list'); // list | create | detail
  const [overview, setOverview] = useState(null);

  const loadGames = useCallback(async () => {
    const { data } = await supabase
      .from('mol_games')
      .select('*')
      .order('created_at', { ascending: false });
    setGames(data ?? []);
    setLoading(false);
  }, []);

  const openGame = useCallback(async (id) => {
    const ov = await fetchGameOverview(id);
    if (!ov) { await loadGames(); setView('list'); return; }
    setOverview(ov);
    setView('detail');
  }, [loadGames]);

  // Eenmalige data-load bij mount. De setState zit in de async callback,
  // niet in de effect-body zelf.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadGames(); }, [loadGames]);

  function backToList() {
    setOverview(null);
    setView('list');
    loadGames();
  }

  if (loading) return <p style={st.muted}>Laden…</p>;

  if (view === 'create') {
    return (
      <CreateGame
        onCancel={() => setView('list')}
        onCreated={async (id) => { await loadGames(); await openGame(id); }}
      />
    );
  }

  if (view === 'detail' && overview) {
    return (
      <LiveGame
        overview={overview}
        reload={() => openGame(overview.game.id)}
        onBack={backToList}
        navigate={navigate}
      />
    );
  }

  return <GameList games={games} onOpen={openGame} onNew={() => setView('create')} onReload={loadGames} />;
}

// ============================================================
// Overzicht
// ============================================================
function GameList({ games, onOpen, onNew, onReload }) {
  async function remove(game) {
    if (!window.confirm(`"${game.name}" verwijderen? Alle spelers en stemmen gaan mee.`)) return;
    await supabase.from('mol_games').delete().eq('id', game.id);
    await onReload();
  }

  return (
    <div>
      <div style={st.topbar}>
        <div>
          <h1 style={st.h1}>Spellen</h1>
          <p style={st.muted}>Kies een lopend spel of start een nieuw spel.</p>
        </div>
        <button onClick={onNew} style={st.bigAction}>Nieuw spel</button>
      </div>

      {games.length === 0 ? (
        <div style={{ ...st.card, color: 'var(--text-muted)' }}>
          Nog geen spellen. Start je eerste spel.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map((g) => {
            const b = badgeFor(g);
            return (
              <div key={g.id} style={st.row}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(g.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpen(g.id); }}
                  style={st.rowMain}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={st.rowName}>{g.name}</div>
                    <div style={st.rowMeta}>{formatDate(g.created_at)} · {g.num_teams} teams</div>
                  </div>
                  <span style={{ ...st.badge, background: b.bg, color: b.fg }}>{b.text}</span>
                </div>
                <button onClick={() => remove(g)} aria-label={`Verwijder ${g.name}`} style={st.iconBtn}>
                  <IconTrash />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Spel aanmaken
// ============================================================
function CreateGame({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [numTeams, setNumTeams] = useState(4);
  const [maxPerTeam, setMaxPerTeam] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Geef het spel een naam.'); return; }
    setBusy(true);
    setError('');

    const { data, error: err } = await supabase
      .from('mol_games')
      .insert({
        name: name.trim(),
        num_teams: numTeams,
        max_per_team: maxPerTeam,
        active_phase: 0,
        status: 'active',
      })
      .select()
      .single();

    if (err) { setError(err.message); setBusy(false); return; }
    await onCreated(data.id);
  }

  return (
    <div>
      <button onClick={onCancel} disabled={busy} style={st.back}>← Terug</button>
      <h1 style={st.h1}>Nieuw spel</h1>
      <p style={st.muted}>De tweede persoon die zich in een team registreert wordt de mol.</p>

      <form onSubmit={submit} style={{ ...st.card, maxWidth: 480, marginTop: 22 }}>
        <Field label="Naam van het spel">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Vrijdagavond O'Learys"
            disabled={busy}
            autoFocus
          />
        </Field>
        <Field label="Aantal teams">
          <input
            type="number" min={2} max={30} value={numTeams} disabled={busy}
            onChange={(e) => setNumTeams(clamp(e.target.value, 2, 30))}
          />
        </Field>
        <Field label="Maximaal per team">
          <input
            type="number" min={2} max={10} value={maxPerTeam} disabled={busy}
            onChange={(e) => setMaxPerTeam(clamp(e.target.value, 2, 10))}
          />
        </Field>

        {error && <div style={st.error}>{error}</div>}

        <button type="submit" disabled={busy} style={{ marginTop: 8 }}>
          {busy ? 'Bezig…' : 'Spel starten'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// Live spel
// ============================================================
function LiveGame({ overview, reload, onBack, navigate }) {
  const { game, players, checkin_votes, ipad_scores } = overview;
  const [busy, setBusy] = useState(false);
  const [ipad, setIpad] = useState(ipad_scores || {});
  const [showMoles, setShowMoles] = useState(false);

  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; }, [reload]);

  // Realtime: registraties en stemmen komen binnen zonder verversen.
  useEffect(() => {
    const channel = supabase
      .channel(`live-${game.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mol_players', filter: `game_id=eq.${game.id}` },
        () => reloadRef.current())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mol_votes', filter: `game_id=eq.${game.id}` },
        () => reloadRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [game.id]);

  async function saveIpad(team, value) {
    const score = Math.max(0, parseInt(value, 10) || 0);
    setIpad((prev) => ({ ...prev, [team]: score }));
    await supabase.rpc('mol_set_ipad_score', {
      p_game_id: game.id, p_team_number: team, p_ipad_score: score,
    });
  }

  async function setPhase(phase) {
    if (busy) return;
    setBusy(true);
    await supabase.from('mol_games').update({ active_phase: phase }).eq('id', game.id);
    await reload();
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm('Spel verwijderen? Alle spelers en stemmen gaan mee.')) return;
    setBusy(true);
    await supabase.from('mol_games').delete().eq('id', game.id);
    onBack();
  }

  const teams = {};
  players.forEach((pl) => { (teams[pl.team_number] ||= []).push(pl); });
  const teamNumbers = Object.keys(teams).map(Number).sort((a, b) => a - b);

  const registered = players.length;
  const teamsFull = teamNumbers.filter((t) => teams[t].length >= game.max_per_team).length;
  const votes = (n) => checkin_votes?.[n] ?? checkin_votes?.[String(n)] ?? 0;
  const done = registered > 0 ? [1, 2, 3, 4].filter((n) => votes(n) >= registered).length : 0;

  const b = badgeFor(game);

  return (
    <div>
      <button onClick={onBack} style={st.back}>← Terug</button>

      <div style={st.topbar}>
        <div>
          <h1 style={st.h1}>{game.name}</h1>
          <span style={{ ...st.badge, background: b.bg, color: b.fg, marginTop: 8 }}>{b.text}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {game.active_phase === 0 && (
            <button onClick={() => setPhase(1)} disabled={busy || registered === 0} style={st.bigAction}>
              {busy ? 'Bezig…' : 'Check-ins openen'}
            </button>
          )}
          {game.active_phase >= 1 && game.active_phase < 5 && (
            <button onClick={() => setPhase(5)} disabled={busy} style={st.bigAction}>
              {busy ? 'Bezig…' : 'Scores vrijgeven'}
            </button>
          )}
          {game.active_phase === 5 && (
            <button onClick={() => window.open('/scores', '_blank')} style={st.bigAction}>
              Scorebord openen
            </button>
          )}
        </div>
      </div>

      <div style={st.metrics}>
        <Metric label="Geregistreerd" value={registered} />
        <Metric label="Teams vol" value={`${teamsFull} / ${game.num_teams}`} />
        <Metric label="Check-ins compleet" value={`${done} / 4`} />
        <Metric label="Fase" value={b.text} />
      </div>

      <h2 style={st.h2}>Check-in voortgang</h2>
      <div style={st.checkinGrid}>
        {[1, 2, 3, 4].map((n) => {
          const v = votes(n);
          const complete = registered > 0 && v >= registered;
          return (
            <div key={n} style={{ ...st.card, borderColor: complete ? 'var(--teal)' : 'var(--border)' }}>
              <div style={st.cardLabel}>Check-in {n}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <span style={{ fontFamily: 'var(--font-head)', fontSize: 30, fontWeight: 700, color: complete ? 'var(--teal)' : 'var(--text)', lineHeight: 1 }}>
                  {v}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>van {registered}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginTop: 34 }}>
        <h2 style={{ ...st.h2, marginTop: 0 }}>Teams</h2>
        <button onClick={() => setShowMoles((v) => !v)} style={st.ghost}>
          {showMoles ? 'Verberg mollen' : 'Toon mollen'}
        </button>
      </div>
      <p style={{ ...st.muted, marginTop: -6, marginBottom: 14 }}>
        De mol staat standaard verborgen. Zet hem alleen aan als niemand meekijkt.
      </p>

      {teamNumbers.length === 0 ? (
        <div style={{ ...st.card, color: 'var(--text-muted)' }}>
          Nog niemand geregistreerd. Deelnemers scannen de QR op hun tafel.
        </div>
      ) : (
        <div style={st.teamGrid}>
          {teamNumbers.map((t) => (
            <div key={t} style={st.card}>
              <div style={st.teamHead}>
                Team {t}
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  {' '}{teams[t].length}/{game.max_per_team}
                </span>
              </div>

              <label style={st.ipadRow}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>iPad-score</span>
                <input
                  type="number" min={0} style={st.ipadInput} placeholder="0"
                  value={ipad[t] ?? ipad[String(t)] ?? ''}
                  onChange={(e) => setIpad((prev) => ({ ...prev, [t]: e.target.value }))}
                  onBlur={(e) => saveIpad(t, e.target.value)}
                />
              </label>

              <div>
                {[...teams[t]].sort((a, c) => a.position - c.position).map((pl) => (
                  <div key={pl.id} style={st.playerRow}>
                    <span>
                      <span style={{ color: 'var(--text-muted)' }}>{pl.position}.</span> {pl.name}
                    </span>
                    {showMoles && pl.is_mole && <span style={st.moleTag}>MOL</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={st.bottom}>
        <button onClick={() => navigate(`/qr-codes/${game.id}`)} style={st.secondary}>QR codes</button>
        {game.active_phase === 5 && (
          <button onClick={() => setPhase(1)} disabled={busy} style={st.secondary}>
            Terug naar check-ins
          </button>
        )}
        <button onClick={remove} disabled={busy} style={st.danger}>Spel verwijderen</button>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function badgeFor(game) {
  if (game.status === 'finished') return { text: 'Afgerond', bg: 'var(--surface-2)', fg: 'var(--text-muted)' };
  if (game.active_phase === 0) return { text: 'Registratie', bg: 'var(--teal-soft)', fg: 'var(--teal)' };
  if (game.active_phase === 5) return { text: 'Scores', bg: 'var(--yellow-soft)', fg: '#8a6d00' };
  return { text: 'Check-ins', bg: 'var(--teal-soft)', fg: 'var(--teal)' };
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

function clamp(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div style={st.card}>
      <div style={st.cardLabel}>{label}</div>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 700, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const st = {
  h1: { fontSize: 27 },
  h2: { fontSize: 17, marginTop: 34, marginBottom: 14 },
  muted: { fontSize: 14, color: 'var(--text-muted)', marginTop: 4 },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    padding: 18,
  },
  cardLabel: { fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 },
  topbar: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, marginBottom: 24, flexWrap: 'wrap',
  },
  bigAction: { fontSize: 15, padding: '0.7rem 1.3rem', whiteSpace: 'nowrap' },
  back: {
    background: 'transparent', color: 'var(--text-muted)', padding: 0,
    fontSize: 14, fontWeight: 500, marginBottom: 16,
  },
  ghost: {
    background: 'transparent', color: 'var(--text-muted)',
    border: '1px solid var(--border)', fontSize: 13, padding: '0.4rem 0.8rem',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--surface)', border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    borderRadius: 'var(--radius)', padding: '12px 14px 12px 18px',
  },
  rowMain: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, flex: 1, minWidth: 0, cursor: 'pointer',
  },
  rowName: {
    fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  rowMeta: { fontSize: 13, color: 'var(--text-muted)', marginTop: 2 },
  badge: {
    display: 'inline-block', fontSize: 12, fontWeight: 700,
    padding: '4px 11px', borderRadius: 99, whiteSpace: 'nowrap',
  },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 },
  checkinGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  teamGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 },
  teamHead: { fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 16, marginBottom: 12 },
  ipadRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)',
  },
  ipadInput: { width: 88, padding: '6px 10px', fontSize: 14 },
  playerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 14, padding: '7px 0', borderBottom: '1px solid var(--border)',
  },
  moleTag: {
    fontSize: 10, fontWeight: 800, color: '#000', background: 'var(--yellow)',
    padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em',
  },
  iconBtn: {
    background: 'transparent', color: 'var(--danger)', padding: 8,
    display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
  danger: { background: 'transparent', color: 'var(--danger)', border: '1px solid #f3c9c9' },
  bottom: { display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' },
  error: {
    color: 'var(--danger)', background: 'var(--danger-soft)',
    border: '1px solid #f3c9c9', borderRadius: 'var(--radius)',
    padding: '0.6rem 0.75rem', fontSize: 13, marginBottom: 12,
  },
};
