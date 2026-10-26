import { ACHIEVEMENTS, TITLES, clone, emptyAchievements, unlockAchievements } from './achievements.ts';
import type { Achievements } from './achievements.ts';
import { readProgress, serializeProgress, isLevelUnlocked } from './levels.ts';
import type { CampaignProgress } from './levels.ts';
import { kinds, number, object, readBattleSave } from './battle-save.ts';
import type { BattleSave } from './battle-save.ts';
import { UNIT_ORDER } from './content.ts';
import type { UnitKind } from './content.ts';
import { readCatAppearance } from './cat-appearance.ts';
import type { CatAppearance } from './cat-appearance.ts';

export interface SavedRun { battle: BattleSave; speed: 1 | 2; awards: string[] }
export interface Profile { version: 5; progress: CampaignProgress; achievements: Achievements; run: SavedRun | null; legacyRecruits: UnitKind[]; cat: CatAppearance }
export const emptyProfile = (): Profile => ({ version: 5, progress: {}, achievements: emptyAchievements(), run: null, legacyRecruits: [], cat:readCatAppearance(null) });
const ids = ACHIEVEMENTS.map(a=>a.id);
function readAchievements(raw: unknown): Achievements {
  const data = emptyAchievements(); if (!object(raw)) return data;
  if (object(raw.stats)) {
    for (const key of ['gunnerDamage','prevented','dodges','hookTargets','boxerTargets'] as const) if (number(raw.stats[key])) data.stats[key]=raw.stats[key];
    for (const key of ['recruited','drummed'] as const) if (kinds(raw.stats[key])) data.stats[key]=clone(raw.stats[key]);
    if (Array.isArray(raw.stats.flags)) data.stats.flags=ids.filter(id=>raw.stats.flags.includes(id));
  }
  for (const id of ids) {
    const entry = raw.unlocked?.[id];
    if (object(entry) && number(entry.unlockedAt,0,1e15) && ['play','migration'].includes(entry.source)) data.unlocked[id]={unlockedAt:entry.unlockedAt,source:entry.source};
  }
  data.equippedTitle = TITLES.some(t=>t.id===raw.equippedTitle&&Object.keys(data.unlocked).length>=t.count) ? raw.equippedTitle : null;
  if (Array.isArray(raw.unseenIds)) data.unseenIds=ids.filter(id=>data.unlocked[id]&&raw.unseenIds.includes(id));
  return data;
}
export function readProfile(raw: string | null, now = Date.now()) {
  const profile=emptyProfile();
  const result={profile,writable:true,notice:'',migrated:false};
  if (raw === null) return result;
  try {
    if (raw.length > 1000000) throw new Error('oversized');
    const parsed=JSON.parse(raw);
    if (!object(parsed)) throw new Error('shape');
    if ((parsed.version !== undefined && ![2,3,4,5].includes(parsed.version)) || (parsed.achievements?.rulesVersion ?? 1) !== 1) {
      result.writable=false; result.notice='存档来自其他版本，已保留原记录；本次试玩不会覆盖它。'; return result;
    }
    profile.progress=readProgress(raw);
    profile.cat=readCatAppearance(parsed.cat);
    profile.achievements=readAchievements(parsed.achievements);
    profile.legacyRecruits=UNIT_ORDER.filter(k=>parsed.version>=4 ? Array.isArray(parsed.legacyRecruits)&&parsed.legacyRecruits.includes(k) : profile.achievements.stats.recruited.includes(k));
    const migrated = unlockAchievements(profile.achievements,profile.progress,'migration',now);
    result.migrated=parsed.version!==5 || migrated.length>0;
    if (migrated.length) result.notice=`已补发 ${migrated.length} 项成就，原有关卡成绩已保留。`;
    if (parsed.run != null) {
      const r=parsed.run;
      const saved=object(r) ? readBattleSave(r.battle) : null;
      if (saved&&(r.speed===1||r.speed===2)&&isLevelUnlocked(saved.levelId,profile.progress)) {
        profile.run={battle:saved,speed:r.speed,awards:ids.filter(id=>Array.isArray(r.awards)&&r.awards.includes(id)&&profile.achievements.unlocked[id])};
        if(saved.legacyRoster) profile.legacyRecruits=UNIT_ORDER.filter(k=>profile.legacyRecruits.includes(k)||saved.stats.recruited.includes(k)||saved.units.some(u=>u.side==='player'&&u.kind===k));
        if(saved.rules!==r.battle.rules)result.migrated=true;
      }
      else result.notice='未完对局的版本或内容不兼容，无法续玩；关卡成绩与成就已保留。';
    }
    return result;
  } catch {
    result.writable=false; result.notice='暂时无法读取存档，已保留原记录；本次试玩不会覆盖它。'; return result;
  }
}
export function serializeProfile(profile: Profile) {
  const campaigns=JSON.parse(serializeProgress(profile.progress));
  return JSON.stringify({ ...campaigns, version:5, achievements:profile.achievements, run:profile.run, legacyRecruits:profile.legacyRecruits, cat:readCatAppearance(profile.cat) });
}
