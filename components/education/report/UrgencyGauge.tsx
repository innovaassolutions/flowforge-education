'use client';

/**
 * Urgency Gauge Component
 *
 * SVG semi-circle gauge showing urgency level from low to critical.
 * Color gradient: green (low) -> yellow (medium) -> orange (high) -> red (critical)
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Epic: 2 - Education Synthesis Reports
 */

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface UrgencyGaugeProps {
  level: 'low' | 'medium' | 'high' | 'critical';
}

const URGENCY_CONFIG = {
  low: {
    label: 'Low',
    value: 0.15,
    color: 'hsl(var(--success))',
    bgClass: 'bg-[hsl(var(--success))]/10',
    textClass: 'text-[hsl(var(--success))]',
  },
  medium: {
    label: 'Medium',
    value: 0.4,
    color: 'hsl(var(--warning))',
    bgClass: 'bg-warning/10',
    textClass: 'text-warning',
  },
  high: {
    label: 'High',
    value: 0.65,
    color: 'hsl(var(--accent))',
    bgClass: 'bg-accent/10',
    textClass: 'text-accent',
  },
  critical: {
    label: 'Critical',
    value: 0.9,
    color: 'hsl(var(--destructive))',
    bgClass: 'bg-destructive/10',
    textClass: 'text-destructive',
  },
};

export default function UrgencyGauge({ level }: UrgencyGaugeProps) {
  const config = URGENCY_CONFIG[level];

  // SVG dimensions
  const width = 200;
  const height = 120;
  const centerX = width / 2;
  const centerY = height - 10;
  const radius = 80;
  const strokeWidth = 12;

  // Calculate arc paths
  const arcPath = useMemo(() => {
    // Semi-circle from 180 to 0 degrees (left to right)
    const startAngle = Math.PI; // 180 degrees
    const endAngle = 0; // 0 degrees

    const startX = centerX + radius * Math.cos(startAngle);
    const startY = centerY + radius * Math.sin(startAngle);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);

    return `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
  }, [centerX, centerY, radius]);

  // Calculate the indicator position
  const indicatorAngle = useMemo(() => {
    // Map value (0-1) to angle (180-0 degrees in radians)
    return Math.PI * (1 - config.value);
  }, [config.value]);

  const indicatorX = centerX + radius * Math.cos(indicatorAngle);
  const indicatorY = centerY + radius * Math.sin(indicatorAngle);

  // Gradient stops for the gauge
  const gradientId = `urgency-gradient-${level}`;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          {/* Gradient for gauge background */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--success))" />
            <stop offset="35%" stopColor="hsl(var(--warning))" />
            <stop offset="65%" stopColor="hsl(var(--accent))" />
            <stop offset="100%" stopColor="hsl(var(--destructive))" />
          </linearGradient>
        </defs>

        {/* Background arc (gray) */}
        <path
          d={arcPath}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored gauge arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * radius * config.value} ${Math.PI * radius}`}
          className="transition-all duration-500"
        />

        {/* Indicator dot */}
        <circle
          cx={indicatorX}
          cy={indicatorY}
          r={8}
          fill={config.color}
          stroke="white"
          strokeWidth={3}
          className="drop-shadow-md transition-all duration-500"
        />

        {/* Level markers */}
        <g className="text-[10px] fill-muted-foreground">
          <text x={centerX - radius - 5} y={centerY + 4} textAnchor="end">
            Low
          </text>
          <text x={centerX + radius + 5} y={centerY + 4} textAnchor="start">
            Critical
          </text>
        </g>
      </svg>

      {/* Label */}
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full mt-2 ${config.bgClass}`}
      >
        <AlertTriangle className={`w-4 h-4 ${config.textClass}`} />
        <span className={`font-semibold ${config.textClass}`}>
          {config.label} Urgency
        </span>
      </div>
    </div>
  );
}
