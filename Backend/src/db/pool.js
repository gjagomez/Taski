import mysql from 'mysql2/promise';
import 'dotenv/config';

const IDENTIFIER = /^[A-Za-z0-9_]+$/;

/** Nombres de base de datos, tablas o columnas: solo letras, números y guion bajo. */
export function assertIdentifier(name) {
  if (!IDENTIFIER.test(String(name))) throw new Error(`Identificador SQL no permitido: ${name}`);
  return name;
}

export const DB_NAME = assertIdentifier(process.env.DB_NAME || 'gestor_proyectos');

const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  dateStrings: true,
  // Nunca se permiten varias sentencias en una misma consulta ("…; DROP TABLE …")
  multipleStatements: false,
};

/**
 * Defensa en profundidad contra inyección SQL. Los valores del usuario SIEMPRE viajan como
 * parámetros (?) y mysql2 los escapa; el texto SQL solo lo escribe el código. Si alguna vez se
 * concatenara un valor por error, estas reglas lo detectan antes de llegar a MySQL:
 *  - sin ";" (sentencias encadenadas) ni comentarios (--, #, /* *\/) que permitan truncar la consulta;
 *  - el número de "?" debe coincidir con los parámetros enviados.
 */
export function assertSafeSql(sql, params = []) {
  const text = String(sql);
  // Se ignora el contenido de literales de texto escritos por el código ('DONE', '%Y-%m', …)
  const code = text.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  if (/;/.test(code)) throw new Error('Consulta bloqueada: contiene ";"');
  if (/--|#|\/\*|\*\//.test(code)) throw new Error('Consulta bloqueada: contiene comentarios SQL');
  const placeholders = (code.match(/\?/g) || []).length;
  if (placeholders !== params.length) {
    throw new Error(`Consulta bloqueada: ${placeholders} parámetro(s) esperados y ${params.length} recibidos`);
  }
}

export async function createDatabaseIfMissing() {
  const conn = await mysql.createConnection(baseConfig);
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
}

export async function dropDatabase() {
  const conn = await mysql.createConnection(baseConfig);
  await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await conn.end();
}

export const pool = mysql.createPool({
  ...baseConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function query(sql, params = []) {
  assertSafeSql(sql, params);
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** Conexión para transacciones con la misma validación en cada consulta. */
export async function getConnection() {
  const conn = await pool.getConnection();
  const raw = conn.query.bind(conn);
  conn.query = (sql, params = []) => {
    assertSafeSql(sql, params);
    return raw(sql, params);
  };
  return conn;
}
