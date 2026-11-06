import Phaser from 'phaser';
import { pixelText } from '../utils/text.js';

// "0:23" / "1:05" style. Time is internal ms from GameScene.
function fmtTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Run-over screen. Receives { stats } from GameScene via init(data).
// Stats shown: survived, kills, damage dealt, damage taken.
// RETRY restarts GameScene; MENU returns to BootScene.
//
// Rooms-cleared and deaths are NOT shown: solo runs have exactly one
// death and there are no rooms yet. Tracking object in GameScene has
// room for both when they become meaningful (multiplayer).
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.stats = (data && data.stats) ? data.stats : {
      elapsedMs: 0, kills: 0, damageDealt: 0, damageTaken: 0
    };
    this.transitioning = false;
  }

  create() {
    const { width } = this.scale;
    this.cameras.main.fadeIn(300, 0, 0, 0);

    pixelText(this, width / 2, 22, 'YOU DIED',
      { size: 32, color: '#ff3333', origin: [0.5, 0.5] });

    const s = this.stats;
    const rows = [
      ['SURVIVED',     fmtTime(s.elapsedMs)],
      ['KILLS',        String(s.kills)],
      ['DAMAGE DEALT', String(s.damageDealt)],
      ['DAMAGE TAKEN', String(s.damageTaken)]
    ];
    const rowStartY = 58;
    const rowStep   = 18;
    const splitX    = width / 2;
    rows.forEach((row, i) => {
      const y = rowStartY + i * rowStep;
      pixelText(this, splitX - 10, y, row[0],
        { size: 16, color: '#888888', origin: [1, 0.5] });
      pixelText(this, splitX + 10, y, row[1],
        { size: 16, color: '#ffffff', origin: [0, 0.5] });
    });

    this.makeButton(100, 145, 120, 24, 'RETRY',
      { fill: 0x004422, stroke: 0x00aa44, pressed: 0x00aa44 },
      () => this.goto('GameScene'));
    this.makeButton(290, 145, 120, 24, 'MENU',
      { fill: 0x222222, stroke: 0x666666, pressed: 0x555555 },
      () => this.goto('BootScene'));
  }

  makeButton(x, y, w, h, label, colors, onClick) {
    const bg = this.add
      .rectangle(x, y, w, h, colors.fill, 0.9)
      .setStrokeStyle(1, colors.stroke, 1)
      .setInteractive();
    pixelText(this, x, y, label,
      { size: 16, color: '#ffffff', origin: [0.5, 0.5] }).setDepth(11);
    bg.on('pointerdown', () => {
      bg.setFillStyle(colors.pressed, 1);
      onClick();
    });
    return bg;
  }

  goto(sceneKey) {
    // transitioning guard prevents a double-tap from queueing two starts.
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey);
    });
  }
}
