// Integración con LM Studio (API compatible con OpenAI) usando un modelo local, p. ej. Gemma.
import http from 'node:http';
import { query } from './db/pool.js';
import { userFromRequest } from './auth.js';
import { itemScope, requireFileAccess } from './wsAccess.js';
import { documentContent, documentMessage } from './docText.js';
import { sanitizeChatBody } from './security.js';

const LM_URL = (process.env.LMSTUDIO_URL || 'http://localhost:1234/v1').replace(/\/$/, '');
const LM_MODEL = process.env.LMSTUDIO_MODEL || 'gemma-3-4b-it-qat';
const AI_PORT = Number(process.env.AI_PORT || 4001);
// Gemma está cargado con 4096 tokens de contexto: se recorta el historial para no excederlo
const MAX_HISTORY = 8;

const STATUS = { PENDING: 'por hacer', IN_PROGRESS: 'en progreso', DONE: 'finalizado' };

export async function aiStatus() {
  try {
    const res = await fetch(`${LM_URL}/models`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { available: false, model: LM_MODEL, message: `LM Studio respondió ${res.status}` };
    const { data } = await res.json();
    const found = data.some((m) => m.id === LM_MODEL);
    return {
      available: found,
      model: LM_MODEL,
      message: found ? 'Conectado' : `El modelo "${LM_MODEL}" no está disponible en LM Studio`,
    };
  } catch {
    return { available: false, model: LM_MODEL, message: 'LM Studio no responde en ' + LM_URL };
  }
}

/** Resumen compacto del espacio de trabajo para darle contexto al modelo (solo lo que el usuario puede ver). */
export async function workspaceContext(ctx) {
  const { sql: sc, params: p } = await itemScope(ctx);
  const items = await query(`
    SELECT b.name AS board, g.name AS stage, i.id, i.name, i.area, i.due_date,
      (SELECT GROUP_CONCAT(u.name SEPARATOR ', ') FROM ws_item_assignees a JOIN users u ON u.id = a.user_id WHERE a.item_id = i.id) AS people,
      (SELECT COUNT(*) FROM ws_subitems s WHERE s.item_id = i.id) AS subs,
      (SELECT COUNT(*) FROM ws_subitems s WHERE s.item_id = i.id AND s.status = 'DONE') AS done,
      (SELECT COALESCE(SUM(s.hours), 0) FROM ws_subitems s WHERE s.item_id = i.id) AS hours
    FROM ws_items i JOIN ws_boards b ON b.id = i.board_id JOIN ws_groups g ON g.id = i.group_id
    WHERE ${sc}
    ORDER BY b.name, g.position, i.position LIMIT 60`, p);
  const overdue = await query(`
    SELECT s.name, s.due_date, s.status, i.name AS item, u.name AS who
    FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id LEFT JOIN users u ON u.id = s.assignee_id
    WHERE s.status <> 'DONE' AND s.due_date < CURDATE() AND ${sc} ORDER BY s.due_date LIMIT 15`, p);
  const upcoming = await query(`
    SELECT s.name, s.due_date, s.status, i.name AS item, u.name AS who
    FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id LEFT JOIN users u ON u.id = s.assignee_id
    WHERE s.status <> 'DONE' AND s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY) AND ${sc}
    ORDER BY s.due_date LIMIT 15`, p);
  const load = await query(`
    SELECT u.name, COUNT(*) AS tasks,
      COALESCE(SUM(CASE WHEN s.status <> 'DONE' THEN s.hours END), 0) AS open_hours,
      SUM(s.status <> 'DONE' AND s.due_date < CURDATE()) AS late
    FROM ws_subitems s JOIN users u ON u.id = s.assignee_id JOIN ws_items i ON i.id = s.item_id
    WHERE ${sc} GROUP BY u.id ORDER BY open_hours DESC`, p);

  const lines = [`Fecha de hoy: ${new Date().toISOString().slice(0, 10)}`, '', 'PROYECTOS (tablero | etapa | proyecto | área | responsables | subtareas finalizadas/total | horas | fecha):'];
  for (const i of items) {
    lines.push(
      `- ${i.board} | ${i.stage} | ${i.name} | ${i.area || '-'} | ${i.people || 'sin asignar'} | ${i.done}/${i.subs} | ${Number(i.hours)} h | ${i.due_date || '-'}`
    );
  }
  lines.push('', 'SUBTAREAS VENCIDAS:');
  if (!overdue.length) lines.push('- Ninguna');
  for (const s of overdue) lines.push(`- ${s.name} (${s.item}) · ${s.who || 'sin asignar'} · venció ${s.due_date} · ${STATUS[s.status]}`);
  lines.push('', 'ENTREGAS PRÓXIMAS (14 días):');
  if (!upcoming.length) lines.push('- Ninguna');
  for (const s of upcoming) lines.push(`- ${s.due_date}: ${s.name} (${s.item}) · ${s.who || 'sin asignar'} · ${STATUS[s.status]}`);
  lines.push('', 'CARGA POR PROGRAMADOR (horas abiertas):');
  for (const l of load) lines.push(`- ${l.name}: ${l.tasks} subtareas, ${Number(l.open_hours)} h abiertas, ${Number(l.late)} vencidas`);
  return lines.join('\n');
}

const SYSTEM_PROMPT = `Eres "TaskiTask IA", el asistente de un sistema de gestión de proyectos de software.
Respondes siempre en español, de forma breve, clara y práctica. Usa listas cortas cuando ayuden.
Basa tus respuestas en los DATOS DEL ESPACIO DE TRABAJO; si algo no aparece en los datos, dilo en lugar de inventarlo.
Puedes sugerir prioridades, riesgos, planes de prueba (QA) y redactar descripciones o comentarios.`;

/** Quita los bloques ```json ... ``` que a veces agrega el modelo. */
function parseJson(text) {
  const clean = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(clean);
}

async function complete(body) {
  const res = await fetch(`${LM_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: LM_MODEL, ...body }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`LM Studio respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Sugerencias de subtareas para un proyecto (salida estructurada en JSON). */
export async function suggestSubitems({ name, area, stage, existing }) {
  const schema = {
    type: 'object',
    properties: {
      subtareas: {
        type: 'array',
        minItems: 3,
        maxItems: 8,
        items: {
          type: 'object',
          properties: { nombre: { type: 'string' }, horas: { type: 'number' } },
          required: ['nombre', 'horas'],
        },
      },
    },
    required: ['subtareas'],
  };
  const data = await complete({
    temperature: 0.4,
    max_tokens: 700,
    response_format: { type: 'json_schema', json_schema: { name: 'subtareas', strict: true, schema } },
    messages: [
      {
        role: 'system',
        content:
          'Eres un líder técnico. Descompones proyectos de software en subtareas concretas (análisis, desarrollo, pruebas QA, documentación, despliegue) con horas laborales estimadas (múltiplos de 2, entre 2 y 40). Responde solo con JSON.',
      },
      {
        role: 'user',
        content: `Proyecto: "${name}"${area ? `\nÁrea: ${area}` : ''}${stage ? `\nEtapa actual: ${stage}` : ''}${
          existing.length ? `\nSubtareas que ya existen (no las repitas): ${existing.join('; ')}` : ''
        }\nPropón entre 4 y 6 subtareas nuevas en español.`,
      },
    ],
  });
  const parsed = parseJson(data.choices[0].message.content);
  return (parsed.subtareas || [])
    .filter((s) => s && typeof s.nombre === 'string' && s.nombre.trim())
    .slice(0, 8)
    .map((s) => ({ name: s.nombre.trim().slice(0, 200), hours: Math.min(Math.max(Math.round(Number(s.horas) || 4), 1), 80) }));
}

/** Analiza un documento (PDF, Word, texto o imagen) y extrae las tareas que implica. */
export async function analyzeDocument(fileId) {
  const doc = await documentContent(fileId);
  const schema = {
    type: 'object',
    properties: {
      resumen: { type: 'string' },
      tareas: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            horas: { type: 'number' },
            prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
          },
          required: ['nombre', 'horas', 'prioridad'],
        },
      },
    },
    required: ['resumen', 'tareas'],
  };
  const data = await complete({
    temperature: 0.3,
    max_tokens: 900,
    response_format: { type: 'json_schema', json_schema: { name: 'analisis', strict: true, schema } },
    messages: [
      {
        role: 'system',
        content:
          'Eres un analista de requerimientos y líder técnico. Lees documentos (requerimientos, actas, casos de prueba, capturas) y los conviertes en tareas de trabajo concretas para un equipo de software: análisis, desarrollo, pruebas QA, documentación y despliegue. Cada tarea empieza con un verbo, es específica del documento y trae horas laborales estimadas (entre 2 y 40). Responde solo con JSON en español.',
      },
      documentMessage(
        doc,
        'Devuelve: "resumen" (2 o 3 oraciones con lo que pide el documento) y "tareas" (entre 3 y 10) con nombre, horas y prioridad.'
      ),
    ],
  });
  const parsed = parseJson(data.choices[0].message.content);
  return {
    fileName: doc.name,
    summary: String(parsed.resumen || '').trim(),
    truncated: !!doc.truncated,
    pages: doc.pages ?? null,
    tasks: (parsed.tareas || [])
      .filter((t) => t && typeof t.nombre === 'string' && t.nombre.trim())
      .slice(0, 12)
      .map((t) => ({
        name: t.nombre.trim().slice(0, 200),
        hours: Math.min(Math.max(Math.round(Number(t.horas) || 4), 1), 80),
        priority: ['alta', 'media', 'baja'].includes(t.prioridad) ? t.prioridad : 'media',
      })),
  };
}

const DOC_SYSTEM_PROMPT = `Eres "TaskiTask IA", un analista que ayuda a un equipo de software a entender documentos del proyecto.
Respondes en español, breve y claro, con listas cuando ayuden. Basa tus respuestas SOLO en el documento proporcionado;
si algo no está en el documento, dilo. Puedes identificar requerimientos, tareas, riesgos, dudas y criterios de aceptación.`;

// ---------- Chat con streaming (SSE) en un puerto propio ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 200_000) reject(new Error('Mensaje demasiado grande'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function handleChat(req, res) {
  const user = await userFromRequest(req);
  if (!user) {
    res.writeHead(401, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Debes iniciar sesión' }));
  }
  let messages;
  let fileId = null;
  try {
    ({ messages, fileId } = sanitizeChatBody(JSON.parse(await readBody(req))));
    if (!messages.length) throw new Error('Solicitud inválida');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: err.message || 'Solicitud inválida' }));
  }

  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Con un documento, el historial se recorta más porque el propio documento ocupa contexto
  const history = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(fileId ? -4 : -MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (history.length && history[0].role !== 'user') history.shift();

  let prompt;
  try {
    if (fileId) {
      await requireFileAccess({ user }, String(fileId));
      const doc = await documentContent(String(fileId));
      prompt = [
        { role: 'system', content: `${DOC_SYSTEM_PROMPT}\nUsuario actual: ${user.name}.` },
        documentMessage(doc, 'Usa este documento para responder las preguntas que siguen.'),
        { role: 'assistant', content: `Leí "${doc.name}". ¿Qué necesitas saber?` },
        ...history,
      ];
    } else {
      const context = await workspaceContext({ user });
      prompt = [
        { role: 'system', content: `${SYSTEM_PROMPT}\nUsuario actual: ${user.name} (rol: ${user.role_name ?? 'sin rol'}).\n\nDATOS DEL ESPACIO DE TRABAJO:\n${context}` },
        ...history,
      ];
    }
  } catch (err) {
    send('error', { message: err.message });
    return res.end();
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const upstream = await fetch(`${LM_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: LM_MODEL,
        stream: true,
        temperature: 0.4,
        max_tokens: 900,
        messages: prompt,
      }),
    });
    if (!upstream.ok) throw new Error(`LM Studio respondió ${upstream.status}: ${(await upstream.text()).slice(0, 200)}`);

    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) send('token', delta);
        } catch {
          /* fragmento incompleto */
        }
      }
    }
    send('done', {});
  } catch (err) {
    if (!controller.signal.aborted) {
      const offline = err.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(err.message);
      send('error', { message: offline ? 'LM Studio no está disponible. Abre LM Studio e inicia el servidor local (puerto 1234).' : err.message });
    }
  } finally {
    res.end();
  }
}

export function startAiServer() {
  const server = http.createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    if (req.method === 'POST' && req.url === '/ai/chat') return handleChat(req, res);
    res.writeHead(404);
    res.end();
  });
  server.on('error', (err) => console.error(`⚠️  No se pudo iniciar el asistente IA en el puerto ${AI_PORT}: ${err.message}`));
  server.listen(AI_PORT, () => console.log(`🤖 Asistente IA (LM Studio · ${LM_MODEL}) en http://localhost:${AI_PORT}/ai/chat`));
  return server;
}
