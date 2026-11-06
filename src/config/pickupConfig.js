// Pickup collection tuning.
//
// PICKUP_COLLECT_DISTANCE is an EDGE-TO-EDGE GAP between the player's AABB
// and the pickup's AABB, in internal game pixels. It is NOT center-to-center.
//
//   0   - must overlap. Pickup mostly hidden behind the player.
//   10  - within 10 pixels of the player's edge (default). Roughly the
//         width of the player's forearm - "reachable".
//   20  - about one player-width gap.
//   40+ - practically "walk up to it" range.
//
// Overlap counts as 0, so a pickup the player is standing on is always
// collectable regardless of the distance setting.
export const PICKUP_COLLECT_DISTANCE = 10;

// Physics for dropped weapons. Simple kinematic integration in
// WeaponPickup.update() - no Phaser physics engine. Values are tuned
// for 'satisfying but fast to settle': visible bounce, little slide.
export const PICKUP_PHYSICS = {
  gravity: 800,               // px/s^2
  dropVxRange: 100,           // initial |vx| up to this, random sign
  dropVy: -120,               // initial upward kick (px/s, negative = up)
  bounce: 0.4,                // restitution on floor/wall hit (0..1)
  groundFrictionPerFrame: 0.75, // vx multiplier per frame at 60 fps
  restVy: 30,                 // |vy| below this at floor => stop bouncing
  restVx: 3                   // |vx| below this => snap to 0 (fully stopped)
};
