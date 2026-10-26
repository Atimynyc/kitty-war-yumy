export class GameAudio {
  enabled = false;
  private context?: AudioContext;
  unlock() {
    // Some embedded browsers or OS audio backends cannot create an audio device.
    // Optional sound must never prevent the match from starting.
    try {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.context ??= new AudioContextClass();
      void this.context.resume().catch(() => undefined);
    } catch { this.context = undefined; }
  }
  play(type: 'hire' | 'upgrade' | 'roar' | 'catnip' | 'win' | 'lose' | 'tap') {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.context;
    if (!ctx) return;
    const notes: Record<typeof type, number[]> = { hire: [520, 690], catnip: [659, 784, 988], upgrade: [440, 554, 659], roar: [220, 170, 120], win: [523, 659, 784, 1046], lose: [392, 330, 262], tap: [650] };
    notes[type].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = type === 'roar' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      const start = ctx.currentTime + index * .09;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.075, start + .01); gain.gain.exponentialRampToValueAtTime(.001, start + .2);
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + .21);
    });
  }
}
