interface LaunchOptions { miniToolEnv?: { buildVersion?: number } }
interface Rect { left: number; top: number; right: number; bottom: number }
export interface WindowInfo {
  windowWidth: number; windowHeight: number; safeArea?: Rect;
  menuButtons?: { back?: Rect | null; me?: Rect | null; share?: Rect | null };
}
interface MiniTool {
  getLaunchOptions?: () => Promise<LaunchOptions>;
  getStorage?: (options: { key: string }) => Promise<{ data: string | null }>;
  setStorage?: (options: { key: string; data: string }) => Promise<unknown>;
  getWindowInfo?: () => Promise<WindowInfo>;
}
declare global { interface Window { xhs?: { launchOptions?: LaunchOptions; miniTool?: MiniTool } } }

// Bound native calls so a missing callback never prevents an offline game starting.
export function bounded<T>(operation: Promise<T>, milliseconds = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Platform response timed out')), milliseconds);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
export async function clientVersion(): Promise<number> {
  let version = Number(window.xhs?.launchOptions?.miniToolEnv?.buildVersion) || 0;
  const api = window.xhs?.miniTool;
  if (!version && typeof api?.getLaunchOptions === 'function') {
    try { version = Number((await bounded(api.getLaunchOptions())).miniToolEnv?.buildVersion) || 0; } catch { /* Unknown version uses the documented fallback. */ }
  }
  return Math.floor(version / 1000);
}

export function createProgressStore(key: string) {
  let native: MiniTool | undefined;
  let nativeWritable = true;
  let writes = Promise.resolve(true);
  let readFailed = false;
  const legacy = () => { try { return localStorage.getItem(key); } catch { readFailed = true; return null; } };
  return {
    canWrite: () => nativeWritable && !readFailed,
    async load(): Promise<string | null> {
      const api = window.xhs?.miniTool;
      if (await clientVersion() < 9460 || typeof api?.getStorage !== 'function' || typeof api.setStorage !== 'function') return legacy();
      native = api;
      try {
        const result = await bounded(api.getStorage({ key }));
        if (typeof result.data === 'string') return result.data;
        // Migrate once only after the native store confirms that no save exists.
        const previous = legacy();
        if (previous) {
          try { await bounded(api.setStorage({ key, data: previous })); } catch { nativeWritable = false; /* Keep the old save so migration can be retried. */ }
        }
        return previous;
      } catch { nativeWritable = false; return null; }
    },
    save(data: string): Promise<boolean> {
      writes = writes.then(async () => {
        if (readFailed || (native && !nativeWritable)) return false;
        try {
          if (native?.setStorage) await bounded(native.setStorage({ key, data }));
          else localStorage.setItem(key, data);
          return true;
        } catch {
          // A timed-out bridge write cannot be cancelled. Avoid a later write
          // overtaking it, or replacing a save we failed to read, until reload.
          if (native) nativeWritable = false;
          return false;
        }
      });
      return writes;
    },
  };
}

export async function readWindowInfo(): Promise<WindowInfo | null> {
  const api = window.xhs?.miniTool;
  if (typeof api?.getWindowInfo !== 'function' || await clientVersion() < 9490) return null;
  try {
    const info = await bounded(api.getWindowInfo());
    return Number.isFinite(info.windowHeight) && info.windowHeight > 0 && Number.isFinite(info.windowWidth) && info.windowWidth > 0 ? info : null;
  } catch { return null; }
}
