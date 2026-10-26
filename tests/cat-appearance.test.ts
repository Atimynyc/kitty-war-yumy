import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_OPTIONS, PLAYER_CAT, ORANGE_CAT, breedPreset, copyCat, readCatAppearance } from '../src/game/cat-appearance.ts';
import type { CatFeature } from '../src/game/cat-appearance.ts';
import { baseCatSVG } from '../src/game/base-cat-art.ts';
import { emptyProfile, readProfile, serializeProfile } from '../src/game/profile.ts';
import { Battle } from '../src/game/simulation.ts';
import { createSaveCoordinator } from '../src/ui/save-coordinator.ts';

test('v2/v3/v4 migration keeps campaign, legacy recruits and resumable battle with a default cat',()=>{
  const p=emptyProfile(),b=new Battle();b.start();b.step(2);p.run={battle:b.save(),speed:2,awards:[]};
  p.progress['campaign-01']={stars:3,bestTime:120,ratingVersion:2};p.legacyRecruits=['healer'];
  for(const version of [2,3,4]){
    const raw=JSON.parse(serializeProfile(p));raw.version=version;delete raw.cat;
    raw.achievements.stats.recruited=['healer'];
    const loaded=readProfile(JSON.stringify(raw));
    assert.equal(loaded.writable,true);assert.equal(loaded.migrated,true);
    assert.deepEqual(loaded.profile.cat,PLAYER_CAT);assert.deepEqual(loaded.profile.progress,p.progress);
    assert.deepEqual(loaded.profile.legacyRecruits,['healer']);assert.deepEqual(loaded.profile.run,p.run);
  }
});
test('all ten appearance dimensions survive saving without affecting a battle checkpoint',()=>{
  const p=emptyProfile(),b=new Battle();b.start();b.summon('player','soldier');b.step(3);
  p.run={battle:b.save(),speed:1,awards:[]};p.cat={...breedPreset('ragdoll'),face:'pointed',body:'slim',ears:'folded',tail:'short',eyeShape:'almond',mouth:'smile',nose:'heart',paws:'round',pattern:'calico'};
  p.cat.coat.body='#d99857';
  const result=readProfile(serializeProfile(p));
  assert.deepEqual(result.profile,p);assert.equal(result.migrated,false);
  const restored=new Battle();assert.equal(restored.restore(result.profile.run!.battle),true);
  assert.deepEqual(restored.armies,b.armies);assert.deepEqual(restored.units,b.units);
});
test('malformed cosmetics fall back without discarding unrelated progress, and cannot inject SVG',()=>{
  const cat=readCatAppearance({breed:'unknown',face:'<svg>',eyes:'url(https://x)',noseColor:'" onload="alert(1)',coat:{body:'<script>',head:'#AAbbCC',tail:null},paws:2});
  assert.equal(cat.coat.head,'#aabbcc');assert.equal(cat.coat.body,PLAYER_CAT.coat.body);
  assert.equal(cat.face,PLAYER_CAT.face);assert.doesNotMatch(baseCatSVG(cat),/script|onload|https:\/\/x/);
  const p=emptyProfile();p.progress['campaign-01']={stars:2,bestTime:170,ratingVersion:2};
  const raw=JSON.parse(serializeProfile(p));raw.cat=['broken'];
  const loaded=readProfile(JSON.stringify(raw));assert.equal(loaded.writable,true);assert.deepEqual(loaded.profile.progress,p.progress);assert.deepEqual(loaded.profile.cat,PLAYER_CAT);
  assert.equal(readProfile(JSON.stringify({version:6,cat})).writable,false);
});
test('all selectable shape variants produce distinct artwork; player edits leave enemy and defaults intact',()=>{
  const enemy=JSON.stringify(ORANGE_CAT),original=JSON.stringify(PLAYER_CAT);
  for(const key of ['face','body','ears','tail','eyeShape','mouth','nose','paws','pattern'] as CatFeature[]){
    const art=CAT_OPTIONS[key].map(([value])=>baseCatSVG({...copyCat(PLAYER_CAT),[key]:value}));
    assert.equal(new Set(art).size,CAT_OPTIONS[key].length,`${key} is visually distinct`);
  }
  const breeds=CAT_OPTIONS.breed.map(([id])=>baseCatSVG(breedPreset(id)));
  assert.equal(new Set(breeds).size,6);
  const edited=copyCat(PLAYER_CAT);edited.coat.body='#000000';
  assert.equal(JSON.stringify(ORANGE_CAT),enemy);assert.equal(JSON.stringify(PLAYER_CAT),original);
});
test('appearance save reports actual storage failure and supports a successful retry',async()=>{
  let writable=false;const statuses: string[]=[];
  const saver=createSaveCoordinator({save:async()=>writable},state=>statuses.push(state));
  const data=serializeProfile(emptyProfile());assert.equal(await saver.save(data),false);
  assert.equal(statuses.at(-1),'failed');writable=true;
  assert.equal(await saver.save(data),true);assert.equal(statuses.at(-1),'saved');
  assert.equal(await saver.save(data),true);
});
