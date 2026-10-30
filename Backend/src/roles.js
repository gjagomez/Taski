// Reglas del mantenimiento de roles (las usan los resolvers de roles y de usuarios).
import { one, query } from './db/pool.js';
import { fail } from './domain.js';
import { can, PERMISSIONS } from './permissions.js';

export const rolePermissions = async (roleId) =>
  (await query('SELECT permission FROM role_permissions WHERE role_id = ? ORDER BY permission', [roleId])).map((r) => r.permission);

/**
 * Nadie puede dar más permisos de los que tiene: evita que quien solo gestiona usuarios se asigne
 * (o asigne a una cuenta suya) un rol con más poder, o que edite un rol para agregarle permisos ajenos.
 */
export function assertGrantable(actor, permissions, what = 'ese rol') {
  const missing = permissions.filter((p) => !can(actor, p));
  if (missing.length) {
    const labels = missing.map((key) => `"${PERMISSIONS.find((p) => p.key === key)?.label ?? key}"`);
    fail(`No puedes otorgar ${what}: incluye permisos que tú no tienes (${labels.join(', ')}).`, 'FORBIDDEN');
  }
}

/** Rol que se va a asignar a un usuario: debe existir y no superar los permisos de quien lo asigna. */
export async function assignableRole(actor, roleId) {
  const role = await one('SELECT * FROM roles WHERE id = ?', [roleId]);
  if (!role) fail('El rol seleccionado no existe');
  assertGrantable(actor, await rolePermissions(role.id), `el rol "${role.name}"`);
  return role;
}

export const systemRoleId = async (code) => (await one('SELECT id FROM roles WHERE code = ?', [code])).id;
