import { ACHIEVEMENTS, CATEGORIES, TITLES, achievementValue, equippedTitle, missingPartners } from '../game/achievements.ts';
import type { Achievement, Achievements } from '../game/achievements.ts';
import type { CampaignProgress } from '../game/levels.ts';
import { svgURL, unitPortraitSVG, paw, icons } from '../art.ts';

const motifs: Record<string,string> = {
  sun:'<circle cx="32" cy="31" r="11"/><path d="M32 13v4m0 28v4M14 31h4m28 0h4M19 18l3 3m20 20 3 3M19 44l3-3m20-20 3-3" fill="none"/>',
  box:'<path d="m15 25 17-9 17 9v23H15Z"/><path d="M15 25h34M32 26v22m-9-12h5m8 0h5" fill="none"/>',
  jar:'<rect x="21" y="15" width="22" height="7" rx="3"/><rect x="18" y="22" width="28" height="29" rx="7"/><path d="m32 28 7 7-7 8-7-8Z" fill="#fff9e9"/>',
  leaf:'<path d="M16 46Q13 14 49 17q3 34-33 29Z"/><path d="m18 44 23-20m-14 7v10m6-16v10" fill="none"/>',
  moon:'<path d="M39 14a20 20 0 1 0 12 31A22 22 0 0 1 39 14Z"/><path d="m46 17 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>',
  crown:'<path d="m16 23 9 7 7-14 7 14 9-7-4 24H20Z"/><path d="M20 41h24" fill="none"/>',
  star:'<path d="m32 13 6 13 15 2-11 10 3 15-13-7-13 7 3-15-11-10 15-2Z"/>',
};
export function achievementBadge(a: Achievement) {
  if(a.unit) return `<img src="${svgURL(unitPortraitSVG(a.unit))}" alt=""/>`;
  if(a.icon==='paw') return paw;
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${motifs[a.icon] ?? motifs.star}</g></svg>`;
}
export function achievementsMarkup() {
  return `<section id="achievement-screen" class="menu-screen achievement-screen" hidden aria-labelledby="achievement-title">
    <div class="menu-heading"><div><span class="eyebrow">LITTLE PAWS, BIG MOMENTS</span><h1 id="achievement-title" tabindex="-1">小窝荣誉柜</h1></div><button id="achievements-back" class="menu-secondary">← 返回</button></div>
    <div class="honor-banner"><span class="honor-seal">${paw}</span><div><strong id="achievement-summary">0 / 24 枚徽章</strong><p>每一次配合，都值得留个爪印。</p><progress id="achievement-total" max="24" value="0" aria-label="成就总进度"></progress></div></div>
    <div class="honor-title-picker"><label for="equipped-title">佩戴称号</label><select id="equipped-title"><option value="">暂不佩戴</option>${TITLES.map(t=>`<option value="${t.id}">${t.name} · ${t.count} 项解锁</option>`).join('')}</select><p id="next-title"></p></div>
    <div class="honor-filters"><label>分类<select id="achievement-category"><option value="all">全部分类</option>${CATEGORIES.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><label>状态<select id="achievement-status"><option value="all">全部成就</option><option value="locked">未获得</option><option value="unlocked">已获得</option></select></label></div>
    <p id="achievement-filter-summary" class="honor-filter-summary" role="status"></p><div id="achievement-list" class="honor-grid"></div>
    <p class="honor-footnote">徽章与称号不影响战斗数值。进度自动保存在当前设备，累计成就失败也保留。</p>
  </section>`;
}
export function renderAchievements(data: Achievements, progress: CampaignProgress) {
  const get = (id: string) => document.getElementById(id)!;
  const count=Object.keys(data.unlocked).length;
  get('achievement-summary').textContent=`${count} / 24 枚徽章`;
  (get('achievement-total') as HTMLProgressElement).value=count;
  const select=get('equipped-title') as HTMLSelectElement;
  for(const option of Array.from(select.options)) { const title=TITLES.find(t=>t.id===option.value); option.disabled=!!title&&count<title.count; }
  select.value=data.equippedTitle ?? '';
  const next=TITLES.find(t=>t.count>count);
  get('next-title').textContent=next?`再获得 ${next.count-count} 枚徽章，解锁「${next.name}」`:'全部称号已解锁，谢谢你守好每个小窝。';
  const category=(get('achievement-category') as HTMLSelectElement).value, filter=(get('achievement-status') as HTMLSelectElement).value;
  const visible=ACHIEVEMENTS.filter(a=>(category==='all'||String(a.category)===category)&&(filter==='all'||(filter==='unlocked')===!!data.unlocked[a.id]));
  get('achievement-filter-summary').textContent=`显示 ${visible.length} 项成就`;
  get('achievement-list').innerHTML=visible.length?visible.map(a=>{
    const value=achievementValue(a,data,progress), entry=data.unlocked[a.id];
    const unread=!!entry && data.unseenIds.includes(a.id);
    const missing=a.counter==='recruited'?missingPartners(data):[];
    return `<article class="honor-card ${entry?'earned':'unearned'}" data-achievement="${a.id}">${unread?'<span class="achievement-dot" role="img" aria-label="新获得的成就"></span>':''}<div class="honor-badge">${achievementBadge(a)}</div><div class="honor-copy"><span class="honor-category">${CATEGORIES[a.category]}</span><h2>${a.name}</h2><p>${a.description}</p><div class="honor-progress"><progress value="${value}" max="${a.target}" aria-label="${a.name}进度"></progress><span>${entry?'✓ 已获得':`${value} / ${a.target}`}</span></div>${entry?`<small>${entry.source==='migration'?'根据已有成绩补发':'已收入荣誉柜'}</small>`:''}${missing.length?`<details><summary>还没招募的伙伴 · ${missing.length}</summary><p>${missing.join('、')}</p></details>`:''}</div></article>`;
  }).join(''):'<p class="honor-empty">这里还没有徽章。试试其他分类，或带伙伴们出发吧。</p>';
}
export function resultAchievements(data: Achievements) {
  const title=equippedTitle(data);
  return `<div class="result-honors">${title?`<p class="equipped-honor">${title}</p>`:''}<div class="result-links"><button class="subtle-button nav-icon-button" id="result-achievements">${icons.trophy}<span>成就</span></button><button class="subtle-button nav-icon-button" id="result-detail" aria-controls="result-detail-screen">${icons.details}<span>详情</span></button></div></div>`;
}

export function renderAchievementIndicators(data: Achievements) {
  for (const id of ['home-achievements','pause-achievements','result-achievements']) {
    const button=document.getElementById(id);
    if (!button) continue;
    const unread=data.unseenIds.length>0;
    button.classList.add('achievement-entry');
    button.setAttribute('aria-label',unread?'成就，有新成就':'成就');
    const dot=button.querySelector('.achievement-dot');
    if (unread && !dot) button.insertAdjacentHTML('beforeend','<span class="achievement-dot" aria-hidden="true"></span>');
    if (!unread) dot?.remove();
  }
}
