import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleRoot = process.env.BEHAVIOR_MODULE_ROOT;

if (!moduleRoot) {
  throw new Error('BEHAVIOR_MODULE_ROOT is required for behavior tests');
}

export async function importBehaviorModule(moduleName) {
  const moduleUrl = pathToFileURL(path.join(moduleRoot, moduleName)).href;
  return import(`${moduleUrl}?t=${Date.now()}`);
}

export function installWindowMock(initialEntries = {}) {
  const store = new Map(
    Object.entries(initialEntries).map(([key, value]) => [key, String(value)])
  );

  const localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    get length() {
      return store.size;
    },
  };

  globalThis.window = { localStorage };

  return {
    localStorage,
    entries() {
      return Object.fromEntries(store.entries());
    },
    restore() {
      Reflect.deleteProperty(globalThis, 'window');
    },
  };
}

export function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, snapshot);
}
