import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { notifyEducationAdmin } from '@/lib/services/completion-notification'
import type { EducationModule } from '@/lib/agents/education-interview-agent'

/**
 * POST /api/session/[token]/complete
 * Facilitator override - manually mark an education session module as complete
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const module: string = body.module || 'student_wellbeing'

    // Validate token format
    if (!token.startsWith('ff_edu_')) {
      return NextResponse.json(
        { error: 'Invalid education session token' },
        { status: 400 }
      )
    }

    // Look up participant token with school/campaign context
    const { data: participantToken, error: tokenError } = await supabaseAdmin
      .from('education_participant_tokens')
      .select(`
        id,
        token,
        participant_type,
        is_active,
        school_id,
        campaign_id,
        schools:school_id(id, name),
        campaigns:campaign_id(id, name)
      `)
      .eq('token', token)
      .single() as any

    if (tokenError || !participantToken) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (!participantToken.is_active) {
      return NextResponse.json(
        { error: 'Session has been deactivated' },
        { status: 403 }
      )
    }

    // Validate module
    const validModules: EducationModule[] = [
      'student_wellbeing',
      'teaching_learning',
      'parent_confidence',
    ]
    const targetModule: EducationModule = validModules.includes(module as EducationModule)
      ? (module as EducationModule)
      : 'student_wellbeing'

    // Find the agent session for this participant + module
    const { data: agentSession, error: sessionError } = await (supabaseAdmin
      .from('agent_sessions') as any)
      .select('id, education_session_context, session_context')
      .eq('participant_token_id', participantToken.id)
      .contains('education_session_context', { module: targetModule })
      .single()

    if (sessionError || !agentSession) {
      return NextResponse.json(
        { error: 'No active session found for this module' },
        { status: 404 }
      )
    }

    // Update education session context with facilitator override
    const updatedContext = {
      ...(agentSession.education_session_context || {}),
      facilitator_override: true,
      is_complete: true,
      completed_at: new Date().toISOString(),
    }

    const { error: contextError } = await (supabaseAdmin
      .from('agent_sessions') as any)
      .update({ education_session_context: updatedContext })
      .eq('id', agentSession.id)

    if (contextError) {
      console.error('[education/complete] Failed to update agent session:', contextError)
      return NextResponse.json(
        { error: 'Failed to update agent session' },
        { status: 500 }
      )
    }

    // Mark module as completed via RPC
    try {
      await (supabaseAdmin.rpc as Function)('mark_module_completed', {
        input_token_id: participantToken.id,
        input_module: targetModule,
      })
    } catch (rpcErr) {
      console.error('[education/complete] mark_module_completed RPC failed:', rpcErr)
      return NextResponse.json(
        { error: 'Failed to mark module as completed' },
        { status: 500 }
      )
    }

    const participantLabel = participantToken.participant_type
      ? `${participantToken.participant_type} participant`
      : 'Participant'

    console.log(`[education/complete] Module ${targetModule} manually completed for token ${token.substring(0, 15)}...`)

    // Notify school admin/facilitator
    try {
      await notifyEducationAdmin({
        campaignId: participantToken.campaign_id,
        participantName: participantLabel,
        assessmentType: `Education Assessment (${targetModule.replace(/_/g, ' ')})`,
        dashboardPath: '/dashboard/education',
      })
    } catch (notifyErr) {
      console.error('[education/complete] Failed to send completion notification:', notifyErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Module marked as complete',
    })
  } catch (error) {
    console.error('[education/complete] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
