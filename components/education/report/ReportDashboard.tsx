'use client';

/**
 * Education Report Dashboard
 *
 * Client component that orchestrates all visualization components for the
 * education synthesis report landing page.
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Epic: 2 - Education Synthesis Reports
 */

import { useState } from 'react';
import Image from 'next/image';
import { Calendar, FileText, Building2, Download, Loader2 } from 'lucide-react';
import {
  EducationSynthesisResult,
  LongitudinalComparisonResult,
} from '@/lib/agents/education-synthesis-agent';
import FourLensesCards from './FourLensesCards';
import StakeholderDonut from './StakeholderDonut';
import TriangulationChart from './TriangulationChart';
import UrgencyGauge from './UrgencyGauge';
import RecommendationsTimeline from './RecommendationsTimeline';
import SafeguardingSection from './SafeguardingSection';
import LongitudinalTrend from './LongitudinalTrend';

interface ReportDashboardProps {
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
  hasSafeguardingSignals: boolean;
  generatedAt: string;
  longitudinalData: LongitudinalComparisonResult | null;
  accessToken: string;
}

const MODULE_LABELS: Record<string, string> = {
  student_wellbeing: 'Student Wellbeing',
  teaching_learning: 'Teaching & Learning',
  parent_confidence: 'Parent Confidence',
  leadership_strategy: 'Strategic Leadership',
};

export default function ReportDashboard({
  school,
  campaign,
  module,
  synthesis,
  hasSafeguardingSignals,
  generatedAt,
  longitudinalData,
  accessToken,
}: ReportDashboardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const moduleName = MODULE_LABELS[module] || module.replace(/_/g, ' ');
  const formattedDate = new Date(generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/reports/${accessToken}/download-pdf`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${school.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${module.replace(/_/g, '-')}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-6
                        sm:px-6
                        lg:px-8">
          <div className="flex flex-col gap-4
                          sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="/icon-orb.svg"
                alt="FlowForge"
                width={48}
                height={48}
                className="w-12 h-12"
                unoptimized
              />
              <div>
                <h1 className="text-2xl font-bold text-foreground
                               sm:text-3xl">
                  {school.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    {school.code}
                  </span>
                  <span className="hidden sm:inline">|</span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {moduleName}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{formattedDate}</span>
              </div>
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                           bg-accent text-white rounded-lg hover:bg-accent-hover
                           disabled:opacity-60 disabled:cursor-not-allowed
                           transition-colors"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8
                       sm:px-6
                       lg:px-8">
        {/* Executive Summary Section */}
        <section className="mb-8">
          <div className="bg-card border border-border rounded-xl p-6
                          lg:p-8">
            <h2 className="text-xl font-bold text-foreground mb-4">
              {synthesis.executive_summary.headline}
            </h2>
            <p className="text-muted-foreground mb-6">
              {synthesis.executive_summary.key_finding}
            </p>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 gap-6
                            md:grid-cols-2">
              {/* Urgency Gauge */}
              <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg">
                <UrgencyGauge
                  level={synthesis.executive_summary.urgency_level}
                />
              </div>

              {/* Stakeholder Participation */}
              <div className="flex flex-col items-center justify-center p-4 bg-background rounded-lg">
                <StakeholderDonut
                  stakeholderCoverage={synthesis.data_quality.stakeholder_coverage}
                  totalSessions={synthesis.data_quality.total_sessions}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Primary Recommendation Callout */}
        <section className="mb-8">
          <div className="bg-accent-subtle border border-accent/30 rounded-xl p-6">
            <p className="text-sm font-medium text-accent mb-2">
              Primary Recommendation
            </p>
            <p className="text-foreground font-medium">
              {synthesis.executive_summary.primary_recommendation}
            </p>
          </div>
        </section>

        {/* Four Lenses Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            The Four Lenses
          </h2>
          <FourLensesCards
            whatIsHolding={synthesis.what_is_holding}
            whatIsSlipping={synthesis.what_is_slipping}
            whatIsMisunderstood={synthesis.what_is_misunderstood}
            whatIsAtRisk={synthesis.what_is_at_risk}
          />
        </section>

        {/* Triangulation Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Stakeholder Perspectives
          </h2>
          <TriangulationChart
            triangulation={synthesis.triangulation}
          />
        </section>

        {/* Recommendations Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Action Plan
          </h2>
          <RecommendationsTimeline
            recommendations={synthesis.recommendations}
          />
        </section>

        {/* Longitudinal Trends Section */}
        {longitudinalData && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Longitudinal Trends
            </h2>
            <LongitudinalTrend data={longitudinalData} />
          </section>
        )}

        {/* Safeguarding Section (Conditional) */}
        {hasSafeguardingSignals && synthesis.what_is_at_risk.safeguarding_signals > 0 && (
          <SafeguardingSection
            safeguardingSignals={synthesis.what_is_at_risk.safeguarding_signals}
            interventionRecommended={synthesis.what_is_at_risk.intervention_recommended}
            evidence={synthesis.what_is_at_risk.evidence}
          />
        )}

        {/* Data Quality Footer */}
        <footer className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col gap-4 text-sm text-muted-foreground
                          sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-4">
              <span>
                {synthesis.data_quality.complete_sessions} of {synthesis.data_quality.total_sessions} sessions analyzed
              </span>
              <span className="hidden sm:inline">|</span>
              <span>
                Depth score: {Math.round(synthesis.data_quality.average_depth_score * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Image
                src="/icon-orb.svg"
                alt="FlowForge"
                width={20}
                height={20}
                className="w-5 h-5 opacity-50"
                unoptimized
              />
              <span>Generated by FlowForge</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
