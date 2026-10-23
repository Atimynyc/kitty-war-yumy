import type { Battle } from '../game/simulation.ts';
import { UNITS } from '../game/content.ts';
import { bossCharge } from '../game/boss-combat.ts';

export const bossStatusMarkup = `<section id="boss-status" class="boss-status" aria-label="大胖橘首领" hidden>
  <div><strong>大胖橘 · 守关首领</strong><span id="boss-health-text"></span></div>
  <div id="boss-health" class="boss-health" role="progressbar" aria-label="大胖橘生命" aria-valuemin="0"><i></i></div>
  <p id="boss-action" role="status" aria-live="polite"></p>
</section>`;
export function installBossStatus(battle: Battle) {
  const panel=document.getElementById('boss-status')!,health=document.getElementById('boss-health')!,bar=health.firstElementChild as HTMLElement;
  const count=document.getElementById('boss-health-text')!,action=document.getElementById('boss-action')!;
  return ()=>{
    panel.hidden=!battle.boss.spawned || battle.phase==='ready' || battle.phase==='ended';
    if(panel.hidden)return;
    const boss=battle.units.find(u=>u.id===battle.boss.unitId),hp=boss?.hp??0;
    count.textContent=`${Math.ceil(hp)} / ${UNITS.boss.hp}`;
    health.setAttribute('aria-valuemax',String(UNITS.boss.hp));health.setAttribute('aria-valuenow',String(Math.ceil(hp)));
    bar.style.width=`${Math.max(0,hp/UNITS.boss.hp*100)}%`;
    const charge=bossCharge(boss?.sweep);
    const text=!boss?'大胖橘已被击败！':boss.sweep?charge.swipe>0?'巨爪横扫！':charge.holding?'巨爪蓄满！即将横扫击退！':'慢慢抬爪…小心前排！':battle.time-boss.attackAt<.4?'巨爪重击！前排被推开！':battle.time-battle.boss.enteredAt<4?'我的冻干！本大橘亲自来！':'巨爪横扫 · 重击并击退';
    if(action.textContent!==text)action.textContent=text;
    panel.dataset.charging=String(Boolean(boss?.sweep));
  };
}
