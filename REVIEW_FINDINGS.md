# Revisión integral · Legal Tracker — Hallazgos y plan de acción

> Revisión de código completa (junio 2026). Foco: coherencia de flujos, bugs,
> redundancias a eliminar y mejoras. Las referencias son `archivo:línea` —
> ubicá por nombre de función si los números se corrieron por merges.

> **ESTADO (2ª pasada, jun-2026):** los P0 #1 y #2 quedaron **resueltos**
> (stats de proyecto sobre todas las tareas + gobierno del proyecto restringido
> a responsable/manager/head). También #7 (fuga de semanticSearch, filtrada
> server-side) y #11 (draft del wizard de proyecto; el mutate de `v.lider` ya
> no existía). #3, #4, #5, #6, #10 y el ternario de #13 ya habían quedado
> resueltos por los PRs #83–#85. El deep-dive de frontend que esta revisión
> recomendaba se hizo y encontró 3 funciones con **shadowing de `t()`**
> (parámetro/var `t` tapando la función i18n) que rompían el tracker con
> tareas compartidas, la reasignación masiva y el hero de Proyectos — los tres
> arreglados; el patrón queda anotado en PENDIENTES.md. Pendientes que siguen
> vivos: #8 (decisión Slack), #9 (i18n masivo + huérfanas), #12 parcial
> (el detalle ya muestra contrapartes; el setTimeout quedó centralizado en
> `edPiNewTaskInProject`), #14 (docs), #15 (scopes) y la unificación
> HQ home vs "Por país". El detalle nuevo vive en PENDIENTES.md.

## Cobertura de esta revisión

| Área | Profundidad |
|------|-------------|
| `backend/codigo.gs` (5054), `admin.gs`, `tests.gs` | **A fondo** (lectura completa) |
| `backend/ai.gs`, `gmailAddon.gs`, `SlackModal.gs` | **A fondo** (ai/gmail completos; Slack: entry points + auth + salientes) |
| `appsscript.json`, `Dashboard.html`, contrato RPC FE↔BE | **A fondo** |
| Frontend **Proyectos** (index, detalle, wizard, permisos) | **A fondo** (lectura directa) |
| Frontend homes / tracker / bulk / analytics / colaboradores / recursos / biblioteca | **Pase medio** (grep + lecturas dirigidas) — recomiendo deep-dive posterior |

Gates al momento de la revisión: `node --check` OK en los 5 `.gs` + 2 HTML; `check-i18n` **verde** (`Missing in T_PT: 0`).

---

## Lo que está SÓLIDO (no tocar)

- **`_safeMutation`**: lock + invalidación de cache + envelope `{success}` como único punto de escritura.
- **Sanitización anti-fórmula** (`_sanitizeCell`/`_sanitizeRow`) en todos los writes.
- **Autorización server-side** (`_authorizeTaskWrite/_authorizeProjectWrite/_authorizeColaboradoresWrite`) espejada en la UI (`_piCanEditProject`).
- **Confidencialidad filtrada server-side** (`filterTasksForRole`), incluido el PDF mensual (fuga histórica ya tapada).
- **Días hábiles O(1) con feriados por país** (`countBizDays`), cache 1h.
- **Guard de cache 90KB**, telemetría sin PII, lecturas defensivas de columnas opcionales (anti-drift de esquema).
- **IA con degradación limpia**: sin `GEMINI_API_KEY` todo cae a `NO_AI`/heurística sin romper. Add-on de Gmail bien construido (auth role-aware, dedupe por threadId, adjuntos vía `uploadDocument`).

---

## QUÉ NOS TOCA HACER (priorizado)

### 🔴 P0 — Coherencia/permisos (engañan o sobre-autorizan)

**1. Proyectos: el % de avance y el estado se calculan sobre las tareas que cada rol VE, no sobre el proyecto completo.**
- Backend: `_buildViewForRole` arma `taskStats`/`pctDone` desde `tasks` ya filtradas (`codigo.gs:746-784`).
- Frontend: `_piEnrichProject` (`Dashboard.js.html:8197`) y `_piRenderDetail` (`:8390-8391`) **recalculan** el progreso desde `D.tasks`/`D.historial` (también filtrados) — ni usan el `pctDone` del backend.
- **Efecto:** un specialist con 1 tarea en un proyecto de 5 ve **100% / "Completado"** al cerrarla; un participante sin tareas propias lo ve **0% / total 0**. Manager/head ven el número real → el mismo proyecto muestra avances distintos según quién mira.
- **Fix:** calcular las stats de proyecto sobre TODAS las tareas del proyecto (no las filtradas) y mandarlas en el snapshot (`projectStatsAll`); el frontend las consume en vez de recomputar. Esfuerzo: **~1 día**.

**2. Permisos de proyecto demasiado amplios: cualquier participante puede cancelar/reasignar/quitar gente.**
- `_authorizeProjectWrite` (`codigo.gs:1085-1098`) permite a cualquier participante editar `status` (= cancelar), `participantes` (= quitar al responsable u otros), `deadline`, `priority`, etc.
- **Fix:** separar "editar contenido" (descripción/notas/tipo) de "cambiar estado/responsable/participantes" (restringir a responsable + líder + manager + head). Esfuerzo: **medio**.

### 🟠 P1 — Redundancias y paridad

**3. Eliminar la UI de creación/edición legacy (código muerto + campos divergentes).**
- El FAB (`edCrearOpen`) y el detalle abren los **wizards** (`EDC`/`crHost`, `EDCP`/`crpHost`). El modal viejo `createOv` (+ `submitTask`/`submitProj`/`goSub`/`closeCreate`) y el `editOv` (+ `saveEdit`) quedaron superados (`Dashboard.html:49-112,123`).
- El modal viejo **aún tiene "Nivel de riesgo"** que se quitó del wizard (commit `dad1833`) → campos divergentes según por dónde entres. Esfuerzo: **bajo-medio** (borrar markup + funciones; verificar que nada lo abra).

**4. Unificar los dos sistemas de digest (footgun de naming).**
- Conviven `sendDailyDigest`/`_runDailyDigest`/`_sendSpecialistDigest`+`_sendManagerDigest` (instalado por `installDigestTrigger` **8am**, `admin.gs:92`) y `sendDailyDigests`/`_buildDigestForMember` (instalado por `setupDailyDigestTrigger` **7am**, `codigo.gs:3479`). El botón "enviar mi digest ahora" usa **un formato**, el trigger diario **otro**.
- **Fix:** quedarse con uno, renombrar para que no se confundan, borrar el otro. Esfuerzo: **bajo**.

**5. `addProject` a paridad con `addTask`.** No valida enums (`priority`/`status`), no rechaza deadline en el pasado, y no aplica guard de país al specialist (`_addProjectImpl`, `codigo.gs:1228`) — todo eso sí existe en `addTask`. Esfuerzo: **bajo**.

**6. Unificar el vocabulario de "Nivel de riesgo".** Hay 3 variantes: modal legacy `Legal alto/Reputacional/Operativo` (`Dashboard.html:67`), wizard/add-on `Legal/Reputacional/Negocio` (`gmailAddon.gs:262`), y `ai.gs:278` setea `'Legal'`. Elegir una lista y propagarla. Esfuerzo: **bajo**.

**7. Verificar fuga potencial en búsqueda semántica.** `semanticSearchBiblioteca` (`ai.gs:356`) rankea sobre TODOS los embeddings sin filtro de rol/confidencialidad y devuelve `ids`. Es seguro **solo si** el frontend intersecta esos ids con la lista de docs ya filtrada (`getBibliotecaDocs`). Confirmar y, si no, filtrar server-side. Esfuerzo: **bajo** (verificación).

**8. Decisión Slack.** La integración (~928 líneas) está **inoperante**: `access:DOMAIN` rechaza el POST anónimo de Slack; las mutaciones usan `Session.getActiveUser()` (vacío en POST externo) → "No autorizado"; no hay mapeo Slack→email; firma desactivada (`_SLACK_SIG_ENFORCED=false`). Las salientes solo son reactivas a eventos entrantes (no hay notificaciones autónomas). **Opciones:** (a) Cloud Function proxy + mapeo (~1-2 días) si se quiere Slack; (b) desactivar/aislar el módulo para bajar superficie y mantenimiento. Esfuerzo: **decisión**.

### 🟡 P2 — Limpieza y pulido

**9. i18n:** Biblioteca está sin `t()` (ej. `_bibSubnav`, `Dashboard.js.html:10307`); el panel de notificaciones usa `LANG==='pt'` inline (consistente, pero distinto al resto). Además hay **167 claves huérfanas en `T_PT`** (27% del diccionario, nadie las llama) para borrar. Esfuerzo: **medio** (mecánico).

**10. Dedupe conflicto de interés.** Dos implementaciones equivalentes: `checkContraparteConflict()` (`Dashboard.js.html:553`, modal legacy) y `_crMatchConflict()` (`:7698`, wizard). Dejar una. Esfuerzo: **bajo**.

**11. Wizard de proyecto:** alinear el restore de borrador con el de tareas — `edCrearProyectoOpen` (`:10196`) hace `Object.assign(EDCP.values, draft)` y pisa el prefill de país/líder con el draft viejo (el wizard de tareas solo copia claves no vacías). Y `_crpRenderStep2` muta `v.lider` durante el render (`~:10014-10018`) — efecto colateral. Esfuerzo: **bajo**.

**12. UX proyectos:** el detalle no muestra las **contrapartes en conflicto** declaradas (solo se usan al crear una tarea). Mostrarlas en el detalle. La acción "Nueva tarea en proyecto" usa un `setTimeout(...,100)` frágil para setear el proyecto (`:8426`). Esfuerzo: **bajo**.

**13. Limpiezas menores backend:** ternario muerto `lang==='pt'?'Modo claro':'Modo claro'` (`:3176`); doble `invalidateCache()` en `closeTaskById` (`codigo.gs:4214`, ya lo hace `_safeMutation`); fallback muerto de `oldValue` en `_updateTaskFieldImpl`; auto-promote usa match exacto de nombre en vez de `_normalizeName`. Esfuerzo: **bajo**.

**14. Docs desactualizados:** `ARCHITECTURE.md` dice 10 hojas / 3365 LOC (real 12+ / 5054); el digest se documenta como "8am hora del país" (es trigger único 7/8am hora Bogotá); ARCHITECTURE/REVIEW_BRIEF dicen "event delegation con data-act, no onclick inline" pero la realidad es **255 `onclick=` inline vs 16 `data-act`** (y eso es superficie XSS si se olvida `esc()` en algún `onclick` interpolado). Esfuerzo: **bajo**.

**15. (Investigar) Scopes:** `appsscript.json` pide `drive` (completo) — ver si `drive.file` alcanza; `script.container.ui` puede no ser necesario para webapp + add-on. Esfuerzo: **investigar**.

### Por confirmar (pase medio — del backlog del equipo, no verificado a fondo)
- HQ home vs "Por país" (`vEdResumen`): tablas casi duplicadas → unificar o quitar una del nav.
- Tour de HQ: copy dice un número de pasos que no coincide con los que renderiza.
- KPIs clickeables (drill) en los homes pero no en Analytics / Mi equipo.

---

## Cierre
El **núcleo backend está genuinamente bien pensado** (locks, sanitización, autorización y confidencialidad server-side, días hábiles). La deuda real está en: (1) **coherencia de Proyectos** entre roles, (2) **duplicación de UI/digest/enums** acumulada por iteración rápida, y (3) **integraciones a medias** (Slack inoperante). Atacando P0+P1 se gana coherencia y se baja superficie de mantenimiento de forma notable.
