// ============================================================
// MAIN.JS
// ============================================================
let game;

function resizeGame() {
  const container = document.getElementById('game-container');
  const touchControls = document.getElementById('touch-controls');
  const touchVisible = !touchControls.classList.contains('hidden');
  const reserved = touchVisible ? 120 : 24; // room for on-screen buttons + status bars

  const availW = window.innerWidth - 16;
  const availH = window.innerHeight - reserved;

  const aspect = CONFIG.VIEW_W / CONFIG.VIEW_H;
  let w = availW;
  let h = w / aspect;
  if (h > availH) { h = availH; w = h * aspect; }

  container.style.width = Math.round(w) + 'px';
  container.style.height = Math.round(h) + 'px';

  // establishes the em-scale for every overlay element (see style.css)
  const scale = w / CONFIG.VIEW_W;
  // Overlay elements use CSS pixels rather than the canvas's internal
  // pixels. The previous 4px base made the entire interface microscopic
  // when the canvas was scaled up.
  container.style.fontSize = (scale * 8) + 'px';

  touchControls.style.width = Math.round(w) + 'px';
}

document.addEventListener('DOMContentLoaded', () => {
  game = new Game();
  resizeGame();
  window.addEventListener('resize', resizeGame);
  window.addEventListener('orientationchange', () => setTimeout(resizeGame, 200));

  // Show the on-screen controls whenever a race is active. They support
  // touch and mouse input, so the game is playable without a keyboard.
  const touchControls = document.getElementById('touch-controls');
  let controlsVisible = false;
  setInterval(() => {
    const shouldShow = game.state === 'RACE';
    if (shouldShow === controlsVisible) return;
    controlsVisible = shouldShow;
    touchControls.classList.toggle('hidden', !shouldShow);
    resizeGame();
  }, 200);

  // first user gesture anywhere unlocks WebAudio
  const unlock = () => { game.audio.unlock(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
});
