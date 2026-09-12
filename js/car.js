// ============================================================
// CAR.JS - base Car class
// Lightweight arcade physics: velocity is blended toward the
// car's forward direction by a "grip" factor each frame, which
// is what produces drifting on ice/oil with very little code.
// ============================================================
const SURFACE_MULT = { road: 1, grass: 0.8, sand: 0.52, snow: 0.85 };

class Car {
  constructor(stats, color, x, y, angle) {
    this.stats = stats; // {maxSpeed, accel, brake, turnRate, nitroCapacity}
    this.color = color;
    this.x = x; this.y = y; this.angle = angle;
    this.vx = 0; this.vy = 0; this.speed = 0;

    this.nitro = stats.nitroCapacity * 0.5;
    this.nitroActive = false;

    this.lapCount = 0;
    this.progress = 0;        // fractional progress 0..1 around current lap
    this.trackIndexHint = 0;
    this.finished = false;
    this.finishTime = 0;

    this.shieldTimer = 0;
    this.slideTimer = 0;
    this.collisionCooldown = 0;
    this.onRoad = true;
    this.surface = 'road';

    this.coins = 0;
    this.overtakes = 0;
    this._totalProgress = 0; // lap + fraction, monotonic-ish, used for standings
  }

  get totalProgress() { return this.lapCount + this.progress; }

  applyControls(dt, throttle, brake, steer, nitroHeld, track) {
    const st = this.stats;

    // -- surface lookup --
    const idx = findNearestIndex(track.centerline, this.x, this.y, this.trackIndexHint);
    this.trackIndexHint = idx;
    const cp = track.centerline[idx];
    const distFromCenter = dist(this.x, this.y, cp.x, cp.y);
    const halfW = track.roadWidth / 2;
    this.onRoad = distFromCenter <= halfW;
    this.surface = this.onRoad ? 'road' : track.offSurface;
    const surfaceMult = SURFACE_MULT[this.surface] ?? 0.8;

    // -- nitro --
    this.nitroActive = nitroHeld && this.nitro > 1;
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - 42 * dt);
    else this.nitro = Math.min(st.nitroCapacity, this.nitro + 3 * dt);
    const nitroMult = this.nitroActive ? 1.4 : 1;

    const maxSpeed = st.maxSpeed * surfaceMult * nitroMult * track.grip;

    // -- throttle / brake --
    if (throttle > 0) {
      this.speed += st.accel * (this.nitroActive ? 1.6 : 1) * dt;
    } else if (brake > 0) {
      if (this.speed > 4) this.speed -= st.brake * dt;
      else this.speed -= st.accel * 0.6 * dt;
    } else {
      // engine braking / rolling friction
      if (this.speed > 0) this.speed = Math.max(0, this.speed - st.accel * 0.5 * dt);
      else this.speed = Math.min(0, this.speed + st.accel * 0.5 * dt);
    }
    this.speed = clamp(this.speed, -maxSpeed * 0.45, maxSpeed);

    // -- steering (needs some speed to bite, arcade-style) --
    const speedFactor = clamp(Math.abs(this.speed) / 60, 0, 1);
    const dir = this.speed >= 0 ? 1 : -1;
    this.angle += steer * st.turnRate * dt * speedFactor * dir;

    // -- grip / drift blending --
    let grip = track.grip * (this.onRoad ? 1 : 0.85);
    if (this.slideTimer > 0) { grip *= 0.18; this.slideTimer -= dt; }
    grip = clamp(grip, 0.05, 1);
    const blend = 1 - Math.pow(1 - grip, dt * 60); // frame-rate independent lerp factor

    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const desiredVx = fx * this.speed, desiredVy = fy * this.speed;
    this.vx = lerp(this.vx, desiredVx, blend);
    this.vy = lerp(this.vy, desiredVy, blend);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // -- progress tracking --
    const n = track.centerline.length;
    const newIdx = findNearestIndex(track.centerline, this.x, this.y, this.trackIndexHint);
    const prevFrac = this.progress;
    this.progress = newIdx / n;
    // wrap detection: crossing from near end (progress~1) to near start (progress~0)
    if (prevFrac > 0.85 && this.progress < 0.15) {
      this.lapCount += 1;
      this._justLapped = true;
    } else {
      this._justLapped = false;
    }
    this.trackIndexHint = newIdx;

    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.collisionCooldown > 0) this.collisionCooldown -= dt;
  }

  hasShield() { return this.shieldTimer > 0; }
  grantShield(seconds = 8) { this.shieldTimer = seconds; }
  grantSlide(seconds = 0.9) { this.slideTimer = Math.max(this.slideTimer, seconds); }

  bounceOffBarrier(nx, ny) {
    // reflect velocity a little and lose speed on hitting a wall
    const dot = this.vx * nx + this.vy * ny;
    this.vx -= 2 * dot * nx;
    this.vy -= 2 * dot * ny;
    this.speed *= 0.35;
    this.vx *= 0.4; this.vy *= 0.4;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const L = CONFIG.CAR_LENGTH, W = CONFIG.CAR_WIDTH;
    // outline
    ctx.fillStyle = '#111111';
    ctx.fillRect(-L / 2 - 1, -W / 2 - 1, L + 2, W + 2);
    // body
    ctx.fillStyle = this.color;
    ctx.fillRect(-L / 2, -W / 2, L, W);
    // windshield
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(L / 2 - 5, -W / 2 + 1, 3, W - 2);
    // shield glow
    if (this.hasShield()) {
      ctx.strokeStyle = 'rgba(120,200,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6);
    }
    ctx.restore();
  }
}
