# Changelog / 更新日志

All notable changes to **dsh-plugin-weaknet-adaptor**.

## [1.0.4] — 2026-08-16

### Fixed / 修复

- **Settings page parameters never loaded ("loading…" forever)** — 设置页参数一直"正在加载"。
  - Root cause: the browser half accessed the Remote namespace through `ctx.get('remote.weaknet')`, but cordis service lookup walks the fiber parent chain — the namespace service is registered in the api-gateway's child fiber and is **invisible to sibling fibers** (verified with a live cordis experiment: sibling/child-fiber services return `undefined`). The official UI packages only work because they consume namespaces mounted by the host-side aggregator via `inject` (root-store dependency resolution).
  - 根因：浏览器半通过 `ctx.get('remote.weaknet')` 访问 Remote 命名空间，但 cordis 服务查找沿 fiber 父链——命名空间服务注册在 api-gateway 的子 fiber，对兄弟 fiber **不可见**（已用 cordis 实测复现：兄弟/子 fiber 服务返回 `undefined`）。官方 UI 包能用是因为它们经 `inject`（root store 依赖解析）消费宿主聚合器挂载的命名空间。
  - Fix: the settings page and status dock now call the generic RPC channel directly — `ctx.connection.rpc.call('/api', 'weaknet/<method>', { args })` (the same transport the api-gateway uses internally). The `$mount` contribution stays for gateway discoverability; it is fully decoupled from the UI path.
  - 修复：设置页与状态条改为直接走通用 RPC 通道 `ctx.connection.rpc.call('/api', 'weaknet/<method>', { args })`（与 api-gateway 内部同款传输）；`$mount` 注册保留供 gateway 发现，与 UI 路径完全解耦。

## [1.0.3] — 2026-08-16

### Added / 新增

- **WiFi icon** (inline linear SVG, 1.5px stroke — same style family as the product icons) in the settings page headings and the composer bottom status dock; the dock's `●` bullet is replaced by the WiFi icon, tinted by network state.
- **新增 WiFi 图标**（内联线性 SVG，1.5px 描边，与产品图标同风格）：设置页标题与输入区底部状态条使用 WiFi 图标替代圆点，颜色随网络状态（绿/黄/红）。
- Settings page now surfaces Remote readiness: a loading hint while parameters load and a visible error line when the `weaknet` Remote namespace cannot be mounted — no more silent blank parameter area.
- 设置页新增就绪提示：参数加载中显示提示；`weaknet` Remote 挂载失败时直接显示错误信息，不再静默空白。

### Fixed / 修复

- None (diagnostics only). 无功能性修复（仅诊断增强）。

## [1.0.2] — 2026-08-16

### Fixed / 修复

- **Critical: WebUI could hang on startup (blocking bug)** — 严重：插件可能导致 DSH WebUI 启动卡死。
  - Root cause: the browser half injected `remote.weaknet` but never installed it. Client-side remote namespaces are **not** dynamic proxies — they only exist after a typert contribution is mounted via `ctx.remote.$mount(...)`. Without a contribution, the plugin waited forever on its inject, freezing the UI.
  - 根因：浏览器半声明依赖 `remote.weaknet` 却从未安装它。Client 端 Remote 命名空间不是动态代理，必须通过 `ctx.remote.$mount(contribution)` 显式注册；缺少注册时插件在 apply 前无限等待，导致界面卡死。
  - Fix: added the `WEAKNET_REMOTE` contribution (5 descriptors, strict codecs backed by a hand-written `parse()`-compatible schema — **no zod dependency**), mounted it in an async `apply` (**fail-soft**: registration errors only degrade the settings page), removed `remote.weaknet` from `inject` (self-built services would deadlock), and access the namespace via `ctx.get('remote.weaknet')` after mount.
  - 修复：新增 `WEAKNET_REMOTE` contribution（5 个描述符，strict codec 使用手写 `parse()` 兼容对象，零 zod 依赖）；`apply` 改为 async 并执行 `$mount`（fail-soft：注册失败只降级设置页）；从 `inject` 移除 `remote.weaknet`（自建服务会死锁）；挂载后经 `ctx.get('remote.weaknet')` 访问。
  - Host side verified in a live environment: apply, service binding, and all 5 SRC markers work correctly. 宿主侧已在本机真实环境实测通过（apply、服务绑定、5 个 SRC markers 均正常）。

## [1.0.1] — 2026-08-16

### Added / 新增

- `dsh.bundle` manifest with a `cordis.patch.yml` bundle patch — the plugin is now installable with **`dsh plugin add dsh-plugin-weaknet-adaptor`** (one command, no manual `cordis.yml` edits).
- 新增 `dsh.bundle` 清单与 bundle patch —— 现在支持 **`dsh plugin add dsh-plugin-weaknet-adaptor`** 一键安装。
- Package metadata: `repository` / `homepage` / `bugs`.

## [1.0.0] — 2026-08-16

### Added / 首发

- Weak-network adaptor for the DeepSeek Harness: 弱网适配插件首发。
  - Transparent long-backoff retries in the `llm/stream` waterfall (10-min cap by default); 模型流透明长退避重试（默认 10 分钟封顶）；
  - Local replay cache of successful responses (fingerprint keys, LRU, TTL); 本地响应缓存（指纹、LRU、TTL）；
  - Heartbeat auto-reconnect with exponential backoff, plus passive restore; 心跳自动重连（指数退避）+ 被动恢复；
  - Degraded-mode economy: zero calls while waiting, optional output cap & tool-result pruning; 降级省 token：等待零调用、可选输出上限与 tool-result 裁剪；
  - 24 fully structured parameters with a bilingual (zh/en) settings page; 24 个全结构化参数 + 中英双语设置页；
  - `dsh.client` browser half auto-mounts the settings page and the composer bottom status dock (red/amber/green). 浏览器半自动挂载设置页与输入区底部状态条（红/黄/绿）。
