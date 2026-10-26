import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runPolicy, summarize } from './global-balance.mjs';
import { runPolicy as oldPolicy } from '../analysis/spells-0.19/baseline-policy.mjs';
import { Battle } from '../src/game/simulation.ts';
import * as content from '../src/game/content.ts';
import { LEVELS } from '../src/game/levels.ts';
import { Battle as OldBattle } from '../analysis/spells-0.19/baseline-source/simulation.ts';
import * as oldContent from '../analysis/spells-0.19/baseline-source/content.ts';
import { LEVELS as oldLevels } from '../analysis/spells-0.19/baseline-source/levels.ts';

const folder='analysis/spells-0.19';mkdirSync(folder,{recursive:true});
const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const sources=Object.fromEntries(['simulation.ts','content.ts','spell-notices.ts'].map(f=>[f,hash(`src/game/${f}`)]));
const policies=['guns','siege','support'],seed=1234,baseline=[],applied=[],choices=[];
for(const level of LEVELS) {
  for(const policy of policies) {
    baseline.push(oldPolicy(OldBattle,oldContent,oldLevels.find(l=>l.id===level.id),policy,seed));
    applied.push(runPolicy(Battle,content,level,policy,seed));
  }
  if([1,5,10,15,20,30].includes(level.stage))for(const spells of ['none','catnip','treat','bombard'])choices.push({...runPolicy(Battle,content,level,'guns',seed,{spells}),spellPolicy:spells});
  console.log(`stage ${level.stage}: ${applied.length} paired matches, ${choices.length} skill comparisons`);
}
for(const [file,before] of Object.entries(sources))if(hash(`src/game/${file}`)!==before)throw new Error(`Source changed during measurement: ${file}`);
const report={scope:'30 stages × 3 identical recruitment policies × one seed, 90 old / 90 new matches; 24 extra single-skill/no-skill choices. Normal resources, 600s cutoff, not human win rates.',seed,policies,sources,baselineSummary:summarize(baseline),appliedSummary:summarize(applied),baseline,applied,choices};
writeFileSync(`${folder}/comparison.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({old:report.baselineSummary.overall,current:report.appliedSummary.overall,stagesWithoutWin:report.appliedSummary.stagesWithoutWin}));
