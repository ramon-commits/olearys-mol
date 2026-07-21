-- ============================================================
-- I mol O'Learys - uitbreiding: aanpasbare vragen per event
-- Draai dit NA mol_00_full.sql, in hetzelfde Supabase-project.
--
-- Wat dit toevoegt:
--   1. mol_questions          vragen per spel (8 tot 20), eigen tekst + opties
--   2. mol_checkin_config     per check-in (1,2,3): welke vragen, hoeveel
--   3. Check-in 4 = ontmaskering: raad wie de mol is, waarde instelbaar
--   4. Seed-functie die een nieuw spel vult met de 8 standaardvragen
--   5. Scoring beweegt mee met de geselecteerde vragen per check-in
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kolommen op mol_games voor de ontmaskering
-- ------------------------------------------------------------
ALTER TABLE mol_games
  ADD COLUMN IF NOT EXISTS unmask_points integer NOT NULL DEFAULT 50;

-- ------------------------------------------------------------
-- 2. Vragen per spel
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mol_questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      uuid NOT NULL REFERENCES mol_games(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  qkey         text NOT NULL,                 -- stabiele sleutel binnen dit spel
  self_text    text NOT NULL,                 -- vraag over jezelf (registratie)
  mol_text     text NOT NULL,                 -- vraag over de mol (check-in)
  options      jsonb NOT NULL DEFAULT '[]',   -- array van antwoordmogelijkheden
  created_at   timestamptz DEFAULT now(),
  UNIQUE (game_id, qkey)
);

CREATE INDEX IF NOT EXISTS idx_mol_questions_game ON mol_questions(game_id, sort_order);

-- ------------------------------------------------------------
-- 3. Check-in configuratie (welke vragen in check-in 1,2,3)
--    Als er voor een check-in GEEN rijen staan, gelden alle vragen.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mol_checkin_config (
  game_id        uuid NOT NULL REFERENCES mol_games(id) ON DELETE CASCADE,
  checkin_number integer NOT NULL CHECK (checkin_number BETWEEN 1 AND 3),
  question_id    uuid NOT NULL REFERENCES mol_questions(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, checkin_number, question_id)
);

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
ALTER TABLE mol_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mol_checkin_config ENABLE ROW LEVEL SECURITY;

-- Iedereen mag de vragen LEZEN (deelnemers hebben ze nodig).
-- De vragen bevatten niets geheims: alleen kenmerken, geen wie-de-mol-is.
DROP POLICY IF EXISTS mol_questions_read ON mol_questions;
CREATE POLICY mol_questions_read ON mol_questions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS mol_questions_write ON mol_questions;
CREATE POLICY mol_questions_write ON mol_questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS mol_checkin_config_read ON mol_checkin_config;
CREATE POLICY mol_checkin_config_read ON mol_checkin_config
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS mol_checkin_config_write ON mol_checkin_config;
CREATE POLICY mol_checkin_config_write ON mol_checkin_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 5. Seed: vul een nieuw spel met de 8 standaardvragen
--    Aan te roepen door de facilitator direct na het aanmaken.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION mol_seed_default_questions(p_game_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Niet dubbel seeden
  IF EXISTS (SELECT 1 FROM mol_questions WHERE game_id = p_game_id) THEN
    RETURN json_build_object('ok', true, 'skipped', true);
  END IF;

  INSERT INTO mol_questions (game_id, sort_order, qkey, self_text, mol_text, options) VALUES
    (p_game_id, 1, 'age',    'Wat is je leeftijd?',       'Welke leeftijdscategorie heeft de mol?', '["15-25","26-35","36-45","46-55","55+"]'),
    (p_game_id, 2, 'tenure', 'Hoe lang werk je hier al?', 'Hoe lang werkt de mol hier al?',          '["minder dan 1 jaar","1-3 jaar","3-5 jaar","5-10 jaar","10+ jaar"]'),
    (p_game_id, 3, 'hair',   'Wat is je haarkleur?',      'Welke haarkleur heeft de mol?',           '["blond","bruin","zwart","rood","grijs","anders"]'),
    (p_game_id, 4, 'height', 'Hoe lang ben je?',          'Hoe lang is de mol?',                     '["korter dan 1.65m","1.65-1.75m","1.75-1.85m","langer dan 1.85m"]'),
    (p_game_id, 5, 'glasses','Draag je een bril?',        'Draagt de mol een bril?',                 '["ja","nee"]'),
    (p_game_id, 6, 'shoe',   'Wat is je schoenmaat?',     'Welke schoenmaat heeft de mol?',          '["kleiner dan 38","38-41","42-44","groter dan 44"]'),
    (p_game_id, 7, 'pet',    'Welk huisdier heb je?',     'Welk huisdier heeft de mol?',             '["hond","kat","ander huisdier","geen huisdier"]'),
    (p_game_id, 8, 'drink',  'Wat drink je het liefst?',  'Wat drinkt de mol het liefst?',           '["koffie","thee","water","fris","bier of wijn"]');

  RETURN json_build_object('ok', true);
END; $$;

-- ------------------------------------------------------------
-- 6. Welke vragen gelden in een check-in?
--    Geen config -> alle vragen. Wel config -> alleen die selectie.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION mol_checkin_question_ids(p_game_id uuid, p_checkin integer)
RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
  SELECT q.id
  FROM mol_questions q
  WHERE q.game_id = p_game_id
    AND (
      NOT EXISTS (
        SELECT 1 FROM mol_checkin_config c
        WHERE c.game_id = p_game_id AND c.checkin_number = p_checkin
      )
      OR q.id IN (
        SELECT c.question_id FROM mol_checkin_config c
        WHERE c.game_id = p_game_id AND c.checkin_number = p_checkin
      )
    )
  ORDER BY q.sort_order;
$$;

-- ------------------------------------------------------------
-- 7. Check-in 4: de ontmaskering. Speler wijst een teamgenoot aan.
--    We slaan dit op in mol_votes met checkin_number = 4 en
--    answers = { "guess_player_id": "<uuid>" }.
-- ------------------------------------------------------------
-- checkin_number mag nu tot 4
ALTER TABLE mol_votes DROP CONSTRAINT IF EXISTS mol_votes_checkin_number_check;
ALTER TABLE mol_votes ADD CONSTRAINT mol_votes_checkin_number_check
  CHECK (checkin_number BETWEEN 1 AND 4);

-- Teamgenoten ophalen voor de ontmaskering (namen, geen is_mole!)
CREATE OR REPLACE FUNCTION mol_get_teammates(p_token uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me mol_players%ROWTYPE; v_list json;
BEGIN
  SELECT * INTO v_me FROM mol_players WHERE player_token = p_token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;

  SELECT COALESCE(json_agg(json_build_object('id', id, 'name', name) ORDER BY name), '[]'::json)
  INTO v_list
  FROM mol_players
  WHERE game_id = v_me.game_id
    AND team_number = v_me.team_number
    AND id <> v_me.id;   -- jezelf kun je niet aanwijzen

  RETURN json_build_object('my_name', v_me.name, 'teammates', v_list);
END; $$;

-- Ontmaskering-stem uitbrengen
CREATE OR REPLACE FUNCTION mol_cast_unmask(p_token uuid, p_guess_player_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me mol_players%ROWTYPE; v_phase integer; v_valid boolean;
BEGIN
  SELECT * INTO v_me FROM mol_players WHERE player_token = p_token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;

  SELECT active_phase INTO v_phase FROM mol_games WHERE id = v_me.game_id;
  IF v_phase < 1 OR v_phase > 4 THEN RETURN json_build_object('error', 'not_open'); END IF;

  -- Gok moet een teamgenoot zijn (zelfde team, niet jezelf)
  SELECT EXISTS (
    SELECT 1 FROM mol_players
    WHERE id = p_guess_player_id
      AND game_id = v_me.game_id
      AND team_number = v_me.team_number
      AND id <> v_me.id
  ) INTO v_valid;
  IF NOT v_valid THEN RETURN json_build_object('error', 'bad_guess'); END IF;

  INSERT INTO mol_votes (game_id, checkin_number, voter_token, answers)
  VALUES (v_me.game_id, 4, p_token, json_build_object('guess_player_id', p_guess_player_id))
  ON CONFLICT (game_id, checkin_number, voter_token) DO NOTHING;

  IF NOT FOUND THEN RETURN json_build_object('error', 'already_voted'); END IF;
  RETURN json_build_object('ok', true);
END; $$;

-- ------------------------------------------------------------
-- 8. Herbouw van cast_vote en get_checkin zodat ze de per-event
--    vragen gebruiken (in plaats van de vaste 8 keys).
-- ------------------------------------------------------------
-- match op basis van de vraag-keys van dit spel
CREATE OR REPLACE FUNCTION mol_match_count_dynamic(p_game_id uuid, a jsonb, b jsonb)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(count(*), 0)::int
  FROM mol_questions q
  WHERE q.game_id = p_game_id
    AND a ? q.qkey AND b ? q.qkey
    AND a->>q.qkey = b->>q.qkey;
$$;

-- Check-in state teruggeven, nu met de vragen voor die check-in
CREATE OR REPLACE FUNCTION mol_get_checkin(p_token uuid, p_checkin integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player mol_players%ROWTYPE; v_phase integer; v_status text;
  v_answers jsonb; v_questions json; v_unmask integer;
BEGIN
  SELECT * INTO v_player FROM mol_players WHERE player_token = p_token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;

  SELECT active_phase, status, unmask_points INTO v_phase, v_status, v_unmask
  FROM mol_games WHERE id = v_player.game_id;

  SELECT answers INTO v_answers FROM mol_votes
  WHERE voter_token = p_token AND checkin_number = p_checkin AND game_id = v_player.game_id;

  IF p_checkin BETWEEN 1 AND 3 THEN
    SELECT COALESCE(json_agg(json_build_object(
             'qkey', q.qkey, 'mol_text', q.mol_text, 'options', q.options
           ) ORDER BY q.sort_order), '[]'::json)
    INTO v_questions
    FROM mol_questions q
    WHERE q.id IN (SELECT mol_checkin_question_ids(v_player.game_id, p_checkin));
  ELSE
    v_questions := '[]'::json;   -- check-in 4 haalt teammates apart op
  END IF;

  RETURN json_build_object(
    'my_name', v_player.name, 'my_team', v_player.team_number,
    'active_phase', v_phase, 'status', v_status,
    'checkin', p_checkin, 'is_unmask', (p_checkin = 4),
    'unmask_points', v_unmask,
    'questions', v_questions,
    'existing_answers', v_answers
  );
END; $$;

-- Stem uitbrengen (check-in 1-3), valideert tegen de vragen van dit spel
CREATE OR REPLACE FUNCTION mol_cast_vote(p_token uuid, p_checkin integer, p_answers jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_player mol_players%ROWTYPE; v_phase integer; v_existing jsonb;
BEGIN
  SELECT * INTO v_player FROM mol_players WHERE player_token = p_token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;
  IF p_checkin < 1 OR p_checkin > 3 THEN RETURN json_build_object('error', 'bad_checkin'); END IF;

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

-- ------------------------------------------------------------
-- 9. Scoring herbouwd: kenmerk-punten (check-in 1-3) plus
--    ontmaskering (check-in 4, waarde = unmask_points).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION mol_calculate_scores(p_game_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_phase integer; v_unmask integer; v_team json; v_mole json; v_det json;
BEGIN
  SELECT active_phase, unmask_points INTO v_phase, v_unmask FROM mol_games WHERE id = p_game_id;
  IF v_phase IS NULL THEN RETURN json_build_object('error', 'not_found'); END IF;

  IF v_phase < 5 AND auth.role() <> 'authenticated' THEN
    RETURN json_build_object('error', 'not_ready');
  END IF;

  -- Mol-aftrek per team = som van foute kenmerk-antwoorden door niet-mol teamgenoten
  -- in check-ins 1 t/m 3, waarbij per stem alleen de vragen tellen die in die
  -- check-in gevraagd zijn.
  WITH checkin_vragen AS (
    SELECT c AS checkin, ci AS question_id
    FROM (SELECT unnest(ARRAY[1,2,3]) AS c) t
    CROSS JOIN LATERAL mol_checkin_question_ids(p_game_id, t.c) AS ci
  ),
  aantal_per_checkin AS (
    SELECT checkin, count(*) AS n_vragen FROM checkin_vragen GROUP BY checkin
  ),
  fout_per_stem AS (
    SELECT pl.team_number,
           apc.n_vragen - mol_match_count_dynamic(p_game_id, v.answers, molp.appearance) AS fout
    FROM mol_players pl
    JOIN mol_players molp
      ON molp.game_id = pl.game_id AND molp.team_number = pl.team_number AND molp.is_mole = true
    JOIN mol_votes v
      ON v.voter_token = pl.player_token AND v.game_id = p_game_id AND v.checkin_number BETWEEN 1 AND 3
    JOIN aantal_per_checkin apc ON apc.checkin = v.checkin_number
    WHERE pl.game_id = p_game_id AND pl.is_mole = false
  ),
  penalty AS (
    SELECT team_number, COALESCE(SUM(GREATEST(fout,0)),0)::int AS mol_penalty
    FROM fout_per_stem GROUP BY team_number
  ),
  -- Ontmaskering: elke speler die de mol juist aanwees levert unmask_points op.
  -- Bleef de mol onontdekt (niemand in het team wees hem aan), dan krijgt het
  -- team NIETS uit de ontmaskering en pakt de mol het bonusbedrag voor zijn team.
  unmask AS (
    SELECT pl.team_number,
      SUM(CASE WHEN (v.answers->>'guess_player_id')::uuid = molp.id THEN v_unmask ELSE 0 END)::int AS speler_bonus,
      bool_or((v.answers->>'guess_player_id')::uuid = molp.id) AS mol_ontmaskerd
    FROM mol_players pl
    JOIN mol_players molp
      ON molp.game_id = pl.game_id AND molp.team_number = pl.team_number AND molp.is_mole = true
    JOIN mol_votes v
      ON v.voter_token = pl.player_token AND v.game_id = p_game_id AND v.checkin_number = 4
    WHERE pl.game_id = p_game_id AND pl.is_mole = false
    GROUP BY pl.team_number
  )
  INSERT INTO mol_team_scores (game_id, team_number, ipad_score, mol_penalty, final_score)
  SELECT p_game_id,
         t.team_number,
         COALESCE(ts.ipad_score, 0),
         COALESCE(p.mol_penalty, 0),
         COALESCE(ts.ipad_score,0)
           - COALESCE(p.mol_penalty,0)
           + COALESCE(u.speler_bonus,0)
           + CASE WHEN u.team_number IS NOT NULL AND NOT COALESCE(u.mol_ontmaskerd,false)
                  THEN v_unmask ELSE 0 END
  FROM (SELECT DISTINCT team_number FROM mol_players WHERE game_id = p_game_id) t
  LEFT JOIN mol_team_scores ts ON ts.game_id = p_game_id AND ts.team_number = t.team_number
  LEFT JOIN penalty p ON p.team_number = t.team_number
  LEFT JOIN unmask  u ON u.team_number = t.team_number
  ON CONFLICT (game_id, team_number) DO UPDATE
    SET mol_penalty = EXCLUDED.mol_penalty,
        final_score = EXCLUDED.final_score;

  SELECT json_agg(row_to_json(t)) INTO v_team FROM (
    SELECT team_number, ipad_score, mol_penalty, final_score
    FROM mol_team_scores WHERE game_id = p_game_id ORDER BY final_score DESC
  ) t;

  SELECT json_agg(row_to_json(t)) INTO v_mole FROM (
    SELECT molp.id, molp.name, molp.team_number, COALESCE(ts.mol_penalty, 0) AS mole_score
    FROM mol_players molp
    LEFT JOIN mol_team_scores ts ON ts.game_id = molp.game_id AND ts.team_number = molp.team_number
    WHERE molp.game_id = p_game_id AND molp.is_mole = true
    ORDER BY mole_score DESC
  ) t;

  SELECT json_agg(row_to_json(t)) INTO v_det FROM (
    SELECT pl.id, pl.name, pl.team_number,
      COALESCE(SUM(mol_match_count_dynamic(p_game_id, v.answers, molp.appearance))
               FILTER (WHERE v.id IS NOT NULL AND v.checkin_number BETWEEN 1 AND 3), 0)::int AS correct
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

REVOKE EXECUTE ON FUNCTION mol_seed_default_questions(uuid) FROM anon;

NOTIFY pgrst, 'reload schema';

-- Verificatie
SELECT proname FROM pg_proc
WHERE proname IN (
  'mol_seed_default_questions','mol_checkin_question_ids','mol_get_teammates',
  'mol_cast_unmask','mol_match_count_dynamic','mol_get_checkin','mol_cast_vote',
  'mol_calculate_scores'
) ORDER BY proname;
