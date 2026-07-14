import { useParams } from 'react-router-dom';
import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px } from '../../theme/participant.js';

// Stub. Wordt stap 2: registratie (naam + 8 vragen) -> mol_claim_position.
export default function Scan() {
  const { team } = useParams();
  return (
    <ParticipantScreen>
      <h1 style={px.title}>I mol O&apos;Learys</h1>
      <p style={px.sub}>Team {team}. Registratie komt hier.</p>
    </ParticipantScreen>
  );
}
