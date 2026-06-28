// Persistent Hall of Fame using localStorage.
// Tracks cumulative wins/games/points per player name (case-insensitive key),
// plus a recent match history. Safe no-ops if storage is unavailable.

const KEY = 'stumpdad_hof_v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { players: {}, matches: [] };
  } catch {
    return { players: {}, matches: [] };
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore (private mode / disabled) */
  }
}

function norm(name) {
  return (name || 'Player').trim().toLowerCase();
}

// Record a finished match.
// result = { mode, difficulty, players: [{name, emoji, score}], winners: [name] }
export function recordMatch(result) {
  const data = read();
  for (const p of result.players) {
    const k = norm(p.name);
    const rec = data.players[k] || { name: p.name, emoji: p.emoji, games: 0, wins: 0, points: 0, best: 0 };
    rec.name = p.name;
    rec.emoji = p.emoji || rec.emoji;
    rec.games += 1;
    rec.points += p.score || 0;
    rec.best = Math.max(rec.best, p.score || 0);
    if (result.winners.map(norm).includes(k)) rec.wins += 1;
    data.players[k] = rec;
  }
  data.matches.unshift({
    at: Date.now(),
    mode: result.mode,
    difficulty: result.difficulty,
    players: result.players.map((p) => ({ name: p.name, emoji: p.emoji, score: p.score })),
    winners: result.winners,
  });
  data.matches = data.matches.slice(0, 40);
  write(data);
  return data;
}

export function getHallOfFame() {
  const data = read();
  const players = Object.values(data.players).sort((a, b) => b.wins - a.wins || b.points - a.points);
  return { players, matches: data.matches };
}

export function clearHallOfFame() {
  write({ players: {}, matches: [] });
}

// Remember the last roster so families don't retype names every night.
const ROSTER_KEY = 'stumpdad_roster_v1';
export function saveRoster(players) {
  try {
    localStorage.setItem(
      ROSTER_KEY,
      JSON.stringify(players.map((p) => ({ name: p.name, emoji: p.emoji, colorIdx: p.colorIdx, topics: p.topics })))
    );
  } catch {
    /* ignore */
  }
}
export function loadRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
