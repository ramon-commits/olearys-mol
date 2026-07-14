import { px, P_KEYFRAMES } from '../theme/participant.js';

// Wrapper voor elk deelnemerscherm: noir-achtergrond, keyframes,
// en het O'Learys-logo discreet onderaan.
export default function ParticipantScreen({ children }) {
  return (
    <div style={px.screen}>
      <style>{P_KEYFRAMES}</style>
      <div style={px.center}>
        {children}
        <img src="/olearys-logo.png" alt="O'Learys" className="logo-invert" style={px.footerLogo} />
      </div>
    </div>
  );
}
