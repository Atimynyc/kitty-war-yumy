import { CATNIP, ROAR } from './content.ts';
import type { Side } from './content.ts';

export type SpellKind = 'roar' | 'catnip';
export interface SpellNotice {
  id: number; side: Side; spell: SpellKind; affected: number;
  castAt: number; startsAt: number; endsAt: number;
}
export const SPELL_NOTICE_DURATION = 4.5;

/** Each army has its own queue so simultaneous casts cannot overwrite an opponent's notice. */
export class SpellNotices {
  private items: SpellNotice[] = [];
  private nextId = 1;
  reset() { this.items = []; this.nextId = 1; }
  prune(now: number) { this.items = this.items.filter(item => item.endsAt > now); }
  add(side: Side, spell: SpellKind, affected: number, now: number) {
    this.prune(now);
    const startsAt = Math.max(now, ...this.items.filter(item => item.side === side).map(item => item.endsAt));
    this.items.push({ id: this.nextId++, side, spell, affected, castAt: now, startsAt, endsAt: startsAt + SPELL_NOTICE_DURATION });
  }
  visible(now: number) {
    return this.items.filter(item => item.startsAt <= now && item.endsAt > now)
      .sort((a,b) => a.side === b.side ? a.id-b.id : a.side === 'enemy' ? -1 : 1);
  }
}

export function spellNoticeText(notice: SpellNotice) {
  const caster = notice.side === 'enemy' ? '敌方' : '我方';
  const title = `${caster}释放${notice.spell === 'catnip' ? '猫薄荷' : '震退'}`;
  const detail = notice.spell === 'catnip'
    ? `在场 ${notice.affected} 名${notice.side === 'enemy' ? '敌军' : '队友'}攻击力 +${Math.round(CATNIP.bonus * 100)}%，持续 ${CATNIP.duration} 秒；新出兵不享受`
    : notice.affected
      ? `击退 ${notice.affected} 名${notice.side === 'enemy' ? '我方单位' : '附近敌军'}，移速 −${Math.round(ROAR.slow * 100)}%，持续 ${ROAR.duration} 秒`
      : '震退已释放，基地附近没有可击退的敌人';
  return { title, detail };
}
