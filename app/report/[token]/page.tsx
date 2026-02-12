/**
 * Education Report Landing Page
 *
 * Public page for viewing education synthesis reports via secure access token.
 * No authentication required - security through cryptographic token (256-bit).
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Story: 2.4 - Longitudinal Comparison & Safeguarding Notifications
 * Epic: 2 - Education Synthesis Reports
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isValidTokenFormat } from '@/lib/utils/token-generator';
import ReportDashboard from '@/components/education/report/ReportDashboard';
import {
  EducationSynthesisResult,
  generateLongitudinalComparison,
  LongitudinalComparisonResult,
} from '@/lib/agents/education-synthesis-agent';

interface ReportPageProps {
  params: Promise<{ token: string }>;
}

interface ReportData {
  id: string;
  school: {
    id: string;
    name: string;
    code: string;
    country: string | null;
    curriculum: string | null;
  };
  campaign: {
    id: string;
    name: string;
    description: string | null;
  };
  module: string;
  synthesis: EducationSynthesisResult;
  has_safeguarding_signals: boolean;
  generated_at: string;
  report_created_at: string;
  longitudinal: LongitudinalComparisonResult | null;
}

async function getReportData(token: string): Promise<ReportData | null> {
  // Validate token format
  if (!token || !isValidTokenFormat(token)) {
    return null;
  }

  const supabase = await createClient();

  // Query education_reports with access token
  const { data: report, error: reportError } = await supabase
    .from('education_reports')
    .select(`
      id,
      synthesis_id,
      school_id,
      is_active,
      has_safeguarding_signals,
      access_count,
      last_accessed_at,
      created_at
    `)
    .eq('access_token', token)
    .eq('is_active', true)
    .single();

  if (reportError || !report) {
    return null;
  }

  // Fetch the synthesis content
  const { data: synthesis, error: synthesisError } = await supabase
    .from('education_synthesis')
    .select(`
      id,
      campaign_id,
      school_id,
      module,
      content,
      generated_at
    `)
    .eq('id', report.synthesis_id)
    .single();

  if (synthesisError || !synthesis) {
    return null;
  }

  // Fetch school information
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

  // Increment access count (non-blocking, fire-and-forget)
  // Using an async IIFE to handle the update without blocking the response
  (async () => {
    try {
      await supabase
        .from('education_reports')
        .update({
          access_count: (report.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', report.id);
    } catch (err) {
      console.error('Failed to update access count:', err);
    }
  })();

  // Fetch longitudinal comparison data
  let longitudinalData: LongitudinalComparisonResult | null = null;
  try {
    longitudinalData = await generateLongitudinalComparison(
      report.school_id,
      synthesis.module
    );
  } catch (err) {
    console.error('Failed to fetch longitudinal data:', err);
    // Non-blocking - continue without longitudinal data
  }

  return {
    id: report.id,
    school: {
      id: school?.id || '',
      name: school?.name || 'Unknown School',
      code: school?.code || '',
      country: school?.country || null,
      curriculum: school?.curriculum || null,
    },
    campaign: {
      id: campaign?.id || '',
      name: campaign?.name || 'Assessment Report',
      description: campaign?.description || null,
    },
    module: synthesis.module,
    synthesis: synthesis.content as EducationSynthesisResult,
    has_safeguarding_signals: report.has_safeguarding_signals || false,
    generated_at: synthesis.generated_at,
    report_created_at: report.created_at,
    longitudinal: longitudinalData,
  };
}

export async function generateMetadata({
  params,
}: ReportPageProps): Promise<Metadata> {
  const { token } = await params;
  const reportData = await getReportData(token);

  if (!reportData) {
    return {
      title: 'Report Not Found',
      description: 'The requested report could not be found.',
    };
  }

  const moduleName = reportData.module
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${reportData.school.name} - ${moduleName} Report`,
    description: `${reportData.campaign.name} assessment report for ${reportData.school.name}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function EducationReportPage({ params }: ReportPageProps) {
  const { token } = await params;
  const reportData = await getReportData(token);

  if (!reportData) {
    notFound();
  }

  return (
    <ReportDashboard
      school={reportData.school}
      campaign={reportData.campaign}
      module={reportData.module}
      synthesis={reportData.synthesis}
      hasSafeguardingSignals={reportData.has_safeguarding_signals}
      generatedAt={reportData.generated_at}
      longitudinalData={reportData.longitudinal}
      accessToken={token}
    />
  );
}
