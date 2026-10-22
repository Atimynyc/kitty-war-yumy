import type { UnitLook } from './unit-art.ts';

interface DirectionArt { look: UnitLook; mirror: number }

/** Keep tiny aim changes from repeatedly swapping body textures or weapon hands.
 * This only selects artwork; the weapon still uses the exact target direction. */
export function directionArt(forward: { x: number; y: number }, previous?: DirectionArt): DirectionArt {
  const sideThreshold = previous ? previous.look === 'side' ? .42 : .54 : .48;
  const mirrorThreshold = previous ? previous.mirror < 0 ? -.06 : -.18 : -.12;
  return {
    look: Math.abs(forward.x) > sideThreshold ? 'side' : forward.y > 0 ? 'front' : 'back',
    mirror: forward.x < mirrorThreshold ? -1 : 1,
  };
}
