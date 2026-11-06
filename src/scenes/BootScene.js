import Phaser from 'phaser';
// Vite only serves public/ at the URL root, so files under assets/
// must be imported to get a resolvable URL. ?url returns the
// asset URL without Vite trying to parse it as a module.
import fontTextureUrl from '../../assets/fonts/m6x11.png?url';
import fontDataUrl    from '../../assets/fonts/m6x11.fnt?url';
import { pixelText } from '../utils/text.js';

// Temporary scaffold scene. Proves the game boots on the phone and that
// multi-touch reaches Phaser: one dot is drawn per active pointer.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Bitmap font, generated from m6x11.ttf. Loaded here so every later
    // scene can assume it exists. URLs come from ?url imports so Vite
    // serves them correctly (see the import block at the top).
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

    // Zones + topOnly dispatch: a full-screen play zone at depth 0, and a
    // smaller settings zone at depth 10 over the text. Tap in the
    // settings area -> settings; tap anywhere else -> game. No race
    // between handlers, no stopPropagation needed.
    const playZone = this.add.zone(width / 2, height / 2, width, height)
      .setInteractive()
      .setDepth(0);
    playZone.on('pointerdown', () => this.scene.start('GameScene'));

    const settingsZone = this.add.zone(width - 42, height - 14, 100, 34)
      .setInteractive()
      .setDepth(10);
    settingsZone.on('pointerdown', () => this.scene.start('SettingsScene'));
  }

}
