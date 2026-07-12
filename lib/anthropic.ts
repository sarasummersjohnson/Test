import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

// Server-side only. ANTHROPIC_API_KEY is read from the environment and is
// never sent to the browser — this module is only ever imported from API
// route handlers.
export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set.')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}
