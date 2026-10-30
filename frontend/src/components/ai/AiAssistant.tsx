import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { ArrowUp, BarChart3, Bot, RotateCcw, Sparkles, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/common'
import { AI_CHART, AI_STATUS } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { AiChartCard, type AiChart } from './AiChartView'
import { streamChat, type ChatMessage } from '@/lib/ai'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const CHART_SUGGESTIONS = [
  'Gráfica de proyectos por programador 2026 por etapa',
  'Gráfica: ¿qué programadores han realizado más pases?',
  'Gráfica de productividad: horas completadas por programador',
  'Gráfica de subtareas por estado en cada tablero',
]

const SUGGESTIONS = [
  '¿Qué subtareas están vencidas y quién es responsable?',
  'Resume el avance de cada tablero',
  '¿Quién tiene más carga de trabajo esta semana?',
  'Sugiere prioridades para los próximos días',
  'Propón un plan de pruebas QA para el proyecto más atrasado',
]

type UiMessage = ChatMessage & { chart?: AiChart }

const CHART_WORDS = /gr[aá]fic|chart|diagrama|barras|columnas|visualiza|histograma|tendencia|evoluci[oó]n por mes/i
// Ajustes sobre la gráfica anterior: "ahora solo 2026", "cámbiala a horas", "sepárala por estado"…
const FOLLOW_UP = /^(ahora|y\s|solo|s[oó]lo|c[aá]mbia|mu[eé]stra|agr[eé]ga|qu[ií]ta|sep[aá]ra|ord[eé]na|en (barras|l[ií]nea|horizontal))/i

/** Botón flotante + panel de chat con el asistente local (Gemma en LM Studio). */
export function AiAssistant() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const { data, refetch } = useQuery<{ aiStatus: { available: boolean; model: string; message: string } }>(AI_STATUS, {
    skip: !open,
    fetchPolicy: 'network-only',
  })
  const client = useApolloClient()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const status = data?.aiStatus

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  /** Gemma interpreta la petición y el servidor calcula los datos de la gráfica. */
  async function sendChart(content: string, previousSpec: string | null) {
    setMessages((prev) => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }])
    setInput('')
    setError(null)
    setStreaming(true)
    try {
      const { data } = await client.mutate<{ aiChart: AiChart }>({ mutation: AI_CHART, variables: { prompt: content, previousSpec } })
      const chart = data!.aiChart
      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: chart.insight || chart.title, chart }])
    } catch (err) {
      setError(errorMessage(err))
      setMessages((prev) => prev.slice(0, -1))
      refetch()
    } finally {
      setStreaming(false)
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || streaming) return
    const lastChart = [...messages].reverse().find((m) => m.role === 'assistant')?.chart
    const isFollowUp = !!lastChart && FOLLOW_UP.test(content)
    if (CHART_WORDS.test(content) || isFollowUp) return sendChart(content, isFollowUp ? lastChart!.spec : null)
    // Al modelo solo se le envía texto (las gráficas viajan como su resumen)
    const history: ChatMessage[] = [...messages, { role: 'user' as const, content }].map(({ role, content }) => ({ role, content }))
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setError(null)
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await streamChat(
        history,
        (token) =>
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]!
            next[next.length - 1] = { ...last, content: last.content + token }
            return next
          }),
        controller.signal
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message)
        setMessages((prev) => (prev.at(-1)?.content ? prev : prev.slice(0, -1)))
        refetch()
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group fixed right-6 bottom-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-[#8b7cf8] to-[#5a47e8] py-3 pr-5 pl-4 font-semibold text-white shadow-2xl shadow-primary/40 transition hover:-translate-y-0.5 hover:shadow-primary/60"
        aria-label="Abrir asistente IA"
      >
        <Sparkles className="size-5 transition group-hover:rotate-12" />
        Asistente IA
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          {/* Encabezado */}
          <div className="flex items-center gap-3 border-b bg-gradient-to-br from-secondary/80 to-white px-5 py-4 pr-12">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#8b7cf8] to-[#5a47e8] text-white shadow-lg shadow-primary/30">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">Asistente IA</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5 text-xs">
                <span className={cn('size-2 rounded-full', !status ? 'bg-slate-300' : status.available ? 'bg-emerald-500' : 'bg-rose-500')} />
                {status ? `${status.model} · ${status.available ? 'local en LM Studio' : status.message}` : 'Conectando…'}
              </SheetDescription>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  abortRef.current?.abort()
                  setMessages([])
                  setError(null)
                }}
                aria-label="Nueva conversación"
                title="Nueva conversación"
              >
                <RotateCcw />
              </Button>
            )}
          </div>

          {/* Conversación */}
          <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {messages.length === 0 && (
              <div className="pt-4 text-center">
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-3xl bg-secondary text-primary">
                  <Bot className="size-7" />
                </div>
                <p className="font-semibold">Hola{user ? `, ${user.name.split(' ')[0]}` : ''}. ¿En qué te ayudo?</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Conozco tus tableros, proyectos, subtareas, fechas y carga de trabajo. Todo se procesa localmente en tu equipo.
                </p>
                <p className="mt-5 mb-2 flex items-center gap-1.5 text-left text-xs font-semibold text-muted-foreground">
                  <BarChart3 className="size-3.5" /> Gráficas (pídelas como quieras)
                </p>
                <div className="grid grid-cols-2 gap-2 text-left">
                  {CHART_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={status?.available === false}
                      className="rounded-2xl border border-primary/20 bg-secondary/40 px-3 py-2 text-xs transition hover:border-primary/50 hover:bg-secondary disabled:opacity-50"
                    >
                      {s.replace(/^Gráfica:?\s*(de\s*)?/i, '')}
                    </button>
                  ))}
                </div>
                <p className="mt-4 mb-2 text-left text-xs font-semibold text-muted-foreground">Preguntas</p>
                <div className="space-y-2 text-left">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      disabled={status?.available === false}
                      className="w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition hover:border-primary/40 hover:bg-secondary/50 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end gap-2">
                  <div className="max-w-[85%] rounded-3xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">{m.content}</div>
                  {user && <UserAvatar user={user} className="size-8" />}
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-3xl rounded-tl-md bg-muted/60 px-4 py-3 text-sm leading-relaxed">
                    {m.chart ? (
                      <div className="-mx-1 space-y-2">
                        <AiChartCard chart={m.chart} compact />
                        {m.chart.insight && <p className="px-1 text-[13px]">{m.chart.insight}</p>}
                        <p className="px-1 text-[11px] text-muted-foreground">Puedes ajustarla: “ahora solo 2026”, “sepárala por estado”, “en barras horizontales”…</p>
                      </div>
                    ) : m.content ? (
                      <Markdown text={m.content} />
                    ) : (
                      <span className="flex gap-1 py-1">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="size-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: `${d * 150}ms` }} />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              )
            )}

            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
            <div ref={bottomRef} />
          </div>

          {/* Entrada */}
          <form onSubmit={submit} className="border-t p-4">
            <div className="flex items-end gap-2 rounded-3xl border bg-white p-2 pl-4 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={1}
                placeholder="Pregunta sobre tus proyectos…"
                className="max-h-36 min-h-9 resize-none border-0 p-0 py-1.5 shadow-none focus-visible:ring-0"
              />
              {streaming ? (
                <Button type="button" size="icon" className="shrink-0 rounded-full" onClick={() => abortRef.current?.abort()} aria-label="Detener">
                  <Square className="size-3.5 fill-current" />
                </Button>
              ) : (
                <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={!input.trim()} aria-label="Enviar">
                  <ArrowUp />
                </Button>
              )}
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Render mínimo de Markdown (encabezados, listas, negritas, código) sin HTML crudo. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={blocks.length} className={cn('my-1.5 space-y-1 pl-5', list.ordered ? 'list-decimal' : 'list-disc')}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>
    )
    list = null
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    if (bullet || numbered) {
      const ordered = !!numbered
      if (!list || list.ordered !== ordered) {
        flush()
        list = { ordered, items: [] }
      }
      list.items.push((bullet ?? numbered)![1]!)
      continue
    }
    flush()
    if (heading) blocks.push(<p key={blocks.length} className="mt-2 mb-1 font-semibold">{inline(heading[1]!)}</p>)
    else if (line.trim()) blocks.push(<p key={blocks.length} className="my-1">{inline(line)}</p>)
  }
  flush()
  return <>{blocks}</>
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('`') && part.endsWith('`') ? (
      <code key={i} className="rounded bg-white px-1 py-0.5 text-[12px]">{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  )
}
