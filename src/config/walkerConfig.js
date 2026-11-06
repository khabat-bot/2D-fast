// Walker AI tuning. Data only, no logic.
//
// Ag g r o: player must be within rangeX/rangeY of the walker AND have
// clear line-of-sight (no '#' tiles between their centers). Once aggroed,
// the walker stays aggroed for deaggroMs after the player leaves range,
// so it doesn't jitter at the boundary.
//
// Chase: walkers move at patrol speed * speedMult toward the player.
// Jump velocity is the initial upward speed in px/s. With Walker's
// GRAVITY = 800, peak jump height = jumpVelocity^2 / 1600. 320 gives
// ~64px peak = about 4 tiles of clearance (walker is 20px, wall tiles
// are 16px, so a 3-tile wall is comfortably jumpable).
// jumpCooldownMs prevents jump spam when a wall is very close.
export const WALKER_AGGRO = {
  rangeX: 220,
  rangeY: 120,
  deaggroMs: 1000
};

export const WALKER_CHASE = {
  speedMult: 1.5,

  // Peak jump height in PIXELS. Walker derives the initial upward
  // velocity from this and GRAVITY, so you can tune "how high it hops"
  // directly without doing physics. Reference:
  //   32px = 2 tiles (low hop, clears a single '#' block)
  //   40px = 2.5 tiles (default, clears a 2-tile wall)
  //   56px = 3.5 tiles (clears a 3-tile wall, feels springy)
  // Wall tiles are 16px tall; the walker itself is 20px. To clear a
  // wall of height N tiles, jumpHeightPx should be > N*16.
  jumpHeightPx: 40,

  jumpCooldownMs: 500,

  // To chase a player on a higher platform, the player must be at
  // least playerAboveMinPx above AND within playerAboveRangeX
  // horizontally. Prevents "player slightly above at long range ->
  // walker jumps in place forever".
  playerAboveMinPx: 24,       // ~1.5 tiles
  playerAboveRangeX: 48       // 3 tiles
};
