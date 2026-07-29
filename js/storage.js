// localStorage persistence: players, per-country knowledge records,
// session history and knowledge snapshots.

const KEY = 'mapgame.v1';

let db = load();

function load() {
  let d = { players: {}, lastPlayer: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) d = JSON.parse(raw);
  } catch (e) { /* corrupted storage — start fresh */ }
  // Level definitions were reorganized (geographic clusters, v2): per-level
  // stars/scores no longer match, so reset them once. Per-country knowledge
  // records are untouched.
  if (!d.levelsV2) {
    for (const p of Object.values(d.players || {})) p.levels = {};
    d.levelsV2 = true;
  }
  // v3: two modes (difficulty / zone), keys are now "mode:n". The old numeric
  // keys don't map, so reset per-level stars once more. Country records kept.
  if (!d.levelsV3) {
    for (const p of Object.values(d.players || {})) { p.levels = {}; p.dirty = {}; }
    d.levelsV3 = true;
  }
  return d;
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

export function createPlayer(name, extra = {}) {
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
      levels: {},              // levelN -> {bestStars, plays, lastMissed}
      pinHash: null,           // sha256(name:pin), also mirrored in the cloud
      cloudId: null,           // players.id in Supabase once linked
      dirty: {},               // levelN -> true, waiting for cloud sync
      ...extra,
    };
    save();
  }
  return db.players[name];
}

// Wipe a player's progress (records, sessions, stars, scores) but keep the
// identity (name, PIN, cloud link).
export function resetPlayerData(name) {
  const p = db.players[name];
  if (!p) return;
  p.qIndex = 0;
  p.totalScore = 0;
  p.bestStreak = 0;
  p.perfectRuns = 0;
  p.records = {};
  p.sessions = [];
  p.snapshots = [];
  p.levels = {};
  p.dirty = {};
  save();
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

export function getStoredLang() {
  return db.lang || null;
}

export function setStoredLang(l) {
  db.lang = l;
  save();
}

// Which level progression is shown on the menu: 'difficulty' (default) or 'zone'.
export function getLevelMode() {
  return db.levelMode === 'zone' ? 'zone' : 'difficulty';
}

export function setLevelMode(m) {
  db.levelMode = m === 'zone' ? 'zone' : 'difficulty';
  save();
}

export function getMapMode() {
  return db.mapMode === '2d' ? '2d' : 'globe'; // globe is the default
}

export function setMapMode(m) {
  db.mapMode = m === 'globe' ? 'globe' : '2d';
  save();
}

export function getTheme() {
  return db.theme || 'atlas'; // atlas is the default
}

export function setTheme(key) {
  db.theme = key;
  save();
}

// Whether the country name is shown in the prompt (default) or hidden so the
// flag is the only hint.
export function getShowNames() {
  return db.showNames !== false;
}

export function setShowNames(v) {
  db.showNames = !!v;
  save();
}

export function persist() {
  save();
}
