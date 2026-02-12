'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/api-url';
import { createClient } from '@/lib/supabase/client';
import {
  FileText,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  education_config?: {
    modules?: string[];
  } | null;
}

interface ExistingReport {
  id: string;
  access_token: string;
  report_url: string;
  has_safeguarding_signals: boolean;
  created_at: string;
}

interface ReportGenerationPanelProps {
  campaign: Campaign;
  schoolId: string;
  existingReport?: ExistingReport | null;
  onReportGenerated?: (report: ExistingReport) => void;
}

type PanelState = 'idle' | 'generating' | 'success' | 'error';

export function ReportGenerationPanel({
  campaign,
  schoolId,
  existingReport,
  onReportGenerated,
}: ReportGenerationPanelProps) {
  const [state, setState] = useState<PanelState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ExistingReport | null>(existingReport || null);
  const [copied, setCopied] = useState(false);

  // Get the first module from education_config or use default
  const module = campaign.education_config?.modules?.[0] || 'student_wellbeing';

  async function handleGenerateReport() {
    setState('generating');
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Authentication required');
      }

      // Step 1: Generate synthesis
      const synthesisResponse = await fetch(apiUrl('api/synthesis'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaign_id: campaign.id,
          school_id: schoolId,
          module: module,
        }),
      });

      if (!synthesisResponse.ok) {
        const synthesisError = await synthesisResponse.json();
        const errorMessage = synthesisError.details
          ? `${synthesisError.error}: ${synthesisError.details}`
          : synthesisError.error || 'Failed to generate synthesis';
        throw new Error(errorMessage);
      }

      const synthesisResult = await synthesisResponse.json();

      // Step 2: Create report from synthesis
      const reportResponse = await fetch(apiUrl('api/reports'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          synthesis_id: synthesisResult.synthesis_id,
        }),
      });

      if (!reportResponse.ok) {
        const reportError = await reportResponse.json();
        throw new Error(reportError.error || 'Failed to create report');
      }

      const reportResult = await reportResponse.json();

      const newReport: ExistingReport = {
        id: reportResult.report_id,
        access_token: reportResult.access_token,
        report_url: reportResult.report_url,
        has_safeguarding_signals: reportResult.has_safeguarding_signals || false,
        created_at: reportResult.created_at || new Date().toISOString(),
      };

      setReportData(newReport);
      setState('success');
      onReportGenerated?.(newReport);
    } catch (err) {
      console.error('Report generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setState('error');
    }
  }

  async function handleCopyUrl() {
    if (!reportData?.report_url) return;

    try {
      await navigator.clipboard.writeText(reportData.report_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }

  // If report exists (either from props or after generation), show it
  if (reportData) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-[hsl(var(--success))]" />
          <span className="text-[hsl(var(--success))] font-medium">Report Available</span>
          {reportData.has_safeguarding_signals && (
            <span className="px-2 py-0.5 bg-warning-subtle text-warning text-xs font-medium rounded-full">
              Safeguarding Signals
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-2
                        sm:flex-row sm:items-center">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <code className="text-xs text-muted-foreground truncate flex-1">
                {reportData.report_url}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopyUrl}
                title="Copy URL"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[hsl(var(--success))]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="shrink-0"
          >
            <a href={reportData.report_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              View Report
            </a>
          </Button>
        </div>

        {state === 'success' && (
          <p className="mt-2 text-xs text-[hsl(var(--success))]">
            Report generated successfully!
          </p>
        )}
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium">Generation Failed</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={handleGenerateReport}
        >
          <AlertCircle className="w-4 h-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  // Loading state
  if (state === 'generating') {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Generating synthesis report...</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This may take a minute as we analyze the interview data.
        </p>
      </div>
    );
  }

  // Idle state - show generate button
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateReport}
      >
        <FileText className="w-4 h-4 mr-1" />
        Generate Report
      </Button>
    </div>
  );
}
