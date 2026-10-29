import { svgURL, unitPortraitSVG } from '../art.ts';
import { UNITS } from '../game/content.ts';
import { battleReport } from '../game/battle-report.ts';
import { levelNumber } from '../game/levels.ts';
import type { Battle } from '../game/simulation.ts';

export function resultDetailsMarkup() {
  return `<section id="result-detail-screen" class="menu-screen" hidden aria-labelledby="result-detail-title">
    <header class="result-detail-header"><button id="result-detail-back" class="menu-secondary" aria-label="返回对局结果">← 返回</button><div><h1 id="result-detail-title" tabindex="-1">本局详情</h1><p id="result-detail-level"></p></div></header>
    <div id="result-detail-body" tabindex="0" role="region" aria-label="本局统计和招募伙伴明细"></div>
  </section>`;
}

export function renderResultDetails(battle: Battle) {
  const report = battleReport(battle);
  const duration = `${Math.floor(report.duration / 60).toString().padStart(2, '0')}:${Math.floor(report.duration % 60).toString().padStart(2, '0')}`;
  const maxCount = report.recruits[0]?.count ?? 1;
  document.getElementById('result-detail-level')!.textContent = `第 ${levelNumber(battle.level)} 关 · ${battle.level.name}`;
  const body = document.getElementById('result-detail-body')!;
  body.innerHTML = `<dl class="battle-report-stats">
      <div><dt>战斗时长</dt><dd id="detail-duration">${duration}</dd></div>
      <div><dt>招募伙伴</dt><dd id="detail-total">${report.totalRecruited}<small> 位</small></dd></div>
      <div><dt>基地剩余血量</dt><dd id="detail-hp">${report.baseHp}<small> / ${report.baseMaxHp}</small></dd></div>
    </dl>
    <div class="recruit-report-heading"><h2>招募伙伴明细</h2><span>按数量从多到少</span></div>
    <p class="recruit-report-note">累计招募，包含已退场的伙伴。</p>
    ${report.recruits.length ? `<ol class="recruit-report-list">${report.recruits.map(({kind, count}) => `<li class="recruit-report-row" data-kind="${kind}" data-count="${count}" aria-label="${UNITS[kind].name}，招募 ${count} 位">
      <img src="${svgURL(unitPortraitSVG(kind))}" alt="" width="52" height="52" />
      <div class="recruit-report-partner"><span>${UNITS[kind].name}</span><div class="recruit-report-track" aria-hidden="true"><i style="width:${count / maxCount * 100}%"></i></div></div>
      <strong>× ${count}</strong>
    </li>`).join('')}</ol>` : !report.totalRecruited ? '<p class="recruit-report-empty">本局没有招募伙伴。</p>' : ''}
    ${report.unrecordedRecruits ? `<p class="recruit-report-unrecorded">另有 ${report.unrecordedRecruits} 位伙伴未记录兵种明细。</p>` : ''}`;
  body.scrollTop = 0;
}
