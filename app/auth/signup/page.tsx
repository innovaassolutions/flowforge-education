'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { UserCircle, Briefcase, Building2, ArrowLeft } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Disable static generation for auth pages
export const dynamic = 'force-dynamic'

type AccountType = 'coach' | 'consultant' | 'company'

const ACCOUNT_TYPES = [
  {
    value: 'coach' as AccountType,
    label: 'Coach',
    description: 'Leadership coaching and archetype assessments',
    icon: UserCircle,
  },
  {
    value: 'consultant' as AccountType,
    label: 'Consultant',
    description: 'Run campaigns and assessments for client organizations',
    icon: Briefcase,
  },
  {
    value: 'company' as AccountType,
    label: 'Institution',
    description: 'Schools, universities, and organizations',
    icon: Building2,
  },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'select-type' | 'form'>('select-type')
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null)

  useEffect(() => {
    setSupabase(createClient())
  }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return

    setLoading(true)
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    if (!accountType) {
      setError('Please select an account type')
      setLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            user_type: accountType,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
            <div className="flex flex-col md:flex-row md:items-center md:gap-8">
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-foreground mb-4">
                  Check Your Email
                </h1>
                <p className="text-muted-foreground mb-6">
                  We've sent a confirmation link to <strong>{formData.email}</strong>.
                  Please check your inbox and click the link to activate your account.
                </p>
                <p className="text-muted-foreground text-sm mb-6">
                  Didn't receive the email? Check your spam folder or try signing up again.
                </p>
                <Link
                  href="/auth/login"
                  className="inline-block bg-primary hover:bg-[hsl(var(--accent-hover))] text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors">
                  Go to Sign In
                </Link>
              </div>
              <div className="hidden md:flex md:items-center md:justify-center">
                <Image
                  src="https://www.innovaas.co/illustrations/welcome-greeter.png"
                  alt="Welcome"
                  width={280}
                  height={280}
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

  // Get the selected account type details
  const selectedType = ACCOUNT_TYPES.find(t => t.value === accountType)

  // Step 1: Account Type Selection
  if (step === 'select-type') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Create Your Account
              </h1>
              <p className="text-muted-foreground">
                Select your account type to get started
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {ACCOUNT_TYPES.map((type) => {
                const Icon = type.icon
                const isSelected = accountType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAccountType(type.value)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all flex items-start gap-4 ${
                      isSelected
                        ? 'border-primary bg-[hsl(var(--accent-subtle))]'
                        : 'border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}>
                        {type.label}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {type.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="text-primary">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => accountType && setStep('form')}
              disabled={!accountType}
              className="w-full bg-primary hover:bg-[hsl(var(--accent-hover))] text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="text-primary hover:underline font-medium">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Registration Form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
          <div className="flex flex-col md:flex-row md:items-center md:gap-8">
            {/* Left side - Form content */}
            <div className="flex-1">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setStep('select-type')}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Change account type
              </button>

              <div className="text-center md:text-left mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Create Your Account
                </h1>
                <p className="text-muted-foreground">
                  Signing up as{' '}
                  <span className="font-medium text-primary">
                    {selectedType?.label}
                  </span>
                </p>
              </div>

              {error && (
                <div className="mb-6 bg-destructive/10 border border-destructive/50 rounded-lg p-4">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-5">
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium text-foreground mb-2">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
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
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-foreground mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Confirm your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-[hsl(var(--accent-hover))] text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50">
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Already have an account?{' '}
                  <Link
                    href="/auth/login"
                    className="text-primary hover:underline font-medium">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>

            {/* Right side - Illustration */}
            <div className="hidden md:flex md:items-center md:justify-center">
              <Image
                src="https://www.innovaas.co/illustrations/welcome-greeter.png"
                alt="Welcome"
                width={280}
                height={280}
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
