import { apply as roster } from './candidate-roster.mjs';
export function apply(content, levels) {
  roster(content, levels);
  content.FOOD_RATES.splice(0, Infinity, 12, 18, 22, 26, 30, 34, 38, 42);
  content.ECONOMY_COSTS.splice(0, Infinity, 120, 160, 220, 280, 340, 400, 480);
  for (const level of levels) {
    const cap = [2, 3, 3, 4, 4, 5][level.chapter - 1];
    const last = level.economyAt[2];
    level.economyAt = [...level.economyAt.slice(0, 3), last + 65, last + 135].slice(0, cap);
  }
}
