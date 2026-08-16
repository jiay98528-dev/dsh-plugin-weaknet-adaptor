<div align="center">

# 🌐 dsh-plugin-weaknet-adaptor

**Weak-network adaptor for the DeepSeek Harness — 弱网适配插件**

Keep model reply chains alive on flaky networks: transparent long-backoff retries, local response cache, heartbeat auto-reconnect, and degraded-mode token economy — with a fully structured, bilingual (zh/en) settings page.

弱网下保护模型回复链条不断裂：透明长退避重试、本地响应缓存、心跳自动重连、降级省 token——全部参数结构化，设置页中英双语。

[![npm version](https://img.shields.io/npm/v/dsh-plugin-weaknet-adaptor)](https://www.npmjs.com/package/dsh-plugin-weaknet-adaptor)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-%E2%9C%93-2f9e44)](https://github.com/topics/dsh-plugin)
[![node](https://img.shields.io/badge/node-%3E%3D18-339933)](https://nodejs.org)

</div>

---

## ✨ Features / 特性

| | 中文 | English |
|---|---|---|
| 🔁 | 模型流在 `llm/stream` 瀑布层透明拦截：降级模式下全缓冲 + 指数退避重试（默认最长等待 10 分钟），网络抖动不再打断回复链条 | Transparent interception in the `llm/stream` waterfall: degraded mode buffers and retries with exponential backoff (up to a 10-minute cap by default), so network blips no longer break the reply chain |
| 💾 | 完整成功响应本地缓存（请求指纹 key、LRU、TTL 可配）：相同请求零 token 本地重放 | Local replay cache for fully successful responses (fingerprint keys, LRU, configurable TTL): identical requests replay with zero tokens |
| ❤️ | 断网后本地心跳任务按指数退避自动探测重连（间隔上限默认 10 分钟）；任意模型流成功也立即被动恢复 | After an outage a local heartbeat task probes and auto-reconnects with exponential backoff (cap: 10 minutes by default); any successful model stream passively restores online state |
| 🪙 | 重试等待期间零模型调用（零 token）；重连后可选输出上限降级与 tool-result 确定性裁剪 | Zero model calls (zero tokens) while waiting; optional output-cap and deterministic tool-result pruning after reconnect |
| 🎛️ | 24 个参数全部结构化（分组/类型/范围/默认值），设置页「弱网适配」可全部调整 | All 24 parameters are fully structured (group/type/range/default) and adjustable in the "Weak Network" settings page |
| 🌍 | 每个参数的说明与场景预期效果均为中英双语，UI 跟随系统语言 | Every parameter ships with bilingual (zh/en) descriptions and expected-effect notes; the UI follows the interface language |

---

## 🚀 Install / 安装

```bash
npm install dsh-plugin-weaknet-adaptor
```

Add to your composition (`cordis.yml`), e.g. in the DSH profile you run:

```yaml
plugins:
  - name: dsh-plugin-weaknet-adaptor
```

The Host half activates automatically; the browser half (settings page + status dock) is
picked up through the package's `dsh.client` declaration and served by `client-modules` —
no extra wiring needed. Peer dependencies (`@deepseek-ai/*`, `cordis`) are installed
automatically by npm.

> 💡 **为什么用正式包而不是动态插件？** 动态插件（会话内 `cordis_define` 创建）只存在于进程内存，进程崩溃或重启后即丢失；本包由 `cordis.yml` 静态加载，重启后依然生效，真正"安装即用"。
>
> 💡 **Why a real package instead of a dynamic plugin?** Dynamic plugins live only in process memory and vanish on crash/restart; this package is loaded statically from `cordis.yml` and survives restarts.

---

## ⚙️ Configuration / 参数配置

All parameters can be changed live from **Settings → Weak Network**（设置 → 弱网适配）.
Changes persist best-effort to `<workspaceRoot>/.dsh/weaknet-params.json`.

| 组 Group | 参数 Key | 类型 Type | 默认 Default | 说明与预期效果 Description & expected effect |
|---|---|---|---|---|
| 总开关 Master | `enabled` | boolean | `true` | 总开关；关闭后完全恢复原生流程。Master switch; off restores the native flow entirely. |
| 网络探测与心跳 Probing & heartbeat | `probeUrl` | string | `https://www.gstatic.com/generate_204` | 心跳探测地址；任意 HTTP 响应（含非 2xx）视为可达。Probe URL; any HTTP response (incl. non-2xx) counts as reachable. 内网/代理环境请改内网轻量端点。 |
| | `probeTimeoutMs` | number | `5000` | 探测超时（500–60000）。调小判定更快但高延迟易误报。Probe timeout; smaller = faster detection, larger = fewer false positives. |
| | `probeMode` | enum | `fetch` | `fetch`（web 服务探测）/ `off`（仅被动恢复）。`off` 用于无 fetch provider 的环境。 |
| | `heartbeatBaseIntervalMs` | number | `1000` | 探测失败后的初始间隔（200–60000）。Heartbeat base interval. |
| | `heartbeatMaxIntervalMs` | number | **`600000`** | **重连最长等待（10 分钟）**（10000–3600000）。间隔指数增长到此封顶。**Longest reconnect wait (10 min) — the interval caps here.** |
| | `heartbeatBackoffFactor` | number | `2` | 探测间隔倍增系数（1.1–5）；抖动频繁建议接近 1.1。 |
| | `successThreshold` | number | `1` | 连续成功多少次判定恢复（1–10）；波动网络建议 2–3。 |
| | `criticalFailures` | number | `3` | 连续失败达到该次数状态变红（离线告警），此前为黄（弱网）。 |
| 请求重试 Request retry | `maxAttempts` | number | `10` | 单个请求最大重试次数（1–100）；超限按原流程终止，消息不丢。 |
| | `backoffBaseMs` | number | `1000` | 重试基础退避（100–60000）。 |
| | `backoffMaxMs` | number | `600000` | 重试退避上限（1000–3600000）。 |
| | `backoffFactor` | number | `2` | 重试退避倍增系数（1.1–5）。 |
| | `jitterRatio` | number | `0.2` | 退避抖动（0–0.5）；多会话并发建议 ≥0.2 避免重试风暴。 |
| | `retryableCodes` | string[] | `TRANSPORT, TIMEOUT, STREAM_CLOSED, EMPTY_RESPONSE, MALFORMED_RESPONSE` | 视为网络故障的错误码；供应商自定义码可追加。 |
| | `retryStatuses` | number[] | `429, 500, 502, 503, 504` | 视为可重试的 HTTP 状态；勿加入 4xx 认证错误。 |
| 本地缓存 Local cache | `cacheEnabled` | boolean | `true` | 完整成功响应缓存；命中零 token 重放。 |
| | `cacheMaxEntries` | number | `50` | LRU 条目上限（1–1000）。 |
| | `cacheMaxAgeMs` | number | `600000` | 缓存有效期（1000–86400000）。 |
| 降级省 token Economy | `reduceMaxTokens` | number\|null | `null` | 降级期间输出 token 上限（100–128000）；留空不限制。建议从 2000 起步。 |
| | `pruneToolResults` | boolean | `false` | 降级期间对会话 tool-result 确定性裁剪（**不可逆**），长任务接近上下文上限时开启。 |
| 界面 UI | `showStatusDock` | boolean | `true` | composer 底部信息栏显示网络状态（绿=正常、黄=弱网、红=中断）。 |
| | `statusPollMs` | number | `5000` | 状态轮询间隔（1000–60000）。 |
| 存储 Storage | `persistParams` | boolean | `true` | 参数 best-effort 持久化；写失败静默回退内存。 |

---

## 🧠 How it works / 工作原理

```
模型请求
   │
   ▼
llm/stream 瀑布（本插件 prepend 挂载）
   │
   ├─ 缓存命中？ ──► 本地重放（零 token，不调 next()）
   │
   ├─ online 模式：流式转发 + 收集缓存 + 观察失败（网络类失败 → degrade）
   │
   └─ degraded 模式：全缓冲 → finish 判定
        ├─ 成功 → 写缓存 + 被动恢复 online + 整体交付
        └─ 网络类失败 → 指数退避 sleep（可被取消中断）→ 重试（≤ maxAttempts）
                               │
                               ▼
                   心跳任务（仅 degraded 时运行）
                   探测 probeUrl → 失败：间隔 ×factor（封顶 10 分钟）
                                 → 连续成功 ≥successThreshold：恢复 online
```

- **重试为何放在 `llm/stream` 而不是 `agent/request-error`？** 宿主 `llm-retry` 默认已接管 `agent/request-error`（`DEFAULT_RETRYABLE_CODES` 覆盖 TRANSPORT/TIMEOUT 等），后注册的监听器会被短路；`llm/stream` 是每个模型请求必经的瀑布，可确定性接管。`agent/request-error` 仅作降级观察。
- **缓存指纹**：`provider + model + reasoningEffort + temperature + maxTokens + stop + system + tools + messages + purpose`（键排序规范序列化）。只有逐字节一致的请求才命中。
- **不做什么**：不做工具集裁剪（动态插件沙箱白名单限制不适用于本包，但裁剪工具集会改变模型能力面，保持克制）；不做流中断"前缀续传"（LLM API 不支持续传，重试即重新生成）。
- **RPC**：设置页通过 `@Remote`（`dsh-typert-protocol`）的 SRC markers 机制调用 `weaknet/*` 命名空间（`getParamDefs / getParams / setParams / getStatus / resetStats`），无需手写 typert 生成物。

---

## 🧪 Quick verification / 快速验证

1. 打开 设置 → **弱网适配**：状态卡 + 7 组参数（每项有双语说明与「▸ 预期效果」）。
2. 把 **心跳探测地址** 改为 `http://127.0.0.1:1/x` 并保存 → composer 底部信息栏依次变黄（弱网）→ 红（网络中断，连续 3 次探测失败），"下次探测"秒数随指数退避逐次拉长（封顶 10 分钟）；改回默认 → 变绿自动恢复。
3. 切换界面语言（中/英）：设置页文案即时跟随。

---

## 🛠 Development / 开发

```bash
git clone https://github.com/<your-user>/dsh-plugin-weaknet-adaptor.git
cd dsh-plugin-weaknet-adaptor
npm install
npm run check   # node --check lib/index.js && node --check lib/client.js
npm pack        # build the tarball
```

Layout:

```
lib/index.js        Host half (cordis plugin + weaknet Remote service)
lib/client.js       Browser half (ModuleLoader bundle: settings page + status dock)
lib/types/index.d.ts  Type declarations
```

## 📜 Changelog / 更新日志

See [CHANGELOG.md](CHANGELOG.md) — 1.0.3 (WiFi icon + settings diagnostics), 1.0.2 (critical WebUI-hang fix), 1.0.1 (`dsh plugin add` support), 1.0.0 (first release).

## 📄 License / 许可证

MIT — see [LICENSE](LICENSE).
