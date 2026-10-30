import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Priority, Status } from './types'

export const STATUS_META: Record<Status, { label: string; color: string; soft: string }> = {
  BACKLOG: { label: 'Por hacer', color: '#8b80f9', soft: 'bg-violet-100 text-violet-700' },
  IN_PROGRESS: { label: 'En progreso', color: '#f59e0b', soft: 'bg-amber-100 text-amber-700' },
  REVIEW: { label: 'En revisión / QA', color: '#3b82f6', soft: 'bg-sky-100 text-sky-700' },
  DONE: { label: 'Completado', color: '#10b981', soft: 'bg-emerald-100 text-emerald-700' },
}

export const STATUS_ORDER: Status[] = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE']

export const PRIORITY_META: Record<Priority, { label: string; className: string; dot: string }> = {
  HIGH: { label: 'Alta', className: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  MEDIUM: { label: 'Media', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  LOW: { label: 'Baja', className: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
}

/** MySQL devuelve "YYYY-MM-DD HH:MM:SS"; lo convertimos a fecha local. */
export function toDate(value: string) {
  return parseISO(value.includes(' ') ? value.replace(' ', 'T') : value)
}

export const fmtDate = (v?: string | null, pattern = "d MMM yyyy") => (v ? format(toDate(v), pattern, { locale: es }) : '—')
export const fmtDateTime = (v?: string | null) => (v ? format(toDate(v), "d MMM yyyy, HH:mm", { locale: es }) : '—')
export const fromNow = (v: string) => formatDistanceToNow(toDate(v), { addSuffix: true, locale: es })

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

export function passwordChecks(password: string) {
  return [
    { label: '8+ caracteres', ok: password.length >= 8 },
    { label: 'Mayúscula', ok: /[A-Z]/.test(password) },
    { label: 'Minúscula', ok: /[a-z]/.test(password) },
    { label: 'Número', ok: /\d/.test(password) },
    { label: 'Carácter especial', ok: /[^A-Za-z0-9]/.test(password) },
  ]
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export const ACTION_LABEL: Record<string, string> = {
  CREATED: 'Creación',
  ASSIGNED: 'Asignación',
  MOVED: 'Cambio de estado',
  COMPLETED: 'Cierre',
  REJECTED: 'Rechazo QA',
  UPDATED: 'Edición',
  COMMENTED: 'Comentario',
  SUBTASK_ADDED: 'Subtarea',
  SUBTASK_DONE: 'Subtarea',
  SUBTASK_REOPENED: 'Subtarea',
  SUBTASK_DELETED: 'Subtarea',
  BOARD_CREATED: 'Tablero',
  DELETED: 'Eliminación',
}

/** Pone en minúscula la primera letra para continuar una frase ("Ana movió…"), sin romper siglas como "QA". */
export const lowerFirst = (text: string) => (/^\p{Lu}\p{Ll}/u.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text)
