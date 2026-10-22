import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { BASE_HP, BASE_X, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, STARTING_FOOD, UNITS } from '../src/game/content.ts';
import { LEVELS, readProgress } from '../src/game/levels.ts';
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
    assert.equal(battle.armies[side].food, 190);
    assert.equal(battle.summon(side, 'soldier'), false);
    advance(battle, 1.3);
    assert.ok(Math.abs(battle.armies[side].food - 205.6) < .01);
    assert.equal(battle.summon(side, 'soldier'), true);
    battle.armies[side].food = 24;
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
  assert.equal(battle.armies.player.food, 120);
  advance(battle, 20);
  assert.ok(Math.abs(battle.armies.player.food - 480) < .001);
  battle.armies.player.food = 240;
  assert.equal(battle.researchTech('player'), true);
  assert.equal(battle.researchTech('player'), false);
  assert.equal(battle.summon('player', 'soldier'), true);
  advance(battle, 8);
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
  assert.equal(battle.armies.player.food, STARTING_FOOD); assert.equal(battle.armies.player.hp, BASE_HP);
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
  assert.ok(Math.abs(battle.armies.player.food - foodBefore - .8) < .001);
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

test('opening supports an economy upgrade plus two soldiers and a short refill', () => {
  const battle = new Battle(); battle.start();
  assert.equal(battle.upgradeEconomy('player'), true);
  assert.equal(battle.summon('player', 'soldier'), true);
  advance(battle, 1.3);
  assert.equal(battle.summon('player', 'soldier'), true);
  assert.equal(battle.armies.enemy.hired, 0);
  battle.armies.player.food = 0;
  advance(battle, 3);
  assert.equal(battle.summon('player', 'soldier'), true);
  assert.equal(battle.armies.player.hp, BASE_HP);
});

test('cannon targets the closest enemy in range, never allies, and observes its cooldown', () => {
  const battle = create();
  const nearest = spawn(battle, 'enemy', 'shield', BASE_X.player + 100);
  const farther = spawn(battle, 'enemy', 'shield', BASE_X.player + 210);
  const friend = spawn(battle, 'player', 'soldier', BASE_X.player + 10);
  battle.armies.player.tech = 1;
  battle.step(1 / 30);
  assert.equal(nearest.hp, UNITS.shield.hp - 32);
  assert.equal(farther.hp, UNITS.shield.hp);
  assert.equal(friend.hp, UNITS.soldier.hp);
  assert.equal(battle.armies.player.cannonShots, 1);
  advance(battle, 1);
  assert.equal(battle.armies.player.cannonShots, 1);
  battle.togglePause(); const cooldown = battle.armies.player.cannonCooldown;
  advance(battle, 10); assert.equal(battle.armies.player.cannonCooldown, cooldown);
  battle.reset(); assert.equal(battle.armies.player.cannonCooldown, 0);
  assert.equal(battle.armies.player.cannonShots, 0);
});

test('cannon stays ready out of range and gains damage only after research completes', () => {
  const battle = create();
  const target = spawn(battle, 'enemy', 'shield', BASE_X.player + CANNON_RANGE + 2);
  battle.step(1 / 30);
  assert.equal(battle.armies.player.cannonShots, 0);
  battle.armies.player.food = 1000;
  battle.researchTech('player');
  advance(battle, 7);
  assert.equal(battle.armies.player.tech, 1);
  advance(battle, 1);
  assert.equal(battle.armies.player.tech, 2);
  target.hp = UNITS.shield.hp; target.x = BASE_X.player + 100;
  battle.armies.player.cannonCooldown = 0;
  battle.step(1 / 30);
  assert.equal(target.hp, UNITS.shield.hp - 55);
  battle.armies.player.tech = 3; battle.armies.player.cannonCooldown = 0;
  battle.step(1 / 30);
  assert.equal(target.hp, UNITS.shield.hp - 55 - 85);
  assert.equal(battle.armies.player.cannonCooldown, CANNON_INTERVAL);
});

test('both cannons resolve fatal hits simultaneously with identical rules', () => {
  const battle = create();
  const a = spawn(battle, 'player', 'soldier', BASE_X.enemy - 100);
  const b = spawn(battle, 'enemy', 'soldier', BASE_X.player + 100);
  a.hp = b.hp = CANNON_DAMAGE[2];
  battle.step(1 / 30);
  assert.equal(battle.units.length, 0);
  assert.equal(battle.armies.player.cannonShots, 1);
  assert.equal(battle.armies.enemy.cannonShots, 1);
});

test('each level grants its preparation time and keeps recruiting for fifteen minutes', () => {
  for (const level of LEVELS) {
    const battle = new Battle(); battle.reset(level.id); battle.start();
    advance(battle, level.grace - 1);
    assert.equal(battle.armies.enemy.hired, 0, level.id);
    advance(battle, 2);
    assert.ok(battle.armies.enemy.hired > 0, level.id);
    // Remove spent waves periodically and protect the target so the test measures
    // sustained scheduling/resource limits beyond a normal match's end time.
    battle.armies.player.hp = 1e9;
    for (let minute = 0; minute < 15; minute++) {
      const hiredBefore = battle.armies.enemy.hired;
      battle.units = [];
      for (let tick = 0; tick < 60 * 30; tick++) {
        battle.step(1 / 30);
        assert.ok(battle.armies.enemy.food >= 0, level.id);
        assert.ok(battle.population('enemy') <= 24, level.id);
      }
      assert.ok(battle.armies.enemy.hired > hiredBefore, `${level.id}: no reinforcements in minute ${minute + 1}`);
    }
    // A full army must resume recruiting when population is released.
    battle.units = []; const before = battle.armies.enemy.hired;
    advance(battle, 15); assert.ok(battle.armies.enemy.hired > before);
  }
});

test('corrupt or foreign campaign saves are ignored without preventing play', () => {
  assert.deepEqual(readProgress('not json'), {});
  assert.deepEqual(readProgress('{"sunroom":{"stars":99,"bestTime":-1},"foreign":{"stars":3,"bestTime":20}}'), {});
  assert.deepEqual(readProgress('{"sunroom":{"stars":2,"bestTime":180}}'), { sunroom: { stars: 2, bestTime: 180 } });
});
