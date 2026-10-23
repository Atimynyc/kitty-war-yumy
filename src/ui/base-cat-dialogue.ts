import type { Battle } from '../game/simulation.ts';
import { baseCatLayout } from '../game/base-cat-layout.ts';

export function installBaseCatDialogue(battle: Battle) {
  const bubble = document.getElementById('enemy-cat-speech')!;
  const canvas = document.getElementById('battle-canvas')!;
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const { bubble: at } = baseCatLayout(box.width, box.height);
    const gutter = canvas.parentElement!.clientWidth - box.width;
    bubble.style.right = `${at.right + gutter}px`; bubble.style.top = `${at.top}px`; bubble.style.width = `${at.width}px`;
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  return () => {
    const speech = battle.baseDialogue.snapshot(battle.time);
    const text = battle.phase === 'ready' || battle.phase === 'ended' || battle.boss.spawned ? '' : speech.text;
    if (bubble.textContent !== text) {
      const split = speech.cue === 'opening' ? text.indexOf('！') + 1 : speech.cue === 'protect' ? text.indexOf('都') : -1;
      const lines = split > 0 ? [text.slice(0, split), text.slice(split)] : [text];
      bubble.replaceChildren(...lines.map(line => {
        const span = document.createElement('span'); span.textContent = line; return span;
      }));
    }
    // Spell effects take precedence while their short captions are visible.
    bubble.hidden = !text || battle.spellNotices.visible(battle.time).length > 0; bubble.dataset.mood = speech.mood;
  };
}
