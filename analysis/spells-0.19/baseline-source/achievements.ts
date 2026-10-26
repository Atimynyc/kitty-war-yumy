import { UNIT_ORDER, UNITS } from './content.ts';
import type { UnitKind } from './content.ts';
import { CHAPTERS, LEVELS } from './levels.ts';
import type { CampaignProgress } from './levels.ts';

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function addKind(list: UnitKind[], kind: UnitKind) { if (UNIT_ORDER.includes(kind) && !list.includes(kind)) list.push(kind); }
export function emptyRunStats() {
  return { recruited: [] as UnitKind[], participated: [] as UnitKind[], drummed: [] as UnitKind[],
    maxTech: 1, maxEconomy: 1, gunnerDamage: 0, prevented: 0, dodges: 0, hookTargets: 0, boxerTargets: 0,
    litterMax: 0, assassinBase: false, casts: 0, regroupPeak: 0, regroupWindow: -1, regroupDamage: 0, bossDefeated: false };
}
export type RunStats = ReturnType<typeof emptyRunStats>;
export const COUNTERS = ['gunnerDamage', 'prevented', 'dodges', 'hookTargets', 'boxerTargets'] as const;
export function emptyAchievements() {
  return { rulesVersion: 1 as const, unlocked: {} as Record<string, { unlockedAt: number; source: 'play' | 'migration' }>,
    stats: { recruited: [] as UnitKind[], drummed: [] as UnitKind[], gunnerDamage: 0, prevented: 0, dodges: 0, hookTargets: 0, boxerTargets: 0, flags: [] as string[] },
    equippedTitle: null as string | null, unseenIds: [] as string[] };
}
export type Achievements = ReturnType<typeof emptyAchievements>;
export const CATEGORIES = ['守护旅程', '小窝经营', '伙伴收藏', '伙伴拿手戏', '战术时刻'];
export const TITLES = [
  { id: 'apprentice', count: 6, name: '见习守护喵' }, { id: 'commander', count: 12, name: '小窝指挥官' },
  { id: 'tactician', count: 18, name: '猫咪战术家' }, { id: 'legend', count: 24, name: '传奇冻干守护者' },
];
export interface Achievement { id: string; name: string; category: number; description: string; target: number; unit?: UnitKind; chapter?: number; counter?: typeof COUNTERS[number] | 'recruited' | 'drummed'; icon: string }
export const ACHIEVEMENTS: Achievement[] = [
  ...['阳光下的小窝','纸箱里的王国','零食保管员','花园守护者','月光巡逻队','一粒也不能少'].map((name, i) => ({ id: `journey.${CHAPTERS[i].scene}`, name, category: 0, description: `通关${CHAPTERS[i].name}全部五关`, target: 5, chapter: i + 1, icon: ['sun','box','jar','leaf','moon','crown'][i] })),
  { id:'growth.first-feeder', name:'开饭啦', category:1, description:'首次成功升级到产能 Lv.2', target:1, icon:'jar' },
  { id:'growth.first-research', name:'纸箱也有科技', category:1, description:'首次完成二阶科技研究', target:1, icon:'star' },
  { id:'growth.fortress', name:'小窝变要塞', category:1, description:'一局中完成三阶科技，并赢得该局', target:1, icon:'box' },
  { id:'growth.food-factory', name:'金爪粮食工坊', category:1, description:'一局中升到产能 Lv.8，并获胜；先稳住前排再投资', target:1, icon:'crown' },
  { id:'collection.eight', name:'小队初成', category:2, description:'跨局成功招募 8 种不同伙伴', target:8, counter:'recruited', icon:'paw' },
  { id:'collection.sixteen', name:'一个都不能少', category:2, description:'跨局成功招募全部 16 种伙伴，无需同时在场', target:16, counter:'recruited', icon:'paw' },
  { id:'specialist.gunner', name:'软弹神射手', category:3, description:'玩具枪手对敌军累计造成 2,000 点有效伤害', target:2000, counter:'gunnerDamage', unit:'gunner', icon:'star' },
  { id:'specialist.litter', name:'猫砂请签收', category:3, description:'同一枚猫砂炸弹让 3 名存活敌军受到减攻', target:1, unit:'litter', icon:'star' },
  { id:'specialist.kungfu', name:'你打不着我', category:3, description:'功夫猫累计闪避 20 次，不要求连续', target:20, counter:'dodges', unit:'kungfu', icon:'star' },
  { id:'specialist.assassin', name:'偷偷到你家', category:3, description:'同一只刺客触发隐身后，显形并伤害敌方基地', target:1, unit:'assassin', icon:'moon' },
  { id:'specialist.umbrella', name:'一起躲雨吧', category:3, description:'伞盾累计为我方减少 500 点有效远程伤害', target:500, counter:'prevented', unit:'umbrella', icon:'leaf' },
  { id:'specialist.drummer', name:'跟着节奏来', category:3, description:'跨局让 3 种伙伴在鼓舞生效时伤害敌军', target:3, counter:'drummed', unit:'drummer', icon:'star' },
  { id:'specialist.hook', name:'你过来呀', category:3, description:'吸盘累计拉动 3 名不同的敌方远程兵', target:3, counter:'hookTargets', unit:'hook', icon:'star' },
  { id:'specialist.boxer', name:'让一让，猫来了', category:3, description:'拳套累计击退 10 名不同敌军', target:10, counter:'boxerTargets', unit:'boxer', icon:'star' },
  { id:'tactic.mixed-team', name:'各有所长', category:4, description:'同一局至少 5 种伙伴实际参战，并获胜', target:1, icon:'paw' },
  { id:'tactic.regroup-push', name:'趁现在，向前', category:4, description:'同一整备窗口伤害敌基地 500 点，并赢得该局', target:1, icon:'sun' },
  { id:'tactic.energy-loop', name:'再来一招', category:4, description:'同一局成功释放至少 2 次技能', target:1, icon:'star' },
  { id:'tactic.orange-boss', name:'胖橘也得让路', category:4, description:'在第 30 关真正击败胖橘，并赢得该局', target:1, icon:'crown' },
];
export function achievementValue(a: Achievement, data: Achievements, progress: CampaignProgress) {
  if (data.unlocked[a.id]) return a.target;
  if (a.chapter) return LEVELS.filter(l => l.chapter === a.chapter && progress[l.id]).length;
  if (a.counter) { const value = data.stats[a.counter]; return Math.min(a.target, Array.isArray(value) ? value.length : Math.floor(value)); }
  return data.stats.flags.includes(a.id) ? 1 : 0;
}
export function unlockAchievements(data: Achievements, progress: CampaignProgress, source: 'play' | 'migration' = 'play', now = Date.now()) {
  const gained: string[] = [];
  for (const a of ACHIEVEMENTS) if (!data.unlocked[a.id] && achievementValue(a, data, progress) >= a.target) {
    data.unlocked[a.id] = { unlockedAt: now, source }; data.unseenIds.push(a.id); gained.push(a.id);
  }
  return gained;
}
/** Apply only the delta since the last captured checkpoint. The checkpoint and totals share one save. */
export function absorbRun(data: Achievements, current: RunStats, applied: RunStats) {
  for (const key of COUNTERS) data.stats[key] = Math.min(1e12, data.stats[key] + Math.max(0, current[key] - applied[key]));
  for (const kind of current.recruited) addKind(data.stats.recruited, kind);
  for (const kind of current.drummed) addKind(data.stats.drummed, kind);
  const flag = (id: string, condition: boolean) => { if (condition && !data.stats.flags.includes(id)) data.stats.flags.push(id); };
  flag('growth.first-feeder', current.maxEconomy >= 2); flag('growth.first-research', current.maxTech >= 2);
  flag('specialist.litter', current.litterMax >= 3); flag('specialist.assassin', current.assassinBase);
  flag('tactic.energy-loop', current.casts >= 2);
}
export function awardVictory(data: Achievements, stats: RunStats, stage: number) {
  const flags = [stats.maxTech >= 3 && 'growth.fortress', stats.maxEconomy >= 8 && 'growth.food-factory',
    stats.participated.length >= 5 && 'tactic.mixed-team', stats.regroupPeak >= 500 && 'tactic.regroup-push',
    stage === 30 && stats.bossDefeated && 'tactic.orange-boss'];
  for (const id of flags) if (id && !data.stats.flags.includes(id)) data.stats.flags.push(id);
}
export function equippedTitle(data: Achievements) { return TITLES.find(t => t.id === data.equippedTitle && Object.keys(data.unlocked).length >= t.count)?.name ?? ''; }
export function missingPartners(data: Achievements) { return UNIT_ORDER.filter(k => !data.stats.recruited.includes(k)).map(k => UNITS[k].name); }
