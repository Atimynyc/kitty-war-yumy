import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { ACHIEVEMENTS, TITLES, emptyAchievements, emptyRunStats, absorbRun, awardVictory, unlockAchievements, clone } from '../src/game/achievements.ts';
import { BASE_X } from '../src/game/content.ts';
import type { UnitKind, Side } from '../src/game/content.ts';
import { runPolicy } from '../scripts/global-balance.mjs';
import * as content from '../src/game/content.ts';
import { LEVELS } from '../src/game/levels.ts';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function advance(b: Battle, seconds:number){for(let t=0;t<seconds-1e-8;t+=1/30)b.step(Math.min(1/30,seconds-t));}
function create(){const b=new Battle(1234);b.start();b.aiEnabled=false;b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=10000;return b;}
function spawn(b:Battle,side:Side,kind:UnitKind,x:number){const a=b.armies[side];a.tech=3;a.food=10000;a.cooldowns[kind]=0;assert.ok(b.summon(side,kind));const u=b.units.at(-1)!;Object.assign(u,{x,row:1,targetRow:1,attackCooldown:10000});return u;}

test('24 unique achievements cover six journeys and eight specialists, and title milestones cannot depend on themselves',()=>{
  assert.equal(ACHIEVEMENTS.length,24);assert.equal(new Set(ACHIEVEMENTS.map(a=>a.id)).size,24);
  assert.equal(ACHIEVEMENTS.filter(a=>a.unit).length,8);assert.deepEqual(TITLES.map(t=>t.count),[6,12,18,24]);
});
test('failed summons, enemy recruitment and research start do not grant player milestones',()=>{
  const b=create();b.armies.player.food=0;assert.equal(b.summon('player','soldier'),false);assert.equal(b.stats.recruited.length,0);
  b.summon('enemy','soldier');assert.equal(b.stats.recruited.length,0);
  b.armies.player.food=400;b.researchTech('player');assert.equal(b.stats.maxTech,1);advance(b,8.1);assert.equal(b.stats.maxTech,2);
  b.upgradeEconomy('player');assert.equal(b.stats.maxEconomy,2);
});
test('gunner only receives real enemy-unit damage, not overkill, same-frame duplicate damage or cannon damage',()=>{
  const b=create(),gun=spawn(b,'player','gunner',600),other=spawn(b,'player','gunner',601),foe=spawn(b,'enemy','soldier',800);
  foe.hp=10;gun.attackCooldown=other.attackCooldown=0;b.step(.01);near(b.stats.gunnerDamage,10);
  b.units=b.units.filter(u=>u.side==='player');gun.x=BASE_X.enemy-100;other.x=gun.x;gun.attackCooldown=0;b.step(.01);
  near(b.stats.gunnerDamage,10);assert.ok(b.armies.enemy.hp<3000);
  const cannon=create();const enemy=spawn(cannon,'enemy','soldier',200);enemy.hp=10;cannon.armies.player.cannonCooldown=0;cannon.step(.01);near(cannon.stats.gunnerDamage,0);
});
test('a single litter landing counts distinct surviving weakened enemies, never victims of another bomb or dead enemies',()=>{
  const run=(lethal:boolean)=>{const b=create(),cat=spawn(b,'player','litter',600);for(let i=0;i<3;i++){const u=spawn(b,'enemy','shield',810+i*5);if(lethal&&i===0)u.hp=20;}cat.attackCooldown=0;b.step(.01);assert.equal(b.stats.litterMax,0);advance(b,.41);return b;};
  assert.equal(run(false).stats.litterMax,3);assert.equal(run(true).stats.litterMax,2);
});
test('umbrella counts effective blood saved, avoiding overkill padding and counting actual protection as participation',()=>{
  const b=create();spawn(b,'player','umbrella',600);const ally=spawn(b,'player','soldier',640),enemy=spawn(b,'enemy','slinger',800);
  enemy.attackCooldown=0;b.step(.01);near(b.stats.prevented,18.9);assert.ok(b.stats.participated.includes('umbrella'));
  ally.hp=10;enemy.attackCooldown=0;b.step(.01);near(b.stats.prevented,18.9,'lethal overkill saves no HP');
});
test('dodge totals count actual resolved dodges and the observer consumes no random numbers',()=>{
  const a=create(),cat=spawn(a,'player','kungfu',600),foe=spawn(a,'enemy','soldier',616);
  const b=new Battle();assert.ok(b.restore(a.save()));b.togglePause();b.trackingEnabled=false;
  let dodges=0;
  for(let i=0;i<50;i++){
    cat.hp=350;b.units.find(u=>u.kind==='kungfu')!.hp=350;foe.attackCooldown=0;b.units.find(u=>u.side==='enemy')!.attackCooldown=0;
    const hp=cat.hp;a.step(.01);b.step(.01);if(cat.hp===hp)dodges++;
    assert.deepEqual(a.units,b.units);assert.deepEqual(a.armies,b.armies);
  }
  assert.equal(a.stats.dodges,dodges);assert.equal(b.stats.dodges,0);assert.ok(dodges>0);
});
test('assassin must truly use stealth and then damage the base; invisibility alone never completes it',()=>{
  const b=create(),cat=spawn(b,'player','assassin',600),foe=spawn(b,'enemy','soldier',616);foe.attackCooldown=0;b.step(.01);
  assert.equal(b.stats.assassinBase,false);assert.ok(cat.stealthUsed);cat.x=BASE_X.enemy-24;cat.attackCooldown=0;
  advance(b,.3);assert.equal(b.stats.assassinBase,true);
  const unhidden=create(),fresh=spawn(unhidden,'player','assassin',BASE_X.enemy-16);fresh.attackCooldown=0;unhidden.step(.01);assert.equal(unhidden.stats.assassinBase,false);
});
test('drummer requires actual damage under active haste; a healed ally and healer also count as real participants',()=>{
  const b=create();spawn(b,'player','drummer',600);const gun=spawn(b,'player','gunner',630),target=spawn(b,'enemy','shield',700);
  b.step(.01);assert.equal(b.stats.drummed.length,0);gun.attackCooldown=0;b.step(.01);assert.deepEqual(b.stats.drummed,['gunner']);
  assert.ok(b.stats.participated.includes('drummer'));assert.ok(target.hp<700);
  const healer=spawn(b,'player','healer',630);gun.hp=100;healer.attackCooldown=0;b.step(.01);assert.ok(b.stats.participated.includes('healer'));
  const sameStep=create();spawn(sameStep,'player','drummer',650);const shooter=spawn(sameStep,'player','gunner',630);spawn(sameStep,'enemy','shield',700);
  shooter.attackCooldown=0;sameStep.step(.01);assert.deepEqual(sameStep.stats.drummed,['gunner'],'newly applied haste counts on the actual shot');
});
test('pull and punch count actual displacement once per victim, including after restoring its counted flags',()=>{
  const b=create(),hook=spawn(b,'player','hook',600),foe=spawn(b,'enemy','slinger',800);hook.attackCooldown=0;advance(b,.8);assert.equal(b.stats.hookTargets,1);
  const c=new Battle();assert.ok(c.restore(b.save()));c.togglePause();
  for(const match of [b,c]){const h=match.units.find(u=>u.kind==='hook')!,f=match.units.find(u=>u.side==='enemy')!;h.attackCooldown=0;f.x=h.x+190;advance(match,.8);assert.equal(match.stats.hookTargets,1);}
  const punch=create(),box=spawn(punch,'player','boxer',700);spawn(punch,'enemy','shield',716);box.attackCooldown=0;advance(punch,.7);assert.equal(punch.stats.boxerTargets,1);
});
test('base progress uses one regroup window and caps overkill; reaching it alone does not grant a victory achievement',()=>{
  const b=create();b.reset('campaign-06');b.start();b.aiEnabled=false;b.armies.enemy.cannonCooldown=10000;
  const cat=spawn(b,'player','gunner',BASE_X.enemy-100);b.time=80;cat.attackCooldown=0;b.step(.01);near(b.stats.regroupPeak,125);
  b.time=110;cat.attackCooldown=0;b.step(.01);near(b.stats.regroupPeak,125,'separate windows do not add');
  b.armies.enemy.hp=10;cat.attackCooldown=0;b.step(.01);near(b.stats.regroupPeak,135);
  const data=emptyAchievements();absorbRun(data,b.stats,emptyRunStats());unlockAchievements(data,{});assert.equal(data.unlocked['tactic.regroup-push'],undefined);
});
test('a real boss death differs from destroying the base while the boss is still alive',()=>{
  const run=(kill:boolean)=>{const b=create();b.reset('campaign-30');b.start();b.aiEnabled=false;b.armies.enemy.hp=850;b.step(.01);advance(b,1.3);const boss=b.units.find(u=>u.kind==='boss')!;
    if(kill){boss.hp=1;const gun=spawn(b,'player','gunner',boss.x-100);gun.attackCooldown=0;}else {b.armies.enemy.hp=1;const cat=spawn(b,'player','assassin',BASE_X.enemy-16);cat.stealthUsed=true;cat.attackCooldown=0;}
    b.step(.01);return b;};
  assert.equal(run(true).stats.bossDefeated,true);assert.equal(run(false).stats.bossDefeated,false);
});
test('accumulated counters, saved checkpoints and repeated unlock evaluation are idempotent across rounds',()=>{
  const data=emptyAchievements(),run=emptyRunStats();run.gunnerDamage=1500;run.recruited=['gunner'];absorbRun(data,run,emptyRunStats());
  const checkpoint=clone(run);run.gunnerDamage=2100;absorbRun(data,run,checkpoint);const applied=clone(run);absorbRun(data,run,applied);
  near(data.stats.gunnerDamage,2100);assert.deepEqual(unlockAchievements(data,{},'play',1),['specialist.gunner']);assert.deepEqual(unlockAchievements(data,{},'play',2),[]);
  const next=emptyRunStats();next.gunnerDamage=100;absorbRun(data,next,emptyRunStats());near(data.stats.gunnerDamage,2200);
});
test('victory-only awards require actual participation, completed research, investment and a genuine boss kill',()=>{
  const data=emptyAchievements(),run=emptyRunStats();run.maxTech=3;run.maxEconomy=8;run.regroupPeak=600;run.bossDefeated=true;
  run.recruited=['soldier','gunner','shield','litter','drummer'];absorbRun(data,run,emptyRunStats());unlockAchievements(data,{});
  assert.equal(data.unlocked['growth.fortress'],undefined);awardVictory(data,run,30);unlockAchievements(data,{});
  assert.ok(data.unlocked['growth.fortress']);assert.ok(data.unlocked['growth.food-factory']);assert.ok(data.unlocked['tactic.orange-boss']);assert.ok(data.unlocked['tactic.regroup-push']);assert.equal(data.unlocked['tactic.mixed-team'],undefined);
  run.participated=[...run.recruited];awardVictory(data,run,30);unlockAchievements(data,{});assert.ok(data.unlocked['tactic.mixed-team']);
});
test('achievement tracking never changes current-rule outcomes or resources across representative stages and specialists',()=>{
  class UntrackedBattle extends Battle { constructor(seed: number) { super(seed); this.trackingEnabled=false; } }
  for(const stage of [1,5,15,20,26,30])for(const policy of ['guns','infiltration','support']){
    const before=runPolicy(UntrackedBattle,content,LEVELS[stage-1],policy,8675309);
    const after=runPolicy(Battle,content,LEVELS[stage-1],policy,8675309);
    assert.deepEqual(after,before,`${stage}/${policy}`);
  }
});
