'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
// import Link from 'next/link' // Unused - signup link disabled
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
// OAuth disabled - users are created by admins with email/password
// import SocialAuthButtons from '@/components/social-auth-buttons'

// Disable static generation for auth pages
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null)

  // Initialize Supabase client in browser only
  useEffect(() => {
    setSupabase(createClient())
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      // Update last_seen_at for the user
      if (data.user) {
        await (supabase
          .from('user_profiles') as any)
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', data.user.id)

        // Log the login for admin tracking (non-blocking)
        fetch('/api/auth/log-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            authMethod: 'password',
            success: true,
          }),
        }).catch((err) => console.error('Failed to log login:', err))
      }

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
          <div className="flex flex-col md:flex-row md:items-center md:gap-8">
            {/* Left side - Form content */}
            <div className="flex-1">
              <div className="text-center md:text-left mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Sign In
                </h1>
                <p className="text-muted-foreground">
                  Welcome back to Innovaas FlowForge
                </p>
              </div>

              {error && (
                <div className="mb-6 bg-destructive/10 border border-destructive/50 rounded-lg p-4">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-[hsl(var(--accent-hover))] text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>

            {/* Right side - Soldier illustration */}
            <div className="hidden md:flex md:items-center md:justify-center">
              <Image
                src="https://www.innovaas.co/illustrations/soldier-guard.png"
                alt="Security guard illustration"
                width={320}
                height={400}
                className="object-contain"
                priority
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
