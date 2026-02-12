/**
 * Education Reports API Endpoint
 *
 * POST /api/reports
 *
 * Creates a shareable report from an education synthesis.
 * Generates a secure access token and optionally notifies
 * safeguarding lead if signals are detected.
 *
 * Story: 2.1 - Database & API Foundation
 * Epic: 2 - Education Synthesis Reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  generateReportAccessToken,
  detectSafeguardingSignals,
  buildSafeguardingEmailContent,
  buildSafeguardingEmailText,
} from '@/lib/report/education-report-utils';
import { buildPublicUrl } from '@/lib/api-url';

interface CreateReportRequest {
  synthesis_id: string;
}

// Type for synthesis record (table not yet in generated types)
interface EducationSynthesisRecord {
  id: string;
  campaign_id: string;
  school_id: string;
  module: string;
  content: Record<string, unknown>;
  generated_at: string;
}

// Type for report record (table not yet in generated types)
interface EducationReportRecord {
  id: string;
  access_token: string;
  created_at: string;
}

// Type for school record
interface SchoolRecord {
  id: string;
  name: string;
  code: string;
  safeguarding_lead_email?: string;
  safeguarding_lead_name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization and permissions
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, role, permissions, user_type')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id && profile?.user_type !== 'admin') {
      return NextResponse.json(
        { error: 'User not associated with an organization' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: CreateReportRequest = await request.json();
    const { synthesis_id } = body;

    // Validate required fields
    if (!synthesis_id) {
      return NextResponse.json(
        { error: 'synthesis_id is required' },
        { status: 400 }
      );
    }

    // Fetch synthesis with content
    // @ts-ignore - education_synthesis table not yet in generated types
    const { data: synthesisData, error: synthesisError } = await supabaseAdmin
      .from('education_synthesis')
      .select('id, campaign_id, school_id, module, content, generated_at')
      .eq('id', synthesis_id)
      .single();

    const synthesis = synthesisData as EducationSynthesisRecord | null;

    if (synthesisError || !synthesis) {
      return NextResponse.json(
        { error: 'Synthesis not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this school (unless admin)
    if (profile?.user_type !== 'admin') {
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id, organization_id')
        .eq('id', synthesis.school_id)
        .single();

      if (schoolError || !school) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }

      if (school.organization_id !== profile?.organization_id) {
        return NextResponse.json(
          { error: 'Access denied - school belongs to different organization' },
          { status: 403 }
        );
      }
    }

    // Check if report already exists for this synthesis
    // @ts-ignore - education_reports table not yet in generated types
    const { data: existingReportData } = await supabaseAdmin
      .from('education_reports')
      .select('id, access_token')
      .eq('synthesis_id', synthesis_id)
      .single();

    const existingReport = existingReportData as { id: string; access_token: string } | null;

    if (existingReport) {
      // Return existing report info
      const reportUrl = buildPublicUrl(`/report/${existingReport.access_token}`);
      return NextResponse.json({
        success: true,
        report_id: existingReport.id,
        access_token: existingReport.access_token,
        report_url: reportUrl,
        message: 'Report already exists for this synthesis',
      });
    }

    // Generate secure access token
    const accessToken = generateReportAccessToken();

    // Detect safeguarding signals from synthesis content
    const synthesisContent = synthesis.content as Record<string, unknown>;
    const safeguardingSignals = detectSafeguardingSignals(synthesisContent);
    const hasSafeguardingSignals = safeguardingSignals > 0;

    // Create report record
    // @ts-ignore - education_reports table not yet in generated types
    const { data: reportData, error: insertError } = await supabaseAdmin
      .from('education_reports')
      // @ts-ignore - education_reports table not yet in generated types
      .insert({
        synthesis_id,
        school_id: synthesis.school_id,
        access_token: accessToken,
        is_active: true,
        has_safeguarding_signals: hasSafeguardingSignals,
        generated_by: user.id,
      })
      .select('id, access_token, created_at')
      .single();

    const report = reportData as EducationReportRecord | null;

    if (insertError || !report) {
      console.error('Error creating report:', insertError);
      return NextResponse.json(
        { error: 'Failed to create report', details: insertError?.message },
        { status: 500 }
      );
    }

    // Build report URL
    const reportUrl = buildPublicUrl(`/report/${accessToken}`);

    // Send safeguarding notification if signals detected
    let safeguardingNotificationSent = false;
    if (hasSafeguardingSignals) {
      try {
        // Fetch school with safeguarding lead info
        // @ts-ignore - schools table has fields not in types
        const { data: schoolData } = await supabaseAdmin
          .from('schools')
          .select('name, safeguarding_lead_email, safeguarding_lead_name')
          .eq('id', synthesis.school_id)
          .single();

        const school = schoolData as SchoolRecord | null;

        if (school?.safeguarding_lead_email) {
          // Import Resend dynamically to avoid issues if not configured
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);

          const safeguardingUrl = `${reportUrl}#safeguarding`;

          await resend.emails.send({
            from: 'FlowForge Safeguarding <noreply@innovaas.com>',
            to: school.safeguarding_lead_email,
            subject: `[Action Required] Safeguarding Signals Detected - ${school.name}`,
            html: buildSafeguardingEmailContent(
              school.name,
              school.safeguarding_lead_name || '',
              safeguardingSignals,
              safeguardingUrl
            ),
            text: buildSafeguardingEmailText(
              school.name,
              school.safeguarding_lead_name || '',
              safeguardingSignals,
              safeguardingUrl
            ),
          });

          // Update report with notification timestamp
          // @ts-ignore - education_reports table not yet in generated types
          await supabaseAdmin
            .from('education_reports')
            // @ts-ignore - education_reports table not yet in generated types
            .update({ safeguarding_notified_at: new Date().toISOString() })
            .eq('id', report.id);

          safeguardingNotificationSent = true;
          console.log(
            `Safeguarding notification sent to ${school.safeguarding_lead_email} for ${safeguardingSignals} signal(s)`
          );
        } else {
          console.warn(
            `No safeguarding lead configured for school ${synthesis.school_id}`
          );
        }
      } catch (emailError) {
        // Log but don't fail the request if email fails
        console.error('Failed to send safeguarding notification:', emailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        report_id: report.id,
        access_token: report.access_token,
        report_url: reportUrl,
        created_at: report.created_at,
        has_safeguarding_signals: hasSafeguardingSignals,
        safeguarding_signals_count: safeguardingSignals,
        safeguarding_notification_sent: safeguardingNotificationSent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Report creation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports
 *
 * List all education reports for the user's organization.
 * Supports optional filtering by campaign_id query parameter.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id, user_type')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id && profile?.user_type !== 'admin') {
      return NextResponse.json(
        { error: 'User not associated with an organization' },
        { status: 403 }
      );
    }

    // Build query for reports
    // @ts-ignore - education_reports table not yet in generated types
    let query = supabaseAdmin
      .from('education_reports')
      .select(
        `
        id,
        synthesis_id,
        school_id,
        access_token,
        is_active,
        has_safeguarding_signals,
        safeguarding_notified_at,
        access_count,
        last_accessed_at,
        created_at,
        education_synthesis (
          module,
          generated_at,
          campaign_id
        ),
        schools (
          name,
          code
        )
      `
      )
      .order('created_at', { ascending: false });

    // Non-admin users only see reports for their organization's schools
    if (profile?.user_type !== 'admin') {
      const { data: schoolIds } = await supabase
        .from('schools')
        .select('id')
        .eq('organization_id', profile.organization_id);

      if (schoolIds && schoolIds.length > 0) {
        query = query.in(
          'school_id',
          schoolIds.map((s) => s.id)
        );
      } else {
        return NextResponse.json({ success: true, reports: [] });
      }
    }

    const { data: reports, error } = await query;

    // Filter by campaign_id if provided (campaign_id is in the synthesis relation)
    let filteredReports: Array<Record<string, unknown>> | null = reports as Array<Record<string, unknown>> | null;
    if (campaignId && filteredReports) {
      filteredReports = filteredReports.filter((report) => {
        const synthesis = report.education_synthesis as { campaign_id?: string } | null;
        return synthesis?.campaign_id === campaignId;
      });
    }

    if (error) {
      console.error('Reports fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    // Transform response with safe type handling
    const transformedReports = (filteredReports as Array<Record<string, unknown>> | null)?.map((report) => {
      const synthesis = report.education_synthesis as { module?: string; generated_at?: string; campaign_id?: string } | null;
      const school = report.schools as { name?: string; code?: string } | null;

      return {
        id: report.id,
        synthesis_id: report.synthesis_id,
        school_id: report.school_id,
        school_name: school?.name,
        school_code: school?.code,
        module: synthesis?.module,
        campaign_id: synthesis?.campaign_id,
        access_token: report.access_token,
        report_url: buildPublicUrl(`/report/${report.access_token}`),
        is_active: report.is_active,
        has_safeguarding_signals: report.has_safeguarding_signals,
        safeguarding_notified_at: report.safeguarding_notified_at,
        access_count: report.access_count,
        last_accessed_at: report.last_accessed_at,
        created_at: report.created_at,
        synthesis_generated_at: synthesis?.generated_at,
      };
    });

    return NextResponse.json({ success: true, reports: transformedReports || [] });
  } catch (error) {
    console.error('Reports list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
