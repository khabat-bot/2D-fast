// Minimal circular touch button. Owns a circle visual and a manual
// point-in-circle hit test. Manual (not setInteractive) because touch
// controls already route raw pointer events; adding Phaser's input
// dispatch on top would mean two event paths for the same tap.
const DEFAULT_DEPTH = 1000;

export class Button {
  constructor(scene, opts) {
    if (!Number.isFinite(opts.x) || !Number.isFinite(opts.y) || !Number.isFinite(opts.radius)) {
      throw new Error('Button: x, y and radius are required');
    }
    this.x = opts.x;
    this.y = opts.y;
    this.radius = opts.radius;
    this.color = opts.color ?? 0xffffff;
    this.alpha = opts.alpha ?? 0.2;
    this.pressedAlpha = opts.pressedAlpha ?? 0.5;
    this.circle = scene.add
      .circle(this.x, this.y, this.radius, this.color, this.alpha)
      .setDepth(opts.depth ?? DEFAULT_DEPTH);
  }

  contains(pointer) {
    const dx = pointer.x - this.x;
    const dy = pointer.y - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  setPressed(pressed) {
    this.circle.setFillStyle(this.color, pressed ? this.pressedAlpha : this.alpha);
  }

  destroy() {
    this.circle.destroy();
  }
}
