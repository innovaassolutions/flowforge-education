import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/campaigns
 * List all education campaigns for the user's organization
 */
export async function GET() {
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

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'User not associated with an organization' },
        { status: 403 }
      )
    }

    // Get schools for this organization
    // @ts-ignore - schools table not yet in generated types
    const { data: schools } = await supabase
      .from('schools')
      .select('id')
      .eq('organization_id', profile.organization_id)

    if (!schools || schools.length === 0) {
      return NextResponse.json({ campaigns: [] })
    }

    const schoolIds = schools.map((s: { id: string }) => s.id)

    // Fetch education campaigns for organization's schools
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select(`
        id,
        name,
        campaign_type,
        status,
        description,
        school_id,
        education_config,
        created_at,
        schools:school_id(id, name, code)
      `)
      .in('school_id', schoolIds)
      .in('campaign_type', ['education_pilot', 'education_annual'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Campaigns fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      )
    }

    return NextResponse.json({ campaigns })

  } catch (error) {
    console.error('Campaigns list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns
 * Create a new education campaign
 */
export async function POST(request: NextRequest) {
  console.log('🚀 POST /api/campaigns - Request received')

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

    // Get user's organization, permissions, and profile info for facilitator fields
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('organization_id, role, permissions, full_name, email, user_type')
      .eq('id', user.id)
      .single()

    console.log('📋 Profile lookup:', {
      userId: user.id,
      userEmail: user.email,
      profile,
      profileError,
      hasOrgId: !!profile?.organization_id
    })

    if (profileError) {
      console.error('❌ Profile query error:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError.message },
        { status: 500 }
      )
    }

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'User not associated with an organization' },
        { status: 403 }
      )
    }

    // Get user email from auth if not in profile - ensure non-empty values
    const facilitatorEmail = profile.email || user.email || 'education@innovaas.co'
    const facilitatorName = profile.full_name || user.email?.split('@')[0] || 'Education Facilitator'

    console.log('👤 Facilitator info:', { facilitatorEmail, facilitatorName })

    // Check permission - platform admins, org owners/admins, or users with manage_campaigns permission
    const isPlatformAdmin = profile.user_type === 'admin'
    const canManageCampaigns =
      isPlatformAdmin ||
      profile.role === 'owner' ||
      profile.role === 'admin' ||
      (profile.permissions as Record<string, Record<string, boolean>>)?.education?.manage_campaigns

    console.log('🔐 Permission check:', {
      isPlatformAdmin,
      role: profile.role,
      userType: profile.user_type,
      canManageCampaigns
    })

    if (!canManageCampaigns) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create campaigns' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      school_id,
      campaign_type = 'education_pilot',
      description,
      education_config
    } = body

    // Validate required fields
    if (!name || !school_id) {
      return NextResponse.json(
        { error: 'Name and school are required' },
        { status: 400 }
      )
    }

    // Verify school belongs to user's organization
    // @ts-ignore - schools table not yet in generated types
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, organization_id')
      .eq('id', school_id)
      .eq('organization_id', profile.organization_id)
      .single()

    if (schoolError || !school) {
      return NextResponse.json(
        { error: 'School not found or access denied' },
        { status: 404 }
      )
    }

    // Build default education config if not provided
    const defaultEducationConfig = {
      pilot_type: campaign_type === 'education_annual' ? 'annual' : '14_day_pilot',
      modules: ['student_wellbeing'],
      cohorts: {
        students: {
          year_bands: [],
          divisions: [],
          target_sample_size: 50
        },
        teachers: {
          divisions: [],
          role_categories: [],
          target_sample_size: 20
        },
        parents: {
          year_bands: [],
          target_sample_size: 30
        },
        leadership: {
          roles: [],
          target_sample_size: 5
        }
      },
      anonymity: {
        access_code_prefix: 'PILOT',
        escrow_model: 'school_held',
        minimum_cohort_size: 5
      },
      safeguarding: {
        break_glass_enabled: true,
        alert_channels: ['portal'],
        escalation_timeout_hours: 4
      }
    }

    const finalEducationConfig = education_config || defaultEducationConfig

    console.log('📦 Creating education campaign:', {
      name,
      campaign_type,
      school_id,
      school_name: (school as { name: string }).name,
      organization_id: profile.organization_id,
      facilitator_name: facilitatorName,
      facilitator_email: facilitatorEmail,
      created_by: user.id,
      hasEducationConfig: !!finalEducationConfig,
      modules: finalEducationConfig.modules,
      hasCohorts: !!finalEducationConfig.cohorts
    })

    // Create campaign using admin client (bypasses RLS for insert)
    const { data: campaign, error: createError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        name,
        campaign_type,
        organization_id: profile.organization_id, // Required field
        company_name: (school as { name: string }).name, // Legacy field for compatibility
        facilitator_name: facilitatorName, // Required field
        facilitator_email: facilitatorEmail, // Required field
        school_id,
        description,
        education_config: finalEducationConfig,
        status: 'active',
        created_by: user.id
      } as any)
      .select(`
        id,
        name,
        campaign_type,
        status,
        description,
        school_id,
        education_config,
        created_at
      `)
      .single() as any

    if (createError) {
      console.error('❌ Campaign creation error:', {
        error: createError,
        code: createError.code,
        message: createError.message,
        details: createError.details,
        hint: createError.hint
      })
      return NextResponse.json(
        { error: 'Failed to create campaign', details: createError.message },
        { status: 500 }
      )
    }

    console.log('✅ Education campaign created:', {
      campaignId: campaign?.id,
      campaignName: campaign?.name
    })

    return NextResponse.json({ campaign }, { status: 201 })

  } catch (error) {
    console.error('❌ Campaign creation catch error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
