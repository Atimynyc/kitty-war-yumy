import { Battle } from '../src/game/simulation.ts';
import { LEVELS } from '../src/game/levels.ts';
import { UNITS } from '../src/game/content.ts';
import { pathToFileURL } from 'node:url';

export const STRATEGIES = ['mouse-rush', 'soldier-rush', 'economy-and-tech', 'economy-opening', 'reserve-for-tech', 'combined-arms'];
export function simulateStrategy(level, strategy) {
  const battle = new Battle(); battle.reset(level.id); battle.level = level; battle.start();
  if (strategy === 'economy-opening' || strategy === 'combined-arms') battle.upgradeEconomy('player');
  let decision = 0;
  for (let frame = 0; frame < 30 * 900 && battle.phase === 'playing'; frame++) {
    if (frame % 15 === 0) {
      const army = battle.armies.player;
      const allies = battle.units.filter(u => u.side === 'player');
      const threatened = battle.units.some(u => u.side === 'enemy' && u.x < 430);
      if (threatened) battle.roar('player');
      decision++;
      if (strategy === 'combined-arms') {
        const count = kind => allies.filter(u => u.kind === kind).length;
        if (allies.filter(u => u.attacking).length >= 3) battle.catnip('player');
        let saving = false;
        if (allies.length >= 2 && army.hp > 1500) {
          if (army.economy < 3 && battle.time >= [0,22,48][army.economy]) {
            saving = !battle.upgradeEconomy('player');
          } else if (army.tech < 3 && !army.researching && battle.time >= [12,45][army.tech-1]) {
            saving = !battle.researchTech('player');
          }
        }
        if (!saving) {
          const desired = army.tech === 1 ? 'soldier'
            : count('shield') < 1 ? 'shield'
            : count('mage') < 1 ? 'mage'
            // A heavy frontliner helps break healing lines after the splash radius reduction.
            : army.tech === 3 && count('knight') < 1 ? 'knight'
            : army.tech === 3 && count('catapult') < 2 ? 'catapult'
            : army.tech === 3 && count('healer') < 1 ? 'healer'
            : count('slinger') < 4 ? 'slinger'
            : 'soldier';
          battle.summon('player', desired);
        }
      }
      else if (strategy === 'mouse-rush') battle.summon('player', 'mouse');
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
  return { level: level.id, strategy, winner: battle.winner ?? 'unfinished', seconds: Math.round(battle.time), playerHp: Math.round(battle.armies.player.hp), enemyHp: Math.round(battle.armies.enemy.hp), playerTech: battle.armies.player.tech, enemyTech: battle.armies.enemy.tech, playerIncomeLevel: battle.armies.player.economy + 1, enemyIncomeLevel: battle.armies.enemy.economy + 1, playerFood: Math.round(battle.armies.player.food), enemyFood: Math.round(battle.armies.enemy.food), ...(battle.winner ? {} : {remainingUnits:battle.units.map(({kind,side,x,hp})=>({kind,side,x:Math.round(x),hp:Math.round(hp)}))}) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(LEVELS.flatMap(level => STRATEGIES.map(strategy => simulateStrategy(level,strategy))), null, 2));
