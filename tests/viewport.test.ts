import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitProjection } from '../src/game/projection.ts';
import { BASE_X } from '../src/game/content.ts';
import { CombatLayout, combatLayout, targetFacing, unitScale, meleeContactPixels } from '../src/game/combat-layout.ts';
import { Battle } from '../src/game/simulation.ts';
import { BodyDirection, directionArt } from '../src/game/unit-facing.ts';
import type { Side, UnitKind } from '../src/game/content.ts';

test('vertical projection places the player below the enemy and preserves relative progress across sizes', () => {
  for (const [width, height] of [[304, 240], [374, 500], [752, 700]]) {
    const view = portraitProjection(width, height);
    const player = view.project(BASE_X.player), enemy = view.project(BASE_X.enemy);
    assert.ok(player.y > enemy.y);
    assert.ok(enemy.y > 0 && player.y < height);
    assert.equal(player.x, enemy.x);
    const middle = view.project((BASE_X.player + BASE_X.enemy) / 2);
    assert.ok(Math.abs(middle.y - height / 2) < .001);
    const quarter = view.project(BASE_X.player + (BASE_X.enemy - BASE_X.player) * .25);
    assert.ok(Math.abs((player.y - quarter.y) / (player.y - enemy.y) - .25) < .001);
    for (let row = 0; row < 3; row++) {
      const point = view.project(700, row);
      assert.ok(point.x > view.unitSize / 2 && point.x < width - view.unitSize / 2);
    }
    assert.ok(view.unitSize >= 36 && view.unitSize <= 60);
  }
});

test('catapult splash outline never exceeds two soldier body widths on any supported display', () => {
  for (const [width,height] of [[264,190],[304,210],[374,467],[504,1100],[504,2200]]) {
    const view = portraitProjection(width,height), splash = view.catapultSplashSize();
    const twoSoldiers = view.unitSize * 2 * 76 / 128;
    assert.ok(splash.width > 0 && splash.height > 0);
    assert.ok(splash.width + 2 <= twoSoldiers && splash.height + 2 <= twoSoldiers);
  }
});

test('facing points the native weapon direction toward front, rear and lateral targets on either side', () => {
  for (const side of ['player', 'enemy'] as Side[]) for (const [dx, dy] of [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]]) {
    const facing = targetFacing({ x: 50, y: 50 }, { x: 50 + dx, y: 50 + dy }, side);
    const native = side === 'player' ? -1 : 1;
    const forward = { x: -Math.sin(facing) * native, y: Math.cos(facing) * native };
    assert.ok(Math.abs((forward.x * dx + forward.y * dy) / Math.hypot(dx, dy) - 1) < 1e-8);
    assert.ok(Number.isFinite(targetFacing({x:0,y:0}, {x:0,y:0}, side)));
  }
});

test('touching melee silhouettes remain distinct on short boards without mutating combat positions', () => {
  for (const [width, height] of [[304,190],[374,430],[504,500]]) for (const kind of ['soldier', 'knight'] as UnitKind[]) {
    const actors = [{ id:1, side:'player' as Side, kind, x:700, row:1 }, { id:2, side:'enemy' as Side, kind, x:716, row:1 }];
    const before = structuredClone(actors), layout = combatLayout(actors, width, height), a = layout.get(1)!, b = layout.get(2)!;
    assert.deepEqual(actors, before); assert.ok(a.y > b.y);
    const distance = Math.hypot(a.x-b.x, a.y-b.y), contact = meleeContactPixels(kind,kind,portraitProjection(width,height).unitSize);
    assert.ok(distance >= portraitProjection(width,height).unitSize*unitScale(kind)*.45 && distance <= contact+.1);
    assert.deepEqual(combatLayout([...actors].reverse(), width, height), layout);
  }
});

function combatFixture(count: number) {
  const battle = new Battle(); battle.start(); battle.aiEnabled = false;
  for (const side of ['player', 'enemy'] as Side[]) for (let i = 0; i < count; i++) {
    battle.armies[side].food = 10000;
    battle.armies[side].cooldowns.soldier = 0;
    assert.ok(battle.summon(side, 'soldier'));
    Object.assign(battle.units.at(-1)!, {
      x: (side === 'player' ? 580 : 860) + (side === 'player' ? -1 : 1) * Math.floor(i / 3) * 12,
      row: count === 1 ? 1 : i % 3, attackCooldown: 0,
    });
  }
  return battle;
}

test('a duel visibly closes throughout its approach instead of stopping before melee range', () => {
  for (const [width, height] of [[254,240], [314,520], [444,560]]) {
    const battle = combatFixture(1), layout = new CombatLayout();
    const [a, b] = battle.units;
    let previous = layout.update(battle.units, width, height, battle.time);
    for (let frame = 0; frame < 100 && a.attackAt < 0; frame++) {
      battle.step(1 / 30);
      const current = layout.update(battle.units, width, height, battle.time);
      if (a.attackAt < 0) {
        const before = Math.hypot(previous.get(a.id)!.x - previous.get(b.id)!.x, previous.get(a.id)!.y - previous.get(b.id)!.y);
        const after = Math.hypot(current.get(a.id)!.x - current.get(b.id)!.x, current.get(a.id)!.y - current.get(b.id)!.y);
        assert.ok(before - after > .01, `${width}px duel stopped approaching at ${battle.time}s`);
      }
      previous = current;
    }
    assert.ok(a.attackAt > 0 && b.attackAt > 0);
    const p = previous.get(a.id)!, q = previous.get(b.id)!;
    assert.ok(Math.hypot(p.x-q.x,p.y-q.y) <= meleeContactPixels(a.kind,b.kind,portraitProjection(width,height).unitSize)+.1);
  }
});

test('crowd movement and deaths do not reshuffle existing puppets or change combat state', () => {
  for (const [width, height] of [[254,240], [314,520]]) {
    const battle = combatFixture(24), layout = new CombatLayout();
    let previous = layout.update(battle.units, width, height, battle.time);
    for (let frame = 0; frame < 300; frame++) {
      battle.step(1 / 30);
      const before = structuredClone(battle.units);
      const current = layout.update(battle.units, width, height, battle.time);
      assert.deepEqual(battle.units, before);
      for (const [id, point] of current) {
        const old = previous.get(id);
        if (old) assert.ok(Math.hypot(point.x - old.x, point.y - old.y) < 4, `unit ${id} jumped at ${battle.time}s`);
      }
      for (const unit of battle.units.filter(u=>u.attacking)) {
        const target = battle.units.find(u=>u.id===unit.targetId);
        if (!target) continue;
        const p=current.get(unit.id)!,q=current.get(target.id)!;
        assert.ok(Math.hypot(p.x-q.x,p.y-q.y) <= meleeContactPixels(unit.kind,target.kind,portraitProjection(width,height).unitSize)+.2,
          `unit ${unit.id} attacked with a visible gap at ${battle.time}s`);
      }
      previous = current;
    }
    assert.ok(battle.units.length < 48, 'the scenario must include casualties');
  }
});

test('layout preserves knockback, freezes at unchanged time and resets on resize or restart', () => {
  const actors = [{ id: 1, side: 'enemy' as Side, kind: 'soldier' as UnitKind, x: 700, row: 1 }];
  const layout = new CombatLayout(), view = portraitProjection(314,520);
  const first = layout.update(actors,314,520,0).get(1)!;
  actors[0].x += 90;
  const moved = layout.update(actors,314,520,1/30), point = moved.get(1)!;
  assert.ok(Math.abs(point.y-first.y - (view.project(790).y-view.project(700).y)) < 1e-8, 'real knockback must not be eased away');
  assert.deepEqual(layout.update(actors,314,520,1/30),moved);
  assert.deepEqual(layout.update(actors,254,240,1/30),combatLayout(actors,254,240));
  actors.push({ id:2, side:'player', kind:'soldier', x:780, row:1 });
  assert.deepEqual(layout.update(actors,254,240,2),combatLayout(actors,254,240));
  layout.reset();
  assert.deepEqual(layout.update(actors,254,240,0),new CombatLayout().update(actors,254,240,0));
});

test('small target-angle fluctuations do not flip body art, while deliberate turns still work', () => {
  const forward = (x: number, ySign = 1) => ({ x, y: ySign * Math.sqrt(1-x*x) });
  for (const sign of [-1,1]) for (const start of [-.14,-.1,.46,.5]) {
    let previous = directionArt(forward(start,sign));
    const initial = previous;
    const center = start < 0 ? -.12 : .48;
    for (let frame = 0; frame < 60; frame++) {
      previous = directionArt(forward(center + Math.sin(frame)*.025,sign),previous);
      assert.deepEqual(previous,initial);
    }
    previous = directionArt(forward(-.8,sign),previous);
    assert.deepEqual(previous,{look:'side',mirror:-1});
    previous = directionArt(forward(.8,sign),previous);
    assert.deepEqual(previous,{look:'side',mirror:1});
    previous = directionArt(forward(0,sign),previous);
    assert.deepEqual(previous,{look:sign>0?'front':'back',mirror:1});
  }
});

test('body ignores brief shoulder crossings during contact but completes sustained turns', () => {
  const body=new BodyDirection();
  const original=body.update({x:0,y:-1},0);
  for(let frame=1;frame<=60;frame++) {
    const pose=body.update({x:frame%2 ? -1 : 1,y:0},frame/30);
    assert.deepEqual(pose,original);
  }
  for(let frame=61;frame<=65;frame++) body.update({x:-1,y:0},frame/30);
  assert.deepEqual(body.update({x:-1,y:0},2.2),{look:'side',mirror:-1});
  assert.equal(body.turning,false);
  const pose=body.update({x:0,y:1},2.2);
  assert.deepEqual(body.update({x:0,y:1},2.2),pose,'paused time cannot turn a body');
  assert.deepEqual(body.update({x:0,y:1},2.5),{look:'front',mirror:1});
});
