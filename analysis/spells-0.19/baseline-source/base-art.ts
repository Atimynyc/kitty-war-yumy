import type { Side } from './content.ts';

export const BASE_NAMES = ['纸箱营地', '加固猫屋', '冻干要塞'] as const;
export const FEEDER_NAMES = ['小食盆', '单桶投喂器', '双桶投喂站', '输送投喂站', '加高粮仓', '自动分粮站', '双塔粮仓', '金爪粮食工坊'] as const;
export const BASE_TIERS = [1, 2, 3] as const;
export const CANNON_PIVOT = { x: 90, y: 61 };
export const cannonLength = (tier: number) => 25 + tier * 3;
const ink = '#655346', gold = '#d7b16b', cream = '#fff0cb';
const palette = (side: Side) => side === 'player'
  ? { main: '#7eaa90', dark: '#507d68', light: '#c4d8b5' }
  : { main: '#bc735a', dark: '#914d3d', light: '#e9ba93' };
const svg = (body: string, width = 180, height = 145) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const paw = (x: number, y: number, scale: number, color = cream) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="${color}" stroke="none"><path d="M-9 4q0-9 9-9t9 9q0 8-9 5-9 3-9-5Z"/><ellipse cx="-10" cy="-6" rx="3.5" ry="4.5"/><ellipse cx="-3.5" cy="-12" rx="3.5" ry="4.5"/><ellipse cx="4.5" cy="-12" rx="3.5" ry="4.5"/><ellipse cx="11" cy="-5.5" rx="3.5" ry="4.5"/></g>`;
const bolt = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.1" fill="${cream}" stroke-width="1.3"/>`;

/** Fixed footprint, visibly different rooflines. The barrel is a separate articulated part. */
export function baseShellSVG(side: Side, tier: number) {
  const c = palette(side);
  const shadow = '<ellipse cx="90" cy="129" rx="77" ry="12" fill="#6f5b3e" opacity=".17" stroke="none"/>';
  if (tier === 1) return svg(shadow + `<path d="M35 70 88 48l58 22v45l-56 20-55-20Z" fill="#bd986d"/>
    <path d="m35 70 55 20v45l-55-20Z" fill="#ddb986"/><path d="m35 70 53-22 58 22-56 21Z" fill="#f0d4a4"/>
    <path d="m49 70 39-15 43 15-41 14Z" fill="${c.dark}"/><path d="m58 69 30-9 31 10-29 10Z" fill="#8e7950"/>
    <path d="m55 73 10-6 11 7-9 5m32-7 12-5 10 6-12 6" fill="#edc587" stroke-width="1.5"/>
    <path d="m35 70-8 8 55 19 8-7m0 0 7 8 55-20-6-8" fill="#eacb97"/>
    <path d="m65 85 14 5v27l-14-5Z" fill="#f5e2b6" stroke="#caa471" stroke-width="1.5"/>
    <path d="m105 99 27-10v22l-27 10Z" fill="${c.main}"/>${paw(118, 105, .48)}
    <path d="M132 65V28m0 0 27 4-7 8 7 9-27-4Z" fill="${c.main}"/>
    <path d="m43 104 9 3m-9 5 6 2" stroke="#b18c5e" stroke-width="1.5"/>`);
  const walls = `<path d="M31 67 89 44l61 23v48l-60 22-59-22Z" fill="#c4a376"/>
    <path d="m31 67 59 23v47l-59-22Z" fill="${tier === 3 ? '#ead6aa' : '#e5c898'}"/>
    <path d="m31 106 59 21 60-21v10l-60 21-59-22Z" fill="${c.dark}"/>
    <path d="M31 67 88 34l62 33-60 24Z" fill="${c.main}"/><path d="m42 66 46-23 49 24-47 17Z" fill="${c.light}" stroke="${c.dark}" stroke-width="1.5"/>
    <path d="m26 67 64 25 65-25v8L90 100 26 75Z" fill="${tier === 3 ? gold : c.dark}"/>
    <path d="m51 85 27 10v29l-27-10Z" fill="${c.main}"/>${paw(65, 108, .62)}
    <path d="m105 99 28-10v28l-28 11Z" fill="#746c50"/><path d="m109 105 20-7m-20 14 20-7m-20 14 20-7" stroke="#f0d8a6" stroke-width="2"/>`;
  if (tier === 2) return svg(shadow + walls + `<path d="m36 62-2-28 25 16m66 0 24-16-2 29" fill="${c.main}"/>
    <path d="m42 50-1-9 10 8m83-1 9-7-1 10" fill="#f5d8b5" stroke="none"/>
    <path d="m32 80 9 4v29l-9-3m99-25 10-4v29l-10 4" fill="#f8e3b4"/>
    ${bolt(37, 89)}${bolt(37, 106)}${bolt(144, 89)}${bolt(144, 106)}
    <path d="M89 102v28" stroke="#b8996c" stroke-width="2"/>`);
  const tower = (x: number) => `<path d="M${x} 75l15-7 17 7v48l-17 8-15-8Z" fill="${c.main}"/>
    <path d="m${x + 15} 84 17-9v48l-17 8Z" fill="${c.dark}"/>
    <path d="M${x} 75V62l10 5v-9l5 3 7-3v9l10-5v13l-17 9Z" fill="#edd49d"/>
    <path d="m${x} 83 15 8 17-8v6l-17 8-15-8Z" fill="${gold}"/>
    <path d="M${x + 8} 101v13m15-13v13" stroke="#f4d893" stroke-width="3"/>`;
  return svg(shadow + walls + tower(14) + tower(135) + `<path d="m52 85 26 10v7L52 92Z" fill="${gold}"/>
    <path d="M119 49V20m0 0 25 3-7 8 7 8-25-3Z" fill="${gold}"/>${paw(129, 30, .3, c.dark)}
    <path d="m35 69 55 21 58-22" fill="none" stroke="#ffe6b2" stroke-width="1.8"/>`);
}

export function cannonMountSVG(side: Side, tier: number) {
  const c = palette(side), r = 14 + tier * 3;
  return svg(`<ellipse cx="40" cy="59" rx="${r + 4}" ry="10" fill="#aa8961"/>
    <path d="M${40 - r} 46v12q${r} 15 ${r * 2} 0V46Z" fill="${c.main}"/>
    <ellipse cx="40" cy="46" rx="${r}" ry="9" fill="${c.light}"/>
    <path d="M${41 - r} 57q${r - 1} 9 ${r * 2 - 2} 0" fill="none" stroke="${tier === 3 ? gold : c.dark}" stroke-width="2"/>
    ${tier > 1 ? `<path d="M${40 - r} 43v13m${r * 2} -13v13" stroke="${tier === 3 ? gold : cream}" stroke-width="5"/>` : ''}
    ${paw(40, 60, tier === 3 ? .44 : .34)}`, 80, 90);
}

export function cannonBarrelSVG(side: Side, tier: number) {
  const c = palette(side), d = side === 'player' ? -1 : 1, radius = 8 + tier * 2;
  const end = 48 + d * cannonLength(tier), near = 48 + d * 2;
  const metal = tier === 1 ? '#eedab0' : c.main;
  // Both elevations keep their own top light and a single open muzzle; the building stays upright.
  return svg(`<path d="M${40 - radius} ${near}L${41 - radius} ${end}Q40 ${end - 6} ${39 + radius} ${end}L${40 + radius} ${near}Q40 ${near + 8} ${40 - radius} ${near}Z" fill="${metal}"/>
    <path d="M${35 + radius} ${near - d * 1}L${34 + radius} ${end - d * 4}" stroke="${tier === 1 ? '#c7b084' : c.dark}" stroke-width="4"/>
    <path d="M${44 - radius} ${near + d * 5}L${45 - radius} ${end - d * 6}" stroke="${cream}" stroke-width="2"/>
    ${tier > 1 ? `<path d="M${40 - radius} ${end - d * 8}q${radius} ${d * 5} ${radius * 2} 0" fill="none" stroke="${tier === 3 ? gold : cream}" stroke-width="5"/>` : ''}
    <ellipse cx="40" cy="${end}" rx="${radius + 1}" ry="${6 + tier * .5}" fill="${tier === 3 ? '#e9c684' : cream}"/>
    <ellipse cx="40" cy="${end}" rx="${radius - 3}" ry="${3 + tier * .4}" fill="#625c4c" stroke-width="1.6"/>
    <path d="M${44 - radius} ${end - 1}q${radius - 4} -3 ${radius * 2 - 8} 0" fill="none" stroke="#fff5d9" stroke-width="1.3"/>`, 80, 90);
}

export function feederSVG(side: Side, economy: number) {
  const c = palette(side);
  const bowl = `<path d="m8 121 32 1-5 10H14Z" fill="${c.main}"/><ellipse cx="24" cy="121" rx="16" ry="5" fill="#b79668"/>
    <path d="m15 119 4-3 5 4m3 0 4-3 4 3" fill="#efc984" stroke-width="1.2"/>`;
  if (economy === 0) return svg(bowl);
  const hopper = (x: number) => `<path d="M${x} 97v18q7 5 14 0V97Z" fill="#ead7aa"/><ellipse cx="${x + 7}" cy="97" rx="7" ry="4" fill="${c.light}"/>
    <path d="M${x + 3} 104h8v7h-8Z" fill="${gold}" stroke-width="1.2"/><path d="M${x + 7} 117v5" stroke="${c.dark}" stroke-width="4"/>`;
  const belt = `<path d="M5 127h38v10H5Z" fill="${c.dark}"/><path d="M10 132h28" stroke="#e7d3ab" stroke-width="3"/><circle cx="10" cy="132" r="3" fill="${ink}"/><circle cx="38" cy="132" r="3" fill="${ink}"/>`;
  if (economy < 4) return svg(`${economy > 1 ? hopper(7) + hopper(24) : hopper(17)}${bowl}${economy === 3 ? belt : ''}`);
  // Higher production grows upward within the existing side-module footprint.
  const silo = (x: number, y: number, w: number) => `<path d="M${x} ${y + 7}v${115 - y}q${w / 2} 5 ${w} 0V${y + 7}Z" fill="${c.main}"/>
    <ellipse cx="${x + w / 2}" cy="${y + 7}" rx="${w / 2}" ry="5" fill="${c.light}"/>
    <path d="M${x + 4} ${y + 16}h${w - 8}v${100 - y}h-${w - 8}Z" fill="#ecd6a3" stroke-width="1.5"/>
    <path d="M${x + 5} 108h${w - 10}v-10l-${(w - 10) / 2} 3-${(w - 10) / 2}-4Z" fill="${gold}" stroke="none"/>`;
  const dual = economy >= 6;
  return svg(`${dual ? silo(4, 68, 18) + silo(25, 68, 18) : silo(8, economy >= 5 ? 69 : 79, 30)}
    ${economy >= 5 ? `<path d="M6 118h35v8H6Z" fill="${c.light}"/><circle cx="14" cy="122" r="3" fill="${gold}"/><path d="m13 118 3 8m-6-3 7-3" stroke-width="1.2"/><path d="M26 121h10" stroke="${c.dark}" stroke-width="2"/>` : bowl}
    ${belt}${economy >= 7 ? `<path d="m3 77 5-14 7 8 8-15 8 15 8-8 5 14Z" fill="${gold}" stroke-width="2"/>${paw(24, 91, .48, cream)}<circle cx="36" cy="121" r="3" fill="#b8dbad"/>` : ''}`);
}

export function baseDamageSVG(damage: number) {
  return svg(damage === 0 ? '' : `<path d="m93 102 7 4-4 7 6 4-4 10m-51-29 5 5-3 5 7 6" fill="none" stroke="#927050" stroke-width="2"/>
    ${damage > 1 ? '<path d="m122 91-7 9 6 5-5 12m-77-15 6 1 4-6" fill="none" stroke="#927050" stroke-width="2.5"/><path d="m49 128 8-3 4 7-8 3m70-8 7 2-2 6-9-3" fill="#d5b383" stroke-width="1.4"/>' : ''}`);
}

/** Menu and art-review composition uses the same sources as the battlefield. */
export function basePreviewSVG(side: Side, tier = 1, economy = 0) {
  const place = (source: string) => source.replace('<svg ', `<svg x="${CANNON_PIVOT.x - 40}" y="${CANNON_PIVOT.y - 48}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="145" viewBox="0 0 180 145">${baseShellSVG(side, tier)}${feederSVG(side, economy)}${place(cannonMountSVG(side, tier))}${place(cannonBarrelSVG(side, tier))}</svg>`;
}
