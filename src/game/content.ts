export type Side = 'player' | 'enemy';
export type UnitKind = 'mouse' | 'soldier' | 'shield' | 'slinger' | 'mage' | 'catapult' | 'healer' | 'knight' | 'boss';
export interface UnitSpec {
  name: string; short: string; role: string; description: string;
  cost: number; population: number; tier: number; cooldown: number;
  hp: number; damage: number; interval: number; speed: number; range: number;
  minRange?: number; splash?: number; heal?: number; baseBonus?: number;
  color: string;
}
export const UNIT_ORDER: UnitKind[] = ['mouse', 'soldier', 'shield', 'slinger', 'mage', 'catapult', 'healer', 'knight'];
export const STAR_MAGIC = { slow: .3, duration: 3, travel: .32 };
export const CATNIP = { bonus: .2, duration: 10, energyCost: 50 };
export const ROAR = { range: 300, distance: 130, slow: .55, duration: 3, energyCost: 50 };
export const ENERGY = { starting: 50, max: 100 };
// Reward the defeated troop, once per kill, including defensive cannon kills.
export const ENERGY_REWARDS: Record<UnitKind, number> = {
  mouse: 2, soldier: 4, shield: 6, slinger: 5, mage: 6,
  catapult: 8, healer: 6, knight: 20, boss: 50,
};
// All melee troops must close to the same contact distance, including knights.
export const MELEE_CONTACT_RANGE = 22;
export const ORANGE_BOSS = {
  trigger: .3, entrance: 1.2, lift: 1.1, hold: .3, swipe: .12, recovery: .28,
  get windup() { return this.lift + this.hold + this.swipe; },
  knockback: 80, sweepDepth: 36, sweepHalfWidth: 96,
};
export const UNITS: Record<UnitKind, UnitSpec> = {
  boss: { name: '大胖橘', short: '大胖橘', role: '守关首领', description: '缓慢举起巨型猫爪，停顿后横扫身前一排并击退。', cost: 0, population: 0, tier: 99, cooldown: 0, hp: 2600, damage: 180, interval: 3.6, speed: 26, range: MELEE_CONTACT_RANGE, color: '#efbc79' },
  mouse: { name: '发条玩具鼠', short: '玩具鼠', role: '快速突击', description: '轻巧又勇敢。跑得快、出兵快，适合补位；小心范围攻击。', cost: 25, population: 1, tier: 1, cooldown: .8, hp: 85, damage: 12, interval: .8, speed: 75, range: MELEE_CONTACT_RANGE, color: '#e8cbb2' },
  soldier: { name: '小鱼干士兵', short: '小鱼干士兵', role: '均衡近战', description: '可靠的小队主力。挥起香喷喷的小鱼干，向冻干前进！', cost: 50, population: 1, tier: 1, cooldown: 1.2, hp: 230, damage: 28, interval: 1, speed: 48, range: MELEE_CONTACT_RANGE, color: '#efd29a' },
  shield: { name: '纸箱盾卫', short: '纸箱盾卫', role: '前排守护', description: '厚厚的纸箱就是安全感。高生命、低伤害，保护身后的投手。', cost: 90, population: 2, tier: 2, cooldown: 2.5, hp: 700, damage: 15, interval: 1.4, speed: 33, range: MELEE_CONTACT_RANGE, color: '#cce0c6' },
  slinger: { name: '毛球投手', short: '毛球投手', role: '远程输出', description: '毛球也是武器。躲在前排身后持续输出，被近身时很脆弱。', cost: 85, population: 2, tier: 2, cooldown: 2.4, hp: 150, damage: 42, interval: 1.3, speed: 42, range: 200, color: '#ddcfe8' },
  mage: { name: '逗猫棒法师', short: '逗猫棒法师', role: '星星迟缓', description: '挥动逗猫棒发射星星。命中使敌人攻速、移速降低 30%，持续 3 秒；再次命中刷新时长，不叠加。', cost: 110, population: 2, tier: 2, cooldown: 3.2, hp: 150, damage: 28, interval: 1.6, speed: 40, range: 220, color: '#d4d7f2' },
  catapult: { name: '猫咪投石机', short: '猫咪投石机', role: '范围攻城', description: '毛球小范围溅射，范围圈直径不超过两个小鱼干士兵的宽度。对基地伤害 ×1.7；近处 65 范围无法开火。', cost: 160, population: 3, tier: 3, cooldown: 4.5, hp: 260, damage: 105, interval: 3, speed: 27, range: 310, minRange: 65, splash: 35, baseBonus: 1.7, color: '#ead9bd' },
  healer: { name: '奶妈猫', short: '奶妈猫', role: '治疗支援', description: '给队友一点温柔。每 2 秒治疗附近最多 3 名受伤友军各 42 点；不能治疗基地。', cost: 130, population: 2, tier: 3, cooldown: 4, hp: 180, damage: 0, interval: 2, speed: 38, range: 155, heal: 42, color: '#f0d3d2' },
  knight: { name: '小狗骑士', short: '小狗骑士', role: '终极重骑', description: '铠甲猫咪骑上忠勇小狗，挺枪突破前线。三阶终极近战：1800 生命、每击 150 伤害；耗费 500 猫粮、6 人口，招募冷却 12 秒。', cost: 500, population: 6, tier: 3, cooldown: 12, hp: 1800, damage: 150, interval: 1.6, speed: 45, range: MELEE_CONTACT_RANGE, color: '#e6d6a6' },
};
// Each investment adds less income than the previous one: +6, +3, then +2.
export const FOOD_RATES = [12, 18, 21, 23];
export const ECONOMY_COSTS = [120, 180, 240];
export const TECH_COSTS = [150, 280];
export const TECH_TIMES = [8, 12];
export const MAX_POPULATION = 24;
export const BASE_HP = 3000;
export const BASE_X: Record<Side, number> = { player: 155, enemy: 1285 };

export const STARTING_FOOD = 240;
export const CANNON_DAMAGE = [32, 55, 85];
export const CANNON_RANGE = 280;
export const CANNON_INTERVAL = 2.5;
