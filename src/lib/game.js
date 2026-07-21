import { supabase } from './supabase.js';

// Deelnemer-state. Eén actief spel tegelijk.
// De speler bewaart zijn player_token in localStorage; dat is zijn hele identiteit.
// Er is geen login voor deelnemers, en dat hoeft ook niet: de token geeft alleen
// toegang tot de eigen rol, nooit tot die van een ander.

const CURRENT_GAME = 'olm_current_game';
const tokenKey = (gameId) => `olm_token_${gameId}`;

export function rememberPlayer(gameId, token) {
  localStorage.setItem(tokenKey(gameId), token);
  localStorage.setItem(CURRENT_GAME, gameId);
}

export function currentGameId() {
  return localStorage.getItem(CURRENT_GAME);
}

export function storedToken(gameId = currentGameId()) {
  return gameId ? localStorage.getItem(tokenKey(gameId)) : null;
}

export function forgetPlayer(gameId = currentGameId()) {
  if (gameId) localStorage.removeItem(tokenKey(gameId));
  localStorage.removeItem(CURRENT_GAME);
}

// Het actieve spel: het meest recente spel met status 'active'.
export async function fetchActiveGame() {
  const { data, error } = await supabase
    .from('mol_games')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return null;
  return data?.[0] ?? null;
}

// Meest recente spel, ongeacht status. Voor het publieke scorebord.
export async function fetchLatestGame() {
  const { data, error } = await supabase
    .from('mol_games')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return null;
  return data?.[0] ?? null;
}

// Facilitator-overzicht inclusief is_mole. Werkt alleen als je ingelogd bent.
export async function fetchGameOverview(gameId) {
  const { data, error } = await supabase.rpc('mol_get_game_overview', { p_game_id: gameId });
  if (error || !data || data.error) return null;
  return data;
}

// Vragen van een spel ophalen (voor registratie). Openbaar leesbaar.
export async function fetchQuestions(gameId) {
  const { data, error } = await supabase
    .from('mol_questions')
    .select('id, qkey, self_text, mol_text, options, sort_order')
    .eq('game_id', gameId)
    .order('sort_order');
  if (error) return [];
  return (data ?? []).map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? q.options : [],
  }));
}
