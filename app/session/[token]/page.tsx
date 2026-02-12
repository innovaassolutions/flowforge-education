'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { apiUrl } from '@/lib/api-url'
import {
  MessageCircle,
  Send,
  Loader2,
  CheckCircle,
  ArrowLeft,
  Shield,
  AlertTriangle,
  RefreshCw,
  Info,
  Mic
} from 'lucide-react'
import { VoiceSession } from '@/components/voice'
import type { SessionMode, VoiceAvailabilityResponse } from '@/lib/types/voice'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface SessionData {
  id: string
  module: string
  participant_type: string
  cohort_metadata: Record<string, string>
  school_name: string
  campaign_name: string
}

interface ConversationState {
  phase?: string
  questions_asked?: number
  topics_covered?: string[]
  is_complete?: boolean
}

const PARTICIPANT_LABELS: Record<string, string> = {
  student: 'Student Voice',
  teacher: 'Teacher Insights',
  parent: 'Parent Perspective',
  leadership: 'Leadership View'
}

const MODULE_LABELS: Record<string, string> = {
  student_wellbeing: 'Student Wellbeing',
  teaching_learning: 'Teaching & Learning',
  parent_confidence: 'Parent Confidence',
  leadership_strategy: 'Strategic Leadership'
}

/**
 * Education Session Chat Interface
 * Pseudonymous participant view for AI-guided interviews
 * This is a PUBLIC page - token is the authentication
 */
export default function EducationSessionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()

  const [session, setSession] = useState<SessionData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationState, setConversationState] = useState<ConversationState | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [availableModules, setAvailableModules] = useState<string[]>([])
  const [completedModules, setCompletedModules] = useState<string[]>([])

  // Voice mode state
  const [sessionMode, setSessionMode] = useState<SessionMode>('text')
  const [voiceAvailability, setVoiceAvailability] = useState<VoiceAvailabilityResponse | null>(null)
  const [checkingVoice, setCheckingVoice] = useState(true) // Start true to avoid flash of text content
  const [isNewVoiceSession, setIsNewVoiceSession] = useState(false) // Track if this is a new voice session

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSession()
  }, [token])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadSession() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(apiUrl(`api/session/${token}`))
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Unable to access session')
        return
      }

      if (data.status === 'module_completed') {
        setIsComplete(true)
        setCompletedModules(data.completed_modules || [])
        setAvailableModules(data.available_modules || [])
        return
      }

      setSession(data.session)
      setAvailableModules(data.available_modules || [])
      setCompletedModules(data.completed_modules || [])

      // Handle conversation state
      if (data.conversationHistory && data.conversationHistory.length > 0) {
        setMessages(data.conversationHistory.map((m: { role: string; content: string; created_at?: string }) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at
        })))
        setIsResuming(true)
      }
      // NOTE: Don't add greeting here - wait until we know voice availability
      // Voice mode should handle its own greeting verbally

      setConversationState(data.conversationState)

      // Check voice availability FIRST, then decide on greeting
      // Voice mode will be the default when available
      await checkVoiceAvailability(data.greeting)

    } catch (err) {
      console.error('Session load error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function checkVoiceAvailability(greeting?: string) {
    try {
      setCheckingVoice(true)
      const response = await fetch(apiUrl(`api/voice/availability?sessionToken=${token}`))
      const data = await response.json()
      setVoiceAvailability(data)

      // If voice is available, use voice mode and let the voice agent deliver the greeting
      if (data.available) {
        setSessionMode('voice')
        setIsNewVoiceSession(true) // Mark as new voice session - don't show text messages
      } else if (greeting) {
        // Voice not available - show text greeting for text-only mode
        setMessages([{
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString()
        }])
      }
    } catch (err) {
      console.error('Voice availability check failed:', err)
      setVoiceAvailability({ available: false, reason: 'Unable to check voice availability' })
      // On error, fall back to text mode with greeting
      if (greeting) {
        setMessages([{
          role: 'assistant',
          content: greeting,
          timestamp: new Date().toISOString()
        }])
      }
    } finally {
      setCheckingVoice(false)
    }
  }

  function handleModeChange(mode: SessionMode) {
    setSessionMode(mode)
    // When switching to text mode, show messages and focus input
    if (mode === 'text') {
      setIsNewVoiceSession(false) // Allow messages to be shown
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleVoiceSessionEnd(completed: boolean) {
    // Only mark assessment as done if the interview was actually completed
    // (not just disconnected due to error or early termination)
    if (completed) {
      setIsComplete(true)
    } else {
      // Session ended early - show message and switch to text mode as fallback
      setError('Voice session ended. You can continue with text if needed.')
      handleModeChange('text')
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputMessage.trim() || sending || !session) return

    const message = inputMessage.trim()
    setInputMessage('')

    // Add user message optimistically
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      setSending(true)

      const response = await fetch(apiUrl(`api/session/${token}/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          module: session.module
        })
      })

      const data = await response.json()

      if (data.success) {
        // Add assistant response
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, assistantMessage])
        setConversationState(data.conversationState)

        // Check if complete
        if (data.isComplete) {
          setIsComplete(true)
        }
      } else {
        setError(data.error || 'Failed to send message')
        // Remove optimistic message on error
        setMessages(prev => prev.slice(0, -1))
      }
    } catch (err) {
      console.error('Send message error:', err)
      setError('Failed to send message. Please try again.')
      // Remove optimistic message on error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function calculateProgress(): number {
    const questions = conversationState?.questions_asked || 0
    return Math.min(Math.round((questions / 15) * 100), 100)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading your session...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{error}</h2>
          <p className="text-muted-foreground mb-6">
            Please check your access link or contact your school administrator.
          </p>
          <button
            onClick={() => router.push('/education/session')}
            className="inline-flex items-center gap-2 text-brand-teal hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Try a different code
          </button>
        </div>
      </div>
    )
  }

  // Module completed (before current session loaded)
  if (isComplete && !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-success-subtle rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-[hsl(var(--success))]" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Assessment Complete!</h2>
          <p className="text-muted-foreground mb-6">
            Thank you for your participation. Your responses have been recorded.
          </p>
          {availableModules.length > completedModules.length && (
            <p className="text-sm text-muted-foreground">
              You have {availableModules.length - completedModules.length} more module(s) available.
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Sticky to show progress while scrolling */}
      <header className="border-b border-border bg-card flex-shrink-0 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4
                        sm:px-6
                        lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/icon-orb.svg"
                alt="FlowForge"
                width={32}
                height={32}
                className="w-8 h-8"
                unoptimized
              />
              <div>
                <h1 className="text-lg font-bold text-foreground">{session.campaign_name}</h1>
                <p className="text-xs text-muted-foreground">{session.school_name}</p>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-muted-foreground">
                  {PARTICIPANT_LABELS[session.participant_type] || 'Assessment'}
                </p>
                <p className="text-sm font-medium text-brand-teal">
                  {calculateProgress()}% complete
                </p>
              </div>
              <div className="w-12 h-12 relative">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    className="text-brand-teal"
                    strokeWidth="3"
                    strokeDasharray={`${calculateProgress()}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
                  {conversationState?.questions_asked || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Resume Notice */}
      {isResuming && messages.length > 0 && !isComplete && (
        <div className="bg-brand-teal/10 border-b border-brand-teal/30">
          <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-2 text-sm text-brand-teal">
              <RefreshCw className="w-4 h-4" />
              <span>Your conversation has been restored. Continue where you left off.</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages - hide for new voice sessions until conversation starts */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4
                        sm:px-6
                        lg:px-8">
          {/* Privacy Reminder */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success-subtle text-sm text-[hsl(var(--success))]">
              <Shield className="w-4 h-4" />
              <span>Your responses are anonymous and confidential</span>
            </div>
          </div>

          {/* Only show messages if not a new voice session (voice handles greeting verbally) */}
          {!(isNewVoiceSession && sessionMode === 'voice') && messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                  message.role === 'user'
                    ? 'bg-brand-teal text-white rounded-br-md'
                    : 'bg-card border border-border rounded-bl-md'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-4 h-4 text-brand-teal" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Jippity
                    </span>
                  </div>
                )}
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-inherit">
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-5 py-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-brand-teal" />
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-brand-teal rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-brand-teal rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-brand-teal rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border-t border-destructive/30 bg-destructive/10">
          <div className="max-w-4xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-xs text-destructive/70 hover:text-destructive underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4
                        sm:px-6
                        lg:px-8">
          {isComplete ? (
            <div className="bg-success-subtle border border-[hsl(var(--success))]/30 rounded-2xl p-6 text-center">
              <CheckCircle className="w-12 h-12 text-[hsl(var(--success))] mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground mb-2">Assessment Complete!</h3>
              <p className="text-muted-foreground">
                Thank you for sharing your valuable insights. Your responses have been recorded
                and will contribute to improving school outcomes.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                You may now close this window.
              </p>
            </div>
          ) : sessionMode === 'voice' ? (
            /* Voice Mode Interface */
            <div className="space-y-4">
              <VoiceSession
                sessionToken={token}
                moduleId={session.module}
                onSessionEnd={handleVoiceSessionEnd}
                onError={(err) => setError(err)}
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleModeChange('text')}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Switch to text mode
                </button>
                <p className="text-xs text-muted-foreground">
                  {MODULE_LABELS[session.module] || session.module}
                </p>
              </div>
            </div>
          ) : (
            /* Text Mode Interface */
            <>
              <form onSubmit={sendMessage} className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={sending}
                  placeholder="Type your response..."
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground
                             placeholder:text-muted-foreground
                             focus:outline-none focus:ring-2 focus:ring-brand-teal/50 focus:border-brand-teal
                             disabled:opacity-50 transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || sending}
                  className="bg-brand-teal hover:bg-brand-teal/90 disabled:opacity-50 disabled:cursor-not-allowed
                             text-white font-semibold px-6 py-3 rounded-xl
                             flex items-center gap-2 transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Share openly - your identity is protected
                </p>
                <div className="flex items-center gap-4">
                  {/* Voice Mode Toggle */}
                  {voiceAvailability?.available && !checkingVoice && (
                    <button
                      onClick={() => handleModeChange('voice')}
                      className="text-sm text-brand-teal hover:text-brand-teal/80 flex items-center gap-1.5 transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      Voice mode
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {MODULE_LABELS[session.module] || session.module}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
