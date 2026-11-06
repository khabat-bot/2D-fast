// Minimal circular touch button. Owns a circle visual, an optional label,
// and a manual point-in-circle hit test. Manual (not setInteractive)
// because touch controls already route raw pointer events; adding Phaser's
// input dispatch on top would mean two event paths for the same tap.
//
// setPressed() applies a fill alpha change AND a small scale tween so the
// button feels tactile when tapped. The hit test always uses this.radius;
// the visual shrinks but the touch target does not.
import { pixelText } from '../utils/text.js';

const DEFAULT_DEPTH = 1000;
const PRESSED_SCALE = 0.92;
const PRESS_DOWN_MS = 60;
const PRESS_UP_MS   = 100;

export class Button {
  constructor(scene, opts) {
    if (!Number.isFinite(opts.x) || !Number.isFinite(opts.y) || !Number.isFinite(opts.radius)) {
      throw new Error('Button: x, y and radius are required');
    }
    this.scene = scene;
    this.x = opts.x;
    this.y = opts.y;
    this.radius = opts.radius;
    this.color = opts.color ?? 0xffffff;
    this.alpha = opts.alpha ?? 0.2;
    this.pressedAlpha = opts.pressedAlpha ?? 0.5;
    const depth = opts.depth ?? DEFAULT_DEPTH;

    this.circle = scene.add
      .circle(this.x, this.y, this.radius, this.color, this.alpha)
      .setDepth(depth);

    this.label = null;
    if (opts.label) {
      this.label = pixelText(scene, this.x, this.y, opts.label, {
        size: 16,
        color: opts.labelColor ?? '#ffffff',
        origin: [0.5, 0.5]
      }).setDepth(depth + 1);
    }
  }

  contains(pointer) {
    const dx = pointer.x - this.x;
    const dy = pointer.y - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  setPressed(pressed) {
    this.circle.setFillStyle(this.color, pressed ? this.pressedAlpha : this.alpha);
    const target = pressed ? PRESSED_SCALE : 1.0;
    const duration = pressed ? PRESS_DOWN_MS : PRESS_UP_MS;
    this.scene.tweens.add({
      targets: this.circle,
      scale: target,
      duration,
      ease: 'Quad.easeOut'
    });
    if (this.label) {
      this.scene.tweens.add({
        targets: this.label,
        scale: target,
        duration,
        ease: 'Quad.easeOut'
      });
    }
  }

  destroy() {
    this.circle.destroy();
    if (this.label) this.label.destroy();
  }
}
