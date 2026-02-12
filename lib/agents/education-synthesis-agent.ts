import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase/server'

// ============================================================================
// EDUCATION SYNTHESIS AGENT
// Analyzes patterns across pseudonymous stakeholder interviews
// Never exposes individual identities - works with tokens and patterns
// ============================================================================

interface EducationSession {
  id: string
  participant_token_id: string
  education_session_context: {
    module: string
    participant_type: string
    cohort_metadata: {
      year_band?: string
      division?: string
      role_category?: string
      relationship_type?: string
    }
    progress: {
      questions_asked: number
      sections_completed: string[]
      estimated_completion: number
    }
  }
  session_context: {
    phase?: string
    topics_covered?: string[]
    is_complete?: boolean
  } | null
  created_at: string
  updated_at: string
}

interface EducationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface EducationTranscript {
  session: EducationSession
  messages: EducationMessage[]
  participant_type: string
  cohort_metadata: Record<string, string>
}

export interface StakeholderGroupAnalysis {
  participant_type: string
  session_count: number
  cohort_breakdown: Record<string, number>
  themes: string[]
  concerns: string[]
  strengths: string[]
  representative_quotes: string[] // Anonymized, no attribution
}

export interface TriangulationInsight {
  theme: string
  student_perspective?: string
  teacher_perspective?: string
  parent_perspective?: string
  leadership_perspective?: string
  alignment_score: number // 0-100
  tension_points: string[]
  synthesis: string
}

export interface EducationSynthesisResult {
  campaign_id: string
  school_id: string
  module: string
  generated_at: string

  // Executive Summary
  executive_summary: {
    headline: string
    key_finding: string
    primary_recommendation: string
    urgency_level: 'low' | 'medium' | 'high' | 'critical'
  }

  // Stakeholder Group Analyses
  stakeholder_analyses: StakeholderGroupAnalysis[]

  // Cross-Stakeholder Triangulation
  triangulation: {
    aligned_themes: TriangulationInsight[]
    divergent_themes: TriangulationInsight[]
    blind_spots: string[] // What one group sees that others don't
  }

  // The Four Lenses
  what_is_holding: {
    description: string
    evidence: string[]
    stakeholder_agreement: number
  }
  what_is_slipping: {
    description: string
    evidence: string[]
    stakeholder_agreement: number
    risk_trajectory: 'stable' | 'declining' | 'critical'
  }
  what_is_misunderstood: {
    description: string
    evidence: string[]
    perception_gaps: Array<{
      group_a: string
      group_b: string
      gap_description: string
    }>
  }
  what_is_at_risk: {
    description: string
    evidence: string[]
    safeguarding_signals: number
    intervention_recommended: boolean
  }

  // Recommendations
  recommendations: {
    immediate_actions: string[] // Within 1 week
    short_term: string[] // Within 1 month
    strategic: string[] // Within term/quarter
  }

  // Metadata
  data_quality: {
    total_sessions: number
    complete_sessions: number
    average_depth_score: number
    stakeholder_coverage: Record<string, number>
  }
}

// Module-specific analysis frameworks
const MODULE_FRAMEWORKS: Record<string, {
  key_dimensions: string[]
  triangulation_themes: string[]
  risk_indicators: string[]
}> = {
  student_wellbeing: {
    key_dimensions: [
      'Sense of belonging and connection',
      'Academic confidence and engagement',
      'Peer relationships and social dynamics',
      'Adult trust and support systems',
      'Mental health and emotional regulation',
      'Future outlook and aspirations'
    ],
    triangulation_themes: [
      'How students experience vs how adults perceive wellbeing',
      'Gap between stated support and felt support',
      'Academic pressure balance',
      'Peer dynamics visibility to adults',
      'Communication channel effectiveness'
    ],
    risk_indicators: [
      'Isolation patterns',
      'Academic disengagement',
      'Trust breakdown with adults',
      'Peer exclusion dynamics',
      'Help-seeking barriers'
    ]
  },
  teaching_learning: {
    key_dimensions: [
      'Pedagogical approaches and innovation',
      'Assessment and feedback practices',
      'Differentiation and inclusion',
      'Technology integration',
      'Teacher workload and sustainability',
      'Professional development needs'
    ],
    triangulation_themes: [
      'Teaching effectiveness perception gaps',
      'Assessment purpose understanding',
      'Technology as enabler vs burden',
      'Parent-teacher partnership quality',
      'Student agency in learning'
    ],
    risk_indicators: [
      'Teacher burnout signals',
      'Curriculum coverage anxiety',
      'Technology friction',
      'Parent miscommunication',
      'Student passivity patterns'
    ]
  },
  parent_confidence: {
    key_dimensions: [
      'Communication clarity and frequency',
      'Understanding of educational approach',
      'Trust in school decision-making',
      'Visibility into child\'s experience',
      'Partnership feeling',
      'Value alignment'
    ],
    triangulation_themes: [
      'Communication satisfaction gaps',
      'Understanding of school priorities',
      'Confidence in pastoral care',
      'Academic progress visibility',
      'Crisis response trust'
    ],
    risk_indicators: [
      'Communication breakdown',
      'Trust erosion',
      'Misaligned expectations',
      'Hidden dissatisfaction',
      'Withdrawal patterns'
    ]
  }
}

/**
 * Generate system prompt for education synthesis
 */
function generateSynthesisPrompt(
  module: string,
  stakeholderGroups: string[],
  sessionCount: number
): string {
  const framework = MODULE_FRAMEWORKS[module] || MODULE_FRAMEWORKS.student_wellbeing

  return `You are an expert educational researcher and organizational psychologist conducting synthesis analysis for a ${module.replace('_', ' ')} assessment.

ANALYSIS CONTEXT:
- Module Focus: ${module.replace('_', ' ')}
- Stakeholder Groups Represented: ${stakeholderGroups.join(', ')}
- Total Interview Sessions: ${sessionCount}

YOUR MISSION:
Synthesize patterns across pseudonymous stakeholder interviews to surface actionable insights for school leadership. You are analyzing PATTERNS, not individuals. Never reference specific participants or attempt to identify anyone.

KEY DIMENSIONS TO ANALYZE:
${framework.key_dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

TRIANGULATION THEMES:
${framework.triangulation_themes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

RISK INDICATORS TO WATCH:
${framework.risk_indicators.map((r, i) => `${i + 1}. ${r}`).join('\n')}

THE FOUR LENSES FRAMEWORK (CRITICAL - populate each with actual evidence from transcripts):

1. WHAT'S HOLDING (what_is_holding):
   - What is working well? What foundations are strong? What should be protected and celebrated?
   - Extract 3-5 specific quotes that show what's working well

2. WHAT'S SLIPPING (what_is_slipping):
   - What was working but is declining? What risks are emerging? What needs attention before it becomes critical?
   - Extract 3-5 specific quotes that show emerging concerns or declining areas

3. WHAT'S MISUNDERSTOOD (what_is_misunderstood):
   - Where are perception gaps between stakeholder groups? What do some see that others don't?
   - Extract quotes showing differing perspectives between groups

4. WHAT'S AT RISK (what_is_at_risk):
   - What requires immediate attention? What safeguarding signals emerged?
   - Extract quotes that reveal concerning patterns or safeguarding issues
   - Count actual safeguarding signals mentioned (bullying, mental health concerns, safety issues)

TRIANGULATION PRINCIPLES:
- When all stakeholder groups agree → High confidence insight
- When adults agree but students differ → Trust/communication issue
- When leadership differs from frontline → Implementation gap
- When parents differ from school staff → Expectation/communication mismatch

CRITICAL REQUIREMENTS:
- NEVER identify individuals or use specific names
- Reference stakeholder GROUPS and PATTERNS only
- Include representative quotes but WITHOUT any attribution
- Balance critique with recognition of strengths
- Make recommendations actionable and specific
- Flag any safeguarding concerns prominently
- EVIDENCE ARRAYS MUST contain actual quotes from the transcripts (3-5 per lens minimum)

REQUIRED JSON OUTPUT STRUCTURE:
{
  "executive_summary": {
    "headline": "One sentence headline",
    "key_finding": "Most important finding",
    "primary_recommendation": "Top priority action",
    "urgency_level": "low" | "medium" | "high" | "critical"
  },
  "stakeholder_analyses": [
    {
      "participant_type": "student" | "teacher" | "parent" | "leadership",
      "session_count": number,
      "cohort_breakdown": {"Year 10": 2, "Year 11": 1},
      "themes": ["theme1", "theme2"],
      "concerns": ["concern1", "concern2"],
      "strengths": ["strength1", "strength2"],
      "representative_quotes": ["quote without attribution", "another quote"]
    }
  ],
  "triangulation": {
    "aligned_themes": [
      {
        "theme": "Theme name",
        "student_perspective": "What students said",
        "teacher_perspective": "What teachers said",
        "parent_perspective": "What parents said",
        "alignment_score": 85,
        "tension_points": [],
        "synthesis": "Summary of aligned view"
      }
    ],
    "divergent_themes": [
      {
        "theme": "Theme where groups disagree",
        "student_perspective": "Students see...",
        "teacher_perspective": "Teachers see...",
        "alignment_score": 35,
        "tension_points": ["specific tension"],
        "synthesis": "Analysis of divergence"
      }
    ],
    "blind_spots": ["What one group sees that others don't"]
  },
  "what_is_holding": {
    "description": "2-3 sentence summary of what's working well",
    "evidence": [
      "Direct quote from transcript showing positive aspect",
      "Another quote showing strength",
      "Quote demonstrating good practice"
    ],
    "stakeholder_agreement": 0-100
  },
  "what_is_slipping": {
    "description": "2-3 sentence summary of declining areas",
    "evidence": [
      "Quote showing concern or decline",
      "Another quote showing emerging issue",
      "Quote revealing attention needed"
    ],
    "stakeholder_agreement": 0-100,
    "risk_trajectory": "stable" | "declining" | "critical"
  },
  "what_is_misunderstood": {
    "description": "2-3 sentence summary of perception gaps",
    "evidence": [
      "Quote showing one perspective",
      "Quote showing different perspective",
      "Quote revealing assumption"
    ],
    "perception_gaps": [
      {
        "group_a": "students",
        "group_b": "teachers",
        "gap_description": "What the gap is"
      }
    ]
  },
  "what_is_at_risk": {
    "description": "2-3 sentence summary of immediate concerns",
    "evidence": [
      "Quote revealing concerning pattern",
      "Quote about safety or wellbeing issue",
      "Quote showing urgent matter"
    ],
    "safeguarding_signals": number (count of distinct safeguarding concerns),
    "intervention_recommended": true | false
  },
  "recommendations": {
    "immediate_actions": ["Action within 1 week"],
    "short_term": ["Action within 1 month"],
    "strategic": ["Action within term/quarter"]
  }
}

IMPORTANT: The "evidence" arrays in each Four Lenses section MUST contain 3-5 actual quotes extracted from the interview transcripts. These quotes should be verbatim or lightly paraphrased, never attributed to individuals, and should clearly support the description provided.`
}

/**
 * Prepare transcripts for analysis (anonymize and structure)
 */
function prepareTranscriptsForAnalysis(
  transcripts: EducationTranscript[]
): string {
  const groupedByType: Record<string, EducationTranscript[]> = {}

  // Group by participant type
  transcripts.forEach(t => {
    const type = t.participant_type
    if (!groupedByType[type]) {
      groupedByType[type] = []
    }
    groupedByType[type].push(t)
  })

  // Format for analysis
  const sections: string[] = []

  Object.entries(groupedByType).forEach(([type, typeTranscripts]) => {
    sections.push(`\n## ${type.toUpperCase()} PERSPECTIVES (${typeTranscripts.length} sessions)\n`)

    typeTranscripts.forEach((t, index) => {
      const cohortInfo = Object.entries(t.cohort_metadata)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')

      sections.push(`### Session ${index + 1} [${cohortInfo || 'General'}]`)

      // Include only substantive user responses (not AI questions)
      const userResponses = t.messages
        .filter(m => m.role === 'user')
        .map(m => m.content)

      sections.push('Key Responses:')
      userResponses.forEach((r, i) => {
        sections.push(`- "${r}"`)
      })
      sections.push('')
    })
  })

  return sections.join('\n')
}

/**
 * Normalize recommendations to ensure correct structure
 * Handles case where Claude returns array instead of object
 */
function normalizeRecommendations(
  recommendations: unknown
): { immediate_actions: string[]; short_term: string[]; strategic: string[] } {
  const defaultRecs = {
    immediate_actions: [],
    short_term: [],
    strategic: []
  }

  if (!recommendations) {
    return defaultRecs
  }

  // If it's already the correct object structure
  if (
    typeof recommendations === 'object' &&
    !Array.isArray(recommendations) &&
    ('immediate_actions' in recommendations || 'short_term' in recommendations || 'strategic' in recommendations)
  ) {
    const recs = recommendations as Record<string, unknown>
    return {
      immediate_actions: Array.isArray(recs.immediate_actions) ? recs.immediate_actions as string[] : [],
      short_term: Array.isArray(recs.short_term) ? recs.short_term as string[] : [],
      strategic: Array.isArray(recs.strategic) ? recs.strategic as string[] : []
    }
  }

  // If it's an array of strings, distribute them across categories
  if (Array.isArray(recommendations)) {
    const strings = recommendations.filter((r): r is string => typeof r === 'string')
    // Put first 2 in immediate, next 2 in short_term, rest in strategic
    return {
      immediate_actions: strings.slice(0, 2),
      short_term: strings.slice(2, 4),
      strategic: strings.slice(4)
    }
  }

  return defaultRecs
}

/**
 * Calculate data quality metrics
 */
function calculateDataQuality(transcripts: EducationTranscript[]): {
  total_sessions: number
  complete_sessions: number
  average_depth_score: number
  stakeholder_coverage: Record<string, number>
} {
  const coverage: Record<string, number> = {}
  let totalDepth = 0
  let completeCount = 0

  transcripts.forEach(t => {
    // Count by type
    const type = t.participant_type
    coverage[type] = (coverage[type] || 0) + 1

    // Check completion - use education_session_context.progress.estimated_completion
    // Consider 70%+ completion as "complete" for reporting purposes
    const eduContext = t.session.education_session_context as {
      progress?: { estimated_completion?: number }
    } | undefined
    const estimatedCompletion = eduContext?.progress?.estimated_completion || 0
    if (estimatedCompletion >= 0.7) {
      completeCount++
    }

    // Calculate depth (questions answered)
    const userMessages = t.messages.filter(m => m.role === 'user').length
    totalDepth += Math.min(userMessages / 15, 1) // Normalize to 0-1
  })

  return {
    total_sessions: transcripts.length,
    complete_sessions: completeCount,
    average_depth_score: transcripts.length > 0 ? totalDepth / transcripts.length : 0,
    stakeholder_coverage: coverage
  }
}

/**
 * Generate education synthesis from campaign transcripts
 */
export async function generateEducationSynthesis(
  campaignId: string,
  schoolId: string,
  module: string,
  model: 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514' = 'claude-sonnet-4-20250514'
): Promise<EducationSynthesisResult> {
  // First get participant tokens for this campaign
  // @ts-ignore - education_participant_tokens table not yet in generated types
  const { data: tokensData, error: tokensError } = await supabaseAdmin
    .from('education_participant_tokens')
    .select('id')
    .eq('campaign_id', campaignId)

  const tokens = tokensData as Array<{ id: string }> | null

  if (tokensError) {
    console.error('Error fetching campaign tokens:', tokensError)
    throw new Error('Failed to fetch campaign participant tokens')
  }

  const tokenIds = tokens?.map(t => t.id) || []

  if (tokenIds.length === 0) {
    throw new Error('No participant tokens found for this campaign')
  }

  // Fetch all sessions for this campaign's tokens
  // @ts-ignore - agent_sessions education fields not yet in generated types
  const { data: sessionsData, error: sessionsError } = await supabaseAdmin
    .from('agent_sessions')
    .select(`
      id,
      participant_token_id,
      education_session_context,
      session_context,
      created_at,
      updated_at
    `)
    .in('participant_token_id', tokenIds)
    .not('participant_token_id', 'is', null)
    .order('created_at', { ascending: true })

  // Type assertion for sessions
  const allSessions = sessionsData as Array<{
    id: string
    participant_token_id: string
    education_session_context: Record<string, unknown>
    session_context: Record<string, unknown>
    created_at: string
    updated_at: string
  }> | null

  if (sessionsError) {
    console.error('Error fetching sessions:', sessionsError)
    throw new Error('Failed to fetch education sessions')
  }

  // Filter by module in JS (Supabase client doesn't support JSONB ->> syntax)
  const sessions = (allSessions || []).filter(s => {
    const context = s.education_session_context as { module?: string } | null
    return context?.module === module
  })

  if (sessions.length === 0) {
    throw new Error(`No education sessions found for module "${module}" in this campaign`)
  }

  // Fetch messages for each session
  console.log(`[Synthesis] Fetching messages for ${sessions.length} sessions`)
  const allTranscripts: EducationTranscript[] = await Promise.all(
    sessions.map(async (session) => {
      const { data: messagesData } = await supabaseAdmin
        .from('agent_messages')
        .select('role, content, created_at')
        .eq('agent_session_id', session.id)
        .order('created_at', { ascending: true })

      // Type assertion for messages
      const messages = messagesData as Array<{
        role: string
        content: string
        created_at: string
      }> | null

      const context = session.education_session_context as EducationSession['education_session_context']

      return {
        session: session as unknown as EducationSession,
        messages: (messages || []).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.created_at
        })),
        participant_type: context?.participant_type || 'unknown',
        cohort_metadata: context?.cohort_metadata || {}
      }
    })
  )

  // Filter to only include transcripts with actual user messages
  const transcripts = allTranscripts.filter(t => {
    const userMessages = t.messages.filter(m => m.role === 'user')
    return userMessages.length > 0
  })

  console.log(`[Synthesis] ${transcripts.length} of ${allTranscripts.length} sessions have user messages`)

  if (transcripts.length === 0) {
    throw new Error('No sessions with user messages found - interviews may be incomplete')
  }

  // Get unique stakeholder types
  const stakeholderGroups = [...new Set(transcripts.map(t => t.participant_type))]

  // Prepare anonymized transcript data
  const preparedData = prepareTranscriptsForAnalysis(transcripts)

  // Calculate data quality
  const dataQuality = calculateDataQuality(transcripts)

  // Generate synthesis prompt
  const systemPrompt = generateSynthesisPrompt(module, stakeholderGroups, transcripts.length)

  // Call Claude for synthesis
  console.log(`[Synthesis] Calling Claude API with model: ${model}`)
  console.log(`[Synthesis] Prepared data length: ${preparedData.length} chars`)
  console.log(`[Synthesis] Stakeholder groups: ${stakeholderGroups.join(', ')}`)

  let response
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze the following pseudonymous interview transcripts and generate a comprehensive synthesis:

${preparedData}

---

Generate your synthesis as JSON matching the EducationSynthesisResult interface. Focus on patterns and themes, never individuals.`
        }
      ]
    })
    console.log(`[Synthesis] Claude API call successful, response type: ${response.content[0]?.type}`)
  } catch (claudeError) {
    console.error('[Synthesis] Claude API error:', claudeError)
    throw new Error(`Claude API call failed: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}`)
  }

  // Extract response text
  const responseText = response.content[0].type === 'text'
    ? response.content[0].text
    : ''

  console.log(`[Synthesis] Response text length: ${responseText.length} chars`)
  console.log(`[Synthesis] Response preview: ${responseText.substring(0, 200)}...`)

  // Parse JSON (handle potential markdown wrapper)
  let synthesisData: Partial<EducationSynthesisResult>
  try {
    // Try direct parse first
    synthesisData = JSON.parse(responseText)
    console.log('[Synthesis] Direct JSON parse successful')
  } catch (parseError) {
    console.log('[Synthesis] Direct parse failed, trying markdown extraction')
    // Try extracting from markdown code block
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        synthesisData = JSON.parse(jsonMatch[1])
        console.log('[Synthesis] Markdown JSON extraction successful')
      } catch (mdParseError) {
        console.error('[Synthesis] Markdown JSON parse error:', mdParseError)
        console.error('[Synthesis] Extracted content preview:', jsonMatch[1].substring(0, 500))
        throw new Error(`Failed to parse extracted JSON: ${mdParseError instanceof Error ? mdParseError.message : 'Unknown error'}`)
      }
    } else {
      console.error('[Synthesis] No JSON code block found in response')
      console.error('[Synthesis] Full response:', responseText.substring(0, 1000))
      throw new Error('Failed to parse synthesis response as JSON - no code block found')
    }
  }

  // Construct final result with metadata
  const result: EducationSynthesisResult = {
    campaign_id: campaignId,
    school_id: schoolId,
    module,
    generated_at: new Date().toISOString(),
    executive_summary: synthesisData.executive_summary || {
      headline: 'Analysis Complete',
      key_finding: 'See detailed findings below',
      primary_recommendation: 'Review triangulation insights',
      urgency_level: 'medium'
    },
    stakeholder_analyses: synthesisData.stakeholder_analyses || [],
    triangulation: synthesisData.triangulation || {
      aligned_themes: [],
      divergent_themes: [],
      blind_spots: []
    },
    what_is_holding: synthesisData.what_is_holding || {
      description: '',
      evidence: [],
      stakeholder_agreement: 0
    },
    what_is_slipping: synthesisData.what_is_slipping || {
      description: '',
      evidence: [],
      stakeholder_agreement: 0,
      risk_trajectory: 'stable'
    },
    what_is_misunderstood: synthesisData.what_is_misunderstood || {
      description: '',
      evidence: [],
      perception_gaps: []
    },
    what_is_at_risk: synthesisData.what_is_at_risk || {
      description: '',
      evidence: [],
      safeguarding_signals: 0,
      intervention_recommended: false
    },
    recommendations: normalizeRecommendations(synthesisData.recommendations),
    data_quality: dataQuality
  }

  return result
}

/**
 * Generate cohort-specific analysis (e.g., Year 10 students only)
 */
export async function generateCohortAnalysis(
  campaignId: string,
  schoolId: string,
  module: string,
  cohortFilter: Record<string, string>
): Promise<Partial<EducationSynthesisResult>> {
  // This would filter transcripts by cohort before analysis
  // Useful for diving deeper into specific year groups, divisions, etc.

  const filterDescription = Object.entries(cohortFilter)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')

  console.log(`Generating cohort analysis for: ${filterDescription}`)

  // Implementation would follow same pattern as generateEducationSynthesis
  // but with filtered data
  throw new Error('Cohort analysis not yet implemented')
}

/**
 * Longitudinal data point for trend analysis
 */
export interface LongitudinalDataPoint {
  synthesisId: string
  generatedAt: string
  termLabel: string
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
  holdingScore: number
  slippingScore: number
  riskScore: number
  misunderstoodScore: number
}

/**
 * Longitudinal comparison result
 */
export interface LongitudinalComparisonResult {
  dataPoints: LongitudinalDataPoint[]
  trend_analysis: {
    improving: string[]
    declining: string[]
    stable: string[]
  }
  key_changes: string[]
  recommendations: string[]
  hasSufficientData: boolean
}

/**
 * Generate term label from date
 */
function getTermLabel(date: Date): string {
  const month = date.getMonth()
  const year = date.getFullYear()

  // UK academic terms approximation
  if (month >= 0 && month <= 3) {
    return `Spring ${year}`
  } else if (month >= 4 && month <= 7) {
    return `Summer ${year}`
  } else {
    return `Autumn ${year}`
  }
}

/**
 * Compare synthesis across multiple time periods
 */
export async function generateLongitudinalComparison(
  schoolId: string,
  module: string,
  synthesisIds?: string[]
): Promise<LongitudinalComparisonResult> {
  // Fetch all synthesis records for this school/module, ordered by date
  const { data: synthesesData, error } = await supabaseAdmin
    .from('education_synthesis')
    .select('id, content, generated_at')
    .eq('school_id', schoolId)
    .eq('module', module)
    .order('generated_at', { ascending: true })

  if (error) {
    console.error('Error fetching longitudinal data:', error)
    throw new Error('Failed to fetch longitudinal data')
  }

  const syntheses = synthesesData as Array<{
    id: string
    content: Record<string, unknown>
    generated_at: string
  }> | null

  // Handle case with insufficient data
  if (!syntheses || syntheses.length < 2) {
    return {
      dataPoints: syntheses ? syntheses.map(s => {
        const content = s.content as unknown as EducationSynthesisResult
        return {
          synthesisId: s.id,
          generatedAt: s.generated_at,
          termLabel: getTermLabel(new Date(s.generated_at)),
          urgencyLevel: content.executive_summary?.urgency_level || 'medium',
          holdingScore: content.what_is_holding?.stakeholder_agreement || 0,
          slippingScore: content.what_is_slipping?.stakeholder_agreement || 0,
          riskScore: content.what_is_at_risk?.safeguarding_signals || 0,
          misunderstoodScore: content.what_is_misunderstood?.perception_gaps?.length || 0,
        }
      }) : [],
      trend_analysis: {
        improving: [],
        declining: [],
        stable: [],
      },
      key_changes: [],
      recommendations: [],
      hasSufficientData: false,
    }
  }

  // Extract data points from each synthesis
  const dataPoints: LongitudinalDataPoint[] = syntheses.map(s => {
    const content = s.content as unknown as EducationSynthesisResult
    return {
      synthesisId: s.id,
      generatedAt: s.generated_at,
      termLabel: getTermLabel(new Date(s.generated_at)),
      urgencyLevel: content.executive_summary?.urgency_level || 'medium',
      holdingScore: content.what_is_holding?.stakeholder_agreement || 0,
      slippingScore: content.what_is_slipping?.stakeholder_agreement || 0,
      riskScore: content.what_is_at_risk?.safeguarding_signals || 0,
      misunderstoodScore: content.what_is_misunderstood?.perception_gaps?.length || 0,
    }
  })

  // Analyze trends by comparing first and last data points
  const first = dataPoints[0]
  const last = dataPoints[dataPoints.length - 1]

  const improving: string[] = []
  const declining: string[] = []
  const stable: string[] = []

  // Holding score - higher is better
  if (last.holdingScore > first.holdingScore + 5) {
    improving.push('What\'s Holding - stakeholder agreement improved')
  } else if (last.holdingScore < first.holdingScore - 5) {
    declining.push('What\'s Holding - stakeholder agreement declined')
  } else {
    stable.push('What\'s Holding - stakeholder agreement stable')
  }

  // Slipping score - lower is better
  if (last.slippingScore < first.slippingScore - 5) {
    improving.push('What\'s Slipping - fewer concerns')
  } else if (last.slippingScore > first.slippingScore + 5) {
    declining.push('What\'s Slipping - more concerns emerging')
  } else {
    stable.push('What\'s Slipping - concern level stable')
  }

  // Risk score - lower is better
  if (last.riskScore < first.riskScore) {
    improving.push('What\'s At Risk - fewer safeguarding signals')
  } else if (last.riskScore > first.riskScore) {
    declining.push('What\'s At Risk - more safeguarding signals')
  } else {
    stable.push('What\'s At Risk - signal count unchanged')
  }

  // Urgency level changes
  const urgencyOrder = ['low', 'medium', 'high', 'critical']
  const firstUrgency = urgencyOrder.indexOf(first.urgencyLevel)
  const lastUrgency = urgencyOrder.indexOf(last.urgencyLevel)

  const key_changes: string[] = []
  if (lastUrgency < firstUrgency) {
    key_changes.push(`Urgency level improved from ${first.urgencyLevel} to ${last.urgencyLevel}`)
  } else if (lastUrgency > firstUrgency) {
    key_changes.push(`Urgency level increased from ${first.urgencyLevel} to ${last.urgencyLevel}`)
  }

  // Generate recommendations based on trends
  const recommendations: string[] = []
  if (declining.length > improving.length) {
    recommendations.push('Consider scheduling a review meeting to address declining trends')
  }
  if (last.riskScore > 0) {
    recommendations.push('Prioritize safeguarding follow-up actions')
  }
  if (improving.length > 0) {
    recommendations.push('Document successful interventions for future reference')
  }

  console.log(`Generated longitudinal comparison for ${dataPoints.length} assessments for school ${schoolId}`)

  return {
    dataPoints,
    trend_analysis: {
      improving,
      declining,
      stable,
    },
    key_changes,
    recommendations,
    hasSufficientData: true,
  }
}

/**
 * Save synthesis result to database
 */
export async function saveSynthesisResult(
  result: EducationSynthesisResult,
  sourceTokenIds: string[]
): Promise<string> {
  // @ts-ignore - synthesis table not yet in generated types
  const { data, error } = await supabaseAdmin
    .from('synthesis')
    // @ts-ignore - synthesis table not yet in generated types
    .insert({
      campaign_id: result.campaign_id,
      synthesis_type: 'education_module',
      content: result as unknown as Record<string, unknown>,
      model_used: 'claude-sonnet-4-5-20250929',
      source_token_ids: sourceTokenIds,
      metadata: {
        module: result.module,
        school_id: result.school_id,
        stakeholder_coverage: result.data_quality.stakeholder_coverage
      }
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving synthesis:', error)
    throw new Error('Failed to save synthesis result')
  }

  return (data as { id: string }).id
}
