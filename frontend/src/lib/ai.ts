import { getToken } from './apollo'

const AI_URL = import.meta.env.VITE_AI_URL ?? 'http://localhost:4001/ai/chat'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Envía la conversación al asistente (LM Studio vía backend) y recibe la respuesta por streaming (SSE).
 * Llama a `onToken` con cada fragmento de texto. Con `fileId` la conversación es sobre ese documento.
 */
export async function streamChat(messages: ChatMessage[], onToken: (text: string) => void, signal?: AbortSignal, fileId?: string) {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() ?? ''}` },
    body: JSON.stringify({ messages, fileId }),
    signal,
  })
  if (!res.ok || !res.body) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.error ?? `El asistente respondió ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const block of events) {
      const event = block.match(/^event: (\w+)/m)?.[1]
      const data = block.match(/^data: (.*)$/m)?.[1]
      if (!event || data === undefined) continue
      if (event === 'token') onToken(JSON.parse(data))
      if (event === 'error') throw new Error(JSON.parse(data).message)
    }
  }
}
