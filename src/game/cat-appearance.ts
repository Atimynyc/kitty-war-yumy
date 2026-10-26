/** Cosmetic data only: never changes combat rules or unit statistics. */
export const CAT_OPTIONS = {
  breed: [['british-shorthair','英国短毛猫'],['domestic-shorthair','中华田园猫'],['ragdoll','布偶猫'],['siamese','暹罗猫'],['persian','波斯猫'],['scottish-fold','折耳猫']],
  face: [['round','圆脸'],['oval','椭圆脸'],['pointed','小尖脸']],
  body: [['standard','匀称'],['slim','苗条'],['chubby','圆滚滚']],
  ears: [['pointed','尖耳'],['round','圆耳'],['folded','折耳']],
  tail: [['curled','卷卷尾'],['long','长尾'],['short','短尾'],['fluffy','蓬松尾']],
  eyeShape: [['oval','豆豆眼'],['round','圆眼睛'],['almond','杏仁眼']],
  mouth: [['cat','小猫嘴'],['smile','微笑嘴'],['tiny','小小嘴']],
  nose: [['triangle','三角鼻'],['round','圆鼻'],['heart','爱心鼻']],
  paws: [['soft','软爪'],['round','圆爪'],['fluffy','毛绒爪']],
  pattern: [['tabby','虎斑'],['solid','纯色'],['tuxedo','双色'],['point','重点色'],['calico','三花']],
} as const;
export type CatFeature = keyof typeof CAT_OPTIONS;
type Choice<K extends CatFeature> = typeof CAT_OPTIONS[K][number][0];
export type CatBreed = Choice<'breed'>;
export type CatAppearance = { [K in CatFeature]: Choice<K> } & {
  coat: { body: string; head: string; ears: string; muzzle: string; belly: string; paws: string; tail: string; markings: string };
  eyes: string;
  noseColor: string;
  scarf: string;
}
export const PLAYER_CAT: CatAppearance = {
  breed: 'british-shorthair', face:'round', body:'standard', ears:'pointed', tail:'curled',
  eyeShape:'oval', mouth:'cat', nose:'triangle', paws:'soft', pattern:'tabby', noseColor:'#c17f76',
  coat: { body: '#aab8bf', head: '#b9c7cb', ears: '#e5b2aa', muzzle: '#fff6e3', belly: '#f6efdf', paws: '#fff6e3', tail: '#93a7af', markings: '#81969f' },
  eyes: '#668b7c', scarf: '#71937b',
};
export const ORANGE_CAT: CatAppearance = {
  ...PLAYER_CAT, breed: 'domestic-shorthair', face:'oval',
  coat: { body: '#e9ad60', head: '#efbc79', ears: '#e7a18a', muzzle: '#fff0cc', belly: '#ffe2aa', paws: '#fff0cc', tail: '#d99a50', markings: '#c98440' },
  eyes: '#796148', scarf: '#b85b49',
};

export const COAT_PALETTES = [
  { name:'雾蓝', body:'#aab8bf', head:'#b9c7cb', tail:'#93a7af', markings:'#81969f', light:'#fff6e3' },
  { name:'奶橘', body:'#e9ad60', head:'#efbc79', tail:'#d99a50', markings:'#b7763e', light:'#fff0cc' },
  { name:'奶油', body:'#e8d3b2', head:'#f0dfc3', tail:'#cbb38e', markings:'#a98d6c', light:'#fff8e9' },
  { name:'可可', body:'#ad8870', head:'#c3a089', tail:'#90715c', markings:'#70523f', light:'#f5dfc6' },
  { name:'雪白', body:'#eee9df', head:'#faf4e9', tail:'#d9d1c4', markings:'#afa598', light:'#fffaf1' },
  { name:'芝麻', body:'#625b58', head:'#756c66', tail:'#514a47', markings:'#393636', light:'#e6d9c4' },
];
export const CAT_COLORS = ['#fff6e3','#e9ad60','#c98440','#aab8bf','#81969f','#625b58','#ad8870','#e5b2aa','#668b7c','#78a4bf','#b9a1c6','#b85b49'];
export function copyCat(cat: CatAppearance): CatAppearance { return { ...cat, coat:{...cat.coat} }; }
export function coatPalette(cat: CatAppearance, index: number): CatAppearance {
  const p=COAT_PALETTES[index] ?? COAT_PALETTES[0];
  return {...cat,coat:{...cat.coat,body:p.body,head:p.head,tail:p.tail,markings:p.markings,muzzle:p.light,belly:p.light,paws:p.light}};
}
export function breedPreset(breed: CatBreed): CatAppearance {
  const cat=copyCat(PLAYER_CAT); cat.breed=breed;
  switch(breed) {
    case 'domestic-shorthair': return {...coatPalette(cat,1),face:'oval',body:'slim',tail:'long',eyes:'#a17a38'};
    case 'ragdoll': return {...coatPalette(cat,2),face:'oval',tail:'fluffy',paws:'fluffy',pattern:'point',eyeShape:'round',eyes:'#78a4bf'};
    case 'siamese': return {...coatPalette(cat,2),face:'pointed',body:'slim',tail:'long',pattern:'point',eyeShape:'almond',eyes:'#78a4bf',coat:{...coatPalette(cat,2).coat,markings:'#79604f'}};
    case 'persian': return {...coatPalette(cat,4),body:'chubby',ears:'round',tail:'fluffy',paws:'fluffy',eyeShape:'round',pattern:'solid',eyes:'#b99145'};
    case 'scottish-fold': return {...coatPalette(cat,3),ears:'folded',body:'chubby',tail:'short',eyeShape:'round'};
    default: return cat;
  }
}
const record=(v: unknown): v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const color=(value: unknown,fallback: string)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;
/** Whitelisted shapes and hex colors keep malformed saves out of SVG/HTML. */
export function readCatAppearance(raw: unknown): CatAppearance {
  if(!record(raw))return copyCat(PLAYER_CAT);
  const breed=CAT_OPTIONS.breed.some(([id])=>id===raw.breed)?raw.breed as CatBreed:PLAYER_CAT.breed;
  const cat=breedPreset(breed);
  for(const key of Object.keys(CAT_OPTIONS) as CatFeature[]) {
    const value=raw[key];
    if(CAT_OPTIONS[key].some(([id])=>id===value)) Object.assign(cat,{[key]:value});
  }
  if(record(raw.coat))for(const key of Object.keys(cat.coat) as (keyof CatAppearance['coat'])[])cat.coat[key]=color(raw.coat[key],cat.coat[key]);
  for(const key of ['eyes','noseColor','scarf'] as const)cat[key]=color(raw[key],cat[key]);
  return cat;
}
export const catSignature=(cat: CatAppearance)=>JSON.stringify(readCatAppearance(cat));
export const breedLabel=(cat: CatAppearance)=>CAT_OPTIONS.breed.find(([id])=>id===cat.breed)![1];
export function randomCat(): CatAppearance {
  const pick=<T>(items: readonly T[])=>items[Math.floor(Math.random()*items.length)];
  let cat=breedPreset(pick(CAT_OPTIONS.breed)[0]);
  cat=coatPalette(cat,Math.floor(Math.random()*COAT_PALETTES.length));
  for(const key of ['face','body','ears','tail','eyeShape','mouth','nose','paws','pattern'] as const)Object.assign(cat,{[key]:pick<readonly [string,string]>(CAT_OPTIONS[key])[0]});
  cat.eyes=pick(['#668b7c','#78a4bf','#a17a38','#796148']);
  return cat;
}
