import Phaser from 'phaser';
import { TouchControls } from '../systems/TouchControls.js';
import { AimController } from '../systems/AimController.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { Player } from '../entities/Player.js';
import { Button } from '../ui/Button.js';
import { loadSetting } from '../systems/SettingsStore.js';
import { placeholderFor } from '../utils/placeholders.js';
import { pixelText } from '../utils/text.js';
import { STARTING_WEAPONS } from '../data/weapons.js';
import {
  JOYSTICK_RADIUS, JOYSTICK_STICK_RADIUS, JOYSTICK_DEADZONE,
  JOYSTICK_ZONE_WIDTH_FRAC, JOYSTICK_ZONE_Y_START_FRAC,
  BUTTON_RADIUS, BUTTON_LEFT_X, BUTTON_RIGHT_X, BUTTON_Y_FROM_BOTTOM,
  JUMP_BUTTON_RADIUS, JUMP_BUTTON_X_FROM_RIGHT, JUMP_BUTTON_Y_FROM_BOTTOM,
  AIM_STICK_RADIUS, AIM_STICK_STICK_RADIUS, AIM_STICK_DEADZONE,
  FIRE_BUTTON_RADIUS, FIRE_BUTTON_X_FROM_RIGHT, FIRE_BUTTON_Y_FROM_BOTTOM,
  SWITCH_BUTTON_RADIUS, SWITCH_BUTTON_X_FROM_RIGHT, SWITCH_BUTTON_Y_FROM_TOP,
  SWITCH_BUTTON_COLOR
} from '../config/controlsConfig.js';
import { PLAYER_W, PLAYER_H } from '../config/playerConfig.js';

const AIM_LINE_LENGTH   = 40;
const AIM_COLOR         = 0xffeb3b;
const FIRE_FLASH_MS     = 150;
const FIRE_FLASH_COLOR  = 0xffff33;
const FIRE_FLASH_DEPTH  = 60;
const AIM_BRIGHT_MS     = 150;
const MUZZLE_OFFSET     = PLAYER_W / 2 + 2;
const TARGET_SIZE       = 20;
const MELEE_ARC_MS      = 150;
const MELEE_ARC_COLOR   = 0xffffff;

function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 &&
         Math.abs(ay - by) < (ah + bh) / 2;
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.prevFirePulse = 0;
    this.lastFireAtMs = -10000;
  }

  create() {
    const { width, height } = this.scale;
    const groundY = height - 30;

    this.add.rectangle(width / 2, groundY + 1, width, 2, 0x333333);

    this.player = new Player(this, {
      x: width / 2 - 60,
      y: groundY - PLAYER_H / 2,
      groundY
    });
    this.prevJumpHeld = false;

    this.testTarget = placeholderFor(this, 'testTarget', {
      category: 'enemy',
      width: TARGET_SIZE,
      height: TARGET_SIZE,
      x: width - 60,
      y: groundY - TARGET_SIZE / 2
    });

    this.controls = new TouchControls(this, {
      mode: loadSetting('movementMode'),
      radius: JOYSTICK_RADIUS,
      stickRadius: JOYSTICK_STICK_RADIUS,
      deadzone: JOYSTICK_DEADZONE,
      joystickZoneWidthFrac: JOYSTICK_ZONE_WIDTH_FRAC,
      joystickZoneYStartFrac: JOYSTICK_ZONE_Y_START_FRAC,
      buttonRadius: BUTTON_RADIUS,
      buttonLeftX: BUTTON_LEFT_X,
      buttonRightX: BUTTON_RIGHT_X,
      buttonYFromBottom: BUTTON_Y_FROM_BOTTOM,
      jumpButtonRadius: JUMP_BUTTON_RADIUS,
      jumpButtonXFromRight: JUMP_BUTTON_X_FROM_RIGHT,
      jumpButtonYFromBottom: JUMP_BUTTON_Y_FROM_BOTTOM
    });

    this.aim = new AimController(this, {
      mode: loadSetting('aimMode'),
      dragFireMode: loadSetting('dragFireMode'),
      touchControls: this.controls,
      aimStickRadius: AIM_STICK_RADIUS,
      aimStickStickRadius: AIM_STICK_STICK_RADIUS,
      deadzone: AIM_STICK_DEADZONE,
      fireButtonRadius: FIRE_BUTTON_RADIUS,
      fireButtonX: width - FIRE_BUTTON_X_FROM_RIGHT,
      fireButtonY: height - FIRE_BUTTON_Y_FROM_BOTTOM
    });

    this.weapon = new WeaponSystem(this, STARTING_WEAPONS);

    // Weapon switch button (top-right). Registered with TouchControls so
    // its taps are claimed and aim does not steal them.
    this.switchButton = new Button(this, {
      x: width - SWITCH_BUTTON_X_FROM_RIGHT,
      y: SWITCH_BUTTON_Y_FROM_TOP,
      radius: SWITCH_BUTTON_RADIUS,
      color: SWITCH_BUTTON_COLOR,
      alpha: 0.5,
      pressedAlpha: 0.9,
      depth: 1000
    });
    this.controls.registerFixedButton(this.switchButton);

    this.switchButtonPointerId = null;
    this.input.on('pointerdown', (pointer) => {
      if (this.switchButtonPointerId !== null) return;
      if (!this.switchButton.contains(pointer)) return;
      this.switchButtonPointerId = pointer.id;
      this.switchButton.setPressed(true);
      this.weapon.selectNext();
    });
    this.input.on('pointerup', (pointer) => {
      if (pointer.id !== this.switchButtonPointerId) return;
      this.switchButtonPointerId = null;
      this.switchButton.setPressed(false);
    });
    this.input.on('pointerupoutside', (pointer) => {
      if (pointer.id !== this.switchButtonPointerId) return;
      this.switchButtonPointerId = null;
      this.switchButton.setPressed(false);
    });

    this.aimLine = this.add.graphics().setDepth(50);
    this.readout = pixelText(this, width / 2, 14, '',
      { size: 16, color: '#888888', origin: [0.5, 0.5] });
    pixelText(this, width / 2, height - 14,
      'L:move  R:aim  BTN:jump  TOP-R:switch',
      { size: 16, color: '#666666', origin: [0.5, 0.5] });

    this.prevFirePulse = this.aim.firePulse;
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;

    const jumpHeld = this.controls.jumpHeld;
    const jumpJustPressed  = jumpHeld && !this.prevJumpHeld;
    const jumpJustReleased = !jumpHeld && this.prevJumpHeld;
    this.prevJumpHeld = jumpHeld;

    this.player.update(dt, {
      moveX: this.controls.outputX,
      jumpHeld,
      jumpJustPressed,
      jumpJustReleased
    });

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const aim = this.aim.getAim(px, py);
    const fire = this.aim.consumeFire();
    if (fire) this.lastFireAtMs = time;

    const mx = px + aim.x * MUZZLE_OFFSET;
    const my = py + aim.y * MUZZLE_OFFSET;

    if (fire) {
      const result = this.weapon.tryFire(time, mx, my, aim.x, aim.y);
      if (result.fired) {
        if (result.type === 'melee') {
          this.spawnMeleeArc(px, py, Math.atan2(aim.y, aim.x), result.weapon);
          this.checkMeleeHits(px, py, aim, result.weapon);
        } else {
          this.spawnFireFlash(mx, my, aim);
        }
      }
    }

    this.weapon.update(dt);

    // Projectile vs test target.
    if (this.testTarget && this.testTarget.active) {
      this.weapon.forEachActiveProjectile((p) => {
        if (!p.active) return;
        if (aabbOverlap(
          p.sprite.x, p.sprite.y, p.width, p.height,
          this.testTarget.x, this.testTarget.y, TARGET_SIZE, TARGET_SIZE
        )) {
          p.deactivate();
          this.flashTarget();
        }
      });
    }

    if (this.aim.firePulse !== this.prevFirePulse) {
      this.prevFirePulse = this.aim.firePulse;
    }

    const recentlyFired = (time - this.lastFireAtMs) < AIM_BRIGHT_MS;
    const bright = fire || recentlyFired;

    this.aimLine.clear();
    if (this.aim.mode === 'tapToShoot' && this.aim.aimPointerId !== null) {
      this.aimLine.lineStyle(1, AIM_COLOR, bright ? 0.9 : 0.5);
      this.aimLine.beginPath();
      this.aimLine.moveTo(px, py);
      this.aimLine.lineTo(this.aim.fingerX, this.aim.fingerY);
      this.aimLine.strokePath();
    } else if (this.aim.hasAim) {
      this.aimLine.lineStyle(2, AIM_COLOR, bright ? 1.0 : 0.4);
      this.aimLine.beginPath();
      this.aimLine.moveTo(px, py);
      this.aimLine.lineTo(px + aim.x * AIM_LINE_LENGTH, py + aim.y * AIM_LINE_LENGTH);
      this.aimLine.strokePath();
    }

    const w = this.weapon.currentWeapon;
    const ammo = this.weapon.currentAmmo;
    const bulletCount = this.weapon.countActiveBullets();
    const ammoStr = ammo === null ? '' : `:${ammo}`;
    this.readout.setText(
      `${w.name}${ammoStr}  #${bulletCount}${fire ? ' F' : ''}`
    );
  }

  spawnFireFlash(x, y, aim) {
    const flash = this.add.circle(x, y, 8, FIRE_FLASH_COLOR, 1)
      .setDepth(FIRE_FLASH_DEPTH);
    this.tweens.add({
      targets: flash, alpha: 0, scale: 2, duration: FIRE_FLASH_MS,
      onComplete: () => flash.destroy()
    });
    const tip = this.add.circle(
      x + aim.x * 8, y + aim.y * 8, 5, FIRE_FLASH_COLOR, 1
    ).setDepth(FIRE_FLASH_DEPTH);
    this.tweens.add({
      targets: tip, alpha: 0,
      x: x + aim.x * 28, y: y + aim.y * 28,
      duration: FIRE_FLASH_MS,
      onComplete: () => tip.destroy()
    });
  }

  spawnMeleeArc(px, py, aimAngle, weapon) {
    const half = (weapon.melee.arcDegrees / 2) * Math.PI / 180;
    const g = this.add.graphics().setDepth(55);
    g.fillStyle(MELEE_ARC_COLOR, 0.55);
    g.slice(px, py, weapon.melee.range, aimAngle - half, aimAngle + half, false);
    g.fillPath();
    this.tweens.add({
      targets: g, alpha: 0, duration: MELEE_ARC_MS,
      onComplete: () => g.destroy()
    });
  }

  checkMeleeHits(px, py, aim, weapon) {
    const halfArc = (weapon.melee.arcDegrees / 2) * Math.PI / 180;
    const aimAngle = Math.atan2(aim.y, aim.x);
    if (!this.testTarget || !this.testTarget.active) return;
    const dx = this.testTarget.x - px;
    const dy = this.testTarget.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > weapon.melee.range + TARGET_SIZE / 2) return;
    const targetAngle = Math.atan2(dy, dx);
    if (Math.abs(angleDelta(targetAngle, aimAngle)) <= halfArc) {
      this.flashTarget();
    }
  }

  flashTarget() {
    if (!this.testTarget || this.testTarget.isTinted) return;
    this.testTarget.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (this.testTarget) this.testTarget.clearTint();
    });
  }
}
