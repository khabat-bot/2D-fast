import Phaser from 'phaser';
import { pixelText } from '../utils/text.js';
import { loadSetting, saveSetting } from '../systems/SettingsStore.js';

// Three-column selector. Each column is a vertical stack of buttons; the
// active value in each is green. DRAG applies only in TAP aim mode.
const MOVEMENT_OPTIONS = [
  { value: 'joystick', label: 'JOYSTICK' },
  { value: 'buttons',  label: 'BUTTONS'  }
];
const AIM_OPTIONS = [
  { value: 'aimAndShoot', label: 'AIM+SHOOT' },
  { value: 'aimStick',    label: 'STICK+BTN' },
  { value: 'tapToShoot',  label: 'TAP'       }
];
const DRAG_OPTIONS = [
  { value: 'onRelease',  label: 'ON RELEASE' },
  { value: 'continuous', label: 'CONTINUOUS' }
];

const COLOR_ACTIVE   = 0x00aa44;
const COLOR_INACTIVE = 0x333333;
const BTN_W = 115;
const BTN_H = 22;
const BTN_SPACING = 6;

const COL_X = [62, 195, 328];
const LABEL_Y = 44;
const BTN_START_Y = 64;

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    const { width, height } = this.scale;

    pixelText(this, width / 2, 12, 'SETTINGS',
      { size: 16, color: '#ffffff', origin: [0.5, 0.5] });

    // Back zone at depth 0. Buttons (depth 10) win taps first via Phaser's
    // default topOnly dispatch. No stopPropagation needed.
    const backZone = this.add.zone(width / 2, height / 2, width, height)
      .setInteractive()
      .setDepth(0);
    backZone.on('pointerdown', () => this.scene.start('BootScene'));

    // Column labels.
    pixelText(this, COL_X[0], LABEL_Y, 'MOVE',
      { size: 16, color: '#888888', origin: [0.5, 0.5] });
    pixelText(this, COL_X[1], LABEL_Y, 'AIM',
      { size: 16, color: '#888888', origin: [0.5, 0.5] });
    pixelText(this, COL_X[2], LABEL_Y, 'DRAG',
      { size: 16, color: '#888888', origin: [0.5, 0.5] });

    // Columns.
    this.buildColumn(MOVEMENT_OPTIONS, COL_X[0], BTN_START_Y, 'movementMode');
    this.buildColumn(AIM_OPTIONS,      COL_X[1], BTN_START_Y, 'aimMode');
    this.buildColumn(DRAG_OPTIONS,     COL_X[2], BTN_START_Y, 'dragFireMode');

    pixelText(this, width / 2, height - 28, 'DRAG: applies in TAP aim mode',
      { size: 16, color: '#666666', origin: [0.5, 0.5] });
    pixelText(this, width / 2, height - 10, 'TAP ELSEWHERE TO RETURN',
      { size: 16, color: '#666666', origin: [0.5, 0.5] });
  }

  buildColumn(options, cx, startY, settingKey) {
    const current = loadSetting(settingKey);
    const buttons = [];
    options.forEach((opt, i) => {
      const by = startY + i * (BTN_H + BTN_SPACING);
      const rect = this.add
        .rectangle(cx, by, BTN_W, BTN_H, COLOR_INACTIVE, 1)
        .setDepth(10)
        .setInteractive();
      pixelText(this, cx, by, opt.label,
        { size: 16, color: '#ffffff', origin: [0.5, 0.5] }).setDepth(11);
      rect.on('pointerdown', () => {
        saveSetting(settingKey, opt.value);
        this.refresh(buttons, opt.value);
      });
      buttons.push({ rect, value: opt.value });
    });
    this.refresh(buttons, current);
    return buttons;
  }

  refresh(buttons, activeValue) {
    buttons.forEach(({ rect, value }) => {
      rect.setFillStyle(
        value === activeValue ? COLOR_ACTIVE : COLOR_INACTIVE,
        1
      );
    });
  }
}
