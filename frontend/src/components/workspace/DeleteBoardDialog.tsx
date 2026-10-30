import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client/react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DELETE_WS_BOARD } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'

/** Confirmación para eliminar un tablero. Solo se permite si no tiene elementos. */
export function DeleteBoardDialog({
  board,
  onOpenChange,
}: {
  board: { id: string; name: string; itemCount: number } | null
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [remove, { loading }] = useMutation(DELETE_WS_BOARD, { refetchQueries: ['WsBoards', 'WsFolders', 'WsDashboard'] })
  const empty = board?.itemCount === 0

  async function confirm() {
    if (!board) return
    try {
      await remove({ variables: { id: board.id } })
      toast.success(`Tablero "${board.name}" eliminado`)
      onOpenChange(false)
      if (pathname === `/proyectos/${board.id}`) navigate('/proyectos')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={!!board} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <div className={`mb-2 grid size-12 place-items-center rounded-2xl ${empty ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
            {empty ? <Trash2 className="size-6" /> : <AlertTriangle className="size-6" />}
          </div>
          <DialogTitle className="text-xl">{empty ? `¿Eliminar "${board?.name}"?` : 'El tablero no está vacío'}</DialogTitle>
          <DialogDescription>
            {empty
              ? 'El tablero no tiene elementos. Se eliminarán también sus grupos (etapas). Esta acción no se puede deshacer.'
              : `"${board?.name}" tiene ${board?.itemCount} elemento(s). Para eliminarlo primero elimina o mueve sus elementos; así no se pierden proyectos, subtareas ni archivos de evidencia.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {empty ? 'Cancelar' : 'Entendido'}
          </Button>
          {empty && (
            <Button variant="destructive" className="rounded-full" disabled={loading} onClick={confirm}>
              {loading ? <Loader2 className="animate-spin" /> : <Trash2 />} Eliminar tablero
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
