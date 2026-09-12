// ============================================================
// AICAR.JS
// The AI does not "think" about the whole track - each frame it
// just steers toward a point on the centerline a little ahead of
// itself, and eases off the throttle when that point curves away
// sharply. Personality only tweaks a handful of multipliers.
// ============================================================
const AI_PERSONALITIES = {
  BALANCED: { speedMult: 1.0, mistakeChance: 0.15, laneChangeRate: 0.6, name: 'Balanced' },
  FAST: { speedMult: 1.12, mistakeChance: 0.22, laneChangeRate: 0.9, name: 'Fast' },
  AGGRESSIVE: { speedMult: 1.05, mistakeChance: 0.28, laneChangeRate: 1.4, name: 'Aggressive' },
  STEADY: { speedMult: 0.92, mistakeChance: 0.05, laneChangeRate: 0.3, name: 'Slow & Steady' },
};

class AICar extends Car {
  constructor(stats, color, x, y, angle, personalityKey) {
    super(stats, color, x, y, angle);
    this.personality = AI_PERSONALITIES[personalityKey] || AI_PERSONALITIES.BALANCED;
    this.laneOffset = 0;
    this.laneTarget = (Math.random() - 0.5) * 0.8;
    this.laneChangeTimer = 1 + Math.random() * 2;
    this.mistakeTimer = 0;
    this.mistakeSteerBias = 0;
  }

  _lookahead(track, steps) {
    const n = track.centerline.length;
    return track.centerline[(this.trackIndexHint + steps) % n];
  }

  _curvatureAhead(track) {
    const n = track.centerline.length;
    const a = track.centerline[this.trackIndexHint % n];
    const b = track.centerline[(this.trackIndexHint + 10) % n];
    const c = track.centerline[(this.trackIndexHint + 20) % n];
    const a1 = Math.atan2(b.y - a.y, b.x - a.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    return Math.abs(angleDiff(a1, a2));
  }

  update(dt, track, particles, otherCars) {
    const p = this.personality;

    // occasionally pick a new lane offset - reads as overtaking / weaving
    this.laneChangeTimer -= dt;
    if (this.laneChangeTimer <= 0) {
      this.laneChangeTimer = (1.2 + Math.random() * 2.2) / p.laneChangeRate;
      this.laneTarget = clamp((Math.random() - 0.5) * 1.6 * p.laneChangeRate, -0.85, 0.85);
    }
    this.laneOffset = lerp(this.laneOffset, this.laneTarget, dt * 1.5);

    // occasional small "mistake" - a brief steering wobble
    this.mistakeTimer -= dt;
    if (this.mistakeTimer <= 0 && Math.random() < p.mistakeChance * dt) {
      this.mistakeTimer = 0.4 + Math.random() * 0.5;
      this.mistakeSteerBias = (Math.random() - 0.5) * 0.9;
    }
    if (this.mistakeTimer <= 0) this.mistakeSteerBias = lerp(this.mistakeSteerBias, 0, dt * 2);

    const lookSteps = clamp(10 + Math.abs(this.speed) * 0.12, 10, 34) | 0;
    const target = this._lookahead(track, lookSteps);
    const laneTarget = placeAlong(track.centerline, track.roadWidth / 2, (this.trackIndexHint + lookSteps) % track.centerline.length, this.laneOffset);

    const toTarget = Math.atan2(laneTarget.y - this.y, laneTarget.x - this.x);
    let steer = clamp(angleDiff(this.angle, toTarget) * 2.2, -1, 1);
    steer += this.mistakeSteerBias;
    steer = clamp(steer, -1, 1);

    const curvature = this._curvatureAhead(track);
    const cautious = clamp(1 - curvature * 1.4, 0.35, 1);
    let throttle = 1;
    let brake = 0;
    const desiredSpeed = this.stats.maxSpeed * p.speedMult * cautious;
    if (this.speed > desiredSpeed) { throttle = 0; brake = 0.5; }

    // light nitro usage on straights when winning is close
    const nitroHeld = curvature < 0.12 && this.nitro > 30 && Math.random() < 0.02;

    this.applyControls(dt, throttle, brake, steer, nitroHeld, track);

    if (!this.onRoad && Math.abs(this.speed) > 20 && Math.random() < 0.4) {
      const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
      particles.dust(this.x - fx * 6, this.y - fy * 6);
    }
  }
}
