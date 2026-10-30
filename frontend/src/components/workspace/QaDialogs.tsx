import { useState, type FormEvent } from 'react'
import { useQuery } from '@apollo/client/react'
import { Check, Loader2, Plus, RotateCcw, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { UserBadge } from './UserPicker'
import { BUG_SEVERITY, BUG_SEVERITY_ORDER } from './meta'
import { useWsActions, type WsBugDraft } from './useWsActions'
import { WS_QA_USERS } from '@/lib/graphql'
import type { BugSeverity, User } from '@/lib/types'
import { cn } from '@/lib/utils'

type QaItem = { id: string; name: string; qa: User | null; qaGroup: { id: string; name: string } | null }

/**
 * Enviar el proyecto a la etapa de QA eligiendo a la persona (rol QA) que lo va a probar.
 * `assignOnly`: el proyecto ya está en QA pero sin QA; solo se le asigna.
 */
export function SendToQaDialog({
  item,
  open,
  onOpenChange,
  assignOnly = false,
}: {
  item: QaItem
  open: boolean
  onOpenChange: (o: boolean) => void
  assignOnly?: boolean
}) {
  const { data, loading } = useQuery<{ wsQaUsers: User[] }>(WS_QA_USERS, { skip: !open })
  const actions = useWsActions()
  const [picked, setPicked] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const qaUsers = data?.wsQaUsers ?? []
  // Por defecto, el QA que ya revisó el proyecto en una ronda anterior
  const qaId = picked ?? item.qa?.id ?? null

  async function send() {
    if (!qaId) return toast.error('Elige al QA que revisará el proyecto')
    setSaving(true)
    const ok = await actions.patchItem(item.id, assignOnly ? { qaId } : { groupId: item.qaGroup!.id, qaId })
    setSaving(false)
    if (ok) {
      toast.success(assignOnly ? 'QA asignado al proyecto' : `"${item.name}" se envió a ${item.qaGroup!.name}`)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{assignOnly ? 'Asignar QA' : 'Enviar a QA'}</DialogTitle>
          <DialogDescription>
            Elige quién probará <b>{item.name}</b>. Sus pruebas aparecerán en el mismo proyecto; si encuentra defectos, te lo devolverá con
            una corrección asignada a ti.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>QA</Label>
          {loading ? (
            <Loader2 className="mx-auto my-4 animate-spin text-muted-foreground" />
          ) : qaUsers.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              No hay usuarios con el rol <b>QA</b>. Un administrador puede asignarlo en <b>Usuarios</b>.
            </p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {qaUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPicked(u.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-secondary/60',
                    qaId === u.id && 'border-primary bg-primary/5'
                  )}
                >
                  <UserBadge user={u} className="size-8 ring-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  {qaId === u.id && <Check className="size-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" disabled={!qaId || saving} onClick={send}>
            {saving ? <Loader2 className="animate-spin" /> : <Send />} {assignOnly ? 'Asignar QA' : 'Enviar a QA'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const emptyBug = (): WsBugDraft => ({ name: '', severity: 'MEDIUM', steps: '' })

/**
 * El QA devuelve el proyecto a desarrollo registrando cada bug por separado (título, gravedad y pasos para
 * reproducirlo). Cada uno queda como tarea del programador; `reopenedBugs` son los que el QA reabrió al verificar.
 */
export function RejectQaDialog({
  item,
  developer,
  reopenedBugs,
  open,
  onOpenChange,
}: {
  item: { id: string; name: string }
  developer: User | null
  reopenedBugs: number
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const actions = useWsActions()
  const [bugs, setBugs] = useState<WsBugDraft[]>([emptyBug()])
  const [saving, setSaving] = useState(false)
  const set = (i: number, patch: Partial<WsBugDraft>) => setBugs((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  // Las filas sin título se ignoran: así se puede devolver solo con bugs reabiertos
  const filled = bugs.filter((b) => b.name.trim())

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!filled.length && !reopenedBugs) return toast.error('Registra al menos un bug')
    setSaving(true)
    const ok = await actions.rejectQa(
      item.id,
      filled.map((b) => ({ name: b.name.trim(), severity: b.severity, steps: b.steps?.trim() || undefined }))
    )
    setSaving(false)
    if (ok) {
      setBugs([emptyBug()])
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Devolver a desarrollo</DialogTitle>
          <DialogDescription>
            Registra cada bug por separado. El proyecto regresa a "En Desarrollo" y cada bug queda como tarea de{' '}
            <b>{developer?.name ?? 'el programador del proyecto'}</b>, que debe cerrarlo con un comentario de resolución. Tus pruebas abiertas
            se mantienen para la siguiente revisión.
            {reopenedBugs > 0 && (
              <>
                {' '}
                También vuelven los <b>{reopenedBugs}</b> bug(s) abiertos que ya reportaste o reabriste: si no hay más, deja el formulario vacío.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {bugs.map((b, i) => (
            <div key={i} className="space-y-2 rounded-2xl border bg-rose-50/40 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Bug {i + 1}</span>
                {bugs.length > 1 && (
                  <button type="button" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => setBugs((l) => l.filter((_, j) => j !== i))} aria-label="Quitar bug">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <Input autoFocus={i === bugs.length - 1} maxLength={200} placeholder="Qué falla (título)" value={b.name} onChange={(e) => set(i, { name: e.target.value })} />
                <select
                  className="h-9 rounded-md border bg-white px-2 text-sm"
                  value={b.severity}
                  onChange={(e) => set(i, { severity: e.target.value as BugSeverity })}
                  aria-label="Gravedad"
                >
                  {BUG_SEVERITY_ORDER.map((sev) => (
                    <option key={sev} value={sev}>
                      Gravedad {BUG_SEVERITY[sev].label.toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                rows={2}
                maxLength={2000}
                placeholder="Pasos para reproducir y resultado esperado (opcional)"
                value={b.steps}
                onChange={(e) => set(i, { steps: e.target.value })}
              />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setBugs((l) => [...l, emptyBug()])}>
            <Plus /> Otro bug
          </Button>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" className="rounded-full" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <RotateCcw />} Devolver con {filled.length + reopenedBugs} bug(s)
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
