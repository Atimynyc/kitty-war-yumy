export interface Level {
  id: string; name: string; subtitle: string; difficulty: string; description: string;
  grace: number; openingDuration: number; openingInterval: number; interval: number;
  economyAt: number[]; techAt: number[]; accent: string;
}

// The same combat rules and resource budget apply to every opponent. Difficulty
// changes its preparation time and decisions, never grants free troops.
export const LEVELS: readonly Level[] = [
  { id: 'sunroom', name: '阳光客厅', subtitle: '第一次守护', difficulty: '入门', description: '有足够时间布置小队，适合熟悉招募与基地升级。', grace: 24, openingDuration: 60, openingInterval: 6, interval: 3.6, economyAt: [65, 150, 240], techAt: [100, 230], accent: '#799678' },
  { id: 'cardboard', name: '纸箱走廊', subtitle: '小队集结', difficulty: '标准', description: '增援更频繁。让盾卫保护远程伙伴，稳住前线再升级。', grace: 16, openingDuration: 45, openingInterval: 4.5, interval: 2.7, economyAt: [50, 115, 195], techAt: [80, 195], accent: '#b68d60' },
  { id: 'pantry', name: '冻干保卫线', subtitle: '守护最后一罐', difficulty: '挑战', description: '对手更早发展科技。搭配攻城、治疗和主炮守住小窝。', grace: 10, openingDuration: 30, openingInterval: 3.5, interval: 2.1, economyAt: [40, 90, 150], techAt: [65, 155], accent: '#9c87ac' },
];
export const getLevel = (id: string) => LEVELS.find(level => level.id === id) ?? LEVELS[0];

export type CampaignProgress = Record<string, { stars: number; bestTime: number }>;
export function readProgress(raw: string | null): CampaignProgress {
  try {
    const value = JSON.parse(raw ?? '{}');
    const valid: CampaignProgress = {};
    for (const { id } of LEVELS) {
      const entry = value?.[id];
      if (entry && Number.isInteger(entry.stars) && entry.stars >= 1 && entry.stars <= 3 && Number.isFinite(entry.bestTime) && entry.bestTime > 0) valid[id] = { stars: entry.stars, bestTime: entry.bestTime };
    }
    return valid;
  } catch { return {}; }
}
