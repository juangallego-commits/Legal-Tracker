# Legal Tracker

Web app interna del equipo Global Legal de Rappi+ para hacer seguimiento de tareas y proyectos legales en LATAM. Una sola vista web que adapta su contenido al rol del usuario (specialist / manager / head) y muestra qué hay que cerrar hoy, qué está bloqueado, y cómo va el equipo.

Construida sobre Google Apps Script con Google Sheets como base de datos — sin frameworks ni bundler, un solo HTML servido por `HtmlService`.

## Stack

- **Backend**: Google Apps Script (`.gs`) — auth, mutations, cache, snapshot read, telemetry, Slack integration, daily digest emails
- **Frontend**: HTML + CSS + JS plano servidos vía `HtmlService` — vanilla JS, sin React/Vue/bundler
- **Datos**: Google Sheets (10 hojas — ver "Modelo de datos")
- **Auth**: Google SSO + allowlist en la hoja `Equipos`
- **Integraciones**: Slack (modal de crear/editar), Drive (docs por tarea/proyecto), Gmail (digest diario)
- **Deploy**: [clasp](https://github.com/google/clasp) + GitHub Actions (push a `main` → `clasp push -f` automático)
- **i18n**: ES (default) + PT-BR vía diccionario `T_PT` en cliente
- **Theme**: dark / light con toggle persistido en localStorage

## Modelo de datos

Hojas en el Sheet de Google (constantes en `backend/codigo.gs`):

| Hoja | Uso | Notas |
|------|-----|-------|
| `Tracking Activo` | Tareas en curso | 19 columnas, source of truth |
| `Historial` | Tareas cerradas | Append-only, movidas al cerrar |
| `Equipos` | Roster + allowlist | code/country/leader/members/emails |
| `Proyectos` | Proyectos | 17 columnas |
| `Comments` | Comentarios por tarea | Auto-creada en primer uso |
| `Activity` | Audit log de cambios | Auto-creada; comments, status changes, blocks, reassigns |
| `Config` | Líderes globales (head) | Define quién ve la vista LATAM |
| `Feriados` | Días no laborables por país | Manual; afecta el cálculo de SLA |
| `Templates` | Checklists por tipo de trabajo | Opcional |

Cualquier escritura pasa por `_safeMutation()` que toma `LockService` y luego invalida el cache (TTL 30s en `CacheService`).

## Roles y permisos

Determinados al login leyendo `Equipos` + `Config`:

- **specialist** — ve sus tareas + las del equipo de su país. Edita las propias. Puede cerrar/bloquear con resumen.
- **manager** — todo lo del specialist + ve KPIs del país, reasigna dentro del país, cambia confidencialidad.
- **head** (Global) — vista LATAM agregada, drill-down por país, ve todos los equipos, puede reasignar cross-country.

Si un email no está en `Equipos`, ve una pantalla de "acceso denegado".

## Estructura del repo

```
.
├── appsscript.json              Manifiesto de Apps Script (raíz)
├── backend/
│   ├── codigo.gs                ~3500 líneas — auth, CRUD, snapshot, cache, digest, telemetry
│   ├── SlackModal.gs            Webhook + modal de crear/editar tareas desde Slack
│   └── tests.gs                 Suite de smoke tests (corre desde el editor de Apps Script)
├── frontend/
│   ├── Dashboard.html           Shell HTML
│   ├── Dashboard.css.html       ~3000 líneas — tokens (dark/light), componentes, pills, KPIs, modales
│   ├── Dashboard.js.html        ~11400 líneas — tracker, 3 homes (specialist/manager/head), modales, i18n, dark/light, activity log, notificaciones, bulk ops
│   └── StandaloneDemo.html      Demo offline con datos mockeados
├── .github/workflows/
│   └── deploy-appsscript.yml    CI: push a main → clasp push -f
├── plan/
│   ├── PRD.md                   Product requirements
│   ├── ARCHITECTURE.md          (raíz) — modelo de datos + decisiones técnicas
│   ├── IMPLEMENTATION-PLAN.md   Plan de implementación
│   ├── PILOT-RUNBOOK.md         Guía operativa del piloto
│   ├── VIDEO_TUTORIAL.md        Script para video onboarding
│   └── analysis/                Audits previos del estado del código
├── ARCHITECTURE.md              Capas, flujos, decisiones
├── DEMO_BRIEF.md                Brief para presentación
└── REVIEW_BRIEF.md              Prompt para revisión externa (ver siguiente sección)
```

> En el editor de Apps Script los archivos aparecen con el path completo (ej. `frontend/Dashboard`) — así es como `clasp` publica subcarpetas. Es esperado.

## Features destacadas

- **3 home views adaptadas al rol** — specialist ve "lo que más necesita atención", manager ve "quién necesita atención" en su país, head ve operación LATAM
- **Tracker con bulk actions** — seleccionar N tareas y avanzar/reasignar/poner on hold en una sola pasada. Si avanzas mix de tareas y algunas cerrarían, se abre un wizard de cierre con resumen único.
- **Auto-promote** — editar una tarea Pendiente la mueve automáticamente a En curso (sin clickear estado)
- **Activity log + notificaciones in-app** — sheet `Activity` registra cambios. El menú de usuario muestra "Actividad reciente · N" con badge.
- **Tour interactivo** — primer login dispara un tour de 7 pasos. Saltable.
- **Atajos de teclado** — `/` busca, `N` nueva, `?` ayuda, `Esc` cierra modal, `↑↓` navega selección, `A` avanza la seleccionada
- **Daily digest** — email a las 8am hora del país con vencidas/hoy/bloqueadas
- **Slack integration** — crear y actualizar tareas desde modal de Slack
- **Confidencialidad** — 2 niveles (Normal / Confidencial). Solo manager/head puede cambiarlo.
- **i18n ES/PT-BR** — toggle en menú de usuario, persistido. ~250 strings cubiertos.
- **Dark/light theme** — toggle en menú. Pills con border-left para daltonismo.

## Desarrollo local

### Requisitos

- Node 20+
- [`clasp`](https://github.com/google/clasp): `npm install -g @google/clasp`
- Login: `clasp login`

### Setup

1. Copiar `.clasp.json.example` a `.clasp.json` y poner tu `SCRIPT_ID`.
2. `clasp pull` para traer la versión actual desde Apps Script (opcional si ya tenés el repo al día).
3. Editar `.gs` y `.html` localmente.
4. `clasp push` para subir y probar en el editor.

> Nunca subas `.clasp.json` ni `.clasprc.json` al repo (están en `.gitignore`).

### Validación local rápida

```bash
# Sintaxis del JS embebido en el HTML:
awk 'BEGIN{p=0} /<script>/{p=1; next} /<\/script>/{p=0} p' frontend/Dashboard.js.html | node --check /dev/stdin
```

No hay test runner local — los tests viven en `backend/tests.gs` y corren desde el editor de Apps Script (Run → función `runAllTests`).

## Deploy a producción

Workflow `.github/workflows/deploy-appsscript.yml`:

- Trigger: `push` a `main` (también `workflow_dispatch` manual)
- Acción: `clasp push -f`
- Secrets requeridos en el repo:
  - `CLASPRC_JSON` — contenido completo de `~/.clasprc.json`
  - `SCRIPT_ID` — id del proyecto en Apps Script

Flujo recomendado:

1. Branch desde `main` → `git checkout -b feat/lo-que-sea`
2. Commit + push
3. PR → review → merge
4. Deploy automático al mergear

## Performance y límites conocidos

- **Cache**: snapshot completo en `CacheService` con TTL 30s. Cualquier escritura invalida.
- **Lock**: mutations toman `LockService.getScriptLock()` con timeout 10s. Si el server está ocupado, devuelve "Servidor ocupado, reintentá".
- **Apps Script quotas**: 6 min/ejecución, 30 min/día total. La app está bien dentro de límites con uso normal (<100 escrituras/día por country lead).
- **Document upload**: máximo 45MB (límite Apps Script para `FileBlob`).

## Estado actual

En piloto con ~5 países activos (CO, MX, BR, AR, CL) + global head. ~150 tareas activas en steady state. La rama `claude/review-project-status-fpUFy` acumula las últimas pasadas de UX/diseño/i18n; cuando madura se squash-mergea a `main`.

Ver `REVIEW_BRIEF.md` para el contexto que necesita una persona (o agente) externo que vaya a revisar el proyecto.
