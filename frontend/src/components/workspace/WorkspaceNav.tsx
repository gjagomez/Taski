import { useState, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client/react'
import { CalendarPlus, ChevronDown, ChevronRight, Folder, FolderOpen, LayoutList, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CREATE_WS_BOARD, CREATE_WS_FOLDER, DELETE_WS_FOLDER, WS_BOARDS, WS_FOLDERS } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import type { WsBoardSummary } from '@/lib/types'
import { cn } from '@/lib/utils'
import { DEFAULT_STAGES } from './meta'
import { DeleteBoardDialog } from './DeleteBoardDialog'

type FolderInfo = { name: string; boardCount: number }

const NO_FOLDER = '__none__'

/** Siguiente año sugerido: el mayor año existente + 1 (o el año actual si no hay ninguno). */
function nextYear(folders: FolderInfo[]) {
  const years = folders.map((f) => f.name).filter((n) => /^\d{4}$/.test(n)).map(Number)
  const current = new Date().getFullYear()
  return String(years.length ? Math.max(...years, current - 1) + 1 : current)
}

/** Árbol "Proyectos" del menú lateral: años/carpetas → tableros. */
export function WorkspaceNav({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth()
  const canManage = can('boards.manage')
  const { data } = useQuery<{ wsBoards: WsBoardSummary[] }>(WS_BOARDS)
  const { data: folderData } = useQuery<{ wsFolders: FolderInfo[] }>(WS_FOLDERS)
  const [deleteFolder] = useMutation(DELETE_WS_FOLDER, { refetchQueries: ['WsFolders'] })
  const [open, setOpen] = useState(true)
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set())
  const [boardDialog, setBoardDialog] = useState<{ folder: string | null } | null>(null)
  const [yearOpen, setYearOpen] = useState(false)
  const [deleting, setDeleting] = useState<WsBoardSummary | null>(null)

  const boards = data?.wsBoards ?? []
  const folders = folderData?.wsFolders ?? []
  const loose = boards.filter((b) => !b.folder)

  const toggleFolder = (f: string) =>
    setClosedFolders((s) => {
      const next = new Set(s)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })

  async function removeFolder(name: string) {
    if (!confirm(`¿Eliminar la carpeta "${name}"?`)) return
    try {
      await deleteFolder({ variables: { name } })
      toast.success(`Carpeta "${name}" eliminada`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const boardLink = (b: WsBoardSummary) => (
    <div key={b.id} className="group/board relative">
      <NavLink
        to={`/proyectos/${b.id}`}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
            isActive ? 'bg-primary/12 font-semibold text-primary' : 'text-muted-foreground hover:bg-white/70 hover:text-foreground',
            canManage && b.itemCount === 0 && 'pr-8'
          )
        }
      >
        <LayoutList className="size-4 shrink-0" />
        <span className="truncate">{b.name}</span>
        {b.itemCount === 0 && <span className="ml-auto text-[10px] text-muted-foreground/60 group-hover/board:hidden">vacío</span>}
      </NavLink>
      {canManage && b.itemCount === 0 && (
        <button
          onClick={() => setDeleting(b)}
          className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 rounded-md p-1 text-muted-foreground group-hover/board:block hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Eliminar tablero ${b.name}`}
          title="Eliminar tablero vacío"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 px-4">
        <button onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-1 text-xs font-medium text-muted-foreground/80 hover:text-foreground">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          Proyectos
        </button>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Agregar" title="Agregar tablero o año">
                <Plus />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setBoardDialog({ folder: folders.at(-1)?.name ?? null })}>
                <LayoutList /> Nuevo tablero
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setYearOpen(true)}>
                <CalendarPlus /> Agregar año
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && (
        <div className="space-y-0.5">
          {folders.map(({ name, boardCount }) => {
            const list = boards.filter((b) => b.folder === name)
            const closed = closedFolders.has(name)
            return (
              <div key={name}>
                <div className="group/folder flex items-center rounded-xl pr-1 text-muted-foreground hover:bg-white/70 hover:text-foreground">
                  <button onClick={() => toggleFolder(name)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm">
                    {closed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    {closed ? <Folder className="size-4" /> : <FolderOpen className="size-4" />}
                    <span className="truncate">{name}</span>
                  </button>
                  {canManage && (
                    <span className="flex opacity-0 transition group-hover/folder:opacity-100">
                      <button
                        onClick={() => setBoardDialog({ folder: name })}
                        className="rounded-md p-1 hover:bg-primary/10 hover:text-primary"
                        aria-label={`Nuevo tablero en ${name}`}
                        title={`Nuevo tablero en ${name}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                      {boardCount === 0 && (
                        <button
                          onClick={() => removeFolder(name)}
                          className="rounded-md p-1 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Eliminar carpeta ${name}`}
                          title="Eliminar carpeta vacía"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
                {!closed && (
                  <div className="ml-5 space-y-0.5 border-l border-primary/10 pl-1">
                    {list.map(boardLink)}
                    {list.length === 0 &&
                      (canManage ? (
                        <button
                          onClick={() => setBoardDialog({ folder: name })}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground/70 hover:bg-white/70 hover:text-primary"
                        >
                          <Plus className="size-3.5" /> Crear tablero
                        </button>
                      ) : (
                        <p className="px-3 py-2 text-xs text-muted-foreground/60">Sin tableros</p>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
          {loose.map(boardLink)}
          {canManage && (
            <button
              onClick={() => setYearOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground/70 hover:bg-white/70 hover:text-primary"
            >
              <CalendarPlus className="size-3.5" /> Agregar año
            </button>
          )}
          {!canManage && boards.length === 0 && <p className="px-4 py-2 text-xs text-muted-foreground">Aún no hay tableros.</p>}
        </div>
      )}

      {canManage && (
        <>
          <CreateWsBoardDialog
            key={boardDialog?.folder ?? NO_FOLDER}
            open={!!boardDialog}
            onOpenChange={(o) => !o && setBoardDialog(null)}
            folders={folders.map((f) => f.name)}
            defaultFolder={boardDialog?.folder ?? null}
            onCreated={onNavigate}
          />
          <DeleteBoardDialog board={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
          <NewYearDialog key={`${yearOpen}-${nextYear(folders)}`} open={yearOpen} onOpenChange={setYearOpen} suggestion={nextYear(folders)} />
        </>
      )}
    </div>
  )
}

function NewYearDialog({ open, onOpenChange, suggestion }: { open: boolean; onOpenChange: (o: boolean) => void; suggestion: string }) {
  const [value, setValue] = useState(suggestion)
  const [error, setError] = useState<string | null>(null)
  const [create, { loading }] = useMutation(CREATE_WS_FOLDER, { refetchQueries: ['WsFolders'] })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return setError('Escribe el año')
    try {
      await create({ variables: { name: value.trim() } })
      toast.success(`Año ${value.trim()} agregado`)
      setError(null)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">Agregar año</DialogTitle>
          <DialogDescription>Crea una carpeta para agrupar los tableros de ese año.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Año</Label>
            <Input
              autoFocus
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={suggestion}
              className="h-12 text-center text-2xl font-bold tracking-widest"
              aria-invalid={!!error}
            />
          </div>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <CalendarPlus />} Agregar año
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreateWsBoardDialog({
  open,
  onOpenChange,
  folders,
  defaultFolder = null,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  folders: string[]
  defaultFolder?: string | null
  onCreated?: () => void
}) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [folder, setFolder] = useState(defaultFolder ?? NO_FOLDER)
  const [error, setError] = useState<string | null>(null)
  const [create, { loading }] = useMutation<{ createWsBoard: { id: string } }>(CREATE_WS_BOARD, { refetchQueries: ['WsBoards', 'WsFolders'] })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('El nombre del tablero es obligatorio')
    try {
      const { data } = await create({ variables: { name, folder: folder === NO_FOLDER ? null : folder } })
      toast.success(`Tablero "${name}" creado`)
      setName('')
      setError(null)
      onOpenChange(false)
      onCreated?.()
      navigate(`/proyectos/${data!.createWsBoard.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo tablero</DialogTitle>
          <DialogDescription>Ejemplo: Nuevo, Billetera, PRONET. Dentro podrás crear proyectos por etapa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Nombre del tablero *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Billetera" aria-invalid={!!error} />
          </div>
          <div className="space-y-1.5">
            <Label>Año / carpeta</Label>
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>
                    <Folder /> {f}
                  </SelectItem>
                ))}
                <SelectItem value={NO_FOLDER}>Sin carpeta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Etapas que se crearán</Label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_STAGES.map((s) => (
                <span key={s.name} className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: s.color }}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Plus />} Crear tablero
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
