// Slowly rotating decorative globe rendered on a canvas behind the menu
// screens. Muted single-tone styling; pauses entirely when no menu screen
// is visible and respects prefers-reduced-motion (static frame).

import { buildGeoData } from './map.js';

const d3 = window.d3;

let canvas = null, ctx = null, features = null, projection = null, geoPath = null;
let running = false, raf = null, lambda = -20, lastT = 0;
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.id = 'bg-globe';
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', () => { if (canvas.style.display !== 'none') fit(); });
}

function fit() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  const w = window.innerWidth, h = window.innerHeight;
  const r = Math.max(w, h) * 0.52;
  projection = d3.geoOrthographic()
    .translate([w * 0.72, h * 0.42])
    .scale(r)
    .clipAngle(90);
  geoPath = d3.geoPath(projection, ctx);
}

function draw() {
  const w = window.innerWidth, h = window.innerHeight;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  projection.rotate([lambda, -18]);
  // Ocean disc.
  ctx.beginPath();
  geoPath({ type: 'Sphere' });
  ctx.fillStyle = '#dde8ee';
  ctx.fill();
  // Land, single muted tone.
  ctx.beginPath();
  for (const f of features) geoPath(f);
  ctx.fillStyle = '#c3d2db';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function loop(t) {
  if (!running) return;
  if (t - lastT > 40) { // ~25fps is plenty for a background
    lambda += (t - lastT) * 0.004; // ~4 deg/s
    lastT = t;
    draw();
  }
  raf = requestAnimationFrame(loop);
}

export function start(world) {
  if (!features) {
    features = buildGeoData(world).features;
  }
  ensureCanvas();
  canvas.style.display = '';
  fit();
  if (REDUCED) { draw(); return; }
  if (!running) {
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

export function stop() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (canvas) canvas.style.display = 'none';
}
