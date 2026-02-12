/**
 * Session Completed Notification Email Template
 *
 * Branded email sent to the coach/consultant when a participant
 * completes their interview assessment.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components'

interface SessionCompletedNotificationProps {
  clientName: string
  assessmentType: string
  completedAt: string
  dashboardUrl: string
  brandConfig: {
    logo?: { url: string; alt?: string }
    colors?: {
      primary?: string
      background?: string
      text?: string
      textMuted?: string
    }
    tagline?: string
  }
  emailConfig?: {
    senderName?: string
    emailFooter?: string
  }
}

export function SessionCompletedNotification({
  clientName,
  assessmentType,
  completedAt,
  dashboardUrl,
  brandConfig,
  emailConfig,
}: SessionCompletedNotificationProps) {
  const primaryColor = brandConfig.colors?.primary || '#1a1a2e'
  const backgroundColor = brandConfig.colors?.background || '#ffffff'
  const textColor = brandConfig.colors?.text || '#333333'
  const mutedColor = brandConfig.colors?.textMuted || '#666666'

  const previewText = `${clientName} has completed their ${assessmentType} assessment`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ ...styles.body, backgroundColor }}>
        <Container style={styles.container}>
          {/* Header with Logo */}
          <Section style={styles.header}>
            {brandConfig.logo?.url ? (
              <Img
                src={brandConfig.logo.url.startsWith('/')
                  ? `${process.env.NEXT_PUBLIC_APP_URL}${brandConfig.logo.url}`
                  : brandConfig.logo.url
                }
                alt={brandConfig.logo.alt || 'Logo'}
                width={180}
                height={60}
                style={styles.logo}
              />
            ) : (
              <Heading style={{ ...styles.brandName, color: primaryColor }}>
                FlowForge
              </Heading>
            )}
            {brandConfig.tagline && (
              <Text style={{ ...styles.tagline, color: mutedColor }}>
                {brandConfig.tagline}
              </Text>
            )}
          </Section>

          {/* Main Content */}
          <Section style={styles.content}>
            <Heading style={{ ...styles.heading, color: textColor }}>
              Session Completed
            </Heading>

            <Text style={{ ...styles.paragraph, color: textColor }}>
              <strong>{clientName}</strong> has completed their {assessmentType} assessment.
            </Text>

            {/* Details */}
            <Section style={styles.detailsBox}>
              <Text style={{ ...styles.detailRow, color: textColor }}>
                <strong>Client:</strong> {clientName}
              </Text>
              <Text style={{ ...styles.detailRow, color: textColor }}>
                <strong>Assessment:</strong> {assessmentType}
              </Text>
              <Text style={{ ...styles.detailRow, color: textColor }}>
                <strong>Completed:</strong> {completedAt}
              </Text>
            </Section>

            <Text style={{ ...styles.paragraph, color: textColor }}>
              You can review their results and generate reports from your dashboard.
            </Text>

            {/* CTA Button */}
            <Section style={styles.buttonContainer}>
              <Button
                href={dashboardUrl}
                style={{ ...styles.button, backgroundColor: primaryColor }}
              >
                View in Dashboard
              </Button>
            </Section>

            <Text style={{ ...styles.smallText, color: mutedColor }}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={{ ...styles.link, color: primaryColor }}>
              <Link href={dashboardUrl} style={{ color: primaryColor }}>
                {dashboardUrl}
              </Link>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={{ ...styles.footerText, color: mutedColor }}>
              {emailConfig?.emailFooter || 'Session completion notification'}
            </Text>
            <Text style={{ ...styles.footerText, color: mutedColor }}>
              Assessment platform powered by{' '}
              <Link
                href="https://flowforge.innovaas.co"
                style={{ color: mutedColor }}
              >
                Innovaas FlowForge
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: 0,
    padding: 0,
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '40px',
  },
  logo: {
    margin: '0 auto',
    display: 'block',
  },
  brandName: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0',
  },
  tagline: {
    fontSize: '14px',
    margin: '8px 0 0',
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '40px',
    border: '1px solid #e2e8f0',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 24px',
  },
  paragraph: {
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 0 16px',
  },
  detailsBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '20px',
    margin: '24px 0',
  },
  detailRow: {
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 4px',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '32px 0',
  },
  button: {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    textDecoration: 'none',
    padding: '14px 32px',
    borderRadius: '8px',
    display: 'inline-block',
  },
  smallText: {
    fontSize: '12px',
    margin: '0 0 8px',
    textAlign: 'center' as const,
  },
  link: {
    fontSize: '12px',
    wordBreak: 'break-all' as const,
    textAlign: 'center' as const,
    margin: '0 0 24px',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '40px',
  },
  footerText: {
    fontSize: '12px',
    margin: '0 0 8px',
  },
}

export default SessionCompletedNotification
