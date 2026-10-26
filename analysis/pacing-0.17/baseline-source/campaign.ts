import type { Level, SceneId } from './levels.ts';
import type { UnitKind } from './content.ts';

export interface Chapter { id: number; name: string; scene: SceneId; accent: string; description: string }
export const CHAPTERS: readonly Chapter[] = [
  { id: 1, name: '阳光客厅', scene: 'sunroom', accent: '#657f57', description: '从窗边的一小队，开始守护自己的家。' },
  { id: 2, name: '纸箱走廊', scene: 'cardboard', accent: '#996b3e', description: '纸箱堆起阵地，前排和后排一起向前。' },
  { id: 3, name: '零食厨房', scene: 'kitchen', accent: '#467f78', description: '穿过棋盘瓷砖，别让饼干罐落入敌手。' },
  { id: 4, name: '花园阳台', scene: 'balcony', accent: '#667f40', description: '花叶间的拉锯战，需要一点耐心与默契。' },
  { id: 5, name: '月光天台', scene: 'rooftop', accent: '#636a9b', description: '暖灯亮起，月光下迎来更强的伙伴与对手。' },
  { id: 6, name: '冻干仓库', scene: 'pantry', accent: '#94703e', description: '最后一罐冻干，大胖橘已经等候多时。' },
];

type Tactic = 'basic' | 'rush' | 'guard' | 'ranged' | 'magic' | 'siege' | 'support' | 'heavy' | 'mixed';
type Formations = UnitKind[][];
const formations: Record<Tactic, Formations> = {
  basic: [['soldier', 'soldier', 'mouse'], ['soldier', 'soldier', 'slinger'], ['shield', 'slinger', 'soldier', 'soldier']],
  rush: [['mouse', 'soldier', 'mouse', 'soldier'], ['soldier', 'mouse', 'slinger', 'soldier'], ['soldier', 'mage', 'mouse', 'catapult', 'soldier']],
  guard: [['soldier', 'soldier', 'soldier'], ['shield', 'soldier', 'slinger', 'shield', 'slinger'], ['shield', 'slinger', 'mage', 'healer', 'soldier']],
  ranged: [['soldier', 'soldier', 'mouse'], ['shield', 'slinger', 'slinger', 'soldier'], ['shield', 'slinger', 'catapult', 'mage', 'soldier']],
  magic: [['soldier', 'mouse', 'soldier'], ['shield', 'mage', 'soldier', 'mage', 'slinger'], ['shield', 'mage', 'catapult', 'healer', 'slinger']],
  siege: [['soldier', 'soldier', 'soldier', 'mouse'], ['shield', 'slinger', 'mage', 'soldier'], ['shield', 'catapult', 'soldier', 'slinger', 'catapult', 'mage']],
  support: [['soldier', 'soldier', 'mouse'], ['shield', 'mage', 'slinger', 'soldier'], ['shield', 'healer', 'slinger', 'mage', 'soldier', 'catapult']],
  heavy: [['soldier', 'soldier', 'mouse'], ['shield', 'mage', 'slinger', 'soldier'], ['shield', 'mage', 'knight', 'healer', 'slinger', 'soldier']],
  mixed: [['soldier', 'soldier', 'mouse'], ['shield', 'slinger', 'mage', 'soldier', 'slinger'], ['shield', 'catapult', 'mage', 'healer', 'slinger', 'soldier']],
};
const tacticLabels: Record<Tactic, string> = { basic: '基础小队', rush: '快速补位', guard: '锅盖阵地', ranged: '远程火力', magic: '铃音迟缓', siege: '零食攻城', support: '罐头补给', heavy: '小猪重骑', mixed: '协同混编' };
const covers: Record<Tactic, UnitKind> = { basic: 'soldier', rush: 'mouse', guard: 'shield', ranged: 'slinger', magic: 'mage', siege: 'catapult', support: 'healer', heavy: 'knight', mixed: 'shield' };
type StageSpec = [name: string, tactic: Tactic, tip: string, next?: Tactic];
const stages: StageSpec[] = [
  ['第一口冻干', 'basic', '先招募两名鱼干士兵，守住前线再升级产能。'],
  ['沙发下的动静', 'rush', '罐头侦察车跑得快，用士兵守住它们接近基地的路线。'],
  ['午后备粮', 'basic', '产能投资需要时间回本，记得留下一份补兵猫粮。', 'rush'],
  ['窗边小队', 'ranged', '研究二阶，让盾卫保护身后的毛球投手。'],
  ['客厅守护者', 'guard', '前排和远程一起出发，别让投手独自迎敌。', 'ranged'],
  ['胶带路标', 'guard', '对手的前排变厚了，给自己的远程留好保护。'],
  ['纸箱阵地', 'ranged', '盾卫能挡住伤害，远程伙伴负责持续输出。', 'guard'],
  ['走廊星光', 'magic', '敌人的铃音会拖慢攻速和脚步，前后排配合更重要。'],
  ['转角增援', 'rush', '对手随后会转为远程编队，保留一次救场技能。', 'ranged'],
  ['纸箱守卫队', 'mixed', '盾卫、投手、法师一起出场，及时研究和补位。', 'magic'],
  ['厨房开张', 'ranged', '对手会较早投资产能，选择压制或同步发展。'],
  ['饼干罐争夺', 'ranged', '投手火力很强，用前排保护自己的输出队伍。', 'magic'],
  ['零食弹道', 'siege', '零食投射车不能攻击近处目标，让近战接近它。'],
  ['最后一份储备', 'rush', '先应对快速骚扰，再研究三阶，别一次花光猫粮。', 'siege'],
  ['零食保卫队', 'siege', '盾卫掩护攻城兵，猫薄荷留给真正交战的队伍。', 'mixed'],
  ['花盆之间', 'support', '对手有罐头补给员支援，配合增伤与攻城打破消耗。'],
  ['藤架下的援军', 'guard', '前排退场后及时补位，别让远程失去掩护。', 'support'],
  ['薄荷时刻', 'support', '伙伴开始交战后再释放猫薄荷，提高这次增伤的收益。', 'magic'],
  ['落叶追逐', 'rush', '前线之外也要留意基地旁的快速敌人。', 'support'],
  ['阳台守护队', 'support', '治疗和迟缓一起上阵，补兵时兼顾保护与输出。', 'mixed'],
  ['夜灯亮起', 'magic', '先看清敌方编队，稳住前排后再攒粮研究。'],
  ['天台重骑', 'heavy', '小猪重骑兵很强，用前排承伤、法师迟缓来应对。'],
  ['月光拉锯', 'ranged', '后续增援会转为重装编队，保留灵活补兵的资源。', 'heavy'],
  ['连续来客', 'rush', '两段进攻间隔更短，别在前线未稳时连续投资。', 'heavy'],
  ['月下精英队', 'heavy', '骑士也需要伙伴，搭配远程与治疗一起推进。', 'mixed'],
  ['仓库门口', 'mixed', '观察前排、远程和攻城的比例，再决定补谁。'],
  ['标签迷阵', 'guard', '编队会阶段性变化，留意从迟缓到攻城的转换。', 'magic'],
  ['冻干争夺战', 'siege', '击杀会回能，给第二次攻势预留一次技能。', 'heavy'],
  ['胖橘的前哨', 'mixed', '准备完整的三阶队伍，不要让攻城兵失去保护。', 'support'],
  ['一粒也不能少', 'mixed', '敌方基地低于 30% 时胖橘登场，小心举爪后的横扫。', 'heavy'],
];

// Chapter starts ease off after the previous guard encounter. These tune decisions,
// never troop stats or free resources; the player retains all three research tiers.
const pacing = [
  { grace: 10, interval: 3, economy: [22, 72, 135], tech: [42, 112] },
  { grace: 7, interval: 2.25, economy: [18, 58, 115], tech: [34, 100] },
  { grace: 6, interval: 1.8, economy: [14, 50, 105], tech: [30, 84] },
  { grace: 5, interval: 1.4, economy: [12, 45, 98], tech: [26, 78] },
  { grace: 4, interval: 1.2, economy: [10, 40, 92], tech: [24, 72] },
  { grace: 4, interval: 1, economy: [9, 38, 88], tech: [22, 68] },
];

function chapterFormation(tactic: Tactic, stage: number): Formations {
  return formations[tactic].map(rotation => rotation.map(kind => {
    if (kind === 'mage' && stage < 8) return 'slinger';
    if (kind === 'catapult' && stage < 13) return 'slinger';
    if (kind === 'healer' && stage < 16) return 'soldier';
    if (kind === 'knight' && stage < 22) return 'soldier';
    return kind;
  }));
}

export const campaignLevels: readonly Level[] = stages.map(([name, tactic, tip, next], index) => {
  const stage = index + 1, slot = index % 5, chapter = CHAPTERS[Math.floor(index / 5)], pace = pacing[chapter.id - 1];
  // Give first encounters room to establish a front line before investment.
  const researchDelay = (stage >= 4 && stage <= 15) || stage === 17 ? 25 : 0;
  const economyDelay = chapter.id === 2 || chapter.id === 3 || stage === 17 ? 10 : 0;
  const cadence = [11, 13, 17, 27].includes(stage) ? 1.5 : 1;
  const baseInterval = Math.max(.6, pace.interval - slot * (chapter.id === 1 ? .2 : .12));
  const interval = baseInterval * cadence;
  const phaseAt = chapter.id < 3 ? 105 : 90;
  const phases = next ? [{ at: phaseAt, label: tacticLabels[next], formations: chapterFormation(next, stage), interval: Math.max(.6, baseInterval * .85) * cadence }] : [];
  if (stage === 27) phases.push({ at: 170, label: tacticLabels.siege, formations: chapterFormation('siege', stage), interval: .65 * cadence });
  const opening = chapterFormation(tactic, stage);
  // Early chapters stop investing earlier. Later opponents buy extra production
  // with the same prices; staggered schedules leave room for technology and attacks.
  const economyAt = pace.economy.map(time => time - slot * 2 + economyDelay);
  const economyCap = [2, 3, 3, 4, 4, 5][chapter.id - 1];
  const productionSchedule = [...economyAt, economyAt[2] + 65, economyAt[2] + 135].slice(0, economyCap);
  // The moonlit guard mixes affordable infantry into its expensive support line.
  if (stage === 25) for (const plan of [opening, ...phases.map(phase => phase.formations)]) plan[1] = ['soldier', ...plan[1], 'soldier', 'soldier'];
  return {
    id: `campaign-${String(stage).padStart(2, '0')}`, stage, chapter: chapter.id, scene: chapter.scene,
    name, subtitle: slot === 4 ? '章节守关' : `${chapter.name} · ${slot + 1} / 5`,
    difficulty: stage === 30 ? '最终守关' : slot === 4 ? '守关' : chapter.id === 1 ? '入门' : chapter.id < 4 ? '进阶' : '挑战',
    description: `${tacticLabels[tactic]}${next ? ` → ${tacticLabels[next]}` : ''}。${tip}`, tip, tactic: tacticLabels[tactic],
    grace: Math.max(2, pace.grace - slot), openingDuration: Math.max(22, 48 - chapter.id * 3 - slot * 2),
    openingInterval: (baseInterval + (chapter.id < 3 ? 1 : .5)) * cadence, interval,
    economyAt: productionSchedule, techAt: pace.tech.map(time => time - slot * 2 + researchDelay),
    investmentGuard: stage === 4 || stage === 5 || stage === 29 ? 3 : 2, savingTime: chapter.id === 1 ? 5 : 7, accent: chapter.accent,
    formations: opening, phases, techCap: stage <= 3 ? 1 : stage <= 12 ? 2 : 3,
    knight: stage >= 22, cover: stage === 30 ? 'boss' : covers[tactic],
    ...(stage === 30 ? { bossEncounter: { kind: 'orange' as const, trigger: .3 } } : {}),
  };
});
