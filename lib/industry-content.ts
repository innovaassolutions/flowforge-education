// Education-specific content configuration for landing page

export interface IndustryPainPoint {
	title: string
	description: string
}

export interface IndustryPersona {
	title: string
	description: string
	benefits: string[]
}

export interface IndustryContactForm {
	/** Pre-set interest value sent to CRM (hides dropdown) */
	interest: string
	/** Dialog title when opened from CTA */
	dialogTitle: string
	/** Dialog description below title */
	dialogDescription: string
	/** Label for the organization/company field */
	organizationLabel: string
	/** Placeholder for the organization/company field */
	organizationPlaceholder: string
	/** Label for the role field */
	roleLabel: string
	/** Placeholder for the role field */
	rolePlaceholder: string
	/** Placeholder for the notes textarea */
	notesPlaceholder: string
	/** Source tag for CRM tracking */
	source: string
}

export interface IndustryContent {
	key: string
	name: string
	shortName: string
	// Color accents (CSS custom property values)
	accentColor: string
	accentColorLight: string
	// Character illustration for this industry
	illustration: string
	// Hero section
	heroHeadline: string
	heroHighlight: string
	heroDescription: string | string[]
	// Value propositions
	valueProps: {
		title: string
		description: string
	}[]
	// Target personas for this industry
	personas: IndustryPersona[]
	// Industry-specific pain points
	painPoints: IndustryPainPoint[]
	// How it works steps
	stepsHeading: string
	steps: {
		title: string
		description: string
		bullets: string[]
	}[]
	// Why FlowForge benefits
	benefits: {
		title: string
		description: string
		icon: 'clock' | 'shield' | 'trending-up' | 'brain'
	}[]
	// CTA text
	ctaPrimary: string
	ctaSecondary: string
	// Stats/social proof
	stats: {
		value: string
		label: string
	}[]
	// Mockup reference (component name)
	heroMockup: string
	// Vertical-specific contact form configuration
	contactForm: IndustryContactForm
}

export const educationContent: IndustryContent = {
	key: 'education',
	name: 'Education',
	shortName: 'Education',
	accentColor: 'hsl(220, 70%, 55%)', // Academic blue
	accentColorLight: 'hsl(220, 70%, 93%)',
	illustration: '/illustrations/educator.png',
	heroHeadline: 'Hear Every Voice — See The Whole Institution',
	heroHighlight: 'Every Voice',
	heroDescription: [
		'FlowForge provides leadership and governance teams with a clear, longitudinal view of institutional health — beyond surveys, anecdotes or annual hindsight.',
		'Institutional intelligence — built for continuity, trust and governance.'
	],
	valueProps: [
		{
			title: 'Stakeholder Signal, Not Noise',
			description: 'Structured insight from parents, staff, and leadership — synthesized into patterns leadership can act on.'
		},
		{
			title: 'Institutional Coherence & Alignment',
			description: 'See where perspectives align, diverge, or quietly erode across departments and terms.'
		},
		{
			title: 'Inspection- and Board-Ready Evidence',
			description: 'Continuously generated qualitative evidence that supports governance oversight and accreditation without last-minute scrambling.'
		}
	],
	personas: [
		{
			title: 'Heads of School & Executive Leadership',
			description: 'Maintain institutional continuity, parent confidence and leadership alignment across terms of change.',
			benefits: [
				'Parent satisfaction drivers revealed',
				'Communication gap identification',
				'Enrollment and retention insights'
			]
		},
		{
			title: 'Boards & Governance Committees',
			description: 'Access a defensible, evidence-based view of institutional health beyond anecdote or operational reporting.',
			benefits: [
				'Faculty development needs',
				'Curriculum alignment analysis',
				'Cross-department comparison'
			]
		},
		{
			title: 'Accreditation & Inspection Preparation',
			description: 'Generate inspection-safe evidence continuously, not retroactively.',
			benefits: [
				'Qualitative evidence at scale',
				'Continuous improvement documentation',
				'Multi-stakeholder perspective synthesis'
			]
		}
	],
	painPoints: [
		{
			title: 'Parents Are Silent Until They Leave',
			description: 'Risk emerges quietly, then expensively. Families who are unhappy rarely speak up — they just don\'t re-enroll.'
		},
		{
			title: 'Institutions Track Data, Not Continuity',
			description: '15% response rates and checkbox answers don\'t tell you why. Conversational AI gets 85%+ participation and rich qualitative depth.'
		},
		{
			title: 'Governance Requires Longitudinal Proof',
			description: 'You need evidence of stakeholder voice and continuous improvement. FlowForge delivers both, automatically documented and synthesized.'
		}
	],
	stepsHeading: 'How FlowForge for Schools Operates',
	steps: [
		{
			title: 'Define the Institutional Lens',
			description: 'Leadership selects focus areas aligned to governance priorities and upcoming terms.',
			bullets: ['Multi-stakeholder coordination', 'Flexible methodology selection', 'Progress tracking dashboard']
		},
		{
			title: 'Structured Stakeholder Input',
			description: 'Anonymized, role-specific input collected across the institution.',
			bullets: ['Context-aware questioning', 'Natural conversation flow', 'Anonymous response options']
		},
		{
			title: 'Institutional Intelligence Synthesis',
			description: 'Patterns, risks and continuity signals surfaced in leadership-ready language.',
			bullets: ['Multi-dimensional analysis', 'Visual data representations', 'Actionable recommendations']
		}
	],
	benefits: [
		{ title: 'Episodic Insight with Continuity', description: 'Automate stakeholder interviews while maintaining depth and quality. What used to take weeks now takes days.', icon: 'clock' },
		{ title: 'Reduce Reputational and Governance Risk', description: 'Consistent, structured questioning ensures every stakeholder receives the same rigorous assessment experience.', icon: 'shield' },
		{ title: 'Scale Without Limits', description: 'Conduct assessments with 10 or 1,000 stakeholders simultaneously. Your capacity is no longer bottlenecked by interviewer availability.', icon: 'trending-up' },
		{ title: 'Data-Driven Insights', description: 'AI synthesis identifies patterns, themes, and strategic opportunities across hundreds of interview transcripts instantly.', icon: 'brain' },
	],
	ctaPrimary: 'Request an Executive Overview',
	ctaSecondary: 'See Education Demo',
	stats: [
		{ value: '85%', label: 'Parent participation rate' },
		{ value: '500+', label: 'Voices captured per school' },
		{ value: '2 Weeks', label: 'Complete assessment cycle' }
	],
	heroMockup: 'education',
	contactForm: {
		interest: 'education',
		dialogTitle: 'Request an Executive Overview',
		dialogDescription: 'Tell us about your institution and we\'ll set up a pilot to capture stakeholder voice across your school community.',
		organizationLabel: 'School / Institution Name',
		organizationPlaceholder: 'Westlake Academy',
		roleLabel: 'Your Role',
		rolePlaceholder: 'Head of School',
		notesPlaceholder: 'Tell us about your school, enrollment size, or what stakeholder insights you\'re looking for...',
		source: 'flowforge-education',
	}
}

// Helper to get education content (maintains API compatibility with multi-vertical imports)
export function getIndustryContent(): IndustryContent {
	return educationContent
}
