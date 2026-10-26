import { simulateStrategy } from './balance.mjs';
import { LEGACY_LEVELS as LEVELS } from '../src/game/levels.ts';
import { ENERGY_REWARDS } from '../src/game/content.ts';
import { readFileSync, writeFileSync } from 'node:fs';

// Run after energy-balance.mjs; all candidate changes stay inside this process.
const output = 'analysis/energy-2026-10-23';
const candidates = JSON.parse(readFileSync(`${output}/candidates.json`, 'utf8')).candidates;
const lightOnly = process.argv.includes('--light');
const selected = lightOnly ? ['light'] : ['conservative', 'steady', 'standard'];
const results = [], original = { ...ENERGY_REWARDS };
try {
  for (const candidate of candidates.filter(c => selected.includes(c.name))) {
    Object.assign(ENERGY_REWARDS, candidate.rewards);
    for (const minBuff of lightOnly ? [4, 5] : [3, 4, 5, 6]) {
      for (const earliest of lightOnly ? [0] : [0, 45, 75]) {
        const scenarios = LEVELS.map(level => simulateStrategy(level, 'combined-arms', { minBuff, earliest }));
        results.push(lightOnly ? { minBuff, scenarios } : { candidate: candidate.name, minBuff, earliest, scenarios });
      }
    }
  }
} finally {
  Object.assign(ENERGY_REWARDS, original);
}
writeFileSync(`${output}/${lightOnly ? 'light-tactics' : 'tactics'}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map(result => ({
  ...result,
  scenarios: result.scenarios.map(({ level, seconds, winner }) => ({ level, seconds, winner })),
})), null, 2));
