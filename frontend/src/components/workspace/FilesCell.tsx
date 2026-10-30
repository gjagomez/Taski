import { useRef, useState, type DragEvent } from 'react'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { Download, Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DELETE_WS_FILE, UPLOAD_WS_FILE } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { fromNow } from '@/lib/format'
import type { WsFile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FileIcon } from './FileIcon'
import { FilesDrawer } from './FilesDrawer'
import { formatSize, loadFile, saveFile } from './fileContent'

const MAX_BYTES = 15 * 1024 * 1024
const BLOCKED = ['exe', 'bat', 'cmd', 'com', 'msi', 'ps1', 'sh', 'vbs', 'scr', 'jar']
const REFETCH = { refetchQueries: ['WsBoard', 'WsItemDetail'] }

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Columna "Archivos" del elemento: íconos por tipo, subir (clic o arrastrar), descargar y eliminar. */
export function FilesCell({ itemId, files }: { itemId: string; files: WsFile[] }) {
  const { user, can } = useAuth()
  const client = useApolloClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [viewing, setViewing] = useState<string | null>(null)
  const canDelete = (f: WsFile) => can('files.deleteAny') || user?.id === f.uploadedBy.id
  const [upload] = useMutation(UPLOAD_WS_FILE, REFETCH)
  const [remove] = useMutation(DELETE_WS_FILE, REFETCH)

  async function uploadFiles(list: FileList | File[]) {
    const items = Array.from(list)
    for (const file of items) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (BLOCKED.includes(ext)) {
        toast.error(`Por seguridad no se permiten archivos .${ext}`)
        continue
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" supera el máximo de 15 MB`)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const dataBase64 = await readBase64(file)
        await upload({ variables: { itemId, name: file.name, mimeType: file.type || null, dataBase64 } })
        toast.success(`"${file.name}" subido`)
      } catch (err) {
        toast.error(errorMessage(err))
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function download(file: WsFile) {
    try {
      const loaded = await loadFile(client, file.id)
      if (!loaded) return toast.error('El archivo ya no existe')
      saveFile(loaded)
      setTimeout(() => URL.revokeObjectURL(loaded.url), 60_000)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  function view(file: WsFile) {
    setOpen(false)
    setViewing(file.id)
  }

  async function deleteFile(file: WsFile) {
    if (!confirm(`¿Eliminar "${file.name}"?`)) return
    try {
      await remove({ variables: { id: file.id } })
      toast.success('Archivo eliminado')
      if (viewing === file.id) setViewing(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
    },
  }

  return (
    <div {...dropProps} className={cn('group/files relative flex h-full w-full items-center justify-center gap-1 px-1', dragging && 'bg-primary/10 ring-2 ring-primary ring-inset')}>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {files.slice(0, 3).map((f) => (
        <Tooltip key={f.id}>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => view(f)} className="rounded transition hover:-translate-y-0.5" aria-label={`Ver ${f.name}`}>
              <FileIcon name={f.name} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {f.name} · {formatSize(f.size)}
          </TooltipContent>
        </Tooltip>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {files.length > 3 ? (
            <button type="button" className="rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary">
              +{files.length - 3}
            </button>
          ) : (
            <button
              type="button"
              aria-label="Archivos"
              className={cn(
                'grid size-6 place-items-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-primary',
                files.length > 0 && 'opacity-0 group-hover/files:opacity-100'
              )}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : files.length ? <Paperclip className="size-4" /> : <Upload className="size-4 opacity-50" />}
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="center">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">Archivos de evidencia</p>
            <span className="text-xs text-muted-foreground">{files.length}</span>
          </div>
          <div className="scrollbar-thin max-h-64 overflow-y-auto p-1.5">
            {files.map((f) => (
              <div key={f.id} className="group/file flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                <FileIcon name={f.name} className="h-9 w-7" />
                <button type="button" onClick={() => view(f)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium hover:text-primary">{f.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatSize(f.size)} · {f.uploadedBy.name.split(' ')[0]} · {fromNow(f.createdAt)}
                  </span>
                </button>
                <button type="button" onClick={() => download(f)} className="rounded p-1 text-muted-foreground hover:text-primary" aria-label="Descargar">
                  <Download className="size-4" />
                </button>
                {canDelete(f) && (
                  <button type="button" onClick={() => deleteFile(f)} className="rounded p-1 text-muted-foreground opacity-0 group-hover/file:opacity-100 hover:text-destructive" aria-label="Eliminar">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {files.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Aún no hay archivos.</p>}
          </div>
          <div className="p-2 pt-0">
            <button
              type="button"
              {...dropProps}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-primary/25 px-3 py-4 text-center transition hover:border-primary hover:bg-primary/5',
                dragging && 'border-primary bg-primary/10'
              )}
            >
              {uploading ? <Loader2 className="size-5 animate-spin text-primary" /> : <Upload className="size-5 text-primary" />}
              <span className="text-sm font-medium">Subir archivos</span>
              <span className="text-[11px] text-muted-foreground">Arrastra aquí o haz clic · PDF, Word, Excel, imágenes… (máx. 15 MB)</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <FilesDrawer
        files={files}
        fileId={viewing}
        itemId={itemId}
        onSelect={setViewing}
        onClose={() => setViewing(null)}
        canDelete={canDelete}
        onDelete={deleteFile}
      />
    </div>
  )
}
