# AI 对话框应用

基于 Next.js + Electron 构建的桌面 AI 聊天应用，支持流式对话、Markdown 渲染、会话持久化和附件协议。

## 功能特性

- ✅ 流式对话（逐字显示 AI 回复）
- ✅ 对话历史管理（localStorage 持久化）
- ✅ Markdown 渲染（支持代码块、表格等）
- ✅ 图片附件协议（默认关闭，模型支持时可启用）
- ✅ 多轮对话上下文
- ✅ 桌面应用（Electron 打包）

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 API

复制 `.env.example` 为 `.env.local` 并填入你的配置：

```bash
cp .env.example .env.local
```

**配置项说明：**

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `AI_API_KEY` | API 密钥（必填） | 无 |
| `AI_API_BASE_URL` | API 基础地址 | `https://api.openai.com/v1` |
| `AI_MODEL` | 模型名称 | `gpt-3.5-turbo` |
| `AI_SUPPORTS_ATTACHMENTS` | 是否启用图片附件直传协议 | `false` |

**常见配置示例：**

```env
# OpenAI
AI_API_KEY=sk-xxx
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4
AI_SUPPORTS_ATTACHMENTS=false

# 兼容 OpenAI 格式的第三方 API（如 Azure、本地部署等）
AI_API_KEY=your-key
AI_API_BASE_URL=https://your-custom-api.com/v1
AI_MODEL=your-model-name
AI_SUPPORTS_ATTACHMENTS=false
```

### 3. 运行开发模式

**Web 模式：**
```bash
pnpm dev
```
访问 http://localhost:3000

**Electron 桌面模式：**
```bash
pnpm electron-dev
```

如果 Electron 下载或打包阶段访问 GitHub 失败，优先确认
`node_modules/.pnpm/electron@41.2.0/node_modules/electron/path.txt`
存在；当前打包配置会复用本地 Electron 分发目录，必要时再配置
`ELECTRON_MIRROR` 或公司内网镜像。

### 4. 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` 使用仓库内的无新增依赖验证脚本，覆盖升级清单中的脚本、会话、API/provider、附件协议和 Electron 安全边界检查。

### 5. 构建桌面应用

```bash
pnpm electron-build
```

构建完成后，未打包目录位于 `dist/win-unpacked/`，可执行文件为
`dist/win-unpacked/AI Chat.exe`。生成安装器使用：

```bash
pnpm electron-installer
```

## 项目结构

```
ai-chat/
├── src/
│   ├── app/              # Next.js 页面路由
│   │   ├── api/chat/     # AI API 路由
│   │   ├── layout.tsx    # 根布局
│   │   └── page.tsx      # 主页
│   ├── components/       # React 组件
│   │   ├── ChatBox.tsx   # 主对话框
│   │   ├── MessageList.tsx  # 消息列表
│   │   ├── MessageBubble.tsx  # 消息气泡
│   │   ├── InputArea.tsx  # 输入区域
│   │   └── FileUpload.tsx  # 文件上传
│   ├── hooks/
│   │   └── useChat.ts    # 对话逻辑 hook
│   └── types/
│       └── chat.ts       # 类型定义
├── electron/
│   └── main.js           # Electron 主进程
└── package.json
```

## 自定义 AI API

兼容 OpenAI 的 provider 逻辑位于 `src/server/ai/`：

- `config.ts` 负责读取和校验 `AI_API_KEY`、`AI_API_BASE_URL`、`AI_MODEL`。
- `openai-compatible.ts` 负责上游 `/chat/completions` 调用、SSE 转发、附件映射和错误标准化。
- `src/app/api/chat/route.ts` 只处理 HTTP 入参/出参。

模型 base URL、模型名和附件开关也可在应用右上角设置页中编辑；API Key 仍只从 `.env.local` 读取，不在界面中展示或保存。

## 附件协议

默认 `AI_SUPPORTS_ATTACHMENTS=false`。此时带附件的请求会返回明确错误，避免半接入状态。
当设置为 `true` 时，图片附件会以 OpenAI-compatible 的 `image_url` content part 直传；非图片文件会被拒绝并提示先转为文本摘要。

## 自动更新策略

当前没有发布渠道配置，因此不硬接入自动更新。后续接入时应先确定发布源、签名证书和回滚策略，再启用 electron-builder publish/auto-update 配置。

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript
- **样式**: Tailwind CSS 4
- **Markdown**: react-markdown + remark-gfm
- **桌面**: Electron 41
- **包管理**: pnpm

## 许可证

MIT
