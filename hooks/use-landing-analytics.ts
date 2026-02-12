'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createCRMClient } from '@/lib/supabase/crm-client'

// Note: Analytics and leads are stored in the CRM Supabase database
// Tables required: analytics_sessions, analytics_page_views, analytics_events, leads
// Run the migration 20241221_landing_pages_cms.sql on the CRM database

interface AnalyticsConfig {
  pageSlug: string
  pageTitle?: string
}

// Session cookie name
const SESSION_COOKIE = 'ff_session_id'
const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  // Check for existing session
  const cookies = document.cookie.split(';')
  const sessionCookie = cookies.find(c => c.trim().startsWith(`${SESSION_COOKIE}=`))

  if (sessionCookie) {
    const sessionId = sessionCookie.split('=')[1]
    // Refresh session expiry
    setSessionCookie(sessionId)
    return sessionId
  }

  // Create new session
  const newSessionId = crypto.randomUUID()
  setSessionCookie(newSessionId)
  return newSessionId
}

function setSessionCookie(sessionId: string) {
  const expires = new Date(Date.now() + SESSION_DURATION)
  document.cookie = `${SESSION_COOKIE}=${sessionId}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
}

function getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop'
  const width = window.innerWidth
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

function getBrowserInfo() {
  if (typeof navigator === 'undefined') return { browser: null, version: null }

  const ua = navigator.userAgent
  let browser = 'Unknown'
  let version = null

  if (ua.includes('Firefox/')) {
    browser = 'Firefox'
    version = ua.split('Firefox/')[1]?.split(' ')[0]
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome'
    version = ua.split('Chrome/')[1]?.split(' ')[0]
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari'
    version = ua.split('Version/')[1]?.split(' ')[0]
  } else if (ua.includes('Edge/')) {
    browser = 'Edge'
    version = ua.split('Edge/')[1]?.split(' ')[0]
  }

  return { browser, version }
}

function getOS() {
  if (typeof navigator === 'undefined') return null

  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown'
}

function getUTMParams() {
  if (typeof window === 'undefined') return {}

  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
  }
}

export function useLandingAnalytics({ pageSlug, pageTitle }: AnalyticsConfig) {
  const supabase = createCRMClient()
  const sessionIdRef = useRef<string>('')
  const pageViewIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const maxScrollRef = useRef<number>(0)

  // Initialize session
  useEffect(() => {
    sessionIdRef.current = getSessionId()
  }, [])

  // Track session
  const trackSession = useCallback(async () => {
    if (!sessionIdRef.current) return

    const utmParams = getUTMParams()
    const { browser, version } = getBrowserInfo()

    try {
      // Check if session exists (using type assertion for new tables)
      const { data: existingSession } = await (supabase as any)
        .from('analytics_sessions')
        .select('id')
        .eq('session_id', sessionIdRef.current)
        .single()

      if (existingSession) {
        // Update last_seen_at
        await (supabase as any)
          .from('analytics_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('session_id', sessionIdRef.current)
      } else {
        // Create new session
        await (supabase as any).from('analytics_sessions').insert({
          session_id: sessionIdRef.current,
          first_page_slug: pageSlug,
          referrer: typeof document !== 'undefined' ? document.referrer : null,
          utm_source: utmParams.utm_source,
          utm_medium: utmParams.utm_medium,
          utm_campaign: utmParams.utm_campaign,
          utm_term: utmParams.utm_term,
          utm_content: utmParams.utm_content,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          browser,
          browser_version: version,
          os: getOS(),
          device_type: getDeviceType(),
          screen_width: typeof window !== 'undefined' ? window.screen.width : null,
          screen_height: typeof window !== 'undefined' ? window.screen.height : null,
          language: typeof navigator !== 'undefined' ? navigator.language : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      }
    } catch (error) {
      console.error('Failed to track session:', error)
    }
  }, [supabase, pageSlug])

  // Track page view
  const trackPageView = useCallback(async () => {
    if (!sessionIdRef.current) return

    try {
      const { data } = await (supabase as any)
        .from('analytics_page_views')
        .insert({
          session_id: sessionIdRef.current,
          page_slug: pageSlug,
          page_title: pageTitle || (typeof document !== 'undefined' ? document.title : null),
          page_url: typeof window !== 'undefined' ? window.location.href : null,
          referrer: typeof document !== 'undefined' ? document.referrer : null,
        })
        .select('id')
        .single()

      if (data) {
        pageViewIdRef.current = data.id
      }
    } catch (error) {
      console.error('Failed to track page view:', error)
    }
  }, [supabase, pageSlug, pageTitle])

  // Track event
  const trackEvent = useCallback(async (
    eventType: 'click' | 'scroll' | 'form_start' | 'form_submit' | 'video_play',
    options: {
      category?: string
      elementId?: string
      elementText?: string
      elementHref?: string
      value?: string
    } = {}
  ) => {
    if (!sessionIdRef.current) return

    try {
      await (supabase as any).from('analytics_events').insert({
        session_id: sessionIdRef.current,
        page_slug: pageSlug,
        event_type: eventType,
        event_category: options.category,
        element_id: options.elementId,
        element_text: options.elementText,
        element_href: options.elementHref,
        event_value: options.value,
      })
    } catch (error) {
      console.error('Failed to track event:', error)
    }
  }, [supabase, pageSlug])

  // Track scroll depth
  const trackScrollDepth = useCallback(() => {
    if (typeof window === 'undefined') return

    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100)

    if (scrollPercent > maxScrollRef.current) {
      maxScrollRef.current = scrollPercent
    }
  }, [])

  // Update page view with time and scroll on unload
  const updatePageViewOnUnload = useCallback(async () => {
    if (!pageViewIdRef.current) return

    const timeOnPage = Math.round((Date.now() - startTimeRef.current) / 1000)

    try {
      await (supabase as any)
        .from('analytics_page_views')
        .update({
          time_on_page_seconds: timeOnPage,
          scroll_depth_percent: maxScrollRef.current,
        })
        .eq('id', pageViewIdRef.current)
    } catch (error) {
      console.error('Failed to update page view:', error)
    }
  }, [supabase])

  // Initialize tracking
  useEffect(() => {
    trackSession()
    trackPageView()
    startTimeRef.current = Date.now()

    // Add scroll listener
    window.addEventListener('scroll', trackScrollDepth, { passive: true })

    // Track on unload
    const handleUnload = () => {
      updatePageViewOnUnload()
    }

    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleUnload()
      }
    })

    return () => {
      window.removeEventListener('scroll', trackScrollDepth)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [trackSession, trackPageView, trackScrollDepth, updatePageViewOnUnload])

  // Return track functions for manual event tracking
  return {
    trackEvent,
    sessionId: sessionIdRef.current,
  }
}

// Lead submission helper - sends to CRM database
export async function submitLead(data: {
  pageSlug: string
  email: string
  name?: string
  phone?: string
  organizationName?: string
  organizationType?: string
  role?: string
  country?: string
  source?: string
}) {
  const supabase = createCRMClient()
  const sessionId = getSessionId()
  const utmParams = getUTMParams()

  try {
    const { error } = await (supabase as any).from('leads').insert({
      page_slug: data.pageSlug,
      session_id: sessionId,
      email: data.email,
      name: data.name,
      phone: data.phone,
      organization_name: data.organizationName,
      organization_type: data.organizationType,
      role: data.role,
      country: data.country,
      source: data.source || 'landing_page',
      utm_source: utmParams.utm_source,
      utm_medium: utmParams.utm_medium,
      utm_campaign: utmParams.utm_campaign,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
    })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Failed to submit lead:', error)
    return { success: false, error }
  }
}
