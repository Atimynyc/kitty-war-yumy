import { UNITS } from './content.ts';
import type { Unit } from './simulation.ts';
import { bossCharge } from './boss-combat.ts';

export const DEATH_DURATION = .8;
export const ATTACK_WINDUP = .16;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const ease = (n: number) => 1 - (1 - clamp(n)) ** 3;

/** Visual offsets only: walking, recoil and death never move the simulated unit. */
export function unitMotion(unit: Unit, now: number, deathAt?: number, reduced = false) {
  const attackAge = now - unit.attackAt, hitAge = now - unit.hitAt;
  const dying = deathAt !== undefined;
  const deathAge = dying ? Math.max(0, now - deathAt) : 0;
  const attack = !dying && attackAge >= 0 && attackAge < .34 ? 1 - ease(Math.max(0, attackAge - .07) / .27) : 0;
  // Cooldown anticipates the next strike; a newly acquired target can strike immediately.
  const windup = !dying && unit.sweep ? bossCharge(unit.sweep).lift
    : !dying && unit.kind!=='boss' && unit.attacking && unit.attackCooldown > 0 && unit.attackCooldown < ATTACK_WINDUP
    ? 1 - unit.attackCooldown / ATTACK_WINDUP : 0;
  const wave = Math.sin(unit.walkDistance / 32 * Math.PI * 2 + unit.id * 1.7);
  const stride = !dying && unit.walking ? wave : 0;
  const hit = !dying && hitAge >= 0 && hitAge < .38 ? Math.exp(-hitAge * 10) * Math.cos(hitAge * 16) : 0;
  const moving = !reduced && !dying && unit.walking;
  return {
    state: dying ? 'death' : hitAge >= 0 && hitAge < .38 ? 'hurt' : attack || windup || unit.sweep ? 'attack' : unit.walking ? 'walk' : 'idle',
    stride: reduced ? 0 : stride, lift: moving ? Math.abs(stride) * 3 : 0,
    attack: reduced ? 0 : attack, windup: reduced ? 0 : windup, hit: reduced ? 0 : hit,
    flash: !reduced && hitAge >= 0 && hitAge < .08,
    fall: dying && !reduced ? ease(deathAge / .34) : 0,
    alpha: dying ? 1 - clamp((deathAge - .48) / (DEATH_DURATION - .48)) : 1,
    stars: dying && !reduced && deathAge >= .16,
    wheel: !reduced && !dying ? unit.walkDistance / (UNITS[unit.kind].speed > 50 ? 7 : 10) : 0,
  };
}
