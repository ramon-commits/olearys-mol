import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import AdminLayout from './components/AdminLayout.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import QRCodes from './pages/QRCodes.jsx';

import Scan from './pages/participant/Scan.jsx';
import Card from './pages/participant/Card.jsx';
import Checkin from './pages/participant/Checkin.jsx';
import Scores from './pages/participant/Scores.jsx';

// Routes
// /                  Login                     (publiek)
// /dashboard         spel-overzicht            (facilitator, auth + layout)
// /qr-codes/:gameId  QR codes                  (facilitator, auth + layout)
// /scan/:team        registratie               (deelnemer, fullscreen)
// /card              eigen rolkaart            (deelnemer, fullscreen)
// /checkin/:number   stemronde 1-4             (deelnemer, fullscreen)
// /scores            scoreborden grootbeeld    (publiek, fullscreen)

function Admin({ children }) {
  return (
    <RequireAuth>
      <AdminLayout>{children}</AdminLayout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/dashboard" element={<Admin><Dashboard /></Admin>} />
          <Route path="/dashboard/:gameId" element={<Admin><Dashboard /></Admin>} />
          <Route path="/qr-codes/:gameId" element={<Admin><QRCodes /></Admin>} />

          <Route path="/scan/:team" element={<Scan />} />
          <Route path="/card" element={<Card />} />
          <Route path="/checkin/:number" element={<Checkin />} />
          <Route path="/scores" element={<Scores />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
