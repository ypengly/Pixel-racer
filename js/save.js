// ============================================================
// SAVE.JS - SaveManager
// Centralizes every LocalStorage read/write so the rest of the
// game never touches localStorage directly.
// ============================================================
const SaveManager = {
  KEY: 'pixelRacer_save_v1',

  _defaults() {
    return {
      unlockedTracks: [0],       // indices of tracks the player can play
      unlockedCars: [0],         // indices of cars available in the garage
      selectedCar: 0,
      winCount: 0,
      soundEnabled: true,
      highScores: [
        { initials: 'ACE', score: 12500 },
        { initials: 'MAX', score: 10850 },
        { initials: 'REX', score: 9400 },
        { initials: 'TOM', score: 7200 },
        { initials: 'BEN', score: 5300 },
      ],
    };
  },

  _read() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this._defaults();
      const data = JSON.parse(raw);
      return Object.assign(this._defaults(), data);
    } catch (e) {
      return this._defaults();
    }
  },

  _write(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  },

  getData() { return this._read(); },

  unlockTrack(i) {
    const d = this._read();
    if (!d.unlockedTracks.includes(i)) d.unlockedTracks.push(i);
    this._write(d);
  },
  isTrackUnlocked(i) { return this._read().unlockedTracks.includes(i); },

  unlockCar(i) {
    const d = this._read();
    if (!d.unlockedCars.includes(i)) d.unlockedCars.push(i);
    this._write(d);
  },
  isCarUnlocked(i) { return this._read().unlockedCars.includes(i); },

  getSelectedCar() { return this._read().selectedCar; },
  setSelectedCar(i) { const d = this._read(); d.selectedCar = i; this._write(d); },

  addWin() {
    const d = this._read();
    d.winCount += 1;
    this._write(d);
    return d.winCount;
  },
  getWinCount() { return this._read().winCount; },

  getSoundEnabled() { return this._read().soundEnabled; },
  setSoundEnabled(v) { const d = this._read(); d.soundEnabled = v; this._write(d); },

  getHighScores() { return this._read().highScores.slice().sort((a, b) => b.score - a.score); },

  qualifiesForHighScore(score) {
    const list = this.getHighScores();
    return list.length < 5 || score > list[list.length - 1].score;
  },

  addHighScore(initials, score) {
    const d = this._read();
    d.highScores.push({ initials: initials.slice(0, 3).toUpperCase() || 'YOU', score });
    d.highScores.sort((a, b) => b.score - a.score);
    d.highScores = d.highScores.slice(0, 5);
    this._write(d);
    return d.highScores;
  },

  resetAll() {
    localStorage.removeItem(this.KEY);
  },
};
