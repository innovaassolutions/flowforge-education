'use client';

/**
 * Longitudinal Trend Component
 *
 * SVG line chart showing assessment trends over time.
 * Displays multiple series for holding, slipping, and risk scores.
 *
 * Story: 2.4 - Longitudinal Comparison & Safeguarding Notifications
 * Epic: 2 - Education Synthesis Reports
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, Info } from 'lucide-react';
import { LongitudinalDataPoint, LongitudinalComparisonResult } from '@/lib/agents/education-synthesis-agent';

interface LongitudinalTrendProps {
  data: LongitudinalComparisonResult;
}

const SERIES_CONFIG = {
  holding: {
    label: "What's Holding",
    color: 'hsl(var(--success))',
    colorClass: 'text-[hsl(var(--success))]',
    bgClass: 'bg-[hsl(var(--success))]/10',
    key: 'holdingScore' as const,
  },
  slipping: {
    label: "What's Slipping",
    color: 'hsl(var(--warning))',
    colorClass: 'text-warning',
    bgClass: 'bg-warning/10',
    key: 'slippingScore' as const,
  },
  risk: {
    label: 'Risk Signals',
    color: 'hsl(var(--destructive))',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    key: 'riskScore' as const,
  },
};

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return <TrendingUp className="w-4 h-4 text-[hsl(var(--success))]" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="w-4 h-4 text-destructive" />;
  }
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export default function LongitudinalTrend({ data }: LongitudinalTrendProps) {
  const { dataPoints, trend_analysis, key_changes, hasSufficientData } = data;

  // Chart dimensions
  const width = 600;
  const height = 300;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales and paths
  const { xScale, yScale, paths } = useMemo(() => {
    if (dataPoints.length === 0) {
      return { xScale: () => 0, yScale: () => 0, paths: {} };
    }

    // Find max values for Y scale (use 100 for percentage scores, or max for counts)
    const maxHolding = Math.max(...dataPoints.map(d => d.holdingScore), 100);
    const maxSlipping = Math.max(...dataPoints.map(d => d.slippingScore), 100);
    const maxRisk = Math.max(...dataPoints.map(d => d.riskScore), 10);
    const yMax = Math.max(maxHolding, maxSlipping, maxRisk * 10);

    // X scale: evenly distribute points
    const xScale = (index: number) => {
      if (dataPoints.length === 1) return chartWidth / 2;
      return (index / (dataPoints.length - 1)) * chartWidth;
    };

    // Y scale: 0 to yMax
    const yScale = (value: number) => {
      return chartHeight - (value / yMax) * chartHeight;
    };

    // Generate SVG paths for each series
    const generatePath = (key: 'holdingScore' | 'slippingScore' | 'riskScore', multiplier = 1) => {
      if (dataPoints.length < 2) return '';
      return dataPoints
        .map((d, i) => {
          const x = padding.left + xScale(i);
          const y = padding.top + yScale(d[key] * multiplier);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');
    };

    return {
      xScale,
      yScale,
      paths: {
        holding: generatePath('holdingScore'),
        slipping: generatePath('slippingScore'),
        risk: generatePath('riskScore', 10), // Scale up risk for visibility
      },
    };
  }, [dataPoints, chartWidth, chartHeight, padding.left, padding.top]);

  // Render first assessment message
  if (!hasSufficientData) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <Info className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">
              First Assessment
            </h3>
            <p className="text-muted-foreground">
              Longitudinal comparison data will appear after future assessments.
              Run additional assessments to track trends over time.
            </p>
            {dataPoints.length === 1 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Current assessment: {dataPoints[0].termLabel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-6 overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto"
        >
          {/* Grid lines */}
          <g className="text-border">
            {[0, 25, 50, 75, 100].map((value) => {
              const y = padding.top + (chartHeight - (value / 100) * chartHeight);
              return (
                <g key={value}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    opacity={0.3}
                  />
                  <text
                    x={padding.left - 10}
                    y={y}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="text-xs fill-muted-foreground"
                  >
                    {value}
                  </text>
                </g>
              );
            })}
          </g>

          {/* X-axis labels */}
          <g className="text-muted-foreground">
            {dataPoints.map((point, i) => {
              const x = padding.left + (dataPoints.length === 1
                ? chartWidth / 2
                : (i / (dataPoints.length - 1)) * chartWidth);
              return (
                <text
                  key={point.synthesisId}
                  x={x}
                  y={height - 20}
                  textAnchor="middle"
                  className="text-xs fill-muted-foreground"
                >
                  {point.termLabel}
                </text>
              );
            })}
          </g>

          {/* Axis labels */}
          <text
            x={padding.left / 2}
            y={height / 2}
            textAnchor="middle"
            transform={`rotate(-90, ${padding.left / 2}, ${height / 2})`}
            className="text-xs fill-muted-foreground"
          >
            Score
          </text>

          {/* Lines */}
          {paths.holding && (
            <path
              d={paths.holding}
              fill="none"
              stroke={SERIES_CONFIG.holding.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {paths.slipping && (
            <path
              d={paths.slipping}
              fill="none"
              stroke={SERIES_CONFIG.slipping.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {paths.risk && (
            <path
              d={paths.risk}
              fill="none"
              stroke={SERIES_CONFIG.risk.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 4"
            />
          )}

          {/* Data points */}
          {dataPoints.map((point, i) => {
            const x = padding.left + (dataPoints.length === 1
              ? chartWidth / 2
              : (i / (dataPoints.length - 1)) * chartWidth);
            const maxY = Math.max(100, Math.max(...dataPoints.map(d => d.riskScore)) * 10);

            return (
              <g key={point.synthesisId}>
                <circle
                  cx={x}
                  cy={padding.top + chartHeight - (point.holdingScore / maxY) * chartHeight}
                  r={5}
                  fill={SERIES_CONFIG.holding.color}
                />
                <circle
                  cx={x}
                  cy={padding.top + chartHeight - (point.slippingScore / maxY) * chartHeight}
                  r={5}
                  fill={SERIES_CONFIG.slipping.color}
                />
                <circle
                  cx={x}
                  cy={padding.top + chartHeight - (point.riskScore * 10 / maxY) * chartHeight}
                  r={5}
                  fill={SERIES_CONFIG.risk.color}
                />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-border">
          {Object.entries(SERIES_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-4 h-1 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend Analysis */}
      <div className="grid grid-cols-1 gap-4
                      md:grid-cols-3">
        {/* Improving */}
        {trend_analysis.improving.length > 0 && (
          <div className="bg-[hsl(var(--success))]/5 border border-[hsl(var(--success))]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendIcon trend="up" />
              <h4 className="font-medium text-[hsl(var(--success))]">Improving</h4>
            </div>
            <ul className="space-y-2">
              {trend_analysis.improving.map((item, idx) => (
                <li key={idx} className="text-sm text-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stable */}
        {trend_analysis.stable.length > 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendIcon trend="stable" />
              <h4 className="font-medium text-muted-foreground">Stable</h4>
            </div>
            <ul className="space-y-2">
              {trend_analysis.stable.map((item, idx) => (
                <li key={idx} className="text-sm text-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Declining */}
        {trend_analysis.declining.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendIcon trend="down" />
              <h4 className="font-medium text-destructive">Needs Attention</h4>
            </div>
            <ul className="space-y-2">
              {trend_analysis.declining.map((item, idx) => (
                <li key={idx} className="text-sm text-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Key Changes */}
      {key_changes.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Key Changes</h4>
          <ul className="space-y-2">
            {key_changes.map((change, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full flex-shrink-0" />
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
