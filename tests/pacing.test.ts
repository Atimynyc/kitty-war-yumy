import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, isHidden } from '../src/game/simulation.ts';
import { LEVELS, LEGACY_LEVELS, reinforcementPhase } from '../src/game/levels.ts';
import { UNITS, BASE_X } from '../src/game/content.ts';
import type { Side, UnitKind } from '../src/game/content.ts';

function advance(b: Battle, seconds: number) {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 30) b.step(Math.min(1 / 30, seconds - t));
}
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function shortCycle() {
  const b = new Battle(1234); b.reset('campaign-06');
  b.level = { ...b.level, economyAt: [], techAt: [], reinforcements: { start: 0, cycle: 12, rest: 4 } };
  b.start(); b.armies.player.cannonCooldown = b.armies.enemy.cannonCooldown = 10000;
  return b;
}
function spawn(b: Battle, side: Side, kind: UnitKind, x: number) {
  const a = b.armies[side]; a.food = 10000; a.tech = 3; a.cooldowns[kind] = 0;
  assert.ok(b.summon(side, kind)); const u = b.units.at(-1)!;
  Object.assign(u, { x, row: 1, targetRow: 1, attackCooldown: 10000 }); return u;
}

test('all thirty stages have bounded recruitment windows with correct exact and repeated boundaries', () => {
  for (const level of LEVELS) {
    const plan = level.reinforcements!;
    assert.ok(plan.start >= level.grace && plan.rest > 0 && plan.rest < plan.cycle);
    const first = plan.start + plan.cycle - plan.rest;
    near(reinforcementPhase(level, 0).nextChangeIn!, first);
    for (const cycle of [0, 1, 50]) {
      const begin = first + plan.cycle * cycle, end = begin + plan.rest;
      assert.equal(reinforcementPhase(level, begin - .001).regrouping, false);
      assert.equal(reinforcementPhase(level, begin).regrouping, true);
      near(reinforcementPhase(level, begin).nextChangeIn!, plan.rest);
      assert.equal(reinforcementPhase(level, end - .001).regrouping, true);
      assert.equal(reinforcementPhase(level, end).regrouping, false);
      near(reinforcementPhase(level, end).nextChangeIn!, plan.cycle - plan.rest);
    }
  }
  for (const level of LEGACY_LEVELS) assert.deepEqual(reinforcementPhase(level, 500), { regrouping: false, nextChangeIn: null });
});

test('regrouping stops new recruits while ordinary income and existing combat continue, then recruitment resumes', () => {
  const b = shortCycle(); advance(b, 8.1);
  const enemy = b.units.find(u => u.side === 'enemy')!; assert.ok(enemy);
  assert.ok(b.summon('player', 'soldier')); const friend = b.units.at(-1)!;
  Object.assign(friend, { x: 600, row: 1, attackCooldown: 0 });
  Object.assign(enemy, { x: 616, row: 1, attackCooldown: 0 });
  const hired = b.armies.enemy.hired, food = b.armies.enemy.food, hp = friend.hp;
  advance(b, 3.8);
  assert.equal(b.armies.enemy.hired, hired); near(b.armies.enemy.food, food + 12 * 3.8);
  assert.ok(friend.hp < hp, 'existing enemies still attack during rest');
  advance(b, 4);
  assert.ok(b.armies.enemy.hired > hired, 'recruitment resumes on the next ordinary AI decision');
});

test('both armies may research during regrouping and continue paying real costs', () => {
  const b = shortCycle(); advance(b, 8.1);
  b.level = { ...b.level, techAt: [0], investmentGuard: 0 };
  assert.ok(b.researchTech('player')); const hired = b.armies.enemy.hired, before = b.armies.enemy.food;
  advance(b, 3.8);
  assert.equal(b.armies.enemy.hired, hired); assert.equal(b.armies.enemy.researching, true);
  near(b.armies.enemy.food, before + 12 * 3.8 - 150);
  near(b.armies.player.research, 8 - 3.8);
  advance(b, 7); assert.equal(b.armies.player.tech, 2); assert.equal(b.armies.enemy.tech, 2);
});

test('pause freezes rest, income and research; reset restores the selected stage opening', () => {
  const b = shortCycle(); advance(b, 8.1); b.researchTech('player'); b.togglePause();
  const snapshot = JSON.stringify({ time: b.time, armies: b.armies, units: b.units, phase: reinforcementPhase(b.level, b.time) });
  advance(b, 30);
  assert.equal(JSON.stringify({ time: b.time, armies: b.armies, units: b.units, phase: reinforcementPhase(b.level, b.time) }), snapshot);
  b.togglePause(); advance(b, 1); near(b.time, 9.1);
  b.reset(); near(b.time, 0); assert.equal(b.units.length, 0); assert.equal(b.armies.enemy.hired, 0);
  assert.equal(b.level.id, 'campaign-06'); near(reinforcementPhase(b.level, b.time).nextChangeIn!, 80);
});

test('after an actual three-second stealth, assassin pursues the forward backline rather than a distant old target', () => {
  const b = new Battle(); b.start(); b.aiEnabled = false;
  b.armies.player.cannonCooldown = b.armies.enemy.cannonCooldown = 10000;
  const cat = spawn(b, 'player', 'assassin', 600), old = spawn(b, 'enemy', 'soldier', 616), rear = spawn(b, 'enemy', 'slinger', 1050);
  old.attackCooldown = 0; cat.attackCooldown = 0; b.step(.01);
  assert.equal(cat.stealthUsed, true); assert.ok(isHidden(cat, b.time));
  const oldHp = old.hp, rearHp = rear.hp;
  advance(b, 2.9); assert.ok(isHidden(cat, b.time)); near(old.hp, oldHp); near(rear.hp, rearHp);
  advance(b, .11); assert.equal(isHidden(cat, b.time), false); assert.equal(cat.targetId, rear.id);
  const x = cat.x; advance(b, .3); assert.ok(cat.x > x); assert.equal(cat.targetId, rear.id);
  b.units = [cat, old]; const x2 = cat.x; b.step(.01);
  assert.equal(cat.targetId, null); assert.equal(cat.targetX, BASE_X.enemy); assert.ok(cat.x > x2);
});

test('revealed assassin can fight a contact pursuer and cannot trigger stealth a second time', () => {
  const b = new Battle(); b.start(); b.aiEnabled = false;
  b.armies.player.cannonCooldown = b.armies.enemy.cannonCooldown = 10000;
  const cat = spawn(b, 'player', 'assassin', 700), pursuer = spawn(b, 'enemy', 'soldier', 684);
  cat.stealthUsed = true; cat.stealthUntil = 0; cat.attackCooldown = pursuer.attackCooldown = 0;
  b.step(.01); assert.equal(cat.targetId, pursuer.id); near(pursuer.hp, UNITS.soldier.hp - UNITS.assassin.damage);
  near(cat.hp, UNITS.assassin.hp - UNITS.soldier.damage); assert.equal(isHidden(cat, b.time), false);
});
