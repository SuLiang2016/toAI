# toAI

Repository for a local AI chat application built with Next.js, React, TypeScript,
Tailwind CSS, and Electron.

The application source lives in [`ai-chat/`](ai-chat/).

## Features

- Streaming AI chat through an OpenAI-compatible `/chat/completions` API.
- Conversation history, drafts, prompt templates, and provider presets in local
  browser storage.
- Markdown rendering with code blocks and GitHub-flavored markdown support.
- Optional image attachment forwarding for providers that support multimodal
  requests.
- Electron desktop packaging for Windows.

## Project Layout

```text
.
|-- ai-chat/             # Next.js + Electron chat app
|   |-- src/app/         # App Router pages and API route
|   |-- src/components/  # Chat UI components
|   |-- src/hooks/       # Chat streaming hook
|   |-- src/server/ai/   # Provider config and OpenAI-compatible client
|   |-- src/types/       # Shared TypeScript types
|   `-- electron/        # Electron main process
`-- scripts/             # Repository helper scripts
```

## Requirements

- Node.js
- pnpm

The current app is configured for Next.js 16, React 19, Tailwind CSS 4, and
Electron 41.

## Setup

```bash
cd ai-chat
pnpm install
```

Create `ai-chat/.env.local` with your provider settings:

```env
AI_API_KEY=your-api-key
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-3.5-turbo
AI_SUPPORTS_ATTACHMENTS=false
```

`AI_API_KEY` is required. The UI can store provider base URL/model presets, but
API keys should stay in environment configuration.

## Development

Run the web app:

```bash
cd ai-chat
pnpm dev
```

Open `http://localhost:3000`.

Run the Electron app in development mode:

```bash
cd ai-chat
pnpm electron-dev
```

## Verification

```bash
cd ai-chat
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Desktop Build

```bash
cd ai-chat
pnpm electron-build
```

The Windows unpacked build is written under `ai-chat/dist/`.

## Notes

- Do not commit real API keys or local `.env.local` files.
- Prefer `pnpm` for dependency installation, scripts, and upgrades.
- Keep provider credentials server-side or environment-backed.
