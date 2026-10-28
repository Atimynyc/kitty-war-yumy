import { icons } from '../art.ts';
import type { AudioSettings, GameAudio } from '../game/audio.ts';
import { createProgressStore } from './platform.ts';

export const settingsMarkup = `<dialog id="settings-dialog" aria-labelledby="settings-title">
  <button class="dialog-close" id="settings-close" aria-label="关闭设置">×</button>
  <div class="settings-heading"><span class="settings-emblem">${icons.settings}</span><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="settings-title">设置</h2></div></div>
  <section class="settings-section" aria-labelledby="settings-sound-title">
  <h3 id="settings-sound-title">${icons.sound}声音</h3>
  <label class="audio-master"><span>开启声音<small>快捷键 M 可一键静音</small></span><input id="audio-enabled" type="checkbox" /></label>
  <div class="audio-volume"><label for="audio-music">背景音乐</label><output id="audio-music-value" for="audio-music"></output><input id="audio-music" type="range" min="0" max="100" step="1" /><small>小窝旋律 · 战斗节奏 · 胖橘登场</small></div>
  <div class="audio-volume"><label for="audio-effects">游戏音效</label><output id="audio-effects-value" for="audio-effects"></output><input id="audio-effects" type="range" min="0" max="100" step="1" /><small>招募、攻击、技能与胜负提示</small></div>
  <p id="audio-save-status" class="audio-hint" role="status">音量调到 0 可单独关闭；设置保存在当前设备。</p>
  </section>
  <div class="audio-actions"><button id="audio-preview" class="menu-secondary">试听音效 ♪</button><button id="settings-done" class="primary-button">完成</button></div>
</dialog>`;

export function installSettings(audio: GameAudio, qa: boolean, changed: (open: boolean) => void) {
  const dialog = document.querySelector<HTMLDialogElement>('#settings-dialog')!;
  const master = document.querySelector<HTMLInputElement>('#audio-enabled')!;
  const settingsButton = document.querySelector<HTMLButtonElement>('#settings')!;
  const hint = document.querySelector<HTMLElement>('#audio-save-status')!;
  const store = createProgressStore(qa ? 'paw-pantry-audio-qa-v1' : 'paw-pantry-audio-v1');
  let edited = false, loaded = false;
  const update = () => {
    const settings = audio.preferences;
    master.checked = settings.enabled;
    for (const bus of ['music', 'effects'] as const) {
      const input = document.querySelector<HTMLInputElement>(`#audio-${bus}`)!, value = Math.round(settings[bus] * 100);
      input.value = String(value); input.setAttribute('aria-valuetext', value ? `${value}%` : '关闭');
      document.querySelector(`#audio-${bus}-value`)!.textContent = value ? `${value}%` : '关闭';
    }
  };
  const save = async () => {
    if (!loaded) return;
    const ok = await store.save(JSON.stringify({ version: 1, ...audio.preferences }));
    hint.textContent = ok ? '音量调到 0 可单独关闭；设置已保存。' : '设置已生效，本次未能保存；下次打开可能需要重新设置。';
  };
  const configure = (settings: Partial<AudioSettings>) => {
    edited = true; audio.configure(settings); audio.unlock(); update(); void save();
  };
  void store.load().then(raw => {
    if (!edited && raw) {
      try { const settings = JSON.parse(raw); if (settings?.version === 1) audio.configure(settings); } catch { /* Invalid preferences use defaults. */ }
    }
    loaded = true; update(); if (edited) void save();
  });
  const toggleSound = () => { configure({ enabled: !audio.enabled }); audio.play('tap'); };
  settingsButton.addEventListener('click', () => {
    if (dialog.open) return;
    dialog.showModal(); settingsButton.setAttribute('aria-expanded', 'true'); changed(true);
  });
  master.addEventListener('change', () => configure({ enabled: master.checked }));
  for (const bus of ['music', 'effects'] as const) {
    document.querySelector<HTMLInputElement>(`#audio-${bus}`)!.addEventListener('input', event => configure({ [bus]: Number((event.target as HTMLInputElement).value) / 100 }));
  }
  document.querySelector('#audio-preview')!.addEventListener('click', () => audio.play('hire'));
  for (const id of ['settings-close', 'settings-done']) document.getElementById(id)!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { settingsButton.setAttribute('aria-expanded', 'false'); changed(false); });
  document.addEventListener('pointerdown', event => { if (event.isTrusted) audio.unlock(); }, { capture: true });
  document.addEventListener('keydown', event => { if (event.isTrusted && !event.repeat && event.key.toLowerCase() !== 'm') audio.unlock(); }, { capture: true });
  document.addEventListener('click', event => {
    if (event.isTrusted) audio.unlock(); // Touch browsers may grant activation only on click.
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (!/^(hire-|upgrade-|audio-|bombard$|treat$|catnip$)/.test(button.id)) audio.play('tap');
  });
  update();
  return { dialog, toggleSound };
}
