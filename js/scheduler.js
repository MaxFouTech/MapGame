// Adaptive question scheduler — a Leitner-style spaced-repetition system
// keyed on the player's global question counter rather than wall-clock time,
// so spacing works both within a session and across sessions.
//
// Each country record: { a: attempts, c: correct, box: 0..5, lastQ, streak }
// box 0   = just missed / brand new     -> comes back almost immediately
// box 5   = mastered                    -> rarely asked
//
// Selection = weighted random over candidates:
//   - unseen countries get a solid base weight (we must cover everything)
//   - due countries are weighted by how overdue they are and their error rate
//   - not-yet-due countries keep a tiny weight for variety

export const INTERVALS = [2, 6, 16, 40, 100, 250]; // questions until due, per box

export function statusOf(rec) {
  if (!rec || rec.a === 0) return 'new';
  if (rec.box >= 5) return 'mastered';
  if (rec.box >= 3) return 'known';
  return 'learning';
}

export function accuracy(rec) {
  if (!rec || rec.a === 0) return null;
  return rec.c / rec.a;
}

// Priority weight used both for picking questions and for the
// "countries to reinforce" list in the stats screen.
export function weight(rec, qIndex) {
  if (!rec || rec.a === 0) return 8;                     // unseen
  const due = rec.lastQ + INTERVALS[Math.min(rec.box, 5)];
  const overdue = qIndex - due;
  const errRate = (rec.a - rec.c + 1) / (rec.a + 2);     // smoothed error rate
  if (overdue < 0) return 0.05 * (0.5 + errRate);        // not due yet
  const urgency = 1 + Math.min(overdue, 60) / 12;
  const boxBoost = rec.box === 0 ? 3 : rec.box === 1 ? 1.6 : 1;
  return urgency * (0.5 + 2.5 * errRate) * boxBoost;
}

// Smart review targeting. Priority order:
//   1. a recently-missed country whose spaced-repetition retry is due;
//   2. the player's past mistakes / weak countries (ever missed, or box <= 1);
//   3. for someone with no mistakes yet (e.g. a new player), unseen countries
//      following the level order — only the lowest level that still has unseen
//      countries, so coverage advances sequentially instead of jumping around;
//   4. once everything is seen and solid, the weakest seen countries.
export function pickTarget(player, candidates, recentAsked, forcedQueue, levelOf) {
  const q = player.qIndex;

  // Forced reinforcement: a recently-missed country whose retry is due.
  const forcedIdx = forcedQueue.findIndex(f => f.dueQ <= q && candidates.includes(f.name)
    && !recentAsked.slice(-1).includes(f.name));
  if (forcedIdx >= 0) {
    return forcedQueue.splice(forcedIdx, 1)[0].name;
  }

  const avoid = new Set(recentAsked.slice(-3));
  let base = candidates.filter(n => !avoid.has(n));
  if (base.length === 0) base = candidates;

  const seen = base.filter(n => player.records[n] && player.records[n].a > 0);
  const mistakes = seen.filter(n => {
    const r = player.records[n];
    return r.c < r.a || r.box <= 1;              // ever missed, or weak / just-missed
  });
  const unseen = base.filter(n => !player.records[n] || player.records[n].a === 0);

  // Unseen countries limited to the earliest level that still has some,
  // so a fresh player is quizzed in level order.
  let frontier = unseen;
  if (unseen.length && levelOf) {
    const minLvl = Math.min(...unseen.map(levelOf));
    frontier = unseen.filter(n => levelOf(n) === minLvl);
  }

  // Prefer mistakes; keep some room for fresh coverage when both exist.
  let pool;
  if (mistakes.length && (frontier.length === 0 || Math.random() < 0.7)) pool = mistakes;
  else if (frontier.length) pool = frontier;
  else pool = seen.length ? seen : base;

  const weights = pool.map(n => weight(player.records[n], q));
  let total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function recordResult(player, name, correct) {
  const rec = player.records[name] ||
    (player.records[name] = { a: 0, c: 0, box: 0, lastQ: 0, streak: 0, failStreak: 0 });
  rec.a++;
  if (correct) {
    rec.c++;
    rec.streak++;
    rec.failStreak = 0;
    // From box 0 (new or just missed) a correct answer jumps two boxes, so
    // two consecutive finds reach box 3 = "known". A miss then two finds
    // validates the country instead of grinding through three repetitions.
    rec.box = Math.min(5, rec.box + (rec.box === 0 ? 2 : 1));
  } else {
    rec.streak = 0;
    rec.failStreak = (rec.failStreak || 0) + 1;
    rec.box = 0;
  }
  rec.lastQ = player.qIndex;
  player.qIndex++;
  return rec;
}

// Knowledge snapshot for the evolution chart.
export function snapshot(player, allPlayable) {
  let known = 0, mastered = 0, seen = 0;
  for (const n of allPlayable) {
    const s = statusOf(player.records[n]);
    if (s !== 'new') seen++;
    if (s === 'known' || s === 'mastered') known++;
    if (s === 'mastered') mastered++;
  }
  return { ts: Date.now(), known, mastered, seen };
}
