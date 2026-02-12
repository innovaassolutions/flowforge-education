/**
 * Education Report Utilities
 *
 * Utility functions for education synthesis reports including:
 * - Token generation for secure report access
 * - Safeguarding signal detection
 * - Safeguarding lead notification
 *
 * Story: 2.1 - Database & API Foundation
 * Epic: 2 - Education Synthesis Reports
 */

import { generateAccessToken } from '@/lib/utils/token-generator';

/**
 * Generate a secure access token for education reports.
 * Reuses the existing token generator for consistency with consulting reports.
 *
 * @returns 43-character base64url-encoded access token (256-bit entropy)
 */
export function generateReportAccessToken(): string {
  return generateAccessToken();
}

/**
 * Detect safeguarding signals from synthesis content.
 * Checks the what_is_at_risk section for safeguarding indicators.
 *
 * @param synthesisContent - The full synthesis result content
 * @returns Number of safeguarding signals detected
 */
export function detectSafeguardingSignals(
  synthesisContent: Record<string, unknown>
): number {
  const whatIsAtRisk = synthesisContent?.what_is_at_risk as
    | {
        safeguarding_signals?: number;
        intervention_recommended?: boolean;
      }
    | undefined;

  // Return explicit count if provided
  if (typeof whatIsAtRisk?.safeguarding_signals === 'number') {
    return whatIsAtRisk.safeguarding_signals;
  }

  // If intervention is recommended but no explicit count, assume at least 1
  if (whatIsAtRisk?.intervention_recommended) {
    return 1;
  }

  return 0;
}

/**
 * Build safeguarding notification email content.
 * Creates a professional, sensitive email for safeguarding leads.
 *
 * @param schoolName - Name of the school
 * @param safeguardingLeadName - Name of the safeguarding lead
 * @param signalCount - Number of safeguarding signals detected
 * @param reportUrl - Full URL to the report safeguarding section
 * @returns HTML email content
 */
export function buildSafeguardingEmailContent(
  schoolName: string,
  safeguardingLeadName: string,
  signalCount: number,
  reportUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FEF5EE; border-left: 4px solid #F25C05; padding: 16px; margin-bottom: 24px; }
        .header h1 { margin: 0; color: #171614; font-size: 18px; }
        .content { margin-bottom: 24px; }
        .action-button { display: inline-block; background-color: #F25C05; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { color: #71706B; font-size: 12px; border-top: 1px solid #E6E2D6; padding-top: 16px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Action Required: Safeguarding Signals Detected</h1>
        </div>

        <div class="content">
          <p>Dear ${safeguardingLeadName || 'Safeguarding Lead'},</p>

          <p>A new assessment report for <strong>${schoolName}</strong> has identified
             <strong>${signalCount} safeguarding signal${signalCount !== 1 ? 's' : ''}</strong>
             that require${signalCount === 1 ? 's' : ''} your attention.</p>

          <p>These signals have been identified through analysis of stakeholder interviews
             and warrant review to determine if any follow-up action is needed.</p>

          <p style="margin: 24px 0;">
            <a href="${reportUrl}" class="action-button">View Safeguarding Section</a>
          </p>

          <p><strong>Please note:</strong> This report contains aggregated, anonymized insights.
             Individual participants cannot be identified from the report content.</p>
        </div>

        <div class="footer">
          <p>This is an automated notification from FlowForge for Schools.</p>
          <p>If you believe you received this in error, please contact your Innovaas representative.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build plain text version of safeguarding email.
 *
 * @param schoolName - Name of the school
 * @param safeguardingLeadName - Name of the safeguarding lead
 * @param signalCount - Number of safeguarding signals detected
 * @param reportUrl - Full URL to the report safeguarding section
 * @returns Plain text email content
 */
export function buildSafeguardingEmailText(
  schoolName: string,
  safeguardingLeadName: string,
  signalCount: number,
  reportUrl: string
): string {
  return `
ACTION REQUIRED: Safeguarding Signals Detected

Dear ${safeguardingLeadName || 'Safeguarding Lead'},

A new assessment report for ${schoolName} has identified ${signalCount} safeguarding signal${signalCount !== 1 ? 's' : ''} that require${signalCount === 1 ? 's' : ''} your attention.

These signals have been identified through analysis of stakeholder interviews and warrant review to determine if any follow-up action is needed.

View the safeguarding section: ${reportUrl}

Please note: This report contains aggregated, anonymized insights. Individual participants cannot be identified from the report content.

---
This is an automated notification from FlowForge for Schools.
If you believe you received this in error, please contact your Innovaas representative.
  `.trim();
}

/**
 * Interface for synthesis content structure
 */
export interface EducationSynthesisContent {
  campaign_id: string;
  school_id: string;
  module: string;
  generated_at: string;
  executive_summary: {
    headline: string;
    key_finding: string;
    primary_recommendation: string;
    urgency_level: 'low' | 'medium' | 'high' | 'critical';
  };
  stakeholder_analyses: Array<{
    participant_type: string;
    session_count: number;
    themes: string[];
    concerns: string[];
    strengths: string[];
  }>;
  triangulation: {
    aligned_themes: Array<{
      theme: string;
      synthesis: string;
      alignment_score: number;
    }>;
    divergent_themes: Array<{
      theme: string;
      synthesis: string;
      tension_points: string[];
    }>;
    blind_spots: string[];
  };
  what_is_holding: {
    description: string;
    evidence: string[];
    stakeholder_agreement: number;
  };
  what_is_slipping: {
    description: string;
    evidence: string[];
    stakeholder_agreement: number;
    risk_trajectory: 'stable' | 'declining' | 'critical';
  };
  what_is_misunderstood: {
    description: string;
    evidence: string[];
    perception_gaps: Array<{
      group_a: string;
      group_b: string;
      gap_description: string;
    }>;
  };
  what_is_at_risk: {
    description: string;
    evidence: string[];
    safeguarding_signals: number;
    intervention_recommended: boolean;
  };
  recommendations: {
    immediate_actions: string[];
    short_term: string[];
    strategic: string[];
  };
  data_quality: {
    total_sessions: number;
    complete_sessions: number;
    average_depth_score: number;
    stakeholder_coverage: Record<string, number>;
  };
}
