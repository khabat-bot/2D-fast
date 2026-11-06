// Movement + jump controls. Two movement modes, chosen by settings and
// passed in via opts:
//
//   'joystick' — floating stick on left half, appears under the finger
//   'buttons'  — two fixed circles at bottom-left, left and right
//
// Both modes have a fixed jump button at bottom-right, tracked with its own
// pointer ID so it never fights the movement input.
//
// Outputs:
//   outputX, outputY  [-1, 1] each frame (joystick gives both; buttons Y=0)
//   jumpHeld          boolean, current jump button state
//
// Press/release edges are computed by the caller (GameScene) from jumpHeld
// deltas each frame - that keeps edge state where it is consumed.
import { Button } from '../ui/Button.js';

const CONTROL_DEPTH = 1000;

export class TouchControls {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.mode = opts.mode ?? 'joystick';
    this.outputX = 0;
    this.outputY = 0;

    // Jump button is shared between modes.
    this.jumpButton = new Button(scene, {
      x: scene.scale.width - (opts.jumpButtonXFromRight ?? 50),
      y: scene.scale.height - (opts.jumpButtonYFromBottom ?? 45),
      radius: opts.jumpButtonRadius ?? 32,
      depth: CONTROL_DEPTH
    });
    this.jumpPointerId = null;

    // eslint-disable-next-line no-console
    console.log('[TouchControls] mode:', this.mode);

    if (this.mode === 'joystick') {
      this.initJoystick(opts);
    } else if (this.mode === 'buttons') {
      this.initButtons(opts);
    } else {
      throw new Error(`TouchControls: unknown mode "${this.mode}"`);
    }

    this._fixedButtons = [];

    this.onDown = this.handleDown.bind(this);
    this.onMove = this.handleMove.bind(this);
    this.onUp   = this.handleUp.bind(this);

    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.on('pointerupoutside', this.onUp);
  }

  // --- joystick mode ------------------------------------------------------

  initJoystick(opts) {
    this.radius      = opts.radius ?? 28;
    this.stickRadius = opts.stickRadius ?? 14;
    this.deadzone    = opts.deadzone ?? 0.15;
    this.joystickZoneWidthFrac   = opts.joystickZoneWidthFrac   ?? 0.5;
    this.joystickZoneYStartFrac  = opts.joystickZoneYStartFrac  ?? 0.5;
    this.activePointerId = null;
    this.baseX = 0;
    this.baseY = 0;
    this.baseCircle = this.scene.add
      .circle(0, 0, this.radius, 0xffffff, 0.12)
      .setDepth(CONTROL_DEPTH).setVisible(false);
    this.stickCircle = this.scene.add
      .circle(0, 0, this.stickRadius, 0xffffff, 0.35)
      .setDepth(CONTROL_DEPTH + 1).setVisible(false);
  }

  handleJoystickDown(pointer) {
    if (this.activePointerId !== null) return;
    // Spawn only in the bottom-left 1/3 x 1/3 of the screen. The rest
    // of the screen (including the top-left) is available for aim and
    // future buttons.
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    if (pointer.x >= w * this.joystickZoneWidthFrac) return;
    if (pointer.y <  h * this.joystickZoneYStartFrac) return;
    this.activePointerId = pointer.id;
    this.baseX = pointer.x;
    this.baseY = pointer.y;
    this.baseCircle.setPosition(this.baseX, this.baseY).setVisible(true);
    this.stickCircle.setPosition(this.baseX, this.baseY).setVisible(true);
    this.outputX = 0;
    this.outputY = 0;
  }

  handleJoystickMove(pointer) {
    if (pointer.id !== this.activePointerId) return;
    const dx = pointer.x - this.baseX;
    const dy = pointer.y - this.baseY;
    const len = Math.hypot(dx, dy);
    const max = this.radius;
    const scale = len > max ? max / len : 1;
    const sx = dx * scale;
    const sy = dy * scale;
    this.stickCircle.setPosition(this.baseX + sx, this.baseY + sy);
    let nx = sx / max;
    let ny = sy / max;
    if (Math.hypot(nx, ny) < this.deadzone) { nx = 0; ny = 0; }
    this.outputX = nx;
    this.outputY = ny;
  }

  handleJoystickUp(pointer) {
    if (pointer.id !== this.activePointerId) return;
    this.activePointerId = null;
    this.outputX = 0;
    this.outputY = 0;
    this.baseCircle.setVisible(false);
    this.stickCircle.setVisible(false);
  }

  // --- buttons mode -------------------------------------------------------

  initButtons(opts) {
    const height = this.scene.scale.height;
    const r  = opts.buttonRadius ?? 28;
    const lx = opts.buttonLeftX ?? 50;
    const rx = opts.buttonRightX ?? 120;
    const yb = opts.buttonYFromBottom ?? 50;
    const y  = height - yb;

    this.buttonLeft  = new Button(this.scene, { x: lx, y, radius: r, depth: CONTROL_DEPTH });
    this.buttonRight = new Button(this.scene, { x: rx, y, radius: r, depth: CONTROL_DEPTH });
    this.leftPointerId  = null;
    this.rightPointerId = null;
  }

  handleButtonsDown(pointer) {
    if (this.leftPointerId === null && this.buttonLeft.contains(pointer)) {
      this.leftPointerId = pointer.id;
      this.buttonLeft.setPressed(true);
    } else if (this.rightPointerId === null && this.buttonRight.contains(pointer)) {
      this.rightPointerId = pointer.id;
      this.buttonRight.setPressed(true);
    }
    this.recomputeButtonOutput();
  }

  handleButtonsUp(pointer) {
    let changed = false;
    if (pointer.id === this.leftPointerId) {
      this.leftPointerId = null;
      this.buttonLeft.setPressed(false);
      changed = true;
    }
    if (pointer.id === this.rightPointerId) {
      this.rightPointerId = null;
      this.buttonRight.setPressed(false);
      changed = true;
    }
    if (changed) this.recomputeButtonOutput();
  }

  recomputeButtonOutput() {
    const left  = this.leftPointerId  !== null ? -1 : 0;
    const right = this.rightPointerId !== null ?  1 : 0;
    this.outputX = left + right;
    this.outputY = 0;
  }

  // --- jump button (both modes) ------------------------------------------

  handleJumpDown(pointer) {
    if (this.jumpPointerId !== null) return;
    if (!this.jumpButton.contains(pointer)) return false;
    this.jumpPointerId = pointer.id;
    this.jumpButton.setPressed(true);
    return true;
  }

  handleJumpUp(pointer) {
    if (pointer.id !== this.jumpPointerId) return false;
    this.jumpPointerId = null;
    this.jumpButton.setPressed(false);
    return true;
  }

  get jumpHeld() {
    return this.jumpPointerId !== null;
  }

  // Lets AimController (and any future control system) check whether a
  // pointer has already been claimed by a fixed button before it tries
  // to use it. Add new fixed buttons here.
  // External systems (GameScene, AimController) can register extra
  // fixed buttons so isPointerClaimed recognises them and aim
  // does not steal their taps.
  registerFixedButton(button) {
    this._fixedButtons.push(button);
  }

  isPointerClaimed(pointer) {
    // Jump button claims its pointer in every mode.
    if (pointer.id === this.jumpPointerId) return true;
    // Any registered fixed button claims its taps.
    for (const b of this._fixedButtons) {
      if (b.contains(pointer)) return true;
    }
    // In joystick mode, the entire spawn zone is reserved even before
    // the joystick starts. A tap there is for the joystick, not for aim.
    if (this.mode === 'joystick') {
      const w = this.scene.scale.width;
      const h = this.scene.scale.height;
      if (pointer.x < w * this.joystickZoneWidthFrac &&
          pointer.y > h * this.joystickZoneYStartFrac) return true;
    } else if (this.mode === 'buttons') {
      // In buttons mode, the L and R circles are claimed. Taps in the
      // gap between them are NOT claimed and can be used for aim.
      if (this.buttonLeft.contains(pointer)) return true;
      if (this.buttonRight.contains(pointer)) return true;
    }
    return false;
  }

  // --- dispatch -----------------------------------------------------------

  handleDown(pointer) {
    // Jump button has priority in both modes: it lives on the right half
    // where joystick never goes, and outside the L/R circles in buttons mode.
    if (this.handleJumpDown(pointer)) return;
    if (this.mode === 'joystick') this.handleJoystickDown(pointer);
    else                          this.handleButtonsDown(pointer);
  }

  handleMove(pointer) {
    if (this.mode === 'joystick') this.handleJoystickMove(pointer);
  }

  handleUp(pointer) {
    this.handleJumpUp(pointer);
    if (this.mode === 'joystick') this.handleJoystickUp(pointer);
    else                          this.handleButtonsUp(pointer);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    this.jumpButton.destroy();
    if (this.mode === 'joystick') {
      this.baseCircle.destroy();
      this.stickCircle.destroy();
    } else {
      this.buttonLeft.destroy();
      this.buttonRight.destroy();
    }
  }
}
