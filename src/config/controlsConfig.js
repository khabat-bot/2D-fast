// Touch layout only. Game feel numbers (speed, jump, gravity) live in
// src/config/playerConfig.js - do not add them here.

// Joystick mode (movement mode 1). Floating stick on left half.
export const JOYSTICK_RADIUS       = 28;
export const JOYSTICK_STICK_RADIUS = 11;
export const JOYSTICK_DEADZONE     = 0.15;

// Buttons mode (movement mode 2). Two fixed circles at bottom-left.
export const BUTTON_RADIUS        = 28;
export const BUTTON_LEFT_X        = 50;
export const BUTTON_RIGHT_X       = 120;
export const BUTTON_Y_FROM_BOTTOM = 50;

// Jump button (both modes). Fixed circle at bottom-right.
export const JUMP_BUTTON_RADIUS        = 28;
export const JUMP_BUTTON_X_FROM_RIGHT  = 50;
export const JUMP_BUTTON_Y_FROM_BOTTOM = 45;

// Aim stick (modes 1, 2). Floating on the right half of the screen.
export const AIM_STICK_RADIUS       = 28;
export const AIM_STICK_STICK_RADIUS = 14;
export const AIM_STICK_DEADZONE     = 0.15;

// Fire button (mode 2 only). Fixed circle above the jump button.
export const FIRE_BUTTON_RADIUS        = 24;
export const FIRE_BUTTON_X_FROM_RIGHT  = 50;
export const FIRE_BUTTON_Y_FROM_BOTTOM = 105;

// Joystick spawn zone (mode 1 only). Fraction of screen width/height.
// The joystick spawns only when the touch falls inside the bottom-left
// quadrant (25% of screen area). This frees the top-left quadrant for
// future buttons (jump, fire, map, etc). Values are fractions of the
// canvas, not pixels.
export const JOYSTICK_ZONE_WIDTH_FRAC     = 0.5;  // x < width * this
export const JOYSTICK_ZONE_Y_START_FRAC   = 0.5;  // y > height * this
