import { baseSVG, icons, roomSVG, svgURL, unitSVG } from '../art.ts';
import { LEVELS } from '../game/levels.ts';
import type { CampaignProgress } from '../game/levels.ts';

export function menuMarkup() {
  return `<section id="home-screen" class="menu-screen home-screen" aria-labelledby="home-title">
    <div class="home-copy"><span class="eyebrow">PAW & PANTRY · 小爪子，大作战</span>
      <h1 id="home-title" tabindex="-1">冻干，<br>一粒也不能<span>少。</span></h1>
      <p class="home-lead">开动投喂机，集结猫咪小队。<br>让每一只勇敢的小猫，都有冻干可吃。</p>
      <div class="home-actions"><button id="start" class="primary-button">开始守护 ${icons.play}</button><button id="choose-level" class="menu-secondary">选择关卡 <span>→</span></button></div>
      <div class="home-details"><span><b>240</b> 开局猫粮</span><span><b>12 / 秒</b> 自动投喂</span><span><b>3</b> 个关卡</span></div>
    </div>
    <div class="home-art" role="img" aria-label="阳光照进客厅，猫咪小队守护冻干仓库" style="background-image:url('${svgURL(roomSVG)}')">
      <span class="home-sticker">今日任务<br><b>守好小窝！</b></span>
      <img class="home-base" src="${svgURL(baseSVG('player'))}" alt="" />
      <img class="home-cat hero-shield" src="${svgURL(unitSVG('shield'))}" alt="" />
      <img class="home-cat hero-soldier" src="${svgURL(unitSVG('soldier'))}" alt="" />
      <img class="home-cat hero-mouse" src="${svgURL(unitSVG('mouse'))}" alt="" />
      <div class="home-art-caption">自动行军 · 搭配阵容 · 升级主炮</div>
    </div>
    <p class="home-tip">从「阳光客厅」开始，慢慢成为冻干守护者。<button id="home-guide">看看怎么玩</button></p>
  </section>
  <section id="level-screen" class="menu-screen level-screen" hidden aria-labelledby="levels-title">
    <div class="menu-heading"><div><span class="eyebrow">CHOOSE YOUR LITTLE ADVENTURE</span><h1 id="levels-title" tabindex="-1">今天，守护哪一个小窝？</h1></div><button id="levels-back" class="menu-secondary">← 返回首页</button></div>
    <p class="level-lead">三个关卡均可挑战。对手会持续增援，摧毁敌方仓库才算胜利。</p>
    <div class="level-list" role="group" aria-label="选择关卡">${LEVELS.map((level, index) => `<button class="level-card" id="level-${level.id}" data-level="${level.id}" aria-pressed="false" style="--level-accent:${level.accent}">
      <span class="level-top"><span class="level-number">0${index + 1}</span><span class="difficulty-tag">${level.difficulty}</span></span>
      <div class="level-picture"><img src="${svgURL(unitSVG((['soldier', 'shield', 'catapult'] as const)[index]))}" alt=""/><span class="level-selection">✓ 已选择</span></div>
      <span class="level-subtitle">${level.subtitle}</span><strong>${level.name}</strong><span class="level-description">${level.description}</span>
      <span class="level-rule">首波 ${level.grace} 秒后 · 持续增援</span><span class="level-record" data-record="${level.id}">☆☆☆ 尚未通关</span>
    </button>`).join('')}</div>
    <div class="level-launch"><p id="selected-level-summary"></p><button id="level-start" class="primary-button">出发，保护冻干 ${icons.play}</button></div>
  </section>`;
}

export function updateLevelSelection(selectedId: string, progress: CampaignProgress) {
  for (const level of LEVELS) {
    document.getElementById(`level-${level.id}`)?.setAttribute('aria-pressed', String(level.id === selectedId));
    const record = document.querySelector<HTMLElement>(`[data-record="${level.id}"]`)!;
    const result = progress[level.id];
    record.textContent = result ? `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)} 已通关 · 最快 ${Math.round(result.bestTime)} 秒` : '☆☆☆ 尚未通关';
    if (level.id === selectedId) document.getElementById('selected-level-summary')!.textContent = `${level.name} · ${level.difficulty} / 双方基地主炮自动防守`;
  }
}
