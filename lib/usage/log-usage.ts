/**
 * Usage Logging Service
 *
 * Logs usage events for billing and analytics.
 * Integrates with CostCalculatorService for automatic cost calculation.
 * Triggers usage notifications when thresholds are crossed.
 *
 * Story: billing-1-3-implement-cost-calculation-service
 * Updated: billing-3-2-implement-warning-triggers
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { calculateCost } from '@/lib/services/cost-calculator'
import { getTenantUsage, invalidateUsageCache } from '@/lib/services/usage-tracker'
import { checkAndSendNotifications } from '@/lib/services/notification-service'

// ============================================================================
// Types
// ============================================================================

export type UsageEventType =
  | 'llm_request'
  | 'email_sent'
  | 'session_started'
  | 'session_completed'
  | 'report_generated'
  | 'document_processed'

export interface LogUsageEventParams {
  tenantId: string
  eventType: UsageEventType
  eventData?: Record<string, unknown>
  inputTokens?: number
  outputTokens?: number
  modelUsed?: string
  userId?: string
}

export interface UsageEvent {
  id: string
  tenant_id: string
  user_id: string | null
  event_type: UsageEventType
  event_data: Record<string, unknown>
  tokens_used: number
  input_tokens: number
  output_tokens: number
  model_used: string | null
  cost_cents: number
  created_at: string
}

// ============================================================================
// Database Client
// ============================================================================

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Log a usage event with automatic cost calculation
 *
 * For LLM requests, calculates cost_cents based on model pricing.
 * Stores input_tokens and output_tokens separately for accurate billing.
 *
 * @param params - Usage event parameters
 * @param supabase - Optional Supabase client (uses service client if not provided)
 * @returns The created usage event ID, or null if logging failed
 */
export async function logUsageEvent(
  params: LogUsageEventParams,
  supabase?: SupabaseClient
): Promise<string | null> {
  const {
    tenantId,
    eventType,
    eventData = {},
    inputTokens = 0,
    outputTokens = 0,
    modelUsed,
    userId,
  } = params

  const client = supabase || getServiceClient()

  try {
    // Calculate cost for LLM requests
    let costCents = 0
    if (eventType === 'llm_request' && modelUsed && (inputTokens > 0 || outputTokens > 0)) {
      costCents = await calculateCost(modelUsed, inputTokens, outputTokens)
    }

    // Calculate total tokens (for backward compatibility with tokens_used column)
    const tokensUsed = inputTokens + outputTokens

    // Insert usage event
    const { data, error } = await client
      .from('usage_events')
      .insert({
        tenant_id: tenantId,
        user_id: userId || null,
        event_type: eventType,
        event_data: eventData,
        tokens_used: tokensUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model_used: modelUsed || null,
        cost_cents: costCents,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[logUsageEvent] Failed to insert usage event:', error)
      return null
    }

    // After successful logging, check usage thresholds and send notifications
    // This is done async and non-blocking to not slow down the main request
    if (eventType === 'llm_request') {
      setImmediate(async () => {
        try {
          // Invalidate cache so we get fresh usage data
          invalidateUsageCache(tenantId)

          // Get current usage and check thresholds
          const usage = await getTenantUsage(tenantId)
          if (usage) {
            await checkAndSendNotifications(tenantId, usage)
          }
        } catch (notifError) {
          console.error('[logUsageEvent] Failed to check notifications:', notifError)
        }
      })
    }

    return data?.id || null
  } catch (error) {
    // Log but don't fail the request if usage tracking fails
    console.error('[logUsageEvent] Exception while logging usage event:', error)
    return null
  }
}

/**
 * Log an LLM request usage event (convenience function)
 *
 * Shorthand for logging AI model usage with token counts.
 */
export async function logLLMUsage(
  tenantId: string,
  modelUsed: string,
  inputTokens: number,
  outputTokens: number,
  eventData?: Record<string, unknown>,
  supabase?: SupabaseClient
): Promise<string | null> {
  return logUsageEvent(
    {
      tenantId,
      eventType: 'llm_request',
      eventData,
      inputTokens,
      outputTokens,
      modelUsed,
    },
    supabase
  )
}

/**
 * Log a session started event
 */
export async function logSessionStarted(
  tenantId: string,
  sessionId: string,
  assessmentType: string,
  supabase?: SupabaseClient
): Promise<string | null> {
  return logUsageEvent(
    {
      tenantId,
      eventType: 'session_started',
      eventData: { session_id: sessionId, assessment_type: assessmentType },
    },
    supabase
  )
}

/**
 * Log a session completed event
 */
export async function logSessionCompleted(
  tenantId: string,
  sessionId: string,
  assessmentType: string,
  supabase?: SupabaseClient
): Promise<string | null> {
  return logUsageEvent(
    {
      tenantId,
      eventType: 'session_completed',
      eventData: { session_id: sessionId, assessment_type: assessmentType },
    },
    supabase
  )
}
