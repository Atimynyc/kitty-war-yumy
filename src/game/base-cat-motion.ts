import type { Side } from './content.ts';
import type { CatMood } from './base-dialogue.ts';

const pulse=(phase: number,start: number,duration: number)=>{
  const t=(phase-start)/duration;
  return t>0&&t<1?Math.sin(Math.PI*t)**2:0;
};

/** Absolute combat time keeps idle motion deterministic across pauses, loads and skipped frames. */
export function baseCatMotion(time: number, side: Side, mood: CatMood, startedAt: number, reduced: boolean) {
  const still={breath:0,headX:0,headY:0,headAngle:0,tailAngle:0,leftEarAngle:0,rightEarAngle:0,blink:0,pawLift:0,hop:0};
  if(reduced)return still;
  const enemy=side==='enemy',t=Math.max(0,time),offset=enemy ? .65 : 2.2;
  const breathe=Math.sin(t*(enemy?1.65:1.85)+offset);
  const glance=pulse((t+(enemy?1:5))%13,7,3.8);
  const blinkPhase=(t+(enemy ? .7 : 2.6))%(enemy?6.4:5.8);
  const blink=Math.max(pulse(blinkPhase,3,.3),pulse(blinkPhase,3.48,.25));
  const earPhase=(t+(enemy?3.8:0))%9.6;
  const twitch=pulse(earPhase,4,.26)-.6*pulse(earPhase,4.3,.3);
  return {
    breath:breathe*.027,
    headX:Math.sin(t*.72+offset)*1.2+glance*(enemy?-2.2:2.2),
    headY:-breathe*1.6-glance*.8,
    headAngle:Math.sin(t*.58+offset)*1.5+glance*(enemy?-3:3),
    tailAngle:Math.sin(t*(enemy?1.4:1.05)+offset)*(enemy?17:12)+Math.sin(t*2.4+offset)*2,
    leftEarAngle:twitch*(enemy?-8:-11),rightEarAngle:twitch*(enemy?11:6),
    blink,pawLift:(.5+.5*Math.sin(t*1.1+offset))*.9,
    hop:mood==='happy'?Math.abs(Math.sin((t-startedAt)*7))*2.5:0,
  };
}
