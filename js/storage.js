// localStorage persistence: players, per-country knowledge records,
// session history and knowledge snapshots.

const KEY = 'mapgame.v1';

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted storage — start fresh */ }
  return { players: {}, lastPlayer: null };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('Could not save progress', e);
  }
}

export function listPlayers() {
  return Object.keys(db.players).sort((a, b) =>
    (db.players[b].lastPlayed || 0) - (db.players[a].lastPlayed || 0));
}

export function getPlayer(name) {
  return db.players[name] || null;
}

export function createPlayer(name) {
  if (!db.players[name]) {
    db.players[name] = {
      created: Date.now(),
      lastPlayed: Date.now(),
      qIndex: 0,               // global question counter (drives spaced repetition)
      totalScore: 0,
      bestStreak: 0,
      records: {},             // countryName -> {a, c, box, lastQ, streak}
      sessions: [],            // {ts, score, asked, correct, bestStreak}
      snapshots: [],           // {ts, known, mastered, seen}
      settings: { tiers: [1, 2] },
    };
    save();
  }
  return db.players[name];
}

export function deletePlayer(name) {
  delete db.players[name];
  if (db.lastPlayer === name) db.lastPlayer = null;
  save();
}

export function touchPlayer(name) {
  const p = db.players[name];
  if (p) { p.lastPlayed = Date.now(); db.lastPlayer = name; save(); }
}

export function getLastPlayer() {
  return db.lastPlayer && db.players[db.lastPlayer] ? db.lastPlayer : null;
}

export function persist() {
  save();
}
