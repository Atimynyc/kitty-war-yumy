import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { BASE_HP, BASE_X, UNITS } from '../src/game/content.ts';
import type { Side, UnitKind } from '../src/game/content.ts';

function create() { const battle = new Battle(); battle.aiEnabled = false; battle.start(); return battle; }
function advance(battle: Battle, seconds: number) { for (let frame = 0; frame < seconds * 30; frame++) battle.step(1 / 30); }
function spawn(battle: Battle, side: Side, kind: UnitKind, x: number) {
  battle.armies[side].food = 10000; battle.armies[side].tech = 3; battle.armies[side].cooldowns[kind] = 0;
  assert.equal(battle.summon(side, kind), true);
  const unit = battle.units.at(-1)!; unit.x = x; unit.attackCooldown = 0; return unit;
}

test('income, spending, cooldowns and population enforce the same constraints for both sides', () => {
  for (const side of ['player', 'enemy'] as Side[]) {
    const battle = create();
    assert.equal(battle.summon(side, 'shield'), false);
    assert.equal(battle.summon(side, 'soldier'), true);
    assert.equal(battle.armies[side].food, 60);
    assert.equal(battle.summon(side, 'soldier'), false);
    advance(battle, 3.1);
    assert.ok(Math.abs(battle.armies[side].food - 78.6) < .01);
    assert.equal(battle.summon(side, 'soldier'), true);
    assert.equal(battle.summon(side, 'mouse'), false);
    battle.units = [];
    for (let i = 0; i < 8; i++) spawn(battle, side, 'catapult', BASE_X[side]);
    assert.equal(battle.population(side), 24);
    assert.equal(battle.summon(side, 'mouse'), false);
    battle.units[0].hp = 0; battle.step(1 / 30);
    assert.equal(battle.population(side), 21);
    assert.equal(battle.summon(side, 'mouse'), true);
  }
});

test('investment changes income; technology completes while allowing recruitment', () => {
  const battle = create();
  assert.equal(battle.upgradeEconomy('player'), true);
  assert.equal(battle.armies.player.food, 0);
  advance(battle, 20);
  assert.ok(Math.abs(battle.armies.player.food - 180) < .001);
  battle.armies.player.food = 240;
  assert.equal(battle.researchTech('player'), true);
  assert.equal(battle.researchTech('player'), false);
  assert.equal(battle.summon('player', 'soldier'), true);
  advance(battle, 15);
  assert.equal(battle.armies.player.tech, 2);
  assert.equal(battle.armies.player.researching, false);
  assert.equal(battle.summon('player', 'shield'), true);
  assert.equal(battle.summon('player', 'catapult'), false);
});

test('pause freezes income, combat, research, cooldowns and game time; restart clears the match', () => {
  const battle = create();
  battle.armies.player.food = 500;
  battle.researchTech('player'); battle.summon('player', 'soldier'); battle.roar('player');
  advance(battle, 2); battle.togglePause();
  const snapshot = JSON.stringify({ armies: battle.armies, units: battle.units, time: battle.time });
  advance(battle, 10);
  assert.equal(JSON.stringify({ armies: battle.armies, units: battle.units, time: battle.time }), snapshot);
  assert.equal(battle.summon('player', 'mouse'), false);
  battle.togglePause(); advance(battle, 1);
  assert.ok(battle.time > 2);
  battle.reset();
  assert.equal(battle.phase, 'ready'); assert.equal(battle.time, 0); assert.equal(battle.units.length, 0);
  assert.equal(battle.armies.player.food, 120); assert.equal(battle.armies.player.hp, BASE_HP);
});

test('melee contact halts forward movement, limits contact positions and awards no kill income', () => {
  const battle = create();
  for (let i = 0; i < 5; i++) spawn(battle, 'player', 'soldier', 700);
  const target = spawn(battle, 'enemy', 'shield', 735); target.attackCooldown = 10;
  const foodBefore = battle.armies.player.food;
  battle.step(1 / 30);
  assert.equal(target.hp, UNITS.shield.hp - UNITS.soldier.damage * 3);
  assert.ok(battle.units.filter(u => u.side === 'player').every(u => u.x === 700));
  target.hp = 1;
  for (const unit of battle.units) if (unit.side === 'player') unit.attackCooldown = 0;
  battle.step(1 / 30);
  assert.equal(battle.units.some(u => u.id === target.id), false);
  assert.ok(Math.abs(battle.armies.player.food - foodBefore - .4) < .001);
});

test('catapult splash damages a cluster and has a minimum firing range', () => {
  const battle = create();
  const catapult = spawn(battle, 'player', 'catapult', 500);
  const first = spawn(battle, 'enemy', 'soldier', 740), second = spawn(battle, 'enemy', 'soldier', 780);
  battle.step(1 / 30);
  assert.equal(first.hp, UNITS.soldier.hp - UNITS.catapult.damage);
  assert.equal(second.hp, UNITS.soldier.hp - UNITS.catapult.damage);
  first.x = 530; second.x = 900; catapult.attackCooldown = 0;
  const hp = first.hp; battle.step(1 / 30);
  assert.equal(first.hp, hp);
});

test('healer restores at most three allies and never heals buildings or exceeds maximum health', () => {
  const battle = create();
  const healer = spawn(battle, 'player', 'healer', 500);
  const friends = Array.from({ length: 4 }, (_, i) => spawn(battle, 'player', 'soldier', 530 + i * 5));
  for (const unit of friends) unit.hp = 220;
  battle.armies.player.hp = 2000;
  battle.step(1 / 30);
  assert.equal(friends.filter(u => u.hp === UNITS.soldier.hp).length, 3);
  assert.equal(battle.armies.player.hp, 2000);
  assert.equal(healer.hp, UNITS.healer.hp);
});

test('roar only displaces nearby enemies, applies slow and observes its cooldown', () => {
  const battle = create();
  const near = spawn(battle, 'enemy', 'soldier', 300), far = spawn(battle, 'enemy', 'soldier', 900);
  const friend = spawn(battle, 'player', 'soldier', 250);
  const hp = near.hp;
  assert.equal(battle.roar('player'), true);
  assert.equal(near.x, 430); assert.equal(near.hp, hp); assert.equal(near.slow, 3);
  assert.equal(far.x, 900); assert.equal(friend.x, 250);
  assert.equal(battle.roar('player'), false);
});

test('attacking the base completes the match and completed matches stop advancing', () => {
  const battle = create();
  spawn(battle, 'player', 'catapult', 1000);
  battle.armies.enemy.hp = 100;
  battle.step(1 / 30);
  assert.equal(battle.phase, 'ended'); assert.equal(battle.winner, 'player'); assert.equal(battle.armies.enemy.hp, 0);
  const time = battle.time; advance(battle, 10); assert.equal(battle.time, time);
});

test('simultaneous fatal melee damage removes both soldiers without update-order advantage', () => {
  const battle = create();
  const a = spawn(battle, 'player', 'soldier', 700), b = spawn(battle, 'enemy', 'soldier', 735);
  a.hp = b.hp = 10;
  battle.step(1 / 30);
  assert.equal(battle.units.length, 0);
  assert.equal(battle.armies.player.lost, 1); assert.equal(battle.armies.enemy.lost, 1);
});

test('identical opposing soldiers approach and fight symmetrically regardless of insertion order', () => {
  for (const firstSide of ['player', 'enemy'] as Side[]) {
    const battle = create();
    const secondSide: Side = firstSide === 'player' ? 'enemy' : 'player';
    const first = spawn(battle, firstSide, 'soldier', firstSide === 'player' ? 500 : 940);
    const second = spawn(battle, secondSide, 'soldier', secondSide === 'player' ? 500 : 940);
    for (let frame = 0; frame < 450 && battle.units.length; frame++) {
      battle.step(1 / 30);
      assert.equal(first.hp, second.hp);
      assert.ok(Math.abs(first.x + second.x - 1440) < .001);
    }
    assert.equal(battle.units.length, 0);
  }
});

test('computer can finish a full match and stays within its resource and population limits', () => {
  const battle = new Battle(); battle.start();
  for (let frame = 0; frame < 30 * 480 && battle.phase === 'playing'; frame++) {
    battle.step(1 / 30);
    assert.ok(battle.armies.enemy.food >= 0);
    assert.ok(battle.population('enemy') <= 24);
  }
  assert.equal(battle.phase, 'ended'); assert.equal(battle.winner, 'enemy');
  assert.ok(battle.time > 30 && battle.time < 480);
});
