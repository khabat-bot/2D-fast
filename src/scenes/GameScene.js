import Phaser from 'phaser';
import { TouchControls } from '../systems/TouchControls.js';
import { AimController } from '../systems/AimController.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { Player } from '../entities/Player.js';
import {
  WeaponPickup, AmmoPickup,
  WEAPON_PICKUP_SIZE
} from '../entities/Pickup.js';
import { Button } from '../ui/Button.js';
import { loadSetting } from '../systems/SettingsStore.js';
import { pixelText } from '../utils/text.js';
import { STARTING_WEAPONS } from '../data/weapons.js';
import { Walker } from '../entities/enemies/Walker.js';
import { RoomLoader } from '../world/RoomLoader.js';
import { ROOMS } from '../data/rooms.js';
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
import {
  CAMERA_LERP, CAMERA_DEADZONE_W, CAMERA_DEADZONE_H,
  CAMERA_LOOKAHEAD, CAMERA_LOOKAHEAD_LERP
} from '../config/cameraConfig.js';

const AIM_LINE_LENGTH   = 40;
const AIM_COLOR         = 0xffeb3b;
const FIRE_FLASH_MS     = 150;
const FIRE_FLASH_COLOR  = 0xffff33;
const FIRE_FLASH_DEPTH  = 60;
const AIM_BRIGHT_MS     = 150;
const MUZZLE_OFFSET     = PLAYER_W / 2 + 2;
const MELEE_ARC_MS      = 150;
const MELEE_ARC_COLOR   = 0xffffff;
const MELEE_ARC_FILL_ALPHA = 0.55;
const MELEE_ARC_DEPTH   = 55;
const DROP_COOLDOWN_MS  = 300;
const DROP_FORWARD_DIST = PLAYER_W / 2 + 8;
const FACING_AIM_THRESHOLD = 0.1;
const FACING_MOVE_THRESHOLD = 0.05;
const HINT_FADE_DELAY_MS = 8000;
const HINT_FADE_MS       = 800;
const DMG_NUMBER_DEPTH   = 70;
const DMG_NUMBER_MS      = 500;
const DMG_NUMBER_COLOR   = '#ffff44';
const KILL_BURST_DEPTH   = 58;
const KILL_BURST_MS      = 300;
const KILL_BURST_COUNT   = 8;

// HP bar (top-left, distinct from the slot strip).
const HP_BAR_W = 50;
const HP_BAR_H = 10;
const HP_BAR_X = 8;
const HP_BAR_Y = 15;
const HP_BAR_DEPTH = 900;
const HP_BAR_COLOR = 0xff3333;

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
    this.facing = 1;
  }

  create() {
    // Reset instance state. The constructor does NOT re-run on
    // scene.restart() - only create() does - so any array/flag that
    // would persist across a restart must be reset here.
    this.activeMeleeArcs = [];
    this.prevFirePulse = 0;
    this.lastFireAtMs = -10000;
    this.facing = 1;
    this.dying = false;
    this.stats = {
      elapsedMs: 0,
      kills: 0,
      damageDealt: 0,
      damageTaken: 0
    };

    const { width, height } = this.scale;

    // Load the room. Single room for now; multi-room comes later.
    this.room = new RoomLoader(this, ROOMS.test_room);
    this.roomFloorY = this.room.getFloorY();
    const spawn = this.room.getPlayerSpawn();
    this.player = new Player(this, {
      x: spawn.x,
      y: spawn.y - PLAYER_H / 2,
      room: this.room
    });
    this.prevJumpHeld = false;
    this.setupCamera();
    this.createHpBar();

    this.enemies = [];
    const walkerBounds = this.room.getWalkerBounds();
    for (const ws of this.room.getWalkerSpawns()) {
      this.enemies.push(new Walker(this, ws.x, ws.y, walkerBounds));
    }

    this.weaponPickups = [];
    this.ammoPickups = [];
    for (const ps of this.room.getPickupSpawns()) {
      if (ps.type === 'weapon') {
        this.weaponPickups.push(
          new WeaponPickup(this, ps.x, ps.y, ps.weaponId)
        );
      } else if (ps.type === 'ammo') {
        this.ammoPickups.push(new AmmoPickup(this, ps.x, ps.y));
      }
    }

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

    this.createSlotUI();

    // Drop button (cyan, top-right). Switch button is gone; slots replace it.
    this.dropButton = new Button(this, {
      x: width - DROP_BUTTON_X_FROM_RIGHT,
      y: DROP_BUTTON_Y_FROM_TOP,
      radius: DROP_BUTTON_RADIUS,
      color: DROP_BUTTON_COLOR,
      alpha: 0.5,
      pressedAlpha: 0.9,
      depth: 1000,
      label: 'D'
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

    // Aim line drawn in SCREEN space so it lines up with the aim-finger
    // visuals (which are scrollFactor 0). World-to-screen conversion is
    // done in update() below.
    this.aimLine = this.add.graphics().setDepth(50).setScrollFactor(0);

    // Hint fades out after a few seconds - it is onboarding, not permanent.
    this.hintText = pixelText(this, width / 2, height - 14,
      'TAP pickups  J:jump  D:drop',
      { size: 16, color: '#666666', origin: [0.5, 0.5] })
      .setScrollFactor(0);
    this.tweens.add({
      targets: this.hintText,
      alpha: 0,
      delay: HINT_FADE_DELAY_MS,
      duration: HINT_FADE_MS
    });

    this.prevFirePulse = this.aim.firePulse;
  }

  setupPickupTaps() {
    this.controls.setOnPickupTap((pointer) => {
      if (!this.player.alive) return false;
      const now = this.time.now;
      const px = this.player.sprite.x;
      const py = this.player.sprite.y;
      const maxDist = PICKUP_COLLECT_DISTANCE;

      for (let i = this.weaponPickups.length - 1; i >= 0; i--) {
        const p = this.weaponPickups[i];
        if (p.collected || now < p.collectableAt) continue;
        if (!p.contains(pointer.x, pointer.y)) continue;
        if (aabbGap(px, py, PLAYER_W, PLAYER_H,
                    p.sprite.x, p.sprite.y, p.width, p.height) > maxDist) continue;
        const result = this.weapon.addWeapon(p.weaponId, p.ammo);
        if (!result.added) continue;
        p.collected = true;
        p.destroy();
        this.weaponPickups.splice(i, 1);
        if (result.dropped) {
          // Throw the swapped-out weapon from the PLAYER in the aim
          // direction. Previously it spawned at the pickup's world
          // position with a random kick, which looked like a
          // teleport. This matches the drop button's behaviour.
          const swappedAim = this.aim.getAim(px, py);
          this.spawnDroppedWeapon(result.dropped, px, py,
            { x: swappedAim.x, y: swappedAim.y });
        }
        return true;
      }

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
    if (!dropped) return;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const aim = this.aim.getAim(px, py);
    this.spawnDroppedWeapon(dropped, px, py, { x: aim.x, y: aim.y });
    this.refreshSlotUI();
  }

  spawnDroppedWeapon(dropped, x, y, dir = null) {
    const zoneMinX = this.scale.width * JOYSTICK_ZONE_WIDTH_FRAC + 15;
    const dropX = Phaser.Math.Clamp(x, zoneMinX, this.scale.width - 20);
    const dropY = (y !== undefined)
      ? Phaser.Math.Clamp(y, 10, this.roomFloorY - WEAPON_PICKUP_SIZE / 2)
      : (this.roomFloorY - WEAPON_PICKUP_SIZE / 2);
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

  createSlotUI() {
    const width = this.scale.width;
    const slotW = 80;
    const slotH = 34;
    const gap = 6;
    const totalW = this.weapon.maxSlots * slotW +
                   (this.weapon.maxSlots - 1) * gap;
    const startX = (width - totalW) / 2 + slotW / 2;
    const y = 22;
    this.slotUI = [];
    for (let i = 0; i < this.weapon.maxSlots; i++) {
      const x = startX + i * (slotW + gap);
      // HUD - all slot elements locked to screen.
      const bg = this.add.rectangle(x, y, slotW, slotH, 0x222222, 0.9)
        .setDepth(900)
        .setStrokeStyle(1, 0x555555, 1)
        .setScrollFactor(0)
        .setInteractive();
      const swatch = this.add.rectangle(
        x - slotW / 2 + 6, y, 6, slotH - 4, 0x444444, 1
      ).setDepth(901).setScrollFactor(0);
      const nameLbl = pixelText(this, x - slotW / 2 + 12, y - 7, '',
        { size: 16, color: '#ffffff', origin: [0, 0.5] })
        .setDepth(901).setScrollFactor(0);
      const ammoLbl = pixelText(this, x + slotW / 2 - 4, y + 7, '',
        { size: 16, color: '#cccccc', origin: [1, 0.5] })
        .setDepth(901).setScrollFactor(0);
      const slotIndex = i;
      bg.on('pointerdown', () => {
        this.weapon.selectIndex(slotIndex);
        this.refreshSlotUI();
      });
      this.controls.registerFixedButton({
        contains: (pointer) => {
          const dx = pointer.x - x;
          const dy = pointer.y - y;
          return Math.abs(dx) <= slotW / 2 && Math.abs(dy) <= slotH / 2;
        }
      });
      this.slotUI.push({ bg, swatch, nameLbl, ammoLbl, x, y });
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

      const bgCol = sel ? (empty ? 0x553300 : 0x004422) : 0x222222;
      ui.bg.setFillStyle(bgCol, 0.9);
      ui.bg.setStrokeStyle(sel ? 2 : 1, sel ? 0xffee00 : 0x555555, 1);

      if (empty) {
        ui.swatch.setFillStyle(0x444444, 1);
        ui.nameLbl.setText(sel ? 'FISTS' : '\u2014');
        ui.nameLbl.setTintFill(sel ? 0xffcc44 : 0x666666);
        ui.ammoLbl.setText('');
      } else {
        ui.swatch.setFillStyle(s.color, 1);
        ui.nameLbl.setText(s.name);
        ui.nameLbl.setTintFill(0xffffff);
        if (s.ammo === null) {
          ui.ammoLbl.setText('');
        } else {
          ui.ammoLbl.setText(`${s.ammo}/${s.maxAmmo}`);
          ui.ammoLbl.setTintFill(s.ammo === 0 ? 0xff4444 : 0xcccccc);
        }
      }
    }
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.stats.elapsedMs += delta;

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

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) { this.enemies.splice(i, 1); continue; }
      e.update(dt);
    }

    // Contact damage. One hit per frame max - i-frames inside the
    // player handle repeat prevention within the same touch.
    if (this.player.alive) {
      for (const e of this.enemies) {
        if (!e.alive || !e.sprite) continue;
        if (aabbOverlap(
          px, py, PLAYER_W, PLAYER_H,
          e.sprite.x, e.sprite.y, e.width, e.height
        )) {
          const dmg = e.def?.contactDamage ?? 10;
          const r = this.player.takeDamage(dmg, e.sprite.x);
          if (r.hit) this.stats.damageTaken += dmg;
          break;
        }
      }
    }

    // Death freezes gameplay. Transition is handled once by
    // onPlayerDeath(). Everything below is skipped until restart.
    if (!this.player.alive) {
      if (!this.dying) { this.dying = true; this.onPlayerDeath(); }
      this.refreshHpBar();
      this.refreshSlotUI();
      return;
    }

    if (this.activeMeleeArcs.length > 0) this.redrawMeleeArcs(px, py);

    const rangedHasRoom = this.weapon.hasRangedBelowMax();
    for (const p of this.weaponPickups) {
      if (p.collected) continue;
      p.update(dt, this.roomFloorY,
               this.room.getBounds().x,
               this.room.getBounds().x + this.room.getBounds().w);
      const gap = aabbGap(px, py, PLAYER_W, PLAYER_H,
                          p.sprite.x, p.sprite.y, p.width, p.height);
      p.setInRange(gap <= PICKUP_COLLECT_DISTANCE && time >= p.collectableAt, time);
    }
    for (const p of this.ammoPickups) {
      if (p.collected) continue;
      p.update(dt, this.roomFloorY,
               this.room.getBounds().x,
               this.room.getBounds().x + this.room.getBounds().w);
      const gap = aabbGap(px, py, PLAYER_W, PLAYER_H,
                          p.sprite.x, p.sprite.y, p.width, p.height);
      p.setInRange(gap <= PICKUP_COLLECT_DISTANCE && rangedHasRoom, time);
    }

    // Aim math in SCREEN space. AimController stores fingerX/Y as
    // pointer.x/y (screen). Passing world player coords would mix spaces.
    // Directions are preserved in both spaces, so muzzle/movement use
    // world coords safely - only the aim line rendering needs screen.
    const cam = this.cameras.main;
    const pxs = px - cam.scrollX;
    const pys = py - cam.scrollY;
    const aim = this.aim.getAim(pxs, pys);
    const fire = this.aim.consumeFire();
    if (fire) this.lastFireAtMs = time;

    const aimActive = this.aim.aimPointerId !== null || fire;
    if (aimActive && Math.abs(aim.x) > FACING_AIM_THRESHOLD) {
      this.facing = aim.x > 0 ? 1 : -1;
    } else if (Math.abs(this.controls.outputX) > FACING_MOVE_THRESHOLD) {
      this.facing = this.controls.outputX > 0 ? 1 : -1;
    }

    // Camera look-ahead: shift follow target in facing direction while
    // the player is moving. Lerped so direction changes pan smoothly.
    const moving = Math.abs(this.controls.outputX) > FACING_MOVE_THRESHOLD;
    const targetLookahead = moving ? this.facing * CAMERA_LOOKAHEAD : 0;
    this.cameraLookaheadX = Phaser.Math.Linear(
      this.cameraLookaheadX, targetLookahead,
      Math.min(1, dt * CAMERA_LOOKAHEAD_LERP)
    );
    this.cameras.main.setFollowOffset(this.cameraLookaheadX, 0);

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

    this.weapon.forEachActiveProjectile((p) => {
      if (!p.active) return;
      for (const e of this.enemies) {
        if (!e.alive || !e.sprite) continue;
        if (aabbOverlap(
          p.sprite.x, p.sprite.y, p.width, p.height,
          e.sprite.x, e.sprite.y, e.width, e.height
        )) {
          const ex = e.sprite.x;
          const ey = e.sprite.y;
          const died = e.hit(p.damage, p.sprite.x);
          this.spawnDamageNumber(ex, ey - 15, p.damage);
          this.stats.damageDealt += p.damage;
          if (died) {
            this.spawnKillBurst(ex, ey, e.def?.color ?? 0xe53935);
            this.stats.kills += 1;
          }
          p.deactivate();
          break;
        }
      }
    });

    if (this.aim.firePulse !== this.prevFirePulse) {
      this.prevFirePulse = this.aim.firePulse;
    }

    const recentlyFired = (time - this.lastFireAtMs) < AIM_BRIGHT_MS;
    const bright = fire || recentlyFired;

    // Aim line drawn in SCREEN space from screen player to screen finger
    // (or in aim direction). Both points are screen coords, so the visual
    // matches the finger position exactly regardless of camera scroll.
    this.aimLine.clear();
    if (this.aim.mode === 'tapToShoot' && this.aim.aimPointerId !== null) {
      this.aimLine.lineStyle(1, AIM_COLOR, bright ? 0.9 : 0.5);
      this.aimLine.beginPath();
      this.aimLine.moveTo(pxs, pys);
      this.aimLine.lineTo(this.aim.fingerX, this.aim.fingerY);
      this.aimLine.strokePath();
    } else if (this.aim.hasAim) {
      this.aimLine.lineStyle(2, AIM_COLOR, bright ? 1.0 : 0.4);
      this.aimLine.beginPath();
      this.aimLine.moveTo(pxs, pys);
      this.aimLine.lineTo(pxs + aim.x * AIM_LINE_LENGTH, pys + aim.y * AIM_LINE_LENGTH);
      this.aimLine.strokePath();
    }

    this.refreshHpBar();
    this.refreshSlotUI();
  }

  createHpBar() {
    this.hpBarBg = this.add
      .rectangle(HP_BAR_X, HP_BAR_Y, HP_BAR_W, HP_BAR_H, 0x000000, 0.7)
      .setOrigin(0, 0.5)
      .setDepth(HP_BAR_DEPTH)
      .setStrokeStyle(1, 0x666666, 1)
      .setScrollFactor(0);
    this.hpBarFill = this.add
      .rectangle(HP_BAR_X, HP_BAR_Y, HP_BAR_W, HP_BAR_H, HP_BAR_COLOR, 1)
      .setOrigin(0, 0.5)
      .setDepth(HP_BAR_DEPTH + 1)
      .setScrollFactor(0);
    this.refreshHpBar();
  }

  refreshHpBar() {
    const frac = Math.max(0, this.player.hp / this.player.maxHp);
    this.hpBarFill.scaleX = frac;
  }

  setupCamera() {
    this.cameraLookaheadX = 0;
    const cam = this.cameras.main;
    const b = this.room.getBounds();
    cam.setBounds(b.x, b.y, b.w, b.h);
    cam.setDeadzone(CAMERA_DEADZONE_W, CAMERA_DEADZONE_H);
    cam.startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP);
  }

  onPlayerDeath() {
    this.cameras.main.stopFollow();
    // Snapshot stats at the moment of death. If we read this.stats
    // inside the delayed callback the 400ms fade would inflate the
    // 'survived' time.
    const finalStats = {
      elapsedMs: this.stats.elapsedMs,
      kills: this.stats.kills,
      damageDealt: this.stats.damageDealt,
      damageTaken: this.stats.damageTaken
    };
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOverScene', { stats: finalStats });
    });
  }

  spawnDamageNumber(x, y, dmg) {
    const t = pixelText(this, x, y, `-${dmg}`, {
      size: 16, color: DMG_NUMBER_COLOR, origin: [0.5, 0.5]
    }).setDepth(DMG_NUMBER_DEPTH);
    this.tweens.add({
      targets: t,
      y: y - 20,
      alpha: 0,
      duration: DMG_NUMBER_MS,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy()
    });
  }

  spawnKillBurst(x, y, color) {
    for (let i = 0; i < KILL_BURST_COUNT; i++) {
      const a = (i / KILL_BURST_COUNT) * Math.PI * 2;
      const speed = 30 + Math.random() * 20;
      const dot = this.add.circle(x, y, 2, color, 1).setDepth(KILL_BURST_DEPTH);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * speed,
        y: y + Math.sin(a) * speed,
        alpha: 0,
        duration: KILL_BURST_MS,
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy()
      });
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
    for (const e of this.enemies) {
      if (!e.alive || !e.sprite) continue;
      const dx = e.sprite.x - px;
      const dy = e.sprite.y - py;
      const dist = Math.hypot(dx, dy);
      const reach = weapon.melee.range + Math.max(e.width, e.height) / 2;
      if (dist > reach) continue;
      const targetAngle = Math.atan2(dy, dx);
      if (Math.abs(angleDelta(targetAngle, aimAngle)) <= halfArc) {
        const ex = e.sprite.x;
        const ey = e.sprite.y;
        const died = e.hit(weapon.melee.damage, px);
        this.spawnDamageNumber(ex, ey - 15, weapon.melee.damage);
        this.stats.damageDealt += weapon.melee.damage;
        if (died) {
          this.spawnKillBurst(ex, ey, e.def?.color ?? 0xe53935);
          this.stats.kills += 1;
        }
      }
    }
  }
}
