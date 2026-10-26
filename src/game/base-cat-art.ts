import type { CatMood } from './base-dialogue.ts';
import type { CatAppearance } from './cat-appearance.ts';

export type BaseCatPartName = 'shadow' | 'tail' | 'body' | 'feet' | 'scarf' | 'leftEar' | 'rightEar' | 'head' | 'eyes' | 'jar' | 'hands';
export interface BaseCatPart { name: BaseCatPartName; x: number; y: number; svg: string }
export const BASE_CAT_MOOD_PARTS: BaseCatPartName[] = ['head','eyes','hands'];
export function baseCatTexture(side: string, mood: CatMood, part: BaseCatPartName) {
  return `base-cat-${side}-${BASE_CAT_MOOD_PARTS.includes(part)?mood:'calm'}-${part}`;
}

/** Separate coat regions and fixed pivots support recoloring and a seated puppet. */
export function baseCatParts(appearance: CatAppearance, mood: CatMood = 'calm', chubby = false): BaseCatPart[] {
  const c=appearance.coat, ink='#695343';
  const wrap=(body: string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g stroke="${ink}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  const part=(name: BaseCatPartName,x: number,y: number,body: string): BaseCatPart=>({name,x,y,svg:wrap(body)});
  const thick=chubby||appearance.body==='chubby',slim=!chubby&&appearance.body==='slim';
  const body=thick?'M36 75Q12 83 14 116q2 31 64 32 63 0 67-29 4-30-30-45Z':slim?'M58 78q-16 18-15 43 0 26 35 27 36 0 37-26 0-27-17-44Z':'M49 77q-20 17-18 43 1 27 47 28 47-1 49-27 1-28-22-44Z';
  const british=appearance.face==='round';
  const head=appearance.face==='pointed'?'M37 53Q39 32 61 35q20-7 38 0 22-3 25 18 7 17-2 29l-25 18q-17 12-33 0L38 82q-9-15-1-29Z':british?'M37 52Q39 31 61 35q20-7 38 0 22-4 24 18 9 14 3 28-8 23-46 23-40 0-48-23-5-15 5-29Z':'M33 53Q33 31 59 35q22-7 42 0 25-5 26 18 12 20 2 34-12 18-49 18-39 0-51-20-8-15 4-32Z';
  const eye=(x: number)=>appearance.eyeShape==='round'?`<ellipse cx="${x}" cy="67" rx="8" ry="9" fill="#fff8eb" stroke-width="1.5"/><ellipse cx="${x+1}" cy="67" rx="5" ry="6" fill="${appearance.eyes}" stroke="none"/><ellipse cx="${x+1}" cy="67" rx="2" ry="4" fill="${ink}" stroke="none"/>`:appearance.eyeShape==='almond'?`<path d="M${x-9} 68q9-14 18-2-8 11-18 2Z" fill="${appearance.eyes}" stroke-width="1.6"/><path d="M${x} 63v7" stroke-width="2.5"/>`:`<ellipse cx="${x}" cy="67" rx="4.2" ry="6" fill="${appearance.eyes}" stroke="none"/>`;
  const eyes=mood==='happy'
    ?'<path d="M48 67q7-10 14 0m36 0q7-10 14 0" fill="none" stroke-width="4"/>'
    :`${eye(55)}${eye(105)}<path d="M56 64h.1m50 0h.1" stroke="#fff8eb" stroke-width="2.4"/>`;
  const calmMouth=appearance.mouth==='smile'?'<path d="M68 86q12 15 24 0" fill="none" stroke-width="2.5"/>':appearance.mouth==='tiny'?'<ellipse cx="80" cy="89" rx="3" ry="4" fill="#88594c" stroke="none"/>':'<path d="M80 83v5m0 0q-5 7-12 1m12-1q5 7 12 1" fill="none" stroke-width="2.2"/>';
  const mouth=mood==='happy'||mood==='hungry'
    ?`<path d="M69 84q11 6 22 0-1 15-11 15-9 0-11-15Z" fill="#88594c" stroke-width="2"/><path d="M74 93q6-5 13 0-7 8-13 0" fill="#e7a3a0" stroke="none"/>${mood==='hungry'?'<path d="M92 89q10 10 3 14-7 0-3-14Z" fill="#c2e4df" stroke-width="1.6"/>':''}`
    :mood==='worried'?'<path d="M71 91q9-11 18 0" fill="none" stroke-width="2.6"/>':calmMouth;
  const paw=(x: number,y: number,tilt: number)=>`<g transform="rotate(${tilt} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${appearance.paws==='round'?15:12}" ry="${appearance.paws==='round'?14:16}" fill="${c.paws}"/>${appearance.paws==='fluffy'?`<path d="m${x-10} ${y-6}-4 5 4 1-3 5 5-1m18-10 4 5-4 1 3 5-5-1" fill="${c.paws}" stroke-width="1.6"/>`:''}<path d="M${x-4} ${y+6}v3m7-3v3" stroke="${c.markings}" stroke-width="1.5"/></g>`;
  const hands=mood==='happy'?paw(23,95,-35)+paw(137,95,35):mood==='worried'?paw(56,119,-35)+paw(104,119,35):paw(thick?35:slim?51:44,114,-12)+paw(thick?126:slim?109:116,114,12);
  const tailPath=appearance.tail==='short'?'M38 132Q15 138 18 122':appearance.tail==='long'?'M38 132Q6 138 11 109T18 75':appearance.tail==='fluffy'?'M38 132Q6 132 17 105q12-22 4-32':'M38 132Q5 142 8 113q2-15 13-11 10 3 3 15';
  const ear=(right: boolean)=>{
    const outer=appearance.ears==='folded'?'M33 56 34 34Q45 27 67 42L47 48 38 44Z':appearance.ears==='round'?'M33 56Q24 15 46 23q14 5 21 19L60 60Z':british?'M37 55 39 22l30 18-7 18Z':'M33 56 33 18l34 22-7 20Z';
    const inner=appearance.ears==='folded'?'M38 38 47 44 57 41':appearance.ears==='round'?'M38 48q-6-24 7-17l11 11Z':'m39 31 1 19 12-10';
    return `<g${right?' transform="translate(160 0) scale(-1 1)"':''}><path d="${outer}" fill="${appearance.pattern==='point'?c.markings:c.head}"/><path d="${inner}" fill="${c.ears}" stroke="none"/></g>`;
  };
  const markings=appearance.pattern==='tabby'?`<path d="m65 36 4 12m11-14v14m14-12-4 12M33 62l10 3m-12 8 11 2m85-13-10 3m12 8-11 2" stroke="${c.markings}" stroke-width="4"/>`:appearance.pattern==='point'?`<path d="M46 53q34-17 68 0l4 23q-2 22-38 22T42 76Z" fill="${c.markings}" opacity=".8" stroke="none"/>`:appearance.pattern==='tuxedo'?`<path d="M80 42Q75 72 49 84q30 22 62 0Q86 70 80 42" fill="${c.muzzle}" stroke="none"/>`:appearance.pattern==='calico'?`<path d="M41 49q13-21 32-10l-9 31q-21 13-28-3Z" fill="${c.markings}" stroke="none"/><path d="M100 39q22-6 25 22l-11 14q-22-5-14-36" fill="#d99857" stroke="none"/>`:'';
  const nose=appearance.nose==='round'?'<ellipse cx="80" cy="79" rx="5" ry="4"/>':appearance.nose==='heart'?'<path d="M80 83q-12-7-7-10 4-3 7 1 3-4 7-1 5 3-7 10Z"/>':'<path d="m75 78 5 5 5-5q-5-4-10 0"/>';
  return [
    part('shadow',80,149,'<ellipse cx="81" cy="149" rx="68" ry="9" fill="#79634e" opacity=".16" stroke="none"/>'),
    part('tail',38,132,`<path d="${tailPath}" fill="none" stroke="${ink}" stroke-width="${appearance.tail==='fluffy'?26:17}"/><path d="${tailPath}" fill="none" stroke="${c.tail}" stroke-width="${appearance.tail==='fluffy'?20:11}"/>${appearance.pattern==='tabby'?`<path d="M9 118h10m-7 10 8-4" stroke="${c.markings}" stroke-width="3"/>`:''}`),
    part('body',80,144,`<path d="${body}" fill="${c.body}"/><ellipse cx="81" cy="119" rx="${thick?42:slim?23:30}" ry="27" fill="${c.belly}" stroke="none"/>`),
    part('feet',80,144,`<ellipse cx="49" cy="144" rx="${appearance.paws==='round'?22:20}" ry="${appearance.paws==='round'?11:9}" fill="${c.paws}"/><ellipse cx="112" cy="144" rx="${appearance.paws==='round'?22:20}" ry="${appearance.paws==='round'?11:9}" fill="${c.paws}"/>${appearance.paws==='fluffy'?`<path d="m30 141-4 4 6 1-2 5 7-2m93-8 4 4-6 1 2 5-7-2" fill="${c.paws}"/>`:''}<path d="M44 145v3m8-3v3m55-3v3m8-3v3" stroke="${c.markings}" stroke-width="1.8"/>`),
    part('scarf',80,100,`<path d="m47 90 66 1-11 16-20-5-21 5Z" fill="${appearance.scarf}"/><path d="m99 103 11 14-16 1-5-14" fill="${appearance.scarf}"/>`),
    part('leftEar',46,49,ear(false)),
    part('rightEar',114,49,ear(true)),
    part('head',80,92,`<path d="${head}" fill="${c.head}"/>
      ${appearance.breed==='ragdoll'||appearance.breed==='persian'?`<path d="m32 75-8 6 10 3-6 8 15-2m85-15 8 6-10 3 6 8-15-2" fill="${c.head}"/>`:''}
      ${markings}
      <path d="M49 80q7-9 21-4 10-5 20 0 15-6 22 5 5 15-31 17-34-2-32-18Z" fill="${c.muzzle}" stroke="none"/>
      ${mood==='worried'?'<path d="m46 55 15 5m38 0 15-5" fill="none" stroke-width="3.4"/>':''}
      <g fill="${appearance.noseColor}" stroke="none">${nose}</g>${mouth}
      <path d="m35 83-15-3m16 10-13 3m102-10 15-3m-16 10 13 3" fill="none" stroke-width="1.7"/>
      <ellipse cx="43" cy="81" rx="7" ry="3.5" fill="#e3a38a" opacity=".7" stroke="none"/><ellipse cx="117" cy="81" rx="7" ry="3.5" fill="#e3a38a" opacity=".7" stroke="none"/>`),
    part('eyes',80,67,eyes),
    part('jar',80,135,`<path d="M63 116h35v24q-17 9-35 0Z" fill="${chubby?'#d5b184':'#91ad90'}"/><ellipse cx="80.5" cy="116" rx="17.5" ry="5" fill="#fff0c9"/><path d="M72 113v-5h16v5" fill="none" stroke-width="2"/><path d="M74 132q0-7 6-7t7 7q0 5-7 2-6 3-6-2Z" fill="#fff3cf" stroke="none"/><path d="M72 125h.1m5-4h.1m6 0h.1m6 4h.1" stroke="#fff3cf" stroke-width="3"/>`),
    part('hands',80,114,hands),
  ];
}

/** Static previews share the same layers as the animated camp mascots. */
export function baseCatSVG(appearance: CatAppearance, mood: CatMood = 'calm', chubby = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">${baseCatParts(appearance,mood,chubby).map(p=>p.svg.replace(/^<svg[^>]*>|<\/svg>$/g,'')).join('')}</svg>`;
}
