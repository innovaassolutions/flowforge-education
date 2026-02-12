import { Metadata } from 'next'
import EducationLanding from '@/components/landing/education-landing'

export const metadata: Metadata = {
  title: 'FlowForge for Schools - Term-to-Term Leadership Intelligence',
  description: 'A leadership intelligence system for schools navigating growth, change, and rising parent expectations. See what\'s stabilizing, what\'s slipping, and what needs attention now.',
  keywords: ['school assessment', 'leadership intelligence', 'education', 'IB schools', 'CIS', 'WASC', 'international schools', 'stakeholder feedback'],
  openGraph: {
    title: 'FlowForge for Schools - Term-to-Term Leadership Intelligence',
    description: 'A leadership intelligence system for schools navigating growth, change, and rising parent expectations.',
    type: 'website',
    locale: 'en_US',
    siteName: 'FlowForge Education',
    images: [
      {
        url: '/og/education-landing.png',
        width: 1200,
        height: 630,
        alt: 'FlowForge for Schools',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlowForge for Schools - Term-to-Term Leadership Intelligence',
    description: 'A leadership intelligence system for schools navigating growth, change, and rising parent expectations.',
    images: ['/og/education-landing.png'],
  },
}

export default function EducationLandingPage() {
  return <EducationLanding />
}
