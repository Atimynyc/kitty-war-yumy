import { baseSVG, icons, roomSVG, svgURL, unitSVG } from '../art.ts';
import { CHAPTERS, LEVELS, LEGACY_LEVELS, isLevelUnlocked, levelNumber, recommendedLevel } from '../game/levels.ts';
import type { CampaignProgress } from '../game/levels.ts';
import { chapterPostcard } from '../game/scene-art.ts';
import { ENEMY_FACTION, ENEMY_UNITS } from '../game/enemy-roster.ts';
import { ENEMY_ORDER, UNITS } from '../game/content.ts';
import type { UnitKind } from '../game/content.ts';
import { arrivalsAtStage, unlockedUnits, UNIT_LESSONS } from '../game/unit-unlocks.ts';
import { baseCatSVG } from '../game/base-cat-art.ts';
import { PLAYER_CAT } from '../game/cat-appearance.ts';

export function menuMarkup() {
  return `<section id="home-screen" class="menu-screen home-screen" aria-labelledby="home-title">
    <div class="home-copy"><span class="eyebrow">PAW & PANTRY · 小爪子，大作战</span>
      <h1 id="home-title" tabindex="-1">冻干，<br>一粒也不能<span>少。</span></h1>
      <p class="home-lead">大胖橘带着搜粮团盯上了你的冻干罐头！<br>带着自己的猫咪，召集小队守住这份美味。</p>
      <div class="home-actions"><button id="start" class="primary-button">开始守护 ${icons.play}</button><button id="choose-level" class="menu-secondary">选择关卡 <span>→</span></button></div>
      <button id="home-cat" class="home-my-cat"><img id="home-cat-preview" src="${svgURL(baseCatSVG(PLAYER_CAT))}" alt="我的猫咪"/><span><strong>我的猫咪</strong><small id="home-cat-description">换个喜欢的模样，一起守护小窝</small></span><span aria-hidden="true">→</span></button>
      <p id="resume-summary" class="resume-summary" hidden></p><button id="new-battle" class="home-new-battle" hidden>重新开始这关</button>
      <div class="home-honors"><button id="home-characters" class="nav-icon-button">${icons.book}<span>图鉴</span></button><button id="home-achievements" class="nav-icon-button">${icons.trophy}<span>成就</span></button><span id="home-equipped-title" class="equipped-honor"></span></div>
      <div class="home-details"><span><b>${CHAPTERS.length}</b> 个场景</span><span><b>${LEVELS.length}</b> 个关卡</span><span><b id="home-cleared">0 / ${LEVELS.length}</b> 已守护</span></div>
      <p id="home-progress" class="home-progress">第 01 关 · 第一口冻干</p>
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
    <div class="menu-heading"><div><span class="eyebrow">SIX LITTLE PLACES TO PROTECT</span><h1 id="levels-title" tabindex="-1">把每一个小窝，守好。</h1></div><button id="levels-back" class="menu-secondary">← 首页</button></div>
    <p class="level-lead">六个地方，三十次守护。通关解锁下一关，满血获胜拿三星。</p>
    <div class="chapter-tabs" role="group" aria-label="浏览章节">${CHAPTERS.map(chapter => `<button class="chapter-tab" data-chapter="${chapter.id}" aria-pressed="false" aria-label="第 ${chapter.id} 章 ${chapter.name}">${String(chapter.id).padStart(2, '0')}<span data-chapter-medal="${chapter.id}" aria-hidden="true"></span></button>`).join('')}</div>
    <div class="chapter-postcard"><img id="chapter-art" alt=""/><div class="chapter-caption"><span id="chapter-number"></span><h2 id="chapter-title"></h2><p id="chapter-copy"></p></div><span id="chapter-stars" class="chapter-stars"></span></div>
    ${CHAPTERS.map(chapter => `<div class="stage-map" data-chapter-group="${chapter.id}" role="group" aria-label="${chapter.name}的五个关卡" hidden>${LEVELS.filter(level => level.chapter === chapter.id).map(level => `<button class="stage-node" id="level-${level.id}" data-level="${level.id}" aria-pressed="false"><span class="stage-number">${levelNumber(level)}</span><img src="${svgURL(unitSVG(level.cover!, 'enemy'))}" alt=""/><span class="stage-state"></span><span class="stage-stars" data-record="${level.id}">☆☆☆</span></button>`).join('')}</div>`).join('')}
    <div class="stage-detail" aria-live="polite"><div class="stage-detail-heading"><strong id="selected-level-name"></strong><span id="selected-level-tag"></span></div><p id="selected-level-tactic"></p><ul id="selected-enemy-roster" class="enemy-roster" aria-label="本关可能出现的敌军"></ul><div id="selected-unit-arrivals"></div><p id="selected-level-tip"></p><small id="selected-level-record"></small></div>
    <div class="campaign-launch"><p id="selected-level-summary"></p><button id="level-start" class="primary-button">出发，保护冻干 ${icons.play}</button></div>
    <details id="legacy-scores" class="legacy-scores" hidden><summary>经典三关成绩</summary><p>原版成绩为你保留。新旅程从第 01 关开始。</p><div id="legacy-records"></div></details>
  </section>`;
}

export function updateLevelSelection(selectedId: string, progress: CampaignProgress, inherited: readonly UnitKind[] = []) {
  const selected = LEVELS.find(level => level.id === selectedId) ?? LEVELS[0];
  const chapter = CHAPTERS.find(item => item.id === selected.chapter)!;
  const screen = document.getElementById('level-screen')!;
  screen.style.setProperty('--chapter-accent', chapter.accent);
  document.getElementById('chapter-number')!.textContent = `第 ${String(chapter.id).padStart(2, '0')} 章`;
  document.getElementById('chapter-title')!.textContent = chapter.name;
  document.getElementById('chapter-copy')!.textContent = chapter.description;
  (document.getElementById('chapter-art') as HTMLImageElement).src = svgURL(chapterPostcard(chapter.scene));
  const chapterLevels = LEVELS.filter(level => level.chapter === chapter.id);
  const stars = chapterLevels.reduce((sum, level) => sum + (progress[level.id]?.stars ?? 0), 0);
  const completed = chapterLevels.every(level => progress[level.id]);
  document.getElementById('chapter-stars')!.textContent = completed ? `✓ 已守护 · ${stars} / 15 ★` : `${stars} / 15 ★`;
  document.querySelectorAll<HTMLElement>('[data-chapter-group]').forEach(group => { group.hidden = Number(group.dataset.chapterGroup) !== chapter.id; });
  for (const item of CHAPTERS) {
    const tab = document.querySelector<HTMLButtonElement>(`[data-chapter="${item.id}"]`)!;
    tab.setAttribute('aria-pressed', String(item.id === chapter.id));
    const cleared = LEVELS.filter(level => level.chapter === item.id).every(level => progress[level.id]);
    document.querySelector<HTMLElement>(`[data-chapter-medal="${item.id}"]`)!.textContent = cleared ? '✓' : '';
  }
  for (const level of LEVELS) {
    const button = document.getElementById(`level-${level.id}`)!;
    button.setAttribute('aria-pressed', String(level.id === selected.id));
    const unlocked = isLevelUnlocked(level.id, progress);
    button.dataset.locked = String(!unlocked);
    const result = progress[level.id];
    const state = result ? '已通关' : !unlocked ? '未解锁' : level.stage! % 5 === 0 ? '守关战' : '可挑战';
    button.querySelector<HTMLElement>('.stage-state')!.textContent = state;
    button.setAttribute('aria-label', `第 ${levelNumber(level)} 关 ${level.name}，${state}${result ? `，${result.stars} 星` : ''}，点击预览`);
    button.querySelector<HTMLElement>('[data-record]')!.textContent = result ? `${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}` : '☆☆☆';
  }
  const record = progress[selected.id], unlocked = isLevelUnlocked(selected.id, progress);
  document.getElementById('selected-level-name')!.textContent = `${levelNumber(selected)} · ${selected.name}`;
  document.getElementById('selected-level-tag')!.textContent = selected.difficulty;
  document.getElementById('selected-level-tactic')!.textContent = `${ENEMY_FACTION} · ${selected.tactic}${selected.phases?.length ? ` → ${selected.phases.map(phase => phase.label).join(' → ')}` : ''}`;
  const formations = [selected.formations, ...(selected.phases ?? []).map(phase => phase.formations)];
  // Emergency defense can recruit the two basic roles outside the scheduled formation.
  const possible = new Set(['mouse', 'soldier']);
  for (const formation of formations) for (const tier of formation) for (const kind of tier) possible.add(kind);
  if (selected.knight) possible.add('knight');
  const roster = ENEMY_ORDER.filter(kind => possible.has(kind) && UNITS[kind].tier <= (selected.techCap ?? 3));
  if (selected.bossEncounter) roster.push('boss');
  document.getElementById('selected-enemy-roster')!.innerHTML = roster.map(kind => `<li title="${ENEMY_UNITS[kind].description}"><img src="${svgURL(unitSVG(kind, 'enemy'))}" alt=""/><span>${ENEMY_UNITS[kind].name}<small>${ENEMY_UNITS[kind].role}</small></span></li>`).join('');
  document.getElementById('selected-level-tip')!.textContent = selected.tip!;
  const owned=unlockedUnits(progress,inherited), arrivals=arrivalsAtStage(selected.stage!);
  const arrivalBox=document.getElementById('selected-unit-arrivals')!;
  arrivalBox.hidden=arrivals.length===0;
  arrivalBox.innerHTML=arrivals.map(kind=>`<div class="unit-arrival"><img src="${svgURL(unitSVG(kind))}" alt=""/><p><strong>${owned.includes(kind)?'已加入伙伴':'到达本关解锁'} · ${UNITS[kind].short}</strong><span>${UNIT_LESSONS[kind]??'基础伙伴，随时准备出发。'}</span><small>${['一','二','三'][UNITS[kind].tier-1]}阶科技 · ${UNITS[kind].cost} 猫粮</small></p></div>`).join('');
  document.getElementById('selected-level-record')!.textContent = record ? `最好 ${record.stars} 星 · 最快 ${Math.round(record.bestTime)} 秒` : `首波 ${selected.grace} 秒后 · 交替增援与整备`;
  document.getElementById('selected-level-summary')!.textContent = unlocked ? `${chapter.name} · 第 ${(selected.stage! - 1) % 5 + 1} / 5 关` : `先通关第 ${String(selected.stage! - 1).padStart(2, '0')} 关`;
  const start = document.getElementById('level-start') as HTMLButtonElement;
  start.disabled = !unlocked;
  start.textContent = unlocked ? record ? '再次守护 →' : '出发，保护冻干 →' : '通关前一关后解锁';
  updateHomeProgress(progress);
}

export function updateHomeProgress(progress: CampaignProgress) {
  const cleared = LEVELS.filter(level => progress[level.id]).length, next = recommendedLevel(progress);
  document.getElementById('home-cleared')!.textContent = `${cleared} / ${LEVELS.length}`;
  document.getElementById('home-progress')!.textContent = cleared === LEVELS.length ? '六个小窝都守住了，再来挑战满星吧。' : `第 ${levelNumber(next)} 关 · ${next.name}`;
  document.getElementById('start')!.textContent = cleared === LEVELS.length ? '重温最终守护 →' : cleared ? '继续守护 →' : '开始守护 →';
  const legacy = LEGACY_LEVELS.filter(level => progress[level.id]);
  document.getElementById('legacy-scores')!.hidden = legacy.length === 0;
  document.getElementById('legacy-records')!.innerHTML = legacy.map(level => `<p><strong>${level.name}</strong><span>${progress[level.id].stars} 星${progress[level.id].ratingVersion === 2 ? '' : '（旧评分）'} · ${Math.round(progress[level.id].bestTime)} 秒</span></p>`).join('');
}
