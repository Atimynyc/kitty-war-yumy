import Phaser from 'phaser';
import { BASE_X, CANNON_INTERVAL, UNIT_ORDER, UNITS } from './content.ts';
import type { Side } from './content.ts';
import { Battle } from './simulation.ts';
import type { Unit } from './simulation.ts';
import { portraitBaseSVG } from '../portrait-art.ts';
import { portraitProjection } from './projection.ts';
import { unitParts, unitShadowSVG, unitStarsSVG } from './unit-art.ts';
import { UnitView } from './UnitView.ts';
import { DEATH_DURATION } from './unit-motion.ts';
import { CombatLayout, targetFacing, unitScale } from './combat-layout.ts';
import type { ScreenPoint } from './combat-layout.ts';
import { baseCatSVG } from './base-cat-art.ts';
import { ORANGE_CAT, PLAYER_CAT } from './cat-appearance.ts';
import { BaseCatView } from './BaseCatView.ts';

export class BattleScene extends Phaser.Scene {
  private battle: Battle;
  private onFrame: () => void;
  private units = new Map<number, UnitView>();
  private positions = new Map<number, ScreenPoint>();
  private combatLayout = new CombatLayout();
  private launchOffsets = new Map<number, ScreenPoint>();
  private bars!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private cannons!: Phaser.GameObjects.Graphics;
  private bases: Partial<Record<Side, Phaser.GameObjects.Image>> = {};
  private baseCats!: BaseCatView;
  private accumulator = 0;
  private endingTime = 0;
  private revision = -1;
  private assetUrls: string[] = [];
  private portraitBackground!: Phaser.GameObjects.Graphics;
  speed = 1;
  manualTime = false;
  private motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  private get reducedMotion() { return this.motionPreference.matches; }
  constructor(battle: Battle, onFrame: () => void) { super('battle'); this.battle = battle; this.onFrame = onFrame; }
  preload() {
    const load = (key: string, svg: string) => {
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      this.assetUrls.push(url); this.load.svg(key, url);
    };
    load('unit-shadow', unitShadowSVG); load('unit-stars', unitStarsSVG);
    for (const side of ['player', 'enemy'] as Side[]) {
      load(`base-${side}`, portraitBaseSVG(side));
      for (const mood of ['calm', 'hungry', 'happy', 'worried'] as const) {
        load(`base-cat-${side}-${mood}`, baseCatSVG(side === 'enemy' ? ORANGE_CAT : PLAYER_CAT, mood, side === 'enemy'));
      }
      for (const kind of UNIT_ORDER) {
        for (const part of unitParts(kind, side)) load(`${side}-${kind}-${part.name}`, part.svg);
        if (kind !== 'mouse' && kind !== 'catapult') for (const look of ['back', 'front', 'side'] as const) {
          for (const part of unitParts(kind, side, look)) if (part.name === 'body' || part.name === 'rider') load(`${side}-${kind}-${part.name}-${look}`, part.svg);
        }
      }
    }
  }
  create() {
    this.assetUrls.forEach(url => URL.revokeObjectURL(url)); this.assetUrls = [];
    this.portraitBackground = this.add.graphics().setDepth(0);
    this.cameras.main.setOrigin(0, 0).setZoom(1).setScroll(0, 0);
    for (const side of ['player', 'enemy'] as Side[]) this.bases[side] = this.add.image(0, 0, `base-${side}`).setDepth(4);
    this.baseCats = new BaseCatView(this);
    this.bars = this.add.graphics().setDepth(30);
    this.fx = this.add.graphics().setDepth(40);
    this.cannons = this.add.graphics().setDepth(6);
    const parent = document.getElementById('battle-canvas')!;
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const w = Math.round(width), h = Math.round(height);
      if (this.scale.width !== w || this.scale.height !== h) this.scale.resize(w, h);
      this.game.canvas.style.width = `${w}px`; this.game.canvas.style.height = `${h}px`;
      this.drawPortraitRoom();
      const view = portraitProjection(w, h);
      for (const side of ['player', 'enemy'] as Side[]) this.bases[side]!.setPosition(w / 2, side === 'player' ? h - 40 : 40).setDisplaySize(view.baseSize, view.baseSize * 145 / 180);
      this.baseCats.draw(this.battle, w, h, this.reducedMotion);
    };
    const observer = new ResizeObserver(resize); observer.observe(parent);
    window.addEventListener('resize', resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { observer.disconnect(); window.removeEventListener('resize', resize); this.units.clear(); });
    this.game.canvas.dataset.orientation = 'vertical';
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.setAttribute('aria-label', '竖屏战场：上方大胖橘想抢走冻干，下方灰白猫代表你守护粮罐。猫咪小队沿地毯进攻。');
    document.querySelector('#loading')?.remove();
    resize(); this.onFrame();
  }
  update(_time: number, delta: number) {
    if (this.revision !== this.battle.revision) {
      for (const view of this.units.values()) view.destroy();
      this.units.clear(); this.launchOffsets.clear(); this.combatLayout.reset(); this.positions.clear(); this.accumulator = 0; this.endingTime = 0; this.revision = this.battle.revision;
    }
    if (!this.manualTime && this.battle.phase === 'playing') {
      this.accumulator += Math.min(delta, 100) / 1000 * this.speed;
      while (this.accumulator >= 1 / 30) { this.battle.step(1 / 30); this.accumulator -= 1 / 30; }
    } else this.accumulator = 0;
    if (!this.manualTime && this.battle.phase === 'ended') this.endingTime = Math.min(DEATH_DURATION, this.endingTime + Math.min(delta, 100) / 1000 * this.speed);
    this.bars.clear(); this.fx.clear();
    this.drawPortraitBattle(); this.drawCannons(); this.baseCats.draw(this.battle, this.scale.width, this.scale.height, this.reducedMotion); this.onFrame();
  }
  advanceSimulation(seconds: number) {
    if (this.bars && this.revision !== this.battle.revision) this.update(0, 0);
    // Render state is derived from simulation timestamps, including skipped intermediate frames.
    const frames = Math.ceil(seconds * 30);
    for (let i = 0; i < frames; i++) {
      const dt = Math.min(1 / 30, seconds - i / 30);
      if (this.battle.phase === 'playing') this.battle.step(dt);
      else if (this.battle.phase === 'ended') this.endingTime = Math.min(DEATH_DURATION, this.endingTime + dt);
      else break;
    }
    if (this.bars) this.update(0, 0);
  }
  private drawUnits() {
    const projection = portraitProjection(this.scale.width, this.scale.height);
    const live = new Map(this.battle.units.map(unit => [unit.id, unit]));
    const deaths = new Map(this.battle.effects.filter(effect => effect.type === 'death' && effect.unitId !== undefined).map(effect => [effect.unitId!, effect]));
    const now = this.battle.time + this.endingTime;
    for (const unit of live.values()) if (!this.units.has(unit.id)) this.units.set(unit.id, new UnitView(this, unit));
    // Also handle units killed entirely between rendered frames or during deterministic stepping.
    for (const [id, death] of deaths) {
      if (!death.kind || this.units.has(id) || death.age + this.endingTime >= DEATH_DURATION) continue;
      const unit: Unit = { id, side: death.side, kind: death.kind, x: death.x, row: death.row, hp: 0, attackCooldown: 0, attacking: false, walking: false, slow: 0, starSlow: 0, catnip: 0, walkDistance: 0, attackAt: -100, hitAt: -100,
        targetId: null, targetX: death.aimX ?? death.x, targetRow: death.aimRow ?? death.row };
      this.units.set(id, new UnitView(this, unit));
    }
    const previous = this.positions;
    this.positions = new Map(this.combatLayout.update([...live.values()], this.scale.width, this.scale.height, now));
    // Fallen units keep their last position and stop pushing living fighters.
    for (const [id, death] of deaths) if (!live.has(id)) this.positions.set(id,previous.get(id) ?? projection.project(death.x,death.row));
    for (const [id, view] of this.units) {
      const death = deaths.get(id), unit = live.get(id) ?? view.unit;
      if (!live.has(id) && (!death || death.age + this.endingTime >= DEATH_DURATION)) { view.destroy(); this.units.delete(id); continue; }
      const point = this.positions.get(id)!, size = projection.unitSize * unitScale(unit.kind);
      const target = (!death && unit.targetId !== null ? this.positions.get(unit.targetId) : undefined) ?? projection.project(unit.targetX, unit.targetRow);
      view.draw(unit, now, point.x, point.y, size, this.reducedMotion, targetFacing(point, target, unit.side), death ? this.battle.time - death.age : undefined);
      if (!death && unit.hp < UNITS[unit.kind].hp) {
        this.bars.fillStyle(0x695449, .2).fillRoundedRect(point.x - 13, point.y - size * .48, 26, 3, 1.5);
        this.bars.fillStyle(unit.side === 'player' ? 0x6c9579 : 0x9f83b2).fillRoundedRect(point.x - 13, point.y - size * .48, Math.max(1, 26 * unit.hp / UNITS[unit.kind].hp), 3, 1.5);
      }
    }
  }
  getAnimationSnapshot() { return [...this.units.values()].map(view => view.snapshot()); }
  private effectPoint(x: number, row: number, id?: number) { return (id === undefined ? undefined : this.positions.get(id)) ?? portraitProjection(this.scale.width, this.scale.height).project(x, row); }
  private launchPoint(id: number, x: number, row: number, sourceId?: number) {
    const projection = portraitProjection(this.scale.width, this.scale.height), origin = projection.project(x, row);
    if (!this.launchOffsets.has(id)) {
      const source = sourceId === undefined ? undefined : this.units.get(sourceId);
      const muzzle = source?.projectileOrigin() ?? origin;
      this.launchOffsets.set(id, { x: (muzzle.x - origin.x) / projection.unitSize, y: (muzzle.y - origin.y) / projection.unitSize });
    }
    // Keep the launch position after the caster moves or dies; scale it with the viewport.
    const offset = this.launchOffsets.get(id)!;
    return { x: origin.x + offset.x * projection.unitSize, y: origin.y + offset.y * projection.unitSize };
  }
  private cannonPosition(side: Side) { return { x: this.scale.width / 2, y: side === 'player' ? this.scale.height - 62 : 62 }; }
  private drawCannons() {
    const g = this.cannons;
    g.clear();
    const scale = .66;
    for (const side of ['player', 'enemy'] as Side[]) {
      const army = this.battle.armies[side], at = this.cannonPosition(side);
      const direction = side === 'player' ? 1 : -1;
      const dx = 0, dy = -direction;
      const recoil = this.reducedMotion ? 0 : Math.max(0, (army.cannonCooldown - CANNON_INTERVAL + .18) / .18) * 5 * scale;
      const x = at.x - dx * recoil, y = at.y - dy * recoil;
      const alpha = army.hp > 0 ? 1 : .4;
      g.fillStyle(0x665344, alpha).fillCircle(at.x, at.y + 4 * scale, 18 * scale);
      g.fillStyle(side === 'player' ? 0x77987b : 0x9a83af, alpha).fillCircle(x, y, 15 * scale);
      const tipX = x + dx * 31 * scale, tipY = y + dy * 31 * scale;
      g.lineStyle(15 * scale, 0x5f584d, alpha).lineBetween(x, y, tipX, tipY);
      g.lineStyle(8 * scale, 0xd9c6a0, alpha).lineBetween(x + dx * 8 * scale, y + dy * 8 * scale, tipX, tipY);
      g.fillStyle(0xffe1a2, alpha).fillCircle(x, y, 7 * scale);
      for (let i = 0; i < army.tech; i++) g.fillStyle(0xffdf91, alpha).fillCircle(at.x - 8 * scale + i * 8 * scale, at.y + 19 * scale, 2.5 * scale);
    }
    for (const effect of this.battle.effects) {
      if (effect.type !== 'cannon') continue;
      const start = this.cannonPosition(effect.side);
      const target = this.effectPoint(effect.targetX, effect.row, effect.targetId);
      const progress = Math.min(1, effect.age / .24), alpha = 1 - effect.age / effect.duration;
      const x = Phaser.Math.Linear(start.x, target.x, progress), y = Phaser.Math.Linear(start.y, target.y, progress);
      this.fx.lineStyle(4 * scale, 0xfff2c4, alpha).lineBetween(Phaser.Math.Linear(start.x, target.x, Math.max(0, progress - .12)), Phaser.Math.Linear(start.y, target.y, Math.max(0, progress - .12)), x, y);
      this.fx.fillStyle(0xe6a64e, alpha).fillCircle(x, y, 7 * scale);
      this.fx.fillStyle(0xfff2c4, alpha).fillCircle(x, y, 3 * scale);
      if (progress === 1) this.fx.lineStyle(3 * scale, 0xffdf9a, alpha).strokeCircle(x, y, (9 + (effect.age - .24) * 90) * scale);
      if (effect.age < .12) this.fx.fillStyle(0xffe1a2, .7).fillCircle(start.x, start.y, (11 - effect.age * 60) * scale);
    }
  }

  private drawPortraitRoom() {
    const g = this.portraitBackground, w = this.scale.width, h = this.scale.height;
    const rugWidth = Math.min(420, w * .72), rugX = (w - rugWidth) / 2;
    g.clear().fillStyle(0xe7d5b9).fillRect(0, 0, w, h);
    g.lineStyle(1, 0xc8b696, .45);
    for (let y = 0; y < h; y += 56) { g.lineBetween(0, y, w, y); const x = ((y / 56) % 2 ? .3 : .7) * w; g.lineBetween(x, y, x, y + 56); }
    g.fillStyle(0xb9baa0, .25).fillRoundedRect(rugX - 3, 22, rugWidth + 6, h - 41, 21);
    g.fillStyle(0xc8cbb0).fillRoundedRect(rugX, 18, rugWidth, h - 40, 20);
    g.lineStyle(2, 0xe8e5cc, .9).strokeRoundedRect(rugX + 8, 26, rugWidth - 16, h - 56, 15);
    g.lineStyle(1.5, 0xb8bba0, .7);
    for (let x = rugX + 16; x < rugX + rugWidth - 12; x += 9) { g.lineBetween(x, 12, x, 18); g.lineBetween(x, h - 22, x, h - 16); }
    // Small household props stay outside the combat lane.
    g.fillStyle(0xc8b29d).fillRoundedRect(w * .04, h * .32, w * .065, 34, 7);
    g.fillStyle(0x9fb18c).fillEllipse(w * .075, h * .32, 25, 21).fillEllipse(w * .05, h * .32 + 10, 23, 19).fillEllipse(w * .095, h * .32 + 10, 22, 18);
    g.fillStyle(0xd9b7a5).fillRoundedRect(w * .88, h * .63, w * .08, 35, 10);
    g.lineStyle(1.5, 0xbda58d, .5).strokeRoundedRect(w * .88 + 4, h * .63 + 4, w * .08 - 8, 27, 6);
    g.fillStyle(0xb8bea0, .6);
    for (const y of [h * .3, h * .7]) { g.fillCircle(w / 2 - 5, y, 3).fillCircle(w / 2 + 6, y + 9, 3); }
    g.fillStyle(0xb3a1c0, .22).fillEllipse(w / 2, 57, 110, 33);
    g.fillStyle(0x83a18a, .22).fillEllipse(w / 2, h - 33, 110, 33);
  }

  private drawPortraitBattle() {
    const view = portraitProjection(this.scale.width, this.scale.height);
    for (const side of ['player', 'enemy'] as Side[]) this.bases[side]!.setAlpha(this.battle.armies[side].hp === 0 ? .4 : 1);
    this.drawUnits();
    const flights = new Set([...this.battle.projectiles.map(projectile => projectile.id), ...this.battle.effects.filter(effect => effect.type === 'shot').map(effect => effect.id)]);
    for (const id of this.launchOffsets.keys()) if (!flights.has(id)) this.launchOffsets.delete(id);
    const star = (x: number, y: number, radius: number, angle: number, alpha: number) => {
      const points = Array.from({ length: 10 }, (_, i) => {
        const a = angle + i * Math.PI / 5, r = radius * (i % 2 ? .45 : 1);
        return new Phaser.Geom.Point(x + Math.cos(a) * r, y + Math.sin(a) * r);
      });
      this.fx.fillStyle(0xffe7a2, alpha).fillPoints(points, true);
      this.fx.lineStyle(1.4, 0x9b80bd, alpha).strokePoints(points, true);
    };
    for (const projectile of this.battle.projectiles) {
      const start = this.launchPoint(projectile.id, projectile.x, projectile.row, projectile.sourceId), end = this.effectPoint(projectile.targetX, projectile.targetRow, projectile.targetId);
      const t = Math.min(1, projectile.age / projectile.duration);
      const x = Phaser.Math.Linear(start.x, end.x, t), y = Phaser.Math.Linear(start.y, end.y, t);
      this.fx.lineStyle(3, 0xc7b5ec, .7).lineBetween(Phaser.Math.Linear(start.x, end.x, Math.max(0, t - .2)), Phaser.Math.Linear(start.y, end.y, Math.max(0, t - .2)), x, y);
      star(x, y, 7, this.reducedMotion ? 0 : t * 5, 1);
    }
    for (const effect of this.battle.effects) {
      if (effect.type === 'cannon' || effect.type === 'death') continue;
      const t = effect.age / effect.duration, alpha = 1 - t;
      const point = effect.type === 'shot' ? this.launchPoint(effect.id, effect.x, effect.sourceRow ?? effect.row, effect.sourceId) : this.effectPoint(effect.x, effect.sourceRow ?? effect.row, effect.sourceId);
      const target = this.effectPoint(effect.targetX, effect.row, effect.targetId);
      if (effect.type === 'shot') {
        const x = Phaser.Math.Linear(point.x, target.x, t) + Math.sin(t * Math.PI) * (effect.side === 'player' ? -15 : 15);
        const y = Phaser.Math.Linear(point.y, target.y, t), radius = effect.kind === 'catapult' ? 7 : 4;
        this.fx.fillStyle(effect.side === 'player' ? 0xb39260 : 0xaa93bc).fillCircle(x, y, radius);
        this.fx.lineStyle(1, 0xffedc9, .9).strokeCircle(x, y, radius - 2);
        if (effect.kind === 'catapult') {
          // Damage resolves on the attack tick; show its whole splash zone immediately.
          const splash = view.catapultSplashSize();
          this.fx.lineStyle(2, 0xc89559, alpha).strokeEllipse(target.x, target.y, splash.width, splash.height);
        }
      } else if (effect.type === 'roar') {
        const center = view.project(BASE_X[effect.side]);
        this.fx.lineStyle(3 * alpha, effect.side === 'player' ? 0xfff0b5 : 0xd6bdec, alpha).strokeEllipse(center.x, center.y, 30 + t * this.scale.width * .9, 25 + t * Math.min(190, this.scale.height * .5));
      } else if (effect.type === 'starHit') {
        this.fx.lineStyle(2, 0xa698d5, alpha).strokeCircle(target.x, target.y, 8 + t * 16);
        for (let i = 0; i < 3; i++) star(target.x + Math.cos(i * 2.1) * t * 20, target.y + Math.sin(i * 2.1) * t * 20, 4, i, alpha);
      } else if (effect.type === 'catnip') {
        this.fx.lineStyle(2, 0x75a16e, alpha).strokeEllipse(point.x, point.y + 10, 24 + t * 30, 10 + t * 16);
      } else if (effect.type === 'heal') {
        this.fx.fillStyle(0x6a9e7a, alpha).fillRect(target.x - 2, target.y - 24 - 12 * t, 4, 13).fillRect(target.x - 6.5, target.y - 19.5 - 12 * t, 13, 4);
      } else {
        const at = effect.type === 'hit' ? target : point;
        if (effect.type === 'hit') {
          const angle = Math.atan2(target.y - point.y, target.x - point.x);
          const reach = Math.min(view.unitSize * .48, Math.hypot(target.x - point.x, target.y - point.y) * .4);
          this.fx.lineStyle(3, 0xffecc3, alpha).beginPath().arc(point.x, point.y, reach + t * 8, angle - .65, angle + .65).strokePath();
        }
        for (let i = 0; i < 5; i++) { const angle = i * Math.PI * .4; this.fx.fillStyle(0xfff1c5, alpha).fillCircle(at.x + Math.cos(angle) * t * 22, at.y + Math.sin(angle) * t * 22, alpha * 3 + 1); }
      }
    }
  }

  getViewportSnapshot() {
    const view = portraitProjection(this.scale.width, this.scale.height);
    return { orientation: 'vertical', width: this.scale.width, height: this.scale.height, renderFrame: this.game.loop.frame,
      player: view.project(BASE_X.player), enemy: view.project(BASE_X.enemy), unitSize: view.unitSize,
      cannons: { player: this.cannonPosition('player'), enemy: this.cannonPosition('enemy') } };
  }
}

export function createGame(parent: string, battle: Battle, onFrame: () => void) {
  const scene = new BattleScene(battle, onFrame);
  const game = new Phaser.Game({
    // This sprite-only game needs no shaders. Canvas keeps resizing reliable on
    // browsers whose WebGL drawing buffer can disappear from the compositor.
    type: Phaser.CANVAS, parent, width: '100%', height: '100%',
    backgroundColor: '#eee7d9', scene: [scene],
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    audio: { noAudio: true },
    fps: { target: 60 },
  });
  return { game, scene };
}
