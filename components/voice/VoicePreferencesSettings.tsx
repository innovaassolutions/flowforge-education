'use client'

/**
 * VoicePreferencesSettings Component
 *
 * User settings panel for voice interview preferences.
 * Allows users to enable/disable voice mode and set defaults.
 *
 * Reference: docs/research-technical-2025-12-31.md (Appendix B.6.1)
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Mic, MessageSquare, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SessionMode } from '@/lib/types/voice'

// ============================================================================
// TYPES
// ============================================================================

interface VoicePreferences {
  voiceEnabled: boolean
  defaultMode: SessionMode
  autoStartVoice: boolean
}

interface VoicePreferencesSettingsProps {
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VoicePreferencesSettings({ className }: VoicePreferencesSettingsProps) {
  const [prefs, setPrefs] = useState<VoicePreferences>({
    voiceEnabled: true,
    defaultMode: 'text',
    autoStartVoice: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Fetch current preferences
  useEffect(() => {
    async function fetchPrefs() {
      try {
        const response = await fetch('/api/user/voice-preferences')
        if (response.ok) {
          const data = await response.json()
          setPrefs({
            voiceEnabled: data.voiceEnabled ?? true,
            defaultMode: data.defaultMode ?? 'text',
            autoStartVoice: data.autoStartVoice ?? false,
          })
        }
      } catch (error) {
        console.error('Failed to fetch voice preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPrefs()
  }, [])

  // Update a preference
  const updatePreference = async (key: keyof VoicePreferences, value: boolean | string) => {
    setSaving(true)
    setSaved(false)

    const newPrefs = { ...prefs, [key]: value }
    setPrefs(newPrefs)

    try {
      const response = await fetch('/api/user/voice-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })

      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error('Failed to update voice preferences:', error)
      // Revert on error
      setPrefs(prefs)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Voice Interview Settings</CardTitle>
          </div>
          {saved && (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <Check className="w-4 h-4" />
              Saved
            </div>
          )}
        </div>
        <CardDescription>
          Configure how you interact with AI interview agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Voice Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-medium">Enable Voice Mode</div>
            <div className="text-sm text-muted-foreground">
              Allow voice conversations in interviews where available
            </div>
          </div>
          <ToggleSwitch
            checked={prefs.voiceEnabled}
            onChange={(checked) => updatePreference('voiceEnabled', checked)}
            disabled={saving}
          />
        </div>

        {/* Default Mode Selection */}
        {prefs.voiceEnabled && (
          <>
            <div className="border-t pt-6 space-y-3">
              <div className="font-medium">Default Interview Mode</div>
              <div className="flex gap-3">
                <ModeOption
                  icon={MessageSquare}
                  label="Text"
                  selected={prefs.defaultMode === 'text'}
                  onClick={() => updatePreference('defaultMode', 'text')}
                  disabled={saving}
                />
                <ModeOption
                  icon={Mic}
                  label="Voice"
                  selected={prefs.defaultMode === 'voice'}
                  onClick={() => updatePreference('defaultMode', 'voice')}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Auto-start Voice */}
            <div className="flex items-center justify-between border-t pt-6">
              <div className="space-y-0.5">
                <div className="font-medium">Auto-start Voice Sessions</div>
                <div className="text-sm text-muted-foreground">
                  Automatically begin voice mode when starting an interview
                </div>
              </div>
              <ToggleSwitch
                checked={prefs.autoStartVoice}
                onChange={(checked) => updatePreference('autoStartVoice', checked)}
                disabled={saving}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}

interface ModeOptionProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

function ModeOption({ icon: Icon, label, selected, onClick, disabled }: ModeOptionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border hover:border-muted-foreground/50'
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
    </button>
  )
}

export default VoicePreferencesSettings
