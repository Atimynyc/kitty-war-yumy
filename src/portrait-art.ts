import type { Side, UnitKind } from './game/content.ts';

const svg = (body: string, w = 96, h = 96) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#655345" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

export function portraitUnitSVG(kind: UnitKind, side: Side) {
  const friendly = side === 'player', fur = friendly ? '#f5d19a' : '#ddd0e9';
  const accent = friendly ? '#80a38a' : '#a494b9';
  const shadow = '<ellipse cx="48" cy="78" rx="30" ry="10" fill="#796850" opacity=".15" stroke="none"/>';
  if (kind === 'mouse') {
    const body = `<path d="M48 77q-18 18-25 3" fill="none" stroke="#ce9a8e" stroke-width="4"/><ellipse cx="48" cy="55" rx="20" ry="25" fill="#cec1b5"/><path d="M31 39q4-19 17-23 15 5 18 23" fill="#cec1b5"/><circle cx="28" cy="37" r="11" fill="#e3b6ad"/><circle cx="68" cy="37" r="11" fill="#e3b6ad"/><circle cx="48" cy="17" r="4" fill="#d99491"/><path d="M41 28v2m14-2v2"/><path d="M34 56h28v8H34Z" fill="${accent}"/><path d="M46 51v-8h-5v-7h14v7h-5v8" fill="#dbba80"/>`;
    return svg(shadow + `<g${friendly ? '' : ' transform="rotate(180 48 48)"'}>${body}</g>`);
  }
  if (kind === 'catapult') {
    const body = `<path d="M23 46h50v30H23Z" fill="#c8a375"/><path d="M29 45v-8h38v8" fill="#e4c28e"/><rect x="15" y="44" width="10" height="33" rx="4" fill="#937454"/><rect x="71" y="44" width="10" height="33" rx="4" fill="#937454"/><path d="M48 67V24" stroke="#957354" stroke-width="9"/><path d="m35 27 3-13h20l3 13Z" fill="#e5c599"/><circle cx="48" cy="20" r="12" fill="${accent}"/><path d="m40 12 14 14m-18-7 16 10" stroke="#fbefce" stroke-width="1.5"/><path d="m31 70 2-12 9 5 10-5 3 13q-2 14-13 14-12-1-11-15" fill="${fur}"/><path d="m38 74 1 2m8-2-1 2"/>`;
    return svg(shadow + `<g${friendly ? '' : ' transform="rotate(180 48 48)"'}>${body}</g>`);
  }
  const head = `<path d="m22 37 1-20 16 10q11-3 20 0l14-10 1 22q6 15-3 26-11 13-28 10-24 0-24-23Z" fill="${fur}"/>`;
  const face = friendly
    ? '<path d="m34 47 4 4m8-8 4 5m9-3 4 4" stroke="#c6a076"/><path d="m36 62 24 1" stroke="#d3b183" stroke-width="2"/>'
    : '<path d="M34 47v4m26-4v4" stroke-width="3.2"/><path d="m44 56 4 3 4-3" fill="#c18c93"/><path d="M48 60q-5 6-9 1m9-1q5 6 9 1" fill="none" stroke-width="1.7"/><ellipse cx="28" cy="58" rx="5" ry="3" fill="#c5afd2" stroke="none"/><ellipse cx="67" cy="58" rx="5" ry="3" fill="#c5afd2" stroke="none"/>';
  const body = `<path d="m31 64-1 19h14l3-9 4 9h14l-1-19Z" fill="${fur}"/><path d="M60 75q17 15 21-1" fill="none" stroke="${fur}" stroke-width="7"/>`;
  let gear = '';
  if (kind === 'soldier') gear = `<path d="M22 37q0-22 26-23 25 0 26 23Z" fill="${accent}"/><path d="M48 17v16" stroke="#d3debf" stroke-width="4"/><path d="M22 38h51" stroke-width="3"/><path d="M72 73V43l6-8 6 8-6 30Z" fill="#d6ddd6"/><path d="M69 73h16" stroke="#ab8b63" stroke-width="4"/>`;
  if (kind === 'shield') gear = `<path d="m23 32 2-16 23-7 25 12-1 14Z" fill="#c6a77b"/><path d="M48 10v22" stroke="#e5c798" stroke-width="5"/><path d="m66 43 21 8-2 25-19 7-10-19Z" fill="#d7b58a"/><path d="m67 46 8 30" stroke="#ead0a8" stroke-width="5"/>`;
  if (kind === 'slinger') gear = `<path d="M23 37q1-21 25-23 24 1 25 23" fill="${accent}"/><path d="M23 38h50" stroke-width="4"/><path d="M78 80V57L68 46m10 11 10-11" fill="none" stroke="#ac875e" stroke-width="5"/><path d="m68 46 10 18 10-18" fill="none" stroke="#d8ba8c" stroke-width="2"/><circle cx="23" cy="74" r="9" fill="#d8a391"/>`;
  if (kind === 'healer') gear = `<path d="m23 37 2-17 23-8 24 9 1 16Z" fill="#fff7e8"/><path d="M48 18v14m-6-7h12" stroke="#cf8f85" stroke-width="4"/><path d="M76 79V49" stroke="#a88d66" stroke-width="4"/><path d="M76 52q-17-9-10-17 6-4 10 3 7-8 12-2 7 8-12 16" fill="#e4a39a"/>`;
  return svg(shadow + body + head + face + gear);
}

export function portraitBaseSVG(side: Side) {
  const accent = side === 'player' ? '#86a58b' : '#a596b9';
  return svg(`<ellipse cx="90" cy="116" rx="78" ry="17" fill="#7d674a" opacity=".13" stroke="none"/><path d="m17 59 70-34 75 33v52l-70 25-75-25Z" fill="#d6b389"/><path d="m17 59 70 23 75-24-75-33Z" fill="#efcf9e"/><path d="M87 82v53m-70-76 70 23 75-24" fill="none" stroke="#b18f64"/><path d="m40 57 46-20 46 19-46 17Z" fill="${accent}"/><path d="m51 56 35-13 32 12-32 10Z" fill="#f4deb4" stroke="none"/><path d="m66 48 14 2 2 10-15 1Zm22 7 12-6 9 7-12 6Z" fill="#ba8d55" stroke-width="1.5"/><path d="M134 60V9m0 1h31l-8 11 8 10h-31" fill="${accent}"/><path d="m46 85 24 8v20l-24-8Z" fill="#f8e8c9"/><path d="m53 95 10 3" stroke="#b28b5d"/><path d="m112 91 23-7v19l-23 7Z" fill="${accent}"/><path d="m110 111 35-10" stroke="#b18f64"/>`, 180, 145);
}
