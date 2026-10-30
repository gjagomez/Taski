import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client/react'
import { ArrowRight, ChevronRight, KanbanSquare, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/AppLayout'
import { AvatarStack, EmptyState, Loading } from '@/components/common'
import { BoardDialog, ProjectDialog } from '@/components/ProjectForms'
import { StatusBar, StatusLegend } from '@/components/StatusBar'
import { DELETE_BOARD, DELETE_PROJECT, PROJECT } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { fmtDate } from '@/lib/format'
import type { Project } from '@/lib/types'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useAuth()
  const canManage = can('boards.manage')
  const [boardOpen, setBoardOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const { data, loading } = useQuery<{ project: Project | null }>(PROJECT, { variables: { id } })
  const [deleteProject] = useMutation(DELETE_PROJECT, { refetchQueries: ['Projects', 'Dashboard'] })
  const [deleteBoard] = useMutation(DELETE_BOARD, { refetchQueries: ['Project', 'Dashboard'] })
  const project = data?.project

  if (loading && !project) return <Panel><Loading /></Panel>
  if (!project) {
    return (
      <Panel>
        <EmptyState icon={<Lock />} title="Proyecto no disponible">No existe o no tienes acceso.</EmptyState>
      </Panel>
    )
  }

  async function removeProject() {
    if (!confirm(`¿Eliminar el proyecto "${project!.name}" con todos sus tableros y tareas?`)) return
    try {
      await deleteProject({ variables: { id: project!.id } })
      toast.success('Proyecto eliminado')
      navigate('/kanban')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function removeBoard(boardId: string, name: string) {
    if (!confirm(`¿Eliminar el tablero "${name}" y todas sus tareas?`)) return
    try {
      await deleteBoard({ variables: { id: boardId } })
      toast.success('Tablero eliminado')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const s = project.stats
  const tiles = [
    { label: 'Total de tareas', value: s.total, color: 'text-primary bg-secondary' },
    { label: 'Completadas', value: s.done, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'En progreso', value: s.inProgress, color: 'text-amber-600 bg-amber-50' },
    { label: 'En revisión', value: s.review, color: 'text-sky-600 bg-sky-50' },
    { label: 'Vencidas', value: s.overdue, color: 'text-rose-600 bg-rose-50' },
  ]

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <div className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/kanban" className="hover:text-foreground">Tableros Kanban</Link>
        <ChevronRight className="size-3.5" />
        <span>{project.name}</span>
      </div>

      <div className="relative mt-2 overflow-hidden rounded-3xl p-7 text-white" style={{ background: `linear-gradient(135deg, ${project.color}, ${project.color}cc)` }}>
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-wider text-white/80 uppercase">Proyecto · creado el {fmtDate(project.createdAt)}</p>
            <h1 className="mt-1 text-3xl font-bold">{project.name}</h1>
            {project.description && <p className="mt-2 text-sm text-white/85">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <AvatarStack users={project.members} max={4} />
            {canManage && (
              <>
                <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setEditOpen(true)} aria-label="Editar proyecto">
                  <Pencil />
                </Button>
                <Button size="icon" variant="secondary" className="rounded-full text-destructive" onClick={removeProject} aria-label="Eliminar proyecto">
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="relative mt-6 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${s.completionRate}%` }} />
          </div>
          <span className="text-sm font-bold">{s.completionRate}%</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-2xl p-4 ${t.color}`}>
            <p className="text-2xl font-bold">{t.value}</p>
            <p className="text-xs font-medium opacity-80">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Tableros</h2>
          <StatusLegend />
        </div>
        {canManage && (
          <Button className="rounded-full shadow-lg shadow-primary/30" onClick={() => setBoardOpen(true)}>
            <Plus /> Nuevo tablero
          </Button>
        )}
      </div>

      {project.boards.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<KanbanSquare />} title="Sin tableros">Crea un tablero para comenzar a registrar tareas.</EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {project.boards.map((b) => (
            <div key={b.id} className="group rounded-3xl border bg-white p-5 transition hover:shadow-lg hover:shadow-primary/10">
              <div className="flex items-start justify-between gap-2">
                <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <KanbanSquare className="size-5" />
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" onClick={() => removeBoard(b.id, b.name)} aria-label="Eliminar tablero">
                    <Trash2 className="text-destructive" />
                  </Button>
                )}
              </div>
              <h3 className="mt-3 font-bold">{b.name}</h3>
              <p className="line-clamp-1 text-sm text-muted-foreground">{b.description || 'Sin descripción'}</p>
              <StatusBar stats={b.stats} className="mt-4 h-2" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{b.stats.total} tareas</span>
                {b.stats.overdue > 0 && <span className="font-semibold text-rose-600">{b.stats.overdue} vencidas</span>}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <AvatarStack users={b.members} max={4} />
                <Button asChild size="sm" className="rounded-full">
                  <Link to={`/tableros/${b.id}`}>
                    Abrir <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <>
          <BoardDialog projectId={project.id} open={boardOpen} onOpenChange={setBoardOpen} onSaved={(bid) => navigate(`/tableros/${bid}`)} />
          <ProjectDialog key={project.id + String(editOpen)} open={editOpen} onOpenChange={setEditOpen} project={project} />
        </>
      )}
    </Panel>
  )
}
