/** Shared art inputs for a future player-cat editor. No combat stats belong here. */
export type CatBreed = 'domestic-shorthair' | 'british-shorthair' | 'ragdoll';
export interface CatAppearance {
  breed: CatBreed;
  coat: { body: string; head: string; ears: string; muzzle: string; belly: string; paws: string; tail: string; markings: string };
  eyes: string;
  scarf: string;
}
export const PLAYER_CAT: CatAppearance = {
  breed: 'british-shorthair',
  coat: { body: '#aab8bf', head: '#b9c7cb', ears: '#e5b2aa', muzzle: '#fff6e3', belly: '#f6efdf', paws: '#fff6e3', tail: '#93a7af', markings: '#81969f' },
  eyes: '#668b7c', scarf: '#71937b',
};
export const ORANGE_CAT: CatAppearance = {
  breed: 'domestic-shorthair',
  coat: { body: '#e9ad60', head: '#efbc79', ears: '#e7a18a', muzzle: '#fff0cc', belly: '#ffe2aa', paws: '#fff0cc', tail: '#d99a50', markings: '#c98440' },
  eyes: '#796148', scarf: '#b85b49',
};
