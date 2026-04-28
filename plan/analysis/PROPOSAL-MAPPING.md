# Análisis · Propuesta Editorial de Claude Design

> Reporte generado por agente de mapeo · 2026-04-28
> Fuente: lectura de archivos `.jsx` y `.html` en `pendientes/`

## ⚠️ Aclaración crítica de archivos

Los nombres de archivo en `pendientes/` están desordenados respecto al contenido. Mapeo real (por contenido):

| Archivo | Contiene realmente |
|---|---|
| `shared-components.jsx` | tokens, `EdSidebar`, `EdHeader`, `edTheme()`, `edBaseCSS()`, `edScope()` |
| `editorial-shared.jsx` | datos `ED_*` (people, team, tasks, projects, tracker, nav) |
| `editorial-data.jsx` | componente `EdTracker` |
| `ed-tracker.jsx` | `EdHomeSpecialist` |
| `ed-home-specialist.jsx` | `EdHomeManager` + `EdHomeHQ` |
| `ed-home-manager-hq.jsx` | `EdCrear` |
| `ed-crear.jsx` | `EdAgrupadas` |
| `ed-agrupadas.jsx` | Direction 3 Dense (NO es Editorial) |
| `direction-2-editorial.jsx` | Direction 1 Refined (NO es Editorial) |
| `shared-data.jsx` | primitives (Icon, Avatar, Sparkline, LoadBar, fmtDeadline) |
| `Dashboard (1).html` / `Dashboard.css.html` / `Dashboard.js.html` | **producto actual GAS**, NO la propuesta |
| `Legal Tracker Editorial Deep (standalone).html` | demo navegable (React 18 + Babel CDN) |
| `Legal Tracker Editorial Deep.html` | versión bundleada/inlined del demo (1.8MB) |

## 1. Sistema visual (design tokens)

Definidos en `shared-components.jsx → edTheme(theme)`. Dos modos:

### 1.1 Paleta

**Light (default editorial):**
- `bg #FAFAF7` (papel cálido), `paper #FFFFFF`, `paper2 #F4F2EC`, `paper3 #E9E6DD`
- `ink #1A1A1A`, `muted #5B5B5B`, `dim #9A998F`
- `rule rgba(0,0,0,.09)`, `ruleSoft .04`, `ruleStrong .16`
- **accent `#B8551F`** (terracota — el "rojo Rappi" suavizado a editorial), `accentSoft rgba(184,85,31,.10)`
- `critical #C8372D`, `warn #C68B2B`, `good #4A7C59`, `info #3E5F7A` (cada uno con su `*Soft`)

**Dark:**
- `bg #111114`, `paper #17181C`, `paper2 #1E1F25`, `paper3 #262830`
- `ink #EDEDEE`, `muted #9A9AA2`, `dim #63646C`
- `accent #D17247`, `critical #E26259`, `warn #D9A23F`, `good #6FA88A`, `info #7B96BF`

### 1.2 Tipografías
- **Fraunces** (serif, italic) — restringida a `.ed-h1` (38px, weight 300/400, ls -1px), números hero (44–46px weight 300), `.tk-panel-title` (24px), `.cr-title` (24px), `.cr-step-num` (italic).
- **Nunito Sans** (300–900) — UI general.
- **JetBrains Mono** (400–700) — IDs (`T-142`), métricas tabulares, ETAs, kbd.
- **Eyebrow / labels**: 10–11px, uppercase, ls 1.4–2px, weight 700.

### 1.3 Spacing / radii / shadows
- Layout main: `padding: 40px 48px 60px; max-width: 1200px`
- Sidebar: `218px` (con tracker abierto: `grid-template-columns: 218px 1fr 440px`)
- Radii pequeños: `border-radius: 3–6px` en pills/inputs/buttons
- Sin shadows ambientales; el modal `cr-modal` tiene `box-shadow: 0 30px 80px rgba(0,0,0,.18)` — único shadow notable
- Reglas en lugar de cards: `border-bottom: 1px solid t.rule` separa filas

### 1.4 Dual-theme
Vía prop `theme="light"|"dark"`. No hay breakpoints responsivos (artboards a 1280×1100 / 1480×1100 / 1280×980 fijos).

## 2. Estructura de la app

### 2.1 Navegación por rol (`ED_NAV_BY_ROLE` en `editorial-shared.jsx`)

**Specialist:**
- *Mi día*: Inicio · Mis tareas (badge 7) · Por urgencia
- *Donde participo*: Mis proyectos (badge 3) · Cerradas

**Manager:**
- *Mi día*: Inicio · Mis tareas (badge 3)
- *Equipo*: Tracker (badge 11) · Mi equipo · Proyectos (badge 3)
- *Insights*: Analytics · Historial

**HQ:**
- *Visión*: Inicio global · Por país (badge 10)
- *Operación*: Tracker global (badge 20) · Proyectos (badge 3) · Equipos
- *Insights*: Analytics · Historial

Sidebar muestra brand "Legal" en Fraunces italic + sub "Tracker · Rappi" + role pill (`· Specialist/Manager/HQ`). Footer: avatar + nombre + role.

### 2.2 Vistas implementadas en demo

| ID | Componente | Quién la ve | Propósito |
|---|---|---|---|
| `home` (specialist) | `EdHomeSpecialist` | Specialist | Día personal: vencidas, hoy, semana, racha |
| `home` (manager) | `EdHomeManager` | Manager | Salud del equipo, atención ranked, carga |
| `home` (hq) | `EdHomeHQ` | HQ | 10 países, totales LATAM |
| `tracker` | `EdTracker` | Spec/Mgr/HQ | Tabla + side panel detalle |
| `agrupadas` | `EdAgrupadas` | Specialist | Vista intermedia por urgencia/proyecto/tipo/riesgo |
| `crear` (modal) | `EdCrear` | Todos | Wizard 2 pasos + IA |

**No implementadas** en demo (en sidebar): Mi equipo (manager), Por país (HQ), Proyectos detalle, Cerradas/Historial, Analytics.

## 3. Componentes nuevos (clases CSS clave)

**Primitives editoriales (`edBaseCSS`):**
- `.ed-root`, `.ed-side`, `.ed-main`, `.ed-head`
- `.ed-eye` — eyebrow uppercase 11px
- `.ed-h1` (Fraunces 38px) con `.ed-h1 em` (italic accent)
- `.ed-lede` — párrafo de contexto narrativo, 15px max-width 720px
- `.ed-h2` — section header con regla `::after`
- `.ed-section`, `.ed-mono`, `.ed-serif`
- `.ed-pill` — variantes `.alta .media .baja .curso .revision .bloqueado .pendiente`
- `.ed-dot` con tonos `crit/warn/good/info`
- `.ed-btn`, `.ed-btn.primary`, `.ed-btn.accent`
- `.ed-nav-item`, `.ed-nav-section`, `.ed-nav-label`, `.ed-nav-badge`
- `.ed-role-pill`

**Specialist home (`esp-*`):** `.esp-hero` (4 stats grid bordered), `.esp-stat-num`, `.esp-task-row`, `.esp-task-rank` (numeral italic Fraunces), `.esp-task-meta/.name/.action/.eta/.pills`, `.esp-perf` (4 col), `.esp-proj-row/.esp-proj-role`.

**Manager home (`mgr-*`):** `.mgr-hero`, `.mgr-stat-num.crit/.warn/.good`, `.mgr-team-row` (grid `auto 1.5fr 1fr 1fr 1fr 1fr`), `.mgr-av`, `.mgr-load-bar/.mgr-load-fill.over`, `.mgr-att-row`, `.mgr-att-rank` (Fraunces italic).

**HQ home (`hq-*`):** `.hq-hero`, `.hq-country-row` (6 col), `.hq-flag`, `.hq-num.crit/.good/.warn`, `.hq-spark` (mini barras 12px).

**Tracker (`tk-*`):** `.tk-toolbar`, `.tk-filter.active`, `.tk-table`, `.tk-row.selected` (con `box-shadow:inset 3px 0 0 accent`), `.tk-id`, `.tk-name`, `.tk-name-meta`, `.tk-eta.crit/.warn/.dim`, `.tk-panel` (sticky 440px), `.tk-panel-grid` (2-col), `.tk-panel-block.crit`, `.tk-timeline + .tk-tl-item/.tk-tl-dot.crit/.good`, `.tk-actions`.

**Agrupadas (`ag-*`):** `.ag-tabs/.ag-tab.active`, `.ag-bucket`, `.ag-bhead`, `.ag-cards` (grid 2 col).

**Crear (`cr-*`):** `.cr-overlay/.cr-backdrop/.cr-modal` (780px max-w), `.cr-steps`, `.cr-field/.cr-label`, `.cr-input.title` (Fraunces), `.cr-pills-row/.cr-pill-btn`, `.cr-ai`, `.cr-summary`, `.cr-foot`. `.cr-label .ai` (chip).

**Helpers (`shared-components.jsx`):** `edTheme(theme)`, `edBaseCSS(t)`, `edScope(scope, css)`, `EdSidebar({t, role, activeItem, onNav})`, `EdHeader({t, onCreate})`.

## 4. Modelo de datos esperado

Definido en `editorial-shared.jsx`.

### Persona — `ED_PEOPLE`
- specialist: `{id, name, short, role, country, avatar, color, streak, avgAlta, avgMedia, avgBaja}`
- manager: `{id, name, short, role, country, avatar, color, team}`
- hq: `{id, name, short, role, country, avatar, color, countries}`

### Team member — `ED_TEAM[]`
`{id, name, role, avatar, color, load, capacity, overdue, blocked}`

### Tarea (mías) — `ED_TASKS_MINE[]`
`{id, name, project, priority, status, deadline (int días, neg=vencida), eta (string humano), accionable, blocked (string razón opcional), sla ('2d'|'5d'|'7d')}`

### Tarea tracker — `ED_TRACKER[]`
`{id, name, project, resp (id), priority, status, deadline, type, risk, country}`

### Proyecto — `ED_PROJECTS_MINE[]`
`{id, name, role ('Owner'|'Participante'), tasks, completed, deadline, lead, participants}`

### Buckets de urgencia — `ED_BUCKETS_MINE`
- `overdue`: `deadline < 0`
- `today`: `deadline === 0`
- `thisWeek`: `1 ≤ deadline ≤ 5`
- `later`: `deadline > 5`
- `blocked`: `status === 'Bloqueado'`

### Métricas calculadas
- specialist: `streak`, `avgAlta/Media/Baja`
- team member: `load/capacity` (utilización), `overdue`, `blocked`
- país (HQ): `open, overdue, sla, trend ('up'|'down'|'flat')`
- tarea: `eta` derivado, `blocked.reason`, timeline `{when, what, dot}`
- globales: total LATAM, on-time 30d, países en riesgo

## 5. Vistas por rol — detalle

### 5.1 Specialist home (`EdHomeSpecialist`, archivo `ed-tracker.jsx`)

**Estructura vertical:**
1. **Eyebrow** "Jueves 23 abril · 10:15"
2. **H1**: "Buenos días, Juan Camilo. Tienes *3 cosas* apremiantes hoy."
3. **Lede narrativo** (3–4 líneas) con `crit/good` inline
4. **Hero stats (4 col bordered):** Vencidas (02 crit) · Vencen hoy (01 warn) · Esta semana (04) · Bloqueadas (01 warn). Cada una con `lbl + num + ctx`
5. **"— En tu mesa, por urgencia":** primeras 4 tareas como `esp-task-row` (rank Fraunces italic + meta `id · proyecto · SLA` + nombre + accionable + eta + 2 pills). CTA "Ver todas mis 7 tareas →"
6. **"— Tu desempeño este mes":** 4 col `esp-perf` — Racha on-time, Cierre Alta/Media/Baja vs SLA con margen
7. **"— Proyectos donde participas":** filas con role pill, nombre, líder/participantes, progress, eta

### 5.2 Manager home (`EdHomeManager`, archivo `ed-home-specialist.jsx`)

1. Eyebrow "Jueves 23 abril · Equipo CO"
2. H1: "Tu equipo cargó *11 tareas* de alta prioridad esta semana."
3. Lede que llama out a riesgos y utilización
4. **Hero (4 col):** Tareas vencidas crit · Vencen hoy warn · Carga equipo % · SLA cumplido good
5. **"— Pide tu atención, ahora":** 4 items con `rank | id · who | what | why narrativo` + botones "Ver" y "Reasignar"
6. **"— Tu equipo de un vistazo":** tabla `Persona | Carga (bar+x/y) | Vencidas | Bloqueadas | SLA mes`, con `over` rojo si load>80%

### 5.3 HQ home (`EdHomeHQ`, mismo archivo)

1. Eyebrow "Jueves 23 abril · Visión global · 10 países"
2. H1: "Operación legal global, *vista de un día*."
3. Lede con países en riesgo + saludables
4. **Hero (4 col):** Total abiertas · Vencidas crit · SLA LATAM good · Países en riesgo warn
5. **"— Por país":** tabla 6 col `flag | País/Líder | Abiertas | Vencidas | SLA | Tendencia 30d (sparkbar 12 barras)`

## 6. Tracker (`EdTracker`)

- **Toolbar de filtros con counts inline:** Todas / Vencidas / Hoy / Bloqueadas + buscador `⌘F`
- **Layout split:** cuando hay row seleccionado, `grid-template-columns: 218px 1fr 440px`
- **Columnas:** `ID | Tarea (name + meta `type · proyecto · country`) | Responsable o Proyecto | Prioridad pill | Estado pill | ETA mono`
- **Row selected:** background `accentSoft` + `box-shadow: inset 3px 0 0 accent`
- **Filtrado por rol:** specialist solo sus tareas (sin columna responsable), manager su país, hq todo

**Side panel (`tk-panel`):**
- Header: `id · country` + `×` cerrar
- Título Fraunces 24px
- Pills (prioridad, estado, tipo)
- Bloque "— Estado actual" con narrativa contextual
- Grid 2×3: Responsable / Creada por / Deadline / SLA / Riesgo / Proyecto
- Timeline "— Historial" con dots por evento
- Actions stack: **Escalar** (primary), Reasignar, Comentar

## 7. Agrupadas / Por urgencia (`EdAgrupadas`)

Tabs superiores: **Por urgencia** / Por proyecto / Por tipo / Por riesgo (las 3 últimas no implementadas, solo el tab).

Cada bucket renderiza:
- `ag-bhead`: título Fraunces (`— Vencidas`) + count mono + **narrativa contextualizada**
- `ag-cards` grid 2 col: meta + nombre + accionable + pills (prioridad, estado, eta)

Buckets renderizados: `overdue (crit) → today (warn) → thisWeek → later`.

## 8. Modal de crear (`EdCrear`)

Modal de 780px, wizard de 3 pasos (solo 2 implementados; el 3 "Confirmar" está como tab inactivo).

**Stepper:** `cr-step` con número Fraunces italic 18px. Estados: `active / done / pending`.

**Paso 1 — "Empecemos por lo esencial":**
- Título * (input Fraunces 20px)
- Descripción (textarea)
- Tipo (pills): Contractual / Regulatorio / Contencioso / Privacy
- País (pills): Colombia / México / Brasil / + otros
- "Continuar →"

**Paso 2 — "Revisá y publicá":**
- Resumen `cr-summary`
- **Banda IA `cr-ai`** con sugerencias hardcoded (mockup)
- Grid 3: Prioridad · Riesgo · SLA
- Grid 2: Responsable · Deadline *
- Vincular a proyecto
- "← Volver" + "Publicar tarea"

## 9. Demo standalone

`Legal Tracker Editorial Deep (standalone).html` **es navegable directo en navegador**. Carga React 18.3.1 + ReactDOM + Babel via unpkg, fuentes Google, y los `.jsx` en orden. Layout: 4 secciones × ~12 artboards (Home por rol × light/dark, Agrupadas, Tracker, Crear). TweaksPanel cambia themes y `tracker_role`.

## 10. Lo que NO está en la propuesta

- **Slack / notificaciones / email**
- **Auth / roles backend** (el rol llega como prop)
- **Estados de error / vacíos / loading**
- **Vistas declaradas en sidebar pero no implementadas**: Mi equipo, Por país detalle, Proyectos detalle, Cerradas, Analytics
- **Edge cases**: tareas sin owner, multi-país, dependencias, comentarios/threads
- **Mobile / responsive**: artboards a 1280–1480px fijos
- **Adjuntos / archivos**
- **Permisos finos** (matriz de quién puede qué)
- **Integración con Apps Script** (`<?!= include() ?>`, `google.script.run`) NO mapeada
- **Search ⌘K** (placeholder sin lógica)
- **Analytics dashboard** (sin diseño)
- **Audit log a nivel proyecto**
- **i18n**
- **Filtros guardados / vistas custom**
- **IA real** (las sugerencias del modal Crear son mockup hardcoded)

## Archivos clave (paths absolutos)
- `/home/user/Legal-Tracker/pendientes/shared-components.jsx` — tokens + EdSidebar + EdHeader (base obligatoria)
- `/home/user/Legal-Tracker/pendientes/shared-data.jsx` — Icon/Avatar/Sparkline/LoadBar/fmtDeadline
- `/home/user/Legal-Tracker/pendientes/editorial-shared.jsx` — modelo de datos canónico
- `/home/user/Legal-Tracker/pendientes/ed-tracker.jsx` — `EdHomeSpecialist`
- `/home/user/Legal-Tracker/pendientes/ed-home-specialist.jsx` — `EdHomeManager` + `EdHomeHQ`
- `/home/user/Legal-Tracker/pendientes/editorial-data.jsx` — `EdTracker`
- `/home/user/Legal-Tracker/pendientes/ed-crear.jsx` — `EdAgrupadas`
- `/home/user/Legal-Tracker/pendientes/ed-home-manager-hq.jsx` — `EdCrear`
- `/home/user/Legal-Tracker/pendientes/Legal Tracker Editorial Deep (standalone).html` — demo navegable
