import {
  placeholderKeyFor,
  ensurePlaceholderTexture,
  CATEGORY_COLORS
} from '../utils/placeholders.js';

// Single pooled projectile. The sprite is created once at construction and
// re-used via the pool: spawn() repositions and shows it, deactivate() hides
// it. Nothing is created or destroyed per shot (AGENT.md performance rules).
//
// Movement and collision are computed by callers each frame from `active`,
// `vx`, `vy` and `sprite.x/y` - no Phaser physics.
export class Projectile {
  constructor(scene, weapon) {
    const p = weapon.projectile;
    const key = `proj.${weapon.id}`;
    const texKey = placeholderKeyFor(scene, key, {
      category: 'projectile',
      width: p.width,
      height: p.height,
      color: p.color
    });
    const color = p.color != null ? p.color : CATEGORY_COLORS.projectile;
    ensurePlaceholderTexture(scene, texKey, p.width, p.height, color);

    this.sprite = scene.add
      .sprite(-100, -100, texKey)
      .setOrigin(0.5)
      .setVisible(false);
    this.width = p.width;
    this.height = p.height;
    this.speed = p.speed;
    this.lifetimeMs = p.lifetime;
    this.damage = p.damage;
    this.scene = scene;

    this.active = false;
    this.vx = 0;
    this.vy = 0;
    this.ageMs = 0;
  }

  spawn(x, y, vx, vy) {
    this.active = true;
    this.vx = vx;
    this.vy = vy;
    this.ageMs = 0;
    this.sprite.setPosition(x, y).setVisible(true);
  }

  update(dt) {
    if (!this.active) return;
    this.ageMs += dt * 1000;
    if (this.ageMs >= this.lifetimeMs) { this.deactivate(); return; }
    this.sprite.x += this.vx * dt;
    this.sprite.y += this.vy * dt;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    if (this.sprite.x < -30 || this.sprite.x > w + 30 ||
        this.sprite.y < -30 || this.sprite.y > h + 30) {
      this.deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this.sprite.setVisible(false);
  }
}
