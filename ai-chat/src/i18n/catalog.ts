import { enMessages, type MessageCatalog } from './messages/en';
import { zhCNMessages } from './messages/zh-CN';
import { DEFAULT_LOCALE, type Locale } from './types';

export type MessageKey = keyof typeof zhCNMessages;
export type MessageValues = Record<string, string | number>;

export const messagesByLocale: Record<Locale, MessageCatalog> = {
  'zh-CN': zhCNMessages,
  en: enMessages,
};

function formatMessage(template: string, values?: MessageValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = values[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

export function getMessage(locale: Locale, key: MessageKey, values?: MessageValues): string {
  const template = messagesByLocale[locale][key] ?? messagesByLocale[DEFAULT_LOCALE][key] ?? key;
  return formatMessage(template, values);
}
