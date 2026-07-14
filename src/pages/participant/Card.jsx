import ParticipantScreen from '../../components/ParticipantScreen.jsx';
import { px } from '../../theme/participant.js';

// Stub. Wordt stap 2: eigen rolkaart via mol_get_my_role. Groen = speler, geel = mol.
export default function Card() {
  return (
    <ParticipantScreen>
      <h1 style={px.title}>Jouw rol</h1>
      <p style={px.sub}>Hier komt je spelerskaart.</p>
    </ParticipantScreen>
  );
}
