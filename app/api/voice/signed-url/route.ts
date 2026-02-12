import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getVoiceConfigForSession } from '@/lib/services/voice-availability'

/**
 * Generate a personalized greeting based on participant type and school name.
 * These greetings are passed as firstMessage override to ElevenLabs.
 */
function generateGreeting(participantType: string, schoolName?: string): string {
  const school = schoolName || 'your school'
  const normalizedType = participantType?.toLowerCase() || 'student'

  switch (normalizedType) {
    case 'student':
      return `Hi, I'm Jippity! Thanks for taking the time to chat with me today. I'm here to learn a bit about your experience at ${school}. This is a relaxed conversation, and there are no right or wrong answers. I'm just interested in hearing your thoughts. Before we start, I want you to know that everything you share is completely confidential. So, how are you doing today?`

    case 'teacher':
      return `Hi, I'm Jippity! Thank you for joining me today. I'm here to gather some insights about your professional experience at ${school}. This is an informal conversation, and I'm genuinely interested in your perspective on teaching and working here. Everything we discuss is confidential and will be used to help improve the school environment. How has your day been so far?`

    case 'parent':
      return `Hi, I'm Jippity! Thank you so much for taking the time to speak with me. I'm here to learn about your experience as a parent with a child at ${school}. This is a relaxed conversation, and your honest feedback is really valuable. Everything you share is confidential. How are you doing today?`

    case 'leadership':
      return `Hi, I'm Jippity! Thank you for making time in your schedule to speak with me. I'm here to discuss your perspective on ${school} and gather your insights as a school leader. Your feedback is valuable for understanding the broader picture. Everything discussed is confidential. How has your week been going?`

    default:
      return `Hi, I'm Jippity! Thanks for joining me today. I'm here to have a friendly conversation and learn about your experience. Everything you share is completely confidential, and there are no right or wrong answers. How are you doing today?`
  }
}

// CORS headers for cross-origin requests
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
 * GET handler - returns method info for debugging
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Use POST method to get a signed URL', methods: ['POST'] },
    { status: 405, headers: corsHeaders }
  )
}

/**
 * POST /api/voice/signed-url
 * Get a signed URL for connecting to ElevenLabs Conversational AI
 *
 * This endpoint:
 * 1. Validates the session/participant token
 * 2. Checks voice availability for the session
 * 3. Requests a signed URL from ElevenLabs
 * 4. Returns the URL with dynamic variables for session context
 *
 * Body:
 * - sessionToken: string (required) - The participant access token (ff_edu_xxx) or session token
 * - moduleId: string (optional) - The module being interviewed
 */
export async function POST(request: NextRequest) {
  console.log('[voice/signed-url] POST request received')

  try {
    const body = await request.json()
    const { sessionToken, moduleId } = body

    console.log('[voice/signed-url] Token:', sessionToken?.substring(0, 20) + '...')

    if (!sessionToken) {
      console.log('[voice/signed-url] No session token provided')
      return NextResponse.json(
        { error: 'Session token is required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Check voice availability and get config
    console.log('[voice/signed-url] Checking voice availability...')
    const voiceAvailability = await getVoiceConfigForSession(sessionToken)
    console.log('[voice/signed-url] Voice availability:', voiceAvailability.available, voiceAvailability.reason || '')

    if (!voiceAvailability.available) {
      return NextResponse.json(
        { error: voiceAvailability.reason || 'Voice not available' },
        { status: 403 }
      )
    }

    const config = voiceAvailability.config!

    // Get stakeholder context for dynamic variables and greeting personalization
    let stakeholderName: string | undefined
    let schoolName: string | undefined

    // For education participant tokens (ff_edu_xxx), get context directly from participant token
    if (sessionToken.startsWith('ff_edu_')) {
      const { data: participantTokenData } = await supabase
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

      if (participantToken) {
        stakeholderName = participantToken.participant_type
        schoolName = participantToken.schools?.name
      }
    } else {
      // For regular session tokens, try to get from agent_sessions
      const { data: sessionData } = await supabase
        .from('agent_sessions')
        .select(`
          id,
          participant_token_id,
          education_session_context
        `)
        .eq('session_token', sessionToken)
        .single()

      const session = sessionData as {
        id: string
        participant_token_id: string | null
        education_session_context: Record<string, unknown> | null
      } | null

      if (session?.participant_token_id) {
        const { data: participantTokenData } = await supabase
          .from('education_participant_tokens')
          .select(`
            participant_type,
            cohort_metadata,
            schools:school_id(name)
          `)
          .eq('id', session.participant_token_id)
          .single()

        const participantToken = participantTokenData as {
          participant_type: string
          cohort_metadata: Record<string, string> | null
          schools: { name: string } | null
        } | null

        if (participantToken) {
          stakeholderName = participantToken.participant_type
          schoolName = participantToken.schools?.name
        }
      }
    }

    // Generate personalized greeting for the voice session
    const firstMessage = generateGreeting(stakeholderName || 'student', schoolName)
    console.log('[voice/signed-url] Generated greeting for:', stakeholderName, '- length:', firstMessage.length)

    // Use vertical-specific agent ID, or fall back to default
    const agentId =
      config.elevenlabsAgentId || process.env.ELEVENLABS_AGENT_ID

    console.log('[voice/signed-url] Agent ID:', agentId ? agentId.substring(0, 10) + '...' : 'NOT SET')

    if (!agentId) {
      console.error('[voice/signed-url] No ElevenLabs agent ID configured')
      return NextResponse.json(
        { error: 'Voice agent not configured' },
        { status: 500 }
      )
    }

    // Request signed URL from ElevenLabs
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY

    console.log('[voice/signed-url] API Key:', elevenlabsApiKey ? 'SET (' + elevenlabsApiKey.length + ' chars)' : 'NOT SET')

    if (!elevenlabsApiKey) {
      console.error('[voice/signed-url] ELEVENLABS_API_KEY not configured')
      return NextResponse.json(
        { error: 'Voice service not configured' },
        { status: 500 }
      )
    }

    // Request both signed URL (WebSocket fallback) and conversation token (WebRTC)
    console.log('[voice/signed-url] Requesting credentials from ElevenLabs...')

    // Get conversation token for WebRTC (preferred)
    const tokenResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': elevenlabsApiKey,
        },
      }
    )

    console.log('[voice/signed-url] Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[voice/signed-url] ElevenLabs token error:', errorText)
      return NextResponse.json(
        { error: `Voice service error: ${tokenResponse.status}` },
        { status: 500 }
      )
    }

    const tokenData = await tokenResponse.json()
    const { token: conversationToken } = tokenData

    console.log('[voice/signed-url] Got conversation token:', conversationToken ? 'YES' : 'NO')

    // Return conversation token with dynamic variables and personalized greeting
    // Using WebRTC mode for better stability (fixes WebSocket disconnection issues)
    // IMPORTANT: All dynamic variables must have values (not undefined) for ElevenLabs interpolation
    return NextResponse.json({
      conversationToken,
      firstMessage,
      dynamicVariables: {
        session_token: sessionToken,
        module_id: moduleId || 'default',
        stakeholder_name: stakeholderName || 'participant',
        vertical_key: config.verticalKey || 'education',
      },
      config: {
        verticalKey: config.verticalKey,
        displayName: config.displayName,
        llmEndpointPath: config.llmEndpointPath,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[voice/signed-url] Error:', errorMessage, error)
    return NextResponse.json(
      { error: `Failed to get voice session URL: ${errorMessage}` },
      { status: 500 }
    )
  }
}
