export function apply(content, levels) {
  for (const level of levels) level.reinforcements = { start: 90, cycle: 36, rest: 12 };
}
