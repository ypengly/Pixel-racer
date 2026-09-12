// ============================================================
// INPUT.JS - InputManager
// Normalizes keyboard + on-screen touch buttons into a single
// state object the rest of the game reads from every frame.
// ============================================================
class InputManager {
  constructor() {
    this.keys = new Set();
    this.touch = { up: false, down: false, left: false, right: false, nitro: false };
    this.menu = { up: false, down: false, left: false, right: false, confirm: false, back: false };

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    this._bindTouchButtons();
  }

  _onKey(e, isDown) {
    const code = e.code;
    const trackedRace = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
    const trackedMenu = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
    if (trackedRace.includes(code) || trackedMenu.includes(code)) e.preventDefault();

    if (isDown) this.keys.add(code); else this.keys.delete(code);

    // Menu commands are edge-triggered. Ignore browser key-repeat events so
    // holding a key cannot skip several entries before the next game frame.
    if (isDown && !e.repeat) {
      if (code === 'ArrowUp') this.menu.up = true;
      if (code === 'ArrowDown') this.menu.down = true;
      if (code === 'ArrowLeft') this.menu.left = true;
      if (code === 'ArrowRight') this.menu.right = true;
      if (code === 'Enter') this.menu.confirm = true;
      if (code === 'Escape') this.menu.back = true;
    }
  }

  _bindTouchButtons() {
    const map = [
      ['btn-left', 'left'], ['btn-right', 'right'],
      ['btn-accel', 'up'], ['btn-brake', 'down'], ['btn-nitro', 'nitro'],
    ];
    for (const [id, key] of map) {
      const el = document.getElementById(id);
      if (!el) continue;
      const press = (e) => { e.preventDefault(); this.touch[key] = true; };
      const release = (e) => { e.preventDefault(); this.touch[key] = false; };
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
    }
  }

  // ---- race controls ----
  get throttle() { return (this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.touch.up) ? 1 : 0; }
  get brake() { return (this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.touch.down) ? 1 : 0; }
  get steer() {
    let s = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left) s -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right) s += 1;
    return s;
  }
  get nitroHeld() { return this.keys.has('Space') || this.touch.nitro; }

  // ---- menu controls (edge-triggered, call consumeMenu() after reading) ----
  consumeMenu() {
    const m = { ...this.menu };
    this.menu.up = this.menu.down = this.menu.left = this.menu.right = this.menu.confirm = this.menu.back = false;
    return m;
  }
}
