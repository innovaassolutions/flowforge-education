/**
 * AI Model Configuration for Tiered Report Quality
 *
 * This module defines which Claude models to use based on report tier.
 * Premium tiers use more capable (and expensive) models for deeper analysis.
 */

export type ReportTier = 'standard' | 'premium' | 'enterprise'

export interface ModelConfig {
  modelId: string
  displayName: string
  description: string
  estimatedCostPerReport: string
  capabilities: string[]
}

export const MODEL_CONFIGURATIONS: Record<ReportTier, ModelConfig> = {
  standard: {
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    description: 'Balanced performance and cost for comprehensive analysis',
    estimatedCostPerReport: '$0.30 - $0.60',
    capabilities: [
      'Multi-dimensional analysis',
      'Strategic synthesis',
      'Structured JSON output',
      'Executive summaries'
    ]
  },
  premium: {
    modelId: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    description: 'Highest capability model for deep strategic insights',
    estimatedCostPerReport: '$1.50 - $3.00',
    capabilities: [
      'Advanced analytical depth',
      'Nuanced contradiction detection',
      'Superior strategic recommendations',
      'Complex stakeholder synthesis',
      'Industry-leading insights'
    ]
  },
  enterprise: {
    modelId: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4 (Extended)',
    description: 'Premium model with extended context and custom tuning',
    estimatedCostPerReport: '$2.00 - $4.00',
    capabilities: [
      'All Premium features',
      'Extended analysis depth',
      'Custom industry frameworks',
      'Competitive benchmarking',
      'Executive-ready deliverables'
    ]
  }
}

/**
 * Get the model ID for a specific report tier
 */
export function getModelForTier(tier: ReportTier = 'standard'): string {
  return MODEL_CONFIGURATIONS[tier].modelId
}

/**
 * Get full configuration for a report tier
 */
export function getModelConfig(tier: ReportTier = 'standard'): ModelConfig {
  return MODEL_CONFIGURATIONS[tier]
}

/**
 * Validate that a tier is supported
 */
export function isValidTier(tier: string): tier is ReportTier {
  return tier in MODEL_CONFIGURATIONS
}

/**
 * Get all available tiers for UI selection
 */
export function getAvailableTiers(): Array<{
  value: ReportTier
  label: string
  description: string
  cost: string
}> {
  return Object.entries(MODEL_CONFIGURATIONS).map(([tier, config]) => ({
    value: tier as ReportTier,
    label: config.displayName,
    description: config.description,
    cost: config.estimatedCostPerReport
  }))
}

/**
 * Get recommended tier based on criteria
 */
export function getRecommendedTier(criteria: {
  stakeholderCount?: number
  isClientFacing?: boolean
  hasComplexData?: boolean
}): ReportTier {
  const { stakeholderCount = 0, isClientFacing = false, hasComplexData = false } = criteria

  // Enterprise: Many stakeholders + client-facing
  if (stakeholderCount > 10 && isClientFacing) {
    return 'enterprise'
  }

  // Premium: Client-facing or complex data
  if (isClientFacing || hasComplexData || stakeholderCount > 5) {
    return 'premium'
  }

  // Standard: Default for internal assessments
  return 'standard'
}
