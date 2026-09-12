// ============================================================
// COLLISIONMANAGER.JS
// Pure functions that mutate car state on impact. Called once
// per car per frame from RaceManager, after physics integration.
// ============================================================
const CollisionManager = {
  CAR_RADIUS: 6,
  SHOULDER: 15, // extra run-off before a hard wall impact

  resolveTrackBoundary(car, track, onHit) {
    const idx = car.trackIndexHint;
    const cp = track.centerline[idx];
    let dx = car.x - cp.x, dy = car.y - cp.y;
    const d = Math.hypot(dx, dy) || 1;
    const hardLimit = track.roadWidth / 2 + this.SHOULDER;
    if (d > hardLimit) {
      const nx = dx / d, ny = dy / d;
      car.x = cp.x + nx * hardLimit;
      car.y = cp.y + ny * hardLimit;
      if (car.collisionCooldown <= 0) {
        if (!car.hasShield()) {
          car.bounceOffBarrier(nx, ny);
          onHit && onHit(car, cp.x + nx * hardLimit, cp.y + ny * hardLimit);
        } else {
          car.speed *= 0.7;
        }
        car.collisionCooldown = 0.35;
      }
    }
  },

  resolveObstacles(car, track, particles, onHit) {
    for (const ob of track.obstacles) {
      const d = dist(car.x, car.y, ob.x, ob.y);
      const minD = ob.radius + this.CAR_RADIUS;
      if (d < minD) {
        if (ob.type === 'oil') {
          car.grantSlide(0.9);
          if (Math.random() < 0.5) particles.smoke(ob.x, ob.y);
          continue;
        }
        if (car.collisionCooldown <= 0) {
          const nx = (car.x - ob.x) / (d || 1), ny = (car.y - ob.y) / (d || 1);
          car.x = ob.x + nx * minD; car.y = ob.y + ny * minD;
          if (!car.hasShield()) {
            car.speed *= 0.45;
            car.vx *= 0.4; car.vy *= 0.4;
            particles.sparks(ob.x + nx * ob.radius, ob.y + ny * ob.radius);
            onHit && onHit(car);
          } else {
            car.shieldTimer = 0; // shield absorbs one hit
          }
          car.collisionCooldown = 0.35;
        }
      }
    }
  },

  resolveCarCar(cars, particles) {
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        const d = dist(a.x, a.y, b.x, b.y);
        const minD = this.CAR_RADIUS * 2;
        if (d < minD && d > 0.001) {
          const nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
          const overlap = (minD - d) / 2;
          a.x += nx * overlap; a.y += ny * overlap;
          b.x -= nx * overlap; b.y -= ny * overlap;
          const kick = 18;
          a.vx += nx * kick; a.vy += ny * kick;
          b.vx -= nx * kick; b.vy -= ny * kick;
          a.speed *= 0.92; b.speed *= 0.92;
          if (a.collisionCooldown <= 0 && b.collisionCooldown <= 0) {
            particles.dust((a.x + b.x) / 2, (a.y + b.y) / 2);
            a.collisionCooldown = 0.25; b.collisionCooldown = 0.25;
          }
        }
      }
    }
  },

  resolvePowerups(car, track, audio, onCollect) {
    const now = performance.now();
    for (const pu of track.powerups) {
      if (!pu.alive) {
        if (now >= pu.respawn) pu.alive = true; else continue;
      }
      const d = dist(car.x, car.y, pu.x, pu.y);
      if (d < pu.radius + this.CAR_RADIUS) {
        pu.alive = false;
        pu.respawn = now + 9000;
        onCollect && onCollect(car, pu.type);
      }
    }
  },
};
