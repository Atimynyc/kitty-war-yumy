import Phaser from 'phaser';
import { unitParts } from './unit-art.ts';
import type { PartName } from './unit-art.ts';
import type { UnitLook } from './unit-art.ts';
import { unitMotion } from './unit-motion.ts';
import { BodyDirection } from './unit-facing.ts';
import type { Unit } from './simulation.ts';
import { isHidden } from './simulation.ts';
import { bossCharge } from './boss-combat.ts';
import { ORANGE_BOSS } from './content.ts';

/** One reusable puppet for the vertical battlefield. The root is the logical ground point. */
export class UnitView {
  readonly root: Phaser.GameObjects.Container;
  private actor: Phaser.GameObjects.Container;
  private facing: Phaser.GameObjects.Container;
  private torso: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private stars: Phaser.GameObjects.Image;
  private bossPaw?: Phaser.GameObjects.Image;
  private status: Phaser.GameObjects.Graphics;
  private pieces: Partial<Record<PartName, Phaser.GameObjects.Image>> = {};
  private pivots: Partial<Record<PartName, { x: number; y: number }>> = {};
  private state = 'idle';
  private drawn = false;
  private deathFacing?: number;
  private heading = 0;
  private aimRotation = 0;
  private look: UnitLook = 'back';
  private bodyDirection = new BodyDirection();

  constructor(scene: Phaser.Scene, readonly unit: Unit) {
    this.root = scene.add.container(0, 0).setName(`unit-${unit.id}`);
    this.shadow = scene.add.image(0, 0, 'unit-shadow');
    this.actor = scene.add.container(0, 0);
    this.facing = scene.add.container(0, 0);
    this.facing.add(this.actor);
    this.torso = scene.add.container(0, 0);
    this.stars = scene.add.image(0, 0, 'unit-stars').setVisible(false);
    this.status = scene.add.graphics();
    this.root.add([this.shadow, this.status, this.facing, this.stars]);
    for (const part of unitParts(unit.kind, unit.side)) {
      const image = scene.add.image(part.x - 64, part.y - 64, `${unit.side}-${unit.kind}-${part.name}`).setOrigin(part.x / 128, part.y / 128);
      this.pieces[part.name] = image;
      this.pivots[part.name] = { x: part.x - 64, y: part.y - 64 };
      if (part.name.endsWith('Foot')) this.actor.add(image); else this.torso.add(image);
    }
    this.actor.add(this.torso);
    if(unit.kind==='boss') {
      const paw=this.pieces.rightHand!;
      this.bossPaw=scene.add.image(0,0,paw.texture.key).setOrigin(paw.originX,paw.originY).setDepth(29).setVisible(false);
    }
    // Wheels remain on the ground; mouse/vehicle body and tool point toward the foe.
    if (unit.side === 'enemy' && (unit.kind === 'mouse' || unit.kind === 'catapult')) this.actor.setAngle(180);
  }

  draw(unit: Unit, now: number, x: number, y: number, size: number, reduced: boolean, facing: number, deathAt?: number) {
    const motion = unitMotion(unit, now, deathAt, reduced);
    const direction = unit.side === 'player' ? -1 : 1;
    const machine = unit.kind === 'mouse' || unit.kind === 'catapult';
    const localDirection = machine ? -1 : direction;
    const hidden = deathAt === undefined && isHidden(unit, now);
    const dodging = deathAt === undefined && now - (unit.dodgeAt ?? -100) < .3;
    this.state = hidden ? 'stealth' : dodging ? 'dodge' : motion.state;
    if (deathAt !== undefined) this.deathFacing ??= this.drawn ? this.heading : facing;
    this.heading = this.deathFacing ?? facing;
    const forward = { x: -Math.sin(this.heading) * direction, y: Math.cos(this.heading) * direction };
    const artwork = deathAt !== undefined && this.drawn ? { look:this.look,mirror:this.facing.scaleX } : this.bodyDirection.update(forward,now);
    const mirror = machine ? 1 : artwork.mirror;
    const localForward = machine ? { x: 0, y: direction } : { x: forward.x * mirror, y: forward.y };
    // Standing character art uses directional faces; only overhead vehicles rotate in the floor plane.
    this.facing.setRotation(machine ? this.heading : 0).setScale(mirror, 1);
    this.look = artwork.look;
    const aim = Math.atan2(localForward.y, localForward.x) - direction * Math.PI / 2;
    this.aimRotation = machine ? 0 : Math.atan2(Math.sin(aim), Math.cos(aim));
    this.drawn = true;
    this.status.clear();
    if (deathAt === undefined) {
      if ((unit.weakenedUntil ?? 0) > now) {
        this.status.fillStyle(0xc4b589, .4).fillEllipse(0, 46, 84, 20);
        this.status.lineStyle(3, 0xa18f62, 1).lineBetween(-9, -52, 0, -44).lineBetween(0, -44, 9, -52);
      }
      if ((unit.guardUntil ?? 0) > now) this.status.lineStyle(3, 0x88b89e, .8).strokeEllipse(0, 2, 112, 108);
      if ((unit.hasteUntil ?? 0) > now) {
        this.status.lineStyle(3, 0xd9ac5b, .95).lineBetween(-37, -32, -29, -41).lineBetween(-29, -41, -21, -32);
        this.status.fillStyle(0xd9ac5b, .95).fillCircle(40, -20, 4);
        this.status.lineStyle(2, 0xd9ac5b, 1).lineBetween(43, -20, 43, -34).lineBetween(43, -34, 50, -31);
      }
      if (unit.starSlow > 0 || unit.slow > 0) {
        this.status.lineStyle(3, 0x8b9bdf, .85).strokeEllipse(0, 48, 94, 25);
        this.status.lineStyle(3, 0xc0cafa, 1).lineBetween(-45, 31, -39, 38).lineBetween(-39, 38, -33, 31);
      }
      if (unit.catnip > 0) {
        this.status.lineStyle(3, 0x71a76b, .9).strokeEllipse(0, 46, 80, 18);
        for (const dx of [-45, 45]) {
          const lift = reduced ? 0 : Math.sin(now * 3 + dx) * 3;
          this.status.fillStyle(0x6da26b, .95).fillEllipse(dx, 10 + lift, 10, 19);
          this.status.lineStyle(1.5, 0xe3eec2, 1).lineBetween(dx, 4 + lift, dx, 19 + lift);
        }
      }
    }
    this.root.setPosition(x, y).setScale(size / 128).setAlpha(motion.alpha * (hidden ? .32 : 1)).setDepth(10 + y / 10000);
    const lunge = motion.attack * 8 - motion.windup * 3;
    this.actor.setPosition(-motion.fall * 8 * direction + localForward.x * lunge, motion.fall * 7 + localForward.y * lunge)
      .setAngle((machine && unit.side === 'enemy' ? 180 : 0) + motion.fall * 72 * direction);
    this.shadow.setScale(1 - motion.lift * .015, 1).setAlpha(1 - motion.fall * .4);
    this.stars.setVisible(motion.stars).setPosition(motion.fall * 20 * direction, 15);
    const recoil = motion.attack * 5 - motion.windup * 2 - motion.hit * 7;
    this.torso.setPosition(localForward.x * recoil, -motion.lift + (machine ? localDirection : localForward.y) * recoil)
      .setScale(1 + motion.hit * .045, 1 - motion.hit * .06).setAngle(motion.stride * 1.2 + motion.hit * 5);
    if (dodging && !reduced) { this.torso.x += Math.sin((now - unit.dodgeAt!) / .3 * Math.PI) * 14; this.torso.angle -= 12; }
    for (const [name, image] of Object.entries(this.pieces) as [PartName, Phaser.GameObjects.Image][]) {
      const pivot = this.pivots[name]!;
      if (!machine && (name === 'body' || name === 'rider')) image.setTexture(`${unit.side}-${unit.kind}-${name}-${this.look}`);
      image.setPosition(pivot.x, pivot.y).setRotation(0).setScale(1);
      image.setVisible(true);
      // Canvas tint support differs across browsers, so recoil/scale also carries the hit.
      if (motion.flash) image.setTint(0xffd4bb);
      else if (unit.slow > 0 || unit.starSlow > 0) image.setTint(0xd3dff5);
      else image.clearTint();
    }
    const left = this.pieces.leftFoot!, right = this.pieces.rightFoot!;
    if (unit.kind === 'knight') {
      // Diagonal pairs trot together; the rider and lance move independently of the mount.
      const rearLeft = this.pieces.rearLeftFoot!, rearRight = this.pieces.rearRightFoot!;
      for (const [foot, phase] of [[left, 1], [right, -1], [rearLeft, -1], [rearRight, 1]] as const) {
        foot.y += motion.stride * phase * 6;
        foot.setAngle(motion.stride * phase * 13);
        foot.setScale(1, 1 + Math.max(0, motion.stride * phase) * .1);
      }
      this.pieces.rider!.y -= Math.abs(motion.stride) * 2 + motion.windup * 2;
      this.pieces.rider!.setAngle(direction * (motion.attack * 7 - motion.windup * 4));
      this.pieces.leftHand!.setAngle(motion.stride * 3 + motion.hit * 8);
      this.pieces.rightHand!.y += direction * (motion.attack * 23 - motion.windup * 9);
      this.pieces.rightHand!.setAngle(direction * (motion.attack * 14 - motion.windup * 12) + motion.hit * 5);
      this.torso.y += localDirection * motion.attack * 3;
    } else if (machine) {
      const tread = Math.sin(motion.wheel * 3) * 1.8;
      left.y += tread; right.y -= tread;
      left.setScale(1, 1 + tread * .025); right.setScale(1, 1 - tread * .025);
      if (unit.kind === 'mouse') this.pieces.rightHand!.setRotation(motion.wheel * .8 + motion.attack * .7);
      else if (unit.side === 'player') {
        this.pieces.rightHand!.y += motion.attack * 10;
        this.pieces.rearLeftFoot!.y += motion.stride * 5; this.pieces.rearRightFoot!.y -= motion.stride * 5;
        this.pieces.leftHand!.y += motion.stride * .7;
      } else this.pieces.rightHand!.setRotation(motion.windup * -.25 + motion.attack * .65).setScale(1, 1 - motion.attack * .28);
    } else {
      left.y += motion.stride * 7; right.y -= motion.stride * 7;
      left.x -= Math.max(0, motion.stride) * 2; right.x += Math.max(0, -motion.stride) * 2;
      left.setScale(1 + Math.max(0, motion.stride) * .1); right.setScale(1 + Math.max(0, -motion.stride) * .1);
      const leftHand = this.pieces.leftHand!, rightHand = this.pieces.rightHand!;
      leftHand.y -= motion.stride * 3; rightHand.y += motion.stride * 3;
      leftHand.setAngle(motion.stride * 8 - motion.hit * 12 + motion.fall * 18);
      if (unit.kind === 'boss') {
        const charge=bossCharge(unit.sweep),raise=deathAt===undefined?charge.lift:0,age=now-unit.attackAt;
        const striking=deathAt===undefined && age>=0 && age<ORANGE_BOSS.recovery;
        const swipe=unit.sweep?charge.swipe:striking?1:0;
        const recover=striking?Math.max(0,1-age/ORANGE_BOSS.recovery):unit.sweep?1:0;
        const lifted=unit.sweep?raise:recover;
        // The palm grows with the lift, holds at full size, then crosses fast.
        rightHand.setScale(1+lifted*1.1);
        if(!reduced) {
          rightHand.y += -lifted*36+Math.sin(swipe*Math.PI/2)*recover*48;
          rightHand.x -= swipe*recover*72;
          rightHand.setAngle(-lifted*50+swipe*recover*115);
          leftHand.setAngle(lifted*12-swipe*recover*18);
          this.torso.setAngle(-lifted*4+swipe*recover*8+motion.hit*5);
        }
      } else if (unit.kind === 'gunner' || unit.kind === 'hook') {
        rightHand.y += motion.attack * 10 + motion.windup * 5;
        leftHand.setAngle(-motion.attack * 12);
      } else if (unit.kind === 'drummer') {
        leftHand.setAngle(-motion.attack * 28 + motion.windup * 15);
        rightHand.setAngle(motion.attack * 28 - motion.windup * 15);
      } else if (unit.kind === 'litter') {
        rightHand.setAngle(motion.windup * 48 - motion.attack * 65);
        rightHand.y += motion.windup * 8 - motion.attack * 12;
      } else if (unit.kind === 'boxer' || unit.kind === 'kungfu') {
        rightHand.y += direction * (motion.attack * 25 - motion.windup * 15);
        leftHand.setAngle(motion.attack * -20 + motion.windup * 12);
      } else if (unit.kind === 'umbrella') {
        rightHand.setAngle(motion.attack * 12);
      } else if (unit.kind === 'shield') {
        rightHand.y += direction * (motion.attack * 15 - motion.windup * 4);
        rightHand.setAngle(-direction * motion.attack * 12);
      } else if (unit.kind === 'slinger') {
        leftHand.y -= direction * motion.windup * 11;
        leftHand.x += motion.windup * 9;
        rightHand.setAngle(direction * (motion.attack * 24 - motion.windup * 8));
      } else if (unit.kind === 'mage') {
        rightHand.y += direction * (motion.attack * 16 - motion.windup * 8);
        rightHand.setAngle(direction * (motion.attack * 38 - motion.windup * 24) + (unit.side === 'enemy' ? Math.sin(motion.attack * Math.PI * 2) * 16 : 0));
        leftHand.y += direction * motion.attack * 6;
        if (unit.side === 'enemy') leftHand.setAngle(-motion.attack * 24 + motion.windup * 12);
      } else if (unit.kind === 'healer') {
        rightHand.y += direction * (motion.attack * 14 + motion.windup * 5);
        rightHand.setAngle(direction * motion.attack * (unit.side === 'enemy' ? 42 : 20));
        leftHand.y += direction * motion.attack * 8;
      } else rightHand.setAngle(direction * (motion.attack * 30 - motion.windup * 38) - motion.stride * 8);
      rightHand.rotation += motion.hit * .12 - motion.fall * .3;
    }
    if (!machine) {
      const hand = this.pieces.rightHand!;
      hand.rotation += this.aimRotation;
      const reach = unit.kind === 'knight' ? motion.attack * 23 - motion.windup * 9
        : unit.kind === 'shield' ? motion.attack * 15 - motion.windup * 4
        : unit.kind === 'mage' ? motion.attack * 16 - motion.windup * 8
        : unit.kind === 'healer' ? motion.attack * 14 + motion.windup * 5 : 0;
      hand.x += localForward.x * reach;
      hand.y += (localForward.y - direction) * reach;
    }
    if(this.bossPaw) {
      // Draw the giant paw over the front line, so crowded soldiers cannot hide the swing.
      const hand=this.pieces.rightHand!,front=deathAt===undefined && Boolean(unit.sweep || now-unit.attackAt<ORANGE_BOSS.recovery);
      this.bossPaw.setVisible(front);
      if(front) {
        const transform=hand.getWorldTransformMatrix().decomposeMatrix();
        this.bossPaw.setPosition(transform.translateX,transform.translateY).setRotation(transform.rotation)
          .setScale(transform.scaleX,transform.scaleY).setAlpha(motion.alpha).setTint(hand.tintTopLeft);
        hand.setVisible(false);
      }
    }
  }

  projectileOrigin() {
    const hand = this.pieces.rightHand!;
    if (this.unit.side === 'enemy') {
      const dy = this.unit.kind === 'mage' ? 26 : this.unit.kind === 'catapult' ? -52 : 14;
      return hand.getWorldTransformMatrix().transformPoint(0, dy);
    }
    // Friendly tools point up from their hand pivots.
    const dx = this.unit.kind === 'mage' ? -2 : 0;
    const dy = this.unit.kind === 'mage' ? -52 : this.unit.kind === 'catapult' ? -37 : this.unit.kind === 'gunner' ? -47 : this.unit.kind === 'hook' ? -40 : -21;
    return hand.getWorldTransformMatrix().transformPoint(dx, dy);
  }
  snapshot() {
    return { id: this.unit.id, kind: this.unit.kind, side: this.unit.side, state: this.state, x: this.root.x, y: this.root.y, alpha: this.root.alpha, facing: this.heading, targetId: this.unit.targetId,
      look: this.look, mirror: this.facing.scaleX, turning: this.bodyDirection.turning, spriteRotation: this.facing.rotation, aimRotation: this.aimRotation,
      body: { x: this.torso.x, y: this.torso.y, rotation: this.torso.rotation },
      charge:this.unit.kind==='boss'?bossCharge(this.unit.sweep):undefined,
      parts: Object.fromEntries(Object.entries(this.pieces).map(([name, piece]) => [name, { x: piece.x, y: piece.y, rotation: piece.rotation, scaleX: piece.scaleX, scaleY: piece.scaleY }])) };
  }
  destroy() { this.root.destroy(); this.bossPaw?.destroy(); }
}
