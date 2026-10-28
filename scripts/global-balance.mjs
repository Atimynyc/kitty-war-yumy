// Normal-resource, deterministic policy comparisons. These are NOT human win rates.
// Baseline imports its own frozen simulation and config, never the current rules.
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const PLANS = {
  siege: { label: '重骑攻城', two: ['shield', 'slinger', 'mage', 'soldier'], three: ['shield', 'knight', 'catapult', 'slinger', 'healer', 'mage', 'catapult'] },
  guns: { label: '枪手保护', two: ['shield', 'slinger', 'umbrella', 'slinger'], three: ['shield', 'gunner', 'umbrella', 'gunner', 'healer', 'drummer', 'gunner', 'litter'] },
  martial: { label: '功夫控场', two: ['shield', 'kungfu', 'litter', 'boxer', 'slinger', 'kungfu'], three: ['shield', 'kungfu', 'litter', 'boxer', 'healer', 'drummer', 'catapult', 'kungfu'] },
  infiltration: { label: '刺客突进', two: ['shield', 'kungfu', 'slinger', 'mage'], three: ['shield', 'assassin', 'hook', 'gunner', 'assassin', 'healer', 'mage', 'assassin'] },
  support: { label: '协同支援', two: ['shield', 'slinger', 'litter', 'drummer', 'umbrella'], three: ['shield', 'gunner', 'litter', 'drummer', 'umbrella', 'catapult', 'healer', 'boxer'] },
  soldiers: { label: '纯鱼干压力测试', two: ['soldier'], three: ['soldier'], rush: true },
};
const FRONT = new Set(['soldier', 'shield', 'kungfu', 'umbrella', 'boxer', 'knight']);
export function runPolicy(Battle, content, level, policy, seed = 1234, options = {}) {
  const { UNITS, FOOD_RATES, ECONOMY_COSTS, MAX_POPULATION, TECH_COSTS } = content;
  const b = new Battle(seed); b.reset(level.id); b.start();
  const plan = PLANS[policy], recruited = {}, investments = [], techAt = [0], economyAt = [0];
  let cursor = 0, pending, pendingAt = 0, savingKey = '', savingAt = 0, retryAt = 0;
  let maxPopulation = 0, fullSeconds = 0, pressureSeconds = 0, foodSum = 0, samples = 0;
  let lastEffect = 0;
  const abilityEvents = {}, statusSeconds = { weakenedEnemies: 0, guardedAllies: 0, hastedAllies: 0, hiddenAllies: 0 };
  const trace = [];
  const buy = kind => {
    if (!b.summon('player', kind)) return false;
    recruited[kind] = (recruited[kind] ?? 0) + 1; return true;
  };
  if (!plan.rush && b.upgradeEconomy('player')) { economyAt.push(0); investments.push({ t: 0, kind: 'economy', level: 2 }); }
  for (let frame = 0; frame < 30 * (options.limit ?? 600) && b.phase === 'playing'; frame++) {
    if (frame % 15 === 0) {
      const a = b.armies.player, allies = b.units.filter(u => u.side === 'player'), enemies = b.units.filter(u => u.side === 'enemy');
      const count = kind => allies.filter(u => u.kind === kind).length;
      const pop = b.population('player'), front = allies.filter(u => FRONT.has(u.kind));
      const pressure = enemies.some(u => u.x < 430);
      if (b.bombard) {
        const target = b.bombardTarget('player');
        const cluster = target ? enemies.filter(u => Math.hypot(u.x-target.x,(u.row-target.row)*80) <= content.BOMBARD.radius).length : 0;
        const wounded = allies.filter(u => u.hp < UNITS[u.kind].hp*.65);
        const mode = options.spells ?? 'balanced';
        if (mode !== 'none') {
          if ((mode === 'balanced' || mode === 'bombard') && cluster >= (pressure ? 2 : 4) && b.bombard('player')) {}
          else if ((mode === 'balanced' || mode === 'treat') && (wounded.length >= 3 || wounded.some(u=>u.kind==='knight'&&u.hp<720)) && b.treat('player')) {}
          else if ((mode === 'balanced' || mode === 'catnip') && allies.filter(u=>u.attacking&&UNITS[u.kind].damage>0&&u.catnip<=2).length>=4) b.catnip('player');
        }
      } else {
        // Archived rules keep their original two-skill policy.
        if (pressure) b.roar('player');
        if (allies.filter(u => u.attacking && UNITS[u.kind].damage > 0 && u.catnip <= 2).length >= 4) b.catnip('player');
      }
      if (plan.rush) buy('soldier');
      else {
        const safe = a.hp > 1400 && front.reduce((n,u) => n + u.hp, 0) > 250 && (!pressure || allies.length >= 4);
        // Interleave technology and income; bounded savings keeps both recruitment and research reachable.
        const techCap = options.allowedKinds ? Math.max(1,...options.allowedKinds.map(k=>UNITS[k].tier)) : 3;
        const desiredTech = a.tech < techCap && !a.researching && b.time >= [14, 60][a.tech - 1];
        const desiredEconomy = a.economy < Math.min(ECONOMY_COSTS.length, options.economyCap ?? Infinity) && b.time >= [0, 32, 85, 120, 160, 200, 245][a.economy];
        let investing = false;
        if (safe && (desiredTech || desiredEconomy) && b.time >= retryAt) {
          const key = desiredTech ? `tech-${a.tech}` : `economy-${a.economy}`;
          if (key !== savingKey) { savingKey = key; savingAt = b.time; }
          const cost = desiredTech ? TECH_COSTS[a.tech - 1] : ECONOMY_COSTS[a.economy];
          // A small reinforcement reserve prevents high-level investment from emptying a defensive wallet.
          if (a.food >= cost + (pressure ? 50 : 0)) {
            const success = desiredTech ? b.researchTech('player') : b.upgradeEconomy('player');
            if (success) {
              investments.push({ t: Math.round(b.time * 10) / 10, kind: desiredTech ? 'tech' : 'economy', level: desiredTech ? a.tech + 1 : a.economy + 1 });
              if (!desiredTech) economyAt[a.economy] = Math.round(b.time * 10) / 10;
            }
            savingKey = ''; investing = true;
          } else if (b.time - savingAt < 10) investing = true;
          else { retryAt = b.time + 4; savingKey = ''; }
        } else if (!safe) savingKey = '';
        if (!investing) {
          const roster = a.tech === 1 ? ['soldier', 'soldier', 'soldier', 'soldier'] : a.tech === 2 ? plan.two : plan.three;
          const available = roster.filter(kind => UNITS[kind].population + pop <= MAX_POPULATION && count(kind) < roster.filter(k => k === kind).length);
          if (!pending || UNITS[pending].tier > a.tech || !available.includes(pending)) pending = undefined;
          // Replace an absent frontline, but do not endlessly replace the first missing role.
          if (!front.length && pop < MAX_POPULATION - 1) {
            const kind = a.tech >= 2 && (!options.allowedKinds || options.allowedKinds.includes('shield')) ? 'shield' : 'soldier';
            if (pending !== kind) { pending = kind; pendingAt = b.time; }
          }
          if (!pending && available.length) {
            for (let n = 0; n < roster.length; n++) {
              const kind = roster[cursor++ % roster.length];
              if (available.includes(kind)) { pending = kind; pendingAt = b.time; break; }
            }
          }
          if (pending) {
            if (buy(pending)) pending = undefined;
            else if (b.time - pendingAt > (pending === 'knight' ? 28 : 15)) pending = undefined;
          } else if (a.tech >= 2 && pop < MAX_POPULATION && !available.length) buy('soldier');
        }
      }
      if (techAt[a.tech - 1] === undefined) techAt[a.tech - 1] = Math.round(b.time * 10) / 10;
      maxPopulation = Math.max(maxPopulation, pop); fullSeconds += pop >= MAX_POPULATION - 1 ? .5 : 0;
      pressureSeconds += pressure ? .5 : 0; foodSum += a.food; samples++;
      statusSeconds.weakenedEnemies += enemies.filter(u => u.weakenedUntil > b.time).length * .5;
      statusSeconds.guardedAllies += allies.filter(u => u.guardUntil > b.time).length * .5;
      statusSeconds.hastedAllies += allies.filter(u => u.hasteUntil > b.time).length * .5;
      statusSeconds.hiddenAllies += allies.filter(u => u.stealthUntil > b.time).length * .5;
      if (frame % 900 === 0) trace.push({ t: Math.round(b.time), hp: Math.round(a.hp), enemyHp: Math.round(b.armies.enemy.hp), food: Math.round(a.food), pop, tech: a.tech, economy: a.economy + 1 });
    }
    b.step(1 / 30);
    for (const fx of b.effects) {
      if (fx.id <= lastEffect) continue;
      if (fx.side === 'player' && ['dodge','stealth','guard','drum','hook','dust','heal'].includes(fx.type)) abilityEvents[fx.type] = (abilityEvents[fx.type] ?? 0) + 1;
      lastEffect = Math.max(lastEffect, fx.id);
    }
  }
  const a = b.armies.player;
  return { stage: level.stage, policy, seed, winner: b.winner ?? 'timeout', seconds: Math.round(b.time), playerHp: Math.round(a.hp), enemyHp: Math.round(b.armies.enemy.hp), tech: a.tech, enemyTech: b.armies.enemy.tech, economy: a.economy + 1, enemyEconomy: b.armies.enemy.economy + 1, food: Math.round(a.food), meanFood: Math.round(foodSum / samples), maxPopulation, fullSeconds, pressureSeconds, recruited, techAt, economyAt, investments, abilityEvents, statusSeconds, energySpent: a.energySpent, energyOverflow: a.energyOverflow, trace };
}

export function summarize(results) {
  const median = a => a.length ? [...a].sort((a,b) => a-b)[Math.floor(a.length / 2)] : null;
  const group = rows => {
    const wins = rows.filter(r => r.winner === 'player');
    return { games: rows.length, wins: wins.length, losses: rows.filter(r => r.winner === 'enemy').length, timeouts: rows.filter(r => r.winner === 'timeout').length, winMedian: median(wins.map(r => r.seconds)), winMin: wins.length ? Math.min(...wins.map(r=>r.seconds)) : null, winMax: wins.length ? Math.max(...wins.map(r=>r.seconds)) : null, wins180to300: wins.filter(r => r.seconds >= 180 && r.seconds <= 300).length, fullHealthWins: wins.filter(r => r.playerHp === 3000).length, tier3: rows.filter(r=>r.tech===3).length, tier3Median: median(rows.flatMap(r => r.techAt[2] === undefined ? [] : [r.techAt[2]])), fullPopulationMedian: median(rows.map(r => r.fullSeconds)), foodMedian: median(rows.map(r=>r.food)) };
  };
  return { overall: group(results), policies: Object.fromEntries(Object.keys(PLANS).map(p=>[p,group(results.filter(r=>r.policy===p))])), chapters: Object.fromEntries([1,2,3,4,5,6].map(c=>[c,group(results.filter(r=>Math.ceil(r.stage/5)===c))])), stagesWithoutWin: [...new Set(results.map(r=>r.stage))].filter(stage=>!results.some(r=>r.stage===stage && r.winner==='player')) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = 'analysis/balance-0.16'; mkdirSync(folder, { recursive: true });
  const files = ['simulation.ts','content.ts','levels.ts','campaign.ts','combat-space.ts','base-dialogue.ts','spell-notices.ts','boss-combat.ts'];
  const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
  if (process.argv.includes('--freeze')) {
    const root = `${folder}/baseline-source`;
    if (existsSync(root)) throw new Error('Baseline already exists; never replace its original source.');
    mkdirSync(root); for (const file of files) copyFileSync(`src/game/${file}`, `${root}/${file}`);
    copyFileSync('scripts/global-balance.mjs', `${folder}/baseline-policy.mjs`);
    writeFileSync(`${folder}/baseline-manifest.json`, JSON.stringify({ version: JSON.parse(readFileSync('package.json')).version, sources: Object.fromEntries(files.map(f=>[f,hash(`${root}/${f}`)])) }, null, 2));
    console.log('Preserved original 0.15 simulation and configuration.');
  } else {
    const baseline = process.argv.includes('--baseline');
    const root = baseline ? `${folder}/baseline-source` : 'src/game';
    const { Battle } = await import(pathToFileURL(path.resolve(`${root}/simulation.ts`)).href);
    const content = await import(pathToFileURL(path.resolve(`${root}/content.ts`)).href);
    const { LEVELS } = await import(pathToFileURL(path.resolve(`${root}/levels.ts`)).href);
    // Optional local candidates mutate only this process, not shipping sources.
    const candidate = process.argv.find(v=>v.startsWith('--candidate='))?.split('=')[1];
    if (candidate) { const { apply } = await import(pathToFileURL(path.resolve(candidate)).href); apply(content, LEVELS); }
    const stages = process.argv.find(v=>v.startsWith('--stages='))?.split('=')[1].split(',').map(Number);
    const seeds = process.argv.includes('--quick') ? [1234] : [1234, 20261025, 8675309];
    const policies = process.argv.find(v=>v.startsWith('--policies='))?.split('=')[1].split(',') ?? Object.keys(PLANS);
    const results = [];
    for (const level of LEVELS.filter(l=>!stages || stages.includes(l.stage))) {
      for (const policy of policies) for (const seed of seeds) results.push(runPolicy(Battle, content, level, policy, seed));
      console.log(`stage ${level.stage}: ${results.length} games`);
    }
    const name = process.argv.find(v=>v.startsWith('--out='))?.split('=')[1] ?? (baseline ? 'baseline' : 'applied');
    const report = { scope: 'Fixed normal-resource policies, not human win rates. 30 Hz. 600-second timeout. Support events/status time are exposure proxies, not causal damage attribution.', seeds, policyHash: hash('scripts/global-balance.mjs'), sources: Object.fromEntries(files.map(f=>[f,hash(`${root}/${f}`)])), candidate: candidate ? { path: candidate, sha256: hash(candidate) } : null, economy: { rates: content.FOOD_RATES, costs: content.ECONOMY_COSTS }, summary: summarize(results), results };
    writeFileSync(`${folder}/${name}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report.summary, null, 2));
  }
}
