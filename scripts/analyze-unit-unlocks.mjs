// Planning probe only: restrict player recruitment in a subclass, never shipping rules.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import * as content from '../src/game/content.ts';
import { LEVELS } from '../src/game/levels.ts';
import { ENEMY_UNITS } from '../src/game/enemy-roster.ts';
import { PLANS, runPolicy, summarize } from './global-balance.mjs';
import { UNIT_UNLOCK_STAGE } from '../src/game/unit-unlocks.ts';

const folder='analysis/unit-unlocks-2026-10-26';mkdirSync(folder,{recursive:true});
const schedules={
  earlyGunner:{mouse:1,soldier:1,slinger:3,shield:4,kungfu:6,umbrella:8,mage:9,gunner:11,hook:13,litter:14,drummer:16,healer:17,assassin:19,catapult:21,boxer:22,knight:24},
  counterLessons:{mouse:1,soldier:1,slinger:3,shield:4,kungfu:6,umbrella:8,mage:9,catapult:11,hook:13,litter:14,gunner:16,drummer:18,assassin:19,healer:21,boxer:22,knight:24},
  observedEncounters:{...UNIT_UNLOCK_STAGE},
};
const fallbacks={
  shield:['soldier'],slinger:['soldier'],mage:['slinger','soldier'],gunner:['slinger','soldier'],
  catapult:['slinger','soldier'],healer:['slinger','soldier'],knight:['kungfu','shield','soldier'],
  kungfu:['soldier'],litter:['mage','slinger','soldier'],umbrella:['shield','soldier'],drummer:['slinger','soldier'],
  hook:['mage','slinger','soldier'],assassin:['kungfu','soldier'],boxer:['kungfu','shield','soldier'],mouse:['soldier'],soldier:[],
};
const args=process.argv.slice(2),arg=key=>args.find(a=>a.startsWith(`${key}=`))?.slice(key.length+1);
const names=(arg('--schedules')??'unrestricted,earlyGunner,counterLessons').split(',');
const seeds=(arg('--seeds')??'1234').split(',').map(Number);
const selectedStages=arg('--stages')?.split(',').map(Number);
const policies=(arg('--policies')??'guns,siege,martial,support,infiltration').split(',');
const originals=JSON.parse(JSON.stringify(PLANS));
const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const sourceFiles=['scripts/analyze-unit-unlocks.mjs','scripts/global-balance.mjs',...['simulation','content','levels','campaign','spell-notices','combat-space','boss-combat','unit-unlocks','profile','battle-save'].map(f=>`src/game/${f}.ts`)];
const sources=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
let allowed=new Set(content.UNIT_ORDER),latest;
class ProbedBattle extends Battle {
  constructor(seed){super(seed);latest=this;this.firstPlayer={};this.firstEnemy={};}
  reset(levelId){super.reset(levelId,[...allowed]);}
  summon(side,kind){const ok=super.summon(side,kind);if(ok){const first=side==='player'?this.firstPlayer:this.firstEnemy;if(first[kind]===undefined)first[kind]=Math.round(this.time*10)/10;}return ok;}
}
for(const [name,map] of Object.entries(schedules))assert.deepEqual(Object.keys(map).sort(),[...content.UNIT_ORDER].sort(),name);
const rows=[];
try {
  for(const name of names){
    assert.ok(name==='unrestricted'||schedules[name]);
    for(const level of LEVELS.filter(l=>!selectedStages||selectedStages.includes(l.stage))){
      const map=schedules[name];allowed=new Set(content.UNIT_ORDER.filter(k=>!map||map[k]<=level.stage));
      for(const policy of policies){
        const original=originals[policy];
        const adapt=k=>allowed.has(k)?k:fallbacks[k].find(f=>allowed.has(f));
        PLANS[policy]={...original,two:original.two.map(adapt),three:original.three.map(adapt)};
        for(const seed of seeds){
          const result=runPolicy(ProbedBattle,content,level,policy,seed,{allowedKinds:[...allowed]});
          assert.ok(Object.keys(result.recruited).every(k=>allowed.has(k)));
          rows.push({...result,schedule:name,allowed:[...allowed],firstPlayer:latest.firstPlayer,firstEnemy:latest.firstEnemy});
        }
      }
      console.log(`${name} stage ${level.stage}: ${rows.length} matches`);
    }
  }
}finally{Object.assign(PLANS,originals);}
for(const f of sourceFiles)assert.equal(hash(f),sources[f],`source changed: ${f}`);
const enemyTimeline=LEVELS.map(l=>{
  const possible=new Set([l,...(l.phases??[])].flatMap(p=>p.formations.slice(0,l.techCap).flat()));
  // The separate AI rider purchase is eligible from stage 22.
  if(l.knight&&l.techCap>=3)possible.add('knight');
  return {stage:l.stage,name:l.name,tactic:l.tactic,techCap:l.techCap,techAt:l.techAt,
    enemies:content.ENEMY_ORDER.filter(k=>possible.has(k)).map(k=>({kind:k,name:ENEMY_UNITS[k].name})),
    phases:(l.phases??[]).map(p=>({at:p.at,label:p.label})),boss:!!l.bossEncounter};
});
const summaries=Object.fromEntries(names.map(name=>[name,summarize(rows.filter(r=>r.schedule===name))]));
const output=arg('--out')??'draft-comparison';
assert.match(output,/^[a-z0-9-]+$/);
writeFileSync(`${folder}/${output}.json`,JSON.stringify({scope:'Planning simulation only. Normal food, technology, cooldowns, population and AI. Locked recruits rejected; fixed policies replace locked roles with earlier available units. 600s cutoff. Not human win rates.',sources,seeds,policies,schedules,summaries,enemyTimeline,rows},null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summaries).map(([n,s])=>[n,{...s.overall,stagesWithoutWin:s.stagesWithoutWin}]))));
