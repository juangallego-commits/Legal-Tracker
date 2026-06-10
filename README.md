# MyDash · Legal Tracker

Web app interna del equipo **Global Legal de Rappi+** para hacer seguimiento de tareas y proyectos legales en LATAM. Una sola vista web que adapta su contenido al rol del usuario (specialist / manager / head) y muestra qué hay que cerrar hoy, qué está bloqueado, y cómo va el equipo.

Construida sobre **Google Apps Script** con **Google Sheets** como base de datos — sin frameworks ni bundler, un solo HTML servido por `HtmlService`. La app se conoce internamente como **MyDash** (ver título/footer); "Legal Tracker" es el nombre del proyecto/repo.

## Stack

- **Backend**: Google Apps Script (`.gs`, runtime V8) — auth, mutations, cache, snapshot read, telemetry, digest diario, integraciones
- **Frontend**: HTML + CSS + JS plano servidos vía `HtmlService` — vanilla JS, sin React/Vue/bundler
- **Datos**: Google Sheets (12 hojas — ver "Modelo de datos")
- **Auth**: Google SSO + allowlist en la hoja `Equipos`; el rol se deriva de `Equipos` + `Config`
- **Integraciones**: Slack (modal crear/editar), Drive (docs por tarea/proyecto), Gmail (digest diario + add-on contextual), Google Calendar (read-only, cruza reuniones con deadlines), Gemini (AI sobre documentos)
- **Deploy**: [clasp](https://github.com/google/clasp) + GitHub Actions (push a `main` → `clasp push -f` + redeploy a la **misma URL** `/exec`)
- **i18n**: ES (default) + PT-BR vía diccionario `T_PT` en `frontend/I18n.js.html` (gate de CI obligatorio)
- **Theme**: dark / light con toggle persistido en localStorage

## Modelo de datos

Hojas en el Sheet de Google (constantes `SHEET_*` en `backend/codigo.gs`):

| Hoja | Uso | Notas |
|------|-----|-------|
| `Tracking Activo` | Tareas en curso | Source of truth. 20 columnas base + col 21 `Colaboradores` (ver abajo) |
| `Historial` | Tareas cerradas | Append-only; las tareas se mueven acá al marcarlas Listo |
| `Equipos` | Roster + allowlist | code / country / leader / members / emails |
| `Proyectos` | Proyectos | 17 columnas (col 16 Documentos, col 17 Contrapartes en conflicto) |
| `Comments` | Comentarios por tarea | Auto-creada en primer uso |
| `Activity` | Audit log de cambios | Auto-creada; comments, status changes, blocks, reassigns |
| `Config` | Líderes globales (head) | Define quién ve la vista LATAM |
| `Feriados` | Días no laborables por país | Manual; afecta el cálculo de SLA/ETA (días hábiles) |
| `Templates` | Checklists por tipo de trabajo | Pre-llenan las notas al crear una tarea |
| `BibliotecaDocs` | Documentos curados (Biblioteca) | Plantillas/recursos descargables |
| `Recursos` | Links curados del equipo + integraciones | Sección "Recursos" |

Cualquier **escritura** pasa por `_safeMutation()`: toma `LockService.getScriptLock()` (timeout 10s), ejecuta, invalida el cache (TTL 30s en `CacheService`) y devuelve un envelope `{success, ...}`.

### Columnas de tareas (`TASK_COLS = 20` + col 21)

Las columnas 17–21 se agregan por migración y el backend solo las escribe si la hoja ya las tiene (`if (lc >= TASK_*_COL)`):

| Col | Campo | Constante |
|-----|-------|-----------|
| 17 | Documentos (JSON) | `TASK_DOCS_COL` |
| 18 | Confidencialidad | `TASK_CONF_COL` |
| 19 | Contraparte | `TASK_CONTRAPARTE_COL` |
| 20 | Área solicitante | `TASK_AREASOL_COL` |
| 21 | Colaboradores (JSON `[{name,role}]`) | requiere correr `migrarColaboradores()` |

**Confidencialidad**: 3 niveles — `estandar`, `restringido`, `confidencial` (`ED_CONF_LEVELS`). Solo manager/head puede subir el nivel.

## Roles y permisos

Determinados al login leyendo `Equipos` + `Config`:

- **specialist** — ve sus tareas + las del equipo de su país. **Crea tareas y proyectos.** Edita/cierra/bloquea las propias con resumen. Agrega **colaboradores** a sus tareas. Edita/cierra los proyectos donde es responsable o participante.
- **manager** — todo lo del specialist + KPIs del país, reasigna dentro del país, cambia confidencialidad, gestiona plantillas (Biblioteca).
- **head** (Global) — vista LATAM agregada, drill-down por país, ve todos los equipos, reasigna cross-country. Tiene el switcher **"Ver app como…"** (specialist/manager) — ⚠ es filtrado **cosmético del lado del cliente**: el browser ya cargó toda la data confidencial.

Si un email no está en `Equipos`, ve una pantalla de "acceso denegado". La autorización **server-side** real vive en `_authorizeTaskWrite` / `_authorizeProjectWrite` / `_authorizeColaboradoresWrite` (la UI espeja estas reglas para no mostrar botones que luego fallan).

## Estructura del repo

```
.
├── appsscript.json              Manifiesto de Apps Script (raíz)
├── backend/
│   ├── codigo.gs                ~4400 líneas — auth, CRUD tareas+proyectos, snapshot, cache,
│   │                            digest, telemetry, colaboradores, recursos, conflicto de interés
│   ├── SlackModal.gs            Webhook + modal de crear/editar tareas desde Slack
│   ├── admin.gs                 Setup + migraciones (setupSheets, installDigestTrigger,
│   │                            wipeTestData, migrarColaboradores, migrarRecursosFaseB)
│   ├── ai.gs                    AI sobre documentos (Gemini / generativelanguage API)
│   ├── gmailAddon.gs            Add-on contextual de Gmail (onGmailHomepage/onGmailMessageOpen)
│   └── tests.gs                 Smoke tests (se corren desde el editor de Apps Script)
├── frontend/
│   ├── Dashboard.html           Shell HTML (incluye I18n.js ANTES de Dashboard.js)
│   ├── Dashboard.css.html       ~3900 líneas — tokens (dark/light), componentes, pills, KPIs, modales
│   ├── Dashboard.js.html        ~11000 líneas — tracker, 3 homes, proyectos, modales, bulk ops,
│   │                            activity log, notificaciones, tour, atajos
│   └── I18n.js.html             ~600 líneas — helper t() + diccionario T_PT (ES↔PT-BR)
├── scripts/
│   └── check-i18n.js            Gate de CI: falla si hay t() sin entrada en T_PT
├── .github/workflows/
│   ├── deploy-appsscript.yml    push a main → clasp push -f + redeploy (misma URL)
│   └── check-i18n.yml           PR/push → audita cobertura i18n
├── plan/CLAUDE_DESIGN_PROMPT.md Template de prompts para sesiones de diseño con Claude
├── archive/                     Docs históricos del rediseño (PRD, plan de sprint, audit)
├── CLAUDE.md                    Guía operativa para sesiones con Claude (se auto-carga)
├── ARCHITECTURE.md              Capas, flujos, decisiones
├── PENDIENTES.md                Backlog vivo (bugs conocidos, mejoras pendientes)
├── DEMO_BRIEF.md                Brief para presentación a stakeholders / demo aislado
└── REVIEW_BRIEF.md              Prompt para revisión externa con Claude chat
```

> En el editor de Apps Script los archivos aparecen con el path completo (ej. `frontend/Dashboard`) — así es como `clasp` publica subcarpetas. Es esperado.

## Features destacadas

- **3 home views adaptadas al rol** — specialist ve "lo que más necesita atención", manager ve "quién necesita atención" en su país, head ve operación LATAM.
- **Tracker con bulk actions** — seleccionar N tareas y avanzar/reasignar/poner on hold en una pasada. Si el mix incluye tareas que cerrarían, se abre un wizard de cierre con resumen único.
- **Proyectos (flujo real)** — crear (wizard de 2 pasos), abrir detalle con tareas, agregar tareas al proyecto, editar/cerrar. Participantes **multi-país** (acordeón colapsable por país) y contador de "días al cierre".
- **Colaboradores en tareas** — sumar personas con rol **ver** o **editar**; el colaborador-editor suma a sus métricas y ve la tarea aun si es confidencial. Se notifica al agregado.
- **Conflicto de interés** — un proyecto declara "contrapartes en conflicto"; al crear una tarea ligada con una contraparte que coincide, salta un aviso en vivo.
- **Recursos** — links curados de herramientas tech/AI del equipo + descubrimiento de las integraciones propias de MyDash.
- **Auto-promote** — editar una tarea Pendiente la mueve a En curso automáticamente.
- **Activity log + notificaciones in-app** — la hoja `Activity` registra cambios; el menú de usuario muestra "Actividad reciente · N".
- **SLA / ETA en días hábiles** — calculado server-side con los feriados de cada país. Límites centralizados en `SLA_LIMITS` → `data.slaLimits` → `_slaLimit()` en cliente.
- **AI sobre documentos (Gemini)** y **add-on de Gmail** contextual.
- **Tour interactivo**, **atajos de teclado** (`/` busca, `N` nueva, `?` ayuda, `Esc` cierra, `↑↓` navega, `A` avanza).
- **Daily digest** — email a las 8am hora del país con vencidas/hoy/bloqueadas.
- **i18n ES/PT-BR**, **dark/light theme** (pills con border-left para daltonismo).

## Desarrollo local

### Requisitos

- Node 20+
- [`clasp`](https://github.com/google/clasp): `npm install -g @google/clasp`, luego `clasp login`

### Setup

1. Copiar `.clasp.json.example` a `.clasp.json` y poner tu `SCRIPT_ID`.
2. `clasp pull` para traer la versión actual (opcional si el repo ya está al día).
3. Editar `.gs` y `.html` localmente.
4. `clasp push` para subir y probar en el editor.

> Nunca subas `.clasp.json` ni `.clasprc.json` (están en `.gitignore`).

### Validación local (corré esto ANTES de cada commit)

```bash
# 1) Sintaxis del JS embebido en el HTML (node rechaza .gs/.html por extensión,
#    así que copiamos a .js y, para el HTML, sacamos el wrapper <script>):
cp backend/codigo.gs /tmp/c.js && node --check /tmp/c.js
sed '1d;$d' frontend/Dashboard.js.html > /tmp/d.js && node --check /tmp/d.js
sed '1d;$d' frontend/I18n.js.html     > /tmp/i.js && node --check /tmp/i.js

# 2) Gate de i18n — DEBE decir "Missing in T_PT: 0" o el CI falla:
node scripts/check-i18n.js
```

No hay test runner local — los smoke tests viven en `backend/tests.gs` y se corren desde el editor de Apps Script (Run → `runAllTests`).

## Deploy a producción

Dos workflows en `.github/workflows/`:

- **`deploy-appsscript.yml`** — trigger `push` a `main` (o `workflow_dispatch`). Hace `clasp push -f` y luego `clasp deploy --deploymentId $WEBAPP_DEPLOYMENT_ID`, lo que actualiza la **implementación existente** de la web app → el equipo entra siempre por la **misma URL `/exec`** sin tener que crear "versión nueva" a mano.
- **`check-i18n.yml`** — trigger en PR/push que toque `frontend/Dashboard.js.html`, `frontend/I18n.js.html` o el script. Corre `node scripts/check-i18n.js --no-orphans` y **falla si hay algún `t()` sin su entrada en `T_PT`**.

Secrets requeridos en el repo: `CLASPRC_JSON` (contenido de `~/.clasprc.json`), `SCRIPT_ID`, `WEBAPP_DEPLOYMENT_ID`.

**Flujo recomendado**: branch desde `main` → commit + push → PR → (CI verde) → **squash-merge** → deploy automático.

## Cómo trabajar en este repo (convenciones + gotchas)

Lo esencial está también en `CLAUDE.md` (se auto-carga en cada sesión con Claude). Resumen:

- **Gates antes de commitear**: `node --check` de los 3 archivos JS + `check-i18n` en 0 missing (ver arriba). No mergees con el gate de i18n en rojo.
- **i18n**: cada `t('texto')` nuevo necesita su entrada `'texto': '<pt>'` en `T_PT` (`frontend/I18n.js.html`), o el CI falla. Valores de data (status/prioridad/enum, payloads al backend) **no** se envuelven en `t()`.
- **Mutaciones**: toda escritura va por `_safeMutation()` (lock + invalidación de cache + envelope `{success}`). Sanitizá las celdas con `_sanitizeRow`/`_sanitizeCell` (anti formula-injection). Autorizá con `_authorize*Write` y espejá esa regla en la UI.
- **⚠ `codigo.gs` tiene un caracter de control** que hace que `grep`/ripgrep lo traten como binario y devuelvan "No matches" falsos. Usá `grep -a`, la herramienta Read, o Python (`open(..., errors='replace')`) para buscar dentro.
- **⚠ El working tree se desincroniza** de forma impredecible en algunos entornos (HEAD vuelve a un commit viejo). **Verificá el estado antes de trabajar y antes de commitear** (`git log -1`, y que símbolos recientes existan en el archivo). Si se desincroniza: `git fetch origin && git reset --hard origin/main`. Todo el trabajo real vive en el remoto.
- **Commits**: terminá el mensaje con `https://claude.ai/code/session_01DtVa8T1C86h6jY2jqweXb3`. No metas el identificador del modelo en commits/PRs/código.

## Performance y límites conocidos

- **Cache**: snapshot completo en `CacheService`, TTL 30s; cualquier escritura invalida.
- **Lock**: mutations con `LockService.getScriptLock()`, timeout 10s → "Servidor ocupado, reintentá".
- **Quotas de Apps Script**: 6 min/ejecución, ~30 min/día. La app está holgada con uso normal.
- **Upload de documentos**: máx 45MB (límite de `FileBlob`).

## Docs relacionados

- **`CLAUDE.md`** — guía operativa para trabajar con Claude (gates, gotchas, flujo).
- **`ARCHITECTURE.md`** — capas, flujos de datos, decisiones de diseño.
- **`PENDIENTES.md`** — backlog vivo: bugs conocidos y mejoras pendientes.
- **`DEMO_BRIEF.md`** — brief de demo / setup del demo aislado con data falsa.
- **`REVIEW_BRIEF.md`** — contexto para una revisión externa del proyecto.

## Estado actual

En piloto con países activos de LATAM (CO, MX, BR, AR, CL, …) + global head. Pruebas arrancaron con el equipo de Colombia. El trabajo se desarrolla en branches de feature que se **squash-mergean** a `main` (cada merge dispara el deploy). Ver `PENDIENTES.md` para lo que sigue.
