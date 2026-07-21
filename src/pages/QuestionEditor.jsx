import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

// Vragen-editor per spel.
//  - Boven: de vragenlijst (8 tot 20). Elke vraag heeft een registratietekst,
//    een check-in-tekst en antwoordopties.
//  - Onder: per check-in (1,2,3) kiezen welke vragen meetellen. Niets aangevinkt
//    voor een check-in = alle vragen. Check-in 4 is de ontmaskering, die staat vast.
//
// Aanpassen kan alleen zolang het spel nog in registratie staat (active_phase 0).
// Daarna liggen de antwoorden van de deelnemers vast en zou wijzigen de scoring
// kapotmaken.
const MAX_QUESTIONS = 20;
const MIN_QUESTIONS = 4;

export default function QuestionEditor({ game, onBack }) {
  const locked = game.active_phase !== 0;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [config, setConfig] = useState({ 1: new Set(), 2: new Set(), 3: new Set() });
  const [unmask, setUnmask] = useState(game.unmask_points ?? 50);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data: qs } = await supabase
      .from('mol_questions')
      .select('*')
      .eq('game_id', game.id)
      .order('sort_order');

    const { data: cfg } = await supabase
      .from('mol_checkin_config')
      .select('*')
      .eq('game_id', game.id);

    const map = { 1: new Set(), 2: new Set(), 3: new Set() };
    (cfg ?? []).forEach((r) => map[r.checkin_number]?.add(r.question_id));

    setQuestions((qs ?? []).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
      optionsText: (Array.isArray(q.options) ? q.options : []).join(', '),
    })));
    setConfig(map);
    setLoading(false);
  }, [game.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function updateQuestion(id, field, value) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    const tempId = `new_${Date.now()}`;
    const nextOrder = (questions[questions.length - 1]?.sort_order ?? 0) + 1;
    setQuestions((prev) => [...prev, {
      id: tempId,
      isNew: true,
      sort_order: nextOrder,
      qkey: `q_${nextOrder}_${Math.random().toString(36).slice(2, 6)}`,
      self_text: '',
      mol_text: '',
      options: [],
      optionsText: '',
    }]);
  }

  function removeQuestion(id) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setConfig((prev) => {
      const next = { 1: new Set(prev[1]), 2: new Set(prev[2]), 3: new Set(prev[3]) };
      [1, 2, 3].forEach((c) => next[c].delete(id));
      return next;
    });
  }

  function toggleConfig(checkin, questionId) {
    setConfig((prev) => {
      const next = { 1: new Set(prev[1]), 2: new Set(prev[2]), 3: new Set(prev[3]) };
      if (next[checkin].has(questionId)) next[checkin].delete(questionId);
      else next[checkin].add(questionId);
      return next;
    });
  }

  function selectAll(checkin, on) {
    setConfig((prev) => {
      const next = { 1: new Set(prev[1]), 2: new Set(prev[2]), 3: new Set(prev[3]) };
      next[checkin] = on ? new Set(questions.map((q) => q.id)) : new Set();
      return next;
    });
  }

  async function save() {
    setError('');

    // Validatie
    const clean = questions.map((q) => ({
      ...q,
      self_text: q.self_text.trim(),
      mol_text: q.mol_text.trim(),
      options: q.optionsText.split(',').map((o) => o.trim()).filter(Boolean),
    }));

    if (clean.length < MIN_QUESTIONS) {
      setError(`Minimaal ${MIN_QUESTIONS} vragen nodig.`);
      return;
    }
    for (const q of clean) {
      if (!q.self_text || !q.mol_text) {
        setError('Elke vraag heeft een registratietekst en een check-in-tekst nodig.');
        return;
      }
      if (q.options.length < 2) {
        setError(`"${q.self_text || 'nieuwe vraag'}" heeft minstens 2 antwoordopties nodig.`);
        return;
      }
    }

    setSaving(true);

    // 1. Verwijderde vragen weg (cascade ruimt config op)
    const keptIds = clean.filter((q) => !q.isNew).map((q) => q.id);
    const { data: existing } = await supabase
      .from('mol_questions').select('id').eq('game_id', game.id);
    const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !keptIds.includes(id));
    if (toDelete.length) {
      await supabase.from('mol_questions').delete().in('id', toDelete);
    }

    // 2. Upsert bestaande + nieuwe. Nieuwe krijgen een echt id van de db.
    const idRemap = {}; // tempId -> echt id
    for (let i = 0; i < clean.length; i++) {
      const q = clean[i];
      const row = {
        game_id: game.id,
        sort_order: i + 1,
        qkey: q.qkey,
        self_text: q.self_text,
        mol_text: q.mol_text,
        options: q.options,
      };
      if (q.isNew) {
        const { data, error: e } = await supabase
          .from('mol_questions').insert(row).select('id').single();
        if (e) { setError(e.message); setSaving(false); return; }
        idRemap[q.id] = data.id;
      } else {
        const { error: e } = await supabase
          .from('mol_questions').update(row).eq('id', q.id);
        if (e) { setError(e.message); setSaving(false); return; }
      }
    }

    // 3. Check-in config opnieuw wegschrijven
    await supabase.from('mol_checkin_config').delete().eq('game_id', game.id);
    const rows = [];
    [1, 2, 3].forEach((c) => {
      config[c].forEach((qid) => {
        const realId = idRemap[qid] || qid;
        // alleen als de vraag nog bestaat
        if (clean.some((q) => (q.isNew ? idRemap[q.id] : q.id) === realId)) {
          rows.push({ game_id: game.id, checkin_number: c, question_id: realId });
        }
      });
    });
    if (rows.length) {
      const { error: e } = await supabase.from('mol_checkin_config').insert(rows);
      if (e) { setError(e.message); setSaving(false); return; }
    }

    // 4. Ontmaskering-punten
    await supabase.from('mol_games')
      .update({ unmask_points: Math.max(0, parseInt(unmask, 10) || 0) })
      .eq('id', game.id);

    setSaving(false);
    setSavedAt(Date.now());
    await load();
  }

  if (loading) return <p style={st.muted}>Vragen laden…</p>;

  return (
    <div>
      <button onClick={onBack} style={st.back}>← Terug naar spel</button>
      <h1 style={st.h1}>Vragenlijst · {game.name}</h1>

      {locked ? (
        <div style={st.lockBanner}>
          De check-ins zijn al gestart, dus de vragen liggen vast. Aanpassen kan alleen
          zolang een spel nog in registratie staat.
        </div>
      ) : (
        <p style={st.muted}>
          {questions.length} vragen. Deelnemers vullen deze bij registratie over zichzelf in,
          en beantwoorden ze bij de check-ins over de mol.
        </p>
      )}

      {/* VRAGEN */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={st.qcard}>
            <div style={st.qhead}>
              <span style={st.qnum}>{i + 1}</span>
              {!locked && (
                <button
                  onClick={() => removeQuestion(q.id)}
                  disabled={questions.length <= MIN_QUESTIONS}
                  style={st.qremove}
                  title={questions.length <= MIN_QUESTIONS ? `Minimaal ${MIN_QUESTIONS} vragen` : 'Verwijder vraag'}
                >
                  Verwijderen
                </button>
              )}
            </div>

            <label style={st.label}>Vraag over jezelf (registratie)</label>
            <input
              value={q.self_text} disabled={locked}
              onChange={(e) => updateQuestion(q.id, 'self_text', e.target.value)}
              placeholder="Wat is je haarkleur?"
              style={st.input}
            />

            <label style={{ ...st.label, marginTop: 10 }}>Vraag over de mol (check-in)</label>
            <input
              value={q.mol_text} disabled={locked}
              onChange={(e) => updateQuestion(q.id, 'mol_text', e.target.value)}
              placeholder="Welke haarkleur heeft de mol?"
              style={st.input}
            />

            <label style={{ ...st.label, marginTop: 10 }}>Antwoordopties (komma's ertussen)</label>
            <input
              value={q.optionsText} disabled={locked}
              onChange={(e) => updateQuestion(q.id, 'optionsText', e.target.value)}
              placeholder="blond, bruin, zwart, rood, grijs"
              style={st.input}
            />
          </div>
        ))}
      </div>

      {!locked && (
        <button
          onClick={addQuestion}
          disabled={questions.length >= MAX_QUESTIONS}
          style={{ ...st.secondary, marginTop: 12 }}
        >
          {questions.length >= MAX_QUESTIONS ? `Maximum van ${MAX_QUESTIONS} bereikt` : '+ Vraag toevoegen'}
        </button>
      )}

      {/* CHECK-IN CONFIG */}
      <h2 style={st.h2}>Welke vragen bij welke check-in?</h2>
      <p style={st.muted}>
        Vink aan welke vragen in een check-in gesteld worden. Vink je niets aan, dan
        gelden automatisch alle vragen. Check-in 4 is de ontmaskering.
      </p>

      <div style={st.checkinCols}>
        {[1, 2, 3].map((c) => {
          const count = config[c].size;
          return (
            <div key={c} style={st.checkinCol}>
              <div style={st.checkinColHead}>
                <span>Check-in {c}</span>
                <span style={st.checkinCount}>
                  {count === 0 ? 'alle' : `${count} van ${questions.length}`}
                </span>
              </div>
              {!locked && (
                <div style={st.selectRow}>
                  <button style={st.tiny} onClick={() => selectAll(c, true)}>Alles</button>
                  <button style={st.tiny} onClick={() => selectAll(c, false)}>Geen</button>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                {questions.map((q, i) => (
                  <label key={q.id} style={st.checkRow}>
                    <input
                      type="checkbox"
                      checked={config[c].has(q.id)}
                      disabled={locked}
                      onChange={() => toggleConfig(c, q.id)}
                      style={{ width: 'auto' }}
                    />
                    <span style={st.checkText}>{i + 1}. {q.self_text || q.mol_text || 'vraag'}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* Check-in 4 vast */}
        <div style={{ ...st.checkinCol, background: 'var(--yellow-soft)', borderColor: 'var(--yellow)' }}>
          <div style={st.checkinColHead}>
            <span>Check-in 4</span>
            <span style={st.checkinCount}>ontmaskering</span>
          </div>
          <p style={{ ...st.muted, marginTop: 8 }}>
            Elke speler wijst aan wie hij de mol vindt.
          </p>
          <label style={{ ...st.label, marginTop: 10 }}>Punten</label>
          <input
            type="number" min={0} max={500} value={unmask} disabled={locked}
            onChange={(e) => setUnmask(e.target.value)}
            style={st.input}
          />
        </div>
      </div>

      {error && <div style={st.error}>{error}</div>}

      {!locked && (
        <div style={st.saveBar}>
          <button onClick={save} disabled={saving} style={st.saveBtn}>
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
          {savedAt && <span style={st.saved}>Opgeslagen ✓</span>}
        </div>
      )}
    </div>
  );
}

const st = {
  h1: { fontSize: 27 },
  h2: { fontSize: 18, marginTop: 36, marginBottom: 6 },
  muted: { fontSize: 14, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: 'var(--text)' },
  input: {
    fontSize: 14, padding: '0.55rem 0.7rem', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', background: 'var(--surface)', width: '100%',
  },
  back: {
    background: 'transparent', color: 'var(--text-muted)', padding: 0,
    fontSize: 14, fontWeight: 500, marginBottom: 16,
  },
  qcard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 16,
  },
  qhead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  qnum: {
    fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 15,
    width: 26, height: 26, borderRadius: '50%', background: 'var(--yellow)',
    color: 'var(--black)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qremove: {
    background: 'transparent', color: 'var(--danger)', border: '1px solid #f3c9c9',
    fontSize: 12, padding: '0.35rem 0.7rem',
  },
  secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
  checkinCols: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 12, marginTop: 16,
  },
  checkinCol: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: 14,
  },
  checkinColHead: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 15,
  },
  checkinCount: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' },
  selectRow: { display: 'flex', gap: 6, marginTop: 8 },
  tiny: {
    background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
    fontSize: 11, padding: '0.25rem 0.6rem',
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
    fontSize: 13, cursor: 'pointer',
  },
  checkText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  lockBanner: {
    background: 'var(--yellow-soft)', border: '1px solid var(--yellow)',
    borderRadius: 'var(--radius)', padding: '0.8rem 1rem', fontSize: 14,
    marginTop: 12, lineHeight: 1.5,
  },
  error: {
    color: 'var(--danger)', background: 'var(--danger-soft)',
    border: '1px solid #f3c9c9', borderRadius: 'var(--radius)',
    padding: '0.6rem 0.75rem', fontSize: 13, marginTop: 16,
  },
  saveBar: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 24 },
  saveBtn: { fontSize: 15, padding: '0.7rem 1.6rem' },
  saved: { fontSize: 13, color: 'var(--teal)', fontWeight: 600 },
};
