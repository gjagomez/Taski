import { query, one, getConnection } from '../db/pool.js';
import { requireAuth, requirePermission } from '../auth.js';
import { can } from '../permissions.js';
import { fail, required } from '../domain.js';
import { accessibleItemIds, canAccessBoardItems, canAccessItem, inList, itemScope, requireItemAccess } from '../wsAccess.js';
import {
  BUG_SEVERITY_LABEL,
  SUBITEM_STATUS_LABEL,
  allowedSubitemStatuses,
  bugReportError,
  bugVerifyError,
  isDevelopmentStage,
  isProductionStage,
  isQaStage,
  projectAssigneesError,
  projectStageError,
  qaApproveError,
  qaReviewError,
  resolutionError,
  subitemEditError,
  subitemTransitionError,
} from '../wsWorkflow.js';

/**
 * Subtareas del proyecto que aún no están Finalizadas. Por defecto, el trabajo del programador
 * (desarrollo y bugs); con 'QA', las pruebas del QA.
 */
async function openSubitems(itemId, kind = 'DEV') {
  const kinds = kind === 'DEV' ? ['DEV', 'BUG'] : [kind];
  const { n } = await one("SELECT COUNT(*) AS n FROM ws_subitems WHERE item_id = ? AND kind IN (?) AND status <> 'DONE'", [itemId, kinds]);
  return Number(n);
}

/** Bugs corregidos que el QA todavía no verificó (o bugs reabiertos que siguen abiertos). */
async function unverifiedBugs(itemId) {
  const { n } = await one("SELECT COUNT(*) AS n FROM ws_subitems WHERE item_id = ? AND kind = 'BUG' AND verified_at IS NULL", [itemId]);
  return Number(n);
}

async function addComment(subitemId, userId, kind, body) {
  const res = await query('INSERT INTO ws_subitem_comments (subitem_id, user_id, kind, body) VALUES (?,?,?,?)', [subitemId, userId, kind, body.trim()]);
  return one('SELECT * FROM ws_subitem_comments WHERE id = ?', [res.insertId]);
}

/** Primera etapa del tablero que cumple `test` (por nombre), o null. */
async function boardStage(boardId, test) {
  return (await query('SELECT * FROM ws_groups WHERE board_id = ? ORDER BY position, id', [boardId])).find((g) => test(g.name)) ?? null;
}

const QA_USERS = "SELECT u.* FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'QA' AND u.active = 1";

async function requireQaUser(id) {
  const qa = await one(`${QA_USERS} AND u.id = ?`, [id]);
  if (!qa) fail('La persona elegida no tiene el rol QA o está desactivada');
  return qa;
}

const isUser = (id, user) => id != null && Number(id) === Number(user.id);

async function nextSubitemPosition(itemId) {
  return (await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM ws_subitems WHERE item_id = ?', [itemId])).pos;
}

/** Programador que recibe los bugs: quien envió el proyecto a QA o, si no hay, el primero de la Asignación. */
async function itemDeveloperId(item) {
  if (item.developer_id) return item.developer_id;
  const first = await one('SELECT user_id FROM ws_item_assignees WHERE item_id = ? ORDER BY user_id LIMIT 1', [item.id]);
  return first?.user_id ?? null;
}

/** Valida los bugs (y su evidencia) antes de guardar nada; devuelve cada bug con sus archivos ya decodificados. */
function validateBugs(bugs) {
  if (bugs.length > 30) fail('Se pueden registrar hasta 30 bugs a la vez.');
  const prepared = bugs.map((b, i) => {
    if (blank(b.name)) fail(`El bug ${i + 1} necesita un título.`);
    if (b.name.trim().length > 200) fail(`El título del bug ${i + 1} supera 200 caracteres.`);
    return { ...b, files: validEvidence(b.evidence ?? [], `Bug ${i + 1}`) };
  });
  const total = prepared.reduce((n, b) => n + b.files.reduce((m, f) => m + f.data.length, 0), 0);
  if (total > MAX_EVIDENCE_TOTAL) fail(`La evidencia suma ${formatSize(total)}: el máximo por reporte es ${formatSize(MAX_EVIDENCE_TOTAL)}.`);
  return prepared;
}

/** Cada bug queda como tarea del programador: debe cerrarlo (con comentario) para volver a enviar a QA. */
async function insertBugs(itemId, bugs, user, developerId, testId = null) {
  for (const b of bugs) {
    const res = await query(
      "INSERT INTO ws_subitems (item_id, name, kind, severity, steps, reported_by, test_id, assignee_id, status, start_date, position) VALUES (?,?,'BUG',?,?,?,?,?,'PENDING',?,?)",
      [itemId, b.name.trim(), b.severity, blank(b.steps) ? null : b.steps.trim(), user.id, testId, developerId, today(), await nextSubitemPosition(itemId)]
    );
    for (const f of b.files) {
      await query('INSERT INTO ws_item_files (item_id, subitem_id, name, mime_type, size, data, uploaded_by) VALUES (?,?,?,?,?,?,?)', [
        itemId,
        res.insertId,
        f.name,
        f.mime,
        f.data.length,
        f.data,
        user.id,
      ]);
    }
  }
}


// Etapas por defecto de cada tablero nuevo (grupos estilo Monday)
export const DEFAULT_STAGES = [
  { name: 'En Desarrollo', color: '#fdab3d' },
  { name: 'En QA & Seguridad', color: '#579bfc' },
  { name: 'En Producción', color: '#00c875' },
  { name: 'Detenido', color: '#e2445c' },
  { name: 'En Espera', color: '#a25ddc' },
  { name: 'En Análisis', color: '#ff7a45' },
];

export const HOURS_PER_DAY = Number(process.env.WORK_HOURS_PER_DAY || 8);

/** Horas laborales entre dos fechas (inclusive), contando solo de lunes a viernes. */
export function workingHours(start, end) {
  if (!start || !end || end < start) return null;
  const day = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let days = 0;
  while (day <= last) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) days++;
    day.setDate(day.getDate() + 1);
  }
  return days * HOURS_PER_DAY;
}

// Archivos de evidencia: se guardan en MySQL (LONGBLOB) y viajan en base64 por GraphQL
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_UPDATE_IMAGES = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Tipo real de una imagen por su firma (magic bytes). SVG no se acepta: puede contener scripts. */
function imageType(data) {
  const hex = data.subarray(0, 12).toString('hex');
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('474946383761') || hex.startsWith('474946383961')) return 'image/gif';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
  return null;
}

const IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Valida las imágenes de una actualización antes de guardar nada. */
function validImages(images = []) {
  if (images.length > MAX_UPDATE_IMAGES) fail(`Se permiten hasta ${MAX_UPDATE_IMAGES} imágenes por actualización`);
  return images.map((img, i) => {
    const data = Buffer.from(img.dataBase64, 'base64');
    if (!data.length) fail(`La imagen ${i + 1} está vacía`);
    if (data.length > MAX_IMAGE_BYTES) fail(`La imagen "${img.name}" supera el máximo de ${formatSize(MAX_IMAGE_BYTES)}`);
    const mime = imageType(data);
    if (!mime) fail(`"${img.name}" no es una imagen válida (se aceptan PNG, JPEG, GIF y WebP)`);
    const base = img.name.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]*$/, '').slice(0, 200) || `imagen-${i + 1}`;
    return { name: `${base}.${IMAGE_EXT[mime]}`, mime, data };
  });
}
const MAX_EVIDENCE_FILES = 5;
// El cuerpo de la petición admite 50 MB y el base64 ocupa ~4/3: el total de evidencia por reporte queda en 30 MB
const MAX_EVIDENCE_TOTAL = 30 * 1024 * 1024;
const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

/** Tipo real de un video por su firma: MP4/MOV (caja "ftyp") o WebM (EBML). */
function videoType(data) {
  if (data.subarray(4, 8).toString('latin1') === 'ftyp') return data.subarray(8, 10).toString('latin1') === 'qt' ? 'video/quicktime' : 'video/mp4';
  if (data.subarray(0, 4).toString('hex') === '1a45dfa3') return 'video/webm';
  return null;
}

/** Evidencia de un bug: imágenes (PNG, JPEG, GIF, WebP) o videos (MP4, MOV, WebM) validados por su contenido. */
function validEvidence(files = [], label) {
  if (files.length > MAX_EVIDENCE_FILES) fail(`${label}: se permiten hasta ${MAX_EVIDENCE_FILES} archivos de evidencia.`);
  return files.map((f, i) => {
    const data = Buffer.from(f.dataBase64, 'base64');
    if (!data.length) fail(`${label}: la evidencia ${i + 1} está vacía.`);
    if (data.length > MAX_FILE_BYTES) fail(`"${f.name}" supera el máximo de ${formatSize(MAX_FILE_BYTES)}.`);
    const mime = imageType(data) ?? videoType(data);
    if (!mime) fail(`"${f.name}" no es una imagen ni un video válido (PNG, JPEG, GIF, WebP, MP4, MOV o WebM).`);
    const base = f.name.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]*$/, '').slice(0, 200) || `evidencia-${i + 1}`;
    return { name: `${base}.${IMAGE_EXT[mime] ?? VIDEO_EXT[mime]}`, mime, data };
  });
}

const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'com', 'msi', 'ps1', 'sh', 'vbs', 'scr', 'jar'];

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}



export const workspaceTypeDefs = `#graphql
  enum SubitemStatus { PENDING IN_PROGRESS DONE }
  "DEV = tarea de desarrollo; QA = prueba del QA; BUG = defecto reportado por el QA (lo corrige el programador)"
  enum SubitemKind { DEV QA BUG }
  enum BugSeverity { CRITICAL HIGH MEDIUM LOW }
  "COMMENT = libre; RESOLUTION = cierre de un bug; VERIFIED / REOPENED = verificación del QA"
  enum CommentKind { COMMENT RESOLUTION VERIFIED REOPENED }

  type WsBoard {
    id: ID!
    name: String!
    folder: String
    description: String
    createdAt: String!
    itemCount: Int!
    groups: [WsGroup!]!
  }

  type WsGroup {
    id: ID!
    name: String!
    color: String!
    position: Int!
    items: [WsItem!]!
  }

  type WsItem {
    id: ID!
    name: String!
    requesters: String
    area: String
    dueDate: String
    position: Int!
    createdAt: String!
    createdBy: User!
    group: WsGroup!
    "Etapa de QA del tablero, destino del botón Enviar a QA"
    qaGroup: WsGroup
    "Etapa En Desarrollo del tablero, destino de Regresar a desarrollo"
    devGroup: WsGroup
    "QA que revisa el proyecto (rol QA)"
    qa: User
    "Programador que lo envió a QA: recibe las correcciones si el QA lo rechaza"
    developer: User
    board: WsBoard!
    assignees: [User!]!
    subitems: [WsSubitem!]!
    subitemCount: Int!
    progress: Int!
    totalHours: Float!
    updateCount: Int!
    updates: [WsUpdate!]!
    activity: [WsActivity!]!
    files: [WsFile!]!
  }

  type WsFile {
    id: ID!
    name: String!
    mimeType: String!
    size: Int!
    createdAt: String!
    uploadedBy: User!
  }

  type WsFileContent { id: ID!, name: String!, mimeType: String!, dataBase64: String! }

  type WsSubitem {
    id: ID!
    name: String!
    kind: SubitemKind!
    status: SubitemStatus!
    startDate: String
    dueDate: String
    hours: Float
    isOverdue: Boolean!
    assignee: User
    completedAt: String
    "Estados a los que el usuario actual puede mover la tarea según las reglas del flujo"
    allowedStatuses: [SubitemStatus!]!
    "Solo bugs: gravedad, pasos para reproducir, quién lo reportó, reaperturas y verificación del QA"
    severity: BugSeverity
    steps: String
    reportedBy: User
    reopenCount: Int!
    verifiedAt: String
    "Bug al que pertenece esta tarea de desarrollo (si se creó para resolverlo)"
    parentId: ID
    "Solo bugs: prueba de QA en la que se encontró"
    testId: ID
    "Solo bugs: imágenes y videos que adjuntó el QA (solo metadatos)"
    evidence: [WsFile!]!
    commentCount: Int!
  }

  type WsSubitemComment { id: ID!, kind: CommentKind!, body: String!, user: User!, createdAt: String! }

  "Bug que reporta el QA; evidence: capturas o videos del defecto (PNG/JPEG/GIF/WebP o MP4/MOV/WebM)"
  input WsBugInput { name: String!, severity: BugSeverity!, steps: String, evidence: [WsImageInput!] }

  type WsUpdate { id: ID!, body: String!, user: User!, createdAt: String!, images: [WsUpdateImage!]! }
  type WsUpdateImage { id: ID!, name: String!, mimeType: String!, size: Int!, dataBase64: String! }

  "Imagen adjunta a una actualización: PNG, JPEG, GIF o WebP (se verifica el contenido, no solo la extensión)"
  input WsImageInput { name: String!, mimeType: String!, dataBase64: String! }
  type WsActivity { id: ID!, detail: String!, user: User!, createdAt: String! }

  input WsItemInput {
    name: String
    requesters: String
    area: String
    dueDate: String
    groupId: ID
    assigneeIds: [ID!]
    "QA que revisará el proyecto (obligatorio al enviarlo a la etapa de QA si aún no tiene)"
    qaId: ID
  }

  input WsSubitemInput {
    name: String
    status: SubitemStatus
    startDate: String
    dueDate: String
    hours: Float
    assigneeId: ID
    "Solo al crear: QA = prueba del QA (por defecto, si la crea el QA del proyecto)"
    kind: SubitemKind
    "Solo al crear: bug que esta tarea ayuda a resolver"
    parentId: ID
    "Comentario que acompaña el cambio (obligatorio al finalizar un bug: comentario de resolución)"
    comment: String
    "Motivo opcional cuando el administrador reabre una subtarea Finalizada (p. ej. defectos encontrados en QA)"
    reason: String
  }

  type WsTotals {
    boards: Int!
    items: Int!
    subitems: Int!
    subitemsDone: Int!
    hoursPlanned: Float!
    hoursDone: Float!
    overdue: Int!
    files: Int!
    completionRate: Int!
  }

  type WsStageCount { name: String!, color: String!, items: Int! }
  type WsStatusCount { status: SubitemStatus!, count: Int!, hours: Float! }

  type WsWorkload {
    user: User!
    tasks: Int!
    overdue: Int!
    hoursPending: Float!
    hoursInProgress: Float!
    hoursDone: Float!
  }

  type WsBoardSummary {
    board: WsBoard!
    items: Int!
    subitems: Int!
    subitemsDone: Int!
    hours: Float!
    overdue: Int!
    progress: Int!
  }

  type WsAgendaEntry {
    subitem: WsSubitem!
    itemId: ID!
    itemName: String!
    boardId: ID!
    boardName: String!
    stageName: String!
    stageColor: String!
  }

  type WsActivityEntry {
    id: ID!
    detail: String!
    createdAt: String!
    user: User!
    itemId: ID!
    itemName: String!
    boardId: ID!
    boardName: String!
  }

  type WsBugSeverityCount { severity: BugSeverity!, count: Int! }
  type WsBugDeveloper { user: User!, total: Int!, open: Int!, reopens: Int! }

  "Calidad: bugs que reportó el QA en los proyectos visibles"
  type WsBugStats {
    total: Int!
    open: Int!
    toVerify: Int!
    verified: Int!
    reopens: Int!
    "Porcentaje de bugs que el QA tuvo que reabrir al menos una vez"
    reopenRate: Int!
    bySeverity: [WsBugSeverityCount!]!
    byDeveloper: [WsBugDeveloper!]!
  }

  type WsDashboard {
    totals: WsTotals!
    bugs: WsBugStats!
    byStage: [WsStageCount!]!
    byStatus: [WsStatusCount!]!
    workload: [WsWorkload!]!
    boards: [WsBoardSummary!]!
    upcoming: [WsAgendaEntry!]!
    overdue: [WsAgendaEntry!]!
    recentActivity: [WsActivityEntry!]!
  }

  type WsFolder { name: String!, boardCount: Int! }

  extend type Query {
    wsFolders: [WsFolder!]!
    wsDashboard: WsDashboard!
    wsMySubitems: [WsAgendaEntry!]!
    wsActivity(limit: Int): [WsActivityEntry!]!
    wsBoards: [WsBoard!]!
    wsBoard(id: ID!): WsBoard
    wsItem(id: ID!): WsItem
    wsFileContent(id: ID!): WsFileContent
    "Usuarios activos con el rol QA (para elegir quién revisa un proyecto)"
    wsQaUsers: [User!]!
    wsSubitemComments(subitemId: ID!): [WsSubitemComment!]!
  }

  extend type Mutation {
    createWsFolder(name: String!): WsFolder!
    deleteWsFolder(name: String!): Boolean!

    createWsBoard(name: String!, folder: String, description: String): WsBoard!
    updateWsBoard(id: ID!, name: String!, folder: String): WsBoard!
    deleteWsBoard(id: ID!): Boolean!

    createWsGroup(boardId: ID!, name: String!, color: String!): WsGroup!
    updateWsGroup(id: ID!, name: String, color: String): WsGroup!
    deleteWsGroup(id: ID!): Boolean!
    "Nuevo orden de las etapas del tablero (todas sus etapas, de primera a última)"
    reorderWsGroups(boardId: ID!, groupIds: [ID!]!): [WsGroup!]!

    createWsItem(groupId: ID!, name: String!): WsItem!
    updateWsItem(id: ID!, input: WsItemInput!): WsItem!
    deleteWsItem(id: ID!): Boolean!
    "El QA devuelve el proyecto a En Desarrollo: cada bug queda como tarea del programador que lo envió"
    rejectWsItemQa(id: ID!, bugs: [WsBugInput!]!): WsItem!
    "El QA reporta bugs desde una de sus pruebas (proyecto en QA): quedan del programador; con returnToDev el proyecto vuelve a desarrollo"
    reportWsBug(testId: ID!, bugs: [WsBugInput!]!, returnToDev: Boolean): WsItem!
    "El QA aprueba el proyecto (pruebas finalizadas y bugs verificados): pasa a Producción"
    approveWsItemQa(id: ID!): WsItem!
    "El QA verifica un bug corregido (ok) o lo reabre (comentario obligatorio)"
    verifyWsBug(id: ID!, ok: Boolean!, comment: String): WsSubitem!
    addWsSubitemComment(subitemId: ID!, body: String!): WsSubitemComment!

    createWsSubitem(itemId: ID!, name: String!, input: WsSubitemInput): WsSubitem!
    updateWsSubitem(id: ID!, input: WsSubitemInput!): WsSubitem!
    deleteWsSubitem(id: ID!): Boolean!

    "El texto puede ir vacío si la actualización lleva imágenes"
    addWsUpdate(itemId: ID!, body: String!, images: [WsImageInput!]): WsUpdate!

    uploadWsFile(itemId: ID!, name: String!, mimeType: String, dataBase64: String!): WsFile!
    deleteWsFile(id: ID!): Boolean!
  }
`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const userById = (ctx, id) => {
  if (!id) return null;
  if (!ctx.userCache.has(id)) ctx.userCache.set(id, one('SELECT * FROM users WHERE id = ?', [id]));
  return ctx.userCache.get(id);
};

async function getItem(id) {
  const item = await one('SELECT * FROM ws_items WHERE id = ?', [id]);
  if (!item) fail('El elemento no existe', 'NOT_FOUND');
  return item;
}

async function logItem(itemId, userId, detail) {
  await query('INSERT INTO ws_activity (item_id, user_id, detail) VALUES (?,?,?)', [itemId, userId, detail]);
}

function validDate(value, label) {
  if (blank(value)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) fail(`La ${label} no es válida`);
  return value;
}

const num = (v) => Number(v || 0);

const AGENDA_SELECT = `
  SELECT s.*, i.id AS item_id, i.name AS item_name, b.id AS board_id, b.name AS board_name,
    g.name AS stage_name, g.color AS stage_color
  FROM ws_subitems s
  JOIN ws_items i ON i.id = s.item_id
  JOIN ws_boards b ON b.id = i.board_id
  JOIN ws_groups g ON g.id = i.group_id`;

const agendaEntry = (r) => ({
  subitem: r,
  itemId: r.item_id,
  itemName: r.item_name,
  boardId: r.board_id,
  boardName: r.board_name,
  stageName: r.stage_name,
  stageColor: r.stage_color,
});

const ACTIVITY_SELECT = `
  SELECT a.*, i.name AS item_name, i.board_id, b.name AS board_name
  FROM ws_activity a JOIN ws_items i ON i.id = a.item_id JOIN ws_boards b ON b.id = i.board_id`;

const activityEntry = (a) => ({
  id: a.id,
  detail: a.detail,
  createdAt: a.created_at,
  user: a.user_id,
  itemId: a.item_id,
  itemName: a.item_name,
  boardId: a.board_id,
  boardName: a.board_name,
});

/** Métricas del espacio de trabajo (los tableros y proyectos que el usuario puede ver). */
async function buildDashboard(ctx) {
  const { sql: sc, params: p } = await itemScope(ctx);
  // Tableros visibles: el administrador ve todos (incluso vacíos); el colaborador, los de sus proyectos
  const { sql: bsc, params: bp } = (await accessibleItemIds(ctx))
    ? { sql: `b.id IN (SELECT i.board_id FROM ws_items i WHERE ${sc})`, params: p }
    : { sql: '1=1', params: [] };
  const [totals, files, boards, byStage, byStatus, workload, perBoard, upcoming, overdue, activity, bugTotals, bugSeverity, bugDevelopers] = await Promise.all([
    one(
      `SELECT
        (SELECT COUNT(*) FROM ws_items i WHERE ${sc}) AS items,
        COUNT(s.id) AS subitems,
        SUM(s.status = 'DONE') AS subitemsDone,
        COALESCE(SUM(s.hours), 0) AS hoursPlanned,
        COALESCE(SUM(CASE WHEN s.status = 'DONE' THEN s.hours END), 0) AS hoursDone,
        SUM(s.due_date < CURDATE() AND s.status <> 'DONE') AS overdue
      FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id WHERE ${sc}`,
      [...p, ...p]
    ),
    one(`SELECT COUNT(*) AS n FROM ws_item_files f JOIN ws_items i ON i.id = f.item_id WHERE ${sc}`, p),
    one(`SELECT COUNT(*) AS n FROM ws_boards b WHERE ${bsc}`, bp),
    // Las etapas se agrupan por nombre entre tableros (cada tablero tiene sus propios grupos)
    query(
      `SELECT g.name, MIN(g.color) AS color, MIN(g.position) AS pos, COUNT(i.id) AS items
      FROM ws_groups g JOIN ws_boards b ON b.id = g.board_id LEFT JOIN ws_items i ON i.group_id = g.id AND ${sc}
      WHERE ${bsc}
      GROUP BY g.name ORDER BY pos, g.name`,
      [...p, ...bp]
    ),
    query(
      `SELECT s.status, COUNT(*) AS count, COALESCE(SUM(s.hours), 0) AS hours
      FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id WHERE ${sc} GROUP BY s.status`,
      p
    ),
    query(`SELECT u.*,
        COUNT(s.id) AS tasks,
        SUM(s.due_date < CURDATE() AND s.status <> 'DONE') AS overdue_count,
        COALESCE(SUM(CASE WHEN s.status = 'PENDING' THEN s.hours END), 0) AS h_pending,
        COALESCE(SUM(CASE WHEN s.status = 'IN_PROGRESS' THEN s.hours END), 0) AS h_progress,
        COALESCE(SUM(CASE WHEN s.status = 'DONE' THEN s.hours END), 0) AS h_done
      FROM users u JOIN ws_subitems s ON s.assignee_id = u.id JOIN ws_items i ON i.id = s.item_id
      WHERE ${sc}
      GROUP BY u.id ORDER BY SUM(CASE WHEN s.status <> 'DONE' THEN s.hours ELSE 0 END) DESC, u.name`, p),
    query(
      `SELECT b.*,
        COUNT(DISTINCT i.id) AS n_items,
        COUNT(s.id) AS n_sub,
        SUM(s.status = 'DONE') AS n_done,
        COALESCE(SUM(s.hours), 0) AS n_hours,
        SUM(s.due_date < CURDATE() AND s.status <> 'DONE') AS n_overdue
      FROM ws_boards b
      LEFT JOIN ws_items i ON i.board_id = b.id AND ${sc}
      LEFT JOIN ws_subitems s ON s.item_id = i.id
      WHERE ${bsc}
      GROUP BY b.id ORDER BY b.folder, b.created_at, b.id`,
      [...p, ...bp]
    ),
    query(`${AGENDA_SELECT} WHERE s.status <> 'DONE' AND s.due_date >= CURDATE() AND ${sc}
      ORDER BY s.due_date, s.start_date LIMIT 8`, p),
    query(`${AGENDA_SELECT} WHERE s.status <> 'DONE' AND s.due_date < CURDATE() AND ${sc}
      ORDER BY s.due_date LIMIT 8`, p),
    query(`${ACTIVITY_SELECT} WHERE ${sc} ORDER BY a.created_at DESC, a.id DESC LIMIT 10`, p),
    one(
      `SELECT COUNT(*) AS total,
        SUM(s.status <> 'DONE') AS open,
        SUM(s.status = 'DONE' AND s.verified_at IS NULL) AS to_verify,
        SUM(s.verified_at IS NOT NULL) AS verified,
        COALESCE(SUM(s.reopen_count), 0) AS reopens,
        SUM(s.reopen_count > 0) AS reopened
      FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id WHERE s.kind = 'BUG' AND ${sc}`,
      p
    ),
    query(
      `SELECT s.severity, COUNT(*) AS count FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id
      WHERE s.kind = 'BUG' AND s.severity IS NOT NULL AND ${sc} GROUP BY s.severity`,
      p
    ),
    query(
      `SELECT u.*, COUNT(*) AS bugs, SUM(s.status <> 'DONE') AS open_bugs, COALESCE(SUM(s.reopen_count), 0) AS reopens
      FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id JOIN users u ON u.id = s.assignee_id
      WHERE s.kind = 'BUG' AND ${sc}
      GROUP BY u.id ORDER BY COUNT(*) DESC, u.name`,
      p
    ),
  ]);

  const subitems = num(totals.subitems);
  const done = num(totals.subitemsDone);
  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s]));
  return {
    totals: {
      boards: num(boards.n),
      items: num(totals.items),
      subitems,
      subitemsDone: done,
      hoursPlanned: num(totals.hoursPlanned),
      hoursDone: num(totals.hoursDone),
      overdue: num(totals.overdue),
      files: num(files.n),
      completionRate: subitems ? Math.round((done / subitems) * 100) : 0,
    },
    bugs: {
      total: num(bugTotals.total),
      open: num(bugTotals.open),
      toVerify: num(bugTotals.to_verify),
      verified: num(bugTotals.verified),
      reopens: num(bugTotals.reopens),
      reopenRate: num(bugTotals.total) ? Math.round((num(bugTotals.reopened) / num(bugTotals.total)) * 100) : 0,
      bySeverity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => ({
        severity,
        count: num(bugSeverity.find((b) => b.severity === severity)?.count),
      })),
      byDeveloper: bugDevelopers.map((d) => ({ user: d, total: num(d.bugs), open: num(d.open_bugs), reopens: num(d.reopens) })),
    },
    byStage: byStage.map((s) => ({ name: s.name, color: s.color, items: num(s.items) })),
    byStatus: ['DONE', 'IN_PROGRESS', 'PENDING'].map((status) => ({
      status,
      count: num(statusMap[status]?.count),
      hours: num(statusMap[status]?.hours),
    })),
    workload: workload.map((w) => ({
      user: w,
      tasks: num(w.tasks),
      overdue: num(w.overdue_count),
      hoursPending: num(w.h_pending),
      hoursInProgress: num(w.h_progress),
      hoursDone: num(w.h_done),
    })),
    boards: perBoard.map((b) => ({
      board: b,
      items: num(b.n_items),
      subitems: num(b.n_sub),
      subitemsDone: num(b.n_done),
      hours: num(b.n_hours),
      overdue: num(b.n_overdue),
      progress: num(b.n_sub) ? Math.round((num(b.n_done) / num(b.n_sub)) * 100) : 0,
    })),
    upcoming: upcoming.map(agendaEntry),
    overdue: overdue.map(agendaEntry),
    recentActivity: activity.map(activityEntry),
  };
}

export const workspaceResolvers = {
  WsActivityEntry: {
    user: (a, _, ctx) => userById(ctx, a.user),
  },

  Query: {
    // Carpetas creadas explícitamente + las que ya usan los tableros (compatibilidad)
    wsFolders: async (_, __, ctx) => {
      requireAuth(ctx);
      const ids = await accessibleItemIds(ctx);
      const rows = ids
        ? await query(
            `SELECT b.folder AS name, COUNT(DISTINCT b.id) AS boardCount FROM ws_boards b JOIN ws_items i ON i.board_id = b.id
             WHERE b.folder IS NOT NULL AND i.id IN (?) GROUP BY b.folder`,
            [inList(ids)]
          )
        : await query(`
        SELECT f.name, COUNT(b.id) AS boardCount FROM (
          SELECT name FROM ws_folders
          UNION SELECT folder FROM ws_boards WHERE folder IS NOT NULL
        ) f LEFT JOIN ws_boards b ON b.folder = f.name
        GROUP BY f.name`);
      // Años en orden numérico; otros nombres después, en orden alfabético
      return rows
        .map((r) => ({ name: r.name, boardCount: num(r.boardCount) }))
        .sort((a, b) => {
          const ya = /^\d{4}$/.test(a.name);
          const yb = /^\d{4}$/.test(b.name);
          if (ya && yb) return Number(a.name) - Number(b.name);
          if (ya !== yb) return ya ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    },
    wsDashboard: (_, __, ctx) => {
      requireAuth(ctx);
      return buildDashboard(ctx);
    },
    // "Mis tareas": subtareas asignadas al usuario (abiertas primero, por fecha final)
    wsMySubitems: async (_, __, ctx) => {
      const user = requireAuth(ctx);
      const rows = await query(
        `${AGENDA_SELECT} WHERE s.assignee_id = ?
         ORDER BY s.status = 'DONE', s.due_date IS NULL, s.due_date, s.start_date, s.id`,
        [user.id]
      );
      return rows.map(agendaEntry);
    },
    wsActivity: async (_, { limit = 100 }, ctx) => {
      requireAuth(ctx);
      const scope = await itemScope(ctx);
      const rows = await query(`${ACTIVITY_SELECT} WHERE ${scope.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ?`, [
        ...scope.params,
        Math.min(limit, 300),
      ]);
      return rows.map(activityEntry);
    },
    wsBoards: async (_, __, ctx) => {
      requireAuth(ctx);
      const ids = await accessibleItemIds(ctx);
      if (!ids) return query('SELECT * FROM ws_boards ORDER BY folder IS NULL, folder, created_at, id');
      return query(
        'SELECT * FROM ws_boards WHERE id IN (SELECT board_id FROM ws_items WHERE id IN (?)) ORDER BY folder IS NULL, folder, created_at, id',
        [inList(ids)]
      );
    },
    wsBoard: async (_, { id }, ctx) => {
      requireAuth(ctx);
      if (!(await canAccessBoardItems(ctx, id))) return null;
      return one('SELECT * FROM ws_boards WHERE id = ?', [id]);
    },
    wsItem: async (_, { id }, ctx) => {
      requireAuth(ctx);
      if (!(await canAccessItem(ctx, id))) return null;
      return one('SELECT * FROM ws_items WHERE id = ?', [id]);
    },
    wsFileContent: async (_, { id }, ctx) => {
      requireAuth(ctx);
      const file = await one('SELECT id, item_id, name, mime_type, data FROM ws_item_files WHERE id = ?', [id]);
      if (!file || !(await canAccessItem(ctx, file.item_id))) return null;
      return { id: file.id, name: file.name, mimeType: file.mime_type, dataBase64: file.data.toString('base64') };
    },
    wsSubitemComments: async (_, { subitemId }, ctx) => {
      requireAuth(ctx);
      const sub = await one('SELECT item_id FROM ws_subitems WHERE id = ?', [subitemId]);
      if (!sub || !(await canAccessItem(ctx, sub.item_id))) return [];
      return query('SELECT * FROM ws_subitem_comments WHERE subitem_id = ? ORDER BY created_at, id', [subitemId]);
    },
    wsQaUsers: (_, __, ctx) => {
      requireAuth(ctx);
      return query(`${QA_USERS} ORDER BY u.name`);
    },
  },

  Mutation: {
    createWsFolder: async (_, { name }, ctx) => {
      const admin = requirePermission(ctx, 'boards.manage');
      required({ Nombre: name });
      const clean = name.trim();
      if (clean.length > 80) fail('El nombre no puede superar 80 caracteres');
      if (/^\d+$/.test(clean) && !/^(19|20|21)\d{2}$/.test(clean)) fail('Ingresa un año válido de 4 dígitos (ej. 2027)');
      const exists = await one(
        'SELECT 1 AS x FROM ws_folders WHERE name = ? UNION SELECT 1 FROM ws_boards WHERE folder = ? LIMIT 1',
        [clean, clean]
      );
      if (exists) fail(`La carpeta "${clean}" ya existe`);
      await query('INSERT INTO ws_folders (name, created_by) VALUES (?,?)', [clean, admin.id]);
      return { name: clean, boardCount: 0 };
    },

    deleteWsFolder: async (_, { name }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      const { n } = await one('SELECT COUNT(*) AS n FROM ws_boards WHERE folder = ?', [name]);
      if (Number(n) > 0) fail('La carpeta tiene tableros. Muévelos o elimínalos antes de borrarla.');
      await query('DELETE FROM ws_folders WHERE name = ?', [name]);
      return true;
    },

    createWsBoard: async (_, { name, folder, description }, ctx) => {
      const admin = requirePermission(ctx, 'boards.manage');
      required({ Nombre: name });
      const conn = await getConnection();
      try {
        await conn.beginTransaction();
        const [res] = await conn.query(
          'INSERT INTO ws_boards (name, folder, description, created_by) VALUES (?,?,?,?)',
          [name.trim(), blank(folder) ? null : folder.trim(), blank(description) ? null : description, admin.id]
        );
        for (const [i, stage] of DEFAULT_STAGES.entries()) {
          await conn.query('INSERT INTO ws_groups (board_id, name, color, position) VALUES (?,?,?,?)', [
            res.insertId,
            stage.name,
            stage.color,
            i,
          ]);
        }
        await conn.commit();
        return one('SELECT * FROM ws_boards WHERE id = ?', [res.insertId]);
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    updateWsBoard: async (_, { id, name, folder }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      required({ Nombre: name });
      await query('UPDATE ws_boards SET name = ?, folder = ? WHERE id = ?', [
        name.trim(),
        blank(folder) ? null : folder.trim(),
        id,
      ]);
      return one('SELECT * FROM ws_boards WHERE id = ?', [id]);
    },

    // Solo se elimina un tablero vacío: así nunca se pierden proyectos, subtareas ni evidencias por accidente
    deleteWsBoard: async (_, { id }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      const board = await one('SELECT id, name FROM ws_boards WHERE id = ?', [id]);
      if (!board) return true;
      const { n } = await one('SELECT COUNT(*) AS n FROM ws_items WHERE board_id = ?', [id]);
      if (Number(n) > 0) {
        fail(`El tablero "${board.name}" tiene ${n} elemento(s). Elimínalos o muévelos antes de borrar el tablero.`);
      }
      await query('DELETE FROM ws_boards WHERE id = ?', [id]);
      return true;
    },

    createWsGroup: async (_, { boardId, name, color }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      required({ Nombre: name });
      const { pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM ws_groups WHERE board_id = ?', [boardId]);
      const res = await query('INSERT INTO ws_groups (board_id, name, color, position) VALUES (?,?,?,?)', [
        boardId,
        name.trim(),
        color,
        pos,
      ]);
      return one('SELECT * FROM ws_groups WHERE id = ?', [res.insertId]);
    },

    reorderWsGroups: async (_, { boardId, groupIds }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      const current = (await query('SELECT id FROM ws_groups WHERE board_id = ?', [boardId])).map((g) => String(g.id));
      const ids = groupIds.map(String);
      if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
        fail('El orden debe incluir exactamente todas las etapas del tablero');
      }
      const conn = await getConnection();
      try {
        await conn.beginTransaction();
        for (const [position, id] of ids.entries()) {
          await conn.query('UPDATE ws_groups SET position = ? WHERE id = ? AND board_id = ?', [position, id, boardId]);
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      return query('SELECT * FROM ws_groups WHERE board_id = ? ORDER BY position, id', [boardId]);
    },

    updateWsGroup: async (_, { id, name, color }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      if (name !== undefined && name !== null) required({ Nombre: name });
      await query('UPDATE ws_groups SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?', [
        name?.trim() ?? null,
        color ?? null,
        id,
      ]);
      return one('SELECT * FROM ws_groups WHERE id = ?', [id]);
    },

    deleteWsGroup: async (_, { id }, ctx) => {
      requirePermission(ctx, 'boards.manage');
      const { n } = await one('SELECT COUNT(*) AS n FROM ws_items WHERE group_id = ?', [id]);
      if (Number(n) > 0) fail('El grupo tiene elementos. Muévelos o elimínalos antes de borrar el grupo.');
      await query('DELETE FROM ws_groups WHERE id = ?', [id]);
      return true;
    },

    createWsItem: async (_, { groupId, name }, ctx) => {
      const user = requireAuth(ctx);
      required({ Nombre: name });
      const group = await one('SELECT * FROM ws_groups WHERE id = ?', [groupId]);
      if (!group) fail('El grupo no existe');
      if (!(await canAccessBoardItems(ctx, group.board_id))) fail('No tienes acceso a este tablero', 'FORBIDDEN');
      const { pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM ws_items WHERE group_id = ?', [groupId]);
      const res = await query(
        'INSERT INTO ws_items (board_id, group_id, name, position, created_by) VALUES (?,?,?,?,?)',
        [group.board_id, groupId, name.trim(), pos, user.id]
      );
      // Sin ver todos los proyectos, quien lo crea queda asignado (si no, dejaría de verlo)
      if (!can(user, 'projects.viewAll')) await query('INSERT INTO ws_item_assignees (item_id, user_id) VALUES (?,?)', [res.insertId, user.id]);
      await logItem(res.insertId, user.id, `Creó el elemento en "${group.name}"`);
      return one('SELECT * FROM ws_items WHERE id = ?', [res.insertId]);
    },

    updateWsItem: async (_, { id, input }, ctx) => {
      const user = requireAuth(ctx);
      await requireItemAccess(ctx, id);
      const item = await getItem(id);
      // Se valida antes de escribir nada, para no dejar cambios a medias
      const currentAssignees = (await query('SELECT user_id FROM ws_item_assignees WHERE item_id = ?', [id])).map((r) => r.user_id);
      if (input.assigneeIds) {
        const assignError = projectAssigneesError(user, currentAssignees, input.assigneeIds);
        if (assignError) fail(assignError, 'FORBIDDEN');
      }
      const stageChange = input.groupId !== undefined && String(input.groupId) !== String(item.group_id);
      const target = stageChange ? await one('SELECT * FROM ws_groups WHERE id = ? AND board_id = ?', [input.groupId, item.board_id]) : null;
      if (stageChange && !target) fail('La etapa seleccionada no pertenece a este tablero');
      const enteringQa = !!target && isQaStage(target.name);
      const currentStage = await one('SELECT name FROM ws_groups WHERE id = ?', [item.group_id]);
      // El QA se elige al enviar el proyecto a QA (o si quedó en QA sin uno); cambiarlo después es de quien asigna personas
      const qa = blank(input.qaId) ? null : await requireQaUser(input.qaId);
      const completingQa = !!qa && !stageChange && isQaStage(currentStage.name) && !item.qa_id;
      if (qa && !enteringQa && !completingQa && !can(user, 'projects.assignOthers')) {
        fail('Solo un administrador puede cambiar el QA del proyecto.', 'FORBIDDEN');
      }
      const qaId = qa?.id ?? item.qa_id;
      if (enteringQa && !qaId) fail('Elige al QA que revisará el proyecto.');
      const sets = [];
      const params = [];
      const changes = [];

      if (input.name !== undefined) {
        required({ Nombre: input.name });
        sets.push('name = ?');
        params.push(input.name.trim());
        if (input.name.trim() !== item.name) changes.push('nombre');
      }
      if (input.requesters !== undefined) {
        sets.push('requesters = ?');
        params.push(blank(input.requesters) ? null : input.requesters.trim());
        changes.push('solicitantes');
      }
      if (input.area !== undefined) {
        sets.push('area = ?');
        params.push(blank(input.area) ? null : input.area.trim());
        changes.push('área');
      }
      if (input.dueDate !== undefined) {
        const due = validDate(input.dueDate, 'fecha');
        sets.push('due_date = ?');
        params.push(due);
        changes.push(`fecha → ${due ?? 'sin fecha'}`);
      }
      if (stageChange) {
        const group = target;
        const from = await one('SELECT name FROM ws_groups WHERE id = ?', [item.group_id]);
        const { n: qaTesting } = await one("SELECT COUNT(*) AS n FROM ws_subitems WHERE item_id = ? AND kind = 'QA' AND status = 'IN_PROGRESS'", [item.id]);
        const stageError = projectStageError(user, from.name, group.name, await openSubitems(item.id), {
          member: currentAssignees.some((uid) => isUser(uid, user)),
          qaTesting: Number(qaTesting) > 0,
        });
        if (stageError) fail(stageError, 'FORBIDDEN');
        const { pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM ws_items WHERE group_id = ?', [group.id]);
        sets.push('group_id = ?', 'position = ?');
        params.push(group.id, pos);
        await logItem(item.id, user.id, `Cambió la etapa de "${from.name}" a "${group.name}"`);
      }
      if (enteringQa || (completingQa && !item.developer_id)) {
        // Las correcciones que pida el QA van a quien lo envía (si está en el proyecto) o al programador anterior
        const developer = currentAssignees.some((uid) => isUser(uid, user)) ? user.id : (item.developer_id ?? currentAssignees[0] ?? null);
        sets.push('developer_id = ?');
        params.push(developer);
      }
      if (qaId !== item.qa_id) {
        sets.push('qa_id = ?');
        params.push(qaId);
      }
      if (sets.length) await query(`UPDATE ws_items SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
      if (changes.length) await logItem(item.id, user.id, `Actualizó ${changes.join(', ')}`);

      if (qa && !isUser(item.qa_id, qa)) {
        // Las pruebas abiertas pasan al nuevo QA
        await query("UPDATE ws_subitems SET assignee_id = ? WHERE item_id = ? AND kind = 'QA' AND status <> 'DONE'", [qa.id, id]);
        await logItem(item.id, user.id, `Asignó la revisión QA a ${qa.name}`);
      }
      // Al entrar a QA, el QA arranca con una prueba abierta (si no le quedaba ninguna de una revisión anterior)
      if ((enteringQa || completingQa) && !(await openSubitems(id, 'QA'))) {
        const { n } = await one("SELECT COUNT(*) AS n FROM ws_subitems WHERE item_id = ? AND kind = 'QA'", [id]);
        await query(
          "INSERT INTO ws_subitems (item_id, name, kind, assignee_id, status, start_date, position) VALUES (?,?,'QA',?,'PENDING',?,?)",
          [id, Number(n) ? 'Pruebas QA (nueva revisión)' : 'Pruebas QA', qaId, today(), await nextSubitemPosition(id)]
        );
      }

      if (input.assigneeIds) {
        await query('DELETE FROM ws_item_assignees WHERE item_id = ?', [id]);
        for (const userId of new Set(input.assigneeIds.map(String))) {
          await query('INSERT INTO ws_item_assignees (item_id, user_id) VALUES (?,?)', [id, userId]);
        }
        const names = input.assigneeIds.length
          ? (await query('SELECT name FROM users WHERE id IN (?)', [input.assigneeIds])).map((u) => u.name).join(', ')
          : 'nadie';
        await logItem(item.id, user.id, `Asignó a ${names}`);
      }
      return one('SELECT * FROM ws_items WHERE id = ?', [id]);
    },

    deleteWsItem: async (_, { id }, ctx) => {
      requireAuth(ctx);
      await requireItemAccess(ctx, id);
      await query('DELETE FROM ws_items WHERE id = ?', [id]);
      return true;
    },

    rejectWsItemQa: async (_, { id, bugs }, ctx) => {
      const user = requireAuth(ctx);
      await requireItemAccess(ctx, id);
      const item = await getItem(id);
      const stage = await one('SELECT name FROM ws_groups WHERE id = ?', [item.group_id]);
      const reviewError = qaReviewError(user, item, stage.name);
      if (reviewError) fail(reviewError, 'FORBIDDEN');
      const devStage = await boardStage(item.board_id, isDevelopmentStage);
      if (!devStage) fail('El tablero no tiene una etapa "En Desarrollo" a la cual devolver el proyecto.');
      // Sin bugs nuevos solo se devuelve si hay bugs abiertos (reportados desde las pruebas o reabiertos al verificar)
      const reopened = Number((await one("SELECT COUNT(*) AS n FROM ws_subitems WHERE item_id = ? AND kind = 'BUG' AND status <> 'DONE'", [id])).n);
      if (!bugs.length && !reopened) fail('Registra al menos un bug para devolver el proyecto a desarrollo.');
      const prepared = validateBugs(bugs);
      const developerId = await itemDeveloperId(item);
      const developer = developerId ? await one('SELECT name FROM users WHERE id = ?', [developerId]) : null;

      const { pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM ws_items WHERE group_id = ?', [devStage.id]);
      await query('UPDATE ws_items SET group_id = ?, position = ? WHERE id = ?', [devStage.id, pos, id]);
      await insertBugs(id, prepared, user, developerId);
      const list = bugs.map((b) => `• [${BUG_SEVERITY_LABEL[b.severity]}] ${b.name.trim()}`).join('\n');
      const summary = [bugs.length && `${bugs.length} bug(s) nuevo(s)`, reopened && `${reopened} pendiente(s)`].filter(Boolean).join(' y ');
      await logItem(id, user.id, `Devolvió el proyecto a "${devStage.name}"${developer ? ` para ${developer.name}` : ''}: ${summary}`);
      await query('INSERT INTO ws_updates (item_id, user_id, body) VALUES (?,?,?)', [
        id,
        user.id,
        `🐞 QA devolvió el proyecto a desarrollo (${summary})${list ? `\n${list}` : ''}`,
      ]);
      return getItem(id);
    },

    reportWsBug: async (_, { testId, bugs, returnToDev = false }, ctx) => {
      const user = requireAuth(ctx);
      const test = await one('SELECT * FROM ws_subitems WHERE id = ?', [testId]);
      if (!test) fail('Prueba no encontrada', 'NOT_FOUND');
      await requireItemAccess(ctx, test.item_id);
      const item = await getItem(test.item_id);
      const stage = await one('SELECT name FROM ws_groups WHERE id = ?', [item.group_id]);
      const error = bugReportError(user, item, test, stage.name);
      if (error) fail(error, 'FORBIDDEN');
      if (!bugs.length) fail('Registra al menos un bug.');
      const prepared = validateBugs(bugs);
      const developerId = await itemDeveloperId(item);
      const developer = developerId ? await one('SELECT name FROM users WHERE id = ?', [developerId]) : null;

      // El proyecto sigue en QA mientras el QA prueba; con returnToDev (o luego con rejectWsItemQa) vuelve al programador
      let returned = null;
      if (returnToDev) {
        returned = await boardStage(item.board_id, isDevelopmentStage);
        if (!returned) fail('El tablero no tiene una etapa "En Desarrollo" a la cual devolver el proyecto.');
        const { pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM ws_items WHERE group_id = ?', [returned.id]);
        await query('UPDATE ws_items SET group_id = ?, position = ? WHERE id = ?', [returned.id, pos, item.id]);
      }
      await insertBugs(item.id, prepared, user, developerId, test.id);
      const list = bugs.map((b) => `• [${BUG_SEVERITY_LABEL[b.severity]}] ${b.name.trim()}`).join('\n');
      const back = returned ? ` y devolvió el proyecto a "${returned.name}"` : '';
      await logItem(item.id, user.id, `Reportó ${bugs.length} bug(s)${developer ? ` para ${developer.name}` : ''} en la prueba "${test.name}"${back}`);
      await query('INSERT INTO ws_updates (item_id, user_id, body) VALUES (?,?,?)', [
        item.id,
        user.id,
        `🐞 QA reportó ${bugs.length} bug(s) en la prueba "${test.name}"${back}\n${list}`,
      ]);
      return getItem(item.id);
    },

    approveWsItemQa: async (_, { id }, ctx) => {
      const user = requireAuth(ctx);
      await requireItemAccess(ctx, id);
      const item = await getItem(id);
      const stage = await one('SELECT name FROM ws_groups WHERE id = ?', [item.group_id]);
      const error = qaApproveError(user, item, stage.name, await openSubitems(id, 'QA'), await unverifiedBugs(id));
      // Sin permiso → FORBIDDEN; con permiso pero con pruebas o bugs pendientes → transición no permitida
      if (error) fail(error, qaReviewError(user, item, stage.name) ? 'FORBIDDEN' : 'TRANSITION_NOT_ALLOWED');
      const production = await boardStage(item.board_id, isProductionStage);
      if (!production) fail('El tablero no tiene una etapa "En Producción" a la cual pasar el proyecto.');
      const { pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM ws_items WHERE group_id = ?', [production.id]);
      await query('UPDATE ws_items SET group_id = ?, position = ? WHERE id = ?', [production.id, pos, id]);
      await logItem(id, user.id, `Aprobó la revisión QA: el proyecto pasó a "${production.name}"`);
      await query('INSERT INTO ws_updates (item_id, user_id, body) VALUES (?,?,?)', [id, user.id, `✅ QA aprobó el proyecto: pasó a ${production.name}`]);
      return getItem(id);
    },

    verifyWsBug: async (_, { id, ok, comment }, ctx) => {
      const user = requireAuth(ctx);
      const bug = await one('SELECT * FROM ws_subitems WHERE id = ?', [id]);
      if (!bug) fail('El bug no existe', 'NOT_FOUND');
      await requireItemAccess(ctx, bug.item_id);
      const item = await getItem(bug.item_id);
      const stage = await one('SELECT name FROM ws_groups WHERE id = ?', [item.group_id]);
      const error = bugVerifyError(user, item, bug, stage.name, ok, comment);
      if (error) fail(error, 'FORBIDDEN');
      const text = String(comment ?? '').trim();
      if (ok) {
        await query('UPDATE ws_subitems SET verified_at = NOW() WHERE id = ?', [id]);
        await addComment(id, user.id, 'VERIFIED', text || 'Verificado: el defecto ya no se reproduce.');
        await logItem(item.id, user.id, `Verificó el bug "${bug.name}"`);
      } else {
        // Reabierto: vuelve al programador (Por hacer) y cuenta como reincidencia
        await query("UPDATE ws_subitems SET status = 'PENDING', completed_at = NULL, reopen_count = reopen_count + 1 WHERE id = ?", [id]);
        await addComment(id, user.id, 'REOPENED', text);
        await logItem(item.id, user.id, `Reabrió el bug "${bug.name}" — ${text}`);
      }
      return one('SELECT * FROM ws_subitems WHERE id = ?', [id]);
    },

    addWsSubitemComment: async (_, { subitemId, body }, ctx) => {
      const user = requireAuth(ctx);
      required({ Comentario: body });
      const sub = await one('SELECT * FROM ws_subitems WHERE id = ?', [subitemId]);
      if (!sub) fail('La subtarea no existe', 'NOT_FOUND');
      await requireItemAccess(ctx, sub.item_id);
      return addComment(subitemId, user.id, 'COMMENT', body);
    },

    createWsSubitem: async (_, { itemId, name, input }, ctx) => {
      const user = requireAuth(ctx);
      required({ Nombre: name });
      await requireItemAccess(ctx, itemId);
      const item = await getItem(itemId);
      const data = input ?? {};
      const start = validDate(data.startDate, 'fecha de inicio');
      const end = validDate(data.dueDate, 'fecha final');
      if (start && end && end < start) fail('La fecha final no puede ser anterior a la fecha de inicio');
      const hours = data.hours ?? workingHours(start, end);
      // Lo que crea el QA del proyecto son sus pruebas, asignadas a él
      const parentId = blank(data.parentId) ? null : data.parentId;
      const kind = data.kind ?? (isUser(item.qa_id, user) && !parentId ? 'QA' : 'DEV');
      if (kind === 'BUG') fail('Los bugs los registra el QA al devolver el proyecto a desarrollo.');
      if (kind === 'QA') {
        if (!item.qa_id) fail('El proyecto aún no tiene QA asignado.');
        if (!isUser(item.qa_id, user) && !can(user, 'subitems.manageAll')) fail('Solo el QA del proyecto (o un administrador) agrega pruebas de QA.', 'FORBIDDEN');
      }
      // Una tarea creada para resolver un bug queda unida a él (trazabilidad)
      const parent = parentId ? await one("SELECT * FROM ws_subitems WHERE id = ? AND item_id = ? AND kind = 'BUG'", [parentId, itemId]) : null;
      if (parentId && !parent) fail('El bug elegido no pertenece a este proyecto.');
      if (parent && kind !== 'DEV') fail('Solo las tareas de desarrollo se vinculan a un bug.');
      // Sin responsable indicado: las pruebas son del QA y las tareas de un bug, de quien corrige el bug
      const assigneeId = blank(data.assigneeId) ? (kind === 'QA' ? item.qa_id : (parent?.assignee_id ?? null)) : data.assigneeId;
      const status = data.status || 'PENDING';
      const editError = subitemEditError(null, user, { assigneeId });
      if (editError) fail(editError, 'FORBIDDEN');
      if (!['PENDING', 'IN_PROGRESS'].includes(status)) fail('Una tarea nueva inicia en "Por hacer" o "En progreso".');
      if (status === 'IN_PROGRESS' && !assigneeId) fail('Para iniciar la tarea en "En progreso" asígnale un programador.');
      const res = await query(
        'INSERT INTO ws_subitems (item_id, name, kind, parent_id, assignee_id, status, start_date, due_date, hours, position) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [itemId, name.trim(), kind, parent?.id ?? null, assigneeId, status, start, end, hours, await nextSubitemPosition(itemId)]
      );
      const assignee = assigneeId ? await one('SELECT name FROM users WHERE id = ?', [assigneeId]) : null;
      await logItem(
        itemId,
        user.id,
        `Agregó ${kind === 'QA' ? 'la prueba de QA' : 'el subelemento'} "${name.trim()}"${parent ? ` para el bug "${parent.name}"` : ''}${assignee ? ` asignado a ${assignee.name}` : ''}${hours ? ` (${hours} h laborales)` : ''}`
      );
      return one('SELECT * FROM ws_subitems WHERE id = ?', [res.insertId]);
    },

    updateWsSubitem: async (_, { id, input }, ctx) => {
      const user = requireAuth(ctx);
      const sub = await one('SELECT * FROM ws_subitems WHERE id = ?', [id]);
      if (!sub) fail('El subelemento no existe', 'NOT_FOUND');
      await requireItemAccess(ctx, sub.item_id);
      // Mover de estado (Kanban) lo valida subitemTransitionError; editar los datos sigue siendo del programador asignado
      const isMoveOnly = Object.keys(input).every((k) => k === 'status' || k === 'reason' || k === 'comment');
      // Lo que reportó el QA (título del bug) no lo reescribe el programador
      if (sub.kind === 'BUG' && input.name !== undefined && !isUser(sub.reported_by, user) && !can(user, 'subitems.manageAll')) {
        fail('El título del bug lo define el QA que lo reportó.', 'FORBIDDEN');
      }
      // Una subtarea Finalizada es de solo lectura para el programador; el administrador puede corregir sus datos
      if (sub.status === 'DONE' && !isMoveOnly && !can(user, 'subitems.manageAll')) {
        fail('La subtarea está Finalizada y no puede modificarse. Un administrador puede reabrirla.');
      }
      if (!isMoveOnly) {
        const editError = subitemEditError(sub, user, input);
        if (editError) fail(editError, 'FORBIDDEN');
      }
      const sets = [];
      const params = [];
      // Si en la misma petición se asigna programador, la regla de "En progreso" lo toma en cuenta
      const nextAssignee = input.assigneeId !== undefined ? (blank(input.assigneeId) ? null : input.assigneeId) : sub.assignee_id;
      if (input.assigneeId !== undefined && !nextAssignee && (input.status || sub.status) === 'IN_PROGRESS') {
        fail('Una tarea en curso debe mantener un programador asignado.');
      }
      if (input.name !== undefined) {
        required({ Nombre: input.name });
        sets.push('name = ?');
        params.push(input.name.trim());
      }
      let transition = null;
      if (input.status && input.status !== sub.status) {
        const to = input.status;
        const error = subitemTransitionError({ ...sub, assignee_id: nextAssignee }, to, user);
        if (error) fail(error, 'TRANSITION_NOT_ALLOWED');
        const noComment = resolutionError(sub, to, input.comment);
        if (noComment) fail(noComment, 'TRANSITION_NOT_ALLOWED');
        // El QA no mueve el trabajo del programador: si encuentra defectos, rechaza el proyecto
        if (sub.kind !== 'QA' && !can(user, 'subitems.manageAll')) {
          const item = await getItem(sub.item_id);
          const inProject = await one('SELECT 1 AS ok FROM ws_item_assignees WHERE item_id = ? AND user_id = ?', [item.id, user.id]);
          if (isUser(item.qa_id, user) && !inProject && !isUser(sub.assignee_id, user)) {
            fail('El QA no mueve las subtareas de desarrollo. Si encontraste defectos, rechaza el proyecto.', 'TRANSITION_NOT_ALLOWED');
          }
        }
        sets.push('status = ?', `completed_at = ${to === 'DONE' ? 'NOW()' : 'NULL'}`);
        params.push(to);
        // Un bug que se reabre (o se vuelve a cerrar) necesita otra verificación del QA
        if (sub.kind === 'BUG') sets.push('verified_at = NULL');
        transition = { from: sub.status, to };
      }
      const start = input.startDate !== undefined ? validDate(input.startDate, 'fecha de inicio') : sub.start_date;
      const end = input.dueDate !== undefined ? validDate(input.dueDate, 'fecha final') : sub.due_date;
      if (start && end && end < start) fail('La fecha final no puede ser anterior a la fecha de inicio');
      if (input.startDate !== undefined) {
        sets.push('start_date = ?');
        params.push(start);
      }
      if (input.dueDate !== undefined) {
        sets.push('due_date = ?');
        params.push(end);
      }
      // Al cambiar las fechas (sin horas manuales) se recalculan las horas laborales
      if (input.hours === undefined && (input.startDate !== undefined || input.dueDate !== undefined)) {
        const hours = workingHours(start, end);
        if (hours !== null) {
          sets.push('hours = ?');
          params.push(hours);
        }
      }
      if (input.hours !== undefined) {
        if (input.hours !== null && (input.hours < 0 || input.hours > 999)) fail('Las horas deben estar entre 0 y 999');
        sets.push('hours = ?');
        params.push(input.hours);
      }
      if (input.assigneeId !== undefined) {
        sets.push('assignee_id = ?');
        params.push(blank(input.assigneeId) ? null : input.assigneeId);
      }
      if (sets.length) await query(`UPDATE ws_subitems SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);

      if (input.assigneeId !== undefined && String(nextAssignee ?? '') !== String(sub.assignee_id ?? '')) {
        const person = nextAssignee ? await one('SELECT name FROM users WHERE id = ?', [nextAssignee]) : null;
        await logItem(sub.item_id, user.id, person ? `Asignó "${sub.name}" a ${person.name}` : `Quitó el programador de "${sub.name}"`);
      }
      if (transition) {
        const { from, to } = transition;
        const reason = String(input.reason ?? '').trim();
        const reopened = from === 'DONE';
        const detail = reopened
          ? `Reabrió "${sub.name}" (Finalizado → En progreso)${reason ? ` — ${reason}` : ''}`
          : to === 'DONE'
            ? `Finalizó "${sub.name}"`
            : `Movió "${sub.name}" de ${SUBITEM_STATUS_LABEL[from]} a ${SUBITEM_STATUS_LABEL[to]}`;
        await logItem(sub.item_id, user.id, detail);
        // El motivo de la reapertura queda también como actualización del proyecto (retroalimentación QA)
        if (reopened && reason) {
          await query('INSERT INTO ws_updates (item_id, user_id, body) VALUES (?,?,?)', [
            sub.item_id,
            user.id,
            `🐞 Se reabrió "${sub.name}": ${reason}`,
          ]);
        }
      }
      // El comentario del movimiento queda en la tarea: en un bug cerrado es la resolución
      const comment = String(input.comment ?? '').trim();
      if (comment) await addComment(id, user.id, transition?.to === 'DONE' && sub.kind === 'BUG' ? 'RESOLUTION' : 'COMMENT', comment);
      return one('SELECT * FROM ws_subitems WHERE id = ?', [id]);
    },

    deleteWsSubitem: async (_, { id }, ctx) => {
      const user = requireAuth(ctx);
      const sub = await one('SELECT * FROM ws_subitems WHERE id = ?', [id]);
      if (!sub) return true;
      await requireItemAccess(ctx, sub.item_id);
      const editError = subitemEditError(sub, user);
      if (editError) fail(editError, 'FORBIDDEN');
      // Los bugs son el historial de calidad del proyecto: no los borra el programador
      if (sub.kind === 'BUG' && !can(user, 'subitems.manageAll')) fail('Solo un administrador puede eliminar un bug.', 'FORBIDDEN');
      await query('DELETE FROM ws_subitems WHERE id = ?', [id]);
      await logItem(sub.item_id, user.id, `Eliminó el subelemento "${sub.name}"`);
      return true;
    },

    uploadWsFile: async (_, { itemId, name, mimeType, dataBase64 }, ctx) => {
      const user = requireAuth(ctx);
      required({ Archivo: name, Contenido: dataBase64 });
      await requireItemAccess(ctx, itemId);
      await getItem(itemId);
      const cleanName = name.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 255);
      const ext = cleanName.includes('.') ? cleanName.split('.').pop().toLowerCase() : '';
      if (BLOCKED_EXTENSIONS.includes(ext)) fail(`Por seguridad no se permiten archivos .${ext}`);
      const data = Buffer.from(dataBase64, 'base64');
      if (!data.length) fail('El archivo está vacío');
      if (data.length > MAX_FILE_BYTES) fail(`El archivo supera el máximo de ${formatSize(MAX_FILE_BYTES)}`);
      const res = await query(
        'INSERT INTO ws_item_files (item_id, name, mime_type, size, data, uploaded_by) VALUES (?,?,?,?,?,?)',
        [itemId, cleanName, mimeType || 'application/octet-stream', data.length, data, user.id]
      );
      await logItem(itemId, user.id, `Subió el archivo "${cleanName}" (${formatSize(data.length)})`);
      return one('SELECT id, item_id, name, mime_type, size, uploaded_by, created_at FROM ws_item_files WHERE id = ?', [res.insertId]);
    },

    deleteWsFile: async (_, { id }, ctx) => {
      const user = requireAuth(ctx);
      const file = await one('SELECT id, item_id, name, uploaded_by FROM ws_item_files WHERE id = ?', [id]);
      if (!file) return true;
      await requireItemAccess(ctx, file.item_id);
      if (!can(user, 'files.deleteAny') && file.uploaded_by !== user.id) {
        fail('Solo quien subió el archivo o un administrador puede eliminarlo', 'FORBIDDEN');
      }
      await query('DELETE FROM ws_item_files WHERE id = ?', [id]);
      await logItem(file.item_id, user.id, `Eliminó el archivo "${file.name}"`);
      return true;
    },

    addWsUpdate: async (_, { itemId, body, images }, ctx) => {
      const user = requireAuth(ctx);
      const files = validImages(images ?? []);
      if (!files.length) required({ Actualización: body });
      await requireItemAccess(ctx, itemId);
      await getItem(itemId);
      const res = await query('INSERT INTO ws_updates (item_id, user_id, body) VALUES (?,?,?)', [itemId, user.id, body.trim()]);
      for (const f of files) {
        await query('INSERT INTO ws_update_images (update_id, name, mime_type, size, data) VALUES (?,?,?,?,?)', [
          res.insertId,
          f.name,
          f.mime,
          f.data.length,
          f.data,
        ]);
      }
      if (files.length) await logItem(itemId, user.id, `Agregó una actualización con ${files.length} imagen(es)`);
      return one('SELECT * FROM ws_updates WHERE id = ?', [res.insertId]);
    },
  },

  WsBoard: {
    createdAt: (b) => b.created_at,
    itemCount: async (b, _, ctx) => {
      const scope = await itemScope(ctx, 'id');
      return Number((await one(`SELECT COUNT(*) AS n FROM ws_items WHERE board_id = ? AND ${scope.sql}`, [b.id, ...scope.params])).n);
    },
    groups: (b) => query('SELECT * FROM ws_groups WHERE board_id = ? ORDER BY position, id', [b.id]),
  },

  WsGroup: {
    items: async (g, _, ctx) => {
      const scope = await itemScope(ctx, 'id');
      return query(`SELECT * FROM ws_items WHERE group_id = ? AND ${scope.sql} ORDER BY position, id`, [g.id, ...scope.params]);
    },
  },

  WsItem: {
    dueDate: (i) => i.due_date,
    createdAt: (i) => i.created_at,
    createdBy: (i, _, ctx) => userById(ctx, i.created_by),
    group: (i) => one('SELECT * FROM ws_groups WHERE id = ?', [i.group_id]),
    qaGroup: async (i) => (await query('SELECT * FROM ws_groups WHERE board_id = ? ORDER BY position, id', [i.board_id])).find((g) => isQaStage(g.name)) ?? null,
    devGroup: (i) => boardStage(i.board_id, isDevelopmentStage),
    qa: (i, _, ctx) => userById(ctx, i.qa_id),
    developer: (i, _, ctx) => userById(ctx, i.developer_id),
    board: (i) => one('SELECT * FROM ws_boards WHERE id = ?', [i.board_id]),
    assignees: (i) =>
      query(
        'SELECT u.* FROM users u JOIN ws_item_assignees a ON a.user_id = u.id WHERE a.item_id = ? ORDER BY u.name',
        [i.id]
      ),
    subitems: (i) => query('SELECT * FROM ws_subitems WHERE item_id = ? ORDER BY position, id', [i.id]),
    subitemCount: async (i) => Number((await one('SELECT COUNT(*) AS n FROM ws_subitems WHERE item_id = ?', [i.id])).n),
    progress: async (i) => {
      const r = await one("SELECT COUNT(*) AS n, SUM(status = 'DONE') AS d FROM ws_subitems WHERE item_id = ?", [i.id]);
      return Number(r.n) ? Math.round((Number(r.d) / Number(r.n)) * 100) : 0;
    },
    totalHours: async (i) => Number((await one('SELECT COALESCE(SUM(hours), 0) AS h FROM ws_subitems WHERE item_id = ?', [i.id])).h),
    updateCount: async (i) => Number((await one('SELECT COUNT(*) AS n FROM ws_updates WHERE item_id = ?', [i.id])).n),
    updates: (i) => query('SELECT * FROM ws_updates WHERE item_id = ? ORDER BY created_at DESC, id DESC', [i.id]),
    activity: (i) => query('SELECT * FROM ws_activity WHERE item_id = ? ORDER BY created_at DESC, id DESC', [i.id]),
    // Solo metadatos: el contenido se descarga aparte con wsFileContent
    files: (i) =>
      query(
        'SELECT id, item_id, name, mime_type, size, uploaded_by, created_at FROM ws_item_files WHERE item_id = ? ORDER BY created_at, id',
        [i.id]
      ),
  },

  WsFile: {
    mimeType: (f) => f.mime_type,
    createdAt: (f) => f.created_at,
    uploadedBy: (f, _, ctx) => userById(ctx, f.uploaded_by),
  },

  WsSubitem: {
    completedAt: (s) => s.completed_at,
    allowedStatuses: (s, _, ctx) => (ctx.user ? allowedSubitemStatuses(s, ctx.user) : []),
    startDate: (s) => s.start_date,
    dueDate: (s) => s.due_date,
    hours: (s) => (s.hours === null ? null : Number(s.hours)),
    isOverdue: (s) => !!s.due_date && s.status !== 'DONE' && s.due_date < today(),
    assignee: (s, _, ctx) => userById(ctx, s.assignee_id),
    reportedBy: (s, _, ctx) => userById(ctx, s.reported_by),
    reopenCount: (s) => Number(s.reopen_count ?? 0),
    verifiedAt: (s) => s.verified_at,
    parentId: (s) => s.parent_id,
    testId: (s) => s.test_id,
    evidence: (s) =>
      s.kind === 'BUG'
        ? query('SELECT id, item_id, name, mime_type, size, uploaded_by, created_at FROM ws_item_files WHERE subitem_id = ? ORDER BY id', [s.id])
        : [],
    commentCount: async (s) => Number((await one('SELECT COUNT(*) AS n FROM ws_subitem_comments WHERE subitem_id = ?', [s.id])).n),
  },

  WsSubitemComment: {
    createdAt: (c) => c.created_at,
    user: (c, _, ctx) => userById(ctx, c.user_id),
  },

  WsUpdate: {
    createdAt: (u) => u.created_at,
    user: (u, _, ctx) => userById(ctx, u.user_id),
    images: async (u) =>
      (await query('SELECT id, name, mime_type, size, data FROM ws_update_images WHERE update_id = ? ORDER BY id', [u.id])).map((img) => ({
        id: img.id,
        name: img.name,
        mimeType: img.mime_type,
        size: img.size,
        dataBase64: img.data.toString('base64'),
      })),
  },

  WsActivity: {
    createdAt: (a) => a.created_at,
    user: (a, _, ctx) => userById(ctx, a.user_id),
  },
};
