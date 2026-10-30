import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ArrowUp, ListChecks, Loader2, MessageSquare, Plus, RefreshCw, Sparkles, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserPicker } from '@/components/workspace/UserPicker'
import { useWsActions } from '@/components/workspace/useWsActions'
import { AI_ANALYZE_FILE } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAssignRestriction } from '@/lib/auth'
import { streamChat, type ChatMessage } from '@/lib/ai'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Markdown } from './AiAssistant'

type Priority = 'alta' | 'media' | 'baja'
type DocTask = { name: string; hours: number; priority: Priority; selected: boolean }
interface Analysis {
  fileName: string
  summary: string
  truncated: boolean
  pages: number | null
  tasks: { name: string; hours: number; priority: string }[]
}

const PRIORITY_STYLE: Record<Priority, string> = {
  alta: 'bg-rose-100 text-rose-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-slate-100 text-slate-600',
}

const QUICK_QUESTIONS = [
  'Resume el documento en 5 puntos',
  '¿Qué riesgos o dependencias identificas?',
  'Propón criterios de aceptación para QA',
  '¿Qué dudas debería aclarar con el solicitante?',
]

/** Panel lateral del visor: la IA analiza el archivo, extrae tareas y responde preguntas sobre él. */
export function DocAiPanel({ fileId, itemId }: { fileId: string; itemId: string }) {
  return (
    <Tabs defaultValue="tasks" className="flex h-full min-h-0 flex-col gap-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-[#8b7cf8] to-[#5a47e8] text-white">
          <Sparkles className="size-4" />
        </span>
        <p className="flex-1 text-sm font-semibold">Análisis con IA</p>
        <TabsList className="h-8">
          <TabsTrigger value="tasks" className="text-xs">
            <ListChecks /> Tareas
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs">
            <MessageSquare /> Chat
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="tasks" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <TasksTab fileId={fileId} itemId={itemId} />
      </TabsContent>
      <TabsContent value="chat" forceMount className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <ChatTab fileId={fileId} />
      </TabsContent>
    </Tabs>
  )
}

function TasksTab({ fileId, itemId }: { fileId: string; itemId: string }) {
  const restrictTo = useAssignRestriction()
  const actions = useWsActions()
  const [analyze, { loading, error }] = useMutation<{ aiAnalyzeFile: Analysis }>(AI_ANALYZE_FILE)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [tasks, setTasks] = useState<DocTask[]>([])
  const [assignee, setAssignee] = useState<User | null>(null)
  const [adding, setAdding] = useState(false)

  async function run() {
    try {
      const { data } = await analyze({ variables: { fileId } })
      const a = data!.aiAnalyzeFile
      setAnalysis(a)
      setTasks(a.tasks.map((t) => ({ ...t, priority: (['alta', 'media', 'baja'].includes(t.priority) ? t.priority : 'media') as Priority, selected: true })))
    } catch {
      /* el error se muestra abajo */
    }
  }

  const chosen = tasks.filter((t) => t.selected && t.name.trim())
  const update = (i: number, patch: Partial<DocTask>) => setTasks((list) => list.map((t, k) => (k === i ? { ...t, ...patch } : t)))

  async function addToProject() {
    setAdding(true)
    let ok = 0
    for (const t of chosen) if (await actions.addSubitem(itemId, t.name.trim(), { assigneeId: assignee?.id ?? null, hours: t.hours })) ok++
    setAdding(false)
    if (ok) {
      toast.success(`${ok} tarea(s) agregadas como subtareas del proyecto`)
      setTasks((list) => list.map((t) => (t.selected ? { ...t, selected: false } : t)))
    }
  }

  if (!analysis && !loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="grid size-14 place-items-center rounded-3xl bg-secondary text-primary">
          <ListChecks className="size-7" />
        </div>
        <div>
          <p className="font-semibold">¿Qué tareas conlleva este documento?</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Gemma leerá el archivo, lo resumirá y propondrá las tareas con horas estimadas para agregarlas al proyecto.
          </p>
        </div>
        {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage(error)}</p>}
        <Button className="rounded-full shadow-lg shadow-primary/30" onClick={run}>
          <Sparkles /> Extraer tareas
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Gemma está leyendo el documento…
        </p>
        <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="rounded-2xl bg-secondary/60 p-3.5 text-sm">
          <p className="mb-1 text-xs font-semibold text-primary">Resumen{analysis?.pages ? ` · ${analysis.pages} página(s)` : ''}</p>
          <p className="leading-relaxed">{analysis?.summary}</p>
          {analysis?.truncated && <p className="mt-2 text-xs text-amber-700">Documento extenso: se analizó la primera parte.</p>}
        </div>
        <p className="pt-1 text-xs font-semibold text-muted-foreground">Tareas propuestas ({tasks.length})</p>
        {tasks.map((t, i) => (
          <div key={i} className={cn('rounded-xl border px-3 py-2 transition', t.selected ? 'border-primary/30 bg-primary/5' : 'opacity-60')}>
            <div className="flex items-start gap-2.5">
              <Checkbox checked={t.selected} onCheckedChange={(c) => update(i, { selected: !!c })} className="mt-1" aria-label="Incluir" />
              <textarea
                value={t.name}
                onChange={(e) => update(i, { name: e.target.value })}
                rows={2}
                className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-snug outline-none"
                aria-label="Nombre de la tarea"
              />
            </div>
            <div className="mt-1 flex items-center gap-2 pl-6.5">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', PRIORITY_STYLE[t.priority])}>{t.priority}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={t.hours}
                  onChange={(e) => update(i, { hours: Math.max(1, Number(e.target.value) || 1) })}
                  className="h-6 w-12 rounded-md border bg-white px-1 text-center text-xs text-foreground outline-none focus:border-primary"
                  aria-label="Horas"
                />
                h
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2.5 border-t p-4">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Asignar a</span>
          <UserPicker value={assignee} onChange={setAssignee} restrictTo={restrictTo} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={run} disabled={adding}>
            <RefreshCw /> Reanalizar
          </Button>
          <Button size="sm" className="flex-1 rounded-full" onClick={addToProject} disabled={adding || chosen.length === 0}>
            {adding ? <Loader2 className="animate-spin" /> : <Plus />} Agregar {chosen.length} como subtareas · {chosen.reduce((n, t) => n + t.hours, 0)} h
          </Button>
        </div>
      </div>
    </div>
  )
}

function ChatTab({ fileId }: { fileId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])
  useEffect(() => () => abortRef.current?.abort(), [])

  async function send(text: string) {
    const content = text.trim()
    if (!content || streaming) return
    const history: ChatMessage[] = [...messages, { role: 'user', content }]
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
            next[next.length - 1] = { role: 'assistant', content: next[next.length - 1]!.content + token }
            return next
          }),
        controller.signal,
        fileId
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message)
        setMessages((prev) => (prev.at(-1)?.content ? prev : prev.slice(0, -1)))
      }
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Pregunta lo que necesites sobre este archivo:</p>
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} onClick={() => send(q)} className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-secondary/50">
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed">
              {m.content ? (
                <Markdown text={m.content} />
              ) : (
                <span className="flex gap-1 py-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-2 animate-bounce rounded-full bg-primary/50" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </span>
              )}
            </div>
          )
        )}
        {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="border-t p-3"
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-white p-1.5 pl-3 focus-within:border-primary">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder="Pregunta sobre el documento…"
            className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none"
          />
          {streaming ? (
            <Button type="button" size="icon-sm" className="rounded-full" onClick={() => abortRef.current?.abort()} aria-label="Detener">
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" className="rounded-full" disabled={!input.trim()} aria-label="Enviar">
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
