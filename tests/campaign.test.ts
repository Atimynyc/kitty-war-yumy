import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, LEVELS, readProgress, serializeProgress, isLevelUnlocked, recommendedLevel, recordVictory, enemyPlan } from '../src/game/levels.ts';
import type { CampaignProgress } from '../src/game/levels.ts';
import { UNITS } from '../src/game/content.ts';
import * as content from '../src/game/content.ts';
import { Battle } from '../src/game/simulation.ts';
import { runPolicy } from '../scripts/global-balance.mjs';

test('campaign has thirty unique ordered stages, five per scene, with playable formations', () => {
  assert.equal(LEVELS.length, 30); assert.equal(CHAPTERS.length, 6);
  assert.equal(new Set(LEVELS.map(level => level.id)).size, 30);
  assert.equal(new Set(CHAPTERS.map(chapter => chapter.scene)).size, 6);
  for (const chapter of CHAPTERS) {
    const stages = LEVELS.filter(level => level.chapter === chapter.id);
    assert.equal(stages.length, 5);
    assert.deepEqual(stages.map(level => level.stage), [1,2,3,4,5].map(n => (chapter.id - 1) * 5 + n));
    assert.ok(stages.every(level => level.scene === chapter.scene));
  }
  for (const level of LEVELS) {
    assert.ok(level.cover && UNITS[level.cover]);
    assert.ok(level.grace >= 2 && level.interval > 0);
    for (const plan of [level, ...(level.phases ?? [])]) {
      assert.equal(plan.formations.length, 3);
      plan.formations.forEach((rotation, tier) => {
        assert.ok(rotation.length > 0);
        rotation.forEach(kind => assert.ok(UNITS[kind].tier <= tier + 1, `${level.id}: invalid ${kind} in tier ${tier + 1}`));
      });
    }
  }
  assert.deepEqual(LEVELS.filter(level => level.bossEncounter).map(level => level.stage), [30]);
});

test('clearance unlocks exactly the next stage, preserves best scores, and ends at stage thirty', () => {
  const progress: CampaignProgress = {};
  assert.equal(isLevelUnlocked('foreign', progress), false);
  assert.equal(recommendedLevel(progress).id, 'campaign-01');
  for (let i = 0; i < LEVELS.length; i++) {
    assert.equal(isLevelUnlocked(LEVELS[i].id, progress), true);
    if (i + 1 < LEVELS.length) assert.equal(isLevelUnlocked(LEVELS[i + 1].id, progress), false);
    recordVictory(progress, LEVELS[i], 1, 250);
    assert.equal(recommendedLevel(progress).id, LEVELS[Math.min(i + 1, 29)].id);
  }
  recordVictory(progress, LEVELS[0], 3000, 200);
  recordVictory(progress, LEVELS[0], 1499, 300);
  assert.deepEqual(progress['campaign-01'], { stars: 3, bestTime: 200, ratingVersion: 2 });
  const gap: CampaignProgress = { 'campaign-05': { stars: 3, bestTime: 100 } };
  assert.equal(isLevelUnlocked('campaign-06', gap), false, 'a later isolated record cannot skip uncleared stages');
});

test('old three-level records survive migration without unlocking or rating the new campaign', () => {
  const old = { sunroom: { stars: 3, bestTime: 60 }, cardboard: { stars: 2, bestTime: 180, ratingVersion: 2 }, pantry: { stars: 1, bestTime: 250, ratingVersion: 2 } };
  const migrated = readProgress(JSON.stringify(old));
  assert.deepEqual(migrated, old);
  assert.equal(isLevelUnlocked('campaign-02', migrated), false);
  recordVictory(migrated, LEVELS[0], 3000, 150);
  const serialized = serializeProgress(migrated);
  assert.deepEqual(JSON.parse(serialized).legacy, old);
  assert.equal(JSON.parse(serialized).version, 2);
  assert.deepEqual(readProgress(serialized), migrated);
  for (const raw of ['null', '[]', 'invalid', '{"version":2,"campaign":{"campaign-02":{"stars":4,"bestTime":10}}}', '{"campaign-01":{"stars":2,"bestTime":0}}']) assert.deepEqual(readProgress(raw), {});
});

test('time phases select real formation changes and pause cannot advance them', () => {
  const level = LEVELS[26];
  assert.equal(enemyPlan(level, 89.99).label, '锅盖阵地');
  assert.equal(enemyPlan(level, 90).label, '铃音迟缓');
  assert.equal(enemyPlan(level, 170).label, '零食攻城');
  const battle = new Battle(); battle.reset(level.id); battle.start(); battle.aiEnabled = false;
  battle.time = 89.99; battle.togglePause(); battle.step(1);
  assert.equal(enemyPlan(level, battle.time).label, '锅盖阵地');
  battle.reset(); assert.equal(enemyPlan(level, battle.time).label, '锅盖阵地');
});

test('teaching stages restrict enemy research and do not prematurely recruit late units', () => {
  for (const index of [0, 3, 7, 12, 15, 21]) {
    const battle = new Battle(); battle.reset(LEVELS[index].id); battle.start();
    battle.armies.player.hp = 1e9;
    const seen = new Set<string>();
    for (let frame = 0; frame < 30 * 240; frame++) {
      battle.step(1 / 30);
      assert.ok(battle.armies.enemy.food >= 0);
      assert.ok(battle.population('enemy') <= 24);
      assert.ok(battle.armies.enemy.tech <= battle.level.techCap!);
      for (const unit of battle.units) if (unit.side === 'enemy') seen.add(unit.kind);
      if (frame % (30 * 30) === 0) battle.units = [];
    }
    if (index < 7) assert.equal(seen.has('mage'), false);
    if (index < 12) assert.equal(seen.has('catapult'), false);
    if (index < 15) assert.equal(seen.has('healer'), false);
    if (index < 21) assert.equal(seen.has('knight'), false);
    if (index === 21) assert.equal(seen.has('knight'), true, 'the heavy-rider encounter must actually recruit a rider with normal income');
  }
});

test('every stage has a normal-resource sixteen-unit strategy that can clear it', () => {
  for (const level of LEVELS) {
    const attempts = [];
    for (const strategy of ['guns', 'siege', 'martial', 'support', 'infiltration']) {
      const result = runPolicy(Battle, content, level, strategy); attempts.push(result);
      if (result.winner === 'player' && result.seconds < 600) break;
    }
    assert.ok(attempts.some(result => result.winner === 'player' && result.seconds < 600), `${level.id}: ${JSON.stringify(attempts)}`);
    if (level.stage! <= 5) assert.equal(attempts[0].winner, 'player', 'the introductory chapter supports the baseline mixed strategy');
  }
});
