# 🌍 MapGame — Learn the World

A training game to memorise where every country is. Pick a player, choose
difficulty levels, and find countries on a colored world map. The game tracks
what you know and automatically reinforces the countries you miss.

## Run it

No build step — it's a static site. Serve the folder and open it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works; opening `index.html` directly via `file://` won't,
because the app fetches the map data.)

## How to play

1. **Pick or create a player** — progress is saved per player in the browser
   (localStorage). The interface is available in **English and French**
   (FR/EN toggle, country names included).
2. **Pick a level** — 8 themed levels of 20-30 countries, ordered by
   difficulty (from *World Giants* to *Microstates & Ends of the Earth*),
   plus a **Grand Slam** level covering all 197 countries.
   A series asks every country of the level once, in random order.
3. **Find the country**: click it on the map. You manage the view yourself —
   scroll to zoom, drag to pan. Every click on a country is an answer.
4. **Mistakes teach**: on a wrong answer the map zooms out to show both
   countries and draws an arrow from your guess to the right one.
   A near miss (you clicked a neighbour) earns a small consolation.
5. **Not sure?** Use *Show me* — it reveals the country (counts as a miss).
6. **Stars**: each series ends with a rating — ★★★ for a perfect run,
   ★★ for ≥80% accuracy, ★ for ≥50%. The score is simply the number of
   countries found (e.g. 18/20); each level card shows your last score,
   your best score and your best stars, and turns **gold** once you get
   3 stars. The end-of-series summary highlights your missed countries
   on the map behind it. If you miss countries, a **training mode**
   replays just your errors until each has been found twice — then retry
   the level for 3 stars.
7. **Smart review** — an endless adaptive mode driven by the
   spaced-repetition scheduler, prioritising your weakest and overdue
   countries across all levels.
8. **All countries** — a browsable list of every country grouped by level,
   colored by your knowledge status.

## Scoring

- Base points scale with difficulty tier (50 → 140).
- Speed bonus for answering within 12 seconds.
- Streak multiplier up to ×2 for consecutive correct answers.

## The training strategy

Every answer feeds a Leitner-style spaced-repetition system:

- Each country sits in a box 0–5. Correct answers promote it; a miss sends
  it back to box 0. From box 0 a correct answer jumps two boxes, so two
  consecutive finds are enough to validate a country ("known") — including
  after a miss.
- Spacing is measured in *questions asked* (not wall-clock time), so it works
  within a session and across sessions.
- Question selection is weighted: overdue and frequently-missed countries are
  strongly favoured, unseen countries get steady coverage, and mastered ones
  only reappear occasionally.
- A missed country is force-re-asked a few questions later so the correction
  sticks.

The **Progress** screen shows knowledge over time (known/mastered curves),
the priority list of countries to reinforce, and per-country accuracy.

## Tech

- Plain HTML/CSS/ES modules, no framework, no build.
- Two map modes: flat 2D (Natural Earth projection) or 3D globe
  (orthographic) — spin by dragging, pinch or scroll to zoom; the
  correction arrow follows the great circle on the sphere. Switchable
  from the menu or mid-game, remembered per browser.
- [D3](https://d3js.org/) + [topojson-client](https://github.com/topojson/topojson-client)
  (vendored in `vendor/`).
- Map data: [world-atlas](https://github.com/topojson/world-atlas) 50m
  (Natural Earth), vendored in `data/`.
- Countries are colored by greedy graph coloring so no two neighbouring or
  nearby countries share a color.
- ~197 playable countries hand-curated into 5 difficulty tiers
  (`js/countries.js`); non-sovereign territories are drawn muted and are
  never asked.
