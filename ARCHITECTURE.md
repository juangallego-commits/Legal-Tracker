# Legal Tracker — Architecture Brief

> Documento resumen para cargar como contexto único en Claude.ai cuando el repo completo excede el límite. Última actualización: 2026-05-06.

---

## 1. Qué es

Web app interna del equipo Global Legal de Rappi+ para hacer seguimiento de tareas y proyectos legales por país, líder, prioridad y estado. **Producción · Piloto Colombia (lanzado 4/5/2026)**. Versión actual: `v3.4 (Editorial Final)`.

---

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Google Apps Script (`.gs`) |
| Frontend | HTML + CSS + JS vanilla servido por `HtmlService` |
| BD | Google Sheets (5 hojas) |
| Auth | Google SSO + allowlist en hoja `Equipos` |
| Integraciones | Slack (modales, slash commands), Google Drive (adjuntos) |
| Deploy | `clasp` vía GitHub Actions en push a `main` |
| Timezone | `America/Bogota` (hardcoded en `appsscript.json`) |

**OAuth scopes**: `spreadsheets`, `drive`, `script.external_request` (Slack), `userinfo.email`, `script.container.ui`.

---

## 3. Estructura de carpetas

```
/
├── backend/            # Apps Script (.gs)
│   ├── codigo.gs           # 1710 LOC — engine principal (auth, CRUD, cache, render, stats)
│   ├── SlackModal.gs       # 928 LOC  — integración Slack
│   └── tests.gs            # 221 LOC  — smoke tests
├── frontend/           # Templates HtmlService
│   ├── Dashboard.html      # 366 LOC  — shell + vistas legacy (fallback)
│   ├── Dashboard.css.html  # 3418 LOC — estilos (tokens, dark mode, responsive)
│   ├── Dashboard.js.html   # 6418 LOC — render imperativo, eventos, modales, búsqueda, edición inline
│   └── StandaloneDemo.html # 179 LOC  — demo standalone
├── plan/               # Docs vivas
│   ├── PRD.md
│   ├── IMPLEMENTATION-PLAN.md
│   ├── PILOT-RUNBOOK.md
│   └── analysis/
│       ├── CURRENT-STATE-AUDIT.md
│       └── PROPOSAL-MAPPING.md
├── pendientes/         # Drafts del rediseño editorial (source de portación)
├── ARCHITECTURE.md     # Este archivo
├── .github/workflows/deploy-appsscript.yml
├── appsscript.json
├── .clasp.json.example
├── .gitignore
└── README.md
```

---

## 4. Backend — funciones clave (`backend/codigo.gs`)

```
doGet(e)                    // Web app entry; auth + render Dashboard; ?page=demo expone standalone
getTrackerData()            // Endpoint lectura único; snapshot JSON; cache 30s
getEditorialData()          // Extiende getTrackerData con campos derivados:
                            //   tasks/historial: eta, etaDays, accionable, blockedReason, slaTarget
                            //   team: load, capacity, overdue, blocked, streak, avgAlta/Media/Baja
                            //   countries: open, overdue, slaPct, trend (12 semanas)
addTask() / updateTaskField() / updateTaskFields() / blockTaskById() / closeTaskById()
addProject() / updateProjectFields()
uploadDocument() / attachDocumentLink() / removeDocument()
resolveVisitor()            // Auth contra hoja Equipos
determineRole()             // head | manager | specialist
readEquipos() / readConfig()
invalidateCache()           // Limpia snapshot tras writes
_safeMutation()             // Wrapper que invalida cache post-write
```

**Shape de `getTrackerData()`**: `{ tasks, historial, projects, projectList, kpi, sla, teamGrid, countries, config, semana, today, _role, _user }`.

**Cache**: TTL 30s. Invalidado vía `_safeMutation()` automáticamente; los entry-points wrappeados son `getEditorialData`, `addTask`, `updateTaskFields`, `closeTaskById`, `blockTaskById`. Otros (`updateTaskField`, `addProject`, `uploadDocument`) llaman `invalidateCache()` manualmente.

---

## 5. Modelo de datos (Google Sheets)

| Hoja | Rol |
|------|-----|
| `Tracking Activo` | Tareas vivas |
| `Historial` | Tareas cerradas/bloqueadas |
| `Config` | Países, prioridades, tipos de tarea, SLAs |
| `Equipos` | Allowlist usuarios + rol (head/manager/specialist) + país |
| `Proyectos` | Proyectos (agrupan tareas) |

---

## 6. Frontend — vistas y features (`Dashboard.js.html`)

**Vistas editoriales** (rEd*):
- `rEdHome()` — landing por rol (specialist/manager/HQ)
- `rEdTracker()` — tabla de tareas + side panel editable
- `rEdAgrupadas()` — tareas por urgencia (overdue/today/week/later)
- `rEdProyectosIndex()` — listado de proyectos
- `rEdMisTareas()`, `rEdMiequipo()`, `rEdAnalytics()`, `rEdHistorial()`, `rEdResumen()`

**Features cross-cutting**:
- **Búsqueda global ⌘K** — modal centrado con debounce 150ms; filtra `D.tasks` + `D.projects` por nombre, responsable, líder, notas, tipoTrabajo, país; highlight con `<mark>`; click en tarea → tracker + select; click en proyecto → vista proyectos.
- **Side panel del tracker editable inline** — click en celda (Responsable, Deadline, Riesgo, Proyecto) abre select/input; doble-click en título; textarea para notas con blur-to-save. Cada cambio dispara `updateTaskField` + `reload()`.
- **Documentos en panel del tracker** — chips clicables para docs adjuntos; "Adjuntar link" (form inline URL+nombre) y "Subir archivo" (input file → base64 → `uploadDocument`); on-success refresca con `reload()`.
- **Navegación por teclado en tracker** — ↓/↑ mueven selección con scroll automático; Enter abre `edUOpen` con variant 'avanzar'; Esc cierra el panel. Listener en capture phase con `_anyModalOpen()` check.
- **Responsive** — sidebar colapsa a 56px en ≤1024px (hover-expand overlay); en ≤768px se oculta y aparece hamburguesa con drawer + backdrop; tracker panel pasa a overlay full-height en ≤1024px.

**Estado global**: variables JS (`D`, `EDT`, `EDS`, `USER`, `F`); render con `innerHTML`. **No hay framework.**

**Vistas legacy (fallback activo, no muerto)**: `vTracker`, `vResumen`, `vProyectos`, `vMiequipo`, `vAnalytics`, `vHistorial`, `vMistareas`. Pobladas por `render()` legacy en cada llegada de datos. `goEd(viewId)` cae a `go(viewId)` cuando una contraparte editorial todavía no existe (p.ej. `goEd('paises')` → `go('resumen')` para HQ). Onclicks inline (`fSt`, `tSort`, `fPSt`) viven dentro de estos bloques. **No borrar sin antes implementar todas las contrapartes editoriales.**

---

## 7. Roles y autorización

| Rol | Capacidad |
|-----|-----------|
| `head` (HQ) | Ve todos los países; reasigna; KPIs globales |
| `manager` | Ve su país; gestiona su equipo |
| `specialist` | Ve sus tareas asignadas |

Resolución en `resolveVisitor()` → `determineRole()` consultando hoja `Equipos` (first-wins en allowlist tras fix `a038820`).

Backend valida en cada write: specialist no puede reasignar `resp` a otros, manager no puede mover tareas a otro país, solo manager/head pueden cambiar `confidencialidad`.

---

## 8. Integración Slack (`backend/SlackModal.gs`)

- Verificación de firma HMAC
- Deduplicación de eventos por hash (fix `0f5ce7a`)
- Slash commands + shortcuts → modal de creación/edición
- Notifica a canal cuando se crea/cierra/bloquea tarea

---

## 9. CI/CD (`.github/workflows/deploy-appsscript.yml`)

Trigger: push a `main` o dispatch manual.
Pasos: checkout → Node 20 → `npm i -g @google/clasp` → escribe `~/.clasprc.json` desde secret `CLASPRC_JSON` y `.clasp.json` con `SCRIPT_ID` → `clasp push -f`.

**Secrets requeridos en GitHub**: `CLASPRC_JSON`, `SCRIPT_ID`.

---

## 10. Deuda técnica

| # | Ítem | Estado |
|---|------|--------|
| 1 | `.xlsx` en raíz | ✅ Resuelto (borrados, en `.gitignore`) |
| 2 | `pendientes/uploads/` y `pendientes/export/` con artefactos de iteración | ✅ Resuelto (borrados, en `.gitignore`) |
| 3 | Cache invalidation manual | 🟡 Parcial: `_safeMutation()` cubre 5 entry-points; resto sigue manual |
| 4 | `pendientes/` con drafts JSX/HTML del rediseño | 🟡 Mantenido (source de portación + demo standalone planeado) |
| 5 | Mezcla `snake_case` / `camelCase` en `codigo.gs` | ⏸ Diferido (post-producción) |
| 6 | `_funcionPrivada` por convención débil | ⏸ Aceptable para Apps Script |
| 7 | TODO X-Frame-Options para embed Notion/Confluence | ⏸ Diferido |
| 8 | `Dashboard.js.html` = 6418 LOC en un solo archivo | 🟡 Aceptable sin bundler; secciones documentadas con MARKER comments |
| 9 | Vistas legacy duplicadas (vTracker, vResumen, etc.) que sirven de fallback al editorial | 🟡 Documentado en HTML; eliminación requiere implementar todas las contrapartes `rEd*` |
| 10 | `streak`, `avgAlta/Media/Baja`, `slaPct`, `trend` antes hardcodeados | ✅ Resuelto (calculados del historial real) |

---

## 11. Estado de git

- Rama actual: `claude/audit-and-roadmap-fdNpp`
- Working tree: limpio (al cierre de cada commit)
- Hitos recientes en esta rama:
  - `c97f66b` feat(responsive): sidebar colapsable y panel overlay
  - `fb624c9` feat(tracker): navegación por teclado (↓/↑/Enter/Esc)
  - `719e9d4` feat(search): búsqueda global Cmd/Ctrl+K
  - `4a6bc4e` feat(tracker-panel): edición inline de campos y notas
  - `78fa946` feat(tracker-panel): documentos en side panel
  - `5666578` feat(countries): slaPct y trend reales del historial
  - `b167c32` feat(team): streak y avgAlta/Media/Baja del historial real
  - `aceb80c` fix(reload): re-render vEdMiequipo y vEdResumen
  - `fc9c621` chore: cleanup `.xlsx` y artefactos de iteración

---

## 12. Lo que falta (gaps conocidos)

1. **Refactor cache completo**: extender `_safeMutation()` a `updateTaskField`, `addProject`, `uploadDocument`, etc.
2. **Implementar contrapartes editoriales faltantes** (`rEdResumen`, etc.) para poder retirar las vistas legacy.
3. **Smoke tests**: ampliar `tests.gs` para cubrir los 3 roles y el path Slack.
4. **Demo standalone** (`?page=demo`): el endpoint ya está en `doGet`; verificar que el HTML sirve bien.
5. **Documentación deploy**: secrets GitHub + permisos Drive del usuario que ejecuta `clasp`.
6. **Touch UX en breakpoint 1024px**: hover-expand del sidebar no funciona bien en tablets; considerar tap-to-expand.

---

## 13. Cómo pedirle a Claude que ayude

Cuando subas este archivo a Claude.ai, incluye también:
- `README.md`
- `plan/PRD.md`
- `plan/IMPLEMENTATION-PLAN.md`
- `backend/codigo.gs` (si cabe) o las primeras 200 líneas

Peticiones atómicas funcionan mejor. Ejemplos:
- *"Extendé `_safeMutation()` para wrappear `updateTaskField`, `addProject`, `uploadDocument` y `attachDocumentLink`."*
- *"Implementá `rEdResumen()` en `Dashboard.js.html` cubriendo los IDs que `rResumen()` legacy popula (rxActivas, rxVencidas, rxOnTime, rxProyectos, rxCountriesBody, rxRiskList, rxTrend)."*
- *"Amplía `tests.gs` con un smoke test por rol (head, manager, specialist) que valide visibilidad de tareas según país."*
