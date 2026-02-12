/**
 * Cost Calculator Service
 */

import { createClient } from '@supabase/supabase-js'

export interface ModelPricing {
  id: string
  provider: string
  modelId: string
  displayName: string | null
  inputRatePerMillion: number
  outputRatePerMillion: number
  effectiveDate: Date
  isActive: boolean
}

interface CachedPricing {
  pricing: ModelPricing
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000

const pricingCache = new Map<string, CachedPricing>()

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function fetchPricingFromDb(modelId: string): Promise<ModelPricing | null> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('model_pricing')
    .select('*')
    .eq('model_id', modelId)
    .eq('is_active', true)
    .order('effective_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    provider: data.provider,
    modelId: data.model_id,
    displayName: data.display_name,
    inputRatePerMillion: parseFloat(data.input_rate_per_million),
    outputRatePerMillion: parseFloat(data.output_rate_per_million),
    effectiveDate: new Date(data.effective_date),
    isActive: data.is_active,
  }
}

export async function getModelPricing(modelId: string): Promise<ModelPricing | null> {
  const cached = pricingCache.get(modelId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.pricing
  }

  const pricing = await fetchPricingFromDb(modelId)

  if (pricing) {
    pricingCache.set(modelId, { pricing, timestamp: Date.now() })
  }

  return pricing
}

export async function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  if (!modelId || (inputTokens <= 0 && outputTokens <= 0)) {
    return 0
  }

  const safeInputTokens = Math.max(0, inputTokens || 0)
  const safeOutputTokens = Math.max(0, outputTokens || 0)

  const pricing = await getModelPricing(modelId)

  if (!pricing) {
    console.warn(`[CostCalculator] Model not found in pricing table: ${modelId}`)
    return 0
  }

  const costUsd =
    (safeInputTokens * pricing.inputRatePerMillion +
      safeOutputTokens * pricing.outputRatePerMillion) /
    1_000_000

  const costCents = Math.ceil(costUsd * 100)

  return costCents
}

export async function refreshPricingCache(): Promise<void> {
  pricingCache.clear()
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: pricingCache.size,
    keys: Array.from(pricingCache.keys()),
  }
}
