# Pendientes manuales · Legal Tracker

Cosas que **no se pueden automatizar desde el código** y hay que hacer a mano
(editor de Apps Script, hoja de Google, consola de Slack/Google), más el
**roadmap priorizado** que salió de la auditoría de producto/UX con agentes.

> Para correr funciones admin: editor de Apps Script → dropdown de funciones →
> elegir la función → **Run**. Requieren estar en `Config!Heads`.

---

## ✅ Deploy — ahora automático (ya no es manual)

El CI ahora hace **`clasp push` + `clasp deploy --deploymentId`** en cada merge a
`main` → la URL `/exec` (la del equipo) se actualiza sola, **mismo link de
siempre**. Ya no hay que hacer "Versión nueva" a mano. (Secret
`WEBAPP_DEPLOYMENT_ID` configurado.)

> Si alguna vez el equipo "no ve los cambios": es caché del navegador, no del
> deploy → **hard refresh** (Cmd/Ctrl+Shift+R).

## 🟠 Para que funcionen features ya construidas

> Estado a esta sesión: **#5 setupSheets, #10 ClientesInternos y #13 GEMINI_API_KEY
> ya hechos** (confirmado: col 20 escribe, la IA del add-on responde). Pendientes
> de confirmar: #8 DriveFolder, #9 CalendarId, #11 migrate biblioteca, #14 backfill.

| # | Qué | Cómo | Por qué |
|---|-----|------|---------|
| 5 | ✅ **Correr `setupSheets()`** | Editor → `setupSheets` → Run | Crea/migra hojas y columnas (Feriados, Templates, col 18 Confidencialidad, col 19 Contraparte, **col 20 AreaSolicitante**, etc.). **Prerrequisito** del campo "Área solicitante" en tareas: sin la col 20 no se guarda (hay guard anti-corrupción). |
| 6 | **Borrar las 3 plantillas de ejemplo** | Correr `clearSampleTemplates()` | Data sembrada que se ve "inventada". |
| 7 | **Encender el digest diario** | Correr `installDigestTrigger()` | Instala el trigger diario ~8am. **Nota:** consolidé los dos sistemas de digest que existían — ahora cualquiera de los dos installers borra los triggers del otro, así que es imposible que manden doble email. Corré **solo uno**. |
| 8 | **Configurar `Config!DriveFolder`** | Hoja `Config`, key `DriveFolder` = URL/ID de la carpeta raíz de Drive | Necesario para **subir archivos** (Biblioteca y adjuntos de tareas). Los *enlaces* funcionan sin esto. |
| 9 | **Configurar `Config!CalendarId`** | Hoja `Config`, key `CalendarId` = ID del calendario del equipo | Define qué calendario muestra la vista **Calendario**. Si no se setea, usa el primario del usuario. |
| 10 | ✅ **Definir `Config!ClientesInternos`** | Hoja `Config`, key `ClientesInternos` = CSV (ej. `Restaurantes, Finanzas, Tesorería, Monetization, …`) | Lista del eje **"Área solicitante"** (cliente interno) en tareas y biblioteca. Editable sin tocar código. Si está vacía, cae a esos 4 por default. |
| 11 | **Biblioteca: asegurar col 17** | Correr `migrateBiblioDocsSchema()` una vez (o se auto-agrega al crear/editar el primer doc) | El campo "Área solicitante" en documentos vive en la col 17 de `BibliotecaDocs`; `_ensureBiblioDocsSheet` la agrega sola en el primer write, pero correr migrate la asegura ya. |
| 12 | **Activar el Gmail Add-on** | Editor de Apps Script → **Deploy → Test deployments → Install** (te lo instala a vos para probar). Para todo el equipo: Deploy → New deployment → tipo **Add-on**, y pedir a IT/Workspace admin que lo despliegue org-wide a Legal. | El `clasp push` (CI) sube el **código** del add-on, pero Gmail no lo muestra hasta que exista un deployment de tipo add-on. Tras instalar, abrí cualquier correo → ícono de Legal Tracker en la barra lateral derecha de Gmail → "Crear tarea". La primera vez Gmail pide autorizar los scopes nuevos (lectura del correo abierto). |
| 15 | ⚠️ **Poblar la columna de emails en `Equipos`** | Hoja `Equipos`, col **F** (`emails`) = CSV **paralelo** a `members` (col E): mismo orden, mismo largo. La col D (`leaderEmail`) para el líder. | **Prerrequisito de las notificaciones por email** (te-asignaron / te-sumaron / te-mencionaron). El aviso resuelve el email del destinatario por su nombre contra esta columna; si está vacía o desalineada, el aviso **no sale** (silencioso, no rompe nada). Sin esto, las notis quedan solo in-app (la campana). |
| 16 | **(Opcional) Apagar las notificaciones por email** | Hoja `Config`, key `NotificacionesEmail` = `off` | Kill-switch global de los avisos por email, sin tocar código. Cualquier otro valor (o ausente) = encendidas. La campana in-app no se afecta. |

> **Nota logo del add-on:** el `logoUrl` en `appsscript.json` (`addOns.common.logoUrl`) usa la balanza ⚖ de Noto Emoji (a color, visible en claro/oscuro) como placeholder. Reemplazar por el logo real de Legal Tracker / Rappi (URL https pública, PNG/JPEG) cuando esté.

> **Adjuntar correos:** el add-on puede subir los adjuntos del correo a la tarea, pero eso usa el mismo upload a Drive que la app → **requiere `Config!DriveFolder` seteado** (#8). Sin esa carpeta, la tarea se crea igual pero los adjuntos fallan (la card lo avisa). Caps: máx 5 archivos / 15 MB por tarea; inline (firmas/logos) se excluyen solos.

| 13 | ✅ **Habilitar AI en todo (add-on + Contract Intelligence + búsqueda semántica)** | Editor de Apps Script → **Configuración del proyecto** → **Propiedades del script** → agregar `GEMINI_API_KEY` con una clave gratis de [aistudio.google.com](https://aistudio.google.com/app/apikey) | **Una sola key destraba 3 features:** (a) super-fill del Gmail add-on, (b) **Contract Intelligence** — botón "✨ Analizar" en cada PDF de una tarea extrae partes/vigencia/vencimiento/riesgos + crea recordatorios de renovación, (c) **búsqueda semántica** en Biblioteca (botón "✨ IA"). **Sin la key, todo cae a su comportamiento previo — nada se rompe.** Free tier de Gemini aguanta sobrado (ojo: si testeás mucho da 429 "cuota agotada" — se resetea por minuto/día). **Privacidad:** se envía el contenido del correo/contrato/doc a Gemini; validar con la org antes de habilitar para datos legales sensibles. |
| 14 | **(Opcional) Backfill de embeddings de Biblioteca** | Tras setear `GEMINI_API_KEY` (#13), correr `backfillBiblioEmbeddings()` desde el editor (solo head) | La búsqueda semántica necesita un vector por documento. Los docs **nuevos** se embeddan solos al subirlos; este backfill genera los vectores de los docs **ya existentes** de una. Idempotente (no re-procesa los que ya tienen). Sin correrlo, la búsqueda IA solo encuentra docs subidos después de habilitar la key. |

---

## 🔌 Slack — estado real y qué hacer (revisado a fondo)

**Cómo está hoy (verificado en código):**

- El bot es **solo por reacciones de emoji** en mensajes: ⚖️ `:scales:` → crear, ✅ `:white_check_mark:` → cerrar, ⛔ `:no_entry:` → bloquear. **No hay slash commands** (los docs decían que sí — era falso) ni shortcuts.
- **Dos paredes que hoy lo dejan inoperante:**
  1. El cambio a `access: DOMAIN` hace que Google **rechace el POST de Slack** antes de llegar a `doPost` (Slack postea anónimo, sin sesión de dominio).
  2. Aun llegando, las mutaciones (`addTask`/`closeTaskById`/`blockTaskById`) pasan por `Session.getActiveUser()`, que en un POST externo está **vacío** → tiran "No autorizado". El parámetro `slackUser` es cosmético; **no hay mapeo Slack→email**.
- La firma HMAC está **desactivada** (`_SLACK_SIG_ENFORCED = false`) — Apps Script no expone headers en `doPost`.

**Postura segura para el piloto:** dejar el **bot entrante (emojis) APAGADO** (en api.slack.com, no apuntar Event Subscriptions a `/exec`). Como está, o no llega o responde "❌". No vale la pena el riesgo con datos legales.

**Lo que SÍ podemos prender ya (quick win, sin tocar el problema de auth):**

- **Notificaciones salientes** disparadas desde los triggers que **corren como owner** (sí tienen sesión válida): DM *"te asignaron la tarea X"*, *"tu tarea vence hoy/mañana"*, y post al canal del país en create/cerrar/bloquear. Reusan el digest diario que ya existe. Solo necesitan:
  - `SLACK_BOT_TOKEN` (Script Property, `xoxb-…`) con scopes `chat:write`, `im:write` (+ `users:read.email` si mapeamos por email).
  - Un mapeo usuario→Slack (columna en `Equipos` o `users.lookupByEmail` usando el email del roster).
  - *Honrar confidencialidad*: nunca mandar nombres de tareas `restringido`/`confidencial` a un canal compartido.

**Roadmap Slack (priorizado):**

- **P0** — Resolver auth para mutaciones entrantes: Cloud Function proxy que valide la firma y reenvíe con identidad + mapeo Slack→email→roster (preserva `_authorizeTaskWrite`). ~1-2 días. *Hasta esto, el bot entrante no funciona.*
- **P1** — Notificaciones salientes (arriba). Alto valor, no necesita proxy. ~0.5-1 día.
- **P2** — Slash commands `/legal nueva|cerrar|buscar` (requiere P0) + resumen semanal al canal.

**Pendientes manuales Slack:** `SLACK_BOT_TOKEN` y `SLACK_SIGNING_SECRET` como Script Properties; decidir en api.slack.com qué prender (recomendado: solo `chat:write`/`im:write` para salientes, Event Subscriptions OFF).

---

## 🟢 Roadmap post-auditoría (propuestas priorizadas)

Salió de 4 agentes Opus revisando flujos, pantallas, biblioteca y Slack. Ordenado por **valor/esfuerzo**. Lo marcado ✅ ya lo implementé esta sesión (ver abajo).

### Quick wins (≤1h c/u)
- ✅ **Atajos de teclado en el wizard de crear** — hecho (sesión jun-2026): Enter avanza paso desde inputs de texto/fecha, Cmd/Ctrl+Enter avanza/envía. Aplica a tarea y proyecto.
- **Bell de notificaciones en el header** — hoy el inbox (`_NOTIF_RECENT`: reasignaciones, comentarios) está escondido en el menú del avatar. Sacarlo a un ícono con badge en el header. Reusa `edNotifOpen`.
- ✅ **KPIs clickeables en Analytics y Mi equipo** — hecho (sesión jun-2026), también en "Por país". Drillean al tracker filtrado como en los homes.
- ✅ **Biblioteca: fecha + picker de categoría en upload** — verificado: ya estaba resuelto (el modal único de clasificación cubre el upload, y `_bibRelTime(d.fecha)` se muestra en cada card).
- ✅ **Fix copy del tour de HQ** — hecho (sesión jun-2026): el head ya no recibe el bloque de pasos de manager (18 → 15 pasos, sin copy de "tu país" que no aplica).

### Medio (≈medio día – 1 día)
- ✅ **PT-BR en pantallas que quedaron en español** — hecho (jun-2026) para **tracker, Cmd+K, Mi equipo, Analytics, Por país, landing HQ** y **el tour completo** (este último con el patrón `LANG` inline, no `t()`, por ser copy largo de onboarding). Queda solo podar ~182 claves huérfanas de `T_PT` (⚠ antes de podar, auditar los `t(variable)` con enums de data — p. ej. `t(p.status)` en el detalle de proyecto usa claves que el script marca como huérfanas).
- **SLA al crear** — al elegir prioridad, mostrar "SLA objetivo: 2/5/7 días hábiles" y un botón "usar SLA" que setea el deadline (la lógica de días hábiles ya existe). Estandariza fechas para el reporting.
- **Filtro/buscador dentro de Biblioteca** — hoy es una lista plana; con 50+ docs se vuelve inusable. Filtro por categoría/tipo + input de búsqueda (client-side sobre el cache).
- ✅ **Checklists rastreables** — hecho (jun-2026): las líneas "- ítem" de Notas se renderizan como checkboxes con barra "3/7" en el panel (toggle persistido línea-por-línea, optimistic + revert), mini-progreso "✓ 3/7" en la fila del tracker, CTA "Usar →" en cada plantilla y hint en el wizard ("nace con el checklist de N pasos" / "escribiste descripción, no se inserta"). Las plantillas pasaron de decorativas a workflow.
- **"Adjuntar desde Biblioteca" a una tarea** — picker para linkear un doc existente en vez de re-subir (reuso de NDAs/plantillas).
- **Indexar comentarios en la búsqueda** + filtros en el modal (solo documentos / mi país).
- **De-duplicar HQ home vs "Por país"** — son casi la misma tabla. Profundizar una o eliminar la otra del nav.
- **Convergir edición inline + retirar el modal legacy `editOv`** — ⚠ ojo: `editOv`/`openEdit` **NO es código muerto** (se confirmó jun-2026): el panel lo usa para editar campos de tarea y **todo el flujo de editar proyecto** (`openEditProj`) pasa por ese mismo modal. Retirarlo requiere PRIMERO construir la edición inline de prioridad/estado/tipo/etc. en el panel y un editor de proyecto propio. No es una eliminación segura suelta.

### Apuestas grandes
- ✅ **Confidencialidad en Biblioteca** — ya implementada (la nota era vieja): el schema tiene columna `confidencialidad`, `_bibValidateMeta` impide que un specialist marque "confidencial", `_filterBibDocsForRole` filtra server-side por rol+país+confidencialidad, y la búsqueda IA lo respeta (intersecta con la lista filtrada). En jun-2026 se agregó el **badge explícito** (candado + nivel) en cada card. *Pendiente real menor:* el **sharing de Drive** del archivo subido no se ajusta automáticamente al nivel (el filtrado de la app sí; pero alguien con el link directo de Drive lo abre). Evaluar permisos de Drive por nivel antes de subir docs muy sensibles.
- ✅ **@menciones en comentarios → notificación** — hecho (jun-2026): picker `@` en el comentario, email al mencionado + entrada in-app en el bell (con refresco en vivo cada 60s), resaltado de la mención. Mismo punto de despacho (`_notify`) que las notis de asignación/colaborador.
- 🔵 **Biblioteca · rediseño de Plantillas → "Modelos de documentos"** (próximo foco). **Estado actual:**
  - **Plantillas** = *checklists* por tipo de trabajo (hoja `Templates`: `tipoTrabajo | checklist(JSON) | estado | autor`). Al crear una tarea de ese tipo, los pasos se insertan en Notas y se renderizan como checklist con progreso. Flujo: specialist propone (pendiente) → manager/head aprueba. "Usar →" abre el wizard con el tipo puesto.
  - **Documentos** (hoja `BibliotecaDocs`, 17 cols, confidencialidad + búsqueda IA) ya tiene un vocabulario `tipoDocumento` con **'Contrato modelo', 'Minuta', 'Poder', 'Formato/Checklist'** → o sea, los "modelos de documentos" que el equipo imagina **ya viven (a medias) acá**. Hay **solapamiento conceptual** entre las dos pestañas y el nombre "Plantillas" engaña.
  - **Fricción de borrado:** `_deleteTemplateImpl` solo deja a manager/head borrar plantillas aprobadas; un specialist (o head en modo "Ver app como…") solo borra sus propias propuestas *pendientes* → "no puedo eliminar". Las 3 de ejemplo (`Revisión NDA`, `Revisión contractual`, `Derecho de petición`) se quitan con `clearSampleTemplates()` desde el editor.
  - **Plan:** rediseñar la IA de Biblioteca para que "modelos aprobados a la mano" sea lo central y claro. Meta-prompt para diseñar el rediseño en `plan/BIBLIOTECA_MODELOS_PROMPT.md`.
- **Modo "Hoy" del specialist** — próxima tarea + reuniones del día (Calendar) + vence-hoy en una sola vista.
- **Sugerencia de rebalanceo para managers** — cuando alguien está >100% y otro <60%, "sugerir reasignar N tareas" (el scoring ya existe en el home).
- **Duplicar tarea** — legal es repetitivo (mismo NDA, distinta contraparte).
- **Documentos requeridos por tipo de trabajo** + **documentos que vencen** (NDAs, poderes) alimentando el digest.
- **Búsqueda full-text del contenido de los docs** (extraer texto de PDFs al subir).
- **Mobile real** — las tablas por rol usan grid fijo que desborda en celular; fallback a cards en anchos chicos.

---

## ✅ Hecho en la revisión profunda de jun-2026 (no requiere acción tuya)

**Bugs P0 (rompían flujos completos)**
- **Shadowing de `t()`**: tres funciones usaban una variable/parámetro `t` que tapaba la función i18n → TypeError al renderizar. Rompía: el tracker entero si había una tarea "compartida conmigo" visible, la **reasignación masiva** (el modal nunca se montaba) y el **hero de Proyectos**. ⚠ Patrón a vigilar: en este archivo casi todo se llama `function(t)` — si una función usa `t('...')` para i18n, su variable de tarea debe llamarse `tk`.
- **Stats de proyectos por rol**: % de avance, conteos y auto-status se calculaban sobre las tareas filtradas por rol (un specialist veía "100% · Completado" cerrando solo su tarea; cada rol veía un % distinto). Backend ahora computa `taskStats`/`pctDone` sobre TODAS las tareas; cards y detalle los consumen.

**Permisos / seguridad**
- Participante no-responsable ya no puede cancelar el proyecto, cambiar plazo/prioridad/nombre ni reescribir `participantes` (lockout) — solo notas y descripción. UI espejada (`_piCanGovernProject`).
- `semanticSearchBiblioteca` ahora filtra server-side por rol/confidencialidad (antes enumeraba ids de docs confidenciales vía `google.script.run` directo).
- `getTeamMembers` exige allowlist. Escape JS correcto (`escJs`) en los `onclick` con texto libre (nombres/clientes — un apóstrofo rompía el handler; un valor malicioso en la hoja ejecutaba JS).

**Tracker / bulk / búsqueda**
- La selección bulk se intersecta con las filas visibles (cambiar filtro/búsqueda/país ya no deja la bulkbar mutando tareas invisibles). Reasignación masiva con double-submit guard, CTA en loading y cierre al terminar. Esc despacha al close correcto en `crHost`; cmdk se cierra con Esc siempre; atajo N no pisa wizards abiertos. Filtro "Compartidas conmigo" funciona para specialist/manager. Filtro "Cerradas" incluye Canceladas (chip = filas). Pick de búsqueda de otro país mueve el drill. Foco del buscador sobrevive al re-render. `edUSubmit` con double-submit guard. Export Excel respeta el filtro de cliente. Pill de fila dice "On hold" (consistente con chips/bulkbar).

**Homes / Analytics**
- KPI "Cerradas (mes)" siempre daba 0 (leía un campo inexistente sobre la colección equivocada) — ahora cuenta el Historial real. KPI duplicado "En tiempo" → "Vencidas" accionable. "SLA promedio LATAM" unificado al agregado del backend (3 vistas daban 3 números). `taskOverdueBySLA` usa `slaState` del backend (con feriados). Sparklines con <2 puntos ya no rompen el SVG. Home manager: KPIs drillean filtrado y el lookup de país es normalizado.

**Datos**
- Deadlines de tareas se escriben como `Date` real (`_deadlineToCell`) en los 3 paths de escritura — como string la tarea podía quedar sin ETA/SLA/digest según el locale. Gmail add-on: dedupe escanea Historial desde la fila 4 (layout real).
- Wizard de proyecto: el borrador restaurado ya no pisa el prefill de país/líder.

**Deuda que quedó anotada (no resuelta en esta sesión)**
- **i18n masivo**: Mi equipo, Analytics, Por país, landing HQ del tracker, el tour completo, la bulkbar, el cmdk y los empty-states del tracker siguen con literales hardcodeados sin `t()` (el gate da 0 missing porque esas vistas no llaman `t()` en absoluto). Es el gap #1 para Brasil. Además hay ~178 claves huérfanas en `T_PT` para podar.
- Hoja `Activity` crece sin cota (id "best-effort" documentado); decidir política de retención.
- Aging buckets de Analytics usan días calendario (el resto del sistema usa hábiles) — documentar o unificar.
- HQ home vs "Por país": siguen ~80% solapadas; decidir si se unifican.

## ✅ Hecho en sesión anterior (no requiere acción tuya)

**Seguridad / privacidad**
- Fuga tapada: el **PDF mensual** filtraba data sin aplicar rol → un manager veía tareas confidenciales de su país. Ahora aplica `filterTasksForRole`.
- `access: ANYONE_ANONYMOUS` → `DOMAIN` (restringe al dominio corporativo; mata la superficie anónima de Slack).
- Guard anti-drift: `updateTaskField/Fields` ya no escriben col 18/19 si la hoja no las tiene.

**Bugs**
- **P0**: `_readTaskById` no devolvía `status` → los auto-promote a "En curso" (al editar/comentar una Pendiente) **nunca disparaban** y el activity log guardaba "valor anterior" vacío. Arreglado (revive ambos + audit trail real).
- **Buscador**: ahora encuentra **documentos de Biblioteca** (antes solo adjuntos a tareas/proyectos — por eso no aparecía el "Certificado…") y **tareas cerradas** (Historial).
- Comentar una Pendiente ahora refleja el paso a "En curso" en la UI.

**UX / consistencia**
- CSS faltante de superficies completas (Cmd+K, landing HQ, analytics HQ/manager, avatares de comentarios) — ya renderizan con estilo.
- Esc + focus-trap para Notificaciones y Help (Help no cerraba al reabrir).
- Vocabulario de riesgo unificado (Legal/Reputacional/Negocio, reconoce legacy).
- Digest: imposible doble-trigger + guard de fin de semana.
- Cierre individual exige resumen ≥5 chars (igual que el bulk).
- Home specialist: barra "cierre promedio" con width fijo 60% (engañosa) → punto + valor real.
- i18n: 0 missing en `check-i18n` (eran 4); `_relativeAgo` bilingüe; toasts `warn` en amarillo; empty-state semanal del calendario; guard de tamaño de upload antes de decodificar.
</content>
</invoke>
