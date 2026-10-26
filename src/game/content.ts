export type Side = 'player' | 'enemy';
export type EnemyKind = 'mouse' | 'soldier' | 'shield' | 'slinger' | 'mage' | 'catapult' | 'healer' | 'knight' | 'boss';
export type SpecialistKind = 'gunner' | 'litter' | 'kungfu' | 'assassin' | 'umbrella' | 'drummer' | 'hook' | 'boxer';
export type UnitKind = EnemyKind | SpecialistKind;
export interface UnitSpec {
  name: string; short: string; role: string; description: string;
  cost: number; population: number; tier: number; cooldown: number;
  hp: number; damage: number; interval: number; speed: number; range: number;
  minRange?: number; splash?: number; heal?: number; baseBonus?: number;
  color: string;
}
export const ENEMY_ORDER: EnemyKind[] = ['mouse', 'soldier', 'shield', 'slinger', 'mage', 'catapult', 'healer', 'knight'];
export const SPECIALIST_ORDER: SpecialistKind[] = ['gunner', 'litter', 'kungfu', 'assassin', 'umbrella', 'drummer', 'hook', 'boxer'];
export const UNIT_ORDER: UnitKind[] = [...ENEMY_ORDER, ...SPECIALIST_ORDER];
export const SPECIAL = {
  litter: { reduction: .35, duration: 4, travel: .4 },
  kungfu: { dodge: .3 }, assassin: { stealth: 3 },
  umbrella: { range: 140, reduction: .45, duration: 3, cooldown: 6 },
  drummer: { range: 155, haste: .25, duration: 3, cooldown: 5 },
  hook: { range: 260, pull: 140, windup: .6 },
  boxer: { push: 75, windup: .55 },
};
export const STAR_MAGIC = { slow: .3, duration: 3, travel: .32 };
export const CATNIP = { bonus: .2, duration: 10, energyCost: 40 };
export const TREAT = { fraction: .3, cap: 240, energyCost: 35 };
export const BOMBARD = { radius: 140, damage: [180, 240, 300], delay: .65, energyCost: 70 };
export const SPELLS = {
  treat: { name: '急救罐头', short: '急救', energyCost: TREAT.energyCost, key: 'H' },
  catnip: { name: '猫薄荷', short: '增伤', energyCost: CATNIP.energyCost, key: 'C' },
  bombard: { name: '毛球轰炸', short: '轰炸', energyCost: BOMBARD.energyCost, key: '空格' },
} as const;
export const ENERGY = { starting: 50, max: 100 };
// Reward the defeated troop, once per kill, including defensive cannon kills.
export const ENERGY_REWARDS: Record<UnitKind, number> = {
  mouse: 2, soldier: 4, shield: 6, slinger: 5, mage: 6,
  catapult: 8, healer: 6, knight: 20, boss: 50,
  gunner: 10, litter: 7, kungfu: 7, assassin: 10, umbrella: 8, drummer: 7, hook: 8, boxer: 8,
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
  catapult: { name: '猫咪玩具大炮', short: '玩具大炮', role: '范围攻城', description: '猫咪推着带轮子的玩具大炮，发射软弹造成小范围溅射。对基地伤害 ×1.7；近处 65 范围无法开火。', cost: 160, population: 3, tier: 3, cooldown: 4.5, hp: 260, damage: 105, interval: 3, speed: 27, range: 310, minRange: 65, splash: 35, baseBonus: 1.7, color: '#ead9bd' },
  healer: { name: '奶妈猫', short: '奶妈猫', role: '治疗支援', description: '给队友一点温柔。每 2 秒治疗附近最多 3 名受伤友军各 42 点；不能治疗基地。', cost: 130, population: 2, tier: 3, cooldown: 4, hp: 180, damage: 0, interval: 2, speed: 38, range: 155, heal: 42, color: '#f0d3d2' },
  knight: { name: '小狗骑士', short: '小狗骑士', role: '终极重骑', description: '铠甲猫咪骑上忠勇小狗，挺枪突破前线。三阶终极近战：1800 生命、每击 150 伤害；耗费 500 猫粮、6 人口，招募冷却 12 秒。', cost: 500, population: 6, tier: 3, cooldown: 12, hp: 1800, damage: 150, interval: 1.6, speed: 45, range: MELEE_CONTACT_RANGE, color: '#e6d6a6' },
  gunner: { name: '猫咪玩具枪手', short: '玩具枪手', role: '远距重击', description: '举起橙色枪口的玩具枪发射软弹。射程 350、每击 125；装填较慢，生命较低，需要前排保护。', cost: 210, population: 3, tier: 3, cooldown: 5, hp: 155, damage: 125, interval: 2.5, speed: 36, range: 350, color: '#b9d4da' },
  litter: { name: '猫砂炸弹手', short: '猫砂炸弹手', role: '范围减攻', description: '抛出猫砂小包，落地造成范围伤害。被命中的敌人攻击力降低 35%，持续 4 秒；重复命中刷新，不叠加。', cost: 135, population: 2, tier: 2, cooldown: 4, hp: 190, damage: 26, interval: 2.2, speed: 39, range: 210, splash: 55, color: '#dfd6b5' },
  kungfu: { name: '功夫猫', short: '功夫猫', role: '闪避近战', description: '系好头带，以猫爪拳迎敌。每次受到攻击有 30% 概率闪避，闪避时不受该次伤害及附带效果。', cost: 110, population: 2, tier: 2, cooldown: 3, hp: 350, damage: 42, interval: .9, speed: 55, range: MELEE_CONTACT_RANGE, color: '#edc9ab' },
  assassin: { name: '刺客猫', short: '刺客猫', role: '隐身突进', description: '首次实际受伤且存活后隐身 3 秒，每只仅触发一次。隐身时无法被锁定、不攻击，穿过敌军直奔基地；时间结束或抵达敌方基地后显形，继续优先向前推进，近身追兵仍会交战。', cost: 180, population: 2, tier: 3, cooldown: 6, hp: 230, damage: 65, interval: .85, speed: 90, range: MELEE_CONTACT_RANGE, color: '#c4c2dd' },
  umbrella: { name: '雨伞护卫猫', short: '雨伞护卫猫', role: '远程防护', description: '靠近交战区时每 6 秒撑伞，附近友军受到的远程伤害降低 45%，持续 3 秒。多个护卫不叠加；近战伤害不减免。', cost: 135, population: 3, tier: 2, cooldown: 4, hp: 520, damage: 16, interval: 1.5, speed: 34, range: MELEE_CONTACT_RANGE, color: '#c8dbbd' },
  drummer: { name: '铃鼓猫', short: '铃鼓猫', role: '攻速支援', description: '跟随前排，每 5 秒敲鼓，使附近伙伴攻速提高 25%，持续 3 秒。同类鼓舞不叠加；自己不攻击。', cost: 115, population: 2, tier: 2, cooldown: 4, hp: 180, damage: 0, interval: 5, speed: 40, range: 155, color: '#f0d39c' },
  hook: { name: '吸盘猫', short: '吸盘猫', role: '拉近后排', description: '优先瞄准 260 范围内的远程敌人，蓄力 0.6 秒后用玩具吸盘拉近最多 140 距离。攻击间隔 4 秒，首领免疫拉拽。', cost: 140, population: 2, tier: 3, cooldown: 4.5, hp: 260, damage: 24, interval: 4, speed: 40, range: 260, color: '#bcd6cd' },
  boxer: { name: '拳套猫', short: '拳套猫', role: '蓄力击退', description: '戴着弹簧拳套，蓄力 0.55 秒后打出重拳，将普通敌人击退 75 并打断其蓄力。首领只受伤害，不被击退。', cost: 150, population: 2, tier: 2, cooldown: 4, hp: 480, damage: 75, interval: 2.4, speed: 40, range: MELEE_CONTACT_RANGE, color: '#e6bbb4' },
};
// Seven investments: the opening repays in 20s; later +4/s steps cost progressively more.
// Long-term upgrades compete with recruitment instead of creating an exponential economy.
export const FOOD_RATES = [12, 18, 22, 26, 30, 34, 38, 42];
export const ECONOMY_COSTS = [120, 160, 220, 280, 340, 400, 480];
export const TECH_COSTS = [150, 280];
export const TECH_TIMES = [8, 12];
export const MAX_POPULATION = 24;
export const BASE_HP = 3000;
export const BASE_X: Record<Side, number> = { player: 155, enemy: 1285 };

export const STARTING_FOOD = 240;
export const CANNON_DAMAGE = [32, 55, 85];
export const CANNON_RANGE = 280;
export const CANNON_INTERVAL = 2.5;
