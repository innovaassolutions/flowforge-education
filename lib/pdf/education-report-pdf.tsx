/**
 * Education Report PDF Document
 *
 * Generates a professional PDF version of the education synthesis report.
 * Follows the same web report structure: Executive Summary, Four Lenses,
 * Stakeholder Perspectives, Action Plan, and Safeguarding.
 *
 * Uses @react-pdf/renderer with Pearl Vibrant theme colors.
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Circle,
} from '@react-pdf/renderer'
import type {
  EducationSynthesisResult,
} from '@/lib/agents/education-synthesis-agent'

// ============================================================================
// TYPES
// ============================================================================

export interface EducationReportPDFData {
  school: {
    id: string
    name: string
    code: string
    country: string | null
    curriculum: string | null
  }
  campaign: {
    id: string
    name: string
    description: string | null
  }
  module: string
  synthesis: EducationSynthesisResult
  hasSafeguardingSignals: boolean
  generatedAt: string
  generatedDate: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#F25C05',
  primaryHover: '#DC5204',
  secondary: '#1D9BA3',
  background: '#FFFEFB',
  backgroundSubtle: '#FAF8F3',
  backgroundMuted: '#F2EFE7',
  text: '#171614',
  textMuted: '#71706B',
  border: '#E6E2D6',
  dark: '#111928',
  white: '#FFFFFF',
  // Four Lenses colors
  holding: '#16A34A',     // green-600
  holdingBg: '#F0FDF4',   // green-50
  slipping: '#D97706',    // amber-600
  slippingBg: '#FFFBEB',  // amber-50
  misunderstood: '#EA580C', // orange-600
  misunderstoodBg: '#FFF7ED', // orange-50
  atRisk: '#DC2626',      // red-600
  atRiskBg: '#FEF2F2',    // red-50
  // Urgency colors
  urgencyLow: '#16A34A',
  urgencyMedium: '#D97706',
  urgencyHigh: '#EA580C',
  urgencyCritical: '#DC2626',
}

const MODULE_LABELS: Record<string, string> = {
  student_wellbeing: 'Student Wellbeing',
  teaching_learning: 'Teaching & Learning',
  parent_confidence: 'Parent Confidence',
  leadership_strategy: 'Strategic Leadership',
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Page
  page: {
    backgroundColor: COLORS.background,
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  coverPage: {
    backgroundColor: COLORS.dark,
    padding: 0,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },

  // Cover page elements
  coverContent: {
    flex: 1,
    padding: 60,
    justifyContent: 'space-between',
  },
  coverBrand: {
    marginBottom: 60,
  },
  coverBrandText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  coverBrandSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  coverMain: {
    marginBottom: 40,
  },
  coverSchoolName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 12,
    lineHeight: 1.2,
  },
  coverModule: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  coverCampaign: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  coverDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  coverMetrics: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 40,
  },
  coverMetricBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  coverMetricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  coverMetricLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coverUrgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  coverUrgencyText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  coverFooterText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
  },

  // Page header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBrand: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  headerDivider: {
    fontSize: 10,
    color: COLORS.border,
  },
  headerSchool: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  headerRight: {
    fontSize: 9,
    color: COLORS.textMuted,
  },

  // Page footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: 8,
    color: COLORS.textMuted,
  },

  // Section titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },

  // Executive summary
  execHeadline: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
    lineHeight: 1.4,
  },
  execKeyFinding: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 1.5,
    marginBottom: 20,
  },
  recommendationCallout: {
    backgroundColor: '#FEF5EE',
    borderWidth: 1,
    borderColor: 'rgba(242, 92, 5, 0.3)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  recommendationLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  recommendationText: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 1.5,
  },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Urgency badge
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Four Lenses card
  lensCard: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
  },
  lensHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  lensTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  lensBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  lensBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  lensContent: {
    padding: 14,
  },
  lensDescription: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.5,
    marginBottom: 12,
  },
  lensEvidenceLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  evidenceQuote: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  evidenceQuoteBar: {
    width: 2,
    minHeight: 12,
    borderRadius: 1,
    marginRight: 8,
    marginTop: 2,
  },
  evidenceQuoteText: {
    flex: 1,
    fontSize: 9,
    color: COLORS.textMuted,
    lineHeight: 1.4,
    fontStyle: 'italic',
  },

  // Perception gap (misunderstood lens)
  perceptionGap: {
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  perceptionGapText: {
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  perceptionGapGroups: {
    fontSize: 8,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Triangulation / Stakeholder perspectives
  triangulationCard: {
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  triangulationTheme: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  triangulationSynthesis: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  alignmentScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  alignmentScoreBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.backgroundMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  alignmentScoreFill: {
    height: 6,
    borderRadius: 3,
  },
  alignmentScoreLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.text,
    width: 32,
    textAlign: 'right',
  },
  tensionPointItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  tensionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 6,
    marginTop: 4,
  },
  tensionText: {
    flex: 1,
    fontSize: 9,
    color: COLORS.textMuted,
    lineHeight: 1.3,
  },
  perspectiveItem: {
    marginBottom: 4,
  },
  perspectiveLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  perspectiveText: {
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  blindSpotItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  blindSpotIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  blindSpotText: {
    flex: 1,
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.4,
  },

  // Action plan
  timeframeSection: {
    marginBottom: 16,
  },
  timeframeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  timeframeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  timeframeBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeframeLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: COLORS.backgroundSubtle,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionNumberText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  actionText: {
    flex: 1,
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.4,
  },

  // Safeguarding
  safeguardingBanner: {
    backgroundColor: COLORS.atRiskBg,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  safeguardingBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.atRisk,
    lineHeight: 1.4,
  },
  safeguardingNote: {
    fontSize: 9,
    color: COLORS.textMuted,
    lineHeight: 1.5,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Stakeholder donut area
  donutSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
  },
  donutLegend: {
    flex: 1,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 9,
    color: COLORS.text,
    flex: 1,
  },
  legendValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.text,
  },
})

// ============================================================================
// HELPERS
// ============================================================================

function getUrgencyColor(level: string): string {
  switch (level) {
    case 'critical': return COLORS.urgencyCritical
    case 'high': return COLORS.urgencyHigh
    case 'medium': return COLORS.urgencyMedium
    default: return COLORS.urgencyLow
  }
}

function getModuleName(module: string): string {
  return MODULE_LABELS[module] || module.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatStakeholderType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
}

// Donut chart colors for stakeholder types
const DONUT_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  '#8B5CF6', // purple
  '#059669', // emerald
  '#D97706', // amber
  '#EC4899', // pink
]

// ============================================================================
// COMPONENT: PageHeader
// ============================================================================

function PageHeader({ schoolName, moduleName }: { schoolName: string; moduleName: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerBrand}>FlowForge</Text>
        <Text style={styles.headerDivider}>|</Text>
        <Text style={styles.headerSchool}>{schoolName}</Text>
      </View>
      <Text style={styles.headerRight}>{moduleName} Report</Text>
    </View>
  )
}

// ============================================================================
// COMPONENT: PageFooter
// ============================================================================

function PageFooter({ generatedDate }: { generatedDate: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>FlowForge by Innovaas</Text>
      <Text style={styles.footerText}>Confidential</Text>
      <Text style={styles.footerText}>{generatedDate}</Text>
    </View>
  )
}

// ============================================================================
// COMPONENT: StakeholderDonut (SVG)
// ============================================================================

function StakeholderDonutChart({ coverage }: { coverage: Record<string, number> }) {
  const entries = Object.entries(coverage)
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  if (total === 0) return null

  const cx = 50
  const cy = 50
  const outerR = 40
  const innerR = 24

  // Build arc segments
  let startAngle = -90 // Start from top
  const segments: Array<{ path: string; color: string }> = []

  entries.forEach(([, count], index) => {
    const sweep = (count / total) * 360
    const endAngle = startAngle + sweep

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1Outer = cx + outerR * Math.cos(startRad)
    const y1Outer = cy + outerR * Math.sin(startRad)
    const x2Outer = cx + outerR * Math.cos(endRad)
    const y2Outer = cy + outerR * Math.sin(endRad)
    const x1Inner = cx + innerR * Math.cos(endRad)
    const y1Inner = cy + innerR * Math.sin(endRad)
    const x2Inner = cx + innerR * Math.cos(startRad)
    const y2Inner = cy + innerR * Math.sin(startRad)

    const largeArc = sweep > 180 ? 1 : 0

    const d = [
      `M ${x1Outer} ${y1Outer}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
      `L ${x1Inner} ${y1Inner}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
      'Z',
    ].join(' ')

    segments.push({ path: d, color: DONUT_COLORS[index % DONUT_COLORS.length] })
    startAngle = endAngle
  })

  return (
    <View style={styles.donutSection}>
      <View style={styles.donutContainer}>
        <Svg width={100} height={100} viewBox="0 0 100 100">
          {segments.map((seg, i) => (
            <Path key={i} d={seg.path} fill={seg.color} />
          ))}
          {/* Center fill */}
          <Circle cx={cx} cy={cy} r={innerR - 2} fill={COLORS.backgroundSubtle} />
        </Svg>
        <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 4 }}>
          {total} sessions
        </Text>
      </View>
      <View style={styles.donutLegend}>
        {entries.map(([type, count], index) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }]} />
            <Text style={styles.legendLabel}>{formatStakeholderType(type)}</Text>
            <Text style={styles.legendValue}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ============================================================================
// COMPONENT: LensCard
// ============================================================================

interface LensCardProps {
  title: string
  headerColor: string
  bgColor: string
  borderColor: string
  description: string
  evidence: string[]
  badge?: string
  perceptionGaps?: Array<{ group_a: string; group_b: string; gap_description: string }>
}

function LensCard({ title, headerColor, bgColor, borderColor, description, evidence, badge, perceptionGaps }: LensCardProps) {
  return (
    <View style={[styles.lensCard, { borderColor }]} wrap={false}>
      <View style={[styles.lensHeader, { backgroundColor: headerColor }]}>
        <Text style={styles.lensTitle}>{title}</Text>
        {badge && (
          <View style={styles.lensBadge}>
            <Text style={styles.lensBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <View style={[styles.lensContent, { backgroundColor: bgColor }]}>
        <Text style={styles.lensDescription}>{description}</Text>

        {perceptionGaps && perceptionGaps.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.lensEvidenceLabel}>Perception Gaps</Text>
            {perceptionGaps.map((gap, i) => (
              <View key={i} style={styles.perceptionGap}>
                <Text style={styles.perceptionGapText}>{gap.gap_description}</Text>
                <Text style={styles.perceptionGapGroups}>
                  {formatStakeholderType(gap.group_a)} vs {formatStakeholderType(gap.group_b)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {evidence.length > 0 && (
          <View>
            <Text style={styles.lensEvidenceLabel}>Evidence</Text>
            {evidence.slice(0, 4).map((quote, i) => (
              <View key={i} style={styles.evidenceQuote}>
                <View style={[styles.evidenceQuoteBar, { backgroundColor: headerColor }]} />
                <Text style={styles.evidenceQuoteText}>&ldquo;{quote}&rdquo;</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

// ============================================================================
// COMPONENT: ActionTimeframe
// ============================================================================

function ActionTimeframe({
  label,
  timeframe,
  color,
  actions,
}: {
  label: string
  timeframe: string
  color: string
  actions: string[]
}) {
  if (actions.length === 0) return null
  return (
    <View style={styles.timeframeSection}>
      <View style={styles.timeframeHeader}>
        <View style={[styles.timeframeBadge, { backgroundColor: color }]}>
          <Text style={styles.timeframeBadgeText}>{timeframe}</Text>
        </View>
        <Text style={styles.timeframeLabel}>{label}</Text>
      </View>
      {actions.map((action, i) => (
        <View key={i} style={styles.actionItem}>
          <View style={[styles.actionNumber, { backgroundColor: color }]}>
            <Text style={styles.actionNumberText}>{i + 1}</Text>
          </View>
          <Text style={styles.actionText}>{action}</Text>
        </View>
      ))}
    </View>
  )
}

// ============================================================================
// MAIN DOCUMENT
// ============================================================================

export function EducationReportPDF({ data }: { data: EducationReportPDFData }) {
  const { school, campaign, module, synthesis, hasSafeguardingSignals, generatedDate } = data
  const moduleName = getModuleName(module)
  const urgencyColor = getUrgencyColor(synthesis.executive_summary.urgency_level)
  const depthPercent = Math.round(synthesis.data_quality.average_depth_score * 100)

  return (
    <Document>
      {/* ================================================================ */}
      {/* PAGE 1: Cover                                                     */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContent}>
          {/* Brand */}
          <View style={styles.coverBrand}>
            <Text style={styles.coverBrandText}>FLOWFORGE</Text>
            <Text style={styles.coverBrandSub}>Education Assessment Platform by Innovaas</Text>
          </View>

          {/* Main */}
          <View style={styles.coverMain}>
            <Text style={styles.coverSchoolName}>{school.name}</Text>
            <Text style={styles.coverModule}>{moduleName} Report</Text>
            <Text style={styles.coverCampaign}>{campaign.name}</Text>
            <Text style={styles.coverDate}>{generatedDate}</Text>

            {/* Urgency badge */}
            <View style={[styles.coverUrgencyBadge, { backgroundColor: urgencyColor }]}>
              <Text style={styles.coverUrgencyText}>
                Urgency: {synthesis.executive_summary.urgency_level}
              </Text>
            </View>
          </View>

          {/* Key Metrics */}
          <View style={styles.coverMetrics}>
            <View style={styles.coverMetricBox}>
              <Text style={styles.coverMetricValue}>
                {synthesis.data_quality.complete_sessions}/{synthesis.data_quality.total_sessions}
              </Text>
              <Text style={styles.coverMetricLabel}>Sessions Analyzed</Text>
            </View>
            <View style={styles.coverMetricBox}>
              <Text style={styles.coverMetricValue}>
                {Object.keys(synthesis.data_quality.stakeholder_coverage).length}
              </Text>
              <Text style={styles.coverMetricLabel}>Stakeholder Groups</Text>
            </View>
            <View style={styles.coverMetricBox}>
              <Text style={styles.coverMetricValue}>{depthPercent}%</Text>
              <Text style={styles.coverMetricLabel}>Depth Score</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.coverFooter}>
            <Text style={styles.coverFooterText}>
              {school.code}{school.country ? ` | ${school.country}` : ''}
              {school.curriculum ? ` | ${school.curriculum}` : ''}
            </Text>
            <Text style={styles.coverFooterText}>Confidential</Text>
          </View>
        </View>
      </Page>

      {/* ================================================================ */}
      {/* PAGE 2: Executive Summary                                         */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.page}>
        <PageHeader schoolName={school.name} moduleName={moduleName} />

        <Text style={styles.sectionTitle}>Executive Summary</Text>

        <Text style={styles.execHeadline}>
          {synthesis.executive_summary.headline}
        </Text>

        <Text style={styles.execKeyFinding}>
          {synthesis.executive_summary.key_finding}
        </Text>

        {/* Urgency badge */}
        <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
          <Text style={styles.urgencyText}>
            Urgency: {synthesis.executive_summary.urgency_level}
          </Text>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {synthesis.data_quality.complete_sessions}
            </Text>
            <Text style={styles.metricLabel}>Complete Sessions</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {synthesis.data_quality.total_sessions}
            </Text>
            <Text style={styles.metricLabel}>Total Sessions</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{depthPercent}%</Text>
            <Text style={styles.metricLabel}>Depth Score</Text>
          </View>
        </View>

        {/* Stakeholder Coverage */}
        <Text style={styles.sectionSubtitle}>Stakeholder Coverage</Text>
        <StakeholderDonutChart coverage={synthesis.data_quality.stakeholder_coverage} />

        {/* Primary Recommendation */}
        <View style={styles.recommendationCallout}>
          <Text style={styles.recommendationLabel}>Primary Recommendation</Text>
          <Text style={styles.recommendationText}>
            {synthesis.executive_summary.primary_recommendation}
          </Text>
        </View>

        <PageFooter generatedDate={generatedDate} />
      </Page>

      {/* ================================================================ */}
      {/* PAGE 3: Four Lenses (Holding + Slipping)                          */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.page}>
        <PageHeader schoolName={school.name} moduleName={moduleName} />

        <Text style={styles.sectionTitle}>The Four Lenses</Text>

        <LensCard
          title="What's Holding"
          headerColor={COLORS.holding}
          bgColor={COLORS.holdingBg}
          borderColor={COLORS.holding}
          description={synthesis.what_is_holding.description}
          evidence={synthesis.what_is_holding.evidence}
          badge={`${synthesis.what_is_holding.stakeholder_agreement}% agreement`}
        />

        <LensCard
          title="What's Slipping"
          headerColor={COLORS.slipping}
          bgColor={COLORS.slippingBg}
          borderColor={COLORS.slipping}
          description={synthesis.what_is_slipping.description}
          evidence={synthesis.what_is_slipping.evidence}
          badge={synthesis.what_is_slipping.risk_trajectory}
        />

        <PageFooter generatedDate={generatedDate} />
      </Page>

      {/* ================================================================ */}
      {/* PAGE 4: Four Lenses (Misunderstood + At Risk)                     */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.page}>
        <PageHeader schoolName={school.name} moduleName={moduleName} />

        <LensCard
          title="What's Misunderstood"
          headerColor={COLORS.misunderstood}
          bgColor={COLORS.misunderstoodBg}
          borderColor={COLORS.misunderstood}
          description={synthesis.what_is_misunderstood.description}
          evidence={synthesis.what_is_misunderstood.evidence}
          perceptionGaps={synthesis.what_is_misunderstood.perception_gaps}
        />

        <LensCard
          title="What's At Risk"
          headerColor={COLORS.atRisk}
          bgColor={COLORS.atRiskBg}
          borderColor={COLORS.atRisk}
          description={synthesis.what_is_at_risk.description}
          evidence={synthesis.what_is_at_risk.evidence}
          badge={synthesis.what_is_at_risk.safeguarding_signals > 0
            ? `${synthesis.what_is_at_risk.safeguarding_signals} safeguarding signals`
            : undefined
          }
        />

        <PageFooter generatedDate={generatedDate} />
      </Page>

      {/* ================================================================ */}
      {/* PAGE 5: Stakeholder Perspectives                                  */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.page}>
        <PageHeader schoolName={school.name} moduleName={moduleName} />

        <Text style={styles.sectionTitle}>Stakeholder Perspectives</Text>

        {/* Aligned Themes */}
        {synthesis.triangulation.aligned_themes.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.sectionSubtitle}>Aligned Themes</Text>
            {synthesis.triangulation.aligned_themes.map((theme, i) => (
              <View key={i} style={styles.triangulationCard} wrap={false}>
                <Text style={styles.triangulationTheme}>{theme.theme}</Text>

                {/* Alignment score bar */}
                <View style={styles.alignmentScoreRow}>
                  <View style={styles.alignmentScoreBar}>
                    <View style={[
                      styles.alignmentScoreFill,
                      {
                        width: `${theme.alignment_score}%`,
                        backgroundColor: theme.alignment_score >= 70 ? COLORS.holding : COLORS.slipping,
                      },
                    ]} />
                  </View>
                  <Text style={styles.alignmentScoreLabel}>{theme.alignment_score}%</Text>
                </View>

                <Text style={styles.triangulationSynthesis}>{theme.synthesis}</Text>

                {/* Perspectives */}
                {theme.student_perspective && (
                  <View style={styles.perspectiveItem}>
                    <Text style={styles.perspectiveLabel}>Student</Text>
                    <Text style={styles.perspectiveText}>{theme.student_perspective}</Text>
                  </View>
                )}
                {theme.teacher_perspective && (
                  <View style={styles.perspectiveItem}>
                    <Text style={styles.perspectiveLabel}>Teacher</Text>
                    <Text style={styles.perspectiveText}>{theme.teacher_perspective}</Text>
                  </View>
                )}
                {theme.parent_perspective && (
                  <View style={styles.perspectiveItem}>
                    <Text style={styles.perspectiveLabel}>Parent</Text>
                    <Text style={styles.perspectiveText}>{theme.parent_perspective}</Text>
                  </View>
                )}
                {theme.leadership_perspective && (
                  <View style={styles.perspectiveItem}>
                    <Text style={styles.perspectiveLabel}>Leadership</Text>
                    <Text style={styles.perspectiveText}>{theme.leadership_perspective}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Divergent Themes */}
        {synthesis.triangulation.divergent_themes.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.sectionSubtitle}>Divergent Themes</Text>
            {synthesis.triangulation.divergent_themes.map((theme, i) => (
              <View key={i} style={styles.triangulationCard} wrap={false}>
                <Text style={styles.triangulationTheme}>{theme.theme}</Text>

                <View style={styles.alignmentScoreRow}>
                  <View style={styles.alignmentScoreBar}>
                    <View style={[
                      styles.alignmentScoreFill,
                      {
                        width: `${theme.alignment_score}%`,
                        backgroundColor: theme.alignment_score >= 50 ? COLORS.slipping : COLORS.atRisk,
                      },
                    ]} />
                  </View>
                  <Text style={styles.alignmentScoreLabel}>{theme.alignment_score}%</Text>
                </View>

                <Text style={styles.triangulationSynthesis}>{theme.synthesis}</Text>

                {theme.tension_points.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    {theme.tension_points.map((tp, j) => (
                      <View key={j} style={styles.tensionPointItem}>
                        <View style={[styles.tensionDot, { backgroundColor: COLORS.atRisk }]} />
                        <Text style={styles.tensionText}>{tp}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Blind Spots */}
        {synthesis.triangulation.blind_spots.length > 0 && (
          <View>
            <Text style={styles.sectionSubtitle}>Blind Spots</Text>
            {synthesis.triangulation.blind_spots.map((spot, i) => (
              <View key={i} style={styles.blindSpotItem}>
                <View style={styles.blindSpotIcon}>
                  <Svg width={12} height={12} viewBox="0 0 24 24">
                    <Circle cx={12} cy={12} r={10} stroke={COLORS.slipping} strokeWidth={2} fill="none" />
                    <Path d="M12 8v4M12 16h.01" stroke={COLORS.slipping} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </View>
                <Text style={styles.blindSpotText}>{spot}</Text>
              </View>
            ))}
          </View>
        )}

        <PageFooter generatedDate={generatedDate} />
      </Page>

      {/* ================================================================ */}
      {/* PAGE 6: Action Plan                                               */}
      {/* ================================================================ */}
      <Page size="A4" style={styles.page}>
        <PageHeader schoolName={school.name} moduleName={moduleName} />

        <Text style={styles.sectionTitle}>Action Plan</Text>

        <ActionTimeframe
          label="Immediate Actions"
          timeframe="1 Week"
          color={COLORS.atRisk}
          actions={synthesis.recommendations.immediate_actions}
        />

        <ActionTimeframe
          label="Short-Term Actions"
          timeframe="1 Month"
          color={COLORS.slipping}
          actions={synthesis.recommendations.short_term}
        />

        <ActionTimeframe
          label="Strategic Actions"
          timeframe="Quarter"
          color={COLORS.secondary}
          actions={synthesis.recommendations.strategic}
        />

        <PageFooter generatedDate={generatedDate} />
      </Page>

      {/* ================================================================ */}
      {/* PAGE 7: Safeguarding (Conditional)                                */}
      {/* ================================================================ */}
      {hasSafeguardingSignals && synthesis.what_is_at_risk.safeguarding_signals > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader schoolName={school.name} moduleName={moduleName} />

          <Text style={styles.sectionTitle}>Safeguarding Concerns</Text>

          {/* Warning banner */}
          <View style={styles.safeguardingBanner}>
            <View style={{ marginTop: 2 }}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke={COLORS.atRisk}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.safeguardingBannerText}>
                {synthesis.what_is_at_risk.safeguarding_signals} potential safeguarding
                {synthesis.what_is_at_risk.safeguarding_signals === 1 ? ' signal' : ' signals'} identified
                {synthesis.what_is_at_risk.intervention_recommended
                  ? ' - Intervention Recommended'
                  : ''}
              </Text>
              <Text style={styles.safeguardingNote}>
                This automated analysis is not a substitute for professional assessment.
                Schools should follow their established safeguarding procedures and consult
                with designated safeguarding leads.
              </Text>
            </View>
          </View>

          {/* Evidence */}
          <Text style={styles.sectionSubtitle}>Identified Patterns</Text>
          {synthesis.what_is_at_risk.evidence.map((item, i) => (
            <View key={i} style={styles.evidenceQuote}>
              <View style={[styles.evidenceQuoteBar, { backgroundColor: COLORS.atRisk }]} />
              <Text style={styles.evidenceQuoteText}>&ldquo;{item}&rdquo;</Text>
            </View>
          ))}

          <PageFooter generatedDate={generatedDate} />
        </Page>
      )}
    </Document>
  )
}
