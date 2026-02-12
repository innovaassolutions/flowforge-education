'use client';

/**
 * Triangulation Chart Component
 *
 * Displays aligned themes, divergent themes, and blind spots
 * from cross-stakeholder analysis.
 *
 * Story: 2.3 - Report Landing Page & Visualizations
 * Epic: 2 - Education Synthesis Reports
 */

import { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { TriangulationInsight } from '@/lib/agents/education-synthesis-agent';

interface TriangulationChartProps {
  triangulation: {
    aligned_themes: TriangulationInsight[];
    divergent_themes: TriangulationInsight[];
    blind_spots: string[];
  };
}

const PERSPECTIVE_LABELS: Record<string, string> = {
  student: 'Students',
  teacher: 'Teachers',
  parent: 'Parents',
  leadership: 'Leadership',
};

interface ThemeCardProps {
  theme: TriangulationInsight;
  variant: 'aligned' | 'divergent';
}

function ThemeCard({ theme, variant }: ThemeCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isAligned = variant === 'aligned';
  const Icon = isAligned ? CheckCircle : AlertCircle;

  const perspectives = [
    { key: 'student_perspective', label: 'Students', value: theme.student_perspective },
    { key: 'teacher_perspective', label: 'Teachers', value: theme.teacher_perspective },
    { key: 'parent_perspective', label: 'Parents', value: theme.parent_perspective },
    { key: 'leadership_perspective', label: 'Leadership', value: theme.leadership_perspective },
  ].filter((p) => p.value);

  return (
    <div
      className={`rounded-lg border p-4 ${
        isAligned
          ? 'bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/30'
          : 'bg-warning/5 border-warning/30'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <Icon
            className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              isAligned ? 'text-[hsl(var(--success))]' : 'text-warning'
            }`}
          />
          <div>
            <h4 className="font-medium text-foreground">{theme.theme}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {theme.synthesis}
            </p>
          </div>
        </div>

        {/* Alignment Score */}
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
            isAligned
              ? 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]'
              : 'bg-warning/20 text-warning'
          }`}
        >
          {Math.round(theme.alignment_score)}%
        </div>
      </div>

      {/* Tension Points (for divergent) */}
      {!isAligned && theme.tension_points.length > 0 && (
        <div className="mb-3 pl-8">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Tension points:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {theme.tension_points.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-warning">-</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Perspectives Toggle */}
      {perspectives.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pl-8"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {expanded ? 'Hide' : 'View'} perspectives ({perspectives.length})
          </button>

          {expanded && (
            <div className="mt-3 pl-8 space-y-3">
              {perspectives.map((p) => (
                <div key={p.key} className="text-sm">
                  <span className="font-medium text-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {p.label}:
                  </span>
                  <p className="text-muted-foreground mt-1 pl-4">
                    {p.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TriangulationChart({
  triangulation,
}: TriangulationChartProps) {
  const { aligned_themes, divergent_themes, blind_spots } = triangulation;

  return (
    <div className="space-y-6">
      {/* Aligned Themes */}
      {aligned_themes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-[hsl(var(--success))]" />
            <h3 className="font-semibold text-foreground">
              Aligned Themes
            </h3>
            <span className="text-sm text-muted-foreground">
              ({aligned_themes.length})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3
                          lg:grid-cols-2">
            {aligned_themes.map((theme, idx) => (
              <ThemeCard key={idx} theme={theme} variant="aligned" />
            ))}
          </div>
        </div>
      )}

      {/* Divergent Themes */}
      {divergent_themes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-foreground">
              Divergent Themes
            </h3>
            <span className="text-sm text-muted-foreground">
              ({divergent_themes.length})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3
                          lg:grid-cols-2">
            {divergent_themes.map((theme, idx) => (
              <ThemeCard key={idx} theme={theme} variant="divergent" />
            ))}
          </div>
        </div>
      )}

      {/* Blind Spots */}
      {blind_spots.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <EyeOff className="w-5 h-5 text-destructive" />
            <h3 className="font-semibold text-foreground">
              Blind Spots
            </h3>
            <span className="text-sm text-muted-foreground">
              ({blind_spots.length})
            </span>
          </div>
          <div className="bg-destructive/5 border border-destructive/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Issues visible to some stakeholders but not others
            </p>
            <ul className="space-y-2">
              {blind_spots.map((spot, idx) => (
                <li
                  key={idx}
                  className="text-sm text-foreground flex items-start gap-2"
                >
                  <EyeOff className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  {spot}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
