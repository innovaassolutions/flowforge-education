'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { apiUrl } from '@/lib/api-url'
import {
  GraduationCap,
  MapPin,
  Users,
  BookOpen,
  Shield,
  Mail,
  Phone,
  Building2,
  Plus,
  BarChart3,
  Key,
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportGenerationPanel } from '@/components/education/report/ReportGenerationPanel'

interface School {
  id: string
  name: string
  code: string
  country: string
  city: string | null
  region: string | null
  curriculum: string | null
  school_type: string | null
  student_count_range: string | null
  fee_tier: string | null
  year_levels: string[] | null
  divisions: string[] | null
  status: string
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_role: string | null
  primary_contact_phone: string | null
  safeguarding_lead_name: string | null
  safeguarding_lead_email: string | null
  safeguarding_lead_phone: string | null
  safeguarding_protocol: string | null
  safeguarding_backup_contact: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

interface Campaign {
  id: string
  name: string
  status: string
  education_config: {
    modules?: string[]
    participant_targets?: Record<string, number>
  } | null
  created_at: string
}

interface AlertSummary {
  total: number
  pending: number
  acknowledged: number
  resolved: number
}

interface CampaignReport {
  id: string
  campaign_id: string
  synthesis_id: string
  access_token: string
  report_url: string
  has_safeguarding_signals: boolean
  created_at: string
}

const CURRICULUM_LABELS: Record<string, string> = {
  'IB': 'International Baccalaureate',
  'British': 'British Curriculum',
  'American': 'American Curriculum',
  'Bilingual': 'Bilingual',
  'National': 'National Curriculum',
  'Other': 'Other'
}

const STATUS_STYLES: Record<string, string> = {
  'active': 'bg-success-subtle text-[hsl(var(--success))]',
  'onboarding': 'bg-accent-subtle text-primary',
  'inactive': 'bg-muted text-muted-foreground',
  'churned': 'bg-destructive/10 text-destructive'
}

export default function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [school, setSchool] = useState<School | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignReports, setCampaignReports] = useState<Record<string, CampaignReport>>({})
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setSchoolId(p.id))
  }, [params])

  useEffect(() => {
    if (schoolId) {
      loadSchoolData()
    }
  }, [schoolId])

  async function loadSchoolData() {
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('Authentication required')
        return
      }

      // Load school details
      const schoolResponse = await fetch(apiUrl(`api/schools/${schoolId}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!schoolResponse.ok) {
        throw new Error('Failed to load school')
      }

      const schoolData = await schoolResponse.json()
      setSchool(schoolData.school)

      // Load education campaigns for this school
      const campaignsResponse = await fetch(apiUrl('api/campaigns'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json()
        const schoolCampaigns = (campaignsData.campaigns || []).filter(
          (c: Campaign & { school_id?: string }) => c.school_id === schoolId
        )
        setCampaigns(schoolCampaigns)
      }

      // Load existing education reports for this school's campaigns
      const reportsResponse = await fetch(apiUrl('api/reports'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json()
        const reportsMap: Record<string, CampaignReport> = {}
        ;(reportsData.reports || []).forEach((report: CampaignReport & { campaign_id?: string }) => {
          if (report.campaign_id) {
            reportsMap[report.campaign_id] = report
          }
        })
        setCampaignReports(reportsMap)
      }

      // Load safeguarding alerts summary
      const alertsResponse = await fetch(apiUrl(`api/safeguarding/alerts?school_id=${schoolId}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json()
        setAlertSummary({
          total: alertsData.pagination?.total || 0,
          pending: alertsData.summary?.by_status?.pending || 0,
          acknowledged: alertsData.summary?.by_status?.acknowledged || 0,
          resolved: alertsData.summary?.by_status?.resolved || 0
        })
      }

    } catch (err) {
      console.error('Error loading school data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load school')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
      </div>
    )
  }

  if (error || !school) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8
                        sm:px-6
                        lg:px-8">
          <div className="bg-destructive/10 border border-destructive rounded-lg p-6 text-destructive flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error || 'School not found'}
          </div>
          <Link
            href="/dashboard/schools"
            className="inline-flex items-center gap-2 mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8
                      sm:px-6
                      lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/schools"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Schools
          </Link>

          <div className="flex flex-col gap-4
                          lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-brand-teal rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                {school.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground
                                 md:text-3xl">
                    {school.name}
                  </h1>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[school.status] || STATUS_STYLES.inactive}`}>
                    {school.status}
                  </span>
                </div>
                <p className="text-muted-foreground font-mono">{school.code}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/schools/${school.id}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit School
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/dashboard/campaigns/new?schoolId=${school.id}`}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8
                        lg:grid-cols-3">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-brand-teal" />
              <p className="text-sm text-muted-foreground">Campaigns</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{campaigns.length}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <p className="text-sm text-muted-foreground">Reports</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{Object.keys(campaignReports).length}</p>
          </div>

          <Link
            href={`/dashboard/safeguarding?school_id=${school.id}`}
            className="bg-card rounded-xl border border-border p-5 hover:border-warning transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <Shield className={`w-5 h-5 ${alertSummary?.pending ? 'text-warning' : 'text-muted-foreground'}`} />
              <p className="text-sm text-muted-foreground">Alerts</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{alertSummary?.total || 0}</p>
            {alertSummary?.pending ? (
              <p className="text-xs text-warning mt-1">{alertSummary.pending} pending</p>
            ) : null}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8
                        lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* School Details */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                School Information
              </h2>

              <div className="grid grid-cols-1 gap-4
                              md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Location</p>
                    <p className="text-foreground font-medium">
                      {school.city ? `${school.city}, ` : ''}{school.country}
                      {school.region ? ` (${school.region})` : ''}
                    </p>
                  </div>
                </div>

                {school.curriculum && (
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Curriculum</p>
                      <p className="text-foreground font-medium">
                        {CURRICULUM_LABELS[school.curriculum] || school.curriculum}
                      </p>
                    </div>
                  </div>
                )}

                {school.school_type && (
                  <div className="flex items-start gap-3">
                    <GraduationCap className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">School Type</p>
                      <p className="text-foreground font-medium capitalize">{school.school_type}</p>
                    </div>
                  </div>
                )}

                {school.student_count_range && (
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Student Count</p>
                      <p className="text-foreground font-medium">{school.student_count_range}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Campaigns */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-brand-teal" />
                  Campaigns
                </h2>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/campaigns/new?schoolId=${school.id}`}>
                    <Plus className="w-4 h-4 mr-1" />
                    New
                  </Link>
                </Button>
              </div>

              {campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No campaigns created yet</p>
                  <Button asChild>
                    <Link href={`/dashboard/campaigns/new?schoolId=${school.id}`}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Campaign
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map(campaign => (
                    <div
                      key={campaign.id}
                      className="p-4 rounded-lg border border-border"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <Link
                            href={`/dashboard/campaigns/${campaign.id}`}
                            className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
                          >
                            {campaign.name}
                          </Link>
                          <p className="text-sm text-muted-foreground mt-1">
                            {campaign.education_config?.modules?.map(m =>
                              m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                            ).join(', ') || 'Education Assessment'}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          campaign.status === 'active'
                            ? 'bg-success-subtle text-[hsl(var(--success))]'
                            : campaign.status === 'completed'
                            ? 'bg-brand-teal/10 text-brand-teal'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {campaign.status}
                        </span>
                      </div>

                      {/* Report Generation Panel */}
                      <ReportGenerationPanel
                        campaign={campaign}
                        schoolId={school.id}
                        existingReport={campaignReports[campaign.id] ? {
                          id: campaignReports[campaign.id].id,
                          access_token: campaignReports[campaign.id].access_token,
                          report_url: campaignReports[campaign.id].report_url,
                          has_safeguarding_signals: campaignReports[campaign.id].has_safeguarding_signals,
                          created_at: campaignReports[campaign.id].created_at,
                        } : null}
                        onReportGenerated={(newReport) => {
                          setCampaignReports(prev => ({
                            ...prev,
                            [campaign.id]: {
                              ...newReport,
                              campaign_id: campaign.id,
                              synthesis_id: '',
                            }
                          }))
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Primary Contact */}
            {school.primary_contact_name && (
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Primary Contact
                </h3>
                <div className="space-y-3">
                  <p className="font-medium text-foreground">{school.primary_contact_name}</p>
                  {school.primary_contact_role && (
                    <p className="text-sm text-muted-foreground">{school.primary_contact_role}</p>
                  )}
                  {school.primary_contact_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${school.primary_contact_email}`} className="text-primary hover:underline">
                        {school.primary_contact_email}
                      </a>
                    </div>
                  )}
                  {school.primary_contact_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{school.primary_contact_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Safeguarding Configuration */}
            <div className={`bg-card rounded-xl border-2 p-6 ${
              school.safeguarding_lead_email ? 'border-[hsl(var(--success))]/50' : 'border-warning/50'
            }`}>
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className={`w-4 h-4 ${school.safeguarding_lead_email ? 'text-[hsl(var(--success))]' : 'text-warning'}`} />
                Safeguarding
              </h3>

              {school.safeguarding_lead_email ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
                    <span className="text-[hsl(var(--success))] font-medium">Configured</span>
                  </div>
                  <p className="font-medium text-foreground">{school.safeguarding_lead_name}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{school.safeguarding_lead_email}</span>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Protocol: <span className="font-medium capitalize">{school.safeguarding_protocol || 'standard'}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Not configured</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Safeguarding lead must be set before launching campaigns.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/schools/${school.id}/edit`}>
                      Configure Now
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/dashboard/access-codes?school_id=${school.id}`}>
                    <Key className="w-4 h-4 mr-2" />
                    Manage Access Codes
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/dashboard/safeguarding?school_id=${school.id}`}>
                    <Shield className="w-4 h-4 mr-2" />
                    View Alerts
                  </Link>
                </Button>
              </div>
            </div>

            {/* Metadata */}
            <div className="text-xs text-muted-foreground">
              <p suppressHydrationWarning>Created: {new Date(school.created_at).toLocaleDateString()}</p>
              <p suppressHydrationWarning>Updated: {new Date(school.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
