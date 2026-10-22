import Phaser from 'phaser';
import { baseSVG, roomSVG, unitSVG } from '../art.ts';
import { BASE_HP, BASE_X, CANNON_INTERVAL, UNIT_ORDER, UNITS, WORLD_HEIGHT, WORLD_WIDTH } from './content.ts';
import type { Side } from './content.ts';
import { Battle } from './simulation.ts';
import { portraitBaseSVG, portraitUnitSVG } from '../portrait-art.ts';
import { portraitProjection } from './projection.ts';

export class BattleScene extends Phaser.Scene {
  private battle: Battle;
  private onFrame: () => void;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private bars!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private cannons!: Phaser.GameObjects.Graphics;
  private bases: Partial<Record<Side, Phaser.GameObjects.Image>> = {};
  private elapsed = 0;
  private accumulator = 0;
  private assetUrls: string[] = [];
  private room!: Phaser.GameObjects.Image;
  private portraitBackground!: Phaser.GameObjects.Graphics;
  private baseLabels: Partial<Record<Side, Phaser.GameObjects.Text>> = {};
  private portrait = false;
  speed = 1;
  manualTime = false;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(battle: Battle, onFrame: () => void) { super('battle'); this.battle = battle; this.onFrame = onFrame; }
  preload() {
    const source = (svg: string) => {
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      this.assetUrls.push(url);
      return url;
    };
    this.load.svg('room', source(roomSVG));
    for (const side of ['player', 'enemy'] as Side[]) {
      this.load.svg(`base-${side}`, source(baseSVG(side)));
      this.load.svg(`portrait-base-${side}`, source(portraitBaseSVG(side)));
      for (const kind of UNIT_ORDER) {
        this.load.svg(`${side}-${kind}`, source(unitSVG(kind, side)));
        this.load.svg(`portrait-${side}-${kind}`, source(portraitUnitSVG(kind, side)));
      }
    }
  }
  create() {
    this.assetUrls.forEach(url => URL.revokeObjectURL(url));
    this.assetUrls = [];
    this.room = this.add.image(0, 0, 'room').setOrigin(0).setDepth(0);
    this.portraitBackground = this.add.graphics().setDepth(0);
    const fitCamera = () => {
      this.portrait = document.documentElement.dataset.layout === 'portrait';
      this.game.canvas.dataset.orientation = this.portrait ? 'vertical' : 'horizontal';
      this.game.canvas.setAttribute('aria-label', this.portrait
        ? '竖屏战场：我方基地在下，对手基地在上。猫咪沿地毯向中央推进。'
        : '横屏战场：我方基地在左，对手基地在右。通过佣兵卡招募小队。');
      this.room.setVisible(!this.portrait);
      this.portraitBackground.setVisible(this.portrait);
      if (this.portrait) {
        this.cameras.main.setOrigin(0, 0).setZoom(1).setScroll(0, 0);
        this.drawPortraitRoom();
      } else {
      const zoom = this.scale.width / WORLD_WIDTH;
      const visibleHeight = this.scale.height / zoom;
      const scrollY = visibleHeight < WORLD_HEIGHT ? WORLD_HEIGHT - visibleHeight : (WORLD_HEIGHT - visibleHeight) / 2;
      this.cameras.main.setOrigin(0, 0).setZoom(zoom).setScroll(0, scrollY);
      }
      const view = portraitProjection(this.scale.width, this.scale.height);
      for (const side of ['player', 'enemy'] as Side[]) {
        this.baseLabels[side]?.setVisible(!this.portrait);
        const base = this.bases[side];
        if (!base) continue;
        base.setTexture(this.portrait ? `portrait-base-${side}` : `base-${side}`);
        if (this.portrait) base.setOrigin(.5).setPosition(this.scale.width / 2, side === 'player' ? this.scale.height - 40 : 40).setDisplaySize(view.baseSize, view.baseSize * 145 / 180);
        else base.setOrigin(.5, 1).setPosition(BASE_X[side], 364).setScale(.94);
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, fitCamera);
    const parent = document.getElementById('battle-canvas')!;
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      if (width > 0 && height > 0) {
        const nextWidth = Math.round(width), nextHeight = Math.round(height);
        // Window and ResizeObserver can report the same resize. Reassigning canvas
        // dimensions clears its drawing buffer even when the size did not change.
        if (this.scale.width !== nextWidth || this.scale.height !== nextHeight) this.scale.resize(nextWidth, nextHeight);
        this.game.canvas.style.width = `${nextWidth}px`;
        this.game.canvas.style.height = `${nextHeight}px`;
      }
      fitCamera();
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    observer?.observe(parent);
    window.addEventListener('game-layout-change', resize);
    window.addEventListener('resize', resize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, fitCamera);
      window.removeEventListener('game-layout-change', resize);
      window.removeEventListener('resize', resize);
      observer?.disconnect();
    });
    for (const side of ['player', 'enemy'] as Side[]) {
      this.bases[side] = this.add.image(BASE_X[side], 364, `base-${side}`).setOrigin(.5, 1).setScale(.94).setDepth(4);
      const color = side === 'player' ? '#587c65' : '#86729c';
      this.baseLabels[side] = this.add.text(BASE_X[side], 396, side === 'player' ? '我方 · 冻干小窝' : '对手 · 馋嘴基地', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color, fontStyle: 'bold' }).setOrigin(.5).setDepth(4);
    }
    this.bars = this.add.graphics().setDepth(30);
    this.fx = this.add.graphics().setDepth(40);
    this.cannons = this.add.graphics().setDepth(6);
    document.querySelector('#loading')?.remove();
    this.game.canvas.setAttribute('role', 'img');
    resize();
    this.onFrame();
  }
  update(_time: number, delta: number) {
    const active = this.battle.phase === 'playing';
    if (active && !this.manualTime) {
      this.elapsed += Math.min(delta, 100) / 1000 * this.speed;
      this.accumulator += Math.min(delta, 100) / 1000 * this.speed;
      while (this.accumulator >= 1 / 30) { this.battle.step(1 / 30); this.accumulator -= 1 / 30; }
    } else this.accumulator = 0;
    const liveIds = new Set(this.battle.units.map(u => u.id));
    for (const [id, sprite] of this.sprites) if (!liveIds.has(id)) { sprite.destroy(); this.sprites.delete(id); }
    this.bars.clear(); this.fx.clear();
    this.drawCannons();
    if (this.portrait) { this.drawPortraitBattle(); this.onFrame(); return; }
    for (const side of ['player', 'enemy'] as Side[]) {
      const army = this.battle.armies[side], x = BASE_X[side];
      this.bars.fillStyle(0x685544, .12).fillRoundedRect(x - 80, 375, 160, 7, 3);
      if (army.hp > 0) this.bars.fillStyle(side === 'player' ? 0x7f9e79 : 0xa595ba).fillRoundedRect(x - 80, 375, Math.max(4, 160 * army.hp / BASE_HP), 7, 3);
      this.bases[side]!.setAlpha(army.hp === 0 ? .45 : 1);
      if (army.hp < BASE_HP * .5) {
        this.fx.lineStyle(2, 0x856c55, .7).beginPath().moveTo(x - 54, 293).lineTo(x - 43, 308).lineTo(x - 50, 319).lineTo(x - 36, 332).strokePath();
      }
    }
    for (const unit of this.battle.units) {
      const spec = UNITS[unit.kind];
      let sprite = this.sprites.get(unit.id);
      if (!sprite) {
        sprite = this.add.image(unit.x, 350, `${unit.side}-${unit.kind}`).setOrigin(.5, .9);
        sprite.setFlipX(unit.side === 'enemy'); this.sprites.set(unit.id, sprite);
      }
      const compact = document.documentElement.dataset.layout === 'compact-landscape';
      const zoom = this.cameras.main.zoom;
      const originalScale = unit.kind === 'catapult' ? .87 : unit.kind === 'mouse' ? .59 : unit.kind === 'shield' ? .76 : .68;
      const scale = compact ? Math.max(originalScale, 34 / (120 * zoom)) : originalScale;
      const motion = unit.walking ? Math.sin(this.elapsed * 12 + unit.id) : 0;
      const attack = unit.attacking ? Math.max(0, 1 - (spec.interval - unit.attackCooldown) * 5) : 0;
      const direction = unit.side === 'player' ? 1 : -1;
      const y = 342 + (compact ? (unit.row - 1) * 9 / zoom : unit.row * 10) - Math.abs(motion) * 3;
      sprite.setTexture(`${unit.side}-${unit.kind}`).setOrigin(.5, .9).setFlipX(unit.side === 'enemy');
      sprite.setPosition(unit.x + direction * attack * 5, y).setScale(scale, scale * (1 + Math.abs(motion) * .025)).setRotation(motion * .035 + attack * direction * .09).setDepth(10 + unit.row);
      if (unit.slow > 0) sprite.setTint(0xd3dff5); else sprite.clearTint();
      if (unit.hp < spec.hp) {
        const w = 38, bx = unit.x - w / 2, by = y - scale * 111;
        this.bars.fillStyle(0x695449, .18).fillRoundedRect(bx, by, w, 4, 2);
        this.bars.fillStyle(unit.side === 'player' ? 0x6f9d83 : 0xa491bd).fillRoundedRect(bx, by, Math.max(2, w * unit.hp / spec.hp), 4, 2);
      }
    }
    for (const effect of this.battle.effects) {
      if (effect.type === 'cannon') continue;
      const t = effect.age / effect.duration, alpha = 1 - t, y = 315 + effect.row * 10;
      if (effect.type === 'shot') {
        const x = Phaser.Math.Linear(effect.x, effect.targetX, t);
        const py = y - Math.sin(t * Math.PI) * (effect.kind === 'catapult' ? 110 : 45);
        const radius = effect.kind === 'catapult' ? 12 : 6;
        this.fx.fillStyle(effect.side === 'player' ? 0xb48f67 : 0xa395bc).fillCircle(x, py, radius);
        this.fx.lineStyle(1.5, 0xffedc9, .9).strokeCircle(x, py, radius - 3);
      } else if (effect.type === 'hit') {
        this.fx.lineStyle(3 * alpha, 0xfff4ce, alpha);
        for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4; this.fx.lineBetween(effect.targetX + Math.cos(a) * 6, y + Math.sin(a) * 6, effect.targetX + Math.cos(a) * (10 + t * 18), y + Math.sin(a) * (10 + t * 18)); }
      } else if (effect.type === 'heal') {
        this.fx.fillStyle(0x7aa78a, alpha).fillRoundedRect(effect.x - 3, y - 30 - t * 25, 6, 19, 2).fillRoundedRect(effect.x - 9.5, y - 23.5 - t * 25, 19, 6, 2);
      } else if (effect.type === 'roar') {
        this.fx.lineStyle(6 * alpha, effect.side === 'player' ? 0xffedc6 : 0xc7b7df, alpha);
        this.fx.strokeEllipse(effect.x, 300, 100 + t * 590, 70 + t * 150);
        this.fx.lineStyle(3 * alpha, 0xe6bc84, alpha).strokeEllipse(effect.x, 300, 60 + t * 450, 40 + t * 120);
      } else {
        for (let i = 0; i < 5; i++) {
          const angle = i * Math.PI * .4;
          this.fx.fillStyle(effect.type === 'death' ? 0xffedac : 0xfff7df, alpha * .8).fillCircle(effect.x + Math.cos(angle) * t * 35, y + Math.sin(angle) * t * 20 - t * 15, 3 + alpha * 4);
        }
      }
    }
    this.onFrame();
  }

  advanceSimulation(seconds: number) {
    const frames = Math.ceil(seconds * 30);
    for (let i = 0; i < frames && this.battle.phase === 'playing'; i++) {
      const dt = Math.min(1 / 30, seconds - i / 30);
      this.battle.step(dt); this.elapsed += dt;
    }
    if (this.bars) this.update(0, 0);
  }

  private cannonPosition(side: Side) {
    return this.portrait
      ? { x: this.scale.width / 2, y: side === 'player' ? this.scale.height - 62 : 62 }
      : { x: BASE_X[side] + (side === 'player' ? 42 : -42), y: 281 };
  }

  private drawCannons() {
    const g = this.cannons;
    g.clear();
    const scale = this.portrait ? .66 : 1;
    for (const side of ['player', 'enemy'] as Side[]) {
      const army = this.battle.armies[side], at = this.cannonPosition(side);
      const direction = side === 'player' ? 1 : -1;
      const dx = this.portrait ? 0 : direction, dy = this.portrait ? -direction : 0;
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
      const target = this.portrait ? portraitProjection(this.scale.width, this.scale.height).project(effect.targetX, effect.row) : { x: effect.targetX, y: 315 + effect.row * 10 };
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
    for (const unit of this.battle.units) {
      const spec = UNITS[unit.kind], point = view.project(unit.x, unit.row);
      let sprite = this.sprites.get(unit.id);
      if (!sprite) { sprite = this.add.image(point.x, point.y, `portrait-${unit.side}-${unit.kind}`); this.sprites.set(unit.id, sprite); }
      const bob = unit.walking ? Math.sin(this.elapsed * 12 + unit.id) : 0;
      const strike = unit.attacking ? Math.max(0, 1 - (spec.interval - unit.attackCooldown) * 5) : 0;
      const direction = unit.side === 'player' ? -1 : 1;
      const size = view.unitSize * (unit.kind === 'catapult' ? 1.14 : unit.kind === 'mouse' ? .85 : 1);
      sprite.setTexture(`portrait-${unit.side}-${unit.kind}`).setOrigin(.5).setFlipX(false)
        .setPosition(point.x + bob * 1.2, point.y + direction * strike * 3)
        .setDisplaySize(size, size * (1 + Math.abs(bob) * .025)).setRotation(bob * .04).setDepth(10 + point.y / Math.max(1, this.scale.height));
      if (unit.slow > 0) sprite.setTint(0xd3dff5); else sprite.clearTint();
      if (unit.hp < spec.hp) {
        this.bars.fillStyle(0x695449, .2).fillRoundedRect(point.x - 13, point.y - size * .55, 26, 3, 1.5);
        this.bars.fillStyle(unit.side === 'player' ? 0x6c9579 : 0x9f83b2).fillRoundedRect(point.x - 13, point.y - size * .55, Math.max(1, 26 * unit.hp / spec.hp), 3, 1.5);
      }
    }
    for (const effect of this.battle.effects) {
      if (effect.type === 'cannon') continue;
      const t = effect.age / effect.duration, alpha = 1 - t;
      const point = view.project(effect.x, effect.row), target = view.project(effect.targetX, effect.row);
      if (effect.type === 'shot') {
        const x = Phaser.Math.Linear(point.x, target.x, t) + Math.sin(t * Math.PI) * (effect.side === 'player' ? -15 : 15);
        const y = Phaser.Math.Linear(point.y, target.y, t), radius = effect.kind === 'catapult' ? 7 : 4;
        this.fx.fillStyle(effect.side === 'player' ? 0xb39260 : 0xaa93bc).fillCircle(x, y, radius);
        this.fx.lineStyle(1, 0xffedc9, .9).strokeCircle(x, y, radius - 2);
      } else if (effect.type === 'roar') {
        const center = view.project(BASE_X[effect.side]);
        this.fx.lineStyle(3 * alpha, effect.side === 'player' ? 0xfff0b5 : 0xd6bdec, alpha).strokeEllipse(center.x, center.y, 30 + t * this.scale.width * .9, 25 + t * Math.min(190, this.scale.height * .5));
      } else if (effect.type === 'heal') {
        this.fx.fillStyle(0x6a9e7a, alpha).fillRect(point.x - 2, point.y - 24 - 12 * t, 4, 13).fillRect(point.x - 6.5, point.y - 19.5 - 12 * t, 13, 4);
      } else {
        const at = effect.type === 'hit' ? target : point;
        for (let i = 0; i < 5; i++) { const angle = i * Math.PI * .4; this.fx.fillStyle(0xfff1c5, alpha).fillCircle(at.x + Math.cos(angle) * t * 22, at.y + Math.sin(angle) * t * 22, alpha * 3 + 1); }
      }
    }
  }

  getViewportSnapshot() {
    const view = portraitProjection(this.scale.width, this.scale.height);
    return { orientation: this.portrait ? 'vertical' : 'horizontal', width: this.scale.width, height: this.scale.height, renderFrame: this.game.loop.frame,
      player: this.portrait ? view.project(BASE_X.player) : { x: BASE_X.player, y: 342 },
      enemy: this.portrait ? view.project(BASE_X.enemy) : { x: BASE_X.enemy, y: 342 }, unitSize: this.portrait ? view.unitSize : 68,
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
