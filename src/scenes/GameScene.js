import Phaser from 'phaser';
import { TouchControls } from '../systems/TouchControls.js';
import { AimController } from '../systems/AimController.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { Player } from '../entities/Player.js';
import {
  WeaponPickup, AmmoPickup,
  WEAPON_PICKUP_SIZE, AMMO_PICKUP_SIZE
} from '../entities/Pickup.js';
import { Button } from '../ui/Button.js';
import { loadSetting } from '../systems/SettingsStore.js';
import { placeholderFor } from '../utils/placeholders.js';
import { pixelText } from '../utils/text.js';
import { STARTING_WEAPONS } from '../data/weapons.js';
import {
  JOYSTICK_RADIUS, JOYSTICK_STICK_RADIUS, JOYSTICK_DEADZONE,
  JOYSTICK_ZONE_WIDTH_FRAC, JOYSTICK_ZONE_Y_START_FRAC,
  BUTTON_RADIUS, BUTTON_LEFT_X, BUTTON_RIGHT_X, BUTTON_Y_FROM_BOTTOM,
  JUMP_BUTTON_RADIUS, JUMP_BUTTON_X_FROM_RIGHT, JUMP_BUTTON_Y_FROM_BOTTOM,
  AIM_STICK_RADIUS, AIM_STICK_STICK_RADIUS, AIM_STICK_DEADZONE,
  FIRE_BUTTON_RADIUS, FIRE_BUTTON_X_FROM_RIGHT, FIRE_BUTTON_Y_FROM_BOTTOM,
  DROP_BUTTON_RADIUS, DROP_BUTTON_X_FROM_RIGHT, DROP_BUTTON_Y_FROM_TOP,
  DROP_BUTTON_COLOR
} from '../config/controlsConfig.js';
import { PLAYER_W, PLAYER_H } from '../config/playerConfig.js';
import { PICKUP_COLLECT_DISTANCE, PICKUP_PHYSICS } from '../config/pickupConfig.js';

const AIM_LINE_LENGTH   = 40;
const AIM_COLOR         = 0xffeb3b;
const FIRE_FLASH_MS     = 150;
const FIRE_FLASH_COLOR  = 0xffff33;
const FIRE_FLASH_DEPTH  = 60;
const AIM_BRIGHT_MS     = 150;
const MUZZLE_OFFSET     = PLAYER_W / 2 + 2;
const TARGET_SIZE       = 20;
const MELEE_ARC_MS      = 150;
const MELEE_ARC_COLOR   = 0xffffff;
const MELEE_ARC_FILL_ALPHA = 0.55;
const MELEE_ARC_DEPTH   = 55;
const DROP_COOLDOWN_MS  = 300;
const DROP_FORWARD_DIST = PLAYER_W / 2 + 8;
// Facing: aim overrides movement if |aim.x| > this threshold. Below it
// (aim mostly vertical), movement decides. See update().
const FACING_AIM_THRESHOLD = 0.1;
const FACING_MOVE_THRESHOLD = 0.05;

function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 &&
         Math.abs(ay - by) < (ah + bh) / 2;
}

function aabbGap(ax, ay, aw, ah, bx, by, bw, bh) {
  const dx = Math.max(0, Math.abs(ax - bx) - (aw + bw) / 2);
  const dy = Math.max(0, Math.abs(ay - by) - (ah + bh) / 2);
  return Math.hypot(dx, dy);
}

function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.prevFirePulse = 0;
    this.lastFireAtMs = -10000;
    this.activeMeleeArcs = [];
    // +1 = right, -1 = left. Updated from aim (primary) or movement.
    this.facing = 1;
  }

  create() {
    const { width, height } = this.scale;
    const groundY = height - 30;
    this.groundY = groundY;
    const weaponRestY = groundY - WEAPON_PICKUP_SIZE / 2;
    const ammoRestY   = groundY - AMMO_PICKUP_SIZE / 2;

    this.add.rectangle(width / 2, groundY + 1, width, 2, 0x333333);

    this.player = new Player(this, {
      x: width / 2 - 60,
      y: groundY - PLAYER_H / 2,
      groundY
    });
    this.prevJumpHeld = false;

    this.testTarget = placeholderFor(this, 'testTarget', {
      category: 'enemy',
      width: TARGET_SIZE,
      height: TARGET_SIZE,
      x: width - 60,
      y: groundY - TARGET_SIZE / 2
    });

    // Test pickups. Positions outside the joystick zone (x >= 130).
    this.weaponPickups = [];
    this.ammoPickups = [];
    this.weaponPickups.push(new WeaponPickup(this, 145, weaponRestY, 'shotgun'));
    this.ammoPickups.push(new AmmoPickup(this, 230, ammoRestY));
    this.weaponPickups.push(new WeaponPickup(this, 300, weaponRestY, 'sniper'));

    this.controls = new TouchControls(this, {
      mode: loadSetting('movementMode'),
      radius: JOYSTICK_RADIUS,
      stickRadius: JOYSTICK_STICK_RADIUS,
      deadzone: JOYSTICK_DEADZONE,
      joystickZoneWidthFrac: JOYSTICK_ZONE_WIDTH_FRAC,
      joystickZoneYStartFrac: JOYSTICK_ZONE_Y_START_FRAC,
      buttonRadius: BUTTON_RADIUS,
      buttonLeftX: BUTTON_LEFT_X,
      buttonRightX: BUTTON_RIGHT_X,
      buttonYFromBottom: BUTTON_Y_FROM_BOTTOM,
      jumpButtonRadius: JUMP_BUTTON_RADIUS,
      jumpButtonXFromRight: JUMP_BUTTON_X_FROM_RIGHT,
      jumpButtonYFromBottom: JUMP_BUTTON_Y_FROM_BOTTOM
    });

    this.setupPickupTaps();

    this.aim = new AimController(this, {
      mode: loadSetting('aimMode'),
      dragFireMode: loadSetting('dragFireMode'),
      touchControls: this.controls,
      aimStickRadius: AIM_STICK_RADIUS,
      aimStickStickRadius: AIM_STICK_STICK_RADIUS,
      deadzone: AIM_STICK_DEADZONE,
      fireButtonRadius: FIRE_BUTTON_RADIUS,
      fireButtonX: width - FIRE_BUTTON_X_FROM_RIGHT,
      fireButtonY: height - FIRE_BUTTON_Y_FROM_BOTTOM
    });

    this.weapon = new WeaponSystem(this, STARTING_WEAPONS);

    // Slot UI at the top. Tapping a slot selects it; tapping an empty
    // slot selects fists.
    this.createSlotUI();

    // Drop button (cyan, top-right, left of switch).
    this.dropButton = new Button(this, {
      x: width - DROP_BUTTON_X_FROM_RIGHT,
      y: DROP_BUTTON_Y_FROM_TOP,
      radius: DROP_BUTTON_RADIUS,
      color: DROP_BUTTON_COLOR,
      alpha: 0.5,
      pressedAlpha: 0.9,
      depth: 1000
    });
    this.controls.registerFixedButton(this.dropButton);

    this.dropButtonPointerId = null;
    this.input.on('pointerdown', (pointer) => {
      if (this.dropButtonPointerId !== null) return;
      if (!this.dropButton.contains(pointer)) return;
      this.dropButtonPointerId = pointer.id;
      this.dropButton.setPressed(true);
      this.dropCurrentWeapon();
    });
    const releaseDrop = (pointer) => {
      if (pointer.id !== this.dropButtonPointerId) return;
      this.dropButtonPointerId = null;
      this.dropButton.setPressed(false);
    };
    this.input.on('pointerup', releaseDrop);
    this.input.on('pointerupoutside', releaseDrop);

    this.aimLine = this.add.graphics().setDepth(50);
    pixelText(this, width / 2, height - 14,
      'TAP pickups  JUMP  DROP',
      { size: 16, color: '#666666', origin: [0.5, 0.5] });

    this.prevFirePulse = this.aim.firePulse;
  }

  setupPickupTaps() {
    this.controls.setOnPickupTap((pointer) => {
      const now = this.time.now;
      const px = this.player.sprite.x;
      const py = this.player.sprite.y;
      const maxDist = PICKUP_COLLECT_DISTANCE;

      // Weapon pickups first.
      for (let i = this.weaponPickups.length - 1; i >= 0; i--) {
        const p = this.weaponPickups[i];
        if (p.collected || now < p.collectableAt) continue;
        if (!p.contains(pointer.x, pointer.y)) continue;
        if (aabbGap(px, py, PLAYER_W, PLAYER_H,
                    p.sprite.x, p.sprite.y, p.width, p.height) > maxDist) continue;
        const pickupX = p.sprite.x;
        const pickupY = p.sprite.y;
        const result = this.weapon.addWeapon(p.weaponId, p.ammo);
        if (!result.added) continue;
        p.collected = true;
        p.destroy();
        this.weaponPickups.splice(i, 1);
        if (result.dropped) {
          this.spawnDroppedWeapon(result.dropped, pickupX, pickupY, 0);
        }
        return true;
      }

      // Ammo pickups. Do not consume the tap if nothing was refilled.
      for (let i = this.ammoPickups.length - 1; i >= 0; i--) {
        const p = this.ammoPickups[i];
        if (p.collected || now < p.collectableAt) continue;
        if (!p.contains(pointer.x, pointer.y)) continue;
        if (aabbGap(px, py, PLAYER_W, PLAYER_H,
                    p.sprite.x, p.sprite.y, p.width, p.height) > maxDist) continue;
        const used = this.weapon.refillAllRangedAmmo();
        if (!used) continue;
        p.collected = true;
        p.destroy();
        this.ammoPickups.splice(i, 1);
        return true;
      }

      return false;
    });
  }

  dropCurrentWeapon() {
    const dropped = this.weapon.removeCurrent();
    if (!dropped) return;  // nothing to drop (selected slot is empty -> fists)
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const aim = this.aim.getAim(px, py);
    // Aim-directed throw: item starts at the player and flies in the
    // aim direction; gravity arcs it down. Aim up = arcs up, aim
    // diagonally = arcs diagonally.
    this.spawnDroppedWeapon(dropped, px, py, { x: aim.x, y: aim.y });
    this.refreshSlotUI();
  }

  // dir: { x, y } unit-ish vector for aim-directed throw (drop button).
  // null = swap-drop (random small pop at the pickup's location, not
  // from the player).
  spawnDroppedWeapon(dropped, x, y, dir = null) {
    const zoneMinX = this.scale.width * JOYSTICK_ZONE_WIDTH_FRAC + 15;
    const dropX = Phaser.Math.Clamp(x, zoneMinX, this.scale.width - 20);
    const dropY = (y !== undefined)
      ? Phaser.Math.Clamp(y, 10, this.groundY - WEAPON_PICKUP_SIZE / 2)
      : (this.groundY - WEAPON_PICKUP_SIZE / 2);
    const pickup = new WeaponPickup(
      this, dropX, dropY,
      dropped.weaponId, dropped.ammo,
      this.time.now + DROP_COOLDOWN_MS
    );
    if (dir) {
      const THROW_SPEED = 220;
      pickup.vx = dir.x * THROW_SPEED;
      pickup.vy = dir.y * THROW_SPEED;
    } else {
      const r = Math.random() < 0.5 ? -1 : 1;
      pickup.vx = r * (PICKUP_PHYSICS.dropVxRange * (0.5 + Math.random() * 0.5));
      pickup.vy = PICKUP_PHYSICS.dropVy;
    }
    pickup.onGround = false;
    this.weaponPickups.push(pickup);
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;

    const jumpHeld = this.controls.jumpHeld;
    const jumpJustPressed  = jumpHeld && !this.prevJumpHeld;
    const jumpJustReleased = !jumpHeld && this.prevJumpHeld;
    this.prevJumpHeld = jumpHeld;

    this.player.update(dt, {
      moveX: this.controls.outputX,
      jumpHeld,
      jumpJustPressed,
      jumpJustReleased
    });

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    if (this.activeMeleeArcs.length > 0) this.redrawMeleeArcs(px, py);

    // Pickup physics + in-range highlight.
    const rangedHasRoom = this.weapon.hasRangedBelowMax();
    for (const p of this.weaponPickups) {
      if (p.collected) continue;
      p.update(dt, this.groundY, 0, this.scale.width);
      const gap = aabbGap(px, py, PLAYER_W, PLAYER_H,
                          p.sprite.x, p.sprite.y, p.width, p.height);
      p.setInRange(gap <= PICKUP_COLLECT_DISTANCE && time >= p.collectableAt, time);
    }
    for (const p of this.ammoPickups) {
      if (p.collected) continue;
      p.update(dt, this.groundY, 0, this.scale.width);
      const gap = aabbGap(px, py, PLAYER_W, PLAYER_H,
                          p.sprite.x, p.sprite.y, p.width, p.height);
      p.setInRange(gap <= PICKUP_COLLECT_DISTANCE && rangedHasRoom, time);
    }

    const aim = this.aim.getAim(px, py);
    const fire = this.aim.consumeFire();
    if (fire) this.lastFireAtMs = time;

    // Facing rule: aim overrides movement when it has a real horizontal
    // component. Straight-up aim defers to movement. No input = last facing.
    const aimActive = this.aim.aimPointerId !== null || fire;
    if (aimActive && Math.abs(aim.x) > FACING_AIM_THRESHOLD) {
      this.facing = aim.x > 0 ? 1 : -1;
    } else if (Math.abs(this.controls.outputX) > FACING_MOVE_THRESHOLD) {
      this.facing = this.controls.outputX > 0 ? 1 : -1;
    }

    const mx = px + aim.x * MUZZLE_OFFSET;
    const my = py + aim.y * MUZZLE_OFFSET;

    if (fire) {
      const result = this.weapon.tryFire(time, mx, my, aim.x, aim.y);
      if (result.fired) {
        if (result.type === 'melee') {
          this.spawnMeleeArc(px, py, Math.atan2(aim.y, aim.x), result.weapon);
          this.checkMeleeHits(px, py, aim, result.weapon);
        } else {
          this.spawnFireFlash(mx, my, aim);
        }
      }
    }

    this.weapon.update(dt);

    if (this.testTarget && this.testTarget.active) {
      this.weapon.forEachActiveProjectile((p) => {
        if (!p.active) return;
        if (aabbOverlap(
          p.sprite.x, p.sprite.y, p.width, p.height,
          this.testTarget.x, this.testTarget.y, TARGET_SIZE, TARGET_SIZE
        )) {
          p.deactivate();
          this.flashTarget();
        }
      });
    }

    if (this.aim.firePulse !== this.prevFirePulse) {
      this.prevFirePulse = this.aim.firePulse;
    }

    const recentlyFired = (time - this.lastFireAtMs) < AIM_BRIGHT_MS;
    const bright = fire || recentlyFired;

    this.aimLine.clear();
    if (this.aim.mode === 'tapToShoot' && this.aim.aimPointerId !== null) {
      this.aimLine.lineStyle(1, AIM_COLOR, bright ? 0.9 : 0.5);
      this.aimLine.beginPath();
      this.aimLine.moveTo(px, py);
      this.aimLine.lineTo(this.aim.fingerX, this.aim.fingerY);
      this.aimLine.strokePath();
    } else if (this.aim.hasAim) {
      this.aimLine.lineStyle(2, AIM_COLOR, bright ? 1.0 : 0.4);
      this.aimLine.beginPath();
      this.aimLine.moveTo(px, py);
      this.aimLine.lineTo(px + aim.x * AIM_LINE_LENGTH, py + aim.y * AIM_LINE_LENGTH);
      this.aimLine.strokePath();
    }

    // Slot UI refreshes each frame - ammo decrements on fire, drops
    // remove entries, pickups add them. Cheap enough at 3 slots.
    this.refreshSlotUI();
  }

  createSlotUI() {
    const width = this.scale.width;
    const slotW = 76;
    const slotH = 22;
    const gap = 6;
    const totalW = this.weapon.maxSlots * slotW +
                   (this.weapon.maxSlots - 1) * gap;
    const startX = (width - totalW) / 2 + slotW / 2;
    const y = 16;
    this.slotUI = [];
    for (let i = 0; i < this.weapon.maxSlots; i++) {
      const x = startX + i * (slotW + gap);
      const bg = this.add.rectangle(x, y, slotW, slotH, 0x333333, 0.85)
        .setDepth(900)
        .setStrokeStyle(1, 0x666666, 1)
        .setInteractive();
      const label = pixelText(this, x, y, '',
        { size: 16, color: '#ffffff', origin: [0.5, 0.5] }).setDepth(901);
      const slotIndex = i;
      bg.on('pointerdown', () => {
        this.weapon.selectIndex(slotIndex);
        this.refreshSlotUI();
      });
      // Register a hit-test with TouchControls so aim does not steal
      // pointer taps on slots (same mechanism as jump/drop buttons).
      this.controls.registerFixedButton({
        contains: (pointer) => {
          const dx = pointer.x - x;
          const dy = pointer.y - y;
          return Math.abs(dx) <= slotW / 2 && Math.abs(dy) <= slotH / 2;
        }
      });
      this.slotUI.push({ bg, label, x, y });
    }
    this.refreshSlotUI();
  }

  refreshSlotUI() {
    const view = this.weapon.getSlotsView();
    for (let i = 0; i < this.slotUI.length; i++) {
      const ui = this.slotUI[i];
      const s = view[i];
      const sel = s.isSelected;
      const empty = s.empty;
      const bgCol = sel
        ? (empty ? 0xaa6600 : 0x00aa44)
        : (empty ? 0x1a1a1a : 0x333333);
      ui.bg.setFillStyle(bgCol, 0.85);
      ui.bg.setStrokeStyle(1, sel ? 0xffee00 : 0x666666, 1);
      let label = '';
      if (empty) {
        label = sel ? 'FISTS' : '-';
      } else if (s.ammo === null) {
        label = s.name;
      } else {
        label = `${s.name} ${s.ammo}`;
      }
      ui.label.setText(label);
    }
  }

  spawnFireFlash(x, y, aim) {
    const flash = this.add.circle(x, y, 8, FIRE_FLASH_COLOR, 1)
      .setDepth(FIRE_FLASH_DEPTH);
    this.tweens.add({
      targets: flash, alpha: 0, scale: 2, duration: FIRE_FLASH_MS,
      onComplete: () => flash.destroy()
    });
    const tip = this.add.circle(
      x + aim.x * 8, y + aim.y * 8, 5, FIRE_FLASH_COLOR, 1
    ).setDepth(FIRE_FLASH_DEPTH);
    this.tweens.add({
      targets: tip, alpha: 0,
      x: x + aim.x * 28, y: y + aim.y * 28,
      duration: FIRE_FLASH_MS,
      onComplete: () => tip.destroy()
    });
  }

  spawnMeleeArc(px, py, aimAngle, weapon) {
    const halfArc = (weapon.melee.arcDegrees / 2) * Math.PI / 180;
    const g = this.add.graphics().setDepth(MELEE_ARC_DEPTH);
    g.fillStyle(MELEE_ARC_COLOR, MELEE_ARC_FILL_ALPHA);
    g.slice(px, py, weapon.melee.range, aimAngle - halfArc, aimAngle + halfArc, false);
    g.fillPath();

    const arc = { graphics: g, range: weapon.melee.range, halfArc, aimAngle };
    this.activeMeleeArcs.push(arc);

    this.tweens.add({
      targets: g, alpha: 0, duration: MELEE_ARC_MS,
      onComplete: () => {
        const i = this.activeMeleeArcs.indexOf(arc);
        if (i >= 0) this.activeMeleeArcs.splice(i, 1);
        g.destroy();
      }
    });
  }

  redrawMeleeArcs(px, py) {
    for (const arc of this.activeMeleeArcs) {
      arc.graphics.clear();
      arc.graphics.fillStyle(MELEE_ARC_COLOR, MELEE_ARC_FILL_ALPHA);
      arc.graphics.slice(
        px, py, arc.range,
        arc.aimAngle - arc.halfArc,
        arc.aimAngle + arc.halfArc,
        false
      );
      arc.graphics.fillPath();
    }
  }

  checkMeleeHits(px, py, aim, weapon) {
    const halfArc = (weapon.melee.arcDegrees / 2) * Math.PI / 180;
    const aimAngle = Math.atan2(aim.y, aim.x);
    if (!this.testTarget || !this.testTarget.active) return;
    const dx = this.testTarget.x - px;
    const dy = this.testTarget.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > weapon.melee.range + TARGET_SIZE / 2) return;
    const targetAngle = Math.atan2(dy, dx);
    if (Math.abs(angleDelta(targetAngle, aimAngle)) <= halfArc) {
      this.flashTarget();
    }
  }

  flashTarget() {
    if (!this.testTarget || this.testTarget.isTinted) return;
    this.testTarget.setFillStyle ? null : null;  // no-op, keeps lint quiet
    this.testTarget.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (this.testTarget) this.testTarget.clearTint();
    });
  }
}
