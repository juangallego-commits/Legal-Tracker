# Plan de implementación · Rediseño Editorial

## Fase 1 — Esta noche (presentación al equipo)

### Objetivo
PR mergeado a `main` con la cara editorial vivá en webapp + demo standalone navegable.

### Estrategia
**5 agentes en paralelo + 1 integrador secuencial.** Cada agente trabaja en archivos no-solapados para evitar conflictos de merge.

### Agentes y entregables

#### Agente A · Backend — `getEditorialData()`
**Archivos**: `backend/codigo.gs`
**Output**: nueva función `getEditorialData()` que extiende `getTrackerData()` con campos derivados (ver PRD §5). NO modifica funciones existentes. Reusa la cache de 30s.

Campos derivados a calcular:
- Por tarea: `eta`, `etaDays`, `accionable`, `blockedReason`, `slaTarget`
- Por persona/equipo: `load`, `capacity`, `overdue`, `blocked`, `streak`, `avgAlta/Media/Baja`
- Por país: `open`, `overdue`, `slaPct`, `trend[12]`
- Globales: `today` (ISO), `roleSpecific.narrative` (copy contextual server-side)

Nuevo endpoint en `doGet`: `?page=demo` que retorna el HTML standalone del demo, leyendo `pendientes/Legal Tracker Editorial Deep (standalone).html` vía `HtmlService.createHtmlOutputFromFile`.

#### Agente B · Sistema visual editorial completo
**Archivos**: `frontend/Dashboard.css.html`
**Output**: extender la Phase 0 actual (líneas 1392-1497) con:
- Tokens completos editorial (paper/ink/rule/accent + critical/warn/good/info, light + dark)
- Layout shell: `.ed-root`, `.ed-side`, `.ed-main`, `.ed-head`
- Sidebar: `.ed-nav-item`, `.ed-nav-section`, `.ed-nav-label`, `.ed-nav-badge`, `.ed-role-pill`
- Specialist home: `.esp-hero`, `.esp-stat-num`, `.esp-task-row`, `.esp-task-rank`, `.esp-perf`, `.esp-proj-row`
- Manager home: `.mgr-hero`, `.mgr-stat-num.crit/.warn/.good`, `.mgr-team-row`, `.mgr-load-bar`, `.mgr-att-row`
- HQ home: `.hq-hero`, `.hq-country-row`, `.hq-flag`, `.hq-num`, `.hq-spark`
- Tracker: `.tk-toolbar`, `.tk-table`, `.tk-row.selected`, `.tk-id`, `.tk-name`, `.tk-eta`, `.tk-panel`, `.tk-panel-grid`, `.tk-panel-block.crit`, `.tk-timeline`, `.tk-tl-item`, `.tk-actions`
- Eliminar (o reemplazar) los `box-shadow` de glow (`.nav-tab.active`, `.topbar-logo`, `.ambient`)
- Agregar `.theme-toggle` (botón sol/luna en sidebar footer)

Tomar como referencia exacta `pendientes/shared-components.jsx` (función `edBaseCSS(t)` y `edScope`).

#### Agente C · Shell + Home views (vanilla JS)
**Archivos**: `frontend/Dashboard.html`, `frontend/Dashboard.js.html`
**Output**:
- Reemplazar topbar de pills con shell `<div class="ed-root">` + `<aside class="ed-side">` + `<main class="ed-main">`
- Sidebar dinámico que lee `USER.role` y renderiza `ED_NAV_BY_ROLE[role]` (portado de `pendientes/editorial-shared.jsx` líneas 59-74)
- Header con eyebrow de fecha + acciones derecha
- 3 funciones nuevas: `rEdHomeSpecialist(data)`, `rEdHomeManager(data)`, `rEdHomeHQ(data)` que renderizan al `<main>`
- Function `goEd(view)` que enrutea según rol y vista
- Default-view por rol al boot (specialist → home, manager → home, hq → home)
- Filtrado de items de nav por rol (no más tabs vacías)
- Theme toggle wired

Tomar como referencia exacta `pendientes/ed-tracker.jsx` (que es `EdHomeSpecialist`), `pendientes/ed-home-specialist.jsx` (que es `EdHomeManager` + `EdHomeHQ`).

#### Agente D · Tracker + side panel
**Archivos**: `frontend/Dashboard.js.html` (sección tracker), `frontend/Dashboard.css.html` (consume tokens del Agente B)
**Output**:
- Función `rEdTracker(data)` que renderiza:
  - Toolbar con filtros bordered: Todas / Vencidas / Hoy / Bloqueadas + counts mono + buscador
  - Tabla con rows compactos (ID mono, name + meta `type · proyecto · país`, responsable o proyecto según rol, prioridad pill, estado pill, ETA mono)
  - Side panel sticky 440px que aparece cuando hay row seleccionado
- Side panel: header, título Fraunces, pills, bloque "Estado actual" (con narrativa server-side), grid 2×3 (responsable/creada/deadline/SLA/riesgo/proyecto), timeline de eventos, actions stack
- Filtrado por rol: specialist solo sus tareas, manager su país, hq todo

Tomar como referencia exacta `pendientes/editorial-data.jsx` (que es `EdTracker`).

#### Agente E · Demo standalone publicado
**Archivos**: ninguno nuevo, mover/copiar `pendientes/Legal Tracker Editorial Deep (standalone).html`
**Output**: el demo accesible en una de estas rutas (en orden de preferencia):
1. **Como subpágina del Apps Script**: `https://script.google.com/macros/s/.../exec?page=demo` (requiere coordinación con Agente A)
2. **GitHub Pages**: configurar Pages en el repo apuntando a `pendientes/` (o branch `gh-pages`)
3. **Drive público**: subir manualmente y compartir link

Verificar que el HTML standalone abre directo y todos los toggles del TweaksPanel funcionan (theme, role).

#### Integrador · Smoke test + PR
**Cuándo**: después de que A-E hayan pusheado a la rama `feat/editorial-redesign`
**Pasos**:
1. Pull y merge de los commits de A-E
2. Resolver conflictos si los hay (probablemente ninguno por el split por archivos)
3. Verificar que el archivo `frontend/Dashboard.html` no rompió includes (`include('frontend/Dashboard.css')`, `include('frontend/Dashboard.js')`)
4. Smoke test mental:
   - Specialist entra → ve Home spec con sus tareas → click en tarea → abre panel
   - Manager entra → ve Home mgr con su equipo
   - HQ entra → ve Home hq con países
   - Tabs filtradas por rol
   - Theme toggle funciona
   - Crear tarea (modal viejo) sigue funcionando
5. Push final + PR a `main` con descripción detallada
6. Merge → workflow despliega → verificar webapp en navegador
7. Notificar al equipo con link

### Cronograma (3 horas total)

```
T+0:00 ─ Branch feat/editorial-redesign creada (✓ ya hecha)
T+0:00 ─ Lanzar 5 agentes en paralelo
T+1:30 ─ Agentes A, B, E terminan (más rápidos)
T+2:00 ─ Agentes C, D terminan
T+2:00 ─ Integrador inicia smoke test
T+2:30 ─ PR abierto
T+2:45 ─ Merge + deploy verificado
T+3:00 ─ Demo enviado al equipo
```

## Fase 2 — Próximos 7 días

### Vistas faltantes
1. **Agrupadas / Por urgencia** (`EdAgrupadas`) — vista intermedia para specialist
2. **Modal de crear** wizard 2 pasos (`EdCrear`) — sin la banda IA, solo el flujo visual
3. **Mi equipo** (manager) — tabla de miembros con métricas
4. **Por país** detalle (HQ) — drill-down de un país
5. **Proyectos** detalle editorial — reescribir card actual
6. **Historial** editorial
7. **Analytics** editorial — charts en tono editorial (sin glow)

### Mejoras
- Computar `streak`, `avgAlta/Media/Baja` con datos reales del Historial (Fase 1 los mockea si no alcanza)
- Agregar columna `Capacidad` a hoja Equipos para no hardcodear `capacity=5`
- Tendencia 30d real (Fase 1 mockea con array fijo)
- Empty states / error states / loading states editoriales

## Fase 3 — Próximas 2-3 semanas

### Funcionalidades nuevas
- Search global ⌘K
- Vista "Comentar" en panel del tracker (threads)
- Notificaciones (Slack ya lo tenemos, pero agregar in-app)
- Filtros guardados / vistas custom
- Adjuntos en task panel

### Sugerencias IA reales
- Endpoint `suggestTaskAttributes(description, country)` que llama a Anthropic API
- Sugiere prioridad, responsable (basado en carga + tipo), SLA, proyecto match
- Mostrar con chips "Sugerido"/"Calculado"/"Match: X%" en `EdCrear`

## Fase 4 — Mes 2

- Mobile / responsive
- i18n (en/es)
- Dependencias entre tareas
- Audit log a nivel proyecto
- Permisos finos (matrix de quién puede qué)

## Notas de migración

### Backend
**No requiere cambios estructurales en Sheets**. Todos los campos derivados se calculan en runtime desde columnas existentes. El único trade-off es que `getEditorialData()` es ligeramente más caro (cache de 30s lo absorbe).

### Frontend
**Tropicalizar React → vanilla JS**: la propuesta usa hooks (`useState`, `useMemo`) y JSX. Se reescribe como funciones imperativas que toman `data` y devuelven HTML string concatenado, igual al patrón actual de `rTracker`, `rResumen`, etc. No se introduce React.

**CSS**: la mayoría de las clases editoriales ya están en Phase 0. Solo se agregan los layouts compound.

### Apps Script gotchas
- Los includes con slash (`include('frontend/Dashboard.css')`) siguen funcionando (validado en commit anterior).
- El template `<?!= include(...) ?>` solo permite strings, no objetos. Para pasar datos al cliente seguir usando `<script>window.__DATA__ = <?!= data ?>;</script>` que ya existe.
- Cache de 30s en backend; cualquier escritura llama `invalidateCache()`.
