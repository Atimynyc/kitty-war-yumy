import type { Army, Unit, Effect, StarProjectile } from './simulation.ts';
import type { BaseDialogue } from './base-dialogue.ts';
import type { SpellNotices } from './spell-notices.ts';
import type { RunStats } from './achievements.ts';
import { UNIT_ORDER, UNITS, FOOD_RATES, MAX_POPULATION, BASE_HP } from './content.ts';
import { LEVELS, LEGACY_LEVELS } from './levels.ts';

// Changing combat rules requires an explicit migration or rejection of suspended rounds.
export const BATTLE_RULES_VERSION = '0.20.0';
export interface BattleSave {
  version: 1; rules: string; levelId: string; time: number; seed: number; randomState: number;
  playerRoster: import('./content.ts').UnitKind[]; legacyRoster: boolean;
  armies: { player: Army; enemy: Army }; units: Unit[]; effects: Effect[]; projectiles: StarProjectile[];
  boss: { spawned: boolean; unitId: number | null; enteredAt: number }; nextId: number;
  ai: { timer: number; queueIndex: number; lastRecruit: number; savingSince: number | null; knightSavingSince: number | null; enabled: boolean };
  message: string; messageUntil: number; dialogue: ReturnType<BaseDialogue['save']>; notices: ReturnType<SpellNotices['save']>; stats: RunStats;
}
export const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const number = (v: unknown, min = 0, max = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min = 0, max = 1e9) => number(v, min, max) && Number.isInteger(v);
const bool = (v: unknown) => typeof v === 'boolean';
const side = (v: unknown) => v === 'player' || v === 'enemy';
const id = (v: unknown) => integer(v, 1);
const optional = (v: unknown, check: (v: any) => boolean) => v === undefined || check(v);
const nullableId = (v: unknown) => v === null || id(v);
const kind = (v: unknown) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(UNITS, v);
const numericFields = (v: Record<string, any>, keys: string[], min = 0, max = 1e12) => keys.every(k => number(v[k], min, max));
export const kinds = (v: unknown) => Array.isArray(v) && v.length <= 16 && new Set(v).size === v.length && v.every(k => UNIT_ORDER.includes(k));
export function validRunStats(s: unknown): s is RunStats {
  return object(s) && ['recruited','participated','drummed'].every(k => kinds(s[k])) &&
    numericFields(s, ['gunnerDamage','prevented','dodges','hookTargets','boxerTargets','casts','litterMax','regroupDamage','regroupPeak']) &&
    integer(s.maxTech,1,3) && integer(s.maxEconomy,1,8) && integer(s.regroupWindow,-1) && bool(s.assassinBase) && bool(s.bossDefeated);
}
function validArmy(a: unknown): a is Army {
  return object(a) && number(a.hp, Number.MIN_VALUE, BASE_HP) && integer(a.tech,1,3) && integer(a.economy,0,FOOD_RATES.length-1) && bool(a.researching) &&
    !(a.researching && a.tech === 3) && number(a.energy,0,100) && number(a.energyGainAt,-1e12) &&
    // Recruitment permits a tiny floating-point affordability epsilon; preserve it exactly.
    number(a.food,-1e-7) && numericFields(a, ['research','energyEarned','energySpent','energyOverflow','energyGain','spent','hired','lost','cannonCooldown','cannonShots']) &&
    object(a.cooldowns) && UNIT_ORDER.every(k=>number(a.cooldowns[k]));
}
function validSweep(s: unknown) { return object(s) && number(s.remaining) && number(s.forwardX,-1,1) && number(s.forwardY,-1,1); }
function validUnit(u: unknown): u is Unit {
  if (!object(u) || !id(u.id) || !kind(u.kind) || !side(u.side)) return false;
  const spec = UNITS[u.kind as keyof typeof UNITS];
  return number(u.hp,Number.MIN_VALUE,spec.hp) && number(u.x,0,1440) && number(u.row,-.5,2.5) &&
    number(u.targetX,-1000,2500) && number(u.targetRow,-10,10) && nullableId(u.targetId) &&
    numericFields(u,['attackCooldown','slow','starSlow','catnip','walkDistance']) && numericFields(u,['attackAt','hitAt'],-1e12) &&
    bool(u.attacking) && bool(u.walking) &&
    ['bossEntry','weakenedUntil','hasteUntil','guardUntil','supportCooldown','stealthUntil'].every(k=>optional(u[k],number)) &&
    optional(u.dodgeAt,v=>number(v,-1e12)) && ['stealthUsed','hookCounted','boxerCounted'].every(k=>optional(u[k],bool)) &&
    optional(u.sweep,validSweep) && optional(u.charge,c=>object(c)&&number(c.remaining)&&nullableId(c.targetId)) &&
    (u.kind !== 'boss' || u.side === 'enemy');
}
function validEffect(e: unknown, legacy = false): e is Effect {
  return object(e) && id(e.id) && side(e.side) && ['hit','shot','cannon','heal','death',...(legacy ? ['roar'] : ['treat','bombard']),'spawn','starHit','catnip','sweep','dust','dodge','stealth','guard','drum','hook'].includes(e.type) &&
    numericFields(e,['x','targetX','row'],-1e6,1e6) && number(e.age) && number(e.duration,Number.MIN_VALUE) &&
    optional(e.kind,kind) && ['unitId','sourceId','targetId'].every(k=>optional(e[k],id)) &&
    ['sourceRow','aimX','aimRow'].every(k=>optional(e[k],v=>number(v,-1e6,1e6))) && optional(e.sweep,validSweep) &&
    (e.type!=='bombard' || (number(e.power,1,300) && bool(e.landed))) && optional(e.power,number) && optional(e.landed,bool);
}
function validProjectile(p: unknown): p is StarProjectile {
  return object(p) && id(p.id) && side(p.side) && id(p.sourceId) && optional(p.targetId,id) &&
    optional(p.kind,k=>k==='mage'||k==='litter') && numericFields(p,['x','row','targetX','targetRow'],-1e6,1e6) &&
    number(p.damage) && number(p.age) && number(p.duration,Number.MIN_VALUE) && optional(p.hasteUntil,number);
}
/** Validate nested shape before mutating a live Battle. Never Object.assign raw storage onto a class. */
export function validBattleSave(s: unknown, legacy = false): s is BattleSave {
  if (!object(s) || s.version !== 1 || !(legacy ? ['0.18.0','0.19.0'] : [BATTLE_RULES_VERSION]).includes(s.rules) || ![...LEVELS,...LEGACY_LEVELS].some(l=>l.id===s.levelId) ||
    !number(s.time) || !integer(s.seed,0,0xffffffff) || !integer(s.randomState,0,0xffffffff) || !id(s.nextId) ||
    !object(s.armies) || !validArmy(s.armies.player) || !validArmy(s.armies.enemy) || !validRunStats(s.stats)) return false;
  if (!legacy && (!kinds(s.playerRoster) || !s.playerRoster.includes('soldier') || !s.playerRoster.includes('mouse') || !bool(s.legacyRoster))) return false;
  const retired=legacy && s.rules==='0.18.0';
  if (!Array.isArray(s.units) || s.units.length > 49 || !s.units.every(validUnit) ||
    !Array.isArray(s.effects) || s.effects.length > 2048 || !s.effects.every(e=>validEffect(e,retired)) ||
    !Array.isArray(s.projectiles) || s.projectiles.length > 512 || !s.projectiles.every(validProjectile)) return false;
  const ids = [...s.units,...s.effects,...s.projectiles].map(v=>v.id);
  if (!legacy && (s.units.some(u=>u.side==='player'&&!s.playerRoster.includes(u.kind)) || s.stats.recruited.some((k:string)=>!s.playerRoster.includes(k)))) return false;
  if (new Set(ids).size !== ids.length || ids.some(v=>v>=s.nextId)) return false;
  for (const team of ['player','enemy']) if (s.units.filter((u: Unit)=>u.side===team).reduce((n:number,u:Unit)=>n+UNITS[u.kind].population,0)>MAX_POPULATION) return false;
  const b=s.boss, a=s.ai, d=s.dialogue, n=s.notices;
  if (!object(b) || !bool(b.spawned) || !nullableId(b.unitId) || !number(b.enteredAt) ||
    !object(a) || !number(a.timer,-.1) || !integer(a.queueIndex) || !number(a.lastRecruit) || !bool(a.enabled) ||
    ![a.savingSince,a.knightSavingSince].every(v=>v===null||number(v)) ||
    typeof s.message!=='string' || s.message.length>1000 || !number(s.messageUntil)) return false;
  if (!object(d) || ![null,'opening','feast','protect'].includes(d.cue) || !numericFields(d,['startedAt','until']) ||
    !object(d.nextAllowed) || !numericFields(d.nextAllowed,['opening','feast','protect'])) return false;
  return object(n) && id(n.nextId) && Array.isArray(n.items) && n.items.length<=512 && n.items.every((v:unknown)=>object(v)&&
    id(v.id)&&v.id<n.nextId&&side(v.side)&&(retired ? ['roar','catnip'] : ['treat','catnip','bombard']).includes(v.spell)&&integer(v.affected,0,49)&&numericFields(v,['castAt','startsAt','endsAt'])&&
    ['energyCost','total','power'].every(k=>optional(v[k],number)));
}

/** Keep old checkpoints playable: retired visuals disappear, already-applied slow expires normally. */
export function readBattleSave(raw: unknown): BattleSave | null {
  if (validBattleSave(raw)) return JSON.parse(JSON.stringify(raw));
  if (!validBattleSave(raw,true)) return null;
  const s: BattleSave = JSON.parse(JSON.stringify(raw));
  const retired=s.rules==='0.18.0';
  s.rules=BATTLE_RULES_VERSION;
  s.playerRoster=[...UNIT_ORDER]; s.legacyRoster=true;
  if(retired) {
    s.effects=s.effects.filter(fx=>(fx.type as string)!=='roar');
    s.notices.items=s.notices.items.filter(n=>(n.spell as string)!=='roar').map(n=>({...n,energyCost:50}));
  }
  return validBattleSave(s) ? s : null;
}
