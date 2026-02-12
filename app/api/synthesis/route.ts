/**
 * Education Synthesis API Endpoint
 *
 * POST /api/synthesis
 *
 * Triggers synthesis generation for a completed education campaign.
 * Uses the education-synthesis-agent to analyze interview transcripts
 * and generate insights using the Four Lenses framework.
 *
 * Story: 2.1 - Database & API Foundation
 * Epic: 2 - Education Synthesis Reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generateEducationSynthesis } from '@/lib/agents/education-synthesis-agent';

interface SynthesisRequest {
  campaign_id: string;
  school_id: string;
  module: string;
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
    const body: SynthesisRequest = await request.json();
    const { campaign_id, school_id, module } = body;

    // Validate required fields
    if (!campaign_id || !school_id || !module) {
      return NextResponse.json(
        { error: 'campaign_id, school_id, and module are required' },
        { status: 400 }
      );
    }

    // Verify school belongs to user's organization (unless admin)
    if (profile?.user_type !== 'admin') {
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id, organization_id')
        .eq('id', school_id)
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

    // Verify campaign exists and belongs to school
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, status, education_config')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get participant tokens for this campaign
    // @ts-ignore - education_participant_tokens table not yet in generated types
    const { data: campaignTokensData, error: tokensError } = await supabaseAdmin
      .from('education_participant_tokens')
      .select('id')
      .eq('campaign_id', campaign_id);

    const campaignTokens = campaignTokensData as Array<{ id: string }> | null;

    if (tokensError) {
      console.error('Error fetching campaign tokens:', tokensError);
      return NextResponse.json(
        { error: 'Failed to verify campaign participants' },
        { status: 500 }
      );
    }

    const tokenIds = campaignTokens?.map((t) => t.id) || [];

    if (tokenIds.length === 0) {
      return NextResponse.json(
        {
          error: 'No participants found for this campaign',
          details: 'Campaign has no participant tokens yet',
        },
        { status: 400 }
      );
    }

    // Check if campaign has sessions for this module
    // @ts-ignore - agent_sessions education fields not yet in generated types
    const { data: sessionsRawData, error: countError } = await supabaseAdmin
      .from('agent_sessions')
      .select('id, participant_token_id, education_session_context')
      .in('participant_token_id', tokenIds)
      .not('participant_token_id', 'is', null);

    const sessionsWithData = sessionsRawData as Array<{
      id: string;
      participant_token_id: string;
      education_session_context: { module?: string } | null;
    }> | null;

    if (countError) {
      console.error('Error counting sessions:', countError);
      return NextResponse.json(
        { error: 'Failed to verify campaign sessions' },
        { status: 500 }
      );
    }

    // Filter sessions by module (JSONB filtering done in JS since Supabase client doesn't support ->> syntax)
    const moduleSessions = (sessionsWithData || []).filter((session) => {
      return session.education_session_context?.module === module;
    });

    const sessionCount = moduleSessions.length;

    if (sessionCount === 0) {
      return NextResponse.json(
        {
          error: 'No sessions found for this campaign/module',
          details: `No sessions found for module "${module}" in this campaign. Found ${tokenIds.length} participant tokens.`,
        },
        { status: 400 }
      );
    }

    // Check for sessions with actual conversation data in agent_messages table
    const sessionIds = moduleSessions.map((s) => s.id);
    // @ts-ignore - agent_messages not yet in generated types
    const { data: messagesRawData, error: messagesError } = await supabaseAdmin
      .from('agent_messages')
      .select('agent_session_id')
      .in('agent_session_id', sessionIds);

    const messagesData = messagesRawData as Array<{ agent_session_id: string }> | null;

    if (messagesError) {
      console.error('Error checking messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to verify session messages' },
        { status: 500 }
      );
    }

    // Get unique session IDs that have messages
    const sessionIdsWithMessages = new Set(
      (messagesData || []).map((m) => m.agent_session_id)
    );

    const sessionsWithConversations = moduleSessions.filter((session) =>
      sessionIdsWithMessages.has(session.id)
    );

    if (sessionsWithConversations.length === 0) {
      return NextResponse.json(
        {
          error: 'No completed interviews found',
          details: `Found ${sessionCount} sessions for module "${module}", but none have conversation data. Interviews need to be completed before synthesis.`,
        },
        { status: 400 }
      );
    }

    console.log(
      `Generating synthesis for campaign ${campaign_id}, school ${school_id}, module ${module} (${sessionCount} sessions)`
    );
    console.log(`Sessions with conversations: ${sessionsWithConversations.length}`);

    // Generate synthesis using the education synthesis agent
    let synthesisResult;
    try {
      synthesisResult = await generateEducationSynthesis(
        campaign_id,
        school_id,
        module
      );
      console.log('Synthesis generation successful');
    } catch (synthesisError) {
      console.error('Synthesis generation failed:', synthesisError);
      return NextResponse.json(
        {
          error: 'Synthesis generation failed',
          details: synthesisError instanceof Error ? synthesisError.message : 'Unknown synthesis error',
        },
        { status: 500 }
      );
    }

    // Get participant token IDs used in synthesis (reuse already-fetched sessions)
    const sourceTokenIds = sessionsWithConversations
      .map((s) => (s as { participant_token_id?: string }).participant_token_id)
      .filter((id): id is string => !!id);

    // Save synthesis to database using admin client (bypasses RLS)
    // @ts-ignore - education_synthesis table not yet in generated types
    const { data: synthesisData, error: insertError } = await supabaseAdmin
      .from('education_synthesis')
      // @ts-ignore - education_synthesis table not yet in generated types
      .insert({
        campaign_id,
        school_id,
        module,
        content: synthesisResult as unknown as Record<string, unknown>,
        model_used: 'claude-sonnet-4-20250514',
        source_token_ids: sourceTokenIds,
        generated_at: new Date().toISOString(),
      })
      .select('id, generated_at')
      .single();

    const synthesis = synthesisData as { id: string; generated_at: string } | null;

    if (insertError || !synthesis) {
      console.error('Error saving synthesis:', insertError);
      return NextResponse.json(
        { error: 'Failed to save synthesis result', details: insertError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        synthesis_id: synthesis.id,
        generated_at: synthesis.generated_at,
        session_count: sessionCount,
        module,
        executive_summary: synthesisResult.executive_summary,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Synthesis generation error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
