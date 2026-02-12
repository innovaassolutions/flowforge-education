'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { apiUrl } from '@/lib/api-url'
import {
  Plus,
  GraduationCap,
  MapPin,
  Users,
  BookOpen,
  Shield,
  Building2,
  Globe,
  AlertTriangle,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  status: string
  safeguarding_lead_name: string | null
  safeguarding_lead_email: string | null
  primary_contact_name: string | null
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

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSchools()
  }, [])

  async function loadSchools() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('Authentication required')
        return
      }

      const response = await fetch(apiUrl('api/schools'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load schools')
      }

      const data = await response.json()
      setSchools(data.schools || [])
    } catch (err) {
      console.error('Error loading schools:', err)
      setError(err instanceof Error ? err.message : 'Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8
                      sm:px-6
                      lg:px-8">
        {/* Header with illustration style from education landing */}
        <div className="flex flex-col gap-8 mb-8
                        lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-6">
            <div className="hidden w-20 h-20 bg-accent-subtle rounded-2xl items-center justify-center
                            sm:flex">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground
                             md:text-3xl">
                School Management
              </h1>
              <p className="mt-2 text-muted-foreground max-w-xl">
                Manage participating schools for FlowForge Education assessments.
                Each school maintains its own safeguarding configuration and access codes.
              </p>
            </div>
          </div>
          <div className="flex gap-3 self-start">
            <Button asChild variant="outline">
              <Link href="/dashboard/campaigns/new">
                <FileText className="w-5 h-5 mr-2" />
                Create Campaign
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/schools/new">
                <Plus className="w-5 h-5 mr-2" />
                Add School
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Schools Grid */}
        {schools.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <div className="w-24 h-24 bg-accent-subtle rounded-2xl flex items-center justify-center mx-auto mb-6">
              <GraduationCap className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No schools yet</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Add your first school to begin creating education campaigns
              and distributing access codes to participants.
            </p>
            <Button asChild size="lg">
              <Link href="/dashboard/schools/new">
                <Plus className="w-5 h-5 mr-2" />
                Add Your First School
              </Link>
            </Button>

            {/* Illustration hint */}
            <div className="mt-12 flex justify-center">
              <Image
                src="/illustrations/teacher-whiteboard.png"
                alt="Teacher illustration"
                width={200}
                height={200}
                className="opacity-60"
                unoptimized
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6
                          md:grid-cols-2
                          lg:grid-cols-3">
            {schools.map((school) => (
              <Link
                key={school.id}
                href={`/dashboard/schools/${school.id}`}
                className="block bg-card rounded-xl border border-border p-6 transition-all
                           hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-teal rounded-xl flex items-center justify-center text-white text-lg font-bold">
                      {school.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground line-clamp-1">
                        {school.name}
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono">{school.code}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[school.status] || STATUS_STYLES.inactive}`}>
                    {school.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">
                      {school.city ? `${school.city}, ` : ''}{school.country}
                    </span>
                  </div>

                  {school.curriculum && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="w-4 h-4 flex-shrink-0" />
                      <span>{CURRICULUM_LABELS[school.curriculum] || school.curriculum}</span>
                    </div>
                  )}

                  {school.student_count_range && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span>{school.student_count_range} students</span>
                    </div>
                  )}
                </div>

                {/* Safeguarding indicator */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Shield className={`w-4 h-4 ${school.safeguarding_lead_email ? 'text-[hsl(var(--success))]' : 'text-warning'}`} />
                      <span className={school.safeguarding_lead_email ? 'text-[hsl(var(--success))]' : 'text-warning'}>
                        {school.safeguarding_lead_email ? 'Safeguarding configured' : 'Safeguarding needed'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(school.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
