import { apply as paced } from './candidate-paced.mjs';
export function apply(content, levels) {
  paced(content, levels);
  Object.assign(content.UNITS.kungfu, { hp: 350, damage: 42 });
  Object.assign(content.UNITS.assassin, { hp: 230 });
  Object.assign(content.UNITS.boxer, { hp: 480 });
  content.UNITS.umbrella.population = 3;
}
