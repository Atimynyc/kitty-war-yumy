import { baseCatParts } from '../game/base-cat-art.ts';
import type { BaseCatPartName } from '../game/base-cat-art.ts';
import type { CatAppearance } from '../game/cat-appearance.ts';

export type ResultCatMood = 'happy' | 'sad' | 'calm';

/** Reuse the saved cat's coat and anatomy; only the result pose changes. */
export function resultCatMarkup(cat: CatAppearance, mood: ResultCatMood, entrance: boolean) {
  const parts=baseCatParts(cat,mood==='sad'?'worried':mood);
  const part=(name: BaseCatPartName)=>{
    const p=parts.find(p=>p.name===name)!;
    return `<g class="result-cat-${name}" style="transform-origin:${p.x}px ${p.y}px">${p.svg.replace(/^<svg[^>]*>|<\/svg>$/g,'')}</g>`;
  };
  const colors=['#d99b76','#93ad8b','#ebc568','#a9bed0','#c4a7c2'];
  const confetti=mood==='happy' && entrance ? `<div class="result-confetti" aria-hidden="true">${Array.from({length:22},(_,i)=>
    `<i style="left:${4+(i*37%93)}%;background:${colors[i%colors.length]};--drift:${(i%2?1:-1)*(12+i%5*7)}px;--turn:${(i%2?1:-1)*(200+i*29)}deg;animation-delay:${(i%7)*.1}s;animation-duration:${1.9+(i%4)*.1}s"></i>`).join('')}</div>` : '';
  const tears=mood==='sad'?'<g class="result-cat-tears" fill="#a9d5df" stroke="#78aaba" stroke-width="1.2"><path class="result-tear" d="M49 74q-3 7-3 9a3 3 0 0 0 6 0q0-2-3-9Z"/><path class="result-tear result-tear-later" d="M111 74q-3 7-3 9a3 3 0 0 0 6 0q0-2-3-9Z"/></g>':'';
  const label=mood==='happy'?'你的猫咪开心地举爪庆祝':mood==='sad'?'你的猫咪垂下耳朵，委屈地轻轻抽泣':'你的猫咪陪你等待下一次出发';
  return `<div class="result-mascot" data-mood="${mood}" data-entrance="${entrance}">${confetti}
    <svg class="result-cat" xmlns="http://www.w3.org/2000/svg" viewBox="-28 -24 216 192" role="img" aria-label="${label}">
      ${part('shadow')}<g class="result-cat-hop"><g class="result-cat-sway">
        ${part('tail')}${part('body')}${part('feet')}${part('scarf')}
        <g class="result-cat-head-group" style="transform-origin:80px 100px">${part('leftEar')}${part('rightEar')}${part('head')}${part('eyes')}${tears}</g>
        ${part('jar')}${part('hands')}
      </g></g>
    </svg>
  </div>`;
}
