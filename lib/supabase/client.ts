import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy-loaded client to avoid build-time initialization
let browserClient: SupabaseClient | null = null

// Client-side Supabase client with auth support (for browser)
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return browserClient
}

// Legacy export for backward compatibility using Proxy
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (createClient() as any)[prop]
  }
})
