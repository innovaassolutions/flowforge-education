import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/access-codes
 * List access codes with optional filtering
 */
export async function GET(request: NextRequest) {
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

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const school_id = searchParams.get('school_id')
    const campaign_id = searchParams.get('campaign_id')
    const status = searchParams.get('status')
    const participant_type = searchParams.get('participant_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query - get schools in user's organization first
    const { data: userSchools } = await supabase
      .from('schools')
      .select('id')
      .eq('organization_id', profile.organization_id)

    const schoolIds = userSchools?.map(s => s.id) || []

    if (schoolIds.length === 0) {
      return NextResponse.json({
        codes: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        },
        summary: {
          total: 0,
          by_status: {},
          by_type: {}
        }
      })
    }

    // Build base query
    // @ts-ignore - education_access_codes table not yet in generated types
    let query = supabaseAdmin
      .from('education_access_codes')
      .select(`
        id,
        code,
        participant_type,
        cohort_metadata,
        status,
        redeemed_at,
        expires_at,
        created_at,
        school_id,
        campaign_id,
        schools:school_id(name, code),
        campaigns:campaign_id(name)
      `, { count: 'exact' })
      .in('school_id', schoolIds)
      .order('created_at', { ascending: false })

    // Apply filters
    if (school_id) {
      query = query.eq('school_id', school_id)
    }
    if (campaign_id) {
      query = query.eq('campaign_id', campaign_id)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (participant_type) {
      query = query.eq('participant_type', participant_type)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: codes, error: queryError, count } = await query

    if (queryError) {
      console.error('Error fetching access codes:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch access codes' },
        { status: 500 }
      )
    }

    // Get summary statistics
    // @ts-ignore - education_access_codes table not yet in generated types
    let summaryQuery = supabaseAdmin
      .from('education_access_codes')
      .select('id, status, participant_type')
      .in('school_id', schoolIds)

    if (school_id) {
      summaryQuery = summaryQuery.eq('school_id', school_id)
    }
    if (campaign_id) {
      summaryQuery = summaryQuery.eq('campaign_id', campaign_id)
    }

    const { data: summaryData } = await summaryQuery

    // Type assertion for summary data
    const typedSummaryData = summaryData as Array<{ id: string; status: string; participant_type: string }> | null

    const summary = {
      total: typedSummaryData?.length || 0,
      by_status: {} as Record<string, number>,
      by_type: {} as Record<string, number>
    }

    typedSummaryData?.forEach(code => {
      summary.by_status[code.status] = (summary.by_status[code.status] || 0) + 1
      summary.by_type[code.participant_type] = (summary.by_type[code.participant_type] || 0) + 1
    })

    return NextResponse.json({
      codes,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary
    })

  } catch (error) {
    console.error('Access codes list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/access-codes
 * Update access code status (e.g., revoke)
 */
export async function PATCH(request: NextRequest) {
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

    const canManageCodes =
      profile?.role === 'owner' ||
      profile?.role === 'admin' ||
      (profile?.permissions as Record<string, Record<string, boolean>>)?.education?.manage_access_codes

    if (!canManageCodes) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { code_ids, action } = body

    if (!code_ids || !Array.isArray(code_ids) || code_ids.length === 0) {
      return NextResponse.json(
        { error: 'code_ids array is required' },
        { status: 400 }
      )
    }

    if (!['revoke'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Supported: revoke' },
        { status: 400 }
      )
    }

    // Get schools in user's organization
    const { data: userSchools } = await supabase
      .from('schools')
      .select('id')
      .eq('organization_id', profile?.organization_id)

    const schoolIds = userSchools?.map(s => s.id) || []

    // Update codes
    // @ts-ignore - education_access_codes table not yet in generated types
    const { data: updatedCodes, error: updateError } = await supabaseAdmin
      .from('education_access_codes')
      // @ts-ignore - education_access_codes table not yet in generated types
      .update({ status: 'revoked' })
      .in('id', code_ids)
      .in('school_id', schoolIds)
      .eq('status', 'active') // Only revoke active codes
      .select('id')

    if (updateError) {
      console.error('Error revoking codes:', updateError)
      return NextResponse.json(
        { error: 'Failed to revoke codes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      revoked_count: updatedCodes?.length || 0
    })

  } catch (error) {
    console.error('Access code update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
