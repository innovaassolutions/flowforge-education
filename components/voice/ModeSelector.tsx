'use client'

/**
 * ModeSelector Component
 *
 * Toggle between text and voice interview modes.
 * Checks voice availability and shows appropriate UI state.
 *
 * Reference: docs/research-technical-2025-12-31.md (Appendix B.6.2)
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Mic, MessageSquare, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SessionMode, VoiceAvailabilityResponse } from '@/lib/types/voice'

// ============================================================================
// TYPES
// ============================================================================

interface ModeSelectorProps {
  sessionToken: string
  organizationId: string
  verticalKey: string
  currentMode: SessionMode
  onModeChange: (mode: 'text' | 'voice') => void
  disabled?: boolean
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ModeSelector({
  sessionToken,
  organizationId,
  verticalKey,
  currentMode,
  onModeChange,
  disabled = false,
  className,
}: ModeSelectorProps) {
  const [voiceAvailable, setVoiceAvailable] = useState<VoiceAvailabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Check voice availability on mount
  useEffect(() => {
    async function checkAvailability() {
      try {
        const response = await fetch(
          `/api/voice/availability?vertical=${verticalKey}&organizationId=${organizationId}`
        )
        const data: VoiceAvailabilityResponse = await response.json()
        setVoiceAvailable(data)
      } catch (error) {
        console.error('Failed to check voice availability:', error)
        setVoiceAvailable({
          available: false,
          reason: 'Unable to check voice availability',
        })
      } finally {
        setLoading(false)
      }
    }

    checkAvailability()
  }, [verticalKey, organizationId])

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex gap-2', className)}>
        <Button variant="outline" disabled className="gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="sr-only">Loading mode options...</span>
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn('flex gap-2', className)}>
        {/* Text Mode Button */}
        <Button
          variant={currentMode === 'text' ? 'default' : 'outline'}
          onClick={() => onModeChange('text')}
          disabled={disabled}
          className="gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          Text
        </Button>

        {/* Voice Mode Button */}
        {voiceAvailable?.available ? (
          <Button
            variant={currentMode === 'voice' ? 'default' : 'outline'}
            onClick={() => onModeChange('voice')}
            disabled={disabled}
            className="gap-2"
          >
            <Mic className="w-4 h-4" />
            Voice
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                disabled
                className="gap-2 opacity-50 cursor-not-allowed"
              >
                <Mic className="w-4 h-4" />
                Voice
                <AlertCircle className="w-3 h-3 ml-1" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{voiceAvailable?.reason || 'Voice mode is not available'}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

export default ModeSelector
