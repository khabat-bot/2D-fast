import Phaser from 'phaser';

const HIT_FLASH_MS   = 80;
const HP_BAR_DEPTH   = 55;
const HP_BAR_W       = 24;
const HP_BAR_H       = 3;
const HP_BAR_OFFSET  = 6;      // above sprite top edge
const HP_BAR_HOLD_MS = 2000;   // visible for this long after a hit
const HP_BAR_FADE_MS = 400;

// Base class. Subclasses must:
//   - call super(scene, { hp, width, height })
//   - set this.sprite to their visual
//   - implement update(dt, ctx) and call super.update(dt, ctx) so the HP
//     bar follows the sprite
//
// hit(damage) reduces HP, flashes white, shows the HP bar, and returns
// true if the enemy died on this call. die() destroys the sprite and HP
// bar and marks the enemy not alive.
export class Enemy {
  constructor(scene, opts) {
    this.scene = scene;
    this.maxHp = opts.hp;
    this.hp = opts.hp;
    this.width = opts.width;
    this.height = opts.height;
    this.alive = true;
    this.sprite = null;
    this.hpBar = null;
    this.hpBarTween = null;
  }

  // fromX: optional source position for knockback direction. The base
  // class does not use it; subclasses override onHit to apply knockback.
  // Passing null skips onHit entirely, which suits enemies without
  // physics (future flyers that stay on a path may ignore this).
  hit(damage, fromX = null) {
    if (!this.alive) return false;
    this.hp -= damage;
    this.flashHit();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.onHit(damage, fromX);
    this.showHpBar();
    return false;
  }

  // Hook for subclasses. Base: no-op. Walker uses it for knockback.
  onHit(_damage, _fromX) { /* no-op */ }

  flashHit() {
    if (!this.sprite || this.sprite.isTinted) return;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (this.sprite && this.sprite.active) this.sprite.clearTint();
    });
  }

  showHpBar() {
    if (!this.sprite) return;
    if (!this.hpBar) {
      this.hpBar = this.scene.add.graphics().setDepth(HP_BAR_DEPTH);
    }
    this.drawHpBar();
    if (this.hpBarTween) this.hpBarTween.stop();
    this.hpBar.setAlpha(1).setVisible(true);
    this.hpBarTween = this.scene.tweens.add({
      targets: this.hpBar,
      alpha: 0,
      delay: HP_BAR_HOLD_MS,
      duration: HP_BAR_FADE_MS,
      onComplete: () => { if (this.hpBar) this.hpBar.setVisible(false); }
    });
  }

  drawHpBar() {
    if (!this.sprite || !this.hpBar) return;
    const x = Math.round(this.sprite.x - HP_BAR_W / 2);
    const y = Math.round(this.sprite.y - this.height / 2 - HP_BAR_OFFSET);
    const frac = Math.max(0, this.hp / this.maxHp);
    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.8);
    this.hpBar.fillRect(x - 1, y - 1, HP_BAR_W + 2, HP_BAR_H + 2);
    this.hpBar.fillStyle(0xe53935, 1);
    this.hpBar.fillRect(x, y, HP_BAR_W * frac, HP_BAR_H);
  }

  die() {
    this.alive = false;
    if (this.sprite) this.sprite.destroy();
    this.sprite = null;
    if (this.hpBarTween) this.hpBarTween.stop();
    this.hpBarTween = null;
    if (this.hpBar) this.hpBar.destroy();
    this.hpBar = null;
  }

  update(_dt, _ctx) {
    // Base: keep HP bar following the sprite while visible. Subclasses
    // call super.update(dt, ctx) before doing their own movement.
    if (this.hpBar && this.hpBar.visible) this.drawHpBar();
  }
}
