import { px, P_KEYFRAMES } from '../theme/participant.js';

// Wrapper voor elk deelnemerscherm: geel, zwarte tekst, O'Learys-logo onderaan.
// Het logo staat donker op geel, dus geen invert-filter.
export default function ParticipantScreen({ children }) {
  return (
    <div style={px.screen}>
      <style>{P_KEYFRAMES}</style>
      <div style={px.center}>
        {children}
        <img src="/olearys-logo.png" alt="O'Learys" style={px.footerLogo} />
      </div>
    </div>
  );
}
