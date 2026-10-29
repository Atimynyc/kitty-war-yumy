import { BASE_HP, UNIT_ORDER } from './content.ts';
import type { Battle } from './simulation.ts';

/** Cumulative successful hires, including partners that have already left the field. */
export function battleReport(battle: Battle) {
  const army = battle.armies.player;
  const recruits = UNIT_ORDER.map(kind => ({ kind, count: army.recruitCounts?.[kind] ?? 0 }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || UNIT_ORDER.indexOf(a.kind) - UNIT_ORDER.indexOf(b.kind));
  return {
    duration: battle.time,
    totalRecruited: army.hired,
    baseHp: Math.max(0, Math.ceil(army.hp)),
    baseMaxHp: BASE_HP,
    recruits,
    unrecordedRecruits: Math.max(0, army.hired - recruits.reduce((total, item) => total + item.count, 0)),
  };
}
