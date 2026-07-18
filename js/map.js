// World map rendering: graph-colored countries, two-step click (zoom then
// validate), pan/wheel navigation, and the correction overlay (arrow from the
// wrong guess to the right country).

const d3 = window.d3;
const topojson = window.topojson;

const PALETTE = [
  '#eac86e', '#f0a35e', '#df6e56', '#3aa189', '#94b877',
  '#b46684', '#8d90c9', '#a97bc0', '#c2a25b', '#7fb3ab',
];
const NON_PLAYABLE = '#d9d5cc';
const OCEAN = '#cfe0ea';

export class WorldMap {
  constructor(container, world, playableSet, callbacks) {
    this.container = container;
    this.playable = playableSet;
    this.cb = callbacks; // { onValidate(feature), labelFor(name) }
    this.enabled = false;

    const geo = topojson.feature(world, world.objects.countries);
    // Antarctica takes a lot of vertical space and is never asked.
    this.features = geo.features.filter(f => f.properties.name !== 'Antarctica');
    this.byName = new Map(this.features.map(f => [f.properties.name, f]));

    // Adjacency from shared borders (all features, pre-filter, so indexes match).
    const allGeoms = world.objects.countries.geometries;
    const neighborIdx = topojson.neighbors(allGeoms);
    this.neighbors = new Map();
    allGeoms.forEach((g, i) => {
      this.neighbors.set(g.properties.name,
        new Set(neighborIdx[i].map(j => allGeoms[j].properties.name)));
    });

    this._build();
  }

  _build() {
    const el = this.container;
    this.width = el.clientWidth || 1200;
    this.height = el.clientHeight || 700;

    this.svg = d3.select(el).append('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('width', '100%').attr('height', '100%')
      .style('background', OCEAN);

    this.projection = d3.geoNaturalEarth1();
    this._fitProjection();
    this.path = d3.geoPath(this.projection);

    // Refit on window resize so the world always fills the available space.
    this._resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.refit(), 150);
    });

    this.g = this.svg.append('g');
    this.overlay = this.g.append('g').attr('class', 'overlay-layer');

    this._colorize();

    this.countryPaths = this.g.selectAll('path.country')
      .data(this.features, f => f.properties.name)
      .join('path')
      .attr('class', f => 'country' + (this.playable.has(f.properties.name) ? '' : ' territory'))
      .attr('d', this.path)
      .attr('fill', f => this.colors.get(f.properties.name))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0.5)
      .on('click', (event, f) => this._onCountryClick(event, f));

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
        this._scaleOverlay();
      });
    this.svg.call(this.zoom).on('dblclick.zoom', null);
  }

  _fitProjection() {
    this.projection.fitExtent(
      [[4, 4], [this.width - 4, this.height - 4]],
      { type: 'FeatureCollection', features: this.features });
  }

  refit() {
    const el = this.container;
    if (!el.clientWidth || !el.clientHeight) return;
    this.width = el.clientWidth;
    this.height = el.clientHeight;
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this._fitProjection();
    this.countryPaths.attr('d', this.path);
  }

  // Greedy graph coloring: countries sharing a border, or with nearby
  // centroids (small neighbors like islands), never get the same color.
  _colorize() {
    const conflicts = new Map(this.features.map(f => [f.properties.name, new Set()]));
    const add = (a, b) => { conflicts.get(a)?.add(b); conflicts.get(b)?.add(a); };

    for (const f of this.features) {
      for (const n of (this.neighbors.get(f.properties.name) || [])) {
        if (conflicts.has(n)) add(f.properties.name, n);
      }
    }

    // Proximity conflicts via geographic centroids (degrees, rough but fine).
    const cent = this.features.map(f => ({ name: f.properties.name, c: d3.geoCentroid(f) }));
    for (let i = 0; i < cent.length; i++) {
      for (let j = i + 1; j < cent.length; j++) {
        const dx = Math.abs(cent[i].c[0] - cent[j].c[0]);
        const dy = Math.abs(cent[i].c[1] - cent[j].c[1]);
        if (Math.min(dx, 360 - dx) < 7 && dy < 7) add(cent[i].name, cent[j].name);
      }
    }

    // Welsh–Powell: color highest-degree first.
    const order = [...conflicts.keys()].sort((a, b) => conflicts.get(b).size - conflicts.get(a).size);
    this.colors = new Map();
    for (const name of order) {
      if (!this.playable.has(name)) { this.colors.set(name, NON_PLAYABLE); continue; }
      const used = new Set();
      for (const n of conflicts.get(name)) {
        const c = this.colors.get(n);
        if (c) used.add(c);
      }
      this.colors.set(name, PALETTE.find(c => !used.has(c)) || PALETTE[0]);
    }
  }

  // A click on a country is always an answer — the player manages zoom and
  // pan themselves (wheel / drag).
  _onCountryClick(event, f) {
    if (!this.enabled) return;
    if (event.defaultPrevented) return; // was a drag
    event.stopPropagation();
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

  _drawArrow(guessName, targetName) {
    const gf = this.byName.get(guessName), tf = this.byName.get(targetName);
    if (!gf || !tf) return;
    // Sample the great circle between the two geographic centroids so long
    // arrows curve naturally with the projection.
    const interp = d3.geoInterpolate(
      d3.geoCentroid(this._mainPolygon(gf)), d3.geoCentroid(this._mainPolygon(tf)));
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
    g.append('text').attr('class', 'map-label-halo').text(text);
    g.append('text').attr('class', 'map-label-text').text(text);
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
    this.overlay.selectAll('.map-label text')
      .attr('font-size', `${15 / k}px`)
      .attr('stroke-width', 4 / k);
  }
}
