/** Keep at most one write in flight and one latest full snapshot; never build an unbounded queue. */
export function createSaveCoordinator(store: { save(data: string): Promise<boolean> }, status: (state: 'saving' | 'saved' | 'failed') => void) {
  let pending: string | null = null, active: Promise<void> | null = null, latest = '', persisted = '';
  async function drain() {
    while (pending !== null) {
      const value = pending; pending = null;
      let success = false;
      try { success = await store.save(value); } catch { /* Surface failure without losing the in-memory profile. */ }
      if (success) persisted=value;
      if (latest===value) status(success?'saved':'failed');
    }
  }
  return {
    save(value: string) {
      latest=value;
      if (value===persisted && !active) return Promise.resolve(true);
      if (value!==pending) pending=value;
      status('saving');
      if (!active) active=drain().finally(()=>{ active=null; });
      return active.then(()=>persisted===value);
    },
    get pending() { return active !== null; },
  };
}
