'use client'

/**
 * UsageBanner Component
 *
 * Displays warning banners when tenant approaches or exceeds usage limits.
 * - Yellow (75-89%): Approaching limit
 * - Orange (90-99%): Warning, suggest upgrade
 * - Red (100%): Lockout, sessions paused
 *
 * Story: billing-5-3-in-app-usage-warning-banner
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AlertTriangle, X, TrendingUp, Zap } from 'lucide-react'

interface UsageBannerProps {
  className?: string
}

interface UsageData {
  percentage: number
  billingPeriod: {
    end: string
  }
  isOverLimit: boolean
}

const DISMISS_KEY = 'usage_banner_dismissed'

/**
 * Get the threshold bucket for a percentage
 */
function getThresholdBucket(percentage: number): number {
  if (percentage >= 100) return 100
  if (percentage >= 90) return 90
  if (percentage >= 75) return 75
  return 0
}

/**
 * Check if banner was dismissed for this threshold
 */
function isDismissed(percentage: number): boolean {
  if (typeof window === 'undefined') return false

  try {
    const stored = localStorage.getItem(DISMISS_KEY)
    if (!stored) return false

    const { threshold, timestamp } = JSON.parse(stored)
    const currentBucket = getThresholdBucket(percentage)

    // Reset after 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return false

    // Only dismissed if same or lower threshold
    return threshold >= currentBucket
  } catch {
    return false
  }
}

/**
 * Save dismissed state
 */
function saveDismissed(percentage: number): void {
  if (typeof window === 'undefined') return

  const bucket = getThresholdBucket(percentage)
  localStorage.setItem(DISMISS_KEY, JSON.stringify({
    threshold: bucket,
    timestamp: Date.now()
  }))
}

/**
 * Get message based on usage percentage
 */
function getMessage(percentage: number, resetDate: string): string {
  const formattedDate = new Date(resetDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })

  if (percentage >= 100) {
    return `Usage limit reached. Your sessions are paused until ${formattedDate} or you upgrade.`
  }
  if (percentage >= 90) {
    return `Warning: You've used ${percentage}% of your monthly allowance. Consider upgrading.`
  }
  return `You've used ${percentage}% of your monthly allowance.`
}

/**
 * Get banner styling based on percentage
 */
function getBannerStyles(percentage: number): {
  bg: string
  border: string
  text: string
  icon: string
} {
  if (percentage >= 100) {
    return {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600'
    }
  }
  if (percentage >= 90) {
    return {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      icon: 'text-orange-600'
    }
  }
  return {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: 'text-amber-600'
  }
}

export function UsageBanner({ className = '' }: UsageBannerProps) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchUsage = useCallback(async () => {
    try {
      const response = await fetch('/api/tenant/usage')
      if (!response.ok) {
        // No tenant profile or other error - just hide banner
        setUsage(null)
        return
      }
      const data = await response.json()
      setUsage(data)

      // Check if already dismissed for this threshold
      if (isDismissed(data.percentage)) {
        setDismissed(true)
      }
    } catch (err) {
      console.error('Error fetching usage for banner:', err)
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  // Don't show while loading
  if (loading) return null

  // Don't show if no usage data
  if (!usage) return null

  // Don't show if under 75%
  if (usage.percentage < 75) return null

  // Don't show if dismissed
  if (dismissed) return null

  const styles = getBannerStyles(usage.percentage)
  const message = getMessage(usage.percentage, usage.billingPeriod.end)

  function handleDismiss() {
    saveDismissed(usage!.percentage)
    setDismissed(true)
  }

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {usage.percentage >= 100 ? (
            <Zap className={`w-5 h-5 ${styles.icon}`} />
          ) : (
            <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
          )}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${styles.text}`}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {usage.percentage >= 90 && (
            <Link
              href="/dashboard/settings/upgrade"
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors
                ${usage.percentage >= 100
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
                }`}
            >
              Upgrade
            </Link>
          )}
          <Link
            href="/dashboard/settings/usage"
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors
              ${styles.bg} ${styles.text} hover:opacity-80 border ${styles.border}`}
          >
            <span className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              View Usage
            </span>
          </Link>
          <button
            onClick={handleDismiss}
            className={`p-1.5 rounded-md transition-colors hover:opacity-80 ${styles.text}`}
            title="Dismiss for 24 hours"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default UsageBanner
