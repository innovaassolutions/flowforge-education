'use client';

/**
 * Four Lenses Cards Component
 *
 * Displays the four analysis lenses with color-coded cards:
 * - What's Holding (Green) - strengths maintaining stability
 * - What's Slipping (Amber) - areas showing decline
 * - What's Misunderstood (Orange) - perception gaps
 * - What's At Risk (Red) - urgent concerns
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Epic: 2 - Education Synthesis Reports
 */

import { useState } from 'react';
import {
  Shield,
  TrendingDown,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';

interface FourLensesCardsProps {
  whatIsHolding: {
    description: string;
    evidence: string[];
    stakeholder_agreement: number;
  };
  whatIsSlipping: {
    description: string;
    evidence: string[];
    stakeholder_agreement: number;
    risk_trajectory: 'stable' | 'declining' | 'critical';
  };
  whatIsMisunderstood: {
    description: string;
    evidence: string[];
    perception_gaps: Array<{
      group_a: string;
      group_b: string;
      gap_description: string;
    }>;
  };
  whatIsAtRisk: {
    description: string;
    evidence: string[];
    safeguarding_signals: number;
    intervention_recommended: boolean;
  };
}

const LENS_CONFIG = {
  holding: {
    title: "What's Holding",
    subtitle: 'Strengths & Stability',
    icon: Shield,
    bgClass: 'bg-[hsl(var(--success))]/10',
    borderClass: 'border-[hsl(var(--success))]/50',
    iconClass: 'text-[hsl(var(--success))]',
    badgeClass: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]',
  },
  slipping: {
    title: "What's Slipping",
    subtitle: 'Areas of Decline',
    icon: TrendingDown,
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/50',
    iconClass: 'text-warning',
    badgeClass: 'bg-warning/20 text-warning',
  },
  misunderstood: {
    title: "What's Misunderstood",
    subtitle: 'Perception Gaps',
    icon: HelpCircle,
    bgClass: 'bg-accent-subtle',
    borderClass: 'border-accent/50',
    iconClass: 'text-accent',
    badgeClass: 'bg-accent/20 text-accent',
  },
  atRisk: {
    title: "What's At Risk",
    subtitle: 'Urgent Concerns',
    icon: AlertTriangle,
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/50',
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/20 text-destructive',
  },
};

interface LensCardProps {
  lens: keyof typeof LENS_CONFIG;
  description: string;
  evidence: string[];
  agreement?: number;
  trajectory?: 'stable' | 'declining' | 'critical';
  perceptionGaps?: Array<{
    group_a: string;
    group_b: string;
    gap_description: string;
  }>;
}

function LensCard({
  lens,
  description,
  evidence,
  agreement,
  trajectory,
  perceptionGaps,
}: LensCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = LENS_CONFIG[lens];
  const Icon = config.icon;

  const trajectoryLabels = {
    stable: 'Stable',
    declining: 'Declining',
    critical: 'Critical',
  };

  return (
    <div
      className={`rounded-xl border p-5 ${config.bgClass} ${config.borderClass}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgClass}`}>
            <Icon className={`w-5 h-5 ${config.iconClass}`} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{config.title}</h3>
            <p className="text-xs text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>

        {/* Agreement Badge or Trajectory */}
        {agreement !== undefined && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.badgeClass}`}
          >
            <Users className="w-3 h-3" />
            {Math.round(agreement)}%
          </div>
        )}
        {trajectory && (
          <div
            className={`px-2 py-1 rounded-full text-xs font-medium ${config.badgeClass}`}
          >
            {trajectoryLabels[trajectory]}
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-foreground mb-4">{description}</p>

      {/* Perception Gaps (for misunderstood) */}
      {perceptionGaps && perceptionGaps.length > 0 && (
        <div className="mb-4 space-y-2">
          {perceptionGaps.slice(0, 2).map((gap, idx) => (
            <div
              key={idx}
              className="text-xs bg-background/50 rounded-lg p-3 border border-accent/20"
            >
              <span className="font-medium text-muted-foreground">
                {gap.group_a} vs {gap.group_b}:
              </span>{' '}
              <span className="text-foreground">{gap.gap_description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Evidence Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        {expanded ? 'Hide' : 'Show'} evidence ({evidence.length})
      </button>

      {/* Evidence List */}
      {expanded && evidence.length > 0 && (
        <ul className="mt-3 space-y-2">
          {evidence.map((item, idx) => (
            <li
              key={idx}
              className="text-sm text-muted-foreground pl-4 border-l-2 border-border"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FourLensesCards({
  whatIsHolding,
  whatIsSlipping,
  whatIsMisunderstood,
  whatIsAtRisk,
}: FourLensesCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4
                    md:grid-cols-2">
      <LensCard
        lens="holding"
        description={whatIsHolding.description}
        evidence={whatIsHolding.evidence}
        agreement={whatIsHolding.stakeholder_agreement}
      />
      <LensCard
        lens="slipping"
        description={whatIsSlipping.description}
        evidence={whatIsSlipping.evidence}
        agreement={whatIsSlipping.stakeholder_agreement}
        trajectory={whatIsSlipping.risk_trajectory}
      />
      <LensCard
        lens="misunderstood"
        description={whatIsMisunderstood.description}
        evidence={whatIsMisunderstood.evidence}
        perceptionGaps={whatIsMisunderstood.perception_gaps}
      />
      <LensCard
        lens="atRisk"
        description={whatIsAtRisk.description}
        evidence={whatIsAtRisk.evidence}
      />
    </div>
  );
}
