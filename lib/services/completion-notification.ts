/**
 * Session Completion Notification Service (Education-only)
 *
 * Sends email notifications to school admins when a participant
 * completes an education interview.
 */

import { createClient } from '@supabase/supabase-js'
import { resend, buildFromAddress } from '@/lib/resend'
import { SessionCompletedNotification } from '@/lib/email/templates/session-completed-notification'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

interface CampaignNotificationParams {
  participantName: string
  assessmentType: string
  dashboardPath: string
  campaignId: string
}

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Notify a school admin when an education interview completes.
 */
export async function notifyEducationAdmin(
  params: CampaignNotificationParams,
  supabase?: SupabaseClient
): Promise<void> {
  const client = supabase || getServiceClient()

  const { data: campaign } = await (client
    .from('campaigns') as any)
    .select('created_by, name, facilitator_name, facilitator_email')
    .eq('id', params.campaignId)
    .single()

  if (!campaign) {
    console.error('[CompletionNotification] Campaign not found', params.campaignId)
    return
  }

  let recipientEmail = campaign.facilitator_email
  if (!recipientEmail && campaign.created_by) {
    const { data: userData } = await client.auth.admin.getUserById(campaign.created_by)
    recipientEmail = userData?.user?.email
  }

  if (!recipientEmail) {
    console.error('[CompletionNotification] No admin email found for campaign', params.campaignId)
    return
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const dashboardUrl = `${baseUrl}${params.dashboardPath}`
  const completedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const senderName = campaign.facilitator_name || 'FlowForge'
  const fromAddress = buildFromAddress(senderName)

  const result = await resend.emails.send({
    from: fromAddress,
    to: recipientEmail,
    subject: `Session Completed: ${params.participantName}`,
    react: SessionCompletedNotification({
      clientName: params.participantName,
      assessmentType: params.assessmentType,
      completedAt,
      dashboardUrl,
      brandConfig: {},
      emailConfig: {},
    }),
  })

  if (result.error) {
    console.error('[CompletionNotification] Email send error:', result.error)
  } else {
    console.log(`[CompletionNotification] Sent to ${recipientEmail} (email ID: ${result.data?.id})`)
  }
}
