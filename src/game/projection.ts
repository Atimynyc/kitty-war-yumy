import { BASE_X, UNITS } from './content.ts';
import { LANE_SPACING } from './combat-space.ts';

export function portraitProjection(width: number, height: number) {
  const unitSize = Math.max(36, Math.min(60, height / 9));
  const margin = Math.min(72, Math.max(48, height * .14));
  const spread = Math.min(38, Math.max(22, width * .075));
  return {
    unitSize,
    baseSize: Math.min(112, Math.max(78, width * .24)),
    catapultSplashSize() {
      // A soldier's body occupies about 76 of its 128 SVG pixels, excluding its weapon.
      // Leave room for the 2px outline, including on unusually tall displays.
      const limit = 2 * unitSize * 76 / 128 - 2;
      const diameter = UNITS.catapult.splash! * 2;
      return {
        width: Math.min(limit, Math.max(12, diameter * spread / LANE_SPACING)),
        height: Math.min(limit, Math.max(12, diameter * (height - margin * 2) / (BASE_X.enemy - BASE_X.player))),
      };
    },
    project(worldX: number, row = 1) {
      const progress = Math.max(0, Math.min(1, (worldX - BASE_X.player) / (BASE_X.enemy - BASE_X.player)));
      return { x: width / 2 + (row - 1) * spread, y: height - margin - progress * (height - margin * 2) };
    },
  };
}
