export type Side = 'player' | 'enemy';
export type UnitKind = 'mouse' | 'soldier' | 'shield' | 'slinger' | 'catapult' | 'healer';
export interface UnitSpec {
  name: string; short: string; role: string; description: string;
  cost: number; population: number; tier: number; cooldown: number;
  hp: number; damage: number; interval: number; speed: number; range: number;
  minRange?: number; splash?: number; heal?: number; baseBonus?: number;
  color: string;
}
export const UNIT_ORDER: UnitKind[] = ['mouse', 'soldier', 'shield', 'slinger', 'catapult', 'healer'];
export const UNITS: Record<UnitKind, UnitSpec> = {
  mouse: { name: '发条玩具鼠', short: '玩具鼠', role: '快速突击', description: '轻巧又勇敢。跑得快、出兵快，适合补位；小心范围攻击。', cost: 30, population: 1, tier: 1, cooldown: 2, hp: 85, damage: 12, interval: .8, speed: 75, range: 35, color: '#e8cbb2' },
  soldier: { name: '小猫士兵', short: '小猫士兵', role: '均衡近战', description: '可靠的小队主力。挥起小鱼剑，向冻干前进！', cost: 60, population: 1, tier: 1, cooldown: 3, hp: 230, damage: 28, interval: 1, speed: 48, range: 40, color: '#efd29a' },
  shield: { name: '纸箱盾卫', short: '纸箱盾卫', role: '前排守护', description: '厚厚的纸箱就是安全感。高生命、低伤害，保护身后的投手。', cost: 100, population: 2, tier: 2, cooldown: 6, hp: 700, damage: 15, interval: 1.4, speed: 33, range: 42, color: '#cce0c6' },
  slinger: { name: '毛球投手', short: '毛球投手', role: '远程输出', description: '毛球也是武器。躲在前排身后持续输出，被近身时很脆弱。', cost: 90, population: 2, tier: 2, cooldown: 5, hp: 150, damage: 42, interval: 1.3, speed: 42, range: 200, color: '#ddcfe8' },
  catapult: { name: '猫咪投石机', short: '猫咪投石机', role: '范围攻城', description: '大毛球，大发挥。范围攻击、对基地伤害 ×1.7；近处 65 范围无法开火。', cost: 180, population: 3, tier: 3, cooldown: 9, hp: 260, damage: 105, interval: 3, speed: 27, range: 310, minRange: 65, splash: 70, baseBonus: 1.7, color: '#ead9bd' },
  healer: { name: '奶妈猫', short: '奶妈猫', role: '治疗支援', description: '给队友一点温柔。每 2 秒治疗附近最多 3 名受伤友军各 42 点；不能治疗基地。', cost: 150, population: 2, tier: 3, cooldown: 8, hp: 180, damage: 0, interval: 2, speed: 38, range: 155, heal: 42, color: '#f0d3d2' },
};
export const FOOD_RATES = [6, 9, 13, 18];
export const ECONOMY_COSTS = [120, 240, 400];
export const TECH_COSTS = [180, 360];
export const TECH_TIMES = [15, 20];
export const MAX_POPULATION = 24;
export const BASE_HP = 3000;
export const WORLD_WIDTH = 1440;
export const WORLD_HEIGHT = 448;
export const BASE_X: Record<Side, number> = { player: 155, enemy: 1285 };
export const TECH_NAMES = ['纸箱营地', '猫咪兵营', '冻干要塞'];
