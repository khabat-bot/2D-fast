import { placeholderFor } from '../utils/placeholders.js';
import { pixelText } from '../utils/text.js';
import { WEAPONS } from '../data/weapons.js';
import { PICKUP_PHYSICS } from '../config/pickupConfig.js';

const PICKUP_DEPTH  = 40;
const PICKUP_RADIUS = 20;

export const WEAPON_PICKUP_SIZE = 14;
export const AMMO_PICKUP_SIZE   = 12;

const OUTLINE_PAD = 3;             // px the outline extends past the sprite
const OUTLINE_COLOR = 0xffee00;
const OUTLINE_PULSE_MS = 500;      // one full bright->dim->bright cycle

// Shared outline creation. Returns a rectangle outline that hides by default.
function makeOutline(scene, x, y, w, h) {
  return scene.add
    .rectangle(x, y, w + OUTLINE_PAD * 2, h + OUTLINE_PAD * 2, 0x000000, 0)
    .setStrokeStyle(1, OUTLINE_COLOR, 1)
    .setDepth(PICKUP_DEPTH - 1)
    .setVisible(false);
}

// Applies pulse to a pickup outline. Caller passes nowMs (scene time) so
// this stays deterministic under pause / hot-reload.
function applyPulse(outline, nowMs) {
  if (!outline.visible) return;
  const phase = (nowMs % OUTLINE_PULSE_MS) / OUTLINE_PULSE_MS;      // 0..1
  const tri = 1 - Math.abs(phase * 2 - 1);                          // 0->1->0
  outline.setStrokeStyle(1, OUTLINE_COLOR, 0.45 + 0.55 * tri);
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

    // Physics state. At rest initially - whoever creates the pickup can
    // give it velocity (spawnDroppedWeapon does).
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

    this.outline = makeOutline(scene, x, y, this.width, this.height);

    this.label = pixelText(scene, x, y - 14, weapon.name, {
      size: 16, color: '#ffffff', origin: [0.5, 1]
    }).setDepth(PICKUP_DEPTH + 1);
  }

  // Called by GameScene each frame with the floor Y and wall bounds.
  update(dt, groundY, minX, maxX) {
    if (this.collected) return;

    const P = PICKUP_PHYSICS;
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    // Gravity only while airborne.
    if (!this.onGround) {
      this.vy += P.gravity * dt;
    }

    // Integrate.
    this.sprite.x += this.vx * dt;
    this.sprite.y += this.vy * dt;

    // Floor collision.
    if (this.sprite.y + halfH >= groundY) {
      this.sprite.y = groundY - halfH;
      if (this.vy > P.restVy) {
        this.vy = -this.vy * P.bounce;
      } else {
        this.vy = 0;
        this.onGround = true;
      }
      // High ground friction. dt-scaled so it behaves the same at any fps.
      this.vx *= Math.pow(P.groundFrictionPerFrame, dt * 60);
      if (Math.abs(this.vx) < P.restVx) this.vx = 0;
    } else if (this.sprite.y + halfH < groundY - 0.5) {
      // Only unset onGround if we are meaningfully above the floor. A
      // half-pixel float check prevents flicker from rounding.
      this.onGround = false;
    }

    // Wall collisions.
    if (this.sprite.x - halfW < minX) {
      this.sprite.x = minX + halfW;
      this.vx = -this.vx * P.bounce;
    } else if (this.sprite.x + halfW > maxX) {
      this.sprite.x = maxX - halfW;
      this.vx = -this.vx * P.bounce;
    }

    // Keep visuals attached.
    this.outline.setPosition(this.sprite.x, this.sprite.y);
    this.label.setPosition(this.sprite.x, this.sprite.y - 14);
  }

  setInRange(inRange, nowMs) {
    if (this.collected) {
      if (this.outline.visible) this.outline.setVisible(false);
      return;
    }
    if (this.outline.visible !== inRange) this.outline.setVisible(inRange);
    if (inRange) applyPulse(this.outline, nowMs);
  }

  contains(x, y) {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    return dx * dx + dy * dy <= PICKUP_RADIUS * PICKUP_RADIUS;
  }

  destroy() {
    this.sprite.destroy();
    this.outline.destroy();
    this.label.destroy();
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

    this.outline = makeOutline(scene, x, y, this.width, this.height);

    this.label = pixelText(scene, x, y - 14, 'AMMO', {
      size: 16, color: '#ffffff', origin: [0.5, 1]
    }).setDepth(PICKUP_DEPTH + 1);
  }

  // Ammo is currently static (never dropped). Signature matches
  // WeaponPickup so GameScene can call both the same way.
  update(_dt, _groundY, _minX, _maxX) { /* no-op */ }

  setInRange(inRange, nowMs) {
    if (this.collected) {
      if (this.outline.visible) this.outline.setVisible(false);
      return;
    }
    if (this.outline.visible !== inRange) this.outline.setVisible(inRange);
    if (inRange) applyPulse(this.outline, nowMs);
  }

  contains(x, y) {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    return dx * dx + dy * dy <= PICKUP_RADIUS * PICKUP_RADIUS;
  }

  destroy() {
    this.sprite.destroy();
    this.outline.destroy();
    this.label.destroy();
  }
}
