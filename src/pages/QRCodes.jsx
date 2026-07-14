import { useParams } from 'react-router-dom';

// Stub. Wordt stap 3: team-QR's + 4 check-in QR's, printbaar.
export default function QRCodes() {
  const { gameId } = useParams();
  return (
    <div>
      <h1 style={{ fontSize: 26 }}>QR codes</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
        Spel {gameId}. Hier komen de team-QR&apos;s en de check-in QR&apos;s.
      </p>
    </div>
  );
}
