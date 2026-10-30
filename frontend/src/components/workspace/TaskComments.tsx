import { useState, type FormEvent } from 'react'
import { useQuery } from '@apollo/client/react'
import { BadgeCheck, CheckCircle2, Loader2, MessageSquare, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserBadge } from './UserPicker'
import { useWsActions } from './useWsActions'
import { WS_SUBITEM_COMMENTS } from '@/lib/graphql'
import { fmtDateTime, fromNow } from '@/lib/format'
import type { CommentKind, WsSubitemComment } from '@/lib/types'
import { cn } from '@/lib/utils'

const KIND: Record<CommentKind, { label: string; icon: typeof MessageSquare; className: string } | null> = {
  COMMENT: null,
  RESOLUTION: { label: 'Resolución', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  VERIFIED: { label: 'Verificado por QA', icon: BadgeCheck, className: 'bg-sky-50 text-sky-800 border-sky-200' },
  REOPENED: { label: 'Reabierto por QA', icon: RotateCcw, className: 'bg-rose-50 text-rose-800 border-rose-200' },
}

/** Comentarios de una subtarea: el historial de lo que se hizo (resolución, verificación y reaperturas del QA). */
export function TaskComments({ subitemId }: { subitemId: string }) {
  const { data, loading } = useQuery<{ wsSubitemComments: WsSubitemComment[] }>(WS_SUBITEM_COMMENTS, {
    variables: { subitemId },
    fetchPolicy: 'cache-and-network',
  })
  const actions = useWsActions()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const comments = data?.wsSubitemComments ?? []

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    if (await actions.addComment(subitemId, body.trim())) setBody('')
    setSaving(false)
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <MessageSquare className="size-3.5" /> Comentarios {comments.length > 0 && `(${comments.length})`}
      </p>
      {loading && !data ? (
        <Loader2 className="mx-auto animate-spin text-muted-foreground" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no hay comentarios en esta tarea.</p>
      ) : (
        <ol className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {comments.map((c) => {
            const kind = KIND[c.kind]
            return (
              <li key={c.id} className={cn('rounded-xl border px-3 py-2 text-sm', kind?.className ?? 'bg-white')}>
                <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <UserBadge user={c.user} className="size-5 ring-0" />
                  <b className="text-foreground">{c.user.name}</b>
                  {kind && (
                    <span className="flex items-center gap-0.5 font-semibold">
                      <kind.icon className="size-3" /> {kind.label}
                    </span>
                  )}
                  <span className="ml-auto" title={fmtDateTime(c.createdAt)}>
                    {fromNow(c.createdAt)}
                  </span>
                </div>
                <p className="break-words whitespace-pre-wrap">{c.body}</p>
              </li>
            )
          })}
        </ol>
      )}
      <form onSubmit={submit} className="flex items-end gap-2">
        <Textarea rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe un comentario…" className="min-h-0" />
        <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={saving || !body.trim()} aria-label="Comentar">
          {saving ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </div>
  )
}
