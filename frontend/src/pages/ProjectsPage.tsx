import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { AlertTriangle, ArrowRight, FolderKanban, LayoutGrid, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/AppLayout'
import { AvatarStack, EmptyState, Loading, PageHeader } from '@/components/common'
import { ProjectDialog } from '@/components/ProjectForms'
import { StatusBar, StatusLegend } from '@/components/StatusBar'
import { PROJECTS } from '@/lib/graphql'
import { useAuth } from '@/lib/auth'
import type { Project } from '@/lib/types'

export default function ProjectsPage() {
  const { can } = useAuth()
  const canManage = can('boards.manage')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { data, loading } = useQuery<{ projects: Project[] }>(PROJECTS)

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <PageHeader
        title="Tableros Kanban"
        subtitle="Flujo de calidad: Por hacer → En progreso → En revisión / QA → Completado, con reglas de transición."
        actions={
          canManage && (
            <Button className="rounded-full shadow-lg shadow-primary/30" onClick={() => setOpen(true)}>
              <Plus /> Nuevo proyecto
            </Button>
          )
        }
      />
      <div className="mt-4">
        <StatusLegend />
      </div>

      {loading && !data ? (
        <Loading />
      ) : data?.projects.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<FolderKanban />} title="Aún no hay proyectos">
            {canManage ? 'Crea tu primer proyecto para empezar.' : 'Un administrador debe asignarte a un tablero.'}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {data?.projects.map((p) => (
            <Link
              key={p.id}
              to={`/kanban/${p.id}`}
              className="group relative overflow-hidden rounded-3xl border bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: p.color }} />
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-12 place-items-center rounded-2xl text-white shadow-lg" style={{ background: p.color }}>
                  <LayoutGrid className="size-5" />
                </div>
                {p.stats.overdue > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    <AlertTriangle className="size-3" /> {p.stats.overdue} vencidas
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-lg font-bold">{p.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{p.description || 'Sin descripción'}</p>

              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold">{p.stats.completionRate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {p.stats.done} de {p.stats.total} tareas completadas
                  </p>
                </div>
                <AvatarStack users={p.members} max={3} />
              </div>
              <StatusBar stats={p.stats} className="mt-3 h-2.5" />

              <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
                <span className="text-muted-foreground">{p.boards.length} tablero(s)</span>
                <span className="flex items-center gap-1 font-semibold text-primary">
                  Abrir <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <ProjectDialog open={open} onOpenChange={setOpen} onSaved={(id) => navigate(`/kanban/${id}`)} />
    </Panel>
  )
}
