import { Resend } from 'resend'

// Lazy-loaded Resend client to avoid build-time env var access
let resendClient: Resend | null = null

export function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

// Backward compatibility export using Proxy
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResendClient() as any)[prop]
  }
})

/**
 * Build the "from" address for outbound emails.
 */
export function buildFromAddress(senderName: string): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'notifications@innovaas.co'
  return `${senderName} <${fromEmail}>`
}
