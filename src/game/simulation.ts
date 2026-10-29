import { BASE_HP, BASE_X, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, CATNIP, TREAT, BOMBARD, SPELLS, STAR_MAGIC, ECONOMY_COSTS, FOOD_RATES, MAX_POPULATION, STARTING_FOOD, TECH_COSTS, TECH_TIMES, UNITS, UNIT_ORDER } from './content.ts';
import type { Side, UnitKind } from './content.ts';
import { getLevel, enemyPlan, reinforcementPhase } from './levels.ts';
import { battleDistance, LANE_SPACING } from './combat-space.ts';
import { BaseDialogue } from './base-dialogue.ts';
import { SpellNotices } from './spell-notices.ts';
import { ORANGE_BOSS } from './content.ts';
import { inBossSweep, sweepDirection } from './boss-combat.ts';
import type { Sweep } from './boss-combat.ts';
import { ENERGY, ENERGY_REWARDS, ENEMY_ORDER, SPECIAL } from './content.ts';
import type { SpellKind } from './spell-notices.ts';
import { addKind, emptyRunStats, clone } from './achievements.ts';
import { readBattleSave, BATTLE_RULES_VERSION } from './battle-save.ts';
import type { BattleSave } from './battle-save.ts';
import { unlockStage, techLockReason } from './unit-unlocks.ts';

export interface Army {
  food: number; hp: number; economy: number; tech: number;
  research: number; researching: boolean;
  energy: number; energyEarned: number; energySpent: number; energyOverflow: number;
  energyGain: number; energyGainAt: number;
  cooldowns: Record<UnitKind, number>; spent: number; hired: number; lost: number;
  // Older checkpoints only have the total; do not infer counts from surviving units.
  recruitCounts?: Partial<Record<UnitKind, number>>;
  cannonCooldown: number; cannonShots: number;
}
export interface Unit {
  id: number; kind: UnitKind; side: Side; x: number; hp: number;
  attackCooldown: number; slow: number; attacking: boolean; walking: boolean; row: number;
  attackAt: number; hitAt: number; walkDistance: number; starSlow: number; catnip: number;
  targetId: number | null; targetX: number; targetRow: number;
  bossEntry?: number; sweep?: Sweep;
  weakenedUntil?: number; hasteUntil?: number; guardUntil?: number; supportCooldown?: number;
  stealthUntil?: number; stealthUsed?: boolean; dodgeAt?: number;
  hookCounted?: boolean; boxerCounted?: boolean;
  charge?: { remaining: number; targetId: number | null };
}
export interface Effect {
  id: number; type: 'hit' | 'shot' | 'cannon' | 'heal' | 'death' | 'treat' | 'bombard' | 'spawn' | 'starHit' | 'catnip' | 'sweep' | 'dust' | 'dodge' | 'stealth' | 'guard' | 'drum' | 'hook';
  side: Side; x: number; targetX: number; row: number; age: number; duration: number; kind?: UnitKind; unitId?: number;
  sourceRow?: number; sourceId?: number; targetId?: number; aimX?: number; aimRow?: number;
  sweep?: Sweep;
  power?: number; landed?: boolean;
}
export interface StarProjectile {
  id: number; side: Side; x: number; row: number; targetX: number; targetRow: number;
  sourceId: number; targetId?: number; damage: number; age: number; duration: number;
  kind?: 'mage' | 'litter';
  hasteUntil?: number;
}
export const isHidden = (unit: Unit, time: number) => (unit.stealthUntil ?? 0) > time + 1e-8;
export type Phase = 'ready' | 'playing' | 'paused' | 'ended';
const makeArmy = (): Army => ({ food: STARTING_FOOD, hp: BASE_HP, economy: 0, tech: 1, research: 0, researching: false,
  energy: ENERGY.starting, energyEarned: 0, energySpent: 0, energyOverflow: 0, energyGain: 0, energyGainAt: -100,
  cannonCooldown: 0, cannonShots: 0, cooldowns: Object.fromEntries(UNIT_ORDER.map(kind => [kind, 0])) as Record<UnitKind, number>, spent: 0, hired: 0, lost: 0, recruitCounts: {} });
const opposite = (side: Side): Side => side === 'player' ? 'enemy' : 'player';

export class Battle {
  private randomState: number;
  private seed: number;
  constructor(seed = 0x51a7cafe) { this.seed = seed; this.randomState = seed >>> 0; }
  private random() { this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0; return this.randomState / 4294967296; }
  readonly baseDialogue = new BaseDialogue();
  readonly spellNotices = new SpellNotices();
  level = getLevel('campaign-01');
  phase: Phase = 'ready';
  armies: Record<Side, Army> = { player: makeArmy(), enemy: makeArmy() };
  units: Unit[] = [];
  effects: Effect[] = [];
  projectiles: StarProjectile[] = [];
  time = 0;
  revision = 0;
  winner: Side | 'draw' | null = null;
  boss = { spawned: false, unitId: null as number | null, enteredAt: 0 };
  aiEnabled = true;
  message = '冻干已就位，小队等你出发。';
  messageUntil = 0;
  private nextId = 1;
  private aiTimer = this.level.grace;
  private aiQueueIndex = 0;
  private aiLastRecruit = 0;
  private aiSavingSince: number | null = null;
  private aiKnightSavingSince: number | null = null;
  stats = emptyRunStats();
  trackingEnabled = true;
  // Pure combat callers may use the full roster; the app passes its permanent unlocks on reset.
  playerRoster: UnitKind[] = [...UNIT_ORDER];
  legacyRoster = false;

  save(): BattleSave {
    return clone({ version: 1, rules: BATTLE_RULES_VERSION, levelId: this.level.id, time: this.time, seed: this.seed,
      randomState: this.randomState, playerRoster:this.playerRoster, legacyRoster:this.legacyRoster, armies: this.armies, units: this.units, effects: this.effects, projectiles: this.projectiles,
      boss: this.boss, nextId: this.nextId, ai: { timer: this.aiTimer, queueIndex: this.aiQueueIndex, lastRecruit: this.aiLastRecruit,
        savingSince: this.aiSavingSince, knightSavingSince: this.aiKnightSavingSince, enabled: this.aiEnabled },
      message: this.message, messageUntil: this.messageUntil, dialogue: this.baseDialogue.save(), notices: this.spellNotices.save(), stats: this.stats });
  }
  restore(raw: unknown): boolean {
    const s = readBattleSave(raw);
    if (!s) return false;
    this.seed = s.seed; this.reset(s.levelId); this.randomState = s.randomState;
    this.playerRoster = s.playerRoster; this.legacyRoster = s.legacyRoster;
    this.armies = s.armies; this.units = s.units; this.effects = s.effects; this.projectiles = s.projectiles;
    this.time = s.time; this.boss = s.boss; this.nextId = s.nextId;
    this.aiTimer = s.ai.timer; this.aiQueueIndex = s.ai.queueIndex; this.aiLastRecruit = s.ai.lastRecruit;
    this.aiSavingSince = s.ai.savingSince; this.aiKnightSavingSince = s.ai.knightSavingSince; this.aiEnabled = s.ai.enabled;
    this.message = s.message; this.messageUntil = s.messageUntil; this.stats = s.stats;
    this.baseDialogue.restore(s.dialogue); this.spellNotices.restore(s.notices);
    this.phase = 'paused'; return true;
  }
  private contribute(kind: UnitKind, side: Side) { if (this.trackingEnabled && side === 'player') addKind(this.stats.participated, kind); }

  start() { if (this.phase === 'ready') { this.phase = 'playing'; this.baseDialogue.start(this.time); this.notify(`首波敌人将在 ${this.level.grace} 秒后出发。${this.level.tip ?? '先升级投喂机，再招募小队！'}`); } }
  reset(levelId = this.level.id, roster: readonly UnitKind[] = this.playerRoster) {
    this.playerRoster=UNIT_ORDER.filter(kind=>roster.includes(kind)); this.legacyRoster=false;
    this.randomState = this.seed >>> 0;
    this.baseDialogue.reset();
    this.spellNotices.reset();
    this.revision++;
    this.level = getLevel(levelId);
    this.phase = 'ready'; this.armies = { player: makeArmy(), enemy: makeArmy() };
    this.units = []; this.effects = []; this.projectiles = []; this.time = 0; this.winner = null;
    this.boss = { spawned:false,unitId:null,enteredAt:0 };
    this.nextId = 1; this.aiTimer = this.level.grace; this.aiQueueIndex = 0; this.aiLastRecruit = 0; this.aiSavingSince = null;
    this.aiKnightSavingSince = null;
    this.aiEnabled = true;
    this.stats = emptyRunStats();
    this.message = '冻干已就位，小队等你出发。'; this.messageUntil = 0;
  }
  togglePause() { if (this.phase === 'playing') this.phase = 'paused'; else if (this.phase === 'paused') this.phase = 'playing'; }
  population(side: Side) { return this.units.filter(u => u.side === side).reduce((n, u) => n + UNITS[u.kind].population, 0); }
  notify(text: string) { this.message = text; this.messageUntil = this.time + 5; }
  summonReason(side: Side, kind: UnitKind): string {
    if (kind === 'boss') return '关卡首领无法招募';
    if (side === 'enemy' && !ENEMY_ORDER.some(enemyKind => enemyKind === kind)) return '敌军没有此兵种';
    if (side === 'player' && !this.playerRoster.includes(kind)) return `到达第 ${unlockStage(kind)} 关解锁`;
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
    const counts = army.recruitCounts ?? (army.recruitCounts = {});
    counts[kind] = (counts[kind] ?? 0) + 1;
    const id = this.nextId++;
    const unit: Unit = { id, kind, side, hp: spec.hp, x: BASE_X[side] + (side === 'player' ? 22 : -22), attackCooldown: .25, slow: 0, starSlow: 0, catnip: 0, attacking: false, walking: true, row: id % 3, attackAt: -100, hitAt: -100, walkDistance: 0,
      targetId: null, targetX: BASE_X[opposite(side)], targetRow: id % 3 };
    this.units.push(unit); this.effect('spawn', side, unit.x, unit.x, unit.row, .6);
    if (this.trackingEnabled && side === 'player') addKind(this.stats.recruited, kind);
    return true;
  }
  private enterBoss() {
    if (this.boss.spawned || !this.level.bossEncounter || this.armies.enemy.hp <= 0 || this.armies.enemy.hp >= BASE_HP*this.level.bossEncounter.trigger) return;
    const id=this.nextId++,x=BASE_X.enemy-55;
    this.boss={spawned:true,unitId:id,enteredAt:this.time};
    this.units.push({id,kind:'boss',side:'enemy',hp:UNITS.boss.hp,x,row:1,targetId:null,targetX:BASE_X.player,targetRow:1,
      attackCooldown:0,slow:0,starSlow:0,catnip:0,attacking:false,walking:true,attackAt:-100,hitAt:-100,walkDistance:0,bossEntry:ORANGE_BOSS.entrance});
    this.notify('大胖橘亲自上场！小心抬爪横扫，保护后排！');
  }
  upgradeEconomy(side: Side) {
    const army = this.armies[side], cost = ECONOMY_COSTS[army.economy];
    if (this.phase !== 'playing' || cost === undefined || army.food < cost) return false;
    army.food -= cost; army.spent += cost; army.economy++;
    if (this.trackingEnabled && side === 'player') this.stats.maxEconomy = Math.max(this.stats.maxEconomy, army.economy + 1);
    if (side === 'player') this.notify(`投喂机升级啦！现在每秒生产 ${FOOD_RATES[army.economy]} 猫粮。`);
    return true;
  }
  researchReason(side: Side): string {
    const army=this.armies[side],cost=TECH_COSTS[army.tech-1];
    if(cost===undefined)return '科技已满级';
    if(army.researching)return '正在研究中';
    const locked=side==='player'?techLockReason(this.playerRoster,army.tech):'';
    if(locked)return locked;
    if(this.phase!=='playing')return this.phase==='paused'?'已暂停':'当前不能研究';
    if(army.food<cost)return '猫粮不足';
    return '';
  }
  researchTech(side: Side) {
    const army = this.armies[side], cost = TECH_COSTS[army.tech - 1];
    const reason=this.researchReason(side);
    if(reason){if(side==='player'&&this.phase==='playing')this.notify(reason);return false;}
    army.food -= cost; army.spent += cost; army.researching = true; army.research = TECH_TIMES[army.tech - 1];
    if (side === 'player') this.notify('猫咪正在研究新装备，期间可以继续招募。');
    return true;
  }
  spellReason(side: Side, kind: SpellKind): string {
    if(side==='enemy')return '敌方无法释放主动技能';
    if(this.phase!=='playing')return this.phase==='paused'?'已暂停':'当前不可释放';
    const cost=SPELLS[kind].energyCost;
    if(this.armies[side].energy<cost)return `能量不足，还差 ${cost-this.armies[side].energy}`;
    if (kind === 'bombard') {
      if (this.effects.some(fx => fx.type === 'bombard' && fx.side === side && !fx.landed)) return '毛球正在落下';
      return this.bombardTarget(side) ? '' : '没有可轰炸的敌人';
    }
    const allies = this.units.filter(u=>u.side===side && u.hp>0 && (u.bossEntry??0)<=0);
    if (!allies.length) return '请先招募伙伴';
    if (kind === 'treat' && !allies.some(u=>u.hp < UNITS[u.kind].hp - 1e-8)) return '伙伴们都是满血';
    if (kind === 'catnip' && allies.every(u=>u.catnip > CATNIP.duration - 2)) return '猫薄荷刚刚生效';
    return '';
  }
  /** Aim at a real troop in the densest group; equal groups prioritize the nearest threat. */
  bombardTarget(side: Side) {
    const foes = this.units.filter(u=>u.side!==side && u.hp>0 && (u.bossEntry??0)<=0 && !isHidden(u,this.time));
    const counts = new Map(foes.map(u=>[u.id,foes.filter(v=>battleDistance(u,v)<=BOMBARD.radius).length]));
    return foes.sort((a,b)=>counts.get(b.id)!-counts.get(a.id)! || Math.abs(a.x-BASE_X[side])-Math.abs(b.x-BASE_X[side]) || a.id-b.id)[0];
  }
  private recoverEnergy(side: Side, kind: UnitKind) {
    const army=this.armies[side],reward=ENERGY_REWARDS[kind],gain=Math.min(reward,ENERGY.max-army.energy);
    army.energy+=gain;army.energyEarned+=gain;army.energyOverflow+=reward-gain;
    if(gain>0) {
      army.energyGain=(army.energyGainAt===this.time?army.energyGain:0)+gain;
      army.energyGainAt=this.time;
    }
  }
  treat(side: Side) {
    if (this.spellReason(side,'treat')) return false;
    const army = this.armies[side]; army.energy-=TREAT.energyCost; army.energySpent+=TREAT.energyCost;
    let affected = 0, total = 0;
    for (const unit of this.units.filter(u=>u.side===side && u.hp>0 && (u.bossEntry??0)<=0 && u.hp<UNITS[u.kind].hp)) {
      const healed = Math.min(UNITS[unit.kind].hp-unit.hp, UNITS[unit.kind].hp*TREAT.fraction, TREAT.cap);
      unit.hp += healed; affected++; total += healed;
      this.effect('treat',side,unit.x,unit.x,unit.row,.9).sourceId=unit.id;
    }
    this.spellNotices.add(side,'treat',affected,this.time,{ total: Math.round(total) });
    if (this.trackingEnabled && side === 'player') this.stats.casts++;
    if (side==='player') this.notify(`急救罐头！${affected} 名伙伴共恢复 ${Math.round(total)} 点生命。`);
    return true;
  }
  bombard(side: Side) {
    if (this.spellReason(side,'bombard')) return false;
    const target=this.bombardTarget(side)!;
    const army=this.armies[side]; army.energy-=BOMBARD.energyCost; army.energySpent+=BOMBARD.energyCost;
    const fx=this.effect('bombard',side,target.x,target.x,target.row,BOMBARD.delay+.55);
    fx.power=BOMBARD.damage[army.tech-1]; fx.landed=false;
    const affected=this.units.filter(u=>u.side!==side && u.hp>0 && !isHidden(u,this.time) && (u.bossEntry??0)<=0 && battleDistance(u,target)<=BOMBARD.radius).length;
    this.spellNotices.add(side,'bombard',affected,this.time,{ power: fx.power });
    if(this.trackingEnabled && side==='player') this.stats.casts++;
    if(side==='player') this.notify(`毛球轰炸锁定敌群！${BOMBARD.delay} 秒后落地，范围伤害 ${fx.power}。`);
    return true;
  }
  catnip(side: Side) {
    const army = this.armies[side], allies = this.units.filter(unit => unit.side === side && unit.hp > 0 && (unit.bossEntry??0)<=0);
    if (this.spellReason(side,'catnip')) return false;
    army.energy-=CATNIP.energyCost;army.energySpent+=CATNIP.energyCost;
    for (const unit of allies) {
      unit.catnip = CATNIP.duration;
      this.effect('catnip', side, unit.x, unit.x, unit.row, .7).sourceId = unit.id;
    }
    this.spellNotices.add(side, 'catnip', allies.length, this.time);
    if (this.trackingEnabled && side === 'player') this.stats.casts++;
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
      army.cannonCooldown = Math.max(0, army.cannonCooldown - dt);
      for (const kind of UNIT_ORDER) army.cooldowns[kind] = Math.max(0, army.cooldowns[kind] - dt);
      if (army.researching) {
        army.research = Math.max(0, army.research - dt);
        if (army.research <= .00001) {
          army.researching = false; army.tech++;
          if (this.trackingEnabled && side === 'player') this.stats.maxTech = Math.max(this.stats.maxTech, army.tech);
          if (side === 'player') {
            const ready=this.playerRoster.filter(kind=>UNITS[kind].tier===army.tech);
            this.notify(`${army.tech === 2 ? '二阶' : '三阶'}科技完成，${ready.length ? `${ready.length} 种已解锁伙伴可以招募` : '本次没有新增可招募伙伴'}；主炮提升至 ${CANNON_DAMAGE[army.tech-1]}，轰炸伤害提升至 ${BOMBARD.damage[army.tech-1]}。`);
          }
        }
      }
    }
    for (const fx of this.effects) fx.age += dt;
    this.effects = this.effects.filter(fx => fx.age < fx.duration);
    const damage = new Map<number, number>();
    const knockback = new Map<number, { x:number; row:number; kind?: UnitKind; side?: Side }>();
    type Source = { sourceKind?: UnitKind; sourceSide?: Side; hasted?: boolean; infiltrated?: boolean };
    const source = (u: Unit): Source => ({ sourceKind: u.kind, sourceSide: u.side, hasted: (u.hasteUntil ?? 0) > this.time, infiltrated: !!u.stealthUsed });
    const hits: (Source & { target: number; amount: number; ranged: boolean; slow?: boolean; weaken?: boolean; bombId?: number; push?: { x: number; row: number } })[] = [];
    const baseHits: (Source & { amount: number; side: Side })[] = [];
    const weakened = new Map<number, Set<number>>();
    const attackPower = (unit: Unit) => (unit.catnip > dt + 1e-8 ? 1 + CATNIP.bonus : 1) * ((unit.weakenedUntil ?? 0) > this.time ? 1 - SPECIAL.litter.reduction : 1);
    const baseDamage: Record<Side, number> = { player: 0, enemy: 0 };
    // Every unit reads the same start-of-step positions. Moving one side first must
    // not let the other side land a first strike a frame earlier on contact.
    const live = this.units.filter(unit=>(unit.bossEntry??0)<=0).map(unit => ({ ...unit }));
    for (const fx of this.effects) if (fx.type==='bombard' && !fx.landed && fx.age+1e-8>=BOMBARD.delay) {
      fx.landed=true;
      for (const victim of live.filter(u=>u.hp>0 && u.side!==fx.side && !isHidden(u,this.time) && battleDistance(u,{x:fx.targetX,row:fx.row})<=BOMBARD.radius)) {
        hits.push({ target:victim.id, amount:fx.power!, ranged:true });
      }
    }
    for (const star of this.projectiles) {
      const target = live.find(unit => unit.id === star.targetId && !isHidden(unit, this.time));
      if (star.kind !== 'litter' && star.targetId !== undefined && !target) { star.age = star.duration; continue; }
      if (target) { star.targetX = target.x; star.targetRow = target.row; }
      star.age += dt;
      if (star.age + 1e-8 < star.duration) continue;
      const caster = live.find(u => u.id === star.sourceId);
      const shotSource: Source = { sourceKind: star.kind ?? 'mage', sourceSide: star.side, hasted: (caster?.hasteUntil ?? star.hasteUntil ?? 0) > this.time };
      if (star.kind === 'litter') {
        for (const victim of live.filter(u => u.side !== star.side && !isHidden(u, this.time) && battleDistance(u, { x: star.targetX, row: star.targetRow }) <= UNITS.litter.splash!)) {
          hits.push({ ...shotSource, target: victim.id, amount: star.damage, ranged: true, weaken: true, bombId: star.id });
        }
        if (star.targetId === undefined) { baseDamage[opposite(star.side)] += star.damage; baseHits.push({ ...shotSource, side: opposite(star.side), amount: star.damage }); }
        this.effect('dust', star.side, star.targetX, star.targetX, star.targetRow, .65);
      } else if (target) {
        hits.push({ ...shotSource, target: target.id, amount: star.damage, ranged: true, slow: true });
      } else { baseDamage[opposite(star.side)] += star.damage; baseHits.push({ ...shotSource, side: opposite(star.side), amount: star.damage }); }
      if (star.kind !== 'litter') this.effect('starHit', star.side, star.targetX, star.targetX, star.targetRow, .45).targetId = star.targetId;
    }
    this.projectiles = this.projectiles.filter(star => star.age + 1e-8 < star.duration);
    // Defensive cannons use the same snapshot/damage batch as troops, so neither
    // side gains an update-order advantage. With no target the cannon stays ready.
    for (const side of ['player', 'enemy'] as Side[]) {
      const army = this.armies[side];
      if (army.hp <= 0 || army.cannonCooldown > 0) continue;
      const target = live.filter(unit => unit.hp > 0 && unit.side !== side && !isHidden(unit, this.time) && Math.abs(unit.x - BASE_X[side]) <= CANNON_RANGE)
        .sort((a, b) => Math.abs(a.x - BASE_X[side]) - Math.abs(b.x - BASE_X[side]) || a.id - b.id)[0];
      if (!target) continue;
      hits.push({ target: target.id, amount: CANNON_DAMAGE[army.tech - 1], ranged: true });
      army.cannonCooldown = CANNON_INTERVAL; army.cannonShots++;
      this.effect('cannon', side, BASE_X[side], target.x, target.row, .45).targetId = target.id;
    }
    // All troops within reach can attack; damage resolves simultaneously.
    const ordered = [...this.units].sort((a, b) => (a.side === 'player' ? -a.x : a.x) - (b.side === 'player' ? -b.x : b.x));
    for (const unit of ordered) {
      if(unit.hp<=0) continue;
      const spec = UNITS[unit.kind], dir = unit.side === 'player' ? 1 : -1;
      if ((unit.bossEntry??0)>0) {
        unit.bossEntry=Math.max(0,unit.bossEntry!-dt); unit.walking=true; unit.attacking=false; unit.walkDistance+=spec.speed*dt;
        continue;
      }
      // Integrate the slowed fraction of this step, including partial expiry.
      const activeTime = dt - Math.min(dt, unit.starSlow) * STAR_MAGIC.slow;
      unit.attackCooldown = Math.max(0, unit.attackCooldown - activeTime * ((unit.hasteUntil ?? 0) > this.time ? 1 + SPECIAL.drummer.haste : 1));
      unit.supportCooldown = Math.max(0, (unit.supportCooldown ?? 0) - dt);
      unit.attacking = false; unit.walking = false;
      const origin = live.find(snapshot => snapshot.id === unit.id)!;
      if (isHidden(unit, this.time)) {
        unit.targetId = null; unit.targetX = BASE_X[opposite(unit.side)]; unit.targetRow = 1;
        this.move(unit, dt, unit.targetX, 1, spec.range * .98);
        if (battleDistance(unit, { x: unit.targetX, row: 1 }) <= spec.range) unit.stealthUntil = this.time;
        continue;
      }
      const foes = live.filter(u => u.hp > 0 && u.side !== unit.side && !isHidden(u, this.time))
        // After slipping through a line, an assassin keeps pursuing the backline.
        // A pursuer already within contact can still be fought; stealth duration is unchanged.
        .filter(u => unit.kind !== 'assassin' || !unit.stealthUsed || (u.x - origin.x) * dir >= 0 || battleDistance(u, origin) <= spec.range)
        .sort((a, b) => battleDistance(a, origin) - battleDistance(b, origin) || a.id - b.id);
      // Keep the current opponent unless a substantially closer one blocks the approach.
      const previous = foes.find(foe => foe.id === unit.targetId);
      const rear = unit.kind === 'hook' ? foes.find(foe => foe.kind !== 'boss' && UNITS[foe.kind].range > 60 && battleDistance(foe, origin) <= spec.range) : undefined;
      const charged = unit.charge ? foes.find(foe => foe.id === unit.charge!.targetId) : undefined;
      const baseX = BASE_X[opposite(unit.side)];
      const baseDistance = battleDistance(origin, { x: baseX, row: 1 });
      const canHitBase = baseDistance <= spec.range && baseDistance >= (spec.minRange ?? 0);
      // Once a siege starts, new recruits must not repeatedly pull every attacker
      // off the base. Losing reach breaks the lock; ordinary combat still uses foes.
      const wasSieging = origin.targetId === null && origin.attacking && origin.targetX === baseX && origin.targetRow === 1;
      const atEnemyBase = canHitBase && (wasSieging || (unit.kind === 'assassin' && unit.stealthUsed) || !foes.length || baseDistance < battleDistance(foes[0], origin));
      const nearest = atEnemyBase ? undefined : charged ?? rear ?? (previous && battleDistance(previous, origin) <= battleDistance(foes[0], origin) + 20 ? previous : foes[0]);
      unit.targetId = nearest?.id ?? null;
      unit.targetX = nearest?.x ?? BASE_X[opposite(unit.side)];
      unit.targetRow = nearest?.row ?? 1;
      if ((unit.kind === 'umbrella' || unit.kind === 'drummer') && unit.supportCooldown <= 0 && nearest && battleDistance(nearest, origin) <= 310) {
        const support = unit.kind === 'umbrella' ? SPECIAL.umbrella : SPECIAL.drummer;
        for (const ally of this.units.filter(u => u.hp > 0 && u.side === unit.side && battleDistance(live.find(s => s.id === u.id) ?? u, origin) <= support.range)) {
          if (unit.kind === 'umbrella') ally.guardUntil = this.time + support.duration;
          else ally.hasteUntil = this.time + support.duration;
        }
        unit.supportCooldown = support.cooldown;
        this.effect(unit.kind === 'umbrella' ? 'guard' : 'drum', unit.side, unit.x, unit.x, unit.row, .7).sourceId = unit.id;
        if (unit.kind === 'drummer') { unit.attackAt = this.time; unit.attacking = true; }
      }
      if (spec.heal || unit.kind === 'drummer') {
        const wounded = this.units.filter(u => (u.bossEntry??0)<=0 && u.hp>0 && u.side === unit.side && u.hp < UNITS[u.kind].hp && battleDistance(live.find(snapshot => snapshot.id === u.id) ?? u, origin) <= spec.range)
          .sort((a, b) => a.hp / UNITS[a.kind].hp - b.hp / UNITS[b.kind].hp).slice(0, 3);
        const casting = this.time - unit.attackAt < .34;
        const healingTarget = wounded[0] ?? (casting ? live.find(ally => ally.id === origin.targetId && ally.side === unit.side) : undefined);
        if (healingTarget) {
          const aim = live.find(snapshot => snapshot.id === healingTarget.id)!;
          unit.targetId = aim.id; unit.targetX = aim.x; unit.targetRow = aim.row;
        }
        if (spec.heal && wounded.length && unit.attackCooldown <= 0) {
          this.contribute(unit.kind, unit.side);
          for (const ally of wounded) { ally.hp = Math.min(UNITS[ally.kind].hp, ally.hp + spec.heal); this.effect('heal', unit.side, ally.x, ally.x, ally.row, .7).targetId = ally.id; }
          unit.attackCooldown = spec.interval; unit.attacking = true; unit.attackAt = this.time;
        }
        const frontline = live.filter(u => u.side === unit.side && !UNITS[u.kind].heal && u.kind !== 'drummer' && !isHidden(u, this.time)).sort((a, b) => dir * (b.x - a.x))[0];
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
      if (unit.kind === 'boss') {
        if (unit.sweep) {
          const sweep={...unit.sweep,remaining:Math.max(0,unit.sweep.remaining-dt+Math.min(dt,unit.starSlow)*STAR_MAGIC.slow)};
          unit.sweep=sweep; unit.attacking=true;
          // A telegraphed swing keeps its heading even if its original target dies.
          unit.targetId=null; unit.targetX=unit.x+sweep.forwardX*ORANGE_BOSS.sweepDepth;
          unit.targetRow=unit.row+sweep.forwardY*ORANGE_BOSS.sweepDepth/LANE_SPACING;
          if (sweep.remaining<=1e-8) {
            const amount=spec.damage*attackPower(origin);
            for (const victim of foes.filter(foe=>inBossSweep(origin,sweep,foe))) {
              hits.push({ target: victim.id, amount, ranged: false, push: {x:sweep.forwardX*ORANGE_BOSS.knockback,row:sweep.forwardY*ORANGE_BOSS.knockback/LANE_SPACING} });
            }
            if (inBossSweep(origin,sweep,{x:BASE_X.player,row:1})) baseDamage.player+=amount;
            unit.attackAt=this.time; unit.sweep=undefined;
            const fx=this.effect('sweep',unit.side,unit.x,unit.targetX,unit.row,ORANGE_BOSS.swipe+ORANGE_BOSS.recovery,'boss');
            fx.sourceId=unit.id; fx.sweep=sweep;
          }
        } else if (this.time-unit.attackAt<ORANGE_BOSS.swipe+ORANGE_BOSS.recovery) {
          unit.attacking=true;
        } else if (inRange) {
          unit.attacking=true;
          if (unit.attackCooldown<=0) {
            unit.sweep={remaining:ORANGE_BOSS.windup,...sweepDirection(origin,{x:targetX,row:unit.targetRow})};
            unit.attackCooldown=spec.interval;
          }
        } else this.move(unit,dt,targetX,unit.targetRow,spec.range*.98);
        continue;
      }
      const tooClose = spec.minRange !== undefined && distance < spec.minRange;
      if (unit.charge && (!inRange || unit.charge.targetId !== (nearest?.id ?? null))) unit.charge = undefined;
      if (inRange && !tooClose) {
        unit.attacking = true;
        if (unit.attackCooldown <= 0) {
          if (unit.kind === 'hook' || unit.kind === 'boxer') {
            if (!unit.charge) { unit.charge = { remaining: SPECIAL[unit.kind].windup, targetId: nearest?.id ?? null }; continue; }
            unit.charge.remaining = Math.max(0, unit.charge.remaining - activeTime);
            if (unit.charge.remaining > 1e-8) continue;
            unit.charge = undefined;
          }
          unit.attackCooldown = spec.interval;
          unit.attackAt = this.time;
          const attackDamage = spec.damage * attackPower(origin);
          if (unit.kind === 'mage' || unit.kind === 'litter') {
            this.projectiles.push({ id: this.nextId++, side: unit.side, x: unit.x, row: unit.row, targetX, targetRow: unit.targetRow,
              sourceId: unit.id, targetId: nearest?.id, damage: attackDamage, age: 0, duration: unit.kind === 'litter' ? SPECIAL.litter.travel : STAR_MAGIC.travel, kind: unit.kind, hasteUntil: unit.hasteUntil });
          } else if (nearest) {
            const targets = spec.splash ? foes.filter(u => battleDistance(u, nearest) <= spec.splash!) : [nearest];
            for (const victim of targets) {
              let push;
              if (victim.kind !== 'boss' && (unit.kind === 'hook' || unit.kind === 'boxer')) {
                const d = Math.max(1, battleDistance(origin, victim));
                const travel = unit.kind === 'hook' ? -Math.min(SPECIAL.hook.pull, Math.max(0, d - 30)) : SPECIAL.boxer.push;
                push = { x: (victim.x - origin.x) / d * travel, row: (victim.row - origin.row) / d * travel };
              }
              hits.push({ ...source(unit), target: victim.id, amount: attackDamage, ranged: spec.range > 60, push });
            }
          } else { const amount = attackDamage * (spec.baseBonus ?? 1); baseDamage[opposite(unit.side)] += amount; baseHits.push({ ...source(unit), side: opposite(unit.side), amount }); }
          if (unit.kind !== 'mage' && unit.kind !== 'litter') {
            const fx = this.effect(unit.kind === 'hook' ? 'hook' : spec.range > 60 ? 'shot' : 'hit', unit.side, unit.x, targetX, unit.targetRow, spec.range > 60 ? .4 : .25, unit.kind);
            fx.sourceRow = unit.row; fx.sourceId = unit.id; fx.targetId = nearest?.id;
          }
        }
      } else if (!inRange) this.move(unit, dt, targetX, unit.targetRow, Math.min(30, spec.range * .98));
    }
    for (const unit of this.units) unit.starSlow = Math.max(0, unit.starSlow - dt);
    // Resolve individual hits for dodge and first-hit stealth, while all attackers
    // still act from the same snapshot. A lethal first hit cannot revive an assassin.
    for (const hit of hits) {
      const target = this.units.find(u => u.id === hit.target);
      if (!target || target.hp - (damage.get(target.id) ?? 0) <= 0 || isHidden(target, this.time)) continue;
      if (target.kind === 'kungfu' && this.random() < SPECIAL.kungfu.dodge) {
        if (this.trackingEnabled && target.side === 'player') { this.stats.dodges++; this.contribute(target.kind, target.side); }
        target.dodgeAt = this.time;
        this.effect('dodge', target.side, target.x, target.x, target.row, .35).targetId = target.id;
        continue;
      }
      const amount = hit.amount * (hit.ranged && (target.guardUntil ?? 0) > this.time ? 1 - SPECIAL.umbrella.reduction : 1);
      if (this.trackingEnabled) {
        const remaining = Math.max(0, target.hp - (damage.get(target.id) ?? 0)), actual = Math.min(remaining, amount);
        if (actual > 0) {
          this.contribute(target.kind, target.side);
          if (hit.sourceKind && hit.sourceSide === 'player') {
            this.contribute(hit.sourceKind, hit.sourceSide);
            if (hit.sourceKind === 'gunner') this.stats.gunnerDamage += actual;
            if (hit.hasted) { addKind(this.stats.drummed, hit.sourceKind); this.contribute('drummer', 'player'); }
          }
        }
        if (target.side === 'player' && amount < hit.amount) {
          const prevented = Math.min(remaining, hit.amount) - actual;
          this.stats.prevented += prevented; if (prevented > 0) this.contribute('umbrella', 'player');
        }
        if (hit.weaken && hit.sourceSide === 'player' && hit.bombId !== undefined) {
          const victims = weakened.get(hit.bombId) ?? new Set<number>(); victims.add(target.id); weakened.set(hit.bombId, victims);
        }
      }
      damage.set(target.id, (damage.get(target.id) ?? 0) + amount);
      if (hit.slow) target.starSlow = STAR_MAGIC.duration;
      if (hit.weaken) target.weakenedUntil = this.time + SPECIAL.litter.duration;
      if (hit.push) knockback.set(target.id, { ...hit.push, kind: hit.sourceKind, side: hit.sourceSide });
      if (target.kind === 'assassin' && !target.stealthUsed && amount > 0 && target.hp > damage.get(target.id)!) {
        target.stealthUsed = true; target.stealthUntil = this.time + SPECIAL.assassin.stealth;
        target.charge = undefined; target.targetId = null; target.targetX = BASE_X[opposite(target.side)]; target.targetRow = 1;
        target.attacking = false; target.walking = true; knockback.delete(target.id);
        this.effect('stealth', target.side, target.x, target.x, target.row, .6).sourceId = target.id;
      }
    }
    for (const unit of this.units) {
      unit.slow = Math.max(0, unit.slow - dt);
      unit.catnip = Math.max(0, unit.catnip - dt);
      if ((damage.get(unit.id) ?? 0) > 0) unit.hitAt = this.time;
      const hpBefore=unit.hp;
      unit.hp -= damage.get(unit.id) ?? 0;
      const push=knockback.get(unit.id);
      if (push && unit.hp>0) {
        const oldX = unit.x, oldRow = unit.row;
        unit.x=Math.max(BASE_X.player+22,Math.min(BASE_X.enemy-22,unit.x+push.x));
        unit.row=Math.max(-.5,Math.min(2.5,unit.row+push.row));
        if (this.trackingEnabled && push.side === 'player' && Math.hypot(unit.x - oldX, unit.row - oldRow) > 1e-8) {
          if (push.kind === 'hook' && UNITS[unit.kind].range > 60 && !unit.hookCounted) { unit.hookCounted = true; this.stats.hookTargets++; }
          if (push.kind === 'boxer' && !unit.boxerCounted) { unit.boxerCounted = true; this.stats.boxerTargets++; }
        }
        unit.attacking=false; unit.walking=false; unit.charge=undefined;
      }
      if (unit.hp <= 0) {
        if (this.trackingEnabled && unit.side === 'enemy' && unit.kind === 'boss' && hpBefore > 0 && (damage.get(unit.id) ?? 0) > 0) this.stats.bossDefeated = true;
        if(hpBefore>0 && (damage.get(unit.id)??0)>0)this.recoverEnergy(opposite(unit.side),unit.kind);
        if (unit.kind !== 'boss') this.armies[unit.side].lost++;
        const death = this.effect('death', unit.side, unit.x, unit.x, unit.row, .8, unit.kind, unit.id);
        death.aimX = unit.targetX; death.aimRow = unit.targetRow;
      }
    }
    this.units = this.units.filter(u => u.hp > 0);
    if (this.trackingEnabled) {
      for (const victims of weakened.values()) this.stats.litterMax = Math.max(this.stats.litterMax, this.units.filter(u => victims.has(u.id) && (u.weakenedUntil ?? 0) > this.time).length);
      const remaining = { player: this.armies.player.hp, enemy: this.armies.enemy.hp };
      for (const hit of baseHits) {
        const actual = Math.min(remaining[hit.side], hit.amount); remaining[hit.side] -= actual;
        if (actual <= 0 || hit.sourceSide !== 'player' || !hit.sourceKind) continue;
        this.contribute(hit.sourceKind, 'player');
        if (hit.sourceKind === 'assassin' && hit.infiltrated) this.stats.assassinBase = true;
        if (reinforcementPhase(this.level, this.time).regrouping && this.level.reinforcements) {
          const window = Math.floor((this.time - this.level.reinforcements.start + 1e-8) / this.level.reinforcements.cycle);
          if (this.stats.regroupWindow !== window) { this.stats.regroupWindow = window; this.stats.regroupDamage = 0; }
          this.stats.regroupDamage += actual; this.stats.regroupPeak = Math.max(this.stats.regroupPeak, this.stats.regroupDamage);
        }
      }
    }
    for (const side of ['player', 'enemy'] as Side[]) this.armies[side].hp = Math.max(0, this.armies[side].hp - baseDamage[side]);
    this.baseDialogue.onBaseDamage(this.time, baseDamage.player, baseDamage.enemy);
    if (!this.armies.player.hp || !this.armies.enemy.hp) {
      this.phase = 'ended';
      this.winner = !this.armies.player.hp && !this.armies.enemy.hp ? 'draw' : !this.armies.enemy.hp ? 'player' : 'enemy';
      return;
    }
    this.enterBoss();
    if (this.aiEnabled) {
      this.aiTimer -= dt;
      if (this.aiTimer <= .00001) {
        this.aiTimer = this.time < this.level.openingDuration ? this.level.openingInterval : enemyPlan(this.level, this.time).interval;
        this.decideAI();
      }
    }
  }
  private move(unit: Unit, dt: number, targetX: number, targetRow: number, stopDistance: number) {
    // A pre-0.19 checkpoint may still contain the last seconds of the retired slow.
    const legacySlowTime = Math.min(dt, unit.slow);
    const starOnlyTime = Math.max(0, Math.min(dt, unit.starSlow) - legacySlowTime);
    const travelTime = dt - legacySlowTime * .55 - starOnlyTime * STAR_MAGIC.slow;
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
    const allies = this.units.filter(u => u.side === side), foes = this.units.filter(u => u.side !== side && !isHidden(u, this.time));
    const threatened = foes.some(u => u.x > BASE_X.enemy - 310);
    const count = (kind: UnitKind) => allies.filter(u => u.kind === kind).length;
    // Investment continues during regrouping and uses a bounded savings window.
    const safe = army.hp > BASE_HP * .5 && allies.length >= this.level.investmentGuard && (!threatened || allies.length >= foes.length);
    const investEconomy = safe && army.economy < ECONOMY_COSTS.length && this.time >= (this.level.economyAt[army.economy] ?? Infinity);
    // A defended siege must not trap the AI in tier-one replacements forever.
    // It still pays normal research costs and uses the same bounded savings window.
    const defensiveResearch = army.hp > BASE_HP * .35 && (allies.length >= 3 || army.food >= (TECH_COSTS[army.tech - 1] ?? Infinity) + UNITS.soldier.cost) &&
      this.time >= this.level.techAt[army.tech - 1] + 30;
    const investTech = (safe || defensiveResearch) && army.tech < (this.level.techCap ?? 3) && !army.researching && this.time >= this.level.techAt[army.tech - 1];
    if (investEconomy || investTech) {
      const upgraded = investTech && (!investEconomy || threatened) ? this.researchTech(side) : this.upgradeEconomy(side);
      if (upgraded) this.aiSavingSince = null;
      else {
        this.aiSavingSince ??= this.time;
        if (this.time - this.aiSavingSince < this.level.savingTime && this.time - this.aiLastRecruit < this.level.savingTime) return;
      }
    } else this.aiSavingSince = null;
    // Regrouping banks ordinary income for the next push and offers a visible counterattack window.
    if (reinforcementPhase(this.level, this.time).regrouping) return;
    // A late-game reserve can fund one heavy rider without stalling ordinary reinforcements.
    if (this.level.knight !== false && army.tech === 3 && count('knight') === 0 && army.food >= UNITS.knight.cost && this.summon(side, 'knight')) {
      this.aiLastRecruit = this.time; this.aiSavingSince = null; this.aiKnightSavingSince = null; return;
    }
    const rotation = enemyPlan(this.level, this.time).formations[army.tech - 1];
    let desired = rotation[this.aiQueueIndex % rotation.length];
    if ((desired === 'healer' && (count('healer') >= 2 || allies.length < 3)) || (desired === 'shield' && count('shield') >= 3)) desired = 'soldier';
    if (desired === 'knight' && (count('knight') >= 1 || this.level.knight === false)) desired = 'soldier';
    // Preserve the planned formation while saving briefly; otherwise short decision
    // intervals spend every last coin on mice and advanced troops never arrive.
    const emergency = threatened && (allies.length < 2 || army.hp < BASE_HP * .35);
    // A planned rider needs a real savings window (500 food), not a free spawn.
    // Emergency defense interrupts this investment; ordinary and legacy AI keep their cadence.
    if (desired === 'knight' && !emergency && army.food < UNITS.knight.cost) {
      this.aiKnightSavingSince ??= this.time;
      if (this.time - this.aiKnightSavingSince < 26) return;
    } else this.aiKnightSavingSince = null;
    if (!emergency && this.time - this.aiLastRecruit < this.level.savingTime &&
      (army.food < UNITS[desired].cost || army.cooldowns[desired] > 0)) return;
    for (const kind of [...new Set<UnitKind>([desired, 'soldier', 'mouse'])]) {
      if (!this.summon(side, kind)) continue;
      this.aiQueueIndex++; this.aiLastRecruit = this.time; this.aiSavingSince = null; this.aiKnightSavingSince = null;
      return;
    }
  }
}
