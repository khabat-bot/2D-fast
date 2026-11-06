// Camera follow. Always centered on the player, everywhere, including at
// room edges. No bounds clamp. Dropped items therefore never land under
// the fixed-screen joystick/fire/drop buttons: the player is always in the
// exact middle of the screen. Black background beyond the room bounds is
// intentional, not a bug.
//
// CAMERA_LERP: smoothing per frame. 0 = frozen, 1 = snaps every frame.
//   0.3 keeps up with movement (~11px steady-state lag) without jittering.
// CAMERA_LOOKAHEAD: pixels the camera shifts toward the facing direction.
//   0 = player always centered. Nonzero pushes the player off-center while
//   moving (useful for showing more ahead, but not what "always follow"
//   means). Tunable if desired later.
// CAMERA_LOOKAHEAD_LERP: how fast the lookahead offset catches up. Ignored
//   when CAMERA_LOOKAHEAD is 0.
export const CAMERA_LERP           = 0.3;
export const CAMERA_LOOKAHEAD      = 0;
export const CAMERA_LOOKAHEAD_LERP = 6;
