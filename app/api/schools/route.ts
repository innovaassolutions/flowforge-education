import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/schools
 * List all schools for the user's organization
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

    // Fetch schools for organization
    const { data: schools, error } = await supabase
      .from('schools')
      .select(`
        id,
        name,
        code,
        country,
        region,
        curriculum,
        student_count_range,
        primary_contact_name,
        primary_contact_email,
        safeguarding_protocol,
        is_active,
        created_at
      `)
      .eq('organization_id', profile.organization_id)
      .order('name', { ascending: true })

    if (error) {
      console.error('Schools fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch schools' },
        { status: 500 }
      )
    }

    return NextResponse.json({ schools })

  } catch (error) {
    console.error('Schools list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/schools
 * Create a new school
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

    // Get user's organization and permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, role, permissions')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: 'User not associated with an organization' },
        { status: 403 }
      )
    }

    // Check permission (owners, admins, or users with manage_schools permission)
    const canManageSchools =
      profile.role === 'owner' ||
      profile.role === 'admin' ||
      (profile.permissions as Record<string, Record<string, boolean>>)?.education?.manage_schools

    if (!canManageSchools) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create schools' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      country,
      region,
      curriculum,
      student_count_range,
      primary_contact_name,
      primary_contact_email,
      safeguarding_lead_email,
      safeguarding_lead_phone,
      safeguarding_protocol = 'standard'
    } = body

    // Validate required fields
    if (!name || !country) {
      return NextResponse.json(
        { error: 'Name and country are required' },
        { status: 400 }
      )
    }

    // Generate unique school code
    const codePrefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
    const codeSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const code = `${codePrefix}-${codeSuffix}`

    // Create school using admin client (bypasses RLS for insert)
    // @ts-ignore - schools table not yet in generated types
    const { data: school, error } = await supabaseAdmin
      .from('schools')
      // @ts-ignore - schools table not yet in generated types
      .insert({
        organization_id: profile.organization_id,
        name,
        code,
        country,
        region,
        curriculum,
        student_count_range,
        primary_contact_name,
        primary_contact_email,
        safeguarding_lead_email,
        safeguarding_lead_phone,
        safeguarding_protocol
      })
      .select()
      .single()

    if (error) {
      console.error('School creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create school', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ school }, { status: 201 })

  } catch (error) {
    console.error('School creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
