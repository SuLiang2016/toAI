import { getMessage } from './catalog';
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  type Locale,
} from './types';

export function readLocaleFromCookie(cookieSource: string): Locale | null {
  const segments = cookieSource.split(';');

  for (const segment of segments) {
    const [name, ...rest] = segment.trim().split('=');
    if (name !== LOCALE_COOKIE_NAME) continue;

    const value = decodeURIComponent(rest.join('='));
    return isLocale(value) ? value : null;
  }

  return null;
}

export function readLocaleFromBrowser(): Locale {
  if (typeof document === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const cookieLocale = readLocaleFromCookie(document.cookie);
  if (cookieLocale) {
    return cookieLocale;
  }

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(storedLocale)) {
      return storedLocale;
    }
  } catch {
    // Ignore storage access failures and fall back to document/default state.
  }

  const datasetLocale = document.documentElement.dataset.locale;
  if (isLocale(datasetLocale)) {
    return datasetLocale;
  }

  const htmlLocale = document.documentElement.lang;
  return isLocale(htmlLocale) ? htmlLocale : DEFAULT_LOCALE;
}

export function applyLocaleToDocument(locale: Locale) {
  if (typeof document === 'undefined') return;

  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  document.title = getMessage(locale, 'app.title');
}

export function getBootstrapScript() {
  const payload = JSON.stringify({
    defaultLocale: DEFAULT_LOCALE,
    storageKey: LOCALE_STORAGE_KEY,
    cookieName: LOCALE_COOKIE_NAME,
    supportedLocales: ['zh-CN', 'en'],
    titles: {
      'zh-CN': getMessage('zh-CN', 'app.title'),
      en: getMessage('en', 'app.title'),
    },
  });

  return `(() => {
    const config = ${payload};
    const readCookie = (cookieName) => {
      const cookie = document.cookie
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(cookieName + '='));

      if (!cookie) return null;
      return decodeURIComponent(cookie.slice(cookieName.length + 1));
    };

    let locale = config.defaultLocale;

    try {
      const cookieLocale = readCookie(config.cookieName);
      const storedLocale = window.localStorage.getItem(config.storageKey);
      const candidate = cookieLocale || storedLocale;

      if (config.supportedLocales.includes(candidate)) {
        locale = candidate;
      }
    } catch {
      // Ignore pre-hydration browser storage failures.
    }

    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    document.title = config.titles[locale] || config.titles[config.defaultLocale];
  })();`;
}

