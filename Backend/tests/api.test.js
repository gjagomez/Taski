// Pruebas de integración: levantan la API real sobre una base de datos temporal (gestor_qa_test),
// la recorren por GraphQL como lo haría la interfaz y al final borran esa base.
// No toca la base de trabajo ni envía correos (Mailjet queda sin configurar → Backend/outbox/).
// Ejecutar: npm test  (requiere MySQL con las credenciales de Backend/.env)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: `${ROOT}.env`, quiet: true });

const TEST_DB = 'gestor_qa_test';
const PORT = 4100;
const API = `http://localhost:${PORT}/`;
let server;

const dbAdmin = () =>
  mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

async function dropTestDb() {
  const conn = await dbAdmin();
  await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await conn.end();
}

/** Ejecuta una operación GraphQL. Devuelve data, o { error, code } si el servidor la rechazó. */
async function gql(query, variables = {}, token) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) return { error: body.errors[0].message, code: body.errors[0].extensions?.code };
  return body.data;
}

const login = async (email, password) =>
  (await gql('mutation($e:String!,$p:String!){login(email:$e,password:$p){token user{id}}}', { e: email, p: password })).login;

before(async () => {
  await dropTestDb();
  server = spawn(process.execPath, ['src/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      DB_NAME: TEST_DB,
      PORT: String(PORT),
      AI_PORT: String(PORT + 1),
      MAILJET_API_KEY: '',
      MAILJET_API_SECRET: '',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`La API no arrancó:\n${log}`)), 30_000);
    const onData = (chunk) => {
      log += chunk;
      if (log.includes('API GraphQL lista')) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('exit', (code) => reject(new Error(`La API terminó (código ${code}):\n${log}`)));
  });
});

after(async () => {
  server?.kill();
  await dropTestDb();
});

// ---------------------------------------------------------------------------
describe('Autenticación', () => {
  const REG = 'mutation($n:String!,$e:String!,$p:String!){register(name:$n,email:$e,password:$p){message devCode}}';
  const CONFIRM = 'mutation($e:String!,$c:String!){confirmRegistration(email:$e,code:$c){token user{role{name}}}}';

  test('CP-01 registro: valida campos obligatorios, formato de correo y fortaleza de contraseña', async () => {
    assert.match((await gql(REG, { n: '', e: 'qa@test.com', p: 'Segura123!' })).error, /"Nombre" es obligatorio/);
    assert.match((await gql(REG, { n: 'QA', e: 'qa@test', p: 'Segura123!' })).error, /formato del correo/);
    assert.match((await gql(REG, { n: 'QA', e: 'qa@test.com', p: 'debil' })).error, /La contraseña debe tener/);
    assert.match((await gql(REG, { n: 'Otro', e: 'MARIA@gestor.com', p: 'Segura123!' })).error, /Ya existe una cuenta/);
  });

  test('CP-01b registro: la cuenta se crea solo al confirmar el código enviado al correo', async () => {
    const { devCode } = (await gql(REG, { n: 'Tester QA', e: 'qa@test.com', p: 'Segura123!' })).register;
    assert.match(devCode, /^\d{6}$/);
    // Antes de confirmar no hay cuenta: no se puede iniciar sesión
    assert.equal((await gql('mutation{login(email:"qa@test.com",password:"Segura123!"){token}}')).code, 'UNAUTHENTICATED');
    // Reenviar antes de 60 s no genera otro código
    assert.equal((await gql(REG, { n: 'Tester QA', e: 'qa@test.com', p: 'Segura123!' })).register.devCode, null);
    const wrong = devCode === '000000' ? '111111' : '000000';
    assert.match((await gql(CONFIRM, { e: 'qa@test.com', c: wrong })).error, /Te quedan 4/);
    const ok = (await gql(CONFIRM, { e: 'QA@test.com', c: devCode })).confirmRegistration;
    assert.ok(ok.token);
    assert.equal(ok.user.role.name, 'Colaborador');
    // El código es de un solo uso y el correo ya queda tomado
    assert.match((await gql(CONFIRM, { e: 'qa@test.com', c: devCode })).error, /inválido o ha expirado/);
    assert.match((await gql(REG, { n: 'Otro', e: 'QA@test.com', p: 'Segura123!' })).error, /Ya existe una cuenta/);
  });

  test('CP-02 login: rechaza credenciales incorrectas y acepta las correctas', async () => {
    const bad = await gql('mutation{login(email:"qa@test.com",password:"Incorrecta1!"){token}}');
    assert.equal(bad.code, 'UNAUTHENTICATED');
    assert.ok((await login('qa@test.com', 'Segura123!')).token);
  });

  test('CP-03 recuperación de contraseña: código de 6 dígitos, intentos limitados, un solo uso', async () => {
    const REQ = 'mutation{requestPasswordReset(email:"qa@test.com"){devCode}}';
    const RESET = 'mutation($c:String!,$p:String!){resetPassword(email:"qa@test.com",code:$c,newPassword:$p)}';
    const { devCode } = (await gql(REQ)).requestPasswordReset;
    assert.match(devCode, /^\d{6}$/);
    // Un correo que no existe recibe la misma respuesta (no revela qué cuentas hay)
    assert.equal((await gql('mutation{requestPasswordReset(email:"nadie@test.com"){devCode}}')).requestPasswordReset.devCode, null);
    const wrong = devCode === '000000' ? '111111' : '000000';
    assert.match((await gql(RESET, { c: wrong, p: 'Nueva123!' })).error, /Te quedan 4/);
    assert.equal((await gql(RESET, { c: devCode, p: 'Nueva123!' })).resetPassword, true);
    assert.match((await gql(RESET, { c: devCode, p: 'Otra123!' })).error, /inválido o ha expirado/);
    assert.ok((await login('qa@test.com', 'Nueva123!')).token);
  });

  test('CP-04 roles: un colaborador no puede crear proyectos ni gestionar usuarios', async () => {
    const maria = await login('maria@gestor.com', 'Miembro123!');
    assert.equal((await gql('mutation{createProject(input:{name:"X"}){id}}', {}, maria.token)).code, 'FORBIDDEN');
    assert.equal((await gql('{roles{id}}', {}, maria.token)).code, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
describe('Flujo Kanban: proyecto → tablero → tarea → subtarea', () => {
  let admin, maria, carlos, boardId, taskId, subtaskId;
  const TASK = `id status progress isOverdue completedAt createdAt priority labels assignee{id}
    subtasks{id status checklist{id done}} activity{action detail user{name}} comments{body}`;
  const MOVE = `mutation($id:ID!,$s:Status!,$r:String){moveTask(id:$id,status:$s,reason:$r){${TASK}}}`;
  const move = (status, token, reason) => gql(MOVE, { id: taskId, s: status, r: reason }, token);

  before(async () => {
    admin = await login('admin@gestor.com', 'Admin123!');
    maria = await login('maria@gestor.com', 'Miembro123!');
    carlos = await login('carlos@gestor.com', 'Miembro123!');
  });

  test('CP-05 el administrador crea un proyecto y un tablero con columnas de estado', async () => {
    const p = (await gql('mutation{createProject(input:{name:"Proyecto QA"}){id}}', {}, admin.token)).createProject;
    const b = await gql(
      'mutation($p:ID!,$m:[ID!]){createBoard(input:{projectId:$p,name:"Sprint QA",memberIds:$m}){id columns{status}}}',
      { p: p.id, m: [maria.user.id] },
      admin.token
    );
    boardId = b.createBoard.id;
    assert.deepEqual(b.createBoard.columns.map((c) => c.status), ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE']);
  });

  test('CP-06 crear tarea: fecha de creación automática, prioridad, etiquetas y vencimiento en rojo', async () => {
    const t = await gql(
      `mutation($b:ID!){createTask(input:{boardId:$b,title:"Validar login",description:"Probar el formulario",
        priority:HIGH,labels:["auth","qa"],acceptanceCriteria:"Rechaza correos inválidos",dueDate:"2020-01-31"}){${TASK}}}`,
      { b: boardId },
      maria.token
    );
    taskId = t.createTask.id;
    assert.equal(t.createTask.status, 'BACKLOG');
    assert.equal(t.createTask.priority, 'HIGH');
    assert.deepEqual(t.createTask.labels, ['auth', 'qa']);
    assert.ok(t.createTask.createdAt);
    assert.equal(t.createTask.isOverdue, true, 'fecha límite pasada y sin completar → vencida');
  });

  test('CP-07 transiciones: no se salta estados y "En progreso" exige responsable', async () => {
    assert.equal((await move('DONE', admin.token)).code, 'TRANSITION_NOT_ALLOWED');
    assert.match((await move('IN_PROGRESS', admin.token)).error, /responsable asignado/);
    await gql('mutation($id:ID!,$a:ID){updateTask(id:$id,input:{assigneeId:$a}){id}}', { id: taskId, a: maria.user.id }, admin.token);
    assert.equal((await move('IN_PROGRESS', maria.token)).moveTask.status, 'IN_PROGRESS');
  });

  test('CP-08 subtareas con checklist: la tarea refleja el % de avance y no pasa a revisión con pendientes', async () => {
    const s = await gql('mutation($t:ID!){addSubtask(taskId:$t,title:"Casos de prueba"){id}}', { t: taskId }, maria.token);
    subtaskId = s.addSubtask.id;
    await gql('mutation($t:ID!){addSubtask(taskId:$t,title:"Evidencia"){id}}', { t: taskId }, maria.token);
    const item = await gql('mutation($s:ID!){addChecklistItem(subtaskId:$s,text:"Correo sin dominio"){id}}', { s: subtaskId }, maria.token);
    const toggled = await gql('mutation($id:ID!){toggleChecklistItem(id:$id){status}}', { id: item.addChecklistItem.id }, maria.token);
    assert.equal(toggled.toggleChecklistItem.status, 'DONE', 'checklist completo → subtarea completada');

    let t = (await gql(`query($id:ID!){task(id:$id){${TASK}}}`, { id: taskId }, maria.token)).task;
    assert.equal(t.progress, 50);
    assert.match((await move('REVIEW', maria.token)).error, /1 subtarea\(s\) pendiente/);

    const other = t.subtasks.find((x) => x.id !== subtaskId);
    await gql('mutation($id:ID!){updateSubtask(id:$id,status:DONE){id}}', { id: other.id }, maria.token);
    t = (await gql(`query($id:ID!){task(id:$id){${TASK}}}`, { id: taskId }, maria.token)).task;
    assert.equal(t.progress, 100);
  });

  test('CP-09 solo el responsable envía a revisión; QA rechaza con motivo y luego aprueba', async () => {
    assert.match((await move('REVIEW', carlos.token)).error, /No tienes acceso|Solo el responsable/);
    assert.equal((await move('REVIEW', maria.token)).moveTask.status, 'REVIEW');

    const rejected = (await move('IN_PROGRESS', admin.token, 'Acepta correos sin dominio')).moveTask;
    assert.equal(rejected.status, 'IN_PROGRESS');
    assert.ok(rejected.comments.some((c) => c.body.includes('Acepta correos sin dominio')), 'el motivo queda como comentario');

    await move('REVIEW', maria.token);
    const done = (await move('DONE', admin.token)).moveTask;
    assert.equal(done.status, 'DONE');
    assert.ok(done.completedAt, 'queda la fecha de cierre');
    assert.equal(done.isOverdue, false, 'una tarea completada ya no se marca vencida');
    assert.match((await move('REVIEW', admin.token)).error, /estado final/);
  });

  test('CP-10 trazabilidad: bitácora con usuario y acción, y comentarios por tarea', async () => {
    await gql('mutation($t:ID!){addComment(taskId:$t,body:"Verificado en QA"){id}}', { t: taskId }, admin.token);
    const t = (await gql(`query($id:ID!){task(id:$id){${TASK}}}`, { id: taskId }, admin.token)).task;
    const actions = t.activity.map((a) => a.action);
    for (const a of ['CREATED', 'MOVED', 'REJECTED', 'COMPLETED']) assert.ok(actions.includes(a), `falta ${a} en la bitácora`);
    assert.ok(t.activity.every((a) => a.user?.name));
    assert.ok(t.comments.some((c) => c.body === 'Verificado en QA'));
  });

  test('CP-11 un colaborador no ve tableros a los que no fue asignado', async () => {
    const res = await gql('query($id:ID!){task(id:$id){id}}', { id: taskId }, carlos.token);
    assert.equal(res.code, 'FORBIDDEN');
  });

  test('CP-12 dashboard: totales calculados con los datos del sistema', async () => {
    const { stats } = (await gql('{dashboard{stats{total done inProgress overdue bugs}}}', {}, admin.token)).dashboard;
    assert.ok(stats.total >= 1 && stats.done >= 1);
    assert.ok(stats.bugs >= 2, 'el tablero QA · Bug Tracker trae los defectos documentados');
  });
});

// ---------------------------------------------------------------------------
describe('Mantenimiento de roles', () => {
  test('CP-13 no hay escalada de privilegios', async () => {
    const admin = await login('admin@gestor.com', 'Admin123!');
    const ana = await login('ana@gestor.com', 'Miembro123!');
    const roles = (await gql('{roles{id name}}', {}, admin.token)).roles;
    const ADMIN = roles.find((r) => r.name === 'Administrador').id;
    const gestor = (
      await gql('mutation{createRole(input:{name:"Gestor QA",permissions:["users.manage"]}){id}}', {}, admin.token)
    ).createRole;
    await gql('mutation($u:ID!,$r:ID!){updateUserRole(id:$u,roleId:$r){id}}', { u: ana.user.id, r: gestor.id }, admin.token);
    const SET = 'mutation($u:ID!,$r:ID!){updateUserRole(id:$u,roleId:$r){id}}';
    assert.equal((await gql(SET, { u: ana.user.id, r: ADMIN }, ana.token)).error, 'No puedes cambiar tu propio rol');
    assert.equal((await gql(SET, { u: admin.user.id, r: gestor.id }, ana.token)).code, 'FORBIDDEN');
    assert.match((await gql('mutation($id:ID!){deleteRole(id:$id)}', { id: gestor.id }, admin.token)).error, /usuario\(s\) tienen el rol/);
    assert.match(
      (await gql('mutation($id:ID!){updateRole(id:$id,input:{name:"Administrador",permissions:[]}){id}}', { id: ADMIN }, admin.token)).error,
      /no se pueden quitar/
    );
  });
});

// ---------------------------------------------------------------------------
describe('Revisión QA de proyectos', () => {
  test('CP-14 el QA prueba el proyecto, lo devuelve al mismo programador y al aprobarlo pasa a Producción', async () => {
    const admin = await login('admin@gestor.com', 'Admin123!');
    const maria = await login('maria@gestor.com', 'Miembro123!');
    const QA_ROLE = (await gql('{roles{id name}}', {}, admin.token)).roles.find((r) => r.name === 'QA').id;
    await gql(
      'mutation($r:ID!){createUser(name:"Quinn QA",email:"quinn@test.com",password:"Pruebas123!",roleId:$r){id}}',
      { r: QA_ROLE },
      admin.token
    );
    const qa = await login('quinn@test.com', 'Pruebas123!');

    const board = (await gql('mutation{createWsBoard(name:"Tablero QA"){id groups{id name}}}', {}, admin.token)).createWsBoard;
    const stage = (name) => board.groups.find((g) => g.name === name).id;
    const item = (await gql('mutation($g:ID!){createWsItem(groupId:$g,name:"Pagos"){id}}', { g: stage('En Desarrollo') }, admin.token)).createWsItem;
    await gql('mutation($id:ID!,$u:ID!){updateWsItem(id:$id,input:{assigneeIds:[$u]}){id}}', { id: item.id, u: maria.user.id }, admin.token);

    const ITEM = '{wsItem(id:"ID"){group{name} qa{id} developer{id} subitems{id name kind status assignee{id}}}}';
    const read = async (token) => (await gql(ITEM.replace('ID', item.id), {}, token)).wsItem;
    const NEW = 'mutation($i:ID!,$n:String!,$u:ID){createWsSubitem(itemId:$i,name:$n,input:{assigneeId:$u}){id kind}}';
    const MOVE = 'mutation($id:ID!,$s:SubitemStatus!){updateWsSubitem(id:$id,input:{status:$s}){status}}';
    const SEND = 'mutation($id:ID!,$g:ID!,$qa:ID){updateWsItem(id:$id,input:{groupId:$g,qaId:$qa}){group{name}}}';
    const finish = async (id, token) => {
      await gql(MOVE, { id, s: 'IN_PROGRESS' }, token);
      return gql(MOVE, { id, s: 'DONE' }, token);
    };

    const dev = (await gql(NEW, { i: item.id, n: 'Integrar pasarela', u: maria.user.id }, maria.token)).createWsSubitem;
    assert.equal(dev.kind, 'DEV');
    await finish(dev.id, maria.token);

    // Enviar a QA exige elegir a una persona con el rol QA
    assert.match((await gql(SEND, { id: item.id, g: stage('En QA & Seguridad') }, maria.token)).error, /Elige al QA/);
    assert.match((await gql(SEND, { id: item.id, g: stage('En QA & Seguridad'), qa: maria.user.id }, maria.token)).error, /rol QA/);
    assert.equal((await gql(SEND, { id: item.id, g: stage('En QA & Seguridad'), qa: qa.user.id }, maria.token)).updateWsItem.group.name, 'En QA & Seguridad');

    // El QA ve el proyecto y ya tiene su prueba en el mismo proyecto; el programador queda registrado
    let state = await read(qa.token);
    assert.equal(state.qa.id, qa.user.id);
    assert.equal(state.developer.id, maria.user.id);
    const qaTask = state.subitems.find((s) => s.kind === 'QA');
    assert.equal(qaTask.assignee.id, qa.user.id);
    assert.match((await gql(MOVE, { id: qaTask.id, s: 'IN_PROGRESS' }, maria.token)).error, /Solo el QA asignado/);
    const extra = (await gql(NEW, { i: item.id, n: 'Pruebas de seguridad' }, qa.token)).createWsSubitem;
    assert.equal(extra.kind, 'QA');

    // Rechazo: el QA registra cada bug; vuelve a En Desarrollo con los bugs asignados al mismo programador
    const REJECT = 'mutation($id:ID!,$b:[WsBugInput!]!){rejectWsItemQa(id:$id,bugs:$b){group{name}}}';
    const bugs = [{ name: 'No valida montos negativos', severity: 'HIGH', steps: 'Ingresar -50 y pagar' }];
    assert.equal((await gql(REJECT, { id: item.id, b: bugs }, maria.token)).code, 'FORBIDDEN');
    assert.match((await gql(REJECT, { id: item.id, b: [] }, qa.token)).error, /al menos un bug/);
    assert.equal((await gql(REJECT, { id: item.id, b: bugs }, qa.token)).rejectWsItemQa.group.name, 'En Desarrollo');
    state = await read(maria.token);
    const bug = state.subitems.find((s) => s.name === 'No valida montos negativos');
    assert.equal(bug.kind, 'BUG');
    assert.equal(bug.assignee.id, maria.user.id);
    assert.match((await gql(SEND, { id: item.id, g: stage('En QA & Seguridad') }, maria.token)).error, /faltan 1/);

    // Un bug no se cierra sin comentario de resolución
    await gql(MOVE, { id: bug.id, s: 'IN_PROGRESS' }, maria.token);
    assert.match((await gql(MOVE, { id: bug.id, s: 'DONE' }, maria.token)).error, /comentario de resolución/);
    const CLOSE = 'mutation($id:ID!,$c:String!){updateWsSubitem(id:$id,input:{status:DONE,comment:$c}){status}}';
    assert.equal((await gql(CLOSE, { id: bug.id, c: 'Faltaba validar el signo en el backend' }, maria.token)).updateWsSubitem.status, 'DONE');

    // Corregido, se reenvía al mismo QA sin volver a elegirlo
    assert.equal((await gql(SEND, { id: item.id, g: stage('En QA & Seguridad') }, maria.token)).updateWsItem.group.name, 'En QA & Seguridad');

    // Con las pruebas finalizadas pero el bug sin verificar, no se puede aprobar
    const APPROVE = 'mutation($id:ID!){approveWsItemQa(id:$id){group{name}}}';
    await finish(qaTask.id, qa.token);
    await finish(extra.id, qa.token);
    assert.equal((await read(qa.token)).group.name, 'En QA & Seguridad');
    assert.match((await gql(APPROVE, { id: item.id }, qa.token)).error, /Verifica los bugs corregidos/);
    const VERIFY = 'mutation($id:ID!,$ok:Boolean!,$c:String){verifyWsBug(id:$id,ok:$ok,comment:$c){status verifiedAt reopenCount}}';
    assert.equal((await gql(VERIFY, { id: bug.id, ok: true }, maria.token)).code, 'FORBIDDEN');
    assert.ok((await gql(VERIFY, { id: bug.id, ok: true }, qa.token)).verifyWsBug.verifiedAt);
    // Verificar no basta: pasa a Producción solo con la aprobación explícita del QA (BUG-04)
    assert.equal((await read(qa.token)).group.name, 'En QA & Seguridad');
    assert.equal((await gql(APPROVE, { id: item.id }, maria.token)).code, 'FORBIDDEN');
    assert.equal((await gql(APPROVE, { id: item.id }, qa.token)).approveWsItemQa.group.name, 'En Producción');

    // Trazabilidad: el bug conserva la resolución del programador y la verificación del QA
    const COMMENTS = 'query($id:ID!){wsSubitemComments(subitemId:$id){kind body}}';
    const kinds = (await gql(COMMENTS, { id: bug.id }, admin.token)).wsSubitemComments.map((c) => c.kind);
    assert.deepEqual(kinds, ['RESOLUTION', 'VERIFIED']);
  });

  test('CP-15 un proyecto que quedó en QA sin QA asignado lo completa el programador', async () => {
    const admin = await login('admin@gestor.com', 'Admin123!');
    const maria = await login('maria@gestor.com', 'Miembro123!');
    const qa = await login('quinn@test.com', 'Pruebas123!');
    const board = (await gql('{wsBoards{id name}}', {}, admin.token)).wsBoards.find((b) => b.name === 'Tablero QA');
    const groups = (await gql(`{wsBoard(id:"${board.id}"){groups{id name}}}`, {}, admin.token)).wsBoard.groups;
    const qaStage = groups.find((g) => g.name === 'En QA & Seguridad').id;
    // Como antes de existir el rol QA: el administrador lo pone en QA directo en la base
    const item = (await gql('mutation($g:ID!){createWsItem(groupId:$g,name:"Reportes"){id}}', { g: qaStage }, admin.token)).createWsItem;
    await gql('mutation($id:ID!,$u:ID!){updateWsItem(id:$id,input:{assigneeIds:[$u]}){id}}', { id: item.id, u: maria.user.id }, admin.token);
    const ASSIGN = 'mutation($id:ID!,$qa:ID!){updateWsItem(id:$id,input:{qaId:$qa}){qa{id} developer{id} subitems{kind assignee{id}}}}';
    const done = (await gql(ASSIGN, { id: item.id, qa: qa.user.id }, maria.token)).updateWsItem;
    assert.equal(done.qa.id, qa.user.id);
    assert.equal(done.developer.id, maria.user.id);
    assert.equal(done.subitems.filter((s) => s.kind === 'QA' && s.assignee.id === qa.user.id).length, 1);
    // Ya con QA, cambiarlo es del administrador
    assert.equal((await gql(ASSIGN, { id: item.id, qa: qa.user.id }, maria.token)).code, 'FORBIDDEN');
  });

  test('CP-16 el QA reabre un bug mal corregido: vuelve al programador y cuenta la reincidencia', async () => {
    const admin = await login('admin@gestor.com', 'Admin123!');
    const maria = await login('maria@gestor.com', 'Miembro123!');
    const qa = await login('quinn@test.com', 'Pruebas123!');
    const board = (await gql('{wsBoards{id name}}', {}, admin.token)).wsBoards.find((b) => b.name === 'Tablero QA');
    const groups = (await gql(`{wsBoard(id:"${board.id}"){groups{id name}}}`, {}, admin.token)).wsBoard.groups;
    const stage = (name) => groups.find((g) => g.name === name).id;
    const item = (await gql('mutation($g:ID!){createWsItem(groupId:$g,name:"Facturación"){id}}', { g: stage('En Desarrollo') }, admin.token)).createWsItem;
    await gql('mutation($id:ID!,$u:ID!){updateWsItem(id:$id,input:{assigneeIds:[$u]}){id}}', { id: item.id, u: maria.user.id }, admin.token);
    const SEND = 'mutation($id:ID!,$g:ID!,$qa:ID){updateWsItem(id:$id,input:{groupId:$g,qaId:$qa}){group{name}}}';
    const ITEM = `{wsItem(id:"${item.id}"){group{name} subitems{id name kind status reopenCount}}}`;
    const MOVE = 'mutation($id:ID!,$s:SubitemStatus!,$c:String){updateWsSubitem(id:$id,input:{status:$s,comment:$c}){status}}';
    await gql(SEND, { id: item.id, g: stage('En QA & Seguridad'), qa: qa.user.id }, maria.token);
    await gql('mutation($id:ID!){rejectWsItemQa(id:$id,bugs:[{name:"Total sin IVA",severity:CRITICAL}]){id}}', { id: item.id }, qa.token);
    let bug = (await gql(ITEM, {}, maria.token)).wsItem.subitems.find((s) => s.kind === 'BUG');

    // El programador puede abrir una tarea propia unida al bug
    const NEW = 'mutation($i:ID!,$p:ID!){createWsSubitem(itemId:$i,name:"Ajustar cálculo",input:{parentId:$p}){id kind parentId}}';
    const sub = (await gql(NEW, { i: item.id, p: bug.id }, maria.token)).createWsSubitem;
    assert.equal(sub.parentId, bug.id);
    // No puede borrar el bug ni cambiar lo que reportó el QA
    assert.equal((await gql(`mutation{deleteWsSubitem(id:"${bug.id}")}`, {}, maria.token)).code, 'FORBIDDEN');
    for (const id of [sub.id, bug.id]) {
      await gql(MOVE, { id, s: 'IN_PROGRESS' }, maria.token);
      await gql(MOVE, { id, s: 'DONE', c: 'Se aplica el IVA antes del redondeo' }, maria.token);
    }
    await gql(SEND, { id: item.id, g: stage('En QA & Seguridad') }, maria.token);

    // Reabrir exige comentario; el bug vuelve a Por hacer con una reincidencia
    const VERIFY = 'mutation($id:ID!,$ok:Boolean!,$c:String){verifyWsBug(id:$id,ok:$ok,comment:$c){status reopenCount}}';
    assert.match((await gql(VERIFY, { id: bug.id, ok: false }, qa.token)).error, /explica qué sigue fallando/);
    const reopened = (await gql(VERIFY, { id: bug.id, ok: false, c: 'Sigue sin IVA en descuentos' }, qa.token)).verifyWsBug;
    assert.equal(reopened.status, 'PENDING');
    assert.equal(reopened.reopenCount, 1);
    // Se devuelve sin bugs nuevos porque quedó uno reabierto
    const back = await gql('mutation($id:ID!){rejectWsItemQa(id:$id,bugs:[]){group{name}}}', { id: item.id }, qa.token);
    assert.equal(back.rejectWsItemQa.group.name, 'En Desarrollo');

    // Métricas de calidad del dashboard: 2 bugs en el tablero, 1 verificado y 1 reabierto (50 %)
    const bugsStats = (await gql('{wsDashboard{bugs{total open verified reopens reopenRate bySeverity{severity count} byDeveloper{user{id} total reopens}}}}', {}, admin.token)).wsDashboard.bugs;
    assert.equal(bugsStats.total, 2);
    assert.equal(bugsStats.verified, 1);
    assert.equal(bugsStats.reopens, 1);
    assert.equal(bugsStats.reopenRate, 50);
    assert.equal(bugsStats.bySeverity.find((b) => b.severity === 'CRITICAL').count, 1);
    assert.deepEqual(bugsStats.byDeveloper.map((d) => [d.user.id, d.total, d.reopens]), [[maria.user.id, 2, 1]]);
  });

  test('CP-17 finalizar las pruebas de QA no pasa el proyecto a Producción sin aprobación (BUG-04)', async () => {
    const admin = await login('admin@gestor.com', 'Admin123!');
    const maria = await login('maria@gestor.com', 'Miembro123!');
    const qa = await login('quinn@test.com', 'Pruebas123!');
    const board = (await gql('{wsBoards{id name}}', {}, admin.token)).wsBoards.find((b) => b.name === 'Tablero QA');
    const groups = (await gql(`{wsBoard(id:"${board.id}"){groups{id name}}}`, {}, admin.token)).wsBoard.groups;
    const stage = (name) => groups.find((g) => g.name === name).id;
    const item = (await gql('mutation($g:ID!){createWsItem(groupId:$g,name:"Login"){id}}', { g: stage('En Desarrollo') }, admin.token)).createWsItem;
    await gql('mutation($id:ID!,$u:ID!){updateWsItem(id:$id,input:{assigneeIds:[$u]}){id}}', { id: item.id, u: maria.user.id }, admin.token);
    await gql('mutation($id:ID!,$g:ID!,$qa:ID){updateWsItem(id:$id,input:{groupId:$g,qaId:$qa}){id}}', { id: item.id, g: stage('En QA & Seguridad'), qa: qa.user.id }, maria.token);

    // Lo que pasó en uso real: el QA anota el defecto como una prueba suya y la finaliza
    const NEW = 'mutation($i:ID!,$n:String!){createWsSubitem(itemId:$i,name:$n){id}}';
    const MOVE = 'mutation($id:ID!,$s:SubitemStatus!){updateWsSubitem(id:$id,input:{status:$s}){status}}';
    const misuse = (await gql(NEW, { i: item.id, n: 'Bug login' }, qa.token)).createWsSubitem;
    const tests = (await gql(`{wsItem(id:"${item.id}"){subitems{id kind status}}}`, {}, qa.token)).wsItem.subitems.filter((s) => s.kind === 'QA');
    assert.match((await gql('mutation($id:ID!){approveWsItemQa(id:$id){id}}', { id: item.id }, qa.token)).error, /Finaliza tus pruebas/);
    for (const t of tests) {
      await gql(MOVE, { id: t.id, s: 'IN_PROGRESS' }, qa.token);
      await gql(MOVE, { id: t.id, s: 'DONE' }, qa.token);
    }
    assert.ok(tests.some((t) => t.id === misuse.id));
    // Antes del arreglo aquí pasaba solo a "En Producción"; ahora sigue en QA esperando aprobar o devolver
    const state = (await gql(`{wsItem(id:"${item.id}"){group{name}}}`, {}, qa.token)).wsItem;
    assert.equal(state.group.name, 'En QA & Seguridad');
    const back = await gql('mutation($id:ID!){rejectWsItemQa(id:$id,bugs:[{name:"Bug login",severity:HIGH}]){group{name}}}', { id: item.id }, qa.token);
    assert.equal(back.rejectWsItemQa.group.name, 'En Desarrollo');
  });

  test('CP-18 el QA reporta bugs desde sus pruebas con evidencia: siguen en QA hasta devolverlos al programador', async () => {
    const admin = await login('admin@gestor.com', 'Admin123!');
    const maria = await login('maria@gestor.com', 'Miembro123!');
    const qa = await login('quinn@test.com', 'Pruebas123!');
    const board = (await gql('{wsBoards{id name}}', {}, admin.token)).wsBoards.find((b) => b.name === 'Tablero QA');
    const groups = (await gql(`{wsBoard(id:"${board.id}"){groups{id name}}}`, {}, admin.token)).wsBoard.groups;
    const stage = (name) => groups.find((g) => g.name === name).id;
    const item = (await gql('mutation($g:ID!){createWsItem(groupId:$g,name:"Registro"){id}}', { g: stage('En Desarrollo') }, admin.token)).createWsItem;
    await gql('mutation($id:ID!,$u:ID!){updateWsItem(id:$id,input:{assigneeIds:[$u]}){id}}', { id: item.id, u: maria.user.id }, admin.token);
    await gql('mutation($id:ID!,$g:ID!,$qa:ID){updateWsItem(id:$id,input:{groupId:$g,qaId:$qa}){id}}', { id: item.id, g: stage('En QA & Seguridad'), qa: qa.user.id }, maria.token);
    const NEW = 'mutation($i:ID!,$n:String!){createWsSubitem(itemId:$i,name:$n){id kind}}';
    const login1 = (await gql(NEW, { i: item.id, n: 'Probar login' }, qa.token)).createWsSubitem;
    const form = (await gql(NEW, { i: item.id, n: 'Probar formulario de registro' }, qa.token)).createWsSubitem;
    assert.equal(login1.kind, 'QA');

    const REPORT = 'mutation($t:ID!,$b:[WsBugInput!]!){reportWsBug(testId:$t,bugs:$b){group{name}}}';
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
    const bug = (name, evidence = []) => [{ name, severity: 'HIGH', steps: '1. Abrir\n2. Enviar vacío', evidence }];
    // Solo imágenes o videos reales: un archivo con otra firma se rechaza
    const fake = await gql(REPORT, { t: login1.id, b: bug('x', [{ name: 'a.png', mimeType: 'image/png', dataBase64: Buffer.from('hola').toString('base64') }]) }, qa.token);
    assert.match(fake.error, /no es una imagen ni un video/);
    // El programador no reporta bugs
    assert.match((await gql(REPORT, { t: login1.id, b: bug('x') }, maria.token)).error, /Solo el QA/);

    // Cada reporte deja el proyecto en QA para que el QA siga probando
    const first = await gql(REPORT, { t: login1.id, b: bug('Login acepta contraseña vacía', [{ name: 'captura.png', mimeType: 'image/png', dataBase64: png }]) }, qa.token);
    assert.equal(first.reportWsBug.group.name, 'En QA & Seguridad');
    const second = await gql(REPORT, { t: form.id, b: bug('Registro no valida el correo') }, qa.token);
    assert.equal(second.reportWsBug.group.name, 'En QA & Seguridad');
    // Con bugs abiertos no se aprueba; al terminar los devuelve todos (sin bugs nuevos)
    assert.match((await gql('mutation($id:ID!){approveWsItemQa(id:$id){id}}', { id: item.id }, qa.token)).error, /Finaliza tus pruebas|Verifica los bugs/);
    const back = await gql('mutation($id:ID!){rejectWsItemQa(id:$id,bugs:[]){group{name}}}', { id: item.id }, qa.token);
    assert.equal(back.rejectWsItemQa.group.name, 'En Desarrollo');
    // Con el proyecto en desarrollo ya no se reportan bugs: se hace en la siguiente revisión de QA
    assert.match((await gql(REPORT, { t: form.id, b: bug('Otro') }, qa.token)).error, /en QA/);

    const subs = (await gql(`{wsItem(id:"${item.id}"){subitems{name kind testId assignee{id} evidence{name mimeType}}}}`, {}, maria.token)).wsItem.subitems;
    const bugs = subs.filter((s) => s.kind === 'BUG');
    assert.equal(bugs.length, 2);
    assert.ok(bugs.every((b) => b.assignee.id === maria.user.id));
    const loginBug = bugs.find((b) => b.name === 'Login acepta contraseña vacía');
    assert.equal(loginBug.testId, login1.id);
    assert.deepEqual(loginBug.evidence, [{ name: 'captura.png', mimeType: 'image/png' }]);
    assert.equal(bugs.find((b) => b.name === 'Registro no valida el correo').testId, form.id);

    // "Reportar y devolver a desarrollo" en un solo paso
    await gql('mutation($id:ID!,$g:ID!){updateWsItem(id:$id,input:{groupId:$g}){id}}', { id: item.id, g: stage('En QA & Seguridad') }, admin.token);
    const direct = await gql('mutation($t:ID!,$b:[WsBugInput!]!){reportWsBug(testId:$t,bugs:$b,returnToDev:true){group{name}}}', { t: login1.id, b: bug('Sigue fallando') }, qa.token);
    assert.equal(direct.reportWsBug.group.name, 'En Desarrollo');
  });
});
