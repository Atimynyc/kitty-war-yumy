import type { Side, UnitKind } from './game/content.ts';
import { driedFish, teaserWand } from './game/weapon-art.ts';
import { knightParts } from './game/knight-art.ts';
import { unitShadowSVG, unitParts } from './game/unit-art.ts';
import { bossParts } from './game/boss-art.ts';
import { enemyPortraitSVG } from './game/enemy-art.ts';
import { SPECIALIST_ORDER } from './game/content.ts';
import { basePreviewSVG } from './game/base-art.ts';

const wrap = (body: string, width = 120, height = 120) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g stroke="#604c41" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
export const svgURL = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
export const paw = `<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M8 24c0-5 5-11 8-11s8 6 8 11c0 6-6 3-8 3s-8 3-8-3Z"/><ellipse cx="5.5" cy="14" rx="3.5" ry="5" transform="rotate(-25 5 14)"/><ellipse cx="12" cy="7" rx="3.5" ry="5"/><ellipse cx="21" cy="7" rx="3.5" ry="5"/><ellipse cx="27" cy="15" rx="3.5" ry="5" transform="rotate(25 27 15)"/></svg>`;
export const icons = {
  details: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M8 16h8"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 3-.6 2.3-2 .9-2.2-.7-2.2 3.8 1.7 1.6v2.2l-1.7 1.6 2.2 3.8 2.2-.7 2 .9.6 2.3h5l.6-2.3 2-.9 2.2.7 2.2-3.8-1.7-1.6v-2.2l1.7-1.6-2.2-3.8-2.2.7-2-.9-.6-2.3Z"/><circle cx="12" cy="12" r="3.2"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4M12 14v4m-4 3h8m-7 0v-3h6v3"/><path d="m12 5 .8 1.7 1.9.3-1.4 1.3.4 1.9-1.7-.9-1.7.9.4-1.9L9.3 7l1.9-.3Z" fill="currentColor" stroke="none"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5Q7 2 3 4v15q5-2 9 1 4-3 9-1V4q-4-2-9 1Zm0 0v15M6 8l3 1m-3 3 3 1m6-4 3-1m-3 5 3-1"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 3 7 1 5 7-3 9-10 1-4-8Z" fill="currentColor" opacity=".28"/><path d="m8 3 7 1 5 7-3 9-10 1-4-8Z" stroke="currentColor" stroke-width="2"/><path d="m8 9 6-1 2 6-6 2Z" fill="currentColor"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v7L4 19q-1 2 2 2h12q3 0 2-2l-6-9V3M7 15h10"/><circle cx="10" cy="18" r="1" fill="currentColor"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 4-5 5H3v6h3l5 5ZM15 8q4 4 0 8M18 4q8 8 0 16"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 4-5 5H3v6h3l5 5ZM16 9l6 6m0-6-6 6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l14-8Z"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4q4 0 4 6"/></svg>',
};

export function unitSVG(kind: UnitKind, side: Side = 'player') {
  if (kind === 'boss') return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${unitShadowSVG}${bossParts().map(part=>part.svg).join('')}</svg>`;
  if (side === 'enemy') return enemyPortraitSVG(kind);
  if (kind === 'catapult' || SPECIALIST_ORDER.some(item => item === kind)) return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${unitShadowSVG}${unitParts(kind, side, 'front').map(part => part.svg).join('')}</svg>`;
  if (kind === 'knight') return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 128 128">${unitShadowSVG}${knightParts(side).map(part => part.svg).join('')}</svg>`;
  const fur = side === 'player' ? '#f7d7a1' : '#d9d0ea';
  const accent = side === 'player' ? '#769d88' : '#a18bb9';
  const ear = side === 'player' ? '#eeb3a3' : '#bcabd5';
  const shadow = '<ellipse cx="60" cy="107" rx="35" ry="6" fill="#655248" opacity=".12" stroke="none"/>';
  const cat = `<path d="M37 88q-23 2-19-15 2-9 8-4" fill="none" stroke="${fur}" stroke-width="11"/><path d="M39 72q-6 13-3 29h15l5-14 7 14h16l-2-29Z" fill="${fur}"/><path d="m30 42 2-25 20 13q13-3 24 1l16-14 1 30q7 10 1 24-9 17-33 14-31 1-33-18-3-15 2-25Z" fill="${fur}"/><path d="m36 32 1-9 9 8m33 2 9-9 1 14" fill="${ear}" stroke="none"/><path d="m56 30 3 8m7-8 1 8m8-7-2 7" stroke="#bf9874" stroke-width="3"/><path d="M44 54v5m32-5v5" stroke-width="4"/><path d="m57 63 4 3 4-3Z" fill="#bf8278" stroke="#bf8278"/><path d="M61 67q-3 6-8 2m8-2q3 6 8 2" fill="none" stroke-width="2"/><ellipse cx="40" cy="66" rx="7" ry="3.8" fill="${ear}" stroke="none"/><ellipse cx="81" cy="66" rx="7" ry="3.8" fill="${ear}" stroke="none"/><path d="m29 60-10-2m10 8-10 2m71-10 10-2m-10 10 10 2" stroke-width="1.8"/>`;
  if (kind === 'mouse') return wrap(`${shadow}<path d="M30 81Q4 79 15 60q8-9 12 3" fill="none" stroke="#d1a397" stroke-width="5"/><ellipse cx="61" cy="79" rx="34" ry="23" fill="#d2c6bc"/><path d="m77 64 28 19-27 13" fill="#d2c6bc"/><circle cx="51" cy="57" r="17" fill="#d2c6bc"/><circle cx="51" cy="57" r="10" fill="#e7bbb0" stroke="none"/><circle cx="83" cy="77" r="3" fill="#604c41" stroke="none"/><circle cx="105" cy="83" r="4" fill="#d99292"/><path d="m99 86 9 6m-9-11 9-5" stroke-width="1.5"/><circle cx="44" cy="100" r="8" fill="${accent}"/><circle cx="78" cy="100" r="8" fill="${accent}"/><path d="M64 59V43h-7v-8h17v8h-7" fill="#eac68e"/><path d="M54 83h17" stroke="#b4a699"/>`);
  let gear = '';
  if (kind === 'soldier') gear = `<path d="M30 40q0-27 32-28 28 0 30 28Z" fill="${accent}"/><path d="M28 40h65" stroke-width="4"/><path d="M60 17v17" stroke="#c6d8bb" stroke-width="5"/><path d="m36 80 37 1-4 11H41Z" fill="${accent}"/>${driedFish(99, 66, 24)}<ellipse cx="89" cy="91" rx="8" ry="7" fill="${fur}"/>`;
  if (kind === 'mage') gear = `<path d="m30 37 27-34 13 12 15 23Z" fill="#a89aca"/><path d="M24 39q37-12 75 0l-3 7H27Z" fill="#c9bce4"/><path d="m57 20 3-6 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4Z" fill="#ffe3a1" stroke-width="1.5"/><path d="m36 82 42-1 4 20H32Z" fill="#b4a4d3"/><path d="M39 86h36" stroke="#eee1ad" stroke-width="5"/>${teaserWand(96, 65)}<ellipse cx="96" cy="89" rx="8" ry="7" fill="${fur}"/>`;
  if (kind === 'shield') gear = `<path d="m27 36 4-20 28-8 32 15-2 16Z" fill="#c9aa81"/><path d="m33 19 24 6 26-4M57 25v13" fill="none" stroke="#ab8967"/><path d="m60 63 44 5-5 34-23 11-22-18Z" fill="#cfad81"/><path d="m77 66-3 39" stroke="#e7ca9f" stroke-width="8"/><path d="m67 82 7 8 13-13" fill="none" stroke="#8b9d70" stroke-width="5"/>`;
  if (kind === 'slinger') gear = `<path d="M28 41q8-28 34-27 26 1 31 28" fill="${accent}"/><path d="M29 40h64l-8 7H37Z" fill="${accent}"/><path d="m32 82 46-2-7 14H39Z" fill="${accent}"/><path d="m91 99-2-31-11-13m11 13 13-15" fill="none" stroke="#ac835f" stroke-width="7"/><path d="m78 55 8 19 16-21" fill="none" stroke="#dfb897" stroke-width="2"/><circle cx="21" cy="89" r="12" fill="#e7b3a6"/><path d="m14 80 14 16m-19-9 17 12" stroke="#f9e3d7" stroke-width="1.5"/>`;
  if (kind === 'healer') gear = `<path d="m30 41 5-20 26-7 28 11 3 17Z" fill="#fff8eb"/><path d="M58 21v15m-7-7h14" stroke="#dc948c" stroke-width="5"/><path d="m35 81 42-1-7 23H43Z" fill="#fff6e7"/><path d="M53 84v14m-7-7h14" stroke="#dc948c" stroke-width="4"/><path d="m91 100 5-37" stroke="#b49270" stroke-width="5"/><path d="M96 64q-21-10-10-19 7-5 11 3 6-10 12-3 10 11-13 19" fill="#e8a7a2"/>`;
  return wrap(shadow + cat + gear);
}

/** Trim only the empty margin for recruitment; keep the full figure and weapon. */
export function unitPortraitSVG(kind: UnitKind) {
  const bounds: Partial<Record<UnitKind, [number, number, number, number]>> = {
    mouse: [8, 32, 104, 82], soldier: [11, 9, 107, 106], shield: [11, 6, 97, 109],
    slinger: [7, 11, 99, 104], mage: [11, 0, 107, 115], catapult: [6, 4, 116, 122],
    healer: [11, 12, 108, 103], knight: [0, 0, 128, 120], boss: [0, 0, 128, 128],
  };
  const [x, y, width, height] = bounds[kind] ?? [0, 0, 128, 128];
  return unitSVG(kind).replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">`);
}

export function baseSVG(side: Side) { return basePreviewSVG(side); }

export const roomSVG = wrap(`
  <defs>
    <linearGradient id="wall" x2="0" y2="1"><stop stop-color="#f2eee3"/><stop offset="1" stop-color="#ece7dc"/></linearGradient>
    <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#d4e8df"/><stop offset="1" stop-color="#f1edcf"/></linearGradient>
    <pattern id="wallpaper" width="42" height="42" patternUnits="userSpaceOnUse"><circle cx="21" cy="21" r="1.4" fill="#dcd4c3" stroke="none"/></pattern>
  </defs>
  <path d="M0 0h1440v448H0Z" fill="url(#wall)" stroke="none"/>
  <path d="M0 0h1440v272H0Z" fill="url(#wallpaper)" stroke="none"/>
  <path d="M0 275h1440v173H0Z" fill="#e0ccb0" stroke="none"/>
  <path d="M0 275h1440v12H0Z" fill="#dac8ad" stroke="none"/>
  <path d="M0 275h1440M0 287h1440" stroke="#c7b79d" stroke-width="2"/>
  <g stroke="#cbb89b" stroke-width="1.4" opacity=".65"><path d="M0 337h1440M0 394h1440M100 287 60 337m215-50-18 50m222-50-3 50m210-50 10 50m210-50 24 50m210-50 38 50m200 0 42 57m-260-57 22 57m-300-57 5 57m-290-57-13 57m-295-57-28 57m-122 0-21 54m259-54-16 54m307-54-4 54m318-54 14 54m292-54 30 54"/></g>
  <path d="M270 329q450-30 902 0l44 64q-503 36-990 0Z" fill="#c7c6ab" stroke="none" opacity=".7"/>
  <path d="M279 337q446-27 885 0l33 48q-475 29-952 0Z" fill="none" stroke="#e6e0c6" stroke-width="2" stroke-dasharray="7 8"/>
  <rect x="471" y="24" width="454" height="213" rx="90" fill="#d2bd9b" stroke="#bba889" stroke-width="2"/>
  <rect x="484" y="37" width="428" height="188" rx="79" fill="url(#sky)" stroke="none"/>
  <circle cx="797" cy="87" r="27" fill="#fff2be" stroke="none"/>
  <g fill="#f8f7e9" stroke="none"><path d="M520 95q-1-17 18-14 6-22 25-13 12-8 19 7 24-1 23 20Z"/><path d="M705 139q-3-13 15-15 5-15 17-11 18-8 24 10 19-2 21 16Z"/></g>
  <path d="M485 208q85-68 170-6 98-64 163-7 51-31 94-7v37H485Z" fill="#b6cdb1" stroke="none"/>
  <path d="M698 38v185M484 145h427" stroke="#e8dcc1" stroke-width="9"/>
  <path d="M449 25h53q-4 77-26 129l22 81h-60l13-91Z" fill="#d6bcb1" stroke="#c4aa9c" stroke-width="2"/>
  <path d="M948 25h-48q0 82 23 128l-23 82h58l-12-90Z" fill="#d6bcb1" stroke="#c4aa9c" stroke-width="2"/>
  <path d="m444 151 36 2m443 0 29-2" stroke="#b99c87" stroke-width="5"/>
  <path d="M438 23h522" stroke="#a68e72" stroke-width="7"/>
  <rect x="478" y="227" width="439" height="12" rx="5" fill="#dac7a7" stroke="#beaa8c" stroke-width="2"/>
  <g transform="translate(276 48) rotate(-5 45 55)"><rect width="89" height="107" rx="4" fill="#c5a787" stroke="#b39473" stroke-width="2"/><rect x="8" y="8" width="73" height="91" fill="#f3e9d5" stroke="none"/><path d="m20 54 3-19 13 9q12-6 23 0l9-9 2 20q5 25-25 25-29 0-25-26" fill="#b6c5a6" stroke="none"/><path d="M33 58v3m22-3v3m-14 7 4 3 4-3" fill="none" stroke="#71836a" stroke-width="2"/></g>
  <g transform="translate(1061 62) rotate(4 32 38)"><rect width="69" height="78" rx="3" fill="#c7ae91" stroke="#b49a7d" stroke-width="2"/><rect x="7" y="7" width="55" height="64" fill="#f6edd9" stroke="none"/><path d="m19 37 15-13 18 13-7 21-23-1Z" fill="#e4bd82" stroke="none"/><path d="m28 38 12-3 3 12-12 3Z" fill="#c89862" stroke="none"/></g>
  <path d="M1039 221q-6-30 13-31h113q16 3 13 31v40h-139Z" fill="#d8bcb1" stroke="#bfa499" stroke-width="2"/>
  <path d="M1034 230h150v33h-150Z" fill="#d1b0a5" stroke="#bfa499" stroke-width="2"/><path d="M1046 264v13m124-13v13" stroke="#ac8d70" stroke-width="6"/>
  <rect x="1058" y="204" width="42" height="30" rx="7" fill="#ece1c8" stroke="#cfbfa4" stroke-width="2" transform="rotate(-8 1079 219)"/>
  <rect x="1110" y="202" width="41" height="30" rx="7" fill="#b9c5ae" stroke="#9eaf94" stroke-width="2" transform="rotate(8 1130 217)"/>
  <path d="m367 225 8 51h43l9-51Z" fill="#c8ae94" stroke="#ad957b" stroke-width="2"/>
  <path d="M396 226v-80m0 54q-37-3-31-29 24-3 31 29m0-14q31-4 29-29-23-1-29 29m0-22q-21-16-10-35 21 9 10 35" fill="#a3ba97" stroke="#8ca482" stroke-width="2"/>
  <g stroke="#c0ac8e" stroke-width="2"><path d="M36 422h41m1295-18h49M210 305h25m930 116h26"/><path d="m674 407 5-7 8 4-2 8Z" fill="#caa370"/><path d="m819 306 7-6 6 7-8 5Z" fill="#caa370"/></g>
  <path d="M530 248q20-9 40 0" fill="none" stroke="#d8cbb5" stroke-width="3"/>
`, 1440, 448);
