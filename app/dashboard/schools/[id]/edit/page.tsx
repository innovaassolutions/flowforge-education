'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { apiUrl } from '@/lib/api-url'
import {
  GraduationCap,
  MapPin,
  Users,
  Shield,
  Building2,
  ArrowLeft,
  AlertTriangle,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const CURRICULA = [
  { value: 'IB', label: 'International Baccalaureate (IB)' },
  { value: 'British', label: 'British Curriculum' },
  { value: 'American', label: 'American Curriculum' },
  { value: 'Bilingual', label: 'Bilingual' },
  { value: 'National', label: 'National Curriculum' },
  { value: 'Other', label: 'Other' }
]

const SCHOOL_TYPES = [
  { value: 'international', label: 'International School' },
  { value: 'independent', label: 'Independent School' },
  { value: 'public', label: 'Public School' },
  { value: 'charter', label: 'Charter School' }
]

const STUDENT_COUNT_RANGES = [
  { value: '<500', label: 'Under 500 students' },
  { value: '500-1500', label: '500 - 1,500 students' },
  { value: '1500+', label: '1,500+ students' }
]

const FEE_TIERS = [
  { value: 'tier_a', label: 'Tier A - Premium' },
  { value: 'tier_b', label: 'Tier B - Standard' },
  { value: 'tier_c', label: 'Tier C - Accessible' }
]

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'churned', label: 'Churned' }
]

const SAFEGUARDING_PROTOCOLS = [
  { value: 'standard', label: 'Standard Protocol', description: 'Single safeguarding lead receives alerts' },
  { value: 'two_key', label: 'Two-Key Protocol', description: 'Two designated contacts must verify for unmasking' }
]

export default function EditSchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    country: '',
    city: '',
    region: '',
    curriculum: '',
    school_type: '',
    student_count_range: '',
    fee_tier: '',
    status: 'active',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_role: '',
    primary_contact_phone: '',
    safeguarding_lead_name: '',
    safeguarding_lead_email: '',
    safeguarding_lead_phone: '',
    safeguarding_protocol: 'standard',
    safeguarding_backup_contact: ''
  })

  useEffect(() => {
    params.then(p => setSchoolId(p.id))
  }, [params])

  useEffect(() => {
    if (schoolId) {
      loadSchool()
    }
  }, [schoolId])

  async function loadSchool() {
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('Authentication required')
        return
      }

      const response = await fetch(apiUrl(`api/schools/${schoolId}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load school')
      }

      const data = await response.json()
      const school = data.school

      setFormData({
        name: school.name || '',
        code: school.code || '',
        country: school.country || '',
        city: school.city || '',
        region: school.region || '',
        curriculum: school.curriculum || '',
        school_type: school.school_type || '',
        student_count_range: school.student_count_range || '',
        fee_tier: school.fee_tier || '',
        status: school.status || 'active',
        primary_contact_name: school.primary_contact_name || '',
        primary_contact_email: school.primary_contact_email || '',
        primary_contact_role: school.primary_contact_role || '',
        primary_contact_phone: school.primary_contact_phone || '',
        safeguarding_lead_name: school.safeguarding_lead_name || '',
        safeguarding_lead_email: school.safeguarding_lead_email || '',
        safeguarding_lead_phone: school.safeguarding_lead_phone || '',
        safeguarding_protocol: school.safeguarding_protocol || 'standard',
        safeguarding_backup_contact: school.safeguarding_backup_contact || ''
      })
    } catch (err) {
      console.error('Error loading school:', err)
      setError(err instanceof Error ? err.message : 'Failed to load school')
    } finally {
      setLoading(false)
    }
  }

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name || !formData.code || !formData.country) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('Authentication required')
        return
      }

      const response = await fetch(apiUrl(`api/schools/${schoolId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update school')
      }

      router.push(`/dashboard/schools/${schoolId}`)
    } catch (err) {
      console.error('Error updating school:', err)
      setError(err instanceof Error ? err.message : 'Failed to update school')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Authentication required')
        return
      }

      const response = await fetch(apiUrl(`api/schools/${schoolId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete school')
      }

      router.push('/dashboard/schools')
    } catch (err) {
      console.error('Error deleting school:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete school')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl p-8 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Delete School?</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              This will permanently delete <strong>{formData.name}</strong> and all associated
              campaigns, access codes, and participant data. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete School'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8
                      sm:px-6
                      lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/schools/${schoolId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to School
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-accent-subtle rounded-xl flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground
                               md:text-3xl">
                  Edit School
                </h1>
                <p className="text-muted-foreground font-mono">{formData.code}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              School Information
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4
                              md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    School Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    School Code <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground font-mono placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4
                              md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Curriculum
                  </label>
                  <select
                    value={formData.curriculum}
                    onChange={(e) => updateField('curriculum', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select...</option>
                    {CURRICULA.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    School Type
                  </label>
                  <select
                    value={formData.school_type}
                    onChange={(e) => updateField('school_type', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select...</option>
                    {SCHOOL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4
                              md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Student Count
                  </label>
                  <select
                    value={formData.student_count_range}
                    onChange={(e) => updateField('student_count_range', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select...</option>
                    {STUDENT_COUNT_RANGES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Fee Tier
                  </label>
                  <select
                    value={formData.fee_tier}
                    onChange={(e) => updateField('fee_tier', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select...</option>
                    {FEE_TIERS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Location
            </h2>

            <div className="grid grid-cols-1 gap-4
                            md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Country <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Region/State
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => updateField('region', e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Primary Contact
            </h2>

            <div className="grid grid-cols-1 gap-4
                            md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.primary_contact_name}
                  onChange={(e) => updateField('primary_contact_name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role/Title
                </label>
                <input
                  type="text"
                  value={formData.primary_contact_role}
                  onChange={(e) => updateField('primary_contact_role', e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.primary_contact_email}
                  onChange={(e) => updateField('primary_contact_email', e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.primary_contact_phone}
                  onChange={(e) => updateField('primary_contact_phone', e.target.value)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Safeguarding Configuration */}
          <div className="bg-card rounded-xl border-2 border-warning/50 p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-warning" />
              Safeguarding Configuration
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Critical for the break-glass protocol.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Safeguarding Protocol
                </label>
                <div className="grid grid-cols-1 gap-3
                                md:grid-cols-2">
                  {SAFEGUARDING_PROTOCOLS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateField('safeguarding_protocol', p.value)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        formData.safeguarding_protocol === p.value
                          ? 'border-primary bg-accent-subtle'
                          : 'border-border bg-background hover:border-muted'
                      }`}
                    >
                      <div className="font-medium text-foreground">{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4
                              md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Safeguarding Lead Name
                  </label>
                  <input
                    type="text"
                    value={formData.safeguarding_lead_name}
                    onChange={(e) => updateField('safeguarding_lead_name', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Safeguarding Lead Email
                  </label>
                  <input
                    type="email"
                    value={formData.safeguarding_lead_email}
                    onChange={(e) => updateField('safeguarding_lead_email', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Safeguarding Lead Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.safeguarding_lead_phone}
                    onChange={(e) => updateField('safeguarding_lead_phone', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Backup Contact (Two-Key)
                  </label>
                  <input
                    type="text"
                    value={formData.safeguarding_backup_contact}
                    onChange={(e) => updateField('safeguarding_backup_contact', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={formData.safeguarding_protocol !== 'two_key'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4">
            <Link
              href={`/dashboard/schools/${schoolId}`}
              className="px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
