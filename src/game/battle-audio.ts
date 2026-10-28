import type { Battle } from './simulation.ts';
import type { GameAudio, Sound } from './audio.ts';

/** Observe presentation events once, without altering the deterministic battle/save. */
export function createBattleAudio(audio: GameAudio) {
  let revision = -1, tech = 1, boss = false, hp = 3000;
  let seen = new Set<number>(), landed = new Set<number>();
  return (battle: Battle, active: boolean) => {
    const fresh = revision !== battle.revision;
    const liveBoss = battle.units.some(unit => unit.kind === 'boss' && unit.hp > 0);
    const audible = active && battle.phase === 'playing' && !fresh;
    if (fresh) { seen.clear(); landed.clear(); revision = battle.revision; }
    if (audible) {
      if (battle.armies.player.tech > tech) audio.play('research');
      if (liveBoss && !boss) audio.play('boss');
      if (battle.armies.player.hp < hp) audio.play('baseHit');
    }
    tech = battle.armies.player.tech; hp = battle.armies.player.hp; boss = liveBoss;
    const current = new Set<number>(), impacts = new Set<number>();
    for (const fx of battle.effects) {
      current.add(fx.id);
      if (fx.landed) impacts.add(fx.id);
      if (audible && fx.type === 'bombard' && fx.landed && !landed.has(fx.id)) audio.play('impact');
      if (!audible || seen.has(fx.id)) continue;
      const sounds: Partial<Record<typeof fx.type, Sound>> = {
        hit: 'hit', shot: fx.kind === 'catapult' || fx.kind === 'litter' ? 'cannon' : 'shot',
        cannon: 'cannon', starHit: 'magic', heal: 'magic', sweep: 'sweep', dust: 'impact', hook: 'shot', drum: 'hit',
      };
      // Player casts already have immediate input feedback. Enemy casts share these cues.
      const sound = sounds[fx.type] ?? (fx.side === 'enemy' && ['treat', 'catnip', 'bombard'].includes(fx.type) ? fx.type as Sound : undefined);
      if (sound) audio.play(sound);
    }
    seen = current; landed = impacts;
  };
}
