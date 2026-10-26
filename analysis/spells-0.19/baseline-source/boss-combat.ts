import { ORANGE_BOSS } from './content.ts';
import { LANE_SPACING } from './combat-space.ts';
import type { BattlePoint } from './combat-space.ts';

export interface Sweep { remaining: number; forwardX: number; forwardY: number }
export function bossCharge(sweep?: Sweep) {
  const elapsed=sweep?ORANGE_BOSS.windup-sweep.remaining:0;
  return {
    lift:sweep?Math.max(0,Math.min(1,elapsed/ORANGE_BOSS.lift)):0,
    holding:Boolean(sweep && elapsed>=ORANGE_BOSS.lift-1e-8 && sweep.remaining>ORANGE_BOSS.swipe+1e-8),
    swipe:sweep?Math.max(0,Math.min(1,(elapsed-ORANGE_BOSS.lift-ORANGE_BOSS.hold)/ORANGE_BOSS.swipe)):0,
  };
}
export function sweepDirection(from: BattlePoint, target: BattlePoint) {
  const dx=target.x-from.x,dy=(target.row-from.row)*LANE_SPACING,length=Math.hypot(dx,dy);
  return length>1e-8 ? {forwardX:dx/length,forwardY:dy/length} : {forwardX:-1,forwardY:0};
}
export function inBossSweep(origin: BattlePoint, sweep: Sweep, target: BattlePoint) {
  const dx=target.x-origin.x,dy=(target.row-origin.row)*LANE_SPACING;
  const forward=dx*sweep.forwardX+dy*sweep.forwardY;
  const lateral=-dx*sweep.forwardY+dy*sweep.forwardX;
  return forward>=-1e-8 && forward<=ORANGE_BOSS.sweepDepth+1e-8 && Math.abs(lateral)<=ORANGE_BOSS.sweepHalfWidth+1e-8;
}
export function bossSweepCorners(origin: BattlePoint, sweep: Sweep) {
  return [[0,-1],[1,-1],[1,1],[0,1]].map(([depth,side])=>({
    x:origin.x+sweep.forwardX*depth*ORANGE_BOSS.sweepDepth-sweep.forwardY*side*ORANGE_BOSS.sweepHalfWidth,
    row:origin.row+(sweep.forwardY*depth*ORANGE_BOSS.sweepDepth+sweep.forwardX*side*ORANGE_BOSS.sweepHalfWidth)/LANE_SPACING,
  }));
}
