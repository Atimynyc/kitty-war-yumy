import { mkdirSync, existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { PLANS, runPolicy, summarize } from './global-balance.mjs';

const folder = 'analysis/pacing-0.17';
const files = ['simulation.ts','content.ts','levels.ts','campaign.ts','combat-space.ts','base-dialogue.ts','spell-notices.ts','boss-combat.ts'];
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
mkdirSync(folder, { recursive: true });
if (process.argv.includes('--freeze')) {
  const root = `${folder}/baseline-source`;
  if (existsSync(root)) throw new Error('Never overwrite the baseline.');
  const baseline = JSON.parse(readFileSync('analysis/balance-0.16/applied.json'));
  if (baseline.policyHash !== hash('scripts/global-balance.mjs')) throw new Error('Policy changed since 0.16 validation');
  for (const file of files) if (hash(`src/game/${file}`) !== baseline.sources[file]) throw new Error(`${file} differs from the measured baseline`);
  mkdirSync(root); for (const file of files) copyFileSync(`src/game/${file}`, `${root}/${file}`);
  copyFileSync('scripts/global-balance.mjs', `${folder}/baseline-policy.mjs`);
  writeFileSync(`${folder}/baseline.json`, JSON.stringify({ ...baseline, version: '0.16.0', verifiedReuse: 'Identical source and policy hashes to balance-0.16/applied.json' }, null, 2));
  console.log('Froze 0.16 source and verified all 540 existing baseline matches.');
} else {
  const baseline = process.argv.includes('--baseline');
  const root = baseline ? `${folder}/baseline-source` : 'src/game';
  const { Battle } = await import(pathToFileURL(path.resolve(`${root}/simulation.ts`)).href);
  const content = await import(pathToFileURL(path.resolve(`${root}/content.ts`)).href);
  const { LEVELS } = await import(pathToFileURL(path.resolve(`${root}/levels.ts`)).href);
  const candidate = process.argv.find(v=>v.startsWith('--candidate='))?.split('=')[1];
  if (candidate) { const { apply } = await import(pathToFileURL(path.resolve(candidate)).href); apply(content, LEVELS); }
  const stages = process.argv.find(v=>v.startsWith('--stages='))?.split('=')[1].split(',').map(Number);
  const seeds = process.argv.includes('--quick') ? [1234] : [1234, 20261025, 8675309];
  const policies = process.argv.find(v=>v.startsWith('--policies='))?.split('=')[1].split(',') ?? Object.keys(PLANS);
  const results = [];
  for (const level of LEVELS.filter(l=>!stages || stages.includes(l.stage))) {
    for (const policy of policies) for (const seed of seeds) results.push(runPolicy(Battle, content, level, policy, seed));
    console.log(`stage ${level.stage}: ${results.length} matches`);
  }
  const name = process.argv.find(v=>v.startsWith('--out='))?.split('=')[1] ?? (baseline ? 'baseline-replay' : 'applied');
  const report = { scope: 'Normal resources, identical six policies to 0.16, 30 Hz, 600-second observation limit. Not human win rates.', seeds, policyHash: hash('scripts/global-balance.mjs'), sources: Object.fromEntries(files.map(f=>[f,hash(`${root}/${f}`)])), candidate: candidate ? { path: candidate, sha256: hash(candidate) } : null, summary: summarize(results), results };
  writeFileSync(`${folder}/${name}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
}
