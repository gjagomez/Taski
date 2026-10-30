# TaskiTask

TaskiTask es una plataforma web para la gestión de proyectos, tareas y equipos de trabajo. Permite organizar proyectos mediante tableros, etapas y vistas Kanban; administrar subtareas, responsables, fechas, prioridades y comentarios; dar seguimiento a la actividad del equipo; y gestionar usuarios y permisos según su rol.

El proyecto está compuesto por un frontend desarrollado con React y TypeScript, y un backend con Node.js, GraphQL y MySQL. También incluye funcionalidades de control de calidad, seguimiento de bugs y trazabilidad de los cambios realizados en las tareas.

## Requisito de inteligencia artificial

Para utilizar las funciones de asistencia y generación de gráficas, es necesario instalar [LM Studio](https://lmstudio.ai/), descargar el modelo `gemma-3-4b-it-qat` y activar el servidor local compatible con OpenAI en el puerto `1234`. El proyecto utiliza la siguiente configuración:

```env
LMSTUDIO_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=gemma-3-4b-it-qat
```

## Capturas

![Inicio de sesión](docs/capturas/01-login.png)
![Registro y validaciones](docs/capturas/02-registro-validaciones.png)
![Recuperación de contraseña](docs/capturas/03-recuperar.png)
![Dashboard](docs/capturas/04-dashboard.png)
![Kanban de proyectos](docs/capturas/05-kanban-proyectos.png)
![Tablero de sprint](docs/capturas/06-tablero-sprint.png)
![Bug tracker](docs/capturas/07-bug-tracker.png)
![Bugs reales](docs/capturas/07b-bugs-reales.png)
![Detalle de bug](docs/capturas/08-bug-detalle.png)
![Comentarios de bug](docs/capturas/08b-bug-comentarios.png)
![Actividad de bug](docs/capturas/08c-bug-actividad.png)
![Actividad vencida](docs/capturas/09-vencida-actividad.png)
![Subtareas](docs/capturas/09b-subtareas.png)
![Actividad](docs/capturas/10-actividad.png)
![Usuarios](docs/capturas/11-usuarios.png)
![Roles](docs/capturas/12-roles.png)
![Transición mediante arrastre](docs/capturas/13-drag-transicion.png)
![Aprobación de QA](docs/capturas/14-qa-aprobar.png)
