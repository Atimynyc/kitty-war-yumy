import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { PLANS } from './global-balance.mjs';
import { UNITS, UNIT_ORDER, SPECIAL, FOOD_RATES, ECONOMY_COSTS } from '../src/game/content.ts';
import { LEVELS, CHAPTERS } from '../src/game/levels.ts';
import { FEEDER_NAMES } from '../src/game/base-art.ts';
const root = 'analysis/balance-0.16';
const before = JSON.parse(readFileSync(`${root}/baseline.json`));
const after = JSON.parse(readFileSync(`${root}/applied.json`));
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
assert.equal(before.policyHash, after.policyHash, 'Before/after must use the exact same policy');
assert.equal(after.policyHash, hash('scripts/global-balance.mjs'));
for (const [file, expected] of Object.entries(after.sources)) assert.equal(hash(`src/game/${file}`), expected, `${file} changed after analysis`);
assert.equal(before.results.length, 540); assert.equal(after.results.length, 540);
assert.deepEqual(after.summary.stagesWithoutWin, []);
const economy = FOOD_RATES.map((rate, i) => `| ${i+1} · ${FEEDER_NAMES[i]} | ${rate} | ${i ? ECONOMY_COSTS[i-1] : '—'} | ${i ? rate - FOOD_RATES[i-1] : '—'} | ${i ? ECONOMY_COSTS[i-1] / (rate - FOOD_RATES[i-1]) : '—'} |`).join('\n');
const policies = Object.entries(PLANS).map(([key,p]) => {
  const a = before.summary.policies[key], b = after.summary.policies[key];
  return `| ${p.label} | ${a.wins}/${a.losses}/${a.timeouts} | ${b.wins}/${b.losses}/${b.timeouts} | ${a.winMedian} → ${b.winMedian} | ${a.tier3Median ?? '—'} → ${b.tier3Median ?? '—'} |`;
}).join('\n');
const chapters = CHAPTERS.map(ch => {
  const b = after.summary.chapters[ch.id];
  return `| ${ch.id} · ${ch.name} | ${b.wins}/${b.losses}/${b.timeouts} | ${b.winMedian} | ${b.winMin}–${b.winMax} | ${b.wins180to300}/${b.wins} | Lv.${LEVELS[(ch.id-1)*5].economyAt.length+1} |`;
}).join('\n');
const units = UNIT_ORDER.map(kind => {
  const u = UNITS[kind], cycle = u.interval + (SPECIAL[kind]?.windup ?? 0), dps = u.damage / cycle;
  return `| ${u.name} | ${u.tier} | ${u.cost}/${u.population} | ${u.hp} | ${u.damage} / ${cycle.toFixed(2)}s | ${dps.toFixed(1)} | ${(dps*100/u.cost).toFixed(1)} | ${u.range} |`;
}).join('\n');
const stages = LEVELS.map(level => {
  const rows = after.results.filter(r=>r.stage===level.stage), wins = rows.filter(r=>r.winner==='player');
  const counts = Object.keys(PLANS).map(p=>wins.filter(r=>r.policy===p).length).join(' / ');
  const example = wins.find(r=>r.policy==='siege' && r.seconds>=180 && r.seconds<=300) ?? wins.find(r=>r.policy==='guns') ?? wins[0];
  return `| ${level.stage} · ${level.name} | ${counts} | ${PLANS[example.policy].label} · ${example.seconds}s |`;
}).join('\n');
const b = before.summary.overall, a = after.summary.overall;
const abilityTotals = Object.fromEntries(['dodge','stealth','guard','drum','hook','dust','heal'].map(k=>[k,after.results.reduce((n,r)=>n+(r.abilityEvents[k]??0),0)]));
const incomeLevels = FOOD_RATES.map((_,i)=>({ level:i+1, matches:after.results.filter(r=>r.economy>=i+1).length }));
const paired = after.results.filter(r=>r.winner==='player' && before.results.some(z=>z.stage===r.stage && z.policy===r.policy && z.seed===r.seed && z.winner==='player'));
const regressions = after.results.filter(r=>r.winner!=='player' && before.results.some(z=>z.stage===r.stage && z.policy===r.policy && z.seed===r.seed && z.winner==='player'));
const promotions = after.results.filter(r=>r.winner==='player' && before.results.some(z=>z.stage===r.stage && z.policy===r.policy && z.seed===r.seed && z.winner!=='player'));
const trialNames = ['baseline-pilot','economy-pilot','roster-pilot','paced-pilot','frontline-pilot','defensive-pilot','reserve-pilot','balanced-pilot'];
const trials = trialNames.map(name=> {
  const r=JSON.parse(readFileSync(`${root}/${name}.json`)).summary.overall;
  return `| ${name} | ${r.wins}/${r.losses}/${r.timeouts} | ${r.winMedian} |`;
}).join('\n');
writeFileSync(`${root}/comparison.json`, JSON.stringify({ policyHash:after.policyHash, before:b, after:a, winsInBoth:paired.length, newlyWon:promotions.length, newlyNotWon:regressions.length, incomeLevels, abilityEventTotals:abilityTotals, regressions:regressions.map(({stage,policy,seed,winner,seconds})=>({stage,policy,seed,winner,seconds})) },null,2));

writeFileSync('docs/八档产能与全局数值分析.md', `# 八档产能与全局数值分析

版本 0.16.0 · 2026-10-25。目标：让投资、研究与补兵有取舍，主流对局向 3–5 分钟靠拢。

## 本轮实现

产能从 4 档、3 次购买扩展到 **8 档、7 次购买**，最高收入 23 → 42 猫粮/秒。等级、下一次费用、每秒产量、满级禁用与真实扣费同步；后四档有独立粮仓外观，科技建筑仍按研究完成换装。界面显示 Lv.当前/8，按钮说明含回本时间。

保留 16 张招募卡、24 人口与三阶科技。敌军维持原八种角色；没有新增镜像角色或我方专属技能。玩家开局 240 粮，主炮、科技费用/耗时、技能能量与关卡存档格式维持现有规则。

## 经济曲线

回本时间 = 本次费用 ÷ 新增每秒收入，仅计算这次投资相对不升级多赚的粮，不包括攒首付款的时间。

| 等级/装置 | 每秒收入 | 本次费用 | 每秒增加 | 回本/秒 |
|---|---:|---:|---:|---:|
${economy}

全升满累计花费 **2000**。第一笔仍是 120 粮 / +6 每秒 / 20 秒回本，保留升级加两名士兵的开局。原第二、三笔需要 60/120 秒回本，现为 40/55 秒；末档 120 秒，留给较长战局，没必要每局升满。

从零粮攒一名 500 粮骑士：原满级约 21.7 秒，新满级约 11.9 秒；210 粮枪手约 9.1 → 5 秒。招募冷却与人口仍生效，产量并不等于实际出兵速度。满人口时继续投资可能只是积粮，应优先考虑前线和阵容需求。

电脑共用这条价格/收入曲线，但按章节设置投资上限和时机：前两章缓慢引入投资，后续增加晚期投资；额外投资最早在原第三次计划之后 65/135 秒。它支付真实费用，没有补贴。守城长期被压制时，若已有三名守军，或持有研究费加一名士兵的储备，可启动延后至少 30 秒的防守研究；不再单纯因人数少而永远卡在低阶。

## 兵种调整

| 兵种 | 调整 | 目的 |
|---|---|---|
| 功夫猫 | 125 → 110 粮；300 → 350 血；38 → 42 攻 | 闪避前排不再明显输给同人口基础士兵的攻血预算 |
| 刺客猫 | 200 → 180 粮；3 → 2 人口；190 → 230 血 | 降低切入成本，提高首次受伤后的存活机会；一次性 3 秒隐身机制不变 |
| 雨伞护卫猫 | 150 → 135 粮，仍占 3 人口 | 更容易加入阵容，同时保留保护枪手群的占位成本 |
| 铃鼓猫 | 145 → 115 粮 | 纯支援不直接输出，降低前期组队门槛 |
| 吸盘猫 | 165 → 140 粮 | 为拉拽的战术价值付费，减少低直接伤害造成的负担 |
| 拳套猫 | 170 → 150 粮；3 → 2 人口；420 → 480 血 | 近身蓄力有风险，改善接敌生存与人口效率 |

枪手、猫砂炸弹手及原八兵种数值未提高。猫砂减攻、伞盾、鼓舞、闪避和隐身的概率/幅度/持续时间保持原规则，避免同时改经济和所有技能强度。

## 16 兵种静态预算

周期包含吸盘/拳套的蓄力；DPS 是单体持续命中的理论值，忽略移动、溢出伤害、攻速增减、治疗、控场与近战接敌上限。它用于发现预算异常，不能单独当强度排名。

| 兵种 | 科技 | 粮/人口 | 生命 | 每击/周期 | 理论 DPS | 每100粮 DPS | 射程 |
|---|---:|---:|---:|---|---:|---:|---:|
${units}

- 功夫猫的平均有效生命约 350 ÷ 0.7 = 500；实际遭受高伤害攻击时有随机波动，不能保证固定承伤次数。
- 玩具大炮对基地理论输出为 105 × 1.7 ÷ 3 = 59.5/秒，另有溅射；近处 65 的盲区和慢移动构成代价。枪手输出 50/秒，350 射程更安全，三人口/210 粮与低血量是限制。
- 奶妈上限 42 × 3 ÷ 2 = 63 治疗/秒，需要附近三名受伤队友；铃鼓在持续战斗时理论覆盖 3/5，平均约 +15% 攻速，实际还受站位影响。
- 猫砂减攻 35% 与法师减攻速 30% 属于不同效果，可共同压低输出；理想持续覆盖下约剩 0.65 × 0.7 = 45.5% 输出。它们都不是直接的群体击杀能力，仍需要输出兵。
- 刺客的 3 秒正常移动最多前进约 270 距离，只适合突破局部防线；跨越整张地图并非此技能目标。吸盘/拳套对首领不产生位移。

## 对照方法与完整结果

保存了修改前 0.15 的模拟与配置源码，基线直接从快照导入。修改前后使用**同一个策略脚本、同样 30 关 × 6 策略 × 3 种子 = 各 540 场**，步长 1/30 秒，每场最多模拟 600 秒。种子 1234 / 20261025 / 8675309；只有涉及闪避等随机事件时种子才造成差异，重复的确定性结果不是独立样本。

从正常开局出发，所有招募、研究、升级和技能走真实接口；没有加粮、加血、删敌人或提前解锁。投资与招募使用有限攒粮窗口、轮转补兵，避免旧探针只补第一个缺失角色而永远不研究。五种混编策略会投资，纯鱼干策略专门测试不投资、不换阵的极端情况。脚本不具备真人选时机、观察转阵的全部能力，结果**不是玩家胜率**。

| 指标 | 修改前 | 当前 |
|---|---:|---:|
| 总场次 | ${b.games} | ${a.games} |
| 胜 / 负 / 600秒未结束 | ${b.wins}/${b.losses}/${b.timeouts} | ${a.wins}/${a.losses}/${a.timeouts} |
| 胜局中位时长/秒 | ${b.winMedian} | ${a.winMedian} |
| 胜局最短–最长/秒 | ${b.winMin}–${b.winMax} | ${a.winMin}–${a.winMax} |
| 180–300秒的胜局 | ${b.wins180to300}/${b.wins} | ${a.wins180to300}/${a.wins} |
| 达到三阶的场次 | ${b.tier3} | ${a.tier3} |
| 三阶完成中位时间/秒 | ${b.tier3Median} | ${a.tier3Median} |
| 满血胜局 | ${b.fullHealthWins} | ${a.fullHealthWins} |

同一关卡/策略/种子匹配后：${paired.length} 场前后都获胜，${promotions.length} 场由未胜变胜，${regressions.length} 场由胜变为未胜；退步场次完整保留在 comparison.json。没有只挑选有利结果。

每种策略各 90 场；“胜/负/超时”不是百分比。

| 策略 | 原 胜/负/超时 | 当前 胜/负/超时 | 胜局中位/秒 | 三阶完成中位/秒 |
|---|---|---|---|---|
${policies}

| 章节 | 当前 胜/负/超时 | 胜局中位/秒 | 胜局范围/秒 | 3–5分钟胜局 | 敌方投资上限 |
|---|---|---:|---|---|---|
${chapters}

## 结论与未解决项

经济升级已有完整的中后期空间；主流重骑攻城与枪手保护中位分别 207/223 秒。功夫控场的获胜场数增加，投资和两人口前排让它更容易成型。全部 30 关都有正常资源可通关的组合，未为分析降低关卡生命或免除费用。

**3–5 分钟目标尚未全面达到，长局指标也没有全面改善。** 当前 ${a.timeouts} 场未在 600 秒结束，其中 48 场是纯鱼干，另外 11 场来自混编；新产能能延续防守，部分固定阵容因此更容易僵持。入门章部分策略在约 2 分钟获胜，后期有 7–9 分钟长局。600 秒只是分析截止，不是游戏强制结束时间。

枪手保护在这组策略下最稳定，刺客固定三只的阵容仍偏弱；刺客应作为切入组件，不能据此声称所有新兵都同样强。满血胜局占比仍高，说明现有基地血量星级难区分运营质量。本轮没有改星级或存档，避免把平衡调整混成评分迁移。

接下来真人试玩重点：是否过早连续升级、满人口积粮、枪手保护是否成为唯一解法、刺客能否在正确的前线位置切入、纯近战僵局及第五/六章时长。应根据这些实玩记录再决定是否加入调兵/换阵工具或调整攻城与补给节奏；本轮不强加计时处决、免费补兵或自动伤害。

产能等级到达场数（包含已超过该档的场次）：${incomeLevels.map(r=>`Lv.${r.level}: ${r.matches}`).join('；')}。包含不投资的纯鱼干 90 场，不能将未升满视为失败。

支援机制实战事件汇总：${Object.entries(abilityTotals).map(([k,v])=>`${k}=${v}`).join('，')}。原始结果也记录减攻/伞盾/鼓舞/隐身的单位秒数；这些只证明实际触发和覆盖，不能当作因果伤害贡献。

## 逐关可玩性

六列胜场顺序为重骑 / 枪手 / 功夫 / 刺客 / 支援 / 纯鱼干，各列最多 3；示例从完整结果中取，详细每场的资源、科技时间、招募、人口、技能与 30 秒快照均保留。

| 关卡 | 各策略胜场 | 通关示例 |
|---|---|---|
${stages}

## 候选筛选记录

每个试案 180 场、种子 1234。早期“双方都升到每秒 48”的方案显著增加僵持，因此未采用。后续收缓收入与敌方投资，再比较费用、人口与生命改动；试案是筛选数据，最终验收使用上面的多种子完整对照。

| 文件名 | 胜/负/超时 | 胜局中位/秒 |
|---|---|---:|
${trials}

## 复现

- 当前：\`npm run balance:global\`；冻结基线：\`node --experimental-strip-types scripts/global-balance.mjs --baseline --out=baseline-replay\`。
- 报告：\`node --experimental-strip-types scripts/report-global-balance.mjs\`。生成前检查策略哈希相同且当前源码与 applied.json 指纹一致，防止旧数据冒充新结果。
- 源码快照：\`analysis/balance-0.16/baseline-source/\`；清单 \`baseline-manifest.json\`；策略快照 \`baseline-policy.mjs\`。
- 历史 0.12/0.15 报告不覆盖。旧三关结果回归使用冻结的规则；当前 30 关可通关回归使用新的正常资源策略。
- 验证：97 项规则测试；Chromium/WebKit 七次真实收入升级、三阶研究、满级、暂停/重开、小屏与外观检查。其他浏览器及构建结果见 progress.md。
`, 'utf8');
console.log('Wrote docs/八档产能与全局数值分析.md and the paired comparison.');
