import { useParams } from 'react-router-dom';
import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px } from '../../theme/participant.js';

// Stub. Wordt stap 3: 8 vragen over de mol -> mol_cast_vote.
export default function Checkin() {
  const { number } = useParams();
  return (
    <ParticipantScreen>
      <h1 style={px.title}>Check-in {number}</h1>
      <p style={px.sub}>Hier komen de vragen over de mol.</p>
    </ParticipantScreen>
  );
}
