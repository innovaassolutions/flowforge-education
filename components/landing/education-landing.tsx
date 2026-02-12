'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
	ArrowRight,
	RefreshCw,
	Flame,
	LogOut,
	TrendingDown,
	HelpCircle,
	Lightbulb,
	CheckCircle,
	Check,
	BookOpen,
	Zap,
	Mail,
	Phone,
} from 'lucide-react'
import { useLandingAnalytics, submitLead } from '@/hooks/use-landing-analytics'

// Base path for static assets
const BASE_PATH = ''

// Static content - can be replaced with CMS content from Supabase
const CONTENT = {
	hero: {
		badge: 'For International Schools',
		title: 'Term-to-Term',
		titleHighlight: 'Leadership Clarity',
		titleEnd: 'for Dynamic Schools',
		subtitle: 'A leadership intelligence system for schools navigating growth, change, and rising parent expectations. See what\'s stabilizing, what\'s slipping, and what needs attention now.',
		ctaPrimary: 'Start 14-Day Pilot',
		ctaSecondary: 'Learn More',
		trustBadges: ['IB', 'CIS', 'WASC'],
	},
	problem: {
		eyebrow: 'The Reality',
		title: 'What School Leaders Actually Face',
		intro: 'Fast-growing schools don\'t struggle from lack of effort. They struggle because operational truth is fragmented.',
		cards: [
			{ icon: 'refresh', text: 'Recurring friction every term' },
			{ icon: 'flame', text: 'Leadership firefighting instead of planning' },
			{ icon: 'logout', text: 'Staff churn without clear root causes' },
			{ icon: 'trending-down', text: 'Parent confidence eroding quietly' },
			{ icon: 'help', text: 'Decisions driven by anecdotes, not patterns' },
		],
		conclusion: 'By the time issues are visible, they\'re already costly.',
	},
	solution: {
		title: 'Introducing FlowForge',
		description: 'FlowForge turns lived experience across the school into real-time institutional intelligence — so leadership can see what\'s stabilizing, what\'s slipping, and what needs attention now.',
	},
	differentiators: {
		eyebrow: 'Why This Is Different',
		title: 'Leadership Intelligence, Not Survey Noise',
		subtitle: 'FlowForge is not a survey tool or compliance exercise. It\'s institutional assurance designed for leadership clarity.',
		whatMakesItDifferent: [
			{ highlight: 'Leadership intelligence', text: ', not feedback noise' },
			{ highlight: 'Term-to-term visibility', text: ', not annual hindsight' },
			{ highlight: 'Pattern detection', text: ', not isolated complaints' },
			{ highlight: 'Anonymous & unbiased', text: ', not political' },
		],
		triangulationSources: ['Parents', 'Teachers', 'Students', 'Operations'],
		whatLeadershipGains: [
			{ highlight: 'academics, operations, culture and communication', prefix: 'Clear visibility across ' },
			{ highlight: 'churn, misalignment and parent confidence risk', prefix: 'Early warning signals for ' },
			{ highlight: 'Evidence-led decision making', text: ' instead of reactive fixes' },
			{ highlight: 'Calmer term transitions', text: ' and stronger leadership alignment' },
		],
	},
	features: {
		eyebrow: 'How It Works',
		title: 'From Conversations to Clarity',
		subtitle: 'AI-powered interviews capture authentic stakeholder perspectives, then synthesize them into actionable leadership intelligence.',
		rows: [
			{
				title: 'Deep Stakeholder Conversations',
				description: 'Our AI interviewer engages parents, teachers, and staff in natural dialogue. It asks follow-up questions, explores concerns in depth, and makes every respondent feel truly heard — capturing context that surveys miss.',
				benefits: [
					'Adaptive questioning based on responses',
					'Available 24/7 on any device',
					'Complete anonymity ensures candor',
				],
				image: `${BASE_PATH}/mockups/education/promo/png/parentinterview_with_motherdaughter.png`,
			},
			{
				title: 'Multi-Dimensional Analysis',
				description: 'FlowForge automatically synthesizes hundreds of conversations into clear, scored assessments across key dimensions. See exactly where strengths lie and where attention is needed.',
				benefits: [
					'Academics, operations, culture & communication',
					'Sentiment analysis by stakeholder group',
					'Term-over-term trend tracking',
				],
				image: `${BASE_PATH}/mockups/education/promo/png/overallscore_femaleteacher.png`,
				reverse: true,
			},
			{
				title: 'Prioritized Recommendations',
				description: 'Get clear, ranked recommendations with impact and effort assessments. Know exactly where to focus leadership attention and resources for maximum improvement.',
				benefits: [
					'High-impact quick wins identified',
					'Evidence-backed with stakeholder quotes',
					'Ready for next-term planning',
				],
				image: `${BASE_PATH}/mockups/education/promo/png/recommendations_with_maleteacher.png`,
			},
		],
	},
	accreditation: {
		title: 'Inspection & Accreditation Alignment',
		description: 'FlowForge aligns naturally with continuous improvement expectations and governance oversight standards. This supports inspection readiness without last-minute evidence gathering.',
		badges: ['IB', 'CIS', 'WASC'],
	},
	pilot: {
		eyebrow: 'Get Started',
		title: 'A Safe Way to Start: Leadership-Only Pilot',
		subtitle: 'For schools that want to evaluate FlowForge without disruption.',
		badge: '14-Day Leadership Pilot',
		detailsTitle: 'Limited-Scope, Confidential Deployment',
		includes: [
			'Leadership & SLT only (5-7 participants)',
			'Sampled inputs from parents, teachers & students',
			'No impact on teaching or daily operations',
			'Non-evaluative, discreet, and leadership-focused',
		],
		note: 'Designed for leadership clarity rather than operational change.',
		outcomeTitle: 'Pilot Outcome',
		outcomeDescription: 'A clear leadership insight summary highlighting strengths, risks, blind spots, and next-term priorities.',
		outcomeAreas: [
			'Staff climate',
			'Parent & student experience',
			'Community confidence',
			'Governance oversight',
			'Strategic planning',
			'Accreditation readiness',
		],
	},
	cta: {
		tagline: 'Operational clarity without exposure.',
		title: 'Reputational Protection Through Foresight',
		description: 'High-performing schools begin with a confidential leadership intelligence review to establish a shared, evidence-based view of institutional health.',
		primaryCta: 'Request 14-Day Pilot',
		secondaryCta: 'Schedule a Call',
	},
}

function getIcon(name: string, className?: string) {
	const icons: Record<string, React.ReactNode> = {
		'refresh': <RefreshCw className={className} />,
		'flame': <Flame className={className} />,
		'logout': <LogOut className={className} />,
		'trending-down': <TrendingDown className={className} />,
		'help': <HelpCircle className={className} />,
		'lightbulb': <Lightbulb className={className} />,
	}
	return icons[name] || null
}

export default function EducationLanding() {
	const { trackEvent } = useLandingAnalytics({
		pageSlug: 'education',
		pageTitle: 'FlowForge for Schools',
	})

	const [formData, setFormData] = useState({
		email: '',
		name: '',
		organization: '',
		role: '',
	})
	const [formSubmitting, setFormSubmitting] = useState(false)
	const [formSuccess, setFormSuccess] = useState(false)

	const handleCtaClick = (ctaName: string, href?: string) => {
		trackEvent('click', {
			category: 'cta',
			elementText: ctaName,
			elementHref: href,
		})
	}

	const handleFormSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setFormSubmitting(true)

		trackEvent('form_submit', {
			category: 'lead',
			value: 'pilot_request',
		})

		const result = await submitLead({
			pageSlug: 'education',
			email: formData.email,
			name: formData.name,
			organizationName: formData.organization,
			role: formData.role,
			organizationType: 'school',
			source: 'pilot_request',
		})

		setFormSubmitting(false)
		if (result.success) {
			setFormSuccess(true)
		}
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Navigation */}
			<nav className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border z-50">
				<div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between
                        lg:px-8">
					<Link href="/" className="flex items-center gap-2.5">
						<div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
							<Zap className="w-5 h-5 text-primary-foreground" />
						</div>
						<span className="text-xl font-bold">
							Flow<span className="text-primary">Forge</span>
						</span>
					</Link>

					<div className="hidden items-center gap-8
                          md:flex">
						<a href="#why-different" className="text-muted-foreground text-sm font-medium hover:text-primary transition-colors">
							Why FlowForge
						</a>
						<a href="#features" className="text-muted-foreground text-sm font-medium hover:text-primary transition-colors">
							Features
						</a>
						<a href="#pilot" className="text-muted-foreground text-sm font-medium hover:text-primary transition-colors">
							Pilot Program
						</a>
						<a
							href="#contact"
							onClick={() => handleCtaClick('Request Pilot', '#contact')}
							className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[hsl(var(--accent-hover))] transition-colors"
						>
							Request Pilot
						</a>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="pt-32 pb-16 bg-gradient-to-b from-background to-muted/50
                          md:pt-40 md:pb-24
                          lg:pb-28">
				<div className="max-w-7xl mx-auto px-6
                        lg:px-8">
					<div className="grid grid-cols-1 gap-12 items-center
                          lg:grid-cols-2 lg:gap-16">
						{/* Content */}
						<div className="max-w-xl">
							<div className="inline-flex items-center gap-2 bg-accent-subtle text-primary px-4 py-2 rounded-full text-sm font-semibold mb-6">
								<BookOpen className="w-4 h-4" />
								{CONTENT.hero.badge}
							</div>

							<h1 className="text-3xl font-extrabold leading-tight mb-6
                             md:text-4xl
                             lg:text-5xl">
								{CONTENT.hero.title}{' '}
								<span className="text-primary">{CONTENT.hero.titleHighlight}</span>{' '}
								{CONTENT.hero.titleEnd}
							</h1>

							<p className="text-lg text-muted-foreground mb-8 leading-relaxed
                            md:text-xl">
								{CONTENT.hero.subtitle}
							</p>

							<div className="flex flex-col gap-4 mb-10
                              sm:flex-row">
								<a
									href="#pilot"
									onClick={() => handleCtaClick(CONTENT.hero.ctaPrimary, '#pilot')}
									className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-lg font-semibold hover:bg-[hsl(var(--accent-hover))] hover:translate-y-[-2px] hover:shadow-lg transition-all"
								>
									{CONTENT.hero.ctaPrimary}
									<ArrowRight className="w-5 h-5" />
								</a>
								<a
									href="#why-different"
									onClick={() => handleCtaClick(CONTENT.hero.ctaSecondary, '#why-different')}
									className="inline-flex items-center justify-center gap-2 bg-card text-foreground px-7 py-3.5 rounded-lg font-semibold border border-border hover:border-primary hover:text-primary transition-colors"
								>
									{CONTENT.hero.ctaSecondary}
								</a>
							</div>

							<div className="flex items-center gap-4 pt-6 border-t border-border">
								<span className="text-sm text-muted-foreground">Aligned with:</span>
								<div className="flex gap-3">
									{CONTENT.hero.trustBadges.map((badge) => (
										<span key={badge} className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
											{badge}
										</span>
									))}
								</div>
							</div>
						</div>

						{/* Hero Image */}
						<div className="relative flex justify-center">
							<Image
								src={`${BASE_PATH}/mockups/education/promo/png/dashboard_and_principle_beside.png`}
								alt="FlowForge Assessment Overview"
								width={450}
								height={620}
								className="max-w-[450px] w-full h-auto rounded-2xl shadow-2xl"
								priority
								unoptimized
							/>
						</div>
					</div>
				</div>
			</section>

			{/* Problem Section */}
			<section className="py-20 bg-background
                          md:py-24">
				<div className="max-w-4xl mx-auto px-6
                        lg:px-8">
					<div className="text-center mb-12">
						<span className="inline-block text-primary text-sm font-semibold uppercase tracking-wide mb-4">
							{CONTENT.problem.eyebrow}
						</span>
						<h2 className="text-2xl font-bold mb-4
                           md:text-3xl
                           lg:text-4xl">
							{CONTENT.problem.title}
						</h2>
					</div>

					<p className="text-center text-lg mb-10 max-w-2xl mx-auto">
						{CONTENT.problem.intro.split('operational truth is fragmented')[0]}
						<strong className="text-primary">operational truth is fragmented</strong>
						{CONTENT.problem.intro.split('operational truth is fragmented')[1]}
					</p>

					<div className="grid grid-cols-1 gap-4 mb-4
                          sm:grid-cols-3">
						{CONTENT.problem.cards.slice(0, 3).map((card, i) => (
							<div key={i} className="bg-muted/50 border border-border rounded-xl p-6 text-center">
								<div className="w-11 h-11 bg-accent-subtle rounded-lg flex items-center justify-center mx-auto mb-4">
									{getIcon(card.icon, 'w-5 h-5 text-primary')}
								</div>
								<p className="text-sm">{card.text}</p>
							</div>
						))}
					</div>

					<div className="grid grid-cols-1 gap-4 max-w-lg mx-auto mb-10
                          sm:grid-cols-2">
						{CONTENT.problem.cards.slice(3).map((card, i) => (
							<div key={i} className="bg-muted/50 border border-border rounded-xl p-6 text-center">
								<div className="w-11 h-11 bg-accent-subtle rounded-lg flex items-center justify-center mx-auto mb-4">
									{getIcon(card.icon, 'w-5 h-5 text-primary')}
								</div>
								<p className="text-sm">{card.text}</p>
							</div>
						))}
					</div>

					<p className="text-center text-muted-foreground italic">
						{CONTENT.problem.conclusion}
					</p>
				</div>
			</section>

			{/* Solution Intro */}
			<section className="py-16 bg-gradient-to-br from-primary to-[#e54d00]
                          md:py-20">
				<div className="max-w-3xl mx-auto px-6 text-center
                        lg:px-8">
					<h2 className="text-2xl font-bold text-white mb-5
                         md:text-3xl">
						{CONTENT.solution.title}
					</h2>
					<p className="text-lg text-white/90 leading-relaxed">
						{CONTENT.solution.description}
					</p>
				</div>
			</section>

			{/* Why Different Section */}
			<section id="why-different" className="py-20 bg-muted/50
                                              md:py-24">
				<div className="max-w-7xl mx-auto px-6
                        lg:px-8">
					<div className="text-center mb-16">
						<span className="inline-block text-primary text-sm font-semibold uppercase tracking-wide mb-4">
							{CONTENT.differentiators.eyebrow}
						</span>
						<h2 className="text-2xl font-bold mb-4
                           md:text-3xl
                           lg:text-4xl">
							{CONTENT.differentiators.title}
						</h2>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							{CONTENT.differentiators.subtitle}
						</p>
					</div>

					<div className="grid grid-cols-1 gap-12
                          lg:grid-cols-2 lg:gap-16">
						{/* What Makes It Different */}
						<div>
							<h3 className="text-xl font-bold mb-6 flex items-center gap-3
                             md:text-2xl">
								<div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
									<Lightbulb className="w-5 h-5 text-primary-foreground" />
								</div>
								What Makes It Different
							</h3>

							<ul className="space-y-5 mb-8">
								{CONTENT.differentiators.whatMakesItDifferent.map((item, i) => (
									<li key={i} className="flex items-start gap-3.5">
										<span className="w-5 h-5 bg-success-subtle rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
											<Check className="w-3 h-3 text-[hsl(var(--success))]" />
										</span>
										<span>
											<strong className="text-primary">{item.highlight}</strong>
											{item.text}
										</span>
									</li>
								))}
							</ul>

							<div className="bg-card border border-border rounded-xl p-5">
								<p className="text-sm text-muted-foreground mb-3">
									Insights are triangulated across:
								</p>
								<div className="flex flex-wrap gap-2 mb-4">
									{CONTENT.differentiators.triangulationSources.map((source) => (
										<span key={source} className="bg-brand-teal/10 text-brand-teal px-3.5 py-1.5 rounded-full text-sm font-semibold">
											{source}
										</span>
									))}
								</div>
								<p className="text-sm text-muted-foreground italic">
									Outputs are visible only to leadership.
								</p>
							</div>
						</div>

						{/* What Leadership Gains */}
						<div>
							<h3 className="text-xl font-bold mb-6 flex items-center gap-3
                             md:text-2xl">
								<div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
									<CheckCircle className="w-5 h-5 text-primary-foreground" />
								</div>
								What Leadership Gains
							</h3>

							<ul className="space-y-5 mb-8">
								{CONTENT.differentiators.whatLeadershipGains.map((item, i) => (
									<li key={i} className="flex items-start gap-3.5">
										<span className="w-5 h-5 bg-success-subtle rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
											<Check className="w-3 h-3 text-[hsl(var(--success))]" />
										</span>
										<span>
											{item.prefix}
											<strong className="text-primary">{item.highlight}</strong>
											{item.text}
										</span>
									</li>
								))}
							</ul>

							<div className="bg-accent-subtle border border-primary/20 rounded-xl p-5">
								<p className="text-sm font-semibold text-primary mb-2">
									Minimal effort. Maximum clarity.
								</p>
								<p className="text-sm text-muted-foreground">
									The process is non-intrusive and does not disrupt teaching or operations.
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-20 bg-background
                                         md:py-24">
				<div className="max-w-7xl mx-auto px-6
                        lg:px-8">
					<div className="text-center mb-16">
						<span className="inline-block text-primary text-sm font-semibold uppercase tracking-wide mb-4">
							{CONTENT.features.eyebrow}
						</span>
						<h2 className="text-2xl font-bold mb-4
                           md:text-3xl
                           lg:text-4xl">
							{CONTENT.features.title}
						</h2>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							{CONTENT.features.subtitle}
						</p>
					</div>

					<div className="space-y-20">
						{CONTENT.features.rows.map((row, i) => (
							<div
								key={i}
								className={`grid grid-cols-1 gap-12 items-center
                            lg:grid-cols-2 lg:gap-16
                            ${row.reverse ? 'lg:[direction:rtl]' : ''}`}
							>
								<div className={row.reverse ? 'lg:[direction:ltr]' : ''}>
									<h3 className="text-xl font-bold mb-4
                                 md:text-2xl">
										{row.title}
									</h3>
									<p className="text-muted-foreground mb-6 leading-relaxed">
										{row.description}
									</p>
									<div className="space-y-3">
										{row.benefits.map((benefit, j) => (
											<div key={j} className="flex items-center gap-3">
												<span className="w-5 h-5 bg-success-subtle rounded-full flex items-center justify-center flex-shrink-0">
													<Check className="w-3 h-3 text-[hsl(var(--success))]" />
												</span>
												<span className="text-sm">{benefit}</span>
											</div>
										))}
									</div>
								</div>
								<div className={`${row.reverse ? 'lg:[direction:ltr]' : ''} flex justify-center`}>
									<Image
										src={row.image}
										alt={row.title}
										width={400}
										height={550}
										className="max-w-[400px] w-full h-auto rounded-2xl shadow-xl"
										unoptimized
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Accreditation Section */}
			<section className="py-16 bg-muted/50
                          md:py-20">
				<div className="max-w-3xl mx-auto px-6 text-center
                        lg:px-8">
					<h2 className="text-xl font-bold mb-4
                         md:text-2xl">
						{CONTENT.accreditation.title}
					</h2>
					<p className="text-muted-foreground mb-8 leading-relaxed">
						{CONTENT.accreditation.description}
					</p>
					<div className="flex justify-center gap-6 flex-wrap">
						{CONTENT.accreditation.badges.map((badge) => (
							<div key={badge} className="bg-card border border-border rounded-xl px-8 py-5 text-lg font-bold text-muted-foreground">
								{badge}
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Pilot Section */}
			<section id="pilot" className="py-20 bg-background
                                      md:py-24">
				<div className="max-w-5xl mx-auto px-6
                        lg:px-8">
					<div className="text-center mb-12">
						<span className="inline-block text-primary text-sm font-semibold uppercase tracking-wide mb-4">
							{CONTENT.pilot.eyebrow}
						</span>
						<h2 className="text-2xl font-bold mb-4
                           md:text-3xl
                           lg:text-4xl">
							{CONTENT.pilot.title}
						</h2>
						<p className="text-lg text-muted-foreground">
							{CONTENT.pilot.subtitle}
						</p>
					</div>

					<div className="grid grid-cols-1 gap-8
                          lg:grid-cols-2">
						{/* Pilot Details */}
						<div className="bg-muted/50 border border-border rounded-2xl p-8">
							<span className="inline-block bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
								{CONTENT.pilot.badge}
							</span>
							<h3 className="text-xl font-bold mb-5">
								{CONTENT.pilot.detailsTitle}
							</h3>
							<ul className="space-y-4 mb-6">
								{CONTENT.pilot.includes.map((item, i) => (
									<li key={i} className="flex items-start gap-3">
										<Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
										<span className="text-sm">{item}</span>
									</li>
								))}
							</ul>
							<p className="text-sm text-muted-foreground italic">
								{CONTENT.pilot.note}
							</p>
						</div>

						{/* Pilot Outcome */}
						<div className="bg-card border-2 border-primary rounded-2xl p-8">
							<h3 className="text-lg font-bold text-primary mb-4">
								{CONTENT.pilot.outcomeTitle}
							</h3>
							<p className="mb-6 leading-relaxed">
								{CONTENT.pilot.outcomeDescription}
							</p>
							<div className="grid grid-cols-2 gap-3">
								{CONTENT.pilot.outcomeAreas.map((area, i) => (
									<div key={i} className="flex items-center gap-2.5 text-sm">
										<Check className="w-4 h-4 text-brand-teal flex-shrink-0" />
										<span>{area}</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Contact Form Section */}
			<section id="contact" className="py-20 bg-gradient-to-br from-primary to-[#e54d00]
                                        md:py-24">
				<div className="max-w-2xl mx-auto px-6
                        lg:px-8">
					<div className="text-center mb-10">
						<p className="text-lg font-semibold text-white mb-3">
							{CONTENT.cta.tagline}
						</p>
						<h2 className="text-2xl font-bold text-white mb-4
                           md:text-3xl
                           lg:text-4xl">
							{CONTENT.cta.title}
						</h2>
						<p className="text-white/90 leading-relaxed">
							{CONTENT.cta.description}
						</p>
					</div>

					{formSuccess ? (
						<div className="bg-white rounded-2xl p-8 text-center">
							<div className="w-16 h-16 bg-success-subtle rounded-full flex items-center justify-center mx-auto mb-4">
								<Check className="w-8 h-8 text-[hsl(var(--success))]" />
							</div>
							<h3 className="text-xl font-bold mb-2">Thank You!</h3>
							<p className="text-muted-foreground">
								We have received your request. A member of our team will be in touch within 24 hours.
							</p>
						</div>
					) : (
						<form onSubmit={handleFormSubmit} className="bg-white rounded-2xl p-8 space-y-5">
							<div className="grid grid-cols-1 gap-5
                              sm:grid-cols-2">
								<div>
									<label htmlFor="name" className="block text-sm font-medium mb-2">
										Your Name
									</label>
									<input
										type="text"
										id="name"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										className="w-full px-4 py-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
										placeholder="Dr. Sarah Chen"
										required
									/>
								</div>
								<div>
									<label htmlFor="email" className="block text-sm font-medium mb-2">
										Email Address
									</label>
									<input
										type="email"
										id="email"
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										className="w-full px-4 py-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
										placeholder="sarah@school.edu"
										required
									/>
								</div>
							</div>
							<div>
								<label htmlFor="organization" className="block text-sm font-medium mb-2">
									School Name
								</label>
								<input
									type="text"
									id="organization"
									value={formData.organization}
									onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
									placeholder="International School of Singapore"
									required
								/>
							</div>
							<div>
								<label htmlFor="role" className="block text-sm font-medium mb-2">
									Your Role
								</label>
								<input
									type="text"
									id="role"
									value={formData.role}
									onChange={(e) => setFormData({ ...formData, role: e.target.value })}
									className="w-full px-4 py-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
									placeholder="Head of School"
								/>
							</div>
							<button
								type="submit"
								disabled={formSubmitting}
								className="w-full bg-primary text-primary-foreground py-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[hsl(var(--accent-hover))] transition-colors disabled:opacity-50"
							>
								{formSubmitting ? (
									'Submitting...'
								) : (
									<>
										{CONTENT.cta.primaryCta}
										<ArrowRight className="w-5 h-5" />
									</>
								)}
							</button>
						</form>
					)}

					<div className="flex flex-col gap-4 mt-8 text-center
                          sm:flex-row sm:justify-center">
						<a
							href="mailto:hello@innovaas.co"
							onClick={() => handleCtaClick('Email', 'mailto:hello@innovaas.co')}
							className="inline-flex items-center justify-center gap-2 text-white/90 hover:text-white transition-colors"
						>
							<Mail className="w-5 h-5" />
							hello@innovaas.co
						</a>
						<a
							href="tel:+6560000000"
							onClick={() => handleCtaClick('Phone')}
							className="inline-flex items-center justify-center gap-2 text-white/90 hover:text-white transition-colors"
						>
							<Phone className="w-5 h-5" />
							{CONTENT.cta.secondaryCta}
						</a>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 bg-foreground text-white">
				<div className="max-w-7xl mx-auto px-6 flex flex-col gap-6 items-center
                        md:flex-row md:justify-between
                        lg:px-8">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
							<Zap className="w-4 h-4 text-primary-foreground" />
						</div>
						<span className="font-semibold">FlowForge</span>
					</div>

					<div className="flex gap-8">
						<a
							href="https://www.innovaas.co"
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-white/70 hover:text-white transition-colors"
						>
							www.innovaas.co
						</a>
						<a href="/privacy" className="text-sm text-white/70 hover:text-white transition-colors">
							Privacy Policy
						</a>
						<a href="#contact" className="text-sm text-white/70 hover:text-white transition-colors">
							Contact
						</a>
					</div>

					<span className="text-sm text-white/50">
						Innovaas Solutions Pte. Ltd.
					</span>
				</div>
			</footer>
		</div>
	)
}
