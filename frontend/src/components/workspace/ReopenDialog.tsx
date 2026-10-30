import { useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

/** El administrador reabre una subtarea Finalizada; el motivo es opcional y queda en la bitácora. */
export function ReopenDialog({
  taskName,
  open,
  onOpenChange,
  onConfirm,
}: {
  taskName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<unknown> | void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    setSaving(true)
    await onConfirm(reason.trim())
    setSaving(false)
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-600">
            <RotateCcw className="size-6" />
          </div>
          <DialogTitle className="text-xl">Reabrir subtarea</DialogTitle>
          <DialogDescription>
            «{taskName}» volverá a "En progreso". Si encontraste defectos, descríbelos: quedarán en la bitácora y en las actualizaciones del proyecto.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional). Ej. Al guardar sin datos no muestra validación…"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" disabled={saving} onClick={confirm}>
            {saving ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reabrir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
