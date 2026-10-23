import { BASE_HP } from './content.ts';
import type { UnitKind } from './content.ts';

export interface Level {
  id: string; name: string; subtitle: string; difficulty: string; description: string;
  grace: number; openingDuration: number; openingInterval: number; interval: number;
  economyAt: number[]; techAt: number[]; accent: string;
  investmentGuard: number; savingTime: number; formations: UnitKind[][];
}

// The same combat rules and resource budget apply to every opponent. Difficulty
// changes its preparation time and decisions. The final boss is a separate scripted encounter.
export const LEVELS: readonly Level[] = [
  { id: 'sunroom', name: '阳光客厅', subtitle: '第一次守护', difficulty: '入门', description: '短暂准备后迎接小队。先学会守住前线，再升级产能与科技。', grace: 8, openingDuration: 45, openingInterval: 4, interval: 2.4, economyAt: [18, 65, 125], techAt: [38, 100], accent: '#799678', investmentGuard: 3, savingTime: 5,
    formations: [['soldier','soldier','mouse'], ['shield','soldier','slinger','mage','soldier'], ['shield','catapult','soldier','healer','mage','slinger']] },
  { id: 'cardboard', name: '纸箱走廊', subtitle: '小队集结', difficulty: '标准', description: '更快增援，盾卫与法师协同进攻。及时发展远程火力，别只派士兵。', grace: 4, openingDuration: 28, openingInterval: 2.2, interval: 1, economyAt: [10, 45, 95], techAt: [24, 70], accent: '#b68d60', investmentGuard: 2, savingTime: 7,
    formations: [['soldier','soldier','soldier','mouse'], ['shield','slinger','mage','soldier','slinger'], ['shield','catapult','mage','healer','slinger','soldier']] },
  { id: 'pantry', name: '冻干保卫线', subtitle: '守护最后一罐', difficulty: '挑战', description: '敌方更早投资与研究。基地低于 30% 时，大胖橘亲自上场，抬爪横扫前排！', grace: 2, openingDuration: 18, openingInterval: 1.2, interval: .6, economyAt: [6, 30, 75], techAt: [16, 52], accent: '#9c87ac', investmentGuard: 2, savingTime: 8,
    formations: [['soldier','soldier','soldier'], ['shield','mage','slinger','slinger','soldier'], ['shield','catapult','mage','healer','slinger','soldier']] },
];
export const getLevel = (id: string) => LEVELS.find(level => level.id === id) ?? LEVELS[0];

/** Victory only; exactly half health belongs to the two-star tier. */
export function victoryStars(hp: number): 1 | 2 | 3 {
  return hp >= BASE_HP ? 3 : hp >= BASE_HP * .5 ? 2 : 1;
}

export type CampaignProgress = Record<string, { stars: number; bestTime: number; ratingVersion?: 2 }>;
export function readProgress(raw: string | null): CampaignProgress {
  try {
    const value = JSON.parse(raw ?? '{}');
    const valid: CampaignProgress = {};
    for (const { id } of LEVELS) {
      const entry = value?.[id];
      if (entry && Number.isInteger(entry.stars) && entry.stars >= 1 && entry.stars <= 3 && Number.isFinite(entry.bestTime) && entry.bestTime > 0) {
        valid[id] = { stars: entry.stars, bestTime: entry.bestTime };
        if (entry.ratingVersion === 2) valid[id].ratingVersion = 2;
      }
    }
    return valid;
  } catch { return {}; }
}
