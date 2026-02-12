import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  generateEducationGreeting,
  EducationParticipant,
  EducationCampaign,
  EducationModule
} from '@/lib/agents/education-interview-agent'

/**
 * GET /api/session/[token]
 * Access or resume an education session by participant token
 * This is a PUBLIC endpoint - token is the authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Validate token format
    if (!token.startsWith('ff_edu_')) {
      return NextResponse.json(
        { error: 'Invalid session token format' },
        { status: 400 }
      )
    }

    // Find participant token
    // @ts-ignore - education_participant_tokens table not yet in generated types
    const { data: participantTokenData, error: tokenError } = await supabaseAdmin
      .from('education_participant_tokens')
      .select(`
        id,
        token,
        participant_type,
        cohort_metadata,
        school_id,
        campaign_id,
        modules_completed,
        is_active,
        schools:school_id(id, name),
        campaigns:campaign_id(
          id,
          name,
          education_config
        )
      `)
      .eq('token', token)
      .single()

    // Type assertion for participant token
    const participantToken = participantTokenData as {
      id: string
      token: string
      participant_type: string
      cohort_metadata: Record<string, string>
      school_id: string
      campaign_id: string
      modules_completed: string[] | null
      is_active: boolean
      schools: { id: string; name: string }
      campaigns: { id: string; name: string; education_config: Record<string, unknown> }
    } | null

    if (tokenError || !participantToken) {
      return NextResponse.json(
        { error: 'Invalid or expired session token' },
        { status: 404 }
      )
    }

    if (!participantToken.is_active) {
      return NextResponse.json(
        { error: 'This session has been deactivated' },
        { status: 410 }
      )
    }

    // Get module from query params (default to first available)
    const url = new URL(request.url)
    const requestedModule = url.searchParams.get('module')
    const campaign = participantToken.campaigns as unknown as {
      id: string
      name: string
      education_config: { modules: string[] }
    }
    const availableModules = campaign?.education_config?.modules || ['student_wellbeing']
    const module = requestedModule && availableModules.includes(requestedModule)
      ? requestedModule
      : availableModules[0]

    // Check if module already completed
    const completedModules = participantToken.modules_completed || []
    if (completedModules.includes(module)) {
      return NextResponse.json({
        success: true,
        status: 'module_completed',
        message: 'You have already completed this assessment. Thank you for your participation!',
        completed_modules: completedModules,
        available_modules: availableModules
      })
    }

    // Find or create agent session for this participant + module
    // Note: Using .contains() for JSONB field filtering (Supabase JS doesn't support ->> syntax)
    // Note: conversation_history is NOT a column - messages are in agent_messages table
    const { data: existingSessionData } = await supabaseAdmin
      .from('agent_sessions')
      .select(`
        id,
        education_session_context,
        session_context
      `)
      .eq('participant_token_id', participantToken.id)
      .contains('education_session_context', { module })
      .single()

    // Type assertion for existing session
    type AgentSessionType = {
      id: string
      education_session_context: Record<string, unknown>
      session_context: Record<string, unknown>
      conversation_history: Array<{ role: string; content: string; created_at: string }>
    } | null

    let agentSession: AgentSessionType = existingSessionData as AgentSessionType
    let isResuming = false
    let greeting: string | null = null

    if (!agentSession) {
      // Build participant and campaign data for greeting
      const school = participantToken.schools as unknown as { id: string; name: string }
      const participant: EducationParticipant = {
        token: participantToken.token,
        participant_type: participantToken.participant_type as 'student' | 'teacher' | 'parent' | 'leadership',
        cohort_metadata: participantToken.cohort_metadata as EducationParticipant['cohort_metadata'],
        campaign_id: participantToken.campaign_id,
        school_id: participantToken.school_id
      }

      const campaignData: EducationCampaign = {
        id: campaign.id,
        name: campaign.name,
        school: {
          id: school.id,
          name: school.name,
          country: 'Unknown' // Default value - not available in this context
        },
        education_config: campaign.education_config as EducationCampaign['education_config']
      }

      // Generate greeting
      greeting = await generateEducationGreeting(
        participant,
        campaignData,
        module as EducationModule
      )

      // Create new agent session using database function
      // @ts-ignore - create_education_agent_session function not yet in generated types
      const { data: newSessionId, error: createError } = await supabaseAdmin.rpc('create_education_agent_session', {
        input_participant_token_id: participantToken.id,
        input_agent_type: 'education_interview',
        input_module: module,
        input_participant_type: participantToken.participant_type,
        input_cohort_metadata: participantToken.cohort_metadata,
        input_system_prompt: `Education interview agent for ${module}`
      })

      if (createError) {
        console.error('Session creation error:', createError)
        return NextResponse.json(
          { error: 'Failed to initialize session' },
          { status: 500 }
        )
      }

      // Fetch the created session
      const { data: newSessionData } = await supabaseAdmin
        .from('agent_sessions')
        .select('id, education_session_context, session_context')
        .eq('id', newSessionId)
        .single()

      agentSession = newSessionData as AgentSessionType

      // Save greeting as first assistant message
      if (greeting && agentSession) {
        await supabaseAdmin
          .from('agent_messages')
          // @ts-ignore - agent_messages table types may not include all columns
          .insert({
            agent_session_id: agentSession.id,
            role: 'assistant',
            content: greeting
          })
      }

      // Mark module as started
      // @ts-ignore - mark_module_started function not yet in generated types
      await supabaseAdmin.rpc('mark_module_started', {
        input_token_id: participantToken.id,  // Function expects UUID
        input_module: module
      })
    } else {
      isResuming = true

      // Fetch conversation history for resuming
      const { data: messages } = await supabaseAdmin
        .from('agent_messages')
        .select('role, content, created_at')
        .eq('agent_session_id', agentSession.id)
        .order('created_at', { ascending: true })

      if (messages && messages.length > 0) {
        agentSession = {
          ...agentSession,
          conversation_history: messages
        }
      }
    }

    // Return session data
    const school = participantToken.schools as unknown as { name: string }
    return NextResponse.json({
      success: true,
      status: 'active',
      session: {
        id: agentSession?.id,
        module,
        participant_type: participantToken.participant_type,
        cohort_metadata: participantToken.cohort_metadata,
        school_name: school.name,
        campaign_name: campaign.name
      },
      conversationHistory: agentSession?.conversation_history || [],
      conversationState: agentSession?.session_context || null,
      greeting: !isResuming ? greeting : null,
      isResuming,
      available_modules: availableModules,
      completed_modules: completedModules
    })

  } catch (error) {
    console.error('Session access error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
