import jwt from 'jsonwebtoken';
import { one, query } from './db/pool.js';
import { fail } from './domain.js';
import { can } from './permissions.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(user) {
  // Los permisos no van en el token: se leen de la base en cada petición, así un cambio de rol aplica al instante
  return jwt.sign({ uid: user.id }, SECRET, { expiresIn: '7d' });
}

/** Usuario con su rol (role_name, role_code) y la lista de permisos del rol. */
export async function loadAuthUser(id) {
  const user = await one(
    'SELECT u.*, r.name AS role_name, r.code AS role_code FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
    [id]
  );
  if (!user) return null;
  user.permissions = (await query('SELECT permission FROM role_permissions WHERE role_id = ?', [user.role_id ?? 0])).map((r) => r.permission);
  return user;
}

export async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    const user = await loadAuthUser(payload.uid);
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

export function requireAuth(ctx) {
  if (!ctx.user) fail('Debes iniciar sesión', 'UNAUTHENTICATED');
  return ctx.user;
}

/** Exige un permiso del catálogo (permissions.js). */
export function requirePermission(ctx, permission) {
  const user = requireAuth(ctx);
  if (!can(user, permission)) fail('No tienes permiso para realizar esta acción', 'FORBIDDEN');
  return user;
}

export async function canAccessBoard(user, boardId) {
  if (can(user, 'projects.viewAll')) return true;
  const row = await one('SELECT 1 AS ok FROM board_members WHERE board_id = ? AND user_id = ?', [
    boardId,
    user.id,
  ]);
  return !!row;
}

export async function requireBoard(ctx, boardId) {
  const user = requireAuth(ctx);
  if (!(await canAccessBoard(user, boardId))) {
    fail('No tienes acceso a este tablero', 'FORBIDDEN');
  }
  return user;
}
