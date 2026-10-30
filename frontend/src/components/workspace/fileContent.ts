import type { ApolloClient } from '@apollo/client'
import { WS_FILE_CONTENT } from '@/lib/graphql'

export interface LoadedFile {
  name: string
  mimeType: string
  bytes: Uint8Array
  url: string
}

/** Descarga el contenido de un archivo (base64 por GraphQL) y crea una URL local para verlo. */
export async function loadFile(client: ApolloClient, id: string): Promise<LoadedFile | null> {
  const { data } = await client.query<{ wsFileContent: { name: string; mimeType: string; dataBase64: string } | null }>({
    query: WS_FILE_CONTENT,
    variables: { id },
    fetchPolicy: 'no-cache',
  })
  const content = data?.wsFileContent
  if (!content) return null
  const bytes = Uint8Array.from(atob(content.dataBase64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: content.mimeType }))
  return { name: content.name, mimeType: content.mimeType, bytes, url }
}

export function saveFile(file: LoadedFile) {
  const a = document.createElement('a')
  a.href = file.url
  a.download = file.name
  a.click()
}

export const formatSize = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

export type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'docx' | 'csv' | 'text' | 'none'

const TEXT_EXT = ['txt', 'md', 'log', 'json', 'xml', 'sql', 'html', 'css', 'js', 'ts', 'py', 'java', 'cs', 'yml', 'yaml', 'ini']

export function previewKind(name: string, mimeType: string): PreviewKind {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) return 'video'
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext)) return 'audio'
  if (ext === 'docx') return 'docx'
  if (ext === 'csv') return 'csv'
  if (TEXT_EXT.includes(ext) || mimeType.startsWith('text/')) return 'text'
  return 'none'
}
