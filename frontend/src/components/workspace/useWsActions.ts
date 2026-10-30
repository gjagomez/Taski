import { useMutation } from '@apollo/client/react'
import { toast } from 'sonner'
import {
  CREATE_WS_GROUP,
  CREATE_WS_ITEM,
  CREATE_WS_SUBITEM,
  DELETE_WS_GROUP,
  REORDER_WS_GROUPS,
  DELETE_WS_ITEM,
  DELETE_WS_SUBITEM,
  ADD_WS_SUBITEM_COMMENT,
  REJECT_WS_ITEM_QA,
  REPORT_WS_BUG,
  APPROVE_WS_ITEM_QA,
  VERIFY_WS_BUG,
  UPDATE_WS_GROUP,
  UPDATE_WS_ITEM,
  UPDATE_WS_SUBITEM,
} from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import type { BugSeverity, SubitemKind, SubitemStatus } from '@/lib/types'

const REFETCH = { refetchQueries: ['WsBoard', 'WsBoards', 'WsItemDetail', 'WsMySubitems', 'WsDashboard'] }

export interface WsItemPatch {
  name?: string
  requesters?: string
  area?: string
  dueDate?: string
  groupId?: string
  assigneeIds?: string[]
  /** QA que revisará el proyecto (se elige al enviarlo a QA) */
  qaId?: string
}

export interface WsBugDraft {
  name: string
  severity: BugSeverity
  steps?: string
  /** Capturas o videos del defecto */
  evidence?: { name: string; mimeType: string; dataBase64: string }[]
}

export interface WsSubitemPatch {
  name?: string
  status?: SubitemStatus
  startDate?: string
  dueDate?: string
  hours?: number | null
  assigneeId?: string | null
  /** Solo al crear: prueba del QA o tarea de desarrollo */
  kind?: SubitemKind
  /** Solo al crear: bug que esta tarea ayuda a resolver */
  parentId?: string
  /** Comentario del movimiento (obligatorio al finalizar un bug) */
  comment?: string
  /** Motivo opcional cuando el administrador reabre una subtarea Finalizada */
  reason?: string
}

/** Todas las mutaciones del tablero, con manejo de errores uniforme. */
export function useWsActions() {
  const [createItem] = useMutation(CREATE_WS_ITEM, REFETCH)
  const [updateItem] = useMutation(UPDATE_WS_ITEM, REFETCH)
  const [deleteItem] = useMutation(DELETE_WS_ITEM, REFETCH)
  const [createSubitem] = useMutation(CREATE_WS_SUBITEM, REFETCH)
  const [updateSubitem] = useMutation(UPDATE_WS_SUBITEM, REFETCH)
  const [deleteSubitem] = useMutation(DELETE_WS_SUBITEM, REFETCH)
  const [createGroup] = useMutation(CREATE_WS_GROUP, REFETCH)
  const [updateGroup] = useMutation(UPDATE_WS_GROUP, REFETCH)
  const [deleteGroup] = useMutation(DELETE_WS_GROUP, REFETCH)
  const [reorderGroups] = useMutation(REORDER_WS_GROUPS, REFETCH)
  const [rejectQa] = useMutation(REJECT_WS_ITEM_QA, REFETCH)
  const [reportBug] = useMutation(REPORT_WS_BUG, REFETCH)
  const [approveQa] = useMutation(APPROVE_WS_ITEM_QA, REFETCH)
  const [verifyBug] = useMutation(VERIFY_WS_BUG, REFETCH)
  const [addComment] = useMutation(ADD_WS_SUBITEM_COMMENT, { refetchQueries: ['WsSubitemComments', 'WsItemDetail'] })

  const run = async (p: Promise<unknown>, ok?: string) => {
    try {
      await p
      if (ok) toast.success(ok)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  return {
    addItem: (groupId: string, name: string) => run(createItem({ variables: { groupId, name } })),
    patchItem: (id: string, input: WsItemPatch) => run(updateItem({ variables: { id, input } })),
    removeItem: (id: string) => run(deleteItem({ variables: { id } }), 'Elemento eliminado'),
    rejectQa: (id: string, bugs: WsBugDraft[]) => run(rejectQa({ variables: { id, bugs } }), 'Proyecto devuelto a desarrollo'),
    reportBug: (testId: string, bugs: WsBugDraft[], returnToDev = false) =>
      run(
        reportBug({ variables: { testId, bugs, returnToDev } }),
        returnToDev ? 'Bug reportado: el proyecto volvió a desarrollo' : 'Bug reportado: el proyecto sigue en QA'
      ),
    approveQa: (id: string) => run(approveQa({ variables: { id } }), 'Proyecto aprobado: pasó a Producción'),
    verifyBug: (id: string, ok: boolean, comment?: string) =>
      run(verifyBug({ variables: { id, ok, comment } }), ok ? 'Bug verificado' : 'Bug reabierto: vuelve al programador'),
    addComment: (subitemId: string, body: string) => run(addComment({ variables: { subitemId, body } })),
    addSubitem: (itemId: string, name: string, input?: WsSubitemPatch) =>
      run(createSubitem({ variables: { itemId, name, input } }), 'Subelemento guardado'),
    patchSubitem: (id: string, input: WsSubitemPatch) => run(updateSubitem({ variables: { id, input } })),
    removeSubitem: (id: string) => run(deleteSubitem({ variables: { id } })),
    addGroup: (boardId: string, name: string, color: string) => run(createGroup({ variables: { boardId, name, color } }), 'Grupo creado'),
    patchGroup: (id: string, patch: { name?: string; color?: string }) => run(updateGroup({ variables: { id, ...patch } })),
    removeGroup: (id: string) => run(deleteGroup({ variables: { id } }), 'Grupo eliminado'),
    reorderGroups: (boardId: string, groupIds: string[]) => run(reorderGroups({ variables: { boardId, groupIds } })),
  }
}

export type WsActions = ReturnType<typeof useWsActions>
