'use client';

/**
 * Safeguarding Section Component
 *
 * Conditionally rendered section for safeguarding concerns.
 * Only displayed when safeguarding_signals > 0.
 * Has special warning styling and anchor for email links.
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Epic: 2 - Education Synthesis Reports
 */

import { ShieldAlert, AlertTriangle, Phone, ExternalLink } from 'lucide-react';

interface SafeguardingSectionProps {
  safeguardingSignals: number;
  interventionRecommended: boolean;
  evidence: string[];
}

export default function SafeguardingSection({
  safeguardingSignals,
  interventionRecommended,
  evidence,
}: SafeguardingSectionProps) {
  // Don't render if no signals
  if (safeguardingSignals === 0) {
    return null;
  }

  return (
    <section
      id="safeguarding"
      className="mb-8 scroll-mt-8"
    >
      <div className="bg-destructive/5 border-2 border-destructive/50 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-destructive/10 rounded-xl">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-destructive mb-1">
              Safeguarding Concerns Detected
            </h2>
            <p className="text-muted-foreground">
              This report has identified {safeguardingSignals} potential
              safeguarding {safeguardingSignals === 1 ? 'signal' : 'signals'}{' '}
              that require attention.
            </p>
          </div>
        </div>

        {/* Intervention Alert */}
        {interventionRecommended && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <div>
                <p className="font-semibold text-destructive">
                  Intervention Recommended
                </p>
                <p className="text-sm text-muted-foreground">
                  Based on the analysis, immediate professional intervention is
                  advised. Please consult with your designated safeguarding lead.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Evidence */}
        {evidence.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-foreground mb-3">
              Identified Patterns
            </h3>
            <ul className="space-y-2">
              {evidence.map((item, idx) => (
                <li
                  key={idx}
                  className="text-sm text-foreground pl-4 border-l-2 border-destructive/50"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Important Notice */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Important Notice
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            This automated analysis is not a substitute for professional
            assessment. If you have immediate concerns about a child's safety,
            please contact your school's designated safeguarding lead or
            relevant authorities.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://www.nspcc.org.uk/keeping-children-safe/reporting-abuse/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              NSPCC Reporting Guidelines
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.gov.uk/report-child-abuse"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              UK Gov: Report Child Abuse
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Confidentiality Notice */}
        <p className="mt-4 text-xs text-muted-foreground">
          This section contains sensitive information and should be treated as
          confidential. Access to this report should be limited to authorized
          personnel only.
        </p>
      </div>
    </section>
  );
}
