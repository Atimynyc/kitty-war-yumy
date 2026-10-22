import './style.css';
import './responsive.css';
import './experience.css';
import { installViewport } from './ui/viewport.ts';
import { icons, paw, svgURL, unitSVG } from './art.ts';
import { BASE_HP, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, ECONOMY_COSTS, FOOD_RATES, MAX_POPULATION, TECH_COSTS, TECH_NAMES, TECH_TIMES, UNIT_ORDER, UNITS } from './game/content.ts';
import type { UnitKind } from './game/content.ts';
import { LEVELS, readProgress } from './game/levels.ts';
import type { CampaignProgress } from './game/levels.ts';
import { menuMarkup, updateLevelSelection } from './ui/menus.ts';
import { Battle } from './game/simulation.ts';
import { createGame } from './game/BattleScene.ts';
import { GameAudio } from './game/audio.ts';

installViewport();
const battle = new Battle();
const audio = new GameAudio();
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
const food = `<span class="inline-icon">${icons.food}</span>`;
$('#app').innerHTML = `
  <div class="game-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="猫咪冻干保卫战首页"><span class="brand-mark">${paw}</span><span><span class="brand-name">猫咪冻干保卫战<span class="version">试玩版 0.3</span></span><span class="brand-en">PAW & PANTRY <span>一场为了冻干的可爱战争</span></span></span></a>
      <nav class="toolbar" aria-label="游戏设置"><button class="icon-button" id="sound" title="开启音效（M）" aria-label="开启音效" aria-pressed="false">${icons.mute}</button><button class="text-button" id="help" aria-label="玩法指南"><span class="help-symbol">?</span><span>玩法指南</span></button><span class="toolbar-divider"></span><button class="text-button" id="pause" aria-label="暂停" disabled>${icons.pause}<span>暂停</span></button></nav>
    </header>
    ${menuMarkup()}
    <main id="battle-screen" hidden>
      <section class="battle-heading"><div><span class="eyebrow" id="battle-chapter">CHAPTER 01 · 阳光客厅</span><h1>今天的冻干，由我们守护<span>！</span></h1></div><span class="mode-badge" id="battle-difficulty"><i></i> 人机对战 · 入门</span></section>
      <section class="status-bar" aria-label="对战状态">
        <div class="base-status friendly"><span class="team-avatar">${paw}</span><div class="base-info"><div class="base-title"><span>我方冻干仓库</span><strong id="player-hp">3000 <small>/ 3000</small></strong></div><div class="health-track"><span id="player-health"></span></div></div></div>
        <div class="resource-status"><span class="food-medal">${icons.food}</span><div><span class="resource-label">储备猫粮</span><div class="food-numbers"><strong id="food">240</strong><span id="income">+12 / 秒</span></div></div></div>
        <div class="time-status"><span class="resource-label">对战时间</span><strong id="timer">00:00</strong><button id="speed" title="切换游戏速度" aria-label="游戏速度 1 倍">1×</button></div>
        <div class="base-status rival"><div class="base-info"><div class="base-title"><span>对手冻干仓库</span><strong id="enemy-hp">3000 <small>/ 3000</small></strong></div><div class="health-track"><span id="enemy-health"></span></div></div><span class="team-avatar">${paw}</span></div>
      </section>
      <section class="arena-frame" aria-label="战场">
        <div id="battle-canvas"></div><div id="loading">猫咪们正在整理装备…</div>
        <div class="arena-badge"><span class="sun-icon">☀</span><span id="reinforcement-status">准备迎接第一波</span></div>
        <div class="arena-population">${icons.people} 小队 <strong id="population">0 / 24</strong></div>
        <div class="arena-base-label enemy-label"><span>对手冻干 <strong id="compact-enemy-hp">3000</strong></span><div class="health-track"><span id="compact-enemy-health"></span></div></div>
        <div class="arena-base-label player-label"><span>我方冻干 <strong id="compact-player-hp">3000</strong></span><div class="health-track"><span id="compact-player-health"></span></div><small id="compact-cannon">主炮 32 · 自动防守</small></div>
        <span class="portrait-direction">↑ 守住冻干，向上进攻</span>
        <div id="battle-overlay" class="battle-overlay"></div>
      </section>
      <div class="field-note"><span class="note-paw">${paw}</span><p id="field-message" role="status" aria-live="polite">冻干已就位，小队等你出发。</p><span class="auto-note" id="cannon-status"><i></i> 主炮 32 伤害 · 自动防守</span></div>
      <section class="recruit-section" aria-labelledby="recruit-title"><div class="section-label"><h2 id="recruit-title">集结猫咪小队 <span>RECRUIT YOUR CREW</span></h2><span>点击招募 <span class="keyboard-hint">/ 快捷键 1—6</span></span></div>
        <div class="unit-grid">${UNIT_ORDER.map((kind, index) => { const spec = UNITS[kind]; return `<button class="unit-card" id="hire-${kind}" data-kind="${kind}" aria-label="招募${spec.name}，${spec.cost}猫粮" title="${spec.description}"><span class="unit-key">${index + 1}</span><span class="unit-pop">${spec.population} 人口</span><div class="unit-art" style="--unit-bg:${spec.color}"><img src="${svgURL(unitSVG(kind))}" alt="" draggable="false" /></div><strong class="unit-name">${spec.name}</strong><span class="unit-role">${spec.role}</span><span class="unit-bottom"><span class="unit-cost">${food}${spec.cost}</span><span class="unit-state">招募 +</span></span><span class="cooldown-track"></span></button>`; }).join('')}</div>
      </section>
      <section class="upgrade-grid" aria-label="基地升级和主动技能">
        <button class="upgrade-card economy-card" id="upgrade-economy"><span class="upgrade-symbol">${icons.food}</span><span class="upgrade-info"><strong><b id="economy-title">产能升级</b> <span id="economy-level">Lv.1</span></strong><small id="economy-description">产量 6 → 9 猫粮 / 秒</small></span><span class="upgrade-action" id="economy-action">${food}120<span>升级 ↑</span></span></button>
        <button class="upgrade-card tech-card" id="upgrade-tech"><span class="upgrade-symbol">${icons.flask}</span><span class="upgrade-info"><strong><b id="tech-title">科技研究</b> <span id="tech-level">一阶</span></strong><small id="tech-description">解锁盾卫 & 毛球投手</small></span><span class="upgrade-action" id="tech-action">${food}180<span>研究 ↑</span></span><span id="research-progress"></span></button>
        <button class="upgrade-card roar-card" id="roar"><span class="upgrade-symbol">${paw}</span><span class="upgrade-info"><strong>主动 · 震退 <span class="key-label">SPACE</span></strong><small>震退基地附近敌人，争取反击时间</small></span><span class="upgrade-action" id="roar-action"><b>喵！</b><span>技能就绪</span></span></button>
      </section>
    </main>
    <footer><span>${paw} 每一粒冻干，都值得全力以赴。</span><span>招募 <kbd>1</kbd>—<kbd>6</kbd><i>·</i> 升级 <kbd>E</kbd> / <kbd>T</kbd><i>·</i> 暂停 <kbd>P</kbd></span></footer>
  </div>
  <dialog id="guide" aria-labelledby="guide-title"><button class="dialog-close" aria-label="关闭玩法指南">×</button><span class="eyebrow">THE LITTLE FIELD GUIDE</span><h2 id="guide-title">冻干保卫战，开课啦。</h2><p class="guide-lead">左边是你的家，右边是馋嘴对手。让对手的基地耐久降到零，就赢啦！</p><div class="guide-steps"><p><b>01</b><span><strong>收猫粮，招募小队</strong>投喂机自动生产猫粮。点击兵种卡招募，佣兵会自己前进和战斗，每方最多 24 人口。</span></p><p><b>02</b><span><strong>稳住前线，再做投资</strong>升级投喂机能提高产量；研究科技解锁新伙伴并强化主炮。研究期间照样可以出兵。</span></p><p><b>03</b><span><strong>搭配阵容，抓准时机</strong>盾卫扛伤、投手输出、投石机攻城、奶妈治疗。敌人接近基地时，用「喵喵震退」救场。</span></p></div><div class="guide-units">${UNIT_ORDER.map(kind => `<p><img src="${svgURL(unitSVG(kind))}" alt=""/><span><strong>${UNITS[kind].name}</strong>${UNITS[kind].description}</span></p>`).join('')}</div><p class="guide-fair">双方开局 240 猫粮、每秒产粮 12。电脑按关卡节奏持续招募，同样消耗猫粮和人口。双方主炮自动攻击附近敌人，科技升级将伤害从 32 提升到 55 / 85。切换标签页会自动暂停。</p><button class="primary-button" id="guide-close">记住了，保护冻干！ ${icons.play}</button></dialog>
`;

type Screen = 'home' | 'levels' | 'battle';
let screen: Screen = 'home';
const SAVE_KEY = 'paw-pantry-progress-v1';
let progress: CampaignProgress = {};
try { progress = readProgress(localStorage.getItem(SAVE_KEY)); } catch { /* Storage can be unavailable in private/embedded browsers. */ }
let selectedLevelId = LEVELS.find(level => !progress[level.id])?.id ?? LEVELS[0].id;
let speed = 1;
let previousPhase = '';
let previousMessage = '';
let lastHUD = -Infinity;
let guideWasPlaying = false;
let endSoundPlayed = false;
const renderedMarkup = new WeakMap<HTMLElement, string>();
function updateMarkup(selector: string, markup: string) {
  const element = $(selector);
  // Keep pointer targets mounted between press and release on touch browsers.
  if (renderedMarkup.get(element) === markup) return;
  element.innerHTML = markup;
  renderedMarkup.set(element, markup);
}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const { scene } = createGame('battle-canvas', battle, render);
window.addEventListener('game-layout-change', () => render(true));
const guide = $('#guide') as HTMLDialogElement;

function action(callback: () => boolean, sound: 'hire' | 'upgrade' | 'roar') {
  if (callback()) audio.play(sound);
  render(true);
}
for (const kind of UNIT_ORDER) $(`#hire-${kind}`).addEventListener('click', () => action(() => battle.summon('player', kind), 'hire'));
$('#upgrade-economy').addEventListener('click', () => action(() => battle.upgradeEconomy('player'), 'upgrade'));
$('#upgrade-tech').addEventListener('click', () => action(() => battle.researchTech('player'), 'upgrade'));
$('#roar').addEventListener('click', () => action(() => battle.roar('player'), 'roar'));
$('#pause').addEventListener('click', () => { battle.togglePause(); render(true); });
$('#speed').addEventListener('click', () => { speed = speed === 1 ? 2 : 1; scene.speed = speed; $('#speed').textContent = `${speed}×`; $('#speed').setAttribute('aria-label', `游戏速度 ${speed} 倍`); });
$('#sound').addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  if (audio.enabled) { audio.unlock(); audio.play('tap'); }
  $('#sound').innerHTML = audio.enabled ? icons.sound : icons.mute;
  $('#sound').setAttribute('aria-pressed', String(audio.enabled));
  $('#sound').setAttribute('aria-label', audio.enabled ? '关闭音效' : '开启音效');
  $('#sound').title = `${audio.enabled ? '关闭' : '开启'}音效（M）`;
});
$('#help').addEventListener('click', () => { guideWasPlaying = battle.phase === 'playing'; if (guideWasPlaying) battle.togglePause(); guide.showModal(); render(true); });
const closeGuide = () => guide.close();
$('.dialog-close').addEventListener('click', closeGuide);
$('#guide-close').addEventListener('click', closeGuide);
guide.addEventListener('close', () => { if (guideWasPlaying && battle.phase === 'paused') battle.togglePause(); guideWasPlaying = false; render(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { guideWasPlaying = false; if (battle.phase === 'playing') { battle.togglePause(); render(true); } } });
window.addEventListener('keydown', event => {
  if (guide.open || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))) return;
  const key = event.key.toLowerCase();
  if (key === 'm') { $('#sound').click(); return; }
  if (screen !== 'battle') { if (key === 'escape' && screen === 'levels') navigate('home'); return; }
  if (/^[1-6]$/.test(key)) { event.preventDefault(); action(() => battle.summon('player', UNIT_ORDER[Number(key) - 1]), 'hire'); }
  if (key === 'p' || key === 'escape') { event.preventDefault(); battle.togglePause(); render(true); }
  if (event.code === 'Space' && battle.phase === 'playing') { event.preventDefault(); action(() => battle.roar('player'), 'roar'); }
  if (key === 'e') action(() => battle.upgradeEconomy('player'), 'upgrade');
  if (key === 't') action(() => battle.researchTech('player'), 'upgrade');
  if (key === 'f') { if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {}); else void document.documentElement.requestFullscreen?.().catch(() => {}); }
});

function navigate(next: Screen) {
  screen = next;
  document.documentElement.dataset.screen = next;
  $('#home-screen').hidden = next !== 'home';
  $('#level-screen').hidden = next !== 'levels';
  $('#battle-screen').hidden = next !== 'battle';
  if (next === 'levels') updateLevelSelection(selectedLevelId, progress);
  window.dispatchEvent(new Event('resize'));
  render(true);
  if (next !== 'battle') $(next === 'home' ? '#home-title' : '#levels-title').focus({ preventScroll: true });
}
function begin(levelId = selectedLevelId) {
  audio.unlock(); battle.reset(levelId); battle.start(); selectedLevelId = battle.level.id;
  endSoundPlayed = false; previousPhase = ''; speed = 1; scene.speed = 1;
  $('#speed').textContent = '1×'; $('#speed').setAttribute('aria-label', '游戏速度 1 倍');
  $('#battle-chapter').textContent = `CHAPTER 0${LEVELS.indexOf(battle.level) + 1} · ${battle.level.name}`;
  updateMarkup('#battle-difficulty', `<i></i> 人机对战 · ${battle.level.difficulty}`);
  navigate('battle'); $('#pause').focus({ preventScroll: true });
}
function restart() { begin(battle.level.id); }
function leaveBattle(next: 'home' | 'levels') { battle.reset(); previousPhase = ''; navigate(next); }
function saveVictory() {
  const stars = battle.armies.player.hp >= BASE_HP * .7 ? 3 : battle.armies.player.hp >= BASE_HP * .35 ? 2 : 1;
  const old = progress[battle.level.id];
  progress[battle.level.id] = { stars: Math.max(old?.stars ?? 0, stars), bestTime: Math.min(old?.bestTime ?? Infinity, battle.time) };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* The campaign remains playable without persistence. */ }
}
$('#start').addEventListener('click', () => begin());
$('#choose-level').addEventListener('click', () => navigate('levels'));
$('#levels-back').addEventListener('click', () => navigate('home'));
$('#level-start').addEventListener('click', () => begin());
$('#home-guide').addEventListener('click', () => $('#help').click());
for (const level of LEVELS) $(`#level-${level.id}`).addEventListener('click', () => { selectedLevelId = level.id; updateLevelSelection(selectedLevelId, progress); });
$('.brand').addEventListener('click', event => { event.preventDefault(); if (screen === 'battle') { if (battle.phase === 'playing') battle.togglePause(); render(true); } else navigate('home'); });
function overlay() {
  const target = $('#battle-overlay');
  target.classList.toggle('hidden', battle.phase === 'playing');
  if (battle.phase === 'ready') {
    target.innerHTML = '';
  } else if (battle.phase === 'paused') {
    target.innerHTML = `<div class="intro-card pause-card"><span class="intro-eyebrow">TAKE A LITTLE CATNAP</span><h2>猫咪打个小盹。</h2><p>战场已暂停，猫粮和研究也会等你。</p><button class="primary-button" id="resume">继续保护冻干 ${icons.play}</button><button class="subtle-button" id="restart">重新开始这一局</button><div class="pause-navigation"><button class="menu-secondary" id="pause-levels">返回选关</button><button class="menu-secondary" id="pause-home">返回首页</button></div></div>`;
    $('#resume').addEventListener('click', () => { battle.togglePause(); render(true); });
    $('#restart').addEventListener('click', restart);
    $('#pause-levels').addEventListener('click', () => leaveBattle('levels'));
    $('#pause-home').addEventListener('click', () => leaveBattle('home'));
  } else if (battle.phase === 'ended') {
    const won = battle.winner === 'player', draw = battle.winner === 'draw';
    if (won && !endSoundPlayed) saveVictory();
    const nextLevel = LEVELS[LEVELS.indexOf(battle.level) + 1];
    target.innerHTML = `<div class="intro-card result-card"><span class="result-paw">${paw}</span><span class="intro-eyebrow">${draw ? 'WHAT A CLOSE MATCH' : won ? 'A PURRFECT VICTORY' : 'EVERY CAT GETS ANOTHER CHANCE'}</span><h2>${draw ? '势均力敌，冻干平分！' : won ? '冻干守住啦！' : '冻干被抢走啦…'}</h2><p>${draw ? '两座基地同时倒下，下次再分胜负。' : won ? '今天的小队，每只都值得加餐。' : '下次试试让盾卫保护投手，再找机会升级经济。'}</p><div class="result-stats"><span><b>${clock(battle.time)}</b>战斗时长</span><span><b>${battle.armies.player.hired}</b>招募伙伴</span><span><b>${Math.ceil(battle.armies.player.hp)}</b>剩余耐久</span></div><div class="result-actions"><button class="primary-button" id="play-again">再来一局 ${icons.play}</button>${won && nextLevel ? '<button class="menu-secondary" id="next-level">挑战下一关 →</button>' : ''}</div><button class="subtle-button" id="result-levels">返回关卡选择</button></div>`;
    $('#play-again').addEventListener('click', restart);
    $('#result-levels').addEventListener('click', () => leaveBattle('levels'));
    if (won && nextLevel) $('#next-level').addEventListener('click', () => begin(nextLevel.id));
    if (!endSoundPlayed) { audio.play(won ? 'win' : 'lose'); endSoundPlayed = true; }
  } else target.innerHTML = '';
}

function render(force = false) {
  const now = performance.now();
  if (!force && now - lastHUD < 90 && previousPhase === battle.phase) return;
  lastHUD = now;
  const army = battle.armies.player, enemy = battle.armies.enemy;
  const compact = document.documentElement.dataset.layout !== 'desktop';
  $('.guide-lead').textContent = document.documentElement.dataset.layout === 'portrait'
    ? '下方是你的家，上方是馋嘴对手。猫咪向中央推进，让对手的基地耐久降到零，就赢啦！'
    : '左边是你的家，右边是馋嘴对手。让对手的基地耐久降到零，就赢啦！';
  $('#food').textContent = Math.floor(army.food).toLocaleString('zh-CN');
  $('#reinforcement-status').textContent = battle.time < battle.level.grace ? `首波敌人 ${Math.ceil(battle.level.grace - battle.time)} 秒后出发` : '敌方持续增援中';
  const cannonDamage = CANNON_DAMAGE[army.tech - 1];
  $('#cannon-status').textContent = `主炮 Lv.${army.tech} · ${cannonDamage} 伤害 · 自动防守`;
  $('#compact-cannon').textContent = `主炮 ${cannonDamage} · 自动防守`;
  $('#income').textContent = `+${FOOD_RATES[army.economy]} / 秒`;
  $('#timer').textContent = clock(battle.time);
  $('#population').textContent = `${battle.population('player')} / ${MAX_POPULATION}`;
  for (const [side, state] of [['player', army], ['enemy', enemy]] as const) {
    updateMarkup(`#${side}-hp`, `${Math.ceil(state.hp)} <small>/ ${BASE_HP}</small>`);
    $(`#${side}-health`).style.width = `${state.hp / BASE_HP * 100}%`;
    $(`#compact-${side}-hp`).textContent = String(Math.ceil(state.hp));
    $(`#compact-${side}-health`).style.width = `${state.hp / BASE_HP * 100}%`;
  }
  for (const kind of UNIT_ORDER) {
    const card = $<HTMLButtonElement>(`#hire-${kind}`), spec = UNITS[kind];
    const reason = battle.summonReason('player', kind), locked = army.tech < spec.tier;
    card.disabled = Boolean(reason);
    card.classList.toggle('locked', locked);
    card.classList.toggle('available', !reason);
    card.querySelector('.unit-state')!.textContent = locked ? `⌑ ${spec.tier === 2 ? '二' : '三'}阶解锁` : (reason === '猫粮不足' ? `等 ${Math.ceil((spec.cost - army.food) / FOOD_RATES[army.economy])}s` : reason) || '出兵 +' ;
    (card.querySelector('.cooldown-track') as HTMLElement).style.width = `${army.cooldowns[kind] / spec.cooldown * 100}%`;
    card.title = `${spec.description}${reason ? `（${reason}）` : ''}`;
  }
  const econCost = ECONOMY_COSTS[army.economy];
  $('#economy-title').textContent = '产能升级';
  $('#tech-title').textContent = '科技研究';
  $('#economy-level').textContent = `Lv.${army.economy + 1}`;
  $('#economy-description').textContent = econCost === undefined ? (compact ? '产量已满级' : '满级投喂机，猫粮源源不断！') : compact ? `${FOOD_RATES[army.economy]} → ${FOOD_RATES[army.economy + 1]} / 秒` : `产量 ${FOOD_RATES[army.economy]} → ${FOOD_RATES[army.economy + 1]} 猫粮 / 秒`;
  updateMarkup('#economy-action', econCost === undefined ? '<b>MAX</b><span>已满级</span>' : `${food}${econCost}<span>${army.food < econCost ? '猫粮不足' : '升级 ↑'}</span>`);
  $<HTMLButtonElement>('#upgrade-economy').disabled = battle.phase !== 'playing' || econCost === undefined || army.food < econCost;
  $('#tech-level').textContent = `${['一', '二', '三'][army.tech - 1]}阶`;
  $('#tech-description').textContent = army.researching ? `研究中 · ${Math.ceil(army.research)} 秒` : army.tech < 3
    ? (compact ? `主炮 ${cannonDamage} → ${CANNON_DAMAGE[army.tech]}` : `${army.tech === 1 ? '解锁盾卫 / 投手' : '解锁投石机 / 奶妈'} · 主炮 ${cannonDamage} → ${CANNON_DAMAGE[army.tech]}`)
    : (compact ? `主炮 ${cannonDamage} · 满级` : `${TECH_NAMES[army.tech - 1]} · 主炮 ${cannonDamage} 伤害`);
  $('#upgrade-tech').title = army.tech < 3 ? `研究完成后解锁${army.tech === 1 ? '纸箱盾卫和毛球投手' : '猫咪投石机和奶妈猫'}，主炮伤害 ${cannonDamage} → ${CANNON_DAMAGE[army.tech]}` : '所有兵种与主炮科技已满级';
  updateMarkup('#tech-action', army.researching ? `<b>${Math.ceil(army.research)}s</b><span>研究中…</span>` : army.tech === 3 ? '<b>MAX</b><span>已满级</span>' : `${food}${TECH_COSTS[army.tech - 1]}<span>${army.food < TECH_COSTS[army.tech - 1] ? '猫粮不足' : '研究 ↑'}</span>`);
  $<HTMLButtonElement>('#upgrade-tech').disabled = battle.phase !== 'playing' || army.researching || army.tech === 3 || army.food < TECH_COSTS[army.tech - 1];
  $('#research-progress').style.width = army.researching ? `${(1 - army.research / TECH_TIMES[army.tech - 1]) * 100}%` : '0';
  $<HTMLButtonElement>('#roar').disabled = battle.phase !== 'playing' || army.roarCooldown > 0;
  updateMarkup('#roar-action', army.roarCooldown > 0 ? `<b>${Math.ceil(army.roarCooldown)}s</b><span>休息一下</span>` : '<b>喵！</b><span>技能就绪</span>');
  $<HTMLButtonElement>('#pause').disabled = battle.phase === 'ready' || battle.phase === 'ended';
  updateMarkup('#pause', battle.phase === 'paused' ? `${icons.play}<span>继续</span>` : `${icons.pause}<span>暂停</span>`);
  $('#pause').setAttribute('aria-label', battle.phase === 'paused' ? '继续' : '暂停');
  const fieldMessage = battle.phase === 'playing' && battle.time > battle.messageUntil
    ? (battle.time < battle.level.grace ? '准备阶段：升级产能，招募伙伴，主炮会自动守护小窝。' : '敌方会持续增援。稳住前线，发展科技，再向冻干仓库推进！')
    : battle.message;
  if (previousMessage !== fieldMessage) { $('#field-message').textContent = fieldMessage; previousMessage = fieldMessage; }
  if (previousPhase !== battle.phase) { overlay(); previousPhase = battle.phase; }
  document.documentElement.dataset.phase = battle.phase;
  if (reducedMotion) document.documentElement.classList.add('reduce-motion');
}
navigate('home');

// Development-only hook for deterministic browser acceptance checks, excluded from production.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
  Object.assign(window, { __catGame: { battle, render: () => render(true), getView: () => scene.getViewportSnapshot(), getScreen: () => screen, advance: (seconds: number) => { for (let i = 0; i < seconds * 30 && battle.phase === 'playing'; i++) battle.step(1 / 30); render(true); } } });
}

// Read-only gameplay state and deterministic stepping for browser playtests.
Object.assign(window, {
  render_game_to_text: () => JSON.stringify({ screen, phase: battle.phase, level: battle.level.id, selectedLevel: selectedLevelId, time: +battle.time.toFixed(2), winner: battle.winner,
    coordinates: 'World x increases left to right (155 player, 1285 enemy); portrait maps progress bottom to top.',
    player: { ...battle.armies.player, population: battle.population('player'), income: FOOD_RATES[battle.armies.player.economy] },
    enemy: { hp: battle.armies.enemy.hp, tech: battle.armies.enemy.tech, hired: battle.armies.enemy.hired, population: battle.population('enemy') },
    cannon: { damage: CANNON_DAMAGE[battle.armies.player.tech - 1], range: CANNON_RANGE, interval: CANNON_INTERVAL },
    reinforcement: { initialDelayRemaining: Math.max(0, battle.level.grace - battle.time), continuous: true },
    units: battle.units.map(({ id, kind, side, x, hp }) => ({ id, kind, side, x: +x.toFixed(1), hp })),
  }),
});
if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
  Object.assign(window, { advanceTime: (ms: number) => { scene.manualTime = true; scene.advanceSimulation(Math.max(0, Math.min(ms, 600000)) / 1000); render(true); } });
}
