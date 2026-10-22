import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { BASE_HP, BASE_X, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, STARTING_FOOD, UNITS, STAR_MAGIC, CATNIP } from '../src/game/content.ts';
import { LEVELS, readProgress } from '../src/game/levels.ts';
import type { Side, UnitKind } from '../src/game/content.ts';
import { unitMotion, DEATH_DURATION } from '../src/game/unit-motion.ts';

function create() { const battle = new Battle(); battle.aiEnabled = false; battle.start(); return battle; }
function advance(battle: Battle, seconds: number) { for (let frame = 0; frame < seconds * 30; frame++) battle.step(1 / 30); }
function spawn(battle: Battle, side: Side, kind: UnitKind, x: number) {
  battle.armies[side].food = 10000; battle.armies[side].tech = 3; battle.armies[side].cooldowns[kind] = 0;
  assert.equal(battle.summon(side, kind), true);
  const unit = battle.units.at(-1)!; unit.x = x; unit.attackCooldown = 0; return unit;
}

test('dog knight requires tier three, a large food reserve and six free population, on either side', () => {
  for (const side of ['player', 'enemy'] as Side[]) {
    const b = create(), a = b.armies[side];
    a.food = 500; a.tech = 2;
    assert.equal(b.summon(side, 'knight'), false); assert.equal(a.food, 500);
    a.tech = 3; a.food = 499;
    assert.equal(b.summon(side, 'knight'), false); assert.equal(a.food, 499);
    a.food = 500; assert.equal(b.summon(side, 'knight'), true);
    assert.equal(a.food, 0); assert.equal(b.population(side), 6); assert.equal(a.cooldowns.knight, 12);
    a.food = 500; assert.equal(b.summon(side, 'knight'), false);
    b.units[0].x = BASE_X[side]; advance(b, 12.1);
    assert.equal(b.summon(side, 'knight'), true);
    spawn(b, side, 'knight', BASE_X[side]);
    const mouse = spawn(b, side, 'mouse', BASE_X[side]);
    a.cooldowns.knight = 0;
    assert.equal(b.population(side), 19); assert.equal(b.summon(side, 'knight'), false);
    mouse.hp = 0; b.step(1 / 30);
    assert.equal(b.summon(side, 'knight'), true); assert.equal(b.population(side), 24);
  }
});

test('knight delivers a heavy single-target melee strike, obeys cadence and receives catnip and slow', () => {
  const b = create(), knight = spawn(b, 'player', 'knight', 700);
  const target = spawn(b, 'enemy', 'shield', 735), neighbor = spawn(b, 'enemy', 'shield', 736);
  target.attackCooldown = neighbor.attackCooldown = 100;
  b.step(1 / 30);
  assert.equal(target.hp, UNITS.shield.hp - 140); assert.equal(neighbor.hp, UNITS.shield.hp);
  advance(b, 1.5); assert.equal(target.hp, UNITS.shield.hp - 140);
  advance(b, .15); assert.equal(target.hp, UNITS.shield.hp - 280);
  b.catnip('player'); knight.attackCooldown = 0;
  const hp = target.hp; b.step(1 / 30); assert.equal(hp - target.hp, 168);
  b.units = [knight]; knight.x = 500; knight.starSlow = 3; knight.attackCooldown = 10;
  b.step(.1); assert.ok(Math.abs(knight.x - 503.15) < 1e-8);
  assert.ok(Math.abs(knight.attackCooldown - 9.93) < 1e-8);
});

test('knight can be healed, takes ordinary damage and releases all six population on death', () => {
  const b = create(), knight = spawn(b, 'player', 'knight', 700);
  spawn(b, 'player', 'healer', 600); knight.hp = 1780;
  b.step(1 / 30); assert.equal(knight.hp, 1800);
  const foe = spawn(b, 'enemy', 'knight', 745); knight.attackCooldown = 100;
  b.step(1 / 30); assert.equal(knight.hp, 1660);
  knight.hp = 1; foe.attackCooldown = 0; b.step(1 / 30);
  assert.equal(b.population('player'), 2);
  assert.equal(b.units.some(u => u.id === knight.id), false);
  assert.ok(b.effects.some(fx => fx.type === 'death' && fx.kind === 'knight' && fx.unitId === knight.id));
});

test('star magic applies damage and refreshes a nonstacking slow only on impact, for either side', () => {
  for (const side of ['player', 'enemy'] as Side[]) {
    const b = create(), other = side === 'player' ? 'enemy' : 'player';
    const caster = spawn(b, side, 'mage', side === 'player' ? 600 : 800);
    const target = spawn(b, other, 'shield', side === 'player' ? 800 : 600);
    target.attackCooldown = 10;
    b.step(1 / 30);
    assert.equal(b.projectiles.length, 1); assert.equal(target.starSlow, 0); assert.equal(target.hp, UNITS.shield.hp);
    advance(b, 1 / 3);
    assert.equal(target.hp, UNITS.shield.hp - UNITS.mage.damage); assert.equal(target.starSlow, STAR_MAGIC.duration);
    assert.equal(b.projectiles.length, 0);
    advance(b, .5); caster.attackCooldown = 0;
    b.step(1 / 30); advance(b, 1 / 3);
    assert.equal(target.starSlow, 3);
    caster.attackCooldown = 100; target.attackCooldown = 100;
    advance(b, 3.1); assert.equal(target.starSlow, 0);
  }
});

test('star slow reduces movement and attack frequency by 30%, including partial expiry and roar overlap', () => {
  const b = create(), u = spawn(b, 'player', 'soldier', 500);
  u.starSlow = 3; u.attackCooldown = 10;
  b.step(.1);
  assert.ok(Math.abs(u.x - 503.36) < 1e-8); assert.ok(Math.abs(u.attackCooldown - 9.93) < 1e-8);
  u.starSlow = .05; const x = u.x, cd = u.attackCooldown; b.step(.1);
  assert.ok(Math.abs(u.x - x - 48 * .085) < 1e-8); assert.ok(Math.abs(cd - u.attackCooldown - .085) < 1e-8);
  u.slow = .05; u.starSlow = 3; const overlap = u.x; b.step(.1);
  assert.ok(Math.abs(u.x - overlap - 48 * (.05 * .45 + .05 * .7)) < 1e-8);
  assert.equal(u.slow, 0); assert.ok(u.starSlow > 2.8);
});

test('a slowed fighter completes one attack interval in interval / 0.7 seconds', () => {
  const b = create(), u = spawn(b, 'player', 'soldier', 700), target = spawn(b, 'enemy', 'shield', 735);
  target.attackCooldown = 100; u.starSlow = 3; u.attackCooldown = 1;
  advance(b, 1.4); assert.equal(target.hp, UNITS.shield.hp);
  advance(b, 1 / 30); assert.equal(target.hp, UNITS.shield.hp - UNITS.soldier.damage);
});

test('stars survive caster death, fizzle for dead targets, and can damage bases', () => {
  for (const dead of ['caster', 'target']) {
    const b = create(), mage = spawn(b, 'player', 'mage', 600), target = spawn(b, 'enemy', 'shield', 800);
    b.step(1 / 30);
    b.units = b.units.filter(u => u.id !== (dead === 'caster' ? mage.id : target.id));
    advance(b, .4);
    assert.equal(b.projectiles.length, 0);
    assert.equal(target.hp, UNITS.shield.hp - (dead === 'caster' ? UNITS.mage.damage : 0));
    assert.equal(b.armies.enemy.hp, BASE_HP);
  }
  const b = create(); spawn(b, 'player', 'mage', BASE_X.enemy - 200); b.catnip('player');
  b.step(1 / 30); assert.equal(b.armies.enemy.hp, BASE_HP); advance(b, .4);
  assert.ok(Math.abs(b.armies.enemy.hp - (BASE_HP - UNITS.mage.damage * 1.2)) < 1e-8);
});

test('catnip snapshots only the current living allied roster, expires after 10s and cools down for 45s', () => {
  const b = create(); assert.equal(b.catnip('player'), false); assert.equal(b.armies.player.catnipCooldown, 0);
  const first = spawn(b, 'player', 'soldier', 300), enemy = spawn(b, 'enemy', 'soldier', 1000);
  assert.equal(b.catnip('player'), true); assert.equal(first.catnip, CATNIP.duration); assert.equal(enemy.catnip, 0);
  const later = spawn(b, 'player', 'soldier', 300); assert.equal(later.catnip, 0);
  assert.equal(b.catnip('player'), false);
  // Park units away from combat while advancing spell timers.
  for (let i = 0; i < 450; i++) { first.x = later.x = 300; enemy.x = 1000; b.step(.1); if (i === 100) assert.equal(first.catnip, 0); }
  assert.ok(b.armies.player.catnipCooldown < 1e-8);
  b.step(.1); assert.equal(b.catnip('player'), true); assert.equal(later.catnip, 10);
});

test('catapult splash includes its radius boundary, excludes allies and scales every victim with catnip', () => {
  const b = create(); spawn(b, 'player', 'catapult', 500);
  const ally = spawn(b, 'player', 'shield', 700); ally.attackCooldown = 100;
  const targets = [740, 810, 811].map(x => spawn(b, 'enemy', 'shield', x));
  targets.forEach(u => u.attackCooldown = 100);
  b.catnip('player'); b.step(1 / 30);
  assert.equal(ally.hp, UNITS.shield.hp);
  assert.equal(targets[0].hp, UNITS.shield.hp - UNITS.catapult.damage * 1.2);
  assert.equal(targets[1].hp, targets[0].hp); assert.equal(targets[2].hp, UNITS.shield.hp);
});

test('catnip expires without changing base stats and never increases healing or cannon damage', () => {
  const b = create(), u = spawn(b, 'player', 'soldier', 700), target = spawn(b, 'enemy', 'shield', 735);
  target.attackCooldown = 100; b.catnip('player'); b.step(1 / 30);
  assert.ok(Math.abs(target.hp - (UNITS.shield.hp - UNITS.soldier.damage * 1.2)) < 1e-8);
  u.catnip = .02; u.attackCooldown = 0; const hp = target.hp; b.step(1 / 30);
  assert.equal(hp - target.hp, UNITS.soldier.damage); assert.equal(UNITS.soldier.damage, 28);
  const healing = create(); spawn(healing, 'player', 'healer', 600); const hurt = spawn(healing, 'player', 'shield', 650); hurt.hp = 100;
  healing.catnip('player'); healing.step(1 / 30); assert.equal(hurt.hp, 142);
  const cannon = create(); spawn(cannon, 'player', 'healer', 200); const foe = spawn(cannon, 'enemy', 'shield', 400);
  cannon.catnip('player'); cannon.step(1 / 30); assert.equal(foe.hp, UNITS.shield.hp - CANNON_DAMAGE[2]);
});

test('pause freezes projectiles and statuses, reset clears them and disallows spells while paused', () => {
  const b = create(); const mage = spawn(b, 'player', 'mage', 600); spawn(b, 'enemy', 'shield', 800);
  b.catnip('player'); mage.starSlow = 3; b.step(1 / 30); b.togglePause();
  const state = JSON.stringify([b.units, b.projectiles, b.armies]); advance(b, 5);
  assert.equal(JSON.stringify([b.units, b.projectiles, b.armies]), state); assert.equal(b.catnip('enemy'), false);
  b.reset(); assert.equal(b.projectiles.length, 0); assert.equal(b.units.length, 0); assert.equal(b.armies.player.catnipCooldown, 0);
});

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

test('attack and hurt poses follow actual damage timestamps even when render frames are skipped', () => {
  const battle = create();
  const attacker = spawn(battle, 'player', 'soldier', 700);
  const victim = spawn(battle, 'enemy', 'shield', 735); victim.attackCooldown = 10;
  battle.step(1 / 30);
  assert.equal(attacker.attackAt, battle.time);
  assert.equal(victim.hitAt, battle.time);
  assert.equal(unitMotion(attacker, battle.time).state, 'attack');
  assert.equal(unitMotion(victim, battle.time).state, 'hurt');
  const pose = unitMotion(victim, battle.time);
  battle.togglePause(); advance(battle, 2);
  assert.deepEqual(unitMotion(victim, battle.time), pose);
  battle.togglePause(); advance(battle, .5);
  assert.equal(unitMotion(victim, battle.time).hit, 0);
  assert.equal(unitMotion(attacker, battle.time).attack, 0);
});

test('steps follow distance travelled, including slow, while a roar does not generate footsteps', () => {
  const battle = create(), unit = spawn(battle, 'enemy', 'soldier', 300);
  unit.attackCooldown = 10; battle.armies.player.cannonCooldown = 10;
  battle.step(.1);
  assert.ok(Math.abs(unit.walkDistance - UNITS.soldier.speed * .1) < 1e-6);
  const distance = unit.walkDistance;
  battle.roar('player'); assert.equal(unit.walkDistance, distance);
  battle.step(.1);
  assert.ok(unit.walkDistance - distance < UNITS.soldier.speed * .1);
});

test('death keeps an identifiable visual event while immediately releasing the unit and population', () => {
  const battle = create(), attacker = spawn(battle, 'player', 'soldier', 700), victim = spawn(battle, 'enemy', 'soldier', 735);
  victim.hp = 1; victim.attackCooldown = 10;
  battle.step(1 / 30);
  const event = battle.effects.find(effect => effect.type === 'death' && effect.unitId === victim.id)!;
  assert.ok(event); assert.equal(battle.population('enemy'), 0);
  assert.equal(battle.units.some(unit => unit.id === victim.id), false);
  assert.equal(unitMotion(victim, battle.time, battle.time).state, 'death');
  assert.equal(unitMotion(victim, battle.time + DEATH_DURATION, battle.time).alpha, 0);
  assert.equal(unitMotion(attacker, battle.time, undefined, true).attack, 0);
  const revision = battle.revision; battle.reset();
  assert.equal(battle.revision, revision + 1); assert.equal(battle.effects.length, 0);
});
