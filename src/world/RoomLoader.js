import { placeholderFor } from '../utils/placeholders.js';
import { TILE_SIZE } from '../config/roomConfig.js';

// Tiles behind everything else so entities and pickups render on top.
const TILE_DEPTH = -10;
// Distinct brown so one-way platforms are visually separable from solid
// walls at a glance.
const ONE_WAY_COLOR = 0x8b6f47;

// Parses one room template from src/data/rooms.js, draws its tiles, and
// exposes collision queries, spawn positions, and bounds. Rooms are
// centered in the viewport so odd tile counts stay integer-aligned.
export class RoomLoader {
  constructor(scene, roomData) {
    this.scene = scene;
    this.data = roomData;
    this.tileSize = roomData.tileSize ?? TILE_SIZE;
    const roomW = roomData.tilesWide * this.tileSize;
    const roomH = roomData.tilesTall * this.tileSize;
    this.offsetX = Math.floor((scene.scale.width  - roomW) / 2);
    this.offsetY = Math.floor((scene.scale.height - roomH) / 2);
    this.grid = this._parseGrid();
    this._createTiles();
  }

  _parseGrid() {
    const grid = [];
    for (let row = 0; row < this.data.tilesTall; row++) {
      const line = this.data.grid[row] ?? '';
      const cells = [];
      for (let col = 0; col < this.data.tilesWide; col++) {
        cells.push(line[col] ?? '.');
      }
      grid.push(cells);
    }
    return grid;
  }

  _createTiles() {
    for (let row = 0; row < this.data.tilesTall; row++) {
      for (let col = 0; col < this.data.tilesWide; col++) {
        const cell = this.grid[row][col];
        if (cell !== '#' && cell !== '=') continue;
        const x = this.offsetX + col * this.tileSize + this.tileSize / 2;
        const y = this.offsetY + row * this.tileSize + this.tileSize / 2;
        if (cell === '#') {
          placeholderFor(this.scene, 'tile.solid', {
            category: 'tile',
            width: this.tileSize,
            height: this.tileSize,
            x, y
          }).setDepth(TILE_DEPTH);
        } else {
          placeholderFor(this.scene, 'tile.oneway', {
            category: 'tile',
            width: this.tileSize,
            height: this.tileSize,
            x, y,
            color: ONE_WAY_COLOR
          }).setDepth(TILE_DEPTH);
        }
      }
    }
  }

  // --- grid queries (tile coords) ----------------------------------------

  cellAt(col, row) {
    if (row < 0 || row >= this.grid.length) return '.';
    if (col < 0 || col >= this.grid[row].length) return '.';
    return this.grid[row][col];
  }

  isSolidAt(col, row) { return this.cellAt(col, row) === '#'; }
  isOneWayAt(col, row) { return this.cellAt(col, row) === '='; }

  // --- world-space helpers ------------------------------------------------

  getBounds() {
    return {
      x: this.offsetX,
      y: this.offsetY,
      w: this.data.tilesWide * this.tileSize,
      h: this.data.tilesTall * this.tileSize
    };
  }

  // Top of the bottom-most row, assumed solid. Used for pickups and
  // walkers, which do not do tile collision yet.
  getFloorY() {
    return this.offsetY + (this.data.tilesTall - 1) * this.tileSize;
  }

  // Feet position in world coords. Caller converts to sprite-center Y by
  // subtracting PLAYER_H / 2.
  getPlayerSpawn() {
    return {
      x: this.offsetX + this.data.playerSpawn.x,
      y: this.offsetY + this.data.playerSpawn.y
    };
  }

  // Sprite-center positions in world coords.
  getWalkerSpawns() {
    return (this.data.walkerSpawns ?? []).map((s) => ({
      x: this.offsetX + s.x,
      y: this.offsetY + s.y
    }));
  }

  // Left/right bounds for walker patrol. Walker update checks
  // sprite.x - halfW < minX, so these are edge positions (inside the outer
  // walls by one tile).
  getWalkerBounds() {
    const b = this.getBounds();
    return {
      minX: b.x + this.tileSize,
      maxX: b.x + b.w - this.tileSize
    };
  }
}
