import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { WsGroup } from '@/lib/types'
import { SubitemKanban, fmtHours, moveHint, useSubitemMoves, type KanbanLane } from './SubitemKanban'

/**
 * Kanban del tablero: las subtareas de cada proyecto, un carril por proyecto (en el orden de las etapas).
 * Las subtareas se mueven dentro de su proyecto; las reglas las valida el servidor.
 */
export function BoardSubitemKanban({ boardId, groups, onOpenItem }: { boardId: string; groups: WsGroup[]; onOpenItem: (itemId: string) => void }) {
  const moves = useSubitemMoves()
  const lanes: KanbanLane[] = groups.flatMap((g) =>
    g.items.map((item) => {
      const tasks = item.subitems.map(moves.apply)
      const done = tasks.filter((t) => t.status === 'DONE').length
      const hours = tasks.reduce((n, t) => n + (t.hours ?? 0), 0)
      return {
        key: item.id,
        tasks,
        header: (
          <div>
            <Link
              to={`/proyectos/${boardId}/p/${item.id}`}
              className="group/link flex items-start gap-1 text-sm leading-snug font-semibold hover:text-primary"
              title="Abrir el Kanban del proyecto"
            >
              <span className="line-clamp-2">{item.name}</span>
              <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-0 transition group-hover/link:opacity-60" />
            </Link>
            <span className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: g.color }}>
              {g.name}
            </span>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {done}/{tasks.length} finalizadas · {fmtHours(hours)}
            </p>
          </div>
        ),
      }
    })
  )

  return (
    <>
      <SubitemKanban
        lanes={lanes}
        laneLabel="Proyecto"
        emptyText="No hay proyectos que mostrar en este tablero."
        showAssignee
        onOpen={(t) => {
          const lane = lanes.find((l) => l.tasks.some((x) => x.id === t.id))
          if (lane) onOpenItem(lane.key)
        }}
        onMove={moves.request}
        hint={moveHint}
      />
      {moves.dialog}
    </>
  )
}
