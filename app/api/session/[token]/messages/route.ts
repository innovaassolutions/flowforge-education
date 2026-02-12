import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  processEducationMessage,
  detectSafeguardingConcerns,
  generateClosingMessage,
  EducationCampaign,
  ConversationState
} from '@/lib/agents/education-interview-agent'
import { notifyEducationAdmin } from '@/lib/services/completion-notification'

/**
 * POST /api/session/[token]/messages
 * Send a message in an education interview session
 * This is a PUBLIC endpoint - token is the authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { message, module } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

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

    // Find active agent session
    // Note: Using .contains() for JSONB field filtering (Supabase JS doesn't support ->> syntax)
    // Validate module
    const validModules = ['student_wellbeing', 'teaching_learning', 'parent_confidence'] as const
    const rawModule = module?.toLowerCase() || 'student_wellbeing'
    const targetModule = validModules.includes(rawModule as typeof validModules[number])
      ? rawModule
      : 'student_wellbeing'
    const { data: agentSessionData, error: sessionError } = await supabaseAdmin
      .from('agent_sessions')
      .select(`
        id,
        education_session_context,
        session_context
      `)
      .eq('participant_token_id', participantToken.id)
      .contains('education_session_context', { module: targetModule })
      .single()

    // Type assertion for agent session
    const agentSession = agentSessionData as {
      id: string
      education_session_context: Record<string, unknown>
      session_context: Record<string, unknown>
    } | null

    if (sessionError || !agentSession) {
      return NextResponse.json(
        { error: 'No active session found. Please start a new session.' },
        { status: 404 }
      )
    }

    // Get conversation history
    const { data: messageHistoryData } = await supabaseAdmin
      .from('agent_messages')
      .select('role, content, created_at')
      .eq('agent_session_id', agentSession.id)
      .order('created_at', { ascending: true })

    // Type assertion for message history
    const messageHistory = messageHistoryData as Array<{
      role: string
      content: string
      created_at: string
    }> | null

    // Check for safeguarding concerns BEFORE processing
    const safeguardingFlags = detectSafeguardingConcerns(message)

    // Build participant and campaign data with safe null checks
    const school = participantToken.schools as unknown as { id: string; name: string } | null
    const campaign = participantToken.campaigns as unknown as {
      id: string
      name: string
      education_config: Record<string, unknown>
    } | null

    // Validate school and campaign data
    if (!school || !campaign) {
      console.error('Missing school or campaign data:', { school, campaign })
      return NextResponse.json(
        { error: 'Session data incomplete. Please contact support.' },
        { status: 400 }
      )
    }

    // Normalize and validate participant type
    const rawParticipantType = participantToken.participant_type?.toLowerCase() || 'student'
    const validParticipantTypes = ['student', 'teacher', 'parent', 'leadership'] as const
    const participantType = validParticipantTypes.includes(rawParticipantType as typeof validParticipantTypes[number])
      ? rawParticipantType as 'student' | 'teacher' | 'parent' | 'leadership'
      : 'student' // Default fallback

    // Ensure cohort_metadata is an object, not null/undefined
    const safeCohotMetadata = participantToken.cohort_metadata || {}

    const participant = {
      token: participantToken.token,
      participant_type: participantType,
      cohort_metadata: safeCohotMetadata as Record<string, string>,
      campaign_id: participantToken.campaign_id,
      school_id: participantToken.school_id
    }

    // Ensure education_config has required structure
    const safeEducationConfig = campaign.education_config || { modules: ['student_wellbeing'], pilot_type: 'standard' }

    const campaignData = {
      id: campaign.id,
      name: campaign.name,
      school: {
        id: school.id,
        name: school.name,
        country: 'Unknown' // Default value - not available in this context
      },
      education_config: safeEducationConfig as EducationCampaign['education_config']
    }

    // Process message through education agent
    let response: string
    let updatedState: ConversationState
    let safeguardingAlert: string | undefined

    try {
      const result = await processEducationMessage(
        message,
        participant,
        campaignData,
        targetModule,
        (messageHistory || []).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.created_at
        })),
        (agentSession.education_session_context as Record<string, unknown>)?.progress as ConversationState || {
          phase: 'opening',
          sections_completed: [],
          questions_asked: 0,
          rapport_established: false,
          anonymity_confirmed: false,
          safeguarding_flags: [],
          domains_explored: [],
          current_domain_id: undefined,
          domain_coverage_percent: 0
        } as ConversationState
      )
      response = result.response
      updatedState = result.updatedState
      safeguardingAlert = result.safeguardingAlert
    } catch (agentError) {
      console.error('Education agent error:', agentError)
      console.error('Agent error message:', agentError instanceof Error ? agentError.message : 'Unknown')
      console.error('Message history length:', messageHistory?.length || 0)
      console.error('Participant type:', participant.participant_type)
      console.error('Target module:', targetModule)
      throw agentError // Re-throw to be caught by outer handler
    }

    // If interview is now complete, replace the AI's response with a proper closing message
    // This prevents the abrupt ending where the AI asks a follow-up question but the
    // user can't respond because the completion banner appears
    if (updatedState.is_complete) {
      try {
        console.log('Interview complete - generating proper closing message')
        response = await generateClosingMessage(
          participant,
          campaignData,
          targetModule,
          updatedState
        )
      } catch (closingError) {
        console.error('Error generating closing message:', closingError)
        // Fall back to a warm generic closing if generation fails
        response = "Thank you so much for sharing your thoughts and experiences with me today. Your insights are genuinely valuable and will help identify patterns that can improve outcomes. I really appreciate your openness throughout our conversation."
      }
    }

    // Save user message
    await supabaseAdmin
      .from('agent_messages')
      // @ts-ignore - agent_messages table types may not include all columns
      .insert({
        agent_session_id: agentSession.id,
        role: 'user',
        content: message
      })

    // Save assistant response
    await supabaseAdmin
      .from('agent_messages')
      // @ts-ignore - agent_messages table types may not include all columns
      .insert({
        agent_session_id: agentSession.id,
        role: 'assistant',
        content: response
      })

    // Update session progress
    // @ts-ignore - update_education_session_progress function not yet in generated types
    await supabaseAdmin.rpc('update_education_session_progress', {
      input_session_id: agentSession.id,
      input_questions_asked: updatedState.questions_asked || 0,
      input_sections_completed: updatedState.sections_completed || [],  // Pass array directly, Supabase handles JSONB conversion
      input_estimated_completion: Math.min((updatedState.questions_asked || 0) / 15, 1)
    })

    // Handle safeguarding alerts
    if (safeguardingFlags.length > 0 || safeguardingAlert) {
      // Record flags in session
      for (const flag of safeguardingFlags) {
        // @ts-ignore - record_safeguarding_flag function not yet in generated types
        await supabaseAdmin.rpc('record_safeguarding_flag', {
          input_session_id: agentSession.id,
          input_flag: flag  // Pass object directly, Supabase handles JSONB conversion
        })

        // Create safeguarding alert if confidence is high enough
        if (flag.confidence >= 0.7) {
          // @ts-ignore - create_safeguarding_alert function not yet in generated types
          await supabaseAdmin.rpc('create_safeguarding_alert', {
            input_campaign_id: participantToken.campaign_id,
            input_school_id: participantToken.school_id,
            input_participant_token: participantToken.token,
            input_participant_type: participantToken.participant_type,
            input_cohort_metadata: participantToken.cohort_metadata,  // Already an object, Supabase handles JSONB conversion
            input_trigger_type: flag.type,
            input_trigger_content: message,
            input_trigger_context: response,
            input_confidence: flag.confidence,
            input_ai_analysis: {  // Pass object directly, Supabase handles JSONB conversion
              trigger_type: flag.type,
              trigger_content: flag.content,
              agent_assessment: safeguardingAlert
            }
          })
        }
      }
    }

    // Check if interview is complete
    const isComplete = updatedState.is_complete || false
    if (isComplete) {
      // Mark module as completed
      // @ts-ignore - mark_module_completed function not yet in generated types
      await supabaseAdmin.rpc('mark_module_completed', {
        input_token_id: participantToken.id,  // Function expects UUID
        input_module: targetModule
      })

      // Notify school admin/facilitator
      const participantLabel = participantToken.participant_type
        ? `${participantToken.participant_type} participant`
        : 'Participant'
      try {
        await notifyEducationAdmin({
          campaignId: participantToken.campaign_id,
          participantName: participantLabel,
          assessmentType: `Education Assessment (${targetModule.replace(/_/g, ' ')})`,
          dashboardPath: `/dashboard/education`,
        })
      } catch (notifyErr) {
        console.error('Failed to send completion notification:', notifyErr)
      }
    }

    // Update participant activity
    // @ts-ignore - update_participant_activity function not yet in generated types
    await supabaseAdmin.rpc('update_participant_activity', {
      input_token_id: participantToken.id  // Function expects UUID
    })

    return NextResponse.json({
      success: true,
      response,
      conversationState: updatedState,
      isComplete,
      safeguardingDetected: safeguardingFlags.length > 0
    })

  } catch (error) {
    console.error('=== MESSAGE PROCESSING ERROR ===')
    console.error('Error object:', error)
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)

    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)

      // Check for Anthropic SDK specific error properties
      const anyError = error as unknown as Record<string, unknown>
      if ('status' in anyError) {
        console.error('HTTP status:', anyError.status)
      }
      if ('error' in anyError) {
        console.error('Error body:', JSON.stringify(anyError.error))
      }
      if ('cause' in anyError) {
        console.error('Error cause:', anyError.cause)
      }
    }

    // Provide more specific error info for debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorName = error instanceof Error ? error.name : 'UnknownError'

    // Check for various Anthropic API errors
    const isAnthropicError = errorMessage.includes('401') ||
                            errorMessage.includes('credit') ||
                            errorMessage.includes('api_key') ||
                            errorMessage.includes('authentication') ||
                            errorMessage.includes('first message') ||
                            errorMessage.includes('user role') ||
                            errorMessage.includes('messages:') ||
                            errorMessage.includes('model') ||
                            errorMessage.includes('does not exist') ||
                            errorMessage.includes('invalid') ||
                            errorMessage.includes('rate limit') ||
                            errorMessage.includes('overloaded') ||
                            errorMessage.includes('timeout') ||
                            errorMessage.includes('ECONNREFUSED') ||
                            errorMessage.includes('ENOTFOUND') ||
                            errorName === 'APIError' ||
                            errorName === 'AuthenticationError' ||
                            errorName === 'BadRequestError' ||
                            errorName === 'NotFoundError' ||
                            errorName === 'RateLimitError' ||
                            errorName === 'InternalServerError' ||
                            errorName === 'APIConnectionError'

    // Always include error details in response for debugging
    // Production frontend can choose to hide these from users
    return NextResponse.json(
      {
        error: isAnthropicError
          ? 'AI service error. Please try again in a moment.'
          : 'Failed to process message',
        details: `${errorName}: ${errorMessage}`,
        errorType: isAnthropicError ? 'anthropic' : 'processing',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
