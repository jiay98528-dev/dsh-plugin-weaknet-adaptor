/**
 * dsh-plugin-weaknet-adaptor — type declarations
 */
import type { Context } from '@deepseek-ai/cordis'

export const name: string
export const inject: readonly string[]

/** Remote service namespace `weaknet` (SRC markers, no generated typert artifact). */
export interface WeaknetRemote {
  getParamDefs(): Promise<{ defs: ParamDef[] }>
  getParams(): Promise<{ params: Record<string, unknown>; revision: number }>
  setParams(request: { patch?: Record<string, unknown>; reset?: boolean }): Promise<{ ok: true } | { ok: false; errors: { key: string; code: string }[] }>
  getStatus(): Promise<WeaknetStatus>
  resetStats(): Promise<{ ok: true }>
}

export interface ParamDef {
  key: string
  group: string
  type: 'boolean' | 'number' | 'string' | 'enum' | 'string[]' | 'number[]' | 'null-number'
  default: unknown
  min?: number
  max?: number
  options?: readonly string[]
}

export interface WeaknetStatus {
  mode: 'online' | 'degraded'
  severity: 'ok' | 'warn' | 'crit'
  degradedSince: number
  enabled: boolean
  nextProbeDelayMs: number
  lastProbeAt: number
  lastProbeOk: boolean
  maxAttempts: number
  cacheHits: number
  cacheMisses: number
  degradedCount: number
  restoredCount: number
  retriesTotal: number
  cacheSize: number
}

export declare function apply(ctx: Context): Promise<void>
