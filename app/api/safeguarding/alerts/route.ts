import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * GET /api/safeguarding/alerts
 * List safeguarding alerts for the user's schools
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

    const canViewAlerts =
      profile?.role === 'owner' ||
      profile?.role === 'admin' ||
      (profile?.permissions as Record<string, Record<string, boolean>>)?.education?.view_safeguarding_alerts

    if (!canViewAlerts) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view safeguarding alerts' },
        { status: 403 }
      )
    }

    // Get query parameters
    const url = new URL(request.url)
    const schoolId = url.searchParams.get('school_id')
    const status = url.searchParams.get('status') // pending, sent, acknowledged, resolved
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build query
    // @ts-ignore - education_safeguarding_alerts table not yet in generated types
    let query = supabaseAdmin
      .from('education_safeguarding_alerts')
      .select(`
        id,
        participant_token,
        participant_type,
        cohort_metadata,
        trigger_type,
        trigger_confidence,
        detected_at,
        alert_status,
        alert_sent_at,
        alert_channel,
        acknowledged_at,
        acknowledged_by_role,
        resolved_at,
        resolution_type,
        schools:school_id(id, name),
        campaigns:campaign_id(id, name)
      `, { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by school if specified
    if (schoolId) {
      query = query.eq('school_id', schoolId)
    } else {
      // Get all schools for this organization
      const { data: schools } = await supabase
        .from('schools')
        .select('id')
        .eq('organization_id', profile?.organization_id)

      if (schools && schools.length > 0) {
        const schoolIds = schools.map(s => s.id)
        query = query.in('school_id', schoolIds)
      } else {
        // No schools, return empty
        return NextResponse.json({
          alerts: [],
          pagination: { total: 0, limit, offset }
        })
      }
    }

    // Filter by status if specified
    if (status) {
      query = query.eq('alert_status', status)
    }

    const { data: alertsData, error, count } = await query

    if (error) {
      console.error('Alerts fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      )
    }

    // Type assertion for alerts
    const alerts = alertsData as Array<{
      id: string
      participant_token: string
      participant_type: string
      cohort_metadata: Record<string, string>
      trigger_type: string
      trigger_confidence: number
      detected_at: string
      alert_status: string
      alert_sent_at: string | null
      alert_channel: string | null
      acknowledged_at: string | null
      acknowledged_by_role: string | null
      resolved_at: string | null
      resolution_type: string | null
      schools: { id: string; name: string }
      campaigns: { id: string; name: string }
    }> | null

    // Calculate summary stats
    const statusCounts: Record<string, number> = {}
    alerts?.forEach(alert => {
      const alertStatus = alert.alert_status
      statusCounts[alertStatus] = (statusCounts[alertStatus] || 0) + 1
    })

    return NextResponse.json({
      alerts,
      pagination: {
        total: count || 0,
        limit,
        offset
      },
      summary: {
        by_status: statusCounts,
        urgent: alerts?.filter(a =>
          a.alert_status === 'pending' &&
          a.trigger_confidence >= 0.8
        ).length || 0
      }
    })

  } catch (error) {
    console.error('Alerts list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/safeguarding/alerts
 * Acknowledge or resolve an alert
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

    const canAcknowledge =
      profile?.role === 'owner' ||
      profile?.role === 'admin' ||
      (profile?.permissions as Record<string, Record<string, boolean>>)?.education?.acknowledge_safeguarding_alerts

    if (!canAcknowledge) {
      return NextResponse.json(
        { error: 'Insufficient permissions to acknowledge alerts' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { alert_id, action, role_title, notes, resolution_type } = body

    if (!alert_id || !action) {
      return NextResponse.json(
        { error: 'alert_id and action are required' },
        { status: 400 }
      )
    }

    // Verify alert belongs to user's organization
    // @ts-ignore - education_safeguarding_alerts table not yet in generated types
    const { data: alertData } = await supabaseAdmin
      .from('education_safeguarding_alerts')
      .select('id, school_id, schools:school_id(organization_id)')
      .eq('id', alert_id)
      .single()

    // Type assertion for alert
    const alert = alertData as {
      id: string
      school_id: string
      schools: { organization_id: string }
    } | null

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    const school = alert.schools
    if (school?.organization_id !== profile?.organization_id) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    // Perform action
    if (action === 'acknowledge') {
      // @ts-ignore - acknowledge_alert function not yet in generated types
      await supabaseAdmin.rpc('acknowledge_alert', {
        input_alert_id: alert_id,
        input_acknowledged_by_role: role_title || profile?.role,
        input_notes: notes
      })
    } else if (action === 'resolve') {
      if (!resolution_type) {
        return NextResponse.json(
          { error: 'resolution_type is required for resolve action' },
          { status: 400 }
        )
      }

      // @ts-ignore - resolve_alert function not yet in generated types
      await supabaseAdmin.rpc('resolve_alert', {
        input_alert_id: alert_id,
        input_resolved_by_role: role_title || profile?.role,
        input_resolution_type: resolution_type,
        input_notes: notes
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "acknowledge" or "resolve"' },
        { status: 400 }
      )
    }

    // Fetch updated alert
    // @ts-ignore - education_safeguarding_alerts table not yet in generated types
    const { data: updatedAlert } = await supabaseAdmin
      .from('education_safeguarding_alerts')
      .select('*')
      .eq('id', alert_id)
      .single()

    return NextResponse.json({
      success: true,
      alert: updatedAlert
    })

  } catch (error) {
    console.error('Alert update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
