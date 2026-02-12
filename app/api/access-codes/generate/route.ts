import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

interface CodeGenerationRequest {
  school_id: string
  campaign_id: string
  participant_type: 'student' | 'teacher' | 'parent' | 'leadership'
  cohort_metadata: {
    year_band?: string
    division?: string
    role_category?: string
    relationship_type?: string
  }
  quantity: number
  expires_in_days?: number
}

/**
 * POST /api/access-codes/generate
 * Generate bulk access codes for education participants
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check user has permission
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, role, permissions')
      .eq('id', user.id)
      .single()

    const canGenerateCodes =
      profile?.role === 'owner' ||
      profile?.role === 'admin' ||
      (profile?.permissions as Record<string, Record<string, boolean>>)?.education?.generate_access_codes

    if (!canGenerateCodes) {
      return NextResponse.json(
        { error: 'Insufficient permissions to generate access codes' },
        { status: 403 }
      )
    }

    const body: CodeGenerationRequest = await request.json()
    const {
      school_id,
      campaign_id,
      participant_type,
      cohort_metadata,
      quantity,
      expires_in_days = 30
    } = body

    // Validate required fields
    if (!school_id || !campaign_id || !participant_type || !quantity) {
      return NextResponse.json(
        { error: 'school_id, campaign_id, participant_type, and quantity are required' },
        { status: 400 }
      )
    }

    // Validate quantity
    if (quantity < 1 || quantity > 500) {
      return NextResponse.json(
        { error: 'Quantity must be between 1 and 500' },
        { status: 400 }
      )
    }

    // Verify school belongs to user's organization
    const { data: school } = await supabase
      .from('schools')
      .select('id, organization_id, name')
      .eq('id', school_id)
      .single()

    if (!school || school.organization_id !== profile?.organization_id) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      )
    }

    // Verify campaign exists and is an education campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, campaign_type, school_id')
      .eq('id', campaign_id)
      .single()

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.school_id !== school_id) {
      return NextResponse.json(
        { error: 'Campaign does not belong to this school' },
        { status: 400 }
      )
    }

    // Generate codes using the database function
    const codes: { code: string; expires_at: string }[] = []
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_in_days)

    // Build code prefix based on participant type and cohort
    const typePrefix = {
      student: 'STU',
      teacher: 'TCH',
      parent: 'PAR',
      leadership: 'LDR'
    }[participant_type]

    const cohortSuffix = cohort_metadata.year_band
      ? `-Y${cohort_metadata.year_band}`
      : cohort_metadata.role_category
        ? `-${cohort_metadata.role_category.substring(0, 3).toUpperCase()}`
        : ''

    // Generate codes in batch
    for (let i = 0; i < quantity; i++) {
      // Generate random alphanumeric code
      const randomPart = generateRandomCode(6)
      const code = `PILOT-${typePrefix}${cohortSuffix}-${randomPart}`

      codes.push({
        code,
        expires_at: expiresAt.toISOString()
      })
    }

    // Insert all codes
    const insertData = codes.map(c => ({
      school_id,
      campaign_id,
      code: c.code,
      participant_type,
      cohort_metadata,
      expires_at: c.expires_at,
      created_by: user.id
    }))

    // @ts-ignore - education_access_codes table not yet in generated types
    const { data: insertedCodes, error: insertError } = await supabaseAdmin
      .from('education_access_codes')
      // @ts-ignore - education_access_codes table not yet in generated types
      .insert(insertData)
      .select('id, code, expires_at')

    if (insertError) {
      console.error('Code generation error:', insertError)
      return NextResponse.json(
        { error: 'Failed to generate access codes', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      codes: insertedCodes,
      summary: {
        total_generated: insertedCodes?.length || 0,
        participant_type,
        cohort_metadata,
        expires_at: expiresAt.toISOString(),
        school_name: school.name,
        campaign_name: campaign.name
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Code generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate a random alphanumeric code
 */
function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding I, O, 0, 1 for clarity
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
