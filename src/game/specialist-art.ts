import type { SpecialistKind } from './content.ts';
import type { UnitLook, UnitPart } from './unit-art.ts';

const ink = '#655345', cream = '#fff0cf';
const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g stroke="${ink}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const part = (name: UnitPart['name'], x: number, y: number, body: string): UnitPart => ({ name, x, y, svg: wrap(body) });
const colors: Record<SpecialistKind, [string, string]> = {
  gunner: ['#c5cbd0', '#6c9ca3'], litter: ['#f1d6a7', '#b2ad80'],
  kungfu: ['#f0c08f', '#b96652'], assassin: ['#b9b7cc', '#787994'],
  umbrella: ['#e9d7b5', '#7b9b71'], drummer: ['#f2cb8c', '#cb9a54'],
  hook: ['#bfcac5', '#679c90'], boxer: ['#e1c9b2', '#c47d71'],
};
function face(look: UnitLook) {
  if (look === 'back') return '<path d="m45 55 6 7m12-10v9m14-6-4 7" stroke="#a98e77"/><path d="M44 77q20 8 40 0" fill="none" stroke-width="1.5"/>';
  if (look === 'side') return '<path d="M77 57v6" stroke-width="4"/><path d="m90 66 8 4-7 4" fill="#c28b8b"/><path d="M91 76q-6 5-12 0" fill="none" stroke-width="1.8"/>';
  return '<path d="M46 57v6m35-6v6" stroke-width="4"/><ellipse cx="64" cy="73" rx="18" ry="10" fill="#fff0cf" stroke="none"/><path d="m59 69 5 3 5-3" fill="#c28b8b"/><path d="M64 73q-5 7-11 1m11-1q5 7 11 1" fill="none" stroke-width="1.8"/>';
}
export function specialistParts(kind: SpecialistKind, look: UnitLook = 'back'): UnitPart[] {
  const [fur, accent] = colors[kind];
  const paw = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="9" fill="${fur}"/><path d="M${x-3} ${y+2}v3m6-3v3" stroke-width="1.3"/>`;
  let hat = '', outfit = '', left = paw(23, 84), right = paw(103, 84);
  if (kind === 'gunner') {
    hat = `<path d="M30 40q3-25 33-25t34 25Z" fill="${accent}"/><path d="M28 40h73l-6 7H32Z" fill="${accent}"/><rect x="40" y="31" width="45" height="14" rx="5" fill="#c8e2dc"/><path d="M62 33v10"/>`;
    outfit = `<path d="M40 80h47v18H40Z" fill="${accent}"/><path d="M50 84v12m25-12v12" stroke="${cream}" stroke-width="4"/>`;
    right = `<path d="M94 92V49h18v35l-7 8Z" fill="${accent}"/><rect x="94" y="37" width="18" height="15" rx="3" fill="#df9867"/><ellipse cx="103" cy="37" rx="9" ry="4" fill="#ffe0a2"/><path d="M103 55v20m-14-9h6" stroke="${cream}" stroke-width="3"/><path d="M95 79h-8v10h12" fill="#d2b788"/>${paw(103,87)}`;
    left = `<path d="M15 70h16v18H15Z" fill="#e4ad6e"/><path d="M20 73v10m6-10v10" stroke="${cream}"/>${paw(23,91)}`;
  } else if (kind === 'litter') {
    hat = `<path d="M30 41q4-25 34-24t33 24Z" fill="${accent}"/><path d="M32 44h63" stroke="#ded9b1" stroke-width="5"/>${look !== 'back' ? '<path d="m46 69 17-4 18 4-4 11H50Z" fill="#e2debe"/><path d="M54 73h20" stroke-width="1.4"/>' : ''}`;
    outfit = `<path d="M41 80h45v19H41Z" fill="${accent}"/><path d="M52 86h24v12H52Z" fill="#efe3b8"/>`;
    left = `<path d="M11 67h23l3 37H8Z" fill="#d9c49a"/><path d="M12 69q10-16 20 0" fill="none"/><path d="m15 85 4-4 4 5m3-2 4 4" stroke="#9c956c"/>${paw(23,91)}`;
    right = `<path d="m94 55 7 5 8-5 2 10q10 19 2 26-12 7-23-1-6-9 5-25Z" fill="#e1d8af"/><path d="M94 64h17" stroke="${accent}" stroke-width="4"/><path d="m96 74 3 4m7-6 4 4m-11 7 5 2" stroke="#9a926e"/>${paw(103,88)}`;
  } else if (kind === 'kungfu') {
    hat = `<path d="M29 42h69v9H29Z" fill="${accent}"/><circle cx="63" cy="46" r="4" fill="${cream}"/><path d="m30 48-15 8 7-11m8 4-8 18 12-8" fill="${accent}"/>`;
    outfit = `<path d="M42 79h44l4 21H37Z" fill="${cream}"/><path d="m47 80 18 15 16-15M40 94h48m-25 0 8 14" fill="none" stroke="${accent}" stroke-width="4"/>`;
    left = paw(23,76) + '<path d="M15 81h17v8H15Z" fill="#e4cf9c"/>';
    right = paw(103,68) + '<path d="M95 75h17v9H95Z" fill="#e4cf9c"/>';
  } else if (kind === 'assassin') {
    hat = `<path d="m28 43 3-27 22 15q12-4 24 0l19-15 3 28Z" fill="${accent}"/>${look !== 'back' ? `<path d="M29 65h68q-1 23-33 23T29 65Z" fill="${accent}"/>` : ''}<path d="M30 45h68" stroke="#c4b8df" stroke-width="6"/>`;
    outfit = `<path d="M41 79h46l8 25-31-5-31 5Z" fill="${accent}"/><path d="m48 83 29 13m-32-1 35-13" stroke="#c6b5ce" stroke-width="3"/>`;
    left = `<path d="m18 84-6-17 9-12 8 14-4 15" fill="#c9d5ce"/>${paw(23,89)}`;
    right = `<path d="m100 81-5-30 9-13 10 13-6 30Z" fill="#cedbd7"/><path d="M103 47v26" stroke="#f1f0d6"/><path d="M93 81h20" stroke="#c7a66e" stroke-width="5"/>${paw(103,89)}`;
  } else if (kind === 'umbrella') {
    hat = `<path d="M31 40q6-26 32-26t33 26Z" fill="${accent}"/><path d="M26 42h76" stroke="#aec298" stroke-width="7"/>`;
    outfit = `<path d="M43 80h42l6 21H37Z" fill="${accent}"/><path d="M64 83v15" stroke="#d8e0b6" stroke-width="4"/>`;
    right = `<path d="M98 87V36" stroke="#9c8758" stroke-width="5"/><path d="M64 41q12-29 34-29 18 0 28 29-9-8-16 0-12-9-23 0-12-8-23 0Z" fill="#9ebd83"/><path d="M98 12Q83 22 87 41m11-29q14 15 12 29M98 15v22" fill="none" stroke="#5d855f" stroke-width="1.8"/><path d="M98 10V6"/>${paw(103,84)}`;
  } else if (kind === 'drummer') {
    hat = `<path d="M31 42q8-25 34-24t32 24Z" fill="${accent}"/><path d="M31 42h65" stroke="#f7df9e" stroke-width="6"/><path d="M65 19V8"/><circle cx="65" cy="7" r="5" fill="#d89968"/>`;
    outfit = `<path d="m43 78 42 1v22H42Z" fill="${accent}"/><path d="M41 81h46v18q-23 13-46 0Z" fill="#c28362"/><ellipse cx="64" cy="81" rx="23" ry="8" fill="#ffedbc"/><path d="m45 86 8 15 10-13 11 14 9-16" fill="none" stroke="#e5c887" stroke-width="2"/>`;
    left = `<path d="m21 84 23-21" stroke="#ad855c" stroke-width="5"/><circle cx="45" cy="62" r="5" fill="#f1d8a2"/>${paw(23,86)}`;
    right = `<path d="m102 84-20-23" stroke="#ad855c" stroke-width="5"/><circle cx="81" cy="60" r="5" fill="#f1d8a2"/>${paw(103,86)}`;
  } else if (kind === 'hook') {
    hat = `<path d="M30 43q5-23 34-23t34 23Z" fill="${accent}"/><path d="m32 43 62 1-9 7H39Z" fill="#b1d0ba"/>`;
    outfit = `<path d="M41 80h46v19H41Z" fill="${accent}"/><path d="m43 87 38 8" stroke="#e5d7ab" stroke-width="5"/>`;
    left = `<circle cx="23" cy="78" r="15" fill="#d4bc8c"/><circle cx="23" cy="78" r="9" fill="#a29a78"/><path d="M18 73l10 11m-10 0 10-11" stroke="#f2e2bc"/>${paw(23,93)}`;
    right = `<path d="M103 87V44" stroke="#bdac80" stroke-width="9"/><path d="M91 44q0-15 12-15t12 15Z" fill="#dc9b88"/><ellipse cx="103" cy="44" rx="14" ry="5" fill="#f0bc9e"/><path d="M96 67q-23-5-20 15" fill="none" stroke="#c6ad7e" stroke-width="2"/>${paw(103,87)}`;
  } else {
    hat = `<path d="M32 42q3-24 31-24t32 24" fill="none" stroke="${accent}" stroke-width="9"/><rect x="27" y="38" width="10" height="23" rx="5" fill="${accent}"/><rect x="91" y="38" width="10" height="23" rx="5" fill="${accent}"/>`;
    outfit = `<path d="M41 83h46v18H41Z" fill="${accent}"/><path d="M43 87h42" stroke="#f3dbc1" stroke-width="5"/>`;
    left = `<path d="M16 83v-8q-8-20 8-23 17-2 16 17l-7 14Z" fill="${accent}"/><path d="M15 83h19v8H15Z" fill="#ead7b2"/>`;
    right = `<path d="M99 88V71l9-5-11-5 12-5-10-4" fill="none" stroke="#8d9e91" stroke-width="4"/><path d="m94 54-7-11q-6-17 12-21 20-2 22 13 1 10-8 19Z" fill="${accent}"/><path d="M94 52h19v8H94Z" fill="#ead7b2"/>`;
  }
  return [
    part('leftFoot', 46, 109, `<ellipse cx="46" cy="109" rx="12" ry="8" fill="${fur}"/>`),
    part('rightFoot', 81, 109, `<ellipse cx="81" cy="109" rx="12" ry="8" fill="${fur}"/>`),
    part('body', 64, 86, `<path d="M83 91q19 6 18-9" fill="none" stroke="${fur}" stroke-width="8"/><path d="M43 76h42l4 24H39Z" fill="${fur}"/>${outfit}<path d="m29 43 2-27 22 16q11-4 23 0l20-16 2 29q9 17-4 31-12 13-30 12-30 1-37-19-4-14 2-26Z" fill="${fur}"/><path d="m36 33 1-9 10 10m34 0 9-10 1 11" fill="#dda99d" stroke="none"/>${face(look)}${hat}`),
    part('leftHand', 23, 84, left), part('rightHand', 103, 84, right),
  ];
}

/** A visible cat pushes the rear handle; wheels and paws have separate motion. */
export function toyCannonParts(look: UnitLook = 'back'): UnitPart[] {
  const wheel = (x: number) => `<rect x="${x-8}" y="47" width="16" height="30" rx="7" fill="#93aaa0"/><path d="M${x-4} 53v18" stroke="#d7dfba" stroke-width="3"/>`;
  const head = look === 'front' ? '<path d="M53 96v3m22-3v3m-16 5 5 3 5-3"/><path d="M64 108q-5 4-8 0m8 0q5 4 8 0" fill="none" stroke-width="1.5"/>' : '<path d="m51 94 5 5m8-7v7m12-5-4 5" stroke="#b99d7c"/>';
  return [
    part('leftFoot', 28, 62, wheel(28)), part('rightFoot', 100, 62, wheel(100)),
    part('rearLeftFoot', 48, 119, '<ellipse cx="48" cy="119" rx="10" ry="6" fill="#f1d3a0"/>'),
    part('rearRightFoot', 80, 119, '<ellipse cx="80" cy="119" rx="10" ry="6" fill="#f1d3a0"/>'),
    part('body', 64, 72, `<path d="M33 49h62v25H33Z" fill="#ccac7b"/><path d="M39 72v12h50V72" fill="none" stroke="#947a59" stroke-width="6"/><path d="M50 100h29v17H49Z" fill="#88aa91"/><path d="m41 93 2-19 13 9q8-3 16 0l13-9 2 20q5 19-23 20-27 0-23-21Z" fill="#f1d3a0"/>${head}<path d="M44 86q20-10 39 0" stroke="#80a38a" stroke-width="5"/>`),
    part('leftHand', 64, 84, '<ellipse cx="39" cy="82" rx="8" ry="7" fill="#f1d3a0"/><ellipse cx="89" cy="82" rx="8" ry="7" fill="#f1d3a0"/>'),
    part('rightHand', 64, 54, `<ellipse cx="64" cy="60" rx="23" ry="15" fill="#6b927f"/><path d="M48 55 51 17h26l3 38q-16 13-32 0Z" fill="#90b4a0"/><path d="M56 23v27" stroke="#d9e5bf" stroke-width="5"/><ellipse cx="64" cy="17" rx="14" ry="7" fill="#e9af77"/><ellipse cx="64" cy="17" rx="9" ry="3.8" fill="#716950"/><path d="M50 43q14 6 28 0" fill="none" stroke="#e7cf94" stroke-width="5"/>`),
  ];
}
