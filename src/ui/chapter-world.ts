import type { SceneId } from '../game/levels.ts';

type Point = readonly [number, number];
export const CHAPTER_WORLDS: Record<SceneId, { floor:string; wall:string; accent:string; route:readonly Point[] }> = {
  sunroom:{floor:'#e8d8b8',wall:'#e9efdc',accent:'#789568',route:[[90,360],[220,290],[355,350],[475,220],[365,95]]},
  cardboard:{floor:'#dfc29a',wall:'#eedfc5',accent:'#ad7c48',route:[[105,365],[245,310],[155,180],[355,155],[480,90]]},
  kitchen:{floor:'#d9e6dc',wall:'#eef3e5',accent:'#689e94',route:[[95,360],[235,290],[400,355],[485,220],[350,100]]},
  balcony:{floor:'#dce2ba',wall:'#eaf1cd',accent:'#839c54',route:[[110,360],[260,300],[170,180],[365,145],[500,80]]},
  rooftop:{floor:'#abb8cc',wall:'#cbd5e5',accent:'#777fa7',route:[[90,355],[230,285],[390,345],[485,215],[350,100]]},
  pantry:{floor:'#dfc9a2',wall:'#eee0c3',accent:'#a2804c',route:[[105,365],[250,295],[155,175],[355,145],[500,80]]},
};
const box=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="m-36-20 36-17 36 17v46L0 43l-36-17Z" fill="#cfa46e"/><path d="M-36-20 0-3l36-17M0-3v46" fill="none"/><path d="m-14-31 36 17v15l-9 4v-15l-36-17Z" fill="#f5dfaf" stroke="none"/><path d="m-17 15 8-4m12 14 13-6"/></g>`;
const plant=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-25 4h50l-7 36h-36Z" fill="#cb9675"/><path d="M0 5v-42"/><path d="M0-12q-43-4-34-28 28-7 34 28Zm0-10q4-36 31-31 15 22-31 31ZM0-2q18-27 38-15-4 24-38 15Z" fill="#8ea66f"/></g>`;
const jar=(x:number,y:number,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><rect x="-24" y="-28" width="48" height="65" rx="11" fill="#abc29c"/><rect x="-27" y="-35" width="54" height="13" rx="5" fill="#d8b77f"/><rect x="-17" y="-8" width="34" height="27" rx="6" fill="#fff2d1"/><path d="m-9 4 8-6 10 6-9 8Z" fill="#dba65c" stroke="none"/></g>`;
const sofa=(x:number,y:number)=>`<g transform="translate(${x} ${y})"><rect x="-64" y="-37" width="128" height="70" rx="20" fill="#d6b09c"/><rect x="-48" y="-22" width="96" height="42" rx="13" fill="#efd0b3"/><path d="M0-20v38"/><rect x="-70" y="-4" width="22" height="43" rx="8" fill="#cd9f8c"/><rect x="48" y="-4" width="22" height="43" rx="8" fill="#cd9f8c"/><path d="M-45 40v10m90-10v10"/></g>`;
const windowArt=`<rect x="28" y="26" width="148" height="116" rx="12" fill="#fff5ce"/><path d="M102 28v112M30 84h144" stroke="#c6b48b" stroke-width="6"/><path d="M36 132 168 41v91Z" fill="#e7edc9" opacity=".7" stroke="none"/>`;

/** Six local vector scenes; maps use a top-down route, home keeps the center clear for the cat. */
export function chapterWorldSVG(scene: SceneId, home=false) {
  const p=CHAPTER_WORLDS[scene];
  const common=`<rect width="600" height="480" fill="${p.wall}"/><path d="M0 155h600v325H0Z" fill="${p.floor}"/><path d="M0 155h600" stroke="#fff9e7" stroke-width="8"/>`;
  const floors:Record<SceneId,string>={
    sunroom:'<path d="m35 160 170 0 180 290H110Z" fill="#fff5ce" opacity=".4"/><path d="M0 240h600M0 330h600M0 420h600M110 156v84m300 0v90M220 330v90" stroke="#c8b08a" opacity=".4"/>',
    cardboard:'<path d="M0 245h600M0 350h600M180 155v90m240 0v105M240 350v130" stroke="#b99a73" opacity=".4"/>',
    kitchen:`<g fill="#a9c5b6" opacity=".45">${Array.from({length:24},(_,i)=>{const row=Math.floor(i/6),col=i%6;return (row+col)%2?`<rect x="${col*100}" y="${155+row*82}" width="100" height="82"/>`:'';}).join('')}</g>`,
    balcony:'<path d="M0 200h600M0 275h600M0 350h600M0 425h600" stroke="#aabb87" opacity=".45"/><g fill="#b3c68b" stroke="none"><ellipse cx="300" cy="240" rx="190" ry="110" opacity=".4"/><ellipse cx="90" cy="380" rx="70" ry="50" opacity=".3"/></g>',
    rooftop:'<path d="M0 240h600M0 330h600M0 420h600M150 155v85m300 0v90M260 330v90" stroke="#8194ae" opacity=".5"/>',
    pantry:'<path d="M0 230h600M0 320h600M0 410h600M100 155v75m330 0v90M230 320v90" stroke="#b79d72" opacity=".4"/>',
  };
  const shelf=(x:number,y:number)=>`<g transform="translate(${x} ${y})"><rect x="-67" y="-53" width="134" height="136" rx="5" fill="#b18e62"/><path d="M-66 12H66M-66 76H66" stroke="#f0d2a0" stroke-width="8"/>${jar(-34,-20,.7)}${jar(31,-20,.7)}${jar(-30,44,.65)}${jar(31,44,.65)}</g>`;
  const features:Record<SceneId,string>={
    sunroom:`${windowArt}${sofa(500,110)}${plant(55,220,.8)}${home?'':sofa(480,420)}<circle cx="240" cy="65" r="27" fill="#fff0b4" stroke="none"/>`,
    cardboard:`${box(72,85,1.2)}${box(460,360,1.3)}${box(530,390,.7)}${box(480,30,.6)}<path d="m330 28 40 0 0 55-40 0Z" fill="#f4dbab" transform="rotate(-14 350 50)"/><path d="m338 43 22 0m-22 11h16" stroke="#ba9365"/>`,
    kitchen:`<rect x="16" y="28" width="157" height="103" rx="9" fill="#87ad9c"/><rect x="26" y="39" width="137" height="76" rx="5" fill="#b5cebb"/><path d="M97 40v75"/><circle cx="86" cy="78" r="4" fill="#f2d6a0"/>${jar(510,90,1.4)}${home?'':jar(70,185,.75)}<path d="M480 412q30-31 60 0-30 28-60 0Z" fill="#f6e3b7"/>`,
    balcony:`<path d="M0 35h600M0 120h600M30 35v130M100 35v130M170 35v130M430 35v130M500 35v130M570 35v130" stroke="#ae9e72" stroke-width="6"/>${plant(65,120,1.5)}${plant(530,330,1.6)}${plant(440,390,.9)}<g fill="#e8bba6" stroke="none"><circle cx="530" cy="255" r="13"/><circle cx="506" cy="266" r="11"/></g>`,
    rooftop:`<path d="M0 145V78l34-26 37 26v67m0 0V100l37-27 37 27v45m310 0V80l33-27 33 27v65m0 0V109l36-29 43 29v36" fill="#8e9fb9"/><circle cx="250" cy="60" r="34" fill="#fff1c3" stroke="none"/><path d="M0 16Q300 140 600 16" fill="none" stroke="#6c7f9b"/><g fill="#ffe4a2" stroke="none">${[45,140,235,330,425,520].map((x,i)=>`<circle cx="${x}" cy="${34+Math.sin(i/5*Math.PI)*44}" r="8"/>`).join('')}</g>${plant(540,400,.9)}`,
    pantry:`${shelf(86,68)}${shelf(510,320)}${box(70,430,.75)}<path d="M350 18h100v37H350Z" fill="#f8e8be"/><path d="m370 34 14-9 18 9-18 12Z" fill="#d5a559" stroke="none"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 480" preserveAspectRatio="none"><g stroke="#8c785e" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${common}${floors[scene]}${features[scene]}${home?`<ellipse cx="300" cy="405" rx="173" ry="44" fill="${p.accent}" opacity=".15" stroke="none"/>`:''}</g></svg>`;
}

export function routeSegments(scene:SceneId) {
  const points=CHAPTER_WORLDS[scene].route;
  return points.slice(1).map((end,i)=>{
    const start=points[i],middleY=(start[1]+end[1])/2;
    return `M${start[0]} ${start[1]}C${start[0]} ${middleY} ${end[0]} ${middleY} ${end[0]} ${end[1]}`;
  });
}

export function chapterRouteMarkup(scene:SceneId) {
  return `<svg class="chapter-route" viewBox="0 0 600 480" preserveAspectRatio="none" aria-hidden="true">${routeSegments(scene).map((d,i)=>`<g data-route-segment="${i}"><path class="route-edge" d="${d}"/><path class="route-path" d="${d}"/><path class="route-stitches" d="${d}"/></g>`).join('')}</svg>`;
}
