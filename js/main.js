// Screen management and game loop.

import { TIERS, TIER_NAMES, TIER_ICONS, PLAYABLE, displayName, tierOf } from './countries.js';
import * as store from './storage.js';
import * as sched from './scheduler.js';
import { WorldMap, ARMED_SCALE } from './map.js';

const d3 = window.d3;
const $ = id => document.getElementById(id);

const BASE_POINTS = [0, 50, 70, 90, 110, 140]; // by tier
const SPEED_WINDOW = 12;                        // seconds for full speed bonus decay
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
    list.innerHTML = '<p class="hint">No players yet — create one below.</p>';
  }
  for (const name of players) {
    const p = store.getPlayer(name);
    const snap = sched.snapshot(p, PLAYABLE);
    const row = document.createElement('button');
    row.className = 'player-row';
    row.innerHTML = `<span class="player-row-name">${escapeHtml(name)}</span>
      <span class="player-row-meta">${snap.known}/${PLAYABLE.length} known · ${p.totalScore.toLocaleString()} pts</span>`;
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

$('new-player-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('new-player-name').value.trim();
  if (!name) return;
  store.createPlayer(name);
  $('new-player-name').value = '';
  selectPlayer(name);
});

// ---------- menu screen ----------

function renderMenu() {
  $('menu-player-name').textContent = state.playerName;
  const chips = $('tier-chips');
  chips.innerHTML = '';
  const selected = new Set(state.player.settings.tiers);
  TIER_NAMES.forEach((label, i) => {
    const tier = i + 1;
    const count = PLAYABLE.filter(n => TIERS[n] === tier).length;
    const chip = document.createElement('button');
    chip.className = 'tier-chip' + (selected.has(tier) ? ' on' : '');
    chip.innerHTML = `${TIER_ICONS[i]} ${label} <small>${count}</small>`;
    chip.addEventListener('click', () => {
      if (selected.has(tier)) { if (selected.size > 1) selected.delete(tier); }
      else selected.add(tier);
      state.player.settings.tiers = [...selected].sort();
      store.persist();
      renderMenu();
    });
    chips.appendChild(chip);
  });

  // Per-tier mastery bars.
  const prog = $('menu-progress');
  prog.innerHTML = '';
  TIER_NAMES.forEach((label, i) => {
    const tier = i + 1;
    const names = PLAYABLE.filter(n => TIERS[n] === tier);
    const known = names.filter(n => ['known', 'mastered'].includes(
      sched.statusOf(state.player.records[n]))).length;
    const pct = Math.round(100 * known / names.length);
    const row = document.createElement('div');
    row.className = 'prog-row';
    row.innerHTML = `<span class="prog-label">${label}</span>
      <div class="prog-bar"><div class="prog-fill t${tier}" style="width:${pct}%"></div></div>
      <span class="prog-pct">${known}/${names.length}</span>`;
    prog.appendChild(row);
  });
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
    <div class="stat-tile"><b>${p.totalScore.toLocaleString()}</b><span>total points</span></div>
    <div class="stat-tile"><b>${snap.seen}</b><span>seen</span></div>
    <div class="stat-tile"><b>${snap.known}</b><span>known</span></div>
    <div class="stat-tile"><b>${snap.mastered}</b><span>mastered</span></div>
    <div class="stat-tile"><b>${p.bestStreak}</b><span>best streak</span></div>
    <div class="stat-tile"><b>${p.sessions.length}</b><span>sessions</span></div>`;

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
          <span class="badge t${tierOf(r.n)}">${TIER_NAMES[tierOf(r.n) - 1]}</span>
          <span class="weak-acc">${acc}% correct (${r.rec.c}/${r.rec.a})</span></li>`;
      }).join('')}</ol>`
    : '<p class="hint">Play a session to find out what to reinforce.</p>';

  // Full table.
  const all = PLAYABLE
    .map(n => ({ n, rec: p.records[n] }))
    .sort((a, b) => tierOf(a.n) - tierOf(b.n) || a.n.localeCompare(b.n));
  $('stats-table').innerHTML = `<table class="stats-table">
    <thead><tr><th>Country</th><th>Level</th><th>Status</th><th>Accuracy</th></tr></thead>
    <tbody>${all.map(({ n, rec }) => {
      const st = sched.statusOf(rec);
      const acc = sched.accuracy(rec);
      return `<tr>
        <td>${escapeHtml(displayName(n))}</td>
        <td><span class="badge t${tierOf(n)}">${TIER_NAMES[tierOf(n) - 1]}</span></td>
        <td><span class="status ${st}">${st}</span></td>
        <td>${acc == null ? '—' : Math.round(acc * 100) + '% (' + rec.c + '/' + rec.a + ')'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function renderEvolution(p) {
  const el = $('stats-evolution');
  el.innerHTML = '';
  const snaps = p.snapshots;
  if (snaps.length < 2) {
    el.innerHTML = '<p class="hint">Finish a few sessions to see your knowledge grow.</p>';
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
    .attr('class', 'evo-legend known').text('● known');
  svg.append('text').attr('x', W - m.r).attr('y', m.t + 26).attr('text-anchor', 'end')
    .attr('class', 'evo-legend mastered').text('● mastered');
}

// ---------- game ----------

async function ensureMap() {
  if (state.map) return;
  const world = await fetch('data/countries-50m.json').then(r => r.json());
  state.world = world;
  state.map = new WorldMap($('map'), world, new Set(PLAYABLE), {
    onValidate: onValidate,
    onArm: () => $('zoom-hint').classList.add('hidden'),
  });
}

function candidates() {
  const tiers = new Set(state.player.settings.tiers);
  return PLAYABLE.filter(n => tiers.has(TIERS[n]));
}

async function startSession() {
  show('screen-game');
  await ensureMap();
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
    `<span class="badge t${tier}">${TIER_NAMES[tier - 1]}</span>`;
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
    popPoints(`+${pts}`, s.streak >= 3 ? `🔥 streak ×${mult.toFixed(1)}` : '');
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
      `${nearMiss ? 'So close!' : 'Not quite.'} You clicked <b>${escapeHtml(displayName(clicked))}</b>` +
      ` — <b>${escapeHtml(displayName(target))}</b> is at the tip of the arrow.` +
      (nearMiss ? ' <span class="consolation">+10 for the near miss</span>' : ''));
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
  showFeedback(`<b>${escapeHtml(displayName(target))}</b> is highlighted here. It will come back soon!`);
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
  $('hud-streak').innerHTML = s.streak >= 2 ? `🔥 ${s.streak} in a row` : '';
  $('hud-qcount').textContent =
    `${s.correct}/${s.asked} correct`;
}

function endSession() {
  const s = state.session;
  if (!s) return;
  const p = state.player;
  p.totalScore += s.score;
  p.bestStreak = Math.max(p.bestStreak, s.bestStreak);
  if (s.asked > 0) {
    p.sessions.push({ ts: Date.now(), score: s.score, asked: s.asked, correct: s.correct, bestStreak: s.bestStreak });
    p.snapshots.push(sched.snapshot(p, PLAYABLE));
  }
  store.persist();

  const acc = s.asked ? Math.round(100 * s.correct / s.asked) : 0;
  const missSet = [...new Set(s.misses)];
  $('summary-body').innerHTML = `
    <div class="stats-summary">
      <div class="stat-tile"><b>${s.score.toLocaleString()}</b><span>points</span></div>
      <div class="stat-tile"><b>${acc}%</b><span>accuracy (${s.correct}/${s.asked})</span></div>
      <div class="stat-tile"><b>${s.bestStreak}</b><span>best streak</span></div>
    </div>
    ${missSet.length ? `<h3>To review</h3><p class="miss-list">${missSet.map(n =>
      `<span class="badge t${tierOf(n)}">${escapeHtml(displayName(n))}</span>`).join(' ')}</p>`
      : '<p class="hint">Perfect run — nothing to review! 🏆</p>'}`;
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
