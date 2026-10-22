import { Battle } from '../src/game/simulation.ts';
import { LEVELS } from '../src/game/levels.ts';
import { UNITS } from '../src/game/content.ts';

const results = [];
for (const level of LEVELS) for (const strategy of ['mouse-rush', 'soldier-rush', 'economy-and-tech', 'economy-opening', 'reserve-for-tech']) {
  const battle = new Battle(); battle.reset(level.id); battle.start();
  if (strategy === 'economy-opening') battle.upgradeEconomy('player');
  let decision = 0;
  for (let frame = 0; frame < 30 * 900 && battle.phase === 'playing'; frame++) {
    if (frame % 15 === 0) {
      const army = battle.armies.player;
      const allies = battle.units.filter(u => u.side === 'player');
      const threatened = battle.units.some(u => u.side === 'enemy' && u.x < 430);
      if (threatened) battle.roar('player');
      decision++;
      if (strategy === 'mouse-rush') battle.summon('player', 'mouse');
      else if (strategy === 'soldier-rush') battle.summon('player', 'soldier');
      else {
        const safe = strategy === 'reserve-for-tech' ? allies.length >= 2 && (!threatened || army.hp > 1200) : allies.length >= 3 && !threatened;
        let investing = false;
        if (strategy === 'reserve-for-tech' && army.hp > 1500 && army.tech < 3 && !army.researching && battle.time > (army.tech === 1 ? 4 : 130)) {
          battle.researchTech('player'); investing = true;
        }
        if (!investing && safe && army.economy < 3 && battle.time > [15, 75, 150][army.economy]) {
          investing = battle.upgradeEconomy('player') || allies.length >= 5;
        }
        if (!investing && safe && !army.researching && army.tech < 3 && battle.time > (army.tech === 1 ? 45 : 140)) {
          investing = battle.researchTech('player') || allies.length >= 6;
        }
        if (!investing) {
          const count = kind => allies.filter(u => u.kind === kind).length;
          const choices = [];
          if (army.tech >= 3 && count('catapult') < 2) choices.push('catapult');
          if (army.tech >= 3 && count('healer') < 1 && allies.length >= 4) choices.push('healer');
          if (army.tech >= 2 && count('shield') < 2) choices.push('shield');
          if (army.tech >= 2 && count('slinger') < 4) choices.push('slinger');
          choices.push(army.hired % 4 === 3 ? 'mouse' : 'soldier');
          if (army.food >= UNITS[choices[0]].cost || (threatened && army.hp < 1200)) {
            for (const kind of choices) if (battle.summon('player', kind)) break;
          }
        }
      }
    }
    battle.step(1 / 30);
  }
  results.push({ level: level.id, strategy, winner: battle.winner ?? 'unfinished', seconds: Math.round(battle.time), playerHp: Math.round(battle.armies.player.hp), enemyHp: Math.round(battle.armies.enemy.hp), playerTech: battle.armies.player.tech, enemyTech: battle.armies.enemy.tech, playerIncomeLevel: battle.armies.player.economy + 1, enemyIncomeLevel: battle.armies.enemy.economy + 1 });
}
console.log(JSON.stringify(results, null, 2));
