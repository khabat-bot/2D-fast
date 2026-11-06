import Phaser from 'phaser';
import fontTextureUrl from '../../assets/fonts/m6x11.png?url';
import fontDataUrl    from '../../assets/fonts/m6x11.fnt?url';
import { pixelText } from '../utils/text.js';

// Splash screen. Tap anywhere -> GameScene, tap bottom-right -> Settings.
// Two interactive zones at different depths; Phaser's default topOnly
// dispatch sends each tap to the highest zone under the pointer.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.bitmapFont('m6x11', fontTextureUrl, fontDataUrl);
  }

  create() {
    const { width, height } = this.scale;

    pixelText(this, width / 2, height / 2 - 22, '2D FAST',
      { size: 32, color: '#ffffff', origin: [0.5, 0.5] });
    pixelText(this, width / 2, height / 2 + 18, 'tap to play',
      { size: 16, color: '#00ff88', origin: [0.5, 0.5] });
    pixelText(this, width - 42, height - 14, 'settings',
      { size: 16, color: '#666666', origin: [0.5, 0.5] });

    const playZone = this.add.zone(width / 2, height / 2, width, height)
      .setInteractive().setDepth(0);
    playZone.on('pointerdown', () => this.scene.start('MenuScene'));

    const settingsZone = this.add.zone(width - 42, height - 14, 100, 34)
      .setInteractive().setDepth(10);
    settingsZone.on('pointerdown', () => this.scene.start('SettingsScene'));
  }
}
