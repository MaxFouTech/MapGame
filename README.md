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
   (localStorage).
2. **Choose difficulty levels** — from *Very easy* (USA, Brazil, France…) to
   *Expert* (microstates and remote islands). You can combine several.
3. **Find the country**: the first click zooms into the zone you clicked.
   You can then pan and zoom freely — the next click on a country is your
   answer.
4. **Mistakes teach**: on a wrong answer the map zooms out to show both
   countries and draws an arrow from your guess to the right one.
   A near miss (you clicked a neighbour) earns a small consolation.
5. **Not sure?** Use *Show me* — it reveals the country (counts as a miss)
   and schedules it to come back soon.

## Scoring

- Base points scale with difficulty tier (50 → 140).
- Speed bonus for answering within 12 seconds.
- Streak multiplier up to ×2 for consecutive correct answers.

## The training strategy

Every answer feeds a Leitner-style spaced-repetition system:

- Each country sits in a box 0–5. Correct answers promote it; a miss sends
  it back to box 0.
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
- [D3](https://d3js.org/) + [topojson-client](https://github.com/topojson/topojson-client)
  (vendored in `vendor/`).
- Map data: [world-atlas](https://github.com/topojson/world-atlas) 50m
  (Natural Earth), vendored in `data/`.
- Countries are colored by greedy graph coloring so no two neighbouring or
  nearby countries share a color.
- ~197 playable countries hand-curated into 5 difficulty tiers
  (`js/countries.js`); non-sovereign territories are drawn muted and are
  never asked.
