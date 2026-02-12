-- ============================================================================
-- FlowForge Education - Consolidated Database Schema
-- ============================================================================
-- This is a single-file migration that creates the complete database schema
-- for the FlowForge Education standalone application.
--
-- Extracted from the multi-vertical FlowForge monolith.
-- Includes only education-relevant tables, functions, and policies.
--
-- Table creation order respects FK dependencies:
--   1. Extensions
--   2. Helper functions
--   3. organizations
--   4. user_profiles (FK → organizations, auth.users)
--   5. tenant_profiles (FK → auth.users)
--   6. campaigns (FK → organizations, auth.users)
--   7. schools (FK → organizations)
--   8. campaigns.school_id FK → schools
--   9. stakeholder_sessions (FK → campaigns)
--  10. agent_sessions (FK → stakeholder_sessions)
--  11. education_access_codes (FK → campaigns, schools)
--  12. education_participant_tokens (FK → campaigns, schools)
--  13. agent_sessions education extensions
--  14. education_safeguarding_alerts (FK → campaigns, schools)
--  15. education_synthesis (FK → campaigns, schools)
--  16. education_reports (FK → education_synthesis, schools)
--  17. Voice tables
--  18. Usage tables (FK → tenant_profiles)
--  19. RLS policies
--  20. Auth trigger
--  21. Seed data
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 3. ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  subscription_ends_at TIMESTAMPTZ,
  max_campaigns INTEGER DEFAULT 5,
  max_stakeholders_per_campaign INTEGER DEFAULT 20,
  max_storage_gb INTEGER DEFAULT 10,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#F25C05',
  secondary_color TEXT DEFAULT '#1D9BA3',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_plan ON organizations(plan);
CREATE INDEX idx_organizations_status ON organizations(subscription_status);

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 4. USER PROFILES TABLE
-- ============================================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  preferences JSONB DEFAULT '{}'::jsonb,
  user_type TEXT CHECK (user_type IN ('consultant', 'company', 'coach', 'admin')),
  company_profile_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_user_profiles_organization ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_status ON user_profiles(status);
CREATE INDEX idx_user_profiles_company_profile_id ON user_profiles(company_profile_id);

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 5. TENANT PROFILES TABLE
-- ============================================================================

CREATE TABLE tenant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('coach', 'consultant', 'school')),
  brand_config JSONB NOT NULL DEFAULT '{
    "logo": null,
    "colors": {
      "primary": "#F25C05",
      "primaryHover": "#DC5204",
      "secondary": "#1D9BA3",
      "background": "#FFFEFB",
      "backgroundSubtle": "#FAF8F3",
      "text": "#171614",
      "textMuted": "#71706B",
      "border": "#E6E2D6"
    },
    "fonts": {
      "heading": "Inter",
      "body": "Inter"
    },
    "showPoweredBy": true
  }'::jsonb,
  email_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled_assessments TEXT[] DEFAULT ARRAY['education']::TEXT[],
  subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  is_active BOOLEAN DEFAULT TRUE,
  custom_domain TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_profiles_user_id ON tenant_profiles(user_id);
CREATE INDEX idx_tenant_profiles_slug ON tenant_profiles(slug);
CREATE INDEX idx_tenant_profiles_custom_domain ON tenant_profiles(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_tenant_profiles_tenant_type ON tenant_profiles(tenant_type);
CREATE INDEX idx_tenant_profiles_is_active ON tenant_profiles(is_active) WHERE is_active = TRUE;

CREATE TRIGGER tenant_profiles_updated_at BEFORE UPDATE ON tenant_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 6. CAMPAIGNS TABLE
-- ============================================================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  facilitator_name TEXT NOT NULL,
  facilitator_email TEXT NOT NULL,
  company_name TEXT,
  company_industry TEXT,
  knowledge_base_ids UUID[],
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Education-specific fields (added in 002)
  school_id UUID, -- FK added after schools table creation
  education_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_type ON campaigns(campaign_type);
CREATE INDEX idx_campaigns_facilitator_email ON campaigns(facilitator_email);
CREATE INDEX idx_campaigns_organization ON campaigns(organization_id);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_education_config ON campaigns USING GIN(education_config);

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 7. SCHOOLS TABLE
-- ============================================================================

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  country TEXT NOT NULL,
  city TEXT,
  region TEXT,
  curriculum TEXT,
  school_type TEXT,
  student_count_range TEXT,
  year_levels TEXT[],
  divisions TEXT[],
  fee_tier TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_role TEXT,
  primary_contact_phone TEXT,
  safeguarding_lead_name TEXT,
  safeguarding_lead_email TEXT,
  safeguarding_lead_phone TEXT,
  safeguarding_protocol TEXT DEFAULT 'standard',
  safeguarding_backup_contact TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  logo_url TEXT,
  brand_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_schools_organization ON schools(organization_id);
CREATE INDEX idx_schools_code ON schools(code);
CREATE INDEX idx_schools_country ON schools(country);
CREATE INDEX idx_schools_status ON schools(status);
CREATE INDEX idx_schools_curriculum ON schools(curriculum);
CREATE INDEX idx_schools_fee_tier ON schools(fee_tier);

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 8. ADD FK: campaigns.school_id → schools
-- ============================================================================

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

CREATE INDEX idx_campaigns_school ON campaigns(school_id);


-- ============================================================================
-- 9. STAKEHOLDER SESSIONS TABLE
-- ============================================================================

CREATE TABLE stakeholder_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  stakeholder_name TEXT NOT NULL,
  stakeholder_email TEXT NOT NULL,
  stakeholder_role TEXT NOT NULL,
  stakeholder_title TEXT,
  status TEXT NOT NULL DEFAULT 'invited',
  progress_percentage INTEGER DEFAULT 0,
  current_question_index INTEGER DEFAULT 0,
  access_token TEXT UNIQUE,
  access_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  has_uploaded_documents BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_stakeholder_sessions_campaign ON stakeholder_sessions(campaign_id);
CREATE INDEX idx_stakeholder_sessions_email ON stakeholder_sessions(stakeholder_email);
CREATE INDEX idx_stakeholder_sessions_status ON stakeholder_sessions(status);
CREATE INDEX idx_stakeholder_sessions_role ON stakeholder_sessions(stakeholder_role);
CREATE INDEX idx_stakeholder_sessions_token ON stakeholder_sessions(access_token);

CREATE TRIGGER update_stakeholder_sessions_updated_at BEFORE UPDATE ON stakeholder_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 10. AGENT SESSIONS TABLE
-- ============================================================================

CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_session_id UUID REFERENCES stakeholder_sessions(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  agent_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  system_prompt TEXT,
  session_context JSONB DEFAULT '{}'::jsonb,
  -- Education extensions
  participant_token_id UUID, -- FK added after education_participant_tokens creation
  education_session_context JSONB,
  -- Voice extensions
  session_mode TEXT DEFAULT 'text' CHECK (session_mode IN ('text', 'voice', 'mixed')),
  voice_minutes_used NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_agent_sessions_stakeholder ON agent_sessions(stakeholder_session_id);
CREATE INDEX idx_agent_sessions_type ON agent_sessions(agent_type);
CREATE INDEX idx_agent_sessions_updated ON agent_sessions(updated_at DESC);
CREATE INDEX idx_agent_sessions_mode ON agent_sessions(session_mode);
CREATE INDEX idx_agent_sessions_voice_usage ON agent_sessions(voice_minutes_used) WHERE voice_minutes_used > 0;

CREATE TRIGGER update_agent_sessions_updated_at BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 11. EDUCATION ACCESS CODES TABLE
-- ============================================================================

CREATE TABLE education_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  code_type VARCHAR(20) NOT NULL,
  cohort_metadata JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  batch_id UUID,
  batch_name TEXT
);

CREATE INDEX idx_access_codes_code_active ON education_access_codes(code) WHERE status = 'active';
CREATE INDEX idx_access_codes_campaign ON education_access_codes(campaign_id);
CREATE INDEX idx_access_codes_school ON education_access_codes(school_id);
CREATE INDEX idx_access_codes_type ON education_access_codes(code_type);
CREATE INDEX idx_access_codes_batch ON education_access_codes(batch_id);
CREATE INDEX idx_access_codes_status ON education_access_codes(status);
CREATE INDEX idx_access_codes_expires ON education_access_codes(expires_at) WHERE status = 'active';


-- ============================================================================
-- 12. EDUCATION PARTICIPANT TOKENS TABLE
-- ============================================================================

CREATE TABLE education_participant_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(50) NOT NULL UNIQUE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  participant_type VARCHAR(20) NOT NULL,
  cohort_metadata JSONB DEFAULT '{}'::jsonb,
  first_session_at TIMESTAMPTZ DEFAULT NOW(),
  last_session_at TIMESTAMPTZ,
  session_count INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  modules_started JSONB DEFAULT '[]'::jsonb,
  modules_completed JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_participant_tokens_token ON education_participant_tokens(token);
CREATE INDEX idx_participant_tokens_campaign ON education_participant_tokens(campaign_id);
CREATE INDEX idx_participant_tokens_school ON education_participant_tokens(school_id);
CREATE INDEX idx_participant_tokens_type ON education_participant_tokens(participant_type);
CREATE INDEX idx_participant_tokens_status ON education_participant_tokens(status);
CREATE INDEX idx_participant_tokens_cohort ON education_participant_tokens USING GIN(cohort_metadata);
CREATE INDEX idx_participant_tokens_last_activity ON education_participant_tokens(last_session_at DESC);

CREATE TRIGGER update_participant_tokens_updated_at BEFORE UPDATE ON education_participant_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 13. ADD FK: agent_sessions.participant_token_id → education_participant_tokens
-- ============================================================================

ALTER TABLE agent_sessions
  ADD CONSTRAINT agent_sessions_participant_token_fkey
  FOREIGN KEY (participant_token_id) REFERENCES education_participant_tokens(id) ON DELETE SET NULL;

CREATE INDEX idx_agent_sessions_participant_token ON agent_sessions(participant_token_id);
CREATE INDEX idx_agent_sessions_education_context ON agent_sessions USING GIN(education_session_context)
  WHERE education_session_context IS NOT NULL;


-- ============================================================================
-- 14. EDUCATION SAFEGUARDING ALERTS TABLE
-- ============================================================================

CREATE TABLE education_safeguarding_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  participant_token VARCHAR(50) NOT NULL,
  participant_type VARCHAR(20) NOT NULL,
  cohort_metadata JSONB DEFAULT '{}'::jsonb,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_content TEXT NOT NULL,
  trigger_context TEXT,
  trigger_confidence DECIMAL(3,2),
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alert_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  alert_sent_at TIMESTAMPTZ,
  alert_channel VARCHAR(50),
  alert_recipient_role VARCHAR(100),
  notification_attempts INTEGER DEFAULT 0,
  last_notification_attempt_at TIMESTAMPTZ,
  notification_error TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by_role VARCHAR(100),
  acknowledgment_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_role VARCHAR(100),
  resolution_type VARCHAR(50),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_safeguarding_alerts_campaign ON education_safeguarding_alerts(campaign_id);
CREATE INDEX idx_safeguarding_alerts_school ON education_safeguarding_alerts(school_id);
CREATE INDEX idx_safeguarding_alerts_token ON education_safeguarding_alerts(participant_token);
CREATE INDEX idx_safeguarding_alerts_status ON education_safeguarding_alerts(alert_status);
CREATE INDEX idx_safeguarding_alerts_unacknowledged ON education_safeguarding_alerts(school_id, detected_at)
  WHERE acknowledged_at IS NULL AND alert_status NOT IN ('false_positive', 'resolved');
CREATE INDEX idx_safeguarding_alerts_trigger_type ON education_safeguarding_alerts(trigger_type);
CREATE INDEX idx_safeguarding_alerts_detected ON education_safeguarding_alerts(detected_at DESC);

CREATE TRIGGER update_safeguarding_alerts_updated_at BEFORE UPDATE ON education_safeguarding_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 15. EDUCATION SYNTHESIS TABLE
-- ============================================================================

CREATE TABLE education_synthesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  content JSONB NOT NULL,
  model_used TEXT NOT NULL,
  source_token_ids UUID[] NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_education_synthesis_campaign ON education_synthesis(campaign_id);
CREATE INDEX idx_education_synthesis_school ON education_synthesis(school_id);
CREATE INDEX idx_education_synthesis_module ON education_synthesis(module);
CREATE INDEX idx_education_synthesis_campaign_module ON education_synthesis(campaign_id, module);


-- ============================================================================
-- 16. EDUCATION REPORTS TABLE
-- ============================================================================

CREATE TABLE education_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synthesis_id UUID NOT NULL REFERENCES education_synthesis(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  access_token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  has_safeguarding_signals BOOLEAN NOT NULL DEFAULT false,
  safeguarding_notified_at TIMESTAMPTZ,
  generated_by UUID REFERENCES auth.users(id),
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_education_reports_token ON education_reports(access_token);
CREATE INDEX idx_education_reports_synthesis ON education_reports(synthesis_id);
CREATE INDEX idx_education_reports_school ON education_reports(school_id);

CREATE TRIGGER set_education_synthesis_updated_at BEFORE UPDATE ON education_synthesis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_education_reports_updated_at BEFORE UPDATE ON education_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 17. VOICE SYSTEM TABLES
-- ============================================================================

-- Vertical Voice Configuration
CREATE TABLE vertical_voice_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  voice_enabled BOOLEAN DEFAULT false,
  elevenlabs_agent_id TEXT,
  voice_model TEXT DEFAULT 'flash_v2.5',
  llm_endpoint_path TEXT NOT NULL,
  system_prompt_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vertical_voice_config_key ON vertical_voice_config(vertical_key);
CREATE INDEX idx_vertical_voice_config_enabled ON vertical_voice_config(voice_enabled) WHERE voice_enabled = true;

-- Organization Voice Settings
CREATE TABLE organization_voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  voice_enabled BOOLEAN DEFAULT false,
  voice_included_in_plan BOOLEAN DEFAULT false,
  allowed_verticals TEXT[] DEFAULT '{}',
  monthly_voice_minutes_limit INTEGER DEFAULT 100,
  monthly_voice_minutes_used NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

CREATE INDEX idx_org_voice_settings_org ON organization_voice_settings(organization_id);
CREATE INDEX idx_org_voice_settings_enabled ON organization_voice_settings(voice_enabled) WHERE voice_enabled = true;

-- User Voice Preferences
CREATE TABLE user_voice_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_enabled BOOLEAN DEFAULT true,
  default_mode TEXT DEFAULT 'text' CHECK (default_mode IN ('text', 'voice')),
  auto_start_voice BOOLEAN DEFAULT false,
  preferred_voice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_voice_prefs_user ON user_voice_preferences(user_id);

-- Voice triggers
CREATE TRIGGER update_vertical_voice_config_updated_at BEFORE UPDATE ON vertical_voice_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_voice_settings_updated_at BEFORE UPDATE ON organization_voice_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_voice_prefs_updated_at BEFORE UPDATE ON user_voice_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 18. USAGE & BILLING TABLES
-- ============================================================================

-- Usage Events
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'llm_request', 'email_sent', 'session_started',
    'session_completed', 'report_generated', 'document_processed'
  )),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  tokens_used INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  model_used TEXT,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_tokens CHECK (input_tokens >= 0 AND output_tokens >= 0)
);

CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX idx_usage_events_user_id ON usage_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_usage_events_tenant_month ON usage_events(tenant_id, created_at DESC);
CREATE INDEX idx_usage_events_billing ON usage_events(tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;

-- Model Pricing
CREATE TABLE model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT,
  input_rate_per_million DECIMAL(10,4) NOT NULL,
  output_rate_per_million DECIMAL(10,4) NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, model_id, effective_date)
);

CREATE INDEX idx_model_pricing_lookup ON model_pricing(model_id, is_active, effective_date DESC);

-- Subscription Tiers
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  monthly_token_limit BIGINT,
  monthly_session_limit INTEGER,
  price_cents_monthly INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT at_least_one_limit CHECK (
    monthly_token_limit IS NOT NULL OR monthly_session_limit IS NOT NULL
  )
);

-- Usage Notifications
CREATE TABLE usage_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('75_percent', '90_percent', '100_percent')),
  billing_period DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('in_app', 'email', 'both')),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, notification_type, billing_period)
);

CREATE INDEX idx_usage_notifications_tenant_id ON usage_notifications(tenant_id);
CREATE INDEX idx_usage_notifications_billing_period ON usage_notifications(billing_period);
CREATE INDEX idx_usage_notifications_unacknowledged ON usage_notifications(tenant_id, acknowledged_at) WHERE acknowledged_at IS NULL;


-- ============================================================================
-- 19. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_participant_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_safeguarding_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_synthesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_voice_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_voice_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_notifications ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 20. MULTI-TENANCY HELPER FUNCTIONS
-- ============================================================================

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM user_profiles
  WHERE id = auth.uid();
  RETURN org_id;
END;
$$;

-- Check if user has a permission
CREATE OR REPLACE FUNCTION public.user_has_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
  has_perm BOOLEAN;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  IF user_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;
  SELECT (permissions->permission_name)::boolean INTO has_perm
  FROM user_profiles
  WHERE id = auth.uid();
  RETURN COALESCE(has_perm, FALSE);
END;
$$;

-- Education-specific permission check
CREATE OR REPLACE FUNCTION public.user_has_education_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
  has_perm BOOLEAN;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  IF user_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;
  SELECT (permissions->'education'->permission_name)::boolean INTO has_perm
  FROM user_profiles
  WHERE id = auth.uid();
  RETURN COALESCE(has_perm, FALSE);
END;
$$;


-- ============================================================================
-- 21. RLS POLICIES
-- ============================================================================

-- === Organizations ===
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM user_profiles WHERE user_profiles.id = auth.uid()));

CREATE POLICY "Organization owners can update"
  ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM user_profiles WHERE user_profiles.id = auth.uid() AND role = 'owner'));

-- === User Profiles ===
CREATE POLICY "Users can view profiles in their organization"
  ON user_profiles FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- === Tenant Profiles ===
CREATE POLICY "Users can manage their own tenant profiles"
  ON tenant_profiles FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Public can read active tenant profiles by slug"
  ON tenant_profiles FOR SELECT
  USING (is_active = TRUE);

-- === Campaigns ===
CREATE POLICY "Users can view campaigns in their organization"
  ON campaigns FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Users can create campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Users can update own campaigns"
  ON campaigns FOR UPDATE
  USING (organization_id = public.current_user_organization_id()
    AND (created_by = auth.uid() OR public.user_has_permission('manage_campaigns')));

CREATE POLICY "Admins can delete campaigns"
  ON campaigns FOR DELETE
  USING (organization_id = public.current_user_organization_id()
    AND public.user_has_permission('manage_campaigns'));

-- === Schools ===
CREATE POLICY "Users can view schools in their organization"
  ON schools FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Users can create schools in their organization"
  ON schools FOR INSERT
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "Users can update schools in their organization"
  ON schools FOR UPDATE
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Admins can delete schools in their organization"
  ON schools FOR DELETE
  USING (organization_id = public.current_user_organization_id()
    AND public.user_has_education_permission('manage_schools'));

-- === Stakeholder Sessions ===
CREATE POLICY "Users can view sessions in their organization"
  ON stakeholder_sessions FOR SELECT
  USING (campaign_id IN (SELECT id FROM campaigns WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "Users can manage sessions in their organization"
  ON stakeholder_sessions FOR ALL
  USING (campaign_id IN (SELECT id FROM campaigns WHERE organization_id = public.current_user_organization_id()));

-- === Agent Sessions ===
CREATE POLICY "Users can view agent sessions in their organization"
  ON agent_sessions FOR SELECT
  USING (
    stakeholder_session_id IN (
      SELECT ss.id FROM stakeholder_sessions ss
      JOIN campaigns c ON ss.campaign_id = c.id
      WHERE c.organization_id = public.current_user_organization_id()
    )
  );

CREATE POLICY "Token holders can access their education sessions"
  ON agent_sessions FOR SELECT
  USING (participant_token_id IS NOT NULL);

CREATE POLICY "Users can view education sessions in their organization"
  ON agent_sessions FOR SELECT
  USING (
    participant_token_id IN (
      SELECT ept.id FROM education_participant_tokens ept
      JOIN schools s ON ept.school_id = s.id
      WHERE s.organization_id = public.current_user_organization_id()
    )
  );

-- === Education Access Codes ===
CREATE POLICY "Users can view access codes in their organization"
  ON education_access_codes FOR SELECT
  USING (school_id IN (SELECT id FROM schools WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "Users can create access codes in their organization"
  ON education_access_codes FOR INSERT
  WITH CHECK (school_id IN (SELECT id FROM schools WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "Users can update access codes in their organization"
  ON education_access_codes FOR UPDATE
  USING (school_id IN (SELECT id FROM schools WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "Anyone can validate active codes"
  ON education_access_codes FOR SELECT
  USING (status = 'active' AND expires_at > NOW());

-- === Education Participant Tokens ===
CREATE POLICY "Users can view tokens in their organization"
  ON education_participant_tokens FOR SELECT
  USING (school_id IN (SELECT id FROM schools WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "Users can update tokens in their organization"
  ON education_participant_tokens FOR UPDATE
  USING (school_id IN (SELECT id FROM schools WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "Public can look up tokens for session access"
  ON education_participant_tokens FOR SELECT
  USING (true);

-- === Education Safeguarding Alerts ===
CREATE POLICY "Users can view alerts in their organization"
  ON education_safeguarding_alerts FOR SELECT
  USING (school_id IN (SELECT id FROM schools WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "Users can update alerts in their organization"
  ON education_safeguarding_alerts FOR UPDATE
  USING (school_id IN (SELECT id FROM schools WHERE organization_id = public.current_user_organization_id()));

-- === Education Synthesis ===
CREATE POLICY "Organization members can view education synthesis"
  ON education_synthesis FOR SELECT
  USING (
    school_id IN (
      SELECT s.id FROM schools s
      INNER JOIN user_profiles up ON up.organization_id = s.organization_id
      WHERE up.id = auth.uid()
    )
  );

-- === Education Reports ===
CREATE POLICY "Organization members can manage education reports"
  ON education_reports FOR ALL
  USING (
    generated_by = auth.uid()
    OR school_id IN (
      SELECT s.id FROM schools s
      INNER JOIN user_profiles up ON up.organization_id = s.organization_id
      WHERE up.id = auth.uid()
    )
  );

CREATE POLICY "Public token access for active education reports"
  ON education_reports FOR SELECT
  USING (is_active = true AND access_token IS NOT NULL);

-- === Voice Tables ===
CREATE POLICY "Authenticated users can view vertical voice config"
  ON vertical_voice_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage vertical voice config"
  ON vertical_voice_config FOR ALL TO service_role USING (true);

CREATE POLICY "Users can view their organization voice settings"
  ON organization_voice_settings FOR SELECT
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "Org admins can manage voice settings"
  ON organization_voice_settings FOR ALL
  USING (
    organization_id = public.current_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = organization_voice_settings.organization_id
      AND user_profiles.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Users can view their own voice preferences"
  ON user_voice_preferences FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own voice preferences"
  ON user_voice_preferences FOR ALL USING (user_id = auth.uid());

-- === Usage & Billing ===
CREATE POLICY "Tenant owners can view their usage events"
  ON usage_events FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenant_profiles WHERE user_id = auth.uid()));

CREATE POLICY "All authenticated users can read pricing"
  ON model_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins can manage pricing"
  ON model_pricing FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.user_type = 'admin'));

CREATE POLICY "Authenticated users can read subscription tiers"
  ON subscription_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tenants can view own notifications"
  ON usage_notifications FOR SELECT
  USING (tenant_id IN (SELECT id FROM tenant_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenants can acknowledge own notifications"
  ON usage_notifications FOR UPDATE
  USING (tenant_id IN (SELECT id FROM tenant_profiles WHERE user_id = auth.uid()));


-- ============================================================================
-- 22. EDUCATION HELPER FUNCTIONS
-- ============================================================================

-- Generate a unique access code
CREATE OR REPLACE FUNCTION generate_access_code(
  prefix TEXT,
  code_type_short TEXT,
  cohort_short TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  random_part TEXT;
  full_code TEXT;
BEGIN
  random_part := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
  IF cohort_short IS NOT NULL THEN
    full_code := prefix || '-' || code_type_short || '-' || cohort_short || '-' || random_part;
  ELSE
    full_code := prefix || '-' || code_type_short || '-' || random_part;
  END IF;
  RETURN full_code;
END;
$$ LANGUAGE plpgsql;

-- Validate and redeem an access code
CREATE OR REPLACE FUNCTION redeem_access_code(
  input_code TEXT,
  input_campaign_id UUID
)
RETURNS TABLE (
  access_code_id UUID,
  school_id UUID,
  code_type VARCHAR(20),
  cohort_metadata JSONB
) AS $$
DECLARE
  code_record RECORD;
BEGIN
  SELECT * INTO code_record
  FROM education_access_codes
  WHERE code = input_code
    AND campaign_id = input_campaign_id
    AND status = 'active'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired access code';
  END IF;

  UPDATE education_access_codes
  SET status = 'used', used_at = NOW()
  WHERE id = code_record.id;

  RETURN QUERY
  SELECT code_record.id, code_record.school_id, code_record.code_type, code_record.cohort_metadata;
END;
$$ LANGUAGE plpgsql;

-- Generate a cryptographically secure participant token
CREATE OR REPLACE FUNCTION generate_participant_token()
RETURNS TEXT AS $$
DECLARE
  random_hex TEXT;
BEGIN
  random_hex := encode(gen_random_bytes(16), 'hex');
  RETURN 'ff_edu_' || random_hex;
END;
$$ LANGUAGE plpgsql;

-- Create participant token from redeemed access code
CREATE OR REPLACE FUNCTION create_participant_from_code(
  input_access_code_id UUID,
  input_campaign_id UUID,
  input_school_id UUID,
  input_code_type VARCHAR(20),
  input_cohort_metadata JSONB
)
RETURNS TABLE (token TEXT, participant_id UUID) AS $$
DECLARE
  new_token TEXT;
  new_id UUID;
BEGIN
  new_token := generate_participant_token();
  WHILE EXISTS (SELECT 1 FROM education_participant_tokens WHERE education_participant_tokens.token = new_token) LOOP
    new_token := generate_participant_token();
  END LOOP;

  INSERT INTO education_participant_tokens (token, campaign_id, school_id, participant_type, cohort_metadata)
  VALUES (new_token, input_campaign_id, input_school_id, input_code_type, input_cohort_metadata)
  RETURNING id INTO new_id;

  RETURN QUERY SELECT new_token, new_id;
END;
$$ LANGUAGE plpgsql;

-- Update session activity
CREATE OR REPLACE FUNCTION update_participant_activity(input_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE education_participant_tokens
  SET last_session_at = NOW(), session_count = session_count + 1, total_messages = total_messages + 1, updated_at = NOW()
  WHERE token = input_token;
END;
$$ LANGUAGE plpgsql;

-- Mark module as started
CREATE OR REPLACE FUNCTION mark_module_started(input_token TEXT, input_module TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE education_participant_tokens
  SET modules_started = modules_started || to_jsonb(input_module), updated_at = NOW()
  WHERE token = input_token AND NOT (modules_started ? input_module);
END;
$$ LANGUAGE plpgsql;

-- Mark module as completed
CREATE OR REPLACE FUNCTION mark_module_completed(input_token TEXT, input_module TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE education_participant_tokens
  SET modules_completed = modules_completed || to_jsonb(input_module), updated_at = NOW()
  WHERE token = input_token AND NOT (modules_completed ? input_module);
END;
$$ LANGUAGE plpgsql;

-- Create safeguarding alert
CREATE OR REPLACE FUNCTION create_safeguarding_alert(
  input_campaign_id UUID,
  input_school_id UUID,
  input_participant_token VARCHAR(50),
  input_participant_type VARCHAR(20),
  input_cohort_metadata JSONB,
  input_trigger_type VARCHAR(50),
  input_trigger_content TEXT,
  input_trigger_context TEXT,
  input_confidence DECIMAL(3,2),
  input_ai_analysis JSONB
)
RETURNS UUID AS $$
DECLARE
  new_alert_id UUID;
BEGIN
  INSERT INTO education_safeguarding_alerts (
    campaign_id, school_id, participant_token, participant_type, cohort_metadata,
    trigger_type, trigger_content, trigger_context, trigger_confidence, ai_analysis
  ) VALUES (
    input_campaign_id, input_school_id, input_participant_token, input_participant_type, input_cohort_metadata,
    input_trigger_type, input_trigger_content, input_trigger_context, input_confidence, input_ai_analysis
  )
  RETURNING id INTO new_alert_id;
  RETURN new_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Acknowledge alert
CREATE OR REPLACE FUNCTION acknowledge_alert(
  input_alert_id UUID,
  input_acknowledged_by_role VARCHAR(100),
  input_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE education_safeguarding_alerts
  SET alert_status = 'acknowledged', acknowledged_at = NOW(),
      acknowledged_by_role = input_acknowledged_by_role, acknowledgment_notes = input_notes, updated_at = NOW()
  WHERE id = input_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Resolve alert
CREATE OR REPLACE FUNCTION resolve_alert(
  input_alert_id UUID,
  input_resolved_by_role VARCHAR(100),
  input_resolution_type VARCHAR(50),
  input_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE education_safeguarding_alerts
  SET alert_status = 'resolved', resolved_at = NOW(),
      resolved_by_role = input_resolved_by_role, resolution_type = input_resolution_type,
      resolution_notes = input_notes, updated_at = NOW()
  WHERE id = input_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Get pending alerts for a school
CREATE OR REPLACE FUNCTION get_pending_alerts(input_school_id UUID)
RETURNS TABLE (
  alert_id UUID,
  participant_token VARCHAR(50),
  participant_type VARCHAR(20),
  trigger_type VARCHAR(50),
  trigger_confidence DECIMAL(3,2),
  detected_at TIMESTAMPTZ,
  alert_status VARCHAR(30)
) AS $$
BEGIN
  RETURN QUERY
  SELECT id, ea.participant_token, ea.participant_type, ea.trigger_type,
         ea.trigger_confidence, ea.detected_at, ea.alert_status
  FROM education_safeguarding_alerts ea
  WHERE ea.school_id = input_school_id
    AND ea.alert_status NOT IN ('resolved', 'false_positive')
  ORDER BY ea.detected_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create an education agent session
CREATE OR REPLACE FUNCTION create_education_agent_session(
  input_participant_token_id UUID,
  input_agent_type TEXT,
  input_module TEXT,
  input_participant_type TEXT,
  input_cohort_metadata JSONB,
  input_system_prompt TEXT
)
RETURNS UUID AS $$
DECLARE
  new_session_id UUID;
  education_context JSONB;
BEGIN
  education_context := jsonb_build_object(
    'module', input_module,
    'participant_type', input_participant_type,
    'cohort_metadata', input_cohort_metadata,
    'trust_framing', jsonb_build_object('anonymity_confirmed', false, 'rapport_phase_complete', false),
    'safeguarding', jsonb_build_object('flags_detected', '[]'::jsonb, 'alerts_generated', '[]'::jsonb),
    'progress', jsonb_build_object('questions_asked', 0, 'sections_completed', '[]'::jsonb, 'estimated_completion', 0.0)
  );

  INSERT INTO agent_sessions (stakeholder_session_id, participant_token_id, agent_type, system_prompt, education_session_context)
  VALUES (NULL, input_participant_token_id, input_agent_type, input_system_prompt, education_context)
  RETURNING id INTO new_session_id;

  RETURN new_session_id;
END;
$$ LANGUAGE plpgsql;

-- Log usage event
CREATE OR REPLACE FUNCTION log_usage_event(
  p_tenant_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_tokens_used INTEGER DEFAULT 0,
  p_model_used TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO usage_events (tenant_id, user_id, event_type, event_data, tokens_used, model_used)
  VALUES (p_tenant_id, p_user_id, p_event_type, p_event_data, p_tokens_used, p_model_used)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Education campaign validation trigger
CREATE OR REPLACE FUNCTION validate_education_campaign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_type IN ('education_pilot', 'education_annual') THEN
    IF NEW.school_id IS NULL THEN
      RAISE EXCEPTION 'Education campaigns must have a school_id';
    END IF;
    IF NEW.education_config IS NULL THEN
      RAISE EXCEPTION 'Education campaigns must have education_config';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_education_campaign_trigger
  BEFORE INSERT OR UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION validate_education_campaign();

-- Education agent session validation trigger
CREATE OR REPLACE FUNCTION validate_education_agent_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.participant_token_id IS NOT NULL THEN
    IF NEW.education_session_context IS NULL THEN
      RAISE EXCEPTION 'Education agent sessions must have education_session_context';
    END IF;
    IF NOT (NEW.education_session_context ? 'module') THEN
      RAISE EXCEPTION 'education_session_context must include module';
    END IF;
    IF NOT (NEW.education_session_context ? 'participant_type') THEN
      RAISE EXCEPTION 'education_session_context must include participant_type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_education_agent_session_trigger
  BEFORE INSERT OR UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION validate_education_agent_session();


-- ============================================================================
-- 23. GRANT STATEMENTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.current_user_organization_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_education_permission TO authenticated;
GRANT EXECUTE ON FUNCTION generate_access_code TO authenticated;
GRANT EXECUTE ON FUNCTION generate_participant_token TO authenticated;
GRANT EXECUTE ON FUNCTION create_participant_from_code TO authenticated;
GRANT EXECUTE ON FUNCTION update_participant_activity TO authenticated;
GRANT EXECUTE ON FUNCTION mark_module_started TO authenticated;
GRANT EXECUTE ON FUNCTION mark_module_completed TO authenticated;
GRANT EXECUTE ON FUNCTION create_safeguarding_alert TO authenticated;
GRANT EXECUTE ON FUNCTION acknowledge_alert TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_alert TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION create_education_agent_session TO authenticated;
GRANT EXECUTE ON FUNCTION log_usage_event TO authenticated;

-- Grant to anon for public code redemption
GRANT EXECUTE ON FUNCTION redeem_access_code TO anon;


-- ============================================================================
-- 24. AUTH SIGNUP HANDLER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
  org_name TEXT;
  display_name TEXT;
  tenant_slug TEXT;
BEGIN
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'My School');
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  -- Generate org slug
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  org_slug := trim(both '-' from org_slug);
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) THEN
    org_slug := org_slug || '-' || substr(md5(random()::text), 1, 8);
  END IF;

  -- Create organization
  INSERT INTO public.organizations (id, name, slug, plan, subscription_status)
  VALUES (gen_random_uuid(), org_name, org_slug, 'free', 'active')
  RETURNING id INTO new_org_id;

  -- Create user profile (always company/education user type)
  INSERT INTO public.user_profiles (id, organization_id, full_name, email, role, status, user_type)
  VALUES (NEW.id, new_org_id, display_name, NEW.email, 'owner', 'active', 'company');

  -- Generate tenant slug
  tenant_slug := lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  tenant_slug := trim(both '-' from tenant_slug);
  IF length(tenant_slug) < 3 THEN
    tenant_slug := tenant_slug || '-' || substr(md5(random()::text), 1, 6);
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenant_profiles WHERE slug = tenant_slug) THEN
    tenant_slug := tenant_slug || '-' || substr(md5(random()::text), 1, 6);
  END IF;

  -- Create tenant profile (always school type for education standalone)
  INSERT INTO public.tenant_profiles (
    user_id, slug, display_name, tenant_type, brand_config, email_config,
    enabled_assessments, subscription_tier, is_active
  ) VALUES (
    NEW.id, tenant_slug, display_name, 'school',
    '{"logo":null,"colors":{"primary":"#F25C05","primaryHover":"#DC5204","secondary":"#1D9BA3","background":"#FFFEFB","backgroundSubtle":"#FAF8F3","text":"#171614","textMuted":"#71706B","border":"#E6E2D6"},"fonts":{"heading":"Inter","body":"Inter"},"showPoweredBy":true}'::jsonb,
    jsonb_build_object('replyTo', NEW.email, 'senderName', display_name),
    ARRAY['education']::TEXT[],
    'starter',
    true
  );

  RETURN NEW;
END;
$$;

-- Create auth trigger (must be done in Supabase dashboard or via SQL)
-- Note: This trigger fires when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 25. SEED DATA
-- ============================================================================

-- Default voice configuration for education
INSERT INTO vertical_voice_config (vertical_key, display_name, llm_endpoint_path, voice_enabled)
VALUES ('education', 'Education Assessment', '/api/voice/chat/completions', true);

-- Seed model pricing
INSERT INTO model_pricing (provider, model_id, display_name, input_rate_per_million, output_rate_per_million, effective_date, is_active)
VALUES
  ('anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 3.00, 15.00, NOW(), true),
  ('anthropic', 'claude-opus-4-5-20251101', 'Claude Opus 4.5', 15.00, 75.00, NOW(), true),
  ('anthropic', 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 0.80, 4.00, NOW(), true),
  ('openai', 'gpt-4-turbo', 'GPT-4 Turbo', 10.00, 30.00, NOW(), true),
  ('openai', 'gpt-4o', 'GPT-4o', 5.00, 15.00, NOW(), true),
  ('openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 0.50, 1.50, NOW(), true),
  ('google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 7.00, 21.00, NOW(), true),
  ('google', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 0.35, 1.05, NOW(), true),
  ('elevenlabs', 'eleven_turbo_v2', 'ElevenLabs Turbo v2', 0.00, 30.00, NOW(), true),
  ('elevenlabs', 'eleven_multilingual_v2', 'ElevenLabs Multilingual v2', 0.00, 30.00, NOW(), true);

-- Seed subscription tiers
INSERT INTO subscription_tiers (name, display_name, monthly_token_limit, price_cents_monthly)
VALUES
  ('starter', 'Starter', 500000, 2900),
  ('pro', 'Pro', 2000000, 9900),
  ('enterprise', 'Enterprise', 10000000, 49900);


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE organizations IS 'Organizations (schools/school groups) that own campaigns and data';
COMMENT ON TABLE user_profiles IS 'User profiles linked to auth.users with organization membership';
COMMENT ON TABLE tenant_profiles IS 'Tenant branding, billing, and feature configuration';
COMMENT ON TABLE campaigns IS 'Education assessment campaigns linked to schools';
COMMENT ON TABLE schools IS 'Individual schools participating in FlowForge Education assessments';
COMMENT ON TABLE stakeholder_sessions IS 'Individual stakeholder interview sessions within campaigns';
COMMENT ON TABLE agent_sessions IS 'AI conversation state and message history for each session';
COMMENT ON TABLE education_access_codes IS 'One-time access codes for pseudonymous participant authentication';
COMMENT ON TABLE education_participant_tokens IS 'Pseudonymous participant identifiers - NO IDENTITY DATA';
COMMENT ON TABLE education_safeguarding_alerts IS 'Break-glass events for safeguarding - stores token only, not identity';
COMMENT ON TABLE education_synthesis IS 'Generated synthesis results from education interview campaigns';
COMMENT ON TABLE education_reports IS 'Token-based access control for shareable education synthesis reports';
COMMENT ON TABLE vertical_voice_config IS 'System-level voice configuration per vertical';
COMMENT ON TABLE organization_voice_settings IS 'Organization-level voice enablement and usage quotas';
COMMENT ON TABLE user_voice_preferences IS 'Individual user voice mode preferences';
COMMENT ON TABLE usage_events IS 'Tracks billable events for usage-based billing';
COMMENT ON TABLE model_pricing IS 'AI model pricing rates for cost calculation';
COMMENT ON TABLE subscription_tiers IS 'Subscription tiers with usage limits and pricing';
COMMENT ON TABLE usage_notifications IS 'Usage warning notifications sent to tenants';
