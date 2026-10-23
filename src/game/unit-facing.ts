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

/** Close contact can move a target past either shoulder briefly. Keep the body
 * settled while the weapon aims continuously; deliberate turns still complete. */
export class BodyDirection {
  private current?: DirectionArt;
  private pending?: DirectionArt;
  private pendingSince = 0;
  private changedAt = -Infinity;
  get turning() { return this.pending !== undefined; }
  update(forward: { x: number; y: number }, now: number) {
    const next=directionArt(forward,this.current);
    if(!this.current) return this.current=next;
    if(next.look===this.current.look && next.mirror===this.current.mirror) { this.pending=undefined; return this.current; }
    if(!this.pending || next.look!==this.pending.look || next.mirror!==this.pending.mirror) {
      this.pending=next; this.pendingSince=now;
    }
    if(now-this.pendingSince>=.1-1e-8 && now-this.changedAt>=.22-1e-8) {
      this.current=next; this.pending=undefined; this.changedAt=now;
    }
    return this.current;
  }
}
