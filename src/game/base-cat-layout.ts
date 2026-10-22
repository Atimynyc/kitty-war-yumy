/** Side alcoves keep the two mascots outside the central marching lane. */
export function baseCatLayout(width: number, height: number) {
  const enemySize = Math.max(44, Math.min(100, width * .255, (height - 110) / 1.8));
  const playerSize = enemySize * .84;
  const enemyBottom = 37 + enemySize;
  return {
    enemy: { x: width - enemySize / 2 - 8, y: enemyBottom, size: enemySize },
    player: { x: width - playerSize / 2 - 12, y: height - 9, size: playerSize },
    bubble: { right: 9, top: enemyBottom + 3, width: Math.max(98, Math.min(126, width * .34)) },
  };
}
