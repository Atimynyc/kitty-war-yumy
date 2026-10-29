import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { BASE_HP, BASE_X, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, STARTING_FOOD, UNITS, STAR_MAGIC, CATNIP } from '../src/game/content.ts';
import { LEVELS, LEGACY_LEVELS, readProgress, victoryStars } from '../src/game/levels.ts';
import type { Side, UnitKind } from '../src/game/content.ts';
import { unitMotion, DEATH_DURATION } from '../src/game/unit-motion.ts';
import { battleDistance, LANE_SPACING } from '../src/game/combat-space.ts';
import { simulateStrategy } from '../scripts/balance.mjs';
import { spellNoticeText } from '../src/game/spell-notices.ts';

function create() { const battle = new Battle(); battle.aiEnabled = false; battle.start(); return battle; }
function advance(battle: Battle, seconds: number) { for (let frame = 0; frame < seconds * 30; frame++) battle.step(1 / 30); }
function spawn(battle: Battle, side: Side, kind: UnitKind, x: number, row = 1) {
  battle.armies[side].food = 10000; battle.armies[side].tech = 3; battle.armies[side].cooldowns[kind] = 0;
  assert.equal(battle.summon(side, kind), true);
  const unit = battle.units.at(-1)!; unit.x = x; unit.row = row; unit.targetRow = row; unit.attackCooldown = 0; return unit;
}

test('player spell captions report actual affected troops and effects', () => {
  for (const side of ['player'] as Side[]) {
    const b = create(), foe = side === 'player' ? 'enemy' : 'player';
    b.armies[side].energy=100;
    const ally = spawn(b, side, 'soldier', 700);
    ally.hp = 100;
    spawn(b, foe, 'soldier', BASE_X[side] + (side === 'player' ? 100 : -100));
    spawn(b, foe, 'soldier', 720);
    assert.equal(b.treat(side), true);
    const healing = b.spellNotices.visible(b.time)[0];
    assert.equal(healing.affected, 1); assert.equal(healing.side, side);
    assert.equal(ally.hp, 169);
    assert.match(spellNoticeText(healing).detail, /共恢复 69 生命/);
    advance(b, 4.6);
    assert.equal(b.catnip(side), true);
    const mint = b.spellNotices.visible(b.time)[0];
    assert.equal(mint.spell, 'catnip'); assert.equal(mint.affected, 1); assert.equal(ally.catnip, 10);
    assert.match(spellNoticeText(mint).title, new RegExp(`${side === 'enemy' ? '敌方' : '我方'}释放猫薄荷`));
    assert.match(spellNoticeText(mint).detail, /攻击力 \+20%，持续 10 秒；新出兵不享受/);
    const later = spawn(b, side, 'soldier', 500);
    assert.equal(later.catnip, 0); assert.equal(mint.affected, 1);
  }
});

test('failed and empty casts never spend energy or announce a spell', () => {
  const b = create();
  assert.equal(b.catnip('player'), false); assert.deepEqual(b.spellNotices.visible(b.time), []);
  assert.equal(b.bombard('player'), false);
  const notices = b.spellNotices.visible(b.time);
  assert.deepEqual(notices,[]);assert.equal(b.armies.player.energy,50);
  assert.equal(b.bombard('player'), false);
  b.togglePause(); assert.equal(b.bombard('enemy'), false);
  assert.deepEqual(b.spellNotices.visible(b.time), notices);
});

test('player captions queue, enemy casts are blocked, pause freezes and restart clears them', () => {
  const b = create();
  spawn(b, 'player', 'knight', 500).hp = 1000; spawn(b, 'enemy', 'knight', 340);
  b.armies.player.energy=100;
  b.catnip('player'); b.treat('player'); b.catnip('enemy');
  const notices = b.spellNotices.visible(b.time);
  assert.deepEqual(notices.map(n => [n.side, n.spell]), [['player','catnip']]);
  b.togglePause(); advance(b, 20); assert.deepEqual(b.spellNotices.visible(b.time), notices);
  b.togglePause(); advance(b, 4.6);
  assert.deepEqual(b.spellNotices.visible(b.time).map(n => [n.side, n.spell]), [['player','treat']]);
  advance(b, 4.6); assert.deepEqual(b.spellNotices.visible(b.time), []);
  b.reset(); b.start(); spawn(b, 'player', 'soldier', 500); b.catnip('player'); b.bombard('player');
  b.reset(); assert.deepEqual(b.spellNotices.visible(0), []); b.start(); advance(b, 6);
  assert.deepEqual(b.spellNotices.visible(b.time), []);
});

test('AI cannot cast active skills even under base pressure with full energy', () => {
  const b=create(); b.aiEnabled=true; b.armies.enemy.energy=100;
  advance(b,b.level.grace-.1);
  for(const row of [0,1,2]) spawn(b,'player','knight',BASE_X.enemy-100,row);
  b.aiEnabled=true;advance(b,.2);
  assert.equal(b.armies.enemy.energySpent,0);
  assert.equal(b.spellNotices.visible(b.time).length,0);
  assert.equal(b.effects.some(fx=>fx.type==='bombard'),false);
});

test('base-cat dialogue follows actual base damage, gives defense priority and pauses with battle time', () => {
  const b = create();
  assert.equal(b.baseDialogue.snapshot(b.time).text, '我要吃冻干！快给我！');
  b.togglePause(); advance(b, 12);
  assert.equal(b.baseDialogue.snapshot(b.time).remaining, 5);
  b.togglePause(); advance(b, 6);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '');
  spawn(b, 'enemy', 'soldier', BASE_X.player + 16);
  b.step(1 / 30);
  assert.ok(b.armies.player.hp < BASE_HP);
  const first = b.baseDialogue.snapshot(b.time);
  assert.equal(first.text, '真好吃！');
  advance(b, 2);
  assert.equal(b.baseDialogue.snapshot(b.time).startedAt, first.startedAt, 'repeated attacks must not restart the speech');
  b.units = [];
  spawn(b, 'player', 'soldier', BASE_X.enemy - 16);
  b.step(1 / 30);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '不！我自己都不够吃。');
  assert.ok(b.armies.enemy.hp < BASE_HP);
  b.units = []; advance(b, 5);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '');
  b.reset(); b.start();
  assert.equal(b.baseDialogue.snapshot(b.time).text, '我要吃冻干！快给我！');
});

test('base-cat reactions ignore wounded units and wait for star impact on a base', () => {
  const b = create(); advance(b, 6);
  const a = spawn(b, 'player', 'soldier', 700), z = spawn(b, 'enemy', 'soldier', 716);
  b.step(1 / 30);
  assert.ok(a.hp < UNITS.soldier.hp && z.hp < UNITS.soldier.hp);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '');
  b.units = []; spawn(b, 'enemy', 'mage', BASE_X.player + 100);
  b.step(1 / 30);
  assert.equal(b.projectiles.length, 1);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '');
  advance(b, .2);
  assert.equal(b.armies.player.hp, BASE_HP);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '');
  advance(b, .2);
  assert.ok(b.armies.player.hp < BASE_HP);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '真好吃！');
});

test('simultaneous base hits show the orange cat protecting his food, with a quiet gap between repeats', () => {
  const b = create();
  // Both projectiles land in one tick, even when the two casters have already left.
  b.projectiles = [
    {id: 100, side:'player', x:1100, row:1, targetX:BASE_X.enemy, targetRow:1, sourceId:98, damage:20, age:.3, duration:.32},
    {id: 101, side:'enemy', x:300, row:1, targetX:BASE_X.player, targetRow:1, sourceId:99, damage:20, age:.3, duration:.32},
  ];
  b.step(1 / 30);
  assert.equal(b.baseDialogue.snapshot(b.time).cue, 'protect');
  const first = b.baseDialogue.snapshot(b.time).startedAt;
  spawn(b, 'player', 'knight', BASE_X.enemy - 16);
  advance(b, 5);
  assert.equal(b.baseDialogue.snapshot(b.time).text, '');
  advance(b, 5);
  assert.equal(b.baseDialogue.snapshot(b.time).cue, 'protect');
  assert.ok(b.baseDialogue.snapshot(b.time).startedAt >= first + 9);
});

test('opponents on different rows approach diagonally before melee and remain symmetric', () => {
  for (const reverse of [false, true]) {
    const b = create(), a = spawn(b, 'player', 'soldier', 650, 0), z = spawn(b, 'enemy', 'soldier', 780, 2);
    if (reverse) b.units.reverse();
    const from = { x: a.x, row: a.row };
    b.step(.1);
    assert.equal(a.hp, UNITS.soldier.hp); assert.equal(z.hp, a.hp);
    assert.equal(a.targetId, z.id); assert.equal(z.targetId, a.id);
    assert.ok(a.x > from.x && a.row > from.row && z.row < 2);
    assert.ok(Math.abs(battleDistance(from, a) - UNITS.soldier.speed * .1) < 1e-8);
    for (let i = 0; i < 100 && a.hp === UNITS.soldier.hp; i++) {
      const distance = battleDistance(a, z), hp = a.hp;
      b.step(1 / 30);
      if (a.hp < hp) assert.ok(distance <= UNITS.soldier.range);
      assert.equal(a.hp, z.hp);
      assert.ok(Math.abs(a.x + z.x - 1430) < 1e-8);
      assert.ok(Math.abs(a.row + z.row - 2) < 1e-8);
    }
    assert.ok(a.hp < UNITS.soldier.hp);
    assert.ok(a.row > .7 && a.row < 1 && z.row > 1 && z.row < 1.3);
  }
});

test('purely lateral and rear opponents can be reached without moving away or attacking across the lane', () => {
  for (const side of ['player', 'enemy'] as Side[]) for (const behind of [false, true]) {
    const b = create(), other = side === 'player' ? 'enemy' : 'player', dir = side === 'player' ? 1 : -1;
    const a = spawn(b, side, 'soldier', 700, 0), z = spawn(b, other, 'soldier', behind ? 700 - dir * 150 : 700, 2);
    b.step(.1);
    assert.equal(a.hp, UNITS.soldier.hp); assert.equal(a.targetId, z.id);
    if (behind) assert.ok((a.x - 700) * dir < 0); else assert.equal(a.x, 700);
    assert.ok(a.row > 0 && z.row < 2);
    advance(b, 2.5);
    assert.ok(a.hp < UNITS.soldier.hp); assert.equal(a.hp, z.hp);
  }
});

test('target lock avoids flickering between near-equal foes and reacquires a living target', () => {
  const b = create(), a = spawn(b, 'player', 'soldier', 650, 1);
  const first = spawn(b, 'enemy', 'soldier', 750, 0), second = spawn(b, 'enemy', 'soldier', 755, 2);
  b.step(1 / 30); assert.equal(a.targetId, first.id);
  second.x = 745; b.step(1 / 30); assert.equal(a.targetId, first.id);
  second.x = 680; b.step(1 / 30); assert.equal(a.targetId, second.id);
  second.hp = 0; b.step(1 / 30); assert.equal(a.targetId, first.id);
  first.hp = 0; b.step(1 / 30); assert.equal(a.targetId, null); assert.equal(a.targetX, BASE_X.enemy);
});

test('lateral movement obeys the same speed, slow and travelled-distance rules', () => {
  const b = create(), a = spawn(b, 'player', 'soldier', 700, 0);
  spawn(b, 'enemy', 'soldier', 700, 2); a.starSlow = 3;
  b.step(.1);
  assert.equal(a.x, 700);
  assert.ok(Math.abs(a.row * LANE_SPACING - UNITS.soldier.speed * .1 * .7) < 1e-8);
  assert.ok(Math.abs(a.walkDistance - a.row * LANE_SPACING) < 1e-8);
});

test('ranged reach includes lateral distance and effects retain the actual source and target rows', () => {
  for (const kind of ['slinger', 'mage', 'catapult'] as UnitKind[]) {
    const b = create(), a = spawn(b, 'player', kind, 500, 0), z = spawn(b, 'enemy', 'shield', 500 + UNITS[kind].range - 1, 2);
    b.step(1 / 30);
    assert.equal(a.attackAt, -100); assert.equal(z.hp, UNITS.shield.hp);
    z.x = 650; z.row = 1; a.attackCooldown = 0;
    b.step(1 / 30);
    assert.equal(a.attackAt, b.time);
    const shot = kind === 'mage' ? b.projectiles[0] : b.effects.find(e => e.type === 'shot')!;
    assert.equal(shot.sourceId, a.id); assert.equal(shot.targetId, z.id);
    if (kind === 'mage') { assert.equal(b.projectiles[0].row, a.row); assert.equal(b.projectiles[0].targetRow, 1); }
    else { assert.equal('sourceRow' in shot && shot.sourceRow, a.row); assert.equal(shot.row, 1); }
  }
});

test('splash and healing respect lateral radius instead of hitting the entire row', () => {
  const b = create(); spawn(b, 'player', 'catapult', 500, 0);
  const center = spawn(b, 'enemy', 'shield', 700, 0), inside = spawn(b, 'enemy', 'shield', 700, .4375), outside = spawn(b, 'enemy', 'shield', 700, .45);
  b.step(1 / 30);
  assert.equal(center.hp, UNITS.shield.hp - UNITS.catapult.damage); assert.equal(inside.hp, center.hp); assert.equal(outside.hp, UNITS.shield.hp);
  const h = create(), healer = spawn(h, 'player', 'healer', 600, 0);
  const near = spawn(h, 'player', 'shield', 600, 1), far = spawn(h, 'player', 'shield', 600, UNITS.healer.range / LANE_SPACING + .1);
  near.hp = far.hp = 600; h.step(1 / 30);
  assert.equal(near.hp, 600 + UNITS.healer.heal!); assert.equal(far.hp, 600); assert.equal(healer.targetId, near.id);
  h.step(1 / 30); assert.equal(healer.targetId, near.id);
});

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
  const target = spawn(b, 'enemy', 'shield', 716), neighbor = spawn(b, 'enemy', 'shield', 717);
  target.attackCooldown = neighbor.attackCooldown = 100;
  b.step(1 / 30);
  assert.equal(target.hp, UNITS.shield.hp - 150); assert.equal(neighbor.hp, UNITS.shield.hp);
  advance(b, 1.5); assert.equal(target.hp, UNITS.shield.hp - 150);
  advance(b, .15); assert.equal(target.hp, UNITS.shield.hp - 300);
  b.catnip('player'); knight.attackCooldown = 0;
  const hp = target.hp; b.step(1 / 30); assert.equal(hp - target.hp, 180);
  b.units = [knight]; knight.x = 500; knight.starSlow = 3; knight.attackCooldown = 10;
  b.step(.1); assert.ok(Math.abs(knight.x - 503.15) < 1e-8);
  assert.ok(Math.abs(knight.attackCooldown - 9.93) < 1e-8);
});

test('knight can be healed, takes ordinary damage and releases all six population on death', () => {
  const b = create(), knight = spawn(b, 'player', 'knight', 700);
  spawn(b, 'player', 'healer', 600); knight.hp = 1780;
  b.step(1 / 30); assert.equal(knight.hp, 1800);
  const foe = spawn(b, 'enemy', 'knight', 716); knight.attackCooldown = 100;
  b.step(1 / 30); assert.equal(knight.hp, 1650);
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
  const b = create(), u = spawn(b, 'player', 'soldier', 700), target = spawn(b, 'enemy', 'shield', 716);
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

test('catnip snapshots the current roster, expires after 10s and waiting does not refill energy', () => {
  const b = create(); assert.equal(b.catnip('player'), false); assert.equal(b.armies.player.energy, 50);
  const first = spawn(b, 'player', 'soldier', 300), enemy = spawn(b, 'enemy', 'soldier', 1000);
  assert.equal(b.catnip('player'), true); assert.equal(first.catnip, CATNIP.duration); assert.equal(enemy.catnip, 0);
  const later = spawn(b, 'player', 'soldier', 300); assert.equal(later.catnip, 0);
  assert.equal(b.catnip('player'), false);
  // Park units away from combat while advancing spell timers.
  for (let i = 0; i < 450; i++) { first.x = later.x = 300; enemy.x = 1000; b.step(.1); if (i === 100) assert.equal(first.catnip, 0); }
  assert.equal(b.armies.player.energy,10);assert.equal(b.catnip('player'),false);
  b.armies.player.energy=50;assert.equal(b.catnip('player'), true); assert.equal(later.catnip, 10);
});

test('catapult splash includes its radius boundary, excludes allies and scales every victim with catnip', () => {
  const b = create(); spawn(b, 'player', 'catapult', 500);
  const ally = spawn(b, 'player', 'shield', 700); ally.attackCooldown = 100;
  const targets = [740, 775, 776, 810].map(x => spawn(b, 'enemy', 'shield', x));
  targets.forEach(u => u.attackCooldown = 100);
  b.catnip('player'); b.step(1 / 30);
  assert.equal(ally.hp, UNITS.shield.hp);
  assert.equal(targets[0].hp, UNITS.shield.hp - UNITS.catapult.damage * 1.2);
  assert.equal(targets[1].hp, targets[0].hp); assert.equal(targets[2].hp, UNITS.shield.hp);
  assert.equal(targets[3].hp, UNITS.shield.hp, 'the old 70-unit boundary is now outside the splash');
});

test('catnip expires without changing base stats and never increases healing or cannon damage', () => {
  const b = create(), u = spawn(b, 'player', 'soldier', 700), target = spawn(b, 'enemy', 'shield', 716);
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
  b.reset(); assert.equal(b.projectiles.length, 0); assert.equal(b.units.length, 0); assert.equal(b.armies.player.energy, 50);
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
  battle.researchTech('player'); battle.summon('player', 'soldier'); battle.bombard('player');
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

test('every melee troop must reach contact before damage, including lateral and rear targets', () => {
  for (const kind of ['mouse','soldier','shield','knight'] as UnitKind[]) for (const side of ['player','enemy'] as Side[])
    for (const angle of [0, Math.PI/4, Math.PI/2, Math.PI]) {
      const b=create(), a=spawn(b,side,kind,700), foe=side==='player'?'enemy':'player';
      const place=(distance:number)=>({x:700+Math.cos(angle)*distance,row:1+Math.sin(angle)*distance/LANE_SPACING});
      const outside=place(UNITS[kind].range+.01), z=spawn(b,foe,'shield',outside.x,outside.row);
      z.attackCooldown=100;
      b.step(1/30);
      assert.equal(z.hp,UNITS.shield.hp,`${kind} hit before contact`);
      assert.equal(a.attackAt,-100); assert.equal(a.attacking,false); assert.equal(a.walking,true);
      Object.assign(a,{x:700,row:1}); Object.assign(z,place(UNITS[kind].range-.01));
      b.step(1/30);
      assert.equal(a.attackAt,b.time); assert.equal(z.hp,UNITS.shield.hp-UNITS[kind].damage);
    }
});

test('knockback breaks melee contact and prevents damage until the fighter closes again', () => {
  const b=create(), a=spawn(b,'player','soldier',350), z=spawn(b,'enemy','shield',366);
  b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=100;
  z.attackCooldown=100; b.step(1/30); const hp=z.hp;
  z.x+=130; z.slow=3; a.attackCooldown=0;
  for (let frame=0;frame<180;frame++) {
    const distance=battleDistance(a,z); b.step(1/30);
    if(distance>UNITS.soldier.range) { assert.equal(z.hp,hp); assert.equal(a.attacking,false); }
    else { assert.ok(z.hp<hp); return; }
  }
  assert.fail('fighter never regained contact after knockback');
});

test('all melee troops in contact can hit without moving or awarding kill income', () => {
  const battle = create();
  for (let i = 0; i < 5; i++) spawn(battle, 'player', 'soldier', 700);
  const target = spawn(battle, 'enemy', 'shield', 716); target.attackCooldown = 10;
  const foodBefore = battle.armies.player.food;
  battle.step(1 / 30);
  assert.equal(target.hp, UNITS.shield.hp - UNITS.soldier.damage * 5);
  assert.ok(battle.units.filter(u => u.side === 'player').every(u => u.x === 700));
  target.hp = 1;
  for (const unit of battle.units) if (unit.side === 'player') unit.attackCooldown = 0;
  battle.step(1 / 30);
  assert.equal(battle.units.some(u => u.id === target.id), false);
  assert.ok(Math.abs(battle.armies.player.food - foodBefore - .8) < .001);
});

test('ten melee soldiers kill a full-health soldier in one volley for either side', () => {
  for (const side of ['player','enemy'] as Side[]) {
    const b=create(), foe=side==='player'?'enemy':'player', dir=side==='player'?1:-1;
    const attackers=Array.from({length:10},()=>spawn(b,side,'soldier',700));
    const victim=spawn(b,foe,'soldier',700+dir*16);
    b.step(1/30);
    assert.equal(b.units.includes(victim),false);
    assert.ok(attackers.every(u=>u.attackAt===b.time && u.attackCooldown>0));
    assert.equal(b.armies[foe].lost,1);
    assert.equal(b.armies[side].energy,54,'one reward despite overkill');
  }
});

test('cooling-down front troops do not prevent ready allies from attacking', () => {
  const b=create();
  const front=Array.from({length:3},()=>spawn(b,'player','soldier',705));
  front.forEach(u=>u.attackCooldown=10);
  const ready=Array.from({length:7},()=>spawn(b,'player','soldier',700));
  const victim=spawn(b,'enemy','shield',716);
  b.step(1/30);
  assert.equal(victim.hp,700-7*28);
  assert.ok(ready.every(u=>u.attackAt===b.time));
  assert.ok(front.every(u=>u.attackAt<0));
});

test('all troops can siege and keep attacking through new recruits, including after reload', () => {
  for (const side of ['player','enemy'] as Side[]) {
    const b=create(), foe=side==='player'?'enemy':'player', dir=side==='player'?1:-1;
    b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;
    const attackers=Array.from({length:10},()=>spawn(b,side,'soldier',BASE_X[foe]-dir*20));
    spawn(b,foe,'soldier',700).attackCooldown=100;
    b.step(1/30);
    assert.equal(b.armies[foe].hp,BASE_HP-280,'a distant foe must not block reachable base damage');
    for(let wave=0;wave<3;wave++) {
      spawn(b,foe,'soldier',BASE_X[foe]-dir*22).attackCooldown=100;
      attackers.forEach(u=>u.attackCooldown=0);
      b.step(1/30);
      assert.equal(b.armies[foe].hp,BASE_HP-280*(wave+2));
      assert.ok(attackers.every(u=>u.targetId===null));
    }
    const restored=new Battle(); assert.ok(restored.restore(b.save())); restored.togglePause();
    for(const u of restored.units.filter(u=>u.side===side))u.attackCooldown=0;
    restored.step(1/30);
    assert.equal(restored.armies[foe].hp,BASE_HP-280*5);
    const pushed=restored.units.find(u=>u.id===attackers[0].id)!;
    pushed.x-=dir*100;pushed.attackCooldown=0;
    restored.step(1/30);
    assert.notEqual(pushed.targetId,null,'knockback out of base range releases siege lock');
    assert.equal(restored.armies[foe].hp,BASE_HP-280*5);
  }
});

test('a nearby defender is fought before beginning a siege, then troops reach the base', () => {
  const b=create();b.armies.enemy.cannonCooldown=1000;
  const attackers=Array.from({length:10},()=>spawn(b,'player','soldier',BASE_X.enemy-40));
  spawn(b,'enemy','soldier',BASE_X.enemy-24);
  b.step(1/30);
  assert.equal(b.armies.enemy.hp,BASE_HP);
  assert.equal(b.units.filter(u=>u.side==='enemy').length,0);
  advance(b,1.1);
  assert.ok(b.armies.enemy.hp<BASE_HP);
  assert.ok(attackers.every(u=>u.targetId===null));
});

test('catapult splash damages a cluster and has a minimum firing range', () => {
  const battle = create();
  const catapult = spawn(battle, 'player', 'catapult', 500);
  const first = spawn(battle, 'enemy', 'soldier', 740), second = spawn(battle, 'enemy', 'soldier', 770);
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
  const a = spawn(battle, 'player', 'soldier', 700), b = spawn(battle, 'enemy', 'soldier', 716);
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

test('victory stars require full base health for three stars and include exactly 50% in two stars', () => {
  for (const [hp, stars] of [[3000,3], [2999.99,2], [2100,2], [1500.01,2], [1500,2], [1499.99,1], [1050,1], [1,1]]) {
    assert.equal(victoryStars(hp), stars, `hp=${hp}`);
  }
  assert.deepEqual(readProgress('{"sunroom":{"stars":2,"bestTime":120,"ratingVersion":2}}'), {sunroom:{stars:2,bestTime:120,ratingVersion:2}});
});

test('the frozen pre-rebalance rules preserve historical three-level outcomes', async () => {
  const { Battle: FrozenBattle } = await import('../analysis/balance-0.16/baseline-source/simulation.ts');
  const { UNITS: frozenUnits } = await import('../analysis/balance-0.16/baseline-source/content.ts');
  const { LEGACY_LEVELS: frozenLevels } = await import('../analysis/balance-0.16/baseline-source/levels.ts');
  const rules = { Battle: FrozenBattle, UNITS: frozenUnits };
  const simple = frozenLevels.map(level => simulateStrategy(level, 'soldier-rush', {}, rules));
  assert.deepEqual(simple.map(result => result.winner), ['player', 'enemy', 'enemy']);
  const mixed = frozenLevels.map(level => simulateStrategy(level, 'combined-arms', {}, rules));
  assert.ok(mixed.every(result => result.winner === 'player'));
  // Higher difficulty pressures a simple army earlier; a mixed army's completion
  // time can vary with its matchups and is not a ranking of level difficulty.
  assert.ok(simple[2].seconds < simple[1].seconds);
  assert.ok(mixed[0].seconds < mixed[1].seconds && mixed[0].seconds < mixed[2].seconds);
});

test('attack and hurt poses follow actual damage timestamps even when render frames are skipped', () => {
  const battle = create();
  const attacker = spawn(battle, 'player', 'soldier', 700);
  const victim = spawn(battle, 'enemy', 'shield', 716); victim.attackCooldown = 10;
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

test('steps follow distance travelled, including slow, while displacement does not generate footsteps', () => {
  const battle = create(), unit = spawn(battle, 'enemy', 'soldier', 300);
  unit.attackCooldown = 10; battle.armies.player.cannonCooldown = 10;
  battle.step(.1);
  assert.ok(Math.abs(unit.walkDistance - UNITS.soldier.speed * .1) < 1e-6);
  const distance = unit.walkDistance;
  unit.x+=75; unit.starSlow=3; assert.equal(unit.walkDistance, distance);
  battle.step(.1);
  assert.ok(unit.walkDistance - distance < UNITS.soldier.speed * .1);
});

test('death keeps an identifiable visual event while immediately releasing the unit and population', () => {
  const battle = create(), attacker = spawn(battle, 'player', 'soldier', 700), victim = spawn(battle, 'enemy', 'soldier', 716);
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
