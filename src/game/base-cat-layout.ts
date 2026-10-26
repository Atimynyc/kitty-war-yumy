import { portraitProjection } from './projection.ts';

/** Opposite camp corners share a ground line with their base, away from the marching lane. */
export function baseCatLayout(width: number, height: number) {
  const { baseSize } = portraitProjection(width, height);
  const enemySize = Math.max(40, Math.min(76, width * .218, height * .26));
  const playerSize = enemySize * .92;
  const enemyBottom = 34 + enemySize;
  const playerBottom = height - 19;
  const offset = baseSize * .48 + enemySize * .49;
  const enemyX = width / 2 + offset;
  const bubbleWidth = Math.max(90, Math.min(112, width * .33));
  return {
    enemy: { x: enemyX, y: enemyBottom, size: enemySize },
    player: { x: width / 2 - offset, y: playerBottom, size: playerSize },
    bases: {
      enemy: { x: width / 2, y: enemyBottom - baseSize * .32 - 4 },
      player: { x: width / 2, y: playerBottom - baseSize * .32 - 4 },
    },
    bubble: {
      right: Math.max(8, width - enemyX - bubbleWidth / 2),
      top: enemyBottom + 8, width: bubbleWidth,
    },
  };
}
