// Aim controls. Three modes, chosen by settings and passed in via opts:
//
//   'aimAndShoot' — right-half drag stick, fires while held (mode 1)
//   'aimStick'    — right-half drag stick aims, separate fire button fires (mode 2)
//   'tapToShoot'  — AIM AT FINGER: crosshair at finger; aim direction is
//                   player-to-finger, recomputed every frame. Fire behavior
//                   from dragFireMode: 'onRelease' (one shot on release) or
//                   'continuous' (fire while finger is down with valid aim).
//                   Historical name 'tapToShoot' — this used to be tap-then-
//                   drag-from-base, but that felt like a joystick. Now it is
//                   "point at your finger".
//
// Aim is stored as a unit vector (aimX, aimY), NOT a screen position. Mode 3
// recomputes that vector from finger-pos - player-pos each frame while the
// finger is down. This means:
//   - finger moves -> aim follows finger
//   - player moves -> aim rotates to keep pointing at finger
//   - finger released -> aim vector preserved from last valid computation
//
// Visuals differ per mode so the interaction is unmistakable:
//   modes 1/2: yellow base circle + inner stick dot (joystick style)
//   mode 3:    hollow ring + center dot at the finger (crosshair)
//
// Outputs (read by GameScene):
//   hasAim         true once an aim direction has been computed
//   getAim(px,py)  unit vector {x, y} of current aim direction. Needs
//                  player position for mode 3; ignored in modes 1/2.
//   consumeFire()  true on the frame firing should be visible
//   firePulse      bumped on each fire edge (rising edge of consumeFire),
//                  so GameScene can spawn one flash per fire, not per frame
import { Button } from '../ui/Button.js';

const CONTROL_DEPTH = 1000;
// Below this distance from the player, mode 3 aim is ambiguous (finger
// basically on top of player). Preserve the last known direction instead.
const MIN_AIM_DIST_FROM_PLAYER = 8;

export class AimController {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.mode = opts.mode ?? 'aimAndShoot';
    this.dragFireMode = opts.dragFireMode ?? 'onRelease';
    this.touchControls = opts.touchControls;

    // Stored aim direction (unit vector, in a sense - scaled or not, getAim
    // normalises on output). Preserved after release in all modes.
    this.aimX = 1;
    this.aimY = 0;
    this.hasAim = false;

    this.fireHeld = false;
    this.fireLatch = false;
    this.firePulse = 0;
    this._prevConsumedFire = false;

    // Shared config.
    this.aimStickRadius = opts.aimStickRadius ?? 28;
    this.aimStickStickRadius = opts.aimStickStickRadius ?? 14;
    this.deadzone = opts.deadzone ?? 0.15;
    this.aimPointerId = null;

    // For mode 3: track finger position, not a base point.
    this.fingerX = 0;
    this.fingerY = 0;

    if (this.mode === 'tapToShoot') {
      // Crosshair: hollow ring + center dot at the finger.
      this.tapRing = scene.add.circle(0, 0, 12, 0xffeb3b, 0)
        .setStrokeStyle(2, 0xffeb3b, 1)
        .setDepth(CONTROL_DEPTH)
        .setVisible(false).setScrollFactor(0);
      this.tapDot = scene.add.circle(0, 0, 3, 0xffeb3b, 1)
        .setDepth(CONTROL_DEPTH + 1)
        .setVisible(false).setScrollFactor(0);
    } else {
      this.aimBaseX = 0;
      this.aimBaseY = 0;
      this.dragCurrentlyActive = false;
      this.baseCircle = scene.add
        .circle(0, 0, this.aimStickRadius, 0xffeb3b, 0.12)
        .setDepth(CONTROL_DEPTH).setVisible(false).setScrollFactor(0);
      this.stickCircle = scene.add
        .circle(0, 0, this.aimStickStickRadius, 0xffeb3b, 0.35)
        .setDepth(CONTROL_DEPTH + 1).setVisible(false).setScrollFactor(0);
    }

    if (this.mode === 'aimStick') {
      this.fireButton = new Button(scene, {
        x: opts.fireButtonX ?? (scene.scale.width - 50),
        y: opts.fireButtonY ?? (scene.scale.height - 105),
        radius: opts.fireButtonRadius ?? 24,
        depth: CONTROL_DEPTH,
        label: 'F'
      });
      this.firePointerId = null;
    }

    this.onDown = this.handleDown.bind(this);
    this.onMove = this.handleMove.bind(this);
    this.onUp   = this.handleUp.bind(this);
    scene.input.on('pointerdown', this.onDown);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.on('pointerupoutside', this.onUp);

    // eslint-disable-next-line no-console
    console.log('[AimController v2] mode:', this.mode,
                'dragFireMode:', this.dragFireMode);
  }

  handleDown(pointer) {
    // TouchControls registers first; if it claimed the pointer, leave it.
    if (this.touchControls && this.touchControls.isPointerClaimed(pointer)) return;

    // Fire button (mode 2) — before the aim logic, since it's also on the
    // right half.
    if (this.mode === 'aimStick' && this.firePointerId === null &&
        this.fireButton.contains(pointer)) {
      this.firePointerId = pointer.id;
      this.fireButton.setPressed(true);
      this.fireHeld = true;
      return;
    }

    // Modes 1 and 2 restrict aim to the right half (aim stick). Mode 3
    // (tapToShoot) does not restrict by screen half - it accepts anywhere
    // that is not claimed by TouchControls (jump button, joystick zone,
    // L/R buttons). That is the whole point of 'aim at my finger'.
    if (this.mode !== 'tapToShoot' && pointer.x < this.scene.scale.width / 2) return;
    if (this.aimPointerId !== null) return;
    this.aimPointerId = pointer.id;

    if (this.mode === 'tapToShoot') {
      // Aim-at-finger: just remember where the finger is. getAim() will
      // compute the aim direction from finger to player each frame.
      this.fingerX = pointer.x;
      this.fingerY = pointer.y;
      this.tapRing.setPosition(this.fingerX, this.fingerY).setVisible(true);
      this.tapDot.setPosition(this.fingerX, this.fingerY).setVisible(true);
      // Fire state is set by getAim (continuous mode) or handleUp (onRelease).
    } else {
      // Modes 1/2: joystick style.
      this.aimBaseX = pointer.x;
      this.aimBaseY = pointer.y;
      this.baseCircle.setPosition(this.aimBaseX, this.aimBaseY).setVisible(true);
      this.stickCircle.setPosition(this.aimBaseX, this.aimBaseY).setVisible(true);
      this.dragCurrentlyActive = false;
      if (this.mode === 'aimAndShoot') this.fireHeld = true;
    }
  }

  handleMove(pointer) {
    if (pointer.id !== this.aimPointerId) return;

    if (this.mode === 'tapToShoot') {
      // Finger position updates only. Aim recomputed in getAim(px, py).
      this.fingerX = pointer.x;
      this.fingerY = pointer.y;
      this.tapRing.setPosition(this.fingerX, this.fingerY);
      this.tapDot.setPosition(this.fingerX, this.fingerY);
      return;
    }

    // Modes 1/2: joystick drag.
    const dx = pointer.x - this.aimBaseX;
    const dy = pointer.y - this.aimBaseY;
    const len = Math.hypot(dx, dy);
    const max = this.aimStickRadius;
    const scale = len > max ? max / len : 1;
    this.stickCircle.setPosition(
      this.aimBaseX + dx * scale,
      this.aimBaseY + dy * scale
    );
    const nx = dx / this.aimStickRadius;
    const ny = dy / this.aimStickRadius;
    const mag = Math.hypot(nx, ny);
    this.dragCurrentlyActive = mag >= this.deadzone;
    if (this.dragCurrentlyActive) {
      this.aimX = nx;
      this.aimY = ny;
      this.hasAim = true;
    }
  }

  handleUp(pointer) {
    if (this.mode === 'aimStick' && pointer.id === this.firePointerId) {
      this.firePointerId = null;
      this.fireButton.setPressed(false);
      this.fireHeld = false;
    }

    if (pointer.id !== this.aimPointerId) return;
    this.aimPointerId = null;

    if (this.mode === 'tapToShoot') {
      this.tapRing.setVisible(false);
      this.tapDot.setVisible(false);
      if (this.dragFireMode === 'onRelease') this.fireLatch = true;
      this.fireHeld = false;
    } else {
      this.baseCircle.setVisible(false);
      this.stickCircle.setVisible(false);
      if (this.mode === 'aimAndShoot') this.fireHeld = false;
    }
  }

  // For mode 3, needs the player position to compute player -> finger.
  // Modes 1/2 ignore the arguments and return the stored stick direction.
  getAim(playerX, playerY) {
    if (this.mode === 'tapToShoot' && this.aimPointerId !== null) {
      const dx = this.fingerX - playerX;
      const dy = this.fingerY - playerY;
      const len = Math.hypot(dx, dy);
      const valid = len >= MIN_AIM_DIST_FROM_PLAYER;
      if (valid) {
        this.aimX = dx / len;
        this.aimY = dy / len;
        this.hasAim = true;
      }
      // Continuous mode: fire only while aim is valid. Prevents firing in
      // a stale direction when the finger is on top of the player.
      if (this.dragFireMode === 'continuous') {
        this.fireHeld = valid;
      }
    }
    const len = Math.hypot(this.aimX, this.aimY);
    if (len < 0.001) return { x: 1, y: 0 };
    return { x: this.aimX / len, y: this.aimY / len };
  }

  consumeFire() {
    let fire = false;
    if (this.fireLatch) {
      this.fireLatch = false;
      fire = true;
    } else {
      fire = this.fireHeld;
    }
    if (fire && !this._prevConsumedFire) this.firePulse++;
    this._prevConsumedFire = fire;
    return fire;
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
    if (this.mode === 'tapToShoot') {
      this.tapRing.destroy();
      this.tapDot.destroy();
    } else {
      this.baseCircle.destroy();
      this.stickCircle.destroy();
    }
    if (this.mode === 'aimStick') {
      this.fireButton.destroy();
    }
  }
}
