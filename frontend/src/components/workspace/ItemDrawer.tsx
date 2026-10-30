import { useQuery } from '@apollo/client/react'
import { Link } from 'react-router-dom'
import { Clock, KanbanSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loading, UserAvatar } from '@/components/common'
import { WS_ITEM_DETAIL } from '@/lib/graphql'
import { fmtDate, fmtDateTime, fromNow } from '@/lib/format'
import type { User, WsItem } from '@/lib/types'
import { Battery, EditableText, PeopleStack } from './cells'
import { SUBITEM_STATUS } from './meta'
import { Updates } from './Updates'
import type { WsActions } from './useWsActions'

type ItemDetail = WsItem & {
  board: { id: string; name: string }
  createdAt: string
  createdBy: User
  updates: { id: string; body: string; createdAt: string; user: User }[]
  activity: { id: string; detail: string; createdAt: string; user: User }[]
}

export function ItemDrawer({ itemId, actions, onClose }: { itemId: string | null; actions: WsActions; onClose: () => void }) {
  return (
    <Sheet open={!!itemId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {itemId && <Detail itemId={itemId} actions={actions} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function Detail({ itemId, actions, onClose }: { itemId: string; actions: WsActions; onClose: () => void }) {
  const { data, loading } = useQuery<{ wsItem: ItemDetail | null }>(WS_ITEM_DETAIL, { variables: { id: itemId }, fetchPolicy: 'cache-and-network' })
  const item = data?.wsItem

  if (loading && !item) {
    return (
      <>
        <SheetTitle className="sr-only">Cargando</SheetTitle>
        <Loading />
      </>
    )
  }
  if (!item) return <SheetTitle className="p-6">Elemento no encontrado</SheetTitle>

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-6 pr-12">
        <SheetTitle className="sr-only">{item.name}</SheetTitle>
        <SheetDescription className="sr-only">Detalle del elemento</SheetDescription>
        <EditableText value={item.name} required onSave={(name) => actions.patchItem(item.id, { name })} className="h-auto py-1 text-xl font-bold" />
        <Button asChild size="sm" className="mt-2 ml-2 rounded-full">
          <Link to={`/proyectos/${item.board.id}/p/${item.id}`} onClick={onClose}>
            <KanbanSquare /> Abrir Kanban de subtareas
          </Link>
        </Button>
        <div className="mt-3 flex flex-wrap items-center gap-3 px-2 text-sm">
          <span className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: item.group.color }}>
            {item.group.name}
          </span>
          <PeopleStack people={item.assignees} />
          {item.dueDate && <span className="text-muted-foreground">Fecha: {fmtDate(item.dueDate)}</span>}
        </div>
        <div className="mt-4 px-2">
          <Battery subitems={item.subitems} className="px-0" />
          <p className="mt-1 text-xs text-muted-foreground">
            {item.subitems.filter((s) => s.status === 'DONE').length} de {item.subitemCount} subelementos finalizados · {item.totalHours} h
          </p>
        </div>
      </div>

      <Tabs defaultValue="updates" className="min-h-0 flex-1 gap-0">
        <TabsList variant="line" className="mx-6 mt-3">
          <TabsTrigger value="updates">Actualizaciones ({item.updates.length})</TabsTrigger>
          <TabsTrigger value="subitems">Subelementos</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-6">
          <TabsContent value="updates">
            <Updates itemId={item.id} />
          </TabsContent>

          <TabsContent value="subitems" className="space-y-2">
            {item.subitems.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
                <span className="flex-1">{s.name}</span>
                {s.assignee && <UserAvatar user={s.assignee} className="size-6" />}
                <span className="w-32 text-right text-xs text-muted-foreground">
                  {s.startDate ? fmtDate(s.startDate, 'd MMM') : '—'} → {s.dueDate ? fmtDate(s.dueDate, 'd MMM') : '—'}
                  {s.hours !== null && ` · ${s.hours} h`}
                </span>
                <span className="w-24 rounded px-2 py-1 text-center text-xs font-medium text-white" style={{ background: SUBITEM_STATUS[s.status].color }}>
                  {SUBITEM_STATUS[s.status].label}
                </span>
              </div>
            ))}
            {item.subitems.length === 0 && <p className="text-center text-sm text-muted-foreground">Sin subelementos. Agrégalos desde la tabla.</p>}
          </TabsContent>

          <TabsContent value="activity">
            <ol className="relative space-y-4 border-l-2 border-secondary pl-5">
              {item.activity.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute top-1.5 -left-[27px] size-3 rounded-full bg-primary ring-4 ring-white" />
                  <p className="text-sm">
                    <b>{a.user.name}</b> {a.detail}
                  </p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs text-muted-foreground">
              Creado por {item.createdBy.name} el {fmtDateTime(item.createdAt)}
            </p>
          </TabsContent>
        </div>
      </Tabs>

      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={async () => {
            if (confirm(`¿Eliminar "${item.name}" y sus subelementos?`) && (await actions.removeItem(item.id))) onClose()
          }}
        >
          <Trash2 /> Eliminar elemento
        </Button>
      </div>
    </div>
  )
}
