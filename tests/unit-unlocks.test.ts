import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { UNIT_ORDER, UNITS } from '../src/game/content.ts';
import { LEVELS } from '../src/game/levels.ts';
import { UNIT_UNLOCK_STAGE, unitsAtStage, arrivalsAtStage, unlockedUnits, reachedStage, unlockedTech, techUnlockStage } from '../src/game/unit-unlocks.ts';
import { emptyProfile, readProfile, serializeProfile } from '../src/game/profile.ts';
import { validBattleSave, readBattleSave, BATTLE_RULES_VERSION } from '../src/game/battle-save.ts';

test('research eligibility follows the first permanent partner of each tier',()=>{
  assert.equal(techUnlockStage(2),3);assert.equal(techUnlockStage(3),11);
  for(let stage=1;stage<=30;stage++){
    const b=new Battle();b.reset(LEVELS[stage-1].id,unitsAtStage(stage));b.start();b.aiEnabled=false;
    const cap=stage<3?1:stage<11?2:3;assert.equal(unlockedTech(b.playerRoster),cap);
    for(const tech of [1,2]){
      Object.assign(b.armies.player,{tech,food:1000,researching:false,research:0});
      const before=structuredClone(b.armies.player),stats=structuredClone(b.stats);
      assert.equal(b.researchTech('player'),tech<cap,`stage ${stage}, tier ${tech+1}`);
      if(tech>=cap){assert.deepEqual(b.armies.player,before);assert.deepEqual(b.stats,stats);assert.match(b.researchReason('player'),/第 .* 关解锁/);}
      else {assert.ok(b.armies.player.food<before.food);assert.ok(b.armies.player.researching);}
    }
  }
});
test('replays and inherited partners keep research eligibility; enemy eligibility remains independent',()=>{
  for(const roster of [unlockedUnits(progressTo(11)),unlockedUnits({},['gunner'])]){
    const b=new Battle();b.reset('campaign-01',roster);b.start();b.aiEnabled=false;b.armies.player.food=1000;
    assert.equal(b.researchTech('player'),true);for(let i=0;i<241;i++)b.step(1/30);
    assert.equal(b.armies.player.tech,2);assert.equal(b.researchTech('player'),true);
    for(let i=0;i<361;i++)b.step(1/30);assert.equal(b.armies.player.tech,3);
  }
  const b=new Battle();b.reset('campaign-01',unitsAtStage(1));b.start();assert.equal(b.researchTech('enemy'),true);
});
test('0.20 checkpoints retain completed and paid research without unlocking extra partners',()=>{
  for(const tech of [1,2,3])for(const researching of tech===3?[false]:[false,true]){
    const b=new Battle();b.reset('campaign-01',unitsAtStage(1));b.start();b.aiEnabled=false;
    Object.assign(b.armies.player,{tech,researching,research:researching?2:0,food:100});
    const raw=b.save();raw.rules='0.20.0';
    const migrated=readBattleSave(raw)!;assert.ok(migrated);assert.equal(migrated.rules,BATTLE_RULES_VERSION);
    assert.deepEqual(migrated,{...raw,rules:BATTLE_RULES_VERSION});
    const p=emptyProfile();p.run={battle:raw,speed:1,awards:[]};
    const loaded=readProfile(serializeProfile(p));assert.ok(loaded.migrated);assert.deepEqual(loaded.profile.run!.battle,migrated);
    const restored=new Battle();assert.ok(restored.restore(raw));restored.togglePause();
    for(let i=0;i<61;i++)restored.step(1/30);
    assert.equal(restored.armies.player.tech,tech+(researching?1:0));assert.equal(restored.armies.player.researching,false);
    const food=restored.armies.player.food;assert.equal(restored.researchTech('player'),false);assert.equal(restored.armies.player.food,food);
    const invalid={...raw,playerRoster:['mouse']};assert.equal(readBattleSave(invalid),null);
  }
});

const progressTo=(stage:number)=>Object.fromEntries(LEVELS.slice(0,stage-1).map(l=>[l.id,{stars:1,bestTime:240}]));
test('all sixteen partners unlock before their first encounter, with chapter finales reserved for practice',()=>{
  assert.deepEqual(Object.keys(UNIT_UNLOCK_STAGE).sort(),[...UNIT_ORDER].sort());
  for(const [stage,count] of [[1,2],[5,4],[10,7],[15,10],[20,13],[24,16]]) assert.equal(unitsAtStage(stage).length,count);
  for(const stage of [5,10,15,20,25,30]) assert.equal(arrivalsAtStage(stage).length,0);
  for(const [kind,stage] of Object.entries(UNIT_UNLOCK_STAGE)) {
    assert.ok(unlockedUnits(progressTo(stage)).includes(kind as any));
    if(stage>1)assert.ok(!unlockedUnits(progressTo(stage-1)).includes(kind as any));
  }
  assert.equal(UNIT_UNLOCK_STAGE.umbrella,8);assert.equal(UNIT_UNLOCK_STAGE.hook,13);
  assert.equal(UNIT_UNLOCK_STAGE.gunner,18);assert.equal(UNIT_UNLOCK_STAGE.boxer,22);
});
test('only contiguous victories grant progress; replaying lower stages retains permanent and inherited partners',()=>{
  const isolated={'campaign-23':{stars:3,bestTime:100}};
  assert.equal(reachedStage(isolated),1);assert.deepEqual(unlockedUnits(isolated),['mouse','soldier']);
  const roster=unlockedUnits(progressTo(18),['knight','boss']);
  assert.ok(roster.includes('gunner'));assert.ok(roster.includes('knight'));assert.ok(!roster.includes('boss'));
  const b=new Battle();b.reset('campaign-01',roster);b.start();b.armies.player.tech=3;b.armies.player.food=1000;
  assert.ok(b.summon('player','gunner'));assert.equal(b.summon('player','assassin'),false);
});
test('the simulation enforces both gates and locked attempts never charge resources, population or achievements',()=>{
  for(const kind of UNIT_ORDER){
    const b=new Battle();b.reset('campaign-08',unitsAtStage(8));b.start();b.aiEnabled=false;
    b.armies.player.tech=3;b.armies.player.food=1000;
    if(!unitsAtStage(8).includes(kind)){
      const before=b.save();assert.equal(b.summon('player',kind),false);assert.deepEqual(b.save(),before);
      assert.match(b.summonReason('player',kind),/到达第/);
    }else{assert.equal(b.summon('player',kind),true);assert.equal(b.armies.player.food,1000-UNITS[kind].cost);}
  }
  const b=new Battle();b.reset('campaign-08',unitsAtStage(8));b.start();
  assert.match(b.summonReason('player','umbrella'),/二阶/);b.armies.player.tech=2;
  assert.ok(b.summon('player','umbrella'));
  b.armies.enemy.tech=3;b.armies.enemy.food=1000;assert.ok(b.summon('enemy','knight'),'enemy keeps its own rules');
});
test('new checkpoints preserve the round roster and reject missing or invalid roster fields',()=>{
  const a=new Battle();a.reset('campaign-08',unitsAtStage(8));a.start();a.summon('player','soldier');
  const b=new Battle();assert.ok(b.restore(a.save()));assert.equal(b.phase,'paused');assert.deepEqual(b.save(),a.save());
  b.togglePause();b.armies.player.tech=3;b.armies.player.food=1000;assert.equal(b.summon('player','gunner'),false);
  for(const roster of [undefined,['boss'],['mouse','soldier','soldier'],['mouse'],['mouse','soldier','foreign']]){
    const bad:any=a.save();bad.playerRoster=roster;assert.equal(validBattleSave(bad),false);
  }
});
test('a 0.19 suspended round keeps all previous choices while only previously used partners become inherited unlocks',()=>{
  const b=new Battle();b.start();b.armies.player.tech=3;b.armies.player.food=1000;b.summon('player','gunner');b.bombard('player');
  const old:any=b.save();old.rules='0.19.0';delete old.playerRoster;delete old.legacyRoster;
  const loaded=readProfile(JSON.stringify({version:3,campaign:{},achievements:{stats:{recruited:['healer']}},run:{battle:old,speed:2,awards:[]}}));
  assert.equal(loaded.profile.version,5);assert.ok(loaded.migrated);assert.ok(loaded.profile.run);
  assert.deepEqual(loaded.profile.run!.battle.playerRoster,UNIT_ORDER);assert.equal(loaded.profile.run!.battle.legacyRoster,true);
  const permanent=unlockedUnits(loaded.profile.progress,loaded.profile.legacyRecruits);
  assert.ok(permanent.includes('gunner'));assert.ok(permanent.includes('healer'));assert.ok(!permanent.includes('knight'));
  assert.deepEqual(readProfile(serializeProfile(loaded.profile)).profile,loaded.profile);
  const resumed=new Battle();assert.ok(resumed.restore(loaded.profile.run!.battle));resumed.togglePause();
  resumed.armies.player.food=1000;assert.ok(resumed.summon('player','knight'));
  resumed.reset('campaign-01',permanent);resumed.start();resumed.armies.player.tech=3;resumed.armies.player.food=1000;
  assert.equal(resumed.summon('player','knight'),false);assert.equal(resumed.legacyRoster,false);
});
test('new profiles start with two partners and future profile versions remain protected',()=>{
  const p=emptyProfile();assert.deepEqual(p.legacyRecruits,[]);assert.deepEqual(unlockedUnits(p.progress),['mouse','soldier']);
  assert.deepEqual(readProfile(serializeProfile(p)).profile,p);
  assert.equal(readProfile(JSON.stringify({version:6})).writable,false);
});
