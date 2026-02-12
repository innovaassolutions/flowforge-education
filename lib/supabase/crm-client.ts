import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// CRM Supabase client for analytics and lead capture
// This connects to the separate CRM database instead of the FlowForge database

let crmClient: ReturnType<typeof createSupabaseClient> | null = null

export function createCRMClient() {
  const url = process.env.NEXT_PUBLIC_CRM_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_CRM_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a no-op proxy during build or when CRM is not configured
    return new Proxy({} as ReturnType<typeof createSupabaseClient>, {
      get() {
        return () => ({ data: null, error: null })
      }
    })
  }

  if (typeof window === 'undefined') {
    // Server-side: create new client each time
    return createSupabaseClient(url, key)
  }

  // Client-side: reuse singleton
  if (!crmClient) {
    crmClient = createSupabaseClient(url, key)
  }
  return crmClient
}
