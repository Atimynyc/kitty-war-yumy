import Phaser from 'phaser';
import type { Battle } from './simulation.ts';
import type { Side } from './content.ts';
import { baseCatLayout } from './base-cat-layout.ts';
import { baseCatParts, baseCatTexture, BASE_CAT_MOOD_PARTS } from './base-cat-art.ts';
import type { BaseCatPartName } from './base-cat-art.ts';
import { ORANGE_CAT, PLAYER_CAT, copyCat, catSignature } from './cat-appearance.ts';
import type { CatAppearance } from './cat-appearance.ts';
import { svgURL } from '../art.ts';
import { baseCatMotion } from './base-cat-motion.ts';

class SeatedCat {
  readonly root: Phaser.GameObjects.Container;
  private actor: Phaser.GameObjects.Container;
  private head: Phaser.GameObjects.Container;
  private pieces = {} as Record<BaseCatPartName, Phaser.GameObjects.Image>;
  private lastMood='calm';
  constructor(scene: Phaser.Scene, readonly side: Side, appearance = side==='enemy'?ORANGE_CAT:PLAYER_CAT, private textureSide: string = side) {
    this.root=scene.add.container(0,0).setDepth(5).setName(`camp-cat-${side}`);
    this.actor=scene.add.container(0,0);
    this.head=scene.add.container(0,-68);
    for(const part of baseCatParts(appearance,'calm',side==='enemy')) {
      const image=scene.add.image(part.x-80,part.y-160,baseCatTexture(textureSide,'calm',part.name)).setOrigin(part.x/160,part.y/160);
      this.pieces[part.name]=image;
      if(part.name==='shadow')this.root.add(image);
      else if(['head','eyes','leftEar','rightEar'].includes(part.name)) {image.y+=68;this.head.add(image);}
      else this.actor.add(image);
      if(part.name==='scarf')this.actor.add(this.head);
    }
    this.root.add(this.actor);
  }
  draw(battle: Battle,at: {x: number;y: number;size: number},reduced: boolean) {
    const speech=battle.baseDialogue.snapshot(battle.time),mood=this.side==='enemy'?speech.mood:'calm';
    // Paused/ended scenes retain their exact pose. The clock only advances during play.
    const m=baseCatMotion(battle.time,this.side,mood,speech.startedAt,reduced);
    if(mood!==this.lastMood){for(const part of BASE_CAT_MOOD_PARTS)this.pieces[part].setTexture(baseCatTexture(this.textureSide,mood,part));this.lastMood=mood;}
    this.root.setPosition(at.x,at.y).setScale(at.size/160).setVisible(this.side!=='enemy'||!battle.boss.spawned);
    this.actor.setY(-m.hop);
    this.pieces.body.setScale(1+m.breath*.55,1+m.breath);
    this.pieces.tail.setAngle(m.tailAngle);
    this.head.setPosition(m.headX,-68+m.headY).setAngle(m.headAngle);
    this.pieces.leftEar.setAngle(m.leftEarAngle);this.pieces.rightEar.setAngle(m.rightEarAngle);
    this.pieces.eyes.setScale(1,1-m.blink*.94);
    this.pieces.scarf.setY(-60+m.headY*.35);
    this.pieces.hands.setY(-46-m.pawLift);this.pieces.jar.setY(-25-m.pawLift*.25);
  }
  snapshot() {
    const round=(v: number)=>Math.round(v*10000)/10000;
    const pose=(node: Phaser.GameObjects.Image|Phaser.GameObjects.Container)=>({x:round(node.x),y:round(node.y),rotation:round(node.rotation),scaleX:round(node.scaleX),scaleY:round(node.scaleY)});
    return {visible:this.root.visible,mood:this.lastMood,...pose(this.root),actor:pose(this.actor),head:pose(this.head),parts:Object.fromEntries(Object.entries(this.pieces).map(([name,node])=>[name,pose(node)]))};
  }
  destroy(){this.root.destroy(true);}
}

/** The enemy mascot leaves its cushion when the final-level boss enters battle. */
export class BaseCatView {
  private cats: Record<Side,SeatedCat>;
  private appearance=copyCat(PLAYER_CAT);
  private textureKeys: string[]=[];
  private generation=0;
  private disposed=false;
  constructor(private scene: Phaser.Scene) {this.cats={player:new SeatedCat(scene,'player'),enemy:new SeatedCat(scene,'enemy')};}
  getPlayerAppearance(){return copyCat(this.appearance);}
  /** Decode offscreen, then swap the whole puppet atomically. Old images stay usable on failure. */
  async setPlayerAppearance(appearance: CatAppearance) {
    const generation=++this.generation;
    if(catSignature(appearance)===catSignature(this.appearance))return;
    const cat=copyCat(appearance),parts=baseCatParts(cat);
    const images=await Promise.all(parts.map(part=>new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      const timer=window.setTimeout(()=>{img.onload=null;img.onerror=null;reject(new Error('猫咪图片加载超时，请重试。'));},8000);
      img.onload=()=>{clearTimeout(timer);resolve(img);};
      img.onerror=()=>{clearTimeout(timer);reject(new Error('猫咪图片未能加载，请重试。'));};
      img.src=svgURL(part.svg);
    })));
    if(this.disposed||generation!==this.generation)return;
    const side=`custom-${generation}`,keys=parts.map(part=>baseCatTexture(side,'calm',part.name));
    try {
      images.forEach((img,i)=>{if(!this.scene.textures.addImage(keys[i],img))throw new Error('猫咪图片未能应用，请重试。');});
      const next=new SeatedCat(this.scene,'player',cat,side);
      next.root.setPosition(this.cats.player.root.x,this.cats.player.root.y).setScale(this.cats.player.root.scaleX);
      this.cats.player.destroy();this.cats.player=next;
    } catch(error) {keys.forEach(key=>this.scene.textures.remove(key));throw error;}
    this.textureKeys.forEach(key=>this.scene.textures.remove(key));
    this.textureKeys=keys;this.appearance=cat;
  }
  draw(battle: Battle,width: number,height: number,reduced: boolean) {
    const layout=baseCatLayout(width,height);
    for(const side of ['player','enemy'] as const)this.cats[side].draw(battle,layout[side],reduced);
  }
  snapshot(){return {player:this.cats.player.snapshot(),enemy:this.cats.enemy.snapshot()};}
  destroy(){this.disposed=true;this.generation++;this.cats.player.destroy();this.cats.enemy.destroy();this.textureKeys.forEach(key=>this.scene.textures.remove(key));}
}
