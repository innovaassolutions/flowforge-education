'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiUrl } from '@/lib/api-url'
import {
  Key,
  Plus,
  Download,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  GraduationCap,
  Users,
  Building2,
  Copy,
  Search,
  RefreshCw,
  Ban,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AccessCode {
  id: string
  code: string
  participant_type: 'student' | 'teacher' | 'parent' | 'leadership'
  cohort_metadata: {
    year_band?: string
    division?: string
    role_category?: string
  }
  status: 'active' | 'redeemed' | 'expired' | 'revoked'
  redeemed_at: string | null
  expires_at: string
  batch_id: string | null
  batch_name: string | null
  created_at: string
  school_id: string
  campaign_id: string
  schools: { name: string; code: string } | null
  campaigns: { name: string } | null
}

interface School {
  id: string
  name: string
  code: string
}

interface Campaign {
  id: string
  name: string
  school_id: string
}

interface Summary {
  total: number
  by_status: Record<string, number>
  by_type: Record<string, number>
}

const PARTICIPANT_TYPES = [
  { value: 'student', label: 'Student', icon: Users },
  { value: 'teacher', label: 'Teacher', icon: GraduationCap },
  { value: 'parent', label: 'Parent', icon: Users },
  { value: 'leadership', label: 'Leadership', icon: Building2 }
]

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  active: { label: 'Active', icon: CheckCircle, className: 'text-[hsl(var(--success))] bg-success-subtle' },
  used: { label: 'Used', icon: Clock, className: 'text-brand-teal bg-brand-teal/10' },
  redeemed: { label: 'Used', icon: Clock, className: 'text-brand-teal bg-brand-teal/10' }, // Database uses 'redeemed' status
  expired: { label: 'Expired', icon: XCircle, className: 'text-muted-foreground bg-muted' },
  revoked: { label: 'Revoked', icon: Ban, className: 'text-destructive bg-destructive/10' }
}

const YEAR_BANDS = ['7', '8', '9', '10', '11', '12', '13']
const DIVISIONS = ['primary', 'middle', 'secondary', 'sixth_form']
const TEACHER_ROLES = ['classroom_teacher', 'department_head', 'specialist', 'counselor']

export default function AccessCodesPage() {
  const searchParams = useSearchParams()
  const initialSchoolId = searchParams?.get('school_id') ?? null
  const initialCampaignId = searchParams?.get('campaign_id') ?? null

  const [codes, setCodes] = useState<AccessCode[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Filters
  const [filterSchool, setFilterSchool] = useState<string>(initialSchoolId || '')
  const [filterCampaign, setFilterCampaign] = useState<string>(initialCampaignId || '')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Generate form state
  const [genSchoolId, setGenSchoolId] = useState<string>('')
  const [genCampaignId, setGenCampaignId] = useState<string>('')
  const [genParticipantType, setGenParticipantType] = useState<string>('student')
  const [genQuantity, setGenQuantity] = useState<number>(10)
  const [genYearBand, setGenYearBand] = useState<string>('')
  const [genDivision, setGenDivision] = useState<string>('')
  const [genRoleCategory, setGenRoleCategory] = useState<string>('')
  const [genExpiresDays, setGenExpiresDays] = useState<number>(30)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadSchools = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(apiUrl('api/schools'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSchools(data.schools || [])
      }
    } catch (err) {
      console.error('Error loading schools:', err)
    }
  }, [])

  const loadCampaigns = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(apiUrl('api/campaigns'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Filter to education campaigns (those with school_id)
        const educationCampaigns = (data.campaigns || []).filter(
          (c: Campaign & { school_id?: string }) => c.school_id
        )
        setCampaigns(educationCampaigns)
      }
    } catch (err) {
      console.error('Error loading campaigns:', err)
    }
  }, [])

  const loadAccessCodes = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('Authentication required')
        return
      }

      const params = new URLSearchParams()
      params.set('page', currentPage.toString())
      params.set('limit', '50')
      if (filterSchool) params.set('school_id', filterSchool)
      if (filterCampaign) params.set('campaign_id', filterCampaign)
      if (filterStatus) params.set('status', filterStatus)
      if (filterType) params.set('participant_type', filterType)

      const response = await fetch(apiUrl(`api/access-codes?${params.toString()}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load access codes')
      }

      const data = await response.json()
      setCodes(data.codes || [])
      setSummary(data.summary || null)
      setTotalPages(data.pagination?.totalPages || 1)

    } catch (err) {
      console.error('Error loading access codes:', err)
      setError(err instanceof Error ? err.message : 'Failed to load access codes')
    } finally {
      setLoading(false)
    }
  }, [currentPage, filterSchool, filterCampaign, filterStatus, filterType])

  useEffect(() => {
    loadSchools()
    loadCampaigns()
  }, [loadSchools, loadCampaigns])

  useEffect(() => {
    loadAccessCodes()
  }, [loadAccessCodes])

  // Reset generate form when modal opens
  useEffect(() => {
    if (showGenerateModal) {
      setGenSchoolId(filterSchool || (schools.length === 1 ? schools[0].id : ''))
      setGenCampaignId(filterCampaign || '')
      setGenParticipantType('student')
      setGenQuantity(10)
      setGenYearBand('')
      setGenDivision('')
      setGenRoleCategory('')
      setGenExpiresDays(30)
    }
  }, [showGenerateModal, filterSchool, filterCampaign, schools])

  async function handleGenerateCodes(e: React.FormEvent) {
    e.preventDefault()
    if (!genSchoolId || !genCampaignId) return

    try {
      setGenerating(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const cohort_metadata: Record<string, string> = {}
      if (genYearBand) cohort_metadata.year_band = genYearBand
      if (genDivision) cohort_metadata.division = genDivision
      if (genRoleCategory) cohort_metadata.role_category = genRoleCategory

      const response = await fetch(apiUrl('api/access-codes/generate'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          school_id: genSchoolId,
          campaign_id: genCampaignId,
          participant_type: genParticipantType,
          quantity: genQuantity,
          cohort_metadata,
          expires_in_days: genExpiresDays
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate codes')
      }

      setShowGenerateModal(false)
      loadAccessCodes()
    } catch (err) {
      console.error('Error generating codes:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate codes')
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevokeCodes() {
    if (selectedCodes.length === 0) return
    if (!confirm(`Are you sure you want to revoke ${selectedCodes.length} access code(s)?`)) return

    try {
      setRevoking(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(apiUrl('api/access-codes'), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code_ids: selectedCodes,
          action: 'revoke'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to revoke codes')
      }

      setSelectedCodes([])
      loadAccessCodes()
    } catch (err) {
      console.error('Error revoking codes:', err)
      setError(err instanceof Error ? err.message : 'Failed to revoke codes')
    } finally {
      setRevoking(false)
    }
  }

  function handleExportCodes() {
    const activeCodes = codes.filter(c => c.status === 'active')
    if (activeCodes.length === 0) {
      alert('No active codes to export')
      return
    }

    const csvContent = [
      ['Code', 'Type', 'School', 'Campaign', 'Year Band', 'Division', 'Expires'].join(','),
      ...activeCodes.map(c => [
        c.code,
        c.participant_type,
        c.schools?.name || '',
        c.campaigns?.name || '',
        c.cohort_metadata?.year_band || '',
        c.cohort_metadata?.division || '',
        new Date(c.expires_at).toLocaleDateString()
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `access-codes-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function copyToClipboard(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  function toggleCodeSelection(codeId: string) {
    setSelectedCodes(prev =>
      prev.includes(codeId)
        ? prev.filter(id => id !== codeId)
        : [...prev, codeId]
    )
  }

  function toggleSelectAll() {
    const activeCodes = codes.filter(c => c.status === 'active')
    if (selectedCodes.length === activeCodes.length) {
      setSelectedCodes([])
    } else {
      setSelectedCodes(activeCodes.map(c => c.id))
    }
  }

  const filteredCodes = codes.filter(code => {
    if (searchQuery) {
      return code.code.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  const filteredCampaigns = filterSchool
    ? campaigns.filter(c => c.school_id === filterSchool)
    : campaigns

  const genFilteredCampaigns = genSchoolId
    ? campaigns.filter(c => c.school_id === genSchoolId)
    : campaigns

  if (loading && codes.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
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
                          lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3
                             md:text-3xl">
                <Key className="w-7 h-7 text-primary" />
                Access Codes
              </h1>
              <p className="text-muted-foreground mt-1">
                Generate and manage participant access codes
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleExportCodes}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => setShowGenerateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Generate Codes
              </Button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-destructive/70 hover:text-destructive"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Stats */}
        {summary && (
          <div className="grid grid-cols-2 gap-4 mb-6
                          lg:grid-cols-5">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Codes</p>
              <p className="text-2xl font-bold text-foreground">{summary.total}</p>
            </div>
            <div className="bg-success-subtle rounded-xl border border-[hsl(var(--success))]/30 p-4">
              <p className="text-sm text-[hsl(var(--success))] mb-1">Active</p>
              <p className="text-2xl font-bold text-[hsl(var(--success))]">
                {summary.by_status?.active || 0}
              </p>
            </div>
            <div className="bg-brand-teal/10 rounded-xl border border-brand-teal/30 p-4">
              <p className="text-sm text-brand-teal mb-1">Used</p>
              <p className="text-2xl font-bold text-brand-teal">
                {(summary.by_status?.used || 0) + (summary.by_status?.redeemed || 0)}
              </p>
            </div>
            <div className="bg-muted rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground mb-1">Expired</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {summary.by_status?.expired || 0}
              </p>
            </div>
            <div className="bg-destructive/10 rounded-xl border border-destructive/30 p-4">
              <p className="text-sm text-destructive mb-1">Revoked</p>
              <p className="text-2xl font-bold text-destructive">
                {summary.by_status?.revoked || 0}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <div className="flex flex-col gap-4
                          md:flex-row md:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span>Filters:</span>
            </div>

            <div className="flex flex-wrap gap-3 flex-1">
              <select
                value={filterSchool}
                onChange={(e) => {
                  setFilterSchool(e.target.value)
                  setFilterCampaign('')
                  setCurrentPage(1)
                }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Schools</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>

              <select
                value={filterCampaign}
                onChange={(e) => {
                  setFilterCampaign(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/20"
                disabled={filteredCampaigns.length === 0}
              >
                <option value="">All Campaigns</option>
                {filteredCampaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="redeemed">Used</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Types</option>
                {PARTICIPANT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search codes..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={loadAccessCodes}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedCodes.length > 0 && (
          <div className="bg-accent-subtle rounded-xl border border-primary/30 p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{selectedCodes.length}</span> code(s) selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCodes([])}
              >
                Clear Selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevokeCodes}
                disabled={revoking}
              >
                {revoking ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-1" />
                    Revoke Selected
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Codes Table */}
        {filteredCodes.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Image
              src="/illustrations/teacher-whiteboard.png"
              alt="No access codes"
              width={200}
              height={200}
              className="mx-auto mb-6 opacity-80"
              unoptimized
            />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Access Codes Found</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {filterSchool || filterCampaign || filterStatus || filterType
                ? 'No codes match your current filters. Try adjusting the filters or generate new codes.'
                : 'Generate access codes to enable participants to join education assessments.'}
            </p>
            <Button onClick={() => setShowGenerateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Generate Codes
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCodes.length === codes.filter(c => c.status === 'active').length && selectedCodes.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      School
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Campaign
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Cohort
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Expires
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCodes.map((code) => {
                    const statusConfig = STATUS_CONFIG[code.status] || STATUS_CONFIG.active
                    const StatusIcon = statusConfig.icon

                    return (
                      <tr
                        key={code.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          selectedCodes.includes(code.id) ? 'bg-accent-subtle' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          {code.status === 'active' && (
                            <input
                              type="checkbox"
                              checked={selectedCodes.includes(code.id)}
                              onChange={() => toggleCodeSelection(code.id)}
                              className="rounded border-border"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm text-foreground bg-muted px-2 py-1 rounded">
                              {code.code}
                            </code>
                            <button
                              onClick={() => copyToClipboard(code.code)}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === code.code ? (
                                <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-sm">{code.participant_type}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {code.schools?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {code.campaigns?.name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground">
                            {code.cohort_metadata?.year_band && (
                              <span>Year {code.cohort_metadata.year_band}</span>
                            )}
                            {code.cohort_metadata?.division && (
                              <span className="capitalize">
                                {code.cohort_metadata.year_band ? ' · ' : ''}
                                {code.cohort_metadata.division}
                              </span>
                            )}
                            {code.cohort_metadata?.role_category && (
                              <span className="capitalize">
                                {code.cohort_metadata.role_category.replace(/_/g, ' ')}
                              </span>
                            )}
                            {!code.cohort_metadata?.year_band &&
                             !code.cohort_metadata?.division &&
                             !code.cohort_metadata?.role_category && '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" suppressHydrationWarning>
                          {new Date(code.expires_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate Modal */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Generate Access Codes
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Create bulk access codes for participants
                </p>
              </div>

              <form onSubmit={handleGenerateCodes} className="p-6 space-y-5">
                {/* School Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    School *
                  </label>
                  <select
                    value={genSchoolId}
                    onChange={(e) => {
                      setGenSchoolId(e.target.value)
                      setGenCampaignId('')
                    }}
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground
                               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select a school...</option>
                    {schools.map(school => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                </div>

                {/* Campaign Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Campaign *
                  </label>
                  <select
                    value={genCampaignId}
                    onChange={(e) => setGenCampaignId(e.target.value)}
                    required
                    disabled={!genSchoolId || genFilteredCampaigns.length === 0}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground
                               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a campaign...</option>
                    {genFilteredCampaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                    ))}
                  </select>
                  {genSchoolId && genFilteredCampaigns.length === 0 && (
                    <p className="text-xs text-warning mt-1">
                      No campaigns found for this school. Create a campaign first.
                    </p>
                  )}
                </div>

                {/* Participant Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Participant Type *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {PARTICIPANT_TYPES.map(type => {
                      const TypeIcon = type.icon
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setGenParticipantType(type.value)}
                          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                            genParticipantType === type.value
                              ? 'border-primary bg-accent-subtle text-foreground'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <TypeIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">{type.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Cohort Metadata */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                  <p className="text-sm font-medium text-foreground">Cohort Metadata (Optional)</p>

                  {(genParticipantType === 'student' || genParticipantType === 'parent') && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Year Band</label>
                      <select
                        value={genYearBand}
                        onChange={(e) => setGenYearBand(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                                   focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Any year</option>
                        {YEAR_BANDS.map(year => (
                          <option key={year} value={year}>Year {year}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(genParticipantType === 'student' || genParticipantType === 'teacher') && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Division</label>
                      <select
                        value={genDivision}
                        onChange={(e) => setGenDivision(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                                   focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Any division</option>
                        {DIVISIONS.map(div => (
                          <option key={div} value={div} className="capitalize">
                            {div.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {genParticipantType === 'teacher' && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Role Category</label>
                      <select
                        value={genRoleCategory}
                        onChange={(e) => setGenRoleCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                                   focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Any role</option>
                        {TEACHER_ROLES.map(role => (
                          <option key={role} value={role} className="capitalize">
                            {role.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Quantity and Expiration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      value={genQuantity}
                      onChange={(e) => setGenQuantity(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                      min={1}
                      max={500}
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground
                                 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Max 500 per batch</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Expires In (days)
                    </label>
                    <select
                      value={genExpiresDays}
                      onChange={(e) => setGenExpiresDays(parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground
                                 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowGenerateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={generating || !genSchoolId || !genCampaignId}
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Generate {genQuantity} Codes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
