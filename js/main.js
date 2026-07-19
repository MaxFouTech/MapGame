// Screen management and game loop.
// Three play modes:
//  - series:   one full pass over a level's countries -> star rating
//  - training: redo the errors of a series (each must be found twice)
//  - review:   endless adaptive session driven by the spaced-repetition
//              scheduler over all countries

import { LEVELS, PLAYABLE, displayName, levelOf, levelTitle } from './countries.js';
import * as store from './storage.js';
import * as sched from './scheduler.js';
import { WorldMap } from './map.js';
import { GlobeMap } from './globe.js';
import { t, setLang, getLang } from './i18n.js';
import * as cloud from './cloud.js';
import { icon } from './icons.js';

const d3 = window.d3;
const $ = id => document.getElementById(id);

const TRAIN_GOAL = 2;                           // finds needed to clear a trained country
const state = {
  playerName: null,
  player: null,
  map: null,
  world: null,
  session: null,
  target: null,
  askedAt: 0,
  recentAsked: [],
  forcedQueue: [],
  lastSeries: null, // { levelN, missed } for summary buttons
  phase: 'idle', // 'asking' | 'feedback'
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playerLevels() {
  return state.player.levels || (state.player.levels = {});
}

// ---------- i18n ----------

function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]:not([data-icon])').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n][data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon) + `<span>${t(el.dataset.i18n)}</span>`;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('.logo-ico').forEach(el => { el.innerHTML = icon('globe'); });
  document.querySelectorAll('.switch-ico').forEach(el => { el.innerHTML = icon('users'); });
  document.querySelectorAll('#map-switch button').forEach(b => {
    b.innerHTML = icon(b.dataset.mode === '2d' ? 'map' : 'globe') +
      `<span>${b.dataset.mode === '2d' ? '2D' : '3D'}</span>`;
  });
  $('prompt-label').textContent = t('find');
  $('btn-dontknow').innerHTML = icon('eye') + `<span>${t('showMe')}</span>`;
  $('btn-end').innerHTML = icon('stop') + `<span>${t('endSession')}</span>`;
  updateMapModeUi();
  updateOnlineBadge();
  document.documentElement.lang = getLang();
  // [data-lang] scope: the 2D/3D switch shares the .lang-switch styling
  // but must not be touched by the language logic.
  document.querySelectorAll('.lang-switch button[data-lang]').forEach(b =>
    b.classList.toggle('on', b.dataset.lang === getLang()));
}

function switchLang(l) {
  setLang(l);
  store.setStoredLang(l);
  applyStaticI18n();
  renderPlayers();
  if (state.player) renderMenu();
  if ($('screen-stats').classList.contains('active')) renderStats();
  if ($('screen-countries').classList.contains('active')) renderCountryList();
}

document.querySelectorAll('.lang-switch button[data-lang]').forEach(b =>
  b.addEventListener('click', () => switchLang(b.dataset.lang)));

// ---------- screens ----------

let worldPromise = null;
function loadWorld() {
  // Prefer the preload kicked off in <head>; fall back to fetching here.
  worldPromise = worldPromise || window.__worldFetch || fetch('data/countries-50m.json').then(r => r.json());
  return worldPromise;
}

// The single map/globe instance is a permanent background layer: veiled and
// slowly spinning behind the menus (ambient), fully interactive in game.
function applyAmbient() {
  const ambient = state.currentScreen !== 'screen-game';
  $('map').classList.toggle('ambient', ambient);
  state.map?.setAmbient(ambient);
}

function show(id) {
  document.body.classList.remove('summary-open');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  state.currentScreen = id;
  applyAmbient();
}

// ---------- player screen (with PIN + cloud) ----------

state.cloudPlayers = [];   // fetched from Supabase
state.pinRequest = null;   // { name, mode: 'select'|'set'|'link' }

function renderPlayers() {
  const list = $('player-list');
  list.innerHTML = '';
  const players = store.listPlayers();
  $('pick-title').classList.toggle('hidden', !players.length && !state.cloudPlayers.length);
  if (!players.length && !state.cloudPlayers.length) {
    list.innerHTML = '';
  }
  for (const name of players) {
    const p = store.getPlayer(name);
    const snap = sched.snapshot(p, PLAYABLE);
    const row = document.createElement('button');
    row.className = 'player-row';
    row.innerHTML = `<span class="player-row-name">${escapeHtml(name)}</span>
      <span class="player-row-meta">${snap.known}/${PLAYABLE.length} ${t('known')}</span>`;
    row.addEventListener('click', () =>
      openPinPanel(name, p.pinHash ? 'select' : 'set'));
    list.appendChild(row);
  }

  // Cloud players not present on this device (log in from another browser).
  const localNames = new Set(players);
  const remote = state.cloudPlayers.filter(c => !localNames.has(c.name));
  $('cloud-players-title').classList.toggle('hidden', remote.length === 0);
  const cl = $('cloud-list');
  cl.innerHTML = '';
  for (const c of remote) {
    const row = document.createElement('button');
    row.className = 'player-row cloud';
    row.innerHTML = `<span class="player-row-name">${escapeHtml(c.name)}</span>
      <span class="player-row-meta"></span>`;
    row.addEventListener('click', () => openPinPanel(c.name, 'link'));
    cl.appendChild(row);
  }
}

function openPinPanel(name, mode) {
  state.pinRequest = { name, mode };
  $('pin-panel-label').textContent =
    mode === 'set' ? t('pinSet', { name }) : t('pinFor', { name });
  $('pin-error').classList.add('hidden');
  $('pin-input').value = '';
  $('pin-panel').classList.remove('hidden');
  $('pin-input').focus();
}

function closePinPanel() {
  state.pinRequest = null;
  $('pin-panel').classList.add('hidden');
}

function pinError(msg) {
  const el = $('pin-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

async function submitPin() {
  const reqst = state.pinRequest;
  if (!reqst) return;
  const pin = $('pin-input').value.trim();
  if (!/^\d{4}$/.test(pin)) { pinError(t('pinFormat')); return; }
  const hash = await cloud.pinHash(reqst.name, pin);

  if (reqst.mode === 'select') {
    const p = store.getPlayer(reqst.name);
    if (p.pinHash !== hash) { pinError(t('pinBad')); return; }
    closePinPanel();
    selectPlayer(reqst.name);
  } else if (reqst.mode === 'set') {
    // Legacy local player without a PIN: set it now, then link to cloud.
    const p = store.getPlayer(reqst.name);
    p.pinHash = hash;
    store.persist();
    closePinPanel();
    selectPlayer(reqst.name);
    linkToCloud(reqst.name);
  } else if (reqst.mode === 'link') {
    const c = state.cloudPlayers.find(x => x.name === reqst.name);
    if (!c || c.pin_hash !== hash) { pinError(t('pinBad')); return; }
    store.createPlayer(reqst.name, { pinHash: hash, cloudId: c.id });
    if (c.lang) { setLang(c.lang); store.setStoredLang(c.lang); applyStaticI18n(); }
    closePinPanel();
    selectPlayer(reqst.name);
  }
}

$('btn-pin-ok').addEventListener('click', submitPin);
$('btn-pin-cancel').addEventListener('click', closePinPanel);
$('pin-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); submitPin(); }
});

function selectPlayer(name) {
  state.playerName = name;
  state.player = store.getPlayer(name) || store.createPlayer(name);
  store.touchPlayer(name);
  renderMenu();
  show('screen-menu');
  syncDirty();
}

function playerMsg(text) {
  const el = $('player-msg');
  el.textContent = text;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

async function addPlayer() {
  const name = $('new-player-name').value.trim();
  const pin = $('new-player-pin').value.trim();
  if (!name) return;
  if (!/^\d{4}$/.test(pin)) { playerMsg(t('pinFormat')); return; }
  if (store.getPlayer(name)) { openPinPanel(name, store.getPlayer(name).pinHash ? 'select' : 'set'); return; }
  const hash = await cloud.pinHash(name, pin);
  store.createPlayer(name, { pinHash: hash });
  $('new-player-name').value = '';
  $('new-player-pin').value = '';
  selectPlayer(name);
  linkToCloud(name);
}
$('btn-add-player').addEventListener('click', addPlayer);
$('new-player-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); $('new-player-pin').focus(); }
});
$('new-player-pin').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addPlayer(); }
});

// ---------- cloud sync ----------

// Create or attach the cloud identity for a local player (fire-and-forget).
async function linkToCloud(name) {
  const p = store.getPlayer(name);
  if (!p || !p.pinHash || p.cloudId || p.localOnly) return;
  try {
    const res = await cloud.createPlayer(name, p.pinHash, getLang());
    if (res.conflict) {
      const remote = await cloud.getPlayer(name);
      if (remote && remote.pin_hash === p.pinHash) {
        p.cloudId = remote.id;
      } else {
        p.localOnly = true;
        playerMsg(t('localOnlyWarn'));
      }
    } else {
      p.cloudId = res.id;
    }
    store.persist();
    updateOnlineBadge();
    if (p.cloudId) syncDirty();
  } catch (e) { /* offline — will retry on next sync */ }
}

// Push pending level results for the current player.
async function syncDirty() {
  const p = state.player;
  if (!p) return;
  if (!p.cloudId) { linkToCloud(state.playerName); return; }
  const dirty = Object.keys(p.dirty || {});
  for (const lvlN of dirty) {
    const lvl = LEVELS.find(l => l.n === Number(lvlN));
    const rec = (p.levels || {})[lvlN];
    if (!lvl || !rec) { delete p.dirty[lvlN]; continue; }
    try {
      const ok = await cloud.pushLevel(p.cloudId, state.playerName, Number(lvlN), rec, lvl.countries.length);
      if (ok) { delete p.dirty[lvlN]; store.persist(); }
    } catch (e) { break; /* offline — keep dirty */ }
  }
  updateOnlineBadge();
}

async function refreshCloudPlayers() {
  try {
    state.cloudPlayers = await cloud.listPlayers();
    if ($('screen-players').classList.contains('active')) renderPlayers();
  } catch (e) { /* offline */ }
  updateOnlineBadge();
}

function updateOnlineBadge() {
  const el = $('online-badge');
  const on = cloud.isOnline();
  el.innerHTML = icon(on ? 'cloud' : 'cloudOff') +
    `<span>${on ? t('onlineBadge') : t('offlineBadge')}</span>`;
  el.classList.toggle('off', !on);
}
cloud.onStatus(updateOnlineBadge);

// ---------- menu screen ----------

function starsHtml(n, cls = '') {
  return `<span class="stars ${cls}">` +
    [1, 2, 3].map(i => `<span class="${i <= n ? 'star on' : 'star'}">★</span>`).join('') +
    '</span>';
}

function renderMenu() {
  $('menu-player-name').textContent = state.playerName;
  const grid = $('level-grid');
  grid.innerHTML = '';
  const lv = playerLevels();
  for (const lvl of LEVELS) {
    const rec = lv[lvl.n] || {};
    const statuses = lvl.countries.map(n => sched.statusOf(state.player.records[n]));
    const known = statuses.filter(s => s === 'known' || s === 'mastered').length;
    const learning = statuses.filter(s => s === 'learning').length;
    const total = lvl.countries.length;
    const card = document.createElement('button');
    card.className = 'level-card' + (rec.bestStars === 3 ? ' gold' : '');
    const scores = rec.plays
      ? `<span class="level-scores">${t('lastHigh', {
          last: `${rec.lastScore}/${total}`, high: `${rec.highScore}/${total}` })}</span>`
      : '';
    card.innerHTML = `
      <span class="level-num l${lvl.n}">${lvl.slam ? icon('crown') : lvl.n}</span>
      <span class="level-body">
        <span class="level-title">${escapeHtml(levelTitle(lvl))}</span>
        <span class="level-meta">${t('countriesCount', { n: total })} · ${t('statusCounts', { k: known, l: learning })}</span>
        <span class="level-foot">${starsHtml(rec.bestStars || 0)}
          <span class="prog-bar mini">
            <span class="prog-fill l${Math.min(lvl.n, 9)}" style="width:${100 * known / total}%"></span>
            <span class="prog-fill l${Math.min(lvl.n, 9)} soft" style="width:${100 * learning / total}%"></span>
          </span>
        </span>
        ${scores}
      </span>`;
    card.addEventListener('click', () => startSeries(lvl.n));
    grid.appendChild(card);
  }
}

$('btn-switch-player').addEventListener('click', () => { renderPlayers(); show('screen-players'); refreshCloudPlayers(); });
$('btn-review').addEventListener('click', startReview);
$('btn-leaderboard').addEventListener('click', () => {
  state.lbRows = null; // refetch on each visit
  show('screen-leaderboard');
  renderLeaderboard('total');
});
$('btn-lb-back').addEventListener('click', () => { renderMenu(); show('screen-menu'); });

// ---------- reset my data ----------

$('btn-reset').addEventListener('click', () => {
  $('btn-reset').classList.add('hidden');
  $('reset-confirm').classList.remove('hidden');
});
$('btn-reset-no').addEventListener('click', () => {
  $('reset-confirm').classList.add('hidden');
  $('btn-reset').classList.remove('hidden');
});
$('btn-reset-yes').addEventListener('click', async () => {
  const p = state.player;
  store.resetPlayerData(state.playerName);
  if (p?.cloudId) { try { await cloud.deletePlayerRows(p.cloudId); } catch (e) { /* offline */ } }
  $('reset-confirm').classList.add('hidden');
  $('btn-reset').classList.remove('hidden');
  renderMenu();
});

// ---------- leaderboard screen ----------

async function renderLeaderboard(sel) {
  state.lbSel = sel;
  const tabs = $('lb-tabs');
  tabs.innerHTML = '';
  const mkTab = (key, label) => {
    const b = document.createElement('button');
    b.className = 'lb-tab' + (String(state.lbSel) === String(key) ? ' on' : '');
    b.innerHTML = label;
    b.addEventListener('click', () => renderLeaderboard(key));
    tabs.appendChild(b);
  };
  mkTab('total', t('lbTotal'));
  for (const lvl of LEVELS) mkTab(lvl.n, lvl.slam ? icon('crown') : String(lvl.n));

  const body = $('lb-body');
  let rows = state.lbRows;
  if (!rows) {
    try {
      rows = state.lbRows = await cloud.fetchLeaderboard();
    } catch (e) {
      body.innerHTML = `<p class="hint">${t('lbOffline')}</p>`;
      updateOnlineBadge();
      return;
    }
  }
  if (sel !== state.lbSel) return; // user already switched tab

  const me = state.playerName;
  if (sel === 'total') {
    const byPlayer = new Map();
    for (const r of rows) {
      const a = byPlayer.get(r.player_name) || { sum: 0, gold: 0 };
      a.sum += r.best_score;
      if (r.best_stars === 3) a.gold++;
      byPlayer.set(r.player_name, a);
    }
    const list = [...byPlayer.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, 30);
    body.innerHTML = list.length ? `<table class="lb-table">
      <thead><tr><th>${t('th_rank')}</th><th>${t('th_player')}</th><th>${t('lbSum')}</th><th>${t('th_gold')}</th></tr></thead>
      <tbody>${list.map(([name, a], i) => `
        <tr class="${name === me ? 'me' : ''}"><td class="num">${i + 1}</td>
        <td>${escapeHtml(name)}</td><td class="num">${a.sum}</td>
        <td class="num gold-cell">${a.gold ? icon('medal') + '×' + a.gold : '—'}</td></tr>`).join('')}
      </tbody></table>` : `<p class="hint">${t('lbEmpty')}</p>`;
  } else {
    const lvl = LEVELS.find(l => l.n === Number(sel));
    const list = rows.filter(r => r.level_n === Number(sel))
      .sort((a, b) => b.best_score - a.best_score || b.best_stars - a.best_stars)
      .slice(0, 30);
    body.innerHTML = `<p class="summary-level">${t('levelLabel', { n: lvl.n })} · ${escapeHtml(levelTitle(lvl))}</p>` +
      (list.length ? `<table class="lb-table">
      <thead><tr><th>${t('th_rank')}</th><th>${t('th_player')}</th><th>${t('th_best')}</th><th>★</th></tr></thead>
      <tbody>${list.map((r, i) => `
        <tr class="${r.player_name === me ? 'me' : ''}"><td class="num">${i + 1}</td>
        <td>${escapeHtml(r.player_name)}</td><td class="num">${r.best_score}/${r.total}</td>
        <td>${'★'.repeat(r.best_stars) || '—'}</td></tr>`).join('')}
      </tbody></table>` : `<p class="hint">${t('lbEmpty')}</p>`);
  }
}
$('btn-countries').addEventListener('click', () => { renderCountryList(); show('screen-countries'); });
$('btn-countries-back').addEventListener('click', () => { renderMenu(); show('screen-menu'); });
$('btn-stats').addEventListener('click', () => { renderStats(); show('screen-stats'); });
$('btn-stats-back').addEventListener('click', () => { renderMenu(); show('screen-menu'); });

// ---------- country list screen ----------

function renderCountryList() {
  const legend = $('country-legend');
  legend.innerHTML = ['new', 'learning', 'known', 'mastered'].map(st =>
    `<span class="country-chip ${st}">${t('status_' + st)}</span>`).join('');

  const body = $('country-list-body');
  body.innerHTML = '';
  const lv = playerLevels();
  for (const lvl of LEVELS.filter(l => !l.slam)) {
    const rec = lv[lvl.n] || {};
    const sec = document.createElement('div');
    sec.className = 'country-section';
    const chips = [...lvl.countries]
      .map(n => ({ n, d: displayName(n) }))
      .sort((a, b) => a.d.localeCompare(b.d))
      .map(({ n, d }) => {
        const st = sched.statusOf(state.player.records[n]);
        return `<span class="country-chip ${st}">${escapeHtml(d)}</span>`;
      }).join('');
    sec.innerHTML = `
      <div class="country-section-head">
        <span class="level-num l${lvl.n}">${lvl.n}</span>
        <span class="country-section-title">${escapeHtml(levelTitle(lvl))}
          <small>${t('countriesCount', { n: lvl.countries.length })}</small></span>
        ${starsHtml(rec.bestStars || 0)}
      </div>
      <div class="country-chips">${chips}</div>`;
    body.appendChild(sec);
  }
}

// ---------- stats screen ----------

function levelBadge(n) {
  return `<span class="badge l${n}">${t('levelShort', { n })}</span>`;
}

function renderStats() {
  const p = state.player;
  $('stats-player-name').textContent = state.playerName;
  const snap = sched.snapshot(p, PLAYABLE);

  $('stats-summary').innerHTML = `
    <div class="stat-tile"><b>${snap.seen}</b><span>${t('tile_seen')}</span></div>
    <div class="stat-tile"><b>${snap.known}</b><span>${t('tile_known')}</span></div>
    <div class="stat-tile"><b>${snap.mastered}</b><span>${t('tile_mastered')}</span></div>
    <div class="stat-tile"><b>${p.bestStreak}</b><span>${t('tile_bestStreak')}</span></div>
    <div class="stat-tile"><b>${p.perfectRuns || 0}</b><span>${t('tile_perfect')}</span></div>
    <div class="stat-tile"><b>${p.sessions.length}</b><span>${t('tile_sessions')}</span></div>`;

  renderEvolution(p);

  // Weakest countries = highest scheduler priority among seen-and-imperfect.
  const rows = PLAYABLE
    .map(n => ({ n, rec: p.records[n], w: sched.weight(p.records[n], p.qIndex) }))
    .filter(r => r.rec && r.rec.a > 0 && sched.statusOf(r.rec) !== 'mastered')
    .sort((a, b) => b.w - a.w)
    .slice(0, 10);
  $('stats-weakest').innerHTML = rows.length
    ? `<ol class="weak-list">${rows.map(r => {
        const acc = Math.round(100 * sched.accuracy(r.rec));
        return `<li><b>${escapeHtml(displayName(r.n))}</b>
          ${levelBadge(levelOf(r.n))}
          <span class="weak-acc">${t('weakAcc', { p: acc, c: r.rec.c, a: r.rec.a })}</span></li>`;
      }).join('')}</ol>`
    : `<p class="hint">${t('playHint')}</p>`;

  // Full table.
  const all = PLAYABLE
    .map(n => ({ n, rec: p.records[n] }))
    .sort((a, b) => levelOf(a.n) - levelOf(b.n) || displayName(a.n).localeCompare(displayName(b.n)));
  $('stats-table').innerHTML = `<table class="stats-table">
    <thead><tr><th>${t('th_country')}</th><th>${t('th_level')}</th><th>${t('th_status')}</th><th>${t('th_accuracy')}</th></tr></thead>
    <tbody>${all.map(({ n, rec }) => {
      const st = sched.statusOf(rec);
      const acc = sched.accuracy(rec);
      return `<tr>
        <td>${escapeHtml(displayName(n))}</td>
        <td>${levelBadge(levelOf(n))}</td>
        <td><span class="status ${st}">${t('status_' + st)}</span></td>
        <td>${acc == null ? '—' : t('accCell', { p: Math.round(acc * 100), c: rec.c, a: rec.a })}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function renderEvolution(p) {
  const el = $('stats-evolution');
  el.innerHTML = '';
  const snaps = p.snapshots;
  if (snaps.length < 2) {
    el.innerHTML = `<p class="hint">${t('evoHint')}</p>`;
    return;
  }
  const W = Math.min(el.clientWidth || 600, 700), H = 180, m = { t: 12, r: 12, b: 22, l: 34 };
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');
  const x = d3.scaleLinear().domain([0, snaps.length - 1]).range([m.l, W - m.r]);
  const y = d3.scaleLinear()
    .domain([0, Math.max(10, d3.max(snaps, s => s.known) * 1.2)]).nice()
    .range([H - m.b, m.t]);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).ticks(Math.min(snaps.length, 8)).tickFormat(i => `#${i + 1}`));
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4));
  const mkLine = key => d3.line().x((s, i) => x(i)).y(s => y(s[key]));
  svg.append('path').datum(snaps).attr('class', 'evo-line known').attr('d', mkLine('known'));
  svg.append('path').datum(snaps).attr('class', 'evo-line mastered').attr('d', mkLine('mastered'));
  svg.append('text').attr('x', W - m.r).attr('y', m.t + 10).attr('text-anchor', 'end')
    .attr('class', 'evo-legend known').text(t('legend_known'));
  svg.append('text').attr('x', W - m.r).attr('y', m.t + 26).attr('text-anchor', 'end')
    .attr('class', 'evo-legend mastered').text(t('legend_mastered'));
}

// ---------- game ----------

async function ensureMap() {
  const mode = store.getMapMode();
  if (state.map && state.mapBuiltMode === mode) return;
  if (!state.world) {
    state.world = await loadWorld();
  }
  $('map').innerHTML = '';
  const MapCls = mode === 'globe' ? GlobeMap : WorldMap;
  state.map = new MapCls($('map'), state.world, new Set(PLAYABLE), {
    onValidate: onValidate,
    labelFor: n => displayName(n),
    distLabel: km => `${km.toLocaleString(getLang() === 'fr' ? 'fr-FR' : 'en-US')} km`,
    // Keep the play area below the hud card — also in ambient mode, so the
    // globe does not jump when a game starts. Remember the last measured
    // hud height (it is display:none outside the game).
    topInset: () => {
      const el = $('main-card');
      if (el && el.offsetHeight > 0) state.hudH = el.offsetHeight;
      return (state.hudH || 68) + 26;
    },
  });
  state.mapBuiltMode = mode;
  applyAmbient();
  updateMapModeUi();
}

function updateMapModeUi() {
  const mode = store.getMapMode();
  document.querySelectorAll('#map-switch button').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === mode));
  $('zoom-hint').textContent = t(mode === 'globe' ? 'clickHintGlobe' : 'clickHint');
}

async function setMapMode(mode) {
  store.setMapMode(mode);
  updateMapModeUi();
  // Rebuild the map only when it exists; mid-question switches keep the
  // same target and phase.
  if (state.map) {
    const wasAsking = state.phase === 'asking' && state.session;
    await ensureMap();
    if (wasAsking) state.map.enabled = true;
  }
}

document.querySelectorAll('#map-switch button').forEach(b =>
  b.addEventListener('click', () => setMapMode(b.dataset.mode)));


function newSession(mode, extra = {}) {
  return { mode, asked: 0, correct: 0, streak: 0, bestStreak: 0,
    misses: [], ...extra };
}

// Enter the game screen: the ambient background becomes the playable board
// (the veil fades out via CSS, the layout re-fits under the hud).
async function enterGame() {
  await ensureMap();
  show('screen-game');
  state.map.refit();
}

async function startSeries(levelN) {
  const lvl = LEVELS.find(l => l.n === levelN);
  await enterGame();
  state.session = newSession('series', {
    levelN, queue: shuffle(lvl.countries), total: lvl.countries.length,
  });
  nextQuestion();
}

async function startTraining(levelN, missed) {
  await enterGame();
  const needs = {};
  for (const n of missed) needs[n] = TRAIN_GOAL;
  state.session = newSession('training', {
    levelN, queue: shuffle(missed), needs,
  });
  nextQuestion();
}

async function startReview() {
  await enterGame();
  state.session = newSession('review');
  state.recentAsked = [];
  state.forcedQueue = [];
  nextQuestion();
}

const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Small canvas confetti burst at (x, y) screen coordinates.
function confettiBurst(x, y) {
  if (REDUCED_MOTION) return;
  const host = $('screen-game');
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.width = host.clientWidth || window.innerWidth;
  canvas.height = host.clientHeight || window.innerHeight;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#f4b400', '#2e9e6b', '#2a7de1', '#e07b39', '#d85f74', '#9c55c9'];
  const parts = Array.from({ length: 90 }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 9 - 3,
    s: 4 + Math.random() * 5,
    c: colors[Math.floor(Math.random() * colors.length)],
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.35,
  }));
  const t0 = performance.now();
  requestAnimationFrame(function frame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = Math.max(0, 1 - (now - t0) / 1400);
    ctx.globalAlpha = fade;
    for (const p of parts) {
      p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    }
    if (fade > 0) requestAnimationFrame(frame);
    else canvas.remove();
  });
}

// Insert back into the queue a few positions ahead (not immediately next).
function requeue(queue, name, minAhead = 2) {
  const pos = Math.min(queue.length, minAhead + Math.floor(Math.random() * 3));
  queue.splice(pos, 0, name);
}

function nextQuestion() {
  const s = state.session;
  if (!s) return;

  if (s.mode === 'series' && s.queue.length === 0) return endSeries();
  if (s.mode === 'training' && s.queue.length === 0) return endTraining();

  state.phase = 'asking';
  state.map.cancelAnimations();
  state.map.clearHighlights();
  state.map.enabled = true;
  state.map.zoomReset();

  let name;
  if (s.mode === 'review') {
    name = sched.pickTarget(state.player, PLAYABLE, state.recentAsked, state.forcedQueue);
    state.recentAsked.push(name);
  } else {
    name = s.queue.shift();
  }
  state.target = name;
  state.askedAt = performance.now();

  const lvlN = levelOf(name);
  $('prompt-country').textContent = displayName(name);
  $('prompt-tier').innerHTML = `<span class="badge l${lvlN}">${t('levelShort', { n: lvlN })}</span>`;
  const hint = $('zoom-hint');
  hint.classList.remove('cont');
  hint.textContent = t(store.getMapMode() === 'globe' ? 'clickHintGlobe' : 'clickHint');
  hint.classList.remove('hidden');
  updateHud();
}

function onValidate(feature) {
  if (state.phase !== 'asking') return;
  const clicked = feature.properties.name;
  const target = state.target;
  const correct = clicked === target;

  state.phase = 'feedback';
  state.map.enabled = false;

  const s = state.session;
  s.asked++;

  sched.recordResult(state.player, target, correct);

  if (correct) {
    s.correct++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (s.mode === 'training' && --s.needs[target] > 0) requeue(s.queue, target, 2);
    state.continueOk = true;
    $('zoom-hint').classList.add('hidden');
    state.map.highlight(target, 'correct-flash');
    const pt = state.map.screenPointOf(target);
    confettiBurst(pt ? pt[0] : state.map.width / 2, pt ? pt[1] : state.map.height / 2);
    popFeedback('✓', s.streak >= 3 ? icon('flame') + t('streakRow', { n: s.streak }) : '');
    store.persist();
    updateHud();
    setTimeout(nextQuestion, 700);
  } else {
    handleMiss(clicked, target);
  }
}

function handleMiss(clicked, target) {
  const s = state.session;
  const nearMiss = clicked != null && state.map.isNeighbor(clicked, target);
  s.streak = 0;
  s.misses.push(target);
  if (s.mode === 'training') {
    s.needs[target] = TRAIN_GOAL;
    requeue(s.queue, target, 2);
  }
  if (s.mode === 'review') {
    state.forcedQueue.push({ name: target, dueQ: state.player.qIndex + 2 + Math.floor(Math.random() * 3) });
  }
  const failStreak = state.player.records[target]?.failStreak || 0;
  state.continueOk = false;
  if (clicked != null) {
    // Shake the map (and buzz on mobile) first, then show the correction.
    const shakeMs = REDUCED_MOTION ? 0 : 450;
    if (shakeMs) {
      $('map').classList.add('shake');
      try { navigator.vibrate?.(90); } catch (e) { /* not available */ }
    }
    setTimeout(() => {
      $('map').classList.remove('shake');
      if (state.phase !== 'feedback' || !state.session) return; // session ended meanwhile
      state.map.showCorrection(clicked, target);
      setContinueHint(nearMiss, failStreak);
      state.continueOk = true;
    }, shakeMs);
  } else {
    state.map.revealTarget(target);
    setContinueHint(false, failStreak);
    state.continueOk = true;
  }
  store.persist();
  updateHud();
}

// The bottom pill doubles as the "click anywhere to continue" prompt after
// a miss — all the information (labels, arrow, distance) lives on the map.
function setContinueHint(nearMiss, failStreak) {
  const el = $('zoom-hint');
  let msg = nearMiss ? t('hintMissNear') : t('hintMiss');
  if (failStreak >= 2) msg += ' · ' + t('missStreak', { n: failStreak });
  el.textContent = msg;
  el.classList.add('cont');
  el.classList.remove('hidden');
}

function giveUp() {
  if (state.phase !== 'asking') return;
  state.phase = 'feedback';
  state.map.enabled = false;
  const s = state.session;
  s.asked++;
  sched.recordResult(state.player, state.target, false);
  handleMiss(null, state.target);
}

function popFeedback(main, sub) {
  const el = $('points-popup');
  el.innerHTML = `<div class="pp-main">${main}</div>${sub ? `<div class="pp-sub">${sub}</div>` : ''}`;
  el.classList.remove('hidden');
  el.classList.remove('animate');
  void el.offsetWidth; // restart animation
  el.classList.add('animate');
  setTimeout(() => el.classList.add('hidden'), 900);
}

function updateHud() {
  const s = state.session;
  if (!s) return;
  const errs = s.misses.length;
  let counters = `<span class="c-ok" title="${t('sum_found')}">${icon('check')}${s.correct}</span>` +
    `<span class="c-ko">${icon('x')}${errs}</span>`;
  let showBar = false, okPct = 0, koPct = 0;
  if (s.mode === 'series') {
    counters += `<span class="c-total">/ ${s.total}</span>`;
    showBar = true;
    okPct = 100 * s.correct / s.total;
    koPct = 100 * Math.min(errs, s.total - s.correct) / s.total;
  } else if (s.mode === 'training') {
    const left = Object.values(s.needs).filter(v => v > 0).length;
    counters += `<span class="c-total">${t('trainingLeft', { n: left })}</span>`;
  }
  $('hud-counters').innerHTML = counters;
  $('hud-progress').style.display = showBar ? '' : 'none';
  $('hud-prog-ok').style.width = okPct + '%';
  $('hud-prog-ko').style.width = koPct + '%';
  const flags = [];
  if (errs === 0 && s.asked > 0) {
    flags.push(`<span class="flag-perfect">${icon('sparkle')}<span>${t('perfectChip')}</span></span>`);
  }
  if (s.streak >= 3) {
    flags.push(`<span class="flag-streak">${icon('flame')}<span>${t('streakRow', { n: s.streak })}</span></span>`);
  }
  $('hud-flags').innerHTML = flags.join('');
}

// ---------- session endings ----------

function commonSessionSave(s, { updateLevel = false } = {}) {
  const p = state.player;
  p.bestStreak = Math.max(p.bestStreak, s.bestStreak);
  if (s.asked > 0) {
    p.sessions.push({ ts: Date.now(), asked: s.asked, correct: s.correct, bestStreak: s.bestStreak });
    p.snapshots.push(sched.snapshot(p, PLAYABLE));
  }
  if (updateLevel) {
    const lv = playerLevels();
    const rec = lv[s.levelN] || (lv[s.levelN] = { bestStars: 0, plays: 0, highScore: 0 });
    rec.plays++;
    rec.bestStars = Math.max(rec.bestStars, s.stars);
    rec.lastScore = s.correct;
    rec.highScore = Math.max(rec.highScore || 0, s.correct);
    rec.lastMissed = [...new Set(s.misses)];
    p.dirty = { ...(p.dirty || {}), [s.levelN]: true };
  }
  store.persist();
  if (updateLevel) syncDirty();
}

function starsFor(s) {
  if (s.misses.length === 0) return 3;
  const acc = s.correct / s.total;
  if (acc >= 0.8) return 2;
  if (acc >= 0.5) return 1;
  return 0;
}

function summaryTiles(s) {
  const denom = s.mode === 'series' ? s.total : s.asked;
  return `<div class="stats-summary">
      <div class="stat-tile"><b id="sum-found">0/${denom}</b><span>${t('sum_found')}</span></div>
      <div class="stat-tile"><b>${s.bestStreak}</b><span>${t('sum_bestStreak')}</span></div>
    </div>`;
}

// Count the "found" tile up from 0 while the stars pop in one by one.
function animateSummaryCount(correct, denom, dur = 1000) {
  const el = $('sum-found');
  if (!el) return;
  if (REDUCED_MOTION) { el.textContent = `${correct}/${denom}`; return; }
  const t0 = performance.now();
  requestAnimationFrame(function f(now) {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 2);
    el.textContent = `${Math.round(eased * correct)}/${denom}`;
    if (p < 1) requestAnimationFrame(f);
  });
}

function missBadges(s) {
  const missSet = [...new Set(s.misses)];
  if (missSet.length) {
    return `<h3>${t('toReview')}</h3><p class="miss-list">${missSet.map(n =>
      `<span class="badge l${levelOf(n)}">${escapeHtml(displayName(n))}</span>`).join(' ')}</p>`;
  }
  // "Nothing to review" only means something if questions were answered.
  return s.asked > 0 ? `<p class="hint">${t('nothingToReview')}</p>` : '';
}

function openSummary(s, { title, stars = null, subtitle = '', resumable = false }) {
  const resBtn = $('btn-resume');
  if (resumable) {
    resBtn.classList.remove('hidden');
    resBtn.innerHTML = icon('play') + `<span>${t('resumeBtn')}</span>`;
  } else {
    resBtn.classList.add('hidden');
  }
  $('summary-title').textContent = title;
  const starsEl = $('summary-stars');
  if (stars == null) {
    starsEl.classList.add('hidden');
  } else {
    starsEl.classList.remove('hidden');
    starsEl.innerHTML = starsHtml(stars, 'big') +
      `<div class="hint">${t('starsHint')}</div>`;
  }
  $('summary-body').innerHTML = subtitle + summaryTiles(s) + missBadges(s);
  animateSummaryCount(s.correct, s.mode === 'series' ? s.total : s.asked);

  const missed = [...new Set(s.misses)];
  const trainBtn = $('btn-training');
  if (missed.length && s.levelN) {
    trainBtn.classList.remove('hidden');
    trainBtn.innerHTML = icon('target') + `<span>${t('trainBtn', { n: missed.length })}</span>`;
    state.lastSeries = { levelN: s.levelN, missed };
  } else {
    trainBtn.classList.add('hidden');
    if (s.levelN) state.lastSeries = { levelN: s.levelN, missed: [] };
  }
  $('btn-again').innerHTML = s.mode === 'review'
    ? icon('repeat') + `<span>${t('reviewAgainBtn')}</span>`
    : icon('replay') + `<span>${t('replayBtn')}</span>`;
  $('btn-again').dataset.mode = s.mode === 'review' ? 'review' : 'series';
  $('btn-again').dataset.level = s.levelN || '';
  $('btn-summary-menu').textContent = t('menuBtn');
  state.session = null;

  // Show the summary as an overlay above the map, with the missed countries
  // highlighted (and framed) in the background.
  state.map.enabled = false;
  state.map.cancelAnimations();
  state.map.clearHighlights();
  if (missed.length) {
    for (const n of missed) state.map.highlight(n, 'missed-reveal');
    state.map.zoomToFeatures(missed, 900, 0.8);
  } else {
    state.map.zoomReset();
  }
  show('screen-game');
  $('screen-summary').classList.add('active');
  document.body.classList.add('summary-open');
}

function endSeries() {
  const s = state.session;
  s.stars = starsFor(s);
  if (s.stars === 3) state.player.perfectRuns = (state.player.perfectRuns || 0) + 1;
  commonSessionSave(s, { updateLevel: true });
  const lvl = LEVELS.find(l => l.n === s.levelN);
  openSummary(s, {
    title: s.stars === 3 ? t('perfectTitle') : t('seriesDone'),
    stars: s.stars,
    subtitle: `<p class="summary-level">${t('levelLabel', { n: s.levelN })} · ${escapeHtml(levelTitle(lvl))}</p>`,
  });
}

function endTraining() {
  const s = state.session;
  commonSessionSave(s);
  openSummary(s, {
    title: t('trainingDone'),
    subtitle: `<p class="hint">${t('trainingDoneHint')}</p>`,
  });
}

// "End session" button: normal ending for review; for series/training the
// session is paused and resumable — its stats are only flushed if the
// player leaves the summary without resuming.
function endSessionEarly() {
  const s = state.session;
  if (!s) return;
  if (s.mode === 'review') {
    commonSessionSave(s);
    openSummary(s, { title: t('sessionComplete') });
  } else {
    if (state.phase === 'asking' && state.target) s.queue.unshift(state.target);
    state.pausedSession = s;
    openSummary(s, { title: t('endedEarly'), resumable: true });
  }
}

function flushPausedSession() {
  if (!state.pausedSession) return;
  commonSessionSave(state.pausedSession);
  state.pausedSession = null;
}

// After a mistake, a plain click anywhere on the map moves on to the next
// question (same as the Next button). Drags/zooms don't trigger it.
$('map').addEventListener('click', e => {
  if (e.defaultPrevented) return;
  if (state.phase === 'feedback' && state.session && state.continueOk) nextQuestion();
});

$('btn-dontknow').addEventListener('click', giveUp);
$('btn-end').addEventListener('click', endSessionEarly);
$('btn-resume').addEventListener('click', () => {
  const s = state.pausedSession;
  if (!s) return;
  state.pausedSession = null;
  state.session = s;
  show('screen-game');
  nextQuestion();
});
$('btn-training').addEventListener('click', () => {
  flushPausedSession();
  if (state.lastSeries?.missed.length) startTraining(state.lastSeries.levelN, state.lastSeries.missed);
});
$('btn-again').addEventListener('click', e => {
  flushPausedSession();
  const mode = e.currentTarget.dataset.mode;
  if (mode === 'review') startReview();
  else startSeries(Number(e.currentTarget.dataset.level) || state.lastSeries?.levelN || 1);
});
$('btn-summary-menu').addEventListener('click', () => {
  flushPausedSession();
  renderMenu();
  show('screen-menu');
});

document.addEventListener('keydown', e => {
  if (state.phase === 'feedback' && state.session
    && $('screen-game').classList.contains('active')
    && !document.body.classList.contains('summary-open')
    && state.continueOk
    && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    nextQuestion();
  }
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- boot ----------

setLang(store.getStoredLang() ||
  ((navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en'));
applyStaticI18n();
renderPlayers();
const last = store.getLastPlayer();
if (last) selectPlayer(last);
else show('screen-players'); // starts the background globe

// Build the shared map/globe right away — it is the background of every
// screen (ambient) before being the game board.
ensureMap().catch(e => console.warn('map init failed', e));

// Probe the leaderboard backend; offline mode is fine, we retry on use.
cloud.ping().then(ok => {
  updateOnlineBadge();
  if (ok) { refreshCloudPlayers(); syncDirty(); }
});

// Test hook for automated QA (harmless in production).
window.__mapgame = {
  state,
  forceTarget(name) {
    state.target = name;
    $('prompt-country').textContent = displayName(name);
  },
  clickCountry(name) {
    const f = state.map?.byName.get(name);
    if (f) onValidate(f);
  },
};
