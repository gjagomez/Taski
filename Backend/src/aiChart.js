// Gráficas a pedido: Gemma traduce la petición a una especificación; los datos se calculan con SQL
// sobre dimensiones y métricas permitidas (la IA nunca escribe SQL ni inventa cifras).
import { query } from './db/pool.js';

const LM_URL = (process.env.LMSTUDIO_URL || 'http://localhost:1234/v1').replace(/\/$/, '');
const LM_MODEL = process.env.LMSTUDIO_MODEL || 'gemma-3-4b-it-qat';

export const METRICS = {
  items: { label: 'Proyectos', base: 'items', sql: 'COUNT(DISTINCT i.id)' },
  subitems: { label: 'Subtareas', base: 'subitems', sql: 'COUNT(s.id)' },
  subitems_done: { label: 'Subtareas finalizadas', base: 'subitems', sql: "SUM(s.status = 'DONE')" },
  hours: { label: 'Horas laborales', base: 'subitems', sql: 'COALESCE(SUM(s.hours), 0)' },
  hours_done: { label: 'Horas completadas', base: 'subitems', sql: "COALESCE(SUM(CASE WHEN s.status = 'DONE' THEN s.hours END), 0)" },
  overdue: { label: 'Subtareas vencidas', base: 'subitems', sql: "SUM(s.status <> 'DONE' AND s.due_date < CURDATE())" },
};

const DIMENSIONS = {
  assignee: { label: 'Programador', items: 'u.name', subitems: 'u.name' },
  stage: { label: 'Etapa', items: 'g.name', subitems: 'g.name' },
  board: { label: 'Tablero', items: 'b.name', subitems: 'b.name' },
  status: { label: 'Estado', subitems: 's.status' },
  area: { label: 'Área', items: 'i.area', subitems: 'i.area' },
  year: { label: 'Año', items: 'b.folder', subitems: 'b.folder' },
  month: { label: 'Mes', items: "DATE_FORMAT(i.due_date, '%Y-%m')", subitems: "DATE_FORMAT(s.due_date, '%Y-%m')" },
};

const DUE_DATE = { items: 'i.due_date', subitems: 's.due_date' };

const FROM = {
  // En proyectos, "programador" son las personas asignadas al elemento (un proyecto puede contar para varias)
  items: `FROM ws_items i JOIN ws_boards b ON b.id = i.board_id JOIN ws_groups g ON g.id = i.group_id
          LEFT JOIN ws_item_assignees a ON a.item_id = i.id LEFT JOIN users u ON u.id = a.user_id`,
  subitems: `FROM ws_subitems s JOIN ws_items i ON i.id = s.item_id JOIN ws_boards b ON b.id = i.board_id
             JOIN ws_groups g ON g.id = i.group_id LEFT JOIN users u ON u.id = s.assignee_id`,
};

const STATUS_LABEL = { DONE: 'Finalizado', IN_PROGRESS: 'En progreso', PENDING: 'Por hacer' };
const STATUS_COLOR = { DONE: '#00c875', IN_PROGRESS: '#fdab3d', PENDING: '#c4c4c4' };
// Paleta categórica validada (guía de visualización), en orden fijo
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const MAX_SERIES = 8;
const CHART_TYPES = ['bar', 'horizontal_bar', 'line'];

async function lm(body) {
  const res = await fetch(`${LM_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: LM_MODEL, ...body }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`LM Studio respondió ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

const parseJson = (t) => JSON.parse(t.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());

/** Valores reales disponibles para que el modelo use nombres exactos en los filtros. */
async function vocabulary() {
  const [boards, years, stages, people] = await Promise.all([
    query('SELECT DISTINCT name FROM ws_boards ORDER BY name'),
    query('SELECT DISTINCT folder AS name FROM ws_boards WHERE folder IS NOT NULL UNION SELECT name FROM ws_folders'),
    query('SELECT name, MIN(color) AS color, MIN(position) AS pos FROM ws_groups GROUP BY name ORDER BY pos'),
    query("SELECT name FROM users WHERE active = 1 ORDER BY name"),
  ]);
  return { boards: boards.map((r) => r.name), years: years.map((r) => r.name), stages, people: people.map((r) => r.name) };
}

/** Paso 1: Gemma convierte la petición (y la gráfica anterior, si se está ajustando) en una especificación. */
async function interpret(prompt, previous, vocab) {
  const nullable = (values) => ({ anyOf: [{ type: 'string', enum: values }, { type: 'null' }] });
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      chartType: { type: 'string', enum: CHART_TYPES },
      metric: { type: 'string', enum: Object.keys(METRICS) },
      groupBy: { type: 'string', enum: Object.keys(DIMENSIONS) },
      stackBy: nullable(Object.keys(DIMENSIONS)),
      filters: {
        type: 'object',
        properties: {
          board: nullable(vocab.boards.length ? vocab.boards : ['-']),
          year: nullable(vocab.years.length ? vocab.years : ['-']),
          stage: nullable(vocab.stages.map((s) => s.name)),
          status: nullable(Object.keys(STATUS_LABEL)),
          assignee: nullable(vocab.people),
        },
        required: ['board', 'year', 'stage', 'status', 'assignee'],
      },
    },
    required: ['title', 'chartType', 'metric', 'groupBy', 'stackBy', 'filters'],
  };

  const system = `Conviertes peticiones de gráficas sobre proyectos de software en una especificación JSON.
Métricas: items=cantidad de proyectos, subitems=cantidad de subtareas, subitems_done=subtareas finalizadas (productividad), hours=horas laborales planificadas, hours_done=horas completadas (productividad), overdue=subtareas vencidas.
Dimensiones (groupBy = eje X, stackBy = color/apilado opcional): assignee=programador, stage=etapa del proyecto, board=tablero, status=estado de la subtarea (solo con métricas de subtareas u horas), area, year=año/carpeta, month=mes.
Reglas: "pase"/"pases"/"pases a producción" = proyectos (items) con filtro stage="En Producción". "productividad" = subitems_done u hours_done por programador. "por programador" => groupBy=assignee.
Si piden comparar por etapa o estado dentro de cada barra, usa stackBy. chartType: bar (columnas, por defecto), horizontal_bar (muchas categorías o nombres largos), line (evolución por mes).
Usa solo los valores exactos de los enums en los filtros; si no se menciona un filtro, null. El título va en español, corto.
Tableros: ${vocab.boards.join(', ') || '-'}. Años: ${vocab.years.join(', ') || '-'}. Etapas: ${vocab.stages.map((s) => s.name).join(', ')}. Programadores: ${vocab.people.join(', ')}.`;

  const user = previous
    ? `Gráfica actual: ${JSON.stringify(previous)}\nAjuste pedido: ${prompt}\nDevuelve la especificación completa actualizada.`
    : `Petición: ${prompt}`;

  const content = await lm({
    temperature: 0.1,
    max_tokens: 400,
    response_format: { type: 'json_schema', json_schema: { name: 'grafica', strict: true, schema } },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return parseJson(content);
}

const plain = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const STATUS_WORDS = {
  DONE: ['finalizad', 'terminad', 'completad', 'cerrad'],
  IN_PROGRESS: ['en curso', 'en progreso'],
  PENDING: ['pendiente', 'por hacer'],
};

/**
 * Reglas deterministas sobre lo que propone el modelo (un modelo de 4B tiende a rellenar filtros):
 * un filtro solo se conserva si el usuario lo mencionó (o venía en la gráfica que se está ajustando).
 */
function applyHints(spec, prompt, previous, vocab) {
  const p = plain(prompt);
  const prevFilters = previous?.filters || {};
  const s = { ...spec, filters: { ...spec.filters } };
  const mentioned = (value) => value && p.includes(plain(value));
  const keep = (key, ok) => {
    if (s.filters[key] && !ok(s.filters[key]) && s.filters[key] !== prevFilters[key]) s.filters[key] = null;
  };
  keep('board', mentioned);
  keep('year', mentioned);
  keep('assignee', (v) => mentioned(v) || mentioned(v.split(' ')[0]));
  keep('stage', (v) => mentioned(v) || mentioned(v.replace(/^en /i, '')));
  keep('status', (v) => STATUS_WORDS[v]?.some((w) => p.includes(w)));

  // "Pases" = proyectos que llegaron a producción
  if (/\bpases?\b/.test(p)) {
    const prod = vocab.stages.find((st) => plain(st.name).includes('produccion'));
    s.metric = 'items';
    if (prod) s.filters.stage = prod.name;
    if (!/etapa|tablero|area|mes|ano|año/.test(p)) s.groupBy = 'assignee';
    if (s.stackBy === 'stage') s.stackBy = null;
  }
  // "por programador" fija el eje X; "por etapa"/"por estado" separan las barras por color
  if (/(por|cada) (programador|desarrollador|persona|responsable)/.test(p)) s.groupBy = 'assignee';
  if (/etapa/.test(p) && s.groupBy !== 'stage' && !s.filters.stage) s.stackBy = 'stage';
  if (/estado/.test(p) && s.groupBy !== 'status') {
    s.stackBy = 'status';
    if (METRICS[s.metric].base === 'items') s.metric = 'subitems';
  }
  if (/por mes|mensual|evolucion|tendencia/.test(p)) {
    s.groupBy = 'month';
    if (!/barra|columna/.test(p)) s.chartType = 'line';
  }
  if (/productividad/.test(p) && !/hora/.test(p) && METRICS[s.metric].base === 'items') s.metric = 'subitems_done';
  return s;
}

/** Corrige combinaciones inválidas para que la consulta siempre tenga sentido. */
function normalize(spec) {
  const s = { ...spec, filters: { ...(spec.filters || {}) } };
  if (!METRICS[s.metric]) s.metric = 'items';
  if (!DIMENSIONS[s.groupBy]) s.groupBy = 'assignee';
  if (s.stackBy && !DIMENSIONS[s.stackBy]) s.stackBy = null;
  if (s.stackBy === s.groupBy) s.stackBy = null;
  if (!CHART_TYPES.includes(s.chartType)) s.chartType = 'bar';
  const base = METRICS[s.metric].base;
  // "estado" solo existe en subtareas
  if (base === 'items' && (s.groupBy === 'status' || s.stackBy === 'status' || s.filters.status)) s.metric = 'subitems';
  for (const k of Object.keys(s.filters)) if (s.filters[k] === '-' || s.filters[k] === '') s.filters[k] = null;
  s.title = String(s.title || 'Gráfica').slice(0, 80);
  return s;
}

/** Paso 2: consulta segura con dimensiones permitidas. */
async function runSpec(spec, vocab, scope) {
  const metric = METRICS[spec.metric];
  const base = metric.base;
  const x = DIMENSIONS[spec.groupBy][base];
  const stack = spec.stackBy ? DIMENSIONS[spec.stackBy][base] : null;
  const where = [];
  const params = [];
  const f = spec.filters;
  const filterBy = (sql, value) => {
    where.push(sql);
    params.push(value);
  };
  // Solo los proyectos que el usuario puede ver (wsAccess.itemScope)
  where.push(scope.sql);
  params.push(...scope.params);
  if (f.board) filterBy('b.name = ?', f.board);
  if (f.year) filterBy('b.folder = ?', f.year);
  if (f.stage) filterBy('g.name = ?', f.stage);
  if (f.status && base === 'subitems') filterBy('s.status = ?', f.status);
  if (f.assignee) filterBy('u.name = ?', f.assignee);
  // Sin programador asignado no aporta en gráficas "por programador"
  if (spec.groupBy === 'assignee' || spec.stackBy === 'assignee') where.push('u.id IS NOT NULL');
  if (spec.groupBy === 'month' || spec.stackBy === 'month') where.push(`${DUE_DATE[base]} IS NOT NULL`);

  const rows = await query(
    `SELECT ${x} AS x, ${stack ? `${stack}` : "''"} AS k, ${metric.sql} AS v
     ${FROM[base]} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY x, k`,
    params
  );

  const label = (dim, value) => {
    if (value === null || value === undefined || value === '') return dim === 'area' ? 'Sin área' : 'Sin dato';
    if (dim === 'status') return STATUS_LABEL[value] ?? value;
    return String(value);
  };

  // Categorías del eje X
  const totals = new Map();
  for (const r of rows) {
    const cx = label(spec.groupBy, r.x);
    totals.set(cx, (totals.get(cx) || 0) + Number(r.v || 0));
  }
  let categories = [...totals.keys()].filter((c) => totals.get(c) > 0);
  if (spec.groupBy === 'month' || spec.groupBy === 'year') categories.sort();
  else if (spec.groupBy === 'stage') {
    const order = vocab.stages.map((s) => s.name);
    categories.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else categories.sort((a, b) => totals.get(a) - totals.get(b) || a.localeCompare(b, 'es'));

  // Series (apilado)
  let seriesNames = stack ? [...new Set(rows.map((r) => label(spec.stackBy, r.k)))] : [metric.label];
  if (spec.stackBy === 'stage') {
    const order = vocab.stages.map((s) => s.name);
    seriesNames.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else if (spec.stackBy === 'status') {
    const order = ['Finalizado', 'En progreso', 'Por hacer'];
    seriesNames.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else if (stack) {
    const sum = (n) => rows.filter((r) => label(spec.stackBy, r.k) === n).reduce((t, r) => t + Number(r.v || 0), 0);
    seriesNames.sort((a, b) => sum(b) - sum(a));
  }
  const folded = seriesNames.length > MAX_SERIES ? seriesNames.slice(MAX_SERIES - 1) : [];
  if (folded.length) seriesNames = [...seriesNames.slice(0, MAX_SERIES - 1), 'Otros'];

  const stageColor = Object.fromEntries(vocab.stages.map((s) => [s.name, s.color]));
  const statusByLabel = Object.fromEntries(Object.entries(STATUS_LABEL).map(([k, v]) => [v, k]));
  const colorFor = (name, i) => {
    if (name === 'Otros') return '#9ca3af';
    if (spec.stackBy === 'stage') return stageColor[name] || PALETTE[i % PALETTE.length];
    if (spec.stackBy === 'status') return STATUS_COLOR[statusByLabel[name]] || PALETTE[i % PALETTE.length];
    if (!stack) return '#6d5df6';
    return PALETTE[i % PALETTE.length];
  };

  const series = seriesNames.map((name, i) => ({
    name,
    color: colorFor(name, i),
    values: categories.map((c) =>
      rows
        .filter((r) => label(spec.groupBy, r.x) === c)
        .filter((r) => {
          if (!stack) return true;
          const k = label(spec.stackBy, r.k);
          return name === 'Otros' ? folded.includes(k) : k === name;
        })
        .reduce((t, r) => t + Number(r.v || 0), 0)
    ),
  }));

  return { categories, series: series.filter((s) => s.values.some((v) => v > 0)) };
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Paso 3: lectura del resultado calculada en código (exacta). Un modelo de 4B tiende a
 * equivocarse al leer tablas, así que no se le pide redactar conclusiones numéricas.
 */
function insight(spec, data) {
  const { categories, series } = data;
  if (!categories.length) return 'No hay datos que coincidan con esa consulta.';
  const metric = METRICS[spec.metric].label.toLowerCase();
  const totals = categories.map((_, i) => series.reduce((t, s) => t + s.values[i], 0));
  const total = totals.reduce((a, b) => a + b, 0);
  const parts = [];
  if (spec.groupBy === 'month') {
    const first = totals[0];
    const last = totals[totals.length - 1];
    parts.push(`Entre ${categories[0]} y ${categories[categories.length - 1]} pasa de ${fmt(first)} a ${fmt(last)} ${metric} (total: ${fmt(total)}).`);
  } else {
    const max = Math.max(...totals);
    const min = Math.min(...totals);
    const top = categories.filter((_, i) => totals[i] === max);
    const lowest = categories.length > 1 && min !== max ? `; el más bajo es ${categories[totals.indexOf(min)]} con ${fmt(min)}` : '';
    const verb = top.length > 1 ? 'tienen' : 'tiene';
    parts.push(`${top.join(' y ')} ${verb} el valor más alto con ${fmt(max)} ${metric}${lowest}. Total: ${fmt(total)}.`);
  }
  if (series.length > 1) {
    const bySeries = series.map((s) => [s.name, s.values.reduce((a, b) => a + b, 0)]).sort((a, b) => b[1] - a[1]);
    const [name, value] = bySeries[0];
    parts.push(`Por ${DIMENSIONS[spec.stackBy].label.toLowerCase()}, predomina "${name}" con ${fmt(value)} (${Math.round((value / total) * 100)}%).`);
  }
  return parts.join(' ');
}

export async function buildChart(prompt, previousSpec, scope = { sql: '1=1', params: [] }) {
  const vocab = await vocabulary();
  let previous = null;
  try {
    previous = previousSpec ? JSON.parse(previousSpec) : null;
  } catch {
    previous = null;
  }
  const proposed = normalize(await interpret(prompt, previous, vocab));
  const spec = normalize(applyHints(proposed, prompt, previous, vocab));
  const data = await runSpec(spec, vocab, scope);
  const metric = METRICS[spec.metric];
  const filters = Object.entries(spec.filters)
    .filter(([, v]) => v)
    .map(([k, v]) => (k === 'status' ? STATUS_LABEL[v] : v));
  return {
    title: spec.title,
    chartType: spec.chartType,
    metricLabel: metric.label,
    xLabel: DIMENSIONS[spec.groupBy].label,
    stackLabel: spec.stackBy ? DIMENSIONS[spec.stackBy].label : null,
    filters,
    categories: data.categories,
    series: data.series,
    insight: insight(spec, data),
    spec: JSON.stringify(spec),
  };
}
