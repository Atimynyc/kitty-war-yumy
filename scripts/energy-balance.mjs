import { Battle } from '../src/game/simulation.ts';
import * as content from '../src/game/content.ts';
import { LEGACY_LEVELS as LEVELS } from '../src/game/levels.ts';
import { STRATEGIES, simulateStrategy } from './balance.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const output='analysis/energy-2026-10-23';mkdirSync(output,{recursive:true});
const baseline=process.argv.includes('--baseline');
const applied=process.argv.includes('--applied');
if(baseline && content.ENERGY)throw new Error('The cooldown baseline is archived; do not relabel energy rules as the old version.');
const original={step:Battle.prototype.step,roar:Battle.prototype.roar,catnip:Battle.prototype.catnip};
let stats;
for(const spell of ['roar','catnip'])Battle.prototype[spell]=function(side){
  const success=original[spell].call(this,side);if(success)stats[side].casts.push({spell,time:+this.time.toFixed(2)});return success;
};
Battle.prototype.step=function(dt){
  const before=this.units.filter(u=>u.hp>0).map(u=>({id:u.id,side:u.side,kind:u.kind}));original.step.call(this,dt);
  const after=new Set(this.units.map(u=>u.id));
  for(const u of before)if(!after.has(u.id)){
    const side=u.side==='player'?'enemy':'player';stats[side].kills[u.kind]=(stats[side].kills[u.kind]??0)+1;
  }
  for(const side of ['player','enemy']){
    const a=this.armies[side];Object.assign(stats[side],{energy:a.energy,earned:a.energyEarned,spent:a.energySpent,overflow:a.energyOverflow});
  }
};
const rewards=content.ENERGY_REWARDS?{...content.ENERGY_REWARDS}:null;
const candidates=baseline?[{name:'cooldown-45s'}]:applied?[{name:'applied-light',rewards}]:[
  {name:'conservative',rewards:{mouse:2,soldier:4,shield:7,slinger:5,mage:6,catapult:8,healer:6,knight:16,boss:50}},
  {name:'standard',rewards:{mouse:3,soldier:5,shield:8,slinger:6,mage:8,catapult:10,healer:8,knight:20,boss:50}},
  {name:'generous',rewards:{mouse:4,soldier:6,shield:10,slinger:8,mage:10,catapult:12,healer:10,knight:25,boss:50}},
  {name:'elite',rewards:{mouse:2,soldier:4,shield:10,slinger:6,mage:8,catapult:12,healer:8,knight:25,boss:50}},
  {name:'sparse',rewards:{mouse:2,soldier:3,shield:6,slinger:5,mage:6,catapult:8,healer:6,knight:20,boss:50}},
  {name:'steady',rewards:{mouse:2,soldier:5,shield:8,slinger:6,mage:7,catapult:10,healer:7,knight:20,boss:50}},
  {name:'light',rewards:{mouse:2,soldier:4,shield:6,slinger:5,mage:6,catapult:8,healer:6,knight:20,boss:50}},
];
const scenarios=[];
try {
  for(const candidate of candidates){
    if(candidate.rewards)Object.assign(content.ENERGY_REWARDS,candidate.rewards);
    for(const level of LEVELS)for(const strategy of STRATEGIES){
      stats={player:{casts:[],kills:{}},enemy:{casts:[],kills:{}}};
      scenarios.push({candidate:candidate.name,...simulateStrategy(level,strategy,applied?{}:{minBuff:3}),...{spells:stats}});
    }
  }
} finally {
  if(rewards)Object.assign(content.ENERGY_REWARDS,rewards);
  Object.assign(Battle.prototype,original);
}
const sourceHash=Object.fromEntries(['src/game/content.ts','src/game/simulation.ts','scripts/balance.mjs'].map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]));
writeFileSync(`${output}/${baseline?'baseline':applied?'applied':'candidates'}.json`,JSON.stringify({version:JSON.parse(readFileSync('package.json')).version,sourceHash,spellPolicy:applied?'buff group >=5, remaining buff <=2s':'buff group >=3',candidates,scenarios},null,2));
console.log(JSON.stringify(candidates.map(c=>({candidate:c.name,scenarios:scenarios.filter(r=>r.candidate===c.name).length,
  mixed:scenarios.filter(r=>r.candidate===c.name && r.strategy==='combined-arms').map(r=>({level:r.level,winner:r.winner,seconds:r.seconds,playerCasts:r.spells.player.casts.length,enemyCasts:r.spells.enemy.casts.length,kills:Object.values(r.spells.player.kills).reduce((a,b)=>a+b,0),earned:r.spells.player.earned,overflow:r.spells.player.overflow})),
  wins:scenarios.filter(r=>r.candidate===c.name && r.winner==='player').length,unfinished:scenarios.filter(r=>r.candidate===c.name && r.winner==='unfinished').length})),null,2));
