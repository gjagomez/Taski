import { useEffect, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileWarning, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { errorMessage } from '@/lib/apollo'
import { fmtDateTime } from '@/lib/format'
import type { WsFile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FileIcon, fileKind } from './FileIcon'
import { DocAiPanel } from '@/components/ai/DocAiPanel'
import { formatSize, loadFile, previewKind, saveFile, type LoadedFile } from './fileContent'

/** Panel lateral grande para ver los archivos de evidencia de un elemento. */
export function FilesDrawer({
  files,
  fileId,
  itemId,
  onSelect,
  onClose,
  canDelete,
  onDelete,
}: {
  files: WsFile[]
  fileId: string | null
  itemId: string
  onSelect: (id: string) => void
  onClose: () => void
  canDelete: (f: WsFile) => boolean
  onDelete: (f: WsFile) => void
}) {
  const client = useApolloClient()
  const cache = useRef(new Map<string, LoadedFile>())
  const [loaded, setLoaded] = useState<LoadedFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const index = files.findIndex((f) => f.id === fileId)
  const current = index >= 0 ? files[index]! : null

  // Carga (o toma de caché) el archivo seleccionado
  useEffect(() => {
    if (!fileId) return
    const cached = cache.current.get(fileId)
    if (cached) return setLoaded(cached)
    let cancelled = false
    setLoaded(null)
    setLoading(true)
    loadFile(client, fileId)
      .then((f) => {
        if (!f) return toast.error('El archivo ya no existe')
        cache.current.set(fileId, f)
        if (!cancelled) setLoaded(f)
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [fileId, client])

  // Libera las URLs locales al desmontar
  useEffect(() => {
    const map = cache.current
    return () => map.forEach((f) => URL.revokeObjectURL(f.url))
  }, [])

  // Navegación con flechas del teclado
  useEffect(() => {
    if (!fileId) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (e.key === 'ArrowRight' && index < files.length - 1) onSelect(files[index + 1]!.id)
      if (e.key === 'ArrowLeft' && index > 0) onSelect(files[index - 1]!.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fileId, index, files, onSelect])

  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(
          'gap-0 p-0 transition-[max-width] data-[side=right]:w-full',
          aiOpen ? 'data-[side=right]:sm:max-w-[min(1480px,96vw)]' : 'data-[side=right]:sm:max-w-[min(1100px,92vw)]'
        )}
      >
        {current && (
          <div className="flex h-full flex-col">
            {/* Encabezado */}
            <div className="flex items-center gap-3 border-b px-5 py-3.5 pr-14">
              <FileIcon name={current.name} className="h-10 w-8" />
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base">{current.name}</SheetTitle>
                <SheetDescription className="truncate text-xs">
                  {fileKind(current.name).label} · {formatSize(current.size)} · Subido por {current.uploadedBy.name} · {fmtDateTime(current.createdAt)}
                </SheetDescription>
              </div>
              <Button
                size="sm"
                variant={aiOpen ? 'secondary' : 'default'}
                className={cn('rounded-full', !aiOpen && 'bg-gradient-to-r from-[#8b7cf8] to-[#5a47e8] shadow-md shadow-primary/30')}
                onClick={() => setAiOpen((o) => !o)}
              >
                <Sparkles /> {aiOpen ? 'Ocultar IA' : 'Analizar con IA'}
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" disabled={!loaded} onClick={() => loaded && window.open(loaded.url, '_blank', 'noopener')}>
                <ExternalLink /> Pestaña nueva
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" disabled={!loaded} onClick={() => loaded && saveFile(loaded)}>
                <Download /> Descargar
              </Button>
              {canDelete(current) && (
                <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => onDelete(current)} aria-label="Eliminar archivo">
                  <Trash2 />
                </Button>
              )}
            </div>

            <div className="flex min-h-0 flex-1">
            {/* Vista previa */}
            <div className="relative min-h-0 min-w-0 flex-1 bg-slate-100">
              {loading || !loaded ? (
                <div className="grid h-full place-items-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : (
                <Preview file={loaded} />
              )}
              {index > 0 && (
                <button
                  onClick={() => onSelect(files[index - 1]!.id)}
                  className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg hover:bg-white"
                  aria-label="Archivo anterior"
                >
                  <ChevronLeft />
                </button>
              )}
              {index < files.length - 1 && (
                <button
                  onClick={() => onSelect(files[index + 1]!.id)}
                  className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg hover:bg-white"
                  aria-label="Archivo siguiente"
                >
                  <ChevronRight />
                </button>
              )}
            </div>
            {aiOpen && (
              <aside className="w-[400px] shrink-0 border-l bg-white">
                <DocAiPanel key={current.id} fileId={current.id} itemId={itemId} />
              </aside>
            )}
            </div>

            {/* Miniaturas */}
            {files.length > 1 && (
              <div className="scrollbar-thin flex gap-2 overflow-x-auto border-t bg-white px-4 py-3">
                {files.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onSelect(f.id)}
                    className={cn(
                      'flex w-36 shrink-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition hover:border-primary/50',
                      f.id === current.id && 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    )}
                  >
                    <FileIcon name={f.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{f.name}</span>
                      <span className="block text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Preview({ file }: { file: LoadedFile }) {
  const kind = previewKind(file.name, file.mimeType)

  if (kind === 'pdf') return <iframe src={file.url} title={file.name} className="h-full w-full border-0" />
  if (kind === 'image')
    return (
      <div className="grid h-full place-items-center overflow-auto p-6">
        <img src={file.url} alt={file.name} className="max-h-full max-w-full rounded-lg bg-white object-contain shadow-xl" />
      </div>
    )
  if (kind === 'video')
    return (
      <div className="grid h-full place-items-center p-6">
        <video src={file.url} controls className="max-h-full max-w-full rounded-lg shadow-xl" />
      </div>
    )
  if (kind === 'audio')
    return (
      <div className="grid h-full place-items-center">
        <audio src={file.url} controls />
      </div>
    )
  if (kind === 'docx') return <DocxPreview file={file} />
  if (kind === 'csv') return <CsvPreview file={file} />
  if (kind === 'text')
    return (
      <div className="h-full overflow-auto p-6">
        <pre className="min-h-full rounded-xl bg-white p-6 font-mono text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm">
          {new TextDecoder().decode(file.bytes)}
        </pre>
      </div>
    )
  return <NoPreview file={file} />
}

function NoPreview({ file, reason }: { file: LoadedFile; reason?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <FileIcon name={file.name} className="h-32 w-24" />
      <div>
        <p className="font-semibold">{file.name}</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <FileWarning className="size-4" /> {reason ?? 'El navegador no puede mostrar este tipo de archivo.'}
        </p>
      </div>
      <Button className="rounded-full" onClick={() => saveFile(file)}>
        <Download /> Descargar para abrirlo
      </Button>
    </div>
  )
}

/** Word (.docx) convertido a HTML en el navegador con mammoth (se carga solo cuando se necesita). */
function DocxPreview({ file }: { file: LoadedFile }) {
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    import('mammoth')
      .then((mammoth) => mammoth.convertToHtml({ arrayBuffer: file.bytes.slice().buffer }))
      // mammoth escapa el texto; además se neutralizan enlaces "javascript:" que pudiera traer el documento
      .then((r) => !cancelled && setHtml(r.value.replace(/href\s*=\s*"\s*javascript:[^"]*"/gi, 'href="#"')))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [file])

  if (failed) return <NoPreview file={file} reason="No se pudo leer el documento de Word." />
  if (html === null)
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  return (
    <div className="h-full overflow-auto px-4 py-8">
      <article
        className="mx-auto min-h-full max-w-3xl rounded-sm bg-white px-14 py-12 text-[15px] leading-relaxed shadow-xl [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_img]:max-w-full [&_li]:ml-6 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:my-4 [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: html || '<p><em>Documento vacío</em></p>' }}
      />
    </div>
  )
}

function CsvPreview({ file }: { file: LoadedFile }) {
  const text = new TextDecoder().decode(file.bytes)
  const sep = (text.split('\n')[0]?.match(/;/g)?.length ?? 0) > (text.split('\n')[0]?.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 500)
    .map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, '')))
  const [head, ...body] = rows
  return (
    <div className="h-full overflow-auto p-6">
      <table className="w-full overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead className="bg-muted/60">
          <tr>{head?.map((h, i) => <th key={i} className="border-b px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((c, j) => <td key={j} className="px-3 py-1.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
