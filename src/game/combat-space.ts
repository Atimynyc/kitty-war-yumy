/** Lateral spacing in simulation units; independent of phone size or orientation. */
export const LANE_SPACING = 80;
export interface BattlePoint { x: number; row: number }
export const battleDistance = (a: BattlePoint, b: BattlePoint) => Math.hypot(a.x - b.x, (a.row - b.row) * LANE_SPACING);
