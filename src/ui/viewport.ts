import { readWindowInfo } from './platform.ts';

export function installViewport() {
  document.documentElement.dataset.layout = 'portrait';
  let scheduled = false;
  let nativeWindowHeight: number | null = null;
  const update = () => {
    scheduled = false;
    const viewport = window.visualViewport;
    // Preserve browser pinch zoom: changing the game layout during a pinch fights the user.
    const height = nativeWindowHeight ?? (viewport && Math.abs(viewport.scale - 1) < .01 ? viewport.height : window.innerHeight);
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    document.documentElement.style.setProperty('--game-width', `${Math.min(520, Math.max(340, height * .66))}px`);
    const styles = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(styles.getPropertyValue('--safe-top')) || 0;
    const safeBottom = parseFloat(styles.getPropertyValue('--safe-bottom')) || 0;
    document.documentElement.dataset.density = height - safeTop - safeBottom < 500 ? 'tight' : 'normal';
    window.dispatchEvent(new Event('game-layout-change'));
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  let windowRequest = 0;
  const readNativeViewport = async () => {
    const request = ++windowRequest;
    const info = await readWindowInfo();
    if (!info || request !== windowRequest) return;
    nativeWindowHeight = info.windowHeight;
    const safe = info.safeArea;
    const buttonBottom = Math.max(0, ...Object.values(info.menuButtons || {}).map(button => button && Number.isFinite(button.bottom) ? button.bottom : 0));
    const finite = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, value!) : 0;
    const insets = { top: Math.max(finite(safe?.top), buttonBottom), bottom: safe ? finite(info.windowHeight - safe.bottom) : 0, left: finite(safe?.left), right: safe ? finite(info.windowWidth - safe.right) : 0 };
    for (const side of ['top', 'bottom', 'left', 'right'] as const) document.documentElement.style.setProperty(`--safe-area-inset-${side}`, `${insets[side]}px`);
    schedule();
    window.dispatchEvent(new Event('game-layout-change'));
  };
  let nativeResizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => { nativeWindowHeight = null; windowRequest++; clearTimeout(nativeResizeTimer); nativeResizeTimer = setTimeout(() => void readNativeViewport(), 100); });
  void readNativeViewport();
  update();
}
