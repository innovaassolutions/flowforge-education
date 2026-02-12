'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { apiUrl } from '@/lib/api-url'
import {
  GraduationCap,
  FileText,
  Users,
  BookOpen,
  Calendar,
  CheckCircle,
  Loader2,
  School,
  ArrowRight
} from 'lucide-react'

interface SchoolProfile {
  id: string
  name: string
  code: string
  country: string
  curriculum?: string
  student_count_range?: string
}

const CAMPAIGN_TYPES = [
  { value: 'education_pilot', label: '14-Day Pilot', description: 'Short pilot to demonstrate value' },
  { value: 'education_annual', label: 'Annual Assessment', description: 'Full academic year engagement' }
]

const MODULES = [
  { value: 'student_wellbeing', label: 'Student Wellbeing', description: 'Mental health, belonging, safety' },
  { value: 'teaching_learning', label: 'Teaching & Learning', description: 'Pedagogy, curriculum, assessment' },
  { value: 'parent_confidence', label: 'Parent Confidence', description: 'Communication, engagement, trust' }
]

const YEAR_BANDS = [
  { value: '7', label: 'Year 7' },
  { value: '8', label: 'Year 8' },
  { value: '9', label: 'Year 9' },
  { value: '10', label: 'Year 10' },
  { value: '11', label: 'Year 11' },
  { value: '12', label: 'Year 12' }
]

const DIVISIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'middle', label: 'Middle School' },
  { value: 'secondary', label: 'Secondary' }
]

// Component that uses useSearchParams - wrapped in Suspense
function CampaignFormWrapper() {
  const searchParams = useSearchParams()
  const schoolIdFromUrl = searchParams?.get('schoolId') ?? null

  return <NewEducationCampaignForm initialSchoolId={schoolIdFromUrl} />
}

// Main form component
function NewEducationCampaignForm({ initialSchoolId }: { initialSchoolId: string | null }) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)

  const [schools, setSchools] = useState<SchoolProfile[]>([])

  const [formData, setFormData] = useState({
    name: '',
    schoolId: initialSchoolId || '',
    campaignType: 'education_pilot',
    description: '',
    modules: ['student_wellbeing'] as string[],
    studentYearBands: [] as string[],
    studentDivisions: [] as string[],
    teacherDivisions: [] as string[],
    parentYearBands: [] as string[],
    includeLeadership: false
  })

  useEffect(() => {
    loadSchools()
  }, [])

  async function loadSchools() {
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('Authentication required. Please sign in again.')
        return
      }

      const response = await fetch(apiUrl('api/schools'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()
      setSchools(data.schools || [])
    } catch (err) {
      console.error('Error loading schools:', err)
      setError('Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string | string[] | boolean) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function toggleArrayValue(field: string, value: string) {
    const currentArray = formData[field as keyof typeof formData] as string[]
    const isSelected = currentArray.includes(value)

    if (isSelected) {
      updateField(field, currentArray.filter(v => v !== value))
    } else {
      updateField(field, [...currentArray, value])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name || !formData.schoolId) {
      setError('Please fill in all required fields')
      return
    }

    if (formData.modules.length === 0) {
      setError('Please select at least one assessment module')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Authentication required')
        return
      }

      // Build education_config
      const educationConfig = {
        pilot_type: formData.campaignType === 'education_annual' ? 'annual' : '14_day_pilot',
        modules: formData.modules,
        cohorts: {
          students: {
            year_bands: formData.studentYearBands,
            divisions: formData.studentDivisions,
            target_sample_size: 50
          },
          teachers: {
            divisions: formData.teacherDivisions,
            role_categories: [],
            target_sample_size: 20
          },
          parents: {
            year_bands: formData.parentYearBands,
            target_sample_size: 30
          },
          leadership: {
            roles: formData.includeLeadership ? ['head_of_school', 'deputy_head'] : [],
            target_sample_size: formData.includeLeadership ? 5 : 0
          }
        },
        anonymity: {
          access_code_prefix: 'PILOT',
          escrow_model: 'school_held',
          minimum_cohort_size: 5
        },
        safeguarding: {
          break_glass_enabled: true,
          alert_channels: ['portal'],
          escalation_timeout_hours: 4
        }
      }

      const response = await fetch(apiUrl('api/campaigns'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: formData.name,
          school_id: formData.schoolId,
          campaign_type: formData.campaignType,
          description: formData.description,
          education_config: educationConfig
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to create campaign'
        throw new Error(errorMsg)
      }

      setCreatedCampaignId(data.campaign.id)
      setSuccess(true)
    } catch (err) {
      console.error('Error creating campaign:', err)
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  const selectedSchool = schools.find(s => s.id === formData.schoolId)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8
                      sm:px-6
                      lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/schools"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
          >
            Back to Schools
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-accent-subtle rounded-xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground
                             md:text-3xl">
                Create Education Campaign
              </h1>
              <p className="mt-1 text-muted-foreground">
                Set up a new assessment campaign for a school
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Details */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <School className="w-5 h-5 text-primary" />
              Campaign Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  School <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.schoolId}
                  onChange={(e) => updateField('schoolId', e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select a school...</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
                </select>
                {schools.length === 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No schools found.{' '}
                    <Link href="/dashboard/schools/new" className="text-primary hover:underline">
                      Add a school first
                    </Link>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Campaign Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder={selectedSchool ? `${selectedSchool.name} - January 2025 Pilot` : 'School Name - Assessment Period'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Campaign Type
                </label>
                <div className="grid grid-cols-1 gap-3
                                md:grid-cols-2">
                  {CAMPAIGN_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateField('campaignType', type.value)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        formData.campaignType === type.value
                          ? 'border-primary bg-accent-subtle'
                          : 'border-border bg-background hover:border-muted'
                      }`}
                    >
                      <div className="font-medium text-foreground">{type.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Brief description of this assessment campaign..."
                />
              </div>
            </div>
          </div>

          {/* Assessment Modules */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Assessment Modules <span className="text-destructive">*</span>
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select the assessment areas to include in this campaign
            </p>

            <div className="grid grid-cols-1 gap-3
                            md:grid-cols-3">
              {MODULES.map(module => {
                const isSelected = formData.modules.includes(module.value)
                return (
                  <button
                    key={module.value}
                    type="button"
                    onClick={() => toggleArrayValue('modules', module.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-accent-subtle'
                        : 'border-border bg-background hover:border-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && <CheckCircle className="w-4 h-4 text-primary" />}
                      <span className="font-medium text-foreground">{module.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{module.description}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cohort Configuration */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Participant Cohorts
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Configure which participant groups to include (optional - can be set later)
            </p>

            <div className="space-y-6">
              {/* Student Year Bands */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Student Year Bands
                </label>
                <div className="flex flex-wrap gap-2">
                  {YEAR_BANDS.map(year => {
                    const isSelected = formData.studentYearBands.includes(year.value)
                    return (
                      <button
                        key={year.value}
                        type="button"
                        onClick={() => toggleArrayValue('studentYearBands', year.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          isSelected
                            ? 'border-primary bg-accent-subtle text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-muted'
                        }`}
                      >
                        {year.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Divisions */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  School Divisions
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIVISIONS.map(division => {
                    const isSelected = formData.studentDivisions.includes(division.value)
                    return (
                      <button
                        key={division.value}
                        type="button"
                        onClick={() => toggleArrayValue('studentDivisions', division.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          isSelected
                            ? 'border-primary bg-accent-subtle text-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-muted'
                        }`}
                      >
                        {division.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Include Leadership */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.includeLeadership}
                    onChange={(e) => updateField('includeLeadership', e.target.checked)}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
                  />
                  <div>
                    <span className="font-medium text-foreground">Include Leadership Interviews</span>
                    <p className="text-xs text-muted-foreground">
                      Add structured interviews with school leadership team
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href="/dashboard/schools"
              className="px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || schools.length === 0}
              className="px-6 py-2.5 bg-primary hover:bg-[hsl(var(--accent-hover))] rounded-lg text-primary-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Campaign
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Illustration */}
        <div className="mt-12 flex justify-center">
          <Image
            src="/illustrations/student.png"
            alt="Student illustration"
            width={150}
            height={150}
            className="opacity-40"
            unoptimized
          />
        </div>
      </div>

      {/* Success Modal */}
      {success && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl p-8 max-w-md w-full border border-border shadow-2xl">
            <div className="flex flex-col items-center text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-success-subtle rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8 text-[hsl(var(--success))]" />
              </div>

              <h3 className="text-2xl font-bold text-foreground mb-2">
                Campaign Created!
              </h3>
              <p className="text-muted-foreground mb-6">
                Your education campaign has been created successfully.
                Next, generate access codes for participants.
              </p>

              <div className="flex flex-col gap-3 w-full">
                <Link
                  href={`/dashboard/access-codes?campaign=${createdCampaignId}`}
                  className="w-full bg-primary hover:bg-[hsl(var(--accent-hover))] text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors text-center"
                >
                  Generate Access Codes
                </Link>
                <Link
                  href="/dashboard/schools"
                  className="w-full bg-muted hover:bg-border text-foreground px-6 py-3 rounded-lg font-medium transition-colors text-center"
                >
                  Back to Schools
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Default export with Suspense boundary
export default function NewEducationCampaignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    }>
      <CampaignFormWrapper />
    </Suspense>
  )
}
