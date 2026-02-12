import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  generateConstitutionPrompt,
  getDomains,
  getNextUnexploredDomain,
  getDomainCoveragePercentage,
  getConstitution,
  type ConstitutionDomain
} from './education-constitutions'

// ============================================================================
// TYPES
// ============================================================================

export type ParticipantType = 'student' | 'teacher' | 'parent' | 'leadership'

export type EducationModule =
  | 'student_wellbeing'
  | 'teaching_learning'
  | 'parent_confidence'

export interface CohortMetadata {
  year_band?: string
  division?: string
  role_category?: string
}

export interface EducationParticipant {
  token: string
  participant_type: ParticipantType
  cohort_metadata: CohortMetadata
  campaign_id: string
  school_id: string
}

export interface EducationCampaign {
  id: string
  name: string
  school: {
    id: string
    name: string
    curriculum?: string
    country: string
  }
  education_config: {
    modules: EducationModule[]
    pilot_type: string
  }
}

export interface DomainExploration {
  domain_id: string
  domain_name: string
  explored: boolean
  depth: number  // 0=not explored, 1=touched, 2=explored, 3=deep-dived
  response_type?: 'positive' | 'neutral' | 'negative'
}

export interface ConversationState {
  phase: ConversationPhase
  sections_completed: string[]
  questions_asked: number
  rapport_established: boolean
  anonymity_confirmed: boolean
  last_interaction?: string
  is_complete?: boolean
  current_section?: string
  safeguarding_flags: SafeguardingFlag[]
  // New domain tracking fields
  domains_explored: DomainExploration[]
  current_domain_id?: string
  domain_coverage_percent: number
}

export type ConversationPhase =
  | 'opening'
  | 'rapport'
  | 'daily_experience'
  | 'core_exploration'
  | 'relationships'
  | 'wellbeing_check'
  | 'open_exploration'
  | 'closing'
  | 'completed'

export interface MessageHistory {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface SafeguardingFlag {
  type: SafeguardingTriggerType
  content: string
  confidence: number
  detected_at: string
}

export type SafeguardingTriggerType =
  | 'self_harm'
  | 'harm_to_others'
  | 'abuse_disclosure'
  | 'immediate_danger'
  | 'explicit_request'

// ============================================================================
// SAFEGUARDING DETECTION
// ============================================================================

const SAFEGUARDING_PATTERNS: Array<{
  pattern: RegExp
  type: SafeguardingTriggerType
  confidence: number
}> = [
  // Self-harm indicators
  { pattern: /\b(hurt(ing)? myself|harm(ing)? myself|cut(ting)? myself)\b/i, type: 'self_harm', confidence: 0.9 },
  { pattern: /\b(don'?t want to (be here|live|exist)|end (it|my life|everything))\b/i, type: 'self_harm', confidence: 0.85 },
  { pattern: /\b(suicid|kill myself|take my (own )?life)\b/i, type: 'self_harm', confidence: 0.95 },
  { pattern: /\b(nobody (would|will) (care|notice|miss me))\b/i, type: 'self_harm', confidence: 0.75 },
  { pattern: /\b(better off (without me|dead|gone))\b/i, type: 'self_harm', confidence: 0.85 },

  // Harm to others
  { pattern: /\b(hurt(ing)? (someone|them|him|her)|want to (hurt|harm|kill))\b/i, type: 'harm_to_others', confidence: 0.8 },
  { pattern: /\b(bring a (weapon|gun|knife)|shoot|stab)\b/i, type: 'harm_to_others', confidence: 0.9 },

  // Abuse disclosure
  { pattern: /\b(hit(s)? me|beat(s)? me|abuse|molest|touch(ed|es|ing) me (wrong|inappropriately))\b/i, type: 'abuse_disclosure', confidence: 0.85 },
  { pattern: /\b(scared? (to go home|of my|of going))\b/i, type: 'abuse_disclosure', confidence: 0.7 },
  { pattern: /\b(makes? me (do things|feel unsafe|uncomfortable))\b/i, type: 'abuse_disclosure', confidence: 0.65 },

  // Immediate danger
  { pattern: /\b(emergency|immediate (help|danger)|right now|happening now)\b/i, type: 'immediate_danger', confidence: 0.8 },
  { pattern: /\b(can'?t (stay|be) safe|not safe (here|at home|anywhere))\b/i, type: 'immediate_danger', confidence: 0.85 },

  // Explicit request for help
  { pattern: /\b(need (help|someone|to talk)|please (help|contact|call))\b/i, type: 'explicit_request', confidence: 0.7 },
  { pattern: /\b(want (someone|an adult|a teacher) to (know|help|contact))\b/i, type: 'explicit_request', confidence: 0.8 },
]

/**
 * Detect safeguarding concerns in a message
 */
export function detectSafeguardingConcerns(message: string): SafeguardingFlag[] {
  const flags: SafeguardingFlag[] = []

  for (const { pattern, type, confidence } of SAFEGUARDING_PATTERNS) {
    const match = message.match(pattern)
    if (match) {
      flags.push({
        type,
        content: match[0],
        confidence,
        detected_at: new Date().toISOString()
      })
    }
  }

  return flags
}

/**
 * Create safeguarding alert in database
 */
export async function createSafeguardingAlert(
  participant: EducationParticipant,
  flag: SafeguardingFlag,
  triggerContent: string,
  triggerContext: string
): Promise<string | null> {
  try {
    // @ts-ignore - education_safeguarding_alerts table not yet in generated types
    const { data, error } = await supabaseAdmin
      .from('education_safeguarding_alerts')
      // @ts-ignore - education_safeguarding_alerts table not yet in generated types
      .insert({
        campaign_id: participant.campaign_id,
        school_id: participant.school_id,
        participant_token: participant.token,
        participant_type: participant.participant_type,
        cohort_metadata: participant.cohort_metadata,
        trigger_type: flag.type,
        trigger_content: triggerContent,
        trigger_context: triggerContext,
        trigger_confidence: flag.confidence,
        ai_analysis: {
          matched_pattern: flag.content,
          detection_method: 'pattern_match'
        }
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create safeguarding alert:', error)
      return null
    }

    return (data as { id: string } | null)?.id || null
  } catch (error) {
    console.error('Error creating safeguarding alert:', error)
    return null
  }
}

// ============================================================================
// TRUST-FIRST PROMPTS
// ============================================================================

const TRUST_FRAMING = {
  student: {
    anonymity_statement: `Before we start, I want you to know: this conversation is completely anonymous.
Your teachers can't see what you say. Your name isn't attached to any of this.
I'm just here to understand what school is actually like for you.
There are no right or wrong answers. I'm curious about your real experience.`,
    consequence_firewall: [
      'This has nothing to do with grades',
      'This has nothing to do with behaviour records',
      'This won\'t affect your standing at school',
      'No teacher or staff member will see your individual responses'
    ]
  },
  teacher: {
    anonymity_statement: `Before we begin: this conversation is anonymised. Leadership sees patterns, not individuals.
Your responses aren't linked to your name, and nothing here affects your position.
We're looking for structural patterns - where systems work and where they strain.
This isn't about evaluating anyone. It's about understanding the terrain.`,
    consequence_firewall: [
      'This is not a staff evaluation',
      'This is not an HR tool',
      'This will not influence contract decisions',
      'Workload patterns will not be used to justify "efficiency" measures'
    ]
  },
  parent: {
    anonymity_statement: `This conversation is completely anonymous. Your responses aren't linked to your name or your child.
We're looking for patterns in parent experience, not individual opinions.
We're interested in your honest observations - not endorsements.
The school is trying to understand how things are landing, not collect testimonials.`,
    consequence_firewall: [
      'Your comments will not affect how your child is treated',
      'This will not be used in marketing materials',
      'This is not a feedback form or satisfaction survey'
    ]
  },
  leadership: {
    anonymity_statement: `This conversation explores how leadership intent lands across the school community.
We're looking for patterns of alignment and strain you may not currently see.
The synthesis will help you understand where perception and reality may diverge.`,
    consequence_firewall: [
      'This exercise is not about evaluating leadership',
      'It\'s about giving you visibility you don\'t currently have'
    ]
  }
}

// ============================================================================
// MODULE-SPECIFIC QUESTION FRAMEWORKS
// ============================================================================

interface QuestionFramework {
  sections: Array<{
    name: string
    questions: string[]
    purpose: string
  }>
  quantitative_anchor: {
    question: string
    follow_up: string
  }
}

const QUESTION_FRAMEWORKS: Record<ParticipantType, Record<EducationModule, QuestionFramework>> = {
  student: {
    student_wellbeing: {
      sections: [
        {
          name: 'daily_experience',
          purpose: 'Baseline comfort building',
          questions: [
            'Walk me through a typical day at school. What\'s it actually like?',
            'What parts of the day do you look forward to? What parts do you dread?',
            'Where in the school do you feel most comfortable? Least comfortable?'
          ]
        },
        {
          name: 'academic_life',
          purpose: 'Stress detection',
          questions: [
            'How would you describe the pressure around academics here?',
            'When you\'re struggling with something, what do you do? Who do you go to?',
            'What\'s the attitude toward making mistakes here? Is it okay to fail?'
          ]
        },
        {
          name: 'relationships',
          purpose: 'Connection and trust',
          questions: [
            'How would you describe the vibe between students in your year?',
            'Do you feel like teachers actually know you? Like, beyond just in class?',
            'If something was bothering you at school, would you feel comfortable telling an adult?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how supported do you feel at this school?',
        follow_up: 'What would make that number higher?'
      }
    },
    teaching_learning: {
      sections: [
        {
          name: 'learning_experience',
          purpose: 'Pedagogical quality',
          questions: [
            'What makes a class feel really good to be in?',
            'When do you learn best? What helps you actually understand things?',
            'Are there subjects where you feel like you\'re just going through the motions?'
          ]
        },
        {
          name: 'teacher_effectiveness',
          purpose: 'Teaching quality signals',
          questions: [
            'Do teachers explain things in different ways when you don\'t understand?',
            'How do you feel when you ask a question in class?',
            'Do you feel like lessons are relevant to your life or your future?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how engaging are your classes overall?',
        follow_up: 'What would make learning here better?'
      }
    },
    parent_confidence: {
      sections: [], // Students don't do parent confidence module
      quantitative_anchor: { question: '', follow_up: '' }
    }
  },

  teacher: {
    student_wellbeing: {
      sections: [
        {
          name: 'student_observation',
          purpose: 'Teacher-observed student signals',
          questions: [
            'What\'s your sense of how students are really doing - beyond the surface?',
            'Are there patterns you see in students that you don\'t think leadership is aware of?',
            'What do students tell you that they probably don\'t tell anyone else?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how well-supported do students seem to you?',
        follow_up: 'What would improve student wellbeing here?'
      }
    },
    teaching_learning: {
      sections: [
        {
          name: 'daily_reality',
          purpose: 'Workload and pressure',
          questions: [
            'Walk me through a typical week. Where does your time actually go?',
            'What\'s the balance between teaching and everything else?',
            'Where do you feel the most pressure coming from?'
          ]
        },
        {
          name: 'support_systems',
          purpose: 'Institutional support',
          questions: [
            'When you need support - professionally or personally - where do you find it here?',
            'How would you describe the relationship between teachers and leadership?',
            'Do you feel like your voice reaches decision-makers?'
          ]
        },
        {
          name: 'teaching_culture',
          purpose: 'Pedagogical climate',
          questions: [
            'How would you describe the teaching and learning culture here?',
            'What helps you do your best work? What gets in the way?',
            'How much autonomy do you have in how you teach?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how sustainable is your current workload?',
        follow_up: 'What would make that number higher?'
      }
    },
    parent_confidence: {
      sections: [
        {
          name: 'parent_observation',
          purpose: 'Teacher view of parents',
          questions: [
            'How would you describe parent engagement at this school?',
            'What concerns do parents raise with you that they might not raise with leadership?',
            'Do you feel supported when dealing with difficult parent situations?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how strong is the parent-school relationship?',
        follow_up: 'What would strengthen it?'
      }
    }
  },

  parent: {
    student_wellbeing: {
      sections: [
        {
          name: 'child_experience',
          purpose: 'Indirect wellbeing signal',
          questions: [
            'How does your child talk about school at home?',
            'What does your child love about school? What do they struggle with?',
            'Are there things your child tells you that you don\'t think the school knows about?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how confident are you in your child\'s wellbeing at school?',
        follow_up: 'What would increase that confidence?'
      }
    },
    teaching_learning: {
      sections: [
        {
          name: 'academic_perception',
          purpose: 'Parent view of education quality',
          questions: [
            'How would you describe the quality of teaching your child receives?',
            'Do you feel your child is being appropriately challenged?',
            'How well does the school communicate about your child\'s progress?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how satisfied are you with the academic program?',
        follow_up: 'What would improve it?'
      }
    },
    parent_confidence: {
      sections: [
        {
          name: 'confidence_trust',
          purpose: 'Baseline sentiment',
          questions: [
            'How would you describe your overall confidence in the school right now?',
            'Has that confidence changed over time? In what direction?',
            'What would strengthen your confidence? What might weaken it?'
          ]
        },
        {
          name: 'communication',
          purpose: 'Communication quality',
          questions: [
            'How well do you feel the school communicates with you?',
            'When you have a concern, how easy is it to raise it? And does anything happen?',
            'Do you feel like you understand what\'s going on at the school?'
          ]
        },
        {
          name: 'stability',
          purpose: 'Institutional perception',
          questions: [
            'How stable does the school feel to you right now?',
            'Have there been changes that have affected your confidence - positively or negatively?',
            'Do you feel like the school is on a clear path, or does it feel uncertain?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how likely are you to recommend this school to a close friend?',
        follow_up: 'What would make that number higher?'
      }
    }
  },

  leadership: {
    student_wellbeing: {
      sections: [
        {
          name: 'strategic_view',
          purpose: 'Leadership perspective on students',
          questions: [
            'How do you currently measure student wellbeing?',
            'What signals would tell you something is wrong before it becomes a crisis?',
            'Where might there be gaps between your perception and students\' reality?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how confident are you in your understanding of student wellbeing?',
        follow_up: 'What would give you more clarity?'
      }
    },
    teaching_learning: {
      sections: [
        {
          name: 'staff_culture',
          purpose: 'Leadership view of teachers',
          questions: [
            'How would you describe the current state of staff morale?',
            'What do you think teachers need that they\'re not getting?',
            'Where might there be disconnect between leadership intent and teacher experience?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how aligned are teachers with the school\'s direction?',
        follow_up: 'What would improve alignment?'
      }
    },
    parent_confidence: {
      sections: [
        {
          name: 'parent_relations',
          purpose: 'Leadership view of parents',
          questions: [
            'How do you currently gauge parent confidence?',
            'What concerns do you hear from parents? What might you not be hearing?',
            'What would early warning of declining parent confidence look like?'
          ]
        }
      ],
      quantitative_anchor: {
        question: 'On a scale of 1-10, how strong is parent confidence right now?',
        follow_up: 'What factors could shift that?'
      }
    }
  }
}

// ============================================================================
// SYSTEM PROMPT GENERATION
// ============================================================================

function generateSystemPrompt(
  participant: EducationParticipant,
  campaign: EducationCampaign,
  module: EducationModule,
  conversationState: ConversationState
): string {
  // Build cohort context (for personalisation without identity)
  let cohortContext = ''
  if (participant.cohort_metadata.year_band) {
    cohortContext += `Year ${participant.cohort_metadata.year_band}`
  }
  if (participant.cohort_metadata.division) {
    cohortContext += cohortContext ? ` (${participant.cohort_metadata.division})` : participant.cohort_metadata.division
  }
  if (participant.cohort_metadata.role_category) {
    cohortContext += cohortContext ? `, ${participant.cohort_metadata.role_category}` : participant.cohort_metadata.role_category
  }

  // Use the constitution-based prompt generator
  // This provides comprehensive role, tone, rules, and domain guidance
  const constitutionPrompt = generateConstitutionPrompt(
    participant.participant_type,
    module,
    campaign.school.name,
    conversationState,
    cohortContext || undefined
  )

  // Add anonymity context header
  const anonymityHeader = `CRITICAL CONTEXT - ANONYMITY:
This is an ANONYMOUS conversation. You do NOT know this participant's name, email, or any identifying information.
You only know:
- Participant type: ${participant.participant_type}
- Cohort: ${cohortContext || 'Not specified'}
- School: ${campaign.school.name} (${campaign.school.country})
${campaign.school.curriculum ? `- Curriculum: ${campaign.school.curriculum}` : ''}

`

  // Add domain coverage guidance if we have tracking data
  let domainGuidance = ''
  if (conversationState.domains_explored && conversationState.domains_explored.length > 0) {
    const unexploredDomains = conversationState.domains_explored
      .filter(d => !d.explored || d.depth < 1)
      .map(d => d.domain_name)

    const exploredDomains = conversationState.domains_explored
      .filter(d => d.explored && d.depth >= 1)
      .map(d => d.domain_name)

    domainGuidance = `

DOMAIN COVERAGE STATUS:
- Coverage: ${conversationState.domain_coverage_percent?.toFixed(0) || 0}%
- Explored: ${exploredDomains.join(', ') || 'none yet'}
- Still to explore: ${unexploredDomains.join(', ') || 'all covered'}
${conversationState.current_domain_id ? `- Currently exploring: ${conversationState.current_domain_id}` : ''}

GUIDANCE: Naturally transition to unexplored domains while following conversational flow.
`
  }

  return anonymityHeader + constitutionPrompt + domainGuidance
}

// ============================================================================
// CONVERSATION STATE MANAGEMENT
// ============================================================================

/**
 * Classify user response sentiment for exploration logic
 */
function classifyResponseType(userMessage: string): 'positive' | 'neutral' | 'negative' {
  const lowerMessage = userMessage.toLowerCase()

  // Positive indicators
  const positivePatterns = [
    /\b(great|good|excellent|love|happy|satisfied|works well|no (issues|problems|concerns))\b/,
    /\b(really (good|like|enjoy)|very (happy|satisfied|good))\b/,
    /\b(fine|okay|all good|no complaints)\b/
  ]

  // Negative indicators
  const negativePatterns = [
    /\b(frustrated|annoyed|upset|angry|disappointed|concerned|worried)\b/,
    /\b(problem|issue|difficult|struggle|challenge|hard|tough)\b/,
    /\b(wish|should|could be better|needs (to|improvement))\b/,
    /\b(don't|doesn't|can't|won't|never|rarely)\b.*\b(work|help|support|respond)\b/
  ]

  const positiveScore = positivePatterns.filter(p => p.test(lowerMessage)).length
  const negativeScore = negativePatterns.filter(p => p.test(lowerMessage)).length

  if (negativeScore > positiveScore) return 'negative'
  if (positiveScore > negativeScore && positiveScore >= 1) return 'positive'
  return 'neutral'
}

/**
 * Detect which domain is being discussed based on content
 */
function detectCurrentDomain(
  userMessage: string,
  assistantResponse: string,
  participantType: ParticipantType,
  module: EducationModule
): string | undefined {
  const domains = getDomains(participantType, module)
  const combinedText = (userMessage + ' ' + assistantResponse).toLowerCase()

  // Score each domain based on keyword matches
  let bestMatch: { id: string; score: number } | undefined

  for (const domain of domains) {
    let score = 0

    // Check domain name keywords
    const nameWords = domain.name.toLowerCase().split(/[\s&,]+/)
    score += nameWords.filter(word => word.length > 3 && combinedText.includes(word)).length * 2

    // Check listen_for keywords (high weight)
    score += domain.listen_for.filter(keyword =>
      combinedText.includes(keyword.toLowerCase())
    ).length * 3

    // Check if start question or explore questions appear
    if (combinedText.includes(domain.start_question.toLowerCase().slice(0, 30))) {
      score += 5
    }

    domain.explore_questions.forEach(q => {
      if (combinedText.includes(q.toLowerCase().slice(0, 25))) {
        score += 2
      }
    })

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: domain.id, score }
    }
  }

  return bestMatch?.id
}

function updateConversationState(
  currentState: ConversationState,
  userMessage: string,
  assistantResponse: string,
  module: EducationModule,
  participantType: ParticipantType
): ConversationState {
  const questionsAsked = (currentState.questions_asked || 0) + 1

  // Detect safeguarding flags (ensure array safety)
  const newFlags = detectSafeguardingConcerns(userMessage)
  const safeguardingFlags = [...(currentState.safeguarding_flags || []), ...newFlags]

  // Initialize domains_explored if not present
  let domainsExplored = currentState.domains_explored || []
  if (domainsExplored.length === 0) {
    const domains = getDomains(participantType, module)
    domainsExplored = domains.map(d => ({
      domain_id: d.id,
      domain_name: d.name,
      explored: false,
      depth: 0
    }))
  }

  // Detect current domain being discussed
  const detectedDomainId = detectCurrentDomain(userMessage, assistantResponse, participantType, module)
  const responseType = classifyResponseType(userMessage)

  // Update domain exploration tracking
  if (detectedDomainId) {
    domainsExplored = domainsExplored.map(d => {
      if (d.domain_id === detectedDomainId) {
        return {
          ...d,
          explored: true,
          depth: Math.min(d.depth + 1, 3),
          response_type: responseType
        }
      }
      return d
    })
  }

  // Calculate domain coverage
  const exploredCount = domainsExplored.filter(d => d.explored && d.depth >= 1).length
  const domainCoveragePercent = domainsExplored.length > 0
    ? (exploredCount / domainsExplored.length) * 100
    : 0

  // Phase progression (updated for domain-based flow)
  let phase: ConversationPhase = currentState.phase
  let isComplete = false

  if (questionsAsked === 1) {
    phase = 'rapport'
  } else if (questionsAsked <= 3) {
    phase = 'daily_experience'
  } else if (questionsAsked <= 10) {
    phase = 'core_exploration'
  } else if (questionsAsked <= 13) {
    phase = 'open_exploration'
  } else if (domainCoveragePercent >= 70 || questionsAsked >= 15) {
    phase = 'closing'
    isComplete = questionsAsked >= 15 || domainCoveragePercent >= 85
  }

  // Track sections based on keywords in conversation (legacy support)
  const sections = [...(currentState.sections_completed || [])]
  const framework = QUESTION_FRAMEWORKS[participantType][module]

  framework.sections.forEach(section => {
    if (!sections.includes(section.name)) {
      const covered = section.questions.some(q =>
        assistantResponse.toLowerCase().includes(q.toLowerCase().slice(0, 30))
      )
      if (covered) {
        sections.push(section.name)
      }
    }
  })

  // Check for rapport establishment
  const rapportEstablished = currentState.rapport_established ||
    questionsAsked >= 2 ||
    assistantResponse.toLowerCase().includes('thank') ||
    userMessage.length > 100

  return {
    ...currentState,
    phase,
    questions_asked: questionsAsked,
    sections_completed: sections,
    rapport_established: rapportEstablished,
    anonymity_confirmed: currentState.anonymity_confirmed || questionsAsked >= 1,
    last_interaction: new Date().toISOString(),
    is_complete: isComplete,
    safeguarding_flags: safeguardingFlags,
    // New domain tracking fields
    domains_explored: domainsExplored,
    current_domain_id: detectedDomainId,
    domain_coverage_percent: domainCoveragePercent
  }
}

// ============================================================================
// MAIN AGENT FUNCTIONS
// ============================================================================

/**
 * Process a message through the education interview agent
 */
export async function processEducationMessage(
  message: string,
  participant: EducationParticipant,
  campaign: EducationCampaign,
  module: EducationModule,
  messageHistory: MessageHistory[],
  conversationState: ConversationState
): Promise<{
  response: string
  updatedState: ConversationState
  safeguardingAlert?: string
}> {
  // Check for safeguarding concerns BEFORE processing
  const safeguardingFlags = detectSafeguardingConcerns(message)

  let safeguardingAlertId: string | undefined

  // Create alert for high-confidence flags
  for (const flag of safeguardingFlags) {
    if (flag.confidence >= 0.75) {
      const alertId = await createSafeguardingAlert(
        participant,
        flag,
        message,
        messageHistory.slice(-3).map(m => m.content).join('\n---\n')
      )
      if (alertId) {
        safeguardingAlertId = alertId
      }
    }
  }

  // Generate system prompt
  const systemPrompt = generateSystemPrompt(
    participant,
    campaign,
    module,
    conversationState
  )

  // Prepare messages for Claude
  // IMPORTANT: Anthropic API requires the first message to be from the user role.
  // Since we save the greeting as an assistant message, we need to prepend a synthetic
  // user message to satisfy this requirement.
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  console.log('=== MESSAGE PREPARATION ===')
  console.log('History length:', messageHistory.length)
  console.log('History first role:', messageHistory[0]?.role)
  console.log('Current message length:', message.length)

  if (messageHistory.length > 0 && messageHistory[0].role === 'assistant') {
    // Add a synthetic user message to satisfy Anthropic API requirement
    messages.push({ role: 'user', content: 'Hello, I\'m ready to begin.' })
    console.log('Added synthetic user message')
  }

  // Map history messages, ensuring content is always a string
  const historyMapped = messageHistory.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: String(msg.content || '')
  }))

  messages.push(
    ...historyMapped,
    {
      role: 'user' as const,
      content: String(message || '')
    }
  )

  // Validate message structure
  console.log('Final messages count:', messages.length)
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    console.log(`Message ${i}: role=${msg.role}, contentLength=${msg.content?.length || 0}`)
    if (!msg.content || typeof msg.content !== 'string') {
      console.error(`Invalid message at index ${i}:`, JSON.stringify(msg))
      throw new Error(`Invalid message content at index ${i}`)
    }
  }

  // Verify alternating pattern starts with user
  if (messages.length > 0 && messages[0].role !== 'user') {
    console.error('First message is not user role:', messages[0].role)
    throw new Error('First message must be user role')
  }

  // Call Claude API
  console.log('=== EDUCATION AGENT API CALL ===')
  console.log('Messages count:', messages.length)
  console.log('Messages structure:', JSON.stringify(messages.map(m => ({ role: m.role, contentLength: m.content.length }))))
  console.log('System prompt length:', systemPrompt.length)
  console.log('Participant type:', participant.participant_type)
  console.log('Module:', module)

  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    })
    console.log('API call successful, response type:', response.content[0]?.type)
  } catch (apiError) {
    console.error('=== ANTHROPIC API ERROR ===')
    console.error('Error type:', apiError instanceof Error ? apiError.constructor.name : typeof apiError)
    console.error('Error message:', apiError instanceof Error ? apiError.message : String(apiError))
    if (apiError instanceof Error && 'status' in apiError) {
      console.error('HTTP status:', (apiError as { status?: number }).status)
    }
    if (apiError instanceof Error && 'error' in apiError) {
      console.error('Error details:', JSON.stringify((apiError as { error?: unknown }).error))
    }
    throw apiError
  }

  const assistantResponse = response.content[0].type === 'text'
    ? response.content[0].text
    : ''

  // Update conversation state
  const updatedState = updateConversationState(
    conversationState,
    message,
    assistantResponse,
    module,
    participant.participant_type
  )

  // Add new safeguarding flags to state
  updatedState.safeguarding_flags = [
    ...updatedState.safeguarding_flags,
    ...safeguardingFlags
  ]

  return {
    response: assistantResponse,
    updatedState,
    safeguardingAlert: safeguardingAlertId
  }
}

/**
 * Generate initial greeting for education interview
 */
export async function generateEducationGreeting(
  participant: EducationParticipant,
  campaign: EducationCampaign,
  module: EducationModule
): Promise<string> {
  const trustFraming = TRUST_FRAMING[participant.participant_type]

  const greetingPrompts: Record<ParticipantType, string> = {
    student: `You are starting an anonymous conversation with a student at ${campaign.school.name}.

Write a warm, friendly greeting that:
1. Thanks them for taking the time
2. Explicitly states this is anonymous (teachers can't see what they say)
3. Reassures them there are no right or wrong answers
4. Explains you just want to understand what school is really like for them
5. Asks if they're ready to start

Keep it conversational and age-appropriate. Don't be too formal.
Maximum 4-5 sentences.`,

    teacher: `You are starting an anonymous conversation with a teacher at ${campaign.school.name}.

Write a professional, reassuring greeting that:
1. Thanks them for participating
2. Explicitly states this is anonymised (leadership sees patterns, not individuals)
3. Clarifies this is not an evaluation or HR tool
4. Explains you're looking for structural patterns, not individual performance
5. Asks if that frame sounds okay

Keep it professional but warm. Maximum 4-5 sentences.`,

    parent: `You are starting an anonymous conversation with a parent at ${campaign.school.name}.

Write a respectful, professional greeting that:
1. Thanks them for taking the time
2. States their responses aren't linked to their name or child
3. Clarifies you're looking for patterns, not endorsements
4. Explains this is about understanding experience, not collecting testimonials
5. Asks if that makes sense before you begin

Keep it professional and serious (not marketing-speak). Maximum 4-5 sentences.`,

    leadership: `You are starting a conversation with a school leader at ${campaign.school.name}.

Write a professional greeting that:
1. Thanks them for participating
2. Frames this as exploring how leadership intent lands across the community
3. Notes you're looking for patterns that may not be visible from their vantage point
4. Asks if they're ready to begin

Keep it collegial and respectful. Maximum 4-5 sentences.`
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512,
    system: greetingPrompts[participant.participant_type],
    messages: [
      {
        role: 'user',
        content: 'Generate the greeting message.'
      }
    ]
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

/**
 * Initialize conversation state for a new education interview
 */
export function initializeEducationConversationState(
  participantType?: ParticipantType,
  module?: EducationModule
): ConversationState {
  // Initialize domain tracking if participant type and module are provided
  let domainsExplored: DomainExploration[] = []
  if (participantType && module) {
    const domains = getDomains(participantType, module)
    domainsExplored = domains.map(d => ({
      domain_id: d.id,
      domain_name: d.name,
      explored: false,
      depth: 0
    }))
  }

  return {
    phase: 'opening',
    sections_completed: [],
    questions_asked: 0,
    rapport_established: false,
    anonymity_confirmed: false,
    safeguarding_flags: [],
    // New domain tracking fields
    domains_explored: domainsExplored,
    current_domain_id: undefined,
    domain_coverage_percent: 0
  }
}

/**
 * Check if conversation should end
 * Considers both question count AND domain coverage
 */
export function shouldEndConversation(state: ConversationState): boolean {
  // Explicit completion
  if (state.is_complete || state.phase === 'completed') {
    return true
  }

  // Hard limit on questions
  if (state.questions_asked >= 15) {
    return true
  }

  // Good coverage achieved (70%+) AND enough questions asked (12+)
  const domainCoverage = state.domain_coverage_percent || 0
  if (domainCoverage >= 70 && state.questions_asked >= 12) {
    return true
  }

  return false
}

/**
 * Generate closing message using constitution-based guidelines
 */
export async function generateClosingMessage(
  participant: EducationParticipant,
  campaign: EducationCampaign,
  module: EducationModule,
  conversationState: ConversationState
): Promise<string> {
  // Get the constitution for this participant type and module
  const constitution = getConstitution(participant.participant_type, module)
  const closing = constitution.closing

  // Build domain coverage summary for context
  const domainsExplored = conversationState.domains_explored || []
  const exploredDomainNames = domainsExplored
    .filter(d => d.explored && d.depth >= 1)
    .map(d => d.domain_name)
  const coveragePercent = conversationState.domain_coverage_percent || 0

  // Build constitution-informed closing prompt
  const closingPrompt = `You are concluding an anonymous interview with a ${participant.participant_type} at ${campaign.school.name}.

CLOSING GUIDELINES FROM CONSTITUTION:

Final Question to Weave In (optional, if natural):
"${closing.final_question}"

Things You Must NOT Do:
${closing.do_not.map(item => `- ${item}`).join('\n')}

Required Tone:
${closing.tone}

CONTEXT:
- Questions asked: ${conversationState.questions_asked}
- Topics explored: ${exploredDomainNames.join(', ') || 'general conversation'}
- Coverage: ${coveragePercent.toFixed(0)}%

GENERATE A CLOSING MESSAGE THAT:
1. Thanks them genuinely for their honesty and time
2. Acknowledges the specific areas they shared about (if relevant)
3. Reminds them their responses help identify patterns (not individuals)
4. Maintains the tone specified above
5. Optionally weaves in the final reflection question if it feels natural
6. Keeps it to 2-4 sentences

Do NOT be performative, overly warm, or sound like marketing. Be real.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 256,
    system: closingPrompt,
    messages: [
      {
        role: 'user',
        content: 'Generate the closing message.'
      }
    ]
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
