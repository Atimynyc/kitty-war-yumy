import { svgURL, unitSVG } from '../art.ts';
import { catalogKinds, characterInfo, enemyFirstStage } from '../game/character-catalog.ts';
import { ORANGE_BOSS, UNITS } from '../game/content.ts';
import type { Side, UnitKind } from '../game/content.ts';
import { unlockStage } from '../game/unit-unlocks.ts';

export function characterCatalogMarkup() {
  return `<section id="character-screen" class="menu-screen catalog-screen" aria-labelledby="catalog-title" hidden>
    <header class="catalog-heading"><div><span class="eyebrow">PAW & PANTRY · 小窝档案室</span><h1 id="catalog-title" tabindex="-1">认识每一位伙伴。</h1></div><button id="catalog-back" class="menu-secondary">← 首页</button></header>
    <div id="catalog-index">
      <p class="catalog-lead">有守护晚餐的勇气，也有偷吃零食的小心思。<br>翻开档案，看看每张熟悉面孔背后的故事。</p>
      <div class="catalog-factions" role="group" aria-label="选择角色阵营"><button data-catalog-side="player" aria-pressed="true">守护小队 <span>16</span></button><button data-catalog-side="enemy" aria-pressed="false">胖橘搜粮团 <span>9</span></button></div>
      <p id="catalog-summary" class="catalog-summary" role="status"></p>
      <div id="catalog-cards" class="catalog-cards"></div>
      <p class="catalog-footnote">所有档案都可阅读。查看角色不会解锁或招募伙伴。</p>
    </div>
    <article id="catalog-detail" hidden></article>
  </section>`;
}

export function installCharacterCatalog(options: { getOwned: () => UnitKind[]; close: () => void }) {
  const root=document.getElementById('character-screen')!;
  const cards=document.getElementById('catalog-cards')!;
  const detail=document.getElementById('catalog-detail')!;
  const back=document.getElementById('catalog-back')!;
  let side: Side='player', selected: UnitKind|null=null, returnLabel='首页', listScroll=0;
  const portrait=(kind: UnitKind)=>svgURL(unitSVG(kind,side));
  const owned=()=>options.getOwned();
  function availability(kind: UnitKind) {
    if(side==='enemy')return kind==='boss'?'第 30 关 · 首领':`第 ${enemyFirstStage(kind)} 关起可能出现`;
    return owned().includes(kind)?'已加入小队':`第 ${unlockStage(kind)} 关加入`;
  }
  function renderIndex() {
    const kinds=catalogKinds(side);
    document.getElementById('catalog-summary')!.textContent=side==='player'?`已拥有 ${owned().length} / ${kinds.length} 位伙伴 · 按加入顺序翻阅`:'8 种普通敌军与 1 位首领 · 看懂装备，也就看懂了对手';
    cards.innerHTML=kinds.map((kind,i)=>{
      const info=characterInfo(kind,side);
      return `<button class="catalog-card" data-character="${kind}" aria-label="查看${info.name}的角色档案" style="--portrait-color:${UNITS[kind].color}"><span class="catalog-number">${String(i+1).padStart(2,'0')}</span><div class="catalog-portrait"><img src="${portrait(kind)}" alt="" loading="lazy" width="128" height="128" /></div><strong>${info.name}</strong><span class="catalog-role">${info.role}</span><small class="catalog-availability${side==='player'&&owned().includes(kind)?' is-owned':''}">${availability(kind)}</small></button>`;
    }).join('');
    root.dataset.faction=side;
    root.querySelectorAll<HTMLButtonElement>('[data-catalog-side]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.catalogSide===side)));
  }
  function recruitment(kind: UnitKind) {
    const u=UNITS[kind];
    if(kind==='boss')return `<section class="catalog-acquisition"><h3>首领登场</h3><p>第 30 关，敌方基地耐久低于 ${Math.round(ORANGE_BOSS.trigger*100)}% 且仍存活时出场一次。不能招募，不占普通部队人口；直接摧毁基地也会获胜。</p></section>`;
    const joining=unlockStage(kind)===1?'初始伙伴，第一次守护就能招募。':`到达第 ${unlockStage(kind)} 关永久加入；通关前一关即可获得。已继承的旧版伙伴继续保留。`;
    return `<section class="catalog-acquisition"><h3>${side==='player'?'加入与招募':'出没与敌方招募'}</h3><p>${side==='player'?joining:`第 ${enemyFirstStage(kind)} 关起进入可能出现的编队；实际登场还取决于该局研究、猫粮与招募时机。`}</p><dl class="catalog-requirements"><div><dt>所需科技</dt><dd>${['一','二','三'][u.tier-1]}阶</dd></div><div><dt>招募猫粮</dt><dd>${u.cost}</dd></div><div><dt>占用人口</dt><dd>${u.population}</dd></div><div><dt>招募冷却</dt><dd>${u.cooldown} 秒</dd></div></dl></section>`;
  }
  function renderDetail() {
    if(!selected)return;
    const kind=selected, info=characterInfo(kind,side), kinds=catalogKinds(side), index=kinds.indexOf(kind);
    detail.innerHTML=`<div class="catalog-hero" style="--portrait-color:${UNITS[kind].color}"><span class="catalog-dossier">${side==='player'?'守护小队':'胖橘搜粮团'} / ${String(index+1).padStart(2,'0')}</span><div class="catalog-hero-art"><img src="${portrait(kind)}" alt="${info.name}的全身形象" width="200" height="200" /></div><span class="catalog-epithet">${info.epithet}</span><h2 id="catalog-character-name" tabindex="-1">${info.name}</h2><p class="catalog-hero-tags"><span>${info.role}</span><span>${availability(kind)}</span></p><blockquote>“${info.quote}”</blockquote></div>
      <section class="catalog-section catalog-story"><h3>它的故事</h3><p>${info.story}</p></section>
      <section class="catalog-section"><h3>战场上的它</h3><p>${info.use}</p><h4>本领与机制</h4><ul class="catalog-mechanics">${info.mechanics.map(text=>`<li>${text}</li>`).join('')}</ul></section>
      <section class="catalog-section"><h3>基础属性</h3><dl class="catalog-stats">${info.stats.map(stat=>`<div><dt>${stat.label}</dt><dd>${stat.value}</dd></div>`).join('')}</dl><p class="catalog-stat-note">未计算临时增益与减益。距离、速度使用相同的战场刻度；实际出手还受蓄力、弹道和状态影响。击败这个角色，能量由对方获得。</p></section>
      ${recruitment(kind)}
      <section class="catalog-section catalog-tactics"><h3>${side==='player'?'一起上场的窍门':'遇到它怎么办'}</h3><p>${info.advice}</p><div class="catalog-caution"><h4>留意这一点</h4><p>${info.caution}</p></div></section>
      <nav class="catalog-pagination" aria-label="翻阅角色档案"><button class="menu-secondary" data-catalog-step="-1" ${index===0?'disabled':''}>← 上一位</button><span>${index+1} / ${kinds.length}</span><button class="menu-secondary" data-catalog-step="1" ${index===kinds.length-1?'disabled':''}>下一位 →</button></nav><button class="catalog-return menu-secondary" data-catalog-list>返回角色列表</button>`;
  }
  function updateView(focus=false) {
    document.getElementById('catalog-index')!.hidden=selected!==null;
    detail.hidden=selected===null;
    back.textContent=selected?'← 图鉴':`← ${returnLabel}`;
    if(selected)renderDetail();else renderIndex();
    if(focus){root.scrollTop=0;document.getElementById(selected?'catalog-character-name':'catalog-title')!.focus({preventScroll:true});}
  }
  function showList() {
    const previous=selected; selected=null; updateView(); root.scrollTop=listScroll;
    if(previous)cards.querySelector<HTMLButtonElement>(`[data-character="${previous}"]`)?.focus({preventScroll:true});
  }
  function goBack() { if(selected)showList();else options.close(); }
  back.addEventListener('click',goBack);
  root.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
    if(button.dataset.catalogSide){side=button.dataset.catalogSide as Side;selected=null;listScroll=0;updateView();}
    if(button.dataset.character){listScroll=root.scrollTop;selected=button.dataset.character as UnitKind;updateView(true);}
    if(button.hasAttribute('data-catalog-list'))showList();
    if(button.dataset.catalogStep&&selected){const kinds=catalogKinds(side),next=kinds[kinds.indexOf(selected)+Number(button.dataset.catalogStep)];if(next){selected=next;updateView(true);}}
  });
  return {
    open(label: string) { returnLabel=label;selected=null;updateView();root.scrollTop=0; },
    refresh() { updateView(); },
    back:goBack,
    snapshot() { return {side,selected,available:catalogKinds(side),character:selected?characterInfo(selected,side):null}; },
  };
}
