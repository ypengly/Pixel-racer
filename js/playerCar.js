// ============================================================
// PLAYERCAR.JS
// ============================================================
class PlayerCar extends Car {
  constructor(stats, color, x, y, angle) {
    super(stats, color, x, y, angle);
    this.isPlayer = true;
  }

  update(dt, input, track, particles) {
    // Easy-driving assist: keep the car moving unless the player is braking.
    // This lets a new player focus on steering instead of holding a button.
    const throttle = input.throttle || !input.brake ? 1 : 0;
    const brake = input.brake;
    let steer = input.steer;
    const nitroHeld = input.nitroHeld;

    // When no steering key/button is held, gently aim toward the road ahead.
    // Manual input always takes priority, so this is assistance rather than
    // an autopilot.
    if (steer === 0) {
      const n = track.centerline.length;
      const lookAhead = 12;
      const target = track.centerline[(this.trackIndexHint + lookAhead) % n];
      const targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
      steer = clamp(angleDiff(this.angle, targetAngle) * 1.25, -0.55, 0.55);
    }

    const wasOnRoad = this.onRoad;
    this.applyControls(dt, throttle, brake, steer, nitroHeld, track);

    const speedAbs = Math.abs(this.speed);
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const rearX = this.x - fx * CONFIG.CAR_LENGTH / 2;
    const rearY = this.y - fy * CONFIG.CAR_LENGTH / 2;

    if (this.nitroActive && speedAbs > 10) {
      particles.exhaust(rearX, rearY, this.angle);
    }
    if (!this.onRoad && speedAbs > 20 && Math.random() < 0.6) {
      particles.dust(rearX, rearY);
    }
    if (this.slideTimer > 0 && Math.random() < 0.5) {
      particles.smoke(rearX, rearY, this.angle + Math.PI);
    }
  }
}
