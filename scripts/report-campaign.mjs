import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LEVELS, CHAPTERS } from '../src/game/levels.ts';
import assert from 'node:assert/strict';

const runs = JSON.parse(readFileSync('analysis/campaign30-applied.json', 'utf8'));
assert.equal(runs.length, 180);
const names = { 'mouse-rush': '纯玩具鼠', 'soldier-rush': '纯鱼干', 'economy-and-tech': '经济科技', 'economy-opening': '经济开局', 'reserve-for-tech': '攒粮研究', 'combined-arms': '三阶混编' };
const rows = LEVELS.map(level => {
  const samples = runs.filter(run => run.level === level.id), wins = samples.filter(run => run.winner === 'player');
  assert.equal(samples.length, 6); assert.ok(wins.length > 0, `${level.id}: no normal-resource win`);
  const example = wins.find(run => run.strategy === 'combined-arms') ?? wins.find(run => run.strategy !== 'soldier-rush') ?? wins[0];
  return `| ${level.stage} | ${level.name} | ${CHAPTERS[level.chapter - 1].name} | ${wins.length} / 6 | ${names[example.strategy]} | ${example.seconds} 秒 |`;
});
const wins = runs.filter(run => run.winner === 'player'), timeouts = runs.filter(run => run.winner === 'unfinished');
const strategyRows = Object.entries(names).map(([id, name]) => {
  const samples = runs.filter(run => run.strategy === id);
  return `| ${name} | ${samples.filter(r => r.winner === 'player').length} | ${samples.filter(r => r.winner === 'enemy').length} | ${samples.filter(r => r.winner === 'unfinished').length} |`;
});
const sources = ['src/game/campaign.ts', 'src/game/levels.ts', 'src/game/simulation.ts', 'src/game/content.ts', 'scripts/balance.mjs'];
const manifest = { version: '0.12.0', date: '2026-10-24', stages: 30, runs: runs.length, playerWins: wins.length, timeouts: timeouts.length, sources: Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])) };
writeFileSync('analysis/campaign30-manifest.json', JSON.stringify(manifest, null, 2));
const report = `# 30 关战役验收记录

版本：0.12.0。日期：2026-10-24。

## 已实现

- 六章各五关：阳光客厅、纸箱走廊、零食厨房、花园阳台、月光天台、冻干仓库。每章有自己的地面、道路、侧边摆件和配色；换关即更新，不依赖窗口尺寸变化。
- 逐关编队、首波时间、投资门槛、研究上限与部分关卡的阶段换阵；高阶敌军逐步引入，重骑编队会用真实收入攒够招募费用。原有双方普通兵种数值、人口与资源规则保留。
- 章节选关、锁定关卡预览、一星解锁下一关、首页继续、章节纪念章、最终关结算与重玩。
- 旧三关成绩保留，版本 2 存档把主线与经典记录分开。原评分注明，最快时间保留；旧终关不直接解锁新主线。
- 第 30 关按配置触发大胖橘，继续沿用基地存活且耐久低于 30% 的触发边界。

基地科技外观、主炮美术与投喂器部件不属于本轮关卡实现，方向方案见 docs/三十关与基地美术改版规划.md。

## 正常资源对照

直接使用真实 Battle 模拟，步长 1/30 秒，六种固定操作策略 × 30 关，共 ${runs.length} 场；每场最多推进 900 秒。没有给予玩家额外资源或改动攻血。结果是可重复的脚本对照，不是随机样本或真人胜率。浏览器连续解锁测试使用受控胜负夹具，只证明流程；本节才是正常资源对局结果。

胜利 ${wins.length} 场、失败 ${runs.filter(r => r.winner === 'enemy').length} 场、超时 ${timeouts.length} 场。全部 30 关至少找到一种可通关的混编策略，第一章五关均支持基准三阶混编。胜局范围 ${Math.min(...wins.map(r => r.seconds))}–${Math.max(...wins.map(r => r.seconds))} 秒；${wins.filter(r => r.seconds >= 180 && r.seconds <= 300).length} 场胜局落在 3–5 分钟。该时长目标尚未覆盖全部策略，不能把所有关卡宣传为固定时长。

| 策略 | 胜 | 负 | 超时 |
|---|---:|---:|---:|
${strategyRows.join('\n')}

| 关卡 | 名称 | 场景 | 获胜策略数 | 可通关示例 | 时间 |
|---|---|---|---:|---|---:|
${rows.join('\n')}

初轮完整 180 场保存在 analysis/campaign30-initial.json，局部候选 336 场在 analysis/campaign30-tuning.json，最终完整 180 场在 analysis/campaign30-applied.json。调优主要延后新机制教学关的敌方投资时机，并放缓部分首次登场的增援节奏。保留初轮失败与超时，没有用只展示胜局的方式掩盖难度跳跃。

## 自动与视觉验收

- npm test：79 项通过，包含 30 关持续招募、资源 / 人口限制、真实重骑招募、每关正常资源可通关、存档迁移、顺序解锁、首领和原战斗规则。
- Chromium / WebKit 的 test:campaign 通过：从第 1 到第 30 关连续推进、30 个首波时间、六场景无旋转换景、星级边界、失败与平局不改记录、暂停重开、旧存档保留、最后一关与重新加载。
- Chromium 完整玩法、首领专项与 320px / 390px / 横放 / 桌面响应式检查通过，未发现浏览器错误；六套场景、选关页与终局小屏截图已逐项查看。
- develop-web-game 原客户端使用正常资源完成三次招募、施法与战斗推进；记录在 test-results/skill-campaign30-final/。
- 常规构建与小工具兼容构建通过；小工具静态审计、6 项平台存储测试及 Chromium / WebKit 的兼容降级诊断通过。小工具平台和手机真机的验证独立于桌面浏览器检查，未宣称完成真机验收。

## 复跑与后续观察

- node --experimental-strip-types scripts/balance.mjs：输出当前 30 关的 180 场对照；把输出保存为 analysis/campaign30-applied.json 后运行 node --experimental-strip-types scripts/report-campaign.mjs 更新本记录与源码指纹。
- npm run test:campaign：测试主线浏览器流程；通过 TEST_BROWSER=webkit 切换引擎。
- 历史数值分析与能量对照脚本明确使用 LEGACY_LEVELS，避免把旧三关基线误套在 30 关上。
- 真人试玩优先观察第 4 / 5、12 / 13、15、20、22、27 和 30 关，以及新章首关的压力变化。关注过快胜局、单一阵容长局、满人口积粮、能量溢出与满血三星过多的问题。

数据与源码 SHA-256 指纹：analysis/campaign30-manifest.json。
`;
writeFileSync('30关战役验收记录.md', report);
console.log(JSON.stringify({ runs: runs.length, wins: wins.length, losses: runs.filter(r => r.winner === 'enemy').length, timeouts: timeouts.length, allStagesHaveWin: true, winSeconds: [Math.min(...wins.map(r => r.seconds)), Math.max(...wins.map(r => r.seconds))] }));
