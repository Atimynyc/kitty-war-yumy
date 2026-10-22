import type { Side } from './game/content.ts';

const svg = (body: string, w = 96, h = 96) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#655345" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

export function portraitBaseSVG(side: Side) {
  const accent = side === 'player' ? '#86a58b' : '#a596b9';
  return svg(`<ellipse cx="90" cy="116" rx="78" ry="17" fill="#7d674a" opacity=".13" stroke="none"/><path d="m17 59 70-34 75 33v52l-70 25-75-25Z" fill="#d6b389"/><path d="m17 59 70 23 75-24-75-33Z" fill="#efcf9e"/><path d="M87 82v53m-70-76 70 23 75-24" fill="none" stroke="#b18f64"/><path d="m40 57 46-20 46 19-46 17Z" fill="${accent}"/><path d="m51 56 35-13 32 12-32 10Z" fill="#f4deb4" stroke="none"/><path d="m66 48 14 2 2 10-15 1Zm22 7 12-6 9 7-12 6Z" fill="#ba8d55" stroke-width="1.5"/><path d="M134 60V9m0 1h31l-8 11 8 10h-31" fill="${accent}"/><path d="m46 85 24 8v20l-24-8Z" fill="#f8e8c9"/><path d="m53 95 10 3" stroke="#b28b5d"/><path d="m112 91 23-7v19l-23 7Z" fill="${accent}"/><path d="m110 111 35-10" stroke="#b18f64"/>`, 180, 145);
}
