// ============================================================
// RACEMANAGER.JS
// Owns a single race from countdown to finish: spawns the grid,
// steps physics + collisions each frame, and tracks standings.
// ============================================================
const CAR_DEFS = [
  { key: 'red', color: '#e2453c', label: 'RED', stats: { speed: 7, accel: 7, handling: 7, nitro: 7 } },
  { key: 'blue', color: '#3d8ee2', label: 'BLUE', stats: { speed: 9, accel: 5, handling: 6, nitro: 6 }, unlockWins: 1 },
  { key: 'green', color: '#4ac26b', label: 'GREEN', stats: { speed: 6, accel: 6, handling: 9, nitro: 6 }, unlockWins: 2 },
  { key: 'yellow', color: '#e8c93c', label: 'YELLOW', stats: { speed: 6, accel: 6, handling: 6, nitro: 9 }, unlockWins: 3 },
];

function statsToPhysics(s) {
  return {
    maxSpeed: 130 + s.speed * 11,
    accel: 70 + s.accel * 11,
    brake: 160 + s.handling * 6,
    turnRate: 2.0 + s.handling * 0.16,
    nitroCapacity: 60 + s.nitro * 6,
  };
}

const AI_ORDER = ['BALANCED', 'FAST', 'AGGRESSIVE', 'STEADY'];
const AI_COLORS = ['#b45cff', '#ff8a3d', '#3ddad0', '#c9c9c9'];

class RaceManager {
  constructor(track, carDefIndex) {
    this.track = track;
    this.state = 'COUNTDOWN';
    this.countdownStep = 3; // 3,2,1,0(GO)
    this.countdownTimer = 0.85;
    this.raceTime = 0;
    this.finishPlace = null;
    this._prevPlayerRank = 1;

    const startIdx = track.startIndex;
    const cl = track.centerline;
    const tangentAt = (i) => {
      const n = cl.length;
      const a = cl[(i - 1 + n) % n], b = cl[(i + 1) % n];
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    const startAngle = tangentAt(startIdx);

    const def = CAR_DEFS[carDefIndex] || CAR_DEFS[0];
    const p0 = placeAlong(cl, track.roadWidth / 2, startIdx, 0.35);
    this.playerCar = new PlayerCar(statsToPhysics(def.stats), def.color, p0.x, p0.y, startAngle);

    this.aiCars = [];
    for (let k = 0; k < 4; k++) {
      const idx = (startIdx - (k + 1) * 7 + cl.length) % cl.length;
      const lane = (k % 2 === 0) ? -0.4 : 0.4;
      const pos = placeAlong(cl, track.roadWidth / 2, idx, lane);
      const personality = AI_ORDER[k % AI_ORDER.length];
      const aiStats = statsToPhysics({ speed: 6 + (k % 4), accel: 6, handling: 6 + (k % 3), nitro: 6 });
      this.aiCars.push(new AICar(aiStats, AI_COLORS[k % AI_COLORS.length], pos.x, pos.y, tangentAt(idx), personality));
    }
    this.allCars = [this.playerCar, ...this.aiCars];
    // seed each car's nearest-point hint with a full search so the
    // windowed search used every frame afterwards starts accurate
    for (const car of this.allCars) {
      car.trackIndexHint = findNearestIndex(track.centerline, car.x, car.y);
      car.progress = car.trackIndexHint / track.centerline.length;
    }
  }

  _standings() {
    return this.allCars.slice().sort((a, b) => b.totalProgress - a.totalProgress);
  }

  playerPosition() {
    const st = this._standings();
    return st.indexOf(this.playerCar) + 1;
  }

  update(dt, input, particles, audio, callbacks = {}) {
    if (this.state === 'COUNTDOWN') {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.countdownStep -= 1;
        this.countdownTimer = 0.85;
        if (this.countdownStep > 0) {
          audio.countdownBeep();
        } else {
          // Start directly after 3–2–1; no GO! overlay is shown.
          audio.countdownGo();
          this.state = 'RACING';
          audio.startEngine();
        }
      }
      return;
    }

    if (this.state !== 'RACING') return;

    this.raceTime += dt;

    this.playerCar.update(dt, input, this.track, particles);
    for (const ai of this.aiCars) ai.update(dt, this.track, particles, this.allCars);

    const onWallHit = (car) => {
      particles.sparks(car.x, car.y);
      if (car.isPlayer) { audio.collision(); callbacks.onShake && callbacks.onShake(0.35); }
    };
    for (const car of this.allCars) {
      CollisionManager.resolveTrackBoundary(car, this.track, onWallHit);
      CollisionManager.resolveObstacles(car, this.track, particles, (c) => {
        if (c.isPlayer) { audio.collision(); callbacks.onShake && callbacks.onShake(0.3); }
      });
      CollisionManager.resolvePowerups(car, this.track, audio, (c, type) => {
        PowerUp.apply(c, type, audio, c.isPlayer);
      });
    }
    CollisionManager.resolveCarCar(this.allCars, particles);

    audio.updateEngine(input.throttle, clamp(Math.abs(this.playerCar.speed) / this.playerCar.stats.maxSpeed, 0, 1));

    if (this.playerCar._justLapped && !this.playerCar.finished) {
      if (this.playerCar.lapCount < CONFIG.LAPS_PER_RACE) audio.lap();
    }

    const rank = this.playerPosition();
    if (rank < this._prevPlayerRank) this.playerCar.overtakes += (this._prevPlayerRank - rank);
    this._prevPlayerRank = rank;

    if (this.playerCar.lapCount >= CONFIG.LAPS_PER_RACE && !this.playerCar.finished) {
      this.playerCar.finished = true;
      this.state = 'FINISHED';
      audio.stopEngine();
      this.finishPlace = this.playerPosition();
      callbacks.onFinish && callbacks.onFinish({
        place: this.finishPlace,
        laps: CONFIG.LAPS_PER_RACE,
        coins: this.playerCar.coins,
        timeSeconds: this.raceTime,
        nitroRemainingPct: this.playerCar.nitro / this.playerCar.stats.nitroCapacity,
        overtakes: this.playerCar.overtakes,
      });
    }
  }
}
