import { apply as economy } from './candidate-economy.mjs';
export function apply(content, levels) {
  economy(content, levels);
  Object.assign(content.UNITS.kungfu, { cost: 110 });
  Object.assign(content.UNITS.assassin, { cost: 180, population: 2 });
  Object.assign(content.UNITS.umbrella, { cost: 135, population: 2 });
  Object.assign(content.UNITS.drummer, { cost: 115 });
  Object.assign(content.UNITS.hook, { cost: 140 });
  Object.assign(content.UNITS.boxer, { cost: 150, population: 2 });
}
