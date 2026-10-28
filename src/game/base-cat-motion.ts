import type { Side } from './content.ts';
import type { CatMood } from './base-dialogue.ts';

const pulse=(phase: number,start: number,duration: number)=>{
  const t=(phase-start)/duration;
  return t>0&&t<1?Math.sin(Math.PI*t)**2:0;
};

/** Absolute combat time keeps idle motion deterministic across pauses, loads and skipped frames. */
export function baseCatMotion(time: number, side: Side, mood: CatMood, startedAt: number, reduced: boolean) {
  const still={breath:0,bodyAngle:0,headX:0,headY:0,headAngle:0,tailAngle:0,leftEarAngle:0,rightEarAngle:0,blink:0,pawLift:0,hop:0};
  if(reduced)return still;
  const enemy=side==='enemy',t=Math.max(0,time),offset=enemy ? .65 : 2.2;
  const breathe=Math.sin(t*(enemy?1.65:1.85)+offset);
  const glance=pulse((t+(enemy?1:5))%9,3,3.2);
  const sniff=pulse((t+(enemy?4:0))%8,4,1.7);
  const blinkPhase=(t+(enemy ? .7 : 2.6))%(enemy?6.4:5.8);
  const blink=Math.max(pulse(blinkPhase,3,.3),pulse(blinkPhase,3.48,.25));
  const earPhase=(t+(enemy?3.8:0))%9.6;
  const twitch=pulse(earPhase,4,.26)-.6*pulse(earPhase,4.3,.3);
  return {
    breath:breathe*.045,
    bodyAngle:Math.sin(t*.85+offset)*1.8,
    headX:Math.sin(t*1.15+offset)*3.2+glance*(enemy?-4:4),
    headY:-breathe*3.3-glance*1.4+sniff*3,
    headAngle:Math.sin(t*.85+offset)*4+glance*(enemy?-5:5),
    tailAngle:Math.sin(t*(enemy?1.7:1.35)+offset)*(enemy?30:26)+Math.sin(t*2.4+offset)*3,
    leftEarAngle:Math.sin(t*1.2+offset)*3+twitch*(enemy?-10:-14),rightEarAngle:Math.sin(t*1.1+offset+1)*3+twitch*(enemy?14:8),
    blink,pawLift:(.5+.5*Math.sin(t*1.4+offset))*2.8+sniff*3,
    hop:mood==='happy'?Math.abs(Math.sin((t-startedAt)*7))*2.5:0,
  };
}
