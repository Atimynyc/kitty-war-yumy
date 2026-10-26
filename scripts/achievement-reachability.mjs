// Normal resources and unchanged combat AI; this is reachability evidence, not human win rates.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Battle } from '../src/game/simulation.ts';
import * as content from '../src/game/content.ts';
import { LEVELS, recordVictory } from '../src/game/levels.ts';
import { ACHIEVEMENTS, emptyAchievements, emptyRunStats, absorbRun, awardVictory, unlockAchievements, achievementValue } from '../src/game/achievements.ts';
import { validBattleSave } from '../src/game/battle-save.ts';
import { PLANS, runPolicy } from './global-balance.mjs';

const folder='analysis/achievements-0.18'; mkdirSync(folder,{recursive:true});
let last, checkpoints=0, largestCheckpoint=0;
class ObservedBattle extends Battle {
  nextCheckpoint=5;
  constructor(seed) { super(seed); last=this; }
  step(dt) {
    super.step(dt);
    if(this.phase==='playing' && this.time>=this.nextCheckpoint) {
      const snapshot=this.save();
      if(!validBattleSave(snapshot)) writeFileSync(`${folder}/invalid-checkpoint.json`,JSON.stringify(snapshot,null,2));
      assert.ok(validBattleSave(snapshot),`Invalid normal checkpoint ${this.level.id}/${this.time}`);
      largestCheckpoint=Math.max(largestCheckpoint,JSON.stringify(snapshot).length);
      checkpoints++; this.nextCheckpoint+=5;
    }
  }
}
const achievements=emptyAchievements(), progress={}, results=[];
const collect=(result)=>{
  const b=last;
  absorbRun(achievements,b.stats,emptyRunStats());
  if(b.winner==='player') { recordVictory(progress,b.level,b.armies.player.hp,b.time); awardVictory(achievements,b.stats,b.level.stage); }
  const gained=unlockAchievements(achievements,progress,'play',0);
  results.push({...result,stats:b.stats,bossSpawned:b.boss.spawned,gained});
};
const requested=process.argv.find(s=>s.startsWith('--stage='))?.split('=')[1];
for(const level of LEVELS.filter(l=>!requested||l.stage===Number(requested))) {
  for(const policy of Object.keys(PLANS)) collect(runPolicy(ObservedBattle,content,level,policy,1234));
  if(level.stage%5===0) console.log(`Completed ${level.stage*6} normal-resource rounds`);
}
// The standard six policy rosters omit the cheap scout. Recruit it through the normal action.
const scout=new ObservedBattle(1234);scout.start();assert.ok(scout.summon('player','mouse'));collect({stage:1,policy:'scout-recruitment',seed:1234,winner:null,seconds:0});
const report={version:'0.18.0',note:'180 full rounds at one seed plus one real-cost scout recruitment; fixed policies, not human win rates.',sources:Object.fromEntries(['simulation.ts','content.ts','levels.ts','achievements.ts','battle-save.ts'].map(f=>[f,createHash('sha256').update(readFileSync(`src/game/${f}`)).digest('hex')])),checkpoints,largestCheckpoint,unlocked:Object.keys(achievements.unlocked),missing:ACHIEVEMENTS.filter(a=>!achievements.unlocked[a.id]).map(a=>({id:a.id,name:a.name,value:achievementValue(a,achievements,progress),target:a.target})),results};
writeFileSync(`${folder}/${requested?`stage-${requested}`:'reachability'}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({games:results.length,checkpoints,largestCheckpoint,unlocked:report.unlocked.length,missing:report.missing,finalStage:results.filter(r=>r.stage===30).map(r=>({policy:r.policy,winner:r.winner,boss:r.stats.bossDefeated,spawned:r.bossSpawned}))},null,2));
