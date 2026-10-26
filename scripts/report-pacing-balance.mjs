import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PLANS } from './global-balance.mjs';

const folder = 'analysis/pacing-0.17';
const before = JSON.parse(readFileSync(`${folder}/baseline.json`));
const after = JSON.parse(readFileSync(`${folder}/applied.json`));
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(before.policyHash, after.policyHash);
assert.equal(after.policyHash, hash('scripts/global-balance.mjs'));
assert.equal(before.policyHash, hash(`${folder}/baseline-policy.mjs`));
for (const [file, digest] of Object.entries(before.sources)) assert.equal(hash(`${folder}/baseline-source/${file}`), digest, `baseline ${file}`);
for (const [file, digest] of Object.entries(after.sources)) assert.equal(hash(`src/game/${file}`), digest, `current ${file}`);
const key = r => `${r.stage}/${r.policy}/${r.seed}`;
assert.equal(before.results.length, 540); assert.equal(after.results.length, 540);
assert.deepEqual(before.results.map(key).sort(), after.results.map(key).sort());
assert.equal(new Set(after.results.map(key)).size, 540);
const median = list => list.length ? [...list].sort((a,b) => a-b)[Math.floor(list.length/2)] : null;
const percent = (a,b) => `${(a / b * 100).toFixed(1)}%`;
const fmt = r => `${r.wins} / ${r.losses} / ${r.timeouts}`;
const duration = rows => {
  const complete = rows.filter(r=>r.winner !== 'timeout');
  const wins = rows.filter(r=>r.winner === 'player');
  const losses = rows.filter(r=>r.winner === 'enemy');
  return { completed: complete.length, median: median(complete.map(r=>r.seconds)), lossMedian: median(losses.map(r=>r.seconds)),
    under180: complete.filter(r=>r.seconds<180).length,
    target: complete.filter(r=>r.seconds>=180&&r.seconds<=300).length,
    over300: complete.filter(r=>r.seconds>300).length,
    over420: complete.filter(r=>r.seconds>420).length,
    winsTarget: wins.filter(r=>r.seconds>=180&&r.seconds<=300).length };
};
const bd = duration(before.results), ad = duration(after.results);
const previous = new Map(before.results.map(r=>[key(r),r]));
const regressions = after.results.filter(r=>previous.get(key(r)).winner==='player'&&r.winner!=='player');
const gains = after.results.filter(r=>previous.get(key(r)).winner!=='player'&&r.winner==='player');
const timeouts = after.results.filter(r=>r.winner==='timeout');
const fullHealth = after.results.filter(r=>r.winner==='player'&&r.playerHp===3000).length;
const missing = [];
for (let stage=1;stage<=30;stage++) for (const seed of after.seeds)
  if(!after.results.some(r=>r.stage===stage&&r.seed===seed&&r.winner==='player')) missing.push({stage,seed});
const comparison = { scope: after.scope, policyHash: after.policyHash, durations: { before:bd, after:ad }, gains, regressions, timeouts, stageSeedsWithoutWin: missing };
writeFileSync(`${folder}/comparison.json`, JSON.stringify(comparison,null,2));

const lines = [
'# 增援节奏与战术优化',
'',
'版本 0.17.0 · 2026-10-25。目标：减少无效拉锯，让玩家看得懂推进、补兵和投资的时机，逐步靠近通常 3–5 分钟一局。',
'',
'## 已实现的变化',
'',
'敌军在增援与整备之间周期切换。第一章首次整备为 114–126 秒，之后每 36 秒整备 12 秒；第二至六章首次整备为 80–90 秒，之后每 30 秒整备 10 秒。第一章保留更长的建立阵容时间。窗口结束后的下一次正常 AI 决策才招募，不会瞬间补满人口。',
'',
'整备只暂停电脑招募。场上敌人、主炮和技能继续战斗；双方照常产粮与研究，敌军投资仍消耗真实猫粮。没有强制结束计时、额外免费资源或随时间上涨的伤害。原来零散补兵反复占据近战接敌位置，现在会留出可预测的推进空隙；敌军积攒的猫粮也会用于下一轮进攻。',
'',
'战场显示「敌方增援 · N秒后整备」或绿色「敌军整备 · N秒后增援」，玩法指南解释整备不等于停止战斗。暂停冻结倒计时；重开回到准备期。文本状态暴露实际阶段和剩余秒数，与模拟共用同一个函数。重要战斗通知优先于整备建议。',
'',
'刺客首次实际受伤且存活后仍只隐身一次、最多 3 秒；期间不攻击、穿过敌人，抵达基地提前显形。显形后继续面向前方敌军或基地，不再回头追远处旧目标；已经贴身的追兵仍可交战。',
'',
'八档产能、三阶基地、16 张卡片、24 人口、30 关和存档格式保留。本轮没有改兵种攻血费用，也没有扩充敌军或复制我方新兵能力。',
'',
'## 如何比较',
'',
'30 关 × 六种固定策略 × 三个种子（1234、20261025、8675309），前后各 540 场。全程按正常猫粮、人口、研究、招募冷却与能量规则，30 Hz 模拟，600 秒仍未结束记为超时；超时是分析观察上限，游戏不会在此时强制结算。',
'',
'修改前冻结八个依赖文件和策略脚本，确认 SHA-256 与 0.16 完整结果一致后复用旧基线。新版本直接测正式源码。报告生成器检查前后策略、原始源码、当前源码和所有配对键，避免用新规则重跑成旧结果。双方使用完全相同的固定策略代码；策略未根据新倒计时专门调整。这些结果是机器策略对照，不是真人胜率。',
'',
'## 全部结果',
'',
'| 指标 | 0.16 | 0.17 |',
'|---|---:|---:|',
`| 胜 / 负 / 超时 | ${fmt(before.summary.overall)} | ${fmt(after.summary.overall)} |`,
`| 600 秒超时占比 | ${percent(before.summary.overall.timeouts,540)} | ${percent(after.summary.overall.timeouts,540)} |`,
`| 胜局中位时长 | ${before.summary.overall.winMedian} 秒 | ${after.summary.overall.winMedian} 秒 |`,
`| 全部已结束对局中位时长 | ${bd.median} 秒 | ${ad.median} 秒 |`,
`| 败局中位时长 | ${bd.lossMedian} 秒 | ${ad.lossMedian} 秒 |`,
`| 少于 3 分钟结束（含胜负） | ${bd.under180} | ${ad.under180} |`,
`| 3–5 分钟结束（含胜负） | ${bd.target} / ${bd.completed}（${percent(bd.target,bd.completed)}） | ${ad.target} / ${ad.completed}（${percent(ad.target,ad.completed)}） |`,
`| 超过 5 分钟结束（另计超时） | ${bd.over300} | ${ad.over300} |`,
`| 超过 7 分钟结束（另计超时） | ${bd.over420} | ${ad.over420} |`,
`| 3–5 分钟胜局 | ${bd.winsTarget} / ${before.summary.overall.wins} | ${ad.winsTarget} / ${after.summary.overall.wins} |`,
`| 满血胜局 | ${before.summary.overall.fullHealthWins} | ${fullHealth} |`,
'',
`超时减少 ${before.summary.overall.timeouts-after.summary.overall.timeouts} 场（${percent(before.summary.overall.timeouts-after.summary.overall.timeouts,before.summary.overall.timeouts)}）。30 关都有通关策略；按每个关卡和种子分别检查，缺少胜局的组合为 ${missing.length}。目标时长尚未全面达成，不能只用胜局中位数代表所有体验。`,
'',
'## 阵容对照',
'',
'每种策略各 90 场；「胜/负/超时」保留所有结果。',
'',
'| 策略 | 0.16 胜/负/超时 | 0.17 胜/负/超时 | 胜局中位：前→后 | 新版胜局范围 |',
'|---|---:|---:|---:|---:|',
...Object.keys(PLANS).map(p=>{const a=before.summary.policies[p],b=after.summary.policies[p];return `| ${PLANS[p].label} | ${fmt(a)} | ${fmt(b)} | ${a.winMedian} → ${b.winMedian} 秒 | ${b.winMin}–${b.winMax} 秒 |`;}),
'',
'纯鱼干压力测试由 48 场超时降到 0，但仍有 48 场失败，适合验证僵局与基础推进，不能替代后期混编。枪手保护不再所有关卡都赢：第 20、26 关在三个种子下均失败；这两关仍有其他正常资源策略可通。支援阵容还有 9 场超时，满人口时伤害不足与队形拥堵仍需继续观察。刺客作为切入组件的行为更合理，但固定刺客阵容并未成为后期强势通解。',
'',
'## 章节节奏',
'',
'| 章节 | 新版胜/负/超时 | 胜局中位 | 已结束对局中位 | 已结束对局中 3–5 分钟 |',
'|---|---:|---:|---:|---:|',
...[1,2,3,4,5,6].map(c=>{const s=after.summary.chapters[c],d=duration(after.results.filter(r=>Math.ceil(r.stage/5)===c));return `| ${c} | ${fmt(s)} | ${s.winMedian} 秒 | ${d.median} 秒 | ${d.target}/${d.completed} |`;}),
'',
'前两章不少快局是进攻窗口带来的较早突破，后四章中位更接近目标区间。仍需真人测试新玩家是否能读懂窗口、是否有时间补前排，以及熟练玩家会否只按倒计时重复固定操作。',
'',
'## 不利结果与剩余问题',
'',
`同一关卡、策略、种子逐场配对：${gains.length} 场从未胜变胜，${regressions.length} 场从胜变为失败或超时。完整逐场列表在 comparison.json；不只报告变好的样本。`,
'',
'| 由胜变未胜：关卡 | 策略 | 种子 | 旧胜局秒数 | 新结果 / 秒数 |',
'|---|---|---:|---:|---|',
...regressions.map(r=>`| ${r.stage} | ${PLANS[r.policy].label} | ${r.seed} | ${previous.get(key(r)).seconds} | ${r.winner==='timeout'?'超时':'失败'} / ${r.seconds} |`),
'',
'| 剩余超时：关卡 | 策略 | 种子 | 敌基地剩余耐久 | 我方最终粮 / 最高人口 |',
'|---|---|---:|---:|---:|',
...timeouts.map(r=>`| ${r.stage} | ${PLANS[r.policy].label} | ${r.seed} | ${r.enemyHp} | ${r.food} / ${r.maxPopulation} |`),
'',
'满血胜局仍占绝大多数，三星区分度没有解决；本轮未改评星标准。支援队与刺客队的部分长局、前两章过快突破、章间难度跳变是下一轮真人试玩重点。浏览器定位夹具和正常资源对照分别存放，不将注入资源或直接移动角色的 UI 测试计入平衡结果。',
'',
'## 筛选过程与留档',
'',
'保留五份 180 场单种子筛选记录：waves-pilot（30/10 整备、旧刺客选敌）、targeting-pilot（额外泛近战换目标实验）、windows-pilot（36/12 整备与泛近战换目标实验）、forward-pilot（36/12，仅刺客向前）、forward-waves-pilot（30/10，仅刺客向前）。泛近战换目标让纯士兵赢下 24–25/30 关，因此舍弃；正式代码仍保留每个目标最多三名近战接敌的原规则。',
'',
'正式版第一章采用 36/12，后五章采用 30/10，结果单独完整复测，未拼接筛选数据。筛选 JSON 保留当时源码与候选文件指纹；废弃实验不作为当前规则的可复现结果。',
'',
'可复跑命令（项目根目录）：',
'',
'```powershell',
'npm.cmd run balance:pacing',
'node --experimental-strip-types scripts/report-pacing-balance.mjs',
'npm.cmd test',
'node scripts/pacing-playtest.mjs',
'node scripts/pacing-playtest.mjs --webkit',
'```',
'',
'原始数据：`analysis/pacing-0.17/baseline.json`、`applied.json`、`comparison.json`。源码与策略哈希均在 JSON 中，生成报告时重新校验。旧 0.16 报告作为历史记录保留。',
'',
'## 验收记录',
'',
'103 项规则测试通过，新增覆盖 30 关整备边界、重复周期、无配置的旧关卡、暂停招募而继续战斗与收入、双方研究、暂停与重开、刺客隐身结束后的向前追击和贴身追兵反击。原有隐身时长、不可攻击、到基地提前显形、致死首击与一次触发测试继续通过。',
'',
'Chromium / WebKit 新机制专项均通过，覆盖准备→整备→恢复增援、真实扣费研究、暂停与重开、四种尺寸、刺客受击→隐身→显形向前。专项截图与逐场文本状态在 `test-results/pacing/`；已目视 320px、390px、横放和 WebKit 刺客显形截图。曾因直接切换到未解锁关卡使重开被正确拦截，修正测试存档夹具后复测通过，未修改正常解锁规则。',
'',
'Chromium 16 兵种专项、近战接触与拥挤稳定性、完整浏览器流程、小屏 / iPhone / 横放 / 桌面响应式回归通过。标准 develop-web-game 客户端用正常资源招募三只士兵并施放技能，推进约 26 秒；已查看 `test-results/skill-pacing-final/shot-0.png` 与 `state-0.json`，无浏览器错误文件。',
'',
'TypeScript、正式构建、小工具构建和静态审计通过；小工具在 Chromium / WebKit 的生产与降级四种诊断通过。构建仍提示已有的 Phaser 包体较大。未发布或上传；真实手机、实际 Chrome 61 和平台模拟器仍未验证。',
];
writeFileSync('docs/增援节奏与战术优化.md', lines.join('\n')+'\n');
console.log(JSON.stringify({ durations:comparison.durations, gains:gains.length, regressions:regressions.length, timeouts:timeouts.length, stageSeedsWithoutWin:missing },null,2));
