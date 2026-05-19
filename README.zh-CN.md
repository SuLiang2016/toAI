# toAI

[English](README.md) | 中文

这是一个本地 AI 聊天应用仓库，前端与桌面端基于 Next.js、React、
TypeScript、Tailwind CSS 和 Electron 构建。

应用主代码位于 [`ai-chat/`](ai-chat/)。

## 功能

- 通过兼容 OpenAI 的 `/chat/completions` 接口进行流式聊天。
- 会话历史、草稿、提示词模板和 provider 预设保存在浏览器本地存储中。
- 支持 Markdown 渲染、代码块和 GitHub 风格扩展语法。
- 对支持多模态的 provider，可转发图片附件。
- 支持 Windows 的 Electron 桌面打包。

## 项目结构

```text
.
|-- ai-chat/             # Next.js + Electron 聊天应用
|   |-- src/app/         # App Router 页面和 API 路由
|   |-- src/components/  # 聊天 UI 组件
|   |-- src/hooks/       # 聊天流式处理 hook
|   |-- src/server/ai/   # provider 配置和 OpenAI 兼容客户端
|   |-- src/types/       # 共享 TypeScript 类型
|   `-- electron/        # Electron 主进程
`-- scripts/             # 仓库辅助脚本
```

## 环境要求

- Node.js
- pnpm

当前应用配置基于 Next.js 16、React 19、Tailwind CSS 4 和 Electron 41。

## 安装

```bash
cd ai-chat
pnpm install
```

在 `ai-chat/.env.local` 中配置 provider 参数：

```env
AI_API_KEY=your-api-key
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-3.5-turbo
AI_SUPPORTS_ATTACHMENTS=false
```

`AI_API_KEY` 是必需项。界面可以保存 provider 的 base URL 和模型预设，
但 API Key 应保留在环境配置中。

## 开发运行

启动 Web 版：

```bash
cd ai-chat
pnpm dev
```

访问 `http://localhost:3000`。

启动 Electron 开发模式：

```bash
cd ai-chat
pnpm electron-dev
```

## 验证

```bash
cd ai-chat
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## 桌面构建

```bash
cd ai-chat
pnpm electron-build
```

Windows 解包产物会输出到 `ai-chat/dist/`。

## 说明

- 不要提交真实 API Key 或本地 `.env.local` 文件。
- 依赖安装、脚本执行和升级优先使用 `pnpm`。
- provider 凭据应保持在服务端或环境变量中，不要写入本地存储。
