// World map rendering: graph-colored countries, two-step click (zoom then
// validate), pan/wheel navigation, and the correction overlay (arrow from the
// wrong guess to the right country).

const d3 = window.d3;
const topojson = window.topojson;

import { theme } from './themes.js';
import { NAME_TO_ISO2 } from './flags.js';

// Draw a correction label (flag + country name) centred at the current
// origin of `g`. Used by both the 2D map and the globe so the on-map labels
// match the flags shown elsewhere. Returns nothing; a missing flag simply
// leaves the name on its own.
export function appendFlagLabel(g, text, name, fontSize = 15) {
  const inner = g.append('g').attr('class', 'ml-inner');
  const iso = NAME_TO_ISO2[name];
  const fw = fontSize * 1.4, fh = fontSize, gap = fontSize * 0.32;
  const tx = iso ? fw + gap : 0;
  const halo = inner.append('text').attr('class', 'map-label-halo')
    .attr('font-size', `${fontSize}px`).attr('stroke-width', 4)
    .attr('text-anchor', 'start').attr('x', tx).text(text);
  const txt = inner.append('text').attr('class', 'map-label-text')
    .attr('font-size', `${fontSize}px`)
    .attr('text-anchor', 'start').attr('x', tx).text(text);
  let w;
  try { w = txt.node().getComputedTextLength(); } catch (e) { w = text.length * fontSize * 0.55; }
  if (iso) {
    const url = `https://flagcdn.com/w40/${iso}.png`;
    inner.insert('image', ':first-child').attr('class', 'ml-flag')
      .attr('href', url).attr('xlink:href', url) // xlink for older browsers
      .attr('x', 0).attr('y', -fh / 2).attr('width', fw).attr('height', fh)
      .attr('preserveAspectRatio', 'xMidYMid slice');
  }
  inner.attr('transform', `translate(${-(tx + w) / 2}, 0)`);
}

import { EXTRA_FEATURES } from './extras.js';

// Shared between the 2D map and the 3D globe.
export function buildGeoData(world) {
  const geo = topojson.feature(world, world.objects.countries);
  // Antarctica takes a lot of space and is never asked. Extra features
  // (e.g. Tuvalu) fill gaps in the 50m dataset.
  const features = geo.features.filter(f => f.properties.name !== 'Antarctica')
    .concat(EXTRA_FEATURES);
  const byName = new Map(features.map(f => [f.properties.name, f]));

  // Adjacency from shared borders (all features, pre-filter, so indexes match).
  const allGeoms = world.objects.countries.geometries;
  const neighborIdx = topojson.neighbors(allGeoms);
  const neighbors = new Map();
  allGeoms.forEach((g, i) => {
    neighbors.set(g.properties.name,
      new Set(neighborIdx[i].map(j => allGeoms[j].properties.name)));
  });
  // Countries too small to click comfortably get an enlarged hit area
  // (transparent stroke around their outline, enabled once zoomed in).
  const tiny = new Set(features
    .filter(f => d3.geoArea(f) < 2e-4) // ≈ under ~8000 km²
    .map(f => f.properties.name));
  return { features, byName, neighbors, tiny };
}

// Greedy graph coloring: countries sharing a border, or with nearby
// centroids (small neighbors like islands), never get the same color.
export function computeColors(features, neighbors, playable) {
  const conflicts = new Map(features.map(f => [f.properties.name, new Set()]));
  const add = (a, b) => { conflicts.get(a)?.add(b); conflicts.get(b)?.add(a); };

  for (const f of features) {
    for (const n of (neighbors.get(f.properties.name) || [])) {
      if (conflicts.has(n)) add(f.properties.name, n);
    }
  }

  // Proximity conflicts via geographic centroids (degrees, rough but fine).
  const cent = features.map(f => ({ name: f.properties.name, c: d3.geoCentroid(f) }));
  for (let i = 0; i < cent.length; i++) {
    for (let j = i + 1; j < cent.length; j++) {
      const dx = Math.abs(cent[i].c[0] - cent[j].c[0]);
      const dy = Math.abs(cent[i].c[1] - cent[j].c[1]);
      if (Math.min(dx, 360 - dx) < 7 && dy < 7) add(cent[i].name, cent[j].name);
    }
  }

  // Welsh–Powell: color highest-degree first.
  const th = theme();
  const PALETTE = th.palette;
  const order = [...conflicts.keys()].sort((a, b) => conflicts.get(b).size - conflicts.get(a).size);
  const colors = new Map();
  for (const name of order) {
    if (!playable.has(name)) { colors.set(name, th.land); continue; }
    const used = new Set();
    for (const n of conflicts.get(name)) {
      const c = colors.get(n);
      if (c) used.add(c);
    }
    colors.set(name, PALETTE.find(c => !used.has(c)) || PALETTE[0]);
  }
  return colors;
}

// Largest polygon of a multipolygon by spherical area — for centroids and
// bounds of countries with far-flung islands or antimeridian crossings.
export function mainGeometry(f) {
  if (f.geometry.type !== 'MultiPolygon') return f.geometry;
  let best = f.geometry, bestArea = -1;
  for (const coords of f.geometry.coordinates) {
    const poly = { type: 'Polygon', coordinates: coords };
    const a = d3.geoArea(poly);
    if (a > bestArea) { bestArea = a; best = poly; }
  }
  return best;
}

export class WorldMap {
  constructor(container, world, playableSet, callbacks) {
    this.container = container;
    this.playable = playableSet;
    this.cb = callbacks; // { onValidate(feature), labelFor(name) }
    this.enabled = false;

    const { features, byName, neighbors, tiny } = buildGeoData(world);
    this.features = features;
    this.byName = byName;
    this.neighbors = neighbors;
    this.tiny = tiny;

    this._build();
  }

  _build() {
    const el = this.container;
    this.width = el.clientWidth || 1200;
    this.height = el.clientHeight || 700;

    this.svg = d3.select(el).append('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('width', '100%').attr('height', '100%')
      .style('background', theme().ocean);

    this.projection = d3.geoNaturalEarth1();
    this._fitProjection();
    this.path = d3.geoPath(this.projection);

    // Refit on window resize so the world always fills the available space.
    // Keep the handler reference so destroy() can remove it on rebuild.
    this._resizeTimer = null;
    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.refit(), 150);
    };
    window.addEventListener('resize', this._onResize);

    this.g = this.svg.append('g');
    this.overlay = this.g.append('g').attr('class', 'overlay-layer');

    this.colors = computeColors(this.features, this.neighbors, this.playable);

    this.countryPaths = this.g.selectAll('path.country')
      .data(this.features, f => f.properties.name)
      .join('path')
      .attr('class', f => 'country' + (this.playable.has(f.properties.name) ? '' : ' territory'))
      .attr('d', this.path)
      .attr('fill', f => this.colors.get(f.properties.name))
      .attr('stroke', theme().stroke)
      .attr('stroke-width', 0.5)
      .on('click', (event, f) => this._onCountryClick(event, f));

    // Invisible enlarged hit outlines for tiny countries, active when
    // zoomed in enough that they can't swallow big neighbours' clicks.
    this.hitPaths = this.g.append('g').selectAll('path.hit')
      .data(this.features.filter(f =>
        this.playable.has(f.properties.name) && this.tiny.has(f.properties.name)))
      .join('path')
      .attr('class', 'hit')
      .attr('d', this.path)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .style('pointer-events', 'stroke')
      .style('display', 'none')
      .on('click', (event, f) => this._onCountryClick(event, f));

    // Visible ring markers over tiny countries once zoomed in: a fat,
    // findable touch target (32px hit) plus a colored ring affordance.
    const tinyFeats = this.features.filter(f =>
      this.playable.has(f.properties.name) && this.tiny.has(f.properties.name));
    this.markers = this.g.append('g').selectAll('g.tiny-marker')
      .data(tinyFeats).join('g')
      .attr('class', 'tiny-marker')
      .style('display', 'none')
      .on('click', (event, f) => this._onCountryClick(event, f));
    this.markers.append('circle').attr('class', 'tm-hit').attr('fill', 'transparent');
    this.markers.append('circle').attr('class', 'tm-ring')
      .attr('fill', f => this.colors.get(f.properties.name))
      .attr('fill-opacity', 0.22)
      .attr('stroke', f => this.colors.get(f.properties.name));
    this._placeMarkers();

    // Keep overlay on top of country paths.
    this.overlay.raise();

    this.k = 1;
    this.zoom = d3.zoom()
      .scaleExtent([1, 60])
      .clickDistance(5)
      .on('zoom', (event) => {
        this.k = event.transform.k;
        this.g.attr('transform', event.transform);
        this.g.selectAll('path.country').attr('stroke-width', 0.5 / Math.sqrt(this.k));
        this.hitPaths
          .attr('stroke-width', 18 / this.k)
          .style('display', this.k >= 2.2 ? null : 'none');
        this._updateMarkers();
        this._scaleOverlay();
      });
    this.svg.call(this.zoom).on('dblclick.zoom', null);
  }

  _placeMarkers() {
    this.markers.attr('transform', f => {
      const c = this.path.centroid(this._mainPolygon(f));
      return `translate(${c[0]},${c[1]})`;
    });
  }

  // Screen-constant sizes: ring ~7px radius, hit ~16px, at any zoom.
  _updateMarkers() {
    const k = this.k || 1;
    this.markers.style('display', k >= 2.2 ? null : 'none');
    this.markers.select('.tm-hit').attr('r', 16 / k);
    this.markers.select('.tm-ring').attr('r', 7 / k).attr('stroke-width', 1.6 / k);
  }

  _fitProjection() {
    const top = 4 + (this.cb.topInset ? this.cb.topInset() : 0);
    this.projection.fitExtent(
      [[4, top], [this.width - 4, this.height - 4]],
      { type: 'FeatureCollection', features: this.features });
  }

  // Ambient mode: static muted background behind the menus. Entering it
  // resets the view left over from the game (zoom, highlights).
  setAmbient(on) {
    this.ambient = on;
    if (on) {
      this.enabled = false;
      this.clearHighlights();
      this.cancelAnimations();
      this.zoomReset(600);
    }
    this.refit();
  }

  refit() {
    const el = this.container;
    if (!el.clientWidth || !el.clientHeight) return;
    this.width = el.clientWidth;
    this.height = el.clientHeight;
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this._fitProjection();
    this.countryPaths.attr('d', this.path);
    this.hitPaths.attr('d', this.path);
    this._placeMarkers();
  }

  // A click on a country is always an answer — the player manages zoom and
  // pan themselves (wheel / drag). Tiny countries only become answerable
  // once zoomed in enough for their ring markers (prevents impossible
  // misclicks at world view).
  _onCountryClick(event, f) {
    if (!this.enabled) return;
    if (event.defaultPrevented) return; // was a drag
    // Non-playable territories are never an answer — let the click fall
    // through as if it hit the ocean.
    if (!this.playable.has(f.properties.name)) return;
    event.stopPropagation();
    if (this.tiny.has(f.properties.name) && this.k < 2.2) return;
    this.cb.onValidate(f);
  }

  zoomReset(dur = 750) {
    this.svg.transition().duration(dur).call(this.zoom.transform, d3.zoomIdentity);
  }

  // Multipolygon countries that straddle the antimeridian (Russia, Fiji,
  // New Zealand…) or have far-flung islands would produce map-wide bounds
  // and off-map centroids — measure their largest polygon instead.
  _mainPolygon(f) {
    if (f.geometry.type !== 'MultiPolygon') return f;
    let best = f, bestArea = -1;
    for (const coords of f.geometry.coordinates) {
      const poly = { type: 'Polygon', coordinates: coords };
      const a = this.path.area(poly);
      if (a > bestArea) { bestArea = a; best = poly; }
    }
    return best;
  }

  zoomToFeatures(names, dur = 900, pad = 0.72) {
    const feats = names.map(n => this.byName.get(n)).filter(Boolean);
    if (!feats.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of feats) {
      const b = this.path.bounds(this._mainPolygon(f));
      x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]);
      x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]);
    }
    const k = Math.max(1, Math.min(40, pad / Math.max(
      (x1 - x0) / this.width, (y1 - y0) / this.height)));
    const t = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(k)
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    this.svg.transition().duration(dur).call(this.zoom.transform, t);
  }

  centroidOf(name) {
    const f = this.byName.get(name);
    return f ? this.path.centroid(this._mainPolygon(f)) : null;
  }

  // Screen-pixel position of a country's center (for particle effects).
  screenPointOf(name) {
    const c = this.centroidOf(name);
    if (!c) return null;
    return d3.zoomTransform(this.svg.node()).apply(c);
  }

  isNeighbor(a, b) {
    return this.neighbors.get(a)?.has(b) || false;
  }

  highlight(name, cls) {
    this.countryPaths.filter(f => f.properties.name === name).classed(cls, true).raise();
    this.overlay.raise();
  }

  clearHighlights() {
    this.countryPaths.classed('correct-flash wrong-flash target-reveal missed-reveal', false);
    this.overlay.selectAll('*').remove();
  }

  // Wrong answer: zoom out to fit both countries, then draw a curved arrow
  // from the guess to the target and label both.
  showCorrection(guessName, targetName) {
    this.highlight(guessName, 'wrong-flash');
    this.highlight(targetName, 'target-reveal');
    this.zoomToFeatures([guessName, targetName], 900, 0.55);
    setTimeout(() => this._drawArrow(guessName, targetName), 650);
  }

  revealTarget(targetName) {
    this.highlight(targetName, 'target-reveal');
    this.zoomToFeatures([targetName], 900, 0.25);
    setTimeout(() => this._label(targetName, 'target'), 650);
  }

  cancelAnimations() {
    this.svg.interrupt();
  }

  // Tear down before the instance is discarded (rebuild / theme switch):
  // stop transitions and drop the resize listener so dead instances don't
  // linger.
  destroy() {
    this.ambient = false;
    this.cancelAnimations();
    window.removeEventListener('resize', this._onResize);
  }

  _drawArrow(guessName, targetName) {
    const gf = this.byName.get(guessName), tf = this.byName.get(targetName);
    if (!gf || !tf) return;
    // Sample the great circle between the two geographic centroids so long
    // arrows curve naturally with the projection.
    const gc = d3.geoCentroid(this._mainPolygon(gf));
    const tc = d3.geoCentroid(this._mainPolygon(tf));
    const interp = d3.geoInterpolate(gc, tc);
    const pts = d3.range(0, 1.0001, 1 / 48).map(t => this.projection(interp(t))).filter(Boolean);
    if (pts.length < 2) return;
    const line = d3.line().curve(d3.curveCatmullRom.alpha(0.5));

    const arrow = this.overlay.append('g').attr('class', 'arrow');
    arrow.append('path')
      .attr('d', line(pts))
      .attr('class', 'arrow-line');
    // Arrowhead oriented along the last segment.
    const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
    const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    arrow.append('path')
      .attr('class', 'arrow-head')
      .attr('d', 'M0,0 L-12,-5 L-12,5 Z')
      .attr('transform', `translate(${x2},${y2}) rotate(${ang})`);

    // Distance written on the middle of the arrow.
    const km = Math.round(d3.geoDistance(gc, tc) * 6371);
    const midPt = this.projection(interp(0.5));
    if (midPt) {
      const g = this.overlay.append('g')
        .attr('class', 'map-label dist')
        .attr('transform', `translate(${midPt[0]},${midPt[1]})`);
      const text = this.cb.distLabel ? this.cb.distLabel(km) : `${km} km`;
      g.append('text').attr('class', 'map-label-halo').attr('dy', -8).text(text);
      g.append('text').attr('class', 'map-label-text').attr('dy', -8).text(text);
    }

    this._label(guessName, 'guess');
    this._label(targetName, 'target');
    this._scaleOverlay();
  }

  _label(name, kind) {
    const c = this.centroidOf(name);
    if (!c) return;
    const text = this.cb.labelFor ? this.cb.labelFor(name) : name;
    const g = this.overlay.append('g')
      .attr('class', `map-label ${kind}`)
      .attr('transform', `translate(${c[0]},${c[1]})`);
    // Inner group carries the zoom scale so the flag and text stay locked
    // together (see _scaleOverlay).
    const scale = g.append('g').attr('class', 'ml-scale');
    appendFlagLabel(scale, text, name, 15);
    this._scaleOverlay();
  }

  // Keep overlay strokes/labels a constant screen size while zooming.
  _scaleOverlay() {
    const k = this.k || 1;
    this.overlay.selectAll('.arrow-line')
      .attr('stroke-width', 4.2 / k)
      .attr('stroke-dasharray', `${11 / k} ${7 / k}`);
    this.overlay.selectAll('.arrow-head')
      .attr('transform', function () {
        const base = d3.select(this).attr('transform').replace(/ scale\([^)]*\)/, '');
        return `${base} scale(${2.1 / k})`;
      });
    // Country labels (flag + name) scale as a whole group, keeping the flag
    // and text proportioned together.
    this.overlay.selectAll('.map-label:not(.dist) .ml-scale')
      .attr('transform', `scale(${1 / k})`);
    // The distance label is text only.
    this.overlay.selectAll('.map-label.dist text')
      .attr('font-size', `${13 / k}px`)
      .attr('stroke-width', 4 / k)
      .attr('dy', -9 / k);
  }
}
