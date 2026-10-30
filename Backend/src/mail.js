// Envío de correos con Mailjet (API v3.1). Sin MAILJET_API_KEY / MAILJET_API_SECRET no sale nada por
// internet: el correo renderizado se guarda en Backend/outbox/ para revisarlo en el navegador.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { query } from './db/pool.js';
import { can } from './permissions.js';
import { invitationEmail, passwordResetEmail, registrationCodeEmail } from './mailTemplates.js';

const MAILJET_URL = 'https://api.mailjet.com/v3.1/send';
const OUTBOX_DIR = fileURLToPath(new URL('../outbox/', import.meta.url));

const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
const brand = () => process.env.MAIL_FROM_NAME || 'TaskiTask';
const configured = () => Boolean(process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET);

/** `user` debe venir de loadAuthUser (auth.js): trae role_name y permissions. */
/** Envía (o guarda en outbox/) un correo. Devuelve { sent, simulated, detail }. */
export async function sendMail({ to, toName, subject, html, text }) {
  if (!configured()) {
    await mkdir(OUTBOX_DIR, { recursive: true });
    const file = path.join(OUTBOX_DIR, `${Date.now()}-${to.replace(/[^a-z0-9.@_-]/gi, '_')}.html`);
    await writeFile(file, html, 'utf8');
    console.log(`📭 Mailjet sin configurar: correo para ${to} guardado en ${file}`);
    return { sent: false, simulated: true, detail: `Guardado en outbox/${path.basename(file)}` };
  }

  const fromEmail = process.env.MAIL_FROM_EMAIL;
  if (!fromEmail) throw new Error('Falta MAIL_FROM_EMAIL en Backend/.env');
  const auth = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_API_SECRET}`).toString('base64');
  const res = await fetch(MAILJET_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: fromEmail, Name: brand() },
          To: [{ Email: to, Name: toName }],
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  const msg = body.Messages?.[0];
  if (!res.ok || msg?.Status !== 'success') {
    const reason = msg?.Errors?.map((e) => e.ErrorMessage).join('; ') || body.ErrorMessage || `HTTP ${res.status}`;
    throw new Error(`Mailjet rechazó el envío: ${reason}`);
  }
  console.log(`📧 Correo enviado a ${to} (Mailjet ${msg.To?.[0]?.MessageID ?? ''})`);
  return { sent: true, simulated: false, detail: `Enviado a ${to}` };
}

/**
 * Tableros (Nuevo, Billetera, PRONET…) a los que pertenece el usuario, con sus proyectos.
 * Mismo criterio que wsAccess.js: un colaborador pertenece a los proyectos donde está asignado
 * o tiene alguna subtarea; con el permiso projects.viewAll ve todos los tableros.
 */
export async function userBoards(user) {
  if (can(user, 'projects.viewAll')) {
    const rows = await query(
      `SELECT b.id, b.name, b.folder, COUNT(i.id) AS total
       FROM ws_boards b LEFT JOIN ws_items i ON i.board_id = b.id
       GROUP BY b.id, b.name, b.folder ORDER BY b.folder, b.name`
    );
    return rows.map((r) => ({ id: r.id, name: r.name, folder: r.folder, total: Number(r.total), projects: [] }));
  }
  const rows = await query(
    `SELECT b.id AS board_id, b.name AS board, b.folder, i.id, i.name, g.name AS stage, g.color,
       (SELECT COUNT(*) FROM ws_subitems s WHERE s.item_id = i.id AND s.assignee_id = ? AND s.status <> 'DONE') AS pending
     FROM ws_items i
     JOIN ws_boards b ON b.id = i.board_id
     JOIN ws_groups g ON g.id = i.group_id
     WHERE i.id IN (SELECT item_id FROM ws_item_assignees WHERE user_id = ?
                    UNION SELECT item_id FROM ws_subitems WHERE assignee_id = ?
                    UNION SELECT id FROM ws_items WHERE qa_id = ?)
     ORDER BY b.folder, b.name, g.position, i.position`,
    [user.id, user.id, user.id, user.id]
  );
  const boards = new Map();
  for (const r of rows) {
    if (!boards.has(r.board_id)) boards.set(r.board_id, { id: r.board_id, name: r.board, folder: r.folder, projects: [] });
    boards.get(r.board_id).projects.push({ id: r.id, name: r.name, stage: r.stage, color: r.color, pending: Number(r.pending) });
  }
  return [...boards.values()].map((b) => ({ ...b, total: b.projects.length }));
}

/**
 * Correo de invitación / bienvenida con los tableros del usuario.
 * kind: 'welcome' (se registró solo) | 'invite' (lo creó o lo invita un administrador).
 */
export async function sendInvitation(user, { kind = 'invite', invitedBy = null, message = null, temporaryPassword = null } = {}) {
  const boards = await userBoards(user);
  const { subject, html, text } = invitationEmail({
    kind,
    brand: brand(),
    appUrl: appUrl(),
    user,
    boards,
    invitedBy,
    message,
    temporaryPassword,
  });
  return sendMail({ to: user.email, toName: user.name, subject, html, text });
}

/** Código de recuperación de contraseña. */
export async function sendPasswordReset(user, code, minutes) {
  const { subject, html, text } = passwordResetEmail({ brand: brand(), appUrl: appUrl(), user, code, minutes });
  return sendMail({ to: user.email, toName: user.name, subject, html, text });
}

/** Código para confirmar el correo al registrarse. `user` es { name, email }: la cuenta aún no existe. */
export async function sendRegistrationCode(user, code, minutes) {
  const { subject, html, text } = registrationCodeEmail({ brand: brand(), appUrl: appUrl(), user, code, minutes });
  return sendMail({ to: user.email, toName: user.name, subject, html, text });
}
