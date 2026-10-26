import Phaser from 'phaser';
import type { Side } from './content.ts';
import { BASE_HP, BASE_X, CANNON_INTERVAL, CANNON_RANGE, TECH_TIMES } from './content.ts';
import { BASE_NAMES, CANNON_PIVOT, FEEDER_NAMES, cannonLength } from './base-art.ts';
import type { Battle } from './simulation.ts';
import { isHidden } from './simulation.ts';
import { portraitProjection } from './projection.ts';
import { baseCatLayout } from './base-cat-layout.ts';

type Point = { x: number; y: number };
/** Display state only: upgrades, damage and recoil never change the simulation. */
export class BaseView {
  readonly root: Phaser.GameObjects.Container;
  private structure: Phaser.GameObjects.Container;
  private shell: Phaser.GameObjects.Image;
  private feeder: Phaser.GameObjects.Image;
  private damage: Phaser.GameObjects.Image;
  private mount: Phaser.GameObjects.Image;
  private barrel: Phaser.GameObjects.Image;
  private fx: Phaser.GameObjects.Graphics;
  private revision = -1;
  private tier = 1;
  private economy = 0;
  private damageLevel = 0;
  private upgradedAt = -Infinity;
  private lastTime = 0;
  private previousResearch = 0;
  private researching = false;
  private researchProgress = 0;
  private aim = 0;
  private recoil = 0;
  private upgrading = false;

  constructor(scene: Phaser.Scene, readonly side: Side) {
    this.root = scene.add.container(0, 0).setDepth(4).setName(`base-${side}`);
    this.structure = scene.add.container(0, 0);
    this.shell = scene.add.image(0, 0, `base-${side}-1`);
    this.feeder = scene.add.image(0, 0, `feeder-${side}-0`);
    this.damage = scene.add.image(0, 0, 'base-damage-0');
    const x = CANNON_PIVOT.x - 90, y = CANNON_PIVOT.y - 72.5;
    this.mount = scene.add.image(x, y, `cannon-mount-${side}-1`).setOrigin(.5, 48 / 90);
    this.barrel = scene.add.image(x, y, `cannon-barrel-${side}-1`).setOrigin(.5, 48 / 90);
    this.fx = scene.add.graphics();
    this.structure.add([this.shell, this.damage, this.feeder, this.mount, this.barrel]);
    this.root.add([this.structure, this.fx]);
  }

  draw(battle: Battle, width: number, height: number, reduced: boolean, project: (x: number, row: number, id?: number) => Point) {
    const army = battle.armies[this.side], now = battle.time, reset = this.revision !== battle.revision;
    if (reset) { this.revision = battle.revision; this.upgradedAt = -Infinity; this.aim = 0; }
    else if (army.tech > this.tier) {
      // A large deterministic time step may skip the completion frame. Don't replay an old celebration.
      this.upgradedAt = this.researching ? this.lastTime + this.previousResearch : now;
    }
    this.tier = army.tech; this.economy = army.economy;
    this.researching = army.researching; this.previousResearch = army.research; this.lastTime = now;
    this.researchProgress = army.researching ? 1 - army.research / TECH_TIMES[army.tech - 1] : 0;
    this.damageLevel = army.hp < BASE_HP * .25 ? 2 : army.hp < BASE_HP * .5 ? 1 : 0;
    const set = (image: Phaser.GameObjects.Image, key: string) => { if (image.texture.key !== key) image.setTexture(key); };
    set(this.shell, `base-${this.side}-${this.tier}`);
    set(this.mount, `cannon-mount-${this.side}-${this.tier}`);
    set(this.barrel, `cannon-barrel-${this.side}-${this.tier}`);
    set(this.feeder, `feeder-${this.side}-${army.economy}`);
    set(this.damage, `base-damage-${this.damageLevel}`);
    const projection = portraitProjection(width, height), scale = projection.baseSize / 180;
    const at = baseCatLayout(width, height).bases[this.side];
    this.root.setPosition(at.x, at.y).setScale(scale).setAlpha(army.hp > 0 ? 1 : .4);
    const age = now - this.upgradedAt;
    this.upgrading = !reduced && army.hp > 0 && age >= 0 && age < .6;
    this.structure.setScale(this.upgrading ? 1 + Math.sin(age / .6 * Math.PI) * .045 : 1);
    const direction = this.side === 'player' ? -1 : 1;
    const shot = battle.effects.find(fx => fx.type === 'cannon' && fx.side === this.side);
    const target = battle.units.filter(u => u.side !== this.side && u.hp > 0 && !isHidden(u, now) && Math.abs(u.x - BASE_X[this.side]) <= CANNON_RANGE)
      .sort((a, b) => Math.abs(a.x - BASE_X[this.side]) - Math.abs(b.x - BASE_X[this.side]) || a.id - b.id)[0];
    const aimPoint = shot ? project(shot.targetX, shot.row, shot.targetId) : target ? project(target.x, target.row, target.id) : undefined;
    if (army.hp > 0) {
      const pivot = this.mount.getWorldTransformMatrix().transformPoint(0, 0);
      const aim = aimPoint ? Math.atan2(-(aimPoint.x - pivot.x) * direction, (aimPoint.y - pivot.y) * direction) : 0;
      this.aim = Math.max(-.48, Math.min(.48, aim));
    }
    const sinceShot = CANNON_INTERVAL - army.cannonCooldown;
    this.recoil = reduced || !army.cannonShots || sinceShot >= .18 ? 0 : 5 * (1 - Math.max(0, sinceShot) / .18);
    const forward = { x: -Math.sin(this.aim) * direction, y: Math.cos(this.aim) * direction };
    this.barrel.setRotation(this.aim).setPosition(CANNON_PIVOT.x - 90 - forward.x * this.recoil, CANNON_PIVOT.y - 72.5 - forward.y * this.recoil);
    this.fx.clear();
    if (army.researching && army.hp > 0) {
      this.fx.lineStyle(6, 0x665346, .8).lineBetween(-23, 51, 23, 51);
      this.fx.lineStyle(4, 0xffd889, 1).lineBetween(-23, 51, -23 + 46 * this.researchProgress, 51);
    }
    if (this.upgrading) {
      const t = age / .6;
      this.fx.lineStyle(3, 0xe6c77b, 1 - t).strokeEllipse(0, 42, 104 + t * 42, 24 + t * 12);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        this.fx.fillStyle(i % 2 ? 0xffe3a2 : this.side === 'player' ? 0x91b79a : 0xd99a74, 1 - t)
          .fillRect(Math.cos(a) * (38 + t * 27), 10 + Math.sin(a) * 22 - t * 24, 4, 6);
      }
    }
  }

  muzzle() {
    return this.barrel.getWorldTransformMatrix().transformPoint(0, (this.side === 'player' ? -1 : 1) * cannonLength(this.tier));
  }

  snapshot() {
    const mouth = this.muzzle();
    return { side: this.side, tier: this.tier, name: BASE_NAMES[this.tier - 1], economy: this.economy, feeder: FEEDER_NAMES[this.economy],
      texture: this.shell.texture.key, cannonTexture: this.barrel.texture.key, damage: this.damageLevel,
      researching: this.researching, researchProgress: this.researchProgress, upgrading: this.upgrading,
      scale: this.structure.scaleX, alpha: this.root.alpha, aim: this.aim, recoil: this.recoil, muzzle: { x: mouth.x, y: mouth.y } };
  }

  destroy() { this.root.destroy(); }
}
