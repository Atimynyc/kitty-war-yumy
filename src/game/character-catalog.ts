import { ENEMY_ORDER, ENERGY_REWARDS, ORANGE_BOSS, SPECIAL, STAR_MAGIC, UNIT_ORDER, UNITS } from './content.ts';
import type { EnemyKind, Side, UnitKind } from './content.ts';
import { unitIdentity } from './enemy-roster.ts';
import { LEVELS } from './levels.ts';
import { unlockStage } from './unit-unlocks.ts';

interface CharacterStory { epithet: string; quote: string; story: string; use: string; advice: string; caution: string }
const ALLIES: Record<Exclude<UnitKind, 'boss'>, CharacterStory> = {
  mouse: {
    epithet:'第一个冲出玩具箱', quote:'发条上满，勇气也上满！',
    story:'它原本是客厅里最不起眼的旧玩具，尾巴还留着被猫爪抓弯的痕迹。搜粮团第一次闯进小窝时，别的玩具都滚进了沙发底下，只有它沿着地毯冲了出去。从此，每次出发前都有猫咪替它拧紧发条。',
    use:'便宜、移动快、招募间隔短，适合开局补位或抓住空档推进。', advice:'和小鱼干士兵一起出发，用士兵撑住交战，让小车及时补上空位。', caution:'生命很低；成群挤在一起容易被溅射消灭，不适合独自承担前排。',
  },
  soldier: {
    epithet:'把最爱的小鱼干举成旗', quote:'这根鱼干，等守住了再吃。',
    story:'它没有锋利的宝剑，只有一根舍不得吃的小鱼干和一顶略大的头盔。每天巡逻前，它都会认真数一遍罐头。大家笑它太较真，它却总是第一个站到门口——小窝里的每一份晚餐，都值得有人守着。',
    use:'低人口的均衡近战，是开局拦截、持续补兵和保护后排的基础。', advice:'先招士兵建立前线，再补毛球投手；研究时也别让前排断档。', caution:'必须贴身才能攻击；后期独自面对厚重前排和治疗阵时容易陷入拉锯。',
  },
  shield: {
    epithet:'纸箱里装着安全感', quote:'躲我后面，这个箱子很结实。',
    story:'它最珍贵的收藏不是玩具，而是快递刚送来时留下的纸箱。为了让大家安心吃饭，它把最厚的那块纸板做成盾，又在正面画了一枚绿色对勾。每添一道折痕，就说明又有一个伙伴平安回家。',
    use:'高生命、低伤害的前排，替远程伙伴争取持续输出时间。', advice:'与投手、枪手搭配；后期加入奶妈，让承伤能力转化为更长的输出窗口。', caution:'没有嘲讽或自动拦截弹道，伤害也很低。需要提前出兵，不能只靠盾卫推进。',
  },
  slinger: {
    epithet:'毛球也有精准落点', quote:'再远一点，我也投得到。',
    story:'洗衣篮旁总能找到它练习的身影：把松散的毛线揉成球，再一颗颗投进空罐头。它给每次命中画一颗小星星，久而久之，练习本比食谱还厚。如今，那份耐心成了小队身后稳定的火力。',
    use:'较早获得的远程输出，适合在近战伙伴身后持续攻击。', advice:'第一个远程组合可以从士兵加投手开始，获得盾卫后再加强前排。', caution:'生命低，没有范围攻击；前排倒下后要及时补兵，避免被快速单位贴身。',
  },
  kungfu: {
    epithet:'把晨练练成了本领', quote:'脚步轻一点，鱼干稳一点。',
    story:'每天清晨，它都会在窗边跟着自己的影子练拳。那条头带是从旧围裙上裁下来的，结打得歪歪扭扭，却从不松开。伙伴们最喜欢看它绕过摇晃的逗猫棒，再轻轻一爪拍中吊着的小铃铛。',
    use:'移动较快、攻击频繁的近战输出，有概率躲开一次伤害及其附带效果。', advice:'在盾卫稳住前线后补充，搭配铃鼓提高攻击频率。', caution:'闪避是概率效果，不是稳定减伤；不能把生存完全押在连续闪避上。',
  },
  umbrella: {
    epithet:'晴天也带伞的护卫', quote:'靠近些，伞下还有位置。',
    story:'阳台那把小绿伞原本用来给幼苗遮雨。它发现毛球和饼干撞上伞面时会弹向两边，就认真地把伞柄缠上了软布。现在无论晴雨，它都带伞出门；对它来说，保护伙伴和照顾幼苗一样自然。',
    use:'靠近交战区撑伞，阶段性减少附近伙伴受到的远程伤害。', advice:'与盾卫一起保护投手或枪手，面对弹弓、法师和范围轰炸时提供防护。', caution:'伞盾有空档，不减少近战伤害，也不解除迟缓；多个护卫的减伤不会相加。',
  },
  mage: {
    epithet:'让星星替大家争取时间', quote:'慢一点，听听铃声。',
    story:'它从没去过魔法学校，只是在无数个午后研究那根会发亮的逗猫棒。某天，绒球上的星星真的飞了起来，把追逐玩具的伙伴逗得停住脚步。它把这称为魔法，大家则称它为最会争取时间的小猫。',
    use:'用星星命中敌人，降低移动与攻击频率，为队伍争取输出和治疗时间。', advice:'配合盾卫与枪手应对快速近战和重骑；迟缓也能影响首领的攻击节奏。', caution:'迟缓重复命中只刷新时长，不会越叠越慢；攻击基地不附带迟缓。',
  },
  catapult: {
    epithet:'推着大玩具去远足', quote:'软弹装好，出发！',
    story:'它用积木轮子和闲置玩具拼出了一门小炮，还坚持给炮口包上软垫。第一次试射时，软弹恰好落进远处的空粮箱，大家的欢呼比炮声还响。如今它每天检查轮轴，把这件得意之作推到需要它的地方。',
    use:'长射程、小范围溅射，对基地有额外伤害，适合抓住增援空档推进。', advice:'由盾卫挡住近战，法师拖慢追兵；清掉前线后让大炮持续轰击基地。', caution:'移动和攻击都慢，近处有开火盲区。敌人贴身后需要其他伙伴解围。',
  },
  litter: {
    epithet:'随身带着小小沙尘云', quote:'小心，今天的猫砂很松软！',
    story:'它负责整理猫砂盆，总能把地板收拾得干干净净。为了拦住翻箱倒柜的搜粮团，它把多余的干净猫砂装成小包。小包落地散开时，橘猫们忙着抖爪子，挥起武器也没那么有劲了。',
    use:'范围伤害附带减攻，适合敌人聚集交战时降低前排压力。', advice:'配合法师的迟缓与奶妈的治疗，延长队伍站住前线的时间。', caution:'基础伤害较低，主要贡献是削弱；减攻不会叠加，也不会削弱基地炮台。',
  },
  drummer: {
    epithet:'把小队的脚步敲在一起', quote:'一、二，爪子跟上节拍！',
    story:'饭点前，厨房里总会响起它敲碗的节奏。后来它得到了一只真正的小铃鼓，便把催饭曲改成了出发曲。它从不抢着走在最前面，只在队伍身后敲出熟悉的拍子，让紧张的伙伴想起一起吃饭的日子。',
    use:'跟随前排，周期性提高附近伙伴的攻击频率，自己不攻击。', advice:'在已有稳定前排和输出时加入，鼓舞枪手、投手或近战主力。', caution:'不是独立输出，过早大量招募会缺少战力；鼓舞不叠加，也不会清除迟缓。',
  },
  gunner: {
    epithet:'认真瞄准每一颗软弹', quote:'不用急，这一发要打准。',
    story:'它最喜欢的玩具枪有一只醒目的橙色枪口。每次出发，它都把软弹整齐排进小盒子，再擦一遍护目镜。伙伴们知道它装填得慢，却也知道，只要守住它面前那一点空间，远处的目标就很难安稳待着。',
    use:'射程很长、单发伤害高，适合在保护下集中突破耐打或受治疗的阵线。', advice:'用盾卫和雨伞保护，吸盘拉近敌方后排，再搭配猫薄荷增加伤害。', caution:'生命低、装填慢；不会优先瞄准治疗兵，也没有禁止治疗的效果。',
  },
  assassin: {
    epithet:'熟悉每一条沙发缝', quote:'嘘，我去前面看看。',
    story:'捉迷藏时，大家总是最后才找到它。窗帘后、沙发缝、纸箱之间的阴影，都是它熟悉的小路。它把这份本领带上战场，不为抢走谁的风头，只想在正面僵持时，替小队找到另一扇门。',
    use:'首次受伤后短暂隐身穿线，制造向前推进或攻击基地的机会。', advice:'在双方正面交战时加入，利用敌军注意力集中在前排的窗口。', caution:'每只只触发一次，致死伤害不会触发；隐身期间不攻击，也不会主动寻找治疗兵。',
  },
  hook: {
    epithet:'总能把远处的玩具捞回来', quote:'别躲啦，过来一起玩。',
    story:'玩具滚进柜子底下时，大家都会来找它。它把玩具吸盘接上结实的绳子，练出了一爪拉回小球的好本事。搜粮团的弹弓手躲到队伍后面后，它眨眨眼：找回远处的东西，本来就是自己的专长。',
    use:'优先瞄准射程内的远程敌人，把后排拉向近战队友。', advice:'跟随前排靠近敌军，配合功夫猫或士兵处理被拉出的目标。', caution:'有蓄力时间，不能指定目标；射程短于攻城车，需要护送。首领免疫拉拽。',
  },
  healer: {
    epithet:'给每一只爪子留一份温柔', quote:'别逞强，先靠过来。',
    story:'它的小包里放着绷带、干净的手帕和一份备用晚餐。每当有伙伴垂着耳朵回到小窝，它总能察觉，安静地坐到旁边。出征以后，它依旧记得每个伙伴的习惯，也依旧坚持：大家要一起回家。',
    use:'持续治疗附近受伤伙伴，延长高生命前排的战斗时间，不进行普通攻击。', advice:'优先与盾卫、小狗骑士搭配；先有能承伤的伙伴，再补治疗。', caution:'需要队友仍然存活且位于治疗范围；不复活、不修复基地，也不能独自守线。',
  },
  boxer: {
    epithet:'一拳把拥挤的前线推开', quote:'退后一点，给伙伴留条路！',
    story:'这副弹簧拳套原本是储物间里的旧玩具，它花了整整一个下午才学会稳稳戴住。练习时，它只推倒空纸箱，再一只只扶起来。真正上场后，每次重拳都像在说：这里有人守着，请往后站。',
    use:'蓄力后击退普通敌人，给远程伙伴留出空间，也能打断可打断的蓄力。', advice:'面对普通重骑时配合法师和枪手，击退后继续远程消耗。', caution:'蓄力期间需要保护；首领只受伤害、不被击退。击退不是对重骑的秒杀手段。',
  },
  knight: {
    epithet:'两位伙伴，一往无前', quote:'你守好旗，我看好前面的路。',
    story:'猫咪和小狗曾为窗边最暖和的位置争执，最后发现一起挤着睡更舒服。小窝遇袭后，猫咪找来铠甲，小狗背上鞍毯，约好一位观察前路、一位迈稳脚步。它们的骑枪旗帜上，画着同一只饭碗。',
    use:'高生命、高单次伤害的重装近战，适合在经济允许时成为推进核心。', advice:'攒粮时保留基础前排，出骑士后接奶妈和远程输出，保护这笔昂贵投资。', caution:'花费和人口占用都高；仍需贴身攻击，会被迟缓和普通击退影响。',
  },
};
const ENEMIES: Record<EnemyKind, CharacterStory> = {
  mouse:{epithet:'罐头里的先锋',quote:'咕噜咕噜，先到先闻香。',story:'胖橘不舍得扔掉吃空的罐头，就让搜粮团给它们装上轮子。小车叮叮当当地滚过走廊，总能最先找到通往粮仓的缝隙。车身上的划痕，是每次偷偷探路留下的纪念。',use:'低成本的快速突击单位，开局和空档期给防线施加压力。',advice:'用士兵及时拦住；后期可用范围攻击处理聚集的小车。',caution:'不要只顾研究而留下空线。它的生命很低，但移动快。'},
  soldier:{epithet:'把饼干当作战利品',quote:'先借一口，再借一罐。',story:'它本来负责替胖橘看管零食，却总在交班时少数几根饼干棒。为了证明自己可靠，它系紧红围巾，把最大的一根举在手里，站到了搜粮团前面。至于棒子上的牙印，它坚持说是练习留下的。',use:'敌军的均衡近战主力，也常在基地受威胁时补位。',advice:'用近战接住，再让投手在身后持续输出。',caution:'单只威胁不高，但持续补兵会拖住推进，别忽略后方远程的支援。'},
  shield:{epithet:'厨房里的移动堡垒',quote:'锅盖一举，饼干归我！',story:'厨房叮当响时，通常是它在试戴新的钢盆。它挑了最大的一面锅盖当盾，宣布自己是搜粮团里最坚固的橘猫。胖橘十分满意，只有做饭的人一直找不到合适的锅盖。',use:'高生命的敌军前排，为弹弓手和补给员争取时间。',advice:'用功夫猫或远程持续输出，配合吸盘拉出它身后的远程。',caution:'耐打但伤害低；如果把全部火力都耗在它身上，后排会持续输出或治疗。'},
  slinger:{epithet:'零食纸帽下的小算盘',quote:'这一颗饼干，刚好够远。',story:'它用零食包装折出一顶帽子，又把树枝绑成弹弓。每次出发前都挑选最圆的饼干，声称这样飞得稳。其实它还有一个小秘密：不够圆的那些，都被自己留在了午餐袋里。',use:'躲在前排身后的远程伤害来源。',advice:'雨伞减轻远程伤害，吸盘在够近时拉出后排；先维持自己的前线。',caution:'生命低却射程较远，近战伙伴可能会先被它前面的锅盖卫兵牵制。'},
  mage:{epithet:'让脚步乱拍的小铃声',quote:'叮铃——先停一停。',story:'它从旧项圈上收集了许多黄铜铃铛，能摇出各不相同的节奏。搜粮团走散时，它用铃声召回伙伴；遇到守护小队时，又故意摇出让人分神的拍子。它把这套本领叫作厨房交响乐。',use:'远程命中附带迟缓，拖慢移动和攻击节奏。',advice:'雨伞能减轻伤害，吸盘可拉近它；保持队伍输出，避免被慢慢消耗。',caution:'雨伞不能解除迟缓；鼓舞也不是净化技能，两种状态会同时计算。'},
  catapult:{epithet:'把整袋饼干送到门口',quote:'大汤勺，准备发射！',story:'搜粮团把零食箱钉在小车上，再装上一把巨大的汤勺。负责推车的橘猫每次都郑重宣布这是厨房最高杰作，转弯时却还得请伙伴帮忙。它的梦想，是把一整袋饼干准确送进对面的饭碗。',use:'长射程范围攻城，能对聚集部队和基地造成压力。',advice:'先保住前排，再利用快速伙伴靠近其开火盲区；吸盘需要护送到射程内。',caution:'它的射程比吸盘更长，不能指望吸盘一露面就拉到。基地遭到持续轰击时要尽快处理。'},
  healer:{epithet:'忙着开罐头的后勤员',quote:'吃一口，再往前走！',story:'它总背着一个咣当作响的大包，里面整齐塞满了小罐头。搜粮团吵着分零食时，只有它会先看看谁最疲惫。胖橘觉得它走得慢，却从不催促——少了这位补给员，大家很快就没了继续搜粮的精神。',use:'持续恢复附近受伤敌军，帮助厚重前排拖长战斗。',advice:'用集中火力突破回复，吸盘有机会拉近它；枪手与猫薄荷能增加输出压力。',caution:'枪手不会优先攻击它，也没有禁疗效果；刺客同样不会指定追杀补给员。'},
  knight:{epithet:'餐叉长枪与小猪冲锋',quote:'借过，整罐的那种！',story:'胖橘在院子里遇见一只喜欢闻零食香味的小猪，便给它做了暖和的鞍毯。橘猫骑手拿起餐叉长枪，负责辨认粮仓方向；小猪负责迈步，偶尔也负责在路过菜盆时停下来闻一闻。',use:'高生命重骑，贴身后用重击压迫前排。',advice:'用盾卫承伤、法师迟缓、拳套击退，再交给枪手等输出；用奶妈维持防线。',caution:'不是首领，能被普通击退；但它没有需要用拳套持续打断的蓄力机制。'},
  boss:{epithet:'把整个粮仓写进愿望清单',quote:'我要吃冻干！快给我！',story:'大胖橘原本只是喜欢在饭点串门的邻居，后来发现每个小窝都有一份不同口味的冻干。它召集了戴纸帽、背罐头的伙伴，把这趟远行称为搜粮。平时它爱坐在营地旁指挥，只有最后的粮仓告急，才会舍不得似的挪开软垫，亲自伸出大爪子。',use:'最终关首领，缓慢蓄力后用巨爪横扫身前一排，并推开命中的部队。',advice:'观察抬爪与停顿，维持前排并用远程输出；迟缓、减攻和急救能帮助队伍撑过横扫。',caution:'免疫拉拽和击退。胜利条件仍是摧毁敌方基地，不必把击败首领当作额外通关条件。'},
};

export function catalogKinds(side: Side): UnitKind[] {
  return side === 'player' ? [...UNIT_ORDER].sort((a,b)=>unlockStage(a)-unlockStage(b)) : [...ENEMY_ORDER,'boss'];
}
export function characterStory(kind: UnitKind, side: Side): CharacterStory {
  return side === 'enemy' ? ENEMIES[kind as EnemyKind] : ALLIES[kind as Exclude<UnitKind,'boss'>];
}
const percent = (v: number) => `${Math.round(v*100)}%`;
export function characterMechanics(kind: UnitKind): string[] {
  const u=UNITS[kind];
  switch(kind) {
    case 'mage':return [`远程命中使移速与攻击频率降低 ${percent(STAR_MAGIC.slow)}，持续 ${STAR_MAGIC.duration} 秒；重复命中刷新时长，不叠加。`,`弹道飞行约 ${STAR_MAGIC.travel} 秒；对基地造成伤害，但不附加迟缓。`];
    case 'catapult':return [`命中点半径 ${u.splash} 内造成溅射，没有友军伤害。`,`对基地伤害 ×${u.baseBonus}；距离小于 ${u.minRange} 时无法开火。`];
    case 'healer':return [`每 ${u.interval} 秒治疗范围 ${u.range} 内最多 3 名受伤友军，每名回复 ${u.heal} 点生命。`,`优先治疗生命比例较低的目标；不能超过最大生命，不治疗基地，不复活。`];
    case 'litter':return [`猫砂飞行约 ${SPECIAL.litter.travel} 秒，落地在半径 ${u.splash} 内造成伤害。`,`命中敌人的攻击力降低 ${percent(SPECIAL.litter.reduction)}，持续 ${SPECIAL.litter.duration} 秒；重复命中刷新，不叠加。`];
    case 'kungfu':return [`每次受到攻击有 ${percent(SPECIAL.kungfu.dodge)} 概率闪避，免除该次伤害与附带效果。`,`每次攻击独立判定，生命和攻击力不会因闪避永久提高。`];
    case 'assassin':return [`每只首次实际受伤且存活后隐身 ${SPECIAL.assassin.stealth} 秒，期间无法被锁定、不攻击，向敌方基地穿行。`,`时间到或抵达敌方基地后显形，继续优先向前推进；近身追兵仍可交战。`];
    case 'umbrella':return [`附近 ${310} 范围有敌人时，每 ${SPECIAL.umbrella.cooldown} 秒撑伞，为 ${SPECIAL.umbrella.range} 范围内友军提供 ${percent(SPECIAL.umbrella.reduction)} 远程减伤，持续 ${SPECIAL.umbrella.duration} 秒。`,`同类防护不叠加，不减少近战伤害，不解除迟缓。`];
    case 'drummer':return [`附近 ${310} 范围有敌人时，每 ${SPECIAL.drummer.cooldown} 秒鼓舞 ${SPECIAL.drummer.range} 范围内伙伴，攻击频率提高 ${percent(SPECIAL.drummer.haste)}，持续 ${SPECIAL.drummer.duration} 秒。`,`不进行普通攻击，同类鼓舞不叠加；攻击频率加快不等于单次伤害提高。`];
    case 'hook':return [`优先选择 ${SPECIAL.hook.range} 范围内最近的远程敌人，蓄力 ${SPECIAL.hook.windup} 秒后命中，拉近最多 ${SPECIAL.hook.pull} 距离。`,`首领免疫拉拽；实际拉动距离受与目标距离限制，不能手动指定目标。`];
    case 'boxer':return [`蓄力 ${SPECIAL.boxer.windup} 秒后重击，击退普通敌人 ${SPECIAL.boxer.push} 距离，并打断其可打断的蓄力。`,`首领只承受伤害、不发生位移；被推开的近战敌人需重新接近。`];
    case 'boss':return [`入场 ${ORANGE_BOSS.entrance} 秒期间不受攻击；举爪 ${ORANGE_BOSS.lift} 秒、停顿 ${ORANGE_BOSS.hold} 秒，再用 ${ORANGE_BOSS.swipe} 秒横扫。`,`横扫前方 ${ORANGE_BOSS.sweepDepth}、左右各 ${ORANGE_BOSS.sweepHalfWidth} 范围，每个命中目标承受 ${u.damage} 伤害并被击退 ${ORANGE_BOSS.knockback}。方向在抬爪时锁定，命中按横扫时位置判定。`,`自身免疫拉拽与击退；可受到迟缓、减攻及普通伤害。`];
    default:return [u.range<=22?'必须靠近目标后才能进行单体近战攻击。':'在射程内进行单体远程攻击，需要前排保护。','没有额外主动技能；出兵后会自动行军、寻敌和战斗。'];
  }
}

export function enemyFirstStage(kind: UnitKind) {
  if (kind==='boss') return LEVELS.find(l=>l.bossEncounter)?.stage ?? 30;
  return LEVELS.find(level=>{
    if (kind==='mouse'||kind==='soldier') return true;
    if (kind==='knight'&&level.knight&&(level.techCap??3)>=UNITS[kind].tier) return true;
    return [level.formations,...(level.phases??[]).map(p=>p.formations)].some(f=>f.slice(0,level.techCap??3).some(tier=>tier.includes(kind)));
  })?.stage ?? null;
}
export function characterStats(kind: UnitKind) {
  const u=UNITS[kind];
  return [
    {label:'生命上限',value:String(u.hp)},
    {label:u.heal?'每目标治疗':kind==='drummer'?'普通攻击伤害':'单次伤害',value:String(u.heal??u.damage)},
    {label:u.heal?'治疗间隔':kind==='drummer'?'鼓舞间隔':'攻击间隔',value:`${kind==='drummer'?SPECIAL.drummer.cooldown:u.interval} 秒`},
    {label:u.heal?'治疗范围':kind==='drummer'?'鼓舞范围':'攻击距离',value:String(u.range)},
    {label:'移动速度',value:`${u.speed} / 秒`},
    {label:'被击败时回能',value:`${ENERGY_REWARDS[kind]} 能量`},
  ];
}
export function characterInfo(kind: UnitKind, side: Side) {
  return {...unitIdentity(kind,side),...characterStory(kind,side),kind,side,mechanics:characterMechanics(kind),stats:characterStats(kind)};
}
