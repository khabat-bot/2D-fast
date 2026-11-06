// Player physics. Every number here is in internal game pixels (game renders
// at 390x180 and CSS-scales to the phone viewport). Edit values; Vite
// hot-reloads. Feel tuning is expected to happen here.

export const PLAYER_W = 24;
export const PLAYER_H = 32;

// Horizontal movement: target speed, how fast to reach it, how fast to stop.
export const MOVE_SPEED    = 200;   // px/s max horizontal
export const MOVE_ACCEL    = 1600;  // px/s^2 while input held
export const MOVE_FRICTION = 2000;  // px/s^2 while no input

// Vertical: gravity, jump, terminal velocity.
export const GRAVITY         = 1000;
export const JUMP_VELOCITY   = -340; // negative = up. peak ~= v^2/(2g) ~= 58px
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
