// ============================================================
// UIMANAGER.JS
// Every DOM overlay screen the game shows (menus, HUD, results,
// initials entry) lives here. Game.js only calls into this - it
// never touches the DOM directly.
// ============================================================
class UIManager {
  constructor(audio) {
    this.audio = audio;
    this.screen = 'menu'; // menu | tracks | garage | highscores | howto | results | initials | (none while racing)
    this.sel = { menu: 0, tracks: 0, garage: 0, highscores: 0, howto: 0, results: 0 };
    this.menuItems = { menu: [], tracks: [], garage: [], highscores: [], howto: [], results: [] };

    this.els = {};
    ['screen-menu', 'screen-tracks', 'screen-garage', 'screen-highscores', 'screen-howto',
      'screen-results', 'screen-initials', 'hud', 'countdown'].forEach((id) => {
      this.els[id] = document.getElementById(id);
    });

    this.initials = { chars: [0, 0, 0], activeIndex: 0 };
    this._onInitialsDone = null;

    document.getElementById('sound-toggle').addEventListener('click', () => {
      const on = this.audio.toggle();
      document.getElementById('sound-toggle').classList.toggle('muted', !on);
      this.audio.menuSelect();
    });
    if (!this.audio.enabled) document.getElementById('sound-toggle').classList.add('muted');
  }

  // ---------- generic screen switching ----------
  _hideAll() {
    ['screen-menu', 'screen-tracks', 'screen-garage', 'screen-highscores', 'screen-howto', 'screen-results', 'screen-initials']
      .forEach((id) => this.els[id].classList.add('hidden'));
  }

  showMenu(callbacks) {
    this._hideAll();
    this.screen = 'menu';
    this.menuItems.menu = [
      { label: 'PLAY NOW', onSelect: callbacks.onStartRace },
      { label: 'GARAGE', onSelect: callbacks.onGarage },
      { label: 'HIGH SCORES', onSelect: callbacks.onHighScores },
      { label: 'HOW TO PLAY', onSelect: callbacks.onHowTo },
    ];
    this.sel.menu = 0;
    this._renderMenu('menu-main', this.menuItems.menu, this.sel.menu);
    this.els['screen-menu'].classList.remove('hidden');
  }

  showTracks(trackManager, onPick, onBack) {
    this._hideAll();
    this.screen = 'tracks';
    const list = trackManager.listForMenu().map((t) => ({
      label: t.name, locked: t.locked,
      onSelect: () => { if (!t.locked) onPick(t.index); },
    }));
    list.push({ label: 'BACK', onSelect: onBack });
    this.menuItems.tracks = list;
    this.sel.tracks = 0;
    this._renderMenu('menu-tracks', list, this.sel.tracks);
    this.els['screen-tracks'].classList.remove('hidden');
  }

  showGarage(onBack) {
    this._hideAll();
    this.screen = 'garage';
    const selectedCar = SaveManager.getSelectedCar();
    const list = CAR_DEFS.map((c, i) => ({
      label: c.label + (i === selectedCar ? ' (IN USE)' : ''),
      locked: !SaveManager.isCarUnlocked(i),
      onSelect: () => {
        if (!SaveManager.isCarUnlocked(i)) return;
        SaveManager.setSelectedCar(i);
        this.showGarage(onBack);
      },
    }));
    list.push({ label: 'BACK', onSelect: onBack });
    this.menuItems.garage = list;
    this.sel.garage = Math.min(selectedCar, list.length - 1);
    this._renderMenu('menu-garage', list, this.sel.garage);
    this._renderGarageStats(this.sel.garage);
    this.els['screen-garage'].classList.remove('hidden');
  }

  _renderGarageStats(idx) {
    const panel = document.getElementById('garage-stats');
    const def = CAR_DEFS[idx];
    if (!def) { panel.innerHTML = ''; return; }
    const locked = !SaveManager.isCarUnlocked(idx);
    const rows = [['SPEED', def.stats.speed], ['ACCEL', def.stats.accel], ['HANDLING', def.stats.handling], ['NITRO', def.stats.nitro]];
    panel.innerHTML = rows.map(([label, v]) => `
      <div class="stat-row">
        <span class="stat-label">${label}</span>
        <span class="stat-bar"><span class="stat-fill" style="width:${v * 10}%"></span></span>
      </div>`).join('') + (locked ? `<div class="stat-row">WIN ${def.unlockWins} RACE${def.unlockWins > 1 ? 'S' : ''} TO UNLOCK</div>` : '');
  }

  showHighScores(onBack) {
    this._hideAll();
    this.screen = 'highscores';
    const scores = SaveManager.getHighScores();
    const table = document.getElementById('highscore-table');
    table.innerHTML = scores.map((s, i) => `<tr${s.justAdded ? ' class="you"' : ''}><td>${i + 1}. ${s.initials}</td><td>${fmtScore(s.score)}</td></tr>`).join('');
    const list = [{ label: 'BACK', onSelect: onBack }];
    this.menuItems.highscores = list;
    this.sel.highscores = 0;
    this._renderMenu('menu-highscores', list, 0);
    this.els['screen-highscores'].classList.remove('hidden');
  }

  showHowTo(onBack) {
    this._hideAll();
    this.screen = 'howto';
    const list = [{ label: 'BACK', onSelect: onBack }];
    this.menuItems.howto = list;
    this.sel.howto = 0;
    this._renderMenu('menu-howto', list, 0);
    this.els['screen-howto'].classList.remove('hidden');
  }

  showResults(breakdown, place, unlocked, onContinue, onRetry) {
    this._hideAll();
    this.screen = 'results';
    document.getElementById('result-place').textContent =
      place === 1 ? '1ST PLACE!' : `${place}${ScoreManager._suffix(place)} PLACE`;
    document.getElementById('result-lines').innerHTML = breakdown.lines
      .map((l) => `<div class="line"><span>${l.label}</span><span>+${l.value}</span></div>`).join('');
    document.getElementById('result-total').textContent = 'TOTAL ' + fmtScore(breakdown.total);
    document.getElementById('result-unlock').classList.toggle('hidden', !unlocked);

    const list = [
      { label: 'RACE AGAIN', onSelect: onRetry },
      { label: 'MAIN MENU', onSelect: onContinue },
    ];
    this.menuItems.results = list;
    this.sel.results = 0;
    this._renderMenu('menu-results', list, 0);
    this.els['screen-results'].classList.remove('hidden');
  }

  showInitialsEntry(score, onDone) {
    this._hideAll();
    this.screen = 'initials';
    this.initials = { chars: [0, 0, 0], activeIndex: 0 };
    this._onInitialsDone = onDone;
    document.getElementById('initials-score').textContent = fmtScore(score);
    this._renderInitials();
    this.els['screen-initials'].classList.remove('hidden');
  }

  _renderInitials() {
    const spans = document.querySelectorAll('.initial-char');
    spans.forEach((el, i) => {
      el.textContent = String.fromCharCode(65 + this.initials.chars[i]);
      el.classList.toggle('active', i === this.initials.activeIndex);
    });
  }

  // ---------- HUD ----------
  showHUD() {
    // A race can be started from the menu, a track picker, or a retry. Clear
    // whichever screen is currently open so it cannot sit on top of gameplay.
    this._hideAll();
    this.els.hud.classList.remove('hidden');
    this.screen = 'race';
  }
  hideHUD() { this.els.hud.classList.add('hidden'); }

  updateHUD(playerCar, raceManager, score) {
    document.getElementById('hud-score').textContent = 'SCORE: ' + fmtScore(score);
    document.getElementById('hud-time').textContent = fmtTime(raceManager.raceTime);
    document.getElementById('hud-lap').textContent = `LAP ${Math.min(playerCar.lapCount + 1, CONFIG.LAPS_PER_RACE)}/${CONFIG.LAPS_PER_RACE}`;
    document.getElementById('hud-pos').textContent = `POS ${raceManager.playerPosition()}/${raceManager.allCars.length}`;
    const pct = clamp(playerCar.nitro / playerCar.stats.nitroCapacity, 0, 1) * 100;
    document.getElementById('hud-nitro-fill').style.width = pct + '%';
  }

  showCountdown(step) {
    this.els.countdown.classList.remove('hidden');
    const t = document.getElementById('countdown-text');
    t.textContent = step > 0 ? String(step) : 'GO!';
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = 'pop 0.3s ease-out';
  }
  hideCountdown() { this.els.countdown.classList.add('hidden'); }

  // ---------- input handling for whichever menu screen is active ----------
  handleMenuInput(input) {
    if (this.screen === 'initials') { this._handleInitialsInput(input); return; }
    const m = input.consumeMenu();
    const items = this.menuItems[this.screen];
    if (!items || !items.length) return;
    if (m.back) {
      // Every non-root menu ends with BACK. Keep Escape consistent with the
      // documented controls without making it unexpectedly exit the game.
      const backItem = items[items.length - 1];
      if (backItem && backItem.label === 'BACK') {
        this.audio.menuSelect();
        backItem.onSelect && backItem.onSelect();
        return;
      }
    }
    let idx = this.sel[this.screen] || 0;
    let moved = false;
    if (m.down) { idx = (idx + 1) % items.length; moved = true; }
    if (m.up) { idx = (idx - 1 + items.length) % items.length; moved = true; }
    if (moved) {
      this.sel[this.screen] = idx;
      this._highlightMenu(this._ulIdFor(this.screen), idx);
      if (this.screen === 'garage') this._renderGarageStats(idx);
      this.audio.menuMove();
    }
    if (m.confirm) {
      const item = items[idx];
      if (item.locked) { this.audio.collision(); } else { this.audio.menuSelect(); item.onSelect && item.onSelect(); }
    }
  }

  _handleInitialsInput(input) {
    const m = input.consumeMenu();
    if (m.up) { this.initials.chars[this.initials.activeIndex] = (this.initials.chars[this.initials.activeIndex] + 1) % 26; this._renderInitials(); this.audio.menuMove(); }
    if (m.down) { this.initials.chars[this.initials.activeIndex] = (this.initials.chars[this.initials.activeIndex] + 25) % 26; this._renderInitials(); this.audio.menuMove(); }
    if (m.left) { this.initials.activeIndex = (this.initials.activeIndex + 2) % 3; this._renderInitials(); }
    if (m.right) { this.initials.activeIndex = (this.initials.activeIndex + 1) % 3; this._renderInitials(); }
    if (m.confirm) {
      const initials = this.initials.chars.map((c) => String.fromCharCode(65 + c)).join('');
      this.audio.menuSelect();
      this._onInitialsDone && this._onInitialsDone(initials);
    }
  }

  _ulIdFor(screen) {
    return { menu: 'menu-main', tracks: 'menu-tracks', garage: 'menu-garage', highscores: 'menu-highscores', howto: 'menu-howto', results: 'menu-results' }[screen];
  }

  _renderMenu(ulId, items, selectedIndex) {
    const ul = document.getElementById(ulId);
    ul.innerHTML = items.map((it, i) => `<li data-i="${i}" class="${i === selectedIndex ? 'selected' : ''}${it.locked ? ' locked' : ''}">${it.label}${it.locked ? '<span class="lock">&#128274;</span>' : ''}</li>`).join('');
    Array.from(ul.children).forEach((li, i) => {
      li.addEventListener('click', () => {
        this.sel[this.screen] = i;
        this._highlightMenu(ulId, i);
        const item = items[i];
        if (item.locked) { this.audio.collision(); return; }
        this.audio.menuSelect();
        if (this.screen === 'garage') this._renderGarageStats(i);
        item.onSelect && item.onSelect();
      });
    });
  }

  _highlightMenu(ulId, idx) {
    const ul = document.getElementById(ulId);
    Array.from(ul.children).forEach((li, i) => li.classList.toggle('selected', i === idx));
  }
}
