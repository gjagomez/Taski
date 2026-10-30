import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { query, one, getConnection } from '../db/pool.js';
import { signToken, requireAuth, requirePermission, requireBoard, canAccessBoard, loadAuthUser } from '../auth.js';
import { can } from '../permissions.js';
import { assignableRole, systemRoleId } from '../roles.js';
import {
  fail,
  required,
  validateEmail,
  validatePassword,
  transitionError,
  allowedTransitions,
  DEFAULT_COLUMNS,
  STATUS_LABEL,
} from '../domain.js';
import { sendInvitation, sendPasswordReset, sendRegistrationCode } from '../mail.js';

const AVATAR_COLORS = ['#6d5df6', '#f45b69', '#00c875', '#fdab3d', '#579bfc', '#a25ddc', '#ff7575', '#037f4c'];
// Códigos por correo (recuperación de contraseña y confirmación del registro)
const RESET_MINUTES = 15;
const RESEND_SECONDS = 60;
const RESET_MAX_ATTEMPTS = 5;
const PRIORITY_LABEL = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

const TASK_SELECT = `
  SELECT t.*, c.status,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtask_count,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'DONE') AS subtask_done,
    (SELECT COUNT(*) FROM comments cm WHERE cm.task_id = t.id) AS comment_count
  FROM tasks t JOIN board_columns c ON c.id = t.column_id`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyToNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : v);

// ---------- Helpers de acceso a datos ----------
function loadUser(ctx, id) {
  if (!id) return null;
  if (!ctx.userCache.has(id)) ctx.userCache.set(id, one('SELECT * FROM users WHERE id = ?', [id]));
  return ctx.userCache.get(id);
}

const getTask = (id) => one(`${TASK_SELECT} WHERE t.id = ?`, [id]);

async function getTaskForUser(ctx, id) {
  const task = await getTask(id);
  if (!task) fail('La tarea no existe', 'NOT_FOUND');
  await requireBoard(ctx, task.board_id);
  return task;
}

function ensureEditable(task) {
  if (task.status === 'DONE') fail('La tarea está Completada (estado final) y no puede modificarse.');
}

async function log({ taskId = null, boardId, userId, action, detail }) {
  await query('INSERT INTO activity_log (task_id, board_id, user_id, action, detail) VALUES (?,?,?,?,?)', [
    taskId,
    boardId,
    userId,
    action,
    detail,
  ]);
}

/** Restricción por tableros a los que el usuario tiene acceso. */
function scope(user, col = 't.board_id') {
  if (can(user, 'projects.viewAll')) return { sql: '1=1', params: [] };
  return { sql: `${col} IN (SELECT board_id FROM board_members WHERE user_id = ?)`, params: [user.id] };
}

async function statsWhere(where, params) {
  const row = await one(
    `SELECT COUNT(*) AS total,
       SUM(c.status = 'BACKLOG') AS backlog,
       SUM(c.status = 'IN_PROGRESS') AS inProgress,
       SUM(c.status = 'REVIEW') AS review,
       SUM(c.status = 'DONE') AS done,
       SUM(t.due_date < CURDATE() AND c.status <> 'DONE') AS overdue,
       SUM(t.type = 'BUG') AS bugs
     FROM tasks t JOIN board_columns c ON c.id = t.column_id WHERE ${where}`,
    params
  );
  const n = (v) => Number(v || 0);
  const stats = {
    total: n(row.total),
    backlog: n(row.backlog),
    inProgress: n(row.inProgress),
    review: n(row.review),
    done: n(row.done),
    overdue: n(row.overdue),
    bugs: n(row.bugs),
  };
  stats.completionRate = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return stats;
}

async function assertAssignable(boardId, assigneeId) {
  if (!assigneeId) return;
  const user = await one('SELECT * FROM users WHERE id = ? AND active = 1', [assigneeId]);
  if (!user) fail('El responsable seleccionado no existe o está inactivo');
  if (!(await canAccessBoard(user, boardId))) fail(`${user.name} no es miembro de este tablero`);
}

function validateDates(start, due) {
  if (start && due && due < start) fail('La fecha límite no puede ser anterior a la fecha de inicio');
}

async function recomputeSubtask(subtaskId) {
  const row = await one(
    'SELECT COUNT(*) AS total, SUM(done) AS done FROM checklist_items WHERE subtask_id = ?',
    [subtaskId]
  );
  const total = Number(row.total);
  if (total > 0) {
    const status = Number(row.done) === total ? 'DONE' : 'PENDING';
    await query('UPDATE subtasks SET status = ? WHERE id = ?', [status, subtaskId]);
  }
  return one('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);
}

async function subtaskWithTask(ctx, subtaskId) {
  const subtask = await one('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);
  if (!subtask) fail('La subtarea no existe', 'NOT_FOUND');
  const task = await getTaskForUser(ctx, subtask.task_id);
  return { subtask, task };
}

async function visibleProjects(user) {
  if (can(user, 'projects.viewAll')) return query('SELECT * FROM projects ORDER BY created_at DESC');
  return query(
    `SELECT DISTINCT p.* FROM projects p
     JOIN boards b ON b.project_id = p.id
     JOIN board_members bm ON bm.board_id = b.id
     WHERE bm.user_id = ? ORDER BY p.created_at DESC`,
    [user.id]
  );
}

// ---------- Resolvers ----------
export const resolvers = {
  Query: {
    me: (_, __, ctx) => ctx.user,

    users: (_, __, ctx) => {
      requireAuth(ctx);
      return query('SELECT * FROM users ORDER BY name');
    },

    dashboard: async (_, __, ctx) => {
      const user = requireAuth(ctx);
      const s = scope(user);
      const [stats, projects, myTasks, upcomingTasks, overdueTasks, recentActivity] = await Promise.all([
        statsWhere(s.sql, s.params),
        visibleProjects(user),
        query(
          `${TASK_SELECT} WHERE t.assignee_id = ? AND c.status <> 'DONE'
           ORDER BY t.due_date IS NULL, t.due_date LIMIT 8`,
          [user.id]
        ),
        query(
          `${TASK_SELECT} WHERE ${s.sql} AND t.due_date >= CURDATE() AND c.status <> 'DONE'
           ORDER BY t.due_date LIMIT 8`,
          s.params
        ),
        query(
          `${TASK_SELECT} WHERE ${s.sql} AND t.due_date < CURDATE() AND c.status <> 'DONE'
           ORDER BY t.due_date LIMIT 10`,
          s.params
        ),
        query(
          `SELECT a.* FROM activity_log a WHERE ${scope(user, 'a.board_id').sql}
           ORDER BY a.created_at DESC, a.id DESC LIMIT 12`,
          scope(user, 'a.board_id').params
        ),
      ]);
      return { stats, projects, myTasks, upcomingTasks, overdueTasks, recentActivity };
    },

    projects: (_, __, ctx) => visibleProjects(requireAuth(ctx)),

    project: async (_, { id }, ctx) => {
      const user = requireAuth(ctx);
      const projects = await visibleProjects(user);
      return projects.find((p) => String(p.id) === String(id)) || null;
    },

    board: async (_, { id }, ctx) => {
      await requireBoard(ctx, id);
      return one('SELECT * FROM boards WHERE id = ?', [id]);
    },

    task: (_, { id }, ctx) => getTaskForUser(ctx, id),

    myTasks: (_, __, ctx) => {
      const user = requireAuth(ctx);
      return query(
        `${TASK_SELECT} WHERE t.assignee_id = ?
         ORDER BY c.status = 'DONE', t.due_date IS NULL, t.due_date`,
        [user.id]
      );
    },

    activity: (_, { limit = 50 }, ctx) => {
      const user = requireAuth(ctx);
      const s = scope(user, 'a.board_id');
      return query(
        `SELECT a.* FROM activity_log a WHERE ${s.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
        [...s.params, Math.min(limit, 200)]
      );
    },
  },

  Mutation: {
    // ----- Autenticación -----
    // Paso 1: guarda el registro como pendiente y envía un código al correo. La cuenta no existe todavía.
    register: async (_, { name, email, password }) => {
      required({ Nombre: name, Correo: email, Contraseña: password });
      validateEmail(email);
      validatePassword(password);
      email = email.trim().toLowerCase();
      if (await one('SELECT id FROM users WHERE email = ?', [email])) fail('Ya existe una cuenta con ese correo');
      const message = `Te enviamos un código de 6 dígitos a ${email} (válido ${RESET_MINUTES} minutos). Revisa también la carpeta de spam.`;
      // Un código por minuto como máximo: evita llenar el buzón
      const recent = await one('SELECT 1 FROM pending_registrations WHERE email = ? AND sent_at > DATE_SUB(NOW(), INTERVAL ? SECOND)', [
        email,
        RESEND_SECONDS,
      ]);
      if (recent) return { message, devCode: null };

      const code = String(randomInt(100000, 1000000));
      const hash = await bcrypt.hash(password, 10);
      await query(
        `INSERT INTO pending_registrations (email, name, password_hash, code, expires_at, attempts, sent_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), code = VALUES(code),
           expires_at = VALUES(expires_at), attempts = 0, sent_at = NOW()`,
        [email, name.trim(), hash, code, RESET_MINUTES]
      );
      const dev = process.env.NODE_ENV !== 'production';
      try {
        const result = await sendRegistrationCode({ name: name.trim(), email }, code, RESET_MINUTES);
        if (!result.simulated) return { message, devCode: null };
      } catch (err) {
        console.warn(`⚠️  Código de registro para ${email}: ${err.message}`);
      }
      // Sin correo (Mailjet sin configurar o con error): en desarrollo se muestra el código para poder probar
      if (dev) console.log(`🔑 Código de registro para ${email}: ${code}`);
      return { message, devCode: dev ? code : null };
    },

    // Paso 2: con el código correcto se crea la cuenta y se inicia sesión
    confirmRegistration: async (_, { email, code }) => {
      required({ Correo: email, Código: code });
      validateEmail(email);
      email = email.trim().toLowerCase();
      const pending = await one('SELECT * FROM pending_registrations WHERE email = ? AND expires_at > NOW()', [email]);
      if (!pending) fail('El código es inválido o ha expirado. Solicita uno nuevo.');
      if (pending.code !== code.trim()) {
        const attempts = Number(pending.attempts) + 1;
        if (attempts >= RESET_MAX_ATTEMPTS) {
          await query('DELETE FROM pending_registrations WHERE email = ?', [email]);
          fail('Demasiados intentos fallidos. Vuelve a registrarte para recibir un código nuevo.');
        }
        await query('UPDATE pending_registrations SET attempts = ? WHERE email = ?', [attempts, email]);
        fail(`El código es incorrecto. Te quedan ${RESET_MAX_ATTEMPTS - attempts} intento(s).`);
      }
      await query('DELETE FROM pending_registrations WHERE email = ?', [email]);
      if (await one('SELECT id FROM users WHERE email = ?', [email])) fail('Ya existe una cuenta con ese correo');
      const { count } = await one('SELECT COUNT(*) AS count FROM users');
      // El primer usuario de una base vacía queda como Administrador; los demás, como Colaborador
      const roleId = await systemRoleId(Number(count) === 0 ? 'ADMIN' : 'MEMBER');
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const res = await query(
        'INSERT INTO users (name, email, password_hash, role_id, avatar_color) VALUES (?,?,?,?,?)',
        [pending.name, email, pending.password_hash, roleId, color]
      );
      const user = await loadAuthUser(res.insertId);
      // El correo de bienvenida no bloquea ni hace fallar el registro
      sendInvitation(user, { kind: 'welcome' }).catch((err) => console.warn(`⚠️  Bienvenida a ${email}: ${err.message}`));
      return { token: signToken(user), user };
    },

    login: async (_, { email, password }) => {
      required({ Correo: email, Contraseña: password });
      validateEmail(email);
      const user = await one('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        fail('Correo o contraseña incorrectos', 'UNAUTHENTICATED');
      }
      if (!user.active) fail('Tu cuenta está desactivada. Contacta al administrador.', 'FORBIDDEN');
      return { token: signToken(user), user };
    },

    requestPasswordReset: async (_, { email }) => {
      required({ Correo: email });
      validateEmail(email);
      const user = await one('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados
      const message = `Si el correo está registrado, recibirás un código de recuperación (válido ${RESET_MINUTES} minutos). Revisa también la carpeta de spam.`;
      if (!user || !user.active) return { message, devCode: null };
      // Un código por minuto como máximo: evita llenar el buzón del usuario
      const { recent } = await one(
        'SELECT reset_code IS NOT NULL AND reset_expires > DATE_ADD(NOW(), INTERVAL ? SECOND) AS recent FROM users WHERE id = ?',
        [RESET_MINUTES * 60 - RESEND_SECONDS, user.id]
      );
      if (Number(recent)) return { message, devCode: null };

      const code = String(randomInt(100000, 1000000));
      await query(
        'UPDATE users SET reset_code = ?, reset_expires = DATE_ADD(NOW(), INTERVAL ? MINUTE), reset_attempts = 0 WHERE id = ?',
        [code, RESET_MINUTES, user.id]
      );
      const dev = process.env.NODE_ENV !== 'production';
      try {
        const result = await sendPasswordReset(user, code, RESET_MINUTES);
        if (!result.simulated) return { message, devCode: null };
      } catch (err) {
        console.warn(`⚠️  Código de recuperación para ${user.email}: ${err.message}`);
      }
      // Sin correo (Mailjet sin configurar o con error): en desarrollo se muestra el código para poder probar
      if (dev) console.log(`🔑 Código de recuperación para ${user.email}: ${code}`);
      return { message, devCode: dev ? code : null };
    },

    resetPassword: async (_, { email, code, newPassword }) => {
      required({ Correo: email, Código: code, 'Nueva contraseña': newPassword });
      validateEmail(email);
      validatePassword(newPassword);
      const user = await one('SELECT * FROM users WHERE email = ? AND reset_code IS NOT NULL AND reset_expires > NOW()', [
        email.trim().toLowerCase(),
      ]);
      if (!user) fail('El código es inválido o ha expirado. Solicita uno nuevo.');
      if (user.reset_code !== code.trim()) {
        // Tras varios intentos fallidos el código se anula (evita probar los 900.000 códigos posibles)
        const attempts = Number(user.reset_attempts) + 1;
        if (attempts >= RESET_MAX_ATTEMPTS) {
          await query('UPDATE users SET reset_code = NULL, reset_expires = NULL, reset_attempts = 0 WHERE id = ?', [user.id]);
          fail('Demasiados intentos fallidos. Solicita un código nuevo.');
        }
        await query('UPDATE users SET reset_attempts = ? WHERE id = ?', [attempts, user.id]);
        fail(`El código es incorrecto. Te quedan ${RESET_MAX_ATTEMPTS - attempts} intento(s).`);
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await query(
        'UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL, reset_attempts = 0 WHERE id = ?',
        [hash, user.id]
      );
      return true;
    },

    // ----- Usuarios (permiso users.manage) -----
    createUser: async (_, { name, email, password, roleId }, ctx) => {
      const actor = requirePermission(ctx, 'users.manage');
      required({ Nombre: name, Correo: email, Contraseña: password });
      validateEmail(email);
      validatePassword(password);
      email = email.trim().toLowerCase();
      if (await one('SELECT id FROM users WHERE email = ?', [email])) fail('Ya existe una cuenta con ese correo');
      const role = await assignableRole(actor, roleId);
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const res = await query(
        'INSERT INTO users (name, email, password_hash, role_id, avatar_color) VALUES (?,?,?,?,?)',
        [name.trim(), email, await bcrypt.hash(password, 10), role.id, color]
      );
      return one('SELECT * FROM users WHERE id = ?', [res.insertId]);
    },

    sendInvitation: async (_, { userId, message, temporaryPassword }, ctx) => {
      const admin = requirePermission(ctx, 'users.manage');
      const user = await loadAuthUser(userId);
      if (!user) fail('El usuario no existe', 'NOT_FOUND');
      if (!user.active) fail('El usuario está desactivado: actívalo antes de invitarlo');
      // Solo se envía la contraseña si es la vigente (recién creada por el administrador)
      if (temporaryPassword && !(await bcrypt.compare(temporaryPassword, user.password_hash))) {
        fail('La contraseña temporal no coincide con la del usuario');
      }
      const note = message?.trim() ? message.trim().slice(0, 1000) : null;
      try {
        const result = await sendInvitation(user, { kind: 'invite', invitedBy: admin, message: note, temporaryPassword });
        return { ...result, to: user.email };
      } catch (err) {
        console.warn(`⚠️  Invitación a ${user.email}: ${err.message}`);
        fail(err.message, 'EMAIL_FAILED');
      }
    },

    updateUserRole: async (_, { id, roleId }, ctx) => {
      const admin = requirePermission(ctx, 'users.manage');
      if (String(admin.id) === String(id)) fail('No puedes cambiar tu propio rol');
      const target = await loadAuthUser(id);
      if (!target) fail('El usuario no existe', 'NOT_FOUND');
      // Tampoco se le puede quitar el rol a alguien con más permisos que uno
      if (target.permissions.some((p) => !can(admin, p))) fail('No puedes cambiar el rol de un usuario con permisos que tú no tienes', 'FORBIDDEN');
      const role = await assignableRole(admin, roleId);
      await query('UPDATE users SET role_id = ? WHERE id = ?', [role.id, id]);
      return one('SELECT * FROM users WHERE id = ?', [id]);
    },

    setUserActive: async (_, { id, active }, ctx) => {
      const admin = requirePermission(ctx, 'users.manage');
      if (String(admin.id) === String(id)) fail('No puedes desactivar tu propia cuenta');
      const target = await loadAuthUser(id);
      if (!target) fail('El usuario no existe', 'NOT_FOUND');
      if (target.permissions.some((p) => !can(admin, p))) fail('No puedes desactivar a un usuario con permisos que tú no tienes', 'FORBIDDEN');
      await query('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
      return one('SELECT * FROM users WHERE id = ?', [id]);
    },

    // ----- Proyectos (admin) -----
    createProject: async (_, { input }, ctx) => {
      const admin = requirePermission(ctx, 'boards.manage');
      required({ Nombre: input.name });
      const res = await query('INSERT INTO projects (name, description, color, created_by) VALUES (?,?,?,?)', [
        input.name.trim(),
        emptyToNull(input.description),
        input.color || '#6d5df6',
        admin.id,
      ]);
      return one('SELECT * FROM projects WHERE id = ?', [res.insertId]);
    },

    updateProject: async (_, { id, input }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      required({ Nombre: input.name });
      await query('UPDATE projects SET name = ?, description = ?, color = COALESCE(?, color) WHERE id = ?', [
        input.name.trim(),
        emptyToNull(input.description),
        input.color || null,
        id,
      ]);
      return one('SELECT * FROM projects WHERE id = ?', [id]);
    },

    deleteProject: async (_, { id }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      await query('DELETE FROM projects WHERE id = ?', [id]);
      return true;
    },

    // ----- Tableros (admin) -----
    createBoard: async (_, { input }, ctx) => {
      const admin = requirePermission(ctx, 'boards.manage');
      required({ Nombre: input.name, Proyecto: input.projectId });
      if (!(await one('SELECT id FROM projects WHERE id = ?', [input.projectId]))) fail('El proyecto no existe');
      const conn = await getConnection();
      try {
        await conn.beginTransaction();
        const [res] = await conn.query(
          'INSERT INTO boards (project_id, name, description, created_by) VALUES (?,?,?,?)',
          [input.projectId, input.name.trim(), emptyToNull(input.description), admin.id]
        );
        const boardId = res.insertId;
        for (const [i, col] of DEFAULT_COLUMNS.entries()) {
          await conn.query('INSERT INTO board_columns (board_id, name, status, position, color) VALUES (?,?,?,?,?)', [
            boardId,
            col.name,
            col.status,
            i,
            col.color,
          ]);
        }
        const members = new Set([String(admin.id), ...(input.memberIds || []).map(String)]);
        for (const userId of members) {
          await conn.query('INSERT INTO board_members (board_id, user_id) VALUES (?,?)', [boardId, userId]);
        }
        await conn.query('INSERT INTO activity_log (board_id, user_id, action, detail) VALUES (?,?,?,?)', [
          boardId,
          admin.id,
          'BOARD_CREATED',
          `Creó el tablero "${input.name.trim()}"`,
        ]);
        await conn.commit();
        return one('SELECT * FROM boards WHERE id = ?', [boardId]);
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    updateBoard: async (_, { id, name, description }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      required({ Nombre: name });
      await query('UPDATE boards SET name = ?, description = ? WHERE id = ?', [
        name.trim(),
        emptyToNull(description),
        id,
      ]);
      return one('SELECT * FROM boards WHERE id = ?', [id]);
    },

    deleteBoard: async (_, { id }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      await query('DELETE FROM activity_log WHERE board_id = ?', [id]);
      // Primero las tareas: referencian a las columnas, y el borrado en cascada del tablero no garantiza el orden
      await query('DELETE FROM tasks WHERE board_id = ?', [id]);
      await query('DELETE FROM boards WHERE id = ?', [id]);
      return true;
    },

    setBoardMembers: async (_, { boardId, userIds }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      await query('DELETE FROM board_members WHERE board_id = ?', [boardId]);
      for (const userId of new Set(userIds.map(String))) {
        await query('INSERT INTO board_members (board_id, user_id) VALUES (?,?)', [boardId, userId]);
      }
      return one('SELECT * FROM boards WHERE id = ?', [boardId]);
    },

    // ----- Tareas -----
    createTask: async (_, { input }, ctx) => {
      const user = await requireBoard(ctx, input.boardId);
      required({ Título: input.title });
      if (input.title.trim().length > 200) fail('El título no puede superar 200 caracteres');
      const startDate = emptyToNull(input.startDate);
      const dueDate = emptyToNull(input.dueDate);
      validateDates(startDate, dueDate);
      const assigneeId = emptyToNull(input.assigneeId);
      await assertAssignable(input.boardId, assigneeId);

      const backlog = await one("SELECT id FROM board_columns WHERE board_id = ? AND status = 'BACKLOG'", [
        input.boardId,
      ]);
      const { pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM tasks WHERE column_id = ?', [
        backlog.id,
      ]);
      const res = await query(
        `INSERT INTO tasks (board_id, column_id, title, description, type, priority, labels,
           acceptance_criteria, assignee_id, created_by, start_date, due_date, position)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          input.boardId,
          backlog.id,
          input.title.trim(),
          emptyToNull(input.description),
          input.type || 'TASK',
          input.priority || 'MEDIUM',
          (input.labels || []).map((l) => l.trim()).filter(Boolean).join(',') || null,
          emptyToNull(input.acceptanceCriteria),
          assigneeId,
          user.id,
          startDate,
          dueDate,
          pos,
        ]
      );
      await log({
        taskId: res.insertId,
        boardId: input.boardId,
        userId: user.id,
        action: 'CREATED',
        detail: `Creó la ${input.type === 'BUG' ? 'incidencia (bug)' : 'tarea'} en "Por hacer"`,
      });
      return getTask(res.insertId);
    },

    updateTask: async (_, { id, input }, ctx) => {
      const task = await getTaskForUser(ctx, id);
      ensureEditable(task);
      const user = ctx.user;
      const sets = [];
      const params = [];
      const changed = [];
      const set = (col, value, label) => {
        sets.push(`${col} = ?`);
        params.push(value);
        if (label) changed.push(label);
      };

      if (input.title !== undefined) {
        required({ Título: input.title });
        if (input.title.trim() !== task.title) set('title', input.title.trim(), 'título');
      }
      if (input.description !== undefined && (input.description || null) !== task.description)
        set('description', emptyToNull(input.description), 'descripción');
      if (input.acceptanceCriteria !== undefined && (input.acceptanceCriteria || null) !== task.acceptance_criteria)
        set('acceptance_criteria', emptyToNull(input.acceptanceCriteria), 'criterio de aceptación');
      if (input.type && input.type !== task.type) set('type', input.type, 'tipo');
      if (input.priority && input.priority !== task.priority)
        set('priority', input.priority, `prioridad → ${PRIORITY_LABEL[input.priority]}`);
      if (input.labels !== undefined) {
        const labels = input.labels.map((l) => l.trim()).filter(Boolean).join(',') || null;
        if (labels !== task.labels) set('labels', labels, 'etiquetas');
      }

      const startDate = input.startDate !== undefined ? emptyToNull(input.startDate) : task.start_date;
      const dueDate = input.dueDate !== undefined ? emptyToNull(input.dueDate) : task.due_date;
      validateDates(startDate, dueDate);
      if (startDate !== task.start_date) set('start_date', startDate, 'fecha de inicio');
      if (dueDate !== task.due_date) set('due_date', dueDate, `fecha límite → ${dueDate || 'sin fecha'}`);

      if (input.assigneeId !== undefined) {
        const assigneeId = emptyToNull(input.assigneeId);
        if (String(assigneeId ?? '') !== String(task.assignee_id ?? '')) {
          if (!assigneeId && task.status !== 'BACKLOG') {
            fail('Una tarea en curso debe mantener un responsable asignado');
          }
          await assertAssignable(task.board_id, assigneeId);
          set('assignee_id', assigneeId);
          const assignee = assigneeId ? await one('SELECT name FROM users WHERE id = ?', [assigneeId]) : null;
          await log({
            taskId: task.id,
            boardId: task.board_id,
            userId: user.id,
            action: 'ASSIGNED',
            detail: assignee ? `Asignó la tarea a ${assignee.name}` : 'Quitó el responsable',
          });
        }
      }

      if (sets.length) {
        await query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
        if (changed.length) {
          await log({
            taskId: task.id,
            boardId: task.board_id,
            userId: user.id,
            action: 'UPDATED',
            detail: `Actualizó: ${changed.join(', ')}`,
          });
        }
      }
      return getTask(id);
    },

    moveTask: async (_, { id, status, position, reason }, ctx) => {
      const task = await getTaskForUser(ctx, id);
      const user = ctx.user;
      const from = task.status;
      const subtasks = await query('SELECT * FROM subtasks WHERE task_id = ?', [id]);
      const error = transitionError({ task, from, to: status, subtasks, user });
      if (error) fail(error, 'TRANSITION_NOT_ALLOWED');

      const target = await one('SELECT * FROM board_columns WHERE board_id = ? AND status = ?', [
        task.board_id,
        status,
      ]);
      const siblings = await query('SELECT id FROM tasks WHERE column_id = ? AND id <> ? ORDER BY position, id', [
        target.id,
        id,
      ]);
      const ids = siblings.map((s) => s.id);
      const index = position == null ? ids.length : Math.max(0, Math.min(position, ids.length));
      ids.splice(index, 0, Number(id));

      const conn = await getConnection();
      try {
        await conn.beginTransaction();
        for (const [i, taskId] of ids.entries()) {
          await conn.query('UPDATE tasks SET position = ? WHERE id = ?', [i, taskId]);
        }
        if (from !== status) {
          await conn.query(
            `UPDATE tasks SET column_id = ?, completed_at = ${status === 'DONE' ? 'NOW()' : 'NULL'} WHERE id = ?`,
            [target.id, id]
          );
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      if (from !== status) {
        const isRejection = from === 'REVIEW' && status === 'IN_PROGRESS';
        const action = isRejection ? 'REJECTED' : status === 'DONE' ? 'COMPLETED' : 'MOVED';
        let detail = `Movió de "${STATUS_LABEL[from]}" a "${STATUS_LABEL[status]}"`;
        if (isRejection) detail = `QA detectó defectos: regresó a "En progreso"${reason ? ` — ${reason}` : ''}`;
        if (status === 'DONE') detail = 'Aprobó la revisión y cerró la tarea (Completado)';
        await log({ taskId: task.id, boardId: task.board_id, userId: user.id, action, detail });
        if (isRejection && reason?.trim()) {
          await query('INSERT INTO comments (task_id, user_id, body) VALUES (?,?,?)', [
            id,
            user.id,
            `🐞 Defectos detectados en QA: ${reason.trim()}`,
          ]);
        }
      }
      return getTask(id);
    },

    deleteTask: async (_, { id }, ctx) => {
      const task = await getTaskForUser(ctx, id);
      if (!can(ctx.user, 'boards.manage') && task.created_by !== ctx.user.id) {
        fail('Solo el creador o un administrador puede eliminar la tarea', 'FORBIDDEN');
      }
      await query('DELETE FROM tasks WHERE id = ?', [id]);
      await log({
        boardId: task.board_id,
        userId: ctx.user.id,
        action: 'DELETED',
        detail: `Eliminó la tarea "${task.title}"`,
      });
      return true;
    },

    // ----- Subtareas y checklist -----
    addSubtask: async (_, { taskId, title }, ctx) => {
      const task = await getTaskForUser(ctx, taskId);
      ensureEditable(task);
      required({ Título: title });
      const res = await query('INSERT INTO subtasks (task_id, title) VALUES (?,?)', [taskId, title.trim()]);
      await log({
        taskId: task.id,
        boardId: task.board_id,
        userId: ctx.user.id,
        action: 'SUBTASK_ADDED',
        detail: `Agregó la subtarea "${title.trim()}"`,
      });
      return one('SELECT * FROM subtasks WHERE id = ?', [res.insertId]);
    },

    updateSubtask: async (_, { id, title, status }, ctx) => {
      const { subtask, task } = await subtaskWithTask(ctx, id);
      ensureEditable(task);
      if (title !== undefined && title !== null) {
        required({ Título: title });
        await query('UPDATE subtasks SET title = ? WHERE id = ?', [title.trim(), id]);
      }
      if (status && status !== subtask.status) {
        await query('UPDATE subtasks SET status = ? WHERE id = ?', [status, id]);
        if (status === 'DONE') await query('UPDATE checklist_items SET done = 1 WHERE subtask_id = ?', [id]);
        await log({
          taskId: task.id,
          boardId: task.board_id,
          userId: ctx.user.id,
          action: status === 'DONE' ? 'SUBTASK_DONE' : 'SUBTASK_REOPENED',
          detail: `${status === 'DONE' ? 'Completó' : 'Reabrió'} la subtarea "${subtask.title}"`,
        });
      }
      return one('SELECT * FROM subtasks WHERE id = ?', [id]);
    },

    deleteSubtask: async (_, { id }, ctx) => {
      const { subtask, task } = await subtaskWithTask(ctx, id);
      ensureEditable(task);
      await query('DELETE FROM subtasks WHERE id = ?', [id]);
      await log({
        taskId: task.id,
        boardId: task.board_id,
        userId: ctx.user.id,
        action: 'SUBTASK_DELETED',
        detail: `Eliminó la subtarea "${subtask.title}"`,
      });
      return true;
    },

    addChecklistItem: async (_, { subtaskId, text }, ctx) => {
      const { task } = await subtaskWithTask(ctx, subtaskId);
      ensureEditable(task);
      required({ Texto: text });
      const res = await query('INSERT INTO checklist_items (subtask_id, text) VALUES (?,?)', [subtaskId, text.trim()]);
      await recomputeSubtask(subtaskId);
      return one('SELECT * FROM checklist_items WHERE id = ?', [res.insertId]);
    },

    toggleChecklistItem: async (_, { id }, ctx) => {
      const item = await one('SELECT * FROM checklist_items WHERE id = ?', [id]);
      if (!item) fail('El elemento no existe', 'NOT_FOUND');
      const { subtask, task } = await subtaskWithTask(ctx, item.subtask_id);
      ensureEditable(task);
      await query('UPDATE checklist_items SET done = NOT done WHERE id = ?', [id]);
      const updated = await recomputeSubtask(item.subtask_id);
      if (updated.status !== subtask.status) {
        await log({
          taskId: task.id,
          boardId: task.board_id,
          userId: ctx.user.id,
          action: updated.status === 'DONE' ? 'SUBTASK_DONE' : 'SUBTASK_REOPENED',
          detail: `${updated.status === 'DONE' ? 'Completó' : 'Reabrió'} la subtarea "${subtask.title}" (checklist)`,
        });
      }
      return updated;
    },

    deleteChecklistItem: async (_, { id }, ctx) => {
      const item = await one('SELECT * FROM checklist_items WHERE id = ?', [id]);
      if (!item) fail('El elemento no existe', 'NOT_FOUND');
      const { task } = await subtaskWithTask(ctx, item.subtask_id);
      ensureEditable(task);
      await query('DELETE FROM checklist_items WHERE id = ?', [id]);
      await recomputeSubtask(item.subtask_id);
      return true;
    },

    addComment: async (_, { taskId, body }, ctx) => {
      const task = await getTaskForUser(ctx, taskId);
      required({ Comentario: body });
      const res = await query('INSERT INTO comments (task_id, user_id, body) VALUES (?,?,?)', [
        taskId,
        ctx.user.id,
        body.trim(),
      ]);
      await log({
        taskId: task.id,
        boardId: task.board_id,
        userId: ctx.user.id,
        action: 'COMMENTED',
        detail: 'Agregó un comentario',
      });
      return one('SELECT * FROM comments WHERE id = ?', [res.insertId]);
    },
  },

  // ---------- Tipos ----------
  User: {
    active: (u) => !!u.active,
    avatarColor: (u) => u.avatar_color,
    createdAt: (u) => u.created_at,
  },

  Project: {
    createdAt: (p) => p.created_at,
    createdBy: (p, _, ctx) => loadUser(ctx, p.created_by),
    boards: (p, _, ctx) => {
      const s = scope(ctx.user, 'b.id');
      return query(`SELECT b.* FROM boards b WHERE b.project_id = ? AND ${s.sql} ORDER BY b.created_at, b.id`, [
        p.id,
        ...s.params,
      ]);
    },
    members: (p) =>
      query(
        `SELECT DISTINCT u.* FROM users u
         JOIN board_members bm ON bm.user_id = u.id
         JOIN boards b ON b.id = bm.board_id
         WHERE b.project_id = ? ORDER BY u.name`,
        [p.id]
      ),
    stats: (p, _, ctx) => {
      const s = scope(ctx.user);
      return statsWhere(`t.board_id IN (SELECT id FROM boards WHERE project_id = ?) AND ${s.sql}`, [
        p.id,
        ...s.params,
      ]);
    },
  },

  Board: {
    createdAt: (b) => b.created_at,
    project: (b) => one('SELECT * FROM projects WHERE id = ?', [b.project_id]),
    columns: (b) => query('SELECT * FROM board_columns WHERE board_id = ? ORDER BY position', [b.id]),
    members: (b) =>
      query(
        `SELECT u.* FROM users u JOIN board_members bm ON bm.user_id = u.id
         WHERE bm.board_id = ? ORDER BY u.name`,
        [b.id]
      ),
    tasks: (b) => query(`${TASK_SELECT} WHERE t.board_id = ? ORDER BY t.position, t.id`, [b.id]),
    stats: (b) => statsWhere('t.board_id = ?', [b.id]),
  },

  Column: {
    tasks: (c) => query(`${TASK_SELECT} WHERE t.column_id = ? ORDER BY t.position, t.id`, [c.id]),
  },

  Task: {
    labels: (t) => (t.labels ? t.labels.split(',').filter(Boolean) : []),
    acceptanceCriteria: (t) => t.acceptance_criteria,
    board: (t) => one('SELECT * FROM boards WHERE id = ?', [t.board_id]),
    assignee: (t, _, ctx) => loadUser(ctx, t.assignee_id),
    createdBy: (t, _, ctx) => loadUser(ctx, t.created_by),
    startDate: (t) => t.start_date,
    dueDate: (t) => t.due_date,
    completedAt: (t) => t.completed_at,
    createdAt: (t) => t.created_at,
    updatedAt: (t) => t.updated_at,
    isOverdue: (t) => !!t.due_date && t.status !== 'DONE' && t.due_date < today(),
    subtaskCount: (t) => Number(t.subtask_count),
    subtaskDone: (t) => Number(t.subtask_done),
    commentCount: (t) => Number(t.comment_count),
    progress: (t) => {
      const total = Number(t.subtask_count);
      if (total) return Math.round((Number(t.subtask_done) / total) * 100);
      return t.status === 'DONE' ? 100 : 0;
    },
    subtasks: (t) => query('SELECT * FROM subtasks WHERE task_id = ? ORDER BY id', [t.id]),
    comments: (t) => query('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at, id', [t.id]),
    activity: (t) =>
      query('SELECT * FROM activity_log WHERE task_id = ? ORDER BY created_at DESC, id DESC', [t.id]),
    allowedTransitions: async (t, _, ctx) => {
      const subtasks = await query('SELECT status FROM subtasks WHERE task_id = ?', [t.id]);
      return allowedTransitions(t, t.status, subtasks, ctx.user);
    },
  },

  Subtask: {
    createdAt: (s) => s.created_at,
    checklist: (s) => query('SELECT * FROM checklist_items WHERE subtask_id = ? ORDER BY id', [s.id]),
  },

  ChecklistItem: { done: (i) => !!i.done },

  Comment: {
    createdAt: (c) => c.created_at,
    user: (c, _, ctx) => loadUser(ctx, c.user_id),
  },

  Activity: {
    createdAt: (a) => a.created_at,
    user: (a, _, ctx) => loadUser(ctx, a.user_id),
    task: (a) => (a.task_id ? getTask(a.task_id) : null),
  },
};
