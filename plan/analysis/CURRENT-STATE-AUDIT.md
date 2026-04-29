# Análisis · Estado actual del Legal Tracker

> Reporte generado por agente de auditoría · 2026-04-28
> Fuente: lectura completa de `backend/codigo.gs`, `backend/SlackModal.gs`, `frontend/Dashboard.html`, `frontend/Dashboard.css.html`, `frontend/Dashboard.js.html`

## 1. Backend (codigo.gs)

### 1.1 Endpoints expuestos al frontend
Todos accesibles vía `google.script.run.<fn>(...)`. Mutations envuelven en `_safeMutation` que retorna `{success:false, error}` en lugar de throw.

| Función | Firma | Propósito |
|---|---|---|
| `getTrackerData()` | `()` | Snapshot completo filtrado por rol del visitante. Único entry-point de lectura. Cache de 30s. |
| `addTask(taskObj)` | `(obj)` | Crea tarea. Retorna `{success, id}`. Lock para `nextTaskId`. |
| `updateTaskField(taskId, field, value)` | `(id, str, val)` | Update de un solo campo. |
| `updateTaskFields(taskId, fields)` | `(id, {...})` | Batch update. Status='Listo' dispara move a Historial. |
| `updateTaskStatus(taskId, newStatus)` | wrapper sobre `updateTaskField`. |
| `addProject(obj)` | `(obj)` | Crea proyecto, autoinicializa hoja Proyectos si no existe. |
| `updateProjectField(projId, field, value)` | igual a tasks. |
| `updateProjectFields(projId, fields)` | batch. |
| `uploadDocument(kind, itemId, fileData)` | `('task'\|'project', id, {name,mimeType,data:base64})` | Sube a Drive (taxonomía TipoTrabajo/País/Proyecto). |
| `attachDocumentLink(kind, itemId, link)` | `(... , {url, name})` | Vincula link Drive existente. |
| `removeDocument(kind, itemId, docIndex)` | quita referencia (no borra Drive). |
| `closeTaskById(taskId, slackUser)` | usado por Slack y opcionalmente UI. |
| `blockTaskById(taskId, reason, slackUser)` | usado por Slack. |
| `findTaskCandidates(text)` | fuzzy matcher. Slack-only en práctica. |
| `doGet(e)` | render del web app + endpoint `/api?page=api` (JSON). |

Frontend usa actualmente solo: `getTrackerData`, `addTask`, `addProject`, `updateTaskFields`, `updateProjectFields`, `uploadDocument`, `attachDocumentLink`, `removeDocument`.

### 1.2 Shape de getTrackerData()
```jsonc
{
  "tasks": [{
    "id": 17, "nombre": "...", "resp": "Isabela Zuluaga", "acc": "...",
    "deadline": "28/03/2026", "deadlineISO": "2026-03-28",
    "priority": "Alta|Media|Baja",
    "status": "Pendiente|En curso|En revisión|Bloqueado|Listo",
    "semana": "24-28 mar 2026",
    "creado": "21/03/2026", "creadoRaw": "2026-03-21T...Z",
    "cerrado": "", "notas": "...",
    "proyectoId": 4, "proyecto": "4",
    "pais": "CO", "lider": "Carlos Eduardo Fernández",
    "tipoTrabajo": "Contencioso|Regulatorio|Contractual|Privacy|Operativo",
    "riesgo": "Legal alto|Reputacional|Operativo",
    "documentos": [{name,url,id,uploadedBy,uploadedAt,external?}]
  }],
  "historial": [ /* mismo shape, status='Listo' */ ],
  "projects": [{
    "id": 4, "nombre": "...", "pais": "CO", "lider": "...", "responsable": "...",
    "deadline": "...", "deadlineISO": "...",
    "priority": "...", "status": "Activo|En pausa|Completado|Cancelado",
    "statusForced": false, "descripcion": "...", "notas": "...",
    "creado": "...", "semana": "...",
    "participantes": ["Nombre1","Nombre2"],
    "tipoTrabajo": "...", "riesgo": "...",
    "documentos": [...],
    "pctDone": 42,
    "tasks": [ /* sus tareas activas visibles */ ],
    "taskStats": {total,pendiente,enCurso,enRevision,bloqueado,listo,alta,media,baja}
  }],
  "kpi":  {total, alta, media, baja, pendiente, enCurso, bloqueado, enRevision, listo},
  "sla":  {onTime, atRisk, overdue},
  "team": [{name, initials, country, total, alta, media, baja,
            pendiente, enCurso, bloqueado, enRevision, listo, pctDone}],
  "countries": [{code, name, leader, total, alta, media, baja}],
  "equipos": [{code, country, leader, leaderEmail, members:[], emails:[],
               slackChannel, notes}],
  "projectList": [{id, nombre}],
  "semana": "24-28 mar 2026",
  "generated": "28/04/2026 14:33",
  "config": { Heads, Miembros, DriveFolder, ... },
  "_role": "head|manager|specialist",
  "_user": {name, code, isLeader}
}
```

### 1.3 Roles y autorización
- **`determineRole(email, user, config)`** decide:
  - **head** si email está en `config.Heads` (CSV, case-insensitive en hoja Config)
  - **manager** si `user.isLeader` (su email coincide con `leaderEmail` de algún equipo)
  - **specialist** en cualquier otro caso (email en `members/emails` paralelos)
- Allowlist construida en `buildEmailAllowlist(equipos)`: `{email→{name, code, isLeader}}`. `doGet` rechaza no-allowlisted.
- **Filtro de lectura** (`filterTasksForRole`/`filterProjectsForRole`): head ve todo; manager ve `pais === user.code`; specialist solo `resp === user.name`.
- **Filtro de escritura** (`_authorizeTaskWrite` / `_authorizeProjectWrite`): mismas reglas + restricciones específicas (specialist no reasigna, manager no cambia país).
- Cache `tracker_data_v1` 30s; cualquier escritura llama `invalidateCache()`.

## 2. SlackModal.gs
Integración de Slack Events + Interactive Modals via un único `doPost`. Reacciones disparan: `:scales:` → modal de creación → `addTask`; `:white_check_mark:` → fuzzy match + `closeTaskById`; `:no_entry:` → modal de razón + `blockTaskById`. Tokens vía `Script Properties.SLACK_BOT_TOKEN`.

## 3. Frontend HTML

### 3.1 Vistas existentes
| ID | Propósito |
|---|---|
| `vTracker` (default) | Hero con dos canvas + team-grid + tabla de tareas con filtros |
| `vResumen` | Solo head: 4 KPI tiles + tabla por país + proyectos en riesgo + trend |
| `vProyectos` | Filtros + grid de project cards |
| `vMiequipo` | Solo manager/head: tabla Hotspots + grid del equipo |
| `vAnalytics` | 2 canvas + bloque SLA |
| `vHistorial` | Tabla de tareas cerradas |
| `vMistareas` | 4 KPI tiles personales + card "Mi desempeño" + tabla |
| **Modales** | `createOv`, `editOv`, `confOv`, dropdowns, toast |

### 3.2 Tabs en topbar
**Resumen · Tracker · Proyectos · Mi equipo · Analytics · Historial · Mis tareas · + Crear**.

## 4. Sistema visual actual (CSS)

### 4.1 Tokens
Definidos en `:root` (light) y override en `[data-theme="dark"]`.

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--bg` | `#FAFAF7` | `#111114` | body |
| `--surface` | `#FFFFFF` | `#17181C` | cards |
| `--surface2` | `#F4F2EC` | `#1E1F25` | layered |
| `--surface3` | `#E9E6DD` | `#262830` | scrollbar |
| `--border` | `rgba(0,0,0,.09)` | `rgba(255,255,255,.08)` | bordes |
| `--text` | `#1A1A1A` | `#EDEDEE` | principal |
| `--text-muted` | `#5B5B5B` | `#9A9AA2` | secundario |
| `--text-dim` | `#9A998F` | `#63646C` | terciario |
| `--rappi` (accent) | `#B8551F` | `#D17247` | brand |
| `--green/--red/--yellow/--blue/--purple/--cyan` | tonos editoriales | versiones claras | semantic |
| `--radius / --radius-sm / --radius-xs` | 16/10/6 px | — | shape |
| `--font` | `'Nunito Sans'` | — | UI |
| `--mono` | `'JetBrains Mono'` | — | IDs |
| `--serif` | `'Fraunces'` | — | titulares |
| **Aliases editoriales** | `--paper / --ink / --rule / --accent / --critical / --warn / --good / --info` | — | usados por `.ed-*` |

### 4.2 Dual-theme
Implementado mediante `[data-theme="dark"]` selector sobre `<html>`. Switcher disponible vía `setTheme(theme)` en JS. Default light. **No hay trigger UI visible** para cambio de tema.

### 4.3 Tipografías
Importadas en `Dashboard.html` línea 9:
- **Nunito Sans** 300-900 (UI)
- **JetBrains Mono** 400-700 (IDs/números)
- **Fraunces** 300-600 italic + roman (titulares editoriales)

### 4.4 Componentes editoriales ya implementados (Phase 0)
Bloque en CSS líneas 1392-1497:
- `.ed-mono`, `.ed-serif`
- `.ed-eye` — eyebrow uppercase 11px ls 2px
- `.ed-h1` — Fraunces 38px weight 400, lh 1.08, `em` italic en `--accent`
- `.ed-h2` — uppercase 13px con regla `::after`
- `.ed-lede` — párrafo intro 15px, `.crit/.good/.warn/b` para énfasis
- `.ed-section` — spacer 48px
- `.ed-btn` (con `.primary`, `.accent`) — radius 4px
- `.ed-pill` — radius 3px, variantes `.alta/.media/.baja/.curso/.revision/.bloqueado/.pendiente`
- `.ed-dot` — punto 6×6 con `.crit/.warn/.good/.info`

**No detectado:** layouts compound (sidebar, header de portada), tokens spacing/sizing escala, font-size scale.

## 5. Frontend JS

### 5.1 Vistas registradas
```js
var VIEWS = ['resumen','tracker','proyectos','miequipo','analytics','historial','mistareas'];
```
`go(v)` toggla la `.active` y dispara el render correspondiente.

Default por rol al boot:
- specialist → `mistareas`
- manager → `miequipo`
- head → `resumen`

### 5.2 Funciones globales (selección)
- **Navegación / filtros**: `go`, `goSub`, `fC`, `fSt`, `fPr`, `fR`, `tSort`, `onS`, `toggleMyTasks`, `clearAllFilters`
- **Modales**: `openCreate`, `closeCreate`, `openEdit`, `openEditProj`, `closeEdit`, `saveEdit`
- **Mutations**: `submitTask`, `submitProj`, `saveEditTask`, `saveEditProj`, `batchU`, `cfUp`, `uf`
- **Documents**: `onDocFileSelected`, `attachDocLinkFromForm`, `renderDocsSection`
- **Otros**: `addParticipant`, `confirm_`, `toast`, `reload`, `showSM/showPM/showTM`

### 5.3 Filtrado por rol (cliente)
- `mountUserChip()` añade `body.classList = 'role-{head|manager|specialist}'`
- `rResumen` early-returns si `USER.role !== 'head'`
- `rMiEquipo` early-returns si `USER.role === 'specialist'`
- Default-view por rol
- **Gap**: las 7 tabs se renderizan para todos sin gating, click en tab "no permitida" → vista vacía

## 6. Gaps obvios para llegar a la propuesta editorial

1. **Layouts compound editoriales no existen**: solo átomos. Faltan shell con sidebar, header de portada, layout multi-columna estilo prensa.
2. **Tokens faltantes para editorial**: no hay tokens explícitos para spacing, grid columns, font-size scale.
3. **Topbar sigue siendo "nav-tab pill" antiguo** con glow terracota — incompatible con `.ed-btn`. Migrar a sidebar vertical.
4. **Tabs por rol mostradas indiscriminadamente**: head ve "Mis tareas", specialist ve "Resumen"/"Mi equipo" → clicks = pantallas blancas.
5. **Sin theme-toggle UI** aunque dual-theme funciona.
6. **Charts** usan tokens pero el aesthetic editorial probablemente quiera barras/líneas planas sin gradientes.
7. **Modales** mantienen radius 16 y gradient — diferente del `.ed-btn` con radius 4.
8. **Ambient gradients** son decoración tech-glow; eliminar o reemplazar por textura papel.
9. **Backend NO requiere cambios** estructurales para el rediseño — el shape cubre lo que se renderiza hoy. Cualquier campo "nuevo" se calcula en runtime desde existentes.

## Archivos relevantes (paths absolutos)
- `/home/user/Legal-Tracker/backend/codigo.gs` (1099 líneas)
- `/home/user/Legal-Tracker/backend/SlackModal.gs` (681 líneas)
- `/home/user/Legal-Tracker/frontend/Dashboard.html` (347 líneas)
- `/home/user/Legal-Tracker/frontend/Dashboard.css.html` (1498 líneas; editorial atoms en 1392-1497)
- `/home/user/Legal-Tracker/frontend/Dashboard.js.html` (~2411 líneas)
