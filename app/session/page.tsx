'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { apiUrl } from '@/lib/api-url'
import {
  Key,
  Shield,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Lock,
  ArrowRight
} from 'lucide-react'

/**
 * Education Session Entry Page
 * Participants enter their access code to begin the assessment
 * This is a PUBLIC page - no authentication required
 */
export default function EducationSessionEntryPage() {
  return (
    <Suspense fallback={<EducationSessionLoading />}>
      <EducationSessionContent />
    </Suspense>
  )
}

function EducationSessionLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-brand-teal" />
    </div>
  )
}

function EducationSessionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get school code from URL (e.g., /education/session?school=SAIS)
  const schoolCode = searchParams?.get('school') ?? null

  // Dev mode bypass - only in development
  const isDev = process.env.NODE_ENV === 'development'
  const devTestToken = process.env.NEXT_PUBLIC_DEV_TEST_TOKEN

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false)

  // Format code as user types - preserve dashes, convert to uppercase
  function handleCodeChange(value: string) {
    // Convert to uppercase and allow alphanumeric plus dashes
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '')

    // Don't exceed max length (code format like PILOT-STU-Y7-CFTR57)
    if (cleaned.length > 25) return

    setCode(cleaned)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!code.trim()) {
      setError('Please enter your access code')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(apiUrl('api/redeem-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          school_code: schoolCode || undefined
        })
      })

      const data = await response.json()

      if (data.success && data.token) {
        // Redirect to session with token
        router.push(`/session/${data.token}`)
      } else {
        setError(data.error || 'Invalid access code. Please check and try again.')
      }
    } catch (err) {
      console.error('Code redemption error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4
                        sm:px-6
                        lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/icon-orb.svg"
              alt="FlowForge"
              width={36}
              height={36}
              className="w-9 h-9"
              unoptimized
            />
            <div>
              <h1 className="text-lg font-bold text-foreground">FlowForge Education</h1>
              <p className="text-xs text-muted-foreground">School Assessment Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Welcome Card */}
          <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            {/* Header Section */}
            <div className="bg-brand-teal px-6 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Enter Your Access Code</h2>
              <p className="text-white/80 mt-2 text-sm">
                Use the code provided by your school to begin
              </p>
              {schoolCode && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
                  <Shield className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    {schoolCode} Portal
                  </span>
                </div>
              )}
            </div>

            {/* Form Section */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Code Input */}
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
                    Access Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="PILOT-STU-Y10-XXXXX"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground
                               text-center font-mono text-lg tracking-wider
                               placeholder:text-muted-foreground placeholder:font-normal placeholder:text-sm placeholder:tracking-normal
                               focus:outline-none focus:ring-2 focus:ring-brand-teal/50 focus:border-brand-teal
                               transition-all"
                    disabled={loading}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || !code.trim()}
                  className="w-full bg-brand-teal hover:bg-brand-teal/90 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white font-semibold py-3 px-6 rounded-xl
                             flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Start Assessment
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Privacy Notice */}
              <div className="mt-6 pt-6 border-t border-border">
                <button
                  onClick={() => setShowPrivacyInfo(!showPrivacyInfo)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  <span>Your privacy is protected</span>
                </button>

                {showPrivacyInfo && (
                  <div className="mt-4 p-4 rounded-xl bg-success-subtle text-sm space-y-3">
                    <div className="flex items-start gap-2">
                      <Shield className="w-5 h-5 text-[hsl(var(--success))] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Complete Anonymity</p>
                        <p className="text-muted-foreground">
                          Your responses cannot be linked back to you. We use pseudonymous tokens, not names.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-[hsl(var(--success))] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Safe Participation</p>
                        <p className="text-muted-foreground">
                          Share honestly without worrying about who might see your answers.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lock className="w-5 h-5 text-[hsl(var(--success))] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Secure Data</p>
                        <p className="text-muted-foreground">
                          Your data is encrypted and only used in aggregate to improve school outcomes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Help Text */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Can't find your code? Contact your school administrator for assistance.
          </p>

          {/* Dev Mode Bypass - Only shows in development with test token configured */}
          {isDev && devTestToken && (
            <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-xs text-yellow-700 dark:text-yellow-400 text-center mb-3 font-medium">
                Development Mode
              </p>
              <button
                onClick={() => router.push(`/session/${devTestToken}`)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2.5 px-4 rounded-lg
                           flex items-center justify-center gap-2 transition-colors text-sm"
              >
                Skip to Test Session
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Powered by</span>
            <Image
              src="https://www.innovaas.co/designguide/innovaas_orange_and_black_transparent_bkgrnd_2559x594.png"
              alt="Innovaas"
              width={80}
              height={19}
              className="h-4 w-auto"
              unoptimized
            />
          </div>
        </div>
      </footer>
    </div>
  )
}
