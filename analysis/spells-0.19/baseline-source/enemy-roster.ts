import { UNITS } from './content.ts';
import type { Side, UnitKind, EnemyKind } from './content.ts';

export const ENEMY_FACTION = '胖橘搜粮团';

/** Display identities only. Combat, recruitment and rewards keep their shared role keys. */
export const ENEMY_UNITS: Record<EnemyKind, { name: string; role: string; description: string }> = {
  mouse: { name: '罐头侦察车', role: '快速突击', description: '空罐头装上小轮子，快速钻向前线。生命低，范围攻击能拦住成群的小车。' },
  soldier: { name: '饼干棒打手', role: '均衡近战', description: '系着红围巾的橘猫，挥舞大饼干棒。均衡的近战主力，需要贴身才能攻击。' },
  shield: { name: '锅盖卫兵', role: '前排守护', description: '钢盆当头盔，锅盖当盾牌。耐打但伤害低，常替身后的弹弓手挡住攻击。' },
  slinger: { name: '饼干弹弓手', role: '远程输出', description: '头戴零食纸帽，用弹弓发射圆饼干。远程火力强，失去前排保护后很脆弱。' },
  mage: { name: '铃铛干扰师', role: '铃音迟缓', description: '摇响黄铜铃铛，发出迟缓光环。命中降低攻速、移速 30%，持续 3 秒；再次命中刷新，不叠加。' },
  catapult: { name: '零食投射车', role: '范围攻城', description: '零食箱配上大汤勺，抛出成团饼干。小范围溅射，对基地伤害 ×1.7；近处 65 范围无法开火。' },
  healer: { name: '罐头补给员', role: '治疗支援', description: '背着补给包，打开罐头分享食物。每 2 秒治疗附近最多 3 名受伤队友各 42 点，不能治疗基地。' },
  knight: { name: '小猪重骑兵', role: '终极重骑', description: '橘猫骑上圆滚滚的小猪，以餐叉长枪突破前排。1800 生命、每击 150 伤害；消耗 500 猫粮、6 人口。' },
  boss: { name: '大胖橘', role: '搜粮团首领', description: UNITS.boss.description },
};

export function unitIdentity(kind: UnitKind, side: Side) {
  return side === 'enemy' && kind in ENEMY_UNITS ? ENEMY_UNITS[kind as EnemyKind] : UNITS[kind];
}
