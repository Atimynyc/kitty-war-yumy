import type { Side, UnitKind } from './content.ts';
import { UNITS } from './content.ts';
import { battleDistance } from './combat-space.ts';
import { portraitProjection } from './projection.ts';

interface Actor { id: number; x: number; row: number; side: Side; kind: UnitKind; targetId?: number | null }
export interface ScreenPoint { x: number; y: number }
export const unitScale = (kind: UnitKind) => kind === 'knight' ? 1.24 : kind === 'catapult' ? 1.14 : kind === 'mouse' ? .9 : 1;

/** Keep compressed front lines legible without changing simulation reach or collision. */
export function combatLayout(actors: Actor[], width: number, height: number, seed?: Map<number, ScreenPoint>) {
  const view = portraitProjection(width, height);
  const ordered = [...actors].sort((a, b) => a.id - b.id);
  const anchors = new Map(ordered.map(unit => [unit.id, view.project(unit.x, unit.row)]));
  const points = new Map(ordered.map(unit => [unit.id, { ...(seed?.get(unit.id) ?? anchors.get(unit.id)!) }]));
  const targets = new Map(ordered.map(unit => [unit.id, unit.targetId ?? ordered.filter(other => other.side !== unit.side)
    .sort((a,b) => battleDistance(unit,a)-battleDistance(unit,b) || a.id-b.id)[0]?.id]));
  const gaps = new Map<string, number>();
  for (let i = 0; i < ordered.length; i++) for (let j = i + 1; j < ordered.length; j++) {
    const a = ordered[i], b = ordered[j];
    let gap = view.unitSize * (unitScale(a.kind) + unitScale(b.kind)) / 2 * (a.side === b.side ? .62 : .86);
    const meleeReach = Math.max(...[a,b].map(u => UNITS[u.kind].range <= 60 ? UNITS[u.kind].range : 0));
    const engaged = targets.get(a.id) === b.id || targets.get(b.id) === a.id;
    if (a.side !== b.side && meleeReach && engaged) {
      const p = anchors.get(a.id)!, q = anchors.get(b.id)!;
      const projected = Math.hypot(q.x-p.x,q.y-p.y), logical = battleDistance(a,b);
      const reachPixels = logical > 0 ? projected * meleeReach / logical : 0;
      const padding = Math.max(0, gap - reachPixels);
      // Leave a closing gap until actual melee range. A fixed visual radius used
      // to pin both puppets in place while their hidden logical points approached.
      if (padding > .001) gap = Math.max(gap, projected + padding * Math.exp(-Math.max(0, projected-reachPixels) / (2*padding)));
    }
    gaps.set(`${a.id}:${b.id}`,gap);
  }
  for (let pass = 0; pass < 8; pass++) {
    if (seed) for (const unit of ordered) {
      const p = points.get(unit.id)!, anchor = anchors.get(unit.id)!;
      p.x += (anchor.x-p.x)*.015; p.y += (anchor.y-p.y)*.015;
    }
    const shifts = new Map(ordered.map(unit => [unit.id, { x: 0, y: 0 }]));
    for (let i = 0; i < ordered.length; i++) for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i], b = ordered[j], p = points.get(a.id)!, q = points.get(b.id)!;
      const minimum = gaps.get(`${a.id}:${b.id}`)!;
      let dx = q.x - p.x, dy = q.y - p.y, distance = Math.hypot(dx, dy);
      if (distance >= minimum) continue;
      if (distance < .001) {
        dx = a.side === b.side ? 1 : 0; dy = a.side === b.side ? 0 : a.side === 'player' ? -1 : 1; distance = 1;
      }
      const push = (minimum - distance) * .5;
      const sa = shifts.get(a.id)!, sb = shifts.get(b.id)!;
      sa.x -= dx / distance * push; sa.y -= dy / distance * push;
      sb.x += dx / distance * push; sb.y += dy / distance * push;
    }
    for (const unit of ordered) {
      const p = points.get(unit.id)!, shift = shifts.get(unit.id)!;
      const limit = Math.min(1, view.unitSize * .24 / (Math.hypot(shift.x, shift.y) || 1));
      p.x = Math.max(view.unitSize * .65, Math.min(width - view.unitSize * .65, p.x + shift.x * limit));
      p.y = Math.max(view.unitSize * .65, Math.min(height - view.unitSize * .65, p.y + shift.y * limit));
    }
  }
  return points;
}

/** Warm-start separation and ease only its offsets, so walking/knockback keep their
 * real speed while recruitment, target changes and deaths cannot reshuffle a crowd. */
export class CombatLayout {
  private positions = new Map<number, ScreenPoint>();
  private anchors = new Map<number, ScreenPoint>();
  private time = -Infinity;
  private width = 0;
  private height = 0;
  reset() { this.positions.clear(); this.anchors.clear(); this.time = -Infinity; }
  update(actors: Actor[], width: number, height: number, now: number) {
    const view = portraitProjection(width,height);
    const anchors = new Map(actors.map(unit=>[unit.id,view.project(unit.x,unit.row)]));
    const elapsed = Math.max(0, now-this.time);
    const reset = width !== this.width || height !== this.height || elapsed > .25;
    if (!reset && elapsed === 0 && anchors.size === this.anchors.size && [...anchors].every(([id,p]) => {
      const old=this.anchors.get(id); return old && old.x === p.x && old.y === p.y;
    })) return this.positions;
    const seed = new Map<number,ScreenPoint>();
    if (!reset) for (const unit of actors) {
      const p = this.positions.get(unit.id), old = this.anchors.get(unit.id), anchor = anchors.get(unit.id)!;
      if (p && old) seed.set(unit.id,{x:p.x+(anchor.x-old.x),y:p.y+(anchor.y-old.y)});
    }
    const desired = combatLayout(actors,width,height,reset ? undefined : seed);
    const positions = new Map<number,ScreenPoint>();
    for (const unit of actors) {
      const to = desired.get(unit.id)!, from = seed.get(unit.id);
      if (!from) { positions.set(unit.id,to); continue; }
      const dx=to.x-from.x, dy=to.y-from.y, distance=Math.hypot(dx,dy);
      const ease = Math.min(1-Math.exp(-10*elapsed), view.unitSize*1.4*elapsed/(distance || 1));
      positions.set(unit.id,{x:from.x+dx*ease,y:from.y+dy*ease});
    }
    this.positions=positions; this.anchors=anchors; this.time=now; this.width=width; this.height=height;
    return positions;
  }
}

/** Angle from the artwork's native forward direction to its actual screen-space target. */
export function targetFacing(from: ScreenPoint, to: ScreenPoint, side: Side) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.hypot(dx, dy) < .001) return 0;
  const angle = Math.atan2(dy, dx) + (side === 'player' ? Math.PI / 2 : -Math.PI / 2);
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
