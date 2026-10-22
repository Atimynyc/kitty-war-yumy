export function installViewport() {
  document.documentElement.dataset.layout = 'portrait';
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const viewport = window.visualViewport;
    // Preserve browser pinch zoom: changing the game layout during a pinch fights the user.
    const height = viewport && Math.abs(viewport.scale - 1) < .01 ? viewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    const styles = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(styles.getPropertyValue('--safe-top')) || 0;
    const safeBottom = parseFloat(styles.getPropertyValue('--safe-bottom')) || 0;
    document.documentElement.dataset.density = height - safeTop - safeBottom < 500 ? 'tight' : 'normal';
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } };
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  update();
}
