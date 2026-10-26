export function apply(content, levels) {
  content.FOOD_RATES.splice(0, Infinity, 12, 18, 23, 28, 33, 38, 43, 48);
  content.ECONOMY_COSTS.splice(0, Infinity, 120, 180, 240, 300, 360, 430, 510);
  for (const level of levels) {
    // Teaching chapters stop earlier; later chapters can fund higher production.
    const cap = [3, 4, 5, 6, 7, 7][level.chapter - 1];
    const last = level.economyAt[2];
    level.economyAt = [...level.economyAt, last + 45, last + 90, last + 140, last + 195].slice(0, cap);
  }
}
