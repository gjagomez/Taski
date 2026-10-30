import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserPicker } from '@/components/workspace/UserPicker'
import type { WsActions } from '@/components/workspace/useWsActions'
import { AI_SUGGEST_SUBITEMS } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAssignRestriction } from '@/lib/auth'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'

type Suggestion = { name: string; hours: number; selected: boolean }

/** Botón + diálogo: Gemma propone subtareas con horas estimadas; el usuario elige cuáles agregar. */
export function AiSuggestSubitems({ itemId, itemName, actions }: { itemId: string; itemName: string; actions: WsActions }) {
  const restrictTo = useAssignRestriction()
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [assignee, setAssignee] = useState<User | null>(null)
  const [adding, setAdding] = useState(false)
  const [suggest, { loading, error }] = useMutation<{ aiSuggestSubitems: { name: string; hours: number }[] }>(AI_SUGGEST_SUBITEMS)

  async function generate() {
    setSuggestions([])
    try {
      const { data } = await suggest({ variables: { itemId } })
      setSuggestions((data?.aiSuggestSubitems ?? []).map((s) => ({ ...s, selected: true })))
    } catch {
      /* el error se muestra en el diálogo */
    }
  }

  const update = (i: number, patch: Partial<Suggestion>) => setSuggestions((list) => list.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const chosen = suggestions.filter((s) => s.selected && s.name.trim())

  async function addSelected() {
    setAdding(true)
    let ok = 0
    for (const s of chosen) {
      if (await actions.addSubitem(itemId, s.name.trim(), { assigneeId: assignee?.id ?? null, hours: s.hours })) ok++
    }
    setAdding(false)
    if (ok) {
      toast.success(`${ok} subtarea(s) agregadas con IA`)
      setOpen(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          if (!suggestions.length) generate()
        }}
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#8b7cf8] to-[#5a47e8] px-3 py-1 text-xs font-semibold text-white shadow-md shadow-primary/30 transition hover:brightness-110"
      >
        <Sparkles className="size-3.5" /> Sugerir subtareas con IA
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="size-5 text-primary" /> Subtareas sugeridas
            </DialogTitle>
            <DialogDescription className="line-clamp-2">Para «{itemName}». Revisa, ajusta nombres u horas y elige cuáles agregar.</DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="space-y-2 py-2">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" /> Gemma está analizando el proyecto…
              </p>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          )}

          {error && !loading && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage(error)}</p>}

          {!loading && suggestions.length > 0 && (
            <div className="scrollbar-thin max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {suggestions.map((s, i) => (
                <div key={i} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2 transition', s.selected ? 'border-primary/30 bg-primary/5' : 'opacity-60')}>
                  <Checkbox checked={s.selected} onCheckedChange={(c) => update(i, { selected: !!c })} aria-label="Incluir" />
                  <input
                    value={s.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    aria-label="Nombre de la subtarea"
                  />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="number"
                      min={1}
                      max={80}
                      value={s.hours}
                      onChange={(e) => update(i, { hours: Math.max(1, Number(e.target.value) || 1) })}
                      className="h-7 w-14 rounded-md border bg-white px-1.5 text-center text-sm text-foreground outline-none focus:border-primary"
                      aria-label="Horas"
                    />
                    h
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Asignar a</span>
              <div className="w-56">
                <UserPicker value={assignee} onChange={setAssignee} restrictTo={restrictTo} />
              </div>
              <span className="ml-auto text-sm font-semibold">{chosen.reduce((n, s) => n + s.hours, 0)} h</span>
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={generate} disabled={loading || adding}>
              <RefreshCw /> Generar otras
            </Button>
            <Button className="rounded-full" onClick={addSelected} disabled={loading || adding || chosen.length === 0}>
              {adding ? <Loader2 className="animate-spin" /> : <Plus />} Agregar {chosen.length || ''} subtarea(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
