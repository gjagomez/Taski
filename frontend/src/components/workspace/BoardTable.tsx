import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, KanbanSquare, MessageSquarePlus, MoreHorizontal, Palette, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth'
import type { WsGroup, WsItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Battery, DateCell, EditableText, PeopleCell, StatusCell } from './cells'
import { GROUP_COLORS, isDevelopmentStage, isQaStage } from './meta'
import { FilesCell } from './FilesCell'
import { SendToQaDialog } from './QaDialogs'
import { Subitems } from './Subitems'
import type { WsActions } from './useWsActions'

// Columnas: selección | Elemento | actualizaciones | Archivos | Solicitantes | Área | Asignación | Fecha | Etapa | Progreso
const ITEM_COLS = '40px minmax(300px,1fr) 52px 130px 150px 130px 110px 120px 170px 170px'

const cell = 'flex h-10 items-center border-r border-b border-border/80'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function GroupSection({
  group,
  groups,
  items,
  actions,
  selected,
  onToggleSelect,
  onOpenItem,
  onMoveGroup,
}: {
  group: WsGroup
  groups: WsGroup[]
  items: WsItem[]
  actions: WsActions
  selected: Set<string>
  onToggleSelect: (ids: string[], value: boolean) => void
  onOpenItem: (id: string) => void
  /** Reordenar la etapa (administrador): -1 sube, 1 baja. Sin esta función la etapa no se puede mover. */
  onMoveGroup?: (direction: -1 | 1) => void
}) {
  const { can } = useAuth()
  const canManage = can('boards.manage')
  // La etapa se arrastra desde el asa (⋮⋮) junto a su nombre
  const sortable = useSortable({ id: group.id, disabled: !onMoveGroup })
  const position = groups.findIndex((g) => g.id === group.id)
  const [collapsed, setCollapsed] = useState(false)
  const [newName, setNewName] = useState('')
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id))
  const subitems = items.flatMap((i) => i.subitems)
  const hours = items.reduce((sum, i) => sum + i.totalHours, 0)

  function addNew() {
    if (!newName.trim()) return
    actions.addItem(group.id, newName.trim())
    setNewName('')
  }

  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={cn('mb-10', sortable.isDragging && 'relative z-20 rounded-xl bg-white/90 opacity-90 shadow-2xl ring-2 ring-primary/30')}
    >
      <div className="mb-2 flex items-center gap-2">
        {onMoveGroup && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Arrastrar para ordenar la etapa ${group.name}`}
            title="Arrastra para cambiar el orden de la etapa"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <button onClick={() => setCollapsed((c) => !c)} className="rounded p-0.5 hover:bg-muted" style={{ color: group.color }} aria-label={collapsed ? 'Expandir grupo' : 'Contraer grupo'}>
          {collapsed ? <ChevronRight className="size-5" /> : <ChevronDown className="size-5" />}
        </button>
        <div className="w-fit max-w-md text-lg font-semibold" style={{ color: group.color }}>
          {canManage ? (
            <EditableText value={group.name} required onSave={(name) => actions.patchGroup(group.id, { name })} className="text-lg font-semibold" />
          ) : (
            <span className="px-2">{group.name}</span>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'elemento' : 'elementos'}
        </span>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Opciones del grupo">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette /> Color del grupo
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="grid grid-cols-5 gap-1.5 p-2">
                  {GROUP_COLORS.map((c) => (
                    <button key={c} onClick={() => actions.patchGroup(group.id, { color: c })} className="size-6 rounded-md" style={{ background: c }} aria-label={c} />
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {onMoveGroup && (
                <>
                  <DropdownMenuItem disabled={position <= 0} onClick={() => onMoveGroup(-1)}>
                    <ArrowUp /> Mover arriba
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={position === groups.length - 1} onClick={() => onMoveGroup(1)}>
                    <ArrowDown /> Mover abajo
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => confirm(`¿Eliminar el grupo "${group.name}"?`) && actions.removeGroup(group.id)}
              >
                <Trash2 /> Eliminar grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {collapsed ? (
        <div className="flex h-11 items-center gap-4 rounded-lg border border-l-[6px] bg-white px-4 text-sm" style={{ borderLeftColor: group.color }}>
          <span className="font-medium">{group.name}</span>
          <span className="text-muted-foreground">{items.length} elementos</span>
          <Battery subitems={subitems} className="ml-auto w-64" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border-l-[6px] bg-white" style={{ borderLeftColor: group.color }}>
          {/* Encabezado */}
          <div className="grid border-t text-sm text-muted-foreground" style={{ gridTemplateColumns: ITEM_COLS }}>
            <div className={cn(cell, 'justify-center')}>
              <input type="checkbox" className="accent-primary" checked={allSelected} onChange={(e) => onToggleSelect(items.map((i) => i.id), e.target.checked)} aria-label="Seleccionar grupo" />
            </div>
            <div className={cn(cell, 'col-span-2 justify-center')}>Elemento</div>
            <div className={cn(cell, 'justify-center')}>Archivos</div>
            <div className={cn(cell, 'justify-center')}>Solicitantes</div>
            <div className={cn(cell, 'justify-center')}>Área</div>
            <div className={cn(cell, 'justify-center')}>Asignación</div>
            <div className={cn(cell, 'justify-center')}>Fecha</div>
            <div className={cn(cell, 'justify-center')}>Etapa del Proyecto</div>
            <div className={cn(cell, 'justify-center')}>Progreso</div>
          </div>

          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              groups={groups}
              actions={actions}
              selected={selected.has(item.id)}
              onSelect={(v) => onToggleSelect([item.id], v)}
              onOpen={() => onOpenItem(item.id)}
            />
          ))}

          {/* Agregar elemento */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addNew()
            }}
            className="grid"
            style={{ gridTemplateColumns: ITEM_COLS }}
          >
            <div className={cell} />
            <div className={cn(cell, 'col-span-9 px-2')}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={addNew}
                placeholder="+ Agregar elemento"
                className="h-8 w-full max-w-md rounded-md border border-transparent px-2 text-sm outline-none placeholder:text-muted-foreground hover:border-border focus:border-primary"
              />
            </div>
          </form>

          {/* Resumen del grupo */}
          <div className="grid text-xs text-muted-foreground" style={{ gridTemplateColumns: ITEM_COLS }}>
            <div className="col-span-4" />
            <div className="col-span-3 flex h-10 items-center justify-end border-b border-l px-3">{hours ? `${hours} h registradas` : ''}</div>
            <div className="flex h-10 items-center border-b border-l" />
            <div className="flex h-10 items-center border-b border-l px-2">
              <div className="h-4 w-full rounded-sm" style={{ background: group.color }} />
            </div>
            <div className="flex h-10 items-center border-b border-l">
              <Battery subitems={subitems} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function ItemRow({
  item,
  groups,
  actions,
  selected,
  onSelect,
  onOpen,
}: {
  item: WsItem
  groups: WsGroup[]
  actions: WsActions
  selected: boolean
  onSelect: (v: boolean) => void
  onOpen: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [sendingQa, setSendingQa] = useState(false)
  const { id: boardId } = useParams()
  const { user: me, can } = useAuth()
  const canStage = can('projects.changeStage')
  const devStage = isDevelopmentStage(item.group.name)
  // El programador del proyecto lo regresa de QA a desarrollo mientras el QA no esté probando
  const canWithdraw =
    isQaStage(item.group.name) &&
    !!item.devGroup &&
    item.assignees.some((u) => u.id === me?.id) &&
    !item.subitems.some((s) => s.kind === 'QA' && s.status === 'IN_PROGRESS')
  // Pasar a la etapa de QA siempre pide elegir (o confirmar) al QA que lo revisará
  const changeStage = (groupId: string) => {
    if (groupId === item.group.id) return
    if (groupId === item.qaGroup?.id) setSendingQa(true)
    else actions.patchItem(item.id, { groupId })
  }
  const overdue = !!item.dueDate && item.dueDate < today() && item.progress < 100

  return (
    <>
      <div className={cn('group/row grid text-sm', selected ? 'bg-primary/5' : 'hover:bg-muted/30')} style={{ gridTemplateColumns: ITEM_COLS }}>
        <div className={cn(cell, 'justify-center')}>
          <input type="checkbox" className="accent-primary" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label="Seleccionar elemento" />
        </div>
        <div className={cn(cell, 'gap-1 pl-1')}>
          <button onClick={() => setExpanded((x) => !x)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={expanded ? 'Ocultar subelementos' : 'Mostrar subelementos'}>
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <EditableText value={item.name} required onSave={(name) => actions.patchItem(item.id, { name })} />
          </div>
          <Link
            to={`/proyectos/${boardId}/p/${item.id}`}
            className="mr-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary opacity-0 transition group-hover/row:opacity-100 hover:bg-primary/10"
            title="Abrir el Kanban del proyecto"
          >
            <KanbanSquare className="size-3.5" /> Kanban
          </Link>
          {item.subitemCount > 0 && (
            <button onClick={() => setExpanded((x) => !x)} className="mr-2 rounded bg-muted px-1.5 text-xs text-muted-foreground">
              {item.subitemCount}
            </button>
          )}
        </div>
        <div className={cn(cell, 'justify-center')}>
          <button onClick={onOpen} className="relative rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary" aria-label="Actualizaciones">
            <MessageSquarePlus className="size-5 stroke-[1.5]" />
            {item.updateCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-white">{item.updateCount}</span>
            )}
          </button>
        </div>
        <div className={cell}>
          <FilesCell itemId={item.id} files={item.files} />
        </div>
        <div className={cn(cell, 'px-1')}>
          <EditableText value={item.requesters} onSave={(requesters) => actions.patchItem(item.id, { requesters })} className="text-center" />
        </div>
        <div className={cn(cell, 'px-1')}>
          <EditableText value={item.area} onSave={(area) => actions.patchItem(item.id, { area })} className="text-center" />
        </div>
        <div className={cell}>
          <PeopleCell people={item.assignees} onChange={(assigneeIds) => actions.patchItem(item.id, { assigneeIds })} />
        </div>
        <div className={cell}>
          <DateCell value={item.dueDate} overdue={overdue} done={item.subitemCount > 0 && item.progress === 100} onChange={(dueDate) => actions.patchItem(item.id, { dueDate })} />
        </div>
        <div className={cn(cell, 'p-0')}>
          {/* Con projects.changeStage se cambia a cualquier etapa; sin él solo se envía a QA un proyecto En Desarrollo */}
          {canStage ? (
            <StatusCell
              label={item.group.name}
              color={item.group.color}
              options={groups.map((g) => ({ value: g.id, label: g.name, color: g.color }))}
              onChange={changeStage}
            />
          ) : devStage && item.qaGroup ? (
            <StatusCell
              label={item.group.name}
              color={item.group.color}
              options={[{ value: item.qaGroup.id, label: `Enviar a ${item.qaGroup.name}`, color: item.qaGroup.color }]}
              onChange={changeStage}
            />
          ) : canWithdraw ? (
            <StatusCell
              label={item.group.name}
              color={item.group.color}
              options={[{ value: item.devGroup!.id, label: `Regresar a ${item.devGroup!.name}`, color: item.devGroup!.color }]}
              onChange={changeStage}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center px-2 text-[13px] font-medium text-white"
              style={{ background: item.group.color }}
              title="Solo el administrador cambia la etapa"
            >
              <span className="truncate">{item.group.name}</span>
            </div>
          )}
        </div>
        <div className={cell}>
          <Battery subitems={item.subitems} />
        </div>
      </div>

      {expanded && <Subitems item={item} actions={actions} />}
      {item.qaGroup && <SendToQaDialog item={item} open={sendingQa} onOpenChange={setSendingQa} />}
    </>
  )
}
