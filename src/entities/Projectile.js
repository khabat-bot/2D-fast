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

    const oldX = this.sprite.x;
    const oldY = this.sprite.y;
    this.sprite.x += this.vx * dt;
    this.sprite.y += this.vy * dt;

    // Swept tile collision. Fast bullets (e.g. sniper) can move more than
    // one tile per frame, so a plain end-position check tunnels through
    // walls. Sample points along the line old->new at half-tile spacing.
    // Any '#' sample = hit wall = deactivate. One-way '=' tiles are
    // ignored (bullets pass through ledges).
    const room = this.scene.room;
    if (room && this._sweptHitsSolid(room, oldX, oldY)) {
      this.deactivate();
      return;
    }

    // Bounds: use ROOM bounds when available, not viewport. The viewport
    // is 390x180 (visible area) while the room is 640x256 (world size).
    // Checking viewport coords against world coords despawned every
    // bullet that left the visible area, even inside the room.
    let minX = -30, maxX = this.scene.scale.width + 30;
    let minY = -30, maxY = this.scene.scale.height + 30;
    if (room && typeof room.getBounds === 'function') {
      const b = room.getBounds();
      minX = b.x - 30;
      maxX = b.x + b.w + 30;
      minY = b.y - 30;
      maxY = b.y + b.h + 30;
    }
    if (this.sprite.x < minX || this.sprite.x > maxX ||
        this.sprite.y < minY || this.sprite.y > maxY) {
      this.deactivate();
    }
  }

  // Sample points along the segment (oldX,oldY)->(sprite.x,sprite.y) and
  // return true if any of them lands on a solid '#' tile. Step size is
  // half a tile so a 16px tile cannot be skipped regardless of speed.
  _sweptHitsSolid(room, oldX, oldY) {
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;
    const dx = this.sprite.x - oldX;
    const dy = this.sprite.y - oldY;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / (ts / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = oldX + dx * t;
      const py = oldY + dy * t;
      const c = Math.floor((px - ox) / ts);
      const r = Math.floor((py - oy) / ts);
      if (room.cellAt(c, r) === '#') return true;
    }
    return false;
  }

  deactivate() {
    this.active = false;
    this.sprite.setVisible(false);
  }
}
