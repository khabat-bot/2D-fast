// Camera follow. Tuned for the ~390x180 viewport on an iPhone in landscape.
//
// CAMERA_LERP: smoothing factor per frame. 0 = camera does not follow (frozen),
//   1 = snaps every frame (jittery). 0.10-0.15 is smooth without lag.
// CAMERA_DEADZONE_W / H: rectangle around the camera center where the player
//   can move without the camera panning. Wide horizontal (small left-right
//   motion does not pan) / small vertical (jumps do not pan the camera).
// CAMERA_LOOKAHEAD: pixels the camera shifts toward the facing direction
//   while the player is moving. 0 disables look-ahead. 40 = ~10% of viewport.
// CAMERA_LOOKAHEAD_LERP: how fast the look-ahead offset catches up when the
//   facing direction changes. Higher = snappier (can snap), lower = smoother.
export const CAMERA_LERP           = 0.3;
export const CAMERA_DEADZONE_W     = 100;
export const CAMERA_DEADZONE_H     = 40;
export const CAMERA_LOOKAHEAD      = 40;
export const CAMERA_LOOKAHEAD_LERP = 6;
