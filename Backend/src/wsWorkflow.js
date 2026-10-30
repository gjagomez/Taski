import { can } from './permissions.js';

// Ciclo de vida de las tareas (subelementos) de un proyecto. La regla vive en el servidor:
// el Kanban y los selectores de estado solo la reflejan.

export const SUBITEM_STATUS_LABEL = {
  PENDING: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Finalizado',
};

export const SUBITEM_TRANSITIONS = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE', 'PENDING'],
  DONE: ['IN_PROGRESS'],
};

const plain = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const isDevelopmentStage = (stageName) => plain(stageName).includes('desarrollo');
/** Etapa de revisión del tablero ("En QA & Seguridad"). */
export const isQaStage = (stageName) => /(^|[^a-z])qa([^a-z]|$)/.test(plain(stageName));
/** Etapa a la que pasa el proyecto cuando el QA finaliza todas sus pruebas ("En Producción"). */
export const isProductionStage = (stageName) => plain(stageName).includes('produccion');

const isUser = (id, user) => id != null && Number(id) === Number(user.id);
const isAssignee = (sub, user) => isUser(sub.assignee_id, user);

/**
 * Devuelve el motivo por el que no se permite pasar `sub` de su estado actual a `to`, o null.
 * El acceso al proyecto se valida antes (wsAccess.js): quien lo tiene asignado mueve todas sus subtareas,
 * en cualquier etapa del proyecto.
 * - Por hacer → En progreso: requiere programador asignado.
 * - En progreso → Finalizado: el programador la cierra (la revisión QA es una etapa del proyecto).
 * - Finalizado → En progreso: solo el administrador puede reabrirla.
 * - Las pruebas de QA (kind = 'QA') solo las mueve el QA que las tiene asignadas (o el administrador).
 */
export function subitemTransitionError(sub, to, user) {
  const from = sub.status;
  if (from === to) return null;
  if (sub.kind === 'QA' && !isAssignee(sub, user) && !can(user, 'subitems.manageAll')) {
    return 'Solo el QA asignado (o un administrador) puede mover las pruebas de QA.';
  }
  if (from === 'DONE') {
    if (!can(user, 'subitems.manageAll')) return 'La subtarea está Finalizada. Solo un administrador puede reabrirla.';
    return to === 'IN_PROGRESS' ? null : 'Una subtarea Finalizada solo puede reabrirse a "En progreso".';
  }
  if (!SUBITEM_TRANSITIONS[from]?.includes(to)) {
    const allowed = SUBITEM_TRANSITIONS[from].map((s) => `"${SUBITEM_STATUS_LABEL[s]}"`).join(' o ');
    return `Transición no permitida: "${SUBITEM_STATUS_LABEL[from]}" → "${SUBITEM_STATUS_LABEL[to]}". Desde aquí solo puede pasar a ${allowed}.`;
  }
  if (from === 'PENDING' && to === 'IN_PROGRESS' && !sub.assignee_id) {
    return 'Para pasar a "En progreso" la tarea debe tener un programador asignado.';
  }
  return null;
}

/** Estados a los que el usuario puede mover la tarea ahora mismo (para la interfaz). */
export function allowedSubitemStatuses(sub, user) {
  return SUBITEM_TRANSITIONS[sub.status].filter((to) => !subitemTransitionError(sub, to, user));
}

/**
 * Cambio de etapa del proyecto. El administrador lo mueve a cualquier etapa; el programador (con acceso al
 * proyecto) solo puede enviarlo de "En Desarrollo" a QA, y únicamente con todas sus subtareas Finalizadas.
 * También puede regresarlo de QA a "En Desarrollo" si está en la Asignación del proyecto y el QA aún no
 * empezó a probar (`withdraw` = { member, qaTesting }); si ya está probando, lo devuelve el QA.
 */
export function projectStageError(user, fromStage, toStage, openSubitems, withdraw = {}) {
  if (can(user, 'projects.changeStage')) return null;
  if (isQaStage(fromStage) && isDevelopmentStage(toStage) && withdraw.member) {
    return withdraw.qaTesting ? 'El QA ya está probando el proyecto: pídele que lo devuelva a desarrollo.' : null;
  }
  if (!isDevelopmentStage(fromStage) || !isQaStage(toStage)) {
    return 'Solo un administrador puede cambiar la etapa del proyecto. El programador solo puede enviarlo de "En Desarrollo" a QA (o regresarlo mientras el QA no empiece).';
  }
  if (openSubitems > 0) {
    return `Para enviar el proyecto a QA todas sus subtareas deben estar Finalizadas (faltan ${openSubitems}).`;
  }
  return null;
}

/**
 * Quién puede editar los datos de una subtarea (nombre, fechas, horas, programador): quien tiene
 * subitems.manageAll, su programador, o cualquiera si aún no tiene programador (para tomarla).
 * Asignarla a otra persona requiere projects.assignOthers.
 */
export function subitemEditError(sub, user, input = {}) {
  if (!can(user, 'subitems.manageAll') && sub && sub.assignee_id != null && !isAssignee(sub, user)) {
    return 'Solo el programador asignado (o un administrador) puede modificar esta subtarea.';
  }
  if (
    !can(user, 'projects.assignOthers') &&
    input.assigneeId != null &&
    input.assigneeId !== '' &&
    Number(input.assigneeId) !== Number(user.id)
  ) {
    return 'Solo puedes asignarte subtareas a ti mismo; un administrador puede asignarlas a otros.';
  }
  return null;
}

/**
 * Asignación del proyecto (columna "Asignación"). El administrador asigna a cualquiera; el programador
 * solo puede agregarse a sí mismo: no agrega ni quita a otras personas, ni se quita de su proyecto.
 */
export function projectAssigneesError(user, currentIds, nextIds) {
  if (can(user, 'projects.assignOthers')) return null;
  const me = String(user.id);
  const current = new Set(currentIds.map(String));
  const next = new Set(nextIds.map(String));
  const othersChanged = [...current, ...next].some((id) => id !== me && current.has(id) !== next.has(id));
  if (othersChanged) return 'Solo puedes asignarte a ti mismo; un administrador puede asignar a otras personas.';
  if (current.has(me) && !next.has(me)) return 'No puedes quitarte de tu propio proyecto; pídeselo a un administrador.';
  return null;
}

/**
 * Quién puede devolver un proyecto de QA a desarrollo (o asignarle el QA): el QA del proyecto o quien
 * puede cambiar etapas. `item.qa_id` es el QA asignado al proyecto.
 */
export function qaReviewError(user, item, stageName) {
  if (!isQaStage(stageName)) return 'El proyecto no está en la etapa de QA.';
  const isItemQa = item.qa_id != null && Number(item.qa_id) === Number(user.id);
  if (!isItemQa && !can(user, 'projects.changeStage')) return 'Solo el QA asignado (o un administrador) puede rechazar el proyecto.';
  return null;
}

/**
 * Aprobación del QA: el proyecto pasa a Producción solo cuando el QA (o un administrador) lo aprueba de
 * forma explícita, con sus pruebas finalizadas y los bugs verificados. Finalizar una prueba no equivale a
 * aprobarla: una prueba que encontró defectos se reporta con "Devolver a desarrollo".
 */
export function qaApproveError(user, item, stageName, openQaTests, unverifiedBugs) {
  if (!isQaStage(stageName)) return 'El proyecto no está en la etapa de QA.';
  const isItemQa = item.qa_id != null && Number(item.qa_id) === Number(user.id);
  if (!isItemQa && !can(user, 'projects.changeStage')) return 'Solo el QA asignado (o un administrador) puede aprobar el proyecto.';
  if (openQaTests > 0) return `Finaliza tus pruebas antes de aprobar el proyecto (faltan ${openQaTests}).`;
  if (unverifiedBugs > 0) return `Verifica los bugs corregidos antes de aprobar el proyecto (faltan ${unverifiedBugs}).`;
  return null;
}

/**
 * Reportar bugs desde una prueba de QA (kind = 'QA'): lo hace el QA del proyecto, quien tiene la prueba o un
 * administrador, solo con el proyecto en QA. El proyecto sigue en QA hasta que el QA lo devuelve a desarrollo.
 */
export function bugReportError(user, item, test, stageName) {
  if (test.kind !== 'QA') return 'Los bugs se reportan desde una prueba de QA.';
  if (!isUser(item.qa_id, user) && !isAssignee(test, user) && !can(user, 'subitems.manageAll')) {
    return 'Solo el QA del proyecto (o un administrador) reporta bugs.';
  }
  if (!isQaStage(stageName)) return 'Los bugs se reportan con el proyecto en QA.';
  return null;
}

export const BUG_SEVERITY_LABEL = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

/**
 * Un bug no se cierra sin un comentario de resolución (causa y qué se corrigió): es lo que deja la
 * trazabilidad entre lo que reportó el QA y lo que hizo el programador.
 */
export function resolutionError(sub, to, comment) {
  if (sub.kind === 'BUG' && to === 'DONE' && !String(comment ?? '').trim()) {
    return 'Para cerrar un bug escribe un comentario de resolución: la causa y qué corregiste.';
  }
  return null;
}

/**
 * Verificación de un bug corregido: la hace el QA del proyecto (o un administrador) con el proyecto en QA.
 * Si lo reabre, el comentario es obligatorio.
 */
export function bugVerifyError(user, item, bug, stageName, ok, comment) {
  if (bug.kind !== 'BUG') return 'Solo se verifican los bugs.';
  if (!isUser(item.qa_id, user) && !can(user, 'subitems.manageAll')) return 'Solo el QA del proyecto (o un administrador) verifica los bugs.';
  if (!isQaStage(stageName)) return 'Los bugs se verifican cuando el proyecto está en QA.';
  if (bug.status !== 'DONE') return 'El programador aún no ha cerrado este bug.';
  if (bug.verified_at) return 'Este bug ya fue verificado.';
  if (!ok && !String(comment ?? '').trim()) return 'Para reabrir el bug explica qué sigue fallando.';
  return null;
}
