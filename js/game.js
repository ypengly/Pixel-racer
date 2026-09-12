// ============================================================
// GAME.JS
// Top-level orchestrator: owns the canvas render loop and the
// screen state machine (menu screens <-> an active race).
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.trackManager = new TrackManager();
    this.audio = new AudioManager();
    this.ui = new UIManager(this.audio);
    this.input = new InputManager();
    this.particles = new ParticleSystem();

    this.state = 'MENU';
    this.raceManager = null;
    this.currentTrackIndex = 0;

    this.camera = { x: 0, y: 0 };
    this.shake = { time: 0, mag: 0 };
    this._lastCountdownStep = null;
    this._t = 0;

    this._toMenu = this._toMenu.bind(this);
    this._toMenu();

    this._last = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  // ---------------- screen transitions ----------------
  _toMenu() {
    this.state = 'MENU';
    this.ui.showMenu({
      // Start immediately. Tracks advance as the player wins, so a separate
      // selection screen is unnecessary before every race.
      onStartRace: () => this._startRace(this.trackManager.selectedIndex),
      onGarage: () => this._toGarage(),
      onHighScores: () => this._toHighScores(),
      onHowTo: () => this._toHowTo(),
    });
  }
  _toTracks() {
    this.state = 'TRACKS';
    this.ui.showTracks(this.trackManager, (idx) => this._startRace(idx), this._toMenu);
  }
  _toGarage() { this.state = 'GARAGE'; this.ui.showGarage(this._toMenu); }
  _toHighScores() { this.state = 'HIGHSCORES'; this.ui.showHighScores(this._toMenu); }
  _toHowTo() { this.state = 'HOWTO'; this.ui.showHowTo(this._toMenu); }

  _startRace(trackIndex) {
    this.audio.unlock();
    this.currentTrackIndex = trackIndex;
    const track = this.trackManager.getTrack(trackIndex);
    const carIdx = SaveManager.getSelectedCar();
    this.raceManager = new RaceManager(track, carIdx);
    this.particles = new ParticleSystem();
    this.camera.x = this.raceManager.playerCar.x;
    this.camera.y = this.raceManager.playerCar.y;
    this._lastCountdownStep = null;
    this.state = 'RACE';
    this.ui.showHUD();
    // Render the first countdown value immediately; waiting for the first
    // timer tick previously made the visible sequence begin at "2".
    this._lastCountdownStep = this.raceManager.countdownStep;
    this.ui.showCountdown(this._lastCountdownStep);
  }

  _onFinish(stats) {
    const breakdown = ScoreManager.compute(stats);
    let unlockedNew = false;
    if (stats.place === 1) {
      this.trackManager.unlockNext(this.currentTrackIndex);
      if (this.currentTrackIndex + 1 < this.trackManager.count()) {
        this.trackManager.selectedIndex = this.currentTrackIndex + 1;
      }
      const wins = SaveManager.addWin();
      const idx = CAR_DEFS.findIndex((c) => c.unlockWins === wins && !SaveManager.isCarUnlocked(CAR_DEFS.indexOf(c)));
      if (idx >= 0) { SaveManager.unlockCar(idx); unlockedNew = true; }
      this.audio.victory();
    } else {
      this.audio.gameOver();
    }
    this.ui.hideHUD();
    this._lastBreakdown = breakdown;
    this._lastPlace = stats.place;
    this._lastUnlocked = unlockedNew;

    if (SaveManager.qualifiesForHighScore(breakdown.total)) {
      this.state = 'INITIALS';
      this.ui.showInitialsEntry(breakdown.total, (initials) => {
        SaveManager.addHighScore(initials, breakdown.total);
        this._toResults();
      });
    } else {
      this._toResults();
    }
  }

  _toResults() {
    this.state = 'RESULTS';
    this.ui.showResults(this._lastBreakdown, this._lastPlace, this._lastUnlocked, this._toMenu, () => this._startRace(this.currentTrackIndex));
  }

  // ---------------- main loop ----------------
  _loop(now) {
    let dt = (now - this._last) / 1000;
    this._last = now;
    dt = clamp(dt, 0, CONFIG.MAX_STEP);
    this._t += dt;

    this._update(dt);
    this._render();

    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    if (this.state === 'RACE') {
      const rm = this.raceManager;
      if (rm.state === 'COUNTDOWN' && rm.countdownStep !== this._lastCountdownStep) {
        this._lastCountdownStep = rm.countdownStep;
        if (rm.countdownStep >= 0) this.ui.showCountdown(rm.countdownStep);
        else this.ui.hideCountdown();
      }
      rm.update(dt, this.input, this.particles, this.audio, {
        onShake: (mag) => { this.shake.time = 0.22; this.shake.mag = mag * 6; },
        onFinish: (stats) => this._onFinish(stats),
      });
      // RaceManager changes state immediately after the GO! beat. Hide the
      // countdown in that same frame so it never obscures the race.
      if (rm.state !== 'COUNTDOWN' && this._lastCountdownStep !== null) {
        this.ui.hideCountdown();
        this._lastCountdownStep = null;
      }
      this.particles.update(dt);
      if (this.shake.time > 0) this.shake.time -= dt;

      if (rm.state === 'RACING') {
        const liveScore = rm.playerCar.coins * 150 + rm.playerCar.lapCount * 1000 + rm.playerCar.overtakes * 120;
        this.ui.updateHUD(rm.playerCar, rm, liveScore);
      }

      const p = rm.playerCar;
      const followT = 1 - Math.pow(0.001, dt);
      this.camera.x = lerp(this.camera.x, p.x, followT);
      this.camera.y = lerp(this.camera.y, p.y, followT);
    } else {
      this.ui.handleMenuInput(this.input);
    }
  }

  // ---------------- rendering ----------------
  _render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    if (this.state === 'RACE' && this.raceManager) {
      this._renderRace();
    } else {
      this._renderMenuBg();
    }
  }

  _renderMenuBg() {
    const ctx = this.ctx;
    ctx.fillStyle = '#153f4a';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    // A moving road preview makes the start screen feel like a game rather
    // than an empty dark panel, while leaving the menu readable on top.
    ctx.fillStyle = '#2b5f55';
    ctx.beginPath();
    ctx.moveTo(72, 320); ctx.lineTo(168, 320); ctx.lineTo(144, 0); ctx.lineTo(96, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d7f4e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 320); ctx.lineTo(96, 0);
    ctx.moveTo(168, 320); ctx.lineTo(144, 0);
    ctx.stroke();
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -this._t * 42;
    ctx.strokeStyle = '#ffdf69';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 320); ctx.lineTo(120, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Decorative player car in the road preview.
    ctx.save();
    ctx.translate(120, 248);
    ctx.fillStyle = '#101820'; ctx.fillRect(-10, -7, 20, 14);
    ctx.fillStyle = '#ef5a4e'; ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = '#b8efff'; ctx.fillRect(2, -4, 4, 8);
    ctx.restore();

    ctx.strokeStyle = 'rgba(188, 247, 255, 0.25)';
    ctx.lineWidth = 1;
    const spacing = 20;
    const offset = (this._t * 14) % spacing;
    for (let y = -spacing; y < CONFIG.VIEW_H + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y + offset);
      ctx.lineTo(CONFIG.VIEW_W, y + offset);
      ctx.stroke();
    }
    for (let x = 0; x < CONFIG.VIEW_W; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CONFIG.VIEW_H);
      ctx.stroke();
    }
  }

  _renderRace() {
    const ctx = this.ctx;
    const rm = this.raceManager;
    const track = rm.track;

    const shakeX = this.shake.time > 0 ? (Math.random() - 0.5) * this.shake.mag : 0;
    const shakeY = this.shake.time > 0 ? (Math.random() - 0.5) * this.shake.mag : 0;

    ctx.fillStyle = track.bg;
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    ctx.save();
    ctx.translate(CONFIG.VIEW_W / 2 - this.camera.x + shakeX, CONFIG.VIEW_H / 2 - this.camera.y + shakeY);

    // off-road terrain fill (big rect behind the road ribbon)
    ctx.fillStyle = track.offColor;
    ctx.fillRect(this.camera.x - 260, this.camera.y - 320, 520, 640);

    // road ribbon
    this._strokePath(ctx, track.centerline, track.roadWidth, track.roadColor);

    // barrier stripes (checkered look via dashed overlay)
    this._drawBarrier(ctx, track.edges.left);
    this._drawBarrier(ctx, track.edges.right);

    // start/finish line
    this._drawStartLine(ctx, track);

    // obstacles + power-ups
    for (const ob of track.obstacles) PowerUp.drawObstacle(ctx, ob);
    for (const pu of track.powerups) if (pu.alive) PowerUp.drawIcon(ctx, pu, this._t);

    // cars (AI first, player drawn last so it stays on top)
    for (const ai of rm.aiCars) ai.draw(ctx);
    rm.playerCar.draw(ctx);

    this.particles.draw(ctx);

    if (track.night) {
      // Keep the night circuit atmospheric, but leave enough road detail to
      // steer and react to obstacles on ordinary displays.
      ctx.fillStyle = 'rgba(3,5,12,0.34)';
      ctx.fillRect(this.camera.x - 260, this.camera.y - 320, 520, 640);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < track.centerline.length; i += 20) {
        const p = track.centerline[i];
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 40);
        g.addColorStop(0, 'rgba(255,221,85,0.30)');
        g.addColorStop(1, 'rgba(255,221,85,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 40, p.y - 40, 80, 80);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  _strokePath(ctx, points, width, color) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  _drawBarrier(ctx, edge) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(edge[0].x, edge[0].y);
    for (let i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#e0473c';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawStartLine(ctx, track) {
    const i = track.startIndex;
    const cl = track.centerline;
    const n = cl.length;
    const a = cl[(i - 1 + n) % n], b = cl[(i + 1) % n];
    let tx = b.x - a.x, ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    const nx = -ty, ny = tx;
    const hw = track.roadWidth / 2;
    const p = cl[i];
    const squares = 8;
    for (let s = 0; s < squares; s++) {
      const t0 = -hw + (s / squares) * hw * 2;
      const t1 = -hw + ((s + 1) / squares) * hw * 2;
      ctx.fillStyle = s % 2 === 0 ? '#f4f4f4' : '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(p.x + nx * t0 - tx * 2, p.y + ny * t0 - ty * 2);
      ctx.lineTo(p.x + nx * t1 - tx * 2, p.y + ny * t1 - ty * 2);
      ctx.lineTo(p.x + nx * t1 + tx * 2, p.y + ny * t1 + ty * 2);
      ctx.lineTo(p.x + nx * t0 + tx * 2, p.y + ny * t0 + ty * 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}
