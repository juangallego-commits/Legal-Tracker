# Legal Tracker — Architecture Brief

> Documento resumen para cargar como contexto único en Claude.ai cuando el repo completo excede el límite. Última actualización: v3.6 (Collaboration & Polish).

---

## 1. What it is

Web app interna del equipo Global Legal de Rappi+ para hacer seguimiento de tareas y proyectos legales por país, líder, prioridad y estado. **Producción · Piloto Colombia lanzado 4/5/2026**. Versión actual: `v3.6 (Collaboration & Polish)`.

UI completamente en inglés (la data en sheets sigue en español por compatibilidad; capa de display layer traduce).

---

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Google Apps Script (`.gs`) |
| Frontend | HTML + CSS + JS vanilla servido por `HtmlService` (no framework) |
| BD | Google Sheets (6 hojas) |
| Auth | Google SSO + allowlist en hoja `Equipos` |
| Integraciones | Slack (modales, slash commands), Google Drive (adjuntos con taxonomía auto) |
| Deploy | `clasp` vía GitHub Actions en push a `main` (zero-touch) |
| Charts | Chart.js 4.4.1 (CDN) para analytics; SVG inline para sparklines |
| Timezone | `America/Bogota` (hardcoded en `appsscript.json`) |

**OAuth scopes**: `spreadsheets`, `drive`, `script.external_request` (Slack), `userinfo.email`, `script.container.ui`.

---

## 3. Estructura de carpetas

```
/
├── backend/            # Apps Script (.gs)
│   ├── codigo.gs           # 1836 LOC — engine principal (auth, CRUD, cache, stats, comments, docs)
│   ├── SlackModal.gs       # 928 LOC  — integración Slack
│   └── tests.gs            # 221 LOC  — smoke tests
├── frontend/           # Templates HtmlService
│   ├── Dashboard.html      # 385 LOC  — shell + vistas legacy (fallback)
│   ├── Dashboard.css.html  # 4930 LOC — estilos editorial (tokens, dark mode, responsive)
│   ├── Dashboard.js.html   # 8182 LOC — render imperativo, eventos, modales, todas las features
│   └── StandaloneDemo.html # 179 LOC  — demo standalone público (?page=demo)
├── plan/               # Docs vivas
│   ├── PRD.md
│   ├── IMPLEMENTATION-PLAN.md
│   ├── PILOT-RUNBOOK.md
│   └── analysis/
│       ├── CURRENT-STATE-AUDIT.md
│       └── PROPOSAL-MAPPING.md
├── pendientes/         # Drafts del rediseño editorial (source de portación)
├── ARCHITECTURE.md     # Este archivo
├── DEMO_BRIEF.md       # Tour de features + demo script + Q&A
├── .github/workflows/deploy-appsscript.yml
├── appsscript.json
├── .clasp.json.example
├── .gitignore
└── README.md
```

LOC total: ~15K. Repo limpio (sin `pendientes/uploads`, sin `.xlsx`).

---

## 4. Backend — funciones clave (`backend/codigo.gs`)

```
doGet(e)                     // Web app entry; auth + render Dashboard; ?page=demo expone standalone
getTrackerData()             // Endpoint lectura único; snapshot JSON; cache 30s
getEditorialData()           // Extiende getTrackerData con campos derivados:
                             //   tasks/historial: eta, etaDays, accionable, blockedReason, slaTarget
                             //   team: load, capacity, overdue, blocked, streak, avgAlta/Media/Baja
                             //   countries: open, overdue, slaPct, trend (12 semanas)
addTask() / updateTaskField() / updateTaskFields() / blockTaskById() / closeTaskById()
addProject() / updateProjectFields()
uploadDocument() / attachDocumentLink() / removeDocument()
                             // Drive folder con taxonomía: TipoTrabajo / País / Proyecto
getTaskComments(taskId)      // NUEVO v3.6 — hilo de comentarios
addTaskComment(taskId, body) // NUEVO v3.6 — persistente en sheet Comments
resolveVisitor() / determineRole()  // Auth contra hoja Equipos
readEquipos() / readConfig()
invalidateCache()
_safeMutation()              // Wrapper que invalida cache post-write
countBizDays(start, end)     // O(1) — algoritmo optimizado
```

**Shape de `getTrackerData()`**: `{ tasks, historial, projects, projectList, kpi, sla, teamGrid, countries, config, semana, today, _role, _user }`.

**Cache**: TTL 30s vía `_safeMutation()`. Pre-bucketing de team/historial por `resp` y `pais` baja `getEditorialData()` de ~5s a <300ms en sheets con historial extenso.

---

## 5. Modelo de datos (Google Sheets)

| Hoja | Rol |
|------|-----|
| `Tracking Activo` | Tareas vivas (18 cols, columnas 17/18 opcionales: Documentos, Confidencialidad) |
| `Historial` | Tareas cerradas/bloqueadas |
| `Config` | Países, prioridades, tipos de tarea, SLAs, DriveFolder |
| `Equipos` | Allowlist usuarios + rol (head/manager/specialist) + país |
| `Proyectos` | Proyectos (agrupan tareas) |
| `Comments` | **NUEVO v3.6** — hilo de comentarios (auto-creada en primer uso) |

---

## 6. Features por rol

### 👤 Specialist
- **Home** con greeting + urgency banner (si overdue/dueToday > 0) + hero stats clickeables → drill a vistas
- **Mis tareas** (vista personal de tareas activas)
- **By urgency** (buckets: Overdue / Due today / This week / Later)
- **My projects** (proyectos donde participa)
- **Closed** (historial personal)
- **My performance** (analytics personal: on-time rate, lifetime closed, streak, throughput 8 weeks, priority mix)

### 🟢 Manager
- **Home** orientado a equipo (high-priority count, overdue/due today, team load %)
- **Assigned to me** (tareas personales del manager)
- **Team tracker** (tareas del país, filtro por status + project + owner + confidentiality)
- **My team** (miembros con load bars + counts)
- **Projects** (todos los del país)
- **Analytics** (KPIs + distribution por priority + top owners + SLA donut + **aging buckets** + **SLA trend 8 weeks**)
- **History** (cerradas del equipo)

### 🌎 HQ (head)
- **Global home** con countries summary band + countries-at-risk banner
- **By country** (resumen LATAM con sparklines + projects at risk)
- **Global tracker** con **countries-first landing**: grid de cards (Active/Overdue/SLA + sparkline 12w) → drill al detalle
- **Projects** (todos LATAM)
- **Teams** (todos los equipos agrupados por país)
- **Analytics** (todo lo de manager + **Countries comparison matrix** + **Projects at risk top 5**)
- **History** (cerradas globales)
- **Demo switcher** (View as Specialist/Manager/HQ — custom dropdown)

---

## 7. Features cross-cutting (v3.5–v3.6)

| Feature | Descripción | Discoverability |
|---|---|---|
| **Cmd+K search** | Filtra tasks + projects + **documents** por nombre/resp/notas/tipo/país, con highlight `<mark>`, navegación ↓/↑/Enter | Header button "⌘K Search…" |
| **Help modal** | Lista todos los keyboard shortcuts (Cmd+K, ↓/↑, N, Enter, Esc, doble-click) | `?` global + botón "?" en header |
| **Task panel full-screen** | Click en tarea ocupa la vista completa (no side-panel cramped). Back button + flash highlight al volver | Click row |
| **Inline edit en panel** | Click en cell (Owner/Deadline/Risk/Project) abre editor; dbl-click en título; notes con auto-resize | Hover dashed underline |
| **Documents** | Upload a Drive con auto-taxonomía + paste links externos. Chip por doc, click abre | Panel "— Documents" |
| **Comments thread** | Hilo de comentarios por tarea con avatar+name+ts. Cmd+Enter envía. Auto-creates sheet | Panel "— Comments" |
| **Bulk actions** | Checkbox per row → bar sticky: Advance/Block/Reassign/Cancel. Reassign con picker visual (no prompt) | Multi-select |
| **Hover preview** | Tooltip tras 400ms con resp/deadline/action | Hover row |
| **Keyboard nav tracker** | ↓/↑ filas, Enter avanzar, Esc cierra panel | Help modal |
| **Hero stats clickeables** | Números del home navegan al detalle relevante (Overdue → tracker filtrado, etc.) | Affordance "→" on hover |
| **Persistent filters** | Status / country / project / owner / confidentiality persisten en localStorage | Auto |
| **Empty states contextuales** | "No tasks on your plate" vs "No matches for X" con icons + serif italic | Auto |
| **Activity feed sidebar** | Últimas 5 actividades (closed/created) con relative time | Sidebar bottom |
| **Responsive** | Sidebar colapsa <1024px (hover-expand), hamburguesa <768px, panel full-screen siempre | Auto |

---

## 8. Roles y autorización

| Rol | Capacidad |
|-----|-----------|
| `head` (HQ) | Ve todos los países; reasigna a cualquiera; KPIs globales; cambia confidencialidad |
| `manager` | Ve su país; reasigna dentro de su equipo; cambia confidencialidad de sus tareas |
| `specialist` | Ve sus tareas asignadas; puede self-update; NO reasigna |

Resolución en `resolveVisitor()` → `determineRole()` consultando hoja `Equipos`.

**Backend valida en cada write**: specialist no puede reasignar `resp`, manager no puede mover de país, solo manager/head cambian `confidencialidad`. Errores → toast.

**Confidentiality levels**:
- `estandar` — visible al equipo del rol
- `restringido` — solo resp / líder / head / manager del país
- `confidencial` — solo resp / líder / head

Backend `filterTasksForRole()` aplica este filtro antes de devolver tasks. UI muestra cf-dot indicator + chip en search results. Click en cf-dot filtra el tracker por nivel.

---

## 9. Integración Slack (`backend/SlackModal.gs`)

- Verificación de firma HMAC
- Deduplicación de eventos por hash (fix `0f5ce7a`)
- Slash commands + shortcuts → modal de creación/edición
- Notifica a canal cuando se crea/cierra/bloquea tarea

---

## 10. CI/CD (`.github/workflows/deploy-appsscript.yml`)

Trigger: push a `main` o dispatch manual.
Pasos: checkout → Node 20 → `npm i -g @google/clasp` → escribe `~/.clasprc.json` desde secret `CLASPRC_JSON` y `.clasp.json` con `SCRIPT_ID` → `clasp push -f`.

**Secrets requeridos en GitHub**: `CLASPRC_JSON`, `SCRIPT_ID`.

**`/dev` URL** se actualiza automáticamente con cada push a main. **`/exec` URL** (producción) requiere "New version" manual en el editor de Apps Script.

---

## 11. Deuda técnica

| # | Ítem | Estado |
|---|------|--------|
| 1 | `.xlsx` en raíz | ✅ Resuelto |
| 2 | `pendientes/uploads/`, `pendientes/export/` | ✅ Resuelto (gitignored) |
| 3 | Cache invalidation manual | ✅ Resuelto vía `_safeMutation()` en entry points críticos |
| 4 | `countBizDays` O(n) | ✅ Resuelto — algoritmo O(1) |
| 5 | Pre-bucketing en `_getEditorialDataImpl` | ✅ Resuelto — O(team × histo) → O(team + histo) |
| 6 | Toda UI en español | ✅ Resuelto — UI en inglés, sheet sigue en español vía display layer |
| 7 | Status display labels español | ✅ Resuelto — `_statusLabel()` y `_priorityLabel()` |
| 8 | Vistas legacy sin documentar | ✅ Documentado en HTML — fallback activo, NO borrar |
| 9 | Sin a11y focus-visible | ✅ Resuelto — reglas globales |
| 10 | `Dashboard.js.html` = 8182 LOC | 🟡 Aceptable sin bundler; secciones documentadas con MARKER comments |
| 11 | Legacy fallback views (vTracker etc.) en español | 🟡 Documentado; eliminación requiere migrar todos los `rEd*` faltantes |
| 12 | Telemetry sheet en español | ⏸ No user-facing |
| 13 | No notifications automáticos | ⏸ Requeriría triggers + Slack/email setup |
| 14 | No edit/delete comments | ⏸ Simple add-only en v3.6; backlog |
| 15 | Touch UX en breakpoint 1024px | 🟡 Hover-expand puede ser confuso en tablets |

---

## 12. Estado de git

- Rama actual: `claude/audit-and-roadmap-fdNpp`
- Working tree: limpio
- Acumulado en branch pendiente de merge: ~7 commits con features grandes (PR #30)

Hitos recientes ordenados (más reciente primero):

```
v3.6 — Collaboration & Polish (current)
   8b2b7ff  feat: documents en Cmd+K + confidentiality filter
   84cc5f4  feat: comments thread (backend + UI)
   6387b17  i18n: status + priority labels en EN
   d2562f9  feat: hero stats clickeables
   67c8673  feat: inline bulk reassign + project filter + clickable owner
   ffc9c04  polish: continuity scroll
   614c9a9  polish: persistent EDT state + contextual empty states

v3.5 — Visual Surgery & Editorial Polish (deployed)
   8064a3e  fix: demo switcher custom dropdown
   6d933f2  feat: full-screen task panel + HQ countries-first
   e207227  feat: tracker clarity (dynamic H1/lede/eyebrow)
   bc93109  polish: sticky table header + search ↓/↑/Enter + help button
   e6707b5  feat: manager analytics insights + help modal
   d6666af  polish: focus-visible a11y + last EN strings
   42d8544  i18n: project wizard + doc helpers
   f763481  i18n: Mi equipo, Resumen, Wizard create, Update modal
   8d63321  i18n: Manager, HQ home, Agrupadas, Mis tareas, Historial
   91d7159  fix: tasks not creating + countBizDays O(1)

v3.4 — Editorial Final (deployed)
   ab56427  feat(analytics): role-specific insights · specialist scorecard
   2e8597d  feat: proyecto detalle + activity feed
   ...
```

---

## 13. Lo que falta (backlog priorizado)

1. **Notifications automáticos** (Apps Script triggers + Slack DM cuando una tarea vence mañana, cuando alguien te asigna, etc.). Medium-large effort.
2. **Calendar view** del workload por semana. Medium.
3. **@mentions en comments** (notify a otros users por Slack/email). Small-medium.
4. **Edit/delete comments** propios (audit trail mantenido). Small.
5. **Templates de tareas** (recurring work como "Revisión contractual mensual"). Medium-large.
6. **Export CSV/PDF** de la vista actual del tracker. Small.
7. **Eliminación final de legacy fallback** (vTracker/vResumen/etc.) — requiere completar todas las `rEd*` faltantes y migrar onclicks inline. Large, risky.
8. **Mobile touch UX** específico (no hover-expand en tablets). Small-medium.
9. **Onboarding tour** para usuarios nuevos. Small.
10. **Search history** en Cmd+K (últimas 5 búsquedas). Small.

---

## 14. Cómo pedirle a Claude que ayude

Cuando subas este archivo a Claude.ai, incluye también:
- `README.md`
- `DEMO_BRIEF.md` (tour de features + script de demo)
- `plan/PRD.md`
- `plan/IMPLEMENTATION-PLAN.md`

Peticiones atómicas funcionan mejor. Ejemplos:
- *"Diseñá el flujo de notifications: qué trigger, qué endpoint, qué mensaje en Slack. No me des código todavía — quiero el plan."*
- *"Para el demo de 15 min con el VP Legal, decime el orden ideal de pantallas + qué decir en cada una."*
- *"Si me preguntan 'cómo escalan a 10K tareas', ¿qué respondo? ¿Qué arquitectura tendría que cambiar?"*
