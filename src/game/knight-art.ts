import type { Side } from './content.ts';
import type { UnitPart } from './unit-art.ts';

/** Four separate dog paws, a mount, an armored rider and two mounted hands. */
export function knightParts(side: Side): UnitPart[] {
  const friendly = side === 'player';
  const fur = friendly ? '#f5d19a' : '#ded1ed';
  const dog = friendly ? '#cb945f' : '#b4a0bb';
  const dark = friendly ? '#94623f' : '#84738e';
  const accent = friendly ? '#6c9381' : '#9e7eaf';
  const metal = friendly ? '#cedad6' : '#d9d3e4';
  const part = (name: UnitPart['name'], x: number, y: number, content: string): UnitPart => ({ name, x, y,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="#655345" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>` });
  const paw = (x: number, y: number, rear = false) => `<path d="M${x - 5} ${y - 13}v11q-6 1-6 6h19q3-5-3-8v-9Z" fill="${rear ? dark : dog}"/><path d="M${x - 3} ${y + 2}v2m5-2v2" stroke="#f8e5bb" stroke-width="1.5"/>`;
  const lance = `<path d="M97 70 109 14" stroke="#9c7c52" stroke-width="5"/><path d="m107 19-3-9 9-7 3 11Z" fill="${metal}"/><path d="m107 23 14 5-15 7Z" fill="${accent}"/><path d="m95 58 10 2" stroke="#e4c27b" stroke-width="5"/>`;
  return [
    part('rearLeftFoot', 29, 100, paw(29, 100, true)),
    part('rearRightFoot', 47, 108, paw(47, 108, true)),
    part('leftFoot', 84, 105, paw(84, 105)),
    part('rightFoot', 104, 100, paw(104, 100)),
    part('body', 63, 85, `<path d="M31 83Q8 83 13 64q2-8 9-4 8 5-2 10" fill="none" stroke="${dog}" stroke-width="8"/><ellipse cx="59" cy="87" rx="35" ry="19" fill="${dog}"/><path d="M35 77h44l4 22H36Z" fill="${accent}"/><path d="m39 79 2 16h34l-2-16" fill="none" stroke="#e7cb84" stroke-width="3"/><path d="M43 72h29l5 8H39Z" fill="#916d52"/><ellipse cx="90" cy="76" rx="24" ry="22" fill="${dog}"/><path d="M72 59q-15 6-10 25 7 8 14-6Z" fill="${dark}"/><path d="M104 59q16 2 14 17-4 12-10 4Z" fill="${dark}"/><path d="M86 60q10-5 14 6l-2 17H85Z" fill="#f5e2bd" stroke="none"/><path d="M82 72v3m18-3v3" stroke-width="3.4"/><ellipse cx="92" cy="84" rx="15" ry="10" fill="#f5e2bd"/><path d="m88 80 9 1-5 5Z" fill="#655345"/><path d="M92 86q-5 5-10 1m10-1q5 5 9 1" fill="none" stroke-width="1.8"/><path d="M89 92q5 9 8 0" fill="#d99b92"/><path d="M77 96q13 7 26-2" fill="none" stroke="${accent}" stroke-width="5"/><circle cx="91" cy="100" r="4" fill="#e6c274"/>`),
    part('rider', 56, 53, `<path d="m40 58-7 12 4 9 10-2-1-11m23-8 8 12-2 9-10-2 1-11" fill="${metal}"/><path d="M42 42h28l5 17-18 12-20-11Z" fill="${metal}"/><path d="M57 47v20m-15-8 28 0" stroke="#9daea8" stroke-width="2"/><path d="m53 51 4-4 4 4-4 7Z" fill="#e6c274"/><path d="M34 23 35 8l14 9q9-3 18 0L79 8l1 18q4 20-23 22-26-1-23-25Z" fill="${fur}"/><path d="M33 25V13l14 6q11-7 21 0l12-8 2 18-8 7H41Z" fill="${metal}"/><path d="M39 30q18-8 36 0v6q-17 14-35 0Z" fill="${fur}"/><path d="M47 31v3m19-3v3" stroke-width="3.2"/><path d="m54 38 4 2 4-2" fill="none" stroke-width="1.7"/><path d="M57 20V9q5-10 14-4l-8 7v9" fill="${accent}"/><path d="M41 47h-8l-4 9 13 4m29-13h8l5 9-13 4" fill="${metal}"/><path d="M44 23h27" stroke="#f6f3df" stroke-width="2"/>`),
    part('leftHand', 33, 56, `<path d="m36 58 40 18" fill="none" stroke="#755c46" stroke-width="2"/><ellipse cx="33" cy="56" rx="7" ry="6" fill="${metal}"/>`),
    part('rightHand', 97, 57, `${friendly ? lance : `<g transform="translate(97 57) rotate(180) scale(.85) translate(-97 -57)">${lance}</g>`}<path d="m78 50 17 6" stroke="${metal}" stroke-width="7"/><ellipse cx="97" cy="57" rx="7" ry="6" fill="${metal}"/>`),
  ];
}
