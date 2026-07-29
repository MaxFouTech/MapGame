// Thin Supabase REST (PostgREST) client for the shared leaderboard.
// No SDK: plain fetch with the publishable key. Every call has a short
// timeout; any failure flips the app into offline mode (local play keeps
// working; scores sync later).

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let online = null; // null = unknown, true/false once probed
const listeners = new Set();

export function isOnline() { return online === true; }
export function onStatus(fn) { listeners.add(fn); }

function setOnline(v) {
  if (online !== v) {
    online = v;
    listeners.forEach(f => { try { f(v); } catch (e) { /* listener error */ } });
  }
}

// Overrides let automated tests point at a mock server.
const base = () => (window.__SUPABASE_URL_OVERRIDE || SUPABASE_URL) + '/rest/v1';
const key = () => window.__SUPABASE_KEY_OVERRIDE || SUPABASE_KEY;

async function req(path, opts = {}, timeout = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(base() + path, {
      ...opts,
      headers: {
        apikey: key(),
        Authorization: `Bearer ${key()}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
      signal: ctrl.signal,
    });
    // "Online" means functional: a reachable backend that answers with
    // config errors (missing tables, bad key) is offline for our purposes.
    // 409 is a legitimate business answer (name conflict), keep it online.
    setOnline(res.ok || res.status === 409);
    return res;
  } catch (e) {
    setOnline(false);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function ping() {
  try {
    const r = await req('/players?select=name&limit=1', {}, 4000);
    setOnline(r.ok);
    return r.ok;
  } catch (e) {
    return false;
  }
}

// PIN is hashed client-side (salted with the name). Not bulletproof — this
// is a casual game guard, not authentication.
export async function pinHash(name, pin) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`mapgame:${name}:${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function listPlayers() {
  const r = await req('/players?select=id,name,lang,pin_hash&order=name.asc&limit=200');
  if (!r.ok) throw new Error('list ' + r.status);
  return r.json();
}

export async function getPlayer(name) {
  const r = await req(`/players?name=eq.${encodeURIComponent(name)}&select=id,name,pin_hash,lang`);
  if (!r.ok) throw new Error('get ' + r.status);
  const rows = await r.json();
  return rows[0] || null;
}

// Returns {id} on success or {conflict: true} if the name is taken.
export async function createPlayer(name, hash, lang) {
  const r = await req('/players', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name, pin_hash: hash, lang }),
  });
  if (r.status === 409) return { conflict: true };
  if (!r.ok) throw new Error('create ' + r.status);
  const rows = await r.json();
  return { id: rows[0].id };
}

export async function pushLevel(cloudId, playerName, mode, levelN, rec, total) {
  const r = await req('/leaderboard?on_conflict=player_id,mode,level_n', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      player_id: cloudId,
      player_name: playerName,
      mode,
      level_n: levelN,
      best_score: rec.highScore || 0,
      total,
      best_stars: rec.bestStars || 0,
      plays: rec.plays || 0,
      updated_at: new Date().toISOString(),
    }),
  });
  return r.ok;
}

export async function fetchLeaderboard() {
  const r = await req(
    '/leaderboard?select=player_name,mode,level_n,best_score,total,best_stars&order=best_score.desc&limit=4000');
  if (!r.ok) throw new Error('leaderboard ' + r.status);
  return r.json();
}

// Admin: wipe every account and score. The password travels as a request
// parameter only; the Postgres function (see supabase/setup.sql) compares
// its SHA-256 hash server-side and returns {ok:false} on mismatch.
export async function adminDeletePlayers(secret, names) {
  const r = await req('/rpc/admin_delete_players', {
    method: 'POST',
    body: JSON.stringify({ secret, names }),
  }, 10000);
  // 404 = the function has not been created in Supabase yet — surface it
  // as its own case, distinct from "network down".
  if (r.status === 404) return { ok: false, missing: true };
  if (!r.ok) {
    let message = '';
    try { message = (await r.json()).message || ''; } catch (e) { /* no body */ }
    return { ok: false, status: r.status, message };
  }
  return r.json();
}

export async function deletePlayerRows(cloudId) {
  const r = await req(`/leaderboard?player_id=eq.${encodeURIComponent(cloudId)}`,
    { method: 'DELETE' });
  return r.ok;
}
