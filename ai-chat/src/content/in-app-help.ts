import { type Locale } from '@/i18n';
import {
  IN_APP_HELP_INTRO as EN_INTRO,
  IN_APP_HELP_MARKDOWN as EN_MARKDOWN,
  IN_APP_HELP_SECTIONS as EN_SECTIONS,
  IN_APP_HELP_TITLE as EN_TITLE,
} from './in-app-help.en';
import {
  IN_APP_HELP_INTRO as ZH_INTRO,
  IN_APP_HELP_MARKDOWN as ZH_MARKDOWN,
  IN_APP_HELP_SECTIONS as ZH_SECTIONS,
  IN_APP_HELP_TITLE as ZH_TITLE,
} from './in-app-help.zh-CN';

export interface InAppHelpSection {
  id: 'model-switching' | 'prompt-templates' | 'conversation-switching';
  title: string;
  body: string;
}

interface InAppHelpContent {
  title: string;
  intro: string;
  sections: InAppHelpSection[];
  markdown: string;
}

const helpContentByLocale: Record<Locale, InAppHelpContent> = {
  'zh-CN': {
    title: ZH_TITLE,
    intro: ZH_INTRO,
    sections: ZH_SECTIONS,
    markdown: ZH_MARKDOWN,
  },
  en: {
    title: EN_TITLE,
    intro: EN_INTRO,
    sections: EN_SECTIONS,
    markdown: EN_MARKDOWN,
  },
};

export function getInAppHelp(locale: Locale): InAppHelpContent {
  return helpContentByLocale[locale];
}
