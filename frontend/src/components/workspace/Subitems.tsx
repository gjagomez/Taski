import { useState, type FormEvent } from 'react'
import { Check, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { SubitemStatus, User, WsItem, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EditableText, PeopleStack, SubitemStatusCell } from './cells'
import { UserBadge, UserPicker } from './UserPicker'
import { StatusPicker } from './StatusPicker'
import { DateRangeCell } from './DateRangeCell'
import { HOURS_PER_DAY, workingDays, workingHours } from './meta'
import { BugEvidence, ReportBugSheet, canReportBug } from './ReportBugSheet'
import { BugTag, QaTag, useSubitemMoves } from './SubitemKanban'
import type { WsActions } from './useWsActions'
import { useAssignRestriction, useAuth } from '@/lib/auth'
import { AiSuggestSubitems } from '@/components/ai/AiSuggestSubitems'

// selección | Subelemento | Programador | Estado | Fechas (inicio – fin) | Horas | acción
const SUB_COLS = '40px minmax(240px,1fr) 150px 140px 190px 90px 44px'
const cell = 'flex h-10 items-center border-r border-b border-border/80'

export function Subitems({ item, actions }: { item: WsItem; actions: WsActions }) {
  const restrictTo = useAssignRestriction()
  const { user: me, can } = useAuth()
  // Cerrar un bug pasa por el diálogo del comentario de resolución
  const moves = useSubitemMoves()
  // Prueba de QA desde la que se está reportando un bug
  const [reporting, setReporting] = useState<WsSubitem | null>(null)
  const hours = item.subitems.reduce((s, x) => s + (x.hours ?? 0), 0)
  const testName = (id: string | null) => (id ? item.subitems.find((x) => x.id === id)?.name : undefined)

  return (
    <div className="border-b bg-slate-50/60 py-3 pr-4 pl-10">
      <div className="overflow-hidden rounded-md border-l-4 border-l-primary/40 bg-white shadow-sm">
        <div className="grid text-sm text-muted-foreground" style={{ gridTemplateColumns: SUB_COLS }}>
          <div className={cn(cell, 'border-t')} />
          <div className={cn(cell, 'justify-center border-t')}>Subelemento</div>
          <div className={cn(cell, 'justify-center border-t')}>Programador</div>
          <div className={cn(cell, 'justify-center border-t')}>Estado</div>
          <div className={cn(cell, 'justify-center border-t')}>Fechas</div>
          <div className={cn(cell, 'justify-center border-t')} title={`Horas laborales: lunes a viernes, ${HOURS_PER_DAY} h por día`}>
            Horas
          </div>
          <div className={cn(cell, 'border-t')} />
        </div>

        {item.subitems.map((s) => {
          const days = workingDays(s.startDate, s.dueDate)
          // Finalizado: la fila queda de solo lectura para el programador; el administrador puede corregir sus datos
          const done = s.status === 'DONE'
          const locked = done && !can('subitems.manageAll')
          const canFinish = s.allowedStatuses.includes('DONE')
          return (
            <div key={s.id} className={cn('group/sub grid text-sm hover:bg-muted/30', done && 'bg-emerald-50/40')} style={{ gridTemplateColumns: SUB_COLS }}>
              <div className={cn(cell, 'justify-center')}>
                <input
                  type="checkbox"
                  className="accent-primary disabled:cursor-not-allowed"
                  checked={done}
                  disabled={!canFinish}
                  onChange={() => (s.kind === 'BUG' ? moves.request(s, 'DONE') : actions.patchSubitem(s.id, { status: 'DONE' }))}
                  aria-label="Finalizar"
                  title={done ? 'Finalizada' : canFinish ? 'Marcar como finalizada' : 'Se finaliza desde En progreso'}
                />
              </div>
              <div className={cn(cell, 'px-1', locked && 'pointer-events-none', done && 'text-muted-foreground')}>
                {s.kind === 'QA' && <QaTag className="ml-1" />}
                {s.kind === 'BUG' && <BugTag severity={s.severity} className="ml-1 shrink-0" />}
                <EditableText value={s.name} required onSave={(v) => actions.patchSubitem(s.id, { name: v })} />
                {s.kind === 'BUG' && testName(s.testId) && (
                  <span className="mr-1 shrink-0 truncate text-[11px] text-muted-foreground" title="Prueba de QA en la que se encontró">
                    en {testName(s.testId)}
                  </span>
                )}
                {s.kind === 'BUG' && <BugEvidence itemId={item.id} files={s.evidence} compact className="pointer-events-auto mr-1" />}
                {canReportBug(item, s, me, can('subitems.manageAll')) && (
                  <button
                    onClick={() => setReporting(s)}
                    className="pointer-events-auto mr-1 flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                    title="Registrar un bug encontrado en esta prueba y asignárselo al programador"
                  >
                    Reportar bug
                  </button>
                )}
              </div>
              <div className={cn(cell, locked && 'pointer-events-none')}>
                <UserPicker
                  value={s.assignee}
                  restrictTo={restrictTo}
                  align="center"
                  onChange={(u) => actions.patchSubitem(s.id, { assigneeId: u?.id ?? null })}
                  trigger={
                    <button type="button" className="group/people flex h-full w-full items-center gap-2 px-2 text-left hover:bg-muted/60" aria-label="Cambiar programador">
                      {s.assignee ? (
                        <>
                          <UserBadge user={s.assignee} />
                          <span className="truncate text-xs font-medium">{s.assignee.name}</span>
                        </>
                      ) : (
                        <>
                          <PeopleStack people={[]} />
                          <span className="text-xs text-muted-foreground/60">Asignar</span>
                        </>
                      )}
                    </button>
                  }
                />
              </div>
              <div className={cn(cell, 'p-0')}>
                <SubitemStatusCell
                  status={s.status}
                  allowed={s.allowedStatuses}
                  taskName={s.name}
                  onChange={(status, reason) =>
                    s.kind === 'BUG' && status === 'DONE' ? moves.request(s, status) : actions.patchSubitem(s.id, { status, reason })
                  }
                />
              </div>
              <div className={cn(cell, locked && 'pointer-events-none')}>
                <DateRangeCell
                  start={s.startDate}
                  end={s.dueDate}
                  done={s.status === 'DONE'}
                  overdue={s.isOverdue}
                  onChange={(startDate, dueDate) => actions.patchSubitem(s.id, { startDate, dueDate })}
                />
              </div>
              <div className={cn(cell, 'px-1', locked && 'pointer-events-none')} title={days !== null ? `${days} día(s) hábil(es) × ${HOURS_PER_DAY} h` : 'Define inicio y fin para calcular'}>
                <EditableText
                  type="number"
                  value={s.hours === null ? null : String(s.hours)}
                  onSave={(v) => actions.patchSubitem(s.id, { hours: v === '' ? null : Number(v) })}
                  className="text-center"
                />
              </div>
              <div className={cn(cell, 'justify-center')}>
                <button
                  onClick={() => actions.removeSubitem(s.id)}
                  className="rounded p-1 text-muted-foreground opacity-0 group-hover/sub:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Eliminar subelemento"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        <NewSubitemRow itemId={item.id} actions={actions} />

        <div className="grid text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: SUB_COLS }}>
          <div className="col-span-5 flex h-11 items-center justify-between px-3">
            <AiSuggestSubitems itemId={item.id} itemName={item.name} actions={actions} />
            <span>Total horas laborales</span>
          </div>
          <div className="flex h-11 items-center justify-center border-l text-sm font-semibold text-foreground">{hours}</div>
          <div />
        </div>
      </div>
      {moves.dialog}
      <ReportBugSheet item={item} test={reporting} onClose={() => setReporting(null)} />
    </div>
  )
}

const EMPTY = { name: '', assignee: null as User | null, status: 'PENDING' as SubitemStatus, startDate: '', dueDate: '' }

/** Fila para crear un subelemento completo: programador, estado, fechas y horas laborales calculadas. */
function NewSubitemRow({ itemId, actions }: { itemId: string; actions: WsActions }) {
  const { user } = useAuth()
  const restrictTo = useAssignRestriction()
  // Un colaborador crea subtareas para sí mismo
  const initial = { ...EMPTY, assignee: restrictTo ? user : null }
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const days = workingDays(form.startDate || null, form.dueDate || null)
  const hours = workingHours(form.startDate || null, form.dueDate || null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Escribe el nombre del subelemento')
    setSaving(true)
    const ok = await actions.addSubitem(itemId, form.name.trim(), {
      assigneeId: form.assignee?.id ?? null,
      status: form.status,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
    })
    setSaving(false)
    // Se conserva el programador para agregar varias tareas seguidas a la misma persona
    if (ok) setForm({ ...initial, assignee: form.assignee })
  }

  const field = 'h-8 w-full rounded-md border border-border bg-white px-2 text-xs outline-none focus:border-primary'

  return (
    <form onSubmit={submit} className="grid bg-primary/[0.03] text-sm" style={{ gridTemplateColumns: SUB_COLS }}>
      <div className={cn(cell, 'justify-center text-primary')}>
        <Plus className="size-4" />
      </div>
      <div className={cn(cell, 'px-2')}>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Agregar subelemento…"
          className={cn(field, 'text-sm')}
          aria-label="Nombre del subelemento"
        />
      </div>
      <div className={cn(cell, 'px-1')}>
        <UserPicker value={form.assignee} onChange={(u) => set('assignee', u)} restrictTo={restrictTo} />
      </div>
      <div className={cn(cell, 'px-1')}>
        <StatusPicker value={form.status} onChange={(s) => set('status', s)} options={['PENDING', 'IN_PROGRESS']} />
      </div>
      <div className={cn(cell, 'px-1')}>
        <DateRangeCell
          variant="field"
          start={form.startDate || null}
          end={form.dueDate || null}
          onChange={(startDate, dueDate) => setForm((f) => ({ ...f, startDate, dueDate }))}
        />
      </div>
      <div className={cn(cell, 'flex-col justify-center leading-tight')} title={days !== null ? `${days} día(s) hábil(es) × ${HOURS_PER_DAY} h` : undefined}>
        <span className="text-sm font-semibold text-primary">{hours ?? '—'}</span>
        {days !== null && <span className="text-[10px] text-muted-foreground">{days} d háb.</span>}
      </div>
      <div className={cn(cell, 'justify-center')}>
        <button
          type="submit"
          disabled={saving}
          className="grid size-7 place-items-center rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          aria-label="Guardar subelemento"
          title="Guardar subelemento"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-4" />}
        </button>
      </div>
    </form>
  )
}
