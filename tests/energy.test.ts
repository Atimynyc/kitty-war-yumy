import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { BASE_X, ENERGY, ENERGY_REWARDS, UNIT_ORDER, UNITS } from '../src/game/content.ts';
import type { Side, UnitKind } from '../src/game/content.ts';

function create(){const b=new Battle();b.start();b.aiEnabled=false;b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;return b;}
function spawn(b:Battle,side:Side,kind:UnitKind,x:number){
  b.armies[side].food=10000;b.armies[side].tech=3;b.armies[side].cooldowns[kind]=0;
  assert.ok(b.summon(side,kind));const u=b.units.at(-1)!;Object.assign(u,{x,row:1,targetRow:1,attackCooldown:100});return u;
}
function step(b:Battle,seconds:number){for(let t=0;t<seconds-1e-8;t+=1/30)b.step(Math.min(1/30,seconds-t));}

test('50 starting energy permits exactly one choice of skill for either army; time grants none',()=>{
  for(const side of ['player','enemy'] as Side[])for(const first of ['roar','catnip'] as const){
    const b=create(),foe=side==='player'?'enemy':'player';
    spawn(b,side,'soldier',700);spawn(b,foe,'shield',BASE_X[side]+(side==='player'?100:-100));
    assert.equal(b.armies[side].energy,50);assert.ok(b[first](side));
    assert.equal(b.armies[side].energy,0);assert.equal(b.armies[side].energySpent,50);
    assert.equal(b.roar(side),false);assert.equal(b.catnip(side),false);
    b.units=[];step(b,120);assert.equal(b.armies[side].energy,0);
    b.reset();assert.equal(b.armies[side].energy,50);assert.equal(b.armies[side].energyEarned,0);assert.equal(b.armies[side].energySpent,0);
  }
});

test('every ordinary troop returns its configured reward once to the opposing army',()=>{
  for(const side of ['player','enemy'] as Side[])for(const kind of UNIT_ORDER){
    const b=create(),foe=side==='player'?'enemy':'player',a=spawn(b,side,'soldier',700),v=spawn(b,foe,kind,716);
    b.armies[side].energy=0;a.attackCooldown=0;v.hp=1;b.step(1/30);
    assert.equal(b.armies[side].energy,ENERGY_REWARDS[kind],`${side} kills ${kind}`);
    assert.equal(b.armies[foe].energy,50);assert.equal(b.units.some(u=>u.id===v.id),false);
    step(b,1);assert.equal(b.armies[side].energy,ENERGY_REWARDS[kind]);
  }
});

test('multiple attackers and overkill pay only one reward; splash pays for each actual death',()=>{
  const b=create();const attackers=[spawn(b,'player','soldier',700),spawn(b,'player','soldier',700)];
  const v=spawn(b,'enemy','soldier',716);v.hp=1;attackers.forEach(u=>u.attackCooldown=0);
  b.armies.player.energy=0;b.step(1/30);assert.equal(b.armies.player.energy,ENERGY_REWARDS.soldier);
  const splash=create(),catapult=spawn(splash,'player','catapult',500);catapult.attackCooldown=0;
  for(const kind of ['mouse','soldier','shield'] as UnitKind[]){const u=spawn(splash,'enemy',kind,740);u.hp=1;}
  const survivor=spawn(splash,'enemy','shield',760);splash.armies.player.energy=0;splash.step(1/30);
  assert.equal(splash.armies.player.energy,ENERGY_REWARDS.mouse+ENERGY_REWARDS.soldier+ENERGY_REWARDS.shield);
  assert.ok(survivor.hp>0);assert.equal(splash.armies.player.energyGain,splash.armies.player.energy);
});

test('cannon and delayed stars credit kills; damage and healing alone give no energy',()=>{
  const b=create(),v=spawn(b,'enemy','soldier',BASE_X.player+100);v.hp=1;
  b.armies.player.energy=0;b.armies.player.cannonCooldown=0;b.step(1/30);assert.equal(b.armies.player.energy,ENERGY_REWARDS.soldier);
  const star=create(),mage=spawn(star,'player','mage',600),target=spawn(star,'enemy','shield',800);
  mage.attackCooldown=0;target.hp=1;star.armies.player.energy=0;star.step(1/30);
  assert.equal(star.armies.player.energy,0);step(star,.34);assert.equal(star.armies.player.energy,ENERGY_REWARDS.shield);
  const combat=create(),attacker=spawn(combat,'player','soldier',700),shield=spawn(combat,'enemy','shield',716);
  attacker.attackCooldown=0;combat.step(1/30);assert.ok(shield.hp<700);assert.equal(combat.armies.player.energy,50);
  const healer=spawn(combat,'enemy','healer',750);healer.attackCooldown=0;combat.step(1/30);assert.equal(combat.armies.enemy.energy,50);
});

test('simultaneous deaths reward both sides and energy caps at 100 without later overflow credit',()=>{
  const b=create(),a=spawn(b,'player','soldier',700),z=spawn(b,'enemy','soldier',716);
  a.hp=z.hp=1;a.attackCooldown=z.attackCooldown=0;b.step(1/30);
  assert.equal(b.armies.player.energy,50+ENERGY_REWARDS.soldier);assert.equal(b.armies.enemy.energy,b.armies.player.energy);
  const cap=create(),killer=spawn(cap,'player','soldier',700),knight=spawn(cap,'enemy','knight',716);
  cap.armies.player.energy=98;killer.attackCooldown=0;knight.hp=1;cap.step(1/30);
  assert.equal(cap.armies.player.energy,100);assert.equal(cap.armies.player.energyEarned,2);
  assert.equal(cap.armies.player.energyOverflow,ENERGY_REWARDS.knight-2);assert.equal(cap.armies.player.energyGain,2);
  assert.ok(cap.catnip('player'));step(cap,2);assert.equal(cap.armies.player.energy,50);
});

test('boss defeat returns a full skill; boss sweep kills reward the enemy with the same table',()=>{
  const b=create();b.reset('pantry');b.start();b.aiEnabled=false;
  b.armies.enemy.hp=899;b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;b.step(1/30);
  const boss=b.units.find(u=>u.kind==='boss')!;Object.assign(boss,{bossEntry:0,x:700,row:1});
  for(const kind of ['mouse','soldier'] as UnitKind[]){const u=spawn(b,'player',kind,680);u.hp=1;}
  b.armies.enemy.energy=0;boss.sweep={remaining:.001,forwardX:-1,forwardY:0};b.step(.01);
  assert.equal(b.armies.enemy.energy,ENERGY_REWARDS.mouse+ENERGY_REWARDS.soldier);
  const killer=spawn(b,'player','soldier',680);killer.attackCooldown=0;boss.hp=1;b.armies.player.energy=0;b.step(.01);
  assert.equal(b.armies.player.energy,50);assert.ok(b.catnip('player'));assert.equal(b.armies.player.energy,0);
});

test('empty, paused, ended, and unaffordable actions never spend or announce; removed bodies grant nothing',()=>{
  const b=create();assert.equal(b.roar('player'),false);assert.equal(b.catnip('player'),false);assert.equal(b.armies.player.energy,50);
  const a=spawn(b,'player','soldier',700);b.togglePause();assert.equal(b.catnip('player'),false);
  const snapshot=JSON.stringify(b.armies);step(b,10);assert.equal(JSON.stringify(b.armies),snapshot);
  b.togglePause();b.armies.player.energy=49;assert.equal(b.catnip('player'),false);assert.equal(b.armies.player.energy,49);
  b.armies.player.energy=50;b.phase='ended';assert.equal(b.catnip('player'),false);assert.deepEqual(b.spellNotices.visible(b.time),[]);
  b.phase='playing';a.hp=0;b.step(.01);assert.equal(b.armies.enemy.energy,50);
});

test('banked energy allows two skills without a timer; catnip refreshes without stacking',()=>{
  const b=create(),first=spawn(b,'player','soldier',700);b.armies.player.energy=ENERGY.max;
  assert.ok(b.catnip('player'));const later=spawn(b,'player','soldier',500);assert.equal(later.catnip,0);
  assert.ok(b.catnip('player'));assert.equal(first.catnip,10);assert.equal(later.catnip,10);
  assert.equal(b.armies.player.energy,0);assert.equal(b.armies.player.energySpent,100);assert.equal(b.catnip('player'),false);
  const victim=spawn(b,'enemy','shield',716);first.attackCooldown=0;b.step(.01);
  assert.ok(Math.abs(victim.hp-(UNITS.shield.hp-UNITS.soldier.damage*1.2))<1e-8);
});
