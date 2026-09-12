// ============================================================
// PARTICLESYSTEM.JS
// A single flat array of particles, all drawn as tiny squares
// to keep the pixel-art look. update()/draw() are cheap so we
// can afford a few hundred live particles at once.
// ============================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, opts = {}) {
    this.particles.push({
      x, y,
      vx: opts.vx || 0,
      vy: opts.vy || 0,
      life: opts.life || 0.5,
      maxLife: opts.life || 0.5,
      size: opts.size || 2,
      color: opts.color || '#ffffff',
      gravity: opts.gravity || 0,
      fade: opts.fade !== false,
    });
  }

  smoke(x, y, dir) {
    for (let i = 0; i < 2; i++) {
      const a = dir + (Math.random() - 0.5) * 1.2;
      const spd = 8 + Math.random() * 10;
      this.spawn(x, y, {
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.4 + Math.random() * 0.3, size: 2 + Math.random() * 2,
        color: '#9aa08c',
      });
    }
  }

  exhaust(x, y, dir) {
    for (let i = 0; i < 3; i++) {
      const a = dir + Math.PI + (Math.random() - 0.5) * 0.6;
      const spd = 40 + Math.random() * 40;
      this.spawn(x, y, {
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.25 + Math.random() * 0.2, size: 2 + Math.random() * 2,
        color: Math.random() > 0.5 ? '#5ec6ff' : '#ffdd55',
      });
    }
  }

  sparks(x, y) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 60;
      this.spawn(x, y, {
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.2 + Math.random() * 0.25, size: 2,
        color: '#ffdd55',
      });
    }
  }

  dust(x, y) {
    for (let i = 0; i < 2; i++) {
      this.spawn(x, y, {
        vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
        life: 0.3, size: 2, color: '#c9b98a',
      });
    }
  }

  confetti(x, y) {
    const palette = ['#ff5a5a', '#5ec6ff', '#ffdd55', '#7CFC7C', '#ff9f43'];
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const spd = 40 + Math.random() * 60;
      this.spawn(x, y, {
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 0.6 + Math.random() * 0.4, size: 2 + Math.random() * 2,
        color: palette[(Math.random() * palette.length) | 0],
        gravity: 60,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    // hard cap so a chaotic race can never tank the framerate
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  draw(ctx) {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = p.fade ? clamp(t, 0, 1) : 1;
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }
}
