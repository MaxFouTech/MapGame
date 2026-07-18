// Screen management and game loop.

import { TIERS, TIER_ICONS, PLAYABLE, displayName, tierOf } from './countries.js';
import * as store from './storage.js';
import * as sched from './scheduler.js';
import { WorldMap } from './map.js';
import { t, setLang, getLang } from './i18n.js';

const d3 = window.d3;
const $ = id => document.getElementById(id);

const BASE_POINTS = [0, 50, 70, 90, 110, 140]; // by tier
const SPEED_WINDOW = 15;                        // seconds for full speed bonus decay
const state = {
  playerName: null,
  player: null,
  map: null,
  world: null,
  // per-session:
  session: null,
  target: null,
  askedAt: 0,
  recentAsked: [],
  forcedQueue: [],
  phase: 'idle', // 'asking' | 'feedback'
};

const tierName = tier => t('tier_' + tier);

// ---------- i18n ----------

function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  $('prompt-label').textContent = t('find');
  $('hud-pts').textContent = t('pts');
  $('btn-world').textContent = t('worldView');
  $('btn-dontknow').textContent = t('showMe');
  $('btn-end').textContent = t('endSession');
  $('btn-next').textContent = t('next');
  $('btn-again').textContent = t('trainAgain');
  $('btn-summary-menu').textContent = t('menuBtn');
  $('zoom-hint').textContent = t('clickHint');
  document.documentElement.lang = getLang();
  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.classList.toggle('on', b.dataset.lang === getLang()));
}

function switchLang(l) {
  setLang(l);
  store.setStoredLang(l);
  applyStaticI18n();
  // Re-render whatever dynamic screen is visible.
  renderPlayers();
  if (state.player) renderMenu();
  if ($('screen-stats').classList.contains('active')) renderStats();
}

document.querySelectorAll('.lang-switch button').forEach(b =>
  b.addEventListener('click', () => switchLang(b.dataset.lang)));

// ---------- screens ----------

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ---------- player screen ----------

function renderPlayers() {
  const list = $('player-list');
  list.innerHTML = '';
  const players = store.listPlayers();
  if (!players.length) {
    list.innerHTML = `<p class="hint">${t('noPlayers')}</p>`;
  }
  for (const name of players) {
    const p = store.getPlayer(name);
    const snap = sched.snapshot(p, PLAYABLE);
    const row = document.createElement('button');
    row.className = 'player-row';
    row.innerHTML = `<span class="player-row-name">${escapeHtml(name)}</span>
      <span class="player-row-meta">${snap.known}/${PLAYABLE.length} ${t('known')} · ${p.totalScore.toLocaleString()} pts</span>`;
    row.addEventListener('click', () => selectPlayer(name));
    list.appendChild(row);
  }
}

function selectPlayer(name) {
  state.playerName = name;
  state.player = store.getPlayer(name) || store.createPlayer(name);
  store.touchPlayer(name);
  renderMenu();
  show('screen-menu');
}

function addPlayer() {
  const name = $('new-player-name').value.trim();
  if (!name) return;
  store.createPlayer(name);
  $('new-player-name').value = '';
  selectPlayer(name);
}
$('btn-add-player').addEventListener('click', addPlayer);
$('new-player-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); addPlayer(); }
});

// ---------- menu screen ----------

function renderMenu() {
  $('menu-player-name').textContent = state.playerName;
  const chips = $('tier-chips');
  chips.innerHTML = '';
  const selected = new Set(state.player.settings.tiers);
  for (let tier = 1; tier <= 5; tier++) {
    const count = PLAYABLE.filter(n => TIERS[n] === tier).length;
    const chip = document.createElement('button');
    chip.className = 'tier-chip' + (selected.has(tier) ? ' on' : '');
    chip.innerHTML = `${TIER_ICONS[tier - 1]} ${tierName(tier)} <small>${count}</small>`;
    chip.addEventListener('click', () => {
      if (selected.has(tier)) { if (selected.size > 1) selected.delete(tier); }
      else selected.add(tier);
      state.player.settings.tiers = [...selected].sort();
      store.persist();
      renderMenu();
    });
    chips.appendChild(chip);
  }

  // Per-tier mastery bars.
  const prog = $('menu-progress');
  prog.innerHTML = '';
  for (let tier = 1; tier <= 5; tier++) {
    const names = PLAYABLE.filter(n => TIERS[n] === tier);
    const known = names.filter(n => ['known', 'mastered'].includes(
      sched.statusOf(state.player.records[n]))).length;
    const pct = Math.round(100 * known / names.length);
    const row = document.createElement('div');
    row.className = 'prog-row';
    row.innerHTML = `<span class="prog-label">${tierName(tier)}</span>
      <div class="prog-bar"><div class="prog-fill t${tier}" style="width:${pct}%"></div></div>
      <span class="prog-pct">${known}/${names.length}</span>`;
    prog.appendChild(row);
  }
}

$('btn-switch-player').addEventListener('click', () => { renderPlayers(); show('screen-players'); });
$('btn-start').addEventListener('click', startSession);
$('btn-stats').addEventListener('click', () => { renderStats(); show('screen-stats'); });
$('btn-stats-back').addEventListener('click', () => { renderMenu(); show('screen-menu'); });

// ---------- stats screen ----------

function renderStats() {
  const p = state.player;
  $('stats-player-name').textContent = state.playerName;
  const snap = sched.snapshot(p, PLAYABLE);

  $('stats-summary').innerHTML = `
    <div class="stat-tile"><b>${p.totalScore.toLocaleString()}</b><span>${t('tile_totalPoints')}</span></div>
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
          <span class="badge t${tierOf(r.n)}">${tierName(tierOf(r.n))}</span>
          <span class="weak-acc">${t('weakAcc', { p: acc, c: r.rec.c, a: r.rec.a })}</span></li>`;
      }).join('')}</ol>`
    : `<p class="hint">${t('playHint')}</p>`;

  // Full table.
  const all = PLAYABLE
    .map(n => ({ n, rec: p.records[n] }))
    .sort((a, b) => tierOf(a.n) - tierOf(b.n) || displayName(a.n).localeCompare(displayName(b.n)));
  $('stats-table').innerHTML = `<table class="stats-table">
    <thead><tr><th>${t('th_country')}</th><th>${t('th_level')}</th><th>${t('th_status')}</th><th>${t('th_accuracy')}</th></tr></thead>
    <tbody>${all.map(({ n, rec }) => {
      const st = sched.statusOf(rec);
      const acc = sched.accuracy(rec);
      return `<tr>
        <td>${escapeHtml(displayName(n))}</td>
        <td><span class="badge t${tierOf(n)}">${tierName(tierOf(n))}</span></td>
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
  if (state.map) return;
  const world = await fetch('data/countries-50m.json').then(r => r.json());
  state.world = world;
  state.map = new WorldMap($('map'), world, new Set(PLAYABLE), {
    onValidate: onValidate,
    labelFor: n => displayName(n),
  });
}

function candidates() {
  const tiers = new Set(state.player.settings.tiers);
  return PLAYABLE.filter(n => tiers.has(TIERS[n]));
}

async function startSession() {
  show('screen-game');
  await ensureMap();
  state.map.refit();
  state.session = { score: 0, asked: 0, correct: 0, streak: 0, bestStreak: 0, misses: [] };
  state.recentAsked = [];
  state.forcedQueue = [];
  updateHud();
  nextQuestion();
}

function nextQuestion() {
  state.phase = 'asking';
  $('feedback').classList.add('hidden');
  state.map.clearHighlights();
  state.map.enabled = true;
  state.map.zoomReset();

  const name = sched.pickTarget(state.player, candidates(), state.recentAsked, state.forcedQueue);
  state.target = name;
  state.recentAsked.push(name);
  state.askedAt = performance.now();

  const tier = tierOf(name);
  $('prompt-country').textContent = displayName(name);
  $('prompt-tier').innerHTML =
    `<span class="badge t${tier}">${tierName(tier)}</span>`;
  $('zoom-hint').classList.remove('hidden');
  updateHud();
}

function onValidate(feature) {
  if (state.phase !== 'asking') return;
  const clicked = feature.properties.name;
  const target = state.target;
  const correct = clicked === target;

  state.phase = 'feedback';
  state.map.enabled = false;
  $('zoom-hint').classList.add('hidden');

  const s = state.session;
  const elapsed = (performance.now() - state.askedAt) / 1000;
  s.asked++;

  sched.recordResult(state.player, target, correct);

  if (correct) {
    s.correct++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const tier = tierOf(target);
    const base = BASE_POINTS[tier];
    const speedBonus = Math.round(40 * Math.max(0, SPEED_WINDOW - elapsed) / SPEED_WINDOW);
    const mult = 1 + 0.1 * Math.min(s.streak - 1, 10);
    const pts = Math.round((base + speedBonus) * mult);
    s.score += pts;
    state.map.highlight(target, 'correct-flash');
    popPoints(`+${pts}`, s.streak >= 3 ? `🔥 ×${mult.toFixed(1)}` : '');
    store.persist();
    updateHud();
    setTimeout(nextQuestion, 1300);
  } else {
    const nearMiss = state.map.isNeighbor(clicked, target);
    if (nearMiss) s.score += 10;
    s.streak = 0;
    s.misses.push(target);
    // Re-ask soon so the correction sticks.
    state.forcedQueue.push({ name: target, dueQ: state.player.qIndex + 2 + Math.floor(Math.random() * 3) });
    state.map.showCorrection(clicked, target);
    showFeedback(
      `${nearMiss ? t('soClose') : t('notQuite')} ` +
      t('youClicked', { guess: escapeHtml(displayName(clicked)), target: escapeHtml(displayName(target)) }) +
      (nearMiss ? ` <span class="consolation">${t('nearMissBonus')}</span>` : ''));
    store.persist();
    updateHud();
  }
}

function giveUp() {
  if (state.phase !== 'asking') return;
  state.phase = 'feedback';
  state.map.enabled = false;
  $('zoom-hint').classList.add('hidden');
  const s = state.session;
  const target = state.target;
  s.asked++;
  s.streak = 0;
  s.misses.push(target);
  sched.recordResult(state.player, target, false);
  state.forcedQueue.push({ name: target, dueQ: state.player.qIndex + 2 + Math.floor(Math.random() * 3) });
  state.map.revealTarget(target);
  showFeedback(t('revealMsg', { target: escapeHtml(displayName(target)) }));
  store.persist();
  updateHud();
}

function showFeedback(html) {
  $('feedback-text').innerHTML = html;
  $('feedback').classList.remove('hidden');
}

function popPoints(main, sub) {
  const el = $('points-popup');
  el.innerHTML = `<div class="pp-main">${main}</div>${sub ? `<div class="pp-sub">${sub}</div>` : ''}`;
  el.classList.remove('hidden');
  el.classList.remove('animate');
  void el.offsetWidth; // restart animation
  el.classList.add('animate');
  setTimeout(() => el.classList.add('hidden'), 1200);
}

function updateHud() {
  const s = state.session;
  if (!s) return;
  $('hud-score').textContent = s.score.toLocaleString();
  $('hud-perfect').innerHTML = s.misses.length === 0 ? t('perfectChip') : '';
  $('hud-streak').innerHTML = s.streak >= 2 ? t('streakRow', { n: s.streak }) : '';
  $('hud-qcount').textContent = t('correctCount', { c: s.correct, a: s.asked });
}

function endSession() {
  const s = state.session;
  if (!s) return;
  const p = state.player;
  const perfect = s.asked > 0 && s.misses.length === 0;
  p.totalScore += s.score;
  p.bestStreak = Math.max(p.bestStreak, s.bestStreak);
  if (perfect && s.asked >= 5) p.perfectRuns = (p.perfectRuns || 0) + 1;
  if (s.asked > 0) {
    p.sessions.push({ ts: Date.now(), score: s.score, asked: s.asked, correct: s.correct, bestStreak: s.bestStreak });
    p.snapshots.push(sched.snapshot(p, PLAYABLE));
  }
  store.persist();

  const acc = s.asked ? Math.round(100 * s.correct / s.asked) : 0;
  const missSet = [...new Set(s.misses)];
  $('summary-title').textContent = perfect ? t('perfectTitle') : t('sessionComplete');
  $('summary-body').innerHTML = `
    <div class="stats-summary">
      <div class="stat-tile"><b>${s.score.toLocaleString()}</b><span>${t('sum_points')}</span></div>
      <div class="stat-tile"><b>${acc}%</b><span>${t('sum_accuracy', { c: s.correct, a: s.asked })}</span></div>
      <div class="stat-tile"><b>${s.bestStreak}</b><span>${t('sum_bestStreak')}</span></div>
    </div>
    ${missSet.length ? `<h3>${t('toReview')}</h3><p class="miss-list">${missSet.map(n =>
      `<span class="badge t${tierOf(n)}">${escapeHtml(displayName(n))}</span>`).join(' ')}</p>`
      : `<p class="hint">${t('nothingToReview')}</p>`}`;
  state.session = null;
  show('screen-summary');
}

$('btn-world').addEventListener('click', () => state.map?.zoomReset());
$('btn-dontknow').addEventListener('click', giveUp);
$('btn-end').addEventListener('click', endSession);
$('btn-next').addEventListener('click', nextQuestion);
$('btn-again').addEventListener('click', startSession);
$('btn-summary-menu').addEventListener('click', () => { renderMenu(); show('screen-menu'); });

document.addEventListener('keydown', e => {
  if (state.phase === 'feedback' && !$('feedback').classList.contains('hidden')
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
