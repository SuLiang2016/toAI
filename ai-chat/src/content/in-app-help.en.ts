import type { InAppHelpSection } from './in-app-help';

export const IN_APP_HELP_TITLE = 'AI Chat Help';

export const IN_APP_HELP_INTRO = [
  'This guide covers the three workflows already available in the current build so you can switch models, manage prompt templates, and create or switch conversations directly inside the app.',
  'Every step below is based on the current interface. It does not add a separate settings page, language wizard, or extra overlays.',
].join('\n');

export const IN_APP_HELP_SECTIONS: InAppHelpSection[] = [
  {
    id: 'model-switching',
    title: 'Configure and switch models',
    body: [
      '1. Click `Settings` in the top-right corner to open the `Provider presets` dialog.',
      '2. Use `New preset` / `Edit preset` to fill in or update the provider name, API Base URL, model name, and capability hints.',
      '3. Click `Activate` in the preset list to make that preset the model configuration used for future requests in the current conversation.',
      '4. If you want to confirm the configuration works, click `Check connectivity`. The result appears in the preset panel and also in the provider status line under the chat title.',
      '5. If you delete the currently active preset, the app falls back to environment defaults. API keys are still read from `.env.local` only and are never stored in presets.',
    ].join('\n'),
  },
  {
    id: 'prompt-templates',
    title: 'Create and use prompt templates',
    body: [
      '1. Find the `Templates` section in the left sidebar and click `Add` to create a new template.',
      '2. Enter an optional title and the required content. If the title is empty, the app generates a short title from the content automatically.',
      '3. After saving, the template stays in the sidebar list. Clicking the template card inserts its content into the current draft; existing draft text is appended instead of being cleared.',
      '4. Use `Edit` and `Delete` on the template card to keep the template up to date.',
      '5. Templates are stored in local browser storage, so they remain available after a reload.',
    ].join('\n'),
  },
  {
    id: 'conversation-switching',
    title: 'Create and switch conversations',
    body: [
      '1. Click `+ New chat` in the left sidebar to start a new conversation. The title area shows `New chat`, and the draft is stored separately.',
      '2. The left list is sorted by the latest update time. Click any conversation row to switch to it and restore its messages and draft.',
      '3. Use the search box to filter conversations by title, message content, or attachment names so you can quickly find older threads.',
      '4. `Inbox` and `Archived` switch between list views. Archiving is useful for temporarily hiding conversations you do not use often; restoring them keeps the conversation editable.',
      '5. Hover a conversation row to pin, archive, rename, or delete it. These actions only organize the list and do not rewrite the conversation history.',
    ].join('\n'),
  },
];

export const IN_APP_HELP_MARKDOWN = [
  `# ${IN_APP_HELP_TITLE}`,
  IN_APP_HELP_INTRO,
  ...IN_APP_HELP_SECTIONS.flatMap(section => [`## ${section.title}`, section.body]),
].join('\n\n');
