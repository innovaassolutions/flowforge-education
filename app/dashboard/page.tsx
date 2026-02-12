'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { apiUrl } from '@/lib/api-url'
import { Button } from '@/components/ui/button'
import {
  GraduationCap,
  Key,
  CheckCircle,
  Shield,
  BarChart3,
  Plus,
} from 'lucide-react'

interface SchoolInfo {
  id: string
  name: string
  code: string | null
}

interface Campaign {
  id: string
  name: string
  status: string
  created_at: string
}

interface AccessCodeStats {
  active: number
  redeemed: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [accessCodeStats, setAccessCodeStats] = useState<AccessCodeStats>({ active: 0, redeemed: 0 })
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) return

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
      }

      // Fetch schools
      const schoolsRes = await fetch(apiUrl('api/schools'), { headers })
      if (schoolsRes.ok) {
        const schoolsData = await schoolsRes.json()
        const schools = schoolsData.schools || schoolsData
        if (Array.isArray(schools) && schools.length > 0) {
          setSchoolInfo(schools[0])
        }
      }

      // Fetch campaigns
      const campaignsRes = await fetch(apiUrl('api/campaigns'), { headers })
      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json()
        setCampaigns(campaignsData.campaigns || campaignsData || [])
      }

      // Fetch access code stats
      const codesRes = await fetch(apiUrl('api/access-codes?limit=1000'), { headers })
      if (codesRes.ok) {
        const codesData = await codesRes.json()
        const codes = codesData.access_codes || codesData || []
        setAccessCodeStats({
          active: codes.filter((c: { status: string }) => c.status === 'active').length,
          redeemed: codes.filter((c: { status: string }) => c.status === 'redeemed').length,
        })
      }

      // Fetch safeguarding alert count
      const alertsRes = await fetch(apiUrl('api/safeguarding/alerts?limit=1'), { headers })
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlertCount(alertsData.summary?.urgent || 0)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
            <p className="text-muted-foreground mt-4">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="bg-card border-b border-border px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {schoolInfo?.name || 'Your school dashboard'}
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/dashboard/access-codes">
              <Key className="w-4 h-4 mr-2" />
              Manage Access Codes
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-8 py-8">
        {error && (
          <div className="bg-card border border-destructive/20 rounded-lg p-8 text-center mb-8">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link
            href="/dashboard/schools"
            className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <GraduationCap className="w-10 h-10 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">My School</p>
                <h3 className="text-lg font-bold text-foreground truncate">
                  {schoolInfo?.name || 'No school yet'}
                </h3>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/access-codes"
            className="bg-card border border-border rounded-xl p-6 hover:border-[hsl(var(--success))]/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Key className="w-10 h-10 text-[hsl(var(--success))]" />
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Active Codes</p>
                <h3 className="text-4xl font-bold text-[hsl(var(--success))]">{accessCodeStats.active}</h3>
              </div>
            </div>
          </Link>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="w-10 h-10 text-brand-teal" />
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Completed</p>
                <h3 className="text-4xl font-bold text-brand-teal">{accessCodeStats.redeemed}</h3>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/safeguarding"
            className="bg-card border border-border rounded-xl p-6 hover:border-warning/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Shield className={`w-10 h-10 ${alertCount > 0 ? 'text-warning' : 'text-[hsl(var(--success))]'}`} />
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Urgent Alerts</p>
                <h3 className={`text-4xl font-bold ${alertCount > 0 ? 'text-warning' : 'text-[hsl(var(--success))]'}`}>
                  {alertCount}
                </h3>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-lg p-8 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/schools"
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <GraduationCap className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-medium text-foreground">View School Details</h3>
                <p className="text-sm text-muted-foreground">See school information and settings</p>
              </div>
            </Link>
            <Link
              href="/dashboard/access-codes"
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Key className="w-8 h-8 text-[hsl(var(--success))]" />
              <div>
                <h3 className="font-medium text-foreground">Manage Access Codes</h3>
                <p className="text-sm text-muted-foreground">Generate and track participant codes</p>
              </div>
            </Link>
            <Link
              href="/dashboard/safeguarding"
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Shield className="w-8 h-8 text-warning" />
              <div>
                <h3 className="font-medium text-foreground">Safeguarding Alerts</h3>
                <p className="text-sm text-muted-foreground">Review and manage safeguarding concerns</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Campaigns Section */}
        {campaigns.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">
                Your Campaigns
              </h2>
              <Link href="/dashboard/campaigns/new" className="text-sm text-primary hover:text-primary/80">
                Create new campaign
              </Link>
            </div>
            <div className="space-y-4">
              {campaigns.slice(0, 5).map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/dashboard/campaigns/${campaign.id}`}
                  className="block bg-card border border-border rounded-lg p-6 transition-colors hover:border-primary/50"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {campaign.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span suppressHydrationWarning>
                          Created {new Date(campaign.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        campaign.status === 'active'
                          ? 'bg-[hsl(var(--accent-subtle))] text-primary'
                          : campaign.status === 'completed'
                          ? 'bg-[hsl(var(--success-subtle))] text-[hsl(var(--success))]'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                      {campaign.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 text-md font-semibold text-foreground">
              No campaigns yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a campaign to send assessment invites to participants.
            </p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/dashboard/campaigns/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
