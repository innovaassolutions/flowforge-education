'use client'

/**
 * UsageCard Component
 *
 * Displays tenant usage metrics with a visual progress bar.
 * Colors change based on usage percentage thresholds.
 *
 * Story: billing-5-1-tenant-usage-dashboard-component
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Zap, Calendar, TrendingUp, AlertTriangle, History } from 'lucide-react'

interface UsageData {
  currentUsage: number
  limit: number
  remaining: number
  percentage: number
  billingPeriod: {
    start: string
    end: string
  }
  daysRemaining: number
  tier: {
    name: string
    displayName: string
  }
  isOverLimit: boolean
  hasOverride: boolean
  display: {
    usage: string
    percentage: string
    status: string
    statusColor: 'green' | 'yellow' | 'red'
  }
}

interface UsageCardProps {
  className?: string
  compact?: boolean
}

/**
 * Format large numbers for display
 */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString()
}

/**
 * Get progress bar color based on percentage
 */
function getProgressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500'
  if (percentage >= 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

/**
 * Get progress bar background color
 */
function getProgressBgColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-100'
  if (percentage >= 75) return 'bg-amber-100'
  return 'bg-emerald-100'
}

/**
 * Get text color based on status
 */
function getStatusTextColor(status: 'green' | 'yellow' | 'red'): string {
  switch (status) {
    case 'red': return 'text-red-600'
    case 'yellow': return 'text-amber-600'
    default: return 'text-emerald-600'
  }
}

export function UsageCard({ className = '', compact = false }: UsageCardProps) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchUsage() {
    try {
      const response = await fetch('/api/tenant/usage')
      if (!response.ok) {
        if (response.status === 404) {
          // No tenant profile - not an error for non-tenant users
          setUsage(null)
          setError(null)
          return
        }
        throw new Error('Failed to fetch usage')
      }
      const data = await response.json()
      setUsage(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching usage:', err)
      setError('Unable to load usage data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchUsage()
  }

  // Loading state
  if (loading) {
    return (
      <div className={`bg-card border border-border rounded-xl p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-4" />
          <div className="h-3 bg-muted rounded-full w-full mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  // No usage data (non-tenant user or no profile)
  if (!usage) {
    return null
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-card border border-border rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
          <button
            onClick={handleRefresh}
            className="ml-auto p-1 hover:bg-muted rounded"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  const progressColor = getProgressColor(usage.percentage)
  const progressBgColor = getProgressBgColor(usage.percentage)
  const statusColor = getStatusTextColor(usage.display.statusColor)

  // Compact view for sidebar/header
  if (compact) {
    return (
      <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Usage</span>
          <span className={`text-sm font-medium ${statusColor}`}>
            {usage.display.percentage}
          </span>
        </div>
        <div className={`w-full ${progressBgColor} rounded-full h-2`}>
          <div
            className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${Math.min(usage.percentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {formatNumber(usage.remaining)} tokens remaining
        </p>
      </div>
    )
  }

  // Full card view
  return (
    <div className={`bg-card border border-border rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Usage This Period</h3>
            <p className="text-xs text-muted-foreground">
              {usage.tier.displayName} Plan
              {usage.hasOverride && (
                <span className="ml-1 text-blue-600">(Custom limit)</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          title="Refresh usage data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${statusColor}`}>
            {usage.display.status}
          </span>
          <span className="text-sm text-muted-foreground">
            {usage.display.percentage} used
          </span>
        </div>
        <div className={`w-full ${progressBgColor} rounded-full h-4`}>
          <div
            className={`h-4 rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(usage.percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Used</p>
          <p className="text-xl font-bold text-foreground">
            {formatNumber(usage.currentUsage)}
          </p>
          <p className="text-xs text-muted-foreground">tokens</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Remaining</p>
          <p className={`text-xl font-bold ${usage.remaining <= 0 ? 'text-red-600' : 'text-foreground'}`}>
            {formatNumber(usage.remaining)}
          </p>
          <p className="text-xs text-muted-foreground">tokens</p>
        </div>
      </div>

      {/* Period Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>
            {new Date(usage.billingPeriod.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' - '}
            {new Date(usage.billingPeriod.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>{usage.daysRemaining} days left</span>
          </div>
          <Link
            href="/dashboard/settings/usage"
            className="flex items-center gap-1 text-purple-600 hover:text-purple-700"
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </Link>
        </div>
      </div>

      {/* Warning Banner */}
      {usage.isOverLimit && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Usage Limit Reached</p>
            <p className="text-xs text-red-600 mt-1">
              You have exceeded your monthly allowance. Some features may be limited until your next billing cycle.
            </p>
          </div>
        </div>
      )}

      {usage.percentage >= 75 && !usage.isOverLimit && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Approaching Limit</p>
            <p className="text-xs text-amber-600 mt-1">
              You're using {usage.percentage}% of your monthly allowance. Consider upgrading if you need more capacity.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsageCard
