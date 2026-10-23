import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import type { Side, UnitKind } from '../src/game/content.ts';
import { BASE_HP, BASE_X, ORANGE_BOSS, UNITS } from '../src/game/content.ts';
import { bossCharge, inBossSweep, sweepDirection } from '../src/game/boss-combat.ts';
import { LEVELS } from '../src/game/levels.ts';

function create(level='pantry') {
  const b=new Battle(); b.reset(level); b.start(); b.aiEnabled=false;
  b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;
  return b;
}
function advance(b:Battle,seconds:number) {
  for(let t=0;t<seconds-1e-8;t+=1/30) b.step(Math.min(1/30,seconds-t));
}
function spawn(b:Battle,side:Side,kind:UnitKind,x:number,row=1) {
  b.armies[side].food=10000; b.armies[side].tech=3; b.armies[side].cooldowns[kind]=0;
  assert.ok(b.summon(side,kind)); const u=b.units.at(-1)!;
  Object.assign(u,{x,row,targetRow:row,attackCooldown:100}); return u;
}
function encounter() {
  const b=create(); b.armies.enemy.hp=BASE_HP*.3-1; b.step(1/30);
  const boss=b.units.find(u=>u.kind==='boss')!;
  advance(b,ORANGE_BOSS.entrance+.001); Object.assign(boss,{x:700,row:1,attackCooldown:0});
  return {b,boss};
}

test('only final level below 30% spawns one boss, independent of food and population',()=>{
  for(const level of LEVELS) {
    const b=create(level.id); b.armies.enemy.hp=BASE_HP*.3; b.step(1/30);
    assert.equal(b.boss.spawned,false,'exactly 30% must not trigger');
    b.armies.enemy.hp-=.01; b.step(1/30);
    assert.equal(b.boss.spawned,level.id==='pantry');
  }
  const b=create(); for(let n=0;n<24;n++)spawn(b,'enemy','soldier',1000);
  b.armies.enemy.food=0; const {spent,hired}=b.armies.enemy;
  b.armies.enemy.hp=899; b.step(1/30);
  assert.equal(b.population('enemy'),24); assert.equal(b.armies.enemy.spent,spent); assert.equal(b.armies.enemy.hired,hired);
  assert.ok(b.armies.enemy.food<1); assert.equal(b.units.filter(u=>u.kind==='boss').length,1);
  for(const side of ['player','enemy'] as Side[])assert.equal(b.summon(side,'boss'),false);
  b.units.find(u=>u.kind==='boss')!.hp=0; advance(b,4);
  assert.equal(b.units.some(u=>u.kind==='boss'),false); assert.equal(b.armies.enemy.lost,0);
  b.reset('pantry'); assert.equal(b.boss.spawned,false); assert.equal(b.boss.unitId,null);
});

test('actual base damage triggers entry, but a destroyed base ends the game',()=>{
  for(const hp of [901,1]) {
    const b=create(), attacker=spawn(b,'player','soldier',BASE_X.enemy-20); attacker.attackCooldown=0;
    b.armies.enemy.hp=hp; b.step(1/30);
    assert.equal(b.boss.spawned,hp===901); assert.equal(b.phase,hp===901?'playing':'ended');
  }
});

test('entry is untargetable, pauses freeze it, then boss joins ordinary combat',()=>{
  const b=create(); b.armies.enemy.hp=899; b.step(1/30);
  const boss=b.units[0],attacker=spawn(b,'player','soldier',boss.x-20); attacker.attackCooldown=0;
  b.togglePause(); const state=JSON.stringify(b.units); advance(b,2); assert.equal(JSON.stringify(b.units),state);
  b.togglePause(); advance(b,1.1); assert.equal(boss.hp,UNITS.boss.hp); assert.equal(boss.sweep,undefined);
  advance(b,.2); assert.ok(boss.bossEntry===0);
  Object.assign(attacker,{x:boss.x-20,row:boss.row,attackCooldown:0}); b.step(1/30);
  assert.equal(boss.hp,UNITS.boss.hp-UNITS.soldier.damage); assert.ok(boss.sweep);
});

test('slow lift and full-size hold cause no early damage; sweep hits and pushes at release',()=>{
  const {b,boss}=encounter(), victim=spawn(b,'player','shield',680);
  b.step(1/30); assert.ok(boss.sweep);
  advance(b,.55); assert.ok(Math.abs(bossCharge(boss.sweep).lift-.5)<1e-8);
  advance(b,.55); assert.equal(bossCharge(boss.sweep).lift,1); assert.equal(bossCharge(boss.sweep).holding,true);
  advance(b,.29); assert.equal(victim.hp,UNITS.shield.hp); assert.equal(bossCharge(boss.sweep).lift,1);
  advance(b,.01);assert.equal(victim.hp,UNITS.shield.hp,'hold ends before the quick sweep');
  advance(b,.06);assert.equal(victim.hp,UNITS.shield.hp);assert.ok(Math.abs(bossCharge(boss.sweep).swipe-.5)<1e-8);
  const steps=victim.walkDistance; advance(b,.06);
  assert.equal(victim.hp,UNITS.shield.hp-180); assert.equal(victim.x,600);
  assert.equal(victim.walkDistance,steps); assert.equal(victim.attacking,false); assert.equal(boss.sweep,undefined);
  assert.equal(boss.attackAt,b.time); assert.equal(b.effects.filter(fx=>fx.type==='sweep').length,1);
  const hp=victim.hp; advance(b,1); assert.equal(victim.hp,hp,'no repeated hits during recovery');
});

test('a sweep hits the whole front row, excluding the rear, sides and depth beyond its boundary',()=>{
  const {b,boss}=encounter();
  boss.sweep={remaining:.01,forwardX:-1,forwardY:0};
  const targets=[[680,1],[680,-.2],[680,2.2],[664,1],[663.9,1],[701,1],[680,2.201]];
  const victims=targets.map(([x,row])=>spawn(b,'player','shield',x,row));
  b.step(.01);
  victims.forEach((u,i)=>{
    assert.equal(u.hp,UNITS.shield.hp-(i<4?180:0),`target ${i}`);
    if(i<4)assert.ok(u.x<targets[i][0]-79,'push follows the locked heading');
  });
  const angle=sweepDirection({x:700,row:1},{x:700,row:1.25}),sweep={remaining:0,...angle};
  assert.ok(inBossSweep(boss,sweep,{x:700,row:1.4}));
  assert.equal(inBossSweep(boss,sweep,{x:700,row:.9}),false);
});

test('windup locks heading; moving behind the boss dodges and rear allies are not hit',()=>{
  const {b,boss}=encounter(),victim=spawn(b,'player','shield',680);
  b.step(1/30); const heading={...boss.sweep!};
  victim.x=720; advance(b,.7);
  assert.equal(boss.sweep!.forwardX,heading.forwardX); assert.equal(boss.sweep!.forwardY,heading.forwardY);
  advance(b,.82); assert.equal(victim.hp,UNITS.shield.hp);assert.equal(boss.sweep,undefined);
});

test('pause freezes charging; star slow stretches both lift and hold; catnip applies at impact',()=>{
  const {b,boss}=encounter(),victim=spawn(b,'player','shield',680);
  boss.starSlow=3; b.step(1/30); b.togglePause();
  const state=JSON.stringify(b.units); advance(b,3); assert.equal(JSON.stringify(b.units),state);
  b.togglePause(); advance(b,1.4); assert.ok(bossCharge(boss.sweep).lift<1); assert.equal(victim.hp,700);
  advance(b,.2); assert.ok(bossCharge(boss.sweep).holding);
  assert.ok(b.catnip('enemy')); advance(b,.58); assert.equal(victim.hp,700-216);
  assert.equal(boss.sweep,undefined);
});

test('a newly entering boss does not inherit old catnip; killing it cancels the windup',()=>{
  const b=create();spawn(b,'enemy','shield',1000);b.catnip('enemy');
  b.armies.enemy.hp=899;b.step(1/30);
  assert.equal(b.units.find(u=>u.kind==='boss')!.catnip,0);
  const encounterState=encounter(),boss=encounterState.boss,battle=encounterState.b;
  const victim=spawn(battle,'player','shield',680);battle.step(1/30);boss.hp=0;
  advance(battle,2);assert.equal(victim.hp,700);assert.equal(battle.effects.some(fx=>fx.type==='sweep'),false);
  assert.equal(battle.boss.spawned,true);assert.equal(battle.units.some(u=>u.kind==='boss'),false);
});
