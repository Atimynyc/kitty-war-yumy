import type { Battle } from '../game/simulation.ts';
import { CATNIP, ROAR } from '../game/content.ts';
import { spellNoticeText } from '../game/spell-notices.ts';

const roarIcon = `<svg class="spell-art" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#95562f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 45q-12-12 0-25m30 0q12 13 0 25" fill="none" stroke="#e1aa60"/><path d="m13 15-5-3m48 0-5 3M9 35H5m50 0h4"/><path d="M20 41q0-8 12-16 12 8 12 16 0 10-12 5-12 5-12-5Z" fill="#efb56d"/><ellipse cx="19" cy="25" rx="4" ry="6" transform="rotate(-25 19 25)" fill="#fff0cc"/><ellipse cx="28" cy="18" rx="4" ry="6" fill="#fff0cc"/><ellipse cx="38" cy="18" rx="4" ry="6" fill="#fff0cc"/><ellipse cx="47" cy="25" rx="4" ry="6" transform="rotate(25 47 25)" fill="#fff0cc"/><path d="m23 53 9 4 9-4" fill="none" stroke="#d28d45"/></g></svg>`;
const catnipIcon = `<svg class="spell-art" viewBox="0 0 64 64" aria-hidden="true"><g stroke="#547b50" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M30 54q4-17 9-34" fill="none"/><path d="M34 39Q9 41 13 19q25 1 21 20Z" fill="#a8c886"/><path d="M36 32Q35 10 55 11q2 23-19 21Z" fill="#78aa6a"/><path d="m19 26 15 13m15-21-13 14" fill="none" stroke="#e5edbc"/><path d="m32 48 1-9q19-2 18 12-11 4-19-3Z" fill="#92b977"/><path d="m8 43 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#f1d37f" stroke="#b6934f" stroke-width="1.4"/></g></svg>`;
const ring = '<svg class="spell-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="ring-track" cx="32" cy="32" r="29"/><circle class="ring-progress" cx="32" cy="32" r="29" pathLength="1"/></svg>';
export const spellControlsMarkup = `<div class="skill-gutter" aria-hidden="true"></div><div class="spell-rail" role="group" aria-label="主动技能">
  <button id="roar" class="spell-button spell-roar" aria-label="释放震退">${roarIcon}${ring}</button>
  <button id="catnip" class="spell-button spell-catnip" aria-label="释放猫薄荷">${catnipIcon}${ring}</button>
</div><div id="spell-subtitles" class="spell-subtitles" role="status" aria-live="polite" aria-atomic="true"></div>`;

export function installSpellControls(battle: Battle) {
  const subtitles = document.getElementById('spell-subtitles')!;
  const buttons = { roar: document.getElementById('roar') as HTMLButtonElement, catnip: document.getElementById('catnip') as HTMLButtonElement };
  let previous = '';
  return () => {
    const army = battle.armies.player, allies = battle.units.filter(unit => unit.side === 'player' && unit.hp > 0);
    for (const kind of ['roar','catnip'] as const) {
      const cooldown = kind === 'roar' ? army.roarCooldown : army.catnipCooldown;
      const duration = kind === 'roar' ? ROAR.cooldown : CATNIP.cooldown;
      const name = kind === 'roar' ? '震退' : '猫薄荷';
      const button = buttons[kind], empty = kind === 'catnip' && !allies.length;
      button.disabled = battle.phase !== 'playing' || cooldown > 0 || empty;
      button.style.setProperty('--cooldown-fraction', String(Math.max(0, Math.min(1,cooldown / duration))));
      button.dataset.cooling = String(cooldown > 0);
      button.dataset.active = String(kind === 'catnip' && allies.some(unit => unit.catnip > 0));
      const state = battle.phase === 'paused' ? '已暂停' : battle.phase !== 'playing' ? '当前不可释放'
        : cooldown > 0 ? `冷却剩余 ${Math.ceil(cooldown)} 秒` : empty ? '请先招募伙伴' : '可以释放';
      const label = `${name}，${state}`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
    }
    const notices = battle.phase === 'ready' || battle.phase === 'ended' ? [] : battle.spellNotices.visible(battle.time);
    const signature = `${battle.revision}:${notices.map(item=>item.id).join(',')}`;
    if (signature !== previous) {
      previous = signature;
      subtitles.replaceChildren(...notices.map(notice => {
        const card = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('span');
        const copy = spellNoticeText(notice);
        card.className = `spell-notice ${notice.side}`; card.dataset.spell = notice.spell; card.dataset.side = notice.side;
        title.textContent = copy.title; detail.textContent = copy.detail; card.append(title, detail); return card;
      }));
    }
  };
}
