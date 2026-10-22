import { BASE_HP, BASE_X, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, ECONOMY_COSTS, FOOD_RATES, MAX_POPULATION, STARTING_FOOD, TECH_COSTS, TECH_TIMES, UNITS, UNIT_ORDER } from './content.ts';
import type { Side, UnitKind } from './content.ts';
import { getLevel } from './levels.ts';

export interface Army {
  food: number; hp: number; economy: number; tech: number;
  research: number; researching: boolean; roarCooldown: number;
  cooldowns: Record<UnitKind, number>; spent: number; hired: number; lost: number;
  cannonCooldown: number; cannonShots: number;
}
export interface Unit {
  id: number; kind: UnitKind; side: Side; x: number; hp: number;
  attackCooldown: number; slow: number; attacking: boolean; walking: boolean; row: number;
}
export interface Effect {
  id: number; type: 'hit' | 'shot' | 'cannon' | 'heal' | 'death' | 'roar' | 'spawn';
  side: Side; x: number; targetX: number; row: number; age: number; duration: number; kind?: UnitKind;
}
export type Phase = 'ready' | 'playing' | 'paused' | 'ended';
const makeArmy = (): Army => ({ food: STARTING_FOOD, hp: BASE_HP, economy: 0, tech: 1, research: 0, researching: false, roarCooldown: 0, cannonCooldown: 0, cannonShots: 0, cooldowns: { mouse: 0, soldier: 0, shield: 0, slinger: 0, catapult: 0, healer: 0 }, spent: 0, hired: 0, lost: 0 });
const opposite = (side: Side): Side => side === 'player' ? 'enemy' : 'player';

export class Battle {
  level = getLevel('sunroom');
  phase: Phase = 'ready';
  armies: Record<Side, Army> = { player: makeArmy(), enemy: makeArmy() };
  units: Unit[] = [];
  effects: Effect[] = [];
  time = 0;
  winner: Side | 'draw' | null = null;
  aiEnabled = true;
  message = '冻干已就位，小队等你出发。';
  messageUntil = 0;
  private nextId = 1;
  private aiTimer = this.level.grace;
  private aiQueueIndex = 0;
  private aiLastRecruit = 0;
  private aiSavingSince: number | null = null;

  start() { if (this.phase === 'ready') { this.phase = 'playing'; this.notify(`首波敌人将在 ${this.level.grace} 秒后出发。先升级投喂机，再招募小队！`); } }
  reset(levelId = this.level.id) {
    this.level = getLevel(levelId);
    this.phase = 'ready'; this.armies = { player: makeArmy(), enemy: makeArmy() };
    this.units = []; this.effects = []; this.time = 0; this.winner = null;
    this.nextId = 1; this.aiTimer = this.level.grace; this.aiQueueIndex = 0; this.aiLastRecruit = 0; this.aiSavingSince = null;
    this.aiEnabled = true;
    this.message = '冻干已就位，小队等你出发。'; this.messageUntil = 0;
  }
  togglePause() { if (this.phase === 'playing') this.phase = 'paused'; else if (this.phase === 'paused') this.phase = 'playing'; }
  population(side: Side) { return this.units.filter(u => u.side === side).reduce((n, u) => n + UNITS[u.kind].population, 0); }
  notify(text: string) { this.message = text; this.messageUntil = this.time + 5; }
  summonReason(side: Side, kind: UnitKind): string {
    const army = this.armies[side], spec = UNITS[kind];
    if (army.tech < spec.tier) return `${spec.tier === 2 ? '二' : '三'}阶科技解锁`;
    if (this.phase !== 'playing') return this.phase === 'paused' ? '已暂停' : this.phase === 'ended' ? '已结束' : '等待开战';
    if (army.cooldowns[kind] > 0) return `${army.cooldowns[kind].toFixed(1)}s`;
    if (this.population(side) + spec.population > MAX_POPULATION) return '人口已满';
    if (army.food + .00001 < spec.cost) return '猫粮不足';
    return '';
  }
  summon(side: Side, kind: UnitKind) {
    if (this.summonReason(side, kind)) return false;
    const army = this.armies[side], spec = UNITS[kind];
    army.food -= spec.cost; army.spent += spec.cost; army.hired++; army.cooldowns[kind] = spec.cooldown;
    const id = this.nextId++;
    const unit: Unit = { id, kind, side, hp: spec.hp, x: BASE_X[side] + (side === 'player' ? 22 : -22), attackCooldown: .25, slow: 0, attacking: false, walking: true, row: id % 3 };
    this.units.push(unit); this.effect('spawn', side, unit.x, unit.x, unit.row, .6);
    return true;
  }
  upgradeEconomy(side: Side) {
    const army = this.armies[side], cost = ECONOMY_COSTS[army.economy];
    if (this.phase !== 'playing' || cost === undefined || army.food < cost) return false;
    army.food -= cost; army.spent += cost; army.economy++;
    if (side === 'player') this.notify(`投喂机升级啦！现在每秒生产 ${FOOD_RATES[army.economy]} 猫粮。`);
    return true;
  }
  researchTech(side: Side) {
    const army = this.armies[side], cost = TECH_COSTS[army.tech - 1];
    if (this.phase !== 'playing' || army.researching || cost === undefined || army.food < cost) return false;
    army.food -= cost; army.spent += cost; army.researching = true; army.research = TECH_TIMES[army.tech - 1];
    if (side === 'player') this.notify('猫咪正在研究新装备，期间可以继续招募。');
    return true;
  }
  roar(side: Side) {
    const army = this.armies[side];
    if (this.phase !== 'playing' || army.roarCooldown > 0) return false;
    army.roarCooldown = 45;
    const direction = side === 'player' ? 1 : -1;
    for (const unit of this.units) {
      if (unit.side !== side && Math.abs(unit.x - BASE_X[side]) < 300) {
        unit.x = Math.max(BASE_X.player + 30, Math.min(BASE_X.enemy - 30, unit.x + direction * 130));
        unit.slow = 3;
      }
    }
    this.effect('roar', side, BASE_X[side], BASE_X[side] + direction * 300, 1, .85);
    if (side === 'player') this.notify('喵——！基地附近的敌人被震退了。');
    return true;
  }
  private effect(type: Effect['type'], side: Side, x: number, targetX: number, row: number, duration: number, kind?: UnitKind) {
    this.effects.push({ id: this.nextId++, type, side, x, targetX, row, age: 0, duration, kind });
  }
  step(dt: number) {
    if (this.phase !== 'playing' || dt <= 0) return;
    // A bounded, fixed simulation step makes combat independent of browser refresh rate.
    dt = Math.min(dt, .1);
    this.time += dt;
    for (const side of ['player', 'enemy'] as Side[]) {
      const army = this.armies[side];
      army.food += FOOD_RATES[army.economy] * dt;
      army.roarCooldown = Math.max(0, army.roarCooldown - dt);
      army.cannonCooldown = Math.max(0, army.cannonCooldown - dt);
      for (const kind of UNIT_ORDER) army.cooldowns[kind] = Math.max(0, army.cooldowns[kind] - dt);
      if (army.researching) {
        army.research = Math.max(0, army.research - dt);
        if (army.research <= .00001) {
          army.researching = false; army.tech++;
          if (side === 'player') this.notify(`${army.tech === 2 ? '二阶科技完成，盾卫和投手已解锁' : '三阶科技完成，投石机和奶妈已解锁'}！主炮伤害提升至 ${CANNON_DAMAGE[army.tech - 1]}。`);
        }
      }
    }
    for (const fx of this.effects) fx.age += dt;
    this.effects = this.effects.filter(fx => fx.age < fx.duration);
    const damage = new Map<number, number>();
    const baseDamage: Record<Side, number> = { player: 0, enemy: 0 };
    const meleeSlots = new Map<string, number>();
    // Every unit reads the same start-of-step positions. Moving one side first must
    // not let the other side land a first strike a frame earlier on contact.
    const live = this.units.map(unit => ({ ...unit }));
    // Defensive cannons use the same snapshot/damage batch as troops, so neither
    // side gains an update-order advantage. With no target the cannon stays ready.
    for (const side of ['player', 'enemy'] as Side[]) {
      const army = this.armies[side];
      if (army.hp <= 0 || army.cannonCooldown > 0) continue;
      const target = live.filter(unit => unit.hp > 0 && unit.side !== side && Math.abs(unit.x - BASE_X[side]) <= CANNON_RANGE)
        .sort((a, b) => Math.abs(a.x - BASE_X[side]) - Math.abs(b.x - BASE_X[side]) || a.id - b.id)[0];
      if (!target) continue;
      damage.set(target.id, (damage.get(target.id) ?? 0) + CANNON_DAMAGE[army.tech - 1]);
      army.cannonCooldown = CANNON_INTERVAL; army.cannonShots++;
      this.effect('cannon', side, BASE_X[side], target.x, target.row, .45);
    }
    // Frontmost units claim contact positions first; damage resolves simultaneously.
    const ordered = [...this.units].sort((a, b) => (a.side === 'player' ? -a.x : a.x) - (b.side === 'player' ? -b.x : b.x));
    for (const unit of ordered) {
      const spec = UNITS[unit.kind], dir = unit.side === 'player' ? 1 : -1;
      unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
      unit.slow = Math.max(0, unit.slow - dt); unit.attacking = false; unit.walking = false;
      const foes = live.filter(u => u.side !== unit.side).sort((a, b) => Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x));
      const nearest = foes[0];
      if (spec.heal) {
        const wounded = this.units.filter(u => u.side === unit.side && u.hp < UNITS[u.kind].hp && Math.abs((live.find(snapshot => snapshot.id === u.id)?.x ?? u.x) - unit.x) <= spec.range)
          .sort((a, b) => a.hp / UNITS[a.kind].hp - b.hp / UNITS[b.kind].hp).slice(0, 3);
        if (wounded.length && unit.attackCooldown <= 0) {
          for (const ally of wounded) { ally.hp = Math.min(UNITS[ally.kind].hp, ally.hp + spec.heal); this.effect('heal', unit.side, ally.x, ally.x, ally.row, .7); }
          unit.attackCooldown = spec.interval; unit.attacking = true;
        }
        const frontline = live.filter(u => u.side === unit.side && !UNITS[u.kind].heal).sort((a, b) => dir * (b.x - a.x))[0];
        const limit = frontline ? frontline.x - dir * 85 : BASE_X[unit.side] + dir * 35;
        if ((limit - unit.x) * dir > 5 && (!nearest || Math.abs(nearest.x - unit.x) > 110)) this.move(unit, dt, dir, nearest, limit);
        continue;
      }
      const targetX = nearest?.x ?? BASE_X[opposite(unit.side)];
      const distance = Math.abs(targetX - unit.x);
      const inRange = distance <= spec.range;
      const tooClose = spec.minRange !== undefined && distance < spec.minRange;
      const slotKey = `${unit.side}:${nearest?.id ?? 'base'}`;
      const used = meleeSlots.get(slotKey) ?? 0;
      const hasSlot = spec.range > 60 || used < 3;
      if (inRange && !tooClose && hasSlot) {
        if (spec.range <= 60) meleeSlots.set(slotKey, used + 1);
        unit.attacking = true;
        if (unit.attackCooldown <= 0) {
          unit.attackCooldown = spec.interval;
          if (nearest) {
            const targets = spec.splash ? foes.filter(u => Math.abs(u.x - nearest.x) <= spec.splash!) : [nearest];
            for (const victim of targets) damage.set(victim.id, (damage.get(victim.id) ?? 0) + spec.damage);
          } else baseDamage[opposite(unit.side)] += spec.damage * (spec.baseBonus ?? 1);
          this.effect(spec.range > 60 ? 'shot' : 'hit', unit.side, unit.x, targetX, nearest?.row ?? unit.row, spec.range > 60 ? .4 : .25, unit.kind);
        }
      } else if (!inRange) this.move(unit, dt, dir, nearest);
    }
    for (const unit of this.units) {
      unit.hp -= damage.get(unit.id) ?? 0;
      if (unit.hp <= 0) { this.armies[unit.side].lost++; this.effect('death', unit.side, unit.x, unit.x, unit.row, .8, unit.kind); }
    }
    this.units = this.units.filter(u => u.hp > 0);
    for (const side of ['player', 'enemy'] as Side[]) this.armies[side].hp = Math.max(0, this.armies[side].hp - baseDamage[side]);
    if (!this.armies.player.hp || !this.armies.enemy.hp) {
      this.phase = 'ended';
      this.winner = !this.armies.player.hp && !this.armies.enemy.hp ? 'draw' : !this.armies.enemy.hp ? 'player' : 'enemy';
      return;
    }
    if (this.aiEnabled) {
      this.aiTimer -= dt;
      if (this.aiTimer <= .00001) {
        this.aiTimer = this.time < this.level.openingDuration ? this.level.openingInterval : this.level.interval;
        this.decideAI();
      }
    }
  }
  private move(unit: Unit, dt: number, dir: number, nearest?: Unit, limit?: number) {
    let next = unit.x + dir * UNITS[unit.kind].speed * (unit.slow > 0 ? .45 : 1) * dt;
    if (nearest && (nearest.x - unit.x) * dir >= 0) next = dir > 0 ? Math.min(next, nearest.x - 30) : Math.max(next, nearest.x + 30);
    if (limit !== undefined) next = dir > 0 ? Math.min(next, limit) : Math.max(next, limit);
    next = Math.max(BASE_X.player, Math.min(BASE_X.enemy, next));
    if ((next - unit.x) * dir > 0) { unit.x = next; unit.walking = true; }
  }
  private decideAI() {
    const side: Side = 'enemy', army = this.armies.enemy;
    const allies = this.units.filter(u => u.side === side), foes = this.units.filter(u => u.side !== side);
    const threatened = foes.some(u => u.x > BASE_X.enemy - 310);
    const count = (kind: UnitKind) => allies.filter(u => u.kind === kind).length;
    if (threatened && army.roarCooldown === 0) this.roar(side);
    // Continuous recruitment, with a bounded savings window instead of a finite
    // wave list or unbounded return paths while waiting for an expensive upgrade.
    const safe = !threatened && allies.length >= 3 && allies.length + 2 >= foes.length;
    const investEconomy = safe && army.economy < 3 && this.time >= this.level.economyAt[army.economy];
    const investTech = safe && army.tech < 3 && !army.researching && this.time >= this.level.techAt[army.tech - 1];
    if (investEconomy || investTech) {
      const upgraded = investEconomy ? this.upgradeEconomy(side) : this.researchTech(side);
      if (upgraded) this.aiSavingSince = null;
      else {
        this.aiSavingSince ??= this.time;
        if (this.time - this.aiSavingSince < 10 && this.time - this.aiLastRecruit < 10) return;
      }
    } else this.aiSavingSince = null;
    const rotation: UnitKind[] = army.tech === 1 ? ['soldier', 'soldier', 'mouse']
      : army.tech === 2 ? ['shield', 'slinger', 'soldier', 'slinger', 'mouse']
      : ['shield', 'catapult', 'slinger', 'healer', 'soldier', 'slinger'];
    let desired = rotation[this.aiQueueIndex % rotation.length];
    if ((desired === 'healer' && (count('healer') >= 2 || allies.length < 3)) || (desired === 'shield' && count('shield') >= 3)) desired = 'soldier';
    if (safe && army.food < UNITS[desired].cost && this.time - this.aiLastRecruit < 7) return;
    for (const kind of [...new Set<UnitKind>([desired, 'soldier', 'mouse'])]) {
      if (!this.summon(side, kind)) continue;
      this.aiQueueIndex++; this.aiLastRecruit = this.time; this.aiSavingSince = null;
      return;
    }
  }
}
