-- ============================================================
-- Wie is de Mol - O'Learys
-- Volledige migratie. Vervangt mol_01 t/m mol_05 uit het oude project.
-- Uitvoeren in de SQL-editor van een SCHOON Supabase-project.
--
-- Beveiligingsmodel:
--   - Facilitator = ingelogde Supabase-user (role 'authenticated')
--   - Deelnemer   = anon, identificeert zich met een player_token uit localStorage
--   - is_mole komt NOOIT bij anon terecht: alle deelnemer-calls lopen via
--     SECURITY DEFINER functies die alleen de eigen rol teruggeven
-- ============================================================

-- ============================================================
-- 1. TABELLEN
-- ============================================================

CREATE TABLE mol_games (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  num_teams     integer NOT NULL CHECK (num_teams >= 2 AND num_teams <= 30),
  max_per_team  integer NOT NULL DEFAULT 8 CHECK (max_per_team >= 2 AND max_per_team <= 10),
  active_phase  integer NOT NULL DEFAULT 0,   -- 0 = registratie, 1-4 = check-ins, 5 = finale/scores
  status        text NOT NULL DEFAULT 'active', -- active | finished
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE mol_players (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid NOT NULL REFERENCES mol_games(id) ON DELETE CASCADE,
  team_number   integer NOT NULL,
  position      integer NOT NULL,             -- positie 2 = de mol
  player_token  uuid NOT NULL DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  appearance    jsonb NOT NULL DEFAULT '{}',  -- 8 antwoorden over jezelf
  is_mole       boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (game_id, team_number, position),
  UNIQUE (player_token)
);

CREATE TABLE mol_votes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         uuid NOT NULL REFERENCES mol_games(id) ON DELETE CASCADE,
  checkin_number  integer NOT NULL CHECK (checkin_number BETWEEN 1 AND 4),
  voter_token     uuid NOT NULL,
  answers         jsonb NOT NULL DEFAULT '{}', -- 8 antwoorden over de mol
  created_at      timestamptz DEFAULT now(),
  UNIQUE (game_id, checkin_number, voter_token)
);

CREATE TABLE mol_team_scores (
  game_id      uuid NOT NULL REFERENCES mol_games(id) ON DELETE CASCADE,
  team_number  integer NOT NULL,
  ipad_score   integer NOT NULL DEFAULT 0,
  mol_penalty  integer NOT NULL DEFAULT 0,
  final_score  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, team_number)
);

CREATE INDEX idx_mol_players_game  ON mol_players(game_id, team_number);
CREATE INDEX idx_mol_players_token ON mol_players(player_token);
CREATE INDEX idx_mol_votes_game    ON mol_votes(game_id, checkin_number);
CREATE INDEX idx_mol_votes_voter   ON mol_votes(voter_token);

-- ============================================================
-- 2. RLS EN POLICIES
-- ============================================================

ALTER TABLE mol_games       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mol_players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE mol_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mol_team_scores ENABLE ROW LEVEL SECURITY;

-- mol_games: iedereen mag lezen (deelnemer moet het actieve spel kunnen vinden),
-- alleen ingelogde facilitators mogen aanmaken, wijzigen en verwijderen.
CREATE POLICY mol_games_read ON mol_games
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY mol_games_write ON mol_games
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- mol_players / mol_votes / mol_team_scores: anon krijgt NIETS.
-- Ingelogde facilitator mag lezen (dashboard + realtime). Schrijven gaat
-- uitsluitend via de SECURITY DEFINER functies hieronder.
CREATE POLICY mol_players_read_admin ON mol_players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY mol_votes_read_admin ON mol_votes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY mol_team_scores_read_admin ON mol_team_scores
  FOR SELECT TO authenticated USING (true);

-- Realtime voor het live facilitator-dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE mol_players;
ALTER PUBLICATION supabase_realtime ADD TABLE mol_votes;

-- ============================================================
-- 3. HELPERS
-- ============================================================

-- Aantal overeenkomende antwoorden tussen twee answer-objecten (max 8).
-- Keys zijn identiek aan molQuestions.js in de frontend.
CREATE OR REPLACE FUNCTION mol_match_count(a jsonb, b jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int
  FROM unnest(ARRAY['age','tenure','hair','height','glasses','shoe','pet','drink']) AS k
  WHERE a ? k AND b ? k AND a->>k = b->>k;
$$;

-- ============================================================
-- 4. DEELNEMER-FUNCTIES (anon, via player_token)
-- ============================================================

-- Registratie: claim een positie in een team. Positie 2 wordt de mol.
CREATE OR REPLACE FUNCTION mol_claim_position(
  p_game_id uuid, p_team_number integer, p_max_per_team integer,
  p_name text, p_appearance jsonb
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_position integer; v_is_mole boolean; v_token uuid; v_player_id uuid; v_phase integer;
BEGIN
  SELECT active_phase INTO v_phase FROM mol_games WHERE id = p_game_id;
  IF v_phase IS NULL THEN RETURN json_build_object('error', 'not_found'); END IF;
  IF v_phase <> 0 THEN RETURN json_build_object('error', 'registration_closed'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_game_id::text || '|mol|' || p_team_number::text));

  SELECT COUNT(*) + 1 INTO v_position FROM mol_players
  WHERE game_id = p_game_id AND team_number = p_team_number;

  IF v_position > p_max_per_team THEN
    RETURN json_build_object('error', 'team_full');
  END IF;

  v_is_mole := (v_position = 2);
  v_token := gen_random_uuid();

  INSERT INTO mol_players (game_id, team_number, position, player_token, name, appearance, is_mole)
  VALUES (p_game_id, p_team_number, v_position, v_token, p_name, p_appearance, v_is_mole)
  RETURNING id INTO v_player_id;

  RETURN json_build_object(
    'player_id', v_player_id, 'player_token', v_token,
    'position', v_position, 'is_mole', v_is_mole, 'team_number', p_team_number
  );
END; $$;

-- Eigen rol ophalen. Geeft alleen de rol van de token-houder terug, nooit die van een ander.
CREATE OR REPLACE FUNCTION mol_get_my_role(p_token uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_player mol_players%ROWTYPE;
BEGIN
  SELECT * INTO v_player FROM mol_players WHERE player_token = p_token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;
  RETURN json_build_object(
    'player_id', v_player.id, 'name', v_player.name,
    'team_number', v_player.team_number, 'is_mole', v_player.is_mole,
    'position', v_player.position
  );
END; $$;

-- Check-in state: fase + eventueel de eigen eerder gegeven antwoorden.
CREATE OR REPLACE FUNCTION mol_get_checkin(p_token uuid, p_checkin integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_player mol_players%ROWTYPE; v_phase integer; v_status text; v_answers jsonb;
BEGIN
  SELECT * INTO v_player FROM mol_players WHERE player_token = p_token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;

  SELECT active_phase, status INTO v_phase, v_status FROM mol_games WHERE id = v_player.game_id;

  SELECT answers INTO v_answers FROM mol_votes
  WHERE voter_token = p_token AND checkin_number = p_checkin AND game_id = v_player.game_id;

  RETURN json_build_object(
    'my_name', v_player.name, 'my_team', v_player.team_number,
    'active_phase', v_phase, 'status', v_status,
    'existing_answers', v_answers   -- null als er nog niet gestemd is
  );
END; $$;

-- Stem uitbrengen: 8 antwoorden over de mol. Eén stem per check-in, niet te overschrijven.
CREATE OR REPLACE FUNCTION mol_cast_vote(p_token uuid, p_checkin integer, p_answers jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_player mol_players%ROWTYPE; v_phase integer; v_existing jsonb;
BEGIN
  SELECT * INTO v_player FROM mol_players WHERE player_token = p_token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;
  IF p_checkin < 1 OR p_checkin > 4 THEN RETURN json_build_object('error', 'bad_checkin'); END IF;

  SELECT active_phase INTO v_phase FROM mol_games WHERE id = v_player.game_id;
  IF v_phase < 1 OR v_phase > 4 THEN RETURN json_build_object('error', 'not_open'); END IF;

  INSERT INTO mol_votes (game_id, checkin_number, voter_token, answers)
  VALUES (v_player.game_id, p_checkin, p_token, p_answers)
  ON CONFLICT (game_id, checkin_number, voter_token) DO NOTHING;

  IF NOT FOUND THEN
    SELECT answers INTO v_existing FROM mol_votes
    WHERE voter_token = p_token AND checkin_number = p_checkin AND game_id = v_player.game_id;
    RETURN json_build_object('error', 'already_voted', 'answers', v_existing);
  END IF;

  RETURN json_build_object('ok', true);
END; $$;

-- ============================================================
-- 5. FACILITATOR-FUNCTIES (alleen voor ingelogde users)
-- ============================================================

-- Live overzicht van een spel, inclusief is_mole. Alleen voor ingelogde facilitators.
CREATE OR REPLACE FUNCTION mol_get_game_overview(p_game_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_game json; v_players json; v_checkins json; v_scores json;
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT row_to_json(g) INTO v_game FROM (
    SELECT id, name, num_teams, max_per_team, active_phase, status, created_at
    FROM mol_games WHERE id = p_game_id
  ) g;
  IF v_game IS NULL THEN RETURN json_build_object('error', 'not_found'); END IF;

  SELECT COALESCE(json_agg(row_to_json(p) ORDER BY p.team_number, p.position), '[]'::json)
  INTO v_players FROM (
    SELECT id, name, team_number, position, is_mole, appearance
    FROM mol_players WHERE game_id = p_game_id
  ) p;

  SELECT COALESCE(json_object_agg(checkin_number, cnt), '{}'::json) INTO v_checkins FROM (
    SELECT checkin_number, COUNT(*) AS cnt FROM mol_votes
    WHERE game_id = p_game_id GROUP BY checkin_number
  ) c;

  SELECT COALESCE(json_object_agg(team_number, ipad_score), '{}'::json) INTO v_scores
  FROM mol_team_scores WHERE game_id = p_game_id;

  RETURN json_build_object(
    'game', v_game, 'players', v_players,
    'checkin_votes', v_checkins, 'ipad_scores', v_scores
  );
END; $$;

-- iPad-score van een team zetten. Alleen voor ingelogde facilitators.
CREATE OR REPLACE FUNCTION mol_set_ipad_score(p_game_id uuid, p_team_number integer, p_ipad_score integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  INSERT INTO mol_team_scores (game_id, team_number, ipad_score)
  VALUES (p_game_id, p_team_number, GREATEST(COALESCE(p_ipad_score, 0), 0))
  ON CONFLICT (game_id, team_number) DO UPDATE
    SET ipad_score  = EXCLUDED.ipad_score,
        final_score = EXCLUDED.ipad_score - mol_team_scores.mol_penalty;

  RETURN json_build_object('ok', true);
END; $$;

-- ============================================================
-- 6. SCORES
-- ============================================================
-- Publiek aanroepbaar (grootbeeld-scherm zonder login), MAAR pas zodra de
-- facilitator de fase op 5 heeft gezet. Daarvoor lekt deze functie de mollen niet.
CREATE OR REPLACE FUNCTION mol_calculate_scores(p_game_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_phase integer; v_team json; v_mole json; v_det json;
BEGIN
  SELECT active_phase INTO v_phase FROM mol_games WHERE id = p_game_id;
  IF v_phase IS NULL THEN RETURN json_build_object('error', 'not_found'); END IF;

  -- Kernbeveiliging: scores (en dus de namen van de mollen) zijn pas op te vragen
  -- als de facilitator ze heeft vrijgegeven. Ingelogde facilitators mogen altijd.
  IF v_phase < 5 AND auth.role() <> 'authenticated' THEN
    RETURN json_build_object('error', 'not_ready');
  END IF;

  -- mol_penalty per team = som van foute antwoorden van niet-mol teamgenoten
  INSERT INTO mol_team_scores (game_id, team_number, ipad_score, mol_penalty, final_score)
  SELECT p_game_id, pen.team_number, 0, pen.penalty, 0 - pen.penalty
  FROM (
    SELECT pl.team_number,
      COALESCE(SUM(8 - mol_match_count(v.answers, molp.appearance))
               FILTER (WHERE v.id IS NOT NULL), 0)::int AS penalty
    FROM mol_players pl
    JOIN mol_players molp
      ON molp.game_id = pl.game_id AND molp.team_number = pl.team_number AND molp.is_mole = true
    LEFT JOIN mol_votes v ON v.voter_token = pl.player_token AND v.game_id = p_game_id
    WHERE pl.game_id = p_game_id AND pl.is_mole = false
    GROUP BY pl.team_number
  ) pen
  ON CONFLICT (game_id, team_number) DO UPDATE
    SET mol_penalty = EXCLUDED.mol_penalty,
        final_score = mol_team_scores.ipad_score - EXCLUDED.mol_penalty;

  SELECT json_agg(row_to_json(t)) INTO v_team FROM (
    SELECT team_number, ipad_score, mol_penalty, final_score
    FROM mol_team_scores WHERE game_id = p_game_id
    ORDER BY final_score DESC
  ) t;

  SELECT json_agg(row_to_json(t)) INTO v_mole FROM (
    SELECT molp.id, molp.name, molp.team_number, COALESCE(ts.mol_penalty, 0) AS mole_score
    FROM mol_players molp
    LEFT JOIN mol_team_scores ts
      ON ts.game_id = molp.game_id AND ts.team_number = molp.team_number
    WHERE molp.game_id = p_game_id AND molp.is_mole = true
    ORDER BY mole_score DESC
  ) t;

  SELECT json_agg(row_to_json(t)) INTO v_det FROM (
    SELECT pl.id, pl.name, pl.team_number,
      COALESCE(SUM(mol_match_count(v.answers, molp.appearance))
               FILTER (WHERE v.id IS NOT NULL), 0)::int AS correct,
      32 AS max_correct
    FROM mol_players pl
    JOIN mol_players molp
      ON molp.game_id = pl.game_id AND molp.team_number = pl.team_number AND molp.is_mole = true
    LEFT JOIN mol_votes v ON v.voter_token = pl.player_token AND v.game_id = p_game_id
    WHERE pl.game_id = p_game_id AND pl.is_mole = false
    GROUP BY pl.id, pl.name, pl.team_number
    ORDER BY correct DESC
  ) t;

  RETURN json_build_object(
    'team_ranking',      COALESCE(v_team, '[]'::json),
    'mole_ranking',      COALESCE(v_mole, '[]'::json),
    'detective_ranking', COALESCE(v_det,  '[]'::json)
  );
END; $$;

-- ============================================================
-- 7. RECHTEN
-- ============================================================
REVOKE EXECUTE ON FUNCTION mol_get_game_overview(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION mol_set_ipad_score(uuid, integer, integer) FROM anon;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 8. VERIFICATIE (hoort 7 functies te tonen)
-- ============================================================
SELECT proname FROM pg_proc
WHERE proname IN (
  'mol_claim_position','mol_get_my_role','mol_get_checkin','mol_cast_vote',
  'mol_get_game_overview','mol_set_ipad_score','mol_calculate_scores'
)
ORDER BY proname;
