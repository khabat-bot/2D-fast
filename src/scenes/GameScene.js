import Phaser from 'phaser';
import { TouchControls } from '../systems/TouchControls.js';
import { AimController } from '../systems/AimController.js';
import { Player } from '../entities/Player.js';
import { loadSetting } from '../systems/SettingsStore.js';
import { pixelText } from '../utils/text.js';
import {
  JOYSTICK_RADIUS, JOYSTICK_STICK_RADIUS, JOYSTICK_DEADZONE,
  JOYSTICK_ZONE_WIDTH_FRAC, JOYSTICK_ZONE_Y_START_FRAC,
  BUTTON_RADIUS, BUTTON_LEFT_X, BUTTON_RIGHT_X, BUTTON_Y_FROM_BOTTOM,
  JUMP_BUTTON_RADIUS, JUMP_BUTTON_X_FROM_RIGHT, JUMP_BUTTON_Y_FROM_BOTTOM,
  AIM_STICK_RADIUS, AIM_STICK_STICK_RADIUS, AIM_STICK_DEADZONE,
  FIRE_BUTTON_RADIUS, FIRE_BUTTON_X_FROM_RIGHT, FIRE_BUTTON_Y_FROM_BOTTOM
} from '../config/controlsConfig.js';
import { PLAYER_W, PLAYER_H } from '../config/playerConfig.js';

const AIM_LINE_LENGTH   = 40;
const AIM_COLOR         = 0xffeb3b;
const FIRE_FLASH_MS     = 150;
const FIRE_FLASH_COLOR  = 0xffff33;
const FIRE_FLASH_DEPTH  = 60;
const AIM_BRIGHT_MS     = 150;

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
      x: width / 2,
      y: groundY - PLAYER_H / 2,
      groundY
    });
    this.prevJumpHeld = false;

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

    this.aimLine = this.add.graphics().setDepth(50);
    this.readout = pixelText(this, width / 2, 14, '',
      { size: 16, color: '#888888', origin: [0.5, 0.5] });
    pixelText(this, width / 2, height - 14,
      'L:move  R:aim  BTN:jump',
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
    // getAim needs player position for mode 3 (aim at finger).
    const aim = this.aim.getAim(px, py);
    const fire = this.aim.consumeFire();
    if (fire) this.lastFireAtMs = time;

    if (this.aim.firePulse !== this.prevFirePulse) {
      this.prevFirePulse = this.aim.firePulse;
      this.spawnFireFlash(px, py, aim);
    }

    const recentlyFired = (time - this.lastFireAtMs) < AIM_BRIGHT_MS;
    const bright = fire || recentlyFired;

    this.aimLine.clear();
    if (this.aim.mode === 'tapToShoot') {
      // Mode 3: laser sight from player to finger while finger is down.
      // When released, keep a short line in the preserved aim direction.
      if (this.aim.aimPointerId !== null) {
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
    } else if (this.aim.hasAim) {
      // Modes 1/2: standard short aim line.
      this.aimLine.lineStyle(2, AIM_COLOR, bright ? 1.0 : 0.4);
      this.aimLine.beginPath();
      this.aimLine.moveTo(px, py);
      this.aimLine.lineTo(px + aim.x * AIM_LINE_LENGTH, py + aim.y * AIM_LINE_LENGTH);
      this.aimLine.strokePath();
    }

    const mx = this.controls.outputX;
    const aimDeg = Math.atan2(aim.y, aim.x) * 180 / Math.PI;
    this.readout.setText(
      `mx:${mx.toFixed(1)} vy:${this.player.vy.toFixed(0)} aim:${aimDeg.toFixed(0)}${fire ? ' F' : ''}`
    );
  }

  spawnFireFlash(px, py, aim) {
    const flash = this.add.circle(px, py, 8, FIRE_FLASH_COLOR, 1)
      .setDepth(FIRE_FLASH_DEPTH);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: FIRE_FLASH_MS,
      onComplete: () => flash.destroy()
    });
    const tip = this.add.circle(
      px + aim.x * 14, py + aim.y * 14, 5, FIRE_FLASH_COLOR, 1
    ).setDepth(FIRE_FLASH_DEPTH);
    this.tweens.add({
      targets: tip,
      alpha: 0,
      x: px + aim.x * 34,
      y: py + aim.y * 34,
      duration: FIRE_FLASH_MS,
      onComplete: () => tip.destroy()
    });
  }
}
