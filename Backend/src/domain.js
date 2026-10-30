import { can } from './permissions.js';
import { GraphQLError } from 'graphql';

// ---------- Errores ----------
export function fail(message, code = 'BAD_USER_INPUT') {
  throw new GraphQLError(message, { extensions: { code } });
}

// ---------- Validaciones ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function required(fields) {
  for (const [label, value] of Object.entries(fields)) {
    if (value === undefined || value === null || String(value).trim() === '') {
      fail(`El campo "${label}" es obligatorio`);
    }
  }
}

export function validateEmail(email) {
  if (!EMAIL_RE.test(String(email).trim())) fail('El formato del correo no es válido');
}

export function passwordProblems(password) {
  const problems = [];
  if (password.length < 8) problems.push('mínimo 8 caracteres');
  if (!/[A-Z]/.test(password)) problems.push('una mayúscula');
  if (!/[a-z]/.test(password)) problems.push('una minúscula');
  if (!/\d/.test(password)) problems.push('un número');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('un carácter especial');
  return problems;
}

export function validatePassword(password) {
  const problems = passwordProblems(password || '');
  if (problems.length) fail(`La contraseña debe tener: ${problems.join(', ')}`);
}

// ---------- Flujo de trabajo (ciclo de vida de una tarea) ----------
export const STATUSES = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export const DEFAULT_COLUMNS = [
  { name: 'Por hacer', status: 'BACKLOG', color: '#a3a1fb' },
  { name: 'En progreso', status: 'IN_PROGRESS', color: '#fdab3d' },
  { name: 'En revisión / QA', status: 'REVIEW', color: '#579bfc' },
  { name: 'Completado', status: 'DONE', color: '#00c875' },
];

export const STATUS_LABEL = Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.status, c.name]));

export const TRANSITIONS = {
  BACKLOG: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW'],
  REVIEW: ['DONE', 'IN_PROGRESS'],
  DONE: [],
};

/**
 * Valida una transición de estado. Devuelve un mensaje de error o null.
 * La regla vive en el servidor: la UI solo la refleja.
 */
export function transitionError({ task, from, to, subtasks, user }) {
  if (from === to) return null;
  if (from === 'DONE') return 'La tarea está Completada: es un estado final y no puede moverse.';
  if (!TRANSITIONS[from].includes(to)) {
    return `Transición no permitida: "${STATUS_LABEL[from]}" → "${STATUS_LABEL[to]}". Permitidas: ${
      TRANSITIONS[from].map((s) => `"${STATUS_LABEL[s]}"`).join(', ') || 'ninguna'
    }.`;
  }
  if (from === 'BACKLOG' && to === 'IN_PROGRESS' && !task.assignee_id) {
    return 'Para pasar a "En progreso" la tarea debe tener un responsable asignado.';
  }
  if (from === 'IN_PROGRESS' && to === 'REVIEW') {
    if (!can(user, 'subitems.manageAll') && task.assignee_id !== user.id) {
      return 'Solo el responsable de la tarea puede marcar el avance completo y enviarla a revisión.';
    }
    const pending = subtasks.filter((s) => s.status !== 'DONE');
    if (pending.length) {
      return `Hay ${pending.length} subtarea(s) pendiente(s). Complétalas antes de enviar a revisión.`;
    }
  }
  return null;
}

export function allowedTransitions(task, status, subtasks, user) {
  return TRANSITIONS[status].filter((to) => !transitionError({ task, from: status, to, subtasks, user }));
}
