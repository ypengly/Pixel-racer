// ============================================================
// CONSTANTS.JS - global configuration & tiny math helpers
// ============================================================
const CONFIG = {
  VIEW_W: 240,
  VIEW_H: 320,
  FIXED_DT: 1 / 60,        // physics is stepped at a fixed rate
  MAX_STEP: 1 / 15,        // clamp huge frame gaps (tab switch, etc)
  LAPS_PER_RACE: 3,
  CAR_LENGTH: 12,
  CAR_WIDTH: 8,
  CHECKPOINT_SAMPLES: 260, // how many points we sample each track loop into
};

const COLORS = {
  ui_bg: '#0f1a12',
  ui_fg: '#8fe38f',
  ui_dim: '#356338',
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

// shortest-path angle lerp (radians)
function angleLerp(a, b, t) {
  let diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}
function angleDiff(a, b) {
  return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtScore(n) {
  return String(Math.max(0, Math.round(n))).padStart(6, '0');
}

// simple seeded RNG so track obstacle/powerup layouts are stable
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
