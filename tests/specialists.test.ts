import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, isHidden } from '../src/game/simulation.ts';
import { UNITS, UNIT_ORDER, SPECIALIST_ORDER, ENEMY_ORDER, BASE_X, SPECIAL } from '../src/game/content.ts';
import type { Side, UnitKind } from '../src/game/content.ts';
import { battleDistance } from '../src/game/combat-space.ts';

function create(seed = 1234) { const b = new Battle(seed); b.start(); b.aiEnabled = false; b.armies.player.cannonCooldown = b.armies.enemy.cannonCooldown = 10000; return b; }
function spawn(b: Battle, side: Side, kind: UnitKind, x: number, row = 1) {
  const a = b.armies[side]; a.food = 10000; a.tech = 3; a.cooldowns[kind] = 0;
  assert.ok(b.summon(side, kind)); const u = b.units.at(-1)!;
  Object.assign(u, { x, row, targetRow: row, attackCooldown: 10000 }); return u;
}
function advance(b: Battle, seconds: number) { for (let t = 0; t < seconds - 1e-8; t += 1 / 30) b.step(Math.min(1 / 30, seconds - t)); }
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('all sixteen cards are recruitable; the eight additions remain player-only and use real costs, technology, cooldowns and population', () => {
  assert.equal(UNIT_ORDER.length, 16); assert.equal(new Set(UNIT_ORDER).size, 16); assert.equal(ENEMY_ORDER.length, 8);
  for (const kind of SPECIALIST_ORDER) {
    const b = create(), a = b.armies.player, spec = UNITS[kind];
    assert.match(b.summonReason('player', kind), /科技/); a.tech = spec.tier; a.food = spec.cost - 1;
    assert.equal(b.summon('player', kind), false); a.food++;
    assert.equal(b.summon('player', kind), true); assert.equal(a.food, 0); assert.equal(b.population('player'), spec.population);
    a.food = 10000; assert.equal(b.summon('player', kind), false);
    b.armies.enemy.tech = 3; b.armies.enemy.food = 10000; assert.equal(b.summon('enemy', kind), false);
  }
});
test('toy gunner hits at long range for 125, observes reload and cannot shoot beyond 350', () => {
  const b = create(), gunner = spawn(b, 'player', 'gunner', 500), foe = spawn(b, 'enemy', 'shield', 830);
  gunner.attackCooldown = 0; b.step(.01); near(foe.hp, 575); near(gunner.x, 500);
  advance(b, 1); near(foe.hp, 575);
  foe.x = 900; gunner.attackCooldown = 0; b.step(.01); near(foe.hp, 575); assert.ok(gunner.walking);
});
test('litter bombs apply area damage and nonstacking attack reduction only on landing; reduction expires', () => {
  const b = create(), thrower = spawn(b, 'player', 'litter', 500), foe = spawn(b, 'enemy', 'shield', 680), second = spawn(b, 'enemy', 'shield', 690, 1.2);
  const far = spawn(b, 'enemy', 'shield', 690, 2.5); thrower.attackCooldown = 0;
  b.step(.01); assert.equal(foe.hp, 700); assert.equal(foe.weakenedUntil, undefined);
  advance(b, .4); near(foe.hp, 674); near(second.hp, 674); near(far.hp, 700);
  assert.ok(foe.weakenedUntil! > b.time);
  const ally = spawn(b, 'player', 'soldier', 600); b.units = [foe, ally]; foe.x = 616; foe.row = 1; foe.attackCooldown = 0;
  b.step(.01); near(ally.hp, 230 - 15 * .65);
  const before = ally.hp; foe.attackCooldown = 10000; advance(b, 4.1); foe.attackCooldown = 0; b.step(.01); near(ally.hp, before - 15);
});
test('litter in flight survives its thrower death, keeps a ground destination for a lost target and pauses', () => {
  const b = create(), thrower = spawn(b, 'player', 'litter', 500), foe = spawn(b, 'enemy', 'shield', 650);
  thrower.attackCooldown = 0; b.step(.01); b.units = [foe];
  b.togglePause(); const snapshot = JSON.stringify(b.projectiles); advance(b, 5); assert.equal(JSON.stringify(b.projectiles), snapshot); b.togglePause();
  advance(b, .4); near(foe.hp, 674); assert.ok(b.effects.some(e => e.type === 'dust'));
});
test('kungfu dodge is reproducible per hit, about 30 percent, and never a permanent invulnerability', () => {
  function sample() {
    const b = create(6789), cat = spawn(b, 'player', 'kungfu', 700), foe = spawn(b, 'enemy', 'soldier', 716); cat.hp = 100000;
    let dodges = 0;
    for (let i = 0; i < 1000; i++) { const hp = cat.hp; foe.attackCooldown = 0; b.step(.01); if (cat.hp === hp) dodges++; }
    return { hp: cat.hp, dodges };
  }
  const a = sample(); assert.deepEqual(sample(), a); assert.ok(a.dodges > 240 && a.dodges < 360); near(100000 - a.hp, (1000 - a.dodges) * 28);
});
test('a dodged star causes neither damage nor slow, and dodge also covers cannon attacks', () => {
  const b = create(1), cat = spawn(b, 'player', 'kungfu', 700), mage = spawn(b, 'enemy', 'mage', 900);
  mage.attackCooldown = 0; b.step(.01); advance(b, .32); near(cat.hp, UNITS.kungfu.hp); near(cat.starSlow, 0); assert.ok(cat.dodgeAt! > 0);
  const cannon = create(1), defender = spawn(cannon, 'player', 'kungfu', 1100); cannon.armies.enemy.cannonCooldown = 0;
  cannon.step(.01); near(defender.hp, UNITS.kungfu.hp); assert.equal(cannon.armies.enemy.cannonShots, 1);
});
test('assassin takes its first hit, ignores later hits, walks through foes for three seconds and cannot attack or be targeted', () => {
  const b = create(), cat = spawn(b, 'player', 'assassin', 600), a = spawn(b, 'enemy', 'soldier', 616), z = spawn(b, 'enemy', 'soldier', 617);
  a.attackCooldown = z.attackCooldown = 0; b.step(.01);
  near(cat.hp, UNITS.assassin.hp - 28); assert.ok(isHidden(cat, b.time)); assert.equal(cat.stealthUsed, true);
  const started = b.time, x = cat.x; cat.attackCooldown = 0;
  advance(b, 2.9); assert.ok(isHidden(cat, b.time)); assert.ok(cat.x > x + 250); near(cat.hp, UNITS.assassin.hp - 28);
  near(a.hp, 230); near(z.hp, 230); assert.equal(cat.attacking, false); assert.notEqual(a.targetId, cat.id); assert.notEqual(z.targetId, cat.id);
  advance(b, .11); assert.ok(b.time > started + 3); assert.equal(isHidden(cat, b.time), false);
  a.x = cat.x + 16; a.row = cat.row; a.attackCooldown = 0; b.step(.01); near(cat.hp, UNITS.assassin.hp - 56); assert.equal(isHidden(cat, b.time), false);
});
test('stealth cancels incoming homing stars and bombardment, and base arrival ends it early before the assassin attacks', () => {
  const b = create(), cat = spawn(b, 'player', 'assassin', 600), mage = spawn(b, 'enemy', 'mage', 800), attacker = spawn(b, 'enemy', 'soldier', 616);
  mage.attackCooldown = attacker.attackCooldown = 0; b.step(.01); assert.equal(b.projectiles.length, 1);
  advance(b, .4); near(cat.hp, UNITS.assassin.hp - 28); assert.equal(b.projectiles.length, 0);
  cat.x = 1150; const hp = cat.hp; b.armies.enemy.energy=70; assert.equal(b.bombard('enemy'), false);
  advance(b, 1.4); assert.equal(isHidden(cat, b.time), false); near(cat.hp, hp);
  b.units = [cat]; cat.attackCooldown = 0; b.step(.01); assert.ok(b.armies.enemy.hp < 3000);
});
test('lethal first attacks never trigger stealth; active stealth freezes on pause and resets cleanly', () => {
  const b = create(), cat = spawn(b, 'player', 'assassin', 700), foe = spawn(b, 'enemy', 'soldier', 716);
  cat.hp = 20; foe.attackCooldown = 0; b.step(.01); assert.ok(!b.units.includes(cat)); assert.equal(cat.stealthUsed, undefined);
  const other = spawn(b, 'player', 'assassin', 700); foe.attackCooldown = 0; b.step(.01);
  b.togglePause(); const snapshot = JSON.stringify(b.units); advance(b, 8); assert.equal(JSON.stringify(b.units), snapshot);
  b.reset(); assert.deepEqual(b.units, []); assert.deepEqual(b.projectiles, []); assert.deepEqual(b.effects, []);
});
test('umbrella reduces ranged damage for nearby allies, does not stack, expires, and leaves melee damage intact', () => {
  const b = create(), guard = spawn(b, 'player', 'umbrella', 600), guard2 = spawn(b, 'player', 'umbrella', 610), ally = spawn(b, 'player', 'soldier', 640), foe = spawn(b, 'enemy', 'slinger', 800);
  foe.attackCooldown = 0; b.step(.01); near(ally.hp, 230 - 42 * .55); assert.ok(ally.guardUntil! > b.time);
  b.units = [ally, foe]; foe.kind = 'soldier'; foe.x = ally.x + 16; foe.row = ally.row; foe.attackCooldown = 0;
  const before = ally.hp; b.step(.01); near(ally.hp, before - 28);
  foe.attackCooldown = 10000; advance(b, 3.1); foe.kind = 'slinger'; foe.attackCooldown = 0;
  const expired = ally.hp; b.step(.01); near(ally.hp, expired - 42);
  assert.ok(guard.supportCooldown! > 0 && guard2.supportCooldown! > 0);
});
test('drummers boost nearby attack cadence without stacking or granting damage; alone they stay by home', () => {
  const b = create(), first = spawn(b, 'player', 'drummer', 600), second = spawn(b, 'player', 'drummer', 605), ally = spawn(b, 'player', 'soldier', 650), foe = spawn(b, 'enemy', 'shield', 666);
  ally.attackCooldown = 0; b.step(.01); near(foe.hp, 672); assert.ok(ally.hasteUntil! > b.time);
  const at = ally.attackAt; advance(b, .79); assert.equal(ally.attackAt, at); advance(b, .02); assert.ok(ally.attackAt > at); near(foe.hp, 644);
  assert.ok(first.supportCooldown! > 0 && second.supportCooldown! > 0);
  const solo = create(), drummer = spawn(solo, 'player', 'drummer', BASE_X.player + 22); advance(solo, 10); assert.ok(drummer.x < BASE_X.player + 45); near(solo.armies.enemy.hp, 3000);
});
test('suction cat telegraphs and pulls a ranged backliner in front of the shield; a lost target cancels the charge', () => {
  const b = create(), hook = spawn(b, 'player', 'hook', 500), shield = spawn(b, 'enemy', 'shield', 620), rear = spawn(b, 'enemy', 'slinger', 740);
  hook.attackCooldown = 0; b.step(.01); assert.equal(hook.targetId, rear.id); assert.ok(hook.charge); near(rear.hp, 150);
  advance(b, .55); near(rear.hp, 150); const before = rear.x; advance(b, .06);
  near(rear.hp, 126); assert.ok(before - rear.x >= 140); assert.ok(rear.x < shield.x); assert.ok(hook.attackCooldown > 3);
  hook.attackCooldown = 0; b.step(.01); b.units = [hook, shield]; b.step(.01); assert.ok(!hook.charge || hook.charge.targetId === shield.id);
});
test('spring boxer cannot hit early, pushes on contact, breaks windups and does not push a boss', () => {
  const b = create(), boxer = spawn(b, 'player', 'boxer', 700), foe = spawn(b, 'enemy', 'shield', 716);
  boxer.attackCooldown = 0; b.step(.01); assert.ok(boxer.charge); advance(b, .5); near(foe.hp, 700);
  foe.charge = { remaining: 10, targetId: boxer.id }; advance(b, .06); near(foe.hp, 625); assert.ok(battleDistance(boxer, foe) >= 90); assert.equal(foe.charge, undefined);
  b.reset('campaign-30'); b.start(); b.aiEnabled = false; b.armies.enemy.hp = 899; b.step(.01);
  const boss = b.units.find(u => u.kind === 'boss')!; Object.assign(boss, { bossEntry: 0, x: 716, row: 1, attackCooldown: 10000 });
  const punch = spawn(b, 'player', 'boxer', 700); punch.attackCooldown = 0; advance(b, .65); near(boss.hp, 2525); near(boss.x, 716);
});
