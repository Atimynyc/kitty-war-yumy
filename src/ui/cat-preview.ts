import { baseCatParts } from '../game/base-cat-art.ts';
import { baseCatMotion } from '../game/base-cat-motion.ts';
import { catSignature } from '../game/cat-appearance.ts';
import type { CatAppearance } from '../game/cat-appearance.ts';

type TouchPart = 'head' | 'chin' | 'ears' | 'paws' | 'belly' | 'tail';
const reactions: Record<TouchPart, { label: string; text: string; duration: number }> = {
  head: { label: '摸摸头', text: '眯起眼睛，轻轻蹭蹭你的手', duration: 1500 },
  chin: { label: '挠挠下巴', text: '抬起下巴，舒服地眯着眼', duration: 1600 },
  ears: { label: '轻碰耳朵', text: '耳朵抖了抖，侧头看向你', duration: 1050 },
  paws: { label: '轻碰爪子', text: '轻轻缩回小爪子，再慢慢放下', duration: 1250 },
  belly: { label: '轻碰肚皮', text: '收起爪子护住肚皮：这里先不摸哦', duration: 1400 },
  tail: { label: '轻碰尾巴', text: '尾巴轻甩一下，回头看看你', duration: 1150 },
};
const touchHint = '试着摸摸头、下巴或小爪子';

/** The home companion and editor use the same layers, poses and real-time clock. */
export function installCatPreview(preview: HTMLElement, options: { interactive?: boolean; onReaction?: (text: string) => void } = {}) {
  let nodes: Record<string, SVGGElement> = {}, signature = '';
  let active = false, moving = true, frame = 0;
  let reaction: { part: TouchPart; started: number } | null = null;
  let reactionTimer = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function clearReaction() {
    clearTimeout(reactionTimer);
    reaction = null;
    delete preview.dataset.reaction;
    options.onReaction?.(touchHint);
  }
  function pose(now: number) {
    const m = baseCatMotion(now / 1000, 'player', 'calm', 0, !moving || reduced.matches);
    let tuck = 0, feet = 0;
    if (reaction && moving && !reduced.matches) {
      const t = Math.min(1, (now - reaction.started) / reactions[reaction.part].duration);
      // Ease into a short held response, then settle back into the shared idle pose.
      const smooth = (v: number) => v * v * (3 - 2 * v);
      const strength = t < .2 ? smooth(t / .2) : t > .58 ? smooth((1 - t) / .42) : 1;
      const flick = Math.sin(t * Math.PI * 5) * strength;
      switch (reaction.part) {
        case 'head': m.headAngle -= 12 * strength; m.headX -= 6 * strength; m.headY += 3 * strength; m.blink = Math.max(m.blink, .88 * strength); break;
        case 'chin': m.headY -= 12 * strength; m.headAngle += 5 * strength; m.blink = Math.max(m.blink, .92 * strength); break;
        case 'ears': m.leftEarAngle -= 23 * flick; m.rightEarAngle += 15 * flick; m.headAngle += 9 * strength; break;
        case 'paws': m.pawLift += 14 * strength; feet = 5 * strength; m.headY += 3 * strength; break;
        case 'belly': tuck = .12 * strength; m.pawLift += 10 * strength; m.headY += 6 * strength; m.leftEarAngle -= 9 * strength; m.rightEarAngle += 9 * strength; break;
        case 'tail': m.tailAngle += 30 * flick; m.headAngle -= 15 * strength; m.headX -= 8 * strength; m.leftEarAngle -= 12 * strength; break;
      }
    }
    const set = (key: string, value: string) => nodes[key]?.setAttribute('transform', value);
    set('body', `translate(80 144) rotate(${m.bodyAngle}) scale(${1 + m.breath * .55 - tuck * .3} ${1 + m.breath - tuck}) translate(-80 -144)`);
    set('headGroup', `translate(${m.headX} ${m.headY}) rotate(${m.headAngle} 80 92)`);
    set('tail', `rotate(${m.tailAngle} 38 132)`);
    set('leftEar', `rotate(${m.leftEarAngle} 46 49)`); set('rightEar', `rotate(${m.rightEarAngle} 114 49)`);
    set('eyes', `translate(0 67) scale(1 ${1 - m.blink * .94}) translate(0 -67)`);
    set('scarf', `translate(0 ${m.headY * .35})`);
    set('hands', `translate(80 ${-m.pawLift}) scale(${1 - tuck} 1) translate(-80 0)`); set('jar', `translate(0 ${-m.pawLift * .25})`);
    set('feet', `translate(0 ${-feet})`);
  }
  function animate(now: number) {
    pose(now);
    frame = requestAnimationFrame(animate);
  }
  function refresh() {
    cancelAnimationFrame(frame);
    if (!active || document.hidden || reduced.matches || !moving) clearReaction();
    if (!active || document.hidden) return;
    pose(performance.now());
    if (moving && !reduced.matches) frame = requestAnimationFrame(animate);
  }
  function touch(event: Event) {
    const target = event.target instanceof Element ? event.target.closest<SVGElement>('[data-cat-touch]') : null;
    if (!options.interactive || !active || document.hidden || !target) return;
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const part = target.dataset.catTouch as TouchPart, now = performance.now();
    // One response at a time; repeated taps never queue or prolong the animation.
    if (reaction) return;
    reaction = { part, started: now };
    preview.dataset.reaction = part;
    options.onReaction?.(reactions[part].text);
    pose(now);
    reactionTimer = window.setTimeout(() => { clearReaction(); if (active && !document.hidden) pose(performance.now()); }, reactions[part].duration);
  }
  if (options.interactive) {
    preview.addEventListener('click', touch);
    preview.addEventListener('keydown', touch);
  }
  if (reduced.addEventListener) reduced.addEventListener('change', refresh);
  else reduced.addListener(refresh);
  document.addEventListener('visibilitychange', refresh);
  return {
    setAppearance(cat: CatAppearance) {
      const next = catSignature(cat);
      if (next === signature) return;
      clearReaction();
      signature = next;
      const parts = baseCatParts(cat), head = ['leftEar', 'rightEar', 'head', 'eyes'];
      const markup = (name: string) => { const p = parts.find(p => p.name === name)!; return `<g data-preview-part="${p.name}">${p.svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`; };
      preview.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" ${options.interactive ? 'role="group" aria-label="猫咪互动，轻轻触碰不同部位"' : 'aria-hidden="true"'}>${parts.filter(p => !head.includes(p.name) && !['jar', 'hands'].includes(p.name)).map(p => markup(p.name)).join('')}<g data-preview-part="headGroup">${head.map(markup).join('')}${options.interactive ? '<ellipse class="cat-touch-zone" data-cat-touch="chin" cx="80" cy="95" rx="21" ry="9" />' : ''}</g>${markup('jar')}${markup('hands')}</svg>`;
      nodes = Object.fromEntries(Array.from(preview.querySelectorAll<SVGGElement>('[data-preview-part]')).map(n => [n.dataset.previewPart!, n]));
      if (options.interactive) {
        const targets: Record<string, TouchPart> = { head: 'head', eyes: 'head', leftEar: 'ears', rightEar: 'ears', hands: 'paws', feet: 'paws', body: 'belly', tail: 'tail' };
        for (const [name, part] of Object.entries(targets)) nodes[name].dataset.catTouch = part;
        const seen = new Set<TouchPart>();
        preview.querySelectorAll<SVGElement>('[data-cat-touch]').forEach(node => {
          const part = node.dataset.catTouch as TouchPart;
          node.classList.add('cat-touch-part');
          if (!seen.has(part)) {
            node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0');
            node.setAttribute('aria-label', reactions[part].label); seen.add(part);
          }
        });
      }
      pose(performance.now());
    },
    setActive(value: boolean) { if (active === value) return; active = value; refresh(); },
    setMoving(value: boolean) { moving = value; refresh(); },
    snapshot: () => ({ active, reaction: reaction?.part ?? null, reducedMotion: reduced.matches }),
    dispose() {
      active = false; cancelAnimationFrame(frame); clearReaction();
      preview.removeEventListener('click', touch); preview.removeEventListener('keydown', touch);
      if (reduced.removeEventListener) reduced.removeEventListener('change', refresh);
      else reduced.removeListener(refresh);
      document.removeEventListener('visibilitychange', refresh);
    },
  };
}
