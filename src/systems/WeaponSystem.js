import { WEAPONS } from '../data/weapons.js';
import { Projectile } from '../entities/Projectile.js';
import { ObjectPool } from './Pools.js';

// 3-slot weapon inventory (max slots configurable via constructor). Both
// melee and ranged live in the same slots — the only difference is that
// ranged weapons consume ammo on fire and melee weapons do not.
//
// Ammo is per-slot, per-weapon, and does NOT reset on switch. An out-of-ammo
// weapon stays equipped; tryFire() returns { fired: false, reason: 'noAmmo' }
// and the caller can decide what to do (nothing, for now).
//
// One shared projectile pool per weapon ID, lazily created. Inactive
// projectiles are reused forever.
export class WeaponSystem {
  constructor(scene, startingWeaponIds, maxSlots = 3) {
    this.scene = scene;
    this.maxSlots = maxSlots;
    this.slots = [];
    this.selectedIndex = 0;
    this.pools = new Map();

    for (const id of startingWeaponIds) {
      this.addWeapon(id);
    }
    if (this.slots.length === 0) {
      throw new Error('WeaponSystem: inventory is empty');
    }
  }

  // Adds a weapon to the first empty slot. If full, drops the currently
  // selected weapon and puts the new one in its place. Returns
  // { added: true, dropped: weaponId|null }. The dropped weapon is not
  // placed in the world here — pickups (patch 2) handle that.
  addWeapon(weaponId) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) throw new Error(`WeaponSystem: unknown weapon "${weaponId}"`);
    const slot = {
      weaponId,
      ammo: weapon.type === 'ranged' ? weapon.ammo.starting : null,
      lastFireAtMs: -Infinity
    };
    if (this.slots.length < this.maxSlots) {
      this.slots.push(slot);
      return { added: true, dropped: null };
    }
    const dropped = this.slots[this.selectedIndex].weaponId;
    this.slots[this.selectedIndex] = slot;
    return { added: true, dropped };
  }

  selectNext() {
    if (this.slots.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.slots.length;
  }

  selectIndex(i) {
    if (i >= 0 && i < this.slots.length) this.selectedIndex = i;
  }

  get current() {
    return this.slots[this.selectedIndex];
  }

  get currentWeapon() {
    return WEAPONS[this.current.weaponId];
  }

  get currentAmmo() {
    return this.current.ammo;
  }

  // Returns { fired: bool, reason?: string, type?, weapon?, slot? }.
  // On fired:true, all side effects (ammo decrement, projectile spawns)
  // have already happened. Melee side effects (arc visual, hit detection)
  // are the caller's job — tryFire cannot know about scene targets.
  tryFire(time, x, y, aimX, aimY) {
    const slot = this.current;
    const weapon = WEAPONS[slot.weaponId];
    const cooldown = 1000 / weapon.fireRate;
    if (time - slot.lastFireAtMs < cooldown) return { fired: false, reason: 'cooldown' };

    if (weapon.type === 'ranged' && slot.ammo <= 0) {
      return { fired: false, reason: 'noAmmo' };
    }

    slot.lastFireAtMs = time;

    if (weapon.type === 'melee') {
      return { fired: true, type: 'melee', weapon, slot };
    }

    slot.ammo -= 1;
    const pellets = weapon.pellets || 1;
    const pool = this.getPool(weapon);
    for (let i = 0; i < pellets; i++) {
      const proj = pool.acquire();
      if (!proj) break; // pool exhausted; tolerate
      let dx = aimX;
      let dy = aimY;
      const spread = weapon.spread || 0;
      if (spread > 0) {
        const jitter = (Math.random() * 2 - 1) * spread;
        const cs = Math.cos(jitter);
        const sn = Math.sin(jitter);
        dx = aimX * cs - aimY * sn;
        dy = aimX * sn + aimY * cs;
      }
      proj.spawn(x, y, dx * proj.speed, dy * proj.speed);
    }
    return { fired: true, type: 'ranged', weapon, slot };
  }

  getPool(weapon) {
    if (!this.pools.has(weapon.id)) {
      this.pools.set(
        weapon.id,
        new ObjectPool(() => new Projectile(this.scene, weapon), 128)
      );
    }
    return this.pools.get(weapon.id);
  }

  update(dt) {
    for (const pool of this.pools.values()) {
      pool.forEachActive((p) => p.update(dt));
    }
  }

  forEachActiveProjectile(fn) {
    for (const pool of this.pools.values()) {
      pool.forEachActive(fn);
    }
  }

  countActiveBullets() {
    let n = 0;
    for (const pool of this.pools.values()) n += pool.countActive();
    return n;
  }
}
