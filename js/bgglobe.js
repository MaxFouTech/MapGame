// Slowly rotating decorative globe rendered on a canvas behind the menu
// screens. Uses the real country colors, attenuated by a light veil.
// Can "morph" into the in-game globe when a session starts in 3D mode.
// Pauses entirely when no menu screen is visible; honors
// prefers-reduced-motion (static frame, no morph).

import { buildGeoData, computeColors } from './map.js';
import { PLAYABLE } from './countries.js';

const d3 = window.d3;

let canvas = null, ctx = null, features = null, colors = null;
let projection = null, geoPath = null;
let running = false, raf = null, lambda = -20, lastT = 0;
let morphArmed = false;
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
  ctx.fillStyle = '#d5e2ea';
  ctx.fill();
  // Countries in their real colors…
  for (const f of features) {
    ctx.beginPath();
    geoPath(f);
    ctx.fillStyle = colors.get(f.properties.name) || '#c3d2db';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  // …attenuated by a light veil so the background stays quiet.
  ctx.beginPath();
  geoPath({ type: 'Sphere' });
  ctx.fillStyle = 'rgba(238, 243, 246, .45)';
  ctx.fill();
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
    const geo = buildGeoData(world);
    features = geo.features;
    colors = computeColors(geo.features, geo.neighbors, new Set(PLAYABLE));
  }
  ensureCanvas();
  canvas.classList.remove('morphing');
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
  if (morphArmed) return; // a morph will take over and hide the canvas
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (canvas) canvas.style.display = 'none';
}

export function getRotation() {
  return [lambda, -18];
}

// Freeze the canvas through the next stop() call so playMorph can animate it.
export function armMorph() {
  morphArmed = !REDUCED && !!canvas && canvas.style.display !== 'none';
  return morphArmed;
}

// Animate the background globe into the in-game globe position, then hide.
export function playMorph(done) {
  if (!morphArmed || !canvas) { morphArmed = false; done?.(); return; }
  morphArmed = false;
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  const w = window.innerWidth, h = window.innerHeight;
  const gameScale = (Math.min(w, h) / 2 - 10) / (Math.max(w, h) * 0.52);
  canvas.style.setProperty('--mx', `${w / 2 - w * 0.72}px`);
  canvas.style.setProperty('--my', `${h / 2 - h * 0.42}px`);
  canvas.style.setProperty('--ms', gameScale);
  canvas.classList.add('morphing');
  canvas.addEventListener('animationend', () => {
    canvas.classList.remove('morphing');
    canvas.style.removeProperty('--mx');
    canvas.style.removeProperty('--my');
    canvas.style.removeProperty('--ms');
    canvas.style.display = 'none';
    done?.();
  }, { once: true });
}
