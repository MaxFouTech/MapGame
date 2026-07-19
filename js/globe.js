// 3D globe rendering (orthographic projection) with the same public
// interface as WorldMap: drag to spin, wheel/pinch to zoom, click to
// answer, great-circle correction arrow on mistakes.

import { buildGeoData, computeColors, mainGeometry, OCEAN } from './map.js';

const d3 = window.d3;

const clampLat = v => Math.max(-89, Math.min(89, v));

export class GlobeMap {
  constructor(container, world, playableSet, callbacks, opts = {}) {
    this.container = container;
    this.playable = playableSet;
    this.cb = callbacks; // { onValidate(feature), labelFor(name), distLabel(km) }
    this.opts = opts;    // { rotate: [lambda, phi] } initial orientation
    this.enabled = false;

    const { features, byName, neighbors, tiny } = buildGeoData(world);
    this.features = features;
    this.byName = byName;
    this.neighbors = neighbors;
    this.tiny = tiny;

    this._arrow = null;   // {coords: [[lon,lat],...]}
    this._labels = [];    // {name, kind, lonlat}
    this._build();
  }

  _build() {
    const el = this.container;
    this.width = el.clientWidth || 900;
    this.height = el.clientHeight || 700;

    this.svg = d3.select(el).append('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('width', '100%').attr('height', '100%')
      .style('background', '#e9eef2');

    this.k = 1;
    // -18 tilt matches the ambient resting position, so the first ambient
    // pass needs no reset animation at boot.
    this.projection = d3.geoOrthographic()
      .clipAngle(90)
      .rotate(this.opts.rotate || [-10, -18]);
    this._applyLayout();
    this.path = d3.geoPath(this.projection);

    this.sphere = this.svg.append('path')
      .attr('class', 'globe-ocean')
      .attr('fill', OCEAN);

    this.colors = computeColors(this.features, this.neighbors, this.playable);

    this.gCountries = this.svg.append('g');
    this.countryPaths = this.gCountries.selectAll('path.country')
      .data(this.features, f => f.properties.name)
      .join('path')
      .attr('class', f => 'country' + (this.playable.has(f.properties.name) ? '' : ' territory'))
      .attr('fill', f => this.colors.get(f.properties.name))
      .attr('stroke', '#ffffff')
      .on('click', (event, f) => {
        if (!this.enabled || event.defaultPrevented) return;
        // Non-playable territories are never an answer.
        if (!this.playable.has(f.properties.name)) return;
        event.stopPropagation();
        // Tiny countries answerable only at ring-marker zoom level.
        if (this.tiny.has(f.properties.name) && this.k < 1.6) return;
        this.cb.onValidate(f);
      });

    // Invisible enlarged hit outlines for tiny countries (see WorldMap).
    const tinyFeats = this.features.filter(f =>
      this.playable.has(f.properties.name) && this.tiny.has(f.properties.name));
    const validate = (event, f) => {
      if (!this.enabled || event.defaultPrevented) return;
      event.stopPropagation();
      // Tiny countries answerable only at ring-marker zoom level.
      if (this.tiny.has(f.properties.name) && this.k < 1.6) return;
      this.cb.onValidate(f);
    };
    this.hitPaths = this.svg.append('g').selectAll('path.hit')
      .data(tinyFeats)
      .join('path')
      .attr('class', 'hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .style('pointer-events', 'stroke')
      .style('display', 'none')
      .on('click', validate);

    // Visible ring markers over tiny countries (screen-space, hidden when
    // the country faces away from the viewer).
    this.markerLL = new Map(tinyFeats.map(f =>
      [f.properties.name, d3.geoCentroid(mainGeometry(f))]));
    this.markers = this.svg.append('g').selectAll('g.tiny-marker')
      .data(tinyFeats).join('g')
      .attr('class', 'tiny-marker')
      .style('display', 'none')
      .on('click', validate);
    this.markers.append('circle').attr('class', 'tm-hit').attr('r', 16).attr('fill', 'transparent');
    this.markers.append('circle').attr('class', 'tm-ring').attr('r', 7)
      .attr('fill', f => this.colors.get(f.properties.name))
      .attr('fill-opacity', 0.22)
      .attr('stroke', f => this.colors.get(f.properties.name))
      .attr('stroke-width', 1.6);

    this.overlay = this.svg.append('g').attr('class', 'overlay-layer');

    // One d3.zoom handles everything: wheel/pinch scale -> projection
    // scale, drag translate delta -> rotation.
    this._last = { x: 0, y: 0, k: 1 };
    this._syncing = false;
    this.zoom = d3.zoom()
      .scaleExtent([0.8, 14])
      .clickDistance(5)
      .on('zoom', (event) => {
        const t = event.transform;
        if (this._syncing) { this._last = { x: t.x, y: t.y, k: t.k }; return; }
        const zooming = Math.abs(t.k - this._last.k) > 1e-6;
        if (!zooming) {
          const degPerPx = 120 / (this.base * this.k);
          const dx = t.x - this._last.x, dy = t.y - this._last.y;
          const [l, p] = this.projection.rotate();
          this.projection.rotate([l + dx * degPerPx, clampLat(p - dy * degPerPx), 0]);
        }
        this.k = t.k;
        this.projection.scale(this.base * this.k);
        this._last = { x: t.x, y: t.y, k: t.k };
        this._scheduleRender();
      });
    this.svg.call(this.zoom).on('dblclick.zoom', null);

    // Refit on window resize.
    this._resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.refit(), 150);
    });

    this._render();
  }

  // Fit the globe in the space below the hud (topInset) and above the hint.
  _applyLayout() {
    const top = this.cb.topInset ? this.cb.topInset() : 0;
    // 30% larger than the strict fit: the horizon may run off-screen on the
    // narrow axis, which reads as a closer, more immersive globe.
    this.base = (Math.min(this.width, this.height - top) / 2 - 10) * 1.3;
    this.projection
      .translate([this.width / 2, top + (this.height - top) / 2])
      .scale(this.base * this.k);
  }

  // Ambient mode: non-interactive slow spin used as the menu background.
  // Entering it resets the view left over from the game: zoom back to 1,
  // standard tilt, highlights cleared — then the slow spin resumes.
  setAmbient(on) {
    this.ambient = on;
    if (on) {
      this.enabled = false;
      this.clearHighlights();
      this.cancelAnimations();
      // Only animate the reset when coming back from a zoomed game view;
      // at boot (k already 1) start the slow spin directly — no wasted
      // 700ms of full-rate rendering on the load critical path.
      if (this.k > 1.02) {
        const [l] = this.projection.rotate();
        this._animateTo([-l, 18], 1, 700, () => {
          if (this.ambient) this._startSpin();
        });
      } else {
        this._startSpin();
      }
    } else {
      this._stopSpin();
    }
    this.refit();
  }

  _startSpin() {
    if (this._spin) return;
    // Keep the first spin out of the page-load window: its per-frame cost
    // would otherwise inflate FCP/LCP/TBT. The globe still shows at once,
    // it just begins rotating shortly after `load`. Later spins (e.g. back
    // from a game) start immediately.
    if (!this._spunOnce && document.readyState !== 'complete') {
      window.addEventListener('load', () => setTimeout(() => {
        if (this.ambient) this._startSpin();
      }, 400), { once: true });
      return;
    }
    this._spunOnce = true;
    this._lastSpinT = 0;
    const step = (t) => {
      if (!this.ambient) { this._spin = null; return; }
      if (!this._lastSpinT) this._lastSpinT = t;
      const dt = t - this._lastSpinT;
      // ~15fps is plenty for a slowly rotating background and roughly halves
      // the per-second projection cost (rotation stays dt-proportional, so
      // the visual speed is unchanged). Browsers already pause rAF in
      // hidden tabs, so no extra visibility handling is needed.
      if (dt > 66) {
        const [l, p] = this.projection.rotate();
        this.projection.rotate([l + dt * 0.004, p, 0]);
        this._lastSpinT = t;
        this._render();
      }
      this._spin = requestAnimationFrame(step);
    };
    this._spin = requestAnimationFrame(step);
  }

  _stopSpin() {
    if (this._spin) cancelAnimationFrame(this._spin);
    this._spin = null;
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this._render(); });
  }

  _viewCenter() {
    const [l, p] = this.projection.rotate();
    return [-l, -p];
  }

  _render() {
    this.sphere.attr('d', this.path({ type: 'Sphere' }));
    this.countryPaths
      .attr('d', f => this.path(f))
      .attr('stroke-width', 0.5 / Math.sqrt(this.k));
    // Tiny-country hit areas / ring markers only matter above the ring-zoom
    // threshold — below it (including every ambient spin frame) skip
    // projecting their ~60 paths/points entirely.
    if (this.k >= 1.6) {
      const center = this._viewCenter();
      this.hitPaths.attr('d', f => this.path(f)).style('display', null);
      this.markers
        .attr('transform', f => {
          const p = this.projection(this.markerLL.get(f.properties.name));
          return p ? `translate(${p[0]},${p[1]})` : null;
        })
        .style('display', f =>
          d3.geoDistance(this.markerLL.get(f.properties.name), center) < Math.PI / 2 - 0.05
          ? null : 'none');
    } else {
      this.hitPaths.style('display', 'none');
      this.markers.style('display', 'none');
    }
    this._renderOverlay();
  }

  _renderOverlay() {
    const ov = this.overlay;
    ov.selectAll('*').remove();
    const center = this._viewCenter();

    if (this._arrow) {
      // The path clips at the horizon automatically (clipAngle).
      const line = this.path({ type: 'LineString', coordinates: this._arrow.coords });
      if (line) {
        ov.append('path').attr('class', 'arrow-line')
          .attr('d', line)
          .attr('stroke-width', 4.2)
          .attr('stroke-dasharray', '11 7');
        // Arrowhead at the last visible sampled point.
        const pts = this._arrow.coords;
        let tip = null, prev = null;
        for (let i = pts.length - 1; i > 0; i--) {
          if (d3.geoDistance(pts[i], center) < Math.PI / 2 - 0.02) {
            tip = this.projection(pts[i]);
            prev = this.projection(pts[i - 1]);
            break;
          }
        }
        if (tip && prev) {
          const ang = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) * 180 / Math.PI;
          ov.append('path').attr('class', 'arrow-head')
            .attr('d', 'M0,0 L-12,-5 L-12,5 Z')
            .attr('transform', `translate(${tip[0]},${tip[1]}) rotate(${ang}) scale(2.1)`);
        }
        // Distance written on the middle of the arrow.
        if (this._arrow.mid && d3.geoDistance(this._arrow.mid, center) < Math.PI / 2 - 0.02) {
          const mp = this.projection(this._arrow.mid);
          if (mp) {
            const g = ov.append('g').attr('class', 'map-label dist')
              .attr('transform', `translate(${mp[0]},${mp[1]})`);
            g.append('text').attr('class', 'map-label-halo')
              .attr('font-size', '13px').attr('stroke-width', 4).attr('dy', -9)
              .text(this._arrow.distText);
            g.append('text').attr('class', 'map-label-text')
              .attr('font-size', '13px').attr('dy', -9)
              .text(this._arrow.distText);
          }
        }
      }
    }

    for (const lab of this._labels) {
      if (d3.geoDistance(lab.lonlat, center) >= Math.PI / 2 - 0.05) continue;
      const p = this.projection(lab.lonlat);
      if (!p) continue;
      const text = this.cb.labelFor ? this.cb.labelFor(lab.name) : lab.name;
      const g = ov.append('g')
        .attr('class', `map-label ${lab.kind}`)
        .attr('transform', `translate(${p[0]},${p[1]})`);
      g.append('text').attr('class', 'map-label-halo')
        .attr('font-size', '15px').attr('stroke-width', 4).text(text);
      g.append('text').attr('class', 'map-label-text')
        .attr('font-size', '15px').text(text);
    }
  }

  // Animate rotation + zoom, then resync the d3.zoom transform.
  _animateTo(targetLonLat, targetK, dur = 900, done = null) {
    const rot0 = this.projection.rotate();
    let dl = (-targetLonLat[0]) - rot0[0];
    dl = ((dl + 540) % 360) - 180; // shortest way around
    const p0 = rot0[1], p1 = clampLat(-targetLonLat[1]);
    const k0 = this.k, k1 = Math.max(0.8, Math.min(14, targetK));
    this._syncing = true;
    this.svg.transition('globe').duration(dur)
      .tween('rotzoom', () => tt => {
        this.projection.rotate([rot0[0] + dl * tt, p0 + (p1 - p0) * tt, 0]);
        this.k = k0 + (k1 - k0) * tt;
        this.projection.scale(this.base * this.k);
        this._render();
      })
      .on('end interrupt', () => {
        this.svg.call(this.zoom.transform, d3.zoomIdentity.scale(this.k));
        this._syncing = false;
        done?.();
      });
  }

  refit() {
    const el = this.container;
    if (!el.clientWidth || !el.clientHeight) return;
    this.width = el.clientWidth;
    this.height = el.clientHeight;
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    this._applyLayout();
    this._render();
  }

  zoomReset(dur = 750) {
    const c = this._viewCenter();
    this._animateTo(c, 1, dur);
  }

  zoomToFeatures(names, dur = 900) {
    const pts = names.map(n => this.byName.get(n)).filter(Boolean)
      .map(f => d3.geoCentroid(mainGeometry(f)));
    if (!pts.length) return;
    const center = d3.geoCentroid({ type: 'MultiPoint', coordinates: pts });
    const maxD = Math.max(0.05, ...pts.map(p => d3.geoDistance(center, p)));
    const k = Math.max(0.9, Math.min(7, Math.PI / (2 * maxD + 0.55)));
    this._animateTo(center, k, dur);
  }

  // Screen-pixel position of a country's center, or null if it faces away.
  screenPointOf(name) {
    const f = this.byName.get(name);
    if (!f) return null;
    const ll = d3.geoCentroid(mainGeometry(f));
    if (d3.geoDistance(ll, this._viewCenter()) >= Math.PI / 2) return null;
    return this.projection(ll);
  }

  isNeighbor(a, b) {
    return this.neighbors.get(a)?.has(b) || false;
  }

  highlight(name, cls) {
    this.countryPaths.filter(f => f.properties.name === name).classed(cls, true).raise();
  }

  clearHighlights() {
    this.countryPaths.classed('correct-flash wrong-flash target-reveal missed-reveal', false);
    this._arrow = null;
    this._labels = [];
    this.overlay.selectAll('*').remove();
  }

  cancelAnimations() {
    this.svg.interrupt('globe');
  }

  showCorrection(guessName, targetName) {
    this.highlight(guessName, 'wrong-flash');
    this.highlight(targetName, 'target-reveal');
    const gf = this.byName.get(guessName), tf = this.byName.get(targetName);
    if (!gf || !tf) return;
    const gc = d3.geoCentroid(mainGeometry(gf)), tc = d3.geoCentroid(mainGeometry(tf));
    const dist = d3.geoDistance(gc, tc);
    const mid = d3.geoInterpolate(gc, tc)(0.5);
    const k = Math.max(0.9, Math.min(7, Math.PI / (dist + 0.6)));
    const interp = d3.geoInterpolate(gc, tc);
    const km = Math.round(dist * 6371);
    this._arrow = {
      coords: d3.range(0, 1.0001, 1 / 64).map(interp),
      mid,
      distText: this.cb.distLabel ? this.cb.distLabel(km) : `${km} km`,
    };
    this._labels = [
      { name: guessName, kind: 'guess', lonlat: gc },
      { name: targetName, kind: 'target', lonlat: tc },
    ];
    this._animateTo(mid, k, 900);
  }

  revealTarget(targetName) {
    this.highlight(targetName, 'target-reveal');
    const tf = this.byName.get(targetName);
    if (!tf) return;
    const tc = d3.geoCentroid(mainGeometry(tf));
    this._labels = [{ name: targetName, kind: 'target', lonlat: tc }];
    this._animateTo(tc, 3.2, 900);
  }
}
