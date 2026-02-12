'use client';

/**
 * Recommendations Timeline Component
 *
 * Displays recommendations in three timeframe sections:
 * - Immediate Actions (within 1 week)
 * - Short-term (within 1 month)
 * - Strategic (within quarter)
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Epic: 2 - Education Synthesis Reports
 */

import { Clock, Calendar, Target, CheckSquare } from 'lucide-react';

interface RecommendationsTimelineProps {
  recommendations: {
    immediate_actions: string[];
    short_term: string[];
    strategic: string[];
  };
}

const TIMEFRAME_CONFIG = {
  immediate: {
    title: 'Immediate Actions',
    subtitle: 'Within 1 week',
    icon: Clock,
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    iconClass: 'text-destructive',
    dotClass: 'bg-destructive',
  },
  short_term: {
    title: 'Short-term',
    subtitle: 'Within 1 month',
    icon: Calendar,
    bgClass: 'bg-warning/10',
    borderClass: 'border-warning/30',
    iconClass: 'text-warning',
    dotClass: 'bg-warning',
  },
  strategic: {
    title: 'Strategic',
    subtitle: 'Within quarter',
    icon: Target,
    bgClass: 'bg-[hsl(var(--success))]/10',
    borderClass: 'border-[hsl(var(--success))]/30',
    iconClass: 'text-[hsl(var(--success))]',
    dotClass: 'bg-[hsl(var(--success))]',
  },
};

interface TimeframeSectionProps {
  timeframe: keyof typeof TIMEFRAME_CONFIG;
  items: string[];
}

function TimeframeSection({ timeframe, items }: TimeframeSectionProps) {
  const config = TIMEFRAME_CONFIG[timeframe];
  const Icon = config.icon;

  if (items.length === 0) return null;

  return (
    <div className={`rounded-xl border p-5 ${config.bgClass} ${config.borderClass}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${config.bgClass}`}>
          <Icon className={`w-5 h-5 ${config.iconClass}`} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{config.title}</h3>
          <p className="text-xs text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="ml-auto">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.iconClass}`}
          >
            {items.length} {items.length === 1 ? 'action' : 'actions'}
          </span>
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <CheckSquare
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClass}`}
            />
            <span className="text-sm text-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RecommendationsTimeline({
  recommendations,
}: RecommendationsTimelineProps) {
  const { immediate_actions, short_term, strategic } = recommendations;
  const totalActions =
    immediate_actions.length + short_term.length + strategic.length;

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {totalActions} Recommended Actions
          </span>
        </div>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          {totalActions > 0 && (
            <div className="h-full flex">
              {immediate_actions.length > 0 && (
                <div
                  className="bg-destructive h-full"
                  style={{
                    width: `${(immediate_actions.length / totalActions) * 100}%`,
                  }}
                />
              )}
              {short_term.length > 0 && (
                <div
                  className="bg-warning h-full"
                  style={{
                    width: `${(short_term.length / totalActions) * 100}%`,
                  }}
                />
              )}
              {strategic.length > 0 && (
                <div
                  className="bg-[hsl(var(--success))] h-full"
                  style={{
                    width: `${(strategic.length / totalActions) * 100}%`,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="grid grid-cols-1 gap-4
                      lg:grid-cols-3">
        <TimeframeSection timeframe="immediate" items={immediate_actions} />
        <TimeframeSection timeframe="short_term" items={short_term} />
        <TimeframeSection timeframe="strategic" items={strategic} />
      </div>
    </div>
  );
}
