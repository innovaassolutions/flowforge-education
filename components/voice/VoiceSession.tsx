'use client'

/**
 * VoiceSession Component
 *
 * Manages a hybrid voice + text conversation session with ElevenLabs Conversational AI.
 * Uses the @elevenlabs/react SDK's useConversation hook with WebRTC connection
 * for better stability and built-in echo cancellation.
 *
 * Prerequisites:
 * 1. Install the ElevenLabs React SDK: npm install @elevenlabs/react
 * 2. Configure ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in environment
 * 3. Configure ELEVENLABS_LLM_SECRET for the custom LLM endpoint
 *
 * Reference: docs/research-technical-2025-12-31.md (Appendix A)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useConversation } from '@elevenlabs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mic, MicOff, Phone, PhoneOff, Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiUrl } from '@/lib/api-url'
import type { SignedUrlResponse } from '@/lib/types/voice'

// ============================================================================
// TYPES
// ============================================================================

interface VoiceSessionProps {
  sessionToken: string
  moduleId?: string
  onSessionEnd?: (completed: boolean) => void // completed=true means interview finished properly
  onError?: (error: string) => void
  className?: string
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// ============================================================================
// COMPONENT
// ============================================================================

export function VoiceSession({
  sessionToken,
  moduleId,
  onSessionEnd,
  onError,
  className,
}: VoiceSessionProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [isSendingText, setIsSendingText] = useState(false)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const durationSecondsRef = useRef<number>(0)
  const hadErrorRef = useRef<boolean>(false)
  const textInputRef = useRef<HTMLInputElement>(null)
  const audioMonitorRef = useRef<NodeJS.Timeout | null>(null)
  const audioReceivedRef = useRef<boolean>(false)
  const minDurationForComplete = 30 // Minimum 30 seconds for a valid interview

  // Helper: Check for audio elements in the DOM and attempt to play if paused
  const debugAudioElements = useCallback((attemptPlay = false) => {
    const audioElements = document.querySelectorAll('audio')
    console.log('[VoiceSession] Audio elements in DOM:', audioElements.length)
    audioElements.forEach((el, i) => {
      const mediaStream = el.srcObject as MediaStream | null
      const tracks = mediaStream?.getTracks?.() || []

      console.log(`[VoiceSession] Audio[${i}]:`, {
        src: el.src?.substring(0, 50) || '(no src)',
        srcObject: el.srcObject ? 'MediaStream present' : '(no srcObject)',
        paused: el.paused,
        muted: el.muted,
        volume: el.volume,
        readyState: el.readyState,
        currentTime: el.currentTime,
        duration: el.duration,
        error: el.error?.message,
        autoplay: el.autoplay,
        tracks: tracks.map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
      })

      // If audio is paused and we should attempt to play, try to play it
      if (attemptPlay && el.paused && el.srcObject) {
        console.log(`[VoiceSession] Attempting to play paused Audio[${i}]...`)
        el.play()
          .then(() => console.log(`[VoiceSession] Audio[${i}] play() succeeded`))
          .catch((err) => console.error(`[VoiceSession] Audio[${i}] play() failed:`, err.message))
      }
    })
  }, [])

  // Helper: Set up audio element monitoring with event listeners
  const setupAudioMonitoring = useCallback(() => {
    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach((el, i) => {
      // Add event listeners to track audio lifecycle
      el.addEventListener('play', () => console.log(`[VoiceSession] Audio[${i}] EVENT: play`))
      el.addEventListener('pause', () => console.log(`[VoiceSession] Audio[${i}] EVENT: pause`))
      el.addEventListener('ended', () => console.log(`[VoiceSession] Audio[${i}] EVENT: ended`))
      el.addEventListener('error', (e) => console.error(`[VoiceSession] Audio[${i}] EVENT: error`, e))
      el.addEventListener('stalled', () => console.warn(`[VoiceSession] Audio[${i}] EVENT: stalled`))
      el.addEventListener('waiting', () => console.log(`[VoiceSession] Audio[${i}] EVENT: waiting`))
      el.addEventListener('playing', () => console.log(`[VoiceSession] Audio[${i}] EVENT: playing`))
      el.addEventListener('suspend', () => console.log(`[VoiceSession] Audio[${i}] EVENT: suspend`))
    })
    console.log(`[VoiceSession] Set up monitoring for ${audioElements.length} audio elements`)
  }, [])

  // Helper: Start monitoring audio output levels
  // Note: We pass conversation methods as arguments to avoid stale closure issues
  const startAudioMonitoring = useCallback((getOutputVolumeFn?: () => number, getInputVolumeFn?: () => number) => {
    if (audioMonitorRef.current) return

    console.log('[VoiceSession] Starting audio monitoring with input tracking...')
    let inputNeverDetected = true
    let monitorCount = 0

    audioMonitorRef.current = setInterval(() => {
      try {
        monitorCount++
        const outputVol = getOutputVolumeFn?.()
        const inputVol = getInputVolumeFn?.()

        // Always log for debugging
        console.log(`[VoiceSession] Audio levels [${monitorCount}] - output:`, outputVol, 'input:', inputVol)

        // Track if we ever get input
        if (inputVol !== undefined && inputVol > 0) {
          if (inputNeverDetected) {
            console.log('[VoiceSession] ✓ MICROPHONE INPUT DETECTED for first time!')
            inputNeverDetected = false
          }
        } else if (monitorCount > 3 && inputNeverDetected) {
          console.warn('[VoiceSession] ⚠️ WARNING: No microphone input detected after', monitorCount, 'seconds')
        }

        // Check for RTCPeerConnection state
        const peerConnections = (window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection
        if (peerConnections && monitorCount === 1) {
          console.log('[VoiceSession] RTCPeerConnection available:', !!peerConnections)
        }
      } catch (err) {
        console.error('[VoiceSession] Audio monitoring error:', err)
      }
    }, 1000)
  }, [])

  // Helper: Stop audio monitoring
  const stopAudioMonitoring = useCallback(() => {
    if (audioMonitorRef.current) {
      clearInterval(audioMonitorRef.current)
      audioMonitorRef.current = null
    }
  }, [])

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('[VoiceSession] ============ CONNECTED ============')
      console.log('[VoiceSession] Status after connect:', conversation.status)
      console.log('[VoiceSession] isSpeaking:', conversation.isSpeaking)
      console.log('[VoiceSession] Timestamp:', new Date().toISOString())

      // Debug: Inspect the conversation object for any connection info
      try {
        const convAny = conversation as Record<string, unknown>
        console.log('[VoiceSession] Conversation object keys:', Object.keys(convAny))
        if (convAny.conversationId) console.log('[VoiceSession] Conversation ID:', convAny.conversationId)
        if (convAny.sessionId) console.log('[VoiceSession] Session ID:', convAny.sessionId)
      } catch (e) {
        console.log('[VoiceSession] Could not inspect conversation object')
      }

      // Debug: Check WebRTC peer connections in the browser
      try {
        // @ts-ignore - accessing browser internals for debugging
        if (typeof window !== 'undefined' && window.RTCPeerConnection) {
          console.log('[VoiceSession] RTCPeerConnection is available')
        }
      } catch (e) {
        console.log('[VoiceSession] RTCPeerConnection check failed')
      }

      // Debug: Check audio elements in DOM
      debugAudioElements()

      // Set up event listeners on audio elements
      setupAudioMonitoring()

      // Start monitoring audio output levels (pass methods to avoid stale closure)
      startAudioMonitoring(
        conversation.getOutputVolume?.bind(conversation),
        conversation.getInputVolume?.bind(conversation)
      )

      // Ensure volume is set to max on connect
      try {
        conversation.setVolume({ volume: 1 })
        console.log('[VoiceSession] Volume set to 1')
      } catch (volErr) {
        console.warn('[VoiceSession] Could not set volume:', volErr)
      }
      setConnectionStatus('connected')
      setError(null)
      hadErrorRef.current = false
      audioReceivedRef.current = false
      startDurationTracking()
    },
    onDisconnect: () => {
      const finalDuration = durationSecondsRef.current
      console.log('[VoiceSession] ============ DISCONNECTED ============')
      console.log('[VoiceSession] Duration:', finalDuration, 'seconds')
      console.log('[VoiceSession] Had error:', hadErrorRef.current)
      console.log('[VoiceSession] Audio was received:', audioReceivedRef.current)
      console.log('[VoiceSession] Final conversation status:', conversation.status)
      console.log('[VoiceSession] Final isSpeaking:', conversation.isSpeaking)

      // Try to get any available diagnostic info from conversation object
      try {
        console.log('[VoiceSession] Conversation object keys:', Object.keys(conversation))
        // Check if there's any error or reason property
        const convAny = conversation as Record<string, unknown>
        if (convAny.error) console.log('[VoiceSession] Conversation error:', convAny.error)
        if (convAny.disconnectReason) console.log('[VoiceSession] Disconnect reason:', convAny.disconnectReason)
        if (convAny.connectionState) console.log('[VoiceSession] Connection state:', convAny.connectionState)
      } catch (e) {
        console.log('[VoiceSession] Could not inspect conversation object')
      }

      // Check if it was a premature disconnect (less than 5 seconds = likely an issue)
      if (finalDuration < 5 && audioReceivedRef.current) {
        console.error('[VoiceSession] ⚠️ PREMATURE DISCONNECT: Audio was playing but session ended after only', finalDuration, 'seconds')
        console.error('[VoiceSession] This suggests the server closed the connection, possibly due to no microphone input being received')
      }

      // Stop audio monitoring
      stopAudioMonitoring()

      // Debug: Final check of audio elements
      debugAudioElements()

      setConnectionStatus('disconnected')
      stopDurationTracking()
      // Only mark as complete if:
      // 1. No errors occurred
      // 2. Session lasted at least 30 seconds (basic sanity check for real interview)
      const wasCompleted = !hadErrorRef.current && finalDuration >= minDurationForComplete
      console.log('[VoiceSession] Session end - completed:', wasCompleted)
      console.log('[VoiceSession] =====================================')
      onSessionEnd?.(wasCompleted)
    },
    onError: (err) => {
      const message = typeof err === 'string' ? err : (err as Error)?.message || 'Voice session error'
      console.error('[VoiceSession] Error:', message, err)
      hadErrorRef.current = true
      setError(message)
      setConnectionStatus('error')
      onError?.(message)
    },
    onModeChange: ({ mode }) => {
      // Mode is 'speaking' or 'listening'
      console.log('[VoiceSession] Agent mode:', mode, '- isSpeaking:', conversation.isSpeaking)

      // When agent starts speaking, check audio setup and attempt to play
      if (mode === 'speaking') {
        console.log('[VoiceSession] Agent started speaking - checking audio elements and attempting play...')
        // Attempt to play any paused audio elements
        debugAudioElements(true)

        // Set up monitoring for any new audio elements
        setupAudioMonitoring()

        // Try to get output volume
        try {
          const outputVol = conversation.getOutputVolume?.()
          console.log('[VoiceSession] Current output volume:', outputVol)
        } catch {
          console.log('[VoiceSession] getOutputVolume not available')
        }
      }
    },
    onMessage: (message) => {
      // Log all messages from ElevenLabs for debugging
      console.log('[VoiceSession] Message received:', JSON.stringify(message))

      // Check for specific message types that might indicate issues
      const msgAny = message as unknown as Record<string, unknown>
      if (msgAny.type === 'error' || msgAny.error) {
        console.error('[VoiceSession] ⚠️ Error in message:', msgAny.error || msgAny)
      }
      if (msgAny.type === 'audio_event') {
        console.log('[VoiceSession] Audio event:', msgAny)
      }
      if (msgAny.type === 'conversation_ended' || msgAny.type === 'session_ended') {
        console.log('[VoiceSession] Session end message received:', msgAny)
      }
      if (msgAny.type === 'user_transcript' || msgAny.transcript) {
        console.log('[VoiceSession] User transcript:', msgAny.transcript || msgAny)
      }
    },
    onStatusChange: (status) => {
      // Track status changes for debugging - log full object
      console.log('[VoiceSession] Status changed to:', status)
      try {
        console.log('[VoiceSession] Status details:', JSON.stringify(status))
      } catch {
        console.log('[VoiceSession] Status (non-serializable):', typeof status)
      }
    },
    // Track when audio data is received from ElevenLabs
    onAudio: (audio) => {
      if (!audioReceivedRef.current) {
        console.log('[VoiceSession] First audio data received! Type:', typeof audio, 'Size:', audio?.length || 'unknown')
        audioReceivedRef.current = true

        // Check audio elements when first audio arrives and attempt to play if paused
        debugAudioElements(true)

        // Set up event listeners for any new audio elements
        setupAudioMonitoring()
      }
    },
  })

  // Fetch signed URL from our API
  const fetchSignedUrl = useCallback(async (): Promise<SignedUrlResponse> => {
    const response = await fetch(apiUrl('api/voice/signed-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, moduleId }),
    })

    // Get response text first to handle both JSON and non-JSON responses
    const responseText = await response.text()

    if (!responseText) {
      throw new Error('Empty response from voice service')
    }

    let data: SignedUrlResponse
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse voice response:', responseText)
      throw new Error('Invalid response from voice service')
    }

    if (!response.ok) {
      throw new Error((data as { error?: string }).error || 'Failed to get voice session URL')
    }

    return data
  }, [sessionToken, moduleId])

  // Start the voice session
  const startSession = useCallback(async () => {
    try {
      setConnectionStatus('connecting')
      setError(null)

      // NOTE: We previously requested microphone permission here and stopped the stream.
      // However, this might interfere with the ElevenLabs SDK's own mic handling.
      // Let the SDK request microphone access directly during startSession.
      console.log('[VoiceSession] Letting ElevenLabs SDK handle microphone access...')

      // Ensure audio context is resumed (browsers block autoplay)
      // This is a workaround for browser autoplay policies
      try {
        const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext
        if (AudioContext) {
          const audioCtx = new AudioContext()
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume()
            console.log('[VoiceSession] Audio context resumed')
          }
          // Close this context - ElevenLabs SDK will create its own
          await audioCtx.close()
        }
      } catch (audioErr) {
        console.warn('[VoiceSession] Could not initialize audio context:', audioErr)
      }

      // Get signed URL
      const urlData = await fetchSignedUrl()

      // Start conversation with signed URL
      // dynamicVariables is a top-level property in the SDK
      // Filter out undefined values to match SDK type expectations
      const dynamicVars: Record<string, string | number | boolean> = {}
      for (const [key, value] of Object.entries(urlData.dynamicVariables)) {
        if (value !== undefined) {
          dynamicVars[key] = value
        }
      }

      console.log('[VoiceSession] Starting with firstMessage length:', urlData.firstMessage?.length)
      console.log('[VoiceSession] Dynamic variables:', JSON.stringify(dynamicVars))

      // Use WebRTC connection type for better stability
      // WebSocket has known issues: https://github.com/elevenlabs/elevenlabs-examples/issues/134
      // NOTE: Only send firstMessage override if we have one - agents without override
      // permissions enabled will fail if we send an override they don't support
      const sessionConfig: Parameters<typeof conversation.startSession>[0] = {
        conversationToken: urlData.conversationToken,
        connectionType: 'webrtc',
        dynamicVariables: dynamicVars,
        clientTools: {},
      }

      // Only add firstMessage override if provided (agents must have override permission)
      // For testing: temporarily disabled to isolate the issue
      // if (urlData.firstMessage) {
      //   sessionConfig.overrides = {
      //     agent: {
      //       firstMessage: urlData.firstMessage,
      //     },
      //   }
      // }
      console.log('[VoiceSession] Starting WITHOUT firstMessage override (testing)')

      await conversation.startSession(sessionConfig)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start voice session'
      setError(message)
      setConnectionStatus('error')
      onError?.(message)
    }
  }, [fetchSignedUrl, conversation, onError])

  // End the voice session
  const endSession = useCallback(async () => {
    try {
      await conversation.endSession()
      stopDurationTracking()

      // Track voice usage
      if (durationSeconds > 0) {
        await fetch(apiUrl('api/voice/usage'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken,
            durationSeconds,
          }),
        }).catch(console.error)
      }

      // User manually ended the session - not a complete interview
      onSessionEnd?.(false)
    } catch (err) {
      console.error('Error ending voice session:', err)
    }
  }, [conversation, sessionToken, durationSeconds, onSessionEnd])

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted
    conversation.setVolume({ volume: newMuted ? 0 : 1 })
    setIsMuted(newMuted)
  }, [conversation, isMuted])

  // Send text message
  const sendTextMessage = useCallback(async () => {
    const message = textInput.trim()
    if (!message || isSendingText || connectionStatus !== 'connected') return

    try {
      setIsSendingText(true)
      // Use ElevenLabs SDK to send text message
      // sendUserMessage sends text as if the user had spoken it
      await conversation.sendUserMessage(message)
      setTextInput('')
      console.log('[VoiceSession] Sent text message:', message.substring(0, 50))
    } catch (err) {
      console.error('[VoiceSession] Error sending text:', err)
      onError?.('Failed to send text message')
    } finally {
      setIsSendingText(false)
    }
  }, [textInput, isSendingText, connectionStatus, conversation, onError])

  // Handle Enter key in text input
  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendTextMessage()
      }
    },
    [sendTextMessage]
  )

  // Duration tracking
  const startDurationTracking = useCallback(() => {
    durationSecondsRef.current = 0
    durationIntervalRef.current = setInterval(() => {
      durationSecondsRef.current += 1
      setDurationSeconds(durationSecondsRef.current)
    }, 1000)
  }, [])

  const stopDurationTracking = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDurationTracking()
      stopAudioMonitoring()
      if (conversation.status === 'connected') {
        conversation.endSession().catch(console.error)
      }
    }
  }, [stopDurationTracking, stopAudioMonitoring, conversation])

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get status display text
  const getStatusText = (): string => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...'
      case 'connected':
        if (conversation.isSpeaking) return 'Speaking...'
        return 'Listening...'
      case 'error':
        return error || 'Error'
      default:
        return 'Ready to start'
    }
  }

  // Get status color
  const getStatusColor = (): string => {
    switch (connectionStatus) {
      case 'connecting':
        return 'text-yellow-600'
      case 'connected':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 p-6 rounded-lg border bg-card',
        className
      )}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            connectionStatus === 'connected'
              ? 'bg-green-500 animate-pulse'
              : connectionStatus === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : connectionStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-300'
          )}
        />
        <span className={cn('text-sm font-medium', getStatusColor())}>
          {getStatusText()}
        </span>
      </div>

      {/* Duration display */}
      {connectionStatus === 'connected' && (
        <div className="text-2xl font-mono text-muted-foreground">
          {formatDuration(durationSeconds)}
        </div>
      )}

      {/* Voice visualization placeholder */}
      {connectionStatus === 'connected' && (
        <div className="flex items-center gap-1 h-12">
          {conversation.isSpeaking ? (
            // Speaking animation
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.random() * 20}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            // Listening indicator
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mic className="w-5 h-5 animate-pulse" />
              <span className="text-sm">Speak now...</span>
            </div>
          )}
        </div>
      )}

      {/* Control buttons */}
      <div className="flex items-center gap-3">
        {connectionStatus === 'disconnected' && (
          <Button
            onClick={startSession}
            size="lg"
            className="gap-2"
          >
            <Phone className="w-5 h-5" />
            Start Voice Session
          </Button>
        )}

        {connectionStatus === 'connecting' && (
          <Button disabled size="lg" className="gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Connecting...
          </Button>
        )}

        {connectionStatus === 'connected' && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className={cn(isMuted && 'bg-red-100 border-red-300')}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 text-red-600" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>

            <Button
              variant="destructive"
              size="lg"
              onClick={endSession}
              className="gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              End Session
            </Button>
          </>
        )}

        {connectionStatus === 'error' && (
          <Button onClick={startSession} size="lg" className="gap-2">
            <Phone className="w-5 h-5" />
            Try Again
          </Button>
        )}
      </div>

      {/* Text input - always available during voice session */}
      {connectionStatus === 'connected' && (
        <div className="flex items-center gap-2 w-full max-w-md">
          <Input
            ref={textInputRef}
            type="text"
            placeholder="Or type your response here..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleTextKeyDown}
            disabled={isSendingText}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={sendTextMessage}
            disabled={!textInput.trim() || isSendingText}
            title="Send message"
          >
            {isSendingText ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && connectionStatus === 'error' && (
        <div className="text-sm text-red-600 text-center max-w-sm">
          {error}
        </div>
      )}

      {/* Voice tips */}
      {connectionStatus === 'disconnected' && (
        <div className="text-xs text-muted-foreground text-center max-w-sm">
          Speak naturally with the AI interviewer. Your conversation will be
          transcribed and processed in real-time. You can also type messages
          using the chat button if needed.
        </div>
      )}
    </div>
  )
}

export default VoiceSession
