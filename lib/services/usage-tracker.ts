/**
 * Usage Tracker Service
 *
 * Tracks cumulative token usage per tenant per billing period.
 * Calculates usage percentage against tier limits.
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface TenantUsage {
  tenantId: string
  currentUsage: number
  limit: number
  percentage: number
  billingPeriodStart: Date
  billingPeriodEnd: Date
  daysRemaining: number
  isOverLimit: boolean
  tierName: string | null
  hasOverride: boolean
}

interface CachedUsage {
  usage: TenantUsage
  timestamp: number
}

interface TenantProfileWithTier {
  id: string
  tier_id: string | null
  usage_limit_override: number | null
  billing_period_start: string | null
  subscription_tiers: {
    id: string
    name: string
    monthly_token_limit: number | null
  } | null
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL_MS = 60 * 1000

// ============================================================================
// Cache
// ============================================================================

const usageCache = new Map<string, CachedUsage>()

// ============================================================================
// Database Client
// ============================================================================

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateBillingPeriodEnd(start: Date): Date {
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return end
}

function calculateDaysRemaining(end: Date): number {
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

// ============================================================================
// Service Implementation
// ============================================================================

async function getTenantProfile(tenantId: string): Promise<TenantProfileWithTier | null> {
  const supabase = getServiceClient()

  const { data, error } = await (supabase
    .from('tenant_profiles') as any)
    .select(`
      id, tier_id, usage_limit_override, billing_period_start,
      subscription_tiers(id, name, monthly_token_limit)
    `)
    .eq('id', tenantId)
    .single()

  if (error || !data) {
    console.error('[UsageTracker] Failed to fetch tenant profile:', error)
    return null
  }

  const tierData = Array.isArray(data.subscription_tiers)
    ? data.subscription_tiers[0]
    : data.subscription_tiers

  return {
    id: data.id,
    tier_id: data.tier_id,
    usage_limit_override: data.usage_limit_override,
    billing_period_start: data.billing_period_start,
    subscription_tiers: tierData || null,
  } as TenantProfileWithTier
}

async function queryUsageTokens(tenantId: string, billingStart: Date): Promise<number> {
  const supabase = getServiceClient()

  const { data, error } = await (supabase
    .from('usage_events') as any)
    .select('input_tokens, output_tokens, tokens_used')
    .eq('tenant_id', tenantId)
    .gte('created_at', billingStart.toISOString())

  if (error) {
    console.error('[UsageTracker] Failed to query usage events:', error)
    return 0
  }

  if (!data || data.length === 0) {
    return 0
  }

  let totalTokens = 0
  for (const event of data) {
    if (event.input_tokens !== null || event.output_tokens !== null) {
      totalTokens += (event.input_tokens || 0) + (event.output_tokens || 0)
    } else if (event.tokens_used !== null) {
      totalTokens += event.tokens_used
    }
  }

  return totalTokens
}

export async function getCurrentUsageTokens(tenantId: string): Promise<number> {
  const cached = usageCache.get(tenantId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.usage.currentUsage
  }

  const usage = await getTenantUsage(tenantId)
  return usage?.currentUsage ?? 0
}

export async function getTenantUsage(tenantId: string): Promise<TenantUsage | null> {
  const cached = usageCache.get(tenantId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.usage
  }

  const tenant = await getTenantProfile(tenantId)
  if (!tenant) {
    return null
  }

  const billingPeriodStart = tenant.billing_period_start
    ? new Date(tenant.billing_period_start)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const billingPeriodEnd = calculateBillingPeriodEnd(billingPeriodStart)
  const daysRemaining = calculateDaysRemaining(billingPeriodEnd)

  const currentUsage = await queryUsageTokens(tenantId, billingPeriodStart)

  const hasOverride = tenant.usage_limit_override !== null
  const limit = hasOverride
    ? tenant.usage_limit_override!
    : (tenant.subscription_tiers?.monthly_token_limit ?? 0)

  const percentage = limit > 0
    ? Math.round((currentUsage / limit) * 100)
    : 0

  const isOverLimit = limit > 0 && currentUsage > limit

  const usage: TenantUsage = {
    tenantId,
    currentUsage,
    limit,
    percentage,
    billingPeriodStart,
    billingPeriodEnd,
    daysRemaining,
    isOverLimit,
    tierName: tenant.subscription_tiers?.name ?? null,
    hasOverride,
  }

  usageCache.set(tenantId, { usage, timestamp: Date.now() })

  return usage
}

export async function isOverLimit(tenantId: string): Promise<boolean> {
  const usage = await getTenantUsage(tenantId)
  return usage?.isOverLimit ?? false
}

export async function isApproachingLimit(
  tenantId: string,
  threshold: number = 80
): Promise<boolean> {
  const usage = await getTenantUsage(tenantId)
  if (!usage || usage.limit === 0) {
    return false
  }
  return usage.percentage >= threshold && !usage.isOverLimit
}

export interface UsageCheckResult {
  allowed: boolean
  usage: TenantUsage | null
  reason?: string
  retryAfterSeconds?: number
}

export async function checkUsageLimit(tenantId: string): Promise<UsageCheckResult> {
  const usage = await getTenantUsage(tenantId)

  if (!usage) {
    console.warn(`[UsageTracker] Could not get usage for tenant ${tenantId}, allowing request`)
    return { allowed: true, usage: null }
  }

  if (usage.limit === 0) {
    return { allowed: true, usage }
  }

  if (usage.isOverLimit || usage.percentage >= 100) {
    const retryAfterSeconds = Math.max(
      0,
      Math.floor((usage.billingPeriodEnd.getTime() - Date.now()) / 1000)
    )

    return {
      allowed: false,
      usage,
      reason: 'Usage limit reached. Please upgrade your plan or wait for your next billing cycle.',
      retryAfterSeconds,
    }
  }

  return { allowed: true, usage }
}

export function createUsageLimitError(result: UsageCheckResult): {
  status: number
  body: Record<string, unknown>
  headers: Record<string, string>
} {
  const resetDate = result.usage?.billingPeriodEnd.toISOString().split('T')[0] ?? 'unknown'

  return {
    status: 429,
    body: {
      error: 'UsageLimitExceeded',
      message: result.reason ?? 'Usage limit reached',
      usage: result.usage
        ? {
            current: result.usage.currentUsage,
            limit: result.usage.limit,
            percentage: result.usage.percentage,
            resetDate,
          }
        : null,
    },
    headers: {
      'Retry-After': String(result.retryAfterSeconds ?? 86400),
      'X-RateLimit-Limit': String(result.usage?.limit ?? 0),
      'X-RateLimit-Remaining': String(
        Math.max(0, (result.usage?.limit ?? 0) - (result.usage?.currentUsage ?? 0))
      ),
      'X-RateLimit-Reset': resetDate,
    },
  }
}

export function invalidateUsageCache(tenantId: string): void {
  usageCache.delete(tenantId)
}

export function clearUsageCache(): void {
  usageCache.clear()
}

export function getUsageCacheStats(): { size: number; keys: string[] } {
  return {
    size: usageCache.size,
    keys: Array.from(usageCache.keys()),
  }
}

export function formatUsageDisplay(usage: TenantUsage): {
  usageText: string
  percentageText: string
  statusText: string
  statusColor: 'green' | 'yellow' | 'red'
} {
  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toString()
  }

  const usageText = usage.limit > 0
    ? `${formatTokens(usage.currentUsage)} / ${formatTokens(usage.limit)} tokens`
    : `${formatTokens(usage.currentUsage)} tokens (unlimited)`

  const percentageText = usage.limit > 0
    ? `${usage.percentage}%`
    : 'N/A'

  let statusText: string
  let statusColor: 'green' | 'yellow' | 'red'

  if (usage.isOverLimit) {
    statusText = 'Over limit'
    statusColor = 'red'
  } else if (usage.percentage >= 80) {
    statusText = 'Approaching limit'
    statusColor = 'yellow'
  } else {
    statusText = 'OK'
    statusColor = 'green'
  }

  return { usageText, percentageText, statusText, statusColor }
}
