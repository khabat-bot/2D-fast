import Phaser from 'phaser';
import { placeholderFor } from '../utils/placeholders.js';
import {
  PLAYER_W, PLAYER_H,
  MOVE_SPEED, MOVE_ACCEL, MOVE_FRICTION,
  GRAVITY, JUMP_VELOCITY, MAX_FALL_SPEED, JUMP_RELEASE_GRAVITY_MULT,
  COYOTE_TIME, JUMP_BUFFER,
  WALL_SLIDE_SPEED, WALL_JUMP_VX, WALL_JUMP_VY, WALL_JUMP_LOCK,
  WALL_SLIDE_ENABLED, WALL_JUMP_ENABLED,
  AIR_ACCEL_MULT, AIR_FRICTION_MULT,
  IFRAME_ALPHA_LOW, IFRAME_FLICKER_MS, Y_BOUNDS_SLACK,
  PLAYER_MAX_HP, PLAYER_IFRAME_MS, PLAYER_HIT_FLASH_MS,
  PLAYER_HIT_KNOCKBACK_X, PLAYER_HIT_KNOCKBACK_Y
} from '../config/playerConfig.js';

function approach(current, target, step) {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return target;
}

// Player: physics + collision against the room's tile grid + HP state.
//
// Collision is AABB-vs-tile resolution: horizontal move first, then vertical.
// One-way platforms ('=') only collide on the downward Y move, and only if
// the player's feet were above the platform's top edge before the move -
// that lets the player jump through from below without snagging.
//
// Wall slide is active when airborne, falling, and touching a solid wall.
// It caps fall speed to WALL_SLIDE_SPEED.
//
// Wall jump pushes away from the touched wall. A short lockout (WALL_JUMP_LOCK)
// ignores moveX input so the push is not cancelled immediately.
export class Player {
  constructor(scene, opts) {
    this.scene = scene;
    this.room = opts.room;
    this.sprite = placeholderFor(scene, 'player', {
      category: 'player',
      width: PLAYER_W,
      height: PLAYER_H,
      x: opts.x,
      y: opts.y
    });
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.onWallLeft = false;
    this.onWallRight = false;
    this.isWallSliding = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wallJumpLockTimer = 0;

    this.maxHp = PLAYER_MAX_HP;
    this.hp = PLAYER_MAX_HP;
    this.alive = true;
    this.iframeRemainingMs = 0;
  }

  takeDamage(amount, fromX) {
    if (!this.alive) return { hit: false, died: false };
    if (this.iframeRemainingMs > 0) return { hit: false, died: false };

    this.hp = Math.max(0, this.hp - amount);

    const dir = this.sprite.x >= fromX ? 1 : -1;
    this.vx = dir * PLAYER_HIT_KNOCKBACK_X;
    this.vy = PLAYER_HIT_KNOCKBACK_Y;
    this.onGround = false;
    this.coyoteTimer = 0;

    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(PLAYER_HIT_FLASH_MS, () => {
      if (this.alive && this.sprite && this.sprite.active) this.sprite.clearTint();
    });

    if (this.hp <= 0) {
      this.alive = false;
      this.iframeRemainingMs = 0;
      this.sprite.setTintFill(0xff2222);
      this.sprite.setAlpha(0.55);
      return { hit: true, died: true };
    }

    this.iframeRemainingMs = PLAYER_IFRAME_MS;
    return { hit: true, died: false };
  }

  update(dt, input) {
    if (!this.alive) return;

    // I-frame alpha flicker (5 Hz).
    if (this.iframeRemainingMs > 0) {
      this.iframeRemainingMs -= dt * 1000;
      if (this.iframeRemainingMs <= 0) {
        this.iframeRemainingMs = 0;
        this.sprite.setAlpha(1);
      } else {
        const phase = Math.floor(this.iframeRemainingMs / IFRAME_FLICKER_MS) % 2;
        this.sprite.setAlpha(phase === 0 ? IFRAME_ALPHA_LOW : 1);
      }
    }

    // Horizontal intent (skipped during wall-jump lockout so the push holds).
    if (this.wallJumpLockTimer > 0) {
      this.wallJumpLockTimer = Math.max(0, this.wallJumpLockTimer - dt);
    } else {
      const targetVx = input.moveX * MOVE_SPEED;
      const accel    = MOVE_ACCEL    * (this.onGround ? 1 : AIR_ACCEL_MULT);
      const friction = MOVE_FRICTION * (this.onGround ? 1 : AIR_FRICTION_MULT);
      if (input.moveX !== 0) {
        this.vx = approach(this.vx, targetVx, accel * dt);
      } else {
        this.vx = approach(this.vx, 0, friction * dt);
      }
    }

    // Coyote + buffer.
    if (this.onGround) this.coyoteTimer = COYOTE_TIME;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    if (input.jumpJustPressed) this.jumpBufferTimer = JUMP_BUFFER;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // Ground jump.
    let jumped = false;
    if (this.jumpBufferTimer > 0 && (this.onGround || this.coyoteTimer > 0)) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      jumped = true;
    }

    // Wall jump (only if ground jump did not fire this frame).
    if (WALL_JUMP_ENABLED && !jumped && input.jumpJustPressed && !this.onGround) {
      if (this.onWallLeft) {
        this.vx = WALL_JUMP_VX;
        this.vy = WALL_JUMP_VY;
        this.wallJumpLockTimer = WALL_JUMP_LOCK;
        this.jumpBufferTimer = 0;
      } else if (this.onWallRight) {
        this.vx = -WALL_JUMP_VX;
        this.vy = WALL_JUMP_VY;
        this.wallJumpLockTimer = WALL_JUMP_LOCK;
        this.jumpBufferTimer = 0;
      }
    }

    // Gravity (with jump-cut on release).
    if (!this.onGround) {
      let g = GRAVITY;
      if (this.vy < 0 && !input.jumpHeld) g *= JUMP_RELEASE_GRAVITY_MULT;
      this.vy += g * dt;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    }

    // Wall slide: cap fall speed when touching a wall (last-frame wall state).
    this.isWallSliding = false;
    if (WALL_SLIDE_ENABLED && !this.onGround && this.vy > 0 &&
        (this.onWallLeft || this.onWallRight)) {
      this.vy = Math.min(this.vy, WALL_SLIDE_SPEED);
      this.isWallSliding = true;
    }

    // Collision-based movement. X first, then Y.
    this.moveX(this.vx * dt);
    this.moveY(this.vy * dt);

    // Refresh state for next frame.
    this.onGround = this.checkGround();
    this.checkWalls();

    // Room clamp (safety - collision should already prevent this).
    // X clamp keeps the player inside the room horizontally. Y clamp is
    // looser (one player-height of slack each side) so it catches
    // catastrophic out-of-bounds states without interfering with jumps.
    const b = this.room.getBounds();
    this.sprite.x = Phaser.Math.Clamp(
      this.sprite.x,
      b.x + PLAYER_W / 2,
      b.x + b.w - PLAYER_W / 2
    );
    this.sprite.y = Phaser.Math.Clamp(
      this.sprite.y,
      b.y - Y_BOUNDS_SLACK,
      b.y + b.h + Y_BOUNDS_SLACK
    );
  }

  // --- collision ---------------------------------------------------------

  moveX(dx) {
    if (dx === 0) return;
    const halfW = PLAYER_W / 2;
    const halfH = PLAYER_H / 2;
    this.sprite.x += dx;
    const left  = this.sprite.x - halfW;
    const right = this.sprite.x + halfW;
    // Skip floor and ceiling: they should never trigger horizontal
    // collision. Without this, every horizontal move on the ground
    // snaps the player to the side of the floor tile they are standing
    // on, which chains into wall-internal teleports.
    const top   = this.sprite.y - halfH + 0.5;
    const bot   = this.sprite.y + halfH - 0.5;
    const ts = this.room.tileSize;
    const ox = this.room.offsetX;
    const oy = this.room.offsetY;
    const colStart = Math.floor((left - ox) / ts);
    const colEnd   = Math.floor((right - ox) / ts);
    const rowStart = Math.floor((top - oy) / ts);
    const rowEnd   = Math.floor((bot - oy) / ts);
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        if (!this.room.isSolidAt(col, row)) continue;
        const tileLeft  = ox + col * ts;
        const tileRight = ox + (col + 1) * ts;
        if (dx > 0) {
          this.sprite.x = tileLeft - halfW;
        } else {
          this.sprite.x = tileRight + halfW;
        }
        this.vx = 0;
        return;
      }
    }
  }

  moveY(dy) {
    if (dy === 0) return;
    const halfW = PLAYER_W / 2;
    const halfH = PLAYER_H / 2;
    const botBefore = this.sprite.y + halfH;
    this.sprite.y += dy;
    // Skip side walls: they should never trigger vertical collision.
    // Mirrors the moveX inset; without it, being near a wall while
    // falling snaps the player to the ceiling edge of the wall tile.
    const left  = this.sprite.x - halfW + 0.5;
    const right = this.sprite.x + halfW - 0.5;
    const top   = this.sprite.y - halfH;
    const bot   = this.sprite.y + halfH;
    const ts = this.room.tileSize;
    const ox = this.room.offsetX;
    const oy = this.room.offsetY;
    const colStart = Math.floor((left - ox) / ts);
    const colEnd   = Math.floor((right - ox) / ts);
    const rowStart = Math.floor((top - oy) / ts);
    const rowEnd   = Math.floor((bot - oy) / ts);
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const cell = this.room.cellAt(col, row);
        if (cell === '.') continue;
        const tileTop = oy + row * ts;
        const tileBot = oy + (row + 1) * ts;
        if (cell === '#') {
          if (dy > 0) {
            this.sprite.y = tileTop - halfH;
            this.vy = 0;
            return;
          } else if (dy < 0) {
            this.sprite.y = tileBot + halfH;
            this.vy = 0;
            return;
          }
        } else if (cell === '=') {
          // One-way: only from above, only when falling (dy > 0), and only
          // if the player's feet were at or above the platform top before
          // the move. +1 tolerance absorbs float rounding.
          if (dy > 0 && botBefore <= tileTop + 1) {
            this.sprite.y = tileTop - halfH;
            this.vy = 0;
            return;
          }
        }
      }
    }
  }

  checkGround() {
    // Moving up = not grounded (jumping through one-way platforms).
    if (this.vy < -1) return false;
    const halfW = PLAYER_W / 2;
    const halfH = PLAYER_H / 2;
    const feetY = this.sprite.y + halfH;
    const footY = feetY + 1;
    const left  = this.sprite.x - halfW + 2;
    const right = this.sprite.x + halfW - 2;
    const ts = this.room.tileSize;
    const ox = this.room.offsetX;
    const oy = this.room.offsetY;
    const colStart = Math.floor((left - ox) / ts);
    const colEnd   = Math.floor((right - ox) / ts);
    const row = Math.floor((footY - oy) / ts);
    const rowTop = oy + row * ts;
    // Only count as grounded if the feet are within 2px of the tile
    // top (on the surface or barely sunk). Without this, a falling
    // player whose feet were inside the 16px tile would be flagged as
    // grounded for the whole tile - gravity skipped, fall stutters.
    if (feetY > rowTop + 2) return false;
    for (let col = colStart; col <= colEnd; col++) {
      const cell = this.room.cellAt(col, row);
      if (cell === '#' || cell === '=') return true;
    }
    return false;
  }

  checkWalls() {
    const halfW = PLAYER_W / 2;
    const halfH = PLAYER_H / 2;
    const leftProbe  = this.sprite.x - halfW - 1;
    const rightProbe = this.sprite.x + halfW + 1;
    const top = this.sprite.y - halfH + 2;
    const bot = this.sprite.y + halfH - 2;
    const ts = this.room.tileSize;
    const ox = this.room.offsetX;
    const oy = this.room.offsetY;
    const rowStart = Math.floor((top - oy) / ts);
    const rowEnd   = Math.floor((bot - oy) / ts);
    const leftCol  = Math.floor((leftProbe - ox) / ts);
    const rightCol = Math.floor((rightProbe - ox) / ts);
    const lastRow  = this.room.data.tilesTall - 1;
    let onLeft = false, onRight = false;
    for (let row = rowStart; row <= rowEnd; row++) {
      // Skip ceiling (row 0) and floor (lastRow): they are solid across
      // every column, so counting them would falsely mark the player as
      // 'on wall' when their body range touched a floor or ceiling.
      if (row === 0 || row === lastRow) continue;
      if (this.room.isSolidAt(leftCol, row))  onLeft = true;
      if (this.room.isSolidAt(rightCol, row)) onRight = true;
    }
    this.onWallLeft = onLeft;
    this.onWallRight = onRight;
  }
}
