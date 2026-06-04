# Pendientes manuales · Legal Tracker

Cosas que **no se pueden automatizar desde el código** y hay que hacer a mano
(editor de Apps Script, hoja de Google, consola de Slack/Google), más el
**roadmap priorizado** que salió de la auditoría de producto/UX con agentes.

> Para correr funciones admin: editor de Apps Script → dropdown de funciones →
> elegir la función → **Run**. Requieren estar en `Config!Heads`.

---

## 🔴 Para desplegar lo de esta sesión (en orden)

| # | Qué | Cómo | Por qué |
|---|-----|------|---------|
| 1 | **Mergear la rama a `main`** | PR de `claude/gifted-rubin-byMOq` → merge | La rama quedó adelante de `main`. El push a `main` es lo que dispara `clasp` (deploy). |
| 2 | **Publicar producción `/exec`** | Editor → Deploy → Manage deployments → **New version** | El deploy automático solo actualiza `/dev`. La URL `/exec` (la que usa el equipo) requiere "New version" manual. **Sin esto, nada de lo nuevo llega a prod.** |
| 3 | **Verificar acceso por dominio** | Abrir `/dev` logueado con `@rappi.com` | Cambié `access` de `ANYONE_ANONYMOUS` → `DOMAIN`. Confirmá que entrás bien (la cuenta dueña del script debe ser `@rappi.com`). Si pide re-autorizar, aceptá. |
| 4 | **Re-autorizar scopes** | Tras el deploy, correr cualquier función desde el editor y aceptar permisos | Scopes en uso: `spreadsheets`, `drive`, `send_mail` (digest), `calendar.readonly`, `external_request`. Sin re-auth, digest/calendario/upload fallan. |

## 🟠 Para que funcionen features ya construidas

| # | Qué | Cómo | Por qué |
|---|-----|------|---------|
| 5 | **Correr `setupSheets()`** | Editor → `setupSheets` → Run | Crea/migra hojas y columnas (Feriados, Templates, col 18 Confidencialidad, col 19 Contraparte, **col 20 AreaSolicitante**, etc.). **Prerrequisito** del campo "Área solicitante" en tareas: sin la col 20 no se guarda (hay guard anti-corrupción). |
| 6 | **Borrar las 3 plantillas de ejemplo** | Correr `clearSampleTemplates()` | Data sembrada que se ve "inventada". |
| 7 | **Encender el digest diario** | Correr `installDigestTrigger()` | Instala el trigger diario ~8am. **Nota:** consolidé los dos sistemas de digest que existían — ahora cualquiera de los dos installers borra los triggers del otro, así que es imposible que manden doble email. Corré **solo uno**. |
| 8 | **Configurar `Config!DriveFolder`** | Hoja `Config`, key `DriveFolder` = URL/ID de la carpeta raíz de Drive | Necesario para **subir archivos** (Biblioteca y adjuntos de tareas). Los *enlaces* funcionan sin esto. |
| 9 | **Configurar `Config!CalendarId`** | Hoja `Config`, key `CalendarId` = ID del calendario del equipo | Define qué calendario muestra la vista **Calendario**. Si no se setea, usa el primario del usuario. |
| 10 | **Definir `Config!ClientesInternos`** | Hoja `Config`, key `ClientesInternos` = CSV (ej. `Restaurantes, Finanzas, Tesorería, Monetization, …`) | Lista del eje **"Área solicitante"** (cliente interno) en tareas y biblioteca. Editable sin tocar código. Si está vacía, cae a esos 4 por default. |
| 11 | **Biblioteca: asegurar col 17** | Correr `migrateBiblioDocsSchema()` una vez (o se auto-agrega al crear/editar el primer doc) | El campo "Área solicitante" en documentos vive en la col 17 de `BibliotecaDocs`; `_ensureBiblioDocsSheet` la agrega sola en el primer write, pero correr migrate la asegura ya. |
| 12 | **Activar el Gmail Add-on** | Editor de Apps Script → **Deploy → Test deployments → Install** (te lo instala a vos para probar). Para todo el equipo: Deploy → New deployment → tipo **Add-on**, y pedir a IT/Workspace admin que lo despliegue org-wide a Legal. | El `clasp push` (CI) sube el **código** del add-on, pero Gmail no lo muestra hasta que exista un deployment de tipo add-on. Tras instalar, abrí cualquier correo → ícono de Legal Tracker en la barra lateral derecha de Gmail → "Crear tarea". La primera vez Gmail pide autorizar los scopes nuevos (lectura del correo abierto). |

> **Nota logo del add-on:** el `logoUrl` en `appsscript.json` (`addOns.common.logoUrl`) usa la balanza ⚖ de Noto Emoji (a color, visible en claro/oscuro) como placeholder. Reemplazar por el logo real de Legal Tracker / Rappi (URL https pública, PNG/JPEG) cuando esté.

> **Adjuntar correos:** el add-on puede subir los adjuntos del correo a la tarea, pero eso usa el mismo upload a Drive que la app → **requiere `Config!DriveFolder` seteado** (#8). Sin esa carpeta, la tarea se crea igual pero los adjuntos fallan (la card lo avisa). Caps: máx 5 archivos / 15 MB por tarea; inline (firmas/logos) se excluyen solos.

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
- **Atajos de teclado en el wizard de crear** — Enter para avanzar paso, Cmd+Enter para enviar. Hoy hay que ir al mouse en cada tarea.
- **Bell de notificaciones en el header** — hoy el inbox (`_NOTIF_RECENT`: reasignaciones, comentarios) está escondido en el menú del avatar. Sacarlo a un ícono con badge en el header. Reusa `edNotifOpen`.
- **KPIs clickeables en Analytics y Mi equipo** — en los homes los KPIs drillean al tracker filtrado; en Analytics/Mi equipo no. Igualarlo.
- **Biblioteca: mostrar la fecha** (se captura pero no se muestra) y **picker de categoría en upload de archivo** (hoy sube con categoría vacía).
- **Fix copy del tour de HQ** — dice "6 pasos" pero renderiza más (mezcla bloque de manager).

### Medio (≈medio día – 1 día)
- **PT-BR en pantallas que quedaron en español** — el toggle traduce sidebar/home, pero **Mi equipo, Analytics, Por país, landing HQ del Tracker, el panel de tarea, el flujo avanzar/cerrar/bloquear y el tour** tienen literales hardcodeados sin `t()`. Es el gap #1 para el equipo de Brasil. Mecánico pero amplio (envolver en `t()` + sumar keys a `T_PT`). *(Empecé por el panel/flujo — ver abajo.)*
- **SLA al crear** — al elegir prioridad, mostrar "SLA objetivo: 2/5/7 días hábiles" y un botón "usar SLA" que setea el deadline (la lógica de días hábiles ya existe). Estandariza fechas para el reporting.
- **Filtro/buscador dentro de Biblioteca** — hoy es una lista plana; con 50+ docs se vuelve inusable. Filtro por categoría/tipo + input de búsqueda (client-side sobre el cache).
- **Checklists rastreables** — los checklists de templates hoy se aplastan a texto en Notas. Renderizarlos como checkboxes reales con barra "3/7 hecho". Convierte los templates de decorativos en workflow. (El más alto valor según el agente.)
- **"Adjuntar desde Biblioteca" a una tarea** — picker para linkear un doc existente en vez de re-subir (reuso de NDAs/plantillas).
- **Indexar comentarios en la búsqueda** + filtros en el modal (solo documentos / mi país).
- **De-duplicar HQ home vs "Por país"** — son casi la misma tabla. Profundizar una o eliminar la otra del nav.
- **Convergir edición inline** — que prioridad/estado/tipo se editen inline en el panel (hoy abren el modal legacy). Permite retirar el modal viejo del todo.

### Apuestas grandes
- **Confidencialidad en Biblioteca** — los docs de Biblioteca **no tienen nivel de confidencialidad** (las tareas sí). Hueco de privacidad real: agregar columna `conf` + filtrado server-side por rol + sharing de Drive acorde. Importante antes de meter docs sensibles.
- **@menciones en comentarios** → notificación (reusa el roster + el badge de notificaciones).
- **Modo "Hoy" del specialist** — próxima tarea + reuniones del día (Calendar) + vence-hoy en una sola vista.
- **Sugerencia de rebalanceo para managers** — cuando alguien está >100% y otro <60%, "sugerir reasignar N tareas" (el scoring ya existe en el home).
- **Duplicar tarea** — legal es repetitivo (mismo NDA, distinta contraparte).
- **Documentos requeridos por tipo de trabajo** + **documentos que vencen** (NDAs, poderes) alimentando el digest.
- **Búsqueda full-text del contenido de los docs** (extraer texto de PDFs al subir).
- **Mobile real** — las tablas por rol usan grid fijo que desborda en celular; fallback a cards en anchos chicos.

---

## ✅ Hecho en esta sesión (no requiere acción tuya)

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
