import { Enemy } from '../Enemy.js';
import { placeholderFor } from '../../utils/placeholders.js';
import { ENEMIES } from '../../data/enemies.js';

// Simplest enemy: walks left/right between bounds, flips at each edge.
// No gravity (stays at spawn Y); the game is currently a single flat floor,
// so this is enough. When rooms land (section 3), gravity + tile collision
// will be added here.
export class Walker extends Enemy {
  constructor(scene, x, y, bounds) {
    const def = ENEMIES.walker;
    super(scene, { hp: def.hp, width: def.width, height: def.height });
    this.def = def;
    this.bounds = bounds;                 // { minX, maxX }
    this.vx = def.speed;                  // start moving right
    this.sprite = placeholderFor(scene, 'enemy.walker', {
      category: 'enemy',
      width: def.width,
      height: def.height,
      x, y,
      color: def.color
    });
  }

  update(dt, ctx) {
    super.update(dt, ctx);
    if (!this.alive) return;
    const halfW = this.width / 2;
    this.sprite.x += this.vx * dt;
    if (this.sprite.x - halfW < this.bounds.minX) {
      this.sprite.x = this.bounds.minX + halfW;
      this.vx = Math.abs(this.vx);
    } else if (this.sprite.x + halfW > this.bounds.maxX) {
      this.sprite.x = this.bounds.maxX - halfW;
      this.vx = -Math.abs(this.vx);
    }
  }
}
