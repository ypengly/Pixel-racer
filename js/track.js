// ============================================================
// TRACK.JS
// A track is a closed loop described by a dense "centerline"
// point array. Everything else (barrier edges, progress along
// the lap, off-road detection) is derived from that one array,
// which keeps every other system track-shape agnostic.
// ============================================================

// subdivide a polygon (sharp corners, straight edges) into a dense point loop
function buildPolygonCenterline(corners, samplesPerEdge) {
  const pts = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i], b = corners[(i + 1) % n];
    for (let s = 0; s < samplesPerEdge; s++) {
      const t = s / samplesPerEdge;
      pts.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
    }
  }
  return pts;
}

// smooth closed Catmull-Rom spline through control points (sweeping curves)
function buildSplineCenterline(controls, samplesPerSegment) {
  const pts = [];
  const n = controls.length;
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
  for (let i = 0; i < n; i++) {
    const p0 = controls[(i - 1 + n) % n], p1 = controls[i], p2 = controls[(i + 1) % n], p3 = controls[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      pts.push({
        x: cr(p0.x, p1.x, p2.x, p3.x, t),
        y: cr(p0.y, p1.y, p2.y, p3.y, t),
      });
    }
  }
  return pts;
}

// derive left/right barrier polylines from a centerline + half width
function computeEdges(centerline, halfWidth) {
  const n = centerline.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const prev = centerline[(i - 1 + n) % n];
    const next = centerline[(i + 1) % n];
    let tx = next.x - prev.x, ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const nx = -ty, ny = tx; // left-hand normal
    left.push({ x: centerline[i].x + nx * halfWidth, y: centerline[i].y + ny * halfWidth });
    right.push({ x: centerline[i].x - nx * halfWidth, y: centerline[i].y - ny * halfWidth });
  }
  return { left, right };
}

// place a prop at centerline index i, offset laterally by `lat` * halfWidth (-1..1)
function placeAlong(centerline, halfWidth, i, lat) {
  const n = centerline.length;
  const prev = centerline[(i - 1 + n) % n];
  const next = centerline[(i + 1) % n];
  let tx = next.x - prev.x, ty = next.y - prev.y;
  const len = Math.hypot(tx, ty) || 1;
  tx /= len; ty /= len;
  const nx = -ty, ny = tx;
  const p = centerline[i % n];
  return { x: p.x + nx * halfWidth * lat, y: p.y + ny * halfWidth * lat };
}

const SAMPLES_PER_SEG = 14;

// ---- Track 1: Beginner oval -------------------------------------------
function makeTrack1() {
  const rx = 340, ry = 230;
  const controls = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    controls.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
  }
  const centerline = buildSplineCenterline(controls, SAMPLES_PER_SEG);
  // A generous opening track leaves room to learn the controls.
  const roadWidth = 82;
  const edges = computeEdges(centerline, roadWidth / 2);
  const rng = makeRng(1);
  const obstacles = [];
  const powerups = [];
  const idxs = [30, 70, 110, 150, 190];
  idxs.forEach((i, k) => {
    if (k % 2 === 0) obstacles.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 1.2), type: 'cone', radius: 6 });
    else powerups.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 1.0), type: ['nitro', 'coin', 'coin'][k % 3], radius: 8, alive: true, respawn: 0 });
  });
  return {
    name: 'BEGINNER OVAL', subtitle: 'Learn the basics', roadWidth, night: false,
    offSurface: 'grass', grip: 1, bg: '#4f9b65', roadColor: '#536270', offColor: '#6bc878',
    centerline, edges, obstacles, powerups, startIndex: 0, laneSign: 1,
  };
}

// ---- Track 2: City (sharp corners, narrow roads) -----------------------
function makeTrack2() {
  const corners = [
    { x: -260, y: -180 }, { x: 60, y: -180 }, { x: 60, y: -60 }, { x: 260, y: -60 },
    { x: 260, y: 60 }, { x: 100, y: 60 }, { x: 100, y: 200 }, { x: -140, y: 200 },
    { x: -140, y: 40 }, { x: -260, y: 40 },
  ];
  const centerline = buildPolygonCenterline(corners, 16);
  const roadWidth = 46;
  const edges = computeEdges(centerline, roadWidth / 2);
  const rng = makeRng(2);
  const obstacles = [];
  const powerups = [];
  const idxs = [20, 55, 90, 120, 150];
  idxs.forEach((i, k) => {
    if (k % 2 === 0) obstacles.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 1.1), type: 'tire', radius: 6 });
    else powerups.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 0.9), type: ['shield', 'nitro', 'coin'][k % 3], radius: 8, alive: true, respawn: 0 });
  });
  return {
    name: 'CITY RUSH', subtitle: 'Sharp corners ahead', roadWidth, night: false,
    offSurface: 'grass', grip: 1, bg: '#46566c', roadColor: '#687588', offColor: '#5e7085',
    centerline, edges, obstacles, powerups, startIndex: 0, laneSign: 1,
  };
}

// ---- Track 3: Desert (sand + obstacles) --------------------------------
function makeTrack3() {
  const controls = [
    { x: -300, y: -60 }, { x: -180, y: -220 }, { x: 40, y: -260 }, { x: 260, y: -140 },
    { x: 300, y: 40 }, { x: 160, y: 200 }, { x: -60, y: 240 }, { x: -260, y: 120 },
  ];
  const centerline = buildSplineCenterline(controls, SAMPLES_PER_SEG);
  const roadWidth = 58;
  const edges = computeEdges(centerline, roadWidth / 2);
  const rng = makeRng(3);
  const obstacles = [];
  const powerups = [];
  const idxs = [15, 40, 65, 90, 115, 140];
  idxs.forEach((i, k) => {
    if (k % 3 !== 1) obstacles.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 1.3), type: k % 2 === 0 ? 'rock' : 'oil', radius: k % 2 === 0 ? 7 : 10 });
    else powerups.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 0.9), type: ['nitro', 'repair', 'coin'][k % 3], radius: 8, alive: true, respawn: 0 });
  });
  return {
    name: 'DESERT DUNES', subtitle: 'Sand slows you down', roadWidth, night: false,
    offSurface: 'sand', grip: 1, bg: '#b88447', roadColor: '#82755c', offColor: '#e0bd6d',
    centerline, edges, obstacles, powerups, startIndex: 0, laneSign: 1,
  };
}

// ---- Track 4: Snow (slippery) ------------------------------------------
function makeTrack4() {
  const controls = [
    { x: -280, y: 0 }, { x: -180, y: -200 }, { x: 0, y: -120 }, { x: 180, y: -220 },
    { x: 300, y: -20 }, { x: 180, y: 160 }, { x: 20, y: 100 }, { x: -160, y: 220 }, { x: -300, y: 120 },
  ];
  const centerline = buildSplineCenterline(controls, SAMPLES_PER_SEG);
  const roadWidth = 54;
  const edges = computeEdges(centerline, roadWidth / 2);
  const rng = makeRng(4);
  const obstacles = [];
  const powerups = [];
  const idxs = [20, 50, 80, 110, 140, 170];
  idxs.forEach((i, k) => {
    if (k % 2 === 0) obstacles.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 1.2), type: 'barrel', radius: 7 });
    else powerups.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 0.9), type: ['nitro', 'shield', 'coin'][k % 3], radius: 8, alive: true, respawn: 0 });
  });
  return {
    name: 'SNOW PASS', subtitle: 'Watch the ice', roadWidth, night: false,
    offSurface: 'snow', grip: 0.72, bg: '#9bbbd2', roadColor: '#e4edf5', offColor: '#f5faff',
    centerline, edges, obstacles, powerups, startIndex: 0, laneSign: 1,
  };
}

// ---- Track 5: Night circuit (dark, tight corners) ----------------------
function makeTrack5() {
  const controls = [
    { x: -200, y: -140 }, { x: -20, y: -200 }, { x: 140, y: -160 }, { x: 200, y: -30 },
    { x: 100, y: 40 }, { x: 190, y: 130 }, { x: 40, y: 200 }, { x: -120, y: 150 },
    { x: -100, y: 30 }, { x: -220, y: 40 },
  ];
  const centerline = buildSplineCenterline(controls, SAMPLES_PER_SEG);
  const roadWidth = 44;
  const edges = computeEdges(centerline, roadWidth / 2);
  const rng = makeRng(5);
  const obstacles = [];
  const powerups = [];
  const idxs = [15, 35, 55, 75, 95, 115, 135];
  idxs.forEach((i, k) => {
    if (k % 2 === 0) obstacles.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 1.1), type: 'cone', radius: 6 });
    else powerups.push({ ...placeAlong(centerline, roadWidth / 2, i, (rng() - 0.5) * 0.9), type: ['nitro', 'shield', 'repair', 'coin'][k % 4], radius: 8, alive: true, respawn: 0 });
  });
  return {
    name: 'NIGHT CIRCUIT', subtitle: 'Tight & dark', roadWidth, night: true,
    offSurface: 'grass', grip: 1, bg: '#0b0e1a', roadColor: '#3a3a46', offColor: '#131826',
    centerline, edges, obstacles, powerups, startIndex: 0, laneSign: 1,
  };
}

const TRACK_FACTORIES = [makeTrack1, makeTrack2, makeTrack3, makeTrack4, makeTrack5];

// Find the index of the centerline point closest to (x, y).
// Searches a small window around `hint` when given (cheap, cars barely
// move between frames) and falls back to a full scan otherwise.
function findNearestIndex(centerline, x, y, hint = -1, window = 18) {
  const n = centerline.length;
  let best = -1, bestD = Infinity;
  if (hint >= 0) {
    for (let d = -window; d <= window; d++) {
      const i = ((hint + d) % n + n) % n;
      const p = centerline[i];
      const dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  }
  for (let i = 0; i < n; i++) {
    const p = centerline[i];
    const dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (dd < bestD) { bestD = dd; best = i; }
  }
  return best;
}
