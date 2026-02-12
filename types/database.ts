/**
 * Database Types for FlowForge Education
 * Stripped to education-relevant types only
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// =====================================================
// CAMPAIGNS
// =====================================================

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived'
export type CampaignType = 'education_pilot' | 'education_annual'

export interface Campaign {
  id: string
  name: string
  description: string | null
  campaign_type: CampaignType
  status: CampaignStatus

  // Campaign configuration
  facilitator_name: string
  facilitator_email: string
  company_name: string | null
  company_industry: string | null

  // Multi-tenancy fields
  organization_id: string
  created_by: string | null

  // Education-specific fields
  school_id: string | null
  education_config: Json | null

  // Report configuration
  report_tier: 'basic' | 'standard' | 'premium' | null

  // Knowledge base configuration
  knowledge_base_ids: string[] | null

  // Timestamps
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null

  // Metadata
  metadata: Json
}

export interface CampaignInsert extends Omit<Campaign, 'id' | 'created_at' | 'updated_at'> {}
export interface CampaignUpdate extends Partial<CampaignInsert> {}

// =====================================================
// STAKEHOLDER SESSIONS
// =====================================================

export type StakeholderRole =
  | 'managing_director'
  | 'it_operations'
  | 'production'
  | 'purchasing'
  | 'planning'
  | 'engineering'

export type SessionStatus = 'invited' | 'in_progress' | 'completed' | 'abandoned'

export interface StakeholderSession {
  id: string
  campaign_id: string

  // Stakeholder information
  stakeholder_name: string
  stakeholder_email: string
  stakeholder_role: StakeholderRole
  stakeholder_title: string | null

  // Session state
  status: SessionStatus
  progress_percentage: number
  current_question_index: number

  // Access control
  access_token: string | null
  access_expires_at: string | null

  // Session tracking
  started_at: string | null
  completed_at: string | null
  last_activity_at: string | null

  // Document uploads
  has_uploaded_documents: boolean

  // Timestamps
  created_at: string
  updated_at: string

  // Metadata
  metadata: Json
}

export interface StakeholderSessionInsert extends Omit<StakeholderSession, 'id' | 'created_at' | 'updated_at'> {}
export interface StakeholderSessionUpdate extends Partial<StakeholderSessionInsert> {}

// =====================================================
// AGENT SESSIONS
// =====================================================

export type AgentType = 'interview_agent' | 'document_analyst' | 'synthesis_agent'

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Json
}

export interface AgentSession {
  id: string
  stakeholder_session_id: string

  // Agent configuration
  agent_type: AgentType
  agent_model: string

  // Conversation state
  conversation_history: ConversationMessage[]
  system_prompt: string | null

  // Session context
  session_context: Json

  // Timestamps
  created_at: string
  updated_at: string
  last_message_at: string | null

  // Metadata
  metadata: Json
}

export interface AgentSessionInsert extends Omit<AgentSession, 'id' | 'created_at' | 'updated_at'> {}
export interface AgentSessionUpdate extends Partial<AgentSessionInsert> {}

// =====================================================
// SYNTHESIS
// =====================================================

export type SynthesisType = 'cross_stakeholder' | 'contradiction_analysis' | 'roadmap_generation'

export interface Theme {
  title: string
  description: string
  mentioned_by: string[] // stakeholder_session_ids
  frequency: number
}

export interface Contradiction {
  topic: string
  perspectives: {
    stakeholder_id: string
    stakeholder_name: string
    stakeholder_role: StakeholderRole
    statement: string
  }[]
  significance: 'low' | 'medium' | 'high' | 'critical'
}

export interface Gap {
  area: string
  description: string
  impact: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
}

export interface Recommendation {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term'
  dependencies: string[]
}

export interface RoadmapItem {
  phase: number
  title: string
  description: string
  duration: string
  deliverables: string[]
  dependencies: string[]
  stakeholders: StakeholderRole[]
}

export interface Synthesis {
  id: string
  campaign_id: string

  // Synthesis type
  synthesis_type: SynthesisType

  // Analysis content
  title: string
  summary: string | null
  detailed_analysis: Json

  // Identified patterns
  themes: Theme[]
  contradictions: Contradiction[]
  gaps: Gap[]

  // Strategic outputs
  recommendations: Recommendation[]
  roadmap: RoadmapItem[]

  // Source tracking
  source_session_ids: string[] | null

  // Timestamps
  created_at: string
  updated_at: string

  // Metadata
  metadata: Json
}

export interface SynthesisInsert extends Omit<Synthesis, 'id' | 'created_at' | 'updated_at'> {}
export interface SynthesisUpdate extends Partial<SynthesisInsert> {}

// =====================================================
// DATABASE SCHEMA
// =====================================================

// Using permissive Database type to allow any table query.
// TODO: Generate proper types with `supabase gen types` after Supabase project is set up.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Database {
  public: {
    Tables: Record<string, {
      Row: Record<string, any>
      Insert: Record<string, any>
      Update: Record<string, any>
    }>
    Views: Record<string, {
      Row: Record<string, any>
    }>
    Functions: Record<string, {
      Args: Record<string, any>
      Returns: any
    }>
    Enums: Record<string, string>
  }
}
