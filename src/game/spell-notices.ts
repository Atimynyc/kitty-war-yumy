import { CATNIP, TREAT, BOMBARD, SPELLS } from './content.ts';
import type { Side } from './content.ts';

export type SpellKind = keyof typeof SPELLS;
export interface SpellNotice {
  id: number; side: Side; spell: SpellKind; affected: number;
  castAt: number; startsAt: number; endsAt: number;
  energyCost?: number; total?: number; power?: number;
}
export const SPELL_NOTICE_DURATION = 4.5;

/** Each army has its own queue so simultaneous casts cannot overwrite an opponent's notice. */
export class SpellNotices {
  private items: SpellNotice[] = [];
  private nextId = 1;
  save() { return { items: this.items.map(item => ({ ...item })), nextId: this.nextId }; }
  restore(s: ReturnType<SpellNotices['save']>) { this.items = s.items.map(item => ({ ...item })); this.nextId = s.nextId; }
  reset() { this.items = []; this.nextId = 1; }
  prune(now: number) { this.items = this.items.filter(item => item.endsAt > now); }
  add(side: Side, spell: SpellKind, affected: number, now: number, details: { total?: number; power?: number } = {}) {
    this.prune(now);
    const startsAt = Math.max(now, ...this.items.filter(item => item.side === side).map(item => item.endsAt));
    this.items.push({ id: this.nextId++, side, spell, affected, energyCost: SPELLS[spell].energyCost, ...details, castAt: now, startsAt, endsAt: startsAt + SPELL_NOTICE_DURATION });
  }
  visible(now: number) {
    return this.items.filter(item => item.startsAt <= now && item.endsAt > now)
      .sort((a,b) => a.side === b.side ? a.id-b.id : a.side === 'enemy' ? -1 : 1);
  }
}

export function spellNoticeText(notice: SpellNotice) {
  const caster = notice.side === 'enemy' ? '敌方' : '我方';
  const cost=notice.energyCost ?? SPELLS[notice.spell].energyCost;
  const title = `${caster}释放${SPELLS[notice.spell].name} · −${cost} 能量`;
  const detail = notice.spell === 'catnip'
    ? `在场 ${notice.affected} 名${notice.side === 'enemy' ? '敌军' : '队友'}攻击力 +${Math.round(CATNIP.bonus * 100)}%，持续 ${CATNIP.duration} 秒；新出兵不享受`
    : notice.spell === 'treat'
      ? `${notice.affected} 名受伤伙伴共恢复 ${notice.total ?? 0} 生命；每只恢复 ${TREAT.fraction*100}% 上限、最多 ${TREAT.cap}，不修复基地`
      : `锁定 ${notice.affected} 名敌人所在区域，${BOMBARD.delay} 秒后造成 ${notice.power ?? BOMBARD.damage[0]} 范围伤害；不伤友军和基地`;
  const summary=notice.spell==='treat' ? `${notice.affected} 名伙伴 · 共恢复 ${notice.total??0} 生命`
    : notice.spell==='catnip' ? `${notice.affected} 名伙伴攻击力 +20% · 10 秒`
    : `锁定敌群 · ${notice.power??BOMBARD.damage[0]} 范围伤害`;
  return { title, detail, summary };
}
