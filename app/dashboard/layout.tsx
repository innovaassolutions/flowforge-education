'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import DashboardSidebar from '@/components/DashboardSidebar'
import { Menu } from 'lucide-react'
import { UsageBanner } from '@/components/billing'

interface UserProfile {
  full_name: string
  email: string
  role: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const client = createClient()
    setSupabase(client)
    checkUser(client)
  }, [])

  async function checkUser(client: SupabaseClient) {
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    const { data: profile } = await client
      .from('user_profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .single()

    if (profile && typeof profile === 'object') {
      setUserProfile(profile as UserProfile)
    }

    setLoading(false)
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
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
      {/* Top Header Bar */}
      <header className="h-16 bg-card border-b border-border flex items-center px-4 fixed top-0 left-0 right-0 z-40">
        {/* Mobile hamburger menu */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="lg:hidden p-2 text-foreground hover:bg-muted rounded-lg transition-colors mr-3"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* App Logo */}
        <div className="flex items-center gap-3">
          <Image
            src="/icon-orb.svg"
            alt="FlowForge Education"
            width={40}
            height={40}
            className="w-10 h-10 shrink-0"
            unoptimized
          />
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-foreground">FlowForge</h1>
            <p className="text-xs text-muted-foreground">Education Platform</p>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <DashboardSidebar
          userProfile={userProfile}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 lg:ml-16 flex flex-col min-h-[calc(100vh-4rem)]">
          <div className="flex-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
              <UsageBanner />
            </div>
            {children}
          </div>

          {/* Footer */}
          <footer className="border-t border-border py-6 mt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-center gap-3">
                <p className="text-sm text-muted-foreground">
                  FlowForge Education v1.0.0
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
