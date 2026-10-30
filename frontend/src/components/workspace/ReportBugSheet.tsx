import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { ImagePlus, Loader2, Paperclip, PlayCircle, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { DELETE_WS_FILE } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { fmtSize, imagesFromClipboard, prepareImage } from '@/lib/images'
import type { BugSeverity, User, WsFile, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FileIcon } from './FileIcon'
import { FilesDrawer } from './FilesDrawer'
import { BUG_SEVERITY, BUG_SEVERITY_ORDER, isQaStage } from './meta'
import { useWsActions } from './useWsActions'

// Mismos límites que el servidor (validEvidence en workspace.js)
const MAX_FILES = 5
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_TOTAL_BYTES = 30 * 1024 * 1024
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

interface PendingEvidence {
  key: string
  name: string
  mimeType: string
  dataBase64: string
  previewUrl: string
  size: number
  video: boolean
}

let counter = 0

const readBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

/** Las imágenes se reducen (máx. 1920 px); los videos se suben tal cual, hasta 15 MB. */
async function prepareEvidence(file: File | Blob): Promise<PendingEvidence> {
  if (IMAGE_TYPES.includes(file.type)) {
    const img = await prepareImage(file)
    return { ...img, video: false }
  }
  if (!VIDEO_TYPES.includes(file.type)) throw new Error(`Formato no permitido (${file.type || 'desconocido'}). Usa imágenes PNG, JPEG, GIF o WebP, o videos MP4, MOV o WebM.`)
  if (file.size > MAX_FILE_BYTES) throw new Error(`El video supera el máximo de ${fmtSize(MAX_FILE_BYTES)}. Recórtalo o bájale la calidad.`)
  return {
    key: `ev-${Date.now()}-${counter++}`,
    name: file instanceof File ? file.name : `video-${Date.now()}.mp4`,
    mimeType: file.type,
    dataBase64: await readBase64(file),
    previewUrl: URL.createObjectURL(file),
    size: file.size,
    video: true,
  }
}

/**
 * Quién reporta bugs desde una prueba de QA (misma regla que bugReportError en el servidor): el QA del
 * proyecto, quien tiene la prueba o un administrador, solo con el proyecto en QA.
 */
export function canReportBug(item: { group: { name: string }; qa: User | null }, test: WsSubitem, me: User | null, manageAll: boolean) {
  if (test.kind !== 'QA' || !me || !isQaStage(item.group.name)) return false
  return manageAll || item.qa?.id === me.id || test.assignee?.id === me.id
}

/**
 * Panel lateral para reportar un bug encontrado en una prueba de QA: título, gravedad, descripción con los
 * pasos para reproducirlo y evidencia (imágenes o videos: archivo, arrastrar y soltar o pegar una captura).
 * El bug queda como subtarea del programador; el proyecto sigue en QA hasta que el QA lo devuelve a desarrollo.
 */
export function ReportBugSheet({
  item,
  test,
  onClose,
}: {
  item: { id: string; name: string; developer: User | null; group: { name: string }; subitems: WsSubitem[] }
  test: { id: string; name: string } | null
  onClose: () => void
}) {
  const actions = useWsActions()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [severity, setSeverity] = useState<BugSeverity>('MEDIUM')
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [evidence, setEvidence] = useState<PendingEvidence[]>([])
  const [adding, setAdding] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const total = evidence.reduce((n, e) => n + e.size, 0)

  // Al abrir con otra prueba, el formulario empieza vacío; las vistas previas se liberan al cerrar
  useEffect(() => {
    setName('')
    setSeverity('MEDIUM')
    setSteps('')
    setExpected('')
    setEvidence((list) => {
      list.forEach((e) => URL.revokeObjectURL(e.previewUrl))
      return []
    })
  }, [test?.id])

  async function addFiles(files: (File | Blob)[]) {
    const room = MAX_FILES - evidence.length
    if (room <= 0) return toast.error(`Máximo ${MAX_FILES} archivos de evidencia por bug`)
    if (files.length > room) toast.error(`Solo se agregan ${room} archivo(s): el máximo es ${MAX_FILES}`)
    setAdding((n) => n + 1)
    let size = total
    for (const file of files.slice(0, room)) {
      try {
        const ev = await prepareEvidence(file)
        if (size + ev.size > MAX_TOTAL_BYTES) {
          URL.revokeObjectURL(ev.previewUrl)
          toast.error(`La evidencia no puede superar ${fmtSize(MAX_TOTAL_BYTES)} en total`)
          break
        }
        size += ev.size
        setEvidence((list) => [...list, ev])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo leer el archivo')
      }
    }
    setAdding((n) => n - 1)
  }

  function remove(key: string) {
    setEvidence((list) => {
      const ev = list.find((e) => e.key === key)
      if (ev) URL.revokeObjectURL(ev.previewUrl)
      return list.filter((e) => e.key !== key)
    })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files])
  }

  // Ctrl+V de una captura de pantalla (fuera de los campos de texto, el texto pegado no se bloquea)
  async function onPaste(e: ClipboardEvent) {
    const videos = [...e.clipboardData.files].filter((f) => VIDEO_TYPES.includes(f.type))
    const { blobs, hasText } = await imagesFromClipboard(e.clipboardData)
    if (!blobs.length && !videos.length) return
    if (!hasText) e.preventDefault()
    addFiles([...blobs, ...videos])
  }

  // Bugs ya reportados en esta ronda que el programador todavía no recibe (el proyecto sigue en QA)
  const pendingBugs = item.subitems.filter((s) => s.kind === 'BUG' && s.status !== 'DONE').length

  async function send(returnToDev: boolean) {
    if (!test) return
    if (!name.trim()) return toast.error('Escribe qué falla (título del bug)')
    const description = [steps.trim(), expected.trim() && `Resultado esperado: ${expected.trim()}`].filter(Boolean).join('\n\n')
    setSaving(true)
    const ok = await actions.reportBug(test.id, [
      {
        name: name.trim(),
        severity,
        steps: description || undefined,
        evidence: evidence.map(({ name, mimeType, dataBase64 }) => ({ name, mimeType, dataBase64 })),
      },
    ], returnToDev)
    setSaving(false)
    if (ok) onClose()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    send(false)
  }

  return (
    <Sheet open={!!test} onOpenChange={(o) => !o && !saving && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl" onPaste={onPaste}>
        <SheetHeader className="border-b px-6 py-4 pr-14">
          <SheetTitle className="flex items-center gap-2 text-lg">
            Reportar bug
          </SheetTitle>
          <SheetDescription>
            Encontrado en la prueba <b className="text-foreground">{test?.name}</b> de <b className="text-foreground">{item.name}</b>. Queda como
            subtarea de <b className="text-foreground">{item.developer?.name ?? 'el programador del proyecto'}</b>. El proyecto sigue en QA para que reportes
            los demás bugs; cuando termines, devuélvelo a desarrollo.
            {pendingBugs > 0 && <> Ya reportaste <b className="text-foreground">{pendingBugs}</b> bug(s) en esta revisión.</>}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="bug-name">Qué falla</Label>
              <Input
                id="bug-name"
                autoFocus
                maxLength={200}
                placeholder="Ej.: El login acepta una contraseña vacía"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Gravedad</Label>
              <div className="grid grid-cols-4 gap-2">
                {BUG_SEVERITY_ORDER.map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-sm font-medium transition',
                      severity === sev ? 'border-transparent text-white shadow-sm' : 'bg-white hover:bg-muted/60'
                    )}
                    style={severity === sev ? { background: BUG_SEVERITY[sev].color } : { color: BUG_SEVERITY[sev].color }}
                  >
                    {BUG_SEVERITY[sev].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-steps">Descripción y pasos para reproducir</Label>
              <Textarea
                id="bug-steps"
                rows={6}
                maxLength={8000}
                placeholder={'1. Ir a la pantalla de inicio de sesión\n2. Dejar la contraseña vacía\n3. Presionar "Ingresar"\n\nResultado obtenido: entra al sistema sin validar.'}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bug-expected">Resultado esperado</Label>
              <Textarea
                id="bug-expected"
                rows={2}
                maxLength={2000}
                placeholder='Ej.: Debe mostrar "La contraseña es obligatoria" y no permitir el ingreso.'
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label>Evidencia</Label>
                <span className="text-xs text-muted-foreground">
                  {evidence.length}/{MAX_FILES} · {fmtSize(total || 1)} de {fmtSize(MAX_TOTAL_BYTES)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5',
                  dragging && 'border-primary bg-primary/5'
                )}
              >
                {adding > 0 ? <Loader2 className="size-6 animate-spin text-primary" /> : <ImagePlus className="size-6 text-primary" />}
                <span>
                  <b className="text-foreground">Sube imágenes o videos</b>, arrástralos aquí o pega una captura (Ctrl+V)
                </span>
                <span className="text-xs">PNG, JPEG, GIF, WebP · MP4, MOV, WebM · hasta {fmtSize(MAX_FILE_BYTES)} por archivo</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(',')}
                onChange={(e) => {
                  if (e.target.files?.length) addFiles([...e.target.files])
                  e.target.value = ''
                }}
              />

              {evidence.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
                  {evidence.map((ev) => (
                    <div key={ev.key} className="group relative overflow-hidden rounded-xl border bg-slate-100">
                      {ev.video ? (
                        <video src={ev.previewUrl} controls muted className="aspect-video w-full bg-black object-contain" />
                      ) : (
                        <img src={ev.previewUrl} alt={ev.name} className="aspect-video w-full object-cover" />
                      )}
                      <div className="flex items-center gap-1 bg-white px-2 py-1 text-[11px]">
                        {ev.video ? <PlayCircle className="size-3 shrink-0 text-primary" /> : <Paperclip className="size-3 shrink-0 text-muted-foreground" />}
                        <span className="min-w-0 flex-1 truncate">{ev.name}</span>
                        <span className="shrink-0 text-muted-foreground">{fmtSize(ev.size)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(ev.key)}
                        className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                        aria-label={`Quitar ${ev.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-white px-6 py-4">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="outline" className="rounded-full" disabled={saving || adding > 0} title="Guarda el bug y el proyecto sigue en QA">
              {saving ? <Loader2 className="animate-spin" /> : null} Reportar y seguir probando
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={saving || adding > 0}
              onClick={() => send(true)}
              title="Guarda el bug y devuelve el proyecto al programador con todos los bugs reportados"
            >
              {saving ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reportar y devolver a desarrollo
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Evidencia de un bug: miniaturas que abren el visor (imagen o video) con descarga.
 * `compact`: un solo botón con la cantidad (para las filas de la tabla).
 */
export function BugEvidence({ itemId, files, compact, className }: { itemId: string; files: WsFile[]; compact?: boolean; className?: string }) {
  const { user, can } = useAuth()
  const [viewing, setViewing] = useState<string | null>(null)
  const [remove] = useMutation(DELETE_WS_FILE, { refetchQueries: ['WsBoard', 'WsItemDetail'] })
  if (!files.length) return null
  const canDelete = (f: WsFile) => can('files.deleteAny') || user?.id === f.uploadedBy.id

  async function onDelete(f: WsFile) {
    if (!window.confirm(`¿Eliminar la evidencia "${f.name}"?`)) return
    try {
      await remove({ variables: { id: f.id } })
      setViewing(null)
      toast.success('Evidencia eliminada')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const drawer = (
    <FilesDrawer files={files} fileId={viewing} itemId={itemId} onSelect={setViewing} onClose={() => setViewing(null)} canDelete={canDelete} onDelete={onDelete} />
  )

  if (compact)
    return (
      <>
        <button
          type="button"
          onClick={() => setViewing(files[0]!.id)}
          className={cn('flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10', className)}
          title={`Ver evidencia (${files.length})`}
        >
          <Paperclip className="size-3.5" /> {files.length}
        </button>
        {drawer}
      </>
    )

  return (
    <div className={className}>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">Evidencia ({files.length})</p>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setViewing(f.id)}
            className="flex max-w-48 items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-xs hover:border-primary/50 hover:bg-primary/5"
            title="Ver evidencia"
          >
            {f.mimeType.startsWith('video/') ? <PlayCircle className="size-4 shrink-0 text-primary" /> : <FileIcon name={f.name} className="h-5 w-4" />}
            <span className="truncate">{f.name}</span>
          </button>
        ))}
      </div>
      {drawer}
    </div>
  )
}
