import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../src/game/simulation.ts';
import { Battle as OldBattle } from '../analysis/spells-0.19/baseline-source/simulation.ts';
import { BOMBARD, TREAT, CATNIP, BASE_HP, UNITS } from '../src/game/content.ts';
import type { Side, UnitKind } from '../src/game/content.ts';
import { validBattleSave, readBattleSave } from '../src/game/battle-save.ts';
import { readProfile, emptyProfile, serializeProfile } from '../src/game/profile.ts';
import { spellNoticeText } from '../src/game/spell-notices.ts';

function create() { const b=new Battle(1234);b.start();b.aiEnabled=false;b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;return b; }
function spawn(b:Battle,side:Side,kind:UnitKind,x:number,row=1) {
  const a=b.armies[side];a.food=10000;a.tech=3;a.cooldowns[kind]=0;assert.ok(b.summon(side,kind));
  const u=b.units.at(-1)!;Object.assign(u,{x,row,targetRow:row,attackCooldown:1000});return u;
}
function advance(b:Battle,seconds:number,frozen=false) {
  const positions=b.units.map(u=>({id:u.id,x:u.x,row:u.row}));
  for(let t=0;t<seconds-1e-8;t+=1/30) {
    if(frozen)for(const u of b.units){const p=positions.find(p=>p.id===u.id);if(p){u.x=p.x;u.row=p.row;}}
    b.step(Math.min(1/30,seconds-t));
  }
}

test('emergency food heals only living wounded allies, respects individual caps and never repairs a base',()=>{
  for(const side of ['player','enemy'] as Side[]) {
    const b=create(),foe=side==='player'?'enemy':'player';
    const soldier=spawn(b,side,'soldier',500),shield=spawn(b,side,'shield',500),knight=spawn(b,side,'knight',500);
    const full=spawn(b,side,'mouse',500),dead=spawn(b,side,'mouse',500),enemy=spawn(b,foe,'soldier',800);
    soldier.hp=220;shield.hp=100;knight.hp=100;dead.hp=0;enemy.hp=10;b.armies[side].hp=2000;
    assert.ok(b.treat(side));assert.equal(soldier.hp,230);assert.equal(shield.hp,310);assert.equal(knight.hp,340);
    assert.equal(full.hp,85);assert.equal(dead.hp,0);assert.equal(enemy.hp,10);assert.equal(b.armies[side].hp,2000);
    assert.equal(b.armies[side].energy,15);assert.equal(b.armies[side].energyEarned,0);
    const notice=b.spellNotices.visible(b.time)[0];assert.equal(notice.affected,3);assert.equal(notice.total,460);
    assert.match(spellNoticeText(notice).detail,/共恢复 460/);
  }
});

test('three skill prices enforce a choice and unusable casts never spend, queue or count',()=>{
  const b=create();const ally=spawn(b,'player','soldier',400);
  assert.equal(b.treat('player'),false);assert.equal(b.bombard('player'),false);
  b.armies.player.energy=100;assert.equal(b.bombard('player'),false);
  assert.ok(b.catnip('player'));assert.equal(b.catnip('player'),false,'do not pay twice for a fresh buff');
  ally.hp=100;assert.ok(b.treat('player'));assert.equal(b.armies.player.energy,25);assert.equal(b.stats.casts,2);
  const before=b.save();b.togglePause();
  for(const kind of ['treat','catnip','bombard'] as const)assert.equal(b[kind]('player'),false);
  assert.deepEqual(b.save(),before);b.phase='ended';assert.equal(b.treat('player'),false);
});

test('bombardment chooses the densest group then the nearest equally dense threat',()=>{
  const b=create();spawn(b,'enemy','soldier',250);
  for(const row of [0,1,2])spawn(b,'enemy','soldier',900,row);
  b.armies.player.energy=100;assert.equal(b.bombardTarget('player')!.x,900);assert.ok(b.bombard('player'));
  const fx=b.effects.find(f=>f.type==='bombard')!;assert.equal(fx.targetX,900);assert.equal(fx.row,1);
  b.armies.player.energy=100;assert.equal(b.bombard('player'),false,'only one airborne strike per side');
  const c=create();spawn(c,'enemy','soldier',1100);spawn(c,'enemy','soldier',300);
  assert.equal(c.bombardTarget('player')!.x,300);
});

test('blast damage lands at the warned location after 0.65s, never follows a fleeing target and uses the cast-time tier',()=>{
  const b=create(),target=spawn(b,'enemy','soldier',700);
  b.armies.player.energy=100;b.armies.player.tech=1;assert.ok(b.bombard('player'));
  target.x=950;const arrived=spawn(b,'enemy','shield',700);b.armies.player.tech=3;
  advance(b,.64,true);assert.equal(arrived.hp,700);assert.equal(target.hp,230);
  advance(b,.02,true);assert.equal(arrived.hp,520);assert.equal(target.hp,230);
  advance(b,2,true);assert.equal(arrived.hp,520,'landing resolves only once');
  assert.equal(b.armies.player.energy,30);
});

test('blast geometry includes the exact radius, skips allies and bases, and honours ranged protection',()=>{
  const b=create(),center=spawn(b,'enemy','shield',700),edge=spawn(b,'enemy','shield',840);
  const outside=spawn(b,'enemy','shield',840.1),ally=spawn(b,'player','shield',700);
  center.guardUntil=100;b.armies.player.energy=70;
  // Lock on the center before the extra boundary fixture is introduced.
  b.units=[center,ally];assert.ok(b.bombard('player'));b.units.push(edge,outside);
  advance(b,.66,true);assert.equal(center.hp,700-300*.55);assert.equal(edge.hp,400);
  assert.equal(outside.hp,700);assert.equal(ally.hp,700);assert.equal(b.armies.player.hp,BASE_HP);assert.equal(b.armies.enemy.hp,BASE_HP);
});

test('bomb kills award normal energy once, release population, and cannot revive removed targets',()=>{
  const b=create();for(const row of [0,1,2])spawn(b,'enemy','soldier',700,row);
  b.armies.player.tech=3;b.armies.player.energy=70;assert.ok(b.bombard('player'));advance(b,.66,true);
  assert.equal(b.units.length,0);assert.equal(b.population('enemy'),0);assert.equal(b.armies.player.energy,12);
  assert.equal(b.armies.enemy.lost,3);advance(b,2);assert.equal(b.armies.player.energy,12);
});

test('hidden units and entering bosses cannot be targeted or harmed by a pending blast',()=>{
  const b=create(),cat=spawn(b,'player','assassin',700);cat.stealthUntil=100;b.armies.enemy.energy=100;
  assert.equal(b.bombard('enemy'),false);
  const c=create();c.reset('campaign-30');c.start();c.aiEnabled=false;c.armies.enemy.hp=850;c.step(.01);
  c.armies.player.energy=100;assert.equal(c.bombard('player'),false);
  advance(c,1.3);assert.ok(c.bombard('player'));advance(c,.7,true);
  assert.equal(c.units.find(u=>u.kind==='boss')!.hp,2600-BOMBARD.damage[0]);
});

test('simultaneous opposing bombs award both kills and a bomb that defeats the boss records the achievement',()=>{
  const b=create();for(const side of ['player','enemy'] as Side[])spawn(b,side,'soldier',side==='player'?500:900);
  for(const side of ['player','enemy'] as Side[]){b.armies[side].energy=70;assert.ok(b.bombard(side));}
  advance(b,.66,true);assert.equal(b.units.length,0);assert.equal(b.armies.player.energy,4);assert.equal(b.armies.enemy.energy,4);
  const c=create();c.reset('campaign-30');c.start();c.aiEnabled=false;c.armies.enemy.hp=850;c.step(.01);advance(c,1.3);
  c.units.find(u=>u.kind==='boss')!.hp=100;c.armies.player.energy=70;assert.ok(c.bombard('player'));advance(c,.7,true);
  assert.equal(c.stats.bossDefeated,true);assert.equal(c.armies.player.energy,50);assert.equal(c.armies.enemy.hp,850);
  advance(c,1);assert.equal(c.armies.player.energy,50);
});

test('airborne and landed bombs survive exact reload and pause without early or repeated damage',()=>{
  const a=create();spawn(a,'enemy','shield',700);a.armies.player.energy=100;assert.ok(a.bombard('player'));advance(a,.3);
  const b=new Battle();assert.ok(b.restore(a.save()));const paused=b.save();advance(b,10);assert.deepEqual(b.save(),paused);
  b.togglePause();advance(a,.4);advance(b,.4);assert.deepEqual(b.save(),a.save());
  const c=new Battle();assert.ok(c.restore(a.save()));c.togglePause();advance(a,1);advance(c,1);assert.deepEqual(c.save(),a.save());
  const invalid=b.save();invalid.effects.push({id:invalid.nextId++,type:'bombard',side:'player',x:700,targetX:700,row:1,age:0,duration:1,power:-1,landed:false});
  assert.equal(validBattleSave(invalid),false);
});

test('0.18 rounds migrate through both restore and profile loading without losing resources or past achievements',()=>{
  const old=new OldBattle();old.start();old.aiEnabled=false;old.armies.player.energy=100;
  old.summon('player','soldier');old.summon('enemy','soldier');old.units[1].x=300;
  old.catnip('player');old.roar('player');const original=old.save();
  const migrated=readBattleSave(original)!;assert.ok(migrated);assert.equal(migrated.rules,'0.20.0');
  assert.deepEqual(migrated.armies,original.armies);assert.deepEqual(migrated.units,original.units);
  assert.ok(migrated.effects.every(e=>(e.type as string)!=='roar'));assert.equal(migrated.notices.items.length,1);
  assert.equal(migrated.notices.items[0].energyCost,50);assert.equal(original.rules,'0.18.0');
  const b=new Battle();assert.ok(b.restore(original));assert.equal(b.phase,'paused');assert.equal(b.armies.player.energy,0);
  const p=JSON.parse(serializeProfile(emptyProfile()));p.run={battle:original,speed:2,awards:[]};
  const loaded=readProfile(JSON.stringify(p));assert.equal(loaded.profile.run!.battle.rules,'0.20.0');assert.equal(loaded.profile.run!.speed,2);assert.equal(loaded.migrated,true);
});
