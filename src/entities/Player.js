import Phaser from 'phaser';
import { placeholderFor } from '../utils/placeholders.js';
import {
  PLAYER_W, PLAYER_H,
  MOVE_SPEED, MOVE_ACCEL, MOVE_FRICTION,
  GRAVITY, JUMP_VELOCITY, MAX_FALL_SPEED, JUMP_RELEASE_GRAVITY_MULT,
  COYOTE_TIME, JUMP_BUFFER
} from '../config/playerConfig.js';

// Phone-side player: holds the sprite and the physics state. Physics is
// local for now; when multiplayer lands, the numbers move to src/shared/
// and this file becomes a rendering wrapper (see AGENT.md "game logic must
// be plain JS in shared/").
//
// Collision is against a single horizontal floor for now. Tile-based
// collision (with one-way platforms and walls) arrives with the room loader
// in section 3.
function approach(current, target, step) {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return target;
}

export class Player {
  constructor(scene, opts) {
    this.scene = scene;
    this.groundY = opts.groundY;
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
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  update(dt, input) {
    // input: { moveX, jumpHeld, jumpJustPressed, jumpJustReleased }

    // Horizontal: accelerate toward target speed, decelerate when no input.
    const targetVx = input.moveX * MOVE_SPEED;
    if (input.moveX !== 0) {
      this.vx = approach(this.vx, targetVx, MOVE_ACCEL * dt);
    } else {
      this.vx = approach(this.vx, 0, MOVE_FRICTION * dt);
    }

    // Coyote timer: refreshed while on ground, counts down once airborne.
    if (this.onGround) this.coyoteTimer = COYOTE_TIME;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    // Jump buffer: refreshed on press, counts down each frame.
    if (input.jumpJustPressed) this.jumpBufferTimer = JUMP_BUFFER;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // Jump fires if the buffer is alive AND (on ground OR within coyote).
    if (this.jumpBufferTimer > 0 &&
        (this.onGround || this.coyoteTimer > 0)) {
      this.vy = JUMP_VELOCITY;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // Gravity, with extra pull while rising and jump not held. This is
    // the variable-jump-height mechanism: releasing early makes the
    // player decelerate faster and rise less. Smooth velocity curve,
    // no instant snap. See JUMP_RELEASE_GRAVITY_MULT in playerConfig.js.
    if (!this.onGround) {
      let g = GRAVITY;
      if (this.vy < 0 && !input.jumpHeld) g *= JUMP_RELEASE_GRAVITY_MULT;
      this.vy += g * dt;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    }

    // Integrate.
    this.sprite.x += this.vx * dt;
    this.sprite.y += this.vy * dt;

    // Floor collision.
    const bottom = this.sprite.y + PLAYER_H / 2;
    if (bottom >= this.groundY) {
      this.sprite.y = this.groundY - PLAYER_H / 2;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Horizontal bounds (screen edges).
    this.sprite.x = Phaser.Math.Clamp(
      this.sprite.x,
      PLAYER_W / 2,
      this.scene.scale.width - PLAYER_W / 2
    );
  }
}
