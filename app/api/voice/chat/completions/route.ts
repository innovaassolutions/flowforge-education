import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { notifyEducationAdmin } from '@/lib/services/completion-notification'
import {
  processEducationMessage,
  detectSafeguardingConcerns,
  generateClosingMessage,
  EducationCampaign,
  ConversationState,
  EducationModule,
} from '@/lib/agents/education-interview-agent'
import { logUsageEvent, logLLMUsage } from '@/lib/usage/log-usage'
import type { OpenAIChatMessage, OpenAIChatRequest } from '@/lib/types/voice'

// CORS headers for ElevenLabs cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * POST /api/voice/chat/completions
 * Custom LLM endpoint for ElevenLabs Conversational AI (Education only)
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  console.log(`[voice/chat/completions] ========== POST request received at ${timestamp} ==========`)

  // Debug: Log all headers to see what ElevenLabs sends
  const headersObj: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('key')) {
      headersObj[key] = `${value.substring(0, 20)}... (len: ${value.length})`
    } else {
      headersObj[key] = value
    }
  })
  console.log('[voice/chat/completions] All headers:', JSON.stringify(headersObj, null, 2))

  try {
    // Validate authorization
    const authHeader = request.headers.get('authorization')

    // TEMPORARY: Skip auth check to diagnose ElevenLabs connection issue
    // TODO: Re-enable auth after debugging
    const SKIP_AUTH_FOR_DEBUG = true

    if (!SKIP_AUTH_FOR_DEBUG) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[voice/chat/completions] Missing or invalid auth header')
        return new Response('Unauthorized', { status: 401 })
      }

      const apiKey = authHeader.replace('Bearer ', '')
      const expectedSecret = process.env.ELEVENLABS_LLM_SECRET

      if (apiKey !== expectedSecret) {
        console.error('[voice/chat/completions] Invalid LLM secret - mismatch')
        return new Response('Unauthorized', { status: 401 })
      }
    } else {
      console.log('[voice/chat/completions] DEBUG MODE: Auth check skipped')
    }

    const body: OpenAIChatRequest = await request.json()
    const { messages, stream = true } = body

    console.log('[voice/chat/completions] Messages count:', messages.length)

    // Extract session context from system prompt
    const systemMessage = messages.find((m) => m.role === 'system')
    console.log('[voice/chat/completions] System prompt (first 500 chars):', systemMessage?.content?.substring(0, 500))

    const sessionContext = parseSessionContext(messages)
    console.log('[voice/chat/completions] Session context:', {
      hasToken: !!sessionContext.sessionToken,
      tokenPrefix: sessionContext.sessionToken?.substring(0, 10),
      moduleId: sessionContext.moduleId,
      stakeholderName: sessionContext.stakeholderName,
      isTestMode: sessionContext.isTestMode,
    })

    // Handle test mode
    if (sessionContext.isTestMode) {
      console.log('[voice/chat/completions] TEST MODE - returning simple response')
      const userMessage = messages.filter((m) => m.role === 'user').pop()?.content

      if (!userMessage) {
        const testGreeting = `Hi there! I'm Jippity, your AI interviewer. This is a test session to verify the voice connection is working properly. Everything sounds great! How are you doing today?`
        if (stream) {
          return streamResponseAsync(Promise.resolve(testGreeting))
        }
        return jsonResponse(testGreeting)
      }

      const testResponse = `Thank you for saying that! I heard you clearly. The voice connection is working well. Is there anything specific you'd like to test?`
      if (stream) {
        return streamResponseAsync(Promise.resolve(testResponse))
      }
      return jsonResponse(testResponse)
    }

    if (!sessionContext.sessionToken) {
      console.error('[voice/chat/completions] No session token found in messages')
      return streamError('Session context not found')
    }

    // Get the latest user message
    const userMessage = messages
      .filter((m) => m.role === 'user')
      .pop()?.content

    console.log('[voice/chat/completions] User message:', userMessage ? userMessage.substring(0, 50) + '...' : 'NONE')

    if (stream) {
      let contentPromise: Promise<string>

      if (!userMessage) {
        console.log('[voice/chat/completions] No user message - generating greeting')
        contentPromise = generateEducationGreeting(
          sessionContext.sessionToken,
          sessionContext.stakeholderName
        )
      } else {
        contentPromise = handleEducationMessage(
          sessionContext.sessionToken,
          userMessage,
          sessionContext.moduleId
        )
      }

      return streamResponseAsync(contentPromise)
    }

    // Non-streaming
    let response: string

    if (!userMessage) {
      response = await generateEducationGreeting(
        sessionContext.sessionToken,
        sessionContext.stakeholderName
      )
    } else {
      response = await handleEducationMessage(
        sessionContext.sessionToken,
        userMessage,
        sessionContext.moduleId
      )
    }

    console.log('[voice/chat/completions] Response length:', response.length)
    return jsonResponse(response)
  } catch (error) {
    console.error('[voice/chat/completions] Error:', error)
    return streamError('An error occurred processing your request')
  }
}

/**
 * Parse session context from the messages array.
 * ElevenLabs passes dynamic variables in the system prompt.
 */
function parseSessionContext(messages: OpenAIChatMessage[]): {
  sessionToken: string | null
  moduleId: string | null
  stakeholderName: string | null
  isTestMode: boolean
} {
  const systemPrompt = messages.find((m) => m.role === 'system')?.content || ''

  const testTokenMatch = systemPrompt.match(/session_token:\s*(test[-_][\w-]+)/)
  const isTestMode = !!testTokenMatch
  const tokenMatch = isTestMode ? null : systemPrompt.match(/session_token:\s*(\S+)/)
  const sessionToken = testTokenMatch ? testTokenMatch[1] : (tokenMatch ? tokenMatch[1] : null)

  const moduleMatch = systemPrompt.match(/module_id:\s*(\w+[-]?\w*)/)
  const moduleId = moduleMatch ? moduleMatch[1] : null

  const nameMatch = systemPrompt.match(/stakeholder_name:\s*([\w-]+)/)
  const stakeholderName = nameMatch ? nameMatch[1] : null

  return {
    sessionToken,
    moduleId,
    stakeholderName,
    isTestMode,
  }
}

/**
 * Handle education interview messages
 */
async function handleEducationMessage(
  sessionToken: string,
  userMessage: string,
  moduleId: string | null
): Promise<string> {
  if (!sessionToken.startsWith('ff_edu_')) {
    console.error('[voice/education] Invalid token format — expected ff_edu_ prefix, got:', sessionToken.substring(0, 10))
    throw new Error('Invalid education session token format')
  }

  const { data: participantTokenData, error: tokenError } = await supabaseAdmin
    .from('education_participant_tokens')
    .select(
      `
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
    `
    )
    .eq('token', sessionToken)
    .single()

  const participantToken = participantTokenData as {
    id: string
    token: string
    participant_type: string
    cohort_metadata: Record<string, string>
    school_id: string
    campaign_id: string
    is_active: boolean
    schools: { id: string; name: string }
    campaigns: {
      id: string
      name: string
      education_config: Record<string, unknown>
    }
  } | null

  if (tokenError || !participantToken) {
    throw new Error('Invalid session token')
  }

  if (!participantToken.is_active) {
    throw new Error('Session has been deactivated')
  }

  const validModules: EducationModule[] = [
    'student_wellbeing',
    'teaching_learning',
    'parent_confidence',
  ]
  const rawModule = moduleId?.toLowerCase() || 'student_wellbeing'
  const targetModule: EducationModule = validModules.includes(rawModule as EducationModule)
    ? (rawModule as EducationModule)
    : 'student_wellbeing'

  const { data: agentSessionData, error: sessionError } = await supabaseAdmin
    .from('agent_sessions')
    .select(
      `
      id,
      education_session_context,
      session_context
    `
    )
    .eq('participant_token_id', participantToken.id)
    .contains('education_session_context', { module: targetModule })
    .single()

  const agentSession = agentSessionData as {
    id: string
    education_session_context: Record<string, unknown>
    session_context: Record<string, unknown>
  } | null

  if (sessionError || !agentSession) {
    throw new Error('No active session found')
  }

  const { data: messageHistoryData } = await supabaseAdmin
    .from('agent_messages')
    .select('role, content, created_at')
    .eq('agent_session_id', agentSession.id)
    .order('created_at', { ascending: true })

  const messageHistory = messageHistoryData as Array<{
    role: string
    content: string
    created_at: string
  }> | null

  const safeguardingFlags = detectSafeguardingConcerns(userMessage)

  const school = participantToken.schools
  const campaign = participantToken.campaigns

  if (!school || !campaign) {
    throw new Error('Session data incomplete')
  }

  const rawParticipantType =
    participantToken.participant_type?.toLowerCase() || 'student'
  const validParticipantTypes = [
    'student',
    'teacher',
    'parent',
    'leadership',
  ] as const
  const participantType = validParticipantTypes.includes(
    rawParticipantType as (typeof validParticipantTypes)[number]
  )
    ? (rawParticipantType as 'student' | 'teacher' | 'parent' | 'leadership')
    : 'student'

  const safeCohotMetadata = participantToken.cohort_metadata || {}

  const participant = {
    token: participantToken.token,
    participant_type: participantType,
    cohort_metadata: safeCohotMetadata as Record<string, string>,
    campaign_id: participantToken.campaign_id,
    school_id: participantToken.school_id,
  }

  const safeEducationConfig = campaign.education_config || {
    modules: ['student_wellbeing'],
    pilot_type: 'standard',
  }

  const campaignData = {
    id: campaign.id,
    name: campaign.name,
    school: {
      id: school.id,
      name: school.name,
      country: 'Unknown',
    },
    education_config: safeEducationConfig as EducationCampaign['education_config'],
  }

  const result = await processEducationMessage(
    userMessage,
    participant,
    campaignData,
    targetModule,
    (messageHistory || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.created_at,
    })),
    ((agentSession.education_session_context as Record<string, unknown>)
      ?.progress as ConversationState) || {
      phase: 'opening',
      sections_completed: [],
      questions_asked: 0,
      rapport_established: false,
      anonymity_confirmed: false,
      safeguarding_flags: [],
      domains_explored: [],
      current_domain_id: undefined,
      domain_coverage_percent: 0,
    }
  )

  let response = result.response
  const updatedState = result.updatedState
  const safeguardingAlert = result.safeguardingAlert

  if (updatedState.is_complete) {
    try {
      response = await generateClosingMessage(
        participant,
        campaignData,
        targetModule,
        updatedState
      )
    } catch (closingError) {
      console.error('Error generating closing message:', closingError)
      response =
        "Thank you so much for sharing your thoughts and experiences with me today. Your insights are genuinely valuable and will help identify patterns that can improve outcomes. I really appreciate your openness throughout our conversation."
    }
  }

  await (supabaseAdmin.from('agent_messages') as ReturnType<typeof supabaseAdmin.from>).insert({
    agent_session_id: agentSession.id,
    role: 'user',
    content: userMessage,
  })

  await (supabaseAdmin.from('agent_messages') as ReturnType<typeof supabaseAdmin.from>).insert({
    agent_session_id: agentSession.id,
    role: 'assistant',
    content: response,
  })

  try {
    await (supabaseAdmin.rpc as Function)('update_education_session_progress', {
      input_session_id: agentSession.id,
      input_questions_asked: updatedState.questions_asked || 0,
      input_sections_completed: updatedState.sections_completed || [],
      input_estimated_completion: Math.min(
        (updatedState.questions_asked || 0) / 15,
        1
      ),
    })
  } catch (rpcErr) {
    console.error('[voice/education] update_education_session_progress RPC failed:', rpcErr)
  }

  if (safeguardingFlags.length > 0 || safeguardingAlert) {
    for (const flag of safeguardingFlags) {
      await (supabaseAdmin.rpc as Function)('record_safeguarding_flag', {
        input_session_id: agentSession.id,
        input_flag: flag,
      })

      if (flag.confidence >= 0.7) {
        await (supabaseAdmin.rpc as Function)('create_safeguarding_alert', {
          input_campaign_id: participantToken.campaign_id,
          input_school_id: participantToken.school_id,
          input_participant_token: participantToken.token,
          input_participant_type: participantToken.participant_type,
          input_cohort_metadata: participantToken.cohort_metadata,
          input_trigger_type: flag.type,
          input_trigger_content: userMessage,
          input_trigger_context: response,
          input_confidence: flag.confidence,
          input_ai_analysis: {
            trigger_type: flag.type,
            trigger_content: flag.content,
            agent_assessment: safeguardingAlert,
          },
        })
      }
    }
  }

  if (updatedState.is_complete) {
    await (supabaseAdmin.rpc as Function)('mark_module_completed', {
      input_token_id: participantToken.id,
      input_module: targetModule,
    })

    const participantLabel = participantToken.participant_type
      ? `${participantToken.participant_type} participant`
      : 'Participant'
    try {
      await notifyEducationAdmin({
        campaignId: participantToken.campaign_id,
        participantName: participantLabel,
        assessmentType: `Education Assessment (${targetModule.replace(/_/g, ' ')})`,
        dashboardPath: `/dashboard`,
      })
    } catch (notifyErr) {
      console.error('Failed to send completion notification:', notifyErr)
    }
  }

  await (supabaseAdmin.rpc as Function)('update_participant_activity', {
    input_token_id: participantToken.id,
  })

  return response
}

/**
 * Generate greeting for education vertical
 */
async function generateEducationGreeting(
  sessionToken: string,
  stakeholderName: string | null
): Promise<string> {
  const { data: participantTokenData } = await supabaseAdmin
    .from('education_participant_tokens')
    .select(`
      participant_type,
      cohort_metadata,
      schools:school_id(name)
    `)
    .eq('token', sessionToken)
    .single()

  const participantToken = participantTokenData as {
    participant_type: string
    cohort_metadata: Record<string, string> | null
    schools: { name: string } | null
  } | null

  const participantType = participantToken?.participant_type?.toLowerCase() || stakeholderName?.toLowerCase() || 'student'
  const schoolName = participantToken?.schools?.name || 'your school'

  let greeting: string

  switch (participantType) {
    case 'student':
      greeting = `Hi, I'm Jippity! Thanks for taking the time to chat with me today. I'm here to learn a bit about your experience at ${schoolName}. This is a relaxed conversation, and there are no right or wrong answers. I'm just interested in hearing your thoughts. Before we start, I want you to know that everything you share is completely confidential. So, how are you doing today?`
      break
    case 'teacher':
      greeting = `Hi, I'm Jippity! Thank you for joining me today. I'm here to gather some insights about your professional experience at ${schoolName}. This is an informal conversation, and I'm genuinely interested in your perspective on teaching and working here. Everything we discuss is confidential and will be used to help improve the school environment. How has your day been so far?`
      break
    case 'parent':
      greeting = `Hi, I'm Jippity! Thank you so much for taking the time to speak with me. I'm here to learn about your experience as a parent with a child at ${schoolName}. This is a relaxed conversation, and your honest feedback is really valuable. Everything you share is confidential. How are you doing today?`
      break
    case 'leadership':
      greeting = `Hi, I'm Jippity! Thank you for making time in your schedule to speak with me. I'm here to discuss your perspective on ${schoolName} and gather your insights as a school leader. Your feedback is valuable for understanding the broader picture. Everything discussed is confidential. How has your week been going?`
      break
    default:
      greeting = `Hi, I'm Jippity! Thanks for joining me today. I'm here to have a friendly conversation and learn about your experience. Everything you share is completely confidential, and there are no right or wrong answers. How are you doing today?`
  }

  console.log('[voice/chat/completions] Generated education greeting for', participantType, '- length:', greeting.length)
  return greeting
}

// ============================================================================
// SSE STREAMING UTILITIES
// ============================================================================

function streamResponseAsync(contentPromise: Promise<string>): Response {
  const encoder = new TextEncoder()
  const id = `chatcmpl-${Date.now()}`
  const created = Math.floor(Date.now() / 1000)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const roleChunk = JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model: 'flowforge-interview-agent',
          choices: [
            {
              index: 0,
              delta: { role: 'assistant' },
              logprobs: null,
              finish_reason: null,
            },
          ],
        })
        controller.enqueue(encoder.encode(`data: ${roleChunk}\n\n`))

        const content = await contentPromise

        const words = content.split(' ')
        const chunks: string[] = []
        for (let i = 0; i < words.length; i += 4) {
          chunks.push(words.slice(i, i + 4).join(' '))
        }

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          const isLast = i === chunks.length - 1
          const chunkContent = isLast ? chunk : chunk + ' '

          const data = JSON.stringify({
            id,
            object: 'chat.completion.chunk',
            created,
            model: 'flowforge-interview-agent',
            choices: [
              {
                index: 0,
                delta: { content: chunkContent },
                logprobs: null,
                finish_reason: null,
              },
            ],
          })

          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          await new Promise((resolve) => setTimeout(resolve, 10))
        }

        const finishChunk = JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model: 'flowforge-interview-agent',
          choices: [
            {
              index: 0,
              delta: {},
              logprobs: null,
              finish_reason: 'stop',
            },
          ],
        })
        controller.enqueue(encoder.encode(`data: ${finishChunk}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        console.error('[streamResponseAsync] Error:', error)
        const errorData = JSON.stringify({
          id,
          object: 'chat.completion.chunk',
          created,
          model: 'flowforge-interview-agent',
          choices: [
            {
              index: 0,
              delta: { content: 'I apologize, but something went wrong. Could you please try again?' },
              logprobs: null,
              finish_reason: 'stop',
            },
          ],
        })
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  })
}

function streamError(errorMessage: string): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const id = `chatcmpl-${Date.now()}`
      const created = Math.floor(Date.now() / 1000)

      const data = JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model: 'flowforge-interview-agent',
        choices: [
          {
            index: 0,
            delta: {
              content: `I apologize, but ${errorMessage}. Could you please try again?`,
            },
            logprobs: null,
            finish_reason: 'stop',
          },
        ],
      })

      controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  })
}

function jsonResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'flowforge-interview-agent',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  )
}
