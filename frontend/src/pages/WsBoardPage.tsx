import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  ArrowDownUp,
  BarChart3,
  ChevronDown,
  CircleUserRound,
  EyeOff,
  FolderOpen,
  KanbanSquare,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Panel } from '@/components/AppLayout'
import { AvatarStack, EmptyState, Loading, UserAvatar } from '@/components/common'
import { CreateWsBoardDialog } from '@/components/workspace/WorkspaceNav'
import { GroupSection } from '@/components/workspace/BoardTable'
import { BoardSubitemKanban } from '@/components/workspace/BoardSubitemKanban'
import { ItemDrawer } from '@/components/workspace/ItemDrawer'
import { Battery, PeopleStack } from '@/components/workspace/cells'
import { GROUP_COLORS, SUBITEM_STATUS, SUBITEM_STATUS_ORDER } from '@/components/workspace/meta'
import { useWsActions } from '@/components/workspace/useWsActions'
import { DeleteBoardDialog } from '@/components/workspace/DeleteBoardDialog'
import { UPDATE_WS_BOARD, WS_BOARD, WS_BOARDS } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { fmtDate } from '@/lib/format'
import type { User, WsBoard, WsBoardSummary, WsGroup, WsItem } from '@/lib/types'
import { cn } from '@/lib/utils'

type Sort = 'default' | 'date' | 'name'


export function WsHome() {
  const { can } = useAuth()
  const canManage = can('boards.manage')
  const { data, loading } = useQuery<{ wsBoards: WsBoardSummary[] }>(WS_BOARDS)
  const [open, setOpen] = useState(false)
  if (loading && !data) return <Panel><Loading /></Panel>
  const first = data?.wsBoards[0]
  if (first) return <Navigate to={`/proyectos/${first.id}`} replace />
  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <EmptyState icon={<LayoutList />} title="Aún no hay tableros de proyectos">
        {canManage ? (
          <Button className="mt-3 rounded-full" onClick={() => setOpen(true)}>
            <Plus /> Crear el primer tablero
          </Button>
        ) : (
          'Un administrador debe crear el primer tablero.'
        )}
      </EmptyState>
      <CreateWsBoardDialog open={open} onOpenChange={setOpen} folders={[]} />
    </Panel>
  )
}

export default function WsBoardPage() {
  const { id } = useParams()
  return <WsBoardView key={id} id={id!} />
}

function WsBoardView({ id }: { id: string }) {
  const { can } = useAuth()
  const canManage = can('boards.manage')
  const canStage = can('projects.changeStage')
  const { data, loading } = useQuery<{ wsBoard: WsBoard | null }>(WS_BOARD, { variables: { id } })
  const actions = useWsActions()
  const [search, setSearch] = useState('')
  const [person, setPerson] = useState<User | null>(null)
  const [sort, setSort] = useState<Sort>('default')
 
  const [hideEmpty, setHideEmpty] = useState(!can('projects.viewAll'))
 
  const [kanbanMode, setKanbanMode] = useState<'subitems' | 'stages'>('subitems')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [newItemOpen, setNewItemOpen] = useState(false)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [groupOrder, setGroupOrder] = useState<string[] | null>(null)
  const groupSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const board = data?.wsBoard
  const boardGroups = useMemo(() => {
    const list = board?.groups ?? []
    if (!groupOrder) return list
    return [...list].sort((a, b) => groupOrder.indexOf(a.id) - groupOrder.indexOf(b.id))
  }, [board, groupOrder])

  async function reorderGroups(ids: string[]) {
    setGroupOrder(ids)
    if (!(await actions.reorderGroups(board!.id, ids))) setGroupOrder(null)
  }


  const serverOrder = (board?.groups ?? []).map((g) => g.id).join(',')
  useEffect(() => {
    if (groupOrder && groupOrder.join(',') === serverOrder) setGroupOrder(null)
  }, [serverOrder, groupOrder])

  const moveGroup = (groupId: string, direction: -1 | 1) => {
    const ids = boardGroups.map((g) => g.id)
    const from = ids.indexOf(groupId)
    const to = from + direction
    if (to >= 0 && to < ids.length) reorderGroups(arrayMove(ids, from, to))
  }

  function onGroupDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = boardGroups.map((g) => g.id)
    reorderGroups(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const people = useMemo(() => {
    const map = new Map<string, User>()
    for (const g of board?.groups ?? [])
      for (const i of g.items) {
        i.assignees.forEach((u) => map.set(u.id, u))
        i.subitems.forEach((s) => s.assignee && map.set(s.assignee.id, s.assignee))
      }
    return [...map.values()]
  }, [board])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const match = (i: WsItem) =>
      (!q ||
        [i.name, i.area, i.requesters, ...i.subitems.map((s) => s.name)].some((v) => v?.toLowerCase().includes(q))) &&
      (!person || i.assignees.some((u) => u.id === person.id) || i.subitems.some((s) => s.assignee?.id === person.id))
    const order = (items: WsItem[]) =>
      sort === 'name'
        ? [...items].sort((a, b) => a.name.localeCompare(b.name))
        : sort === 'date'
          ? [...items].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
          : items
    return boardGroups
      .map((g) => ({ group: g, items: order(g.items.filter(match)) }))
      .filter((g) => !hideEmpty || g.items.length > 0)
  }, [boardGroups, search, person, sort, hideEmpty])

  if (loading && !board) return <Panel><Loading /></Panel>
  if (!board) {
    return (
      <Panel>
        <EmptyState icon={<FolderOpen />} title="Tablero no encontrado">Puede que haya sido eliminado o que no tengas proyectos asignados en él.</EmptyState>
      </Panel>
    )
  }

  const toggleSelect = (ids: string[], value: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      ids.forEach((i) => (value ? next.add(i) : next.delete(i)))
      return next
    })

  async function moveSelected(groupId: string) {
    for (const itemId of selected) await actions.patchItem(itemId, { groupId })
    toast.success(`${selected.size} elemento(s) movidos`)
    setSelected(new Set())
  }

  async function deleteSelected() {
    if (!confirm(`¿Eliminar ${selected.size} elemento(s)?`)) return
    for (const itemId of selected) await actions.removeItem(itemId)
    setSelected(new Set())
  }

  const filtered = !!search.trim() || !!person
  const itemCount = board.groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)] p-4 sm:p-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {board.folder && (
            <p className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <FolderOpen className="size-3.5" /> Proyectos / {board.folder}
            </p>
          )}
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg px-1 text-3xl font-bold tracking-tight hover:bg-muted">
                {board.name} <ChevronDown className="size-6 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil /> Renombrar / mover de carpeta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                  <Plus /> Agregar grupo (etapa)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 /> Eliminar tablero
                  {itemCount > 0 && <span className="ml-auto text-[10px] opacity-70">{itemCount} elem.</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <h1 className="px-1 text-3xl font-bold tracking-tight">{board.name}</h1>
          )}
        </div>
        <AvatarStack users={people} max={5} />
      </div>

      <Tabs defaultValue="table" className="mt-3">
        <TabsList variant="line" className="w-full justify-start border-b pb-0">
          <TabsTrigger value="table" className="flex-none">
            <LayoutList /> Tabla principal
          </TabsTrigger>
          <TabsTrigger value="kanban" className="flex-none">
            <KanbanSquare /> Kanban
          </TabsTrigger>
          <TabsTrigger value="chart" className="flex-none">
            <BarChart3 /> Gráfico
          </TabsTrigger>
        </TabsList>


        <div className="mt-4 flex flex-wrap items-center gap-1">
          <div className="flex">
            <Button className="rounded-r-none" onClick={() => setNewItemOpen(true)}>
              Agregar elemento
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-l-none border-l border-white/30 px-2" aria-label="Más opciones">
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setNewItemOpen(true)}>
                  <Plus /> Nuevo elemento
                </DropdownMenuItem>
                {canManage && (
                  <DropdownMenuItem onClick={() => setNewGroupOpen(true)}>
                    <Plus /> Nuevo grupo de elementos
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="relative ml-2">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" className="h-9 w-40 border-transparent bg-transparent pl-8 shadow-none hover:bg-muted focus:w-56 focus:bg-white" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn(person && 'bg-primary/10 text-primary')}>
                {person ? <UserAvatar user={person} className="size-5 ring-0" /> : <CircleUserRound />} Persona
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Filtrar por persona</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {people.map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => setPerson(u)}>
                  <UserAvatar user={u} className="size-6" /> {u.name}
                </DropdownMenuItem>
              ))}
              {person && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPerson(null)}>
                    <X /> Quitar filtro
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn(sort !== 'default' && 'bg-primary/10 text-primary')}>
                <ArrowDownUp /> Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <DropdownMenuRadioItem value="default">Orden manual</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date">Por fecha</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name">Por nombre</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" className={cn(hideEmpty && 'bg-primary/10 text-primary')} onClick={() => setHideEmpty((h) => !h)}>
            <EyeOff /> Ocultar vacíos
          </Button>

          {filtered && (
            <Button
              variant="link"
              onClick={() => {
                setSearch('')
                setPerson(null)
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        <TabsContent value="table" className="mt-6">
          {itemCount === 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl border border-dashed border-primary/30 bg-secondary/40 px-5 py-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-white text-primary shadow-sm">
                <FolderOpen className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Este tablero está vacío</p>
                <p className="text-sm text-muted-foreground">Agrega un elemento para empezar{canManage && ' o elimínalo si ya no lo necesitas'}.</p>
              </div>
              <Button className="rounded-full" onClick={() => setNewItemOpen(true)}>
                <Plus /> Agregar elemento
              </Button>
              {canManage && (
                <Button variant="outline" className="rounded-full text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 /> Eliminar tablero
                </Button>
              )}
            </div>
          )}
          <div className="scrollbar-thin overflow-x-auto pb-4">
            <div className="min-w-[1400px]">
           
              <DndContext sensors={groupSensors} collisionDetection={closestCenter} onDragEnd={onGroupDragEnd}>
                <SortableContext items={groups.map((g) => g.group.id)} strategy={verticalListSortingStrategy}>
                  {groups.map(({ group, items }) => (
                    <GroupSection
                      key={group.id}
                      group={group}
                      groups={boardGroups}
                      items={items}
                      actions={actions}
                      selected={selected}
                      onToggleSelect={toggleSelect}
                      onOpenItem={setOpenItem}
                      onMoveGroup={canManage ? (direction) => moveGroup(group.id, direction) : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
          {canManage && (
            <Button variant="outline" className="rounded-full" onClick={() => setNewGroupOpen(true)}>
              <Plus /> Agregar nuevo grupo
            </Button>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="mt-6">
          {canStage && (
            <div className="mb-4 inline-flex rounded-full bg-muted p-1 text-sm">
              {([
                ['subitems', 'Subtareas por proyecto'],
                ['stages', 'Proyectos por etapa'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setKanbanMode(mode)}
                  className={cn('rounded-full px-4 py-1.5 font-medium transition', kanbanMode === mode ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {kanbanMode === 'stages' && canStage ? (
            <WsKanban
              groups={groups.map((g) => ({ ...g.group, items: g.items }))}
              canMove={canStage}
              onMove={(itemId, groupId) => actions.patchItem(itemId, { groupId })}
              onOpen={setOpenItem}
            />
          ) : (
            <BoardSubitemKanban boardId={board.id} groups={groups.map((g) => ({ ...g.group, items: g.items }))} onOpenItem={setOpenItem} />
          )}
        </TabsContent>

        <TabsContent value="chart" className="mt-6">
          <WsChart groups={groups.map((g) => ({ ...g.group, items: g.items }))} />
        </TabsContent>
      </Tabs>


      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border bg-white p-2 pl-4 shadow-2xl shadow-primary/20">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-white">{selected.size}</span>
          <span className="mr-2 text-sm font-medium">seleccionados</span>
          {canStage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">Mover a etapa <ChevronDown /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {board.groups.map((g) => (
                <DropdownMenuItem key={g.id} onClick={() => moveSelected(g.id)}>
                  <span className="size-3 rounded-sm" style={{ background: g.color }} /> {g.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          <Button variant="ghost" className="text-destructive" onClick={deleteSelected}>
            <Trash2 /> Eliminar
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSelected(new Set())} aria-label="Cancelar selección">
            <X />
          </Button>
        </div>
      )}

      <ItemDrawer itemId={openItem} actions={actions} onClose={() => setOpenItem(null)} />
      <NewItemDialog open={newItemOpen} onOpenChange={setNewItemOpen} groups={board.groups} actions={actions} />
      {canManage && <NewGroupDialog open={newGroupOpen} onOpenChange={setNewGroupOpen} boardId={board.id} actions={actions} />}
      {canManage && (
        <DeleteBoardDialog board={deleteOpen ? { id: board.id, name: board.name, itemCount } : null} onOpenChange={setDeleteOpen} />
      )}
      {canManage && <RenameBoardDialog key={board.id + String(renameOpen)} open={renameOpen} onOpenChange={setRenameOpen} board={board} />}
    </Panel>
  )
}

function NewItemDialog({ open, onOpenChange, groups, actions }: { open: boolean; onOpenChange: (o: boolean) => void; groups: WsGroup[]; actions: ReturnType<typeof useWsActions> }) {
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [saving, setSaving] = useState(false)
  const target = groupId || groups[0]?.id

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !target) return
    setSaving(true)
    if (await actions.addItem(target, name.trim())) {
      toast.success('Elemento creado')
      setName('')
      onOpenChange(false)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo elemento</DialogTitle>
          <DialogDescription>Un proyecto del tablero, por ejemplo "Matriz de refinanciamiento".</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Etapa</Label>
            <Select value={target} onValueChange={setGroupId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="size-3 rounded-sm" style={{ background: g.color }} /> {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="rounded-full" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewGroupDialog({ open, onOpenChange, boardId, actions }: { open: boolean; onOpenChange: (o: boolean) => void; boardId: string; actions: ReturnType<typeof useWsActions> }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[1])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (await actions.addGroup(boardId, name.trim(), color)) {
      setName('')
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo grupo (etapa)</DialogTitle>
          <DialogDescription>Los grupos son las etapas por las que pasan los proyectos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="En Certificación" />
          </div>
          <div className="flex flex-wrap gap-2">
            {GROUP_COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} className={cn('size-8 rounded-lg ring-offset-2', color === c && 'ring-2 ring-foreground')} style={{ background: c }} aria-label={c} />
            ))}
          </div>
          <DialogFooter>
            <Button type="submit" className="rounded-full" disabled={!name.trim()}>
              <Plus /> Crear grupo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameBoardDialog({ open, onOpenChange, board }: { open: boolean; onOpenChange: (o: boolean) => void; board: WsBoard }) {
  const [name, setName] = useState(board.name)
  const [folder, setFolder] = useState(board.folder ?? '')
  const [update, { loading }] = useMutation(UPDATE_WS_BOARD, { refetchQueries: ['WsBoards', 'WsBoard', 'WsFolders'] })
  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await update({ variables: { id: board.id, name, folder } })
      toast.success('Tablero actualizado')
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Editar tablero</DialogTitle>
          <DialogDescription>Cambia el nombre o la carpeta del menú.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Carpeta</Label>
            <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Sin carpeta" />
          </div>
          <DialogFooter>
            <Button type="submit" className="rounded-full" disabled={loading || !name.trim()}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


function WsKanban({
  groups,
  canMove,
  onMove,
  onOpen,
}: {
  groups: WsGroup[]
  canMove: boolean
  onMove: (itemId: string, groupId: string) => void
  onOpen: (id: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [active, setActive] = useState<WsItem | null>(null)
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActive(groups.flatMap((g) => g.items).find((i) => i.id === e.active.id) ?? null)}
      onDragCancel={() => setActive(null)}
      onDragEnd={(e) => {
        setActive(null)
        const item = groups.flatMap((g) => g.items).find((i) => i.id === e.active.id)
        const to = e.over?.id as string | undefined
        if (item && to && to !== item.group.id) onMove(item.id, to)
      }}
    >
      <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">
        {groups.map((g) => (
          <KanbanLane key={g.id} group={g} canMove={canMove} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{active && <KanbanCard item={active} dragging />}</DragOverlay>
    </DndContext>
  )
}

function KanbanLane({ group, canMove, onOpen }: { group: WsGroup; canMove: boolean; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id })
  return (
    <div ref={setNodeRef} className={cn('flex w-72 shrink-0 flex-col rounded-2xl bg-slate-50 transition', isOver && 'ring-2 ring-primary')}>
      <div className="flex items-center justify-between rounded-t-2xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: group.color }}>
        {group.name}
        <span className="rounded-full bg-white/25 px-2 text-xs">{group.items.length}</span>
      </div>
      <div className="flex min-h-32 flex-col gap-2.5 p-3">
        {group.items.map((i) => (
          <DraggableItem key={i.id} item={i} canMove={canMove} onOpen={() => onOpen(i.id)} />
        ))}
      </div>
    </div>
  )
}

function DraggableItem({ item, canMove, onOpen }: { item: WsItem; canMove: boolean; onOpen: () => void }) {
  // Cambiar la etapa de un proyecto es tarea del administrador
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: item.id, disabled: !canMove })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn('touch-none', isDragging && 'opacity-30')} onClick={onOpen}>
      <KanbanCard item={item} />
    </div>
  )
}

function KanbanCard({ item, dragging }: { item: WsItem; dragging?: boolean }) {
  return (
    <div className={cn('cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md', dragging && 'rotate-2 shadow-xl')}>
      <p className="text-sm leading-snug font-semibold">{item.name}</p>
      {item.area && <p className="mt-1 text-xs text-muted-foreground">{item.area}</p>}
      <Battery subitems={item.subitems} className="mt-3 px-0" />
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{item.dueDate ? fmtDate(item.dueDate, 'd MMM') : 'Sin fecha'}</span>
        <span className="group/people">
          <PeopleStack people={item.assignees} />
        </span>
      </div>
    </div>
  )
}


function WsChart({ groups }: { groups: WsGroup[] }) {
  const max = Math.max(1, ...groups.map((g) => g.items.length))
  const subitems = groups.flatMap((g) => g.items.flatMap((i) => i.subitems))
  const hours = subitems.reduce((s, x) => s + (x.hours ?? 0), 0)
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-3xl border p-6">
        <h3 className="font-bold">Elementos por etapa</h3>
        <div className="mt-5 space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground">{g.name}</span>
              <div className="h-6 rounded-md bg-slate-100">
                <div className="h-full rounded-md transition-all" style={{ width: `${(g.items.length / max) * 100}%`, background: g.color }} />
              </div>
              <span className="text-right font-semibold">{g.items.length}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border p-6">
        <h3 className="font-bold">Subelementos por estado</h3>
        <p className="text-sm text-muted-foreground">{subitems.length} subelementos · {hours} h estimadas</p>
        <div className="mt-5 space-y-3">
          {SUBITEM_STATUS_ORDER.map((s) => {
            const n = subitems.filter((x) => x.status === s).length
            return (
              <div key={s} className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{SUBITEM_STATUS[s].label}</span>
                <div className="h-6 rounded-md bg-slate-100">
                  <div className="h-full rounded-md" style={{ width: `${subitems.length ? (n / subitems.length) * 100 : 0}%`, background: SUBITEM_STATUS[s].color }} />
                </div>
                <span className="text-right font-semibold">{n}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
