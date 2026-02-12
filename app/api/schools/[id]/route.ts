import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/schools/[id]
 * Get a specific school by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch school (RLS will ensure user can only see their org's schools)
    const { data: school, error } = await supabase
      .from('schools')
      .select(`
        *,
        campaigns:campaigns(
          id,
          name,
          campaign_type,
          status,
          created_at
        )
      `)
      .eq('id', id)
      .single()

    if (error || !school) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ school })

  } catch (error) {
    console.error('School fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/schools/[id]
 * Update a school
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const canManageSchools =
      profile?.role === 'owner' ||
      profile?.role === 'admin' ||
      (profile?.permissions as Record<string, Record<string, boolean>>)?.education?.manage_schools

    if (!canManageSchools) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify school belongs to user's organization
    const { data: existingSchool } = await supabase
      .from('schools')
      .select('id, organization_id')
      .eq('id', id)
      .single()

    if (!existingSchool || existingSchool.organization_id !== profile?.organization_id) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const allowedFields = [
      'name',
      'country',
      'region',
      'curriculum',
      'student_count_range',
      'primary_contact_name',
      'primary_contact_email',
      'safeguarding_lead_email',
      'safeguarding_lead_phone',
      'safeguarding_protocol',
      'is_active'
    ]

    // Filter to only allowed fields
    const updateData: Record<string, unknown> = {}
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update school
    // @ts-ignore - schools table not yet in generated types
    const { data: school, error } = await supabaseAdmin
      .from('schools')
      // @ts-ignore - schools table not yet in generated types
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('School update error:', error)
      return NextResponse.json(
        { error: 'Failed to update school' },
        { status: 500 }
      )
    }

    return NextResponse.json({ school })

  } catch (error) {
    console.error('School update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/schools/[id]
 * Delete a school (soft delete by setting is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check user has permission (only owners/admins can delete)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'owner' && profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can delete schools' },
        { status: 403 }
      )
    }

    // Verify school belongs to user's organization
    const { data: existingSchool } = await supabase
      .from('schools')
      .select('id, organization_id')
      .eq('id', id)
      .single()

    if (!existingSchool || existingSchool.organization_id !== profile?.organization_id) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      )
    }

    // Soft delete (set is_active = false)
    // @ts-ignore - schools table not yet in generated types
    const { error } = await supabaseAdmin
      .from('schools')
      // @ts-ignore - schools table not yet in generated types
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('School deletion error:', error)
      return NextResponse.json(
        { error: 'Failed to delete school' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('School deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
