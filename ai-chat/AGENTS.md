<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ai-chat Agent Guide

本文件适用于 `C:\suliang\toAI\ai-chat` 及其子目录。这里是基于 Next.js 16、React 19、TypeScript、Tailwind CSS 4 和 Electron 41 的 AI 聊天应用。

## 工作原则

- 默认使用 `pnpm`。安装、升级、运行脚本都优先用 `pnpm`，不要用 `npm install` 或 `yarn` 引入依赖变更。
- 不要新增依赖，除非用户明确要求。先复用现有 React、Next.js、Tailwind、Electron、`react-markdown`、`remark-gfm`、`highlight.js` 能力。
- 修改 Next.js、React Server/Client Component、路由、缓存、构建或配置前，先阅读 `node_modules/next/dist/docs/` 中对应版本文档。此项目使用 Next.js 16，不要依赖旧版记忆。
- 保持 TypeScript `strict` 约束；优先使用 `@/*` 路径别名引用 `src/*`。
- 不要提交或暴露真实密钥。`.env.local` 是本地配置文件，示例和文档优先改 `.env.example` 或 README。
- 保持改动小而可验证。涉及行为变化时同步更新类型、调用方和验证步骤。

## 技术栈

- Next.js `16.2.2` + App Router，入口在 `src/app/`。
- React `19.2.4`，需要浏览器状态、事件或 `localStorage` 的组件必须保留 `'use client'`。
- TypeScript 5，配置见 `tsconfig.json`。
- Tailwind CSS 4，PostCSS 配置见 `postcss.config.mjs`，全局样式在 `src/app/globals.css`。
- Markdown 渲染使用 `react-markdown` + `remark-gfm`，代码高亮相关能力来自 `highlight.js`。
- Electron 41 主进程在 `electron/main.js`。
- 包管理器为 `pnpm`，锁文件以 `pnpm-lock.yaml` 为准；不要无关刷新 `package-lock.json`。

## 核心文件

- `src/app/page.tsx`：页面入口，渲染 `ChatBox`。
- `src/app/layout.tsx`：根布局、字体和 metadata。
- `src/app/api/chat/route.ts`：`POST /api/chat`，读取环境变量并代理到兼容 OpenAI 的 `/chat/completions` 流式接口。
- `src/components/ChatBox.tsx`：主聊天界面，侧边栏、当前会话、localStorage 会话列表。
- `src/components/MessageList.tsx`：消息列表、自动滚动和加载状态。
- `src/components/MessageBubble.tsx`：消息气泡、Markdown 和附件展示。
- `src/components/InputArea.tsx`：输入框、发送/停止按钮、文件选择状态。
- `src/components/FileUpload.tsx`：文件上传控件。
- `src/hooks/useChat.ts`：聊天请求、SSE 流解析、`AbortController` 中止生成、文件转 base64。
- `src/types/chat.ts`：`Message`、`Attachment`、`Conversation` 类型。
- `electron/main.js`：Electron 窗口创建、开发/生产加载逻辑。

## 环境变量

运行聊天接口前需要配置 `.env.local`：

- `AI_API_KEY`：必填，AI 服务 API Key。
- `AI_API_BASE_URL`：可选，默认 `https://api.openai.com/v1`。
- `AI_MODEL`：可选，默认 `gpt-3.5-turbo`。
- `OPENAI_API_KEY`：兼容旧变量，仅作为 `AI_API_KEY` 的回退。

不要在日志、错误提示、测试快照或文档示例中泄露真实 key。

## 常用命令

- `pnpm install`：安装依赖。
- `pnpm dev`：启动 Web 开发服务器，默认 `http://localhost:3000`。
- `pnpm lint`：运行 ESLint。
- `pnpm build`：运行 Next.js 构建。
- `pnpm start`：启动生产 Next.js 服务。
- `pnpm electron-dev`：启动 Electron 开发模式。
- `pnpm electron-build`：构建 Next.js 后用 Electron Builder 打包，输出到 `dist/`。

Windows 上停止开发服务器可用 `taskkill /F /T /PID <pid>`。

## 实现注意事项

- API 路由当前期望请求体形如 `{ messages: [{ role, content }] }`，并把 OpenAI 兼容 SSE 响应原样转发给前端。
- 前端流解析依赖 `data: ...` 行和 `[DONE]` 结束标记；改动流协议时要同时更新 `src/hooks/useChat.ts` 和 `src/app/api/chat/route.ts`。
- 附件在前端可预览并可转 base64 发送；如果要真正转发给多模态模型，需要同时调整 API 请求体映射、类型定义和错误处理。
- 会话历史保存在 `localStorage` 的 `conversations` 键里；改会话结构时同步更新 `src/types/chat.ts` 和旧数据兼容逻辑。
- Electron 安全默认值应保持：`nodeIntegration: false`、`contextIsolation: true`。如需 preload 或 IPC，显式设计边界，不要直接打开 Node 集成。
- 生产 Electron 当前加载 `../out/index.html`。若改动 Electron 打包、静态导出或 `next.config.ts`，必须验证 `pnpm electron-build` 的产物路径是否匹配。
- UI 改动应保持聊天工具的工作型界面：信息密度清晰、按钮状态明确、长文本和移动宽度不溢出。

## 验证要求

- 文档或注释改动：检查格式和事实是否与 `package.json`、README、代码一致。
- TypeScript/React/UI 改动：至少运行 `pnpm lint`；涉及构建、路由、字体、Next 配置时运行 `pnpm build`。
- API 或流式对话改动：验证缺少 API Key 的错误路径、非 2xx 上游错误、正常 SSE 流式增量和用户停止生成。
- Electron 改动：运行 `pnpm electron-dev`；涉及打包时运行 `pnpm electron-build` 并确认 `dist/` 产物可启动。
