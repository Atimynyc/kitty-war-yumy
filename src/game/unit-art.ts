import type { Side, UnitKind } from './content.ts';
import { driedFish, teaserWand } from './weapon-art.ts';
import { knightParts } from './knight-art.ts';

export type PartName = 'body' | 'leftFoot' | 'rightFoot' | 'rearLeftFoot' | 'rearRightFoot' | 'rider' | 'leftHand' | 'rightHand';
export interface UnitPart { name: PartName; x: number; y: number; svg: string }
const wrap = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#655345" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;
export const unitShadowSVG = wrap('<ellipse cx="64" cy="108" rx="38" ry="9" fill="#796850" opacity=".17" stroke="none"/>');
export const unitStarsSVG = wrap('<g fill="#ffe39a" stroke="#bc965c" stroke-width="1.5"><path d="m30 25 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"/><path d="m75 17 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/></g>');

/** All parts share a canvas; each supplied pivot is the hand/ankle/body attachment. */
export function unitParts(kind: UnitKind, side: Side): UnitPart[] {
  if (kind === 'knight') return knightParts(side);
  const friendly = side === 'player';
  const fur = friendly ? '#f5d19a' : '#ddd0e9', accent = friendly ? '#80a38a' : '#a494b9';
  const part = (name: PartName, x: number, y: number, content: string): UnitPart => ({ name, x, y, svg: wrap(content) });
  const wheel = (x: number) => `<rect x="${x - 8}" y="75" width="16" height="32" rx="6" fill="#a48867"/><path d="M${x - 5} 82h10m-10 8h10m-10 8h10" stroke="#dfc79f"/>`;
  if (kind === 'mouse') return [
    part('leftFoot', 37, 91, wheel(37)), part('rightFoot', 91, 91, wheel(91)),
    part('body', 64, 76, `<path d="M64 101q-20 23-30 5" fill="none" stroke="#ce9a8e" stroke-width="5"/><ellipse cx="64" cy="75" rx="29" ry="31" fill="#cec1b5"/><path d="M40 54q8-23 24-29 18 9 25 29" fill="#cec1b5"/><circle cx="38" cy="52" r="14" fill="#e3b6ad"/><circle cx="90" cy="52" r="14" fill="#e3b6ad"/><circle cx="64" cy="25" r="5" fill="#d99491"/><path d="M53 42v3m22-3v3" stroke-width="4"/><path d="M42 77h44v10H42Z" fill="${accent}"/>`),
    part('rightHand', 64, 67, '<path d="M61 74V61h-8v-9h22v9h-8v13" fill="#e7c285"/>'),
  ];
  if (kind === 'catapult') return [
    part('leftFoot', 27, 91, wheel(27)), part('rightFoot', 101, 91, wheel(101)),
    part('body', 64, 80, `<path d="M34 58h60v42H34Z" fill="#c8a375"/><path d="M41 59V49h46v10" fill="#e4c28e"/><path d="m48 97 1-16 13 9 14-9 2 18q-2 19-16 17-16 1-14-19" fill="${fur}"/><path d="M55 99v3m14-3v3"/>`),
    part('rightHand', 64, 75, `<path d="M64 78V31" stroke="#957354" stroke-width="10"/><path d="m48 35 4-17h24l4 17Z" fill="#e5c599"/><circle cx="64" cy="25" r="14" fill="${accent}"/><path d="m54 17 18 17m-22-9 19 14" stroke="#fbefce" stroke-width="2"/>`),
  ];
  const hat = kind === 'mage'
    ? '<path d="m29 42 28-35 14 12 13 22Z" fill="#a89aca"/><path d="M24 43q37-12 76 0l-3 7H27Z" fill="#c9bce4"/><path d="m58 23 3-6 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4Z" fill="#ffe3a1" stroke-width="1.5"/>'
    : kind === 'shield'
    ? '<path d="m30 45 2-24 31-9 34 14-2 23Z" fill="#c6a77b"/><path d="M63 15v28" stroke="#e5c798" stroke-width="7"/>'
    : kind === 'healer'
      ? '<path d="m29 46 5-24 30-9 30 10 4 23Z" fill="#fff7e8"/><path d="M64 23v16m-8-8h16" stroke="#cf8f85" stroke-width="5"/>'
      : `<path d="M28 47q1-29 36-31 34 2 36 31Z" fill="${accent}"/><path d="M29 47h70" stroke-width="4"/>${kind === 'soldier' ? '<path d="M64 21v20" stroke="#d3debf" stroke-width="5"/>' : ''}`;
  const face = friendly
    ? '<path d="m47 59 5 6m10-10 3 7m12-5-3 7" stroke="#c6a076"/><path d="M46 79q18 6 36 0" fill="none" stroke="#d3b183" stroke-width="2"/>'
    : '<path d="M47 61v5m34-5v5" stroke-width="4"/><path d="m59 72 5 3 5-3" fill="#c18c93"/><path d="M64 76q-6 7-12 1m12-1q6 7 12 1" fill="none" stroke-width="2"/><ellipse cx="39" cy="73" rx="6" ry="3" fill="#c5afd2" stroke="none"/><ellipse cx="89" cy="73" rx="6" ry="3" fill="#c5afd2" stroke="none"/>';
  const paw = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="10" fill="${fur}"/><path d="M${x - 3} ${y + 2}v3m6-3v3" stroke-width="1.5"/>`;
  // Enemy equipment points down the lane; the character keeps its front-facing art.
  const weapon = (content: string) => friendly ? content : `<g transform="translate(103 84) rotate(180) scale(.75) translate(-103 -84)">${content}</g>`;
  let left = paw(23, 84), right = '';
  if (kind === 'soldier') right = weapon(driedFish(103, 56)) + paw(103, 84);
  if (kind === 'mage') right = weapon(teaserWand(101, 58)) + paw(103, 84);
  if (kind === 'shield') right = `<path d="m95 64 25 7-3 29-18 8-14-21Z" fill="#d7b58a"/><path d="m100 69 5 30" stroke="#ead0a8" stroke-width="6"/><path d="m94 83 7 7 10-12" fill="none" stroke="#83996f" stroke-width="3"/>`;
  if (kind === 'slinger') {
    left = '<circle cx="23" cy="80" r="10" fill="#d8a391"/><path d="m18 72 10 15m-13-8 14 9" stroke="#f6e1cd" stroke-width="1.5"/>' + paw(23, 89);
    right = weapon('<path d="M103 87V63L92 49m11 14 12-14" fill="none" stroke="#ac875e" stroke-width="6"/><path d="m92 49 11 23 12-23" fill="none" stroke="#d8ba8c" stroke-width="2"/>') + paw(103, 84);
  }
  if (kind === 'healer') right = weapon('<path d="M103 89V51" stroke="#a88d66" stroke-width="5"/><path d="M103 54q-20-11-12-20 7-5 12 3 8-9 14-2 8 10-14 19" fill="#e4a39a"/>') + paw(103, 84);
  return [
    part('leftFoot', 46, 108, `<ellipse cx="46" cy="108" rx="12" ry="8" fill="${fur}"/><path d="M42 108v3m7-3v3" stroke-width="1.5"/>`),
    part('rightFoot', 81, 108, `<ellipse cx="81" cy="108" rx="12" ry="8" fill="${fur}"/><path d="M77 108v3m7-3v3" stroke-width="1.5"/>`),
    part('body', 64, 86, `<path d="M79 88q19 14 21 1" fill="none" stroke="${fur}" stroke-width="7"/><path d="M43 73q-6 12-2 24h46q4-13-3-24Z" fill="${kind === 'mage' ? '#b4a4d3' : kind === 'healer' ? '#fff6e7' : fur}"/><path d="M42 89h45v8H42Z" fill="${kind === 'mage' ? '#eee1ad' : accent}"/><path d="m29 45 1-27 22 14q12-4 25 0l20-15 1 29q8 19-4 31-14 16-37 13-32 0-31-30Z" fill="${fur}"/>${face}${hat}`),
    part('leftHand', 23, 84, left), part('rightHand', 103, 84, right),
  ];
}
