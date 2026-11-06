import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { initDebugOverlay } from './utils/debug.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: GAME_CONFIG.backgroundColor,

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_CONFIG.width,
    height: GAME_CONFIG.height
  },

  // Pixel art: no texture smoothing, no sub-pixel sprite positions.
  pixelArt: true,
  roundPixels: true,
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true
  },

  // Mouse pointer + 3 touch pointers, so move + jump + aim/shoot can all be
  // held at once. activePointers includes the mouse pointer.
  input: {
    activePointers: 4
  },

  scene: [BootScene, GameScene, SettingsScene, GameOverScene]
};

const game = new Phaser.Game(config);
initDebugOverlay(game);
