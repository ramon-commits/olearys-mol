# I mol O'Learys

Teambuildingspel voor O'Learys. Elk team heeft een geheime mol. Deelnemers
registreren zich via een QR-code op hun tafel, beantwoorden 8 vragen over
zichzelf, en proberen tijdens vier check-ins te raden wie de mol is door
diezelfde 8 vragen over hem in te vullen. Hoe beter de mol verborgen blijft,
hoe meer punten zijn team verliest.

De facilitator stuurt alles aan vanaf een dashboard.

## Stack

- React 19 + Vite + react-router-dom
- Supabase (Postgres, Auth, Realtime)
- Netlify

## Lokaal draaien

```bash
npm install
cp .env.example .env   # vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in
npm run dev
npm run build
npm run lint
```

## Database

De volledige migratie staat in [`sql/mol_00_full.sql`](./sql/mol_00_full.sql).
Uitvoeren in de SQL-editor van een schoon Supabase-project.

Beveiligingsmodel:

- **Facilitator** = ingelogde Supabase-user. Ziet als enige wie de mol is.
- **Deelnemer** = anon, identificeert zich met een `player_token` uit
  localStorage. Alle deelnemer-calls lopen via SECURITY DEFINER functies die
  alleen de eigen rol teruggeven. `is_mole` van een ander is niet op te vragen.
- De scores (en dus de namen van de mollen) zijn pas publiek op te halen zodra
  de facilitator de fase op 5 zet.

Zet nooit een `service_role` key in dit project. Die is hier niet nodig.

## Twee visuele werelden

- **Facilitator** (login, dashboard, QR): O'Learys-huisstijl. Zwart, teal
  `#2E6B5A`, geel `#FACC15`. Tokens in `src/index.css`.
- **Deelnemer** (scan, card, check-in, scores): donkere noir mol-sfeer.
  `#041214` met groen `#00995F`. Tokens in `src/theme/participant.js`.
