// Normal-resource strategy probes, not measured human win rates.
import { Battle } from '../src/game/simulation.ts';
import { getLevel } from '../src/game/levels.ts';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const plans = {
  mixed: { tier2: ['umbrella', 'kungfu', 'litter', 'drummer', 'boxer'], tier3: ['umbrella', 'gunner', 'healer', 'litter', 'drummer', 'hook', 'boxer', 'assassin', 'kungfu'] },
  guns: { tier2: ['shield', 'slinger', 'umbrella'], tier3: ['umbrella', 'gunner', 'gunner', 'healer', 'drummer', 'gunner', 'litter'] },
  assassins: { tier2: ['kungfu', 'shield'], tier3: ['assassin', 'assassin', 'assassin', 'assassin', 'assassin'] },
};
const results = [];
for (const stage of [5, 15, 30]) for (const [strategy, plan] of Object.entries(plans)) {
  const b = new Battle(1234); b.reset(getLevel(`campaign-${String(stage).padStart(2, '0')}`).id); b.start(); b.upgradeEconomy('player');
  const recruited = {};
  for (let frame = 0; frame < 30 * 600 && b.phase === 'playing'; frame++) {
    if (frame % 15 === 0) {
      const a = b.armies.player, allies = b.units.filter(u => u.side === 'player');
      if (b.units.some(u => u.side === 'enemy' && u.x < 430)) b.roar('player');
      if (allies.filter(u => u.attacking && u.catnip <= 2).length >= 4) b.catnip('player');
      let saving = false;
      if (allies.length >= 2 && a.hp > 1500) {
        if (a.economy < 3 && b.time >= [0, 22, 48][a.economy]) saving = !b.upgradeEconomy('player');
        else if (a.tech < 3 && !a.researching && b.time >= [12, 45][a.tech - 1]) saving = !b.researchTech('player');
      }
      if (!saving) {
        const roster = a.tech === 1 ? ['soldier', 'soldier'] : a.tech === 2 ? plan.tier2 : plan.tier3;
        const target = roster.find((kind, i) => allies.filter(u => u.kind === kind).length < roster.slice(0, i + 1).filter(k => k === kind).length) ?? 'soldier';
        if (b.summon('player', target)) recruited[target] = (recruited[target] ?? 0) + 1;
      }
    }
    b.step(1 / 30);
  }
  results.push({ stage, strategy, winner: b.winner ?? 'timeout', seconds: Math.round(b.time), playerHp: Math.round(b.armies.player.hp), enemyHp: Math.round(b.armies.enemy.hp), recruited });
}
mkdirSync('analysis', { recursive: true });
writeFileSync('analysis/specialists-0.15.json', JSON.stringify({ scope: 'Nine fixed strategies with normal resource and recruitment rules; not human win rates', seed: 1234, fingerprints: Object.fromEntries(['src/game/content.ts', 'src/game/simulation.ts', 'scripts/specialists-balance.mjs'].map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])), results }, null, 2));
console.table(results.map(({ recruited, ...row }) => row));
