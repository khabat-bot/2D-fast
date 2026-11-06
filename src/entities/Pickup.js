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

  update(dt, groundY, minX, maxX) {
    if (this.collected) return;

    const P = PICKUP_PHYSICS;
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    if (!this.onGround) this.vy += P.gravity * dt;

    this.sprite.x += this.vx * dt;
    this.sprite.y += this.vy * dt;

    if (this.sprite.y + halfH >= groundY) {
      this.sprite.y = groundY - halfH;
      if (this.vy > P.restVy) {
        this.vy = -this.vy * P.bounce;
      } else {
        this.vy = 0;
        this.onGround = true;
      }
      this.vx *= Math.pow(P.groundFrictionPerFrame, dt * 60);
      if (Math.abs(this.vx) < P.restVx) this.vx = 0;
    } else if (this.sprite.y + halfH < groundY - 0.5) {
      this.onGround = false;
    }

    if (this.sprite.x - halfW < minX) {
      this.sprite.x = minX + halfW;
      this.vx = -this.vx * P.bounce;
    } else if (this.sprite.x + halfW > maxX) {
      this.sprite.x = maxX - halfW;
      this.vx = -this.vx * P.bounce;
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

  update(_dt, _groundY, _minX, _maxX) { /* static */ }

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
