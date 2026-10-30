// Imágenes para adjuntar en las actualizaciones: desde archivo, arrastrar y soltar o el portapapeles
// (capturas de pantalla, imágenes copiadas de un correo o de una página web).

export interface PendingImage {
  key: string
  name: string
  mimeType: string
  dataBase64: string
  previewUrl: string
  size: number
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_SIDE = 1920
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024
export const MAX_IMAGES = 10

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** Reduce imágenes muy grandes (máx. 1920 px de lado) para que la actualización cargue rápido. GIF se deja igual (animación). */
async function shrink(file: Blob): Promise<Blob> {
  if (file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('No se pudo leer la imagen: el archivo está dañado o no es una imagen.')
  })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= KEEP_AS_IS_BYTES) {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Las capturas (PNG) conservan nitidez; las fotos se guardan como JPEG
  const type = file.type === 'image/png' && file.size <= 4 * KEEP_AS_IS_BYTES ? 'image/png' : 'image/jpeg'
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), type, 0.85))
}

let counter = 0
const extOf = (type: string) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' })[type] ?? 'png'

export async function prepareImage(file: Blob, name?: string): Promise<PendingImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error(`Formato no permitido (${file.type || 'desconocido'}). Usa PNG, JPEG, GIF o WebP.`)
  const blob = await shrink(file)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const base = (name || (file instanceof File ? file.name : '') || `imagen-pegada-${stamp}`).replace(/\.[^.]*$/, '')
  return {
    key: `img-${Date.now()}-${counter++}`,
    name: `${base}.${extOf(blob.type)}`,
    mimeType: blob.type,
    dataBase64: await blobToBase64(blob),
    previewUrl: URL.createObjectURL(blob),
    size: blob.size,
  }
}

/** Imágenes de un `<img>` copiado de un correo o una web: data: URIs y, si el servidor lo permite, URLs http(s). */
async function imagesFromHtml(html: string): Promise<{ blobs: Blob[]; failed: number }> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const sources = [...doc.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '').filter(Boolean)
  const blobs: Blob[] = []
  let failed = 0
  for (const src of sources.slice(0, MAX_IMAGES)) {
    try {
      if (!/^(data:image\/|https?:)/i.test(src)) throw new Error('origen no accesible') // p. ej. cid: de Outlook
      const res = await fetch(src)
      const blob = await res.blob()
      if (!ACCEPTED.includes(blob.type)) throw new Error('no es imagen')
      blobs.push(blob)
    } catch {
      failed++
    }
  }
  return { blobs, failed }
}

/**
 * Lee las imágenes del portapapeles. Devuelve también si el pegado traía texto (para no bloquearlo)
 * y cuántas imágenes del HTML no se pudieron descargar.
 */
export async function imagesFromClipboard(data: DataTransfer): Promise<{ blobs: Blob[]; hasText: boolean; failed: number }> {
  const files = [...data.files].filter((f) => f.type.startsWith('image/'))
  const hasText = !!data.getData('text/plain').trim()
  if (files.length) return { blobs: files, hasText, failed: 0 }
  const html = data.getData('text/html')
  if (html && /<img/i.test(html)) return { ...(await imagesFromHtml(html)), hasText }
  return { blobs: [], hasText, failed: 0 }
}

export const fmtSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)
