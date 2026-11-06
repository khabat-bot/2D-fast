import { placeholderFor } from '../utils/placeholders.js';
import { TILE_SIZE, DOOR_W, DOOR_H } from '../config/roomConfig.js';
import { PLAYER_H } from '../config/playerConfig.js';
import { ENEMIES } from '../data/enemies.js';
import { TILE, charToTile } from '../data/tiles.js';

const TILE_DEPTH    = -10;
const DOOR_DEPTH    = -9;
const ONE_WAY_COLOR = 0x8b6f47;
const DOOR_COLOR    = 0x00cc66;   // green, distinct from red enemies / blue player
const PICKUP_HALF_H = 8;          // assumed half-height when placing pickups on a tile row

// Loads one room: parses the grid, draws tiles and doors, exposes collision
// queries, spawn positions, and door spawns. Doors are the only transition
// mechanism - player overlap triggers a room swap.
//
// Spawn positions in `roomData` use TILE coords:
//   { col, row } -> entity is centered on col, bottom edge on top of row.
// The loader converts to world pixel coords using each entity's own height,
// so changing entity sizes or tile layout never breaks spawns.
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
    this._tileSprites = [];
    this._doorSprites = [];
    this._doorTweens  = [];
    this._createTiles();
    this._createDoors();
  }

  _parseGrid() {
    // Grid rows are digit strings ('1' solid, '2' one-way, '0' empty).
    // charToTile also accepts legacy '#'/'='/'.' so pre-migration rooms
    // in localStorage still load.
    const grid = [];
    for (let row = 0; row < this.data.tilesTall; row++) {
      const line = this.data.grid[row] ?? '';
      const cells = [];
      for (let col = 0; col < this.data.tilesWide; col++) {
        cells.push(charToTile(line[col] ?? '0'));
      }
      grid.push(cells);
    }
    return grid;
  }

  _createTiles() {
    for (let row = 0; row < this.data.tilesTall; row++) {
      for (let col = 0; col < this.data.tilesWide; col++) {
        const cell = this.grid[row][col];
        if (cell !== TILE.SOLID && cell !== TILE.ONEWAY) continue;
        const x = this.offsetX + col * this.tileSize + this.tileSize / 2;
        const y = this.offsetY + row * this.tileSize + this.tileSize / 2;
        let sprite;
        if (cell === TILE.SOLID) {
          sprite = placeholderFor(this.scene, 'tile.solid', {
            category: 'tile',
            width: this.tileSize,
            height: this.tileSize,
            x, y
          }).setDepth(TILE_DEPTH);
        } else {
          sprite = placeholderFor(this.scene, 'tile.oneway', {
            category: 'tile',
            width: this.tileSize,
            height: this.tileSize,
            x, y,
            color: ONE_WAY_COLOR
          }).setDepth(TILE_DEPTH);
        }
        this._tileSprites.push(sprite);
      }
    }
  }

  _createDoors() {
    for (const d of (this.data.doors ?? [])) {
      const x = this.offsetX + d.col * this.tileSize + this.tileSize / 2;
      const y = this.offsetY + d.row * this.tileSize - DOOR_H / 2;
      const sprite = this.scene.add
        .rectangle(x, y, DOOR_W, DOOR_H, DOOR_COLOR, 0.7)
        .setStrokeStyle(2, 0x00ff88, 1)
        .setDepth(DOOR_DEPTH);
      this._doorSprites.push(sprite);
      // Pulse so the door is obvious even on a busy screen.
      const t = this.scene.tweens.add({
        targets: sprite,
        alpha: 0.35,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this._doorTweens.push(t);
    }
  }

  // --- grid queries ------------------------------------------------------

  cellAt(col, row) {
    if (row < 0 || row >= this.grid.length) return TILE.EMPTY;
    if (col < 0 || col >= this.grid[row].length) return TILE.EMPTY;
    return this.grid[row][col];
  }
  isSolidAt(col, row)  { return this.cellAt(col, row) === TILE.SOLID; }
  isOneWayAt(col, row) { return this.cellAt(col, row) === TILE.ONEWAY; }

  // --- world-space helpers ----------------------------------------------

  getBounds() {
    return {
      x: this.offsetX,
      y: this.offsetY,
      w: this.data.tilesWide * this.tileSize,
      h: this.data.tilesTall * this.tileSize
    };
  }

  getFloorY() {
    return this.offsetY + (this.data.tilesTall - 1) * this.tileSize;
  }

  // Returns { x, y } where y is the BOTTOM edge (player sprite y = this - PLAYER_H/2).
  getPlayerSpawn() {
    const s = this.data.playerSpawn;
    return {
      x: this.offsetX + s.col * this.tileSize + this.tileSize / 2,
      y: this.offsetY + s.row * this.tileSize
    };
  }

  // Returns { x, y } where y is the SPRITE CENTER (walker uses it as restY).
  getWalkerSpawns() {
    const walkerH = ENEMIES.walker.height;
    return (this.data.walkers ?? []).map((w) => ({
      x: this.offsetX + w.col * this.tileSize + this.tileSize / 2,
      y: this.offsetY + w.row * this.tileSize - walkerH / 2
    }));
  }

  // Returns { kind, weaponId, x, y } where y is the SPRITE CENTER.
  getPickupSpawns() {
    return (this.data.pickups ?? []).map((p) => ({
      kind: p.kind,
      weaponId: p.weaponId,
      x: this.offsetX + p.col * this.tileSize + this.tileSize / 2,
      y: this.offsetY + p.row * this.tileSize - PICKUP_HALF_H
    }));
  }

  // Door spawns in WORLD coords for overlap checks. `entry` is passed
  // through untouched - it is resolved against the DESTINATION room's
  // doors/playerSpawn by GameScene.handleRoomTransition.
  getDoorSpawns() {
    return (this.data.doors ?? []).map((d) => ({
      x: this.offsetX + d.col * this.tileSize + this.tileSize / 2,
      y: this.offsetY + d.row * this.tileSize - DOOR_H / 2,
      w: DOOR_W,
      h: DOOR_H,
      to: d.to,
      entry: d.entry ?? null
    }));
  }

  getWalkerBounds() {
    const b = this.getBounds();
    return {
      minX: b.x + this.tileSize,
      maxX: b.x + b.w - this.tileSize
    };
  }

  destroy() {
    for (const s of this._tileSprites) s.destroy();
    this._tileSprites = [];
    for (const s of this._doorSprites) s.destroy();
    this._doorSprites = [];
    for (const t of this._doorTweens) {
      if (t && typeof t.remove === 'function') t.remove();
    }
    this._doorTweens = [];
  }
}
