import type { UnitKind } from './content.ts';
import type { UnitLook, UnitPart } from './unit-art.ts';

// Kitchen utensils, snack wrappers and red neckerchiefs give the raiders their own silhouettes.
const ink = '#674b3c', fur = '#e9a356', stripe = '#b96936', cream = '#fff0cf';
const red = '#b85b49', lightRed = '#dc8a6a', metal = '#c8d4cf', metalShade = '#91a9a4';
const wrap = (svg: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="${ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${svg}</g></svg>`;
const part = (name: UnitPart['name'], x: number, y: number, svg: string): UnitPart => ({ name, x, y, svg: wrap(svg) });
const paw = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="9" fill="${fur}"/><path d="M${x - 3} ${y + 2}v3m6-3v3" stroke-width="1.3"/>`;
const biscuit = (x: number, y: number, radius: number) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="#eac17b"/><circle cx="${x - radius * .35}" cy="${y - radius * .25}" r="1.6" fill="${ink}" stroke="none"/><circle cx="${x + radius * .38}" cy="${y - radius * .1}" r="1.5" fill="${ink}" stroke="none"/><circle cx="${x}" cy="${y + radius * .4}" r="1.8" fill="${ink}" stroke="none"/>`;
const lid = (x: number, y: number, radius: number) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${metal}"/><circle cx="${x}" cy="${y}" r="${radius - 5}" fill="none" stroke="${metalShade}" stroke-width="2"/><path d="M${x - 8} ${y - radius + 9}q8-5 15-2" fill="none" stroke="#f6f8e9"/><rect x="${x - 5}" y="${y - 4}" width="10" height="8" rx="3" fill="${red}"/>`;
const bell = (x: number, y: number) => `<path d="M${x - 11} ${y + 5}q4-5 4-12 7-9 14 0 0 7 4 12Z" fill="#e7bd62"/><path d="M${x - 13} ${y + 5}h26" stroke="#9e7446" stroke-width="3"/><circle cx="${x}" cy="${y + 9}" r="3" fill="${ink}" stroke="none"/><path d="M${x - 4} ${y - 8}v6" stroke="#fff2b9" stroke-width="2"/>`;

function face(look: UnitLook) {
  if (look === 'back') return `<path d="m49 53 5 8m10-12v10m13-6-4 8" stroke="${stripe}" stroke-width="4"/><path d="M45 76q19 9 38 0" fill="none" stroke="${stripe}" stroke-width="2"/>`;
  if (look === 'side') return `<path d="M75 58v6" stroke-width="3.5"/><path d="m89 65 9 5-9 4" fill="#c37b66"/><path d="M91 76q-8 5-13-1" fill="none" stroke-width="2"/><path d="m36 57 7 3m-8 8 8 1" stroke="${stripe}" stroke-width="3"/>`;
  return `<path d="M45 58v6m36-6v6" stroke-width="3.5"/><path d="m39 53 10-2m26 0 10 2" stroke-width="2"/><ellipse cx="63" cy="74" rx="19" ry="10" fill="${cream}" stroke="none"/><path d="m58 69 5 4 5-4" fill="#c37b66"/><path d="M63 74q-4 6-9 2m9-2q4 6 9 2" fill="none" stroke-width="1.8"/><path d="m32 62 7 3m-8 6 8 1m50-10-7 3m8 6-8 1m-26-30 2 7m8-8v7m9-6-2 6" stroke="${stripe}" stroke-width="3"/>`;
}

function head(look: UnitLook, hat: string) {
  return `<path d="m29 44 3-26 21 15q12-4 24 0l19-15 1 27q10 19-3 32-12 13-31 12-31 1-36-21-3-13 2-24Z" fill="${fur}"/><path d="m35 34 1-9 10 10m35 0 10-10 1 11" fill="#e5aa88" stroke="none"/>${face(look)}${hat}`;
}

function machineParts(kind: 'mouse' | 'catapult'): UnitPart[] {
  const wheel = (x: number) => `<rect x="${x - 8}" y="76" width="16" height="30" rx="6" fill="${red}"/><path d="M${x - 5} 83h10m-10 8h10m-10 8h10" stroke="#f0bd8e" stroke-width="2"/>`;
  if (kind === 'mouse') return [
    part('leftFoot', 36, 91, wheel(36)), part('rightFoot', 92, 91, wheel(92)),
    part('body', 64, 76, `<path d="M64 98v15l-15 6" fill="none" stroke="${red}" stroke-width="5"/><rect x="37" y="40" width="54" height="61" rx="17" fill="${metal}"/><path d="M40 57h48v29H40Z" fill="${red}"/><path d="M42 93h44" stroke="${metalShade}"/><ellipse cx="64" cy="42" rx="27" ry="12" fill="#e0e4d6"/><ellipse cx="64" cy="42" rx="11" ry="5" fill="none" stroke="${metalShade}" stroke-width="4"/><path d="M50 69h6m16 0h6" stroke="${cream}" stroke-width="4"/><path d="m58 78 6 3 6-3" fill="none" stroke="${cream}" stroke-width="2"/>`),
    part('rightHand', 64, 67, `<path d="M64 56V30" stroke="${metalShade}" stroke-width="5"/><ellipse cx="64" cy="27" rx="13" ry="7" fill="${red}"/><ellipse cx="64" cy="26" rx="6" ry="3" fill="${cream}" stroke="none"/>`),
  ];
  return [
    part('leftFoot', 27, 91, wheel(27)), part('rightFoot', 101, 91, wheel(101)),
    part('body', 64, 80, `<path d="M31 48h66v53H31Z" fill="#c89562"/><path d="m31 48 8-10h50l8 10" fill="#e7bf8d"/><path d="M33 64h62v24H33Z" fill="${red}"/><path d="m48 68 12 2 6 13-20-1Z" fill="${cream}" stroke="none"/><circle cx="77" cy="76" r="7" fill="#e5b46b" stroke="none"/><path d="m48 99 1-15 13 7 14-8 3 16q-2 18-16 17-16 1-15-17Z" fill="${fur}"/><path d="M55 100v3m15-3v3" stroke-width="2"/>`),
    part('rightHand', 64, 75, `<path d="M64 78V32" stroke="${ink}" stroke-width="9"/><path d="M64 78V32" stroke="${metalShade}" stroke-width="5"/><ellipse cx="64" cy="25" rx="20" ry="16" fill="${metal}"/>${biscuit(64, 23, 13)}`),
  ];
}

function pigRiderParts(look: UnitLook): UnitPart[] {
  const pig = '#e7a5a0', pigDark = '#c98180';
  const hoof = (x: number, y: number, rear = false) => `<path d="M${x - 8} ${y - 18}h16l2 24q-8 7-20 0Z" fill="${rear ? pigDark : pig}"/><path d="M${x - 9} ${y + 1}h18v6q-9 5-18-1Z" fill="${ink}"/><path d="M${x} ${y + 3}v5" stroke="#bf8f81" stroke-width="1.5"/>`;
  const pigFace = look === 'back'
    ? `<path d="M80 55q12-5 26 0m-13 1v9" fill="none" stroke="${pigDark}"/>`
    : look === 'side'
    ? `<circle cx="104" cy="68" r="2.7" fill="${ink}" stroke="none"/><ellipse cx="113" cy="81" rx="11" ry="9" fill="#f3c0b4"/><path d="M111 79v3m6-3v3" stroke-width="2.2"/>`
    : `<path d="M81 67v4m23-4v4" stroke-width="3"/><ellipse cx="94" cy="83" rx="17" ry="11" fill="#f3c0b4"/><path d="M88 81v4m12-4v4" stroke="${pigDark}" stroke-width="3.5"/><path d="M89 97q6 4 12-1" fill="none" stroke-width="1.7"/>`;
  const riderFace = look === 'back' ? `<path d="M52 27v9" stroke="${stripe}" stroke-width="3"/>` : look === 'side'
    ? '<path d="M61 29v3m5 4 4 2-4 1" fill="none" stroke-width="2"/>'
    : '<path d="M44 29v3m16-3v3m-11 5 4 3 4-3" fill="none" stroke-width="2"/>';
  return [
    part('rearLeftFoot', 30, 99, hoof(30, 99, true)), part('rearRightFoot', 106, 97, hoof(106, 97, true)),
    part('leftFoot', 46, 105, hoof(46, 105)), part('rightFoot', 89, 105, hoof(89, 105)),
    part('body', 65, 84, `<path d="M27 82Q7 93 8 76q3-10 10-5 4 5-2 9" fill="none" stroke="${pigDark}" stroke-width="5"/><path d="M21 75q7-20 32-18h26q24 4 27 26 0 25-27 26H43q-27-3-22-34Z" fill="${pig}"/><path d="M32 64q22-7 42 0v30q-19 12-40 0Z" fill="${red}"/><path d="M37 69v22q17 8 31 0V69" fill="none" stroke="#efca85" stroke-width="2"/><path d="M76 63q-3-19 19-19 24 0 27 23v14q-2 20-27 21-27-1-26-23Z" fill="${pig}"/><path d="m77 59-9-15q13-4 19 9m20 0q6-13 16-8l-5 17" fill="${pigDark}"/>${pigFace}<path d="M76 98q18 9 34-2" fill="none" stroke="${red}" stroke-width="5"/>`),
    part('rider', 54, 54, `<path d="m39 43-11 23 19 4 16-20Z" fill="${red}"/><path d="M37 43h30l4 18q-18 12-34 0Z" fill="${metal}"/><path d="M40 60v10h12V60m9 0 4 10h9l-5-13" fill="${metalShade}"/><path d="m35 23 1-14 12 8h14l12-9v18q0 20-20 20-23-1-19-23Z" fill="${fur}"/><path d="M32 24q0-19 23-20 21 1 21 20Z" fill="${metal}"/><path d="M49 6V2h13v5M34 23h41" fill="none" stroke="${metalShade}" stroke-width="3"/>${riderFace}<path d="m43 43 11 5 11-5-6 12-5-6-5 6Z" fill="${red}"/>`),
    part('leftHand', 35, 54, `<path d="M35 55q22 23 43 27" fill="none" stroke-width="2"/>${paw(35, 54)}`),
    part('rightHand', 82, 53, `<g transform="translate(82 53) rotate(180) scale(.85) translate(-82 -53)"><path d="M82 60 91 23" stroke="${ink}" stroke-width="6"/><path d="M82 60 91 23" stroke="#be8b55" stroke-width="3"/><path d="M85 3v13q1 9 7 9t7-9V3m-7 0v21" fill="none" stroke="${metalShade}" stroke-width="4"/><path d="m90 30 21 6-9 4 7 7-22-6Z" fill="${red}"/></g>${paw(82, 53)}`),
  ];
}

export function enemyParts(kind: Exclude<UnitKind, 'boss'>, look: UnitLook = 'front'): UnitPart[] {
  if (kind === 'mouse' || kind === 'catapult') return machineParts(kind);
  if (kind === 'knight') return pigRiderParts(look);
  let hat = '', left = paw(23, 84), right = '';
  if (kind === 'soldier') {
    hat = `<path d="M29 43q32-8 68 0v8q-34-7-68 0Z" fill="${red}"/><path d="m29 45-15 9 14 3-3 12 17-18" fill="${red}"/>`;
    right = `<g transform="rotate(12 103 84)"><rect x="94" y="72" width="18" height="48" rx="8" fill="#e7b56d"/><path d="M96 88h13m-13 12h13m-13 11h12" stroke="#b87c45" stroke-width="2"/><path d="M99 79v4m5 9v3m-5 9v3m5 5v3" stroke-width="1.5"/></g>${paw(103, 84)}`;
  } else if (kind === 'shield') {
    hat = `<path d="M27 42q0-26 36-26 34 0 36 26Z" fill="${metal}"/><path d="M23 43h80" stroke="${metalShade}" stroke-width="6"/><path d="M56 17V11h15v7" fill="none" stroke="${metalShade}" stroke-width="4"/><path d="M37 32q5-9 14-10" fill="none" stroke="#f6f8e9"/>`;
    right = lid(101, 85, 24);
  } else if (kind === 'slinger') {
    hat = `<path d="m27 43 7-27 31 8 27-9 9 29Z" fill="#eed29a"/><path d="m34 18 31 16 27-17-5 23H39Z" fill="${red}"/><path d="M29 44h71" stroke="#d7a365" stroke-width="4"/>`;
    left = biscuit(22, 78, 11) + paw(23, 88);
    right = `<path d="M103 78v20l-13 17m13-17 14 16" fill="none" stroke="#9b6c44" stroke-width="6"/><path d="m90 115 13-31 14 30" fill="none" stroke="${red}" stroke-width="2.3"/>${paw(103, 84)}`;
  } else if (kind === 'mage') {
    hat = `<path d="M29 45q-1-29 34-32 33 3 35 32l-13 2-4-14-17-8-17 9-4 14Z" fill="${red}"/><path d="M46 33q17-9 35 0" fill="none" stroke="#f0c477"/><circle cx="64" cy="20" r="4" fill="#e7bd62"/>`;
    left = bell(23, 78) + paw(23, 88);
    right = `<path d="M103 77v29" stroke="#b27e47" stroke-width="5"/>${bell(103, 110)}${paw(103, 84)}`;
  } else {
    hat = `<path d="M30 41q3-20 33-21 25 0 32 20Z" fill="${red}"/><path d="M29 41h72l-7 8H29Z" fill="${lightRed}"/><path d="m59 26 10 1-2 9-10-1Z" fill="${cream}" stroke="none"/>`;
    left = `<path d="M15 77h19v23H15Z" fill="${red}"/><path d="M17 75h15v5H17Z" fill="${metal}"/>${paw(23, 85)}`;
    right = `<rect x="88" y="88" width="29" height="25" rx="4" fill="${metal}"/><path d="M89 96h27v10H89Z" fill="${red}"/><path d="m99 98 7 1-2 5-7-1Z" fill="${cream}" stroke="none"/><ellipse cx="102" cy="88" rx="14" ry="5" fill="#a5774e"/><path d="M89 88q0-19 15-18 16 1 12 16" fill="${metal}"/><path d="M96 78h13" stroke="${metalShade}"/>${paw(103, 84)}`;
  }
  const coat = kind === 'mage' ? red : kind === 'healer' ? '#e1c295' : fur;
  return [
    part('leftFoot', 46, 108, `<ellipse cx="46" cy="107" rx="12" ry="9" fill="${fur}"/><path d="M39 109h14" stroke="${stripe}" stroke-width="2"/>`),
    part('rightFoot', 81, 108, `<ellipse cx="81" cy="107" rx="12" ry="9" fill="${fur}"/><path d="M74 109h14" stroke="${stripe}" stroke-width="2"/>`),
    part('body', 64, 86, `<path d="M82 88q22 15 21-4" fill="none" stroke="${ink}" stroke-width="9"/><path d="M82 88q22 15 21-4" fill="none" stroke="${fur}" stroke-width="6"/><path d="m97 96 3-6" stroke="${stripe}" stroke-width="4"/>${kind === 'healer' ? `<rect x="29" y="65" width="22" height="35" rx="7" fill="${red}"/>` : ''}<path d="M40 72q-6 15-2 29h51q4-17-5-29Z" fill="${coat}"/><path d="M40 94h47v7H40Z" fill="${red}"/>${head(look, hat)}<path d="M43 85q20 8 39-1l-13 12-6-6-9 9-5-8Z" fill="${kind === 'mage' ? '#e6bd70' : red}"/>`),
    part('leftHand', 23, 84, left), part('rightHand', 103, 84, right),
  ];
}

/** Use the same parts in the guide and campaign previews, with vehicles seen from above. */
export function enemyPortraitSVG(kind: Exclude<UnitKind, 'boss'>) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${enemyParts(kind).map(piece => piece.svg).join('')}</svg>`;
}
