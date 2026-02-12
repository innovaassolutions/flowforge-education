import OpenAI from 'openai'

// Lazy-loaded OpenAI client to avoid build-time env var access
let openaiClient: OpenAI | null = null

export function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openaiClient
}

// Backward compatibility export using Proxy
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAIClient() as any)[prop]
  }
})
