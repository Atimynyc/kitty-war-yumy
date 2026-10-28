export type MusicScene = 'menu' | 'battle' | 'boss' | 'silent';
export type Sound = 'tap' | 'hire' | 'upgrade' | 'research' | 'bombard' | 'impact' | 'treat' | 'catnip' | 'hit' | 'shot' | 'magic' | 'cannon' | 'baseHit' | 'boss' | 'sweep' | 'win' | 'lose';
export interface AudioSettings { enabled: boolean; music: number; effects: number }
type Bus = 'music' | 'effects';
type Voice = { source: AudioScheduledSourceNode; gain: GainNode; nodes: AudioNode[]; bus: Bus };

// Original eight-bar theme; a second pass varies the register and ornamentation.
const MELODY = [
  [76, 0, 79, 81, 79, 76, 74, 0], [72, 0, 76, 79, 76, 74, 72, 0],
  [69, 0, 72, 76, 74, 72, 69, 0], [71, 74, 79, 0, 77, 74, 71, 0],
  [76, 79, 84, 0, 83, 81, 79, 76], [81, 0, 79, 76, 74, 72, 69, 0],
  [74, 77, 81, 0, 79, 77, 74, 71], [72, 76, 79, 0, 74, 71, 72, 0],
];
const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Small, offline score and soft toy percussion, all driven by the audio clock. */
export class GameAudio {
  private settings: AudioSettings = { enabled: true, music: .38, effects: .65 };
  private context?: AudioContext;
  private buses?: Record<Bus, GainNode>;
  private noise?: AudioBuffer;
  private voices = new Set<Voice>();
  private lastSound = new Map<Sound, number>();
  private timer?: ReturnType<typeof setInterval>;
  private scene: MusicScene = 'silent';
  private hidden = false;
  private nextNote = 0;
  private step = 0;
  private resuming = false;
  private unavailable = false;
  private played = 0;

  get enabled() { return this.settings.enabled; }
  get preferences() { return { ...this.settings }; }
  configure(settings: Partial<AudioSettings>) {
    if (typeof settings.enabled === 'boolean') this.settings.enabled = settings.enabled;
    for (const bus of ['music', 'effects'] as const) {
      const value = settings[bus];
      if (typeof value === 'number' && Number.isFinite(value)) this.settings[bus] = Math.max(0, Math.min(1, value));
    }
    this.applyVolumes();
    if (!this.enabled || !this.settings.effects) this.stopVoices('effects');
    this.syncMusic();
  }

  // Called only by a trusted pointer/key gesture. A failed audio device is optional.
  unlock() {
    if (!this.enabled || this.hidden || this.unavailable || this.resuming) return;
    try {
      if (!this.context) {
        const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) { this.unavailable = true; return; }
        const ctx = new AudioContextClass();
        this.context = ctx;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 5;
        compressor.connect(ctx.destination);
        this.buses = { music: ctx.createGain(), effects: ctx.createGain() };
        this.buses.music.connect(compressor); this.buses.effects.connect(compressor);
        this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        let seed = 7919;
        for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
        ctx.onstatechange = () => this.syncMusic();
        this.applyVolumes();
      }
      if (this.context.state === 'running') { this.syncMusic(); return; }
      if (this.context.state === 'closed') return;
      this.resuming = true;
      void this.context.resume().then(() => { this.resuming = false; this.syncMusic(); }, () => { this.resuming = false; });
    } catch {
      this.unavailable = true;
      this.stopMusic(); this.stopVoices('effects');
      void this.context?.close().catch(() => undefined);
    }
  }

  setScene(scene: MusicScene) {
    if (scene === this.scene) return;
    this.scene = scene;
    this.stopMusic(); this.step = 0;
    // Drop queued combat tails when pausing or opening another screen.
    this.stopVoices('effects');
    this.syncMusic();
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden; this.applyVolumes();
    if (hidden) this.stopVoices('effects');
    this.syncMusic();
  }
  private applyVolumes() {
    if (!this.context || !this.buses) return;
    for (const bus of ['music', 'effects'] as const) {
      const gain = this.buses[bus].gain, now = this.context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.enabled && !this.hidden ? this.settings[bus] : 0, now, .015);
    }
  }
  private syncMusic() {
    if (!this.enabled || this.hidden || !this.settings.music || this.scene === 'silent' || this.context?.state !== 'running' || this.unavailable) {
      this.stopMusic(); return;
    }
    if (this.timer !== undefined) return;
    this.nextNote = this.context.currentTime + .035;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 30);
  }
  private stopMusic() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.stopVoices('music');
  }
  private stopVoices(bus: Bus) {
    const now = this.context?.currentTime ?? 0;
    for (const voice of this.voices) if (voice.bus === bus) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, .006);
      try { voice.source.stop(now + .025); } catch { /* Already finished. */ }
      this.voices.delete(voice);
    }
  }
  private voice(source: AudioScheduledSourceNode, nodes: AudioNode[], bus: Bus, start: number, duration: number, volume: number, attack = .006) {
    const ctx = this.context!, gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration / 3));
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    let previous: AudioNode = source;
    for (const node of nodes) { previous.connect(node); previous = node; }
    previous.connect(gain); gain.connect(this.buses![bus]);
    const voice = { source, nodes, gain, bus };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); nodes.forEach(node => node.disconnect()); gain.disconnect(); this.voices.delete(voice); };
    source.start(start); source.stop(start + duration + .02);
  }
  private tone(bus: Bus, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', end = frequency, attack = .006) {
    const osc = this.context!.createOscillator(); osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (end !== frequency) osc.frequency.exponentialRampToValueAtTime(end, start + duration);
    this.voice(osc, [], bus, start, duration, volume, attack);
  }
  private rustle(bus: Bus, start: number, duration: number, volume: number, frequency: number) {
    const source = this.context!.createBufferSource(), filter = this.context!.createBiquadFilter();
    source.buffer = this.noise!; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .7;
    this.voice(source, [filter], bus, start, duration, volume);
  }
  private pluck(bus: Bus, note: number, start: number, duration: number, volume: number) {
    this.tone(bus, hz(note), start, duration, volume);
    this.tone(bus, hz(note) * 2, start, duration * .45, volume * .22);
  }
  private schedule() {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;
    const boss = this.scene === 'boss', menu = this.scene === 'menu';
    const eighth = 30 / (boss ? 124 : menu ? 96 : 112);
    // After a stalled tab, resume in real time without playing a backlog of notes.
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + .025;
    while (this.nextNote < ctx.currentTime + .14) {
      const beat = this.step % 8, bar = Math.floor(this.step / 8) % 8, secondPass = Math.floor(this.step / 64) % 2;
      const chord = CHORDS[bar], transpose = boss ? -3 : 0, at = this.nextNote + (beat % 2 ? .012 : 0);
      const note = MELODY[bar][beat];
      if (note) this.pluck('music', note + transpose + (secondPass && bar >= 6 ? 12 : 0), at, menu ? .42 : .3, menu ? .105 : .09);
      if (beat % 2 === 0) this.pluck('music', chord[(beat / 2) % 3] + 12 + transpose, at + .015, .32, .036);
      if (beat === 0 || beat === 4) {
        this.tone('music', hz(chord[beat === 0 ? 0 : 2] + transpose - 12), at, eighth * 1.6, .095, 'triangle');
        if (!menu) this.tone('music', 115, at, .14, boss ? .14 : .09, 'sine', 48);
      }
      if (beat === 0) for (const n of chord) this.tone('music', hz(n + transpose + 12), at, eighth * 7, .022, 'sine', hz(n + transpose + 12), .15);
      if (!menu && (beat === 2 || beat === 6)) this.rustle('music', at, .1, .075, 1400);
      if (beat % 2 === 1) this.rustle('music', at, .045, menu ? .015 : .032, 4800);
      if (secondPass && beat === 7 && !note) this.pluck('music', chord[2] + 24 + transpose, at, .15, .035);
      this.nextNote += eighth; this.step = (this.step + 1) % 128;
    }
  }

  play(type: Sound) {
    const ctx = this.context;
    if (!this.enabled || !this.settings.effects || this.hidden || this.unavailable || ctx?.state !== 'running') return;
    const now = ctx.currentTime;
    const interval = ({ hit: .12, shot: .14, magic: .18, cannon: .22, baseHit: .65, impact: .18, treat: .3, catnip: .3, tap: .055 } as Partial<Record<Sound, number>>)[type] ?? .1;
    if (now - (this.lastSound.get(type) ?? -100) < interval) return;
    // Cap combat polyphony; loud crowds should not bury player feedback.
    const combat = ['hit', 'shot', 'magic', 'cannon', 'baseHit', 'sweep'].includes(type);
    if (this.voices.size > (combat ? 38 : 64)) return;
    this.lastSound.set(type, now); this.played++;
    const at = now + .008;
    const melody: Partial<Record<Sound, number[]>> = {
      tap: [79], hire: [72, 79], upgrade: [60, 64, 67], research: [72, 76, 79, 84],
      treat: [76, 79, 84], catnip: [74, 78, 81, 86], win: [72, 76, 79, 84, 79, 84], lose: [71, 69, 64, 60],
    };
    if (melody[type]) {
      const result = type === 'win' || type === 'lose';
      melody[type]!.forEach((note, i) => this.pluck('effects', note, at + i * (result ? .16 : .075), result ? .5 : .22, type === 'tap' ? .07 : .17));
      if (type === 'win') [48, 52, 55].forEach(note => this.tone('effects', hz(note), at + .48, .9, .07));
    } else if (type === 'hit') {
      this.tone('effects', 240, at, .075, .09, 'triangle', 115); this.rustle('effects', at, .06, .06, 950);
    } else if (type === 'shot') {
      this.tone('effects', 670, at, .11, .08, 'sine', 280);
    } else if (type === 'magic') {
      this.pluck('effects', 88, at, .19, .075); this.pluck('effects', 95, at + .045, .17, .045);
    } else if (type === 'bombard') {
      this.tone('effects', 1000, at, .48, .13, 'sine', 160); this.rustle('effects', at, .25, .08, 1700);
    } else if (type === 'impact' || type === 'cannon' || type === 'baseHit') {
      const heavy = type === 'impact';
      this.tone('effects', heavy ? 160 : 130, at, heavy ? .38 : .2, heavy ? .32 : .19, 'sine', 45);
      this.rustle('effects', at, heavy ? .26 : .13, heavy ? .28 : .15, heavy ? 650 : 950);
    } else if (type === 'sweep') {
      this.rustle('effects', at, .3, .22, 700); this.tone('effects', 220, at + .06, .24, .16, 'triangle', 60);
    } else if (type === 'boss') {
      [48, 43, 36].forEach((note, i) => this.tone('effects', hz(note), at + i * .19, .42, .16, 'triangle'));
      this.rustle('effects', at, .55, .19, 450);
    }
  }
  snapshot() {
    return { ...this.settings, scene: this.scene, context: this.unavailable ? 'unavailable' : this.context?.state ?? 'locked', hidden: this.hidden, musicPlaying: this.timer !== undefined, voices: this.voices.size, effectsPlayed: this.played };
  }
  dispose() {
    this.stopMusic(); this.stopVoices('effects');
    if (this.context) { this.context.onstatechange = null; void this.context.close().catch(() => undefined); }
  }
}
