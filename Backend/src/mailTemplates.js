// Plantillas HTML de correo. Maquetadas con tablas y estilos en línea para que se vean igual en
// Gmail, Outlook y móviles. Todo texto que viene de la base o del usuario pasa por esc().

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const PRIMARY = '#6d5df6';
const PRIMARY_DARK = '#4f3fd9';
const INK = '#1f2340';
const MUTED = '#6b7090';
const LINE = '#ebe9f7';
const FONT = "'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

function button(href, label) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
    <tr><td align="center" bgcolor="${PRIMARY}" style="border-radius:999px;background:${PRIMARY};background-image:linear-gradient(135deg,${PRIMARY},${PRIMARY_DARK})">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)} &rarr;</a>
    </td></tr>
  </table>`;
}

function stagePill(name, color) {
  const c = /^#[0-9a-f]{3,8}$/i.test(color || '') ? color : PRIMARY;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${c};color:#ffffff;font-family:${FONT};font-size:11px;font-weight:700;white-space:nowrap">${esc(name)}</span>`;
}

/** Estructura común: marca, tarjeta blanca con las filas `rows` y pie. */
function shell({ brand, subject, preheader, email, rows }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f2fb">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f2fb" style="background:#f3f2fb">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">

    <!-- Marca -->
    <tr><td style="padding:0 8px 18px;font-family:${FONT};font-size:18px;font-weight:800;color:${INK}">
      <span style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:9px;background:${PRIMARY};color:#fff;text-align:center;font-size:15px;vertical-align:middle">✓</span>
      <span style="vertical-align:middle;padding-left:6px">${esc(brand)}</span>
    </td></tr>

    <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(53,40,160,.10)">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
      </table>
    </td></tr>

    <!-- Pie -->
    <tr><td align="center" style="padding:22px 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:#9a9db8">
      Recibes este correo porque tienes una cuenta en ${esc(brand)} con ${esc(email)}.<br>
      Si no esperabas este mensaje, puedes ignorarlo.
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

function boardCard(board, appUrl, isAdmin) {
  const href = `${appUrl}/proyectos/${board.id}`;
  const rows = board.projects
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${INK}">
          <a href="${esc(`${appUrl}/proyectos/${board.id}/p/${p.id}`)}" style="color:${INK};text-decoration:none;font-weight:600">${esc(p.name)}</a>
          ${p.pending ? `<div style="font-size:12px;color:${MUTED};padding-top:2px">${p.pending} subtarea${p.pending === 1 ? '' : 's'} pendiente${p.pending === 1 ? '' : 's'} para ti</div>` : ''}
        </td>
        <td align="right" valign="top" style="padding:10px 0 10px 12px;border-top:1px solid ${LINE}">${stagePill(p.stage, p.color)}</td>
      </tr>`
    )
    .join('');
  const summary = isAdmin
    ? `${board.total} proyecto${board.total === 1 ? '' : 's'} en el tablero`
    : `Participas en ${board.total} proyecto${board.total === 1 ? '' : 's'}`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;border:1px solid ${LINE};border-radius:16px;background:#ffffff">
    <tr><td style="padding:16px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle" width="44" style="padding-right:12px">
            <div style="width:40px;height:40px;line-height:40px;border-radius:12px;background:#f1efff;color:${PRIMARY};text-align:center;font-family:${FONT};font-size:18px;font-weight:800">${esc(initials(board.name).slice(0, 1))}</div>
          </td>
          <td valign="middle" style="font-family:${FONT}">
            ${board.folder ? `<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">Carpeta ${esc(board.folder)}</div>` : ''}
            <a href="${esc(href)}" style="font-size:17px;font-weight:800;color:${INK};text-decoration:none">${esc(board.name)}</a>
            <div style="font-size:12px;color:${MUTED}">${summary}</div>
          </td>
        </tr>
      </table>
      ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px">${rows}</table>` : ''}
    </td></tr>
  </table>`;
}

/**
 * Invitación / bienvenida. Devuelve { subject, html, text }.
 * boards: [{ id, name, folder, total, projects: [{ id, name, stage, color, pending }] }]
 */
export function invitationEmail({ kind, brand, appUrl, user, boards, invitedBy, message, temporaryPassword }) {
  // Con projects.viewAll el correo lista todos los tableros, no solo los suyos
  const isAdmin = Boolean(user.permissions?.includes('projects.viewAll'));
  const firstName = String(user.name).trim().split(/\s+/)[0];
  const roleLabel = user.role_name || 'Colaborador';
  const loginUrl = `${appUrl}/login`;

  const subject =
    kind === 'welcome'
      ? `¡Bienvenido a ${brand}, ${firstName}!`
      : invitedBy
        ? `${invitedBy.name} te invitó a ${brand}`
        : `Tu acceso a ${brand}`;

  const intro =
    kind === 'welcome'
      ? `Tu cuenta quedó creada. Desde ${esc(brand)} vas a seguir tus proyectos, mover tus subtareas en el Kanban y ver lo que pasa en cada tablero.`
      : invitedBy
        ? `<strong style="color:${INK}">${esc(invitedBy.name)}</strong> te dio acceso al espacio de trabajo de ${esc(brand)}. Aquí tienes un resumen de tu cuenta y de los tableros donde participas.`
        : `Este es un resumen de tu cuenta en ${esc(brand)} y de los tableros donde participas.`;

  const preheader =
    boards.length > 0
      ? `Tableros: ${boards.map((b) => b.name).join(', ')}`
      : `Tu cuenta de ${brand} está lista`;

  const boardsHtml = boards.length
    ? boards.map((b) => boardCard(b, appUrl, isAdmin)).join('')
    : `<div style="padding:20px;border:1px dashed ${LINE};border-radius:16px;text-align:center;font-family:${FONT};font-size:14px;color:${MUTED}">
         Todavía no estás asignado a ningún proyecto. Cuando un administrador te agregue a uno, aparecerá en tu panel.
       </div>`;

  const messageHtml = message
    ? `<tr><td style="padding:0 36px 24px">
        <div style="border-left:4px solid ${PRIMARY};background:#f7f6ff;border-radius:0 12px 12px 0;padding:14px 18px;font-family:${FONT};font-size:14px;line-height:1.6;color:${INK}"><div style="white-space:pre-line">${esc(message)}</div>${
          invitedBy ? `<div style="padding-top:8px;font-size:12px;color:${MUTED}">— ${esc(invitedBy.name)}</div>` : ''
        }</div>
      </td></tr>`
    : '';

  const credentialRow = (label, value, mono = false) => `
    <tr>
      <td style="padding:6px 0;font-family:${FONT};font-size:13px;color:${MUTED}" width="130">${label}</td>
      <td style="padding:6px 0;font-family:${mono ? "Consolas,'Courier New',monospace" : FONT};font-size:14px;font-weight:700;color:${INK}">${esc(value)}</td>
    </tr>`;

  const html = shell({ brand, subject, preheader, email: user.email, rows: `
        <!-- Cabecera -->
        <tr><td bgcolor="${PRIMARY}" style="background:${PRIMARY};background-image:linear-gradient(135deg,${PRIMARY} 0%,#8b5cf6 55%,#ec6fa8 100%);padding:40px 36px 34px;border-radius:24px 24px 0 0">
          <div style="width:60px;height:60px;line-height:60px;border-radius:50%;background:${esc(user.avatar_color || '#ffffff')};border:3px solid rgba(255,255,255,.85);color:#ffffff;text-align:center;font-family:${FONT};font-size:22px;font-weight:800">${esc(initials(user.name))}</div>
          <h1 style="margin:18px 0 6px;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:800;color:#ffffff">${kind === 'welcome' ? '¡Bienvenido' : 'Hola'}, ${esc(firstName)}${kind === 'welcome' ? '!' : ' 👋'}</h1>
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.22);font-family:${FONT};font-size:12px;font-weight:700;color:#ffffff">${roleLabel}</span>
        </td></tr>

        <!-- Introducción -->
        <tr><td style="padding:30px 36px 22px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED}">${intro}</td></tr>

        ${messageHtml}

        <!-- Datos de acceso -->
        <tr><td style="padding:0 36px 26px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafaff;border:1px solid ${LINE};border-radius:16px">
            <tr><td style="padding:16px 20px">
              <div style="font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${PRIMARY};padding-bottom:6px">Tus datos de acceso</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${credentialRow('Correo', user.email)}
                ${temporaryPassword ? credentialRow('Contraseña temporal', temporaryPassword, true) : ''}
                ${credentialRow('Rol', roleLabel)}
              </table>
              ${
                temporaryPassword
                  ? `<div style="padding-top:8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED}">Por seguridad, cámbiala al entrar con <em>¿Olvidaste tu contraseña?</em> en la pantalla de inicio de sesión.</div>`
                  : ''
              }
            </td></tr>
          </table>
        </td></tr>

        <!-- Tableros -->
        <tr><td style="padding:0 36px 8px">
          <div style="font-family:${FONT};font-size:18px;font-weight:800;color:${INK};padding-bottom:4px">${isAdmin ? 'Tableros del espacio de trabajo' : 'Tus tableros'}</div>
          <div style="font-family:${FONT};font-size:13px;color:${MUTED};padding-bottom:14px">${
            isAdmin ? 'Con tu rol tienes acceso a todos.' : 'Los grupos y proyectos donde estás asignado.'
          }</div>
          ${boardsHtml}
        </td></tr>

        <!-- Botón -->
        <tr><td align="center" style="padding:22px 36px 36px">
          ${button(loginUrl, kind === 'welcome' ? 'Ir a mi panel' : 'Entrar a ' + brand)}
          <div style="padding-top:14px;font-family:${FONT};font-size:12px;color:${MUTED}">o copia este enlace: <a href="${esc(loginUrl)}" style="color:${PRIMARY}">${esc(loginUrl)}</a></div>
        </td></tr>

` });

  const textBoards = boards.length
    ? boards
        .map(
          (b) =>
            `• ${b.name}${b.folder ? ` (${b.folder})` : ''}` +
            b.projects.map((p) => `\n    - ${p.name} [${p.stage}]${p.pending ? ` · ${p.pending} pendiente(s)` : ''}`).join('')
        )
        .join('\n')
    : 'Todavía no estás asignado a ningún proyecto.';

  const text = [
    `${kind === 'welcome' ? '¡Bienvenido' : 'Hola'}, ${firstName}`,
    '',
    intro.replace(/<[^>]+>/g, ''),
    message ? `\n"${message}"${invitedBy ? ` — ${invitedBy.name}` : ''}` : '',
    '',
    `Correo: ${user.email}`,
    temporaryPassword ? `Contraseña temporal: ${temporaryPassword}` : '',
    `Rol: ${roleLabel}`,
    '',
    isAdmin ? 'Tableros del espacio de trabajo:' : 'Tus tableros:',
    textBoards,
    '',
    `Entrar: ${loginUrl}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  return { subject, html, text };
}

/** Un cuadrito por dígito del código. */
const codeDigits = (code) =>
  String(code)
    .split('')
    .map(
      (d) =>
        `<td style="padding:0 4px"><div style="width:46px;height:58px;line-height:58px;border-radius:14px;background:#f1efff;border:1px solid #dcd7ff;font-family:Consolas,'Courier New',monospace;font-size:30px;font-weight:800;color:${PRIMARY_DARK};text-align:center">${esc(d)}</div></td>`
    )
    .join('');

/** Código para recuperar la contraseña. Devuelve { subject, html, text }. */
export function passwordResetEmail({ brand, appUrl, user, code, minutes }) {
  const firstName = String(user.name).trim().split(/\s+/)[0];
  const resetUrl = `${appUrl}/recuperar?email=${encodeURIComponent(user.email)}&code=${code}`;
  const subject = `${code} es tu código para recuperar tu contraseña de ${brand}`;
  const digits = codeDigits(code);

  const rows = `
        <tr><td bgcolor="${PRIMARY}" style="background:${PRIMARY};background-image:linear-gradient(135deg,${PRIMARY} 0%,#8b5cf6 55%,#ec6fa8 100%);padding:36px 36px 30px;border-radius:24px 24px 0 0">
          <div style="width:56px;height:56px;line-height:56px;border-radius:16px;background:rgba(255,255,255,.22);text-align:center;font-size:26px">🔐</div>
          <h1 style="margin:16px 0 4px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;color:#ffffff">Recupera tu contraseña</h1>
          <div style="font-family:${FONT};font-size:14px;color:rgba(255,255,255,.88)">Hola, ${esc(firstName)}. Recibimos una solicitud para cambiar tu contraseña.</div>
        </td></tr>

        <tr><td style="padding:30px 36px 8px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED}">
          Escribe este código en la pantalla de recuperación. Vence en <strong style="color:${INK}">${minutes} minutos</strong> y solo se puede usar una vez.
        </td></tr>

        <tr><td align="center" style="padding:18px 36px 24px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${digits}</tr></table>
        </td></tr>

        <tr><td align="center" style="padding:0 36px 28px">
          ${button(resetUrl, 'Cambiar mi contraseña')}
          <div style="padding-top:12px;font-family:${FONT};font-size:12px;color:${MUTED}">El botón abre la pantalla con tu correo y el código ya escritos.</div>
        </td></tr>

        <tr><td style="padding:0 36px 34px">
          <div style="border-radius:14px;background:#fff7ed;border:1px solid #fde3c4;padding:14px 18px;font-family:${FONT};font-size:13px;line-height:1.6;color:#8a4b12">
            <strong>¿No fuiste tú?</strong> Ignora este correo: tu contraseña actual sigue funcionando. Nunca compartas este código; nadie de ${esc(brand)} te lo va a pedir.
          </div>
        </td></tr>`;

  const html = shell({ brand, subject, preheader: `Tu código vence en ${minutes} minutos`, email: user.email, rows });
  const text = [
    `Hola, ${firstName}`,
    '',
    `Tu código para recuperar la contraseña de ${brand} es: ${code}`,
    `Vence en ${minutes} minutos y solo se puede usar una vez.`,
    '',
    `Cambiar la contraseña: ${resetUrl}`,
    '',
    'Si no lo pediste, ignora este correo: tu contraseña actual sigue funcionando.',
  ].join('\n');
  return { subject, html, text };
}

/** Código para confirmar el correo al crear la cuenta. Devuelve { subject, html, text }. */
export function registrationCodeEmail({ brand, appUrl, user, code, minutes }) {
  const firstName = String(user.name).trim().split(/\s+/)[0];
  const confirmUrl = `${appUrl}/registro?email=${encodeURIComponent(user.email)}&code=${code}`;
  const subject = `${code} es tu código para crear tu cuenta de ${brand}`;

  const rows = `
        <tr><td bgcolor="${PRIMARY}" style="background:${PRIMARY};background-image:linear-gradient(135deg,${PRIMARY} 0%,#8b5cf6 55%,#ec6fa8 100%);padding:36px 36px 30px;border-radius:24px 24px 0 0">
          <div style="width:56px;height:56px;line-height:56px;border-radius:16px;background:rgba(255,255,255,.22);text-align:center;font-size:26px">✉️</div>
          <h1 style="margin:16px 0 4px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;color:#ffffff">Confirma tu correo</h1>
          <div style="font-family:${FONT};font-size:14px;color:rgba(255,255,255,.88)">Hola, ${esc(firstName)}. Ya casi tienes tu cuenta de ${esc(brand)}.</div>
        </td></tr>

        <tr><td style="padding:30px 36px 8px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED}">
          Escribe este código en la pantalla de registro para crear tu cuenta. Vence en <strong style="color:${INK}">${minutes} minutos</strong> y solo se puede usar una vez.
        </td></tr>

        <tr><td align="center" style="padding:18px 36px 24px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${codeDigits(code)}</tr></table>
        </td></tr>

        <tr><td align="center" style="padding:0 36px 28px">
          ${button(confirmUrl, 'Confirmar mi correo')}
          <div style="padding-top:12px;font-family:${FONT};font-size:12px;color:${MUTED}">El botón abre la pantalla con tu correo y el código ya escritos.</div>
        </td></tr>

        <tr><td style="padding:0 36px 34px">
          <div style="border-radius:14px;background:#fff7ed;border:1px solid #fde3c4;padding:14px 18px;font-family:${FONT};font-size:13px;line-height:1.6;color:#8a4b12">
            <strong>¿No fuiste tú?</strong> Ignora este correo: sin el código no se crea ninguna cuenta con tu dirección.
          </div>
        </td></tr>`;

  const html = shell({ brand, subject, preheader: `Tu código vence en ${minutes} minutos`, email: user.email, rows });
  const text = [
    `Hola, ${firstName}`,
    '',
    `Tu código para crear tu cuenta de ${brand} es: ${code}`,
    `Vence en ${minutes} minutos y solo se puede usar una vez.`,
    '',
    `Confirmar el correo: ${confirmUrl}`,
    '',
    'Si no lo pediste, ignora este correo: sin el código no se crea ninguna cuenta.',
  ].join('\n');
  return { subject, html, text };
}
