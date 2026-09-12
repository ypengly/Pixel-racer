// ============================================================
// SCOREMANAGER.JS
// ============================================================
const ScoreManager = {
  PLACE_POINTS: [5000, 3000, 2000, 1000, 500],

  compute({ place, laps, coins, timeSeconds, nitroRemainingPct, overtakes }) {
    const placePoints = this.PLACE_POINTS[place - 1] || 0;
    const lapBonus = laps * 1000;
    const coinPoints = coins * 150;
    const timeBonus = Math.max(0, Math.round((180 - timeSeconds) * 8));
    const nitroBonus = Math.round(clamp(nitroRemainingPct, 0, 1) * 800);
    const overtakePoints = overtakes * 120;
    const total = placePoints + lapBonus + coinPoints + timeBonus + nitroBonus + overtakePoints;
    return {
      lines: [
        { label: place === 1 ? '1ST PLACE' : `${place}${this._suffix(place)} PLACE`, value: placePoints },
        { label: 'LAP BONUS', value: lapBonus },
        { label: 'COINS', value: coinPoints },
        { label: 'TIME BONUS', value: timeBonus },
        { label: 'NITRO BONUS', value: nitroBonus },
        { label: 'OVERTAKES', value: overtakePoints },
      ],
      total,
    };
  },

  _suffix(n) {
    if (n === 1) return 'ST'; if (n === 2) return 'ND'; if (n === 3) return 'RD'; return 'TH';
  },
};
