'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { apiUrl } from '@/lib/api-url'
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  ArrowLeft,
  Filter,
  RefreshCw,
  Users,
  GraduationCap,
  Building2,
  ChevronDown,
  X,
  FileCheck,
  Phone,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SafeguardingAlert {
  id: string
  participant_token: string
  participant_type: 'student' | 'teacher' | 'parent' | 'leadership'
  cohort_metadata: {
    year_band?: string
    division?: string
    role_category?: string
  }
  trigger_type: string
  trigger_content: string
  trigger_context: string | null
  trigger_confidence: number
  ai_analysis: Record<string, unknown>
  detected_at: string
  alert_status: string
  alert_sent_at: string | null
  alert_channel: string | null
  acknowledged_at: string | null
  acknowledged_by_role: string | null
  acknowledgment_notes: string | null
  resolved_at: string | null
  resolved_by_role: string | null
  resolution_type: string | null
  resolution_notes: string | null
  schools: { id: string; name: string } | null
  campaigns: { id: string; name: string } | null
}

interface School {
  id: string
  name: string
}

interface Summary {
  by_status: Record<string, number>
  urgent: number
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; className: string; bgClass: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'text-warning', bgClass: 'bg-warning/10 border-warning/30' },
  sent: { label: 'Sent', icon: AlertCircle, className: 'text-primary', bgClass: 'bg-primary/10 border-primary/30' },
  acknowledged: { label: 'Acknowledged', icon: Eye, className: 'text-brand-teal', bgClass: 'bg-brand-teal/10 border-brand-teal/30' },
  resolved: { label: 'Resolved', icon: CheckCircle, className: 'text-[hsl(var(--success))]', bgClass: 'bg-success-subtle border-[hsl(var(--success))]/30' },
  false_positive: { label: 'False Positive', icon: FileCheck, className: 'text-muted-foreground', bgClass: 'bg-muted border-border' }
}

const TRIGGER_TYPE_LABELS: Record<string, { label: string; severity: 'critical' | 'high' | 'medium' }> = {
  immediate_danger: { label: 'Immediate Danger', severity: 'critical' },
  self_harm: { label: 'Self-Harm Indicators', severity: 'critical' },
  harm_to_others: { label: 'Harm to Others', severity: 'critical' },
  abuse_disclosure: { label: 'Abuse Disclosure', severity: 'high' },
  explicit_request: { label: 'Help Request', severity: 'medium' }
}

const RESOLUTION_TYPES = [
  { value: 'intervention_initiated', label: 'Intervention Initiated' },
  { value: 'welfare_check', label: 'Welfare Check Completed' },
  { value: 'external_referral', label: 'External Referral Made' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'escalated', label: 'Escalated to Authority' },
  { value: 'no_action_required', label: 'No Action Required' }
]

const PARTICIPANT_ICONS: Record<string, typeof Users> = {
  student: Users,
  teacher: GraduationCap,
  parent: Users,
  leadership: Building2
}

export default function SafeguardingDashboardPage() {
  const searchParams = useSearchParams()
  const initialSchoolId = searchParams?.get('school_id') ?? null

  const [alerts, setAlerts] = useState<SafeguardingAlert[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterSchool, setFilterSchool] = useState<string>(initialSchoolId || '')
  const [filterStatus, setFilterStatus] = useState<string>('')

  // Action modal state
  const [selectedAlert, setSelectedAlert] = useState<SafeguardingAlert | null>(null)
  const [actionType, setActionType] = useState<'acknowledge' | 'resolve' | null>(null)
  const [roleTitle, setRoleTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [resolutionType, setResolutionType] = useState('')
  const [processing, setProcessing] = useState(false)

  // Expanded alert for detail view
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null)

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

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setError('Authentication required')
        return
      }

      const params = new URLSearchParams()
      if (filterSchool) params.set('school_id', filterSchool)
      if (filterStatus) params.set('status', filterStatus)

      const response = await fetch(apiUrl(`api/safeguarding/alerts?${params.toString()}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load alerts')
      }

      const data = await response.json()
      setAlerts(data.alerts || [])
      setSummary(data.summary || null)

    } catch (err) {
      console.error('Error loading alerts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [filterSchool, filterStatus])

  useEffect(() => {
    loadSchools()
  }, [loadSchools])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  async function handleAction() {
    if (!selectedAlert || !actionType) return

    try {
      setProcessing(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const body: Record<string, string> = {
        alert_id: selectedAlert.id,
        action: actionType
      }

      if (roleTitle) body.role_title = roleTitle
      if (notes) body.notes = notes
      if (actionType === 'resolve' && resolutionType) {
        body.resolution_type = resolutionType
      }

      const response = await fetch(apiUrl('api/safeguarding/alerts'), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error('Failed to update alert')
      }

      // Reset modal and reload
      setSelectedAlert(null)
      setActionType(null)
      setRoleTitle('')
      setNotes('')
      setResolutionType('')
      loadAlerts()

    } catch (err) {
      console.error('Error updating alert:', err)
      setError(err instanceof Error ? err.message : 'Failed to update alert')
    } finally {
      setProcessing(false)
    }
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-destructive'
    if (confidence >= 0.6) return 'text-warning'
    return 'text-muted-foreground'
  }

  function formatRelativeTime(date: string): string {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const pendingCount = summary?.by_status?.pending || 0
  const urgentCount = summary?.urgent || 0

  if (loading && alerts.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-warning border-r-transparent"></div>
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
                <Shield className="w-7 h-7 text-warning" />
                Safeguarding Alerts
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor and respond to safeguarding concerns
              </p>
            </div>

            {urgentCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">{urgentCount} urgent alert(s) requiring attention</span>
              </div>
            )}
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
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6
                        lg:grid-cols-5">
          <div className="bg-warning/10 rounded-xl border border-warning/30 p-4">
            <p className="text-sm text-warning mb-1">Pending</p>
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
          </div>
          <div className="bg-brand-teal/10 rounded-xl border border-brand-teal/30 p-4">
            <p className="text-sm text-brand-teal mb-1">Acknowledged</p>
            <p className="text-2xl font-bold text-brand-teal">
              {summary?.by_status?.acknowledged || 0}
            </p>
          </div>
          <div className="bg-success-subtle rounded-xl border border-[hsl(var(--success))]/30 p-4">
            <p className="text-sm text-[hsl(var(--success))] mb-1">Resolved</p>
            <p className="text-2xl font-bold text-[hsl(var(--success))]">
              {summary?.by_status?.resolved || 0}
            </p>
          </div>
          <div className="bg-muted rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground mb-1">False Positives</p>
            <p className="text-2xl font-bold text-muted-foreground">
              {summary?.by_status?.false_positive || 0}
            </p>
          </div>
          <div className="bg-destructive/10 rounded-xl border border-destructive/30 p-4">
            <p className="text-sm text-destructive mb-1">Urgent (High Confidence)</p>
            <p className="text-2xl font-bold text-destructive">{urgentCount}</p>
          </div>
        </div>

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
                onChange={(e) => setFilterSchool(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                           focus:outline-none focus:ring-2 focus:ring-warning/20"
              >
                <option value="">All Schools</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm
                           focus:outline-none focus:ring-2 focus:ring-warning/20"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
                <option value="false_positive">False Positive</option>
              </select>
            </div>

            <Button variant="ghost" size="sm" onClick={loadAlerts}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Shield className="w-16 h-16 text-[hsl(var(--success))] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Alerts</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {filterSchool || filterStatus
                ? 'No alerts match your current filters.'
                : 'No safeguarding alerts have been detected. The system is actively monitoring for concerns.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const statusConfig = STATUS_CONFIG[alert.alert_status] || STATUS_CONFIG.pending
              const StatusIcon = statusConfig.icon
              const triggerInfo = TRIGGER_TYPE_LABELS[alert.trigger_type]
              const ParticipantIcon = PARTICIPANT_ICONS[alert.participant_type] || Users
              const isExpanded = expandedAlertId === alert.id

              return (
                <div
                  key={alert.id}
                  className={`bg-card rounded-xl border-2 overflow-hidden transition-all ${
                    alert.alert_status === 'pending' && alert.trigger_confidence >= 0.8
                      ? 'border-destructive/50'
                      : statusConfig.bgClass.includes('border')
                        ? statusConfig.bgClass.split(' ')[1]
                        : 'border-border'
                  }`}
                >
                  {/* Alert Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Severity indicator */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        triggerInfo?.severity === 'critical'
                          ? 'bg-destructive/10'
                          : triggerInfo?.severity === 'high'
                            ? 'bg-warning/10'
                            : 'bg-muted'
                      }`}>
                        <AlertTriangle className={`w-6 h-6 ${
                          triggerInfo?.severity === 'critical'
                            ? 'text-destructive'
                            : triggerInfo?.severity === 'high'
                              ? 'text-warning'
                              : 'text-muted-foreground'
                        }`} />
                      </div>

                      {/* Alert Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {triggerInfo?.label || alert.trigger_type}
                            </h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ParticipantIcon className="w-4 h-4" />
                                <span className="capitalize">{alert.participant_type}</span>
                              </span>
                              {alert.cohort_metadata?.year_band && (
                                <span>Year {alert.cohort_metadata.year_band}</span>
                              )}
                              {alert.schools?.name && (
                                <span>{alert.schools.name}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgClass}`}>
                              <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.className}`} />
                              <span className={statusConfig.className}>{statusConfig.label}</span>
                            </span>
                            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Quick Info Row */}
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className={`font-medium ${getConfidenceColor(alert.trigger_confidence)}`}>
                            {Math.round(alert.trigger_confidence * 100)}% confidence
                          </span>
                          <span className="text-muted-foreground" suppressHydrationWarning>
                            {formatRelativeTime(alert.detected_at)}
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {alert.participant_token.substring(0, 16)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/30">
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Trigger Content */}
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">Concerning Content</h4>
                          <div className="bg-background rounded-lg p-4 border border-border">
                            <p className="text-foreground whitespace-pre-wrap">{alert.trigger_content}</p>
                          </div>
                          {alert.trigger_context && (
                            <>
                              <h4 className="text-sm font-semibold text-foreground mt-4 mb-2">Context</h4>
                              <div className="bg-background rounded-lg p-4 border border-border">
                                <p className="text-muted-foreground text-sm whitespace-pre-wrap">{alert.trigger_context}</p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Timeline & Actions */}
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">Alert Timeline</h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Detected:</span>
                              <span className="text-foreground" suppressHydrationWarning>
                                {new Date(alert.detected_at).toLocaleString()}
                              </span>
                            </div>
                            {alert.acknowledged_at && (
                              <div className="flex items-center gap-3 text-sm">
                                <Eye className="w-4 h-4 text-brand-teal" />
                                <span className="text-muted-foreground">Acknowledged:</span>
                                <span className="text-foreground" suppressHydrationWarning>
                                  {new Date(alert.acknowledged_at).toLocaleString()}
                                  {alert.acknowledged_by_role && ` by ${alert.acknowledged_by_role}`}
                                </span>
                              </div>
                            )}
                            {alert.resolved_at && (
                              <div className="flex items-center gap-3 text-sm">
                                <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />
                                <span className="text-muted-foreground">Resolved:</span>
                                <span className="text-foreground" suppressHydrationWarning>
                                  {new Date(alert.resolved_at).toLocaleString()}
                                  {alert.resolution_type && ` - ${alert.resolution_type.replace(/_/g, ' ')}`}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notes */}
                          {(alert.acknowledgment_notes || alert.resolution_notes) && (
                            <div className="mt-4">
                              <h4 className="text-sm font-semibold text-foreground mb-2">Notes</h4>
                              {alert.acknowledgment_notes && (
                                <p className="text-sm text-muted-foreground mb-2">{alert.acknowledgment_notes}</p>
                              )}
                              {alert.resolution_notes && (
                                <p className="text-sm text-muted-foreground">{alert.resolution_notes}</p>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          {alert.alert_status !== 'resolved' && alert.alert_status !== 'false_positive' && (
                            <div className="mt-6 flex gap-3">
                              {alert.alert_status === 'pending' && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedAlert(alert)
                                    setActionType('acknowledge')
                                  }}
                                  className="bg-brand-teal hover:bg-brand-teal/90"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Acknowledge
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedAlert(alert)
                                  setActionType('resolve')
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Resolve
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Important Notice */}
                      <div className="mt-6 p-4 rounded-lg bg-warning/10 border border-warning/30">
                        <div className="flex items-start gap-3">
                          <Phone className="w-5 h-5 text-warning mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-foreground">Identity Resolution Required</p>
                            <p className="text-muted-foreground mt-1">
                              To identify this participant, use your school's escrow system with token:{' '}
                              <code className="bg-background px-2 py-0.5 rounded text-foreground font-mono">
                                {alert.participant_token}
                              </code>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Action Modal */}
        {selectedAlert && actionType && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {actionType === 'acknowledge' ? (
                    <>
                      <Eye className="w-5 h-5 text-brand-teal" />
                      Acknowledge Alert
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 text-[hsl(var(--success))]" />
                      Resolve Alert
                    </>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {actionType === 'acknowledge'
                    ? 'Confirm you have reviewed this alert'
                    : 'Record the resolution of this safeguarding concern'}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Your Role/Title
                  </label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g., Safeguarding Lead, Deputy Head"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground
                               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {actionType === 'resolve' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Resolution Type *
                    </label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground
                                 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Select resolution...</option>
                      {RESOLUTION_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any relevant notes..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground
                               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-border flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedAlert(null)
                    setActionType(null)
                    setRoleTitle('')
                    setNotes('')
                    setResolutionType('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className={`flex-1 ${actionType === 'acknowledge' ? 'bg-brand-teal hover:bg-brand-teal/90' : ''}`}
                  onClick={handleAction}
                  disabled={processing || (actionType === 'resolve' && !resolutionType)}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : actionType === 'acknowledge' ? (
                    'Acknowledge Alert'
                  ) : (
                    'Resolve Alert'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
