/** Claves del catálogo de permisos (Backend/src/permissions.js) */
export type Permission =
  | 'users.manage'
  | 'roles.manage'
  | 'boards.manage'
  | 'projects.viewAll'
  | 'projects.assignOthers'
  | 'projects.changeStage'
  | 'subitems.manageAll'
  | 'files.deleteAny'

export interface UserRole {
  id: string
  name: string
  color: string
  description?: string | null
  system?: boolean
  locked?: boolean
  permissions?: Permission[]
  userCount?: number
}

export interface PermissionInfo {
  key: Permission
  label: string
  description: string
  group: string
}
export type Status = 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'
export type TaskType = 'TASK' | 'BUG'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  permissions: Permission[]
  active: boolean
  avatarColor: string
  createdAt?: string
}

export interface Stats {
  total: number
  backlog: number
  inProgress: number
  review: number
  done: number
  overdue: number
  bugs: number
  completionRate: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Subtask {
  id: string
  title: string
  status: 'PENDING' | 'DONE'
  checklist: ChecklistItem[]
}

export interface Comment {
  id: string
  body: string
  createdAt: string
  user: User
}

export interface Activity {
  id: string
  action: string
  detail: string | null
  createdAt: string
  user: User
  task?: { id: string; title: string; board?: { id: string; name: string } } | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  type: TaskType
  priority: Priority
  labels: string[]
  acceptanceCriteria: string | null
  status: Status
  position: number
  assignee: User | null
  createdBy: User
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  isOverdue: boolean
  progress: number
  subtaskCount: number
  subtaskDone: number
  commentCount: number
  allowedTransitions: Status[]
  board?: { id: string; name: string; project?: { id: string; name: string; color: string } }
  subtasks?: Subtask[]
  comments?: Comment[]
  activity?: Activity[]
}

export interface Column {
  id: string
  name: string
  status: Status
  color: string
}

export interface Board {
  id: string
  name: string
  description: string | null
  createdAt: string
  project: { id: string; name: string; color: string }
  columns: Column[]
  members: User[]
  tasks: Task[]
  stats: Stats
}

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  createdAt: string
  boards: { id: string; name: string; description: string | null; stats: Stats; members: User[] }[]
  members: User[]
  stats: Stats
}

// ---------- Espacio de trabajo ----------
export type SubitemStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE'
/** DEV = tarea de desarrollo; QA = prueba del QA; BUG = defecto reportado por el QA */
export type SubitemKind = 'DEV' | 'QA' | 'BUG'
export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
/** COMMENT = libre; RESOLUTION = cierre de un bug; VERIFIED / REOPENED = verificación del QA */
export type CommentKind = 'COMMENT' | 'RESOLUTION' | 'VERIFIED' | 'REOPENED'

export interface WsSubitemComment {
  id: string
  kind: CommentKind
  body: string
  user: User
  createdAt: string
}

export interface WsBoardSummary {
  id: string
  name: string
  folder: string | null
  itemCount: number
}

export interface WsSubitem {
  id: string
  name: string
  kind: SubitemKind
  status: SubitemStatus
  startDate: string | null
  dueDate: string | null
  hours: number | null
  isOverdue: boolean
  assignee: User | null
  completedAt: string | null
  /** Estados permitidos para el usuario actual según el flujo (los calcula el servidor) */
  allowedStatuses: SubitemStatus[]
  /** Solo bugs */
  severity: BugSeverity | null
  steps: string | null
  reportedBy: User | null
  reopenCount: number
  verifiedAt: string | null
  /** Bug al que pertenece esta tarea de desarrollo */
  parentId: string | null
  /** Prueba de QA en la que se encontró el bug */
  testId: string | null
  /** Solo bugs: imágenes y videos de evidencia */
  evidence: WsFile[]
  commentCount: number
}

export interface WsItem {
  id: string
  name: string
  requesters: string | null
  area: string | null
  dueDate: string | null
  position: number
  progress: number
  totalHours: number
  subitemCount: number
  updateCount: number
  group: { id: string; name: string; color: string }
  /** Etapa de QA del tablero (destino de "Enviar a QA") */
  qaGroup: { id: string; name: string; color: string } | null
  /** Etapa En Desarrollo del tablero (destino de "Regresar a desarrollo") */
  devGroup: { id: string; name: string; color: string } | null
  /** QA que revisa el proyecto */
  qa: User | null
  /** Programador que lo envió a QA (recibe las correcciones) */
  developer: User | null
  assignees: User[]
  subitems: WsSubitem[]
  files: WsFile[]
}

export interface WsFile {
  id: string
  name: string
  mimeType: string
  size: number
  createdAt: string
  uploadedBy: User
}

export interface WsGroup {
  id: string
  name: string
  color: string
  position: number
  items: WsItem[]
}

export interface WsBoard {
  id: string
  name: string
  folder: string | null
  description: string | null
  groups: WsGroup[]
}
