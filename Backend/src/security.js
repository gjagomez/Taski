// Limpieza y validación de TODA entrada que llega a la API (GraphQL y chat de IA).
// La protección contra inyección SQL es que los valores viajan como parámetros (?) — ver db/pool.js.
// Aquí además se normaliza el texto y se rechazan identificadores con formato inválido.
import { GraphQLError } from 'graphql';

const MAX_TEXT = 10_000;
const MAX_LONG_TEXT = 20_000; // prompts y descripciones largas
const MAX_BASE64 = 21 * 1024 * 1024; // ~15 MB de archivo codificado en base64

// Campos que no se alteran (una contraseña debe guardarse exactamente como se escribió)
const RAW_KEYS = new Set(['password', 'newPassword', 'temporaryPassword']);
const LONG_KEYS = new Set(['prompt', 'body', 'description', 'acceptanceCriteria', 'previousSpec']);
// Identificadores: id, boardId, itemId, assigneeIds…
const isIdKey = (key) => key === 'id' || /Ids?$/.test(key);
const NUMERIC_ID = /^\d{1,10}$/;
const BASE64 = /^[A-Za-z0-9+/=\r\n]*$/;

function reject(message) {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

// Caracteres de control e invisibles (byte nulo, separadores de línea Unicode, BOM…), por código
const CONTROL_RANGES = [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f], [0x200b, 0x200f], [0x2028, 0x2029], [0xfeff, 0xfeff]];
const CONTROL_CHARS = new RegExp(`[${CONTROL_RANGES.map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`).join('')}]`, 'g');

/** Quita caracteres de control (incluido el byte nulo), excepto saltos de línea y tabuladores. */
export function cleanText(value, max = MAX_TEXT) {
  const text = String(value)
    .normalize('NFC')
    .replace(CONTROL_CHARS, '');
  if (text.length > max) reject(`El texto supera el máximo de ${max} caracteres`);
  return text;
}

function cleanId(value, key) {
  if (value === null || value === undefined || value === '') return value;
  const text = String(value).trim();
  if (!NUMERIC_ID.test(text)) reject(`Identificador inválido en "${key}"`);
  return text;
}

function cleanValue(value, key) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => cleanValue(v, key));
  if (typeof value === 'object') return cleanObject(value);
  if (typeof value !== 'string') return value;
  if (RAW_KEYS.has(key)) {
    if (value.length > 200) reject('La contraseña es demasiado larga');
    return value;
  }
  if (key === 'dataBase64') {
    if (value.length > MAX_BASE64) reject('El archivo es demasiado grande');
    if (!BASE64.test(value)) reject('El contenido del archivo no es base64 válido');
    return value;
  }
  if (isIdKey(key)) return cleanId(value, key);
  return cleanText(value, LONG_KEYS.has(key) ? MAX_LONG_TEXT : MAX_TEXT);
}

function cleanObject(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) out[key] = cleanValue(value, key);
  return out;
}

export const sanitizeArgs = cleanObject;

/** Envuelve cada resolver de Query y Mutation para que reciba los argumentos ya limpios. */
export function withSanitizedArgs(resolverMaps) {
  return resolverMaps.map((map) => {
    const out = { ...map };
    for (const type of ['Query', 'Mutation']) {
      if (!map[type]) continue;
      out[type] = Object.fromEntries(
        Object.entries(map[type]).map(([name, fn]) => [name, (parent, args, ctx, info) => fn(parent, sanitizeArgs(args), ctx, info)])
      );
    }
    return out;
  });
}

/** Para el chat de IA (fuera de GraphQL). */
export function sanitizeChatBody(body) {
  const fileId = body.fileId === undefined || body.fileId === null ? null : cleanId(body.fileId, 'fileId');
  const messages = Array.isArray(body.messages)
    ? body.messages.slice(-20).map((m) => ({ role: m?.role, content: typeof m?.content === 'string' ? cleanText(m.content, MAX_LONG_TEXT) : '' }))
    : [];
  return { fileId, messages };
}
