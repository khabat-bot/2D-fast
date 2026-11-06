import { placeholderFor } from '../utils/placeholders.js';
import { WEAPONS } from '../data/weapons.js';
import { PICKUP_PHYSICS } from '../config/pickupConfig.js';

const PICKUP_DEPTH  = 40;
const PICKUP_RADIUS = 20;

export const WEAPON_PICKUP_SIZE = 14;
export const AMMO_PICKUP_SIZE   = 12;

// Glow is the only "in range" signal now. Item color identifies what it is
// (orange = shotgun, blue = sniper, yellow = ammo). The slot UI shows the
// name once equipped. On-ground labels were redundant.
const GLOW_COLOR        = 0xffee00;
const GLOW_PULSE_MS     = 500;
const GLOW_STRENGTH_MIN = 1.5;
const GLOW_STRENGTH_MAX = 4.0;

function makeGlow(sprite) {
  if (!sprite || !sprite.postFX || typeof sprite.postFX.addGlow !== 'function') {
    return null;
  }
  try {
    // knockout: false - the sprite renders normally, glow is a halo.
    // knockout: true replaces sprite pixels with the glow (invisible item).
    return sprite.postFX.addGlow(GLOW_COLOR, 0, 0, false, 0.1, 4);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Pickup] glow unavailable:', e);
    return null;
  }
}

function pulseGlow(glow, nowMs) {
  if (!glow) return;
  const phase = (nowMs % GLOW_PULSE_MS) / GLOW_PULSE_MS;
  const tri = 1 - Math.abs(phase * 2 - 1);
  glow.outerStrength = GLOW_STRENGTH_MIN +
    (GLOW_STRENGTH_MAX - GLOW_STRENGTH_MIN) * tri;
}

export class WeaponPickup {
  constructor(scene, x, y, weaponId, ammo = null, collectableAt = 0) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) throw new Error(`WeaponPickup: unknown weapon "${weaponId}"`);
    this.scene = scene;
    this.weaponId = weaponId;
    this.weapon = weapon;
    this.ammo = ammo !== null
      ? ammo
      : (weapon.type === 'ranged' ? weapon.ammo.starting : null);
    this.width = WEAPON_PICKUP_SIZE;
    this.height = WEAPON_PICKUP_SIZE;
    this.collectableAt = collectableAt;
    this.collected = false;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;

    this.sprite = placeholderFor(scene, `pickup.weapon.${weaponId}`, {
      category: 'pickup',
      width: this.width,
      height: this.height,
      x, y,
      color: weapon.color
    }).setDepth(PICKUP_DEPTH);

    this.glowFx = makeGlow(this.sprite);
  }

  // Tile-based physics. After each axis move, walk the tiles the AABB
  // overlaps and reflect/stop on any solid '#' tile. One-way '=' tiles
  // are ignored (they look like thin ledges, not surfaces that catch
  // items mid-air). Interior walls and floor blocks collide, not just
  // the room border.
  update(dt, room) {
    if (this.collected) return;

    const P = PICKUP_PHYSICS;
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    if (!this.onGround) this.vy += P.gravity * dt;

    this.sprite.x += this.vx * dt;
    this._resolveX(room, halfW, halfH);

    this.sprite.y += this.vy * dt;
    this._resolveY(room, halfW, halfH);

    if (this.onGround) {
      this.vx *= Math.pow(P.groundFrictionPerFrame, dt * 60);
      if (Math.abs(this.vx) < P.restVx) this.vx = 0;
    }
  }

  _resolveX(room, halfW, halfH) {
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;
    const left  = this.sprite.x - halfW;
    const right = this.sprite.x + halfW;
    const top   = this.sprite.y - halfH;
    const bot   = this.sprite.y + halfH;
    const colStart = Math.floor((left  - ox) / ts);
    const colEnd   = Math.floor((right - ox - 0.001) / ts);
    const rowStart = Math.floor((top   - oy) / ts);
    const rowEnd   = Math.floor((bot   - oy - 0.001) / ts);

    if (this.vx > 0) {
      for (let row = rowStart; row <= rowEnd; row++) {
        if (room.cellAt(colEnd, row) === '#') {
          this.sprite.x = ox + colEnd * ts - halfW;
          this.vx = -this.vx * PICKUP_PHYSICS.bounce;
          return;
        }
      }
    } else if (this.vx < 0) {
      for (let row = rowStart; row <= rowEnd; row++) {
        if (room.cellAt(colStart, row) === '#') {
          this.sprite.x = ox + (colStart + 1) * ts + halfW;
          this.vx = -this.vx * PICKUP_PHYSICS.bounce;
          return;
        }
      }
    }
  }

  _resolveY(room, halfW, halfH) {
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;
    const left  = this.sprite.x - halfW;
    const right = this.sprite.x + halfW;
    const top   = this.sprite.y - halfH;
    const bot   = this.sprite.y + halfH;
    const colStart = Math.floor((left  - ox) / ts);
    const colEnd   = Math.floor((right - ox - 0.001) / ts);
    const rowStart = Math.floor((top   - oy) / ts);
    const rowEnd   = Math.floor((bot   - oy - 0.001) / ts);

    if (this.vy > 0) {
      for (let col = colStart; col <= colEnd; col++) {
        if (room.cellAt(col, rowEnd) === '#') {
          this.sprite.y = oy + rowEnd * ts - halfH;
          if (this.vy > PICKUP_PHYSICS.restVy) {
            this.vy = -this.vy * PICKUP_PHYSICS.bounce;
            this.onGround = false;
          } else {
            this.vy = 0;
            this.onGround = true;
          }
          return;
        }
      }
      this.onGround = false;
    } else if (this.vy < 0) {
      for (let col = colStart; col <= colEnd; col++) {
        if (room.cellAt(col, rowStart) === '#') {
          this.sprite.y = oy + (rowStart + 1) * ts + halfH;
          this.vy = -this.vy * PICKUP_PHYSICS.bounce;
          return;
        }
      }
    }
  }

  setInRange(inRange, nowMs) {
    if (!this.glowFx) return;
    if (this.collected) {
      this.glowFx.outerStrength = 0;
      return;
    }
    if (inRange) {
      pulseGlow(this.glowFx, nowMs);
    } else {
      this.glowFx.outerStrength = 0;
    }
  }

  contains(x, y) {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    return dx * dx + dy * dy <= PICKUP_RADIUS * PICKUP_RADIUS;
  }

  destroy() {
    this.sprite.destroy();
  }
}

export class AmmoPickup {
  constructor(scene, x, y) {
    this.scene = scene;
    this.collected = false;
    this.collectableAt = 0;
    this.width = AMMO_PICKUP_SIZE;
    this.height = AMMO_PICKUP_SIZE;

    this.sprite = placeholderFor(scene, 'pickup.ammo', {
      category: 'pickup',
      width: this.width,
      height: this.height,
      x, y,
      color: 0xffeb3b
    }).setDepth(PICKUP_DEPTH);

    this.glowFx = makeGlow(this.sprite);
  }

  update(_dt, _room) { /* static */ }

  setInRange(inRange, nowMs) {
    if (!this.glowFx) return;
    if (this.collected) {
      this.glowFx.outerStrength = 0;
      return;
    }
    if (inRange) {
      pulseGlow(this.glowFx, nowMs);
    } else {
      this.glowFx.outerStrength = 0;
    }
  }

  contains(x, y) {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    return dx * dx + dy * dy <= PICKUP_RADIUS * PICKUP_RADIUS;
  }

  destroy() {
    this.sprite.destroy();
  }
}
