// Player physics. Every number here is in internal game pixels (game renders
// at 390x180 and CSS-scales to the phone viewport). Edit values; Vite
// hot-reloads. Feel tuning is expected to happen here.

export const PLAYER_W = 24;
export const PLAYER_H = 32;

// Horizontal movement: target speed, how fast to reach it, how fast to stop.
export const MOVE_SPEED    = 250;   // px/s max horizontal
export const MOVE_ACCEL    = 1600;  // px/s^2 while input held
export const MOVE_FRICTION = 2000;  // px/s^2 while no input

// Vertical: gravity, jump, terminal velocity.
export const GRAVITY         = 1000;
export const JUMP_VELOCITY   = -380; // negative = up. peak ~= v^2/(2g) ~= 58px
export const MAX_FALL_SPEED  = 500;
// Variable jump height: extra gravity applied while rising and the
// jump button is NOT held. Smooth deceleration curve, no abrupt snap.
// Lower = more tail after release (floatier). Higher = less tail
// (snappier stop). 2.5 keeps noticeable variable height while letting
// a quick release rise ~40% of full-jump height.
export const JUMP_RELEASE_GRAVITY_MULT = 2.5;

// Forgiveness windows (seconds). Standard platformer values.
export const COYOTE_TIME = 0.10;     // still jumpable after leaving ground
export const JUMP_BUFFER = 0.12;     // still jumps if pressed shortly before landing

// HP and damage.
// --- Movement tunables (single source of truth) ------------------------
// Toggles
export const WALL_SLIDE_ENABLED = true;   // false disables wall slide
export const WALL_JUMP_ENABLED  = true;   // false disables wall jump

// Air control multipliers (1.0 = same as ground, 0.5 = half air control)
export const AIR_ACCEL_MULT     = 1.0;
export const AIR_FRICTION_MULT  = 1.0;

// I-frame visual feel
export const IFRAME_ALPHA_LOW   = 0.4;   // alpha during flicker
export const IFRAME_FLICKER_MS  = 300;   // ms per flicker phase

// Safety-net slack for the Y clamp: how far outside the room bounds
// the player can be before being snapped back. 32 = one player height.
export const Y_BOUNDS_SLACK     = 32;

// Wall interaction (added with rooms).
export const WALL_SLIDE_SPEED = 80;    // px/s max fall speed while on wall
export const WALL_JUMP_VX     = 220;   // px/s away from wall
export const WALL_JUMP_VY     = -320;  // px/s up
export const WALL_JUMP_LOCK   = 0.15;  // seconds input is ignored after wall jump

// HP and damage.
export const PLAYER_MAX_HP          = 100;
export const PLAYER_IFRAME_MS       = 500;  // invulnerable window after a hit
export const PLAYER_HIT_FLASH_MS    = 100;   // white flash on the sprite
export const PLAYER_HIT_KNOCKBACK_X = 350;   // horizontal push away from attacker
export const PLAYER_HIT_KNOCKBACK_Y = -200;  // small upward pop

