import { BASE_HP } from './content.ts';
import type { UnitKind } from './content.ts';
import { campaignLevels } from './campaign.ts';
export { CHAPTERS } from './campaign.ts';
export type SceneId = 'sunroom' | 'cardboard' | 'kitchen' | 'balcony' | 'rooftop' | 'pantry';

export interface AttackPhase { at: number; label: string; formations: UnitKind[][]; interval: number }

export interface Level {
  id: string; name: string; subtitle: string; difficulty: string; description: string;
  grace: number; openingDuration: number; openingInterval: number; interval: number;
  economyAt: number[]; techAt: number[]; accent: string;
  investmentGuard: number; savingTime: number; formations: UnitKind[][];
  stage?: number; chapter?: number; scene?: SceneId; cover?: UnitKind;
  tactic?: string; tip?: string; techCap?: number; knight?: boolean;
  phases?: AttackPhase[]; bossEncounter?: { kind: 'orange'; trigger: number };
  reinforcements?: { start: number; cycle: number; rest: number };
}

// The same combat rules and resource budget apply to every opponent. Difficulty
// changes its preparation time and decisions. The final boss is a separate scripted encounter.
export const LEGACY_LEVELS: readonly Level[] = [
  { id: 'sunroom', name: '阳光客厅', subtitle: '第一次守护', difficulty: '入门', description: '短暂准备后迎接小队。先学会守住前线，再升级产能与科技。', grace: 8, openingDuration: 45, openingInterval: 4, interval: 2.4, economyAt: [18, 65, 125], techAt: [38, 100], accent: '#799678', investmentGuard: 3, savingTime: 5,
    formations: [['soldier','soldier','mouse'], ['shield','soldier','slinger','mage','soldier'], ['shield','catapult','soldier','healer','mage','slinger']] },
  { id: 'cardboard', name: '纸箱走廊', subtitle: '小队集结', difficulty: '标准', description: '更快增援，盾卫与法师协同进攻。及时发展远程火力，别只派士兵。', grace: 4, openingDuration: 28, openingInterval: 2.2, interval: 1, economyAt: [10, 45, 95], techAt: [24, 70], accent: '#b68d60', investmentGuard: 2, savingTime: 7,
    formations: [['soldier','soldier','soldier','mouse'], ['shield','slinger','mage','soldier','slinger'], ['shield','catapult','mage','healer','slinger','soldier']] },
  { id: 'pantry', name: '冻干保卫线', subtitle: '守护最后一罐', difficulty: '挑战', description: '敌方更早投资与研究。基地低于 30% 时，大胖橘亲自上场，抬爪横扫前排！', grace: 2, openingDuration: 18, openingInterval: 1.2, interval: .6, economyAt: [6, 30, 75], techAt: [16, 52], accent: '#9c87ac', investmentGuard: 2, savingTime: 8, bossEncounter: { kind: 'orange', trigger: .3 },
    formations: [['soldier','soldier','soldier'], ['shield','mage','slinger','slinger','soldier'], ['shield','catapult','mage','healer','slinger','soldier']] },
];
export const LEVELS: readonly Level[] = campaignLevels;
// Legacy encounters remain addressable for historical balance replays, not mainline progress.
export const getLevel = (id: string) => LEVELS.find(level => level.id === id) ?? LEGACY_LEVELS.find(level => level.id === id) ?? LEVELS[0];
export const levelNumber = (level: Level) => String(level.stage ?? 0).padStart(2, '0');

export function enemyPlan(level: Level, time: number) {
  let result = { formations: level.formations, interval: level.interval, label: level.tactic ?? '混编增援' };
  for (const phase of level.phases ?? []) if (time >= phase.at) result = phase;
  return result;
}

/** Repeating recruitment windows, driven only by simulation time. Existing troops keep fighting. */
export function reinforcementPhase(level: Level, time: number) {
  const plan = level.reinforcements;
  if (!plan) return { regrouping: false, nextChangeIn: null as number | null };
  if (time < plan.start) return { regrouping: false, nextChangeIn: plan.start + plan.cycle - plan.rest - time };
  const elapsed = (time - plan.start + 1e-8) % plan.cycle;
  const regrouping = elapsed >= plan.cycle - plan.rest;
  return { regrouping, nextChangeIn: Math.max(0, (regrouping ? plan.cycle : plan.cycle - plan.rest) - elapsed) };
}

/** Victory only; exactly half health belongs to the two-star tier. */
export function victoryStars(hp: number): 1 | 2 | 3 {
  return hp >= BASE_HP ? 3 : hp >= BASE_HP * .5 ? 2 : 1;
}

export type CampaignProgress = Record<string, { stars: number; bestTime: number; ratingVersion?: 2 }>;
export function readProgress(raw: string | null): CampaignProgress {
  try {
    const parsed = JSON.parse(raw ?? '{}');
    const value = [2,3,4,5].includes(parsed?.version) ? { ...parsed.legacy, ...parsed.campaign } : parsed;
    const valid: CampaignProgress = {};
    for (const { id } of [...LEVELS, ...LEGACY_LEVELS]) {
      const entry = value?.[id];
      if (entry && Number.isInteger(entry.stars) && entry.stars >= 1 && entry.stars <= 3 && Number.isFinite(entry.bestTime) && entry.bestTime > 0) {
        valid[id] = { stars: entry.stars, bestTime: entry.bestTime };
        if (entry.ratingVersion === 2) valid[id].ratingVersion = 2;
      }
    }
    return valid;
  } catch { return {}; }
}

export function serializeProgress(progress: CampaignProgress) {
  const records = (levels: readonly Level[]) => Object.fromEntries(levels.filter(level => progress[level.id]).map(level => [level.id, progress[level.id]]));
  return JSON.stringify({ version: 2, campaign: records(LEVELS), legacy: records(LEGACY_LEVELS) });
}

export function isLevelUnlocked(id: string, progress: CampaignProgress) {
  const index = LEVELS.findIndex(level => level.id === id);
  return index >= 0 && LEVELS.slice(0, index).every(level => Boolean(progress[level.id]));
}
export function recommendedLevel(progress: CampaignProgress) {
  return LEVELS.find(level => !progress[level.id]) ?? LEVELS[LEVELS.length - 1];
}

export function recordVictory(progress: CampaignProgress, level: Level, hp: number, time: number) {
  const old = progress[level.id];
  progress[level.id] = { stars: Math.max(old?.ratingVersion === 2 ? old.stars : 0, victoryStars(hp)), bestTime: Math.min(old?.bestTime ?? Infinity, time), ratingVersion: 2 };
}
