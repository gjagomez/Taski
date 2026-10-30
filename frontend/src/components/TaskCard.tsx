import { AlertTriangle, CalendarDays, CheckSquare, MessageSquare } from 'lucide-react'
import { BugBadge, PriorityBadge, UserAvatar } from '@/components/common'
import { fmtDate } from '@/lib/format'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'

export function TaskCard({ task, dragging, onClick }: { task: Task; dragging?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10',
        task.isOverdue && 'border-rose-300 bg-rose-50/60',
        dragging && 'rotate-2 shadow-2xl shadow-primary/25'
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {task.type === 'BUG' && <BugBadge />}
        <PriorityBadge priority={task.priority} />
        {task.labels.slice(0, 2).map((l) => (
          <span key={l} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            {l}
          </span>
        ))}
      </div>
      <p className="leading-snug font-semibold">{task.title}</p>

      {task.subtaskCount > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckSquare className="size-3" /> {task.subtaskDone}/{task.subtaskCount}
            </span>
            <span className="font-semibold text-foreground">{task.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn('h-full rounded-full transition-all', task.progress === 100 ? 'bg-emerald-500' : 'bg-primary')}
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {task.dueDate && (
            <span className={cn('flex items-center gap-1', task.isOverdue && 'font-semibold text-rose-600')}>
              {task.isOverdue ? <AlertTriangle className="size-3" /> : <CalendarDays className="size-3" />}
              {fmtDate(task.dueDate, 'd MMM')}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" /> {task.commentCount}
            </span>
          )}
        </div>
        {task.assignee ? (
          <UserAvatar user={task.assignee} className="size-7" />
        ) : (
          <span className="rounded-full border border-dashed px-2 py-0.5 text-[10px] text-muted-foreground">Sin asignar</span>
        )}
      </div>
    </div>
  )
}
