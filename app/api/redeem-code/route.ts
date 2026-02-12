import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * POST /api/redeem-code
 * Redeem an access code and receive a persistent participant token
 * This is a PUBLIC endpoint - no authentication required
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, school_code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Access code is required' },
        { status: 400 }
      )
    }

    // Normalize code (uppercase, trim) - keep dashes as they're part of the code format
    const normalizedCode = code.trim().toUpperCase()

    // Type for access code lookup result
    type AccessCodeResult = {
      id: string
      campaign_id: string
      school_id: string
      status: string
      expires_at: string | null
      schools: { code: string; name: string } | null
    }

    // First, look up the access code to get its campaign_id and school_id
    // @ts-ignore - education_access_codes table not yet in generated types
    const { data: accessCodeData, error: lookupError } = await supabaseAdmin
      .from('education_access_codes')
      .select(`
        id,
        campaign_id,
        school_id,
        status,
        expires_at,
        schools:school_id(code, name)
      `)
      .eq('code', normalizedCode)
      .single()

    const accessCode = accessCodeData as AccessCodeResult | null

    if (lookupError || !accessCode) {
      return NextResponse.json(
        { error: 'Invalid access code. Please check and try again.' },
        { status: 404 }
      )
    }

    // Validate school code if provided
    // This ensures participants can only redeem codes on their school's portal
    if (school_code) {
      const normalizedSchoolCode = school_code.trim().toUpperCase()
      const accessCodeSchool = accessCode.schools

      if (!accessCodeSchool) {
        return NextResponse.json(
          { error: 'This access code is not associated with a school.' },
          { status: 400 }
        )
      }

      if (accessCodeSchool.code.toUpperCase() !== normalizedSchoolCode) {
        return NextResponse.json(
          { error: 'This access code is not valid for this school portal.' },
          { status: 403 }
        )
      }
    }

    // Check if code is still valid
    if (accessCode.status === 'redeemed') {
      return NextResponse.json(
        { error: 'This access code has already been used.' },
        { status: 409 }
      )
    }

    if (accessCode.status === 'revoked') {
      return NextResponse.json(
        { error: 'This access code has been revoked. Please contact your school administrator.' },
        { status: 410 }
      )
    }

    if (accessCode.status === 'expired' || (accessCode.expires_at && new Date(accessCode.expires_at) < new Date())) {
      return NextResponse.json(
        { error: 'This access code has expired. Please contact your school administrator.' },
        { status: 410 }
      )
    }

    // Call the database function to redeem the code
    // @ts-ignore - redeem_access_code function not yet in generated types
    const { data, error } = await supabaseAdmin.rpc('redeem_access_code', {
      input_code: normalizedCode,
      input_campaign_id: accessCode.campaign_id
    })

    if (error) {
      console.error('Code redemption error:', error)

      // Parse specific error messages
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Invalid access code. Please check and try again.' },
          { status: 404 }
        )
      }
      if (error.message.includes('expired')) {
        return NextResponse.json(
          { error: 'This access code has expired. Please contact your school administrator.' },
          { status: 410 }
        )
      }
      if (error.message.includes('already been used')) {
        return NextResponse.json(
          { error: 'This access code has already been used.' },
          { status: 409 }
        )
      }
      if (error.message.includes('does not match')) {
        return NextResponse.json(
          { error: 'This code is not valid for this assessment.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to redeem access code' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 404 }
      )
    }

    // Get token details for response
    // @ts-ignore - education_participant_tokens table not yet in generated types
    const { data: tokenDetailsData } = await supabaseAdmin
      .from('education_participant_tokens')
      .select(`
        token,
        participant_type,
        cohort_metadata,
        school_id,
        campaign_id,
        schools:school_id(name)
      `)
      .eq('id', data)
      .single()

    // Type assertion for token details
    const tokenDetails = tokenDetailsData as {
      token: string
      participant_type: string
      cohort_metadata: Record<string, string>
      school_id: string
      campaign_id: string
      schools: { name: string }
    } | null

    if (!tokenDetails) {
      return NextResponse.json(
        { error: 'Token created but could not be retrieved' },
        { status: 500 }
      )
    }

    // Return the participant token
    // This token is used for all subsequent session access
    return NextResponse.json({
      success: true,
      token: tokenDetails.token,
      participant_type: tokenDetails.participant_type,
      cohort_metadata: tokenDetails.cohort_metadata,
      message: getWelcomeMessage(tokenDetails.participant_type)
    })

  } catch (error) {
    console.error('Code redemption error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get a friendly welcome message based on participant type
 */
function getWelcomeMessage(participantType: string): string {
  const messages: Record<string, string> = {
    student: 'Welcome! Your responses are completely anonymous. No one at school will know what you say.',
    teacher: 'Welcome! Your insights will help improve our school. Your responses are confidential.',
    parent: 'Welcome! Thank you for taking time to share your perspective. Your responses are confidential.',
    leadership: 'Welcome! Your strategic insights are valuable. Let\'s explore your perspective on school improvement.'
  }
  return messages[participantType] || 'Welcome! Thank you for participating.'
}
