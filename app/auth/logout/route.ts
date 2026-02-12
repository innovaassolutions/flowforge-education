import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Sign out the user
  await supabase.auth.signOut()

  // Redirect to login page
  return NextResponse.redirect(new URL('/auth/login', request.url))
}
