# Meta-prompt · Rediseñar Biblioteca/Plantillas → "Modelos de documentos"

> **Cómo usar esto:** copiá el bloque de "EL PROMPT" abajo en claude.ai (ideal en
> un Project con los archivos del repo en el knowledge — ver "Qué adjuntar").
> Claude te va a devolver (a) un diagnóstico y (b) **un prompt de implementación
> por fases, listo para pegarle a Claude Code** y ejecutar de verdad. No le pidas
> que escriba el código él: su entregable es el *prompt* + el diseño.

---

## EL PROMPT (copiar desde acá) ⬇️

Sos un **diseñador de producto senior especializado en herramientas internas para
equipos legales**. Vas a rediseñar una pieza confusa de **MyDash / Legal Tracker**
(web app del equipo Global Legal de Rappi+) y devolver un **prompt de
implementación por fases** que otro agente (Claude Code) va a ejecutar sobre el
repo. Tu entregable NO es código: es el diagnóstico + el diseño + ese prompt.

### El problema en una frase

La sección **Biblioteca** tiene dos pestañas —**Plantillas** y **Documentos**—
que se solapan, confunden, y no entregan lo que el equipo realmente necesita:
**tener los modelos de documentos aprobados a la mano** (NDA modelo, poder,
minuta, contrato tipo, política…). Hoy "Plantillas" no es eso, y nadie le ve el
sentido. Hay que rediseñarlo para que "modelos aprobados, encontrables y
reutilizables" sea lo central y obvio.

### Estado actual (verificado en código — no asumas otra cosa)

**Pestaña "Plantillas"** — son **checklists por tipo de trabajo**, NO documentos:
- Datos: hoja `Templates`, columnas `tipoTrabajo | checklist(JSON: array de strings) | estado | autor`. `estado ∈ {aprobada, pendiente}`.
- Para qué sirve hoy: al **crear una tarea** de ese `tipoTrabajo` (con descripción vacía), el checklist se inserta en las Notas como líneas `- ítem`, que el panel de la tarea renderiza como **checklist con progreso** ("3/7 hecho"). Hay un botón **"Usar →"** que abre el wizard de crear con el tipo preseleccionado.
- Flujo de gobierno: cualquiera **propone** (un specialist crea → queda `pendiente`); **manager/head aprueba** (`aprobada`). El wizard de crear solo usa las aprobadas.
- **Fricción real reportada:** "no puedo eliminar plantillas". Causa: el borrado solo deja a manager/head borrar las **aprobadas**; un specialist (o un head en modo "Ver app como specialist") solo puede borrar **sus propias propuestas pendientes**. Hay además 3 plantillas **de ejemplo** sembradas que ensucian la vista.

**Pestaña "Documentos"** (`BibliotecaDocs`) — esto SÍ son documentos, y ya es lo
más cercano a "modelos aprobados a la mano":
- Datos: hoja de 17 columnas — `id, nombre, tipo(link/file), url, tipoDocumento, areaTrabajo, pais, confidencialidad, tags, autor, autorEmail, fecha, vigente, notas, actualizadoPor, fechaActualizado, areaSolicitante`.
- `tipoDocumento` (vocabulario controlado) ya incluye: **'Contrato modelo', 'Política', 'Dictamen', 'Precedente', 'Normativa', 'Poder', 'Minuta', 'Guía / Playbook', 'Formato / Checklist', 'Otro'**.
- Archivos en Drive **o** links externos; clasificados por tipo/área/país; **confidencialidad filtrada server-side** por rol (estándar/restringido/confidencial); **búsqueda semántica con IA** (Gemini); filtros por faceta; tags; campo `vigente` (sí/no) para marcar reemplazados.

**Conclusión que tenés que resolver:** "modelos de documentos aprobados" hoy está
**partido y mal nombrado** entre las dos pestañas. "Plantillas" (checklists) y
"Documentos" (que incluye 'Contrato modelo') compiten por el mismo lugar mental.
El equipo busca un repositorio de **modelos** y no lo encuentra claro.

### Roles (importante para gobierno/permisos)

- **specialist** — usa modelos, propone, sube/edita los propios. No aprueba ni borra lo ajeno-aprobado.
- **manager** — todo lo del specialist + aprueba/edita/borra en su país.
- **head** (Global) — todo, cross-país. Tiene un switcher "Ver app como…" (cosmético, client-side).

### Restricciones técnicas (tu diseño DEBE caber acá)

- **Google Apps Script + Google Sheets como DB.** Un solo HTML por `HtmlService`; **vanilla JS, sin framework ni bundler**; CSS propio con tokens dark/light. **Nada** de React/Tailwind/librerías nuevas.
- El front renderiza strings HTML desde funciones JS (no hay componentes). Todo texto visible pasa por `t('…')` con diccionario ES↔PT-BR (cada string nuevo necesita su traducción; hay un gate de CI).
- **Latencia:** cada mutación viaja a Apps Script (~1–3 s); patrón optimista + reconciliación. El snapshot completo llega al cargar (sin paginación server-side).
- **Confidencialidad y permisos son server-side** (la UI solo los espeja). Drive: el archivo vive en una carpeta; hoy el *sharing de Drive* del archivo no se ajusta solo al nivel de confidencialidad (gap conocido).
- **Migraciones de esquema** se hacen con cuidado (guards anti-drift; columnas opcionales que el backend solo escribe si la hoja ya las tiene). Cambiar el modelo de datos implica una migración one-shot idempotente corrida por un head.
- Cambios chicos y atómicos; se mergea por PRs squash que disparan deploy.

### Tu tarea (en este orden)

1. **Diagnóstico (corto):** ¿qué está roto conceptualmente en la IA de Biblioteca?
   ¿"Plantillas" (checklists) debería desaparecer, fusionarse, renombrarse, o
   moverse a otro lado (p. ej. el checklist como propiedad del *tipo de trabajo*
   o del wizard, liberando "Biblioteca" para que sea puramente modelos+recursos)?
   Decidí con argumentos, no con gustos.
2. **El modelo mental ideal:** definí qué es un "Modelo" como objeto de primera
   clase (¿tiene dueño? ¿versión? ¿estado aprobado/borrador/deprecado? ¿país?
   ¿confidencialidad? ¿formato/archivo? ¿variables a completar? ¿"usar este
   modelo" = duplicar a una tarea / generar un borrador / descargar?). Pensá el
   ciclo de vida completo: proponer → aprobar → usar → versionar → deprecar.
3. **Flujos clave** (descritos paso a paso, con copy final ES + PT-BR):
   - Encontrar el modelo correcto rápido (búsqueda/facetas/“lo más usado”).
   - "Usar un modelo" (la acción estrella — definí qué hace exactamente).
   - Proponer/aprobar/versionar/deprecar un modelo, con quién puede qué.
   - Resolver la fricción de borrado de forma predecible y sin sorpresas.
   - Qué pasa con los checklists actuales (no romper la feature que ya anda).
4. **Aprovechá IA donde sume de verdad** (ya hay Gemini integrado): p. ej.
   sugerir el modelo adecuado para una tarea, autocompletar variables del modelo
   desde el contexto de la tarea, o clasificar/extraer metadatos al subir. Sin
   forzarlo donde no aporta.
5. **El entregable final:** un **prompt de implementación por fases para Claude
   Code**, con:
   - **FASE 0** de investigación read-only (que Claude Code confirme anclas reales en el repo antes de tocar nada) y **STOP GATES** entre fases.
   - Cambios **atómicos** (un commit por pieza), **backend antes que frontend**.
   - La **migración de datos** explícita si cambia el esquema (idempotente, corrida por head), y qué hacer con la data existente (Templates + BibliotecaDocs).
   - **i18n** (claves nuevas con su PT), **confidencialidad** respetada server-side, y **degradación limpia** si falta config (Drive/Gemini).
   - Qué **NO** hacer (scope creep), y qué dejar para después.

### Reglas

- Cada decisión anclada a un principio (Nielsen, leyes de UX, patrones de
  herramientas tipo Notion/Linear/iManage/NetDocuments) — no "me parece".
- Distinguí **quick wins** (≤1 día) de **apuestas** (varios días). Da una ruta
  incremental: qué entrega valor primero sin esperar el rediseño completo.
- No propongas cambiar el stack ni un big-bang que rompa lo que ya funciona
  (los checklists insertados en tareas ya andan; la confidencialidad y la
  búsqueda IA de Documentos también).
- El copy es parte del diseño: cuando propongas texto, dalo final y en ES + PT.
- Si algo del estado actual ya está bien, decilo (no inventes para llenar).

Arrancá por el **diagnóstico + el modelo mental ideal de "Modelo"**; después los
flujos; y cerrá con el **prompt de implementación por fases para Claude Code**.

---

## Qué adjuntar (en claude.ai)

| # | Archivo / fragmento | Por qué |
|---|---------|---------|
| 1 | `frontend/Dashboard.js.html` (al menos las funciones `_rEdBibPlantillas`, `_rEdBibDocs`, `_bibModalOpen`, `edPltUseTemplate`, `edPltDelete`, y el wizard de crear `_crRenderStep1/2`) | Toda la UI de Biblioteca + cómo el checklist entra a la tarea. |
| 2 | `frontend/Dashboard.css.html` | Tokens y componentes existentes (`bib-*`, `pa-*`) para proponer con lo que ya hay. |
| 3 | Sección **BIBLIOTECA · DOCUMENTOS** y **Templates** de `backend/codigo.gs` (funciones `getBibliotecaDocs`, `_filterBibDocsForRole`, `readTemplates`, `saveTemplate`, `deleteTemplate`, `_bibValidateMeta`) | El modelo de datos real, vocabularios y reglas de confidencialidad/permiso. |
| 4 | `README.md` + `PENDIENTES.md` (la sección "Biblioteca · rediseño de Plantillas") | Contexto de producto + lo ya decidido (no re-proponer). |
| 5 | `backend/ai.gs` *(opcional)* | Si va a apoyarse en la IA (búsqueda semántica / extracción). |

**No adjuntar:** el resto del backend (telemetría, digest, calendario) — quema
contexto y no toca esto.

**Tips:**
- Subí **2–4 screenshots** de la Biblioteca actual (las dos pestañas) — el código
  no muestra densidad ni el desorden visual real.
- Pedile el diseño primero y el prompt al final, en mensajes separados, para
  poder iterar el modelo mental antes de "congelarlo" en el prompt de ejecución.

---

## Mientras tanto (acciones manuales que ya podés hacer)

- Limpiar las plantillas de ejemplo: editor de Apps Script → correr
  `clearSampleTemplates()` (head). Borra `Revisión NDA`, `Revisión contractual`,
  `Derecho de petición`.
- Si "no podés eliminar" una plantilla aprobada: es por permiso — hacelo como
  manager/head **sin** el demo-switcher en "specialist".
