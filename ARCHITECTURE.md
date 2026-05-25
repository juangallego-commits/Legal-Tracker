# Legal Tracker — Architecture Brief

> Documento resumen para cargar como contexto único en Claude.ai cuando el repo completo excede el límite. Última actualización: v3.7+ (Audit log, notifications, bulk close wizard, design pass).

---

## 1. What it is

Web app interna del equipo Global Legal de Rappi+ para hacer seguimiento de tareas y proyectos legales por país, líder, prioridad y estado. **En piloto** con ~5 países activos (CO, MX, BR, AR, CL) + global head. ~150 tareas activas en steady state.

UI con toggle ES/PT-BR (~314 strings en diccionario). Theme dark/light. La data en sheets sigue en español por compatibilidad; capa de display layer traduce labels visibles (ej. `Bloqueado` → `On hold`).

---

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Google Apps Script (`.gs`) — sin frameworks |
| Frontend | HTML + CSS + JS vanilla servido por `HtmlService` — sin React/Vue/bundler |
| BD | Google Sheets (10 hojas — ver §5) |
| Auth | Google SSO + allowlist en hoja `Equipos` |
| Integraciones | Slack (modales, slash commands), Google Drive (adjuntos con taxonomía auto), Gmail (daily digest) |
| Deploy | `clasp` vía GitHub Actions en push a `main` (zero-touch) |
| Charts | Chart.js 4.4.1 (CDN) para analytics; SVG inline para sparklines |
| Timezone | `America/Bogota` (hardcoded en `appsscript.json`) |
| i18n | ES (default) + PT-BR vía diccionario `T_PT` en cliente |

**OAuth scopes**: `spreadsheets`, `drive`, `script.external_request` (Slack), `userinfo.email`, `script.container.ui`.

---

## 3. Estructura del repo

```
/
├── backend/                  # Apps Script (.gs)
│   ├── codigo.gs             # 3365 LOC — engine principal: auth, CRUD, snapshot, cache, digest, telemetry, activity log
│   ├── admin.gs              #  286 LOC — setupSheets + wipeTestData (gated por HEAD + script property)
│   ├── SlackModal.gs         #  928 LOC — integración Slack (modal create/edit, slash commands)
│   └── tests.gs              #  234 LOC — smoke tests (corre desde el editor)
├── frontend/                 # Templates HtmlService
│   ├── Dashboard.html        #  392 LOC — shell HTML
│   ├── Dashboard.css.html    # 3013 LOC — tokens (dark/light), pills, KPIs, modales, utility classes
│   └── Dashboard.js.html     # 11377 LOC — render imperativo, tracker, 3 homes (specialist/manager/HQ), modales, i18n, activity log, notificaciones, bulk ops
├── plan/                     # Templates vivos
│   └── CLAUDE_DESIGN_PROMPT.md
├── archive/                  # Historial del rediseño (no vigente, ver archive/README.md)
│   ├── PRD.md
│   ├── IMPLEMENTATION-PLAN.md
│   └── CURRENT-STATE-AUDIT.md
├── ARCHITECTURE.md           # Este archivo
├── DEMO_BRIEF.md             # Brief de demo a stakeholders + Q&A
├── REVIEW_BRIEF.md           # Prompt para revisores externos con Claude chat
├── README.md
├── .github/workflows/deploy-appsscript.yml
├── appsscript.json
├── .clasp.json.example
├── .claspignore              # whitelist solo backend/ + frontend/ + appsscript.json
└── .gitignore
```

LOC total: ~19.6K.

---

## 4. Backend — funciones clave (`backend/codigo.gs`)

Entry points expuestos al frontend vía `google.script.run`:

```
doGet(e)                                  // Web app entry; auth + render Dashboard
getTrackerData()                          // Snapshot JSON; cache 30s (90KB guard)
getEditorialData()                        // Extiende con campos derivados (eta, slaTarget, load, capacity, etc.)
addTask() / updateTaskField() / updateTaskFields()
blockTaskById() / closeTaskById()
addProject() / updateProjectFields()
uploadDocument() / attachDocumentLink() / removeDocument()
getTaskComments(taskId) / addTaskComment() / editTaskComment() / deleteTaskComment()
getTaskActivity(taskId)                   // Audit trail por tarea
getMyRecentActivity(sinceIso)             // Notificaciones in-app (cambios de otros en mis tareas)
```

Helpers internos clave:

```
resolveVisitor() / determineRole()        // Auth contra hoja Equipos
filterTasksForRole()                      // Filtro por rol + confidencialidad (server-side)
_safeMutation(fn)                         // DocumentLock + cache invalidation; wrapper de TODAS las mutations
_canUserSeeTask(ctx, taskId)              // Visibility check para reads sensitivos
_authorizeTaskWrite(ctx, currentTask)     // Permission check para writes
_sanitizeCell(v) / _sanitizeRow(arr)      // Anti formula-injection (prefija con ' si empieza con =+-@)
_logActivity(ctx, taskId, action, ...)    // Best-effort write a sheet Activity
_telemetry(name, fn, ctx)                 // Stackdriver logging
_cachedRawData()                          // 30s cache con guard de 90KB (>90 skip cache + log warning)
_readHistorialDataRows(ws)                // Helper canónico: lee data del Historial desde row 4
countBizDays(start, end, country)         // O(1) con feriados por país
```

**Shape de `getTrackerData()`**: `{ tasks, historial, projects, projectList, kpi, sla, teamGrid, countries, config, semana, today, _role, _user }`.

**Cache**: TTL 30s en `CacheService` (key `tracker_data_v1`). Cualquier escritura invalida vía `_safeMutation`. Guard de tamaño: si `JSON.stringify(raw).length > 90KB`, skip cache + log warning (CacheService put límite es 100KB).

**Doble lock pattern**: `_safeMutation` toma `DocumentLock` (30s). Algunos `_*Impl` (addTask, addProject, updateTaskFields) toman `ScriptLock` interno para secciones read-then-write. Son locks distintos, no hay deadlock. La redundancia es intencional (~5ms cost, race condition prevention).

---

## 5. Modelo de datos (Google Sheets)

| Hoja | Uso | Notas |
|------|-----|-------|
| `Tracking Activo` | Tareas en curso | 19 cols, source of truth. Headers en rows 1-3, data desde row 4 |
| `Historial` | Tareas cerradas | Append-only. Mismo layout que Tracking Activo (headers rows 1-3) |
| `Equipos` | Roster + allowlist | code/country/leader/members/emails. Define quién accede |
| `Proyectos` | Proyectos | 17 cols. Headers en row 1 |
| `Comments` | Comentarios por tarea | Auto-creada en primer uso. Headers en row 1 |
| `Activity` | Audit log de cambios | Auto-creada. Acciones: comment, status_change, close, block, reassign, create |
| `Config` | Heads + parámetros globales | `Heads` (CSV de emails) define el rol HQ. `Capacidad default` (número) + `Capacidad: <Nombre>` (override por persona) alimentan las load bars |
| `Feriados` | Días no laborables por país | Manual; afecta `countBizDays` y SLA |
| `Templates` | Checklists por tipoTrabajo | Opcional; pre-llena Notas al crear tarea |
| (`Telemetry`) | Logs de mutations | Generada por `_telemetry()`; no user-facing |

---

## 6. Features por rol

### 👤 Specialist
- **Home** — greeting + banner de vencidas (si overdue > 0) + 4 KPIs (Vencidas/Vencen hoy/Esta semana/On hold) + **"Lo que más necesita atención"** (single card grande con la tarea más urgente) + "Tu mes hasta ahora" + proyectos en los que está
- **Por urgencia** — buckets (vencidas / hoy / esta semana / próximas)
- **Mis tareas** — vista personal de activas
- **Proyectos** — proyectos donde participa
- **Cerradas** — historial personal
- **Mi desempeño** — analytics: on-time rate, racha, throughput 8 semanas, mix por prioridad

### 🟢 Manager
- **Home** — greeting con specialists count + narrative ("Tu equipo está cargando N tareas de prioridad alta") + 4 KPIs + tabla "Requieren tu atención" + tabla **"Quién necesita atención"** (top 3 por carga/vencidas/on hold)
- **Asignadas a mí** — tareas personales del manager
- **Tracker** — del país, filtros (status, project, owner, confidentiality)
- **Mi equipo** — miembros con load bars + counts
- **Proyectos** — todos del país
- **Analytics** — KPIs + distribution por priority + top owners + SLA donut + aging buckets + SLA trend 8 semanas
- **Historial** — cerradas del país

### 🌎 HQ (head)
- **Home global** — "Operaciones legales globales" + narrative LATAM + 4 KPIs agregados + tabla "Por país" (con sparklines 12s) + **"Proyectos en riesgo"** + activity feed (últimas cerradas)
- **Tracker global** — countries-first landing (grid de cards) → drill al detalle
- **Proyectos** — todos LATAM
- **Equipos** — agrupados por país
- **Analytics** — todo lo de manager + Countries comparison + Projects at risk
- **Historial** — cerradas globales
- **Demo switcher** — "Ver como Specialist/Manager/HQ"

---

## 7. Features cross-cutting

| Feature | Descripción |
|---|---|
| **Cmd+K search** | Filtra tasks + projects + documents, con highlight + navegación ↓/↑/Enter |
| **Atajos de teclado** | `/` busca, `N` nueva, `?` help, `Esc` cierra, `↑↓` navega, `A` avanza seleccionada |
| **Help modal** | Lista atajos + flujos básicos |
| **Task panel full-screen** | Click en tarea → vista completa (no side-panel) + back button + flash highlight |
| **Inline edit en panel** | Click en cell (Owner/Deadline/Risk/Project) abre editor; dbl-click en título |
| **Documents** | Upload a Drive con auto-taxonomía + paste links externos |
| **Comments thread** | Hilo por tarea con avatar+name+ts. Cmd+Enter envía. Edit/delete propios |
| **Activity log + notifs in-app** | Sheet `Activity` registra cambios. Menú de usuario muestra "Actividad reciente · N" badge con cambios hechos por otros en tus tareas |
| **Bulk actions** | Checkbox per row → bar sticky: Avanzar/On hold/Reasignar/Cancelar. Reassign con picker visual |
| **Bulk close wizard** | Si seleccionás tareas y "Avanzar" llevaría algunas a Listo, abre modal "Cerrar N tareas como Listo" con resumen único aplicado a todas |
| **Auto-promote** | Editar/comentar una tarea Pendiente la pasa automáticamente a En curso |
| **Tour interactivo** | Primer login: 7 pasos por rol. Localstorage flag. `Esc` salta |
| **Daily digest email** | Trigger 8am hora del país. Email a cada specialist con vencidas/hoy/48h + resumen al manager. Skip fines de semana. Deep-links `?task=ID` |
| **Días hábiles con feriados** | `etaDays` y SLA excluyen sáb/dom + feriados nacionales. Hoja `Feriados` cacheada 1h |
| **Task templates** | Hoja `Templates` (tipoTrabajo|checklist JSON). Pre-llena Notas al crear si está vacío |
| **Conflict of interest** | Banner amarillo si la contraparte de una tarea matchea con `contrapartesConflicto` del proyecto |
| **Export reports** | XLSX de vista filtrada + PDF mensual por país. Files en folder `Legal Tracker · Exports` en Drive |
| **i18n ES/PT-BR** | Toggle en menú de usuario, persistido en localStorage |
| **Dark/light theme** | Toggle en menú. Pills con `border-left` para distinguir estados sin depender de color (daltonismo) |
| **Responsive** | Sidebar colapsa <1024px, hamburguesa <768px. Modales `<900px` ocupan viewport. Tablas con `pa-tbl-wrap` (overflow-x) |
| **Skeleton classes** | `.pa-skeleton-row` + `pa-shimmer` animation listas para usar en próximas pasadas |

---

## 8. Roles y autorización

| Rol | Capacidad |
|-----|-----------|
| `head` (HQ) | Vista LATAM; reasigna cross-country; cambia confidencialidad; corre admin scripts (setupSheets/wipeTestData) |
| `manager` | Su país; reasigna dentro del equipo; cambia confidencialidad |
| `specialist` | Sus tareas; self-update; NO reasigna |

Resolución en `resolveVisitor()` → `determineRole()` consultando hoja `Equipos` + `Config!Heads`.

**Backend valida en cada write** (`_authorizeTaskWrite`): specialist no puede reasignar `resp`, manager no puede mover de país, solo manager/head cambian `confidencialidad`.

**Confidentiality levels** (display layer reducido a 2 niveles, backend acepta los 3 legacy):
- `estandar` (UI: "Normal") — visible al equipo del rol
- `restringido` (UI: "Confidencial", upgrade-to display) — solo resp / líder / head / manager del país
- `confidencial` (UI: "Confidencial") — solo resp / líder / head

`filterTasksForRole()` aplica este filtro antes de devolver tasks.

---

## 9. Integración Slack (`backend/SlackModal.gs`)

- **Verificación HMAC**: implementada pero **desactivada** (`_SLACK_SIG_ENFORCED = false`) por limitación de Apps Script (webapp simple no expone headers HTTP). Workaround documentado: migrar a Cloud Function proxy que valide y forwardee con bearer token.
- **Deduplicación** de eventos por hash
- Slash commands + shortcuts → modal de creación/edición
- Notifica a canal cuando se crea/cierra/bloquea tarea

---

## 10. CI/CD (`.github/workflows/deploy-appsscript.yml`)

Trigger: push a `main` o dispatch manual.

Pasos: checkout → Node 20 → `npm i -g @google/clasp` → escribe `~/.clasprc.json` desde secret `CLASPRC_JSON` y `.clasp.json` con `SCRIPT_ID` → `clasp push -f`.

**Secrets requeridos en GitHub**: `CLASPRC_JSON`, `SCRIPT_ID`.

**`/dev` URL** se actualiza automáticamente con cada push a main. **`/exec` URL** (producción) requiere "New version" manual en el editor de Apps Script.

---

## 11. Seguridad y guards

- **`setupSheets()` y `wipeTestData()`** viven en `backend/admin.gs` (no codigo.gs). Ambas requieren `_requireAdminEmail()` (email en `Config!Heads`). `wipeTestData` además requiere Script Property `WIPE_CONFIRM=YES` (token de uso único).
- **Server-side authorization** en cada write vía `_authorizeTaskWrite`. No confía en el cliente.
- **Confidentiality filter** server-side en `filterTasksForRole` (no solo UI).
- **Formula injection** protegido con `_sanitizeCell` (prefija `'` si valor empieza con `=+-@\t\r`).
- **XSS** escapado en frontend con `esc()` consistente. Event delegation con `data-act` (no `onclick=` inline).
- **Cache guard** de 90KB en `_cachedRawData` (log warning + skip si excede).
- **Error logger del cliente** sanitiza URLs y emails antes de persistir en localStorage (PII redaction). MAX 5 entries.

---

## 12. Deuda técnica conocida

| # | Ítem | Estado |
|---|------|--------|
| 1 | `Dashboard.js.html` = 11.4K LOC monolítico | 🟡 Aceptable sin bundler; pendiente modularización vía `include()` |
| 2 | `_SLACK_SIG_ENFORCED = false` | 🟡 Limitación de plataforma. Workaround: Cloud Function proxy (no priorizado) |
| 3 | `_readTaskById` linear scan | 🟡 OK a 150 tareas; necesita índice a 500+ |
| 4 | `T_PT` inline en JS sin validación | 🟡 314 entries; gaps detectados manualmente |
| 5 | Tests con emails productivos | 🟢 Override vía Script Properties (`TEST_EMAIL_*`); fallback al hardcode |
| 6 | Touch UX en tablets (1024px) | 🟡 Hover-expand puede confundir |
| 7 | Telemetry sheet en español | ⏸ No user-facing |
| 8 | `Historial` crece sin pruning | ⏸ Sin plan de archivado todavía |
| 9 | `Activity` (audit log) crece sin pruning | ⏸ Idem |

---

## 13. Backlog priorizado

1. **Modularizar `Dashboard.js.html`** vía `include()` en HtmlService (split en `EdHome.js.html`, `EdTracker.js.html`, etc.). Esfuerzo: 1 día. Bloquea claridad del próximo trabajo.
2. **Extraer `T_PT` a archivo separado** + script de validación que detecte strings sin traducir. 1 día.
3. **Skeleton loading states** en tablas usando las clases ya creadas (`pa-skeleton-row`). 1.5h.
4. **Bulk export** con filtros aplicados (CSV/PDF de la vista actual). Small.
5. **Mobile touch UX** real (no solo responsive del wrapper). Medium.
6. **@mentions en comments** → notify por Slack/email. Small-medium.
7. **Search history** en Cmd+K (últimas 5). Small.
8. **`_readTaskById` con índice** (cachear id→row en snapshot). Medium, prematuro a 150 tareas.

---

## 14. Cómo pedirle a Claude que ayude

Ver `REVIEW_BRIEF.md` para el prompt completo de revisión externa.

Para tareas puntuales, leé en orden:
- `README.md` — overview
- Este archivo (`ARCHITECTURE.md`) — capas + modelo de datos
- `DEMO_BRIEF.md` — features tour + script de demo

Peticiones atómicas funcionan mejor. Ejemplos:
- *"En `backend/codigo.gs:1357`, el path de `getTaskComments` cuando la tarea está en historial — ¿puede leak data? Diagnóstico, no código."*
- *"Diseñá el flujo de un endpoint `?api=tasks&country=CO` con auth. Plan, no implementación."*
- *"¿Cómo migrarías `T_PT` a un sheet para que el equipo PT-BR edite sin tocar código?"*
