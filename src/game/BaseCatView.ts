import Phaser from 'phaser';
import type { Battle } from './simulation.ts';
import type { Side } from './content.ts';
import { baseCatLayout } from './base-cat-layout.ts';

/** The enemy mascot leaves this spot when the final-level boss enters battle. */
export class BaseCatView {
  private cats: Record<Side, Phaser.GameObjects.Image>;
  constructor(scene: Phaser.Scene) {
    this.cats = {
      player: scene.add.image(0, 0, 'base-cat-player-calm').setOrigin(.5, 1).setDepth(5),
      enemy: scene.add.image(0, 0, 'base-cat-enemy-calm').setOrigin(.5, 1).setDepth(5),
    };
  }
  draw(battle: Battle, width: number, height: number, reduced: boolean) {
    const layout = baseCatLayout(width, height), speech = battle.baseDialogue.snapshot(battle.time);
    for (const side of ['player', 'enemy'] as const) {
      const at = layout[side], image = this.cats[side];
      image.setVisible(side !== 'enemy' || !battle.boss.spawned);
      const mood = side === 'enemy' ? speech.mood : 'calm';
      const animate = !reduced && battle.phase !== 'ready' && battle.phase !== 'ended';
      const breath = animate ? Math.sin(battle.time * 2.5 + (side === 'player' ? 2 : 0)) * .012 : 0;
      const hop = animate && mood === 'happy' ? Math.abs(Math.sin((battle.time - speech.startedAt) * 7)) * 3 : 0;
      image.setTexture(`base-cat-${side}-${mood}`).setPosition(at.x, at.y - hop)
        .setDisplaySize(at.size * (1 - breath * .4), at.size * (1 + breath));
    }
  }
}
