import { pool, assertIdentifier } from './pool.js';
import { SYSTEM_ROLES, PERMISSION_KEYS } from '../permissions.js';

// Jerarquía: Proyecto (espacio de trabajo) → Tablero → Columna (estado) → Tarea → Subtarea → Checklist
const TABLES = [
  // Roles y permisos (mantenimiento de roles). code = 'ADMIN' / 'MEMBER' en los roles del sistema
  `CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6d5df6',
    code VARCHAR(20) NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission VARCHAR(40) NOT NULL,
    PRIMARY KEY (role_id, permission),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    avatar_color VARCHAR(20) NOT NULL DEFAULT '#6d5df6',
    reset_code VARCHAR(10) NULL,
    reset_expires DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
  )`,
  // Registro pendiente: la cuenta se crea en users recién cuando se confirma el código enviado al correo
  `CREATE TABLE IF NOT EXISTS pending_registrations (
    email VARCHAR(160) NOT NULL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6d5df6',
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS board_members (
    board_id INT NOT NULL,
    user_id INT NOT NULL,
    PRIMARY KEY (board_id, user_id),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS board_columns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    name VARCHAR(80) NOT NULL,
    status ENUM('BACKLOG','IN_PROGRESS','REVIEW','DONE') NOT NULL,
    position INT NOT NULL DEFAULT 0,
    color VARCHAR(20) NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    column_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    type ENUM('TASK','BUG') NOT NULL DEFAULT 'TASK',
    priority ENUM('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
    labels VARCHAR(255) NULL,
    acceptance_criteria TEXT NULL,
    assignee_id INT NULL,
    created_by INT NOT NULL,
    start_date DATE NULL,
    due_date DATE NULL,
    completed_at DATETIME NULL,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (column_id) REFERENCES board_columns(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS subtasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    status ENUM('PENDING','DONE') NOT NULL DEFAULT 'PENDING',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS checklist_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subtask_id INT NOT NULL,
    text VARCHAR(255) NOT NULL,
    done TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NULL,
    board_id INT NULL,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    detail TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  // ---------- Espacio de trabajo estilo Monday: Tablero → Grupo (etapa) → Elemento → Subelemento ----------
  `CREATE TABLE IF NOT EXISTS ws_folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ws_boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    folder VARCHAR(80) NULL,
    description TEXT NULL,
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ws_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(20) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    FOREIGN KEY (board_id) REFERENCES ws_boards(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ws_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    group_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    requesters VARCHAR(255) NULL,
    area VARCHAR(120) NULL,
    due_date DATE NULL,
    position INT NOT NULL DEFAULT 0,
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES ws_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES ws_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ws_item_assignees (
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    PRIMARY KEY (item_id, user_id),
    FOREIGN KEY (item_id) REFERENCES ws_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ws_subitems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    assignee_id INT NULL,
    status ENUM('PENDING','IN_PROGRESS','DONE') NOT NULL DEFAULT 'PENDING',
    due_date DATE NULL,
    completed_at DATETIME NULL,
    hours DECIMAL(6,2) NULL,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES ws_items(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ws_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES ws_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  // Imágenes adjuntas a una actualización (subidas, arrastradas o pegadas desde el portapapeles)
  `CREATE TABLE IF NOT EXISTS ws_update_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    update_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    size INT NOT NULL,
    data MEDIUMBLOB NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (update_id) REFERENCES ws_updates(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ws_item_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    size INT NOT NULL,
    data LONGBLOB NOT NULL,
    uploaded_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES ws_items(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ws_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    detail TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES ws_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  // Comentarios por subtarea. kind: COMMENT (libre), RESOLUTION (cierre de un bug), VERIFIED / REOPENED (verificación del QA)
  `CREATE TABLE IF NOT EXISTS ws_subitem_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subitem_id INT NOT NULL,
    user_id INT NOT NULL,
    kind ENUM('COMMENT','RESOLUTION','VERIFIED','REOPENED') NOT NULL DEFAULT 'COMMENT',
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subitem_id) REFERENCES ws_subitems(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
];

// DEV = desarrollo, QA = prueba del QA, BUG = defecto reportado por el QA
const SUBITEM_KIND_ENUM = "ENUM('DEV','QA','BUG') NOT NULL DEFAULT 'DEV'";

// Columnas agregadas después de la primera versión (CREATE TABLE IF NOT EXISTS no las crea en tablas existentes)
const COLUMNS = [
  { table: 'ws_subitems', column: 'start_date', definition: 'DATE NULL AFTER status' },
  { table: 'ws_subitems', column: 'completed_at', definition: 'DATETIME NULL AFTER due_date' },
  { table: 'users', column: 'role_id', definition: 'INT NULL AFTER password_hash' },
  { table: 'users', column: 'reset_attempts', definition: 'INT NOT NULL DEFAULT 0 AFTER reset_expires' },
  // Revisión QA: quién prueba el proyecto, quién lo envió (recibe las correcciones) y de quién es cada subtarea
  { table: 'ws_items', column: 'qa_id', definition: 'INT NULL AFTER due_date' },
  { table: 'ws_items', column: 'developer_id', definition: 'INT NULL AFTER qa_id' },
  { table: 'ws_subitems', column: 'kind', definition: `${SUBITEM_KIND_ENUM} AFTER name` },
  // Bugs reportados por el QA: gravedad, pasos para reproducir, quién lo reportó, cuántas veces se reabrió y
  // cuándo lo verificó el QA. parent_id une una tarea de desarrollo al bug que ayuda a resolver.
  { table: 'ws_subitems', column: 'severity', definition: "ENUM('CRITICAL','HIGH','MEDIUM','LOW') NULL AFTER kind" },
  { table: 'ws_subitems', column: 'steps', definition: 'TEXT NULL AFTER severity' },
  { table: 'ws_subitems', column: 'parent_id', definition: 'INT NULL AFTER steps' },
  { table: 'ws_subitems', column: 'reported_by', definition: 'INT NULL AFTER parent_id' },
  // Prueba de QA en la que se encontró el bug
  { table: 'ws_subitems', column: 'test_id', definition: 'INT NULL AFTER reported_by' },
  // Evidencia (imágenes y videos) de un bug: archivos del proyecto vinculados a esa subtarea
  { table: 'ws_item_files', column: 'subitem_id', definition: 'INT NULL AFTER item_id' },
  { table: 'ws_subitems', column: 'reopen_count', definition: 'INT NOT NULL DEFAULT 0 AFTER reported_by' },
  { table: 'ws_subitems', column: 'verified_at', definition: 'DATETIME NULL AFTER completed_at' },
];

// Las subtareas quedaron con tres estados (Por hacer, En progreso, Finalizado): los que se quitaron
// ("En revisión / QA" y "Detenido") pasan a "En progreso" antes de reducir el ENUM
const SUBITEM_STATUS_ENUM = "ENUM('PENDING','IN_PROGRESS','DONE') NOT NULL DEFAULT 'PENDING'";

const columnExists = async (table, column) =>
  (
    await pool.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [
      table,
      column,
    ])
  )[0].length > 0;

/**
 * Crea los roles del sistema si faltan y mantiene al Administrador con todos los permisos (también los
 * que se agreguen al catálogo en el futuro). Las bases anteriores tenían users.role ENUM('ADMIN','MEMBER'):
 * se pasa a users.role_id y la columna vieja deja de usarse (y de ser obligatoria).
 */
async function syncRoles() {
  for (const r of SYSTEM_ROLES) {
    const [found] = await pool.query('SELECT id FROM roles WHERE code = ?', [r.code]);
    let id = found[0]?.id;
    // Un rol creado a mano con el mismo nombre (p. ej. "QA") pasa a ser el rol del sistema
    if (!id) {
      const [byName] = await pool.query('SELECT id FROM roles WHERE name = ? AND code IS NULL', [r.name]);
      id = byName[0]?.id;
      if (id) await pool.query('UPDATE roles SET code = ? WHERE id = ?', [r.code, id]);
    }
    if (!id) {
      const [res] = await pool.query('INSERT INTO roles (name, description, color, code) VALUES (?,?,?,?)', [r.name, r.description, r.color, r.code]);
      id = res.insertId;
      for (const p of r.permissions) await pool.query('INSERT INTO role_permissions (role_id, permission) VALUES (?,?)', [id, p]);
    }
    if (r.code === 'ADMIN') {
      for (const p of PERMISSION_KEYS) await pool.query('INSERT IGNORE INTO role_permissions (role_id, permission) VALUES (?,?)', [id, p]);
    }
  }
  // Permisos que ya no existen en el catálogo
  await pool.query('DELETE FROM role_permissions WHERE permission NOT IN (?)', [PERMISSION_KEYS]);

  if (await columnExists('users', 'role')) {
    await pool.query(
      "UPDATE users u JOIN roles r ON r.code = (CASE WHEN u.role = 'ADMIN' THEN 'ADMIN' ELSE 'MEMBER' END) SET u.role_id = r.id WHERE u.role_id IS NULL"
    );
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('ADMIN','MEMBER') NULL");
  }
  await pool.query("UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'MEMBER') WHERE role_id IS NULL");
  const [fk] = await pool.query(
    "SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id' AND REFERENCED_TABLE_NAME = 'roles'"
  );
  if (!fk.length) await pool.query('ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)');
}

export async function createSchema() {
  for (const sql of TABLES) await pool.query(sql);
  for (const { table, column, definition } of COLUMNS) {
    if (!(await columnExists(table, column))) {
      await pool.query(`ALTER TABLE ${assertIdentifier(table)} ADD COLUMN ${assertIdentifier(column)} ${definition}`);
    }
  }
  await syncRoles();
  const [statusCol] = await pool.query(
    "SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ws_subitems' AND COLUMN_NAME = 'status'"
  );
  if (statusCol.length && statusCol[0].type !== "enum('PENDING','IN_PROGRESS','DONE')") {
    await pool.query("UPDATE ws_subitems SET status = 'IN_PROGRESS', completed_at = NULL WHERE status NOT IN ('PENDING','IN_PROGRESS','DONE')");
    await pool.query(`ALTER TABLE ws_subitems MODIFY COLUMN status ${SUBITEM_STATUS_ENUM}`);
  }
  // Las bases que ya tenían kind ENUM('DEV','QA') ganan el tipo BUG
  const [kindCol] = await pool.query(
    "SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ws_subitems' AND COLUMN_NAME = 'kind'"
  );
  if (kindCol.length && !kindCol[0].type.includes("'BUG'")) {
    await pool.query(`ALTER TABLE ws_subitems MODIFY COLUMN kind ${SUBITEM_KIND_ENUM}`);
  }
}
