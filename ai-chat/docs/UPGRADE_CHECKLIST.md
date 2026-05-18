# AI Chat 升级执行清单

本文档从 `docs/UPGRADE_PLAN.md` 拆解出可执行升级清单。默认执行顺序为 Phase 0 -> Phase 5；每个阶段完成后先跑对应验证，再进入下一阶段。

## 状态约定

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `Blocked` 需要先解决依赖或业务决策

## Phase 0: 升级前基线冻结

目标：确认当前工程状态，避免后续升级时分不清“已有问题”和“升级引入的问题”。

- [ ] P0-01 记录当前运行状态
  - 涉及：`pnpm dev`、`pnpm electron-dev`、端口 `3000`
  - 验收：明确当前是否有 Next/Electron 进程运行；需要验证时可复用或先停止旧进程
- [ ] P0-02 运行基础检查
  - 涉及：`pnpm lint`、`pnpm exec tsc --noEmit`
  - 验收：记录通过/失败结果；失败时先归档为“升级前既有问题”
- [ ] P0-03 确认环境变量样例
  - 涉及：`.env.example`、`.env.local`
  - 验收：`.env.example` 不含真实密钥，`.env.local` 不被写入文档或日志
- [ ] P0-04 确认 Electron 可执行文件状态
  - 涉及：`node_modules/.pnpm/electron@*/node_modules/electron/path.txt`
  - 验收：开发模式可启动；如缺失，记录需要配置 Electron 下载镜像

## Phase 1: 工程基线

目标：统一脚本、构建路径和打包约定，为后续功能升级提供稳定底座。

- [ ] P1-01 统一开发脚本为 pnpm 体系
  - 涉及：`package.json`
  - 当前依据：`electron-dev` 仍调用 `npm run dev`
  - 验收：`pnpm electron-dev` 内部不再依赖 `npm run dev`
- [ ] P1-02 增加 TypeScript 检查脚本
  - 涉及：`package.json`
  - 建议脚本：`typecheck`
  - 验收：可通过 `pnpm typecheck` 执行 `tsc --noEmit`
- [ ] P1-03 明确测试脚本策略
  - 涉及：`package.json`
  - 注意：新增测试框架属于依赖变更，实施前需要明确选型
  - 验收：至少有不会误导的 `test` 脚本；若引入测试框架，记录选择理由
- [ ] P1-04 修正 Electron 生产构建路径
  - 涉及：`electron/main.js`、`next.config.ts`、`package.json`
  - 当前依据：Electron 生产模式加载 `../out/index.html`，但 `next.config.ts` 未配置静态导出
  - 验收：`pnpm build` 的产物与 Electron 生产加载路径一致
- [ ] P1-05 梳理打包资源配置
  - 涉及：`package.json` 的 `build.files`、`electron/`
  - 验收：`pnpm electron-build` 包含必要产物，不包含无关开发目录
- [ ] P1-06 更新 README 的启动/打包说明
  - 涉及：`README.md`
  - 验收：文档命令与实际脚本一致，包含 Electron 下载失败时的处理线索

## Phase 2: 聊天主链路增强

目标：把聊天 MVP 补齐为可持续使用的基础聊天产品。

- [ ] P2-01 实现历史会话恢复
  - 涉及：`src/components/ChatBox.tsx`、`src/hooks/useChat.ts`、`src/types/chat.ts`
  - 当前依据：选择历史会话时只切换 ID，未把消息加载回当前视图
  - 验收：点击历史会话后，消息列表显示对应历史消息
- [ ] P2-02 实现会话删除
  - 涉及：`src/components/ChatBox.tsx`
  - 验收：删除当前会话和非当前会话都能正确更新 UI 与 `localStorage`
- [ ] P2-03 实现会话重命名或自动标题更新
  - 涉及：`src/components/ChatBox.tsx`
  - 验收：标题来源稳定；新对话标题不因异步消息顺序错乱
- [ ] P2-04 修正会话保存时机
  - 涉及：`src/hooks/useChat.ts`、`src/components/ChatBox.tsx`
  - 验收：用户消息和助手完整回复都进入同一会话；刷新后可恢复
- [ ] P2-05 强化停止生成行为
  - 涉及：`src/hooks/useChat.ts`、`src/components/InputArea.tsx`
  - 验收：用户停止生成后 loading 状态结束，保留已生成内容，不误报普通错误
- [ ] P2-06 强化 API 错误展示
  - 涉及：`src/app/api/chat/route.ts`、`src/hooks/useChat.ts`、`src/components/ChatBox.tsx`
  - 验收：无 Key、上游非 2xx、流中断均显示可理解错误
- [ ] P2-07 明确附件最小闭环
  - 涉及：`src/components/InputArea.tsx`、`src/components/MessageBubble.tsx`、`src/hooks/useChat.ts`、`src/app/api/chat/route.ts`
  - 验收：附件要么明确仅本地展示，要么完整进入 API 请求协议；不保留半接入状态
- [ ] P2-08 优化 Markdown 与长文本展示
  - 涉及：`src/components/MessageBubble.tsx`、`src/app/globals.css`
  - 验收：代码块、表格、长链接、移动宽度不破坏布局

## Phase 3: API 与模型层抽象

目标：把兼容 OpenAI 的调用逻辑从路由中抽离，降低后续换模型和扩展附件能力的成本。

- [ ] P3-01 定义聊天请求/响应类型
  - 涉及：`src/types/chat.ts` 或新增 API 类型文件
  - 验收：前后端共享或对齐请求结构，避免 `any` 扩散
- [ ] P3-02 抽出 provider 配置读取
  - 涉及：`src/app/api/chat/route.ts`
  - 验收：`AI_API_KEY`、`AI_API_BASE_URL`、`AI_MODEL` 的读取和校验集中处理
- [ ] P3-03 抽出 OpenAI-compatible provider
  - 涉及：`src/app/api/chat/route.ts`、可新增 `src/server/ai/`
  - 验收：路由只负责 HTTP 入参/出参，provider 负责上游调用
- [ ] P3-04 标准化上游错误
  - 涉及：provider 层、`src/hooks/useChat.ts`
  - 验收：上游错误结构不同也能转为统一前端错误
- [ ] P3-05 设计附件协议
  - 涉及：`src/types/chat.ts`、`src/hooks/useChat.ts`、API provider
  - 验收：文本模型、多模态模型、不支持附件三种路径都有明确行为
- [ ] P3-06 设计模型配置扩展点
  - 涉及：环境变量、设置页候选、provider 层
  - 验收：后续新增模型不需要重写聊天主链路

## Phase 4: 桌面能力

目标：逐步把 Electron 从“网页壳”升级为稳定桌面应用，同时保持安全边界。

- [ ] P4-01 设计 preload / IPC 边界
  - 涉及：`electron/main.js`、可新增 `electron/preload.js`
  - 验收：不启用 `nodeIntegration`；只暴露必要 API
- [ ] P4-02 增加窗口状态记忆
  - 涉及：Electron 主进程
  - 验收：窗口尺寸、位置可恢复；异常值有兜底
- [ ] P4-03 增加应用设置页
  - 涉及：React 组件、配置存储、Electron IPC
  - 验收：API base URL、模型名等配置可查看/编辑；密钥展示安全
- [ ] P4-04 增加本地日志策略
  - 涉及：Electron 主进程、API 错误路径
  - 验收：日志不包含密钥；能用于定位启动和请求失败
- [ ] P4-05 规划自动更新
  - 涉及：`electron-builder` 配置
  - 验收：只形成方案或开关，不在没有发布渠道时硬接入

## Phase 5: 质量保障

目标：让后续升级具备自动化回归能力。

- [ ] P5-01 确定测试工具选型
  - 涉及：`package.json`
  - 注意：新增依赖需单独确认
  - 验收：明确单元、组件、端到端测试分别用什么工具
- [ ] P5-02 覆盖 API 路由错误路径
  - 涉及：`src/app/api/chat/route.ts`
  - 验收：无 Key、上游错误、正常流式代理都有测试或可重复验证脚本
- [ ] P5-03 覆盖 `useChat` 流式解析
  - 涉及：`src/hooks/useChat.ts`
  - 验收：增量 token、`[DONE]`、中断、坏 JSON 均有测试
- [ ] P5-04 覆盖会话持久化
  - 涉及：`src/components/ChatBox.tsx`
  - 验收：新建、保存、选择、删除会话可回归验证
- [ ] P5-05 覆盖 Electron smoke test
  - 涉及：`electron/main.js`、启动脚本
  - 验收：能验证窗口打开、加载 URL/产物、主进程无启动错误
- [ ] P5-06 建立发布前检查清单
  - 涉及：文档、脚本
  - 验收：发布前至少执行 lint、typecheck、build、Electron 启动验证

## 推荐执行批次

### Batch A: 最小工程稳定化

- P0-01
- P0-02
- P1-01
- P1-02
- P1-04
- P1-06

完成后验证：

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm electron-dev
```

### Batch B: 会话体验闭环

- P2-01
- P2-02
- P2-03
- P2-04
- P2-05
- P2-06

完成后验证：

```text
1. 新建会话并发送消息
2. 切换到历史会话
3. 刷新应用后再次恢复
4. 删除当前会话和非当前会话
5. 手动停止一次生成
6. 使用错误 API Key 验证错误提示
```

### Batch C: 附件与 API 边界

- P2-07
- P3-01
- P3-02
- P3-03
- P3-04
- P3-05

完成后验证：

```text
1. 纯文本模型调用仍可用
2. 不支持附件时提示明确
3. 支持附件时请求体结构可追踪
4. 上游错误不会泄露密钥
```

### Batch D: 桌面化与质量门槛

- P4-01
- P4-02
- P4-03
- P4-04
- P5-01
- P5-02
- P5-03
- P5-04
- P5-05
- P5-06

完成后验证：

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm electron-build
```

## 阻塞与决策点

- 测试框架选择：是否允许新增依赖，以及选 Vitest / Jest / Playwright 中哪些工具。
- Electron 生产模式：选择静态导出加载 `out/`，还是生产时启动/嵌入 Next 服务。
- 附件能力范围：仅本地展示、文本摘要、还是多模态模型直传。
- 配置存储位置：继续 `.env.local`，还是增加桌面设置页和本地安全存储。

## 完成定义

一个升级批次只有同时满足以下条件才算完成：

- 对应 checklist 项全部勾选。
- 相关文档已更新。
- 运行了该批次要求的验证命令或记录了无法运行的原因。
- 未引入真实密钥、无关依赖或无关锁文件刷新。
- 若存在未解决风险，已记录到本文档或 `docs/UPGRADE_PLAN.md`。
