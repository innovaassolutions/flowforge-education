/**
 * Voice Components Export Barrel
 *
 * Components for ElevenLabs voice integration in interviews.
 *
 * Prerequisites:
 * 1. Install ElevenLabs React SDK: npm install @elevenlabs/react
 * 2. Run database migration: 20260101_001_create_voice_system_tables.sql
 * 3. Configure environment variables:
 *    - ELEVENLABS_API_KEY
 *    - ELEVENLABS_AGENT_ID
 *    - ELEVENLABS_LLM_SECRET
 *
 * Reference: docs/research-technical-2025-12-31.md
 */

export { VoiceSession } from './VoiceSession'
export { ModeSelector } from './ModeSelector'
export { VoicePreferencesSettings } from './VoicePreferencesSettings'
