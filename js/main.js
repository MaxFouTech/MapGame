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
import { t, setLang, getLang } from './i18n.js';

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
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  $('prompt-label').textContent = t('find');
  $('btn-world').textContent = t('worldView');
  $('btn-dontknow').textContent = t('showMe');
  $('btn-end').textContent = t('endSession');
  $('btn-next').textContent = t('next');
  $('zoom-hint').textContent = t('clickHint');
  document.documentElement.lang = getLang();
  document.querySelectorAll('.lang-switch button').forEach(b =>
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

document.querySelectorAll('.lang-switch button').forEach(b =>
  b.addEventListener('click', () => switchLang(b.dataset.lang)));

// ---------- screens ----------

function show(id) {
  document.body.classList.remove('summary-open');
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
      <span class="player-row-meta">${snap.known}/${PLAYABLE.length} ${t('known')}</span>`;
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
      <span class="level-num l${lvl.n}">${lvl.slam ? '👑' : lvl.n}</span>
      <span class="level-body">
        <span class="level-title">${escapeHtml(levelTitle(lvl))}</span>
        <span class="level-meta">${t('countriesCount', { n: total })} · ${t('statusCounts', { k: known, l: learning })}</span>
        <span class="level-foot">${starsHtml(rec.bestStars || 0)}
          <span class="prog-bar mini">
            <span class="prog-fill l${Math.min(lvl.n, 8)}" style="width:${100 * known / total}%"></span>
            <span class="prog-fill l${Math.min(lvl.n, 8)} soft" style="width:${100 * learning / total}%"></span>
          </span>
        </span>
        ${scores}
      </span>`;
    card.addEventListener('click', () => startSeries(lvl.n));
    grid.appendChild(card);
  }
}

$('btn-switch-player').addEventListener('click', () => { renderPlayers(); show('screen-players'); });
$('btn-review').addEventListener('click', startReview);
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
  if (state.map) return;
  const world = await fetch('data/countries-50m.json').then(r => r.json());
  state.world = world;
  state.map = new WorldMap($('map'), world, new Set(PLAYABLE), {
    onValidate: onValidate,
    labelFor: n => displayName(n),
  });
}

function newSession(mode, extra = {}) {
  return { mode, asked: 0, correct: 0, streak: 0, bestStreak: 0,
    misses: [], ...extra };
}

async function startSeries(levelN) {
  const lvl = LEVELS.find(l => l.n === levelN);
  show('screen-game');
  await ensureMap();
  state.map.refit();
  state.session = newSession('series', {
    levelN, queue: shuffle(lvl.countries), total: lvl.countries.length,
  });
  nextQuestion();
}

async function startTraining(levelN, missed) {
  show('screen-game');
  await ensureMap();
  state.map.refit();
  const needs = {};
  for (const n of missed) needs[n] = TRAIN_GOAL;
  state.session = newSession('training', {
    levelN, queue: shuffle(missed), needs,
  });
  nextQuestion();
}

async function startReview() {
  show('screen-game');
  await ensureMap();
  state.map.refit();
  state.session = newSession('review');
  state.recentAsked = [];
  state.forcedQueue = [];
  nextQuestion();
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
  $('feedback').classList.add('hidden');
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
  s.asked++;

  sched.recordResult(state.player, target, correct);

  if (correct) {
    s.correct++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (s.mode === 'training' && --s.needs[target] > 0) requeue(s.queue, target, 2);
    state.map.highlight(target, 'correct-flash');
    popFeedback('✓', s.streak >= 3 ? t('streakRow', { n: s.streak }) : '');
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
  const failNote = failStreak >= 2
    ? `<div class="fail-streak">${t('missStreak', { n: failStreak })}</div>` : '';
  if (clicked != null) {
    state.map.showCorrection(clicked, target);
    showFeedback(
      `${nearMiss ? t('soClose') : t('notQuite')} ` +
      t('youClicked', { guess: escapeHtml(displayName(clicked)), target: escapeHtml(displayName(target)) }) +
      (nearMiss ? ` <span class="consolation">${t('nearMissBonus')}</span>` : '') +
      failNote);
  } else {
    state.map.revealTarget(target);
    showFeedback(t('revealMsg', { target: escapeHtml(displayName(target)) }) + failNote);
  }
  store.persist();
  updateHud();
}

function giveUp() {
  if (state.phase !== 'asking') return;
  state.phase = 'feedback';
  state.map.enabled = false;
  $('zoom-hint').classList.add('hidden');
  const s = state.session;
  s.asked++;
  sched.recordResult(state.player, state.target, false);
  handleMiss(null, state.target);
}

function showFeedback(html) {
  $('feedback-text').innerHTML = html;
  $('feedback').classList.remove('hidden');
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
  $('hud-perfect').innerHTML = s.misses.length === 0 ? t('perfectChip') : '';
  $('hud-streak').innerHTML = s.streak >= 2 ? t('streakRow', { n: s.streak }) : '';
  if (s.mode === 'series') {
    $('hud-score').textContent = `${s.correct}/${s.total}`;
    $('hud-qcount').textContent = t('questionOf', { i: Math.min(s.asked + 1, s.total), n: s.total });
  } else if (s.mode === 'training') {
    const left = Object.values(s.needs).filter(v => v > 0).length;
    $('hud-score').textContent = `${s.correct}`;
    $('hud-qcount').textContent = t('trainingLeft', { n: left });
  } else {
    $('hud-score').textContent = `${s.correct}`;
    $('hud-qcount').textContent = t('correctCount', { c: s.correct, a: s.asked });
  }
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
  }
  store.persist();
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
      <div class="stat-tile"><b>${s.correct}/${denom}</b><span>${t('sum_found')}</span></div>
      <div class="stat-tile"><b>${s.bestStreak}</b><span>${t('sum_bestStreak')}</span></div>
    </div>`;
}

function missBadges(s) {
  const missSet = [...new Set(s.misses)];
  return missSet.length
    ? `<h3>${t('toReview')}</h3><p class="miss-list">${missSet.map(n =>
        `<span class="badge l${levelOf(n)}">${escapeHtml(displayName(n))}</span>`).join(' ')}</p>`
    : `<p class="hint">${t('nothingToReview')}</p>`;
}

function openSummary(s, { title, stars = null, subtitle = '' }) {
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

  const missed = [...new Set(s.misses)];
  const trainBtn = $('btn-training');
  if (missed.length && s.levelN) {
    trainBtn.classList.remove('hidden');
    trainBtn.textContent = t('trainBtn', { n: missed.length });
    state.lastSeries = { levelN: s.levelN, missed };
  } else {
    trainBtn.classList.add('hidden');
    if (s.levelN) state.lastSeries = { levelN: s.levelN, missed: [] };
  }
  $('btn-again').textContent = s.mode === 'review' ? t('reviewAgainBtn') : t('replayBtn');
  $('btn-again').dataset.mode = s.mode === 'review' ? 'review' : 'series';
  $('btn-again').dataset.level = s.levelN || '';
  $('btn-summary-menu').textContent = t('menuBtn');
  state.session = null;

  // Show the summary as an overlay above the map, with the missed countries
  // highlighted (and framed) in the background.
  state.map.enabled = false;
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

// "End session" button: normal ending for review, early stop for series/training.
function endSessionEarly() {
  const s = state.session;
  if (!s) return;
  if (s.mode === 'review') {
    commonSessionSave(s);
    openSummary(s, { title: t('sessionComplete') });
  } else {
    commonSessionSave(s);
    openSummary(s, { title: t('endedEarly') });
  }
}

// After a mistake, a plain click anywhere on the map moves on to the next
// question (same as the Next button). Drags/zooms don't trigger it.
$('map').addEventListener('click', e => {
  if (e.defaultPrevented) return;
  if (state.phase === 'feedback' && state.session
    && !$('feedback').classList.contains('hidden')) {
    nextQuestion();
  }
});

$('btn-world').addEventListener('click', () => state.map?.zoomReset());
$('btn-dontknow').addEventListener('click', giveUp);
$('btn-end').addEventListener('click', endSessionEarly);
$('btn-next').addEventListener('click', nextQuestion);
$('btn-training').addEventListener('click', () => {
  if (state.lastSeries?.missed.length) startTraining(state.lastSeries.levelN, state.lastSeries.missed);
});
$('btn-again').addEventListener('click', e => {
  const mode = e.currentTarget.dataset.mode;
  if (mode === 'review') startReview();
  else startSeries(Number(e.currentTarget.dataset.level) || state.lastSeries?.levelN || 1);
});
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
