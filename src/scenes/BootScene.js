import Phaser from 'phaser';
import { placeholderFor } from '../utils/placeholders.js';
import { pixelText } from '../utils/text.js';

// Temporary scaffold scene. Proves the game boots on the phone and that
// multi-touch reaches Phaser: one dot is drawn per active pointer.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Bitmap font, generated from m6x11.ttf. Loaded here so every later
    // scene can assume it exists.
    this.load.bitmapFont(
      'm6x11',
      'assets/fonts/m6x11.png',
      'assets/fonts/m6x11.fnt'
    );
  }

  create() {
    const { width } = this.scale; // 390

    pixelText(this, width / 2, 18, '2D FAST',
      { size: 32, color: '#ffffff', origin: [0.5, 0.5] });
    pixelText(this, width / 2, 42, 'scaffold ok  |  placeholders ok',
      { size: 16, color: '#00ff88', origin: [0.5, 0.5] });

    const demos = [
      { key: 'player',            category: 'player',     w: 24, h: 32 },
      { key: 'enemy.walker',      category: 'enemy',      w: 20, h: 20 },
      { key: 'projectile.bullet', category: 'projectile', w:  8, h:  4 },
      { key: 'pickup.accessory',  category: 'pickup',     w: 16, h: 16 },
      { key: 'tile.solid',        category: 'tile',       w: 16, h: 16 }
    ];
    const rowY = 82;
    const spacing = 54;
    const startX = width / 2 - (demos.length - 1) * spacing / 2;
    demos.forEach((d, i) => {
      const x = startX + i * spacing;
      placeholderFor(this, d.key, {
        category: d.category, width: d.w, height: d.h, x, y: rowY
      });
      pixelText(this, x, rowY + 26, d.key,
        { size: 16, color: '#888888', origin: [0.5, 0.5] });
      pixelText(this, x, rowY + 40, `${d.w}\u00d7${d.h}`,
        { size: 16, color: '#666666', origin: [0.5, 0.5] });
    });

    pixelText(this, width / 2, 152,
      'touch with several fingers \u2014 one dot per pointer',
      { size: 16, color: '#888888', origin: [0.5, 0.5] });

    this.counter = pixelText(this, width / 2, 170, 'pointers: 0',
      { size: 16, color: '#ffffff', origin: [0.5, 0.5] });

    this.dots = new Map();

    this.input.on('pointerdown', (pointer) => {
      const dot = this.add.circle(pointer.x, pointer.y, 10, 0x00ff88, 0.55);
      this.dots.set(pointer.id, dot);
      this.refreshCount();
    });

    this.input.on('pointermove', (pointer) => {
      const dot = this.dots.get(pointer.id);
      if (dot) dot.setPosition(pointer.x, pointer.y);
    });

    const release = (pointer) => {
      const dot = this.dots.get(pointer.id);
      if (!dot) return;
      dot.destroy();
      this.dots.delete(pointer.id);
      this.refreshCount();
    };

    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  refreshCount() {
    this.counter.setText(`pointers: ${this.dots.size}`);
  }
}
