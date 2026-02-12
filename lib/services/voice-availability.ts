/**
 * Voice Availability Service (Education-only)
 *
 * Simplified for education vertical - always uses 'education' as vertical key.
 */

import { createClient, getSupabaseAdmin } from '@/lib/supabase/server'
import type {
  VoiceAvailability,
  VerticalVoiceConfig,
  VerticalVoiceConfigRow,
  OrganizationVoiceSettingsRow,
  UserVoicePreferencesRow,
} from '@/lib/types/voice'

// ============================================================================
// TYPES
// ============================================================================

interface CheckVoiceAvailabilityParams {
  userId: string
  organizationId: string
  verticalKey: string
}

interface GetVoiceConfigForSessionResult {
  available: boolean
  reason?: string
  config?: VerticalVoiceConfig
  organizationId?: string
  verticalKey?: string
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Check if voice is available for a user in an organization.
 */
export async function checkVoiceAvailability({
  userId,
  organizationId,
  verticalKey,
}: CheckVoiceAvailabilityParams): Promise<VoiceAvailability> {
  const supabase = await createClient()

  // 1. Check system-level: Is voice deployed for this vertical?
  const { data: verticalConfig, error: verticalError } = await supabase
    .from('vertical_voice_config')
    .select('*')
    .eq('vertical_key', verticalKey)
    .eq('voice_enabled', true)
    .single()

  if (verticalError || !verticalConfig) {
    return {
      available: false,
      reason: 'Voice is not available for this interview type',
    }
  }

  // 2. Check organization-level
  const { data: orgSettings, error: orgError } = await supabase
    .from('organization_voice_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .single()

  if (orgError || !orgSettings) {
    return {
      available: false,
      reason: 'Voice settings not configured for your organization',
    }
  }

  const typedOrgSettings = orgSettings as OrganizationVoiceSettingsRow

  if (!typedOrgSettings.voice_included_in_plan) {
    return { available: false, reason: 'Voice feature requires a premium subscription' }
  }

  if (!typedOrgSettings.voice_enabled) {
    return { available: false, reason: 'Voice has been disabled for your organization' }
  }

  if (!typedOrgSettings.allowed_verticals.includes(verticalKey)) {
    return { available: false, reason: `Voice is not enabled for ${verticalConfig.display_name}` }
  }

  if (typedOrgSettings.monthly_voice_minutes_used >= typedOrgSettings.monthly_voice_minutes_limit) {
    return { available: false, reason: 'Monthly voice minutes quota exceeded' }
  }

  // 3. Check user-level
  const { data: userPrefs, error: userError } = await supabase
    .from('user_voice_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!userError && userPrefs) {
    const typedUserPrefs = userPrefs as UserVoicePreferencesRow
    if (!typedUserPrefs.voice_enabled) {
      return { available: false, reason: 'Voice mode is disabled in your preferences' }
    }
  }

  const typedVerticalConfig = verticalConfig as VerticalVoiceConfigRow
  return {
    available: true,
    config: {
      id: typedVerticalConfig.id,
      verticalKey: typedVerticalConfig.vertical_key,
      displayName: typedVerticalConfig.display_name,
      voiceEnabled: typedVerticalConfig.voice_enabled,
      elevenlabsAgentId: typedVerticalConfig.elevenlabs_agent_id,
      voiceModel: typedVerticalConfig.voice_model,
      llmEndpointPath: typedVerticalConfig.llm_endpoint_path,
      systemPromptTemplate: typedVerticalConfig.system_prompt_template,
      createdAt: typedVerticalConfig.created_at,
      updatedAt: typedVerticalConfig.updated_at,
    },
  }
}

/**
 * Get voice configuration for an education session by participant token.
 */
export async function getVoiceConfigForSession(
  participantAccessToken: string,
  userId?: string
): Promise<GetVoiceConfigForSessionResult> {
  const supabase = getSupabaseAdmin()

  // Education tokens (ff_edu_xxx)
  if (!participantAccessToken.startsWith('ff_edu_')) {
    return { available: false, reason: 'Invalid education session token' }
  }

  const { data: participantTokenData, error: ptError } = await supabase
    .from('education_participant_tokens')
    .select(`
      id,
      token,
      school_id,
      schools!inner(
        id,
        organization_id
      )
    `)
    .eq('token', participantAccessToken)
    .single()

  const participantToken = participantTokenData as {
    id: string
    token: string
    school_id: string
    schools: { id: string; organization_id: string }
  } | null

  if (ptError || !participantToken) {
    return { available: false, reason: 'Unable to determine organization' }
  }

  const verticalKey = 'education'
  const organizationId = participantToken.schools.organization_id

  if (!userId) {
    const result = await checkVoiceAvailabilityWithoutUser(organizationId, verticalKey)
    return { ...result, organizationId, verticalKey }
  }

  const result = await checkVoiceAvailability({ userId, organizationId, verticalKey })
  return { ...result, organizationId, verticalKey }
}

/**
 * Check voice availability without user-level check.
 */
async function checkVoiceAvailabilityWithoutUser(
  organizationId: string,
  verticalKey: string
): Promise<VoiceAvailability> {
  const supabase = getSupabaseAdmin()

  const { data: verticalConfig, error: verticalError } = await supabase
    .from('vertical_voice_config')
    .select('*')
    .eq('vertical_key', verticalKey)
    .eq('voice_enabled', true)
    .single()

  if (verticalError || !verticalConfig) {
    return { available: false, reason: 'Voice is not available for this interview type' }
  }

  const { data: orgSettings, error: orgError } = await supabase
    .from('organization_voice_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .single()

  if (orgError || !orgSettings) {
    return { available: false, reason: 'Voice settings not configured for this organization' }
  }

  const typedOrgSettings = orgSettings as OrganizationVoiceSettingsRow

  if (!typedOrgSettings.voice_included_in_plan) {
    return { available: false, reason: 'Voice feature requires a premium subscription' }
  }

  if (!typedOrgSettings.voice_enabled) {
    return { available: false, reason: 'Voice has been disabled for this organization' }
  }

  if (!typedOrgSettings.allowed_verticals.includes(verticalKey)) {
    return { available: false, reason: 'Voice is not enabled for this interview type' }
  }

  if (typedOrgSettings.monthly_voice_minutes_used >= typedOrgSettings.monthly_voice_minutes_limit) {
    return { available: false, reason: 'Monthly voice minutes quota exceeded' }
  }

  const typedVerticalConfig = verticalConfig as VerticalVoiceConfigRow
  return {
    available: true,
    config: {
      id: typedVerticalConfig.id,
      verticalKey: typedVerticalConfig.vertical_key,
      displayName: typedVerticalConfig.display_name,
      voiceEnabled: typedVerticalConfig.voice_enabled,
      elevenlabsAgentId: typedVerticalConfig.elevenlabs_agent_id,
      voiceModel: typedVerticalConfig.voice_model,
      llmEndpointPath: typedVerticalConfig.llm_endpoint_path,
      systemPromptTemplate: typedVerticalConfig.system_prompt_template,
      createdAt: typedVerticalConfig.created_at,
      updatedAt: typedVerticalConfig.updated_at,
    },
  }
}

/**
 * Get the vertical key - always 'education' for this app.
 */
export function getVerticalKeyFromCampaignType(campaignType: string): string {
  return 'education'
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

export async function trackVoiceUsage(
  sessionToken: string,
  durationSeconds: number
): Promise<void> {
  const supabase = await createClient()
  const durationMinutes = durationSeconds / 60

  const { data: session } = await supabase
    .from('agent_sessions')
    .select(`
      id,
      voice_minutes_used,
      participant_token_id
    `)
    .eq('session_token', sessionToken)
    .single()

  if (!session) return

  await supabase
    .from('agent_sessions')
    .update({
      voice_minutes_used: (session.voice_minutes_used || 0) + durationMinutes,
    })
    .eq('id', session.id)

  if (session.participant_token_id) {
    const { data: participantTokenData } = await supabase
      .from('education_participant_tokens')
      .select(`
        schools!inner(organization_id)
      `)
      .eq('id', session.participant_token_id)
      .single()

    const participantToken = participantTokenData as {
      schools: { organization_id: string }
    } | null

    if (participantToken) {
      await (supabase.rpc as Function)('track_voice_usage', {
        input_session_token: sessionToken,
        input_duration_seconds: durationSeconds,
      })
    }
  }
}

export async function resetMonthlyVoiceUsage(): Promise<number> {
  const supabase = await createClient()
  const { data } = await (supabase.rpc as Function)('reset_monthly_voice_usage')
  return data || 0
}
