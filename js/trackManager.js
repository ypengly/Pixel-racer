// ============================================================
// TRACKMANAGER.JS
// Owns the 5 built track objects and the unlock/progression
// state (persisted through SaveManager).
// ============================================================
class TrackManager {
  constructor() {
    this.tracks = TRACK_FACTORIES.map((f) => f());
    // Resume from the furthest campaign track unlocked in a past session.
    this.selectedIndex = this.tracks.reduce((latest, _track, index) =>
      SaveManager.isTrackUnlocked(index) ? index : latest, 0);
  }

  count() { return this.tracks.length; }
  getTrack(i) { return this.tracks[i]; }

  isUnlocked(i) { return SaveManager.isTrackUnlocked(i); }

  unlockNext(i) {
    if (i + 1 < this.tracks.length) SaveManager.unlockTrack(i + 1);
  }

  listForMenu() {
    return this.tracks.map((t, i) => ({
      index: i, name: t.name, subtitle: t.subtitle, locked: !this.isUnlocked(i),
    }));
  }
}
