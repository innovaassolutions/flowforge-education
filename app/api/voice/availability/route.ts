import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { checkVoiceAvailability, getVoiceConfigForSession } from '@/lib/services/voice-availability'

/**
 * GET /api/voice/availability
 * Check if voice mode is available for a session
 *
 * Query params:
 * - sessionToken: string (for education/anonymous sessions)
 * - vertical: string (for authenticated users)
 * - organizationId: string (for authenticated users)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.nextUrl.searchParams.get('sessionToken')

    // Education session flow - uses participant token
    if (sessionToken) {
      const availability = await getVoiceConfigForSession(sessionToken)
      return NextResponse.json(availability)
    }

    // Authenticated user flow
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const verticalKey =
      request.nextUrl.searchParams.get('vertical') || 'education'
    const organizationId = request.nextUrl.searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    const availability = await checkVoiceAvailability({
      userId: user.id,
      organizationId,
      verticalKey,
    })

    return NextResponse.json(availability)
  } catch (error) {
    console.error('Voice availability check error:', error)
    return NextResponse.json(
      { error: 'Failed to check voice availability' },
      { status: 500 }
    )
  }
}
