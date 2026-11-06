import { Enemy } from '../Enemy.js';
import { placeholderFor } from '../../utils/placeholders.js';
import { ENEMIES } from '../../data/enemies.js';
import { WALKER_AGGRO, WALKER_CHASE } from '../../config/walkerConfig.js';

// Knockback tuning. Horizontal push decays exponentially; vertical pop
// is a shared jump impulse applied to vy (see onHit).
const KNOCKBACK_H_PER_DMG = 10;
const KNOCKBACK_H_MAX     = 300;
const KNOCKBACK_V_MIN     = 100;
const KNOCKBACK_V_PER_DMG = 5;
const KNOCKBACK_V_MAX     = 220;
const KNOCKBACK_DECAY     = 12;
const KNOCKBACK_H_CAP     = 400;
const GRAVITY             = 800;

// Walker: patrols between walls and ledge edges. When the player is
// within aggro range with clear line-of-sight, chases the player at
// speedMult speed. Jumps over walls, gaps, or up to reach the player.
// Chasing walkers walk off ledges on purpose to reach players below.
// No pathfinding: a walker that cannot reach the player paces nearby.
//
// Physics: shared vy for both knockback pops and AI jumps. Real gravity.
// Lands on the first solid '#' or '=' tile below the feet. Loses track
// of a fixed restY, but that is fine - only the current floor matters.
export class Walker extends Enemy {
  constructor(scene, x, y, room) {
    const def = ENEMIES.walker;
    super(scene, { hp: def.hp, width: def.width, height: def.height });
    this.def = def;
    this.room = room;
    this.restY = y;                 // last known grounded center Y
    this.vx = def.speed;            // patrol velocity
    this.vy = 0;                    // vertical velocity (shared knockback+jump)
    this.knockbackVx = 0;
    this.onGround = true;
    this.aggro = false;
    this.lastAggroAt = 0;
    this.jumpCooldownUntil = 0;
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
    // Additive: a small knockback doesn't cancel a bigger jump.
    if (this.vy > -pop) this.vy = -pop;
    this.onGround = false;
  }

  update(dt, ctx) {
    super.update(dt, ctx);
    if (!this.alive) return;

    const halfW = this.width / 2;
    const player = this.scene && this.scene.player;

    this._updateAggro(player);

    // Walked off a ledge? onGround flag would still be true from before.
    if (this.onGround && !this._isOnFloor(halfW)) {
      this.onGround = false;
    }

    // Vertical physics: gravity + landing on the first solid tile below.
    if (!this.onGround) {
      const oldFeetY = this.sprite.y + this.height / 2;
      this.vy += GRAVITY * dt;
      this.sprite.y += this.vy * dt;
      if (this.vy >= 0) {
        const newFeetY = this.sprite.y + this.height / 2;
        this._tryLandOnFloor(halfW, oldFeetY, newFeetY);
      }
    }

    // Horizontal movement.
    let desiredVx;
    if (this.aggro && player && player.alive) {
      desiredVx = this._chaseVx(player);
    } else {
      desiredVx = this.onGround ? this.vx : 0;
    }
    const prevX = this.sprite.x;
    this.sprite.x += (desiredVx + this.knockbackVx) * dt;

    this._resolveHorizontal(halfW, prevX);

    if (this.knockbackVx !== 0) {
      this.knockbackVx *= Math.exp(-KNOCKBACK_DECAY * dt);
      if (Math.abs(this.knockbackVx) < 5) this.knockbackVx = 0;
    }

    // Patrol: turn at ledges. Skipped while chasing - chasing walkers
    // walk off ledges on purpose.
    if (!this.aggro && this.onGround && Math.abs(this.knockbackVx) < 5) {
      this._checkLedgeAhead(halfW);
    }

    // Chase: jump over walls, gaps, or up to reach the player.
    if (this.aggro && this.onGround && Math.abs(this.knockbackVx) < 5) {
      this._chaseJumpDecision(halfW, player);
    }
  }

  // --- AI -----------------------------------------------------------------

  _updateAggro(player) {
    if (!player || !player.alive) {
      this.aggro = false;
      return;
    }
    const pdx = player.sprite.x - this.sprite.x;
    const pdy = player.sprite.y - this.sprite.y;
    const inRange = Math.abs(pdx) < WALKER_AGGRO.rangeX &&
                    Math.abs(pdy) < WALKER_AGGRO.rangeY;
    const now = this.scene.time.now;
    if (inRange && this._hasLineOfSight(player.sprite.x, player.sprite.y)) {
      this.aggro = true;
      this.lastAggroAt = now;
    } else if (this.aggro && now - this.lastAggroAt > WALKER_AGGRO.deaggroMs) {
      this.aggro = false;
    }
  }

  _hasLineOfSight(targetX, targetY) {
    const room = this.room;
    if (!room) return true;
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;
    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / (ts / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = this.sprite.x + dx * t;
      const py = this.sprite.y + dy * t;
      const c = Math.floor((px - ox) / ts);
      const r = Math.floor((py - oy) / ts);
      if (room.cellAt(c, r) === '#') return false;
    }
    return true;
  }

  _chaseVx(player) {
    const dx = player.sprite.x - this.sprite.x;
    if (Math.abs(dx) < 4) return 0;
    const dir = dx > 0 ? 1 : -1;
    return dir * this.def.speed * WALKER_CHASE.speedMult;
  }

  _chaseJumpDecision(halfW, player) {
    const room = this.room;
    if (!room || !player) return;
    const now = this.scene.time.now;
    if (now < this.jumpCooldownUntil) return;

    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;

    const dx = player.sprite.x - this.sprite.x;
    const dy = player.sprite.y - this.sprite.y;
    const dir = dx > 0 ? 1 : -1;

    const feetY = this.sprite.y + this.height / 2 - 0.001;
    const headY = this.sprite.y - this.height / 2 + 0.001;
    const feetRow = Math.floor((feetY - oy) / ts);
    const headRow  = Math.floor((headY  - oy) / ts);
    const belowRow = feetRow + 1;

    const leadingEdgeX = dir > 0 ? this.sprite.x + halfW : this.sprite.x - halfW;
    const edgeCol = Math.floor((leadingEdgeX - ox) / ts);
    const aheadCol = dir > 0 ? edgeCol + 1 : edgeCol - 1;

    // Player is significantly below: walk off ledge, don't jump.
    if (dy > this.height * 0.6) return;

    // Player meaningfully above AND close horizontally: jump up to
    // reach them. The horizontal proximity check is what stops long-range
    // jump spam. Without it, a walker 200px away from a player 12px
    // higher would jump in place every 500ms forever.
    if (dy < -WALKER_CHASE.playerAboveMinPx &&
        Math.abs(dx) < WALKER_CHASE.playerAboveRangeX) {
      this._doJump();
      return;
    }

    // Wall directly ahead? Jump.
    let wallAhead = false;
    for (let r = headRow; r <= feetRow; r++) {
      if (room.cellAt(aheadCol, r) === '#') { wallAhead = true; break; }
    }
    if (wallAhead) { this._doJump(); return; }

    // Gap ahead (no floor under the leading tile)? Jump.
    const belowAhead = room.cellAt(aheadCol, belowRow);
    if (belowAhead !== '#' && belowAhead !== '=') { this._doJump(); return; }
  }

  _doJump() {
    // Peak height under constant gravity: h = v^2 / (2 * g), so
    // v = sqrt(2 * g * h). Config exposes jumpHeightPx directly, so
    // changing the number in walkerConfig.js changes peak height 1:1.
    const h = WALKER_CHASE.jumpHeightPx;
    this.vy = -Math.sqrt(2 * GRAVITY * h);
    this.onGround = false;
    this.jumpCooldownUntil = this.scene.time.now + WALKER_CHASE.jumpCooldownMs;
  }

  // --- tile physics -------------------------------------------------------

  // True if there's a solid '#' or '=' tile directly under the feet.
  _isOnFloor(halfW) {
    const room = this.room;
    if (!room) return true;
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;
    const feetY = this.sprite.y + this.height / 2 + 0.001;
    const leftCol  = Math.floor((this.sprite.x - halfW - ox) / ts);
    const rightCol = Math.floor((this.sprite.x + halfW - ox - 0.001) / ts);
    const feetRow  = Math.floor((feetY - oy) / ts);
    for (let c = leftCol; c <= rightCol; c++) {
      const cell = room.cellAt(c, feetRow);
      if (cell === '#' || cell === '=') return true;
    }
    return false;
  }

  // Snap to the top of the first solid tile crossed between oldFeetY and
  // newFeetY. Works for both '#' and '=' (walkers stand on one-ways).
  _tryLandOnFloor(halfW, oldFeetY, newFeetY) {
    const room = this.room;
    if (!room) return;
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;

    const leftCol  = Math.floor((this.sprite.x - halfW - ox) / ts);
    const rightCol = Math.floor((this.sprite.x + halfW - ox - 0.001) / ts);
    const oldRow = Math.floor((oldFeetY - oy) / ts);
    const newRow = Math.floor((newFeetY - oy) / ts);
    if (newRow < oldRow) return;

    for (let r = oldRow; r <= newRow; r++) {
      for (let c = leftCol; c <= rightCol; c++) {
        const cell = room.cellAt(c, r);
        if (cell === '#' || cell === '=') {
          this.sprite.y = oy + r * ts - this.height / 2;
          this.vy = 0;
          this.onGround = true;
          this.restY = this.sprite.y;
          return;
        }
      }
    }
  }

  _resolveHorizontal(halfW, prevX) {
    const room = this.room;
    if (!room) return;
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;

    const feetY = this.sprite.y + this.height / 2 - 0.001;
    const topY  = this.sprite.y - this.height / 2;
    const rowStart = Math.floor((topY  - oy) / ts);
    const rowEnd   = Math.floor((feetY - oy) / ts);
    const leftCol  = Math.floor((this.sprite.x - halfW - ox) / ts);
    const rightCol = Math.floor((this.sprite.x + halfW - ox - 0.001) / ts);

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = leftCol; c <= rightCol; c++) {
        if (room.cellAt(c, r) !== '#') continue;
        const tileLeftEdge  = ox + c * ts;
        const tileRightEdge = ox + (c + 1) * ts;
        const tileCenterX   = tileLeftEdge + ts / 2;
        if (prevX <= tileCenterX) {
          this.sprite.x = tileLeftEdge - halfW;
          this.vx = -Math.abs(this.vx);
          if (this.knockbackVx > 0) this.knockbackVx = 0;
        } else {
          this.sprite.x = tileRightEdge + halfW;
          this.vx = Math.abs(this.vx);
          if (this.knockbackVx < 0) this.knockbackVx = 0;
        }
        return;
      }
    }
  }

  _checkLedgeAhead(halfW) {
    const room = this.room;
    if (!room) return;
    const ts = room.tileSize;
    const ox = room.offsetX;
    const oy = room.offsetY;

    const dir = this.vx > 0 ? 1 : (this.vx < 0 ? -1 : 0);
    if (dir === 0) return;

    const feetY = this.sprite.y + this.height / 2 - 0.001;
    const feetRow = Math.floor((feetY - oy) / ts);
    const belowRow = feetRow + 1;

    const leadingEdgeX = dir > 0
      ? this.sprite.x + halfW
      : this.sprite.x - halfW;
    const aheadCol = dir > 0
      ? Math.floor((leadingEdgeX - ox) / ts) + 1
      : Math.floor((leadingEdgeX - ox) / ts) - 1;

    const below = room.cellAt(aheadCol, belowRow);
    if (below !== '#' && below !== '=') {
      this.vx = -this.vx;
    }
  }
}
