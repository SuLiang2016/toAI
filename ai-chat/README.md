# AI 对话框应用

基于 Next.js + Electron 构建的桌面 AI 聊天应用，支持流式对话、Markdown 渲染和文件上传。

## 功能特性

- ✅ 流式对话（逐字显示 AI 回复）
- ✅ 对话历史管理（localStorage 持久化）
- ✅ Markdown 渲染（支持代码块、表格等）
- ✅ 文件/图片上传
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

**常见配置示例：**

```env
# OpenAI
AI_API_KEY=sk-xxx
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4

# 兼容 OpenAI 格式的第三方 API（如 Azure、本地部署等）
AI_API_KEY=your-key
AI_API_BASE_URL=https://your-custom-api.com/v1
AI_MODEL=your-model-name
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

### 4. 构建桌面应用

```bash
pnpm electron-build
```

构建完成后，可执行文件位于 `dist/` 目录。

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

如果你想使用其他 AI 服务（如 Claude、文心一言等），编辑 `src/app/api/chat/route.ts`：

```typescript
// 修改为你的 API 端点
const response = await fetch('YOUR_AI_API_URL', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${YOUR_API_KEY}`,
  },
  body: JSON.stringify({
    // 根据你的 API 要求调整参数
  }),
});
```

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript
- **样式**: Tailwind CSS 4
- **Markdown**: react-markdown + remark-gfm
- **桌面**: Electron 41
- **包管理**: pnpm

## 许可证

MIT
