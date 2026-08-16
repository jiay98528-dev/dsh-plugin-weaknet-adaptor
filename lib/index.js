/**
 * dsh-plugin-weaknet-adaptor — Host half
 *
 * Weak-network adaptor for the DeepSeek Harness:
 *  - transparent long-backoff retry for model streams in the `llm/stream`
 *    waterfall (degraded mode buffers and retries with exponential backoff,
 *    capped at `backoffMaxMs`, default 10 minutes);
 *  - local replay cache of fully successful responses (identical requests
 *    replay with zero tokens and no network call);
 *  - heartbeat auto-reconnect: while degraded, a local heartbeat task probes
 *    `probeUrl` with exponential backoff up to `heartbeatMaxIntervalMs`
 *    (default 600000 ms = 10 minutes); any successful model stream also
 *    passively restores the online state;
 *  - degraded-mode economy: optional output-token cap (`reduceMaxTokens`) and
 *    optional deterministic tool-result pruning (`pruneToolResults`);
 *  - fully structured parameters exposed through a Remote service
 *    (`weaknet/*`) consumed by the browser settings page.
 *
 * @module dsh-plugin-weaknet-adaptor
 */
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

// ---------------------------------------------------------------------------
// 参数定义表（结构化，单一数据源；i18n 文案在 Client 内置 zh/en 字典）
// ---------------------------------------------------------------------------
const PARAM_DEFS = [
  { key: 'enabled', group: 'general', type: 'boolean', default: true },
  { key: 'probeUrl', group: 'network', type: 'string', default: 'https://www.gstatic.com/generate_204' },
  { key: 'probeTimeoutMs', group: 'network', type: 'number', default: 5000, min: 500, max: 60000 },
  { key: 'probeMode', group: 'network', type: 'enum', default: 'fetch', options: ['fetch', 'off'] },
  { key: 'heartbeatBaseIntervalMs', group: 'network', type: 'number', default: 1000, min: 200, max: 60000 },
  { key: 'heartbeatMaxIntervalMs', group: 'network', type: 'number', default: 600000, min: 10000, max: 3600000 },
  { key: 'heartbeatBackoffFactor', group: 'network', type: 'number', default: 2, min: 1.1, max: 5 },
  { key: 'successThreshold', group: 'network', type: 'number', default: 1, min: 1, max: 10 },
  { key: 'criticalFailures', group: 'network', type: 'number', default: 3, min: 1, max: 100 },
  { key: 'maxAttempts', group: 'retry', type: 'number', default: 10, min: 1, max: 100 },
  { key: 'backoffBaseMs', group: 'retry', type: 'number', default: 1000, min: 100, max: 60000 },
  { key: 'backoffMaxMs', group: 'retry', type: 'number', default: 600000, min: 1000, max: 3600000 },
  { key: 'backoffFactor', group: 'retry', type: 'number', default: 2, min: 1.1, max: 5 },
  { key: 'jitterRatio', group: 'retry', type: 'number', default: 0.2, min: 0, max: 0.5 },
  { key: 'retryableCodes', group: 'retry', type: 'string[]', default: ['TRANSPORT', 'TIMEOUT', 'STREAM_CLOSED', 'EMPTY_RESPONSE', 'MALFORMED_RESPONSE'] },
  { key: 'retryStatuses', group: 'retry', type: 'number[]', default: [429, 500, 502, 503, 504] },
  { key: 'cacheEnabled', group: 'cache', type: 'boolean', default: true },
  { key: 'cacheMaxEntries', group: 'cache', type: 'number', default: 50, min: 1, max: 1000 },
  { key: 'cacheMaxAgeMs', group: 'cache', type: 'number', default: 600000, min: 1000, max: 86400000 },
  { key: 'reduceMaxTokens', group: 'economy', type: 'null-number', default: null, min: 100, max: 128000 },
  { key: 'pruneToolResults', group: 'economy', type: 'boolean', default: false },
  { key: 'showStatusDock', group: 'ui', type: 'boolean', default: true },
  { key: 'statusPollMs', group: 'ui', type: 'number', default: 5000, min: 1000, max: 60000 },
  { key: 'persistParams', group: 'storage', type: 'boolean', default: true },
]

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
function validateValue(def, v) {
  if (v === undefined || v === null) return def.type === 'null-number'
  switch (def.type) {
    case 'boolean': return typeof v === 'boolean'
    case 'number': return typeof v === 'number' && Number.isFinite(v) && (def.min === undefined || v >= def.min) && (def.max === undefined || v <= def.max)
    case 'string': return typeof v === 'string'
    case 'enum': return def.options.includes(v)
    case 'string[]': return Array.isArray(v) && v.every((x) => typeof x === 'string')
    case 'number[]': return Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x))
    case 'null-number': return typeof v === 'number' && Number.isFinite(v) && (def.min === undefined || v >= def.min) && (def.max === undefined || v <= def.max)
  }
  return false
}

/** 归一化：undefined → 默认值；null-number 的 undefined/null → null（保证 RPC 返回纯 JSON）。 */
function normalizeParams(user) {
  const out = {}
  for (const def of PARAM_DEFS) {
    const v = user ? user[def.key] : undefined
    if (v === undefined) {
      out[def.key] = def.type === 'null-number' ? null : def.default
    } else {
      out[def.key] = validateValue(def, v) ? v : def.default
    }
  }
  return out
}

/** 规范序列化：对象键排序、数组保序、跳过 undefined —— 用于请求指纹与缓存 key。 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value).sort()
  const parts = []
  for (const k of keys) {
    const v = value[k]
    if (v === undefined) continue
    parts.push(JSON.stringify(k) + ':' + stableStringify(v))
  }
  return '{' + parts.join(',') + '}'
}

function requestFingerprint(options) {
  return stableStringify({
    provider: options.provider,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stop: options.stop,
    system: options.system,
    tools: options.tools,
    messages: options.messages,
    purpose: options.purpose,
  })
}

function isOkFinish(chunk) {
  const kind = chunk && chunk.reason ? chunk.reason.kind : undefined
  return kind === 'stop' || kind === 'tool-calls' || kind === 'max-tokens'
}

function isNetworkFailure(failure, params) {
  if (!failure) return false
  const codes = params.retryableCodes || []
  if (codes.includes(failure.code)) return true
  if (failure.status !== undefined) {
    const statuses = params.retryStatuses || []
    if (statuses.includes(failure.status)) return true
  }
  return false
}

function backoffDelay(attempt, params) {
  const base = params.backoffBaseMs
  const factor = params.backoffFactor
  const max = params.backoffMaxMs
  const jitter = params.jitterRatio
  const exp = Math.min(base * Math.pow(factor, Math.max(attempt - 1, 0)), max)
  const j = 1 - jitter + 2 * jitter * Math.random()
  return Math.min(exp * j, max)
}

function severityOf(state) {
  if (state.mode === 'online') return 'ok'
  return state.heartbeat.failures >= state.criticalFailures ? 'crit' : 'warn'
}

// ---------------------------------------------------------------------------
// Remote 装饰器（纯 JS 手写等价物：@Remote 需要标准 ClassMethodDecoratorContext）
// ---------------------------------------------------------------------------
const remoteInitializers = []
function markRemote(proto, method) {
  Remote(proto[method], {
    kind: 'method',
    name: method,
    static: false,
    private: false,
    access: {},
    addInitializer(fn) { remoteInitializers.push(fn) },
  })
}

// ---------------------------------------------------------------------------
// Weaknet 服务：承载全部状态与 Remote 方法（命名空间 `weaknet`）
// ---------------------------------------------------------------------------
class WeaknetService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'weaknet')
    this._ctx = ctx
    // 运行 Remote 装饰器初始器（幂等）
    for (const init of remoteInitializers) init.call(this)

    this.disposed = false
    this.resolveDisposed = null
    this.disposedPromise = new Promise((resolve) => { this.resolveDisposed = resolve })

    this.userParams = {}
    this.params = normalizeParams(null)
    this.mode = 'online' // 'online' | 'degraded'
    this.degradedSince = 0
    this.heartbeatTimer = null
    this.heartbeat = { failures: 0, successCount: 0, lastProbeAt: 0, lastProbeOk: false, nextDelayMs: 0 }
    this.stats = { cacheHits: 0, cacheMisses: 0, degradedCount: 0, restoredCount: 0, retriesTotal: 0 }
    this.cache = new Map() // key -> { at, chunks }

    this.boot = this.loadParams().then(() => {
      this.params = normalizeParams(this.userParams)
      ctx.logger.info('weaknet: started, mode=online')
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.resolveDisposed()
    if (this.heartbeatTimer) { this.heartbeatTimer() }
    this.heartbeatTimer = null
    this.cache.clear()
  }

  // ---------- 睡眠（可被 turn signal / 插件销毁 中断） ----------
  sleep(ms, signal) {
    return Promise.race([
      this._ctx.timeout(ms),
      this.disposedPromise,
      new Promise((resolve) => {
        if (!signal) return
        if (signal.aborted) return resolve()
        signal.addEventListener('abort', resolve, { once: true })
      }),
    ])
  }

  // ---------- 缓存 ----------
  cacheGet(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.at > this.params.cacheMaxAgeMs) {
      this.cache.delete(key)
      return null
    }
    this.cache.delete(key)
    this.cache.set(key, entry) // LRU touch
    return entry.chunks
  }

  cacheSet(key, chunks) {
    if (!chunks || chunks.length === 0) return
    this.cache.delete(key)
    this.cache.set(key, { at: Date.now(), chunks })
    while (this.cache.size > this.params.cacheMaxEntries) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      this.cache.delete(oldest)
    }
  }

  // ---------- 心跳 ----------
  scheduleHeartbeat(delayMs) {
    if (this.disposed || !this.params.enabled || this.mode !== 'degraded') return
    this.heartbeat.nextDelayMs = delayMs
    if (this.heartbeatTimer) { this.heartbeatTimer() }
    this.heartbeatTimer = this._ctx.timeout(() => {
      this.heartbeatTimer = null
      this.tickHeartbeat()
    }, delayMs)
  }

  async probe() {
    if (this.params.probeMode === 'off') return false
    const web = this._ctx.get('web')
    if (!web) {
      this._ctx.logger.warn('weaknet: web service unavailable; heartbeat cannot probe')
      return false
    }
    try {
      const result = await Promise.race([
        web.fetch({ url: this.params.probeUrl }),
        this._ctx.timeout(this.params.probeTimeoutMs).then(() => null),
      ])
      return result !== null // 拿到任意 HTTP 响应（含非 2xx）= 网络可达
    } catch (e) {
      return false
    }
  }

  async tickHeartbeat() {
    if (this.disposed || this.mode !== 'degraded') return
    const ok = await this.probe()
    this.heartbeat.lastProbeAt = Date.now()
    this.heartbeat.lastProbeOk = ok
    if (ok) {
      this.heartbeat.failures = 0 // 重置连续失败计数（severity 回退到黄色弱网）
      this.heartbeat.successCount += 1
      if (this.heartbeat.successCount >= this.params.successThreshold) {
        this.markOnline()
        return
      }
      this.scheduleHeartbeat(this.params.heartbeatBaseIntervalMs)
    } else {
      this.heartbeat.successCount = 0
      this.heartbeat.failures += 1
      const delay = Math.min(
        this.params.heartbeatBaseIntervalMs * Math.pow(this.params.heartbeatBackoffFactor, Math.max(this.heartbeat.failures - 1, 0)),
        this.params.heartbeatMaxIntervalMs,
      )
      this.scheduleHeartbeat(delay)
    }
  }

  // ---------- 状态机 ----------
  degrade() {
    if (this.disposed || !this.params.enabled || this.mode === 'degraded') return
    this.mode = 'degraded'
    this.degradedSince = Date.now()
    this.stats.degradedCount += 1
    this.heartbeat = { failures: 0, successCount: 0, lastProbeAt: 0, lastProbeOk: false, nextDelayMs: 0 }
    this.scheduleHeartbeat(this.params.heartbeatBaseIntervalMs)
    this._ctx.logger.warn('weaknet: degraded at ' + new Date(this.degradedSince).toISOString())
  }

  markOnline() {
    if (this.disposed || this.mode === 'online') return
    this.mode = 'online'
    this.stats.restoredCount += 1
    if (this.heartbeatTimer) { this.heartbeatTimer() }
    this.heartbeatTimer = null
    this.heartbeat = { failures: 0, successCount: 0, lastProbeAt: 0, lastProbeOk: false, nextDelayMs: 0 }
    this._ctx.logger.info('weaknet: restored at ' + new Date().toISOString())
  }

  // ---------- 流包装 ----------
  replayChunks(chunks, options) {
    return (async function* () {
      for (const chunk of chunks) {
        if (options.signal && options.signal.aborted) return
        yield chunk
      }
    })()
  }

  // online：流式转发 + 缓存收集 + 状态观察（不做内部重试，交给 loop 的 request-error 流程）
  passthroughStream(options, next, key) {
    return (async function* () {
      const collected = key ? [] : null
      const stream = next()
      for await (const chunk of stream) {
        if (key) collected.push(chunk)
        if (chunk.type === 'finish') {
          if (isOkFinish(chunk)) {
            if (key) this.cacheSet(key, collected)
            this.markOnline()
          } else if (chunk.reason && isNetworkFailure(chunk.reason.failure, this.params)) {
            this.degrade()
          }
          yield chunk
          return
        }
        yield chunk
      }
      // 流提前结束且无 finish（异常保护）
      throw new Error('weaknet: stream ended without finish')
    }).call(this)
  }

  // degraded：全缓冲 + 指数退避内部重试（最长退避上限默认 10 分钟）
  retryStream(options, next, key) {
    let attempt = 0
    const self = this
    return (async function* () {
      while (true) {
        attempt += 1
        if (self.disposed || (options.signal && options.signal.aborted)) return
        let stream
        try {
          stream = next()
        } catch (e) {
          if (attempt < self.params.maxAttempts && !self.disposed) {
            self.stats.retriesTotal += 1
            await self.sleep(backoffDelay(attempt, self.params), options.signal)
            continue
          }
          throw e
        }
        const collected = []
        let terminal = null
        try {
          for await (const chunk of stream) {
            collected.push(chunk)
            if (chunk.type === 'finish') {
              terminal = chunk
              break
            }
          }
        } catch (e) {
          // 迭代器异常（防御性）：按可重试处理
          if (!self.disposed && !(options.signal && options.signal.aborted) && attempt < self.params.maxAttempts) {
            self.degrade()
            self.stats.retriesTotal += 1
            await self.sleep(backoffDelay(attempt, self.params), options.signal)
            continue
          }
          throw e
        }
        if (!terminal) {
          throw new Error('weaknet: stream ended without finish')
        }
        if (isOkFinish(terminal)) {
          if (key) self.cacheSet(key, collected)
          self.markOnline()
          for (const chunk of collected) {
            if (options.signal && options.signal.aborted) return
            yield chunk
          }
          return
        }
        const failure = terminal.reason && terminal.reason.failure
        if (isNetworkFailure(failure, self.params)) {
          self.degrade()
          if (!self.disposed && !(options.signal && options.signal.aborted) && attempt < self.params.maxAttempts) {
            self.stats.retriesTotal += 1
            await self.sleep(backoffDelay(attempt, self.params), options.signal)
            continue
          }
        }
        // 不可重试 / 超限：把本次收集的 chunks 原样上交（含 finish error，交由 loop 的 request-error 流程）
        for (const chunk of collected) {
          if (options.signal && options.signal.aborted) return
          yield chunk
        }
        return
      }
    })()
  }

  /** llm/stream 瀑布入口：缓存 + 重试 + 状态观察。 */
  handleStream(options, next) {
    if (!this.params.enabled) return next()
    const key = this.params.cacheEnabled ? requestFingerprint(options) : null
    if (key) {
      const hit = this.cacheGet(key)
      if (hit) {
        this.stats.cacheHits += 1
        this._ctx.logger.info('weaknet: cache hit (' + this.stats.cacheHits + ')')
        return this.replayChunks(hit, options)
      }
      this.stats.cacheMisses += 1
    }
    if (this.mode === 'degraded') return this.retryStream(options, next, key)
    return this.passthroughStream(options, next, key)
  }

  /** agent/request-error：仅观察降级（接管留给宿主 llm-retry / 流层重试）。 */
  observeRequestError(payload) {
    if (this.params.enabled && isNetworkFailure(payload.failure, this.params)) this.degrade()
  }

  /** agent/request：降级期间施加输出上限。 */
  applyRequestConfig(config) {
    if (!this.params.enabled || this.mode !== 'degraded') return config
    const cap = this.params.reduceMaxTokens
    if (!cap || cap <= 0) return config
    if (config && (config.maxTokens === undefined || config.maxTokens > cap)) {
      return { ...config, maxTokens: cap }
    }
    return config
  }

  /** agent/pre-step：降级且开启时裁剪工具结果（不可逆，默认关闭）。 */
  observePreStep(payload) {
    if (!this.params.enabled || this.mode !== 'degraded' || !this.params.pruneToolResults) return
    const pruner = this._ctx.get('toolResultPruner')
    if (!pruner) return
    try {
      pruner.pruneSession(payload.agent.session)
    } catch (e) {
      this._ctx.logger.error('weaknet: pruneSession failed', e)
    }
  }

  // ---------- 参数持久化（best-effort） ----------
  async persistParams() {
    if (!this.params.persistParams) return
    try {
      const fs = this._ctx.get('fs')
      const sp = this._ctx.get('sandboxPolicy')
      if (!fs || !sp || !sp.workspaceRoot) return
      const path = sp.workspaceRoot + '/.dsh/weaknet-params.json'
      const target = await fs.resolve(path)
      await fs.writeText(target, JSON.stringify(this.userParams), undefined, undefined, sp.resolve())
    } catch (e) {
      this._ctx.logger.info('weaknet: params persist skipped (best-effort): ' + String(e && e.message || e))
    }
  }

  async loadParams() {
    try {
      const fs = this._ctx.get('fs')
      const sp = this._ctx.get('sandboxPolicy')
      if (!fs || !sp || !sp.workspaceRoot) return
      const path = sp.workspaceRoot + '/.dsh/weaknet-params.json'
      const target = await fs.resolve(path)
      const text = await fs.readText(target)
      if (text) {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') this.userParams = parsed
      }
    } catch (e) {
      // 无文件 / 解析失败：保持默认
    }
  }

  // ---------- Remote 方法（命名空间 weaknet；参数名即 wire 字段名） ----------
  getParamDefs() {
    return { defs: PARAM_DEFS }
  }

  getParams() {
    return { params: this.params, revision: 1 }
  }

  setParams(request) {
    const patch = request && typeof request === 'object' ? request.patch : undefined
    if (request && request.reset === true) {
      this.userParams = {}
      this.params = normalizeParams(null)
      this.persistParams()
      return { ok: true }
    }
    if (!patch || typeof patch !== 'object') return { ok: false, errors: [{ key: '_', code: 'INVALID_PATCH' }] }
    const errors = []
    for (const key of Object.keys(patch)) {
      const def = PARAM_DEFS.find((d) => d.key === key)
      if (!def) {
        errors.push({ key, code: 'UNKNOWN_KEY' })
      } else if (!validateValue(def, patch[key])) {
        errors.push({ key, code: 'INVALID_VALUE' })
      }
    }
    if (errors.length > 0) return { ok: false, errors }
    this.userParams = { ...this.userParams, ...patch }
    this.params = normalizeParams(this.userParams)
    this.persistParams()
    return { ok: true }
  }

  getStatus() {
    return {
      mode: this.mode,
      severity: severityOf({ mode: this.mode, heartbeat: this.heartbeat, criticalFailures: this.params.criticalFailures }),
      degradedSince: this.degradedSince,
      enabled: this.params.enabled,
      nextProbeDelayMs: this.heartbeat.nextDelayMs,
      lastProbeAt: this.heartbeat.lastProbeAt,
      lastProbeOk: this.heartbeat.lastProbeOk,
      maxAttempts: this.params.maxAttempts,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      degradedCount: this.stats.degradedCount,
      restoredCount: this.stats.restoredCount,
      retriesTotal: this.stats.retriesTotal,
      cacheSize: this.cache.size,
    }
  }

  resetStats() {
    this.stats.cacheHits = 0
    this.stats.cacheMisses = 0
    this.stats.degradedCount = 0
    this.stats.restoredCount = 0
    this.stats.retriesTotal = 0
    return { ok: true }
  }

  // 自定义 RPC 通道分派：/weaknet/<endpoint>（RpcResult 形状与 gateway 一致）。
  // 这是浏览器半的主要调用路径——不依赖 typert gateway 的 claims（兄弟 fiber 不可见问题）。
  dispatchRpc(endpoint, payload, signal) {
    try {
      const args = payload && typeof payload === 'object' ? payload.args : undefined
      switch (endpoint) {
        case 'getParamDefs':
          return { ok: true, value: this.getParamDefs() }
        case 'getParams':
          return { ok: true, value: this.getParams() }
        case 'setParams':
          return { ok: true, value: this.setParams(args && args.request) }
        case 'getStatus':
          return { ok: true, value: this.getStatus() }
        case 'resetStats':
          return { ok: true, value: this.resetStats() }
        default:
          return { ok: false, error: { code: 'endpoint-not-found', message: 'unknown weaknet endpoint: ' + String(endpoint) } }
      }
    } catch (e) {
      return { ok: false, error: { code: 'internal', message: String(e && e.message || e) } }
    }
  }
}

markRemote(WeaknetService.prototype, 'getParamDefs')
markRemote(WeaknetService.prototype, 'getParams')
markRemote(WeaknetService.prototype, 'setParams')
markRemote(WeaknetService.prototype, 'getStatus')
markRemote(WeaknetService.prototype, 'resetStats')

// ---------------------------------------------------------------------------
// Cordis 插件
// ---------------------------------------------------------------------------
export const name = 'weaknet-adaptor'
export const inject = ['timer']

export async function apply(ctx) {
  const service = new WeaknetService(ctx)
  await service.boot

  // llm/stream：缓存 + 重试 + 状态观察（global + prepend 保证先于其它监听器）
  ctx.on('llm/stream', (options, next) => service.handleStream(options, next), { global: true, prepend: true })

  // agent/request-error：仅观察降级（接管留给宿主 llm-retry / 流层重试）
  ctx.on('agent/request-error', async (payload, next) => {
    service.observeRequestError(payload)
    return next()
  })

  // agent/request：降级期间施加输出上限
  ctx.on('agent/request', async (payload, next) => {
    const config = await next()
    return service.applyRequestConfig(config)
  })

  // agent/pre-step：降级且开启时裁剪工具结果
  ctx.on('agent/pre-step', async (payload, next) => {
    service.observePreStep(payload)
    return next()
  })

  // 注册自定义 RPC 通道 /weaknet：浏览器设置页经此读写参数/状态。
  // 使用 connection.rpc.handle（公开 API），绕过 typert gateway 的
  // claims 可见性（服务注册在插件自身 fiber，gateway 的兄弟 fiber 看不到，
  // 走 /api 共享通道会 404）。
  ctx.inject(['connection'], (connectionCtx) => {
    return connectionCtx.connection.rpc.handle('/weaknet', (endpoint, payload, signal) => {
      return service.dispatchRpc(endpoint, payload, signal)
    }, { authority: 'loopback' })
  })

  // 生命周期清理
  ctx.effect(() => () => {
    service.dispose()
  }, 'weaknet: dispose')
}
