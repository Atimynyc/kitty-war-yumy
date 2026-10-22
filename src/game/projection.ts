import { BASE_X } from './content.ts';

export function portraitProjection(width: number, height: number) {
  const unitSize = Math.max(36, Math.min(60, height / 9));
  const margin = Math.min(72, Math.max(48, height * .14));
  const spread = Math.min(38, Math.max(22, width * .075));
  return {
    unitSize,
    baseSize: Math.min(112, Math.max(78, width * .24)),
    project(worldX: number, row = 1) {
      const progress = Math.max(0, Math.min(1, (worldX - BASE_X.player) / (BASE_X.enemy - BASE_X.player)));
      return { x: width / 2 + (row - 1) * spread, y: height - margin - progress * (height - margin * 2) };
    },
  };
}
