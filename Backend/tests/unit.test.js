// Pruebas unitarias de las reglas de negocio (funciones puras, sin base de datos).
// Ejecutar: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { transitionError, passwordProblems, validateEmail, allowedTransitions } from '../src/domain.js';
import {
  subitemTransitionError,
  projectStageError,
  subitemEditError,
  projectAssigneesError,
  resolutionError,
  bugVerifyError,
  bugReportError,
  qaApproveError,
} from '../src/wsWorkflow.js';
import { cleanText, sanitizeArgs } from '../src/security.js';
import { assertSafeSql } from '../src/db/pool.js';
import { can, PERMISSION_KEYS } from '../src/permissions.js';

const admin = { id: 1, permissions: PERMISSION_KEYS };
const member = { id: 2, permissions: [] };
const task = (over = {}) => ({ assignee_id: 2, ...over });

describe('Validaciones de autenticación', () => {
  test('CP-U01 contraseña débil: reporta cada requisito que falta', () => {
    assert.deepEqual(passwordProblems('abc'), ['mínimo 8 caracteres', 'una mayúscula', 'un número', 'un carácter especial']);
    assert.deepEqual(passwordProblems('Segura123!'), []);
  });

  test('CP-U02 formato de correo', () => {
    assert.doesNotThrow(() => validateEmail('ana@empresa.com'));
    for (const bad of ['ana', 'ana@', 'ana@empresa', 'ana @x.com', 'ana@x.c']) {
      assert.throws(() => validateEmail(bad), /formato del correo/, bad);
    }
  });
});

describe('Ciclo de vida de una tarea (módulo Kanban)', () => {
  test('CP-U03 Por hacer → En progreso exige responsable', () => {
    assert.match(transitionError({ task: task({ assignee_id: null }), from: 'BACKLOG', to: 'IN_PROGRESS', subtasks: [], user: admin }), /responsable/);
    assert.equal(transitionError({ task: task(), from: 'BACKLOG', to: 'IN_PROGRESS', subtasks: [], user: member }), null);
  });

  test('CP-U04 no se puede saltar estados', () => {
    assert.match(transitionError({ task: task(), from: 'BACKLOG', to: 'DONE', subtasks: [], user: admin }), /Transición no permitida/);
    assert.match(transitionError({ task: task(), from: 'IN_PROGRESS', to: 'DONE', subtasks: [], user: admin }), /Transición no permitida/);
  });

  test('CP-U05 a revisión solo el responsable y sin subtareas pendientes', () => {
    const other = { id: 9, permissions: [] };
    assert.match(transitionError({ task: task(), from: 'IN_PROGRESS', to: 'REVIEW', subtasks: [], user: other }), /Solo el responsable/);
    assert.match(
      transitionError({ task: task(), from: 'IN_PROGRESS', to: 'REVIEW', subtasks: [{ status: 'PENDING' }], user: member }),
      /1 subtarea\(s\) pendiente/
    );
    assert.equal(transitionError({ task: task(), from: 'IN_PROGRESS', to: 'REVIEW', subtasks: [{ status: 'DONE' }], user: member }), null);
  });

  test('CP-U06 QA aprueba (Completado) o rechaza (En progreso); Completado es final', () => {
    assert.deepEqual(allowedTransitions(task(), 'REVIEW', [], member), ['DONE', 'IN_PROGRESS']);
    assert.match(transitionError({ task: task(), from: 'DONE', to: 'REVIEW', subtasks: [], user: admin }), /estado final/);
  });
});

describe('Reglas del espacio de proyectos', () => {
  test('CP-U07 subtarea finalizada solo la reabre quien tiene "Gestionar subtareas de otros"', () => {
    assert.match(subitemTransitionError({ status: 'DONE', assignee_id: 2 }, 'IN_PROGRESS', member), /Solo un administrador/);
    assert.equal(subitemTransitionError({ status: 'DONE', assignee_id: 2 }, 'IN_PROGRESS', admin), null);
  });

  test('CP-U08 el programador solo envía a QA con todas sus subtareas finalizadas', () => {
    assert.match(projectStageError(member, 'En Desarrollo', 'En QA & Seguridad', 2), /faltan 2/);
    assert.equal(projectStageError(member, 'En Desarrollo', 'En QA & Seguridad', 0), null);
    assert.match(projectStageError(member, 'En Análisis', 'En Producción', 0), /Solo un administrador/);
    // Regresar de QA a desarrollo: solo quien está en el proyecto y mientras el QA no esté probando
    assert.equal(projectStageError(member, 'En QA & Seguridad', 'En Desarrollo', 0, { member: true, qaTesting: false }), null);
    assert.match(projectStageError(member, 'En QA & Seguridad', 'En Desarrollo', 0, { member: true, qaTesting: true }), /pídele que lo devuelva/);
    assert.match(projectStageError(member, 'En QA & Seguridad', 'En Desarrollo', 0, { member: false }), /Solo un administrador/);
  });

  test('CP-U09 sin "Asignar a otras personas" solo puede asignarse a sí mismo', () => {
    assert.match(subitemEditError(null, member, { assigneeId: '7' }), /a ti mismo/);
    assert.equal(subitemEditError(null, member, { assigneeId: '2' }), null);
    assert.match(projectAssigneesError(member, [3], [3, 2, 4]), /a ti mismo/);
    assert.match(projectAssigneesError(member, [3, 2], [3]), /No puedes quitarte/);
    assert.equal(projectAssigneesError(member, [3], [3, 2]), null);
    assert.equal(projectAssigneesError(admin, [3], [4]), null);
  });

  test('CP-U09b un bug se cierra con comentario y solo el QA del proyecto lo verifica', () => {
    const bug = { kind: 'BUG', status: 'DONE', verified_at: null };
    assert.match(resolutionError({ kind: 'BUG' }, 'DONE', '  '), /comentario de resolución/);
    assert.equal(resolutionError({ kind: 'BUG' }, 'DONE', 'Faltaba validar el signo'), null);
    assert.equal(resolutionError({ kind: 'DEV' }, 'DONE', ''), null);
    const item = { qa_id: 2 };
    assert.equal(bugVerifyError(member, item, bug, 'En QA & Seguridad', true), null);
    assert.match(bugVerifyError(member, { qa_id: 9 }, bug, 'En QA & Seguridad', true), /Solo el QA/);
    assert.match(bugVerifyError(member, item, bug, 'En Desarrollo', true), /en QA/);
    assert.match(bugVerifyError(member, item, { ...bug, status: 'IN_PROGRESS' }, 'En QA & Seguridad', true), /aún no ha cerrado/);
    assert.match(bugVerifyError(member, item, bug, 'En QA & Seguridad', false, ''), /explica qué sigue fallando/);
  });

  test('CP-U09c a Producción solo con aprobación del QA, pruebas finalizadas y bugs verificados', () => {
    const item = { qa_id: 2 };
    assert.equal(qaApproveError(member, item, 'En QA & Seguridad', 0, 0), null);
    assert.equal(qaApproveError(admin, { qa_id: 9 }, 'En QA & Seguridad', 0, 0), null);
    assert.match(qaApproveError(member, { qa_id: 9 }, 'En QA & Seguridad', 0, 0), /Solo el QA asignado/);
    assert.match(qaApproveError(member, item, 'En Desarrollo', 0, 0), /etapa de QA/);
    assert.match(qaApproveError(member, item, 'En QA & Seguridad', 1, 0), /Finaliza tus pruebas/);
    assert.match(qaApproveError(member, item, 'En QA & Seguridad', 0, 2), /Verifica los bugs/);
  });

  test('CP-U09d el QA reporta bugs desde sus pruebas, solo con el proyecto en QA', () => {
    const qaTest = { kind: 'QA', assignee_id: 2 };
    const item = { qa_id: 2 };
    assert.equal(bugReportError(member, item, qaTest, 'En QA & Seguridad'), null);
    assert.match(bugReportError(member, item, qaTest, 'En Desarrollo'), /en QA/);
    assert.equal(bugReportError(admin, { qa_id: 9 }, { kind: 'QA', assignee_id: 9 }, 'En QA & Seguridad'), null);
    assert.match(bugReportError(member, { qa_id: 9 }, { kind: 'QA', assignee_id: 9 }, 'En QA & Seguridad'), /Solo el QA/);
    assert.match(bugReportError(member, item, { kind: 'DEV', assignee_id: 2 }, 'En QA & Seguridad'), /prueba de QA/);
    assert.match(bugReportError(member, item, qaTest, 'En Producción'), /en QA/);
  });

  test('CP-U10 can() solo concede permisos del rol', () => {
    assert.equal(can(admin, 'roles.manage'), true);
    assert.equal(can(member, 'roles.manage'), false);
    assert.equal(can(null, 'roles.manage'), false);
  });
});

describe('Seguridad de entradas', () => {
  test('CP-U11 se bloquean consultas SQL con ; comentarios o parámetros que no cuadran', () => {
    assert.throws(() => assertSafeSql('SELECT 1; DROP TABLE users'), /";"/);
    assert.throws(() => assertSafeSql('SELECT * FROM users -- x'), /comentarios/);
    assert.throws(() => assertSafeSql('SELECT * FROM users WHERE id = ?', []), /parámetro/);
    assert.doesNotThrow(() => assertSafeSql('SELECT * FROM users WHERE id = ?', [1]));
  });

  test('CP-U12 limpieza de argumentos: quita caracteres de control y valida identificadores', () => {
    assert.equal(cleanText('ho\u0000la​'), 'hola');
    assert.throws(() => sanitizeArgs({ id: "1 OR 1=1" }), /Identificador inválido/);
    // Las contraseñas no se alteran
    assert.equal(sanitizeArgs({ password: ' Abc\u0000 ' }).password, ' Abc\u0000 ');
  });
});
