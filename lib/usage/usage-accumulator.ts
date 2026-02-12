/**
 * Usage Accumulator
 *
 * Tracks and accumulates token usage across multiple AI calls
 * within a single logical operation (like synthesis).
 *
 * Story: billing-2-6-synthesis-agent-usage-accumulation
 */

import { calculateCost } from '@/lib/services/cost-calculator'
import { logUsageEvent, type UsageEventType } from './log-usage'

// ============================================================================
// Types
// ============================================================================

export interface UsageCall {
  modelUsed: string
  inputTokens: number
  outputTokens: number
  costCents: number
  callType: string
  timestamp: string
}

export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  costCents: number
  callCount: number
}

// ============================================================================
// UsageAccumulator Class
// ============================================================================

/**
 * Accumulates usage across multiple AI calls for a single operation
 *
 * Usage:
 * ```typescript
 * const accumulator = new UsageAccumulator(tenantId, 'synthesis');
 * await accumulator.addCall('technology_analysis', response);
 * await accumulator.addCall('process_analysis', response);
 * // ... more calls
 * await accumulator.logConsolidated({ campaignId: '...' });
 * ```
 */
export class UsageAccumulator {
  private calls: UsageCall[] = []
  private tenantId: string
  private eventType: UsageEventType
  private operationId?: string

  /**
   * Create a new usage accumulator
   *
   * @param tenantId - The tenant to attribute usage to
   * @param eventType - The type of operation (e.g., 'llm_request' for synthesis)
   * @param operationId - Optional ID to identify this specific operation
   */
  constructor(
    tenantId: string,
    eventType: UsageEventType = 'llm_request',
    operationId?: string
  ) {
    this.tenantId = tenantId
    this.eventType = eventType
    this.operationId = operationId
  }

  /**
   * Add a call's usage to the accumulator
   *
   * @param callType - Description of this call (e.g., 'dimension_T1', 'executive_summary')
   * @param modelUsed - The AI model used
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   */
  async addCall(
    callType: string,
    modelUsed: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    // Calculate cost for this individual call
    const costCents = await calculateCost(modelUsed, inputTokens, outputTokens)

    this.calls.push({
      modelUsed,
      inputTokens,
      outputTokens,
      costCents,
      callType,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Add usage directly from an Anthropic API response
   *
   * @param callType - Description of this call
   * @param response - The Anthropic API response object
   */
  async addFromResponse(
    callType: string,
    response: {
      model: string
      usage: { input_tokens: number; output_tokens: number }
    }
  ): Promise<void> {
    await this.addCall(
      callType,
      response.model,
      response.usage.input_tokens,
      response.usage.output_tokens
    )
  }

  /**
   * Get accumulated totals
   */
  getTotals(): UsageTotals {
    return {
      inputTokens: this.calls.reduce((sum, c) => sum + c.inputTokens, 0),
      outputTokens: this.calls.reduce((sum, c) => sum + c.outputTokens, 0),
      costCents: this.calls.reduce((sum, c) => sum + c.costCents, 0),
      callCount: this.calls.length,
    }
  }

  /**
   * Get all individual calls (for metadata/debugging)
   */
  getCalls(): UsageCall[] {
    return [...this.calls]
  }

  /**
   * Check if any calls have been recorded
   */
  hasUsage(): boolean {
    return this.calls.length > 0
  }

  /**
   * Log a consolidated usage event to the database
   *
   * @param additionalData - Extra data to include in event_data
   * @returns The usage event ID, or null if logging failed
   */
  async logConsolidated(
    additionalData?: Record<string, unknown>
  ): Promise<string | null> {
    if (this.calls.length === 0) {
      console.log('[UsageAccumulator] No calls to log')
      return null
    }

    const totals = this.getTotals()

    // Determine the primary model (most used or last used)
    const modelCounts = this.calls.reduce(
      (acc, call) => {
        acc[call.modelUsed] = (acc[call.modelUsed] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    const primaryModel = Object.entries(modelCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0]

    // Build event data with call breakdown
    const eventData: Record<string, unknown> = {
      ...additionalData,
      operation_id: this.operationId,
      call_count: totals.callCount,
      call_breakdown: this.calls.map((c) => ({
        type: c.callType,
        model: c.modelUsed,
        input_tokens: c.inputTokens,
        output_tokens: c.outputTokens,
        cost_cents: c.costCents,
      })),
    }

    const eventId = await logUsageEvent({
      tenantId: this.tenantId,
      eventType: this.eventType,
      eventData,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      modelUsed: primaryModel,
    })

    console.log(
      `[UsageAccumulator] Logged consolidated usage: ${totals.callCount} calls, ` +
        `${totals.inputTokens} in + ${totals.outputTokens} out tokens, ` +
        `$${(totals.costCents / 100).toFixed(4)}`
    )

    return eventId
  }

  /**
   * Log partial usage (e.g., when operation fails partway through)
   *
   * @param error - The error that occurred
   * @param additionalData - Extra data to include in event_data
   */
  async logPartial(
    error: Error | string,
    additionalData?: Record<string, unknown>
  ): Promise<string | null> {
    if (this.calls.length === 0) {
      return null
    }

    return this.logConsolidated({
      ...additionalData,
      partial: true,
      error_message: error instanceof Error ? error.message : error,
      completed_calls: this.calls.length,
    })
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a usage accumulator for a synthesis operation
 *
 * @param tenantId - The tenant to attribute usage to
 * @param campaignId - The campaign being synthesized
 */
export function createSynthesisAccumulator(
  tenantId: string,
  campaignId: string
): UsageAccumulator {
  return new UsageAccumulator(tenantId, 'llm_request', `synthesis_${campaignId}`)
}
