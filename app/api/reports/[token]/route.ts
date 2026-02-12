/**
 * Education Report Access API Endpoint
 *
 * GET /api/reports/[token]
 *
 * Public endpoint for accessing education reports via secure access token.
 * No authentication required - security through cryptographic token (256-bit).
 *
 * Story: 2.1 - Database & API Foundation
 * Epic: 2 - Education Synthesis Reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidTokenFormat } from '@/lib/utils/token-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: accessToken } = await params;

    // Validate token format (43 base64url characters)
    if (!accessToken || !isValidTokenFormat(accessToken)) {
      return NextResponse.json(
        { error: 'Invalid access token format' },
        { status: 400 }
      );
    }

    // Initialize Supabase client (public access, no auth required)
    const supabase = await createClient();

    // Query education_reports with access token
    // RLS policy "Public token access for active education reports" allows this
    const { data: report, error: reportError } = await supabase
      .from('education_reports')
      .select(
        `
        id,
        synthesis_id,
        school_id,
        is_active,
        has_safeguarding_signals,
        access_count,
        last_accessed_at,
        created_at
      `
      )
      .eq('access_token', accessToken)
      .eq('is_active', true)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        {
          error: 'Report not found or access denied',
          details:
            'This report may have been deactivated or the access token is invalid',
        },
        { status: 404 }
      );
    }

    // Fetch the synthesis content
    const { data: synthesis, error: synthesisError } = await supabase
      .from('education_synthesis')
      .select(
        `
        id,
        campaign_id,
        school_id,
        module,
        content,
        model_used,
        generated_at,
        created_at
      `
      )
      .eq('id', report.synthesis_id)
      .single();

    if (synthesisError || !synthesis) {
      return NextResponse.json(
        { error: 'Synthesis data not found' },
        { status: 404 }
      );
    }

    // Fetch school information for report header
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, code, country, curriculum')
      .eq('id', report.school_id)
      .single();

    // Fetch campaign info
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, description')
      .eq('id', synthesis.campaign_id)
      .single();

    // Increment access count and update last_accessed_at
    // This runs as a separate operation and doesn't block the response
    const { error: updateError } = await supabase
      .from('education_reports')
      .update({
        access_count: report.access_count ? report.access_count + 1 : 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', report.id);

    // Log error but don't fail request if tracking update fails
    if (updateError) {
      console.error('Failed to update access tracking:', updateError);
    }

    // Parse synthesis content
    const synthesisContent = synthesis.content as Record<string, unknown>;

    // Return full report data
    return NextResponse.json(
      {
        success: true,
        report: {
          id: report.id,
          school: {
            id: school?.id,
            name: school?.name,
            code: school?.code,
            country: school?.country,
            curriculum: school?.curriculum,
          },
          campaign: {
            id: campaign?.id,
            name: campaign?.name,
            description: campaign?.description,
          },
          module: synthesis.module,
          synthesis: synthesisContent,
          has_safeguarding_signals: report.has_safeguarding_signals,
          generated_at: synthesis.generated_at,
          report_created_at: report.created_at,
          access_count: (report.access_count || 0) + 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Report access error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
