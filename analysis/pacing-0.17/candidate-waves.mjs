export function apply(content, levels) {
  for (const level of levels) level.reinforcements = { start: 60, cycle: 30, rest: 10 };
}
