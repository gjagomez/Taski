// Acceso a los proyectos (elementos) del espacio de trabajo. El administrador ve todo;
// sin el permiso projects.viewAll, solo los proyectos donde está asignado, es el QA o tiene alguna subtarea.
import { query, one } from './db/pool.js';
import { fail } from './domain.js';
import { can } from './permissions.js';

/** Ids de los proyectos visibles para el usuario, o null si puede verlos todos. */
export async function accessibleItemIds(ctx) {
  const user = ctx.user;
  if (!user) return [];
  if (can(user, 'projects.viewAll')) return null;
  ctx.itemAccess ??= query(
    `SELECT item_id AS id FROM ws_item_assignees WHERE user_id = ?
     UNION SELECT item_id FROM ws_subitems WHERE assignee_id = ?
     UNION SELECT id FROM ws_items WHERE qa_id = ?`,
    [user.id, user.id, user.id]
  ).then((rows) => rows.map((r) => Number(r.id)));
  return ctx.itemAccess;
}

/** Lista para `IN (?)`: mysql2 no acepta una lista vacía. */
export const inList = (ids) => (ids.length ? ids : [0]);

/** Condición SQL (con sus parámetros) que limita `column` a los proyectos visibles. */
export async function itemScope(ctx, column = 'i.id') {
  const ids = await accessibleItemIds(ctx);
  return ids ? { sql: `${column} IN (?)`, params: [inList(ids)] } : { sql: '1=1', params: [] };
}

export async function canAccessItem(ctx, itemId) {
  const ids = await accessibleItemIds(ctx);
  return !ids || ids.includes(Number(itemId));
}

export async function requireItemAccess(ctx, itemId) {
  if (!(await canAccessItem(ctx, itemId))) fail('No tienes acceso a este proyecto', 'FORBIDDEN');
}

/** Archivos adjuntos: se heredan del proyecto al que pertenecen. */
export async function requireFileAccess(ctx, fileId) {
  const file = await one('SELECT item_id FROM ws_item_files WHERE id = ?', [fileId]);
  if (file && !(await canAccessItem(ctx, file.item_id))) fail('No tienes acceso a este archivo', 'FORBIDDEN');
}

export async function canAccessBoardItems(ctx, boardId) {
  const ids = await accessibleItemIds(ctx);
  if (!ids) return true;
  return !!(await one('SELECT 1 AS ok FROM ws_items WHERE board_id = ? AND id IN (?) LIMIT 1', [boardId, inList(ids)]));
}
