// Weapon definitions. Data only - no logic. WeaponSystem reads these.
//
// Types:
//   'melee'  — no ammo, swing arc hits targets in range. Cooldown via fireRate.
//   'ranged' — fires projectile(s), consumes ammo. Cooldown via fireRate.
//
// Adding a weapon = one entry. Placeholders and bullets are generated from
// these numbers. Real art, when it exists, is picked up automatically under
// a key like 'proj.pistol' via placeholderFor's real-art fallback.
//
// Common fields:
//   id, name          identity
//   type              'melee' | 'ranged'
//   fireRate          trigger pulls per second (cooldown = 1000/fireRate ms)
//   color             for future icon/HUD, not used yet
//   recoil            optional. Patch 3 will implement:
//                       playerPush      px knockback per shot
//                       shake           ms camera shake
//                       shakeIntensity  0..1 camera shake intensity
//
// Melee fields:
//   melee.range       px from player center the arc extends
//   melee.arcDegrees  total arc width (e.g. 90 = +/-45 deg from aim)
//   melee.damage      HP per hit (used once section 5 enemies exist)
//
// Ranged fields:
//   projectile.*      bullet shape and speed (see Projectile.js)
//   spread            radians, random deviation per shot (0 = accurate)
//   pellets           count per trigger pull (default 1). One ammo per pull.
//   ammo.max          ammo capacity
//   ammo.starting     ammo on pickup / initial
//
// No reloading. Ammo depletes on fire, weapon stays equipped but useless
// at 0. Refill via ammo pickups (patch 2).
export const WEAPONS = {
  // Fists: implicit fallback weapon. Never in any inventory, cannot be
  // dropped, not in STARTING_WEAPONS. WeaponSystem.current returns a
  // synthetic fists slot when slots is empty so a fully-dropped player
  // can still fight (weakly).
  fists: {
    id: 'fists', name: 'Fists', type: 'melee',
    fireRate: 3,
    melee: { range: 26, arcDegrees: 80, damage: 5 },
    color: 0xcccccc
  },

  // --- melee ---------------------------------------------------------------
  sword: {
    id: 'sword', name: 'Sword', type: 'melee',
    fireRate: 2.5,
    melee: { range: 28, arcDegrees: 90, damage: 15 },
    color: 0x90a4ae
  },
  dagger: {
    id: 'dagger', name: 'Dagger', type: 'melee',
    fireRate: 5,
    melee: { range: 20, arcDegrees: 60, damage: 8 },
    color: 0xb0bec5
  },
  hammer: {
    id: 'hammer', name: 'Hammer', type: 'melee',
    fireRate: 1.2,
    melee: { range: 32, arcDegrees: 100, damage: 40 },
    color: 0x795548,
    recoil: { shake: 150, shakeIntensity: 0.015 }   // patch 3
  },
  spear: {
    id: 'spear', name: 'Spear', type: 'melee',
    fireRate: 1.8,
    melee: { range: 44, arcDegrees: 30, damage: 20 },
    color: 0x8d6e63
  },

  // --- ranged --------------------------------------------------------------
  pistol: {
    id: 'pistol', name: 'Pistol', type: 'ranged',
    fireRate: 6, spread: 0, pellets: 1,
    projectile: { width: 8, height: 4, color: 0xffeb3b, speed: 500, lifetime: 1200, damage: 10 },
    ammo: { max: 30, starting: 30 },
    color: 0xffeb3b
  },
  smg: {
    id: 'smg', name: 'SMG', type: 'ranged',
    fireRate: 12, spread: 0.15, pellets: 1,
    projectile: { width: 6, height: 3, color: 0xff9800, speed: 550, lifetime: 1000, damage: 5 },
    ammo: { max: 60, starting: 60 },
    color: 0xff9800
  },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', type: 'ranged',
    fireRate: 1.5, spread: 0.25, pellets: 5,
    projectile: { width: 6, height: 4, color: 0xff5722, speed: 450, lifetime: 800, damage: 8 },
    ammo: { max: 15, starting: 15 },
    color: 0xff5722,
    recoil: { playerPush: 5, shake: 100, shakeIntensity: 0.01 }  // patch 3
  },
  rifle: {
    id: 'rifle', name: 'Rifle', type: 'ranged',
    fireRate: 2, spread: 0.02, pellets: 1,
    projectile: { width: 12, height: 3, color: 0x4caf50, speed: 700, lifetime: 1500, damage: 20 },
    ammo: { max: 20, starting: 20 },
    color: 0x4caf50
  },
  sniper: {
    id: 'sniper', name: 'Sniper', type: 'ranged',
    fireRate: 0.8, spread: 0, pellets: 1,
    projectile: { width: 20, height: 2, color: 0x2196f3, speed: 1200, lifetime: 2000, damage: 60 },
    ammo: { max: 8, starting: 8 },
    color: 0x2196f3,
    recoil: { playerPush: 8, shake: 200, shakeIntensity: 0.02 }  // patch 3
  },
  rocket: {
    id: 'rocket', name: 'Rocket', type: 'ranged',
    fireRate: 0.5, spread: 0, pellets: 1,
    projectile: { width: 10, height: 6, color: 0xf44336, speed: 300, lifetime: 2000, damage: 80 },
    ammo: { max: 5, starting: 5 },
    color: 0xf44336,
    recoil: { playerPush: 12, shake: 300, shakeIntensity: 0.03 } // patch 3
  }
};

export const DEFAULT_WEAPON = 'pistol';

// What the player starts with. Up to MAX_WEAPON_SLOTS entries. Sword is
// selected first (position 0). Adjust here to change the start loadout.
export const STARTING_WEAPONS = ['sword', 'pistol', 'rifle'];
