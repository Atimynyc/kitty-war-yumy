import { apply as paced } from './candidate-paced.mjs';
export function apply(content, levels) {
  paced(content, levels);
  Object.assign(content.UNITS.kungfu, { hp: 380, damage: 44 });
  Object.assign(content.UNITS.assassin, { hp: 260 });
  Object.assign(content.UNITS.boxer, { hp: 560 });
  // Keep the protection role's population opportunity cost in a long-range stack.
  content.UNITS.umbrella.population = 3;
}
