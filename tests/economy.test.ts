import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { FOOD_RATES, ECONOMY_COSTS, TECH_COSTS, STARTING_FOOD, UNITS } from '../src/game/content.ts';
import type { Side } from '../src/game/content.ts';
import { LEVELS } from '../src/game/levels.ts';

const advance = (b: Battle, seconds: number) => { for (let t = 0; t < seconds - 1e-8; t += 1 / 30) b.step(Math.min(1 / 30, seconds - t)); };
const near = (a: number, z: number) => assert.ok(Math.abs(a - z) < 1e-6, `${a} != ${z}`);

test('both sides can afford all seven production upgrades from real income, with exact deductions and a safe cap', () => {
  for (const side of ['player', 'enemy'] as Side[]) {
    const b = new Battle(); b.start(); b.aiEnabled = false;
    const a = b.armies[side];
    assert.ok(ECONOMY_COSTS.length >= 7);
    for (const [i, cost] of ECONOMY_COSTS.entries()) {
      if (a.food < cost) advance(b, (cost - a.food) / FOOD_RATES[i] + 1e-6);
      const before = a.food, spent = a.spent;
      assert.ok(b.upgradeEconomy(side)); assert.equal(a.economy, i + 1);
      near(a.food, before - cost); near(a.spent, spent + cost);
      const after = a.food; advance(b, 1.5); near(a.food, after + FOOD_RATES[i + 1] * 1.5);
      assert.equal(a.tech, 1, 'income upgrades must not grant technology');
    }
    const capped = { ...a };
    assert.equal(b.upgradeEconomy(side), false); assert.deepEqual(a, capped);
    assert.ok(Number.isFinite(a.food));
    b.reset(); assert.equal(b.armies[side].economy, 0); assert.equal(b.armies[side].food, STARTING_FOOD);
  }
});

test('production purchase rejects insufficient food, ready, paused and ended states without deductions', () => {
  const b = new Battle();
  assert.equal(b.upgradeEconomy('player'), false); b.start(); b.aiEnabled = false;
  b.armies.player.food = ECONOMY_COSTS[0] - .01;
  const poor = JSON.stringify(b.armies.player);
  assert.equal(b.upgradeEconomy('player'), false); assert.equal(JSON.stringify(b.armies.player), poor);
  b.armies.player.food = 1000; b.togglePause();
  const paused = JSON.stringify(b.armies.player); advance(b, 10);
  assert.equal(b.upgradeEconomy('player'), false); assert.equal(JSON.stringify(b.armies.player), paused);
  b.phase = 'ended'; assert.equal(b.upgradeEconomy('player'), false);
});

test('high production continues during research and freezes together with it on pause', () => {
  const b = new Battle(); b.start(); b.aiEnabled = false;
  for (const cost of ECONOMY_COSTS) {
    if (b.armies.player.food < cost) advance(b, (cost - b.armies.player.food) / FOOD_RATES[b.armies.player.economy] + .01);
    assert.ok(b.upgradeEconomy('player'));
  }
  const a = b.armies.player;
  advance(b, TECH_COSTS[0] / FOOD_RATES[a.economy]); assert.ok(b.researchTech('player'));
  const before = a.food; advance(b, 4); near(a.food, before + 4 * FOOD_RATES[a.economy]); assert.equal(a.tech, 1);
  b.togglePause(); const saved = JSON.stringify(a); advance(b, 5); assert.equal(JSON.stringify(a), saved);
  b.togglePause(); advance(b, 4); assert.equal(a.tech, 2); assert.equal(a.economy, ECONOMY_COSTS.length);
});

test('a pressured AI with a research reserve can advance without receiving free resources', () => {
  const b = new Battle(); b.reset('campaign-04'); b.start(); b.aiEnabled = false;
  b.armies.player.food = 1000;
  for (let i = 0; i < 4; i++) {
    b.armies.player.cooldowns.soldier = 0; assert.ok(b.summon('player', 'soldier'));
    Object.assign(b.units.at(-1)!, { x: 1050 + i * 10, row: 1, attackCooldown: 1000 });
  }
  b.armies.enemy.food = TECH_COSTS[0] + UNITS.soldier.cost;
  b.time = b.level.techAt[0] + 31; b.aiEnabled = true;
  advance(b, b.level.grace + 9);
  assert.ok(b.armies.enemy.tech >= 2, 'having few defenders must not block affordable defensive research forever');
  assert.ok(b.armies.enemy.spent >= TECH_COSTS[0]); assert.ok(b.armies.enemy.food >= 0);
});

test('chapter investment schedules fit the production tree and retain increasing late-game choices', () => {
  for (const level of LEVELS) {
    assert.ok(level.economyAt.length <= ECONOMY_COSTS.length);
    assert.ok(level.economyAt.every((t,i) => Number.isFinite(t) && t >= 0 && (!i || t > level.economyAt[i-1])));
  }
  assert.ok(LEVELS[29].economyAt.length > LEVELS[0].economyAt.length);
});
