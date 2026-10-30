// Mantenimiento de roles: CRUD de roles y sus permisos (catálogo en permissions.js).
import { one, query, getConnection } from '../db/pool.js';
import { requireAuth, requirePermission } from '../auth.js';
import { fail, required } from '../domain.js';
import { can, PERMISSIONS, PERMISSION_KEYS } from '../permissions.js';
import { assertGrantable, rolePermissions } from '../roles.js';

export const rolesTypeDefs = `#graphql
  type Permission { key: String!, label: String!, description: String!, group: String! }

  type UserRole {
    id: ID!
    name: String!
    description: String
    color: String!
    "Rol del sistema (Administrador / Colaborador): no se elimina ni se renombra"
    system: Boolean!
    "Los permisos del Administrador no se pueden quitar"
    locked: Boolean!
    permissions: [String!]!
    userCount: Int!
    createdAt: String!
  }

  input RoleInput {
    name: String!
    description: String
    color: String
    permissions: [String!]!
  }

  extend type Query {
    roles: [UserRole!]!
    permissions: [Permission!]!
  }

  extend type Mutation {
    createRole(input: RoleInput!): UserRole!
    updateRole(id: ID!, input: RoleInput!): UserRole!
    deleteRole(id: ID!): Boolean!
  }
`;

const COLOR = /^#[0-9a-f]{6}$/i;
const roleById = (id) => one('SELECT * FROM roles WHERE id = ?', [id]);

function validateInput(input) {
  required({ Nombre: input.name });
  const name = input.name.trim();
  if (name.length > 60) fail('El nombre del rol admite hasta 60 caracteres');
  const description = input.description?.trim() || null;
  if (description && description.length > 255) fail('La descripción admite hasta 255 caracteres');
  const color = input.color?.trim() || '#6d5df6';
  if (!COLOR.test(color)) fail('El color debe tener el formato #RRGGBB');
  const unknown = input.permissions.filter((p) => !PERMISSION_KEYS.includes(p));
  if (unknown.length) fail(`Permisos desconocidos: ${unknown.join(', ')}`);
  return { name, description, color, permissions: [...new Set(input.permissions)] };
}

async function assertUniqueName(name, exceptId = 0) {
  if (await one('SELECT id FROM roles WHERE name = ? AND id <> ?', [name, exceptId])) fail(`Ya existe un rol llamado "${name}"`);
}

/** Reemplaza los permisos del rol en una transacción (o quedan todos o ninguno). */
async function savePermissions(roleId, permissions) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    for (const p of permissions) await conn.query('INSERT INTO role_permissions (role_id, permission) VALUES (?,?)', [roleId, p]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export const rolesResolvers = {
  Query: {
    // Lo usan Usuarios (para elegir el rol) y Roles
    roles: (_, __, ctx) => {
      const user = requireAuth(ctx);
      if (!can(user, 'users.manage') && !can(user, 'roles.manage')) fail('No tienes permiso para ver los roles', 'FORBIDDEN');
      return query("SELECT * FROM roles ORDER BY code IS NULL, FIELD(code, 'ADMIN', 'MEMBER', 'QA'), name");
    },
    permissions: (_, __, ctx) => {
      requireAuth(ctx);
      return PERMISSIONS;
    },
  },

  Mutation: {
    createRole: async (_, { input }, ctx) => {
      const actor = requirePermission(ctx, 'roles.manage');
      const data = validateInput(input);
      assertGrantable(actor, data.permissions, 'esos permisos');
      await assertUniqueName(data.name);
      const res = await query('INSERT INTO roles (name, description, color) VALUES (?,?,?)', [data.name, data.description, data.color]);
      await savePermissions(res.insertId, data.permissions);
      return roleById(res.insertId);
    },

    updateRole: async (_, { id, input }, ctx) => {
      const actor = requirePermission(ctx, 'roles.manage');
      const role = await roleById(id);
      if (!role) fail('El rol no existe', 'NOT_FOUND');
      const data = validateInput(input);
      if (role.code && data.name !== role.name) fail('Los roles del sistema no se pueden renombrar');
      await assertUniqueName(data.name, role.id);
      const current = await rolePermissions(role.id);
      // Siempre debe existir un rol con todos los permisos: el sistema nunca se queda sin administradores
      if (role.code === 'ADMIN' && PERMISSION_KEYS.some((p) => !data.permissions.includes(p))) {
        fail('Los permisos del rol Administrador no se pueden quitar');
      }
      // Solo se pueden agregar o quitar permisos que uno mismo tiene
      const changed = [...data.permissions.filter((p) => !current.includes(p)), ...current.filter((p) => !data.permissions.includes(p))];
      assertGrantable(actor, changed, 'esos cambios');
      if (String(actor.role_id) === String(role.id) && !data.permissions.includes('roles.manage')) {
        fail('No puedes quitarle "Gestionar roles" a tu propio rol: perderías el acceso a esta pantalla');
      }
      await query('UPDATE roles SET name = ?, description = ?, color = ? WHERE id = ?', [data.name, data.description, data.color, role.id]);
      await savePermissions(role.id, data.permissions);
      return roleById(role.id);
    },

    deleteRole: async (_, { id }, ctx) => {
      requirePermission(ctx, 'roles.manage');
      const role = await roleById(id);
      if (!role) return true;
      if (role.code) fail('Los roles del sistema no se pueden eliminar');
      const { n } = await one('SELECT COUNT(*) AS n FROM users WHERE role_id = ?', [role.id]);
      if (Number(n)) fail(`No se puede eliminar: ${n} usuario(s) tienen el rol "${role.name}". Cámbiales el rol primero.`);
      await query('DELETE FROM roles WHERE id = ?', [role.id]);
      return true;
    },
  },

  UserRole: {
    system: (r) => Boolean(r.code),
    locked: (r) => r.code === 'ADMIN',
    permissions: (r) => rolePermissions(r.id),
    userCount: async (r) => Number((await one('SELECT COUNT(*) AS n FROM users WHERE role_id = ?', [r.id])).n),
    createdAt: (r) => r.created_at,
  },

  User: {
    role: (u, _, ctx) => {
      ctx.roleCache ??= new Map();
      if (!ctx.roleCache.has(u.role_id)) ctx.roleCache.set(u.role_id, roleById(u.role_id ?? 0));
      return ctx.roleCache.get(u.role_id);
    },
    permissions: (u) => u.permissions ?? rolePermissions(u.role_id ?? 0),
  },
};
