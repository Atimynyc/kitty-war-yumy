import type { CatMood } from './base-dialogue.ts';
import type { CatAppearance } from './cat-appearance.ts';

/** All coat regions are separate shapes so the future editor can recolor them independently. */
export function baseCatSVG(appearance: CatAppearance, mood: CatMood = 'calm', chubby = false) {
  const c = appearance.coat, ink = '#695343';
  const body = chubby ? 'M36 75Q12 83 14 116q2 31 64 32 63 0 67-29 4-30-30-45Z' : 'M49 77q-20 17-18 43 1 27 47 28 47-1 49-27 1-28-22-44Z';
  const head = appearance.breed === 'british-shorthair'
    ? 'M37 52 39 22l22 13q20-7 38 0l22-13 2 31q9 14 3 28-8 23-46 23-40 0-48-23-5-15 5-29Z'
    : 'M33 53 33 18l26 17q22-7 42 0l25-17 1 35q12 20 2 34-12 18-49 18-39 0-51-20-8-15 4-32Z';
  const eyes = mood === 'happy'
    ? '<path d="M48 67q7-10 14 0m36 0q7-10 14 0" fill="none" stroke-width="4"/>'
    : `<ellipse cx="55" cy="67" rx="4.2" ry="6" fill="${appearance.eyes}" stroke="none"/><ellipse cx="105" cy="67" rx="4.2" ry="6" fill="${appearance.eyes}" stroke="none"/>
      <path d="M56 64h.1m50 0h.1" stroke="#fff8eb" stroke-width="2.4"/>
      ${mood === 'worried' ? '<path d="m46 55 15 5m38 0 15-5" fill="none" stroke-width="3.4"/>' : ''}`;
  const mouth = mood === 'happy' || mood === 'hungry'
    ? `<path d="M69 84q11 6 22 0-1 15-11 15-9 0-11-15Z" fill="#88594c" stroke-width="2"/><path d="M74 93q6-5 13 0-7 8-13 0" fill="#e7a3a0" stroke="none"/>
      ${mood === 'hungry' ? '<path d="M92 89q10 10 3 14-7 0-3-14Z" fill="#c2e4df" stroke-width="1.6"/>' : ''}`
    : mood === 'worried'
    ? '<path d="M71 91q9-11 18 0" fill="none" stroke-width="2.6"/>'
    : '<path d="M80 83v5m0 0q-5 7-12 1m12-1q5 7 12 1" fill="none" stroke-width="2.2"/>';
  const paw = (x: number, y: number, tilt: number) => `<g transform="rotate(${tilt} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="12" ry="16" fill="${c.paws}"/><path d="M${x-4} ${y+6}v3m7-3v3" stroke="${c.markings}" stroke-width="1.5"/></g>`;
  const hands = mood === 'happy' ? paw(23, 95, -35) + paw(137, 95, 35)
    : mood === 'worried' ? paw(56, 119, -35) + paw(104, 119, 35)
    : paw(chubby ? 35 : 44, 114, -12) + paw(chubby ? 126 : 116, 114, 12);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g stroke="${ink}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="81" cy="149" rx="68" ry="9" fill="#79634e" opacity=".16" stroke="none"/>
    <path d="M38 132Q5 142 8 113q2-15 13-11 10 3 3 15" fill="none" stroke="${ink}" stroke-width="17"/>
    <path d="M38 132Q5 142 8 113q2-15 13-11 10 3 3 15" fill="none" stroke="${c.tail}" stroke-width="11"/>
    <path d="M9 118h10m-7 10 8-4" stroke="${c.markings}" stroke-width="3"/>
    <path d="${body}" fill="${c.body}"/>
    <ellipse cx="81" cy="119" rx="${chubby ? 42 : 30}" ry="27" fill="${c.belly}" stroke="none"/>
    <ellipse cx="49" cy="144" rx="20" ry="9" fill="${c.paws}"/><ellipse cx="112" cy="144" rx="20" ry="9" fill="${c.paws}"/>
    <path d="M44 145v3m8-3v3m55-3v3m8-3v3" stroke="${c.markings}" stroke-width="1.8"/>
    <path d="m47 90 66 1-11 16-20-5-21 5Z" fill="${appearance.scarf}"/>
    <path d="m99 103 11 14-16 1-5-14" fill="${appearance.scarf}"/>
    <path d="${head}" fill="${c.head}"/>
    <path d="m39 31 1 19 12-10m55 0 13-9-1 20" fill="${c.ears}" stroke="none"/>
    ${appearance.breed === 'ragdoll' ? `<path d="m32 75-8 6 10 3-6 8 15-2m85-15 8 6-10 3 6 8-15-2" fill="${c.head}"/>` : ''}
    <path d="m65 36 4 12m11-14v14m14-12-4 12M33 62l10 3m-12 8 11 2m85-13-10 3m12 8-11 2" stroke="${c.markings}" stroke-width="4"/>
    <path d="M49 80q7-9 21-4 10-5 20 0 15-6 22 5 5 15-31 17-34-2-32-18Z" fill="${c.muzzle}" stroke="none"/>
    ${eyes}<path d="m75 78 5 5 5-5q-5-4-10 0" fill="#c17f76" stroke="none"/>${mouth}
    <path d="m35 83-15-3m16 10-13 3m102-10 15-3m-16 10 13 3" fill="none" stroke-width="1.7"/>
    <ellipse cx="43" cy="81" rx="7" ry="3.5" fill="#e3a38a" opacity=".7" stroke="none"/><ellipse cx="117" cy="81" rx="7" ry="3.5" fill="#e3a38a" opacity=".7" stroke="none"/>
    <g><path d="M63 116h35v24q-17 9-35 0Z" fill="${chubby ? '#d5b184' : '#91ad90'}"/><ellipse cx="80.5" cy="116" rx="17.5" ry="5" fill="#fff0c9"/>
      <path d="M72 113v-5h16v5" fill="none" stroke-width="2"/>
      <path d="M74 132q0-7 6-7t7 7q0 5-7 2-6 3-6-2Z" fill="#fff3cf" stroke="none"/>
      <path d="M72 125h.1m5-4h.1m6 0h.1m6 4h.1" stroke="#fff3cf" stroke-width="3"/></g>
    ${hands}
  </g></svg>`;
}
