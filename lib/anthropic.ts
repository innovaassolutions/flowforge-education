import Anthropic from '@anthropic-ai/sdk'

// Lazy-loaded Anthropic client to avoid build-time env var access
let anthropicClient: Anthropic | null = null

export function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }
  return anthropicClient
}

// Backward compatibility export using Proxy
export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return (getAnthropicClient() as any)[prop]
  }
})
