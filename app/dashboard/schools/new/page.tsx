'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  Globe,
  Phone,
  Mail,
  Building2
} from 'lucide-react'

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
  { value: 'tier_a', label: 'Tier A - Premium', description: 'Top-tier international schools' },
  { value: 'tier_b', label: 'Tier B - Standard', description: 'Mid-range international/independent' },
  { value: 'tier_c', label: 'Tier C - Accessible', description: 'Accessible fee structure' }
]

const SAFEGUARDING_PROTOCOLS = [
  { value: 'standard', label: 'Standard Protocol', description: 'Single safeguarding lead receives alerts' },
  { value: 'two_key', label: 'Two-Key Protocol', description: 'Two designated contacts must verify for unmasking' }
]

export default function NewSchoolPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    year_levels: [] as string[],
    divisions: [] as string[],
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

  function updateField(field: string, value: string | string[]) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function generateCode(name: string) {
    // Generate a code from the school name (first letters + random)
    const words = name.trim().split(/\s+/).filter(w => w.length > 0)
    const initials = words.map(w => w[0].toUpperCase()).join('').slice(0, 3)
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `${initials}-${random}`
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
        setError('Authentication required. Please sign in again.')
        return
      }

      const response = await fetch(apiUrl('api/schools'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create school')
      }

      router.push('/dashboard/schools')
    } catch (err) {
      console.error('Error creating school:', err)
      setError(err instanceof Error ? err.message : 'Failed to create school')
    } finally {
      setSubmitting(false)
    }
  }

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
              <GraduationCap className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground
                             md:text-3xl">
                Add New School
              </h1>
              <p className="mt-1 text-muted-foreground">
                Register a school for FlowForge Education assessments
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
                    onChange={(e) => {
                      updateField('name', e.target.value)
                      if (!formData.code) {
                        updateField('code', generateCode(e.target.value))
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="International School of Singapore"
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
                    placeholder="ISS-ABC"
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unique identifier for access codes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4
                              md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Curriculum
                  </label>
                  <select
                    value={formData.curriculum}
                    onChange={(e) => updateField('curriculum', e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select curriculum...</option>
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
                    <option value="">Select type...</option>
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
                    <option value="">Select range...</option>
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
                    <option value="">Select tier...</option>
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
                  placeholder="Singapore"
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
                  placeholder="Singapore"
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
                  placeholder="Central"
                />
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Primary Contact (School Liaison)
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
                  placeholder="Dr. Sarah Chen"
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
                  placeholder="Head of School"
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
                  placeholder="sarah.chen@school.edu"
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
                  placeholder="+65 6123 4567"
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
              Critical for the break-glass protocol. The safeguarding lead receives alerts when
              concerning content is detected in participant interviews.
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
                    placeholder="Ms. Emily Wong"
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
                    placeholder="safeguarding@school.edu"
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
                    placeholder="+65 9123 4567"
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
                    placeholder="backup@school.edu"
                    disabled={formData.safeguarding_protocol !== 'two_key'}
                  />
                </div>
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
              disabled={submitting}
              className="px-6 py-2.5 bg-primary hover:bg-[hsl(var(--accent-hover))] rounded-lg text-primary-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating School...' : 'Create School'}
            </button>
          </div>
        </form>

        {/* Illustration */}
        <div className="mt-12 flex justify-center">
          <Image
            src="/illustrations/teacher.png"
            alt="Teacher illustration"
            width={150}
            height={150}
            className="opacity-40"
            unoptimized
          />
        </div>
      </div>
    </div>
  )
}
