import { BASE_HP, BASE_X, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, CATNIP, ROAR, STAR_MAGIC, ECONOMY_COSTS, FOOD_RATES, MAX_POPULATION, STARTING_FOOD, TECH_COSTS, TECH_TIMES, UNITS, UNIT_ORDER } from './content.ts';
import type { Side, UnitKind } from './content.ts';
import { getLevel } from './levels.ts';
import { battleDistance } from './combat-space.ts';
import { BaseDialogue } from './base-dialogue.ts';
import { SpellNotices } from './spell-notices.ts';

export interface Army {
  food: number; hp: number; economy: number; tech: number;
  research: number; researching: boolean; roarCooldown: number; catnipCooldown: number;
  cooldowns: Record<UnitKind, number>; spent: number; hired: number; lost: number;
  cannonCooldown: number; cannonShots: number;
}
export interface Unit {
  id: number; kind: UnitKind; side: Side; x: number; hp: number;
  attackCooldown: number; slow: number; attacking: boolean; walking: boolean; row: number;
  attackAt: number; hitAt: number; walkDistance: number; starSlow: number; catnip: number;
  targetId: number | null; targetX: number; targetRow: number;
}
export interface Effect {
  id: number; type: 'hit' | 'shot' | 'cannon' | 'heal' | 'death' | 'roar' | 'spawn' | 'starHit' | 'catnip';
  side: Side; x: number; targetX: number; row: number; age: number; duration: number; kind?: UnitKind; unitId?: number;
  sourceRow?: number; sourceId?: number; targetId?: number; aimX?: number; aimRow?: number;
}
export interface StarProjectile {
  id: number; side: Side; x: number; row: number; targetX: number; targetRow: number;
  sourceId: number; targetId?: number; damage: number; age: number; duration: number;
}
export type Phase = 'ready' | 'playing' | 'paused' | 'ended';
const makeArmy = (): Army => ({ food: STARTING_FOOD, hp: BASE_HP, economy: 0, tech: 1, research: 0, researching: false, roarCooldown: 0, catnipCooldown: 0, cannonCooldown: 0, cannonShots: 0, cooldowns: Object.fromEntries(UNIT_ORDER.map(kind => [kind, 0])) as Record<UnitKind, number>, spent: 0, hired: 0, lost: 0 });
const opposite = (side: Side): Side => side === 'player' ? 'enemy' : 'player';

export class Battle {
  readonly baseDialogue = new BaseDialogue();
  readonly spellNotices = new SpellNotices();
  level = getLevel('sunroom');
  phase: Phase = 'ready';
  armies: Record<Side, Army> = { player: makeArmy(), enemy: makeArmy() };
  units: Unit[] = [];
  effects: Effect[] = [];
  projectiles: StarProjectile[] = [];
  time = 0;
  revision = 0;
  winner: Side | 'draw' | null = null;
  aiEnabled = true;
  message = '冻干已就位，小队等你出发。';
  messageUntil = 0;
  private nextId = 1;
  private aiTimer = this.level.grace;
  private aiQueueIndex = 0;
  private aiLastRecruit = 0;
  private aiSavingSince: number | null = null;

  start() { if (this.phase === 'ready') { this.phase = 'playing'; this.baseDialogue.start(this.time); this.notify(`首波敌人将在 ${this.level.grace} 秒后出发。先升级投喂机，再招募小队！`); } }
  reset(levelId = this.level.id) {
    this.baseDialogue.reset();
    this.spellNotices.reset();
    this.revision++;
    this.level = getLevel(levelId);
    this.phase = 'ready'; this.armies = { player: makeArmy(), enemy: makeArmy() };
    this.units = []; this.effects = []; this.projectiles = []; this.time = 0; this.winner = null;
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
    const unit: Unit = { id, kind, side, hp: spec.hp, x: BASE_X[side] + (side === 'player' ? 22 : -22), attackCooldown: .25, slow: 0, starSlow: 0, catnip: 0, attacking: false, walking: true, row: id % 3, attackAt: -100, hitAt: -100, walkDistance: 0,
      targetId: null, targetX: BASE_X[opposite(side)], targetRow: id % 3 };
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
    army.roarCooldown = ROAR.cooldown;
    const direction = side === 'player' ? 1 : -1;
    let affected = 0;
    for (const unit of this.units) {
      if (unit.side !== side && Math.abs(unit.x - BASE_X[side]) < ROAR.range) {
        unit.x = Math.max(BASE_X.player + 30, Math.min(BASE_X.enemy - 30, unit.x + direction * ROAR.distance));
        unit.slow = ROAR.duration; affected++;
      }
    }
    this.effect('roar', side, BASE_X[side], BASE_X[side] + direction * ROAR.range, 1, .85);
    this.spellNotices.add(side, 'roar', affected, this.time);
    if (side === 'player') this.notify('喵——！基地附近的敌人被震退了。');
    return true;
  }
  catnip(side: Side) {
    const army = this.armies[side], allies = this.units.filter(unit => unit.side === side && unit.hp > 0);
    if (this.phase !== 'playing' || army.catnipCooldown > 0 || !allies.length) return false;
    army.catnipCooldown = CATNIP.cooldown;
    for (const unit of allies) {
      unit.catnip = CATNIP.duration;
      this.effect('catnip', side, unit.x, unit.x, unit.row, .7).sourceId = unit.id;
    }
    this.spellNotices.add(side, 'catnip', allies.length, this.time);
    if (side === 'player') this.notify(`猫薄荷生效！当前 ${allies.length} 名队友攻击力 +20%，持续 10 秒；新出兵不受加成。`);
    return true;
  }
  private effect(type: Effect['type'], side: Side, x: number, targetX: number, row: number, duration: number, kind?: UnitKind, unitId?: number) {
    const effect: Effect = { id: this.nextId++, type, side, x, targetX, row, age: 0, duration, kind, unitId };
    this.effects.push(effect); return effect;
  }
  step(dt: number) {
    if (this.phase !== 'playing' || dt <= 0) return;
    // A bounded, fixed simulation step makes combat independent of browser refresh rate.
    dt = Math.min(dt, .1);
    this.time += dt;
    this.spellNotices.prune(this.time);
    for (const side of ['player', 'enemy'] as Side[]) {
      const army = this.armies[side];
      army.food += FOOD_RATES[army.economy] * dt;
      army.roarCooldown = Math.max(0, army.roarCooldown - dt);
      army.catnipCooldown = Math.max(0, army.catnipCooldown - dt);
      army.cannonCooldown = Math.max(0, army.cannonCooldown - dt);
      for (const kind of UNIT_ORDER) army.cooldowns[kind] = Math.max(0, army.cooldowns[kind] - dt);
      if (army.researching) {
        army.research = Math.max(0, army.research - dt);
        if (army.research <= .00001) {
          army.researching = false; army.tech++;
          if (side === 'player') this.notify(`${army.tech === 2 ? '二阶科技完成，盾卫、投手和法师已解锁' : '三阶科技完成，投石机、奶妈和小狗骑士已解锁'}！主炮伤害提升至 ${CANNON_DAMAGE[army.tech - 1]}。`);
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
    const slowed = new Set<number>();
    for (const star of this.projectiles) {
      const target = live.find(unit => unit.id === star.targetId);
      if (star.targetId !== undefined && !target) { star.age = star.duration; continue; }
      if (target) { star.targetX = target.x; star.targetRow = target.row; }
      star.age += dt;
      if (star.age + 1e-8 < star.duration) continue;
      if (target) {
        damage.set(target.id, (damage.get(target.id) ?? 0) + star.damage);
        slowed.add(target.id);
      } else baseDamage[opposite(star.side)] += star.damage;
      this.effect('starHit', star.side, star.targetX, star.targetX, star.targetRow, .45).targetId = star.targetId;
    }
    this.projectiles = this.projectiles.filter(star => star.age + 1e-8 < star.duration);
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
      this.effect('cannon', side, BASE_X[side], target.x, target.row, .45).targetId = target.id;
    }
    // Frontmost units claim contact positions first; damage resolves simultaneously.
    const ordered = [...this.units].sort((a, b) => (a.side === 'player' ? -a.x : a.x) - (b.side === 'player' ? -b.x : b.x));
    for (const unit of ordered) {
      const spec = UNITS[unit.kind], dir = unit.side === 'player' ? 1 : -1;
      // Integrate the slowed fraction of this step, including partial expiry.
      unit.attackCooldown = Math.max(0, unit.attackCooldown - dt + Math.min(dt, unit.starSlow) * STAR_MAGIC.slow);
      unit.attacking = false; unit.walking = false;
      const origin = live.find(snapshot => snapshot.id === unit.id)!;
      const foes = live.filter(u => u.hp > 0 && u.side !== unit.side).sort((a, b) => battleDistance(a, origin) - battleDistance(b, origin) || a.id - b.id);
      // Keep the current opponent unless a substantially closer one blocks the approach.
      const previous = foes.find(foe => foe.id === unit.targetId);
      const nearest = previous && battleDistance(previous, origin) <= battleDistance(foes[0], origin) + 20 ? previous : foes[0];
      unit.targetId = nearest?.id ?? null;
      unit.targetX = nearest?.x ?? BASE_X[opposite(unit.side)];
      unit.targetRow = nearest?.row ?? 1;
      if (spec.heal) {
        const wounded = this.units.filter(u => u.side === unit.side && u.hp < UNITS[u.kind].hp && battleDistance(live.find(snapshot => snapshot.id === u.id) ?? u, origin) <= spec.range)
          .sort((a, b) => a.hp / UNITS[a.kind].hp - b.hp / UNITS[b.kind].hp).slice(0, 3);
        const casting = this.time - unit.attackAt < .34;
        const healingTarget = wounded[0] ?? (casting ? live.find(ally => ally.id === origin.targetId && ally.side === unit.side) : undefined);
        if (healingTarget) {
          const aim = live.find(snapshot => snapshot.id === healingTarget.id)!;
          unit.targetId = aim.id; unit.targetX = aim.x; unit.targetRow = aim.row;
        }
        if (wounded.length && unit.attackCooldown <= 0) {
          for (const ally of wounded) { ally.hp = Math.min(UNITS[ally.kind].hp, ally.hp + spec.heal); this.effect('heal', unit.side, ally.x, ally.x, ally.row, .7).targetId = ally.id; }
          unit.attackCooldown = spec.interval; unit.attacking = true; unit.attackAt = this.time;
        }
        const frontline = live.filter(u => u.side === unit.side && !UNITS[u.kind].heal).sort((a, b) => dir * (b.x - a.x))[0];
        const limit = frontline ? frontline.x - dir * 85 : BASE_X[unit.side] + dir * 35;
        if (!casting && !unit.attacking && (limit - unit.x) * dir > 5 && (!nearest || battleDistance(nearest, origin) > 110)) {
          const followRow = frontline?.row ?? unit.row;
          if (!healingTarget) { unit.targetId = null; unit.targetX = limit; unit.targetRow = followRow; }
          this.move(unit, dt, limit, followRow, 0);
        }
        continue;
      }
      const targetX = nearest?.x ?? BASE_X[opposite(unit.side)];
      const distance = battleDistance(origin, { x: targetX, row: unit.targetRow });
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
          unit.attackAt = this.time;
          const attackDamage = spec.damage * (unit.catnip > dt + 1e-8 ? 1 + CATNIP.bonus : 1);
          if (unit.kind === 'mage') {
            this.projectiles.push({ id: this.nextId++, side: unit.side, x: unit.x, row: unit.row, targetX, targetRow: unit.targetRow,
              sourceId: unit.id, targetId: nearest?.id, damage: attackDamage, age: 0, duration: STAR_MAGIC.travel });
          } else if (nearest) {
            const targets = spec.splash ? foes.filter(u => battleDistance(u, nearest) <= spec.splash!) : [nearest];
            for (const victim of targets) damage.set(victim.id, (damage.get(victim.id) ?? 0) + attackDamage);
          } else baseDamage[opposite(unit.side)] += attackDamage * (spec.baseBonus ?? 1);
          if (unit.kind !== 'mage') {
            const fx = this.effect(spec.range > 60 ? 'shot' : 'hit', unit.side, unit.x, targetX, unit.targetRow, spec.range > 60 ? .4 : .25, unit.kind);
            fx.sourceRow = unit.row; fx.sourceId = unit.id; fx.targetId = nearest?.id;
          }
        }
      } else if (!inRange) this.move(unit, dt, targetX, unit.targetRow, Math.min(30, spec.range * .98));
    }
    for (const unit of this.units) {
      unit.slow = Math.max(0, unit.slow - dt);
      unit.starSlow = slowed.has(unit.id) ? STAR_MAGIC.duration : Math.max(0, unit.starSlow - dt);
      unit.catnip = Math.max(0, unit.catnip - dt);
      if ((damage.get(unit.id) ?? 0) > 0) unit.hitAt = this.time;
      unit.hp -= damage.get(unit.id) ?? 0;
      if (unit.hp <= 0) {
        this.armies[unit.side].lost++;
        const death = this.effect('death', unit.side, unit.x, unit.x, unit.row, .8, unit.kind, unit.id);
        death.aimX = unit.targetX; death.aimRow = unit.targetRow;
      }
    }
    this.units = this.units.filter(u => u.hp > 0);
    for (const side of ['player', 'enemy'] as Side[]) this.armies[side].hp = Math.max(0, this.armies[side].hp - baseDamage[side]);
    this.baseDialogue.onBaseDamage(this.time, baseDamage.player, baseDamage.enemy);
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
  private move(unit: Unit, dt: number, targetX: number, targetRow: number, stopDistance: number) {
    const roarTime = Math.min(dt, unit.slow);
    const starOnlyTime = Math.max(0, Math.min(dt, unit.starSlow) - roarTime);
    const travelTime = dt - roarTime * ROAR.slow - starOnlyTime * STAR_MAGIC.slow;
    const distance = battleDistance(unit, { x: targetX, row: targetRow });
    if (distance < 1e-8) return;
    const travel = Math.min(UNITS[unit.kind].speed * travelTime, Math.max(0, distance - stopDistance));
    if (travel <= 0) return;
    unit.x += (targetX - unit.x) * travel / distance;
    unit.row += (targetRow - unit.row) * travel / distance;
    unit.walkDistance += travel; unit.walking = true;
  }
  private decideAI() {
    const side: Side = 'enemy', army = this.armies.enemy;
    const allies = this.units.filter(u => u.side === side), foes = this.units.filter(u => u.side !== side);
    const threatened = foes.some(u => u.x > BASE_X.enemy - 310);
    const count = (kind: UnitKind) => allies.filter(u => u.kind === kind).length;
    if (threatened && army.roarCooldown === 0) this.roar(side);
    if (allies.filter(unit => unit.attacking && UNITS[unit.kind].damage > 0).length >= 3) this.catnip(side);
    // Continuous recruitment, with a bounded savings window instead of a finite
    // wave list or unbounded return paths while waiting for an expensive upgrade.
    const safe = army.hp > BASE_HP * .5 && allies.length >= this.level.investmentGuard && (!threatened || allies.length >= foes.length);
    const investEconomy = safe && army.economy < 3 && this.time >= this.level.economyAt[army.economy];
    const investTech = safe && army.tech < 3 && !army.researching && this.time >= this.level.techAt[army.tech - 1];
    if (investEconomy || investTech) {
      const upgraded = investEconomy ? this.upgradeEconomy(side) : this.researchTech(side);
      if (upgraded) this.aiSavingSince = null;
      else {
        this.aiSavingSince ??= this.time;
        if (this.time - this.aiSavingSince < this.level.savingTime && this.time - this.aiLastRecruit < this.level.savingTime) return;
      }
    } else this.aiSavingSince = null;
    // A late-game reserve can fund one heavy rider without stalling ordinary reinforcements.
    if (army.tech === 3 && count('knight') === 0 && army.food >= UNITS.knight.cost && this.summon(side, 'knight')) {
      this.aiLastRecruit = this.time; this.aiSavingSince = null; return;
    }
    const rotation = this.level.formations[army.tech - 1];
    let desired = rotation[this.aiQueueIndex % rotation.length];
    if ((desired === 'healer' && (count('healer') >= 2 || allies.length < 3)) || (desired === 'shield' && count('shield') >= 3)) desired = 'soldier';
    // Preserve the planned formation while saving briefly; otherwise short decision
    // intervals spend every last coin on mice and advanced troops never arrive.
    const emergency = threatened && (allies.length < 2 || army.hp < BASE_HP * .35);
    if (!emergency && this.time - this.aiLastRecruit < this.level.savingTime &&
      (army.food < UNITS[desired].cost || army.cooldowns[desired] > 0)) return;
    for (const kind of [...new Set<UnitKind>([desired, 'soldier', 'mouse'])]) {
      if (!this.summon(side, kind)) continue;
      this.aiQueueIndex++; this.aiLastRecruit = this.time; this.aiSavingSince = null;
      return;
    }
  }
}
