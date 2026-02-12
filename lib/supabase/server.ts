import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
// Server-side Supabase client with user auth context (for RLS)
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Admin client for privileged operations (bypasses RLS)
let adminClient: ReturnType<typeof createSupabaseClient> | null = null

export function getSupabaseAdmin() {
  if (!adminClient) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    }

    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
    }

    console.log('Initializing Supabase Admin Client')
    console.log('URL:', supabaseUrl)
    console.log('Service Role Key:', serviceRoleKey.substring(0, 20) + '...')

    adminClient = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }
  return adminClient
}

// Backward compatibility export
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop]
  }
})
