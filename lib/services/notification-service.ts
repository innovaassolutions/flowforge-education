/**
 * Usage Notification Service
 */

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { TenantUsage } from './usage-tracker'

export type NotificationType = '75_percent' | '90_percent' | '100_percent'
export type DeliveryMethod = 'in_app' | 'email' | 'both'

interface NotificationThreshold {
  percentage: number
  type: NotificationType
  method: DeliveryMethod
}

interface TenantInfo {
  id: string
  display_name: string
  email_config: {
    replyTo?: string
  } | null
  user_id: string | null
}

const THRESHOLDS: NotificationThreshold[] = [
  { percentage: 100, type: '100_percent', method: 'both' },
  { percentage: 90, type: '90_percent', method: 'both' },
  { percentage: 75, type: '75_percent', method: 'in_app' },
]

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[NotificationService] RESEND_API_KEY not set, email notifications disabled')
    return null
  }
  return new Resend(apiKey)
}

export async function checkAndSendNotifications(
  tenantId: string,
  usage: TenantUsage
): Promise<void> {
  if (usage.limit === 0) {
    return
  }

  const { percentage, billingPeriodStart } = usage
  const billingPeriod = formatBillingPeriod(billingPeriodStart)

  for (const threshold of THRESHOLDS) {
    if (percentage >= threshold.percentage) {
      await sendNotificationIfNotSent(
        tenantId,
        threshold.type,
        threshold.method,
        billingPeriod,
        usage
      )
      break
    }
  }
}

async function sendNotificationIfNotSent(
  tenantId: string,
  type: NotificationType,
  method: DeliveryMethod,
  billingPeriod: string,
  usage: TenantUsage
): Promise<void> {
  const supabase = getServiceClient()

  const { data: existing } = await supabase
    .from('usage_notifications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('notification_type', type)
    .eq('billing_period', billingPeriod)
    .single()

  if (existing) {
    return
  }

  const { data: tenant } = await supabase
    .from('tenant_profiles')
    .select('id, display_name, email_config, user_id')
    .eq('id', tenantId)
    .single() as { data: TenantInfo | null; error: unknown }

  if (!tenant) {
    console.error(`[NotificationService] Tenant not found: ${tenantId}`)
    return
  }

  const { error: insertError } = await supabase
    .from('usage_notifications')
    .insert({
      tenant_id: tenantId,
      notification_type: type,
      billing_period: billingPeriod,
      delivery_method: method,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return
    }
    console.error('[NotificationService] Failed to record notification:', insertError)
    return
  }

  if (method === 'email' || method === 'both') {
    await sendUsageWarningEmail(tenant, type, usage)
  }

  console.log(`[NotificationService] Sent ${type} notification to tenant ${tenantId}`)
}

async function sendUsageWarningEmail(
  tenant: TenantInfo,
  type: NotificationType,
  usage: TenantUsage
): Promise<void> {
  const resend = getResendClient()
  if (!resend) return

  const recipientEmail = tenant.email_config?.replyTo
  if (!recipientEmail) {
    console.warn(`[NotificationService] No email configured for tenant ${tenant.id}`)
    return
  }

  const percentageNum = type === '75_percent' ? 75 : type === '90_percent' ? 90 : 100
  const isOverLimit = type === '100_percent'

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toLocaleString()
  }

  const remaining = Math.max(0, usage.limit - usage.currentUsage)
  const resetDate = usage.billingPeriodEnd.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const subject = isOverLimit
    ? `FlowForge: You've reached your monthly usage limit`
    : `FlowForge: You've used ${percentageNum}% of your monthly allowance`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background-color: ${isOverLimit ? '#dc2626' : '#f97316'}; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${isOverLimit ? 'Usage Limit Reached' : 'Usage Warning'}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #333333; font-size: 16px; line-height: 1.5;">
                Hi ${tenant.display_name},
              </p>
              <p style="margin: 0 0 24px; color: #333333; font-size: 16px; line-height: 1.5;">
                ${isOverLimit
                  ? "You've reached 100% of your monthly AI usage allowance. AI-powered features will be limited until your billing period resets."
                  : `You've used ${percentageNum}% of your monthly AI usage allowance.`
                }
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 14px;">Current Usage</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${formatTokens(usage.currentUsage)} tokens</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 14px;">Monthly Limit</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${formatTokens(usage.limit)} tokens</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 14px;">Remaining</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: ${remaining === 0 ? '#dc2626' : '#0f172a'}; font-size: 14px; font-weight: 600;">${formatTokens(remaining)} tokens</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 14px;">Resets On</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #0f172a; font-size: 14px; font-weight: 600;">${resetDate}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 24px; color: #333333; font-size: 16px; line-height: 1.5;">
                ${isOverLimit
                  ? 'To continue using AI features without interruption, please contact us to upgrade your plan.'
                  : 'To avoid any interruption to your AI-powered features, consider upgrading your plan.'
                }
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="mailto:support@innovaas.co?subject=Upgrade%20Request%20-%20${encodeURIComponent(tenant.display_name)}"
                       style="display: inline-block; padding: 14px 28px; background-color: #1a1a2e; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      Contact Us to Upgrade
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                You're receiving this email because you're a FlowForge tenant administrator.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  try {
    await resend.emails.send({
      from: 'FlowForge <notifications@innovaas.co>',
      to: recipientEmail,
      subject,
      html,
    })
    console.log(`[NotificationService] Sent ${type} email to ${recipientEmail}`)
  } catch (error) {
    console.error('[NotificationService] Failed to send email:', error)
  }
}

function formatBillingPeriod(date: Date): string {
  return date.toISOString().split('T')[0]
}

export async function getUnacknowledgedNotifications(
  tenantId: string
): Promise<{
  type: NotificationType
  sentAt: string
  billingPeriod: string
}[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('usage_notifications')
    .select('notification_type, sent_at, billing_period')
    .eq('tenant_id', tenantId)
    .is('acknowledged_at', null)
    .order('sent_at', { ascending: false })

  if (error) {
    console.error('[NotificationService] Failed to fetch notifications:', error)
    return []
  }

  return (data || []).map((n: { notification_type: NotificationType; sent_at: string; billing_period: string }) => ({
    type: n.notification_type,
    sentAt: n.sent_at,
    billingPeriod: n.billing_period,
  }))
}

export async function acknowledgeNotification(
  tenantId: string,
  notificationType: NotificationType,
  billingPeriod: string
): Promise<boolean> {
  const supabase = getServiceClient()

  const { error } = await supabase
    .from('usage_notifications')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('notification_type', notificationType)
    .eq('billing_period', billingPeriod)

  if (error) {
    console.error('[NotificationService] Failed to acknowledge notification:', error)
    return false
  }

  return true
}

export async function getTenantNotificationHistory(
  tenantId: string,
  limit: number = 50
): Promise<{
  id: string
  type: NotificationType
  billingPeriod: string
  sentAt: string
  deliveryMethod: DeliveryMethod
  acknowledgedAt: string | null
}[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('usage_notifications')
    .select('id, notification_type, billing_period, sent_at, delivery_method, acknowledged_at')
    .eq('tenant_id', tenantId)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[NotificationService] Failed to fetch notification history:', error)
    return []
  }

  return (data || []).map((n: {
    id: string
    notification_type: NotificationType
    billing_period: string
    sent_at: string
    delivery_method: DeliveryMethod
    acknowledged_at: string | null
  }) => ({
    id: n.id,
    type: n.notification_type,
    billingPeriod: n.billing_period,
    sentAt: n.sent_at,
    deliveryMethod: n.delivery_method,
    acknowledgedAt: n.acknowledged_at,
  }))
}
