# PRD · Legal Tracker — Rediseño Editorial

> Versión: 1.0 · 2026-04-28 · Owner: Juan Camilo

## 1. Resumen ejecutivo

Migramos la UI del Legal Tracker (web app de Rappi+ corriendo en Google Apps Script) al lenguaje **editorial** propuesto por Claude Design. El backend **no cambia estructuralmente**: extendemos `getTrackerData()` con campos derivados (no requiere cambios en Sheets). Mostramos al equipo esta noche un **demo navegable + el producto vivo con la cara nueva**.

## 2. Por qué

- El Tracker actual es funcional pero "tech-glow": gradientes, halos, pills redondeados que no comunican el carácter del trabajo legal.
- La propuesta editorial baja el ruido visual: papel cálido (`#FAFAF7`), Fraunces para titulares, reglas finas en lugar de cards con shadow, números mono tabulares para SLAs y deadlines.
- La estructura por rol (specialist / manager / hq) ya existe en backend pero la UI la trata casi igual; la propuesta diferencia los tres modos con copy y métricas distintas.

## 3. Alcance

### 3.1 Dentro (esta noche)

| # | Item | Estado |
|---|---|---|
| 1 | Demo standalone navegable presentable al equipo (HTML que abre directo) | Ya existe en `pendientes/Legal Tracker Editorial Deep (standalone).html`, solo necesita ruta pública |
| 2 | Sistema visual editorial completo en `Dashboard.css.html` (tokens + clases `esp-/mgr-/hq-/tk-/ag-/cr-/ed-`) | Phase 0 ya hizo átomos; faltan layouts compound |
| 3 | Shell con sidebar editorial (reemplaza topbar de pills) | Por construir |
| 4 | Home por rol con copy editorial (specialist / manager / hq) | Por construir |
| 5 | Tracker editorial (tabla + side panel sticky 440px) | Por construir |
| 6 | Backend: endpoint `getEditorialData()` que extiende `getTrackerData()` con campos derivados | Por construir |
| 7 | Filtrado de tabs por rol (gating UI) | Por construir |
| 8 | PR mergeado a `main` → deploy automático al webapp | Por hacer al final |

### 3.2 Fuera de scope esta noche (parking lot)

- Vista "Por urgencia" (`EdAgrupadas`) — diseño claro pero queda para después si no alcanza el tiempo
- Modal de crear con wizard 2 pasos + IA mockup (`EdCrear`) — el modal actual sigue funcionando
- Vistas declaradas pero no diseñadas: Mi equipo (manager), Por país (HQ), Proyectos detalle, Historial, Analytics
- Sugerencias de IA reales (las del demo son mockup hardcoded)
- Search ⌘K
- Mobile / responsive (artboards son a 1280-1480px fijos)
- i18n
- Slack: no se toca

## 4. Personas y casos de uso

### 4.1 Specialist (ej. Juan Camilo, Legal Ops · CO)
- **Home**: hero con 4 stats personales (vencidas, hoy, semana, bloqueadas), narrativa contextual, top tareas en mesa por urgencia con próxima acción visible, métricas mes (racha, cierre Alta/Media/Baja vs SLA), proyectos donde participa.
- **Tracker** (filtrado a sus tareas): tabla compacta con ID, nombre, prioridad, estado, ETA mono.
- **CTAs**: ver todas mis tareas, abrir tarea (panel), nuevo.

### 4.2 Manager / Country Lead (ej. Carlos Fernández · CO)
- **Home**: hero con 4 stats de equipo (vencidas en X personas, hoy, carga 65%, SLA cumplido), atención ranked (4 items que requieren acción inmediata), tabla equipo (carga, vencidas, bloqueadas, SLA).
- **Tracker**: equipo CO completo, columna responsable.

### 4.3 HQ / Global Legal Head (ej. Enrique Gonzalez)
- **Home**: hero global (total abiertas LATAM, vencidas, SLA promedio, países en riesgo), tabla por país con sparkbar de tendencia 30d.
- **Tracker**: LATAM completo.

## 5. Modelo de datos (delta)

El backend hoy retorna `tasks`, `projects`, `kpi`, `sla`, `team`, `countries`, `equipos`, `_role`, `_user`. La propuesta requiere campos derivados que se calculan **server-side** sin tocar Sheets:

### 5.1 Por tarea

| Campo nuevo | Cómo se calcula |
|---|---|
| `eta` (string humano) | Función `fmtEta(deadlineISO, today)` → "venció hace 3d", "vence HOY", "mañana", "en 4d" |
| `etaDays` (int) | `(deadlineISO - today)` en días |
| `accionable` (string) | `notas` (campo existente) o derivado por estado |
| `blockedReason` (string) | Si `status === 'Bloqueado'`, primer línea de `notas` |
| `slaTarget` (string) | Tabla por prioridad: Alta=`'2d'`, Media=`'5d'`, Baja=`'7d'` |

### 5.2 Por persona / equipo

| Campo nuevo | Cómo se calcula |
|---|---|
| `load` (int) | Tareas activas (no Listo, no Cancelado) del miembro |
| `capacity` (int) | Default 5 (configurable en hoja Config a futuro) |
| `overdue` (int) | Tareas con `etaDays < 0` |
| `blocked` (int) | Tareas con `status === 'Bloqueado'` |
| `streak` (int) | Tareas cerradas a tiempo consecutivas (lectura de Historial) |
| `avgAlta/Media/Baja` (string) | Tiempo medio de cierre por prioridad (`historial`, calculado server-side) |

### 5.3 Por país

| Campo nuevo | Cómo se calcula |
|---|---|
| `open` (int) | `tasks.filter(t => t.pais === code && t.status !== 'Listo').length` |
| `overdue` (int) | Subset con `etaDays < 0` |
| `slaPct` (int) | Cumplimiento SLA mes (calculado de Historial vs Target) |
| `trend` (array de 12 ints) | Tareas activas por semana, últimas 12 semanas (sparkbar) |

### 5.4 Globales

- `today` (ISO string para evitar drift)
- `roleSpecific` (obj con `narrative`: copy contextual generado server-side por rol)

## 6. Diseño visual — referencia rápida

### 6.1 Tokens core
- `--bg #FAFAF7` / `--paper #FFFFFF` / `--ink #1A1A1A` / `--accent #B8551F` (terracota)
- `--rule rgba(0,0,0,.09)` / `--ruleSoft .04` / `--ruleStrong .16`
- Fonts: `Fraunces` (italic, H1 38px), `Nunito Sans` (UI), `JetBrains Mono` (números/IDs)
- Radii: 3-6px (no 16) · Shadows: solo en modal `0 30px 80px rgba(0,0,0,.18)` · Resto: rules, no boxes

### 6.2 Layout
- Sidebar 218px fijo, main `padding: 40px 48px 60px; max-width: 1200px`
- Tracker con panel: `grid-template-columns: 218px 1fr 440px`
- Sin gradientes radiales decorativos (eliminar `.ambient`)

### 6.3 Componentes clave a portar
- `EdSidebar` (vanilla DOM): brand "Legal" + sub "Tracker · Rappi" + role pill, secciones por rol con badges, footer con avatar+nombre
- `EdHeader` (vanilla DOM): eyebrow fecha + acciones derecha (search placeholder, nuevo)
- Hero stats grid (4 col bordered)
- Task row con rank Fraunces italic + meta + accionable + ETA + pills
- Tracker side panel sticky con grid 2-col + timeline + actions stack

## 7. Criterios de aceptación

### 7.1 Demo standalone
- [ ] Abre directo en navegador sin internet (excepto fonts CDN)
- [ ] Toggle light/dark funciona
- [ ] Toggle role specialist/manager/hq funciona
- [ ] Tracker side panel selecciona y muestra detalle
- [ ] Está accesible vía link público (GitHub Pages, ruta del Apps Script `?page=demo`, o similar)

### 7.2 Producto real (webapp)
- [ ] PR mergeado a `main`
- [ ] Workflow `deploy-appsscript.yml` corre en verde
- [ ] La webapp en producción muestra la cara editorial (sidebar, fonts, tokens nuevos)
- [ ] Specialist al entrar ve su Home editorial con sus tareas reales (no mock)
- [ ] Manager ve su Home con su equipo real
- [ ] HQ ve su Home global con países reales
- [ ] Tracker con panel sticky funciona con datos reales
- [ ] No hay regresiones: crear tarea, editar, cerrar, bloquear, subir doc siguen funcionando
- [ ] Specialist no ve tabs vacías (gating de tabs por rol)

### 7.3 Plan de implementación real
- [ ] PRD en `plan/PRD.md` (este doc)
- [ ] Roadmap en `plan/IMPLEMENTATION-PLAN.md` con fases post-presentación
- [ ] Handoff prompt en `plan/HANDOFF-PROMPT.md` para retomar trabajo

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| No alcanzar el tiempo para portar todas las vistas | Alta | Cortar por capas: Home + Tracker tienen prioridad; Agrupadas / Crear / Mi equipo se hacen después |
| Romper funcionalidad existente al reescribir el shell | Media | El backend no cambia (solo se agrega `getEditorialData`). Los `google.script.run` actuales siguen funcionando |
| Tropicalizar React → vanilla JS introduce bugs | Media | Usar exactamente el mismo CSS de la propuesta; el JS imperativo es más simple que el JSX para estas vistas |
| Standalone HTML pesa 1.5-1.8MB y carga lento | Baja | Es para presentación interna, no producción |
| Workflow de deploy falla con archivos nuevos | Baja | Estructura ya validada; solo agregamos archivos en `frontend/` y `backend/`, no cambiamos paths |

## 9. Cronograma propuesto (esta noche)

| Hora | Hito |
|---|---|
| T+0 | Lanzar 5 agentes en paralelo (backend, CSS, shell+home, tracker, demo) |
| T+90min | Convergencia: integración local |
| T+120min | Smoke test en branch + ajustes |
| T+150min | Push + PR + merge a main |
| T+165min | Deploy completo verificado |
| T+180min | Demo accesible vía link |

## 10. Out of scope explícito (post-noche)

Ver `plan/IMPLEMENTATION-PLAN.md` sección "Fases 2-4" para el roadmap completo después de la presentación.
