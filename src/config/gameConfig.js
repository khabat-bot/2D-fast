// 390x180 = 19.5:9, the iPhone aspect ratio. With Scale.FIT this fills
// the screen on a modern iPhone with zero letterbox. Text is a bitmap
// font (m6x11), so the non-integer upscale only makes glyphs chunky,
// not blurry - there is no anti-aliasing to smear.
//
// If a future device is 16:9 (e.g. an older SE), Scale.FIT letterboxes
// automatically. Do not switch to Scale.NONE + integer scaling: that
// reintroduces the letterbox on this phone.
export const GAME_CONFIG = {
  width: 390,
  height: 180,
  backgroundColor: '#000000'
};
