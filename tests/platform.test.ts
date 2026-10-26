import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressStore, readWindowInfo } from '../src/ui/platform.ts';

function environment(version?: number, api = {}) {
  const legacy = new Map<string, string>();
  Object.assign(globalThis, {
    window: { xhs: version ? { launchOptions: { miniToolEnv: { buildVersion: version } }, miniTool: api } : undefined },
    localStorage: { getItem: (key: string) => legacy.get(key) ?? null, setItem: (key: string, data: string) => legacy.set(key, data) },
  });
  return legacy;
}
test('native progress is authoritative; concurrent victories write in order', async () => {
  const calls: string[] = [];
  const old = environment(9510000, {
    getStorage: async () => ({ data: '{"native":true}' }),
    setStorage: async ({ data }: { data: string }) => { calls.push(data); await new Promise(resolve => setTimeout(resolve, 5)); },
  });
  old.set('save', '{"legacy":true}');
  const store = createProgressStore('save');
  assert.equal(await store.load(), '{"native":true}');
  assert.deepEqual(await Promise.all([store.save('{"stars":1}'), store.save('{"stars":3}')]), [true, true]);
  assert.deepEqual(calls, ['{"stars":1}', '{"stars":3}']);
  assert.equal(old.get('save'), '{"legacy":true}');
});
test('missing native save migrates existing progress without deleting the old copy', async () => {
  const calls: string[] = [];
  const old = environment(9462004, { getStorage: async () => ({ data: null }), setStorage: async ({ data }: { data: string }) => calls.push(data) });
  old.set('save', '{"stars":3}');
  assert.equal(await createProgressStore('save').load(), '{"stars":3}');
  assert.deepEqual(calls, ['{"stars":3}']);
  assert.equal(old.get('save'), '{"stars":3}');
});
test('failed native reads cannot overwrite an unread existing save', async () => {
  let writes = 0;
  environment(9510000, { getStorage: async () => { throw new Error('unavailable'); }, setStorage: async () => { writes++; } });
  const store = createProgressStore('save');
  assert.equal(await store.load(), null);
  assert.equal(await store.save('{}'), false);
  assert.equal(writes, 0);
});
test('native write failure reports failure and does not silently switch storage', async () => {
  const old = environment(9510000, { getStorage: async () => ({ data: '{}' }), setStorage: async () => { throw new Error('quota'); } });
  const store = createProgressStore('save');
  await store.load();
  assert.equal(await store.save('{"new":true}'), false);
  assert.equal(old.has('save'), false);
});
test('old clients use browser storage and tolerate blocked storage', async () => {
  const old = environment(9459000);
  old.set('save', '{}');
  const store = createProgressStore('save');
  assert.equal(await store.load(), '{}');
  assert.equal(await store.save('{"stars":2}'), true);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  assert.equal(await store.load(), null);
  assert.equal(await store.save('{}'), false);
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
test('async launch options determine version and invalid window sizes fall back', async () => {
  environment();
  Object.assign(globalThis, { window: { xhs: { miniTool: { getLaunchOptions: async () => ({ miniToolEnv: { buildVersion: 9490001 } }), getWindowInfo: async () => ({ windowHeight: 0, windowWidth: 390 }) } } } });
  assert.equal(await readWindowInfo(), null);
});
