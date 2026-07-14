import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase.js';

const APP_URL = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');

// /qr-codes/:gameId - alles wat je moet afdrukken.
// Team-codes gaan op de tafels, check-in codes bij de vier opdrachtstations.
// Geen van beide bevat het game-id: ze pakken automatisch het actieve spel,
// dus je kunt dezelfde print bij elk volgend spel hergebruiken.
export default function QRCodes() {
  const navigate = useNavigate();
  const { gameId } = useParams();

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [teams, setTeams] = useState([]);
  const [checkins, setCheckins] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from('mol_games').select('*').eq('id', gameId).limit(1);
      const g = data?.[0] ?? null;
      if (!active) return;
      setGame(g);

      if (g) {
        const t = [];
        for (let i = 1; i <= g.num_teams; i++) {
          const url = `${APP_URL}/scan/${i}`;
          t.push({ n: i, url, img: await QRCode.toDataURL(url, { width: 320, margin: 1 }) });
        }
        const c = [];
        for (let i = 1; i <= 4; i++) {
          const url = `${APP_URL}/checkin/${i}`;
          c.push({ n: i, url, img: await QRCode.toDataURL(url, { width: 320, margin: 1 }) });
        }
        if (!active) return;
        setTeams(t);
        setCheckins(c);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [gameId]);

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>QR codes genereren…</p>;

  if (!game) {
    return (
      <div>
        <h1 style={{ fontSize: 27 }}>QR codes</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Dit spel bestaat niet meer.</p>
        <button onClick={() => navigate('/dashboard')} style={{ marginTop: 18 }}>Naar spellen</button>
      </div>
    );
  }

  return (
    <div className="qr-root">
      <style>{PRINT_CSS}</style>

      <div className="qr-screen">
        <button onClick={() => navigate('/dashboard')} style={styles.back}>← Terug</button>

        <div style={styles.head}>
          <div>
            <h1 style={{ fontSize: 27 }}>QR codes</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 520 }}>
              {game.name}. Hang de teamcodes op de tafels en de check-in codes bij de vier
              opdrachtstations. Deze print werkt ook bij een volgend spel.
            </p>
          </div>
          <button onClick={() => window.print()}>Afdrukken</button>
        </div>
      </div>

      <div className="qr-label">Check-in stations</div>
      <div className="qr-grid qr-grid-4">
        {checkins.map(({ n, url, img }) => (
          <div key={n} className="qr-cell qr-cell-checkin">
            <img src={img} alt={`Check-in ${n}`} className="qr-img" />
            <div className="qr-caption">Check-in {n}</div>
            <div className="qr-url">{url}</div>
          </div>
        ))}
      </div>

      <div className="qr-label">Teams</div>
      <div className="qr-grid qr-grid-3">
        {teams.map(({ n, url, img }) => (
          <div key={n} className="qr-cell">
            <img src={img} alt={`Team ${n}`} className="qr-img" />
            <div className="qr-caption">Team {n}</div>
            <div className="qr-url">{url}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  back: {
    background: 'transparent', color: 'var(--text-muted)', padding: 0,
    fontSize: 14, fontWeight: 500, marginBottom: 16,
  },
  head: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, marginBottom: 28, flexWrap: 'wrap',
  },
};

// Op het scherm donker, op papier wit. De QR-plaatjes zijn zwart-op-wit en
// blijven dus in beide gevallen scanbaar.
const PRINT_CSS = `
.qr-label {
  font-family: var(--font-head);
  font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--text); margin: 30px 0 14px;
}
.qr-grid { display: grid; gap: 16px; }
.qr-grid-3 { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.qr-grid-4 { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.qr-cell {
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px; text-align: center; color: var(--text);
}
.qr-cell-checkin { box-shadow: inset 0 0 0 3px #facc15; }
.qr-img { width: 100%; max-width: 190px; height: auto; display: block; margin: 0 auto; }
.qr-caption { font-family: var(--font-head); font-size: 20px; font-weight: 700; margin-top: 8px; }
.qr-url { font-size: 10px; color: #6b7280; margin-top: 4px; word-break: break-all; }

@media print {
  .qr-screen { display: none !important; }
  aside { display: none !important; }
  body, .qr-root { background: #fff !important; color: #000 !important; }
  .qr-label { color: #000 !important; page-break-before: always; }
  .qr-grid-3, .qr-grid-4 { grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .qr-cell { border: none; page-break-inside: avoid; }
  .qr-cell-checkin { box-shadow: none; }
  .qr-img { max-width: 300px; }
}
`;
