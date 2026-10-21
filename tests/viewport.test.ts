import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseLayout } from '../src/ui/viewport.ts';
import { portraitProjection } from '../src/game/projection.ts';
import { BASE_X } from '../src/game/content.ts';

test('phones, portrait tablets, landscape handsets and desktop windows choose appropriate layouts', () => {
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [540, 720], [768, 1024], [1024, 1366]]) assert.equal(chooseLayout(width, height), 'portrait');
  for (const [width, height] of [[568, 320], [844, 390], [932, 430], [1024, 768], [1280, 600]]) assert.equal(chooseLayout(width, height), 'compact-landscape');
  for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080]]) assert.equal(chooseLayout(width, height), 'desktop');
});

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
    assert.ok(view.unitSize >= 28 && view.unitSize <= 50);
  }
});
