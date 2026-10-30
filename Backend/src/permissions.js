// Catálogo de permisos. Un rol es un conjunto de estas claves (tabla role_permissions); el servidor
// valida cada acción con can(user, 'clave') y la interfaz solo refleja lo mismo.

export const PERMISSIONS = [
  { key: 'users.manage', group: 'Administración', label: 'Gestionar usuarios', description: 'Crear usuarios, cambiar su rol, activarlos o desactivarlos y enviar invitaciones.' },
  { key: 'roles.manage', group: 'Administración', label: 'Gestionar roles', description: 'Crear, editar y eliminar roles y sus permisos.' },
  { key: 'boards.manage', group: 'Tableros', label: 'Gestionar tableros', description: 'Crear, renombrar y eliminar carpetas, tableros y etapas, y reordenar las etapas.' },
  { key: 'projects.viewAll', group: 'Proyectos', label: 'Ver todos los proyectos', description: 'Ver todos los tableros y proyectos aunque no esté asignado (dashboard, actividad y Asistente IA incluidos).' },
  { key: 'projects.assignOthers', group: 'Proyectos', label: 'Asignar a otras personas', description: 'Asignar o quitar personas de un proyecto y asignar subtareas a otros programadores.' },
  { key: 'projects.changeStage', group: 'Proyectos', label: 'Cambiar la etapa de los proyectos', description: 'Mover un proyecto a cualquier etapa (sin permiso solo se puede enviar de "En Desarrollo" a QA).' },
  { key: 'subitems.manageAll', group: 'Subtareas', label: 'Gestionar subtareas de otros', description: 'Editar subtareas de otros programadores y reabrir o corregir subtareas finalizadas.' },
  { key: 'files.deleteAny', group: 'Subtareas', label: 'Eliminar archivos de otros', description: 'Eliminar archivos adjuntos que subieron otras personas.' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/** Roles del sistema: no se eliminan ni se renombran. El Administrador siempre tiene todos los permisos. */
export const SYSTEM_ROLES = [
  { code: 'ADMIN', name: 'Administrador', color: '#6d5df6', description: 'Acceso total al sistema.', permissions: PERMISSION_KEYS },
  { code: 'MEMBER', name: 'Colaborador', color: '#00c875', description: 'Trabaja en los proyectos donde está asignado.', permissions: [] },
  // El QA no necesita permisos extra: ve y prueba los proyectos que le envían (ws_items.qa_id)
  { code: 'QA', name: 'QA', color: '#579bfc', description: 'Revisa los proyectos enviados a QA: registra sus pruebas, los aprueba o los devuelve al programador.', permissions: [] },
];

export const can = (user, permission) => Boolean(user?.permissions?.includes(permission));
