import { Enemy } from '../Enemy.js';
import { placeholderFor } from '../../utils/placeholders.js';
import { ENEMIES } from '../../data/enemies.js';

// Knockback tuning. Applied in onHit (damage-scaled, capped). Decays
// exponentially on knockbackVx (~300ms to near-zero). Vertical hop is a
// ballistic arc under gravity; the walker lands at restY.
const KNOCKBACK_H_PER_DMG = 10;   // px/s of push per point of damage
const KNOCKBACK_H_MAX     = 300;  // cap so heavy hits plateau
const KNOCKBACK_V_MIN     = 100;  // minimum upward pop (so light hits still hop)
const KNOCKBACK_V_PER_DMG = 5;    // extra pop per damage point
const KNOCKBACK_V_MAX     = 220;  // cap on the hop
const KNOCKBACK_DECAY     = 12;   // exp(-DECAY * dt); ~83ms time constant
const KNOCKBACK_H_CAP     = 400;  // total horizontal cap after additivity
const GRAVITY             = 800;  // px/s^2 while airborne

// Walker: patrols between bounds on the ground. On hit, gets pushed back
// horizontally (decaying), hops up (ballistic), and patrol is paused while
// airborne. Lands at restY. If the knockback pushes the walker into a wall,
// the knockback component in that direction is zeroed (patrol still flips,
// which is what you want: the walker ends up walking away from the wall).
export class Walker extends Enemy {
  constructor(scene, x, y, bounds) {
    const def = ENEMIES.walker;
    super(scene, { hp: def.hp, width: def.width, height: def.height });
    this.def = def;
    this.bounds = bounds;
    this.restY = y;                 // sprite center Y while grounded
    this.vx = def.speed;            // patrol velocity
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.onGround = true;
    this.sprite = placeholderFor(scene, 'enemy.walker', {
      category: 'enemy',
      width: def.width,
      height: def.height,
      x, y,
      color: def.color
    });
  }

  onHit(damage, fromX) {
    if (fromX === null) return;
    const dir = this.sprite.x >= fromX ? 1 : -1;
    const push = Math.min(damage * KNOCKBACK_H_PER_DMG, KNOCKBACK_H_MAX);
    this.knockbackVx += dir * push;
    if (this.knockbackVx >  KNOCKBACK_H_CAP) this.knockbackVx =  KNOCKBACK_H_CAP;
    if (this.knockbackVx < -KNOCKBACK_H_CAP) this.knockbackVx = -KNOCKBACK_H_CAP;
    const pop = Math.max(KNOCKBACK_V_MIN,
                Math.min(damage * KNOCKBACK_V_PER_DMG, KNOCKBACK_V_MAX));
    this.knockbackVy = -pop;
    this.onGround = false;
  }

  update(dt, ctx) {
    super.update(dt, ctx);
    if (!this.alive) return;

    const halfW = this.width / 2;

    // Vertical: ballistic while airborne. Landing check only when falling
    // (vy >= 0) so we don't instantly land on the frame that just launched
    // the walker upward.
    if (!this.onGround) {
      this.knockbackVy += GRAVITY * dt;
      this.sprite.y += this.knockbackVy * dt;
      if (this.knockbackVy >= 0 && this.sprite.y >= this.restY) {
        this.sprite.y = this.restY;
        this.knockbackVy = 0;
        this.onGround = true;
      }
    }

    // Horizontal: patrol only while grounded. Knockback applies always.
    const patrolVx = this.onGround ? this.vx : 0;
    this.sprite.x += (patrolVx + this.knockbackVx) * dt;

    // Decay knockback velocity. Exponential so it feels snappy but visible.
    if (this.knockbackVx !== 0) {
      this.knockbackVx *= Math.exp(-KNOCKBACK_DECAY * dt);
      if (Math.abs(this.knockbackVx) < 5) this.knockbackVx = 0;
    }

    // Bounds. Zero the knockback component that is pushing into the wall
    // so patrol can still flip the direction cleanly (no infinite flip).
    if (this.sprite.x - halfW < this.bounds.minX) {
      this.sprite.x = this.bounds.minX + halfW;
      if (this.knockbackVx < 0) this.knockbackVx = 0;
      this.vx = Math.abs(this.vx);
    } else if (this.sprite.x + halfW > this.bounds.maxX) {
      this.sprite.x = this.bounds.maxX - halfW;
      if (this.knockbackVx > 0) this.knockbackVx = 0;
      this.vx = -Math.abs(this.vx);
    }
  }
}
