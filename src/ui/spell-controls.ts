import type { Battle } from '../game/simulation.ts';
import { CATNIP, TREAT, BOMBARD, SPELLS, ENERGY } from '../game/content.ts';
import { spellNoticeText } from '../game/spell-notices.ts';
import type { SpellKind } from '../game/spell-notices.ts';

const treatIcon = `<svg class="spell-art" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#9b655a" stroke-width="2.6" stroke-linejoin="round"><path d="M14 20h36v29q-18 13-36 0Z" fill="#e8ada0"/><ellipse cx="32" cy="20" rx="18" ry="7" fill="#fff0d3"/><ellipse cx="32" cy="18" rx="7" ry="3" fill="none"/><path d="M28 29h8v7h7v8h-7v7h-8v-7h-7v-8h7Z" fill="#fff8e7" stroke="none"/><path d="m50 7 2-4 2 4 4 2-4 2-2 4-2-4-4-2Z" fill="#ebc77a" stroke="#b49356" stroke-width="1.5"/></g></svg>`;
const bombardIcon = `<svg class="spell-art" viewBox="0 0 64 64" aria-hidden="true"><g stroke-linecap="round" stroke-linejoin="round"><path d="m17 8 5 10M9 17l9 5m27-9-4 7" stroke="#c68d48" stroke-width="3"/><circle cx="34" cy="36" r="18" fill="#e9b46e" stroke="#9e6841" stroke-width="2.5"/><path d="M21 24q19 3 27 18M17 33q18 0 27 17M27 19q-5 21 7 35M37 19q-9 17-3 35M19 44q12-15 30-14m-29 7q14-15 25-13" fill="none" stroke="#fff0cb" stroke-width="2"/><path d="m13 49-5 5 11-1m25 4 9-2-2-8" fill="none" stroke="#b88245" stroke-width="2.5"/></g></svg>`;
const catnipIcon = `<svg class="spell-art" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#547b50" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M30 54q4-17 9-34" fill="none"/><path d="M34 39Q9 41 13 19q25 1 21 20Z" fill="#a8c886"/><path d="M36 32Q35 10 55 11q2 23-19 21Z" fill="#78aa6a"/><path d="m19 26 15 13m15-21-13 14" fill="none" stroke="#e5edbc"/><path d="m32 48 1-9q19-2 18 12-11 4-19-3Z" fill="#92b977"/><path d="m8 43 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#f1d37f" stroke="#b6934f" stroke-width="1.4"/></g></svg>`;
export const spellControlsMarkup = `<div class="skill-gutter" aria-hidden="true"></div><div class="spell-rail" role="group" aria-label="主动技能">
  <div id="spell-energy" class="spell-energy" role="meter" aria-label="技能能量" aria-valuemin="0" aria-valuemax="${ENERGY.max}"><div aria-hidden="true"><svg viewBox="0 0 20 24"><path d="M11 1 2 14h7l-1 9 10-14h-7Z" fill="#e6ba58" stroke="#947240" stroke-linejoin="round"/></svg><strong id="energy-count">${ENERGY.starting}</strong></div><span class="energy-track" aria-hidden="true"><i id="energy-fill"></i></span><span id="energy-gain" class="energy-gain" aria-hidden="true" hidden></span></div>
  ${(['treat','catnip','bombard'] as const).map(kind=>`<button id="${kind}" class="spell-button spell-${kind}" aria-label="释放${SPELLS[kind].name}" aria-keyshortcuts="${kind==='bombard'?'Space':SPELLS[kind].key}">${({treat:treatIcon,catnip:catnipIcon,bombard:bombardIcon})[kind]}<span class="spell-label" aria-hidden="true">${SPELLS[kind].short}<b> ${SPELLS[kind].energyCost}</b></span></button>`).join('')}
</div><div id="spell-subtitles" class="spell-subtitles" role="status" aria-live="polite" aria-atomic="true"></div>`;

export function installSpellControls(battle: Battle) {
  const subtitles = document.getElementById('spell-subtitles')!;
  const kinds: SpellKind[] = ['treat','catnip','bombard'];
  const meter=document.getElementById('spell-energy')!,count=document.getElementById('energy-count')!,fill=document.getElementById('energy-fill')!,gain=document.getElementById('energy-gain')!;
  let previous = '';
  return () => {
    const army = battle.armies.player, allies = battle.units.filter(unit => unit.side === 'player' && unit.hp > 0);
    count.textContent=String(army.energy);fill.style.width=`${army.energy/ENERGY.max*100}%`;
    meter.setAttribute('aria-valuenow',String(army.energy));
    meter.setAttribute('aria-valuetext',`${army.energy} / ${ENERGY.max}；急救 ${TREAT.energyCost}，增伤 ${CATNIP.energyCost}，轰炸 ${BOMBARD.energyCost}；击杀敌人回能`);
    meter.dataset.ready=String(army.energy>=TREAT.energyCost);
    gain.hidden=battle.phase==='ready' || battle.phase==='ended' || battle.time-army.energyGainAt>=1 || army.energyGain<=0;
    if(!gain.hidden)gain.textContent=`+${army.energyGain}`;
    for (const kind of kinds) {
      const { energyCost: cost, name, key } = SPELLS[kind];
      const button = document.getElementById(kind) as HTMLButtonElement,reason=battle.spellReason('player',kind);
      button.disabled = Boolean(reason);
      button.dataset.active = String(kind === 'catnip' && allies.some(unit => unit.catnip > 0));
      const description = kind==='treat' ? '治疗全体受伤伙伴：30% 最大生命，每只最多240；不修复基地' : kind==='catnip' ? '在场伙伴攻击力提高20%，持续10秒；新出兵无加成' : `自动锁定密集敌群，0.65秒后造成${BOMBARD.damage[army.tech-1]}范围伤害；不伤友军和基地`;
      const label = `${name}，消耗 ${cost} 能量，${description}，${reason || '可以释放'}（${key}）`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (button.title !== label) button.title=label;
    }
    const notices = battle.phase === 'ready' || battle.phase === 'ended' ? [] : battle.spellNotices.visible(battle.time);
    const signature = `${battle.revision}:${notices.map(item=>item.id).join(',')}`;
    if (signature !== previous) {
      previous = signature;
      subtitles.parentElement!.classList.toggle('has-spell-notice', notices.length > 0);
      subtitles.textContent = '';
      subtitles.append(...notices.map(notice => {
        const card = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('span');
        const copy = spellNoticeText(notice);
        card.className = `spell-notice ${notice.side}`; card.dataset.spell = notice.spell; card.dataset.side = notice.side;
        title.textContent = copy.title; detail.textContent = copy.summary;
        card.title=copy.detail;card.setAttribute('aria-label',`${copy.title}。${copy.detail}`);
        card.append(title, detail); return card;
      }));
    }
  };
}
