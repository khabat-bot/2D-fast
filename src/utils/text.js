// Text helper. Every text object goes through pixelText() so the whole game
// uses the m6x11 bitmap font and nothing else.
//
// Why a bitmap font and not this.add.text():
//   this.add.text() renders a system font into a canvas texture. The browser
//   anti-aliases every glyph edge. When Phaser then CSS-upscales that texture
//   to fill the phone screen at a non-integer factor, those grey anti-alias
//   pixels get stretched into unreadable blobs. A bitmap font has no
//   anti-aliasing to smear - its pixels are already solid - so the same
//   upscale just makes them chunkier, which is what pixel-art text should
//   look like.
//
// m6x11 is designed for multiples of 16. Sizes 16, 32, 48 are safe.
// Other sizes are technically possible but the glyphs are not designed for
// them; stick to the multiples unless you have a reason.
export const FONT_KEY = 'm6x11';
export const FONT_SIZE = 16;

export function pixelText(scene, x, y, str, opts = {}) {
  const size = opts.size ?? FONT_SIZE;
  const color = opts.color ?? '#ffffff';
  const origin = opts.origin; // e.g. [0.5, 0.5]

  const t = scene.add.bitmapText(x, y, FONT_KEY, str, size);
  t.setTint(Phaser.Display.Color.HexStringToColor(color).color);
  if (origin) t.setOrigin(origin[0], origin[1]);
  return t;
}
