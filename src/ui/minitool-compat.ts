// Only the ES2019 helper used by the simulation needs a local implementation.
if (!Object.fromEntries) {
  Object.fromEntries = function <T>(entries: Iterable<readonly [PropertyKey, T]>): { [key: string]: T } {
    const result = {} as { [key: string]: T };
    for (const [key, value] of entries) Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
    return result;
  } as typeof Object.fromEntries;
}

const probe = document.createElement('div');
probe.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px;';
probe.append(document.createElement('div'), document.createElement('div'));
document.body.appendChild(probe);
const flexGap = probe.scrollHeight === 1;
probe.remove();
document.documentElement.classList.toggle('supports-flex-gap', flexGap);
document.documentElement.classList.toggle('no-flex-gap', !flexGap);
if (!flexGap) {
  // Margins replace only unsupported Flex gap. Grid keeps its native grid-gap.
  const changed = new Map<HTMLElement, { left: string; top: string }>();
  let queued = false;
  const refresh = () => {
    queued = false;
    for (const [element, previous] of changed) { element.style.marginLeft = previous.left; element.style.marginTop = previous.top; }
    changed.clear();
    const updates: { element: HTMLElement; left: number; top: number }[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('#app *'))) {
      const style = getComputedStyle(element);
      if (style.display !== 'flex' && style.display !== 'inline-flex') continue;
      // Some engines recognize grid-gap as a gap alias without full Flex support.
      // Explicitly turn off that partial path before applying margins.
      if (element.style.gap !== '0px') element.style.gap = '0px';
      const row = parseFloat(style.getPropertyValue('--layout-row-gap')) || 0;
      const column = parseFloat(style.getPropertyValue('--layout-column-gap')) || 0;
      const vertical = style.flexDirection.indexOf('column') === 0;
      let first = true;
      for (const child of Array.from(element.children) as HTMLElement[]) {
        const childStyle = getComputedStyle(child);
        if (childStyle.display === 'none' || childStyle.position === 'absolute' || childStyle.position === 'fixed') continue;
        if (!first) updates.push({ element: child, left: (parseFloat(childStyle.marginLeft) || 0) + (vertical ? 0 : column), top: (parseFloat(childStyle.marginTop) || 0) + (vertical ? row : 0) });
        first = false;
      }
    }
    for (const { element, left, top } of updates) {
      changed.set(element, { left: element.style.marginLeft, top: element.style.marginTop });
      element.style.marginLeft = `${left}px`; element.style.marginTop = `${top}px`;
    }
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(refresh); } };
  new MutationObserver(records => {
    if (records.some(record => Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(node => node.nodeType === 1))) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('game-layout-change', schedule);
  schedule();
}
