import { ORANGE_CAT } from './cat-appearance.ts';
import type { UnitLook, UnitPart } from './unit-art.ts';

/** The pantry mascot stands up: same coat, stripes and scarf, free sweeping paws. */
export function bossParts(look: UnitLook = 'front'): UnitPart[] {
  const c=ORANGE_CAT.coat,ink='#695343';
  const part=(name:UnitPart['name'],x:number,y:number,art:string):UnitPart=>({name,x,y,
    svg:`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="${ink}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${art}</g></svg>`});
  const face=look==='back'
    ? `<path d="m44 45 5 8m14-13v10m17-5-4 8" stroke="${c.markings}" stroke-width="3"/>`
    : look==='side'
      ? `<path d="m73 46 12 3m-7 5v5" stroke-width="3"/><path d="m95 61 7 3-8 5" fill="#c17f76"/><path d="M92 72q-8 5-13-1" fill="none"/>`
      : `<path d="m36 46 15 4m25 0 15-4" stroke-width="3"/><ellipse cx="45" cy="56" rx="3" ry="4" fill="${ORANGE_CAT.eyes}"/><ellipse cx="83" cy="56" rx="3" ry="4" fill="${ORANGE_CAT.eyes}"/><path d="M40 67q5-8 17-3 7-3 14 0 14-6 19 4 2 13-26 14-28-2-24-15" fill="${c.muzzle}" stroke="none"/><path d="m59 65 5 5 5-5" fill="#c17f76"/><path d="M64 71v4m0 0q-7 7-13 0m13 0q7 7 13 0" fill="none" stroke-width="1.8"/>`;
  const paw=(x:number)=>`<path d="M${x-8} 83q-8-3-8 5-3 7 3 9-1 12 13 13 13-1 14-13 6-4 2-10-1-7-8-5-4-7-9-2Z" fill="${c.paws}"/><path d="M${x-6} 100q0-6 6-8 7 2 7 8 0 6-7 3-6 3-6-3Z" fill="#d99d92" stroke="none"/><g fill="#d99d92" stroke="none"><ellipse cx="${x-9}" cy="91" rx="2.5" ry="3.5"/><ellipse cx="${x-3}" cy="86" rx="2.5" ry="3.5"/><ellipse cx="${x+4}" cy="86" rx="2.5" ry="3.5"/><ellipse cx="${x+10}" cy="92" rx="2.5" ry="3.5"/></g>`;
  return [
    part('leftFoot',43,110,`<ellipse cx="43" cy="110" rx="18" ry="9" fill="${c.paws}"/><path d="M38 110v4m8-4v4" stroke="${c.markings}" stroke-width="1.6"/>`),
    part('rightFoot',85,110,`<ellipse cx="85" cy="110" rx="18" ry="9" fill="${c.paws}"/><path d="M80 110v4m8-4v4" stroke="${c.markings}" stroke-width="1.6"/>`),
    part('body',64,80,`<path d="M29 100Q5 114 10 88q3-11 12-4" fill="none" stroke="${ink}" stroke-width="13"/><path d="M29 100Q5 114 10 88q3-11 12-4" fill="none" stroke="${c.tail}" stroke-width="8"/>
      <path d="M32 64Q12 76 20 98q4 18 44 17 43 0 46-20 6-22-17-32Z" fill="${c.body}"/>
      <ellipse cx="65" cy="91" rx="32" ry="23" fill="${look==='back'?c.body:c.belly}" stroke="none"/>
      <path d="m37 71 53 1-9 14-17-5-18 5Z" fill="${ORANGE_CAT.scarf}"/><path d="m81 82 8 13-12 1-6-11" fill="${ORANGE_CAT.scarf}"/>
      <path d="M28 39 28 12l21 14q16-5 31 0l21-14 1 27q9 16 2 28-10 18-40 17-31 1-41-17-5-13 5-28Z" fill="${c.head}"/>
      <path d="m34 22 1 15 11-7m36 0 12-8-1 16" fill="${c.ears}" stroke="none"/>
      <path d="m52 28 3 10m10-12v11m12-9-3 10m-48 9 9 3m-10 7 9 2m68-12-9 3m10 7-9 2" stroke="${c.markings}" stroke-width="3"/>
      ${face}<path d="m28 67-12-2m13 8-12 3m84-9 12-2m-12 8 12 3" stroke-width="1.5"/>`),
    part('leftHand',17,80,paw(17)),part('rightHand',109,80,paw(109)),
  ];
}
