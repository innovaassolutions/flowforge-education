import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Update last_seen_at for the user
    if (data.user) {
      await (supabase
        .from('user_profiles') as any)
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', data.user.id)

      // Log the login for admin tracking
      try {
        const forwardedFor = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        const userAgent = request.headers.get('user-agent')

        await (supabaseAdmin.from('login_history') as any).insert({
          user_id: data.user.id,
          ip_address: forwardedFor?.split(',')[0].trim() || realIp || null,
          user_agent: userAgent,
          auth_method: 'magic_link', // OAuth callback uses magic_link flow
          success: true,
        })
      } catch (err) {
        console.error('Failed to log login:', err)
        // Non-blocking - don't fail the callback
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}/dashboard`)
}
