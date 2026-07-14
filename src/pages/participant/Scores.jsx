import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px } from '../../theme/participant.js';

// Stub. Wordt stap 3: teamranking, beste mol, beste speurder. Grootbeeld.
export default function Scores() {
  return (
    <ParticipantScreen>
      <h1 style={px.title}>Eindscores</h1>
      <p style={px.sub}>Hier komen de scoreborden.</p>
    </ParticipantScreen>
  );
}
