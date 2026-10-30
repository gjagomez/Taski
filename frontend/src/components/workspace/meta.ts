import type { BugSeverity, SubitemStatus } from '@/lib/types'

export const DEFAULT_STAGES = [
  { name: 'En Desarrollo', color: '#fdab3d' },
  { name: 'En QA & Seguridad', color: '#579bfc' },
  { name: 'En Producción', color: '#00c875' },
  { name: 'Detenido', color: '#e2445c' },
  { name: 'En Espera', color: '#a25ddc' },
  { name: 'En Análisis', color: '#ff7a45' },
]

export const GROUP_COLORS = ['#fdab3d', '#579bfc', '#00c875', '#e2445c', '#a25ddc', '#ff7a45', '#037f4c', '#ff158a', '#784bd1', '#808080']

// Estados de las subtareas: Por hacer → En progreso → Finalizado
export const SUBITEM_STATUS: Record<SubitemStatus, { label: string; color: string }> = {
  DONE: { label: 'Finalizado', color: '#00c875' },
  IN_PROGRESS: { label: 'En progreso', color: '#fdab3d' },
  PENDING: { label: 'Por hacer', color: '#c4c4c4' },
}

/** Gravedad de los bugs que reporta el QA (de mayor a menor). */
export const BUG_SEVERITY: Record<BugSeverity, { label: string; color: string }> = {
  CRITICAL: { label: 'Crítica', color: '#b91c1c' },
  HIGH: { label: 'Alta', color: '#ea580c' },
  MEDIUM: { label: 'Media', color: '#ca8a04' },
  LOW: { label: 'Baja', color: '#64748b' },
}
export const BUG_SEVERITY_ORDER: BugSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

/** Orden para leyendas y barras (de terminado a por hacer). */
export const SUBITEM_STATUS_ORDER: SubitemStatus[] = ['DONE', 'IN_PROGRESS', 'PENDING']

/** Columnas del Kanban por proyecto, en el orden del flujo. */
export const KANBAN_COLUMNS: SubitemStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE']

/** Mensaje para explicar por qué no se permite un movimiento (el servidor tiene la última palabra). */
export function transitionHint(from: SubitemStatus, to: SubitemStatus, hasAssignee: boolean) {
  if (from === 'DONE') return 'La subtarea está Finalizada: solo un administrador puede reabrirla.'
  if (from === 'PENDING' && to === 'IN_PROGRESS' && !hasAssignee) return 'Asigna un programador antes de iniciar la tarea.'
  return `No se puede pasar de "${SUBITEM_STATUS[from].label}" a "${SUBITEM_STATUS[to].label}".`
}

export const HOURS_PER_DAY = 8

/** Días hábiles (lunes a viernes) entre dos fechas, inclusive. Igual al cálculo del servidor. */
export function workingDays(start: string | null, end: string | null) {
  if (!start || !end || end < start) return null
  const day = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  let days = 0
  while (day <= last) {
    const weekday = day.getDay()
    if (weekday !== 0 && weekday !== 6) days++
    day.setDate(day.getDate() + 1)
  }
  return days
}

export const workingHours = (start: string | null, end: string | null) => {
  const days = workingDays(start, end)
  return days === null ? null : days * HOURS_PER_DAY
}

const plainText = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** El programador puede enviar a QA un proyecto "En Desarrollo" (misma regla que el servidor). */
export const isDevelopmentStage = (stageName: string) => plainText(stageName).includes('desarrollo')

/** Etapa de revisión QA ("En QA & Seguridad"), misma regla que el servidor. */
export const isQaStage = (stageName: string) => /(^|[^a-z])qa([^a-z]|$)/.test(plainText(stageName))
