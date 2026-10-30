import bcrypt from 'bcryptjs';
import { query, one } from './pool.js';
import { DEFAULT_COLUMNS, STATUS_LABEL } from '../domain.js';

const pad = (n) => String(n).padStart(2, '0');
function at(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
const day = (days) => at(days).slice(0, 10);

const USERS = [
  { key: 'admin', name: 'Administrador General', email: 'admin@gestor.com', password: 'Admin123!', role: 'ADMIN', color: '#6d5df6' },
  { key: 'maria', name: 'María López', email: 'maria@gestor.com', password: 'Miembro123!', role: 'MEMBER', color: '#f45b69' },
  { key: 'carlos', name: 'Carlos Pérez', email: 'carlos@gestor.com', password: 'Miembro123!', role: 'MEMBER', color: '#00c875' },
  { key: 'ana', name: 'Ana Gómez', email: 'ana@gestor.com', password: 'Miembro123!', role: 'MEMBER', color: '#fdab3d' },
];

const PROJECTS = [
  {
    name: 'Sistema de Gestión de Tareas',
    description: 'Proyecto final de Aseguramiento de la Calidad del Software (SDLC aplicado al propio sistema).',
    color: '#6d5df6',
    boards: [
      {
        name: 'Sprint 1 · Desarrollo',
        description: 'Construcción de los módulos principales',
        members: ['admin', 'maria', 'carlos', 'ana'],
        tasks: [
          {
            title: 'Diseñar modelo de base de datos', priority: 'HIGH', labels: 'backend,base de datos',
            assignee: 'carlos', created: -20, start: -20, due: -15, path: ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'],
            description: 'Modelo entidad-relación con proyectos, tableros, columnas, tareas y subtareas.',
            acceptance: 'El script crea todas las tablas con llaves foráneas.',
            subtasks: [
              { title: 'Diagrama ER', done: true, checklist: [['Entidades', true], ['Relaciones', true]] },
              { title: 'Script DDL', done: true },
            ],
          },
          {
            title: 'Implementar login y registro', priority: 'HIGH', labels: 'auth,seguridad',
            assignee: 'maria', created: -18, start: -17, due: -10, path: ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'],
            description: 'Autenticación con JWT, validación de correo y fortaleza de contraseña.',
            acceptance: 'No se permite registrar contraseñas débiles ni correos inválidos.',
            subtasks: [
              { title: 'Validar formato de correo', done: true },
              { title: 'Validar fortaleza de contraseña', done: true, checklist: [['8+ caracteres', true], ['Mayúscula y número', true], ['Carácter especial', true]] },
              { title: 'Recuperación de contraseña', done: true },
            ],
            comments: [['admin', 'Probado con 5 correos inválidos, todos rechazados ✅', -11]],
          },
          {
            title: 'Tablero Kanban con drag & drop', priority: 'HIGH', labels: 'frontend,ux',
            assignee: 'maria', created: -12, start: -10, due: 2, path: ['BACKLOG', 'IN_PROGRESS', 'REVIEW'],
            description: 'Mover tarjetas entre columnas respetando las reglas de transición.',
            acceptance: 'Una tarea no puede saltar de "Por hacer" a "Completado".',
            subtasks: [
              { title: 'Columnas por estado', done: true },
              { title: 'Arrastrar y soltar', done: true },
            ],
          },
          {
            title: 'Reglas de transición de estados', priority: 'HIGH', labels: 'backend,workflow',
            assignee: 'carlos', created: -9, start: -7, due: 3, path: ['BACKLOG', 'IN_PROGRESS'],
            description: 'Validar en el servidor el ciclo de vida de la tarea.',
            subtasks: [
              { title: 'Requiere responsable para iniciar', done: true },
              { title: 'Subtareas completas para revisión', done: true },
              { title: 'Completado como estado final', done: false, checklist: [['Bloquear edición', true], ['Bloquear movimiento', false]] },
            ],
          },
          {
            title: 'Dashboard con métricas', priority: 'MEDIUM', labels: 'frontend,reportes',
            assignee: 'ana', created: -10, start: -8, due: -2, path: ['BACKLOG', 'IN_PROGRESS'],
            description: 'Resumen por proyecto: totales, completadas, en progreso y vencidas.',
            subtasks: [
              { title: 'Tarjetas de indicadores', done: true },
              { title: 'Gráfica por estado', done: false },
              { title: 'Listado de vencidas', done: false },
            ],
            comments: [['admin', 'Esta tarea ya superó su fecha límite, ¿necesitas apoyo?', -1], ['ana', 'Sí, me falta la gráfica. La termino mañana.', -1]],
          },
          {
            title: 'Bitácora de actividad por tarea', priority: 'MEDIUM', labels: 'trazabilidad',
            created: -6, due: 7, path: ['BACKLOG'],
            description: 'Registrar quién creó, movió y comentó cada tarea.',
          },
          {
            title: 'Plan de pruebas y casos de prueba', priority: 'MEDIUM', labels: 'qa,documentación',
            assignee: 'ana', created: -5, start: 1, due: 5, path: ['BACKLOG'],
            description: 'Alcance, tipos de prueba, criterios de entrada/salida y 8+ casos.',
            subtasks: [{ title: 'Casos de autenticación', done: false }, { title: 'Casos de subtareas', done: false }],
          },
          {
            title: 'Configurar despliegue', priority: 'LOW', labels: 'devops',
            created: -8, due: -1, path: ['BACKLOG'],
          },
        ],
      },
      {
        name: 'QA · Bug Tracker',
        description: 'Defectos encontrados durante las pruebas',
        members: ['admin', 'maria', 'carlos', 'ana'],
        tasks: [
          {
            title: 'Login acepta correos sin dominio', type: 'BUG', priority: 'HIGH', labels: 'bug,auth',
            assignee: 'maria', created: -14, start: -14, due: -12,
            path: ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'IN_PROGRESS', 'REVIEW', 'DONE'],
            rejection: 'Sigue aceptando "usuario@dominio" sin TLD',
            description: 'CP-02: Al registrar "usuario@dominio" el sistema lo aceptaba.',
            acceptance: 'El registro rechaza correos sin dominio de nivel superior.',
            subtasks: [{ title: 'Corregir expresión regular', done: true }, { title: 'Re-ejecutar CP-02', done: true }],
            comments: [['ana', 'Reproducido en registro y en recuperación de contraseña.', -14], ['ana', 'Re-test OK. Se cierra el defecto.', -12]],
          },
          {
            title: 'Tarea se podía mover de "Por hacer" a "Completado"', type: 'BUG', priority: 'HIGH', labels: 'bug,workflow',
            assignee: 'carlos', created: -9, start: -9, due: -6, path: ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'],
            description: 'CP-05: La validación solo existía en la UI; la API permitía cualquier transición.',
            acceptance: 'La API responde TRANSITION_NOT_ALLOWED en saltos inválidos.',
            subtasks: [{ title: 'Validar transición en el servidor', done: true }],
            comments: [['admin', 'Defecto cerrado: validado vía API y vía tablero.', -6]],
          },
          {
            title: 'Porcentaje no se actualiza al marcar checklist', type: 'BUG', priority: 'MEDIUM', labels: 'bug,subtareas',
            assignee: 'maria', created: -4, start: -3, due: 2, path: ['BACKLOG', 'IN_PROGRESS', 'REVIEW'],
            description: 'CP-07: Al completar todo el checklist la subtarea seguía pendiente.',
            subtasks: [{ title: 'Recalcular estado de subtarea', done: true }],
          },
          {
            title: 'Fecha límite permite ser menor a la de inicio', type: 'BUG', priority: 'LOW', labels: 'bug,fechas',
            assignee: 'carlos', created: -2, start: -1, due: 4, path: ['BACKLOG', 'IN_PROGRESS'],
            description: 'CP-08: Se pudo guardar inicio 10/10 y fin 05/10.',
          },
        ],
      },
    ],
  },
  {
    name: 'Lanzamiento Marketing Q4',
    description: 'Campaña de fin de año',
    color: '#f45b69',
    boards: [
      {
        name: 'Campaña digital',
        members: ['admin', 'ana'],
        tasks: [
          { title: 'Definir buyer persona', priority: 'MEDIUM', labels: 'estrategia', assignee: 'ana', created: -15, due: -8, path: ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'] },
          { title: 'Calendario de publicaciones', priority: 'HIGH', labels: 'redes', assignee: 'ana', created: -6, start: -4, due: 4, path: ['BACKLOG', 'IN_PROGRESS'], subtasks: [{ title: 'Instagram', done: true }, { title: 'LinkedIn', done: false }] },
          { title: 'Diseño de banners', priority: 'LOW', labels: 'diseño', created: -3, due: 10, path: ['BACKLOG'] },
        ],
      },
    ],
  },
];

export async function seedIfEmpty() {
  const { count } = await one('SELECT COUNT(*) AS count FROM users');
  if (Number(count) > 0) return;

  const ids = {};
  for (const u of USERS) {
    const res = await query(
      'INSERT INTO users (name, email, password_hash, role_id, avatar_color, created_at) VALUES (?, ?, ?, (SELECT id FROM roles WHERE code = ?), ?, ?)',
      [u.name, u.email, await bcrypt.hash(u.password, 10), u.role, u.color, at(-30)]
    );
    ids[u.key] = res.insertId;
  }

  for (const p of PROJECTS) {
    const project = await query(
      'INSERT INTO projects (name, description, color, created_by, created_at) VALUES (?,?,?,?,?)',
      [p.name, p.description, p.color, ids.admin, at(-25)]
    );
    for (const b of p.boards) {
      const board = await query(
        'INSERT INTO boards (project_id, name, description, created_by, created_at) VALUES (?,?,?,?,?)',
        [project.insertId, b.name, b.description || null, ids.admin, at(-22)]
      );
      const boardId = board.insertId;
      const columns = {};
      for (const [i, c] of DEFAULT_COLUMNS.entries()) {
        const col = await query(
          'INSERT INTO board_columns (board_id, name, status, position, color) VALUES (?,?,?,?,?)',
          [boardId, c.name, c.status, i, c.color]
        );
        columns[c.status] = col.insertId;
      }
      for (const m of b.members) {
        await query('INSERT INTO board_members (board_id, user_id) VALUES (?,?)', [boardId, ids[m]]);
      }
      await query('INSERT INTO activity_log (board_id, user_id, action, detail, created_at) VALUES (?,?,?,?,?)', [
        boardId, ids.admin, 'BOARD_CREATED', `Creó el tablero "${b.name}"`, at(-22),
      ]);

      const positions = {};
      for (const t of b.tasks) {
        const status = t.path[t.path.length - 1];
        positions[status] = (positions[status] ?? -1) + 1;
        const creator = ids[t.creator || 'admin'];
        const assignee = t.assignee ? ids[t.assignee] : null;
        const step = (i) => at(t.created + i, 9 + i);
        const res = await query(
          `INSERT INTO tasks (board_id, column_id, title, description, type, priority, labels, acceptance_criteria,
             assignee_id, created_by, start_date, due_date, completed_at, position, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            boardId, columns[status], t.title, t.description || null, t.type || 'TASK', t.priority, t.labels || null,
            t.acceptance || null, assignee, creator, t.start != null ? day(t.start) : null,
            t.due != null ? day(t.due) : null, status === 'DONE' ? step(t.path.length - 1) : null,
            positions[status], step(0),
          ]
        );
        const taskId = res.insertId;
        const logs = [[creator, 'CREATED', `Creó la ${t.type === 'BUG' ? 'incidencia (bug)' : 'tarea'} en "Por hacer"`, step(0)]];
        if (assignee) logs.push([ids.admin, 'ASSIGNED', `Asignó la tarea a ${USERS.find((u) => u.key === t.assignee).name}`, at(t.created, 9, 5)]);
        for (let i = 1; i < t.path.length; i++) {
          const from = t.path[i - 1];
          const to = t.path[i];
          if (from === 'REVIEW' && to === 'IN_PROGRESS') {
            logs.push([ids.ana, 'REJECTED', `QA detectó defectos: regresó a "En progreso" — ${t.rejection}`, step(i)]);
          } else if (to === 'DONE') {
            logs.push([ids.admin, 'COMPLETED', 'Aprobó la revisión y cerró la tarea (Completado)', step(i)]);
          } else {
            logs.push([assignee || creator, 'MOVED', `Movió de "${STATUS_LABEL[from]}" a "${STATUS_LABEL[to]}"`, step(i)]);
          }
        }
        for (const s of t.subtasks || []) {
          const sub = await query('INSERT INTO subtasks (task_id, title, status, created_at) VALUES (?,?,?,?)', [
            taskId, s.title, s.done ? 'DONE' : 'PENDING', step(0),
          ]);
          for (const [text, done] of s.checklist || []) {
            await query('INSERT INTO checklist_items (subtask_id, text, done) VALUES (?,?,?)', [sub.insertId, text, done ? 1 : 0]);
          }
        }
        if (t.rejection) {
          const i = t.path.findIndex((s, k) => s === 'IN_PROGRESS' && t.path[k - 1] === 'REVIEW');
          await query('INSERT INTO comments (task_id, user_id, body, created_at) VALUES (?,?,?,?)', [
            taskId, ids.ana, `🐞 Defectos detectados en QA: ${t.rejection}`, step(i),
          ]);
        }
        for (const [who, body, when] of t.comments || []) {
          await query('INSERT INTO comments (task_id, user_id, body, created_at) VALUES (?,?,?,?)', [taskId, ids[who], body, at(when, 15)]);
          logs.push([ids[who], 'COMMENTED', 'Agregó un comentario', at(when, 15)]);
        }
        for (const [userId, action, detail, createdAt] of logs) {
          await query(
            'INSERT INTO activity_log (task_id, board_id, user_id, action, detail, created_at) VALUES (?,?,?,?,?,?)',
            [taskId, boardId, userId, action, detail, createdAt]
          );
        }
      }
    }
  }
  console.log('🌱 Datos de demostración creados (admin@gestor.com / Admin123!)');
}
