export type CatMood = 'hungry' | 'happy' | 'worried' | 'calm';
export type CatCue = 'opening' | 'feast' | 'protect';
const LINES: Record<CatCue, { text: string; mood: CatMood }> = {
  opening: { text: '我要吃冻干！快给我！', mood: 'hungry' },
  feast: { text: '真好吃！', mood: 'happy' },
  protect: { text: '不！我自己都不够吃。', mood: 'worried' },
};

/** Narrative follows combat time: pausing, speed changes and replay use the same clock. */
export class BaseDialogue {
  private cue: CatCue | null = null;
  private startedAt = 0;
  private until = 0;
  private nextAllowed = { opening: 0, feast: 0, protect: 0 };
  save() { return { cue: this.cue, startedAt: this.startedAt, until: this.until, nextAllowed: { ...this.nextAllowed } }; }
  restore(s: ReturnType<BaseDialogue['save']>) { this.cue = s.cue; this.startedAt = s.startedAt; this.until = s.until; this.nextAllowed = { ...s.nextAllowed }; }

  reset() {
    this.cue = null; this.startedAt = 0; this.until = 0;
    this.nextAllowed = { opening: 0, feast: 0, protect: 0 };
  }
  start(now: number) { this.say('opening', now, 5); }
  onBaseDamage(now: number, playerDamage: number, enemyDamage: number) {
    // Protecting his own pantry wins when both bases are hit in the same tick.
    const cue = enemyDamage > 0 ? 'protect' : playerDamage > 0 ? 'feast' : null;
    if (!cue || now < this.nextAllowed[cue]) return;
    if (now < this.until && (cue === this.cue || (this.cue === 'protect' && cue === 'feast'))) return;
    this.say(cue, now, 4);
  }
  private say(cue: CatCue, now: number, duration: number) {
    this.cue = cue; this.startedAt = now; this.until = now + duration;
    this.nextAllowed[cue] = now + 9;
  }
  snapshot(now: number) {
    const cue = now < this.until ? this.cue : null;
    return { cue, text: cue ? LINES[cue].text : '', mood: cue ? LINES[cue].mood : 'calm' as CatMood,
      startedAt: this.startedAt, remaining: Math.max(0, this.until - now) };
  }
}
