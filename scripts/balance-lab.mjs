import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Battle } from '../src/game/simulation.ts';
import { LEVELS } from '../src/game/levels.ts';
import { UNITS, UNIT_ORDER, FOOD_RATES, ECONOMY_COSTS, TECH_COSTS, TECH_TIMES, BASE_HP, STARTING_FOOD, MAX_POPULATION } from '../src/game/content.ts';
import { STRATEGIES, simulateStrategy } from './balance.mjs';

export const OUTPUT = 'analysis/balance-2026-10-23';
const runtimeConfig = structuredClone({units:UNITS,foodRates:FOOD_RATES,economyCosts:ECONOMY_COSTS,techCosts:TECH_COSTS,techTimes:TECH_TIMES,levels:LEVELS});
// Freeze the original comparison baseline when shipping the recommended values.
export const BASELINE = JSON.parse(readFileSync(new URL('../analysis/balance-2026-10-23/baseline-config.json',import.meta.url),'utf8'));
const round = (n, digits=2) => +n.toFixed(digits);
export function applyConfig(config={}) {
  for (const kind of UNIT_ORDER) Object.assign(UNITS[kind],BASELINE.units[kind],config.units?.[kind]);
  for (const [key,list] of [['foodRates',FOOD_RATES],['economyCosts',ECONOMY_COSTS],['techCosts',TECH_COSTS],['techTimes',TECH_TIMES]]) list.splice(0,list.length,...(config[key]??BASELINE[key]));
  for(let i=0;i<LEVELS.length;i++)Object.assign(LEVELS[i],structuredClone(BASELINE.levels[i]),config.levels?.[LEVELS[i].id]);
}
export function restoreRuntime() {
  applyConfig({...runtimeConfig,levels:Object.fromEntries(runtimeConfig.levels.map(level=>[level.id,level]))});
}
export const CANDIDATES = {
  baseline: {},
  economy: {economyCosts:[120,180,240]},
  gentle: {economyCosts:[120,180,240],units:{shield:{hp:650},slinger:{damage:46},mage:{hp:150,damage:28},healer:{heal:34},knight:{damage:150}}},
  moderate: {economyCosts:[120,180,240],units:{mouse:{hp:95,damage:14},shield:{hp:620},slinger:{damage:48},mage:{hp:150,damage:28},healer:{heal:30},knight:{damage:155},catapult:{damage:110}}},
  gentle_no_economy: {units:{shield:{hp:650},slinger:{damage:46},mage:{hp:150,damage:28},healer:{heal:34},knight:{damage:150}}},
  gentle_heal30: {economyCosts:[120,180,240],units:{shield:{hp:650},slinger:{damage:46},mage:{hp:150,damage:28},healer:{heal:30},knight:{damage:150}}},
  gentle_heal38: {economyCosts:[120,180,240],units:{shield:{hp:650},slinger:{damage:46},mage:{hp:150,damage:28},healer:{heal:38},knight:{damage:150}}},
  gentle_cheap_mage: {economyCosts:[120,180,240],units:{shield:{hp:650},slinger:{damage:46},mage:{hp:150,damage:28,cost:100},healer:{heal:34},knight:{damage:150}}},
  focused: {economyCosts:[120,180,240],units:{mage:{hp:150,damage:28},healer:{heal:36},knight:{damage:150}}},
  focused_no_heal: {economyCosts:[120,180,240],units:{mage:{hp:150,damage:28},knight:{damage:150}}},
  focused_no_knight: {economyCosts:[120,180,240],units:{mage:{hp:150,damage:28},healer:{heal:36}}},
  focused_mage_only: {economyCosts:[120,180,240],units:{mage:{hp:150,damage:28}}},
  economy240_only: {economyCosts:[120,220,240]},
  focused220: {economyCosts:[120,180,220],units:{mage:{hp:150,damage:28},healer:{heal:36},knight:{damage:150}}},
};
const firstPace={grace:6,openingInterval:3,investmentGuard:2,techAt:[34,95]};
const thirdPace={economyAt:[10,38,90],techAt:[22,65]};
CANDIDATES.paced_first={...CANDIDATES.focused_no_heal,levels:{sunroom:firstPace}};
CANDIDATES.paced_third={...CANDIDATES.focused_no_heal,levels:{pantry:thirdPace}};
CANDIDATES.paced={...CANDIDATES.focused_no_heal,levels:{sunroom:firstPace,pantry:thirdPace}};
CANDIDATES.paced_economy={...CANDIDATES.economy,levels:{sunroom:firstPace,pantry:thirdPace}};
CANDIDATES.paced_gentle={...CANDIDATES.gentle,levels:{sunroom:firstPace,pantry:thirdPace}};

export function unitMetrics() {
  return UNIT_ORDER.map(kind=>{
    const u=UNITS[kind];
    return {kind,name:u.name,cost:u.cost,population:u.population,tier:u.tier,hp:u.hp,damage:u.damage,interval:u.interval,dps:round(u.damage/u.interval),
      hpPer100Food:round(u.hp/u.cost*100),dpsPer100Food:round(u.damage/u.interval/u.cost*100),dpsPerPopulation:round(u.damage/u.interval/u.population),
      heal:u.heal??0,healPerSecondPerTarget:u.heal?round(u.heal/u.interval):0,maxHealPerSecond:u.heal?round(3*u.heal/u.interval):0,
      range:u.range,speed:u.speed,cooldown:u.cooldown,foodWaitAtStart:round(u.cost/FOOD_RATES[0]),foodWaitAtMax:round(u.cost/FOOD_RATES.at(-1))};
  });
}
export function economyMetrics() {
  return ECONOMY_COSTS.map((cost,i)=>({level:i+2,cost,from:FOOD_RATES[i],to:FOOD_RATES[i+1],gain:FOOD_RATES[i+1]-FOOD_RATES[i],payback:round(cost/(FOOD_RATES[i+1]-FOOD_RATES[i])),
    net60:60*(FOOD_RATES[i+1]-FOOD_RATES[i])-cost,net120:120*(FOOD_RATES[i+1]-FOOD_RATES[i])-cost,net180:180*(FOOD_RATES[i+1]-FOOD_RATES[i])-cost}));
}

// Separate from the production AI: fixed, documented player policies with timing
// variants. These scenarios measure robustness, not human win probabilities.
export const POLICIES = ['balanced','ranged','siege','knights','control','two-tier','soldiers','mice'];
const TARGETS = {
  balanced:[['shield',1],['mage',1],['knight',1],['slinger',3],['healer',1],['catapult',2]],
  ranged:[['shield',2],['slinger',5],['mage',1],['healer',1],['catapult',1]],
  siege:[['shield',2],['catapult',3],['healer',1],['mage',1],['slinger',2]],
  knights:[['shield',1],['knight',2],['healer',1],['mage',1],['slinger',2]],
  control:[['shield',2],['mage',4],['healer',1],['slinger',2],['catapult',1]],
  'two-tier':[['shield',2],['slinger',5],['mage',2]],
};
export function campaign(level, policy, variant=0, economyCap=3) {
  const battle=new Battle();battle.reset(level.id);battle.start();
  const simple=policy==='soldiers'||policy==='mice';
  const delay=[0,1.5,3,1,2][variant%5], cadence=[.5,.7,1,.6,.9][variant%5];
  const techAt=[15+variant*2,60+variant*3],ecoAt=[0,35+variant*3,85+variant*4];
  let nextDecision=delay, capSeconds=0,foodIntegral=0,peakFood=STARTING_FOOD,firstBaseHit=null;
  const bought=Object.fromEntries(UNIT_ORDER.map(k=>[k,0])), upgrades=[],samples=[];
  const hire=kind=>{if(battle.summon('player',kind)){bought[kind]++;return true;}return false;};
  for(let frame=0;frame<30*600 && battle.phase==='playing';frame++) {
    const army=battle.armies.player;
    if(battle.time+1e-8>=nextDecision) {
      nextDecision+=cadence;
      const allies=battle.units.filter(u=>u.side==='player'),foes=battle.units.filter(u=>u.side==='enemy');
      const count=kind=>allies.filter(u=>u.kind===kind).length;
      const threatened=foes.some(u=>u.x<435),emergency=threatened && (allies.length<2 || army.hp<BASE_HP*.4);
      if(threatened)battle.roar('player');
      if(allies.filter(u=>u.attacking && UNITS[u.kind].damage>0).length>=3)battle.catnip('player');
      if(simple)hire(policy==='soldiers'?'soldier':'mouse');
      else {
        let saving=false;
        if(!emergency && army.hp>BASE_HP*.5 && (allies.length>=2 || (army.economy===0 && battle.time<4))) {
          if(army.economy<economyCap && battle.time>=ecoAt[army.economy]) {
            if(battle.upgradeEconomy('player'))upgrades.push({type:'economy',level:army.economy+1,time:round(battle.time)});
            else saving=true;
          } else if(army.tech<(policy==='two-tier'?2:3) && !army.researching && battle.time>=techAt[army.tech-1]) {
            if(battle.researchTech('player'))upgrades.push({type:'tech',level:army.tech+1,time:round(battle.time)});
            else saving=true;
          }
        }
        if(!saving) {
          const desired=army.tech===1?'soldier':TARGETS[policy].find(([kind,limit])=>UNITS[kind].tier<=army.tech && count(kind)<limit)?.[0]??'soldier';
          if(!hire(desired) && emergency)hire('soldier');
        }
      }
    }
    battle.step(1/30);
    if(battle.population('player')>=MAX_POPULATION)capSeconds+=1/30;
    foodIntegral+=army.food/30;peakFood=Math.max(peakFood,army.food);
    if(firstBaseHit===null && army.hp<BASE_HP)firstBaseHit=round(battle.time);
    if(frame%300===0)samples.push({time:round(battle.time),food:round(army.food),population:battle.population('player'),hp:round(army.hp),enemyHp:round(battle.armies.enemy.hp),economy:army.economy,tech:army.tech});
  }
  const army=battle.armies.player;
  return {level:level.id,policy,variant,economyCap,winner:battle.winner??'unfinished',seconds:round(battle.time),playerHp:round(army.hp),enemyHp:round(battle.armies.enemy.hp),food:round(army.food),peakFood:round(peakFood),meanFood:round(foodIntegral/battle.time),populationCapSeconds:round(capSeconds),firstBaseHit,
    tech:army.tech,economy:army.economy+1,bought,upgrades,samples};
}

function spawnArena(battle,side,kinds,layout,swapRows) {
  const ordered=[...kinds].sort((a,b)=>UNITS[a].range-UNITS[b].range);
  for(let i=0;i<ordered.length;i++) {
    const kind=ordered[i],army=battle.armies[side];army.food=100000;army.tech=3;army.cooldowns[kind]=0;
    assert.ok(battle.summon(side,kind),`arena exceeds population: ${kind}`);
    const front=side==='player'?560:880,dir=side==='player'?1:-1;
    const support=UNITS[kind].range>60?Math.min(100,UNITS[kind].range*.3):0;
    const row=layout==='clustered'?1:(i+swapRows)%3;
    Object.assign(battle.units.at(-1),{x:front-dir*(Math.floor(i/3)*18+support),row,targetRow:row,attackCooldown:0});
  }
}
export function arena(a,b,layout='spread',swap=0,limit=150) {
  const battle=new Battle();battle.start();battle.aiEnabled=false;
  // Swap each formation to the other side without changing its lane phase.
  spawnArena(battle,'player',a,layout,swap?2:0);spawnArena(battle,'enemy',b,layout,swap?0:2);
  for(const side of ['player','enemy'])battle.armies[side].cannonCooldown=100000;
  for(let frame=0;frame<limit*30;frame++) {
    battle.step(1/30);
    if(!battle.units.some(u=>u.side==='player')||!battle.units.some(u=>u.side==='enemy'))break;
  }
  const stats=side=>{const live=battle.units.filter(u=>u.side===side);return {survivors:live.length,hp:round(live.reduce((n,u)=>n+u.hp,0)),survivingFoodFraction:round(live.reduce((n,u)=>n+UNITS[u.kind].cost*u.hp/UNITS[u.kind].hp,0))};};
  const player=stats('player'),enemy=stats('enemy');
  return {winner:player.survivors===0?enemy.survivors===0?'draw':'enemy':enemy.survivors===0?'player':'unfinished',seconds:round(battle.time),player,enemy};
}
function spend(budget,kind) {
  const kinds=[];let remaining=budget,pop=0;
  for(const choice of [kind,'soldier','mouse'])while(remaining>=UNITS[choice].cost && pop+UNITS[choice].population<=MAX_POPULATION) {
    kinds.push(choice);remaining-=UNITS[choice].cost;pop+=UNITS[choice].population;
  }
  return kinds;
}
export function arenaSuite() {
  const attackers=UNIT_ORDER.filter(k=>k!=='healer');
  const duels=[];
  for(let i=0;i<attackers.length;i++)for(let j=i+1;j<attackers.length;j++)duels.push({a:attackers[i],b:attackers[j],...arena([attackers[i]],[attackers[j]],'clustered')});
  const formations=Object.fromEntries(attackers.map(k=>[k,spend(600,k)]));
  formations.support=['shield','shield','slinger','slinger','healer','mage']; // 590 baseline food.
  const matches=[];
  const keys=Object.keys(formations);
  for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)for(const layout of ['spread','clustered'])for(const swap of [0,1]) {
    const a=keys[i],b=keys[j],left=swap?formations[b]:formations[a],right=swap?formations[a]:formations[b];
    const result=arena(left,right,layout,swap);
    matches.push({a,b,layout,swapped:!!swap,...result,winner:result.winner==='player'?(swap?b:a):result.winner==='enemy'?(swap?a:b):result.winner});
  }
  const cost=kinds=>kinds.reduce((n,k)=>n+UNITS[k].cost,0);
  return {duels,formations:Object.fromEntries(Object.entries(formations).map(([k,v])=>[k,{units:v,cost:cost(v),population:v.reduce((n,k)=>n+UNITS[k].population,0)}])),matches};
}
export function supportSuite() {
  const core=['shield','soldier','slinger','slinger'];
  const additions={soldiers:['soldier','soldier'],ranged:['slinger','mouse'],mage:['mage'],healer:['healer'],shield:['shield','mouse']};
  const opponents={soldiers:Array(8).fill('soldier'),mice:Array(16).fill('mouse'),knight:['knight'],ranged:['shield','shield','slinger','slinger','slinger'],siege:['catapult','catapult','soldier','soldier']};
  const matches=[];
  for(const [addition,extra] of Object.entries(additions))for(const [opponent,foes] of Object.entries(opponents))for(const layout of ['spread','clustered'])for(const swap of [0,1]) {
    const allies=[...core,...extra],a=swap?foes:allies,b=swap?allies:foes,result=arena(a,b,layout,swap);
    matches.push({addition,opponent,layout,swapped:!!swap,cost:allies.reduce((n,k)=>n+UNITS[k].cost,0),opponentCost:foes.reduce((n,k)=>n+UNITS[k].cost,0),...result,
      winner:result.winner==='player'?(swap?'opponent':'allies'):result.winner==='enemy'?(swap?'allies':'opponent'):result.winner});
  }
  return {core,additions,opponents,matches};
}
export function compact(rows) {
  const wins=rows.filter(r=>r.winner==='player'),times=wins.map(r=>r.seconds).sort((a,b)=>a-b);
  return {runs:rows.length,wins:wins.length,unfinished:rows.filter(r=>r.winner==='unfinished').length,fullHealthWins:wins.filter(r=>r.playerHp===BASE_HP).length,
    winsIn180to300:wins.filter(r=>r.seconds>=180 && r.seconds<=300).length,
    medianWinSeconds:times.length?round((times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2):null,
    maxSeconds:rows.length?Math.max(...rows.map(r=>r.seconds)):null};
}
export function save(name,value) {mkdirSync(OUTPUT,{recursive:true});writeFileSync(`${OUTPUT}/${name}.json`,JSON.stringify(value,null,2));}
function run() {
  const mode=process.argv[2]??'screen';
  try {
    if(mode==='screen') {
      const summaries=[];
      const selected=process.argv.slice(3);
      for(const [name,config] of Object.entries(CANDIDATES).filter(([name])=>!selected.length||selected.includes(name))) {
        applyConfig(config);
        const legacy=LEVELS.flatMap(level=>STRATEGIES.map(strategy=>simulateStrategy(level,strategy)));
        const campaigns=LEVELS.flatMap(level=>POLICIES.map(policy=>campaign(level,policy)));
        const report={name,config,units:unitMetrics(),economy:economyMetrics(),legacy,campaigns};save(name,report);
        const summary={name,legacy:compact(legacy),campaigns:compact(campaigns),mixed:compact(campaigns.filter(r=>!['mice','soldiers','two-tier'].includes(r.policy)))};
        summaries.push(summary);console.log(JSON.stringify(summary));
      }
      save('screen-summary',summaries);
    } else if(mode==='arena') {
      const names=process.argv.slice(3);for(const name of names.length?names:['baseline','gentle','moderate']) {
        assert.ok(CANDIDATES[name],`unknown config ${name}`);applyConfig(CANDIDATES[name]);
        const result=arenaSuite();save(`${name}-arena`,result);
        console.log(JSON.stringify({name,duels:result.duels.length,matches:result.matches.length,unfinished:result.matches.filter(r=>r.winner==='unfinished').length,
          wins:Object.keys(result.formations).map(k=>({kind:k,wins:result.matches.filter(r=>r.winner===k).length,runs:result.matches.filter(r=>r.a===k||r.b===k).length}))}));
      }
    } else if(mode==='support') {
      for(const name of process.argv.slice(3)) {
        assert.ok(CANDIDATES[name],`unknown config ${name}`);applyConfig(CANDIDATES[name]);
        const result=supportSuite();save(`${name}-support`,result);
        console.log(JSON.stringify({name,summary:Object.keys(result.additions).map(addition=>({addition,wins:result.matches.filter(r=>r.addition===addition&&r.winner==='allies').length,runs:result.matches.filter(r=>r.addition===addition).length}))}));
      }
    } else if(mode==='validate') {
      for(const name of process.argv.slice(3)) {
        assert.ok(CANDIDATES[name],`unknown config ${name}`);applyConfig(CANDIDATES[name]);
        const campaigns=LEVELS.flatMap(level=>POLICIES.flatMap(policy=>[0,1,2,3,4].map(v=>campaign(level,policy,v))));
        const economy=LEVELS.flatMap(level=>['balanced','ranged','siege'].flatMap(policy=>[0,1,2,3].map(cap=>campaign(level,policy,0,cap))));
        save(`${name}-validation`,{campaigns,economy});console.log(JSON.stringify({name,all:compact(campaigns),byLevel:LEVELS.map(l=>({level:l.id,...compact(campaigns.filter(r=>r.level===l.id))}))}));
      }
    } else throw new Error(`Unknown mode ${mode}`);
  } finally {restoreRuntime();assert.deepEqual(UNITS,runtimeConfig.units);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)run();
