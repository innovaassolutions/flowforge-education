'use client';

/**
 * Stakeholder Donut Chart Component
 *
 * SVG donut chart showing stakeholder participation breakdown.
 * Uses d3-shape for arc calculations.
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Epic: 2 - Education Synthesis Reports
 */

import { useMemo } from 'react';
import { pie, arc, PieArcDatum } from 'd3-shape';
import { Users } from 'lucide-react';

interface StakeholderDonutProps {
  stakeholderCoverage: Record<string, number>;
  totalSessions: number;
}

const STAKEHOLDER_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  student: { label: 'Students', color: 'hsl(var(--chart-1))' },
  teacher: { label: 'Teachers', color: 'hsl(var(--chart-2))' },
  parent: { label: 'Parents', color: 'hsl(var(--chart-3))' },
  leadership: { label: 'Leadership', color: 'hsl(var(--chart-4))' },
};

// Fallback colors for unknown stakeholder types
const FALLBACK_COLORS = [
  'hsl(var(--chart-5))',
  'hsl(220, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(320, 70%, 50%)',
];

interface DonutData {
  type: string;
  label: string;
  value: number;
  color: string;
}

export default function StakeholderDonut({
  stakeholderCoverage,
  totalSessions,
}: StakeholderDonutProps) {
  const data = useMemo(() => {
    const entries = Object.entries(stakeholderCoverage);
    let fallbackIndex = 0;

    return entries.map(([type, count]): DonutData => {
      const config = STAKEHOLDER_CONFIG[type];
      if (config) {
        return {
          type,
          label: config.label,
          value: count,
          color: config.color,
        };
      }
      // Use fallback for unknown types
      const color = FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
      fallbackIndex++;
      return {
        type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        value: count,
        color,
      };
    });
  }, [stakeholderCoverage]);

  // Chart dimensions
  const width = 200;
  const height = 200;
  const outerRadius = 80;
  const innerRadius = 50;

  // Create pie generator
  const pieGenerator = useMemo(
    () =>
      pie<DonutData>()
        .value((d) => d.value)
        .sort(null),
    []
  );

  // Create arc generator
  const arcGenerator = useMemo(
    () =>
      arc<PieArcDatum<DonutData>>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(0.02)
        .cornerRadius(4),
    []
  );

  const arcs = pieGenerator(data);

  return (
    <div className="flex flex-col items-center gap-4
                    sm:flex-row sm:items-start sm:gap-6">
      {/* Donut Chart */}
      <div className="relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          <g transform={`translate(${width / 2}, ${height / 2})`}>
            {arcs.map((arcData, idx) => (
              <path
                key={arcData.data.type}
                d={arcGenerator(arcData) || ''}
                fill={arcData.data.color}
                className="transition-opacity hover:opacity-80"
              />
            ))}
          </g>
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Users className="w-5 h-5 text-muted-foreground mb-1" />
          <span className="text-2xl font-bold text-foreground">
            {totalSessions}
          </span>
          <span className="text-xs text-muted-foreground">Sessions</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2
                      sm:flex-col sm:gap-2">
        {data.map((item) => (
          <div
            key={item.type}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
