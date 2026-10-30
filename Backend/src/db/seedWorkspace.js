import { query, one } from './pool.js';
import { DEFAULT_STAGES } from '../graphql/workspace.js';

const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Subelementos: [nombre, estado, días respecto a hoy, horas, responsable]
const BOARDS = [
  {
    name: 'Nuevo',
    folder: '2026',
    items: [
      {
        stage: 'En Análisis', name: 'MATRIZ DE REFINANCIAMIENTO CON CAMBIO DE PRODUCTO', area: 'Créditos', requesters: 'Gerencia de Negocios',
        assignees: ['carlos'], due: 6,
        subitems: [
          ['Análisis', 'DONE', -8, 8, 'carlos'],
          ['Integración de productos', 'IN_PROGRESS', -2, 4, 'carlos'],
          ['Integración y validación de subproductos', 'PENDING', -1, 4, 'carlos'],
          ['Pruebas de funcionalidad', 'PENDING', 2, 4, 'ana'],
          ['Documentación QA', 'PENDING', 3, 4, 'ana'],
        ],
      },
      {
        stage: 'En Desarrollo', name: 'Fábrica de Créditos - mejoras', area: 'Créditos', requesters: 'Operaciones',
        assignees: ['carlos'], due: 10,
        subitems: [
          ['Levantamiento de requerimientos', 'DONE', -10, 6, 'maria'],
          ['Ajuste de flujo de aprobación', 'IN_PROGRESS', 3, 12, 'carlos'],
          ['Pruebas integrales', 'PENDING', 8, 8, 'ana'],
        ],
      },
      {
        stage: 'En Desarrollo', name: 'Protocolos Push - Abasto', area: 'Canales digitales',
        assignees: ['maria', 'carlos'], due: 14,
        subitems: [
          ['Diseño de notificaciones', 'DONE', -5, 4, 'maria'],
          ['Servicio de envío push', 'IN_PROGRESS', 4, 10, 'carlos'],
        ],
      },
      {
        stage: 'En QA & Seguridad', name: 'Integración de funcionalidad de conversión de prospecto a formularios', area: 'CRM',
        assignees: ['maria'], due: 4,
        subitems: [
          ['Pruebas de seguridad (OWASP)', 'IN_PROGRESS', 1, 6, 'ana'],
          ['Pruebas de regresión', 'IN_PROGRESS', -1, 4, 'ana'],
        ],
      },
      {
        stage: 'En Producción', name: 'MEJORAS ABASTO WEB', area: 'Canales digitales', requesters: 'Mercadeo',
        assignees: ['maria'], due: -3,
        subitems: [
          ['Despliegue', 'DONE', -4, 2, 'carlos'],
          ['Monitoreo post-producción', 'DONE', -3, 2, 'maria'],
        ],
      },
      { stage: 'En Espera', name: 'Portal de autogestión de clientes', area: 'Canales digitales', assignees: [], due: 30, subitems: [] },
    ],
  },
  {
    name: 'Billetera',
    folder: '2026',
    items: [
      {
        stage: 'En Desarrollo', name: 'Pagos con código QR', area: 'Pagos', assignees: ['carlos'], due: 12,
        subitems: [['Generación de QR', 'IN_PROGRESS', 5, 8, 'carlos'], ['Conciliación', 'PENDING', 10, 6, 'maria']],
      },
      { stage: 'Detenido', name: 'Recarga de saldo internacional', area: 'Pagos', assignees: ['maria'], due: -5, subitems: [['Contrato con proveedor', 'IN_PROGRESS', -6, 2, 'maria']] },
    ],
  },
  {
    name: 'PRONET',
    folder: '2026',
    items: [
      {
        stage: 'En Análisis', name: 'Integración de pagos de servicios', area: 'Integraciones', assignees: ['ana'], due: 20,
        subitems: [['Revisión de API', 'IN_PROGRESS', 2, 4, 'ana']],
      },
    ],
  },
];

export async function seedWorkspaceIfEmpty() {
  const { n } = await one('SELECT COUNT(*) AS n FROM ws_boards');
  if (Number(n) > 0) return;
  const admin = await one("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'ADMIN' ORDER BY u.id LIMIT 1");
  if (!admin) return;

  const users = {};
  for (const key of ['maria', 'carlos', 'ana']) {
    users[key] = (await one('SELECT id FROM users WHERE email = ?', [`${key}@gestor.com`]))?.id ?? admin.id;
  }

  for (const b of BOARDS) {
    const board = await query('INSERT INTO ws_boards (name, folder, created_by) VALUES (?,?,?)', [b.name, b.folder, admin.id]);
    const groups = {};
    for (const [i, s] of DEFAULT_STAGES.entries()) {
      const g = await query('INSERT INTO ws_groups (board_id, name, color, position) VALUES (?,?,?,?)', [board.insertId, s.name, s.color, i]);
      groups[s.name] = g.insertId;
    }
    for (const [i, it] of b.items.entries()) {
      const item = await query(
        'INSERT INTO ws_items (board_id, group_id, name, requesters, area, due_date, position, created_by) VALUES (?,?,?,?,?,?,?,?)',
        [board.insertId, groups[it.stage], it.name, it.requesters ?? null, it.area ?? null, day(it.due), i, admin.id]
      );
      for (const a of it.assignees) {
        await query('INSERT IGNORE INTO ws_item_assignees (item_id, user_id) VALUES (?,?)', [item.insertId, users[a]]);
      }
      for (const [k, [name, status, due, hours, who]] of it.subitems.entries()) {
        const start = due - Math.max(Math.ceil(hours / 8) - 1, 0);
        await query(
          'INSERT INTO ws_subitems (item_id, name, status, start_date, due_date, hours, assignee_id, position) VALUES (?,?,?,?,?,?,?,?)',
          [item.insertId, name, status, day(start), day(due), hours, users[who], k]
        );
      }
      await query('INSERT INTO ws_activity (item_id, user_id, detail) VALUES (?,?,?)', [
        item.insertId,
        admin.id,
        `Creó el elemento en "${it.stage}"`,
      ]);
    }
  }
  console.log('🗂️  Tableros de proyectos de ejemplo creados (Nuevo, Billetera, PRONET)');
}
