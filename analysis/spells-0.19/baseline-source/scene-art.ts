import type Phaser from 'phaser';
import type { SceneId } from './levels.ts';
import { baseCatLayout } from './base-cat-layout.ts';
import { portraitProjection } from './projection.ts';

const palettes: Record<SceneId, { floor: number; lane: number; edge: number; line: number; prop: number }> = {
  sunroom: { floor: 0xe7d5b9, lane: 0xc8cbb0, edge: 0xece4c8, line: 0xc8b696, prop: 0x9fb18c },
  cardboard: { floor: 0xdbc3a0, lane: 0xe8d7b6, edge: 0xf4e7c8, line: 0xb79d79, prop: 0xc79964 },
  kitchen: { floor: 0xe2e5d4, lane: 0xc9d9c5, edge: 0xf1eed9, line: 0xa8bdb0, prop: 0x8caf9c },
  balcony: { floor: 0xd8c49c, lane: 0xcbd2b1, edge: 0xe9e0bd, line: 0xb09e79, prop: 0x7f9c66 },
  rooftop: { floor: 0xa4b3c5, lane: 0xc7cbd6, edge: 0xe5dfcf, line: 0x8496ac, prop: 0x727f9d },
  pantry: { floor: 0xdac49e, lane: 0xe6d5ac, edge: 0xf5e7c6, line: 0xb69b70, prop: 0x8eaa91 },
};
const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

/** Static scene geometry is repainted only on scene/size changes. Props stay outside the lane. */
export function drawChapterScene(g: Phaser.GameObjects.Graphics, scene: SceneId, w: number, h: number) {
  const p = palettes[scene], laneW = Math.min(420, w * .72), laneX = (w - laneW) / 2;
  g.clear().fillStyle(p.floor).fillRect(0, 0, w, h);
  g.lineStyle(1, p.line, .65);
  if (scene === 'kitchen') {
    const tile = 42;
    for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) {
      g.fillStyle((Math.floor(x / tile) + Math.floor(y / tile)) % 2 ? 0xc6d6c7 : 0xefecdb).fillRect(x + 1, y + 1, tile - 2, tile - 2);
    }
  } else if (scene === 'rooftop') {
    for (let y = 0; y < h; y += 48) {
      g.lineBetween(0, y, w, y);
      for (let x = (y / 48 % 2) * 36; x < w; x += 72) g.lineBetween(x, y, x, y + 48);
    }
  } else {
    const step = scene === 'balcony' ? 27 : 56;
    for (let y = 0; y < h; y += step) {
      g.lineBetween(0, y, w, y);
      const x = ((y / step) % 2 ? .3 : .7) * w;
      g.lineBetween(x, y, x, y + step);
    }
  }
  g.fillStyle(p.line, .2).fillRoundedRect(laneX - 3, 22, laneW + 6, h - 40, 18);
  g.fillStyle(p.lane).fillRoundedRect(laneX, 18, laneW, h - 40, scene === 'cardboard' || scene === 'pantry' ? 4 : 18);
  g.lineStyle(2, p.edge, .95).strokeRoundedRect(laneX + 7, 25, laneW - 14, h - 54, 12);
  if (scene === 'sunroom' || scene === 'balcony') {
    g.lineStyle(1.5, p.line, .7);
    for (let x = laneX + 16; x < laneX + laneW - 12; x += 9) { g.lineBetween(x, 12, x, 18); g.lineBetween(x, h - 22, x, h - 16); }
  }
  const left = w * .068, right = w * .932, size = Math.min(31, w * .105);
  const pot = (x: number, y: number, flower = false) => {
    g.fillStyle(0x6b6749, .12).fillEllipse(x + 2, y + size * .8, size * 1.3, size * .4);
    g.fillStyle(0xba9271).fillRoundedRect(x - size * .36, y, size * .72, size * .8, 5);
    g.fillStyle(p.prop).fillEllipse(x, y - 5, size, size * .85).fillEllipse(x - size * .23, y + 3, size * .8, size * .65).fillEllipse(x + size * .24, y + 1, size * .8, size * .7);
    if (flower) { g.fillStyle(0xf0c2ad).fillCircle(x, y - 7, 5); g.fillStyle(0xf8e6ae).fillCircle(x, y - 7, 2); }
  };
  const box = (x: number, y: number, tall = false) => {
    const bh = size * (tall ? 1.5 : .9);
    g.fillStyle(0x8c7153, .15).fillRoundedRect(x - size * .48 + 2, y + 4, size, bh, 3);
    g.fillStyle(0xc59a68).fillRoundedRect(x - size * .5, y, size, bh, 3);
    g.lineStyle(1.5, 0x97794f).strokeRoundedRect(x - size * .5, y, size, bh, 3);
    g.fillStyle(0xecd5a8).fillRect(x - size * .09, y, size * .18, bh);
    g.fillStyle(0xf3e6c9).fillRect(x - size * .34, y + bh * .58, size * .3, size * .2);
  };
  const jar = (x: number, y: number, tint: number) => {
    g.fillStyle(0x6d6752, .14).fillEllipse(x, y + size * 1.05, size, size * .3);
    g.fillStyle(tint).fillRoundedRect(x - size * .4, y, size * .8, size, 7);
    g.lineStyle(1.5, 0x8b7c62).strokeRoundedRect(x - size * .4, y, size * .8, size, 7);
    g.fillStyle(0xe6c78c).fillRoundedRect(x - size * .44, y - 4, size * .88, 7, 3);
    g.fillStyle(0xf7ebcd).fillRoundedRect(x - size * .25, y + 8, size * .5, size * .4, 3);
    g.fillStyle(0xb69a64).fillCircle(x, y + size * .44, 3);
  };
  if (scene === 'sunroom') {
    pot(left, h * .32);
    g.fillStyle(0xcba591).fillRoundedRect(right - size * .47, h * .58, size * .92, size * 2.2, 9);
    g.fillStyle(0xe2bd9e).fillRoundedRect(right - size * .32, h * .6, size * .64, size * 1.6, 6);
    g.fillStyle(0xfff2c4, .19).fillPoints([{ x: 0, y: h * .14 }, { x: w * .3, y: h * .24 }, { x: w * .3, y: h * .34 }, { x: 0, y: h * .23 }], true);
  } else if (scene === 'cardboard') {
    box(left, h * .22, true); box(right, h * .39); box(left, h * .63); box(right, h * .74, true);
    g.fillStyle(0xb79466).fillRoundedRect(left - size * .4, h * .46, size * .8, size * 1.6, 4);
    g.lineStyle(1, 0xdbc39e);
    for (let i = 0; i < 8; i++) g.lineBetween(left - size * .3, h * .46 + i * 5 + 3, left + size * .3, h * .46 + i * 5 + 3);
    g.lineStyle(3, 0xf4e5c0, .65);
    for (const y of [h * .33, h * .65]) g.lineBetween(laneX + 10, y, laneX + 24, y - 10);
  } else if (scene === 'kitchen') {
    for (const x of [left, right]) {
      g.fillStyle(0x93b6a3).fillRoundedRect(x - size * .48, h * .2, size * .96, h * .25, 5);
      g.lineStyle(1.5, 0x638e79).strokeRoundedRect(x - size * .36, h * .22, size * .72, h * .21, 4);
      g.fillStyle(0xe8d7ac).fillCircle(x, h * .31, 2.5);
    }
    jar(left, h * .63, 0xe5c29a); jar(right, h * .66, 0xc4cfb0);
    g.lineStyle(1, 0x9cb99f, .35);
    for (let y = 38; y < h - 35; y += 14) g.lineBetween(laneX + 12, y, laneX + laneW - 12, y);
  } else if (scene === 'balcony') {
    g.lineStyle(3, 0xa58b60, .6);
    for (const x of [left, right]) { g.lineBetween(x - 9, 0, x - 9, h); g.lineBetween(x + 9, 0, x + 9, h); }
    pot(left, h * .2, true); pot(right, h * .38); pot(left, h * .64); pot(right, h * .79, true);
    g.fillStyle(0x9caf80, .3);
    for (const y of [h * .24, h * .52, h * .72]) { g.fillEllipse(laneX + 17, y, 9, 5); g.fillEllipse(laneX + laneW - 17, y + 13, 5, 9); }
  } else if (scene === 'rooftop') {
    for (const x of [left, right]) {
      g.lineStyle(2, 0x62748c, .8).lineBetween(x, 0, x, h);
      for (let y = 28; y < h; y += 55) {
        g.lineStyle(2, 0x7a8da6).lineBetween(x - size * .4, y, x + size * .4, y);
        g.fillStyle(0xffe9ad, .15).fillCircle(x, y + 12, 11);
        g.fillStyle(0xffe1a0).fillRoundedRect(x - 4, y + 5, 8, 12, 4);
      }
    }
    g.fillStyle(0x7286a0, .2).fillPoints([{ x: 0, y: h * .4 }, { x: size, y: h * .36 }, { x: size, y: h * .55 }, { x: 0, y: h * .59 }], true);
  } else {
    for (const x of [left, right]) {
      g.fillStyle(0x9f805a).fillRoundedRect(x - size * .52, h * .2, size * 1.04, h * .53, 3);
      for (const y of [h * .22, h * .4, h * .59]) {
        g.fillStyle(0xc9aa7b).fillRect(x - size * .55, y + size * 1.15, size * 1.1, 5);
        jar(x, y, x === left ? 0x9fb49a : 0xddbe87);
      }
    }
    g.lineStyle(2, 0xc8ae7c, .45);
    for (let y = 45; y < h - 35; y += 80) { g.lineBetween(laneX + 13, y, laneX + 25, y + 6); g.lineBetween(laneX + laneW - 25, y + 6, laneX + laneW - 13, y); }
  }
  const camps = baseCatLayout(w, h), { baseSize } = portraitProjection(w, h);
  for (const side of ['enemy', 'player'] as const) {
    const cat = camps[side], base = camps.bases[side], friendly = side === 'player';
    const leftEdge = Math.min(cat.x - cat.size * .54, base.x - baseSize * .46);
    const rightEdge = Math.max(cat.x + cat.size * .54, base.x + baseSize * .46);
    const x = (leftEdge + rightEdge) / 2, y = cat.y - 6, width = rightEdge - leftEdge + 12;
    // A shared woven mat grounds the cat and warehouse as a single little camp.
    g.fillStyle(0x695343, .12).fillEllipse(x, y + 4, width + 7, 36);
    g.fillStyle(friendly ? 0x9bad8c : 0xd1a087).fillEllipse(x, y, width, 35);
    g.lineStyle(1.3, friendly ? 0x758b6c : 0xae795f, .7).strokeEllipse(x, y, width, 35);
    g.lineStyle(1, 0xffedce, .75).strokeEllipse(x, y - 1, width - 10, 26);
    // The smaller seat stays visible when the orange cat steps into the boss fight.
    g.fillStyle(friendly ? 0xc6d6b5 : 0xf0c5a1).fillEllipse(cat.x, y - 1, cat.size * .9, 19);
    g.lineStyle(1, friendly ? 0x829875 : 0xbe8b69, .8).strokeEllipse(cat.x, y - 1, cat.size * .9, 19);
  }
}

/** Compact chapter postcards, with the same palette and landmark vocabulary as the battle. */
export function chapterPostcard(scene: SceneId) {
  const p = palettes[scene];
  const motifs: Record<SceneId, string> = {
    sunroom: '<path d="M18 20h110v80H18Z" fill="#fff2c9"/><path d="M73 20v80M18 60h110" stroke="#cbb68e" stroke-width="5"/><path d="M318 110V66q0-15 15-15h45v59" fill="#d6ac91"/><rect x="305" y="88" width="84" height="47" rx="14" fill="#e4bea0"/>',
    cardboard: '<path d="m20 70 45-18 46 18v57l-45 17-46-17Z" fill="#c99f6b"/><path d="m20 70 46 16 45-16M66 86v58" stroke="#9d774e"/><path d="m45 62 17-7 47 17-17 7Z" fill="#f2deb3"/><path d="M319 55h65v80h-65Z" fill="#c6a171"/><path d="M345 55v80" stroke="#f0d9a7" stroke-width="12"/>',
    kitchen: '<path d="M0 32h120v111H0Zm280 0h120v143H280Z" fill="#91b49e"/><path d="M10 45h100v85H10Zm282-28h105v110H282Z" fill="none" stroke="#648b76"/><circle cx="86" cy="84" r="4" fill="#e8ce91"/><rect x="306" y="34" width="54" height="68" rx="13" fill="#e8c996"/><rect x="302" y="30" width="62" height="12" rx="5" fill="#c9a16b"/><rect x="317" y="56" width="32" height="27" rx="4" fill="#fff0d0"/>',
    balcony: '<path d="M0 20h120M280 20h120M20 0v150M80 0v150M320 0v150M380 0v150" stroke="#a18b65" stroke-width="6"/><path d="M38 103h48l-7 43H45Z" fill="#bf8e70"/><circle cx="62" cy="81" r="32" fill="#8aa56f"/><circle cx="37" cy="94" r="21" fill="#96b477"/><circle cx="346" cy="107" r="39" fill="#89a26a"/><circle cx="346" cy="88" r="11" fill="#efc4ab"/>',
    rooftop: '<path d="M0 110 25 90 50 110V150H0m48-40 30-30 30 30v40H48m244-25 32-30 32 30v25h-64m55-40 25-20 28 20v40h-53" fill="#7c8faa"/><path d="M0 24Q200 105 400 24" fill="none" stroke="#6b7d91" stroke-width="3"/><g fill="#ffe4a2"><circle cx="45" cy="41" r="6"/><circle cx="110" cy="58" r="6"/><circle cx="200" cy="65" r="6"/><circle cx="290" cy="58" r="6"/><circle cx="355" cy="41" r="6"/></g>',
    pantry: '<path d="M10 20h100v125H10Zm280 0h110v150H280Z" fill="#ad895b"/><path d="M10 80h100M280 70h110M280 135h110" stroke="#e4c18a" stroke-width="7"/><g fill="#a4b79a" stroke="#72886b"><rect x="26" y="33" width="26" height="41" rx="5"/><rect x="65" y="33" width="26" height="41" rx="5"/><rect x="296" y="85" width="30" height="45" rx="5"/><rect x="344" y="85" width="30" height="45" rx="5"/></g>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160" width="400" height="160"><rect width="400" height="160" fill="${hex(p.floor)}"/><path d="M125 0h150l35 160H90Z" fill="${hex(p.lane)}"/><path d="M137 0 106 160M263 0l31 160" stroke="${hex(p.edge)}" stroke-width="3"/>${motifs[scene]}<g fill="${hex(p.line)}" opacity=".4"><ellipse cx="185" cy="112" rx="5" ry="7"/><ellipse cx="198" cy="96" rx="5" ry="7"/><ellipse cx="211" cy="77" rx="4" ry="6"/></g></svg>`;
}
