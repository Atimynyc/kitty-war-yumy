import './style.css';
import './responsive.css';
import './experience.css';
import './base-cats.css';
import './spells.css';
import './recruitment.css';
import './boss.css';
import './campaign.css';
import './enemy-faction.css';
import './achievements.css';
import './characters.css';
import './cat-editor.css';
import { ENEMY_FACTION, ENEMY_UNITS, unitIdentity } from './game/enemy-roster.ts';
import { installViewport } from './ui/viewport.ts';
import { icons, paw, svgURL, unitSVG, unitPortraitSVG } from './art.ts';
import { BASE_HP, CANNON_DAMAGE, CANNON_INTERVAL, CANNON_RANGE, ECONOMY_COSTS, FOOD_RATES, MAX_POPULATION, TECH_COSTS, TECH_TIMES, UNIT_ORDER, ENEMY_ORDER, UNITS, ENERGY, ENERGY_REWARDS, TREAT, BOMBARD, CATNIP } from './game/content.ts';
import type { UnitKind } from './game/content.ts';
import { CHAPTERS, LEVELS, readProgress, serializeProgress, victoryStars, recordVictory, isLevelUnlocked, recommendedLevel, levelNumber, enemyPlan, reinforcementPhase } from './game/levels.ts';
import type { CampaignProgress } from './game/levels.ts';
import { menuMarkup, updateLevelSelection, updateHomeProgress } from './ui/menus.ts';
import { Battle } from './game/simulation.ts';
import { createGame } from './game/BattleScene.ts';
import { BASE_NAMES, FEEDER_NAMES } from './game/base-art.ts';
import { GameAudio } from './game/audio.ts';
import { installBaseCatDialogue } from './ui/base-cat-dialogue.ts';
import { breedLabel, copyCat } from './game/cat-appearance.ts';
import { baseCatSVG } from './game/base-cat-art.ts';
import { catEditorMarkup, installCatEditor } from './ui/cat-editor.ts';
import { installSpellControls, spellControlsMarkup } from './ui/spell-controls.ts';
import { spellNoticeText } from './game/spell-notices.ts';
import { bossStatusMarkup, installBossStatus } from './ui/boss-status.ts';
import { createProgressStore } from './ui/platform.ts';
import { emptyProfile, readProfile, serializeProfile } from './game/profile.ts';
import { ACHIEVEMENTS, TITLES, emptyRunStats, absorbRun, awardVictory, clone, unlockAchievements, equippedTitle } from './game/achievements.ts';
import { achievementsMarkup, renderAchievements, resultAchievements } from './ui/achievements.ts';
import { createSaveCoordinator } from './ui/save-coordinator.ts';
import { unlockedUnits, unlockStage, arrivalsAtStage, arrivalText, UNIT_LESSONS } from './game/unit-unlocks.ts';
import { characterCatalogMarkup, installCharacterCatalog } from './ui/character-catalog.ts';

installViewport();
const battle = new Battle();
battle.reset('campaign-01',unlockedUnits({}));
const audio = new GameAudio();
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
const food = `<span class="inline-icon">${icons.food}</span>`;
$('#app').innerHTML = `
  <div class="game-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="猫咪冻干保卫战首页"><span class="brand-mark">${paw}</span><span><span class="brand-name">猫咪冻干保卫战<span class="version">试玩版 0.23</span></span><span class="brand-en">PAW & PANTRY <span>一场为了冻干的可爱战争</span></span></span></a>
      <nav class="toolbar" aria-label="游戏设置"><button class="icon-button" id="sound" title="开启音效（M）" aria-label="开启音效" aria-pressed="false">${icons.mute}</button><button class="text-button" id="help" aria-label="玩法指南"><span class="help-symbol">?</span><span>玩法指南</span></button><span class="toolbar-divider"></span><button class="text-button" id="pause" aria-label="暂停" disabled>${icons.pause}<span>暂停</span></button></nav>
    </header>
    <p id="profile-notice" class="profile-notice" role="status" hidden></p>
    ${menuMarkup()}${achievementsMarkup()}${characterCatalogMarkup()}${catEditorMarkup()}
    <main id="battle-screen" hidden>
      <section class="battle-heading"><div><span class="eyebrow" id="battle-chapter">CHAPTER 01 · 阳光客厅</span><h1>今天的冻干，由我们守护<span>！</span></h1></div><span class="mode-badge" id="battle-difficulty"><i></i> 人机对战 · 入门</span></section>
      <section class="status-bar" aria-label="对战状态">
        <div class="base-status friendly"><span class="team-avatar">${paw}</span><div class="base-info"><div class="base-title"><span>我方冻干仓库</span><strong id="player-hp">3000 <small>/ 3000</small></strong></div><div class="health-track"><span id="player-health"></span></div></div></div>
        <div class="resource-status"><span class="food-medal">${icons.food}</span><div><span class="resource-label">储备猫粮</span><div class="food-numbers"><strong id="food">240</strong><span id="income">+12 / 秒</span></div></div></div>
        <div class="time-status"><span class="resource-label">对战时间</span><strong id="timer">00:00</strong><button id="speed" title="切换游戏速度" aria-label="游戏速度 1 倍">1×</button></div>
        <div class="base-status rival"><div class="base-info"><div class="base-title"><span>胖橘搜粮团</span><strong id="enemy-hp">3000 <small>/ 3000</small></strong></div><div class="health-track"><span id="enemy-health"></span></div></div><span class="team-avatar">${paw}</span></div>
      </section>
      <section class="arena-frame" aria-label="战场">
        <div id="battle-canvas"></div><div id="loading">猫咪们正在整理装备…</div>
        <div class="arena-badge"><span class="sun-icon">☀</span><span id="reinforcement-status">准备迎接第一波</span></div>
        <div class="arena-population">${icons.people} 小队 <strong id="population">0 / 24</strong></div>
        <div class="arena-base-label enemy-label"><span>搜粮团 <strong id="compact-enemy-hp">3000</strong></span><div class="health-track"><span id="compact-enemy-health"></span></div><small id="compact-enemy-base">一阶 · 纸箱营地</small></div>
        <div class="arena-base-label player-label"><span>我方冻干 <strong id="compact-player-hp">3000</strong></span><div class="health-track"><span id="compact-player-health"></span></div><small id="compact-cannon">主炮 32 · 自动防守</small></div>
        <p id="enemy-cat-speech" class="base-cat-speech" role="status" aria-label="大胖橘说" aria-live="polite" aria-atomic="true" hidden></p>${bossStatusMarkup}
        ${spellControlsMarkup}
        <div id="battle-overlay" class="battle-overlay"></div>
      </section>
      <div class="field-note"><span class="note-paw">${paw}</span><p id="field-message" role="status" aria-live="polite">冻干已就位，小队等你出发。</p><span class="auto-note" id="cannon-status"><i></i> 主炮 32 伤害 · 自动防守</span></div>
      <section class="recruit-section" aria-labelledby="recruit-title"><div class="recruit-heading"><h2 id="recruit-title">全部 ${UNIT_ORDER.length} 种伙伴</h2><span>上下滑动 · 点击招募</span></div>
        <div class="unit-grid" tabindex="0" role="region" aria-label="全部兵种，滚动查看更多">${UNIT_ORDER.map(kind => { const spec = UNITS[kind]; return `<button class="unit-card" id="hire-${kind}" data-kind="${kind}" style="--unit-bg:${spec.color}" aria-label="招募${spec.name}，${spec.cost}猫粮" title="${spec.name}：${spec.description}"><img class="recruit-portrait" src="${svgURL(unitPortraitSVG(kind))}" alt="" draggable="false" /><span class="unit-cost" aria-hidden="true">${spec.cost}</span><span class="recruit-name" aria-hidden="true">${spec.short}</span><span class="unit-lock" aria-hidden="true" hidden></span><span class="unit-new" aria-hidden="true" hidden>新</span><span class="cooldown-track" aria-hidden="true"></span></button>`; }).join('')}</div>
      </section>
      <section class="upgrade-grid" aria-label="基地升级">
        <button class="upgrade-card economy-card" id="upgrade-economy"><span class="upgrade-symbol">${icons.food}</span><span class="upgrade-info"><strong><b id="economy-title">产能升级</b> <span id="economy-level">Lv.1/8</span></strong><small id="economy-description">${FOOD_RATES[0]} → ${FOOD_RATES[1]} / 秒</small></span><span class="upgrade-action" id="economy-action">${food}${ECONOMY_COSTS[0]}<span>升级 ↑</span></span></button>
        <button class="upgrade-card tech-card" id="upgrade-tech"><span class="upgrade-symbol">${icons.flask}</span><span class="upgrade-info"><strong><b id="tech-title">科技研究</b> <span id="tech-level">一阶</span></strong><small id="tech-description">解锁盾卫、投手和法师</small></span><span class="upgrade-action" id="tech-action">${food}180<span>研究 ↑</span></span><span id="research-progress"></span></button>
      </section>
    </main>
    <footer><span>${paw} 每一粒冻干，都值得全力以赴。</span><span>招募 <kbd>1</kbd>—<kbd>8</kbd><i>·</i> 升级 <kbd>E</kbd> / <kbd>T</kbd><i>·</i> 暂停 <kbd>P</kbd></span></footer>
  </div>
  <dialog id="guide" aria-labelledby="guide-title"><button class="dialog-close" aria-label="关闭玩法指南">×</button><span class="eyebrow">THE LITTLE FIELD GUIDE</span><h2 id="guide-title">冻干保卫战，开课啦。</h2><p class="guide-lead">下方是你的家，上方是胖橘搜粮团。让对手的基地耐久降到零，就赢啦！</p><div class="guide-steps"><p><b>01</b><span><strong>收猫粮，招募小队</strong>投喂机自动生产猫粮。伙伴随关卡永久解锁，到达该关即可获得；局内研究到对应科技后才能招募。重玩旧关保留已获得的伙伴。上下滑动查看全部 16 种兵种，无需预选编队；点击卡片招募，伙伴会自己前进和战斗，每方最多 24 人口。</span></p><p><b>02</b><span><strong>稳住前线，再做投资</strong>投喂机共 8 档，可升级 7 次，从每秒 12 提升到 42 猫粮；越往后回本越慢，先留够补兵费用。研究科技解锁新伙伴、强化主炮，并在研究完成后将纸箱营地升级为加固猫屋、冻干要塞。产能升级会改变侧边投喂器；研究期间照样可以出兵。</span></p><p><b>03</b><span><strong>搭配阵容，抓准时机</strong>盾卫扛伤、法师迟缓、玩具大炮范围轰击、奶妈治疗；三阶可攒粮召唤高攻高血的小狗骑士。右侧三个主动技能共用能量：急救罐头（35）为在场受伤伙伴恢复30%最大生命，每只最多240，不修复基地；猫薄荷（40）让在场伙伴攻击力 +20%，持续10秒，新出兵无加成，治疗量和主炮不变；毛球轰炸（70）自动锁定最密集敌群，0.65秒后对半径140内敌人造成180/240/300伤害（随科技升级），不伤友军和基地，远程防护和闪避有效。开局50、上限100，击杀回能，无被动回复；空放不扣能量。快捷键 H 急救、C 猫薄荷、空格轰炸。蓝紫星环表示迟缓，绿叶表示增伤。</span></p></div><div class="guide-units">${UNIT_ORDER.map(kind => `<p><img src="${svgURL(unitSVG(kind))}" alt=""/><span><strong>${UNITS[kind].name} · 第 ${unlockStage(kind)} 关加入</strong>${UNITS[kind].description}</span></p>`).join('')}</div><details class="enemy-guide"><summary>认识对手 · ${ENEMY_FACTION}</summary><p>红围巾、厨房装备和零食包装，是这群馋嘴橘猫的标记。看清武器，就能判断它们的职责。</p><div class="guide-units">${ENEMY_ORDER.map(kind => `<p><img src="${svgURL(unitSVG(kind, 'enemy'))}" alt=""/><span><strong>${ENEMY_UNITS[kind].name} · ${ENEMY_UNITS[kind].role}</strong>${ENEMY_UNITS[kind].description}</span></p>`).join('')}</div></details><p class="guide-fair">击杀敌军回能：侦察车 2，饼干棒打手 4，弹弓手 5，锅盖卫兵／干扰师／补给员各 6，投射车 8，小猪重骑 20，胖橘首领 50。主炮击杀也回能；无目标时不会扣能量。最后一关敌方基地低于 30% 时，大胖橘会亲自上场，慢慢举起巨爪、停顿后快速横扫并击退前排。双方开局 240 猫粮、每秒产粮 12。电脑按关卡节奏交替增援与整备，同样消耗猫粮和人口。战场上方显示倒计时；整备期间只暂停敌军招募，场上敌人继续战斗，双方照常产粮与研究。把握窗口推进或升级，也要为下一轮增援留好前排。双方主炮自动攻击附近敌人，科技升级将伤害从 32 提升到 55 / 85。切换标签页会自动暂停。每两秒自动保存战场；暂停菜单可保存并返回，首页继续未完对局，恢复后点击继续。成就、称号和关卡成绩保存在当前设备，清理缓存可能丢失。</p><button class="primary-button" id="guide-close">记住了，保护冻干！ ${icons.play}</button></dialog>
`;

type Screen = 'home' | 'levels' | 'battle' | 'achievements' | 'characters' | 'cat';
let screen: Screen = 'home';
const qaMode = import.meta.env.DEV && new URLSearchParams(location.search).has('qa');
const SAVE_KEY = qaMode ? 'paw-pantry-progress-qa-v3' : 'paw-pantry-progress-v1';
let profile = emptyProfile();
let progress: CampaignProgress = profile.progress;
const progressStore = createProgressStore(SAVE_KEY);
let writableProfile = true;
let attachedRun = false, trackedRevision = -1, appliedStats = emptyRunStats(), roundAwards: string[] = [];
let roundUnlocks: UnitKind[] = [];
let needsSave = false, achievementNotice = '', achievementNoticeUntil = 0;
let achievementsReturn: Screen = 'home';
let charactersReturn: 'home' | 'battle' = 'home';
let catReturn: 'home' | 'battle' = 'home';
let profileLoadNotice = '';
const saver = createSaveCoordinator(progressStore, state => {
  const notice = $('#profile-notice'); notice.dataset.state = state === 'failed' ? state : profileLoadNotice ? 'load' : state;
  notice.textContent = state === 'failed' ? '本次进度暂未保存，关闭后可能丢失。请保留当前页面。' : profileLoadNotice || (state === 'saving' ? '正在保存…' : '进度已保存');
  notice.hidden = state !== 'failed' && !profileLoadNotice;
});
function acknowledgeProfileNotice() {
  if (!writableProfile || !progressStore.canWrite()) return;
  profileLoadNotice = '';
  if ($('#profile-notice').dataset.state === 'load') $('#profile-notice').hidden = true;
}
let progressReady = false;
let selectedLevelId = recommendedLevel(progress).id;
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
const renderBaseCatDialogue = installBaseCatDialogue(battle);
const renderBossStatus = installBossStatus(battle);
const renderSpellControls = installSpellControls(battle);
const { scene } = createGame('battle-canvas', battle, render);
const guide = $('#guide') as HTMLDialogElement;
const characterCatalog=installCharacterCatalog({getOwned:()=>unlockedUnits(progress,profile.legacyRecruits),close:closeCharacters});
const catEditor=installCatEditor({get:()=>profile.cat,canSave:()=>writableProfile&&progressStore.canWrite(),close:closeCat,
  async save(cat){
    await scene.setPlayerAppearance(cat);
    profile.cat=copyCat(cat);
    updateProfileHome();
    return (await saveProfile()) ?? false;
  },
});

function action(callback: () => boolean, sound: 'hire' | 'upgrade' | 'bombard' | 'treat' | 'catnip') {
  if (callback()) audio.play(sound);
  render(true); saveProfile();
}
for (const kind of UNIT_ORDER) $(`#hire-${kind}`).addEventListener('click', () => action(() => battle.summon('player', kind), 'hire'));
$('#upgrade-economy').addEventListener('click', () => action(() => battle.upgradeEconomy('player'), 'upgrade'));
$('#upgrade-tech').addEventListener('click', () => action(() => battle.researchTech('player'), 'upgrade'));
$('#bombard').addEventListener('click', () => action(() => battle.bombard('player'), 'bombard'));
$('#treat').addEventListener('click', () => action(() => battle.treat('player'), 'treat'));
$('#catnip').addEventListener('click', () => action(() => battle.catnip('player'), 'catnip'));
$('#pause').addEventListener('click', () => { battle.togglePause(); render(true); saveProfile(); });
$('#speed').addEventListener('click', () => { speed = speed === 1 ? 2 : 1; scene.speed = speed; $('#speed').textContent = `${speed}×`; $('#speed').setAttribute('aria-label', `游戏速度 ${speed} 倍`); });
$('#sound').addEventListener('click', () => {
  audio.enabled = !audio.enabled;
  if (audio.enabled) { audio.unlock(); audio.play('tap'); }
  $('#sound').innerHTML = audio.enabled ? icons.sound : icons.mute;
  $('#sound').setAttribute('aria-pressed', String(audio.enabled));
  $('#sound').setAttribute('aria-label', audio.enabled ? '关闭音效' : '开启音效');
  $('#sound').title = `${audio.enabled ? '关闭' : '开启'}音效（M）`;
});
$('#help').addEventListener('click', () => { guideWasPlaying = battle.phase === 'playing'; if (guideWasPlaying) battle.togglePause(); guide.showModal(); render(true); saveProfile(); });
const closeGuide = () => guide.close();
$('.dialog-close').addEventListener('click', closeGuide);
$('#guide-close').addEventListener('click', closeGuide);
guide.addEventListener('close', () => { if (guideWasPlaying && battle.phase === 'paused') battle.togglePause(); guideWasPlaying = false; render(true); saveProfile(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { guideWasPlaying = false; if (battle.phase === 'playing') { battle.togglePause(); render(true); } saveProfile(); } });
window.addEventListener('pagehide', () => { if (battle.phase === 'playing') battle.togglePause(); saveProfile(); });
setInterval(() => { if (attachedRun && battle.phase === 'playing') saveProfile(); }, 2000);
window.addEventListener('keydown', event => {
  if (guide.open || $('#replace-run').hasAttribute('open') || $('#cat-discard').hasAttribute('open') || event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))) return;
  const key = event.key.toLowerCase();
  if (key === 'm') { $('#sound').click(); return; }
  if (screen !== 'battle') { if (key === 'escape' && screen === 'cat') {event.preventDefault();catEditor.back();} if (key === 'escape' && screen === 'levels') navigate('home'); if (key === 'escape' && screen === 'achievements') $('#achievements-back').click(); if (key === 'escape' && screen === 'characters') { event.preventDefault(); characterCatalog.back(); } return; }
  const digit = /^Digit([1-8])$/.exec(event.code);
  if (digit) { event.preventDefault(); action(() => battle.summon('player', UNIT_ORDER[Number(digit[1]) - 1 + (event.shiftKey ? 8 : 0)]), 'hire'); }
  if (key === 'p' || key === 'escape') { event.preventDefault(); battle.togglePause(); render(true); saveProfile(); }
  if (event.code === 'Space' && battle.phase === 'playing') { event.preventDefault(); action(() => battle.bombard('player'), 'bombard'); }
  if (key === 'h') action(() => battle.treat('player'), 'treat');
  if (key === 'c') action(() => battle.catnip('player'), 'catnip');
  if (key === 'e') action(() => battle.upgradeEconomy('player'), 'upgrade');
  if (key === 't') action(() => battle.researchTech('player'), 'upgrade');
});

function navigate(next: Screen) {
  if(screen==='cat'&&next!=='cat')catEditor.stop();
  screen = next;
  document.documentElement.dataset.screen = next;
  $('#home-screen').hidden = next !== 'home';
  $('#level-screen').hidden = next !== 'levels';
  $('#battle-screen').hidden = next !== 'battle';
  $('#achievement-screen').hidden = next !== 'achievements';
  $('#character-screen').hidden = next !== 'characters';
  $('#cat-editor').hidden = next !== 'cat';
  if (next === 'levels') refreshSelection();
  if (next === 'home') updateProfileHome();
  if (next === 'achievements') renderAchievements(profile.achievements, progress);
  window.dispatchEvent(new Event('resize'));
  render(true);
  if (next !== 'battle') $(next === 'home' ? '#home-title' : next === 'levels' ? '#levels-title' : next === 'characters' ? '#catalog-title' : next === 'cat' ? '#cat-editor-title' : '#achievement-title').focus({ preventScroll: true });
}
function begin(levelId = selectedLevelId, replacing = false) {
  if (!progressReady || !isLevelUnlocked(levelId, progress)) return;
  if (profile.run && !replacing) { requestNewBattle(levelId); return; }
  acknowledgeProfileNotice();
  syncRun();
  audio.unlock(); battle.reset(levelId, unlockedUnits(progress,profile.legacyRecruits)); battle.start(); selectedLevelId = battle.level.id;
  const lesson=arrivalText(battle.level.stage??0);
  if(lesson&&!progress[levelId]) battle.notify(`新伙伴加入！${lesson}`);
  attachedRun = true; trackedRevision = battle.revision; appliedStats = emptyRunStats(); roundAwards = [];
  roundUnlocks=[];
  endSoundPlayed = false; previousPhase = ''; speed = 1; scene.speed = 1;
  $('#speed').textContent = '1×'; $('#speed').setAttribute('aria-label', '游戏速度 1 倍');
  $('#battle-chapter').textContent = `${CHAPTERS[battle.level.chapter! - 1].name} · 第 ${levelNumber(battle.level)} 关 ${battle.level.name}`;
  updateMarkup('#battle-difficulty', `<i></i> 人机对战 · ${battle.level.difficulty}`);
  navigate('battle'); saveProfile(); $('#pause').focus({ preventScroll: true });
}
function restart() { begin(battle.level.id, true); }
function leaveBattle(next: 'home' | 'levels') {
  if (battle.phase === 'playing') battle.togglePause(); saveProfile(); attachedRun = false;
  battle.reset(); previousPhase = ''; navigate(next);
}
function syncRun() {
  if (!attachedRun) return;
  if (trackedRevision !== battle.revision) { trackedRevision = battle.revision; appliedStats = emptyRunStats(); roundAwards = []; }
  absorbRun(profile.achievements, battle.stats, appliedStats); appliedStats = clone(battle.stats);
  if(battle.legacyRoster) profile.legacyRecruits=UNIT_ORDER.filter(k=>profile.legacyRecruits.includes(k)||battle.stats.recruited.includes(k));
  if (battle.phase === 'ended') {
    if (battle.winner === 'player') {
      const before=unlockedUnits(progress,profile.legacyRecruits);
      recordVictory(progress,battle.level,battle.armies.player.hp,battle.time);
      roundUnlocks=unlockedUnits(progress,profile.legacyRecruits).filter(kind=>!before.includes(kind));
      awardVictory(profile.achievements,battle.stats,battle.level.stage ?? 0);
    }
    profile.run = null; attachedRun = false; needsSave = true;
  }
  const awards = unlockAchievements(profile.achievements, progress);
  if (awards.length) {
    roundAwards.push(...awards); needsSave = true;
    achievementNotice = awards.length > 1 ? `获得 ${awards.length} 项成就，已收入荣誉柜` : `获得成就：${ACHIEVEMENTS.find(a=>a.id===awards[0])!.name}`;
    achievementNoticeUntil = battle.time + 2;
  }
}
function saveProfile() {
  if (!progressReady) return;
  syncRun();
  if (attachedRun && (battle.phase === 'playing' || battle.phase === 'paused')) profile.run = { battle:battle.save(), speed:speed as 1|2, awards:[...roundAwards] };
  if (writableProfile && progressStore.canWrite()) return saver.save(serializeProfile(profile));
  return Promise.resolve(false);
}
function updateProfileHome() {
  updateHomeProgress(progress);
  const catImage=$<HTMLImageElement>('#home-cat-preview'),catSource=svgURL(baseCatSVG(profile.cat));
  if(catImage.getAttribute('src')!==catSource)catImage.src=catSource;
  $('#home-cat-description').textContent=`${breedLabel(profile.cat)} · 换个喜欢的模样`;
  const count=Object.keys(profile.achievements.unlocked).length;
  $('#home-achievement-count').textContent=`${count}/24${profile.achievements.unseenIds.length?' · 新':''}`;
  $('#home-equipped-title').textContent=equippedTitle(profile.achievements);
  const run=profile.run;
  $('#resume-summary').hidden=!run; $('#new-battle').hidden=!run;
  if (run) { $('#start').textContent='继续未完对局 →'; $('#resume-summary').textContent=`第 ${levelNumber(LEVELS.find(l=>l.id===run.battle.levelId)!)} 关 · ${clock(run.battle.time)} · 恢复后先暂停，离线期间不推进`; }
}
function resumeRun() {
  const run=profile.run; if (!run || !battle.restore(run.battle)) return;
  acknowledgeProfileNotice();
  attachedRun=true; trackedRevision=battle.revision; appliedStats=clone(battle.stats); roundAwards=[...run.awards];
  roundUnlocks=[];
  selectedLevelId=battle.level.id; speed=run.speed; scene.speed=speed; previousPhase=''; endSoundPlayed=false;
  $('#speed').textContent=`${speed}×`; $('#speed').setAttribute('aria-label',`游戏速度 ${speed} 倍`);
  $('#battle-chapter').textContent=`${CHAPTERS[battle.level.chapter!-1].name} · 第 ${levelNumber(battle.level)} 关 ${battle.level.name}`;
  updateMarkup('#battle-difficulty',`<i></i> 人机对战 · ${battle.level.difficulty}`);
  navigate('battle'); $('#resume').focus({preventScroll:true});
}
function openAchievements() {
  achievementsReturn=screen;
  if (battle.phase==='playing') battle.togglePause(); saveProfile();
  profile.achievements.unseenIds=[]; navigate('achievements'); saveProfile();
}
function openCharacters() {
  charactersReturn=screen==='battle'?'battle':'home';
  if (battle.phase==='playing') battle.togglePause();
  saveProfile(); characterCatalog.open(charactersReturn==='battle'?'暂停菜单':'首页'); navigate('characters');
}
function closeCharacters() {
  previousPhase=''; navigate(charactersReturn);
  $(charactersReturn==='battle'?'#pause-characters':'#home-characters').focus({preventScroll:true});
}
function openCat() {
  if(!progressReady)return;
  catReturn=screen==='battle'?'battle':'home';
  if(battle.phase==='playing')battle.togglePause();
  saveProfile();catEditor.open(catReturn==='battle'?'暂停菜单':'首页');navigate('cat');
}
function closeCat() {
  previousPhase='';navigate(catReturn);
  $(catReturn==='battle'?'#pause-cat':'#home-cat').focus({preventScroll:true});
}
const replacement=document.createElement('dialog'); replacement.id='replace-run'; replacement.setAttribute('aria-labelledby','replace-title');
replacement.innerHTML='<h2 id="replace-title">开始新的守护？</h2><p>已有一局未结束。开始新对局会替换该战场存档，已获得的关卡成绩与成就保留。</p><div class="replace-actions"><button id="keep-run" class="primary-button">继续未完对局</button><button id="replace-confirm" class="menu-secondary">替换存档，开始新对局</button><button id="replace-cancel" class="subtle-button">取消</button></div>';
document.body.appendChild(replacement);
let replacementLevel='';
function requestNewBattle(id: string) { replacementLevel=id; replacement.showModal(); $('#replace-cancel').focus(); }
$('#replace-cancel').addEventListener('click',()=>replacement.close());
$('#replace-confirm').addEventListener('click',()=>{replacement.close(); begin(replacementLevel,true);});
$('#keep-run').addEventListener('click',()=>{replacement.close(); resumeRun();});
$('#start').addEventListener('click', () => profile.run ? resumeRun() : begin(recommendedLevel(progress).id));
$('#new-battle').addEventListener('click',()=>requestNewBattle(profile.run!.battle.levelId));
$('#home-achievements').addEventListener('click',openAchievements);
$('#home-characters').addEventListener('click',openCharacters);
$('#home-cat').addEventListener('click',openCat);
$('#achievements-back').addEventListener('click',()=>{ previousPhase=''; navigate(achievementsReturn); if(achievementsReturn==='home') $('#home-achievements').focus(); });
for (const selector of ['#achievement-category','#achievement-status']) $(selector).addEventListener('change',()=>renderAchievements(profile.achievements,progress));
$('#equipped-title').addEventListener('change',()=>{
  const value=($('#equipped-title') as HTMLSelectElement).value;
  if (value && !TITLES.some(t=>t.id===value&&Object.keys(profile.achievements.unlocked).length>=t.count)) return;
  profile.achievements.equippedTitle=value||null; saveProfile();
});
$('#choose-level').addEventListener('click', () => navigate('levels'));
$('#levels-back').addEventListener('click', () => navigate('home'));
$('#level-start').addEventListener('click', () => begin());
$('#home-guide').addEventListener('click', () => $('#help').click());
for (const selector of ['#start', '#level-start', '#home-achievements', '#home-cat']) ($(selector) as HTMLButtonElement).disabled = true;
void progressStore.load().then(async raw => {
  const loaded=readProfile(raw); profile=loaded.profile; progress=profile.progress; writableProfile=loaded.writable;
  await scene.setPlayerAppearance(profile.cat);
  selectedLevelId = recommendedLevel(progress).id;
  progressReady = true;
  for (const selector of ['#start', '#level-start', '#home-achievements', '#home-cat']) ($(selector) as HTMLButtonElement).disabled = false;
  updateProfileHome();
  profileLoadNotice=loaded.notice || (!progressStore.canWrite() ? '暂时无法读取本机存档，已保留原记录；本次进度暂不能保存。' : '');
  if (profileLoadNotice) { $('#profile-notice').hidden=false; $('#profile-notice').dataset.state='load'; $('#profile-notice').textContent=profileLoadNotice; }
  if (loaded.migrated && writableProfile && progressStore.canWrite()) void saver.save(serializeProfile(profile));
  if (screen === 'levels') refreshSelection();
  if (screen === 'characters') characterCatalog.refresh();
}).catch(()=>{$('#profile-notice').hidden=false;$('#profile-notice').textContent='猫咪暂时未能加载，请刷新重试。原有存档已保留。';});
function refreshSelection() {
  updateLevelSelection(selectedLevelId, progress, profile.legacyRecruits);
  updateProfileHome();
  if (!progressReady) $<HTMLButtonElement>('#level-start').disabled = true;
}
for (const level of LEVELS) $(`#level-${level.id}`).addEventListener('click', () => { selectedLevelId = level.id; refreshSelection(); });
for (const chapter of CHAPTERS) $(`[data-chapter="${chapter.id}"]`).addEventListener('click', () => {
  const stages = LEVELS.filter(level => level.chapter === chapter.id);
  selectedLevelId = (stages.find(level => !progress[level.id] && isLevelUnlocked(level.id, progress)) ?? stages[0]).id;
  refreshSelection();
});
$('.brand').addEventListener('click', event => { event.preventDefault(); if(screen==='cat'){catEditor.back();return;} if (screen === 'battle') { if (battle.phase === 'playing') battle.togglePause(); render(true); } else navigate('home'); });
function overlay() {
  const target = $('#battle-overlay');
  target.classList.toggle('hidden', battle.phase === 'playing');
  target.parentElement!.classList.toggle('has-overlay', battle.phase !== 'playing');
  if (battle.phase === 'ready') {
    target.innerHTML = '';
  } else if (battle.phase === 'paused') {
    target.innerHTML = `<div class="intro-card pause-card"><span class="intro-eyebrow">TAKE A LITTLE CATNAP</span><h2>猫咪打个小盹。</h2><p>战场已暂停，猫粮和研究也会等你。</p><button class="primary-button" id="resume">继续保护冻干 ${icons.play}</button><button class="subtle-button" id="restart">重新开始这一局</button><div class="pause-navigation"><button class="menu-secondary" id="pause-levels">保存并返回选关</button><button class="menu-secondary" id="pause-home">保存并返回首页</button><button class="menu-secondary" id="pause-achievements">小窝荣誉柜</button><button class="menu-secondary" id="pause-characters">角色图鉴</button><button class="menu-secondary" id="pause-cat">我的猫咪</button></div></div>`;
    $('#resume').addEventListener('click', () => { battle.togglePause(); render(true); });
    $('#restart').addEventListener('click', restart);
    $('#pause-levels').addEventListener('click', () => leaveBattle('levels'));
    $('#pause-home').addEventListener('click', () => leaveBattle('home'));
    $('#pause-achievements').addEventListener('click', openAchievements);
    $('#pause-characters').addEventListener('click', openCharacters);
    $('#pause-cat').addEventListener('click',openCat);
  } else if (battle.phase === 'ended') {
    const won = battle.winner === 'player', draw = battle.winner === 'draw';
    const index = LEVELS.indexOf(battle.level), nextLevel = index >= 0 ? LEVELS[index + 1] : undefined;
    const chapterFinished = won && Boolean(battle.level.stage && battle.level.stage % 5 === 0);
    const stars = won ? victoryStars(battle.armies.player.hp) : 0;
    const healthPercent = Math.floor(battle.armies.player.hp / BASE_HP * 1000) / 10;
    const healthText = battle.armies.player.hp > 0 && healthPercent === 0 ? '不足 0.1%' : `${healthPercent}%`;
    const starIcon = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 5 8.3 16.8 18.5 2.7-13.4 13.1 3.2 18.4L32 47.3l-16.6 8.7 3.2-18.4L5.2 24.5l18.5-2.7Z"/></svg>';
    target.innerHTML = `<div class="intro-card result-card">
      <div class="result-stars" role="img" aria-label="本局评分：${stars} 星，满分 3 星" data-stars="${stars}">${[1,2,3].map(n => `<span class="result-star${n <= stars ? ' earned' : ''}">${starIcon}</span>`).join('')}</div>
      <h2>${draw ? '势均力敌，冻干平分！' : won ? battle.level.stage === 30 ? '三十次守护，一粒没少！' : '冻干守住啦！' : '冻干被抢走啦…'}</h2>
      <strong class="result-rating">${stars === 3 ? '三星 · 完美守护' : stars === 2 ? '二星 · 稳稳守住' : stars === 1 ? '一星 · 险中取胜' : '本次未通关'}</strong>
      <p>${draw ? '两座基地同时倒下，下次再分胜负。' : won ? `我方基地剩余 ${healthText} 耐久` : battle.level.tip ?? '试试盾卫搭配法师，抓住机会升级科技。'}</p>
      ${chapterFinished ? `<div class="chapter-reward">✓ ${CHAPTERS[battle.level.chapter! - 1].name} · 守护纪念章${nextLevel ? '，新章节已解锁' : ' · 六章全部完成'}</div>` : ''}
      ${won && roundUnlocks.length ? `<div class="unit-reward">伙伴已加入：${roundUnlocks.map(k=>UNITS[k].short).join('、')}<small>研究对应科技后即可招募</small></div>` : ''}
      ${won ? '<div class="result-rating-rules" aria-label="胜利评星规则"><span><b>三星</b>满血获胜</span><span><b>二星</b>受损且 ≥50%</span><span><b>一星</b>剩余 &lt;50%</span></div>' : ''}
      <div class="result-stats"><span><b>${clock(battle.time)}</b>战斗时长</span><span><b>${battle.armies.player.hired}</b>招募伙伴</span><span><b>${Math.ceil(battle.armies.player.hp)}</b>剩余耐久</span></div>
      ${resultAchievements(profile.achievements,progress,roundAwards)}<div class="result-actions"><button class="primary-button" id="play-again">再来一局 ${icons.play}</button>${won && nextLevel ? `<button class="menu-secondary" id="next-level">${chapterFinished ? '前往下一章' : '挑战下一关'} →</button>` : ''}</div><button class="subtle-button" id="result-levels">返回关卡选择</button></div>`;
    $('#play-again').addEventListener('click', restart);
    $('#result-achievements').addEventListener('click', openAchievements);
    $('#result-levels').addEventListener('click', () => leaveBattle('levels'));
    if (won && nextLevel) $('#next-level').addEventListener('click', () => begin(nextLevel.id));
    if (!endSoundPlayed) { audio.play(won ? 'win' : 'lose'); endSoundPlayed = true; }
  } else target.innerHTML = '';
}

function render(force = false) {
  syncRun();
  renderBossStatus();
  renderBaseCatDialogue();
  renderSpellControls();
  const now = performance.now();
  if (!force && now - lastHUD < 90 && previousPhase === battle.phase) return;
  lastHUD = now;
  const army = battle.armies.player, enemy = battle.armies.enemy;
  $('#food').textContent = Math.floor(army.food).toLocaleString('zh-CN');
  const reinforcement = reinforcementPhase(battle.level, battle.time);
  const waiting = battle.time < battle.level.grace;
  const reinforcementBadge = $('.arena-badge');
  reinforcementBadge.classList.toggle('regrouping', reinforcement.regrouping);
  $('#reinforcement-status').textContent = waiting ? `首波敌人 ${Math.ceil(battle.level.grace - battle.time)} 秒后出发`
    : reinforcement.nextChangeIn === null ? '敌方持续增援中'
    : reinforcement.regrouping ? `敌军整备 · ${Math.ceil(reinforcement.nextChangeIn)}秒后增援`
    : `敌方增援 · ${Math.ceil(reinforcement.nextChangeIn)}秒后整备`;
  reinforcementBadge.title = '整备期间敌军暂停招募，场上敌人继续战斗，双方照常产粮与研究。';
  const cannonDamage = CANNON_DAMAGE[army.tech - 1];
  $('#cannon-status').textContent = `主炮 Lv.${army.tech} · ${cannonDamage} 伤害 · 自动防守`;
  $('#compact-cannon').textContent = `${BASE_NAMES[army.tech - 1]} · 炮${cannonDamage}`;
  $('#compact-enemy-base').textContent = `${['一', '二', '三'][enemy.tech - 1]}阶 · ${BASE_NAMES[enemy.tech - 1]}`;
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
    const progressLocked=!battle.playerRoster.includes(kind);
    const reason = battle.summonReason('player', kind), locked = progressLocked || army.tech < spec.tier;
    card.disabled = Boolean(reason);
    card.classList.toggle('locked', locked);
    card.classList.toggle('available', !reason);
    card.classList.toggle('progress-locked', progressLocked);
    card.style.order=String((progressLocked?1000:0)+unlockStage(kind)*10+UNIT_ORDER.indexOf(kind));
    const lock=card.querySelector<HTMLElement>('.unit-lock')!;
    lock.hidden=!locked; lock.textContent=progressLocked ? `第 ${unlockStage(kind)} 关` : `需${spec.tier===2?'二':'三'}阶`;
    card.querySelector<HTMLElement>('.unit-new')!.hidden=progressLocked || unlockStage(kind)<=1 || unlockStage(kind)!==battle.level.stage || !!progress[battle.level.id] || profile.legacyRecruits.includes(kind);
    card.dataset.unavailable = reason;
    const label = `招募${spec.name}，${spec.cost}猫粮，${spec.population}人口，${reason || '可以招募'}`;
    if (card.getAttribute('aria-label') !== label) card.setAttribute('aria-label', label);
    (card.querySelector('.cooldown-track') as HTMLElement).style.width = `${army.cooldowns[kind] / spec.cooldown * 100}%`;
    card.title = `${spec.name} · ${spec.cost} 猫粮 · ${spec.population} 人口\n${spec.description}${reason ? `（${reason}）` : ''}`;
  }
  $('#recruit-title').textContent=`伙伴 ${battle.playerRoster.length} / ${UNIT_ORDER.length}`;
  const econCost = ECONOMY_COSTS[army.economy];
  const payback = econCost === undefined ? 0 : Math.ceil(econCost / (FOOD_RATES[army.economy + 1] - FOOD_RATES[army.economy]));
  $('#economy-title').textContent = '产能升级';
  const economyLabel = econCost === undefined ? `${FEEDER_NAMES[army.economy]} · 产能已满级，每秒 ${FOOD_RATES[army.economy]} 猫粮` : `${FEEDER_NAMES[army.economy]} → ${FEEDER_NAMES[army.economy + 1]}，花费 ${econCost} 猫粮，产量 ${FOOD_RATES[army.economy]} → ${FOOD_RATES[army.economy + 1]} / 秒，约 ${payback} 秒回本`;
  $('#upgrade-economy').title = economyLabel;
  $('#upgrade-economy').setAttribute('aria-label', economyLabel);
  $('#tech-title').textContent = '科技研究';
  $('#economy-level').textContent = `Lv.${army.economy + 1}/${FOOD_RATES.length}`;
  $('#economy-description').textContent = econCost === undefined ? `${FOOD_RATES[army.economy]} / 秒 · 满级` : `${FOOD_RATES[army.economy]} → ${FOOD_RATES[army.economy + 1]} / 秒`;
  updateMarkup('#economy-action', econCost === undefined ? '<b>MAX</b><span>已满级</span>' : `${food}${econCost}<span>${army.food < econCost ? '猫粮不足' : '升级 ↑'}</span>`);
  $<HTMLButtonElement>('#upgrade-economy').disabled = battle.phase !== 'playing' || econCost === undefined || army.food < econCost;
  $('#tech-level').textContent = `${['一', '二', '三'][army.tech - 1]}阶`;
  $('#tech-description').textContent = army.researching ? `研究中 · ${Math.ceil(army.research)} 秒` : army.tech < 3
    ? `主炮 ${cannonDamage} → ${CANNON_DAMAGE[army.tech]}`
    : `主炮 ${cannonDamage} · 满级`;
  const researchUnits=battle.playerRoster.filter(k=>UNITS[k].tier===army.tech+1);
  const techLabel=army.tech<3 ? `基地升级为${BASE_NAMES[army.tech]}；${researchUnits.length ? `可招募：${researchUnits.map(k=>UNITS[k].short).join('、')}` : '本次没有新增可招募伙伴'}；主炮 ${cannonDamage} → ${CANNON_DAMAGE[army.tech]}，轰炸 ${BOMBARD.damage[army.tech-1]} → ${BOMBARD.damage[army.tech]}` : `冻干要塞 · 科技已满级；伙伴随关卡永久解锁`;
  $('#upgrade-tech').title=techLabel; $('#upgrade-tech').setAttribute('aria-label',techLabel);
  if(!army.researching&&army.tech<3) $('#tech-description').textContent=researchUnits.length ? `可招募 ${researchUnits.length} 种 · 主炮↑` : '主炮、轰炸强化';
  updateMarkup('#tech-action', army.researching ? `<b>${Math.ceil(army.research)}s</b><span>研究中…</span>` : army.tech === 3 ? '<b>MAX</b><span>已满级</span>' : `${food}${TECH_COSTS[army.tech - 1]}<span>${army.food < TECH_COSTS[army.tech - 1] ? '猫粮不足' : '研究 ↑'}</span>`);
  $<HTMLButtonElement>('#upgrade-tech').disabled = battle.phase !== 'playing' || army.researching || army.tech === 3 || army.food < TECH_COSTS[army.tech - 1];
  $('#research-progress').style.width = army.researching ? `${(1 - army.research / TECH_TIMES[army.tech - 1]) * 100}%` : '0';
  $<HTMLButtonElement>('#pause').disabled = battle.phase === 'ready' || battle.phase === 'ended';
  updateMarkup('#pause', battle.phase === 'paused' ? `${icons.play}<span>继续</span>` : `${icons.pause}<span>暂停</span>`);
  $('#pause').setAttribute('aria-label', battle.phase === 'paused' ? '继续' : '暂停');
  const showAchievement = achievementNotice && battle.time < achievementNoticeUntil && !battle.spellNotices.visible(battle.time).length && !battle.units.some(u=>u.sweep);
  const fieldMessage = battle.phase === 'playing' && battle.time > battle.messageUntil
    ? (showAchievement ? achievementNotice : waiting ? `准备阶段：${battle.level.tip ?? '升级产能，招募伙伴。'}` : reinforcement.regrouping ? '敌军暂停招募，场上敌人仍在战斗。趁机推进，或留粮升级！' : `敌军：${enemyPlan(battle.level, battle.time).label}。${battle.level.tip ?? '稳住前线，发展科技！'}`)
    : battle.message;
  if (previousMessage !== fieldMessage) { $('#field-message').textContent = fieldMessage; previousMessage = fieldMessage; }
  if (previousPhase !== battle.phase) { overlay(); previousPhase = battle.phase; }
  if (needsSave) { needsSave=false; saveProfile(); }
  document.documentElement.dataset.phase = battle.phase;
  if (reducedMotion) document.documentElement.classList.add('reduce-motion');
}
navigate('home');

// Development-only hook for deterministic browser acceptance checks, excluded from production.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
  Object.assign(window, { __catGame: { battle, saveProfile, getCatTextureKeys: () => scene.textures.getTextureKeys().filter(key=>key.startsWith('base-cat-custom-')), getProfile: () => clone(profile), storageKey: SAVE_KEY, render: () => render(true), getView: () => scene.getViewportSnapshot(), getAnimations: () => scene.getAnimationSnapshot(), getScreen: () => screen, advance: (seconds: number) => { scene.advanceSimulation(seconds); render(true); } } });
}

// Read-only gameplay state and deterministic stepping for browser playtests.
Object.assign(window, {
  render_game_to_text: () => JSON.stringify({ screen, phase: battle.phase, level: battle.level.id, selectedLevel: selectedLevelId, time: +battle.time.toFixed(2), winner: battle.winner,
    catalog:screen==='characters'?characterCatalog.snapshot():null,
    achievements: { unlocked:Object.keys(profile.achievements.unlocked), total:24, title:equippedTitle(profile.achievements), stats:profile.achievements.stats },
    resume: { available:!!profile.run, level:profile.run?.battle.levelId??null, time:profile.run?.battle.time??null },
    roster: { available:[...battle.playerRoster], permanent:unlockedUnits(progress,profile.legacyRecruits), legacyRound:battle.legacyRoster, arrivals:arrivalsAtStage(battle.level.stage??0), locked:UNIT_ORDER.filter(k=>!battle.playerRoster.includes(k)).map(kind=>({kind,stage:unlockStage(kind)})) },
    campaign: { total: LEVELS.length, chapter: battle.level.chapter, stage: battle.level.stage, scene: battle.level.scene, tactic: enemyPlan(battle.level, battle.time).label, next: recommendedLevel(progress).id, cleared: LEVELS.filter(level => progress[level.id]).length, selectedUnlocked: isLevelUnlocked(selectedLevelId, progress) },
    result: battle.phase === 'ended' ? { stars: battle.winner === 'player' ? victoryStars(battle.armies.player.hp) : 0, baseHealthPercent: Math.floor(battle.armies.player.hp / BASE_HP * 1000) / 10 } : null,
    coordinates: 'Vertical battlefield: player below, enemy above; x runs from 155 (player) to 1285 (enemy), bottom to top. Continuous row runs left (0) to right (2), with 80 simulation units per row. Facing is in screen radians relative to player up / enemy down.',
    player: { ...battle.armies.player, population: battle.population('player'), income: FOOD_RATES[battle.armies.player.economy] },
    economy: { level: battle.armies.player.economy + 1, maxLevel: FOOD_RATES.length, nextCost: ECONOMY_COSTS[battle.armies.player.economy] ?? null, nextIncome: FOOD_RATES[battle.armies.player.economy + 1] ?? null, paybackSeconds: ECONOMY_COSTS[battle.armies.player.economy] === undefined ? null : ECONOMY_COSTS[battle.armies.player.economy] / (FOOD_RATES[battle.armies.player.economy + 1] - FOOD_RATES[battle.armies.player.economy]) },
    enemy: { faction: ENEMY_FACTION, energy: battle.armies.enemy.energy, hp: battle.armies.enemy.hp, tech: battle.armies.enemy.tech, hired: battle.armies.enemy.hired, population: battle.population('enemy') },
    bases: scene.getBaseSnapshot(),
    cannon: { damage: CANNON_DAMAGE[battle.armies.player.tech - 1], range: CANNON_RANGE, interval: CANNON_INTERVAL },
    reinforcement: { initialDelayRemaining: Math.max(0, battle.level.grace - battle.time), continuous: !battle.level.reinforcements, ...reinforcementPhase(battle.level, battle.time), schedule: battle.level.reinforcements ?? null },
    boss: { ...battle.boss, hp:battle.units.find(u=>u.id===battle.boss.unitId)?.hp??0, maxHp:UNITS.boss.hp,
      state:!battle.boss.spawned?'waiting':!battle.units.some(u=>u.id===battle.boss.unitId)?'defeated':battle.units.find(u=>u.id===battle.boss.unitId)?.bossEntry?'entering':'active',
      sweep:battle.units.find(u=>u.id===battle.boss.unitId)?.sweep??null },
    catEditor: screen==='cat'?catEditor.snapshot():null,
    baseCats: { enemy: { name: '大胖橘', ...battle.baseDialogue.snapshot(battle.time), speechVisible: !battle.boss.spawned && screen === 'battle' && (battle.phase === 'playing' || battle.phase === 'paused') && !battle.spellNotices.visible(battle.time).length && Boolean(battle.baseDialogue.snapshot(battle.time).text) }, player: { name: '我的猫咪', appearance: scene.getPlayerAppearance() }, animation:scene.getBaseCatSnapshot() },
    spells: { energy: { player: battle.armies.player.energy, enemy: battle.armies.enemy.energy, max: ENERGY.max, starting: ENERGY.starting }, costs: { treat: TREAT.energyCost, catnip: CATNIP.energyCost, bombard: BOMBARD.energyCost }, bombardDamage: BOMBARD.damage[battle.armies.player.tech-1], bombardRadius: BOMBARD.radius, pending: battle.effects.filter(fx=>fx.type==='bombard'&&!fx.landed).map(fx=>({side:fx.side,x:fx.targetX,row:fx.row,damage:fx.power,impactIn:Math.max(0,BOMBARD.delay-fx.age)})), killRewards: ENERGY_REWARDS, notices: screen === 'battle' && (battle.phase === 'playing' || battle.phase === 'paused') ? battle.spellNotices.visible(battle.time).map(notice => ({ ...notice, ...spellNoticeText(notice) })) : [] },
    units: battle.units.map(({ id, kind, side, x, row, hp, starSlow, catnip, targetId, targetX, targetRow, weakenedUntil, hasteUntil, guardUntil, stealthUntil, stealthUsed, dodgeAt, charge }) => ({ id, kind, side, name: unitIdentity(kind, side).name, x: +x.toFixed(1), row: +row.toFixed(3), hp, targetId, targetX: +targetX.toFixed(1), targetRow: +targetRow.toFixed(3), slowSeconds: +starSlow.toFixed(2), catnipSeconds: +catnip.toFixed(2), weakenedSeconds: Math.max(0, (weakenedUntil ?? 0) - battle.time), hasteSeconds: Math.max(0, (hasteUntil ?? 0) - battle.time), guardSeconds: Math.max(0, (guardUntil ?? 0) - battle.time), stealthSeconds: Math.max(0, (stealthUntil ?? 0) - battle.time), stealthUsed: !!stealthUsed, dodgeAt, charge })),
    projectiles: battle.projectiles.map(({ id, targetId, age, duration }) => ({ id, targetId, impactIn: +(duration - age).toFixed(2) })),
    animations: scene.getAnimationSnapshot().map(({ id, state, x, y, facing }) => ({ id, state, x: +x.toFixed(1), y: +y.toFixed(1), facing: +facing.toFixed(3) })),
  }),
});
if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
  Object.assign(window, { advanceTime: (ms: number) => { scene.manualTime = true; scene.advanceSimulation(Math.max(0, Math.min(ms, 600000)) / 1000); render(true); } });
}
