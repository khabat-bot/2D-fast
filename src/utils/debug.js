// Debug overlay: FPS counter shown when enabled.
// Toggle: triple-tap the "v0.0.1" chip within 600 ms, or press F.
// State persists in localStorage so it survives reloads.
const STORAGE_KEY = 'debug.fps';
const TAP_WINDOW_MS = 600;
const TAPS_REQUIRED = 3;
const SAMPLE_MS = 500;

export function initDebugOverlay(game) {
  const versionEl = document.getElementById('debug-version');
  const fpsEl = document.getElementById('debug-fps');
  if (!versionEl || !fpsEl) return;

  let enabled = false;
  try { enabled = localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* private mode */ }

  const apply = () => {
    fpsEl.style.display = enabled ? 'block' : 'none';
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
  };
  apply();

  const toggle = () => { enabled = !enabled; apply(); };

  let taps = 0;
  let lastTapAt = 0;
  let lastProcessedAt = 0;

  // iOS Safari fires double-tap-to-zoom on text even when an
  // ancestor has touch-action: none, unless preventDefault runs on
  // touchstart. Without this, taps 1+2 of the triple-tap gesture
  // zoom the page before tap 3 can register.
  const recordTap = () => {
    const now = performance.now();
    // Dedupe when both touchstart and pointerdown fire for one tap.
    if (now - lastProcessedAt < 30) return;
    lastProcessedAt = now;
    taps = (now - lastTapAt) <= TAP_WINDOW_MS ? taps + 1 : 1;
    lastTapAt = now;
    if (taps >= TAPS_REQUIRED) { taps = 0; toggle(); }
  };

  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

  if (hasTouch) {
    versionEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      recordTap();
    }, { passive: false });
  }

  versionEl.addEventListener('pointerdown', (e) => {
    // Stop the tap from reaching the Phaser canvas behind the chip.
    e.stopPropagation();
    // Touch already handled by touchstart above; only process
    // this event on mouse/pen so taps are not double-counted.
    if (e.pointerType === 'touch' && hasTouch) return;
    recordTap();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') toggle();
  });

  // Phaser exposes its measured FPS on game.loop.actualFps — more accurate
  // than a parallel rAF counter because it reflects the game's real loop.
  setInterval(() => {
    if (!enabled) return;
    const fps = game.loop.actualFps;
    fpsEl.textContent = `${fps.toFixed(0)} fps`;
  }, SAMPLE_MS);
}
