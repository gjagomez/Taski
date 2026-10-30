import { useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { Clock, Download, ImagePlus, Loader2, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/common'
import { ADD_WS_UPDATE, WS_ITEM_UPDATES } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { fromNow, fmtDateTime } from '@/lib/format'
import { MAX_IMAGES, fmtSize, imagesFromClipboard, prepareImage, type PendingImage } from '@/lib/images'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'

interface UpdateImage {
  id: string
  name: string
  mimeType: string
  size: number
  dataBase64: string
}

interface Update {
  id: string
  body: string
  createdAt: string
  user: User
  images: UpdateImage[]
}

/** Actualizaciones (comentarios) de un proyecto, con imágenes: botón, arrastrar y soltar o pegar (Ctrl+V). */
export function Updates({ itemId }: { itemId: string }) {
  const { data } = useQuery<{ wsItem: { id: string; updates: Update[] } | null }>(WS_ITEM_UPDATES, {
    variables: { id: itemId },
    fetchPolicy: 'cache-and-network',
  })
  const updates = data?.wsItem?.updates ?? []
  const [viewing, setViewing] = useState<UpdateImage | null>(null)

  return (
    <div className="space-y-4">
      <Composer itemId={itemId} />
      {updates.map((u) => (
        <div key={u.id} className="rounded-2xl border p-4">
          <div className="flex items-center gap-2">
            <UserAvatar user={u.user} className="size-7" />
            <span className="text-sm font-semibold">{u.user.name}</span>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" title={fmtDateTime(u.createdAt)}>
              <Clock className="size-3" /> {fromNow(u.createdAt)}
            </span>
          </div>
          {u.body && <p className="mt-2 text-sm whitespace-pre-wrap">{u.body}</p>}
          {u.images.length > 0 && (
            <div className={cn('mt-3 grid gap-2', u.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
              {u.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setViewing(img)}
                  className="group overflow-hidden rounded-xl border bg-muted/30 focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none"
                  title={`${img.name} · ${fmtSize(img.size)}`}
                >
                  <img
                    src={`data:${img.mimeType};base64,${img.dataBase64}`}
                    alt={img.name}
                    loading="lazy"
                    className={cn('w-full object-cover transition group-hover:scale-[1.02]', u.images.length === 1 ? 'max-h-80 object-contain' : 'h-28')}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {updates.length === 0 && <p className="text-center text-sm text-muted-foreground">Aún no hay actualizaciones.</p>}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-[min(92vw,1100px)] rounded-3xl p-3 sm:max-w-[min(92vw,1100px)]">
          {viewing && (
            <>
              <DialogTitle className="truncate px-2 pt-1 pr-10 text-sm">{viewing.name}</DialogTitle>
              <img src={`data:${viewing.mimeType};base64,${viewing.dataBase64}`} alt={viewing.name} className="max-h-[78vh] w-full rounded-2xl object-contain" />
              <div className="flex justify-end px-1">
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <a href={`data:${viewing.mimeType};base64,${viewing.dataBase64}`} download={viewing.name}>
                    <Download /> Descargar
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Composer({ itemId }: { itemId: string }) {
  const [body, setBody] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])
  const [preparing, setPreparing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [addUpdate, { loading: sending }] = useMutation(ADD_WS_UPDATE, { refetchQueries: ['WsItemUpdates', 'WsItemDetail', 'WsBoard'] })

  async function addBlobs(blobs: Blob[]) {
    const room = MAX_IMAGES - images.length
    if (room <= 0) return void toast.error(`Máximo ${MAX_IMAGES} imágenes por actualización`)
    if (blobs.length > room) toast.info(`Solo se agregaron ${room} imagen(es): el máximo es ${MAX_IMAGES}`)
    setPreparing(true)
    const ready: PendingImage[] = []
    for (const blob of blobs.slice(0, room)) {
      try {
        ready.push(await prepareImage(blob))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo leer la imagen')
      }
    }
    setImages((list) => [...list, ...ready])
    setPreparing(false)
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    // Se lee el portapapeles en el mismo evento; el texto se pega normal y las imágenes se adjuntan
    const pending = imagesFromClipboard(e.clipboardData)
    const hasFiles = [...e.clipboardData.files].some((f) => f.type.startsWith('image/'))
    if (hasFiles && !e.clipboardData.getData('text/plain').trim()) e.preventDefault()
    pending.then(({ blobs, failed }) => {
      if (blobs.length) addBlobs(blobs)
      if (failed) toast.warning(`${failed} imagen(es) del correo no se pudieron copiar. Guárdalas en tu equipo y adjúntalas con el botón de imagen.`)
    })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
    if (files.length) addBlobs(files)
    else toast.error('Arrastra archivos de imagen (PNG, JPEG, GIF o WebP)')
  }

  function remove(key: string) {
    setImages((list) => {
      const img = list.find((i) => i.key === key)
      if (img) URL.revokeObjectURL(img.previewUrl)
      return list.filter((i) => i.key !== key)
    })
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!body.trim() && !images.length) return
    try {
      await addUpdate({
        variables: { itemId, body, images: images.map(({ name, mimeType, dataBase64 }) => ({ name, mimeType, dataBase64 })) },
      })
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl))
      setBody('')
      setImages([])
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <form
      onSubmit={send}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn('space-y-2 rounded-2xl transition', dragOver && 'bg-primary/5 ring-2 ring-primary/40 ring-offset-4')}
    >
      <Textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onPaste={onPaste}
        placeholder="Escribe una actualización… Puedes pegar (Ctrl+V) o arrastrar imágenes aquí."
      />
      {(images.length > 0 || preparing) && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.key} className="group relative size-20 overflow-hidden rounded-xl border bg-muted/30" title={`${img.name} · ${fmtSize(img.size)}`}>
              <img src={img.previewUrl} alt={img.name} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => remove(img.key)}
                className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-80 hover:opacity-100"
                aria-label={`Quitar ${img.name}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {preparing && (
            <div className="grid size-20 place-items-center rounded-xl border border-dashed text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) addBlobs(files)
          }}
        />
        <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => fileInput.current?.click()}>
          <ImagePlus /> Imagen
        </Button>
        <Button type="submit" size="sm" className="rounded-full" disabled={sending || preparing || (!body.trim() && !images.length)}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />} Actualizar
        </Button>
      </div>
    </form>
  )
}
