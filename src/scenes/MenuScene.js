import Phaser from 'phaser';
import { pixelText } from '../utils/text.js';
import { Button } from '../ui/Button.js';

const PLAY_RADIUS     = 45;
const SETTINGS_RADIUS = 35;
const PLAY_COLOR      = 0x005522;
const SETTINGS_COLOR  = 0x333333;

// Main menu. PLAY -> GameScene, SET -> SettingsScene.
// Reached from BootScene (first launch) and GameOverScene's MENU button.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.transitioning = false;
  }

  create() {
    this.transitioning = false;
    const { width } = this.scale;

    pixelText(this, width / 2, 24, '2D FAST',
      { size: 32, color: '#ffffff', origin: [0.5, 0.5] });

    const y = 110;
    this.playBtn = new Button(this, {
      x: width / 2 - 90, y,
      radius: PLAY_RADIUS,
      color: PLAY_COLOR, alpha: 0.85, pressedAlpha: 1,
      label: 'PLAY', depth: 100
    });
    this.editBtn = new Button(this, {
      x: width / 2, y,
      radius: PLAY_RADIUS,
      color: 0x004466, alpha: 0.85, pressedAlpha: 1,
      label: 'EDIT', depth: 100
    });
    this.settingsBtn = new Button(this, {
      x: width / 2 + 90, y,
      radius: SETTINGS_RADIUS,
      color: SETTINGS_COLOR, alpha: 0.85, pressedAlpha: 1,
      label: 'SET', depth: 100
    });

    this.input.on('pointerdown', (pointer) => {
      if (this.transitioning) return;
      if (this.playBtn.contains(pointer)) {
        this.goto('GameScene');
      } else if (this.editBtn.contains(pointer)) {
        this.goto('EditorScene');
      } else if (this.settingsBtn.contains(pointer)) {
        this.goto('SettingsScene');
      }
    });
  }

  goto(sceneKey) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.scene.start(sceneKey);
  }
}
