import Phaser from 'phaser';
import { BASE_X, ORANGE_BOSS, UNIT_ORDER, ENEMY_ORDER, UNITS, FOOD_RATES, BOMBARD } from './content.ts';
import type { Side } from './content.ts';
import { Battle, isHidden } from './simulation.ts';
import type { Unit } from './simulation.ts';
import { BASE_TIERS, baseShellSVG, cannonMountSVG, cannonBarrelSVG, feederSVG, baseDamageSVG } from './base-art.ts';
import { BaseView } from './BaseView.ts';
import { portraitProjection } from './projection.ts';
import { unitParts, unitShadowSVG, unitStarsSVG } from './unit-art.ts';
import { UnitView } from './UnitView.ts';
import { DEATH_DURATION } from './unit-motion.ts';
import { CombatLayout, targetFacing, unitScale } from './combat-layout.ts';
import type { ScreenPoint } from './combat-layout.ts';
import { baseCatParts, baseCatTexture, BASE_CAT_MOOD_PARTS } from './base-cat-art.ts';
import { ORANGE_CAT, PLAYER_CAT } from './cat-appearance.ts';
import type { CatAppearance } from './cat-appearance.ts';
import { BaseCatView } from './BaseCatView.ts';
import { baseCatLayout } from './base-cat-layout.ts';
import { bossSweepCorners, inBossSweep } from './boss-combat.ts';
import type { Sweep } from './boss-combat.ts';
import { LANE_SPACING } from './combat-space.ts';
import { svgURL } from '../art.ts';
import { drawChapterScene } from './scene-art.ts';
import { ENEMY_FACTION } from './enemy-roster.ts';

export class BattleScene extends Phaser.Scene {
  private battle: Battle;
  private onFrame: () => void;
  private units = new Map<number, UnitView>();
  private positions = new Map<number, ScreenPoint>();
  private combatLayout = new CombatLayout();
  private launchOffsets = new Map<number, ScreenPoint>();
  private bars!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private bases: Partial<Record<Side, BaseView>> = {};
  private cannonLaunches = new Map<number, { x: number; y: number }>();
  private baseCats!: BaseCatView;
  private resolveReady!: () => void;
  private ready = new Promise<void>(resolve=>{this.resolveReady=resolve;});
  private accumulator = 0;
  private endingTime = 0;
  private revision = -1;
  private portraitBackground!: Phaser.GameObjects.Graphics;
  speed = 1;
  manualTime = false;
  private motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  private get reducedMotion() { return this.motionPreference.matches; }
  constructor(battle: Battle, onFrame: () => void) { super('battle'); this.battle = battle; this.onFrame = onFrame; }
  preload() {
    const load = (key: string, svg: string) => {
      // Image elements can decode our local SVG artwork without a network loader.
      this.load.image(key, svgURL(svg));
    };
    load('unit-shadow', unitShadowSVG); load('unit-stars', unitStarsSVG);
    for (const damage of [0, 1, 2]) load(`base-damage-${damage}`, baseDamageSVG(damage));
    for (const side of ['player', 'enemy'] as Side[]) {
      for (const tier of BASE_TIERS) {
        load(`base-${side}-${tier}`, baseShellSVG(side, tier));
        load(`cannon-mount-${side}-${tier}`, cannonMountSVG(side, tier));
        load(`cannon-barrel-${side}-${tier}`, cannonBarrelSVG(side, tier));
      }
      for (const economy of FOOD_RATES.keys()) load(`feeder-${side}-${economy}`, feederSVG(side, economy));
      for (const mood of ['calm', 'hungry', 'happy', 'worried'] as const) {
        for (const part of baseCatParts(side === 'enemy' ? ORANGE_CAT : PLAYER_CAT, mood, side === 'enemy')) {
          if (mood === 'calm' || BASE_CAT_MOOD_PARTS.includes(part.name)) load(baseCatTexture(side,mood,part.name),part.svg);
        }
      }
      for (const kind of [...(side === 'player' ? UNIT_ORDER : ENEMY_ORDER), 'boss'] as const) {
        for (const part of unitParts(kind, side)) load(`${side}-${kind}-${part.name}`, part.svg);
        if (kind !== 'mouse' && kind !== 'catapult') for (const look of ['back', 'front', 'side'] as const) {
          for (const part of unitParts(kind, side, look)) if (part.name === 'body' || part.name === 'rider') load(`${side}-${kind}-${part.name}-${look}`, part.svg);
        }
      }
    }
  }
  create() {
    this.portraitBackground = this.add.graphics().setDepth(0);
    this.cameras.main.setOrigin(0, 0).setZoom(1).setScroll(0, 0);
    for (const side of ['player', 'enemy'] as Side[]) this.bases[side] = new BaseView(this, side);
    this.baseCats = new BaseCatView(this);
    this.bars = this.add.graphics().setDepth(30);
    this.fx = this.add.graphics().setDepth(40);
    const parent = document.getElementById('battle-canvas')!;
    const resize = () => {
      parent.parentElement!.classList.toggle('arena-narrow', parent.parentElement!.clientWidth <= 350);
      const { width, height } = parent.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const w = Math.round(width), h = Math.round(height);
      if (this.scale.width !== w || this.scale.height !== h) this.scale.resize(w, h);
      this.game.canvas.style.width = `${w}px`; this.game.canvas.style.height = `${h}px`;
      this.drawPortraitRoom();
      for (const side of ['player', 'enemy'] as Side[]) this.bases[side]!.draw(this.battle, w, h, this.reducedMotion, (x, row, id) => this.effectPoint(x, row, id));
      this.baseCats.draw(this.battle, w, h, this.reducedMotion);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(parent);
    window.addEventListener('resize', resize);
    window.addEventListener('game-layout-change', resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { observer?.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('game-layout-change', resize); this.units.clear(); this.baseCats.destroy(); for (const side of ['player', 'enemy'] as Side[]) this.bases[side]?.destroy(); });
    this.game.canvas.dataset.orientation = 'vertical';
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.setAttribute('aria-label', '竖屏战场：上方大胖橘想抢走冻干，下方我的猫咪守护粮罐。猫咪小队沿地毯进攻。');
    document.querySelector('#loading')?.remove();
    resize(); this.resolveReady(); this.onFrame();
  }
  update(_time: number, delta: number) {
    if (this.revision !== this.battle.revision) {
      for (const view of this.units.values()) view.destroy();
      this.units.clear(); this.launchOffsets.clear(); this.cannonLaunches.clear(); this.combatLayout.reset(); this.positions.clear(); this.accumulator = 0; this.endingTime = 0; this.revision = this.battle.revision;
      this.drawPortraitRoom();
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
    this.positions = new Map(this.combatLayout.update([...live.values()].filter(unit => !isHidden(unit, this.battle.time)), this.scale.width, this.scale.height, now));
    for (const unit of live.values()) if (isHidden(unit, this.battle.time)) this.positions.set(unit.id, projection.project(unit.x, unit.row));
    for (const unit of live.values()) if ((unit.bossEntry??0)>0) {
      const at=baseCatLayout(this.scale.width,this.scale.height).enemy,to=this.positions.get(unit.id)!;
      const progress=1-unit.bossEntry!/ORANGE_BOSS.entrance,ease=progress*progress*(3-2*progress);
      this.positions.set(unit.id,{x:Phaser.Math.Linear(at.x,to.x,ease),y:Phaser.Math.Linear(at.y-at.size*.5,to.y,ease)});
    }
    // Fallen units keep their last position and stop pushing living fighters.
    for (const [id, death] of deaths) if (!live.has(id)) this.positions.set(id,previous.get(id) ?? projection.project(death.x,death.row));
    for (const [id, view] of this.units) {
      const death = deaths.get(id), unit = live.get(id) ?? view.unit;
      if (!live.has(id) && (!death || death.age + this.endingTime >= DEATH_DURATION)) { view.destroy(); this.units.delete(id); continue; }
      const point = this.positions.get(id)!;
      let size = projection.unitSize * unitScale(unit.kind);
      if((unit.bossEntry??0)>0)size=Phaser.Math.Linear(baseCatLayout(this.scale.width,this.scale.height).enemy.size,size,1-unit.bossEntry!/ORANGE_BOSS.entrance);
      let target = (!death && unit.targetId !== null ? this.positions.get(unit.targetId) : undefined) ?? projection.project(unit.targetX, unit.targetRow);
      const sweep=unit.sweep ?? (unit.kind==='boss'?this.battle.effects.find(fx=>fx.type==='sweep' && fx.sourceId===id)?.sweep:undefined);
      if(sweep && !death) {
        const origin=projection.project(unit.x,unit.row),aim=projection.project(unit.x+sweep.forwardX*ORANGE_BOSS.sweepDepth,unit.row+sweep.forwardY*ORANGE_BOSS.sweepDepth/LANE_SPACING);
        target={x:point.x+aim.x-origin.x,y:point.y+aim.y-origin.y};
      }
      view.draw(unit, now, point.x, point.y, size, this.reducedMotion, targetFacing(point, target, unit.side), death ? this.battle.time - death.age : undefined);
      if (!death && unit.kind!=='boss' && unit.hp < UNITS[unit.kind].hp) {
        this.bars.fillStyle(0x695449, .2).fillRoundedRect(point.x - 13, point.y - size * .48, 26, 3, 1.5);
        this.bars.fillStyle(unit.side === 'player' ? 0x6c9579 : 0xba6850).fillRoundedRect(point.x - 13, point.y - size * .48, Math.max(1, 26 * unit.hp / UNITS[unit.kind].hp), 3, 1.5);
      }
    }
  }
  getAnimationSnapshot() { return [...this.units.values()].map(view => view.snapshot()); }
  getBaseCatSnapshot() { return this.baseCats?.snapshot() ?? null; }
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
  private cannonPosition(side: Side) { return this.bases[side]!.muzzle(); }
  private drawCannons() {
    const { width, height } = this.scale;
    const baseScale = portraitProjection(width, height).baseSize / 180;
    const scale = .66;
    for (const side of ['player', 'enemy'] as Side[]) this.bases[side]!.draw(this.battle, width, height, this.reducedMotion, (x, row, id) => this.effectPoint(x, row, id));
    const active = new Set(this.battle.effects.filter(effect => effect.type === 'cannon').map(effect => effect.id));
    for (const id of this.cannonLaunches.keys()) if (!active.has(id)) this.cannonLaunches.delete(id);
    for (const effect of this.battle.effects) {
      if (effect.type !== 'cannon') continue;
      const center = baseCatLayout(width, height).bases[effect.side];
      if (!this.cannonLaunches.has(effect.id)) {
        const muzzle = this.cannonPosition(effect.side);
        this.cannonLaunches.set(effect.id, { x: (muzzle.x - center.x) / baseScale, y: (muzzle.y - center.y) / baseScale });
      }
      const offset = this.cannonLaunches.get(effect.id)!;
      const start = { x: center.x + offset.x * baseScale, y: center.y + offset.y * baseScale };
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
    drawChapterScene(this.portraitBackground, this.battle.level.scene ?? 'sunroom', this.scale.width, this.scale.height);
    this.game.canvas.dataset.scene = this.battle.level.scene ?? 'sunroom';
    this.game.canvas.setAttribute('aria-label', `第 ${this.battle.level.stage ?? 1} 关 ${this.battle.level.name}：我方在下，${ENEMY_FACTION}在上，猫咪小队沿中央路线进攻。`);
  }

  private drawPortraitBattle() {
    const view = portraitProjection(this.scale.width, this.scale.height);
    this.drawUnits();
    for (const unit of this.battle.units) if(unit.sweep) this.drawBossSweep(unit.x,unit.row,unit.sweep,unit.id,.18+.2*(1-unit.sweep.remaining/ORANGE_BOSS.windup),false);
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
      this.fx.lineStyle(3, projectile.side === 'enemy' ? 0xe8bf72 : 0xc7b5ec, .7).lineBetween(Phaser.Math.Linear(start.x, end.x, Math.max(0, t - .2)), Phaser.Math.Linear(start.y, end.y, Math.max(0, t - .2)), x, y);
      if (projectile.kind === 'litter') {
        const arc = Math.sin(t * Math.PI) * 24;
        this.fx.fillStyle(0xd8c69a, 1).fillCircle(x, y - arc, 6);
        this.fx.lineStyle(2, 0x9c9469, 1).lineBetween(x - 3, y - arc - 4, x + 3, y - arc - 4);
      } else if (projectile.side === 'enemy') {
        this.fx.lineStyle(2, 0xb98542, 1).strokeCircle(x, y, 6);
        this.fx.lineStyle(1.5, 0xffedb8, 1).strokeCircle(x, y, 3);
        this.fx.fillStyle(0xe7bd62, 1).fillCircle(x, y, 1.8);
      } else star(x, y, 7, this.reducedMotion ? 0 : t * 5, 1);
    }
    for (const effect of this.battle.effects) {
      if (effect.type === 'cannon' || effect.type === 'death') continue;
      const t = effect.age / effect.duration, alpha = 1 - t;
      const point = effect.type === 'shot' ? this.launchPoint(effect.id, effect.x, effect.sourceRow ?? effect.row, effect.sourceId) : this.effectPoint(effect.x, effect.sourceRow ?? effect.row, effect.sourceId);
      const target = this.effectPoint(effect.targetX, effect.row, effect.targetId);
      if (effect.type === 'sweep' && effect.sweep) {
        this.drawBossSweep(effect.x,effect.row,effect.sweep,effect.sourceId,alpha*.65,true);
      } else if (effect.type === 'hook') {
        this.fx.lineStyle(2, 0xb29c72, alpha).lineBetween(point.x, point.y, target.x, target.y);
        this.fx.fillStyle(0xddaa98, alpha).fillEllipse(target.x, target.y, 12, 7);
      } else if (effect.type === 'dust') {
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          this.fx.fillStyle(0xc4b58c, alpha * .6).fillCircle(target.x + Math.cos(a) * t * 24, target.y + Math.sin(a) * t * 13, 7 + t * 4);
        }
      } else if (effect.type === 'stealth' || effect.type === 'dodge') {
        this.fx.lineStyle(2, 0xa49bbd, alpha).strokeEllipse(target.x, target.y, 15 + t * 35, 9 + t * 16);
        if (effect.type === 'stealth') for (const offset of [-12, 0, 12]) this.fx.fillStyle(0xc9bfd7, alpha * .6).fillCircle(point.x + offset, point.y - t * 14, 9 * alpha + 2);
      } else if (effect.type === 'guard' || effect.type === 'drum') {
        this.fx.lineStyle(2, effect.type === 'guard' ? 0x83b99a : 0xd4ad61, alpha).strokeEllipse(point.x, point.y, 20 + t * 80, 10 + t * 35);
      } else if (effect.type === 'shot') {
        const x = Phaser.Math.Linear(point.x, target.x, t) + Math.sin(t * Math.PI) * (effect.side === 'player' ? -15 : 15);
        const y = Phaser.Math.Linear(point.y, target.y, t), radius = effect.kind === 'catapult' ? 7 : 4;
        this.fx.fillStyle(effect.side === 'player' ? effect.kind === 'gunner' || effect.kind === 'catapult' ? 0xe6b379 : 0xb39260 : 0xe4ae63).fillCircle(x, y, radius);
        this.fx.lineStyle(1, 0xffedc9, .9).strokeCircle(x, y, radius - 2);
        if (effect.side === 'enemy') {
          this.fx.fillStyle(0x805439, 1).fillCircle(x - radius * .3, y - radius * .25, 1.1).fillCircle(x + radius * .4, y, 1).fillCircle(x, y + radius * .4, 1);
        }
        if (effect.kind === 'catapult') {
          // Damage resolves on the attack tick; show its whole splash zone immediately.
          const splash = view.catapultSplashSize();
          this.fx.lineStyle(2, 0xc89559, alpha).strokeEllipse(target.x, target.y, splash.width, splash.height);
        }
      } else if (effect.type === 'bombard') {
        const start=view.project(BASE_X.player,0), end=view.project(BASE_X.enemy,1);
        const rx=BOMBARD.radius*Math.abs(end.x-start.x)/LANE_SPACING;
        const ry=BOMBARD.radius*Math.abs(end.y-start.y)/(BASE_X.enemy-BASE_X.player);
        const color=effect.side==='player'?0xd7a04e:0xc87359;
        this.fx.fillStyle(color,effect.landed?alpha*.22:.1).fillEllipse(target.x,target.y,rx*2,ry*2);
        this.fx.lineStyle(effect.landed?3:1.5,color,effect.landed?alpha:.8).strokeEllipse(target.x,target.y,rx*2,ry*2);
        if (!effect.landed) {
          this.fx.lineStyle(2,color,.7).lineBetween(target.x-5,target.y,target.x+5,target.y).lineBetween(target.x,target.y-5,target.x,target.y+5);
          const fall=Math.min(1,effect.age/BOMBARD.delay);
          for (const dx of [-14,0,14]) {
            const y=target.y-(this.reducedMotion?18:55*(1-fall))-Math.abs(dx)*.3;
            this.fx.fillStyle(0xeabb7b,1).fillCircle(target.x+dx,y,7);
            this.fx.lineStyle(1.2,0xfff0cd,1).strokeCircle(target.x+dx,y,4).lineBetween(target.x+dx-5,y-3,target.x+dx+5,y+3);
          }
        } else for (let i=0;i<6;i++) {
          const a=i*Math.PI/3, burst=this.reducedMotion?.35:Math.min(1,(effect.age-BOMBARD.delay)/.55);
          this.fx.fillStyle(0xf5d19b,alpha).fillCircle(target.x+Math.cos(a)*rx*burst,target.y+Math.sin(a)*ry*burst,5*alpha+2);
        }
      } else if (effect.type === 'treat') {
        const lift=this.reducedMotion?0:t*18;
        this.fx.lineStyle(2,0xa4bb8a,alpha).strokeEllipse(point.x,point.y+10,28+t*12,12);
        this.fx.fillStyle(0xfffae4,alpha).fillRoundedRect(point.x-8,point.y-34-lift,16,18,4);
        this.fx.fillStyle(0xc98779,alpha).fillRect(point.x-2,point.y-31-lift,4,12).fillRect(point.x-6,point.y-27-lift,12,4);
      } else if (effect.type === 'starHit') {
        this.fx.lineStyle(2, effect.side === 'enemy' ? 0xd5a44f : 0xa698d5, alpha).strokeCircle(target.x, target.y, 8 + t * 16);
        if (effect.side === 'enemy') this.fx.lineStyle(1.5, 0xe9c880, alpha).strokeCircle(target.x, target.y, 4 + t * 10);
        else for (let i = 0; i < 3; i++) star(target.x + Math.cos(i * 2.1) * t * 20, target.y + Math.sin(i * 2.1) * t * 20, 4, i, alpha);
      } else if (effect.type === 'catnip') {
        this.fx.lineStyle(2, 0x75a16e, alpha).strokeEllipse(point.x, point.y + 10, 24 + t * 30, 10 + t * 16);
      } else if (effect.type === 'heal') {
        this.fx.fillStyle(0x6a9e7a, alpha).fillRect(target.x - 2, target.y - 24 - 12 * t, 4, 13).fillRect(target.x - 6.5, target.y - 19.5 - 12 * t, 13, 4);
        if (effect.side === 'enemy') this.fx.lineStyle(1.5, 0xe2b665, alpha).strokeEllipse(target.x, target.y + 6, 16 + t * 16, 7 + t * 8);
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

  private drawBossSweep(x:number,row:number,sweep:Sweep,id:number|undefined,alpha:number,hit:boolean) {
    const projection=portraitProjection(this.scale.width,this.scale.height),anchor=projection.project(x,row);
    const at=this.effectPoint(x,row,id),offset={x:at.x-anchor.x,y:at.y-anchor.y};
    const corners=bossSweepCorners({x,row},sweep).map(p=>{const q=projection.project(p.x,p.row);return new Phaser.Geom.Point(q.x+offset.x,q.y+offset.y);});
    this.fx.fillStyle(hit?0xffcc78:0xd68048,alpha*.45).fillPoints(corners,true);
    this.fx.lineStyle(hit?3:1.5,hit?0xfff0c0:0xb86538,alpha).strokePoints(corners,true);
    for(const victim of this.battle.units.filter(u=>u.side==='player' && inBossSweep({x,row},sweep,u))) {
      const p=this.positions.get(victim.id)!;
      this.fx.lineStyle(hit?3:1.5,hit?0xffecc3:0xb86538,alpha).strokeEllipse(p.x,p.y+10,22,8);
    }
    if(hit) {
      const end=projection.project(x+sweep.forwardX*ORANGE_BOSS.sweepDepth,row+sweep.forwardY*ORANGE_BOSS.sweepDepth/LANE_SPACING);
      const angle=Math.atan2(end.y-anchor.y,end.x-anchor.x);
      this.fx.lineStyle(5,0xffe3a3,alpha).beginPath().arc(at.x,at.y,projection.unitSize*.8,angle-1.2,angle+1.2).strokePath();
    }
  }

  async setPlayerAppearance(appearance: CatAppearance) {
    await this.ready;
    await this.baseCats.setPlayerAppearance(appearance);
    this.baseCats.draw(this.battle,this.scale.width,this.scale.height,this.reducedMotion);
  }
  getPlayerAppearance(){return this.baseCats?.getPlayerAppearance() ?? PLAYER_CAT;}
  getBaseSnapshot() { return { player: this.bases.player?.snapshot(), enemy: this.bases.enemy?.snapshot() }; }

  getViewportSnapshot() {
    const view = portraitProjection(this.scale.width, this.scale.height);
    return { orientation: 'vertical', scene: this.battle.level.scene ?? 'sunroom', width: this.scale.width, height: this.scale.height, renderFrame: this.game.loop.frame,
      player: view.project(BASE_X.player), enemy: view.project(BASE_X.enemy), unitSize: view.unitSize,
      bases: this.getBaseSnapshot(), cannons: { player: this.cannonPosition('player'), enemy: this.cannonPosition('enemy') } };
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
    loader: { imageLoadType: 'HTMLImageElement' },
    fps: { target: 60 },
  });
  return { game, scene };
}
