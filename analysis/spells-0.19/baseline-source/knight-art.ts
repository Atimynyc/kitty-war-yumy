import type { Side } from './content.ts';
import type { UnitPart, UnitLook } from './unit-art.ts';

/** A broad, soft mount carries a compact rider; all eight animation parts share a canvas. */
export function knightParts(side: Side, look: UnitLook = 'front'): UnitPart[] {
  const friendly = side === 'player';
  const fur = friendly ? '#f7d8a5' : '#e4d9ee';
  const dog = friendly ? '#dda968' : '#b6a5c8';
  const dogShade = friendly ? '#c38d55' : '#9985af';
  const ear = friendly ? '#b77f4d' : '#887397';
  const cream = friendly ? '#fff0d2' : '#f5eaf4';
  const accent = friendly ? '#739683' : '#9a82b3';
  const accentDark = friendly ? '#527765' : '#78608f';
  const metal = friendly ? '#dbe5de' : '#e0dcea';
  const metalShade = friendly ? '#aabeb5' : '#b8abc9';
  const outline = '#665447';
  const gold = '#e6c27c';
  const part = (name: UnitPart['name'], x: number, y: number, content: string): UnitPart => ({ name, x, y,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="${outline}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>` });

  // Rounded paws overlap the belly at their hips, so a full stride never opens a gap.
  const paw = (x: number, y: number, far = false) => `<path d="M${x - 8} ${y - 17}Q${x - 11} ${y - 7} ${x - 9} ${y + 1}q-4 2-4 7 1 5 11 5h6q7-1 6-7l-2-23Z" fill="${far ? dogShade : dog}"/>
    <path d="M${x - 11} ${y + 6}q10-4 19 0v3q-8 4-18 0Z" fill="${far ? '#e0ceb2' : cream}" stroke="none"/>
    <path d="M${x - 4} ${y + 7}v3m6-3v3" fill="none" stroke="${far ? dogShade : '#c5ab83'}" stroke-width="1.4"/>`;

  const tail = `<path d="M26 84C6 85 3 68 10 59q7-9 13-1 3 6-5 10" fill="none" stroke="${outline}" stroke-width="12"/>
    <path d="M26 84C6 85 3 68 10 59q7-9 13-1 3 6-5 10" fill="none" stroke="${dog}" stroke-width="8"/>
    <path d="M10 59q7-9 13-1 3 6-5 10" fill="none" stroke="${cream}" stroke-width="8"/>`;
  const body = `<path d="M22 72q6-15 29-15h24q25 1 30 23 4 24-22 29H43q-25-2-24-23Z" fill="${dog}"/>
    <path d="M24 92q13 13 31 10h28q12-1 18-10-2 17-22 17H43q-14-1-19-10Z" fill="${dogShade}" stroke="none"/>
    <path d="M77 78q17-6 22 8 4 17-12 22H73q-7-14 4-30Z" fill="${cream}" stroke="none"/>
    <path d="M31 66q22-8 46 0l-3 29q-20 13-41-1Z" fill="${accent}"/>
    <path d="M36 70v20q17 10 33 0l2-20" fill="none" stroke="${gold}" stroke-width="2.5"/>
    <path d="M34 63q19-7 38 0l-1 7q-19-5-37 0Z" fill="#947258"/>
    <path d="M54 71v23" stroke="${accentDark}" stroke-width="4"/>
    <rect x="50" y="84" width="8" height="8" rx="2" fill="${gold}" stroke-width="1.5"/>`;

  const headShape = look === 'side'
    ? `<path d="M74 59q10-15 28-9 15 4 14 20l7 6q3 11-10 17-20 9-34-7-9-11-5-27Z" fill="${dog}"/>`
    : `<path d="M71 61q3-15 22-16 23-1 28 20l-1 15q-4 18-25 19-22-1-26-19Z" fill="${dog}"/>`;
  const dogFace = look === 'back'
    ? `<path d="M83 50q11-5 22 1" fill="none" stroke="${cream}" stroke-width="4"/>
      <path d="M92 51q-3 9-2 16" fill="none" stroke="${dogShade}" stroke-width="2"/>
      <path d="M73 56q-12-3-11 14 0 15 8 16 8-2 9-16Z" fill="${ear}"/>
      <path d="M112 54q12 2 12 17-1 13-8 14-7-2-7-14Z" fill="${ear}"/>`
    : look === 'side'
    ? `<path d="M110 68q7 3 13 8 2 10-10 14-12 3-16-6 0-10 13-16Z" fill="${cream}" stroke="none"/>
      <path d="M76 55q-13-2-13 15 0 14 9 15 10-3 11-21Z" fill="${ear}"/>
      <path d="M72 61q-4 8-1 15" fill="none" stroke="${dogShade}" stroke-width="2"/>
      <ellipse cx="105" cy="66" rx="2.6" ry="3.5" fill="${outline}" stroke="none"/>
      <circle cx="105.7" cy="65" r=".8" fill="#fff9ee" stroke="none"/>
      <path d="M117 74q7-3 8 2-1 5-6 5Z" fill="${outline}"/>
      <path d="M119 82q-2 5-7 4" fill="none" stroke-width="1.6"/>`
    : `<path d="M89 48q7-2 10 2l1 21H86Z" fill="${cream}" stroke="none"/>
      <path d="M72 54q-13-1-12 16 0 14 8 16 9-2 11-20Z" fill="${ear}"/>
      <path d="M113 53q12 1 12 16-1 14-8 16-7-2-8-17Z" fill="${ear}"/>
      <path d="M68 61q-4 8-1 15m51-15q3 7 0 13" fill="none" stroke="${dogShade}" stroke-width="2"/>
      <path d="M79 75q4-6 14-4 9-4 16 3 6 6 0 13-7 8-16 7-17-1-17-11Z" fill="${cream}" stroke="none"/>
      <ellipse cx="84" cy="67" rx="2.5" ry="3.5" fill="${outline}" stroke="none"/>
      <ellipse cx="104" cy="66" rx="2.5" ry="3.5" fill="${outline}" stroke="none"/>
      <path d="M84.7 65.8h.1m20-1h.1" stroke="#fff9ee" stroke-width="1.6"/>
      <path d="M88 76q5-3 10 0 0 5-5 6-5-1-5-6Z" fill="${outline}" stroke="none"/>
      <path d="M90 87q0 7 4 7t4-8" fill="#d89a8c" stroke-width="1.5"/>
      <path d="M93 82v3m0 0q-4 5-9 1m9-1q4 5 9 0" fill="none" stroke-width="1.6"/>`;
  const collar = `<path d="M76 94q18 10 34-2" fill="none" stroke="${outline}" stroke-width="7"/>
    <path d="M76 94q18 10 34-2" fill="none" stroke="${accent}" stroke-width="4"/>
    ${look === 'back' ? '' : `<path d="m93 99 5 4-5 6-5-6Z" fill="${gold}" stroke-width="1.5"/>`}`;

  const cape = `<path d="M40 44q-6 7-11 20 7 5 16 3l11-18Z" fill="${accent}"/>
    <path d="m39 50-4 12" fill="none" stroke="${accentDark}" stroke-width="2"/>`;
  const armor = `<path d="m43 57-5 11q-1 4 8 5h5l1-14m10-2 5 9q5 3 2 7H59l-3-13" fill="${metalShade}"/>
    <path d="M39 44q14-5 26 0l3 15q-12 12-28 1Z" fill="${metal}"/>
    <path d="M41 59q14 7 24-1" fill="none" stroke="${metalShade}" stroke-width="3"/>
    ${look === 'back'
      ? `<path d="M42 46q11-4 21 0l-1 17q-10 5-20-1Z" fill="${accent}"/><path d="m47 57 5-5 5 5-5 5Z" fill="${gold}" stroke="none"/>`
      : `<path d="M53 47v12" stroke="#f7f8e9" stroke-width="2"/><path d="m49 49 5-2 5 2-1 6-4 3-4-3Z" fill="${gold}" stroke-width="1.3"/>`}
    <path d="M40 44q-8-1-9 8l10 3m23-11q8-2 10 7l-9 4" fill="${metal}"/>`;
  const helmet = `<path d="m36 23 1-13 11 6q9-3 15 0l11-6-1 17q4 17-18 19-20 0-21-15Z" fill="${fur}"/>
    <path d="M35 28q-1-10 3-17l10 7q9-4 15 0l10-7q3 8 1 17l-6 5H41Z" fill="${metal}"/>
    <path d="M41 22q14-6 27 0" fill="none" stroke="#f9faed" stroke-width="2.5"/>
    <path d="M55 17V9q1-7 10-6l5 3-9 5v7" fill="${accent}"/>
    <path d="M39 28q16-5 31 0l-2 11q-13 10-26 0Z" fill="${look === 'back' ? metalShade : fur}"/>`;
  const catFace = look === 'back'
    ? `<path d="M54 27v15" stroke="${metal}" stroke-width="2"/>`
    : look === 'side'
    ? `<path d="M61 30v3m6 2 4 2-4 2" fill="none" stroke-width="2"/>
      <path d="M45 35h4" stroke="#e5ad91" stroke-width="2.5"/>`
    : `<path d="M46 30v3m16-3v3" stroke-width="2.6"/>
      <path d="m51 36 3 2 3-2m-3 2v2" fill="none" stroke-width="1.4"/>
      <path d="M41 36h3m20 0h3" stroke="#e5ad91" stroke-width="2.5"/>`;

  // The mounted hand is close to the rider, with a clear pennant above the dog's head.
  const lance = `<path d="M82 60 91 18" stroke="${outline}" stroke-width="5"/>
    <path d="M82 60 91 18" stroke="#b88a5a" stroke-width="2.8"/>
    <path d="m87 19 1-8 7-9 3 12-6 7Z" fill="${metal}"/>
    <path d="m95 5-3 13" fill="none" stroke="#fff8e3" stroke-width="1.5"/>
    <path d="m91 24 19 6-9 4 6 7-19-5Z" fill="${accent}"/>
    <path d="m93 28 10 3-11 1" fill="${gold}" stroke="none"/>
    <path d="m79 54 8 2" stroke="${gold}" stroke-width="4"/>`;
  return [
    part('rearLeftFoot', 30, 99, paw(30, 99, true)),
    part('rearRightFoot', 106, 97, paw(106, 97, true)),
    part('leftFoot', 46, 105, paw(46, 105)),
    part('rightFoot', 89, 105, paw(89, 105)),
    part('body', 65, 84, tail + body + headShape + dogFace + collar),
    part('rider', 54, 54, cape + armor + helmet + catFace),
    part('leftHand', 35, 54, `<path d="M36 56q18 23 42 27" fill="none" stroke="${outline}" stroke-width="2"/>
      <path d="M31 50q7-2 10 4l-2 6q-9 3-11-3Z" fill="${metal}"/>`),
    part('rightHand', 82, 53, `${friendly ? lance : `<g transform="translate(82 53) rotate(180) scale(.85) translate(-82 -53)">${lance}</g>`}
      <path d="m70 50 10 3" stroke="${outline}" stroke-width="8"/>
      <path d="m70 50 10 3" stroke="${metalShade}" stroke-width="5"/>
      <path d="M79 48q8-2 9 5 1 7-7 7l-5-5Z" fill="${metal}"/>`),
  ];
}

