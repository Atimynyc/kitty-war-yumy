import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { validBattleSave } from '../src/game/battle-save.ts';
import { clone } from '../src/game/achievements.ts';
import { readProfile, serializeProfile, emptyProfile } from '../src/game/profile.ts';
import { createSaveCoordinator } from '../src/ui/save-coordinator.ts';
import type { UnitKind, Side } from '../src/game/content.ts';
import { battleReport } from '../src/game/battle-report.ts';

function advance(b: Battle, seconds: number) { for(let t=0;t<seconds-1e-8;t+=1/30)b.step(Math.min(1/30,seconds-t)); }
function spawn(b: Battle, side: Side, kind: UnitKind, x: number) {
  const a=b.armies[side]; a.food=10000; a.tech=3; a.cooldowns[kind]=0; assert.ok(b.summon(side,kind));
  const u=b.units.at(-1)!; Object.assign(u,{x,row:1,targetRow:1,attackCooldown:100}); return u;
}
test('a normal-resource checkpoint round-trips and the resumed AI, income and RNG stay exactly deterministic',()=>{
  const a=new Battle(8675309); a.reset('campaign-15'); a.start(); a.upgradeEconomy('player'); a.summon('player','soldier');
  advance(a,25); assert.equal(a.phase,'playing'); const save=JSON.parse(JSON.stringify(a.save())); assert.ok(validBattleSave(save));
  const b=new Battle(); assert.ok(b.restore(save)); assert.equal(b.phase,'paused'); assert.deepEqual(b.save(),a.save());
  advance(b,300); assert.deepEqual(b.save(),save,'offline time does not run'); b.togglePause();
  for(let i=0;i<4000&&a.phase==='playing';i++){a.step(1/30);b.step(1/30);}
  assert.equal(b.winner,a.winner); assert.deepEqual(b.save(),a.save());
  a.reset();b.reset();assert.deepEqual(b.save(),a.save(),'restart preserves the original seed too');
});
test('stealth, slow, guard, haste, charged attacks, airborne litter and queued spell notices survive a reload',()=>{
  const a=new Battle(3);a.start();a.aiEnabled=false; a.armies.player.cannonCooldown=a.armies.enemy.cannonCooldown=100;
  const cat=spawn(a,'player','assassin',600), foe=spawn(a,'enemy','soldier',616);
  const litter=spawn(a,'player','litter',480); litter.attackCooldown=0; foe.attackCooldown=0;
  a.step(.01);assert.ok(cat.stealthUntil!>a.time);assert.equal(a.projectiles.length,1);
  const boxer=spawn(a,'player','boxer',700);boxer.charge={remaining:.3,targetId:foe.id};
  cat.starSlow=1.7;cat.hasteUntil=a.time+2;cat.guardUntil=a.time+1;cat.weakenedUntil=a.time+3;
  a.catnip('player');a.armies.player.energy=50;a.catnip('player');
  a.armies.enemy.researching=true;a.armies.enemy.tech=2;a.armies.enemy.research=6;
  const b=new Battle();assert.ok(b.restore(a.save()));b.togglePause();
  for(let i=0;i<200;i++){a.step(1/30);b.step(1/30);assert.deepEqual(b.save(),a.save());}
});
test('boss entrance and a partially charged sweep resume without a second spawn or early damage',()=>{
  const a=new Battle();a.reset('campaign-30');a.start();a.aiEnabled=false;
  a.armies.enemy.hp=850; a.armies.player.cannonCooldown=a.armies.enemy.cannonCooldown=100;
  a.step(.01);assert.ok(a.boss.spawned);const b=new Battle();assert.ok(b.restore(a.save()));b.togglePause();
  advance(a,1.4);advance(b,1.4);assert.deepEqual(b.save(),a.save());
  const boss=a.units.find(u=>u.kind==='boss')!;const shield=spawn(a,'player','shield',boss.x-20);shield.attackCooldown=100;
  boss.attackCooldown=0;a.step(.01);assert.ok(boss.sweep);advance(a,.5);
  const c=new Battle();assert.ok(c.restore(a.save()));c.togglePause();advance(a,2);advance(c,2);
  assert.deepEqual(c.save(),a.save());assert.equal(c.units.filter(u=>u.kind==='boss').length,1);
});
test('affordability round-off survives a checkpoint while genuinely negative food is rejected',()=>{
  const b=new Battle();b.start();b.armies.enemy.food=-4.298783551348606e-12;
  const checkpoint=b.save(), restored=new Battle();assert.ok(restored.restore(checkpoint));assert.deepEqual(restored.save(),checkpoint);
  checkpoint.armies.enemy.food=-1;assert.equal(restored.restore(checkpoint),false);
});

test('invalid, incompatible and malformed nested checkpoints cannot partially mutate a live battle',()=>{
  const b=new Battle();b.start();b.summon('player','soldier');const original=b.save();
  for(const corrupt of [
    (s:any)=>{s.rules='future';},(s:any)=>{s.randomState=-1;},(s:any)=>{s.armies.player.tech=9;},
    (s:any)=>{s.units[0].hp=Infinity;},(s:any)=>{s.units[0].kind='foreign';},(s:any)=>{s.armies.enemy.cooldowns={};},
    (s:any)=>{s.units[0].sweep={};},(s:any)=>{s.ai=null;},(s:any)=>{s.stats.recruited=['soldier','soldier'];},
    (s:any)=>{s.units.push(clone(s.units[0]));},(s:any)=>{s.levelId='missing';},(s:any)=>{s.dialogue.nextAllowed={};},
    (s:any)=>{s.notices.items=[{id:1}];},(s:any)=>{s.armies.player.hp=0;},
  ]){const invalid=clone(original);corrupt(invalid);assert.equal(b.restore(invalid),false);assert.deepEqual(b.save(),original);}
});
test('version 2 and classic saves migrate to a single v5 profile, only provable chapter achievements are backfilled',()=>{
  const campaign=Object.fromEntries(Array.from({length:5},(_,i)=>[`campaign-0${i+1}`,{stars:3,bestTime:200,ratingVersion:2}]));
  const legacy={sunroom:{stars:2,bestTime:100}};
  const loaded=readProfile(JSON.stringify({version:2,campaign,legacy}),1234);
  assert.equal(loaded.writable,true);assert.equal(loaded.migrated,true);
  assert.deepEqual(Object.keys(loaded.profile.achievements.unlocked),['journey.sunroom']);
  assert.deepEqual(loaded.profile.achievements.unlocked['journey.sunroom'],{source:'migration',unlockedAt:1234});
  assert.equal(loaded.profile.achievements.stats.recruited.length,0);
  const serialized=serializeProfile(loaded.profile);assert.equal(JSON.parse(serialized).version,5);
  assert.deepEqual(readProfile(serialized).profile,loaded.profile);assert.deepEqual(JSON.parse(serialized).legacy,legacy);
  assert.equal(Object.keys(readProfile(JSON.stringify(legacy)).profile.achievements.unlocked).length,0);
});
test('unsupported profiles are read-only; bad rounds do not erase earned achievements or campaign records',()=>{
  for(const raw of ['{broken','null',JSON.stringify({version:6,campaign:{}}),JSON.stringify({version:3,achievements:{rulesVersion:2}})]) assert.equal(readProfile(raw).writable,false);
  const p=emptyProfile();p.progress['campaign-01']={stars:3,bestTime:200};p.achievements.unlocked['growth.first-feeder']={source:'play',unlockedAt:1};
  const data=JSON.parse(serializeProfile(p));data.run={battle:{rules:'old'},speed:1};
  const loaded=readProfile(JSON.stringify(data));assert.equal(loaded.profile.run,null);assert.ok(loaded.notice);
  assert.deepEqual(loaded.profile.progress,p.progress);assert.deepEqual(loaded.profile.achievements,p.achievements);
});
test('full profile checkpoints keep round statistics and accumulated progress at the same point',()=>{
  const p=emptyProfile(),b=new Battle();b.start();b.summon('player','soldier');advance(b,5);
  p.run={battle:b.save(),speed:2,awards:[]};p.achievements.stats.recruited=['soldier'];
  const loaded=readProfile(serializeProfile(p));assert.deepEqual(loaded.profile,p);assert.ok(loaded.profile.run);
});

test('recruitment detail counts successful hires by side, includes departed units, and resets per round',()=>{
  const b=new Battle();b.start();b.aiEnabled=false;
  spawn(b,'player','mouse',300);spawn(b,'player','soldier',300);spawn(b,'player','soldier',300);
  spawn(b,'enemy','soldier',1000);
  assert.equal(b.summon('player','soldier'),false,'cooldown rejects the hire');
  assert.deepEqual(b.armies.player.recruitCounts,{mouse:1,soldier:2});
  assert.deepEqual(b.armies.enemy.recruitCounts,{soldier:1});
  b.units.find(u=>u.side==='player'&&u.kind==='soldier')!.hp=0;b.step(.01);
  assert.equal(b.units.filter(u=>u.side==='player').length,2);
  assert.deepEqual(battleReport(b).recruits,[{kind:'soldier',count:2},{kind:'mouse',count:1}]);
  b.trackingEnabled=false;spawn(b,'player','mouse',300);
  assert.equal(b.armies.player.recruitCounts!.mouse,2,'recruitment counts are independent of achievement tracking');
  assert.equal(battleReport(b).totalRecruited,4);assert.equal(battleReport(b).unrecordedRecruits,0);
  b.reset();assert.deepEqual(battleReport(b).recruits,[]);assert.equal(battleReport(b).totalRecruited,0);
});

test('recruitment breakdown survives a profile reload and continues counting without duplication',()=>{
  const b=new Battle();b.start();spawn(b,'player','soldier',300);spawn(b,'player','soldier',300);
  const p=emptyProfile();p.run={battle:b.save(),speed:1,awards:[]};
  const loaded=readProfile(serializeProfile(p)),restored=new Battle();
  assert.ok(restored.restore(loaded.profile.run!.battle));restored.togglePause();spawn(restored,'player','mouse',300);
  assert.deepEqual(battleReport(restored).recruits,[{kind:'soldier',count:2},{kind:'mouse',count:1}]);
  assert.equal(battleReport(restored).totalRecruited,3);
  assert.deepEqual(b.armies.player.recruitCounts,{soldier:2},'saved maps do not alias live counters');
});

test('old checkpoints retain their total and explicitly leave missing recruitment detail unrecorded',()=>{
  const b=new Battle();b.start();spawn(b,'player','soldier',300);spawn(b,'player','mouse',300);
  const legacy=b.save();delete legacy.armies.player.recruitCounts;delete legacy.armies.enemy.recruitCounts;
  const restored=new Battle();assert.ok(restored.restore(legacy));
  assert.equal(battleReport(restored).unrecordedRecruits,2);assert.deepEqual(battleReport(restored).recruits,[]);
  restored.togglePause();spawn(restored,'player','soldier',300);
  assert.equal(battleReport(restored).totalRecruited,3);assert.equal(battleReport(restored).unrecordedRecruits,2);
  assert.deepEqual(battleReport(restored).recruits,[{kind:'soldier',count:1}]);
  const again=new Battle();assert.ok(again.restore(restored.save()));assert.deepEqual(battleReport(again),battleReport(restored));
});

test('malformed recruitment counters cannot replace the current checkpoint',()=>{
  const b=new Battle();b.start();b.summon('player','soldier');const original=b.save();
  for(const counts of [null,[],{soldier:-1},{soldier:1.5},{soldier:Infinity},{soldier:2},{boss:1},{foreign:1}]) {
    const invalid=clone(original);(invalid.armies.player as any).recruitCounts=counts;
    assert.equal(b.restore(invalid),false);assert.deepEqual(b.save(),original);
  }
});
test('save coordinator coalesces intermediate snapshots and reports only the latest write status',async()=>{
  const writes:string[]=[],states:string[]=[];let release!:()=>void;
  const coordinator=createSaveCoordinator({save:async value=>{writes.push(value);if(value==='one')await new Promise<void>(r=>{release=r;});return true;}},s=>states.push(s));
  const first=coordinator.save('one');coordinator.save('two');coordinator.save('three');release();await first;
  assert.deepEqual(writes,['one','three']);assert.equal(states.at(-1),'saved');assert.equal(coordinator.pending,false);
  await coordinator.save('three');assert.deepEqual(writes,['one','three']);
  const failure=createSaveCoordinator({save:async()=>false},s=>states.push(s));await failure.save('four');assert.equal(states.at(-1),'failed');
});
