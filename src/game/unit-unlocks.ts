import { UNIT_ORDER, UNITS } from './content.ts';
import type { UnitKind } from './content.ts';
import { LEVELS } from './levels.ts';
import type { CampaignProgress } from './levels.ts';

export const UNIT_UNLOCK_STAGE: Record<Exclude<UnitKind, 'boss'>, number> = {
  mouse:1, soldier:1, slinger:3, shield:4, kungfu:6, umbrella:8, mage:9,
  catapult:11, hook:13, litter:14, drummer:16, gunner:18, assassin:19,
  healer:21, boxer:22, knight:24,
};
export const UNIT_LESSONS: Partial<Record<UnitKind, string>> = {
  slinger:'让士兵站在前面，投手在后方持续输出。',
  shield:'敌方开始使用弹弓手，用盾卫保护你的远程伙伴。',
  kungfu:'用近战输出和闪避应对耐打的锅盖前排。',
  umbrella:'撑伞减少远程伤害，保护队伍；不能解除迟缓。',
  mage:'迟缓快速敌人，为前排和投手争取时间。',
  catapult:'用远射程和范围攻击推进，抓住空档轰击基地。',
  hook:'拉近射程内的法师、弹弓等远程敌人，交给近战伙伴。',
  litter:'对聚集敌人施加减攻，降低前排承受的伤害。',
  drummer:'鼓舞附近输出伙伴，为接下来的消耗战做准备。',
  gunner:'治疗敌人开始稳定出现，配合吸盘与增伤集中突破。',
  assassin:'利用受伤后的隐身穿过前线；不会指定追杀治疗兵。',
  healer:'持续治疗受伤前排，保住队伍并为重骑战做准备。',
  boxer:'击退小猪重骑，为远程争取时间；首领免疫击退。',
  knight:'攒粮召唤重装伙伴，配合治疗和远程一起推进。',
};
export const unlockStage = (kind: UnitKind) => kind === 'boss' ? Infinity : UNIT_UNLOCK_STAGE[kind];
export const unitsAtStage = (stage: number) => UNIT_ORDER.filter(kind=>unlockStage(kind)<=stage);
export const arrivalsAtStage = (stage: number) => UNIT_ORDER.filter(kind=>unlockStage(kind)===stage);
/** Research follows the permanent roster, including previously inherited partners. */
export const unlockedTech = (roster: readonly UnitKind[]) => Math.max(1,...roster.filter(kind=>kind!=='boss').map(kind=>UNITS[kind].tier));
export const techUnlockStage = (tier: number) => Math.min(...UNIT_ORDER.filter(kind=>UNITS[kind].tier>=tier).map(unlockStage));
export function techLockReason(roster: readonly UnitKind[], current: number) {
  return current<3 && current+1>unlockedTech(roster) ? `第 ${techUnlockStage(current+1)} 关解锁${current===1?'二':'三'}阶科技` : '';
}
export function reachedStage(progress: CampaignProgress) {
  const next=LEVELS.find(level=>!progress[level.id]);
  return next?.stage ?? 30;
}
export function unlockedUnits(progress: CampaignProgress, inherited: readonly UnitKind[] = []) {
  const reached=reachedStage(progress);
  return UNIT_ORDER.filter(kind=>unlockStage(kind)<=reached || inherited.includes(kind));
}
export function arrivalText(stage: number) {
  const tech=[2,3].find(tier=>techUnlockStage(tier)===stage);
  return `${tech?`${tech===2?'二':'三'}阶科技研究已开放。`:''}${arrivalsAtStage(stage).filter(kind=>unlockStage(kind)>1).map(kind=>`${UNITS[kind].short}：${UNIT_LESSONS[kind]}`).join(' ')}`;
}
