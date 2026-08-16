/**
 * dsh-plugin-weaknet-adaptor — Client half (browser bundle)
 *
 *  - i18n: built-in zh/en dictionaries resolved against the active locale
 *    (`locale.getLocale()`), so the UI follows the interface language without
 *    claiming a locale namespace (no registration conflicts);
 *  - settings page: registered in `settings.section` ("弱网适配" / "Weak
 *    Network"), driven by the `weaknet` Remote service;
 *  - status: merged into the composer bottom info bar
 *    (`conversation.composer.dock`) with low-attention red/amber/green colors.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-weaknet-adaptor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		// ---------------------------------------------------------------
		// i18n 字典：全参数 label/desc/effect + UI 文案（zh 为回退基础语言）
		// ---------------------------------------------------------------
		const zhDict = {
			'section.label': '弱网适配',
			'section.status': '当前状态',
			'section.params': '参数设置',
			'section.save': '保存',
			'section.saved': '已保存',
			'section.reset': '恢复默认',
			'section.resetStats': '清空统计',
			'section.error': '保存失败：{msg}',
			'group.general': '总开关',
			'group.network': '网络探测与心跳',
			'group.retry': '请求重试',
			'group.cache': '本地缓存',
			'group.economy': '降级省 token',
			'group.ui': '界面',
			'group.storage': '存储',
			'status.mode.online': '网络正常',
			'status.mode.degraded': '弱网模式（重连中）',
			'status.enabled': '插件已启用',
			'status.disabled': '插件已停用',
			'status.degradedCount': '降级次数',
			'status.restoredCount': '恢复次数',
			'status.retriesTotal': '累计重试',
			'status.nextProbe': '下次探测',
			'status.lastProbe': '上次探测',
			'status.since': '降级始于',
			'section.loading': '正在加载参数…',
			'section.remoteError': 'Remote 服务不可用：{msg}',
			'error.INVALID_VALUE': '参数值无效（类型或范围不符）',
			'error.UNKNOWN_KEY': '未知参数',
			'error.INVALID_PATCH': '无效的更新请求',
			'dock.online': '网络正常',
			'dock.degraded': '弱网模式 · 已重试 {n} 次 · 下次探测 {s} 秒',
			'dock.offline': '网络中断 · 已重试 {n} 次 · 下次探测 {s} 秒',
			'dock.off': '弱网适配已停用',
			'param.enabled.label': '启用插件',
			'param.enabled.desc': '插件总开关。关闭后停止全部重试、心跳、缓存与降级行为，模型请求完全恢复原生流程。',
			'param.enabled.effect': '网络不稳定时段可临时关闭以保持原生行为；网络稳定时建议保持开启，以获得缓存与自动重连保护。',
			'param.probeUrl.label': '心跳探测地址',
			'param.probeUrl.desc': '心跳任务探测网络可达性的 URL（HTTP/HTTPS）。收到任意 HTTP 响应（包括非 2xx）即视为网络可达。默认使用 Google 的 204 快速探测端点。',
			'param.probeUrl.effect': '处于内网或代理环境时，可改为内网可达的轻量端点；改用响应慢或流量大的端点会增加探测开销、拖慢恢复判定。',
			'param.probeTimeoutMs.label': '探测超时（毫秒）',
			'param.probeTimeoutMs.desc': '单次心跳探测的超时时间，范围 500–60000 毫秒，默认 5000。超过该时间未收到响应即判定本次探测失败。',
			'param.probeTimeoutMs.effect': '调小：断网判定更快，但高延迟网络容易误报离线；调大：判定更准确，但网络恢复的感知会变慢。',
			'param.probeMode.label': '探测方式',
			'param.probeMode.desc': 'fetch：通过 web 服务请求探测地址；off：不做主动探测，仅依赖模型调用成功被动恢复。',
			'param.probeMode.effect': '当环境没有可用的 fetch provider 时，设为 off 可避免无效探测；被动恢复仍然有效。',
			'param.heartbeatBaseIntervalMs.label': '心跳基础间隔（毫秒）',
			'param.heartbeatBaseIntervalMs.desc': '探测失败后的初始重试间隔，范围 200–60000 毫秒，默认 1000。之后按倍率逐次拉长。',
			'param.heartbeatBaseIntervalMs.effect': '调小：网络恢复后能更快被发现；调大：探测更稀疏，减少无谓请求，适合长期波动、流量敏感的场景。',
			'param.heartbeatMaxIntervalMs.label': '心跳最大间隔（毫秒）',
			'param.heartbeatMaxIntervalMs.desc': '探测间隔的上限（即重连最长等待），范围 10000–3600000 毫秒，默认 600000（10 分钟）。',
			'param.heartbeatMaxIntervalMs.effect': '保持默认 10 分钟封顶：长时间断网时探测自动稀释，省电省流量；调大后探测更稀疏，恢复更慢但更省。',
			'param.heartbeatBackoffFactor.label': '心跳退避倍率',
			'param.heartbeatBackoffFactor.desc': '探测失败后间隔的倍增系数，范围 1.1–5，默认 2。',
			'param.heartbeatBackoffFactor.effect': '调大：间隔快速拉长，省资源但恢复变慢；网络抖动频繁的场景建议接近 1.1，保持探测密度以尽快恢复。',
			'param.successThreshold.label': '恢复成功阈值',
			'param.successThreshold.desc': '连续探测成功多少次才判定网络恢复，范围 1–10，默认 1。',
			'param.successThreshold.effect': '调大：避免网络刚抖动一下就误判恢复，但确认恢复需要更多次成功探测；波动网络建议 2–3。',
			'param.criticalFailures.label': '红色告警阈值',
			'param.criticalFailures.desc': '心跳连续探测失败达到该次数后，底部状态显示为红色（网络中断告警）；此前为黄色（弱网）。范围 1–100，默认 3。',
			'param.criticalFailures.effect': '调小：更快进入红色告警，适合对中断敏感的观察；调大：更晚才变红，减少视觉打扰。',
			'param.maxAttempts.label': '最大重试次数',
			'param.maxAttempts.desc': '单个模型请求在网络故障下的最大重试次数，范围 1–100，默认 10。达到上限后请求按原流程终止（消息仍在会话中，不丢失）。',
			'param.maxAttempts.effect': '调大：长断网时更可能熬到重连成功，但请求会长时间挂起（期间不消耗 token）；需要及时响应的场景可调小。',
			'param.backoffBaseMs.label': '重试基础退避（毫秒）',
			'param.backoffBaseMs.desc': '模型请求重试的初始退避时间，范围 100–60000 毫秒，默认 1000。',
			'param.backoffBaseMs.effect': '调小：网络抖动时恢复更快，但重试更密集；波动网络建议调大以减少无效重试。',
			'param.backoffMaxMs.label': '重试退避上限（毫秒）',
			'param.backoffMaxMs.desc': '重试退避的上限，范围 1000–3600000 毫秒，默认 600000（10 分钟）。',
			'param.backoffMaxMs.effect': '保持默认即可覆盖长断网；调小会限制单次重试的最大等待，缩短整体重试窗口。',
			'param.backoffFactor.label': '重试退避倍率',
			'param.backoffFactor.desc': '重试间隔的倍增系数，范围 1.1–5，默认 2。',
			'param.backoffFactor.effect': '调大：重试间隔快速拉长，节省资源；抖动场景调小可保持较密的重试节奏。',
			'param.jitterRatio.label': '退避抖动比例',
			'param.jitterRatio.desc': '为退避间隔叠加的随机抖动比例，范围 0–0.5，默认 0.2。避免多请求在同一时刻集中重试。',
			'param.jitterRatio.effect': '多会话并发时建议 ≥0.2 以避免同步重试风暴；调大可让重试更分散，但单次等待时间波动更大。',
			'param.retryableCodes.label': '可重试错误码',
			'param.retryableCodes.desc': '视为网络故障的错误码列表（逗号分隔）。默认覆盖传输层与流层错误：TRANSPORT、TIMEOUT、STREAM_CLOSED、EMPTY_RESPONSE、MALFORMED_RESPONSE。',
			'param.retryableCodes.effect': '供应商返回自定义网络类错误码时可追加；误加不可恢复的错误码会让请求反复无效重试。',
			'param.retryStatuses.label': '可重试 HTTP 状态码',
			'param.retryStatuses.desc': '视为可重试的 HTTP 状态码列表（逗号分隔）。默认 429、500、502、503、504。',
			'param.retryStatuses.effect': '429 配合指数退避自动处理；不要把 4xx 认证类错误加入，否则会无效重试。',
			'param.cacheEnabled.label': '启用响应缓存',
			'param.cacheEnabled.desc': '缓存完整成功的模型响应，相同请求（相同指纹）直接本地重放，不发起真实调用，零 token 消耗。',
			'param.cacheEnabled.effect': '断网期间或重复请求（如重发、多会话同请求）命中时显著省 token 并避免等待；对实时性敏感的任务可关闭。',
			'param.cacheMaxEntries.label': '缓存条目上限',
			'param.cacheMaxEntries.desc': '缓存最大条目数，超出后按最近最少使用（LRU）淘汰，范围 1–1000，默认 50。',
			'param.cacheMaxEntries.effect': '调大：更多请求可命中，但内存占用上升；常规会话保持默认即可。',
			'param.cacheMaxAgeMs.label': '缓存有效期（毫秒）',
			'param.cacheMaxAgeMs.desc': '缓存条目的有效期，范围 1000–86400000 毫秒，默认 600000（10 分钟）。',
			'param.cacheMaxAgeMs.effect': '调大：断网重放窗口更长，但可能返回较旧的内容；调小：内容更新鲜但命中率下降。',
			'param.reduceMaxTokens.label': '降级输出上限（留空为不降）',
			'param.reduceMaxTokens.desc': '降级（弱网）模式下对模型请求施加的输出 token 上限；留空表示不限制。范围 100–128000。',
			'param.reduceMaxTokens.effect': '设置后弱网恢复期回答更短、更省 token；设得过小会截断关键输出，建议从 2000 起步。',
			'param.pruneToolResults.label': '降级时裁剪工具结果',
			'param.pruneToolResults.desc': '降级期间对会话中的工具结果做确定性裁剪（截头/中/尾），压缩后续请求的输入上下文。注意：裁剪不可逆。',
			'param.pruneToolResults.effect': '长任务接近上下文上限时可开启以继续推进；裁剪后上下文永久精简，请谨慎启用。',
			'param.showStatusDock.label': '显示网络状态',
			'param.showStatusDock.desc': '在输入区底部信息栏（与统计信息同行）显示网络状态：绿色=正常、黄色=弱网、红色=中断。',
			'param.showStatusDock.effect': '开启便于随时感知网络状态；界面拥挤或不需要时可关闭。',
			'param.statusPollMs.label': '状态轮询间隔（毫秒）',
			'param.statusPollMs.desc': '设置页与状态条刷新状态的轮询间隔，范围 1000–60000 毫秒，默认 5000。',
			'param.statusPollMs.effect': '调小：状态更新更及时，但轮询 RPC 更频繁；调大：更省资源，状态稍滞后。',
			'param.persistParams.label': '持久化参数',
			'param.persistParams.desc': '把参数 best-effort 保存到工作区 .dsh/weaknet-params.json，插件重载后自动恢复；写入失败时静默回退为内存参数。',
			'param.persistParams.effect': '开启后调整的参数在插件重启后保留；多会话共享同一工作区时注意参数会互相覆盖。',
		};

		const enDict = {
			'section.label': 'Weak Network',
			'section.status': 'Current status',
			'section.params': 'Parameters',
			'section.save': 'Save',
			'section.saved': 'Saved',
			'section.reset': 'Reset defaults',
			'section.resetStats': 'Reset stats',
			'section.error': 'Save failed: {msg}',
			'group.general': 'Master',
			'group.network': 'Probing & heartbeat',
			'group.retry': 'Request retry',
			'group.cache': 'Local cache',
			'group.economy': 'Economy',
			'group.ui': 'Interface',
			'group.storage': 'Storage',
			'status.mode.online': 'Online',
			'status.mode.degraded': 'Degraded (reconnecting)',
			'status.enabled': 'Plugin enabled',
			'status.disabled': 'Plugin disabled',
			'status.degradedCount': 'Degraded count',
			'status.restoredCount': 'Restored count',
			'status.retriesTotal': 'Total retries',
			'status.nextProbe': 'Next probe',
			'status.lastProbe': 'Last probe',
			'status.since': 'Degraded since',
			'section.loading': 'Loading parameters…',
			'section.remoteError': 'Remote service unavailable: {msg}',
			'error.INVALID_VALUE': 'Invalid value (type or range)',
			'error.UNKNOWN_KEY': 'Unknown parameter',
			'error.INVALID_PATCH': 'Invalid update request',
			'dock.online': 'Online',
			'dock.degraded': 'Weak network · {n} retries · next probe in {s}s',
			'dock.offline': 'Offline · {n} retries · next probe in {s}s',
			'dock.off': 'Weak-network adaptor disabled',
			'param.enabled.label': 'Enable plugin',
			'param.enabled.desc': 'Master switch. When off, all retry, heartbeat, cache, and economy behaviors stop and model requests follow the native flow.',
			'param.enabled.effect': 'Turn off temporarily during unstable network to keep native behavior; keep on when the network is stable for cache and auto-reconnect protection.',
			'param.probeUrl.label': 'Probe URL',
			'param.probeUrl.desc': 'URL the heartbeat task probes for reachability (HTTP/HTTPS). Any HTTP response (including non-2xx) counts as reachable. Defaults to Google’s fast 204 endpoint.',
			'param.probeUrl.effect': 'In intranet or proxy environments, switch to a lightweight reachable endpoint; slow or heavy endpoints increase probe cost and delay recovery detection.',
			'param.probeTimeoutMs.label': 'Probe timeout (ms)',
			'param.probeTimeoutMs.desc': 'Timeout for one heartbeat probe, 500–60000 ms, default 5000. No response within this window marks the probe failed.',
			'param.probeTimeoutMs.effect': 'Smaller: faster offline detection but false positives on high-latency links; larger: more accurate but slower recovery awareness.',
			'param.probeMode.label': 'Probe mode',
			'param.probeMode.desc': 'fetch: probe via the web service; off: no active probing, recovery relies on passive model-call success.',
			'param.probeMode.effect': 'Set to off when no fetch provider is available to avoid useless probes; passive recovery still works.',
			'param.heartbeatBaseIntervalMs.label': 'Heartbeat base interval (ms)',
			'param.heartbeatBaseIntervalMs.desc': 'Initial retry interval after a failed probe, 200–60000 ms, default 1000. Grows by the backoff factor after each failure.',
			'param.heartbeatBaseIntervalMs.effect': 'Smaller: faster recovery discovery; larger: sparser probes with fewer requests — good for long-lived flaky or metered links.',
			'param.heartbeatMaxIntervalMs.label': 'Heartbeat max interval (ms)',
			'param.heartbeatMaxIntervalMs.desc': 'Upper bound of probe interval (the longest reconnect wait), 10000–3600000 ms, default 600000 (10 minutes).',
			'param.heartbeatMaxIntervalMs.effect': 'Keep the 10-minute cap: probes thin out automatically during long outages to save power and traffic; larger values probe even sparser but recover slower.',
			'param.heartbeatBackoffFactor.label': 'Heartbeat backoff factor',
			'param.heartbeatBackoffFactor.desc': 'Multiplier that grows the probe interval after each failure, 1.1–5, default 2.',
			'param.heartbeatBackoffFactor.effect': 'Larger: intervals grow fast, cheaper but slower to recover; for frequent jitter, use values near 1.1 to keep probes dense.',
			'param.successThreshold.label': 'Recovery success threshold',
			'param.successThreshold.desc': 'Consecutive successful probes needed to declare recovery, 1–10, default 1.',
			'param.successThreshold.effect': 'Larger: avoids false recovery after a single blip, but confirmation takes more successful probes; 2–3 suits flaky networks.',
			'param.criticalFailures.label': 'Critical failure threshold',
			'param.criticalFailures.desc': 'Consecutive failed heartbeat probes after which the bottom status turns red (offline alert); below that it shows amber (weak network). Range 1–100, default 3.',
			'param.criticalFailures.effect': 'Smaller: red alert appears sooner for interruption-sensitive monitoring; larger: red appears later, less visual noise.',
			'param.maxAttempts.label': 'Max retry attempts',
			'param.maxAttempts.desc': 'Max retries for one model request under network failures, 1–100, default 10. After the limit the request terminates through the normal flow (messages stay in the session log).',
			'param.maxAttempts.effect': 'Larger: more likely to outlast a long outage, but the request can hang for a long time (no tokens consumed while waiting); smaller for latency-sensitive work.',
			'param.backoffBaseMs.label': 'Retry base backoff (ms)',
			'param.backoffBaseMs.desc': 'Initial backoff between model-request retries, 100–60000 ms, default 1000.',
			'param.backoffBaseMs.effect': 'Smaller: faster recovery on jitter but denser retries; larger reduces wasted retries on flaky links.',
			'param.backoffMaxMs.label': 'Retry backoff cap (ms)',
			'param.backoffMaxMs.desc': 'Upper bound of retry backoff, 1000–3600000 ms, default 600000 (10 minutes).',
			'param.backoffMaxMs.effect': 'The default covers long outages; smaller values cap single waits and shorten the overall retry window.',
			'param.backoffFactor.label': 'Retry backoff factor',
			'param.backoffFactor.desc': 'Multiplier that grows the retry interval, 1.1–5, default 2.',
			'param.backoffFactor.effect': 'Larger: intervals grow fast, saving resources; smaller keeps a denser retry rhythm for jittery links.',
			'param.jitterRatio.label': 'Backoff jitter ratio',
			'param.jitterRatio.desc': 'Random jitter applied to backoff delays, 0–0.5, default 0.2. Prevents synchronized retry storms.',
			'param.jitterRatio.effect': 'Keep ≥0.2 with concurrent sessions to avoid retry storms; larger spreads retries more but widens per-wait variance.',
			'param.retryableCodes.label': 'Retryable error codes',
			'param.retryableCodes.desc': 'Comma-separated error codes treated as network failures. Defaults cover transport and stream errors: TRANSPORT, TIMEOUT, STREAM_CLOSED, EMPTY_RESPONSE, MALFORMED_RESPONSE.',
			'param.retryableCodes.effect': 'Append custom network-class codes from your provider; adding non-recoverable codes makes requests retry uselessly.',
			'param.retryStatuses.label': 'Retryable HTTP statuses',
			'param.retryStatuses.desc': 'Comma-separated HTTP statuses treated as retryable. Default 429, 500, 502, 503, 504.',
			'param.retryStatuses.effect': '429 is handled with exponential backoff automatically; never add 4xx auth errors or retries will loop pointlessly.',
			'param.cacheEnabled.label': 'Enable response cache',
			'param.cacheEnabled.desc': 'Cache fully successful model responses; identical requests (same fingerprint) replay locally with zero tokens and no network call.',
			'param.cacheEnabled.effect': 'Saves tokens and waiting on repeats (re-sends, multi-session identical requests) and during outages; turn off for realtime-sensitive tasks.',
			'param.cacheMaxEntries.label': 'Cache entry limit',
			'param.cacheMaxEntries.desc': 'Max cached entries; LRU eviction beyond this, 1–1000, default 50.',
			'param.cacheMaxEntries.effect': 'Larger: more hits but more memory; keep the default for ordinary sessions.',
			'param.cacheMaxAgeMs.label': 'Cache TTL (ms)',
			'param.cacheMaxAgeMs.desc': 'Validity of cached entries, 1000–86400000 ms, default 600000 (10 minutes).',
			'param.cacheMaxAgeMs.effect': 'Larger: longer replay window during outages but possibly stale content; smaller: fresher but fewer hits.',
			'param.reduceMaxTokens.label': 'Degraded output cap (empty = none)',
			'param.reduceMaxTokens.desc': 'Output token cap applied to model requests while degraded (weak network); empty means unlimited. Range 100–128000.',
			'param.reduceMaxTokens.effect': 'Once set, replies get shorter and cheaper during recovery; too small truncates key output — start around 2000.',
			'param.pruneToolResults.label': 'Prune tool results while degraded',
			'param.pruneToolResults.desc': 'Deterministically prune (head/middle/tail) tool results in the session while degraded to shrink future request context. Irreversible.',
			'param.pruneToolResults.effect': 'Enable for long tasks near the context limit; the context stays permanently trimmed afterwards — use with care.',
			'param.showStatusDock.label': 'Show network status',
			'param.showStatusDock.desc': 'Show network status in the bottom info bar under the composer (alongside the stats line): green=online, amber=weak network, red=offline.',
			'param.showStatusDock.effect': 'On: network state is always visible; turn off for crowded UIs.',
			'param.statusPollMs.label': 'Status poll interval (ms)',
			'param.statusPollMs.desc': 'Polling interval for the settings page and status dock, 1000–60000 ms, default 5000.',
			'param.statusPollMs.effect': 'Smaller: fresher status but more RPC traffic; larger: cheaper but slightly stale.',
			'param.persistParams.label': 'Persist parameters',
			'param.persistParams.desc': 'Best-effort save of parameters to workspace .dsh/weaknet-params.json, restored on plugin reload; falls back to memory on write failure.',
			'param.persistParams.effect': 'Keeps your adjustments across restarts; note that sessions sharing one workspace overwrite each other’s file.',
		};

		// ---------------------------------------------------------------
		// 工具
		// ---------------------------------------------------------------
		function fmt(template, vars) {
			return template.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? String(vars[k]) : m));
		}

		// 网络语义图标（内联线性 SVG，1.5px stroke，与产品图标同风格）
		function WifiIcon({ size = 14, color = 'currentColor' }) {
			return React.createElement('svg', {
				width: size,
				height: size,
				viewBox: '0 0 24 24',
				fill: 'none',
				stroke: color,
				strokeWidth: 1.5,
				strokeLinecap: 'round',
				strokeLinejoin: 'round',
				'aria-hidden': true,
			},
				React.createElement('path', { d: 'M5 12.55a11 11 0 0 1 14.08 0' }),
				React.createElement('path', { d: 'M1.42 9a16 16 0 0 1 21.16 0' }),
				React.createElement('path', { d: 'M8.53 16.11a6 6 0 0 1 6.95 0' }),
				React.createElement('line', { x1: '12', y1: '20', x2: '12.01', y2: '20' }));
		}

		// 低注意力三色：柔和、低饱和，避免打扰
		const STATUS_COLORS = { ok: '#3f9e6b', warn: '#c98f24', crit: '#bf5b52' };

		// ---------------------------------------------------------------
		// Remote contribution：client 端必须显式 $mount 才会安装
		// `remote.weaknet` 命名空间服务（否则引用它会永远等待，导致 WebUI 卡死）。
		// strict codec 仅要求 schema.parse()，手写兼容对象即可（不依赖 zod）。
		// ---------------------------------------------------------------
		const parseJson = {
			parse(value) {
				return value;
			}
		};
		const WEAKNET_REMOTE = {
			package: 'dsh-plugin-weaknet-adaptor',
			descriptors: [
				{
					id: 'dsh-plugin-weaknet-adaptor#weaknet/getParamDefs',
					service: 'weaknet',
					namespace: 'weaknet',
					method: 'getParamDefs',
					invocation: { kind: 'direct' },
					parameters: [],
					result: { mode: 'strict', typeSymbol: 'dsh-plugin-weaknet-adaptor#WeaknetGetParamDefsResult', schema: parseJson },
					sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
				},
				{
					id: 'dsh-plugin-weaknet-adaptor#weaknet/getParams',
					service: 'weaknet',
					namespace: 'weaknet',
					method: 'getParams',
					invocation: { kind: 'direct' },
					parameters: [],
					result: { mode: 'strict', typeSymbol: 'dsh-plugin-weaknet-adaptor#WeaknetGetParamsResult', schema: parseJson },
					sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
				},
				{
					id: 'dsh-plugin-weaknet-adaptor#weaknet/setParams',
					service: 'weaknet',
					namespace: 'weaknet',
					method: 'setParams',
					invocation: { kind: 'direct' },
					parameters: [
						{
							name: 'request',
							wire: 'request',
							source: 'json',
							codec: { mode: 'strict', typeSymbol: 'dsh-plugin-weaknet-adaptor#WeaknetSetParamsRequest', schema: parseJson }
						}
					],
					result: { mode: 'strict', typeSymbol: 'dsh-plugin-weaknet-adaptor#WeaknetSetParamsResult', schema: parseJson },
					sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
				},
				{
					id: 'dsh-plugin-weaknet-adaptor#weaknet/getStatus',
					service: 'weaknet',
					namespace: 'weaknet',
					method: 'getStatus',
					invocation: { kind: 'direct' },
					parameters: [],
					result: { mode: 'strict', typeSymbol: 'dsh-plugin-weaknet-adaptor#WeaknetGetStatusResult', schema: parseJson },
					sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
				},
				{
					id: 'dsh-plugin-weaknet-adaptor#weaknet/resetStats',
					service: 'weaknet',
					namespace: 'weaknet',
					method: 'resetStats',
					invocation: { kind: 'direct' },
					parameters: [],
					result: { mode: 'strict', typeSymbol: 'dsh-plugin-weaknet-adaptor#WeaknetResetStatsResult', schema: parseJson },
					sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
				}
			]
		};

		// ---------------------------------------------------------------
		// 插件
		// ---------------------------------------------------------------
		const name = 'weaknet-adaptor';
		// 不能 inject 'remote.weaknet'（自建服务会死锁）；也不能依赖
		// ctx.get('remote.weaknet')（命名空间服务注册在 gateway 的子 fiber，
		// cordis 服务查找沿 fiber 父链，兄弟/子 fiber 不可见）。
		// 组件直接走通用 RPC 通道 ctx.connection.rpc（与 api-gateway 内部同款）。
		const inject = ['slots', 'remote', 'connection', 'locale', 'timer'];

		async function apply(ctx) {
			const locale = ctx.locale;

			// 注册 Remote contribution（合规性：供 gateway/其他插件发现）。
			// fail-soft：失败只记日志；组件走 connection RPC 桥，不受影响。
			try {
				await ctx.remote.$mount(WEAKNET_REMOTE);
			} catch (e) {
				console.error('weaknet: remote $mount failed (RPC bridge still works)', e);
			}

			// 直接 RPC 调用桥：/api 通道 + weaknet/<method> endpoint。
			const weaknetCall = async (method, args) => {
				const result = await ctx.connection.rpc.call('/api', 'weaknet/' + method, { args }, undefined);
				if (!result.ok) {
					const err = result.error;
					throw new Error((err && (err.code || err.message)) || 'weaknet rpc failed');
				}
				return result.value;
			};
			const weaknet = {
				getParamDefs: () => weaknetCall('getParamDefs', {}),
				getParams: () => weaknetCall('getParams', {}),
				setParams: (request) => weaknetCall('setParams', { request }),
				getStatus: () => weaknetCall('getStatus', {}),
				resetStats: () => weaknetCall('resetStats', {}),
			};

			// t：跟随系统语言（不注册 locale namespace，避免注册冲突）
			const t = (key) => {
				let id = '';
				try {
					const snap = locale.getLocale();
					if (snap && typeof snap === 'object') id = snap.id ?? snap.locale ?? '';
				} catch (e) {
					id = '';
				}
				const dict = /^zh/.test(id) ? zhDict : enDict;
				return dict[key] ?? key;
			};

			// ---------- 设置页 ----------
			function SettingsSection() {
				const [defs, setDefs] = React.useState(null);
				const [form, setForm] = React.useState(null);
				const [status, setStatus] = React.useState(null);
				const [notice, setNotice] = React.useState(null);
				const [loadError, setLoadError] = React.useState(null);
				const formRef = React.useRef(null);
				formRef.current = form;
				const [, force] = React.useReducer((x) => x + 1, 0);

				React.useEffect(() => {
					if (locale && typeof locale.subscribe === 'function') return locale.subscribe(() => force());
					return undefined;
				}, []);

				React.useEffect(() => {
					let alive = true;
					let disposer = null;
					const loadAll = async () => {
						if (!alive) return;
						try {
							const [d, p] = await Promise.all([weaknet.getParamDefs(), weaknet.getParams()]);
							if (!alive) return;
							if (d && d.defs) setDefs(d.defs);
							if (p && p.params) setForm(p.params);
							setLoadError(null);
						} catch (e) {
							// host 侧未就绪时静默重试，但把错误透出便于诊断
							setLoadError(String(e && e.message || e));
						}
					};
					const loop = async () => {
						if (!alive) return;
						try {
							const s = await weaknet.getStatus();
							if (alive) setStatus(s);
						} catch (e) {
							// 忽略轮询错误
						}
						if (!alive) return;
						const ms = formRef.current && formRef.current.statusPollMs ? formRef.current.statusPollMs : 5000;
						disposer = ctx.timeout(loop, ms);
					};
					loadAll();
					loop();
					return () => {
						alive = false;
						if (disposer) disposer();
					};
				}, []);

				const update = (key, value) => {
					setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
				};

				const save = async () => {
					if (!form) return;
					const patch = {};
					for (const def of defs) {
						const v = form[def.key];
						if (def.type === 'string[]' && Array.isArray(v)) patch[def.key] = v;
						else if (def.type === 'number[]' && Array.isArray(v)) patch[def.key] = v;
						else patch[def.key] = v;
					}
					try {
						const r = await weaknet.setParams({ patch });
						if (r && r.ok) {
							setNotice({ kind: 'ok', text: t('section.saved') });
						} else {
							const msgs = (r && r.errors || []).map((e) => t('error.' + e.code) || e.code).join('; ');
							setNotice({ kind: 'err', text: fmt(t('section.error'), { msg: msgs || '?' }) });
						}
					} catch (e) {
						setNotice({ kind: 'err', text: fmt(t('section.error'), { msg: String(e) }) });
					}
				};

				const resetDefaults = async () => {
					try {
						const r = await weaknet.setParams({ reset: true });
						if (r && r.ok) {
							const p = await weaknet.getParams();
							if (p && p.params) setForm(p.params);
							setNotice({ kind: 'ok', text: t('section.saved') });
						}
					} catch (e) {
						// 忽略
					}
				};

				const resetStats = async () => {
					try {
						await weaknet.resetStats();
						const s = await weaknet.getStatus();
						if (s) setStatus(s);
					} catch (e) {
						// 忽略
					}
				};

				const groups = ['general', 'network', 'retry', 'cache', 'economy', 'ui', 'storage'];
				const defsByGroup = {};
				if (defs) {
					for (const def of defs) {
						;(defsByGroup[def.group] = defsByGroup[def.group] || []).push(def);
					}
				}

				const renderField = (def) => {
					const key = def.key;
					const value = form ? form[key] : undefined;
					const label = t('param.' + key + '.label');
					const desc = t('param.' + key + '.desc');
					const effect = t('param.' + key + '.effect');
					const rowStyle = { marginBottom: 14 };
					const labelStyle = { fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 4 };
					const descStyle = { fontSize: 12, opacity: 0.75, display: 'block', marginBottom: 4, lineHeight: 1.5 };
					const effectStyle = { fontSize: 12, opacity: 0.6, display: 'block', marginBottom: 6, lineHeight: 1.5, fontStyle: 'italic' };
					const inputStyle = { width: '100%', boxSizing: 'border-box' };
					let control = null;
					if (def.type === 'boolean') {
						control = React.createElement('input', { type: 'checkbox', checked: !!value, onChange: (e) => update(key, e.target.checked) });
					} else if (def.type === 'enum') {
						control = React.createElement('select', { value: value === undefined ? def.default : value, onChange: (e) => update(key, e.target.value) },
							def.options.map((opt) => React.createElement('option', { key: opt, value: opt }, opt)));
					} else if (def.type === 'number') {
						control = React.createElement('input', { type: 'number', style: inputStyle, value: value === undefined ? def.default : value, onChange: (e) => update(key, Number(e.target.value)) });
					} else if (def.type === 'null-number') {
						control = React.createElement('input', { type: 'number', style: inputStyle, placeholder: def.default === null ? 'null' : String(def.default), value: value === undefined || value === null ? '' : value, onChange: (e) => update(key, e.target.value === '' ? null : Number(e.target.value)) });
					} else if (def.type === 'string') {
						control = React.createElement('input', { type: 'text', style: inputStyle, value: value === undefined ? def.default : value, onChange: (e) => update(key, e.target.value) });
					} else if (def.type === 'string[]') {
						control = React.createElement('input', { type: 'text', style: inputStyle, value: Array.isArray(value) ? value.join(', ') : (def.default || []).join(', '), onChange: (e) => update(key, e.target.value.split(',').map((s) => s.trim()).filter((s) => s.length > 0)) });
					} else if (def.type === 'number[]') {
						control = React.createElement('input', { type: 'text', style: inputStyle, value: Array.isArray(value) ? value.join(', ') : (def.default || []).join(', '), onChange: (e) => update(key, e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))) });
					}
					return React.createElement('div', { key: key, style: rowStyle },
						React.createElement('label', { style: labelStyle }, label),
						React.createElement('span', { style: descStyle }, desc),
						control,
						React.createElement('span', { style: effectStyle }, '▸ ' + effect));
				};

				return React.createElement('div', { style: { padding: '8px 4px' } },
					React.createElement('h3', { style: { margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 } },
						React.createElement(WifiIcon, { size: 15, color: status && status.severity === 'crit' ? STATUS_COLORS.crit : (status && status.severity === 'warn' ? STATUS_COLORS.warn : STATUS_COLORS.ok) }),
						t('section.status')),
					status ? React.createElement('div', { style: { marginBottom: 16, fontSize: 13, lineHeight: 1.8 } },
						React.createElement('div', null, status.mode === 'degraded' ? t('status.mode.degraded') : t('status.mode.online'), status.enabled ? '' : ' · ' + t('status.disabled')),
						React.createElement('div', null, t('status.retriesTotal') + ': ' + status.retriesTotal + ' · ' + t('status.degradedCount') + ': ' + status.degradedCount + ' · ' + t('status.restoredCount') + ': ' + status.restoredCount),
						status.mode === 'degraded' ? React.createElement('div', null, t('status.nextProbe') + ': ' + Math.round(status.nextProbeDelayMs / 1000) + 's') : null,
						React.createElement('button', { onClick: resetStats, style: { marginTop: 8, fontSize: 12 } }, t('section.resetStats')))
						: React.createElement('div', { style: { opacity: 0.5 } }, '…'),
					React.createElement('h3', { style: { margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 } },
						React.createElement(WifiIcon, { size: 15, color: '#868e96' }),
						t('section.params')),
					loadError ? React.createElement('div', { style: { color: '#d9480f', marginBottom: 10, fontSize: 12, lineHeight: 1.5 } },
						fmt(t('section.remoteError'), { msg: loadError })) : null,
					defs ? groups.map((g) => (defsByGroup[g] && defsByGroup[g].length > 0
						? React.createElement('div', { key: g, style: { marginBottom: 16 } },
							React.createElement('h4', { style: { margin: '12px 0 8px', fontSize: 13, opacity: 0.85 } }, t('group.' + g)),
							defsByGroup[g].map(renderField))
						: null))
						: React.createElement('div', { style: { opacity: 0.5, fontSize: 13 } }, t('section.loading')),
					notice ? React.createElement('div', { style: { color: notice.kind === 'ok' ? '#2f9e44' : '#d9480f', marginBottom: 10, fontSize: 13 } }, notice.text) : null,
					React.createElement('div', { style: { display: 'flex', gap: 8 } },
						React.createElement('button', { onClick: save }, t('section.save')),
						React.createElement('button', { onClick: resetDefaults }, t('section.reset'))));
			}

			// ---------- 底部信息栏网络状态（composer.dock，与统计信息并排；红黄绿低注意力三色） ----------
			function StatusDock() {
				const [status, setStatus] = React.useState(null);
				const [show, setShow] = React.useState(true);
				const [enabled, setEnabled] = React.useState(true);
				const [, force] = React.useReducer((x) => x + 1, 0);

				React.useEffect(() => {
					if (locale && typeof locale.subscribe === 'function') return locale.subscribe(() => force());
					return undefined;
				}, []);

				React.useEffect(() => {
					let alive = true;
					let disposer = null;
					const loop = async () => {
						if (!alive) return;
						try {
							const [s, p] = await Promise.all([weaknet.getStatus(), weaknet.getParams()]);
							if (!alive) return;
							setStatus(s);
							if (p && p.params) {
								setShow(p.params.showStatusDock !== false);
								setEnabled(p.params.enabled !== false);
							}
						} catch (e) {
							// 忽略轮询错误
						}
						if (!alive) return;
						disposer = ctx.timeout(loop, 5000);
					};
					loop();
					return () => {
						alive = false;
						if (disposer) disposer();
					};
				}, []);

				if (!show) return null;
				const style = {
					display: 'inline-flex',
					alignItems: 'center',
					gap: 6,
					fontSize: 12,
					padding: '2px 8px',
					borderRadius: 6,
					lineHeight: 1.5,
				};
				if (!status) return React.createElement('span', { style: { ...style, color: '#868e96', opacity: 0.6 } },
					React.createElement(WifiIcon, { size: 12, color: '#868e96' }));
				if (!enabled) return React.createElement('span', { style: { ...style, color: '#868e96' } },
					React.createElement(WifiIcon, { size: 12, color: '#868e96' }),
					' ' + t('dock.off'));
				const sev = status.severity === 'crit' ? 'crit' : (status.severity === 'warn' ? 'warn' : 'ok');
				let text = '';
				if (sev === 'ok') {
					text = t('dock.online');
				} else {
					text = fmt(t(sev === 'crit' ? 'dock.offline' : 'dock.degraded'), {
						n: status.retriesTotal,
						s: Math.max(Math.round(status.nextProbeDelayMs / 1000), 1),
					});
				}
				return React.createElement('span', { style: { ...style, color: STATUS_COLORS[sev], opacity: 0.9 } },
					React.createElement(WifiIcon, { size: 12, color: STATUS_COLORS[sev] }),
					' ' + text);
			}

			// ---------- 注册 ----------
			ctx.slots.inject('settings.section', () => ctx.slots.register(
				{ name: 'settings.section', id: 'weaknet', order: 30, label: () => t('section.label') },
				() => React.createElement(SettingsSection, null)));
			ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
				{ name: 'conversation.composer.dock', id: 'weaknet-status', order: 10 },
				() => React.createElement(StatusDock, null)));
		}

		module.exports = { name, inject, apply };
		return module.exports;
	},
});
