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

export function installWindowMock(initialEntries = {}, options = {}) {
  const store = new Map(
    Object.entries(initialEntries).map(([key, value]) => [key, String(value)])
  );
  const cookieStore = new Map();

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

  const documentElement = {
    lang: options.lang ?? 'zh-CN',
    dataset: {},
  };

  if (options.datasetLocale) {
    documentElement.dataset.locale = options.datasetLocale;
  }

  if (options.cookie) {
    for (const segment of String(options.cookie).split(';')) {
      const [name, ...rest] = segment.trim().split('=');
      if (!name) continue;
      cookieStore.set(name, rest.join('='));
    }
  }

  const document = {
    documentElement,
    title: options.title ?? '',
    get cookie() {
      return [...cookieStore.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set cookie(value) {
      const parts = String(value).split(';').map(part => part.trim()).filter(Boolean);
      if (parts.length === 0) return;

      const [name, ...valueParts] = parts[0].split('=');
      const cookieValue = valueParts.join('=');
      const expiresPart = parts.find(part => part.toLowerCase().startsWith('expires='));
      const maxAgePart = parts.find(part => part.toLowerCase().startsWith('max-age='));
      const expiresAt = expiresPart ? Date.parse(expiresPart.slice('expires='.length)) : Number.NaN;
      const maxAge = maxAgePart ? Number(maxAgePart.slice('max-age='.length)) : Number.NaN;
      const shouldDelete = cookieValue === ''
        || Number.isFinite(maxAge) && maxAge <= 0
        || Number.isFinite(expiresAt) && expiresAt <= Date.now();

      if (shouldDelete) {
        cookieStore.delete(name);
      } else {
        cookieStore.set(name, cookieValue);
      }
    },
  };

  globalThis.window = { localStorage };
  globalThis.document = document;

  return {
    localStorage,
    document,
    cookies() {
      return Object.fromEntries(cookieStore.entries());
    },
    entries() {
      return Object.fromEntries(store.entries());
    },
    restore() {
      Reflect.deleteProperty(globalThis, 'window');
      Reflect.deleteProperty(globalThis, 'document');
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
