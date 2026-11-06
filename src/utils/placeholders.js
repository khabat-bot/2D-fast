// Placeholder rendering: solid-color rectangles sized to the hitbox, used
// for anything that has no art yet. When real art is added later under the
// same key, placeholderFor() picks it up automatically (TODO 0.12 mechanism)
// — callers never need to know whether they got real art or a placeholder.
//
// The caller passes width/height = hitbox size, which is independent of the
// sprite's visual size; physics bodies are set up separately from the sprite.

export const CATEGORY_COLORS = {
  player:     0x4fc3f7, // light blue
  enemy:      0xe53935, // red
  projectile: 0xffeb3b, // yellow
  pickup:     0xab47bc, // purple
  tile:       0x616161, // grey (visible on black)
  ui:         0x90a4ae, // blue-grey
  default:    0xffffff
};

function textureKeyFor(key, width, height, color) {
  return `ph:${key}:${width}x${height}:${color.toString(16).padStart(6, '0')}`;
}

function ensurePlaceholderTexture(scene, texKey, width, height, color) {
  // Textures live on the game's TextureManager (shared across scenes) and
  // survive scene restarts, so guard against regenerating an existing key.
  if (scene.textures.exists(texKey)) return;
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRect(0, 0, width, height);
  g.generateTexture(texKey, width, height);
  g.destroy();
}

export function placeholderFor(scene, key, opts = {}) {
  const { width, height, x = 0, y = 0 } = opts;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`placeholderFor: invalid size for "${key}": ${width}x${height}`);
  }

  // TODO 0.12 mechanism: if a real texture already exists under this key,
  // use it unchanged. No code change is needed when art is added later.
  if (scene.textures.exists(key)) {
    return scene.add.sprite(x, y, key).setOrigin(0.5);
  }

  const category = opts.category || 'default';
  const color = (opts.color != null)
    ? opts.color
    : (CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default);
  const texKey = textureKeyFor(key, width, height, color);
  ensurePlaceholderTexture(scene, texKey, width, height, color);

  return scene.add.sprite(x, y, texKey).setOrigin(0.5);
}
