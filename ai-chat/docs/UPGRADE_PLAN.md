# AI Chat 升级计划

本文档用于记录当前工程的升级路线、准备状态和阶段性验收标准。目标是在不破坏现有聊天主链路的前提下，逐步把项目从可运行的 MVP 升级为更稳定、可维护、可扩展的桌面聊天应用。

执行清单见：`docs/UPGRADE_CHECKLIST.md`。

## 当前基线

- 工程已可运行：`pnpm dev` 启动 Next 服务，`pnpm electron-dev` 可拉起 Electron 桌面壳。
- 技术栈：Next.js 16、React 19、TypeScript、Tailwind CSS 4、Electron 41、`react-markdown`、`remark-gfm`、`highlight.js`。
- 聊天主链路已通：前端输入 -> `/api/chat` -> 兼容 OpenAI 的流式响应 -> UI 增量渲染。
- 当前已知缺口：
  - 会话选择后未真正恢复历史消息到当前视图。
  - 附件只做了前端预览和 base64 转换，后端尚未完整接入多模态请求体。
  - `electron-dev` 脚本内部仍使用 `npm run dev`，与项目的 `pnpm` 约定不一致。
  - `electron/main.js` 生产环境加载 `../out/index.html`，需要和构建策略保持一致。
  - 暂无测试脚本，质量门槛偏低。

## 升级目标

1. 把基础工程约定统一起来，减少脚本、构建和打包层面的偶发故障。
2. 补齐聊天产品的核心体验，包括会话管理、附件传输和错误处理。
3. 抽象模型与 API 提供层，支持后续切换不同兼容 OpenAI 的服务。
4. 补上自动化验证，让升级过程可回退、可审查。

## 分阶段路线

### Phase 1: 工程基线

- 统一脚本为 `pnpm` 体系。
- 补 `typecheck`、`test` 占位或真实脚本。
- 明确 Electron 安装和构建路径，固定开发/生产启动方式。
- 处理 `next.config.ts` 与 Electron 生产入口的匹配关系。

验收标准：
- `pnpm dev`、`pnpm electron-dev`、`pnpm build`、`pnpm electron-build` 的路径关系明确。
- 不再依赖隐式的 `npm` 行为。

### Phase 2: 聊天主链路增强

- 实现会话历史恢复、重命名、删除和切换。
- 让输入、附件、加载态、停止生成、错误提示在 UI 上形成完整闭环。
- 梳理流式响应协议和错误码处理。

验收标准：
- 选择历史会话后，消息内容可恢复。
- 附件在 UI 和请求体两侧都有明确处理逻辑。
- 上游失败、无 Key、手动停止都能得到明确反馈。

### Phase 3: API 与模型层抽象

- 抽出 provider 层，隔离模型名、base URL、鉴权和错误标准化。
- 扩展附件协议，支持后续多模态或文件摘要能力。
- 统一请求/响应 schema。

验收标准：
- 切换兼容 OpenAI 的服务不需要改前端主逻辑。
- API 层对错误和流式数据的处理一致。

### Phase 4: 桌面能力

- 引入 preload / IPC 边界。
- 增加窗口状态、设置页、日志、自动更新等桌面能力。
- 保持 Electron 安全默认值，不启用不必要的 Node 集成。

验收标准：
- 主进程、渲染进程和系统能力的边界清晰。
- 桌面功能不会破坏 Web 模式。

### Phase 5: 质量保障

- 增加 API 路由测试。
- 增加 `useChat` 和流式解析测试。
- 为关键 UI 和 Electron 启动链路补 smoke 测试。

验收标准：
- 每次升级至少有一层自动化验证支撑。
- 关键行为变化都有可回归的测试覆盖。

## 升级前准备

- 已确认当前项目可以正常启动。
- 已确认 Electron 本地可执行文件已补齐，可重复启动开发模式。
- 已收集核心文件边界：
  - `src/app/api/chat/route.ts`
  - `src/hooks/useChat.ts`
  - `src/components/ChatBox.tsx`
  - `electron/main.js`
  - `next.config.ts`
  - `package.json`
- 下一步实施时，优先处理 Phase 1，再进入功能升级。

## 风险与处理

- 风险：Electron 打包路径与 Next 构建产物不一致。
  - 处理：先锁定构建策略，再改 `electron/main.js`。
- 风险：附件和流式协议改动会牵涉前后端两端。
  - 处理：先补接口约定，再改 UI。
- 风险：没有测试会让后续改动回归成本变高。
  - 处理：先补最小验证，再逐步加覆盖。

## 备注

- 当前文档是升级路线和准备清单，不等同于实现变更。
- 进入具体升级时，应按阶段推进，避免一次性大改。
