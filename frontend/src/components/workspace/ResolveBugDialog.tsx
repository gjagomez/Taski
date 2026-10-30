import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

/** Cerrar un bug exige el comentario de resolución (causa y qué se corrigió): queda en la tarea para el QA. */
export function ResolveBugDialog({
  bugName,
  open,
  onOpenChange,
  onConfirm,
}: {
  bugName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (comment: string) => Promise<unknown> | void
}) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    if (!comment.trim()) return
    setSaving(true)
    await onConfirm(comment.trim())
    setSaving(false)
    setComment('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Cerrar bug</DialogTitle>
          <DialogDescription>
            «{bugName}» pasará a Finalizado y el QA lo verificará. Explica la causa y qué corregiste: queda en la tarea como resolución.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={5}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ej. Causa: no se validaba el signo del monto en el backend. Corrección: validación en PagoService y prueba unitaria."
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="rounded-full" disabled={saving || !comment.trim()} onClick={confirm}>
            {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Cerrar bug
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
