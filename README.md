# 猫咪冻干保卫战 · PAW & PANTRY

一款单路推进的轻策略网页游戏。手机和平板竖屏时，玩家在下方、电脑在上方；横屏和桌面采用左右对抗。双方通过自动投喂机生产猫粮、招募佣兵并争夺冻干仓库。

## 启动

推荐 Node.js 24，最低使用支持 TypeScript 类型擦除的 Node.js 22.18。

```sh
npm install
npm run dev
```

打开终端显示的本地地址。默认地址为 `http://127.0.0.1:5173/`。

```sh
npm run build       # 类型检查并生成 dist/
npm run preview     # 预览生产构建
npm test           # 战斗规则自动测试
npm run test:browser # 浏览器验收，需要先启动开发服务
npm run test:responsive # 17 种屏幕尺寸与旋转、安全区验收
node --experimental-strip-types scripts/balance.mjs # 使用正常资源对比五种出兵策略
```

浏览器验收使用 Playwright Chromium。如果本机没有浏览器，请先运行 `npx playwright install chromium`。Windows 下也会自动尝试使用本机已有的 Playwright Chromium；可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定路径，通过 `GAME_URL` 指定开发服务器地址。截图保存在 `test-results/`。

## 玩法

- 双方初始 3000 基地耐久、120 猫粮和 6 猫粮/秒。敌方基地耐久归零即获胜。
- 点击佣兵卡招募。佣兵自动前进，遇敌战斗，消耗对应人口，退场后释放人口。人口上限为 24。
- 升级自动投喂机，提高持续收入；研究科技，解锁盾卫、投手、投石机和奶妈。
- 「喵喵震退」推开己方基地附近的敌人并减速，冷却 45 秒。
- 电脑遵守同样的猫粮、人口、科技和招募冷却规则。击杀没有额外经济奖励。
- 暂停时，战斗、收入和研究全部暂停。切到其他标签页时自动暂停，返回后手动继续。
- 音效默认关闭，点击右上角声音按钮开启。支持 1× / 2× 对战速度。

| 按键 | 操作 |
|---|---|
| 1—6 | 招募对应卡片的佣兵 |
| E | 升级投喂机 |
| T | 研究科技 |
| 空格 | 喵喵震退 |
| P / Esc | 暂停或继续 |
| M | 开关音效 |

触屏通过按钮操作。竖屏采用上下对抗的俯视地毯战场，底部固定两行三列佣兵卡和一排升级 / 技能按钮；短横屏采用左侧战场、右侧操作区，桌面保留原有左右对抗布局。布局按实际可用宽高自动切换，旋转不会重置对局。

## 手机访问

手机和开发电脑连接同一局域网后，在项目目录运行 `npm run dev:lan`，用手机打开终端显示的 **Network** 地址。手机里的 `localhost` / `127.0.0.1` 指向手机自身，不能用它访问电脑服务。若无法连接，检查 Windows 防火墙是否允许 Node 在专用网络接入，以及路由器是否开启设备隔离。

此命令会把开发服务开放给局域网，仅在可信网络使用。正式发布使用 `npm run build` 生成的静态站点。

## 发布到 GitHub

项目已包含 GitHub Pages 自动部署工作流。创建公开仓库，在 Settings → Pages 中选择 GitHub Actions，然后将源码推送到 `main`，即可发布为手机可直接访问的网址。完整首次上传、发布和更新步骤见 [GitHub 部署说明](./GitHub部署说明.md)。

## 多尺寸与浏览器适配（0.2）

- 手机、折叠屏和平板竖屏：上下对抗；宽度不超过 1100 CSS 像素且高度不小于宽度时启用。
- 短横屏 / 中等宽度窗口：左右战场配侧边操作区；宽屏电脑维持桌面布局。
- 游戏区域使用实际可视高度，适应移动浏览器地址栏展开收起；通过 `viewport-fit=cover` 和 `safe-area-inset-*` 留出刘海与底部手势区域。
- 320 × 568 小屏、长屏、平板和横屏均纳入自动验收。特别矮的可用空间会隐藏佣兵卡插画、缩减辅助信息，保留所有招募和升级按钮。
- 主要触控目标至少 44 × 44 CSS 像素；方向变化时重排画面，不修改单位位置、资源、冷却或科技状态。
- Chromium 与 WebKit 引擎分别进行浏览器测试。Windows WebKit 测试不等同于真实 iPhone Safari，实机浏览器 / 微信内嵌浏览器仍需后续真机复核。
- 音频接口不可用时，静默降级，不影响开局与对战。
- 使用 Phaser 的 Canvas 2D 渲染，避免本次 WebKit 验收中复现的 WebGL 缩放后画面丢失。按钮内部内容仅在变化时更新，避免状态刷新打断点击。

WebKit 验收：先 `npx playwright install webkit`，再在 PowerShell 中执行 `$env:TEST_BROWSER='webkit'; npm run test:responsive`。结果和截图位于 `test-results/responsive/`。

本次覆盖范围与结果见 [移动端适配验收记录](./移动端适配验收记录.md)。

## 首版内容

- 一张客厅地图，六种佣兵，三级科技，四级投喂机。
- 近战接敌、远程攻击、投石机范围伤害和攻城加成、最多三个友军的治疗。
- 普通电脑对手、完整开始 / 暂停 / 胜负结算 / 重开流程。
- 本地矢量角色和场景、战斗特效、可切换的合成音效。
- 本版对局不跨页面刷新保存；平衡数值仍需继续实玩调整，4～7 分钟是设计目标。

## 项目结构

```text
src/
  game/
    content.ts       兵种、经济、科技与地图配置
    simulation.ts    独立于画面的对战规则和电脑决策
    BattleScene.ts   Phaser 场景、角色动画、血条与特效
    projection.ts    横向战斗进度到竖屏画面的映射
    audio.ts         本地 Web Audio 合成音效
  art.ts             原创 SVG 角色与客厅插画
  portrait-art.ts    俯视角色与竖屏基地插画
  responsive.css    可用视口、安全区及横竖屏布局
  ui/viewport.ts    布局模式与动态可视高度
  main.ts            DOM 界面、操作绑定和状态展示
  style.css          主题、桌面和手机布局
tests/
  simulation.test.ts 战斗规则测试
  viewport.test.ts   布局选择与竖屏投影检查
scripts/
  playtest.mjs       浏览器操作验收与截图
  balance.mjs        策略模拟和局时参考
  responsive-playtest.mjs 多尺寸、旋转和跨浏览器检查
游戏设计方案.md       原始玩法设计
```

技术栈为 Phaser 3、TypeScript、Vite。所有插画由项目内 SVG 绘制，音效由 Web Audio 合成，不依赖远程图片、字体或音频服务。

开发模式下通过 `?qa` 才会暴露浏览器验收接口；生产构建不提供该接口。
