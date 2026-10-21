export type LayoutMode = 'portrait' | 'compact-landscape' | 'desktop';

export function chooseLayout(width: number, height: number): LayoutMode {
  if (width <= 1100 && height >= width) return 'portrait';
  if (width <= 1100 || (height <= 600 && width <= 1500)) return 'compact-landscape';
  return 'desktop';
}

export function installViewport() {
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const viewport = window.visualViewport;
    // Preserve browser pinch zoom: changing the game layout during a pinch fights the user.
    const height = viewport && Math.abs(viewport.scale - 1) < .01 ? viewport.height : window.innerHeight;
    const width = document.documentElement.clientWidth;
    const layout = chooseLayout(width, height);
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    const styles = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(styles.getPropertyValue('--safe-top')) || 0;
    const safeBottom = parseFloat(styles.getPropertyValue('--safe-bottom')) || 0;
    document.documentElement.dataset.density = height - safeTop - safeBottom < 500 ? 'tight' : 'normal';
    if (document.documentElement.dataset.layout !== layout) {
      document.documentElement.dataset.layout = layout;
      window.dispatchEvent(new CustomEvent('game-layout-change', { detail: layout }));
    }
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  update();
}
