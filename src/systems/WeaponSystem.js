import { WEAPONS } from '../data/weapons.js';
import { Projectile } from '../entities/Projectile.js';
import { ObjectPool } from './Pools.js';

// 3-slot weapon inventory (max slots configurable). Both melee and ranged
// live in the same slots - the only difference is that ranged weapons
// consume ammo on fire and melee weapons do not.
//
// addWeapon(id, ammo?) is the single entry point for "gain this weapon",
// whether from a starting loadout, a pickup, or a future room reward.
// Returns { added, dropped, merged }:
//   - merged:true  -> the weapon was already in inventory; ammo may have
//                     been upgraded (max), nothing was dropped
//   - dropped:null -> normal add (space was available)
//   - dropped:{...}-> inventory was full; the selected weapon was evicted
//                     and returned so the caller can spawn it as a pickup
//
// Ammo is per-slot and does NOT reset on switch. Out-of-ammo weapons stay
// equipped; tryFire returns reason:'noAmmo'.
export class WeaponSystem {
  constructor(scene, startingWeaponIds, maxSlots = 3) {
    this.scene = scene;
    this.maxSlots = maxSlots;
    this.slots = [];
    this.selectedIndex = 0;
    this.pools = new Map();

    // Fists: implicit fallback weapon. Never in this.slots, always
    // available when slots is empty. Its own cooldown state so a
    // punch does not share a cooldown with any weapon picked up
    // later.
    this._fistsSlot = {
      weaponId: 'fists',
      ammo: null,
      lastFireAtMs: -Infinity
    };

    for (const id of startingWeaponIds) {
      this.addWeapon(id);
    }
    // Empty startingWeaponIds is legal: fists take over.
  }

  addWeapon(weaponId, ammo = null) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) throw new Error(`WeaponSystem: unknown weapon "${weaponId}"`);

    const incomingAmmo = ammo !== null
      ? ammo
      : (weapon.type === 'ranged' ? weapon.ammo.starting : null);

    // Duplicate: merge ammo (max, capped at max). No drop, no new slot.
    for (const slot of this.slots) {
      if (slot.weaponId !== weaponId) continue;
      if (weapon.type === 'ranged' && incomingAmmo !== null && slot.ammo !== null) {
        slot.ammo = Math.min(weapon.ammo.max, Math.max(slot.ammo, incomingAmmo));
      }
      return { added: true, dropped: null, merged: true };
    }

    // Fresh slot available.
    if (this.slots.length < this.maxSlots) {
      this.slots.push({
        weaponId,
        ammo: incomingAmmo,
        lastFireAtMs: -Infinity
      });
      return { added: true, dropped: null };
    }

    // Full: evict selected, place new, return dropped state.
    const evicted = this.slots[this.selectedIndex];
    const dropped = {
      weaponId: evicted.weaponId,
      ammo: evicted.ammo
    };
    this.slots[this.selectedIndex] = {
      weaponId,
      ammo: incomingAmmo,
      lastFireAtMs: -Infinity
    };
    return { added: true, dropped };
  }

  // Refills every ranged weapon to its max. Returns true if anything was
  // changed (so the caller knows whether to consume an ammo pickup).
  refillAllRangedAmmo() {
    let changed = false;
    for (const slot of this.slots) {
      const weapon = WEAPONS[slot.weaponId];
      if (weapon.type !== 'ranged') continue;
      if (slot.ammo < weapon.ammo.max) {
        slot.ammo = weapon.ammo.max;
        changed = true;
      }
    }
    return changed;
  }

  // True if at least one ranged weapon has room. Used by GameScene to
  // decide whether an ammo pickup is worth highlighting (if false, the
  // pickup would do nothing and should not look collectable).
  hasRangedBelowMax() {
    for (const slot of this.slots) {
      const weapon = WEAPONS[slot.weaponId];
      if (weapon.type === 'ranged' && slot.ammo < weapon.ammo.max) return true;
    }
    return false;
  }

  // Removes the currently selected weapon from inventory. Returns
  // { weaponId, ammo } (the state the caller needs to spawn a world
  // pickup), or null if the inventory is empty (nothing to drop -
  // fists are implicit and cannot be dropped).
  //
  // No last-weapon guard anymore: the player CAN drop all weapons, in
  // which case current returns the implicit fists slot and the player
  // switches to weak melee punches.
  //
  // After removal, selectedIndex is clamped: if the removed slot was
  // the last one, selection moves to the new last slot (or 0 if empty).
  removeCurrent() {
    if (this.selectedIndex >= this.slots.length) return null;
    const removed = this.slots[this.selectedIndex];
    this.slots.splice(this.selectedIndex, 1);
    if (this.selectedIndex >= this.slots.length) {
      this.selectedIndex = Math.max(0, this.slots.length - 1);
    }
    return { weaponId: removed.weaponId, ammo: removed.ammo };
  }

  selectNext() {
    if (this.slots.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.slots.length;
  }

  selectIndex(i) {
    if (i >= 0 && i < this.maxSlots) this.selectedIndex = i;
  }

  // Snapshot for UI. Returns maxSlots entries, empty ones flagged so
  // the slot strip can render '-' or 'FISTS' for them.
  getSlotsView() {
    const view = [];
    for (let i = 0; i < this.maxSlots; i++) {
      const slot = this.slots[i];
      if (slot) {
        const w = WEAPONS[slot.weaponId];
        view.push({
          index: i, empty: false, name: w.name,
          ammo: slot.ammo,
          maxAmmo: w.type === 'ranged' ? w.ammo.max : null,
          color: w.color,
          isSelected: i === this.selectedIndex
        });
      } else {
        view.push({
          index: i, empty: true, name: '—',
          ammo: null, maxAmmo: null, color: 0x444444,
          isSelected: i === this.selectedIndex
        });
      }
    }
    return view;
  }

  get current() {
    // selectedIndex can point past the end when the user taps an empty
    // slot. In that case the implicit fists slot takes over.
    if (this.selectedIndex >= this.slots.length) return this._fistsSlot;
    return this.slots[this.selectedIndex];
  }
  get currentWeapon() { return WEAPONS[this.current.weaponId]; }
  get currentAmmo() { return this.current.ammo; }

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
      if (!proj) break;
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
