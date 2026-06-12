# Auditoría pre-lanzamiento — MyDash / Legal Tracker

> **Cómo usar este documento** (para la sesión de Claude que lo ejecute):
> Sos el ORQUESTADOR. Lanzá **7 agentes en paralelo** (read-only), cada uno con la
> CARTA MAESTRA completa + UNA de las 7 pistas. Cuando vuelvan, consolidá en UN solo
> informe: veredicto ejecutivo → hallazgos P0→P3 deduplicados (con evidencia) →
> "qué está bien, no tocar" → checklist de lanzamiento → plan priorizado. No edites
> código ni commitees durante la auditoría; el informe es el entregable. Después el
> usuario elige qué atacar y se ejecuta en olas.

---

## CARTA MAESTRA (contexto + metodología — va completa en el prompt de CADA agente)

### Rol y postura

Sos staff engineer + diseñador de producto haciendo una auditoría PRE-LANZAMIENTO
de MyDash / Legal Tracker, días antes de abrirlo a los equipos legales de varios
países de Rappi+. Tu trabajo NO es elogiar: es encontrar lo que está roto, lo que
miente, lo que confunde y lo que falta — con evidencia — y proponer el arreglo.
Asumí que algo importante está mal aunque "se vea bien".

### Contexto del proyecto (no lo redescubras)

- **Stack**: Google Apps Script V8 (`backend/*.gs`) + Google Sheets como DB + UNA
  sola UI HTML servida por HtmlService (`frontend/Dashboard.js.html`, vanilla JS sin
  bundler); i18n en `frontend/I18n.js.html` (`t()` + diccionario `T_PT`, ES default
  ↔ PT-BR); CSS en `Dashboard.css.html`. Deploy por clasp + GitHub Actions al
  mergear a `main`.
- **Núcleo**: `codigo.gs` (auth, CRUD, cache, digests, catálogo), `gmailAddon.gs`,
  `ai.gs`, `admin.gs`. Roles: specialist/manager/head vía `determineRole()`
  (Config!Heads CSV → head; `user.isLeader` → manager; si no → specialist).
- **Spine de datos**: `getTrackerData()` → `_buildViewForRole()` (arma `countries[]`
  con `.code/.leader/.specialists` y `team[]`) → `_getEditorialDataImpl()` enriquece
  (`member.load/capacity/overdue/blocked/isLead/blockedDays`; `countries[].open/
  overdue/slaPct/trend`) → devuelve el objeto `D` que consume el frontend
  (`D.tasks, D.team, D.countries, D.projects, D.historial, D._role, D.slaLimits,
  D.today…`).
- **Convenciones que DEBEN cumplirse** (violación = hallazgo): toda escritura pasa
  por `_safeMutation()` (lock + invalida cache + envelope `{success}`); celdas
  saneadas con `_sanitizeRow`/`_sanitizeCell`; autorización server-side con
  `_authorize{Task,Project,Colaboradores}Write` ESPEJADA en la UI (no mostrar
  botones que el backend rechaza); SLA centralizado en `SLA_LIMITS` (server) →
  `data.slaLimits` → `_slaLimit()` (cliente); columnas opcionales (tareas 17–22,
  proyectos 16–17) sólo se escriben si `lc >= TASK_*_COL`; el demo-switcher es
  filtrado COSMÉTICO del cliente, NO seguridad; i18n: `t()` sólo en UI estática,
  NUNCA en valores de data.
- **Semántica que debe seguir coherente en TODAS las vistas**: "Vencida" = tarde Y
  accionable (excluye Listo/Cancelado/Bloqueado) vía `_isOverdueTask()`; "On hold"
  pausa el reloj (sale de Vencidas/Hoy/Semana/SLA) y arranca "bloqueada hace Nd"
  (`member.blockedDays` / col 22 `BlockedSince`).
- **DOS GOTCHAS**: (1) `codigo.gs` tiene un caracter de control → grep/ripgrep dan
  "No matches" FALSOS; buscá con `grep -a`, la herramienta Read, o Python
  `errors='replace'`. (2) el working tree se desincroniza solo → antes de
  leer/editar: `git log -1` + confirmá un símbolo reciente
  (`grep -c blockedSince backend/codigo.gs` debe dar >0).
- **Gates** (corrélos, no asumas): `node --check` sobre copias `.js` de cada
  archivo (sacá el wrapper `<script>` con `sed '1d;$d'`);
  `node scripts/check-i18n.js` DEBE dar "Missing in T_PT: 0".
- **Deuda YA conocida** (partí de acá, no la "descubras"): `PENDIENTES.md`
  (migraciones a correr: `setupSheets`, `clearSampleTemplates`,
  `migrarColaboradores`, `migrarBlockedSince`, `backfillBiblioEmbeddings`); gap de
  i18n masivo (vistas enteras hardcoded ES — el gate da 0 porque no llaman `t()` en
  absoluto); claves huérfanas en `T_PT`; hoja Activity sin cota; config por país
  (Equipos: emails col F, slackChannel col G; Feriados); Slack pendiente de SecOps;
  sólo CO tiene data real.

### Metodología (acá se gana o se pierde la auditoría — no negociable)

1. **EVIDENCIA O NO EXISTE.** Cada afirmación anclada a file:line que LEÍSTE ahora,
   no de memoria. Si no lo verificaste, marcá "a confirmar", no lo afirmes.
2. **TRAZÁ LA DATA PUNTA A PUNTA**: columna del sheet → quién la lee →
   transformación → propiedad de `D` → render. Cazá: campos que la UI CONSUME pero
   el backend nunca PRODUCE (undefined en runtime), campos stale, y guards de
   columna opcional faltantes.
3. **DISTINGUÍ BUG DE DATA-DEMO.** Mucho "raro" es data sembrada (sólo CO se
   mueve). No reportes eso como bug; SÍ reportá lógica que se rompe con esa data.
4. **CLASIFICÁ cada hallazgo.** Prioridad: P0 (rompe función / corrompe-pierde
   data / agujero de permisos-confidencialidad) · P1 (cálculo incorrecto /
   incoherencia entre vistas / regla de rol no espejada) · P2
   (UX/empty-state/edge/perf) · P3 (propuesta de diseño). Confianza: confirmado /
   sospechado (por qué) / opinión.
5. **PENSÁ TRANSVERSAL.** El hallazgo valioso no es el lint de superficie: es la
   semántica que diverge entre dos vistas, el campo filtrado distinto en backend
   que en UI, el predicado duplicado que ya divergió. Priorizá esos.
6. **REVISÁ, NO ARREGLES en esta pasada.** Salida = diagnóstico. No edites salvo
   que se pida. Localizá por nombre de función, nunca por línea.

### Contrato de salida (de cada agente)

- VEREDICTO de tu pista (3–5 líneas).
- HALLAZGOS por prioridad: título · evidencia (file:line) · impacto (qué sufre el
  usuario) · arreglo propuesto (1–3 líneas) · confianza.
- LO QUE ESTÁ BIEN — mantener (honesto: qué NO tocar).
- Lo que quedó "a confirmar" y cómo confirmarlo.

### Guardrails

Respetá los gotchas; corré los gates antes de afirmar algo de sintaxis/i18n; no
inventes nombres de funciones (verificá con `grep -a`/Read); no toques `main`; sin
commits durante la auditoría.

---

## LAS 7 PISTAS (una por agente, en paralelo)

1. **Contrato de datos backend↔frontend.** Cada propiedad de `D` y de
   `tasks/team/countries/projects/historial`: producida vs consumida. Cazá
   consumido-no-producido (undefined en runtime), guards de columna opcional, y que
   `filterTasksForRole` scope-ee sin **fugar ni sobre-ocultar**, y que
   `data.slaLimits`/`_slaLimit` no diverjan del server.

2. **Correctitud funcional E2E por feature.** Enumerá: wizard crear tarea/proyecto,
   filtros y vistas del tracker, panel + edición inline, bulk, reasignación,
   proyectos, biblioteca, recursos/integraciones, calendario, digests, Gmail
   add-on, IA, analytics/mi equipo/por país. Por cada una: ¿el write usa
   `_safeMutation`+authorize+sanitize? ¿el read refleja el write? ¿hay estados que
   renderizan mal (familia On-hold/Vencida)?

3. **Permisos, confidencialidad y seguridad.** Cada `_authorize*` espejado en UI;
   el modelo `estandar/restringido/confidencial` enforced en backend **y** no
   fugado en payloads/cards; el demo-switcher cosmético (¿alguna vista asume que
   esconde data?); **XSS**: ¿todo lo interpolado al HTML pasa por `esc()`? Cazá
   interpolaciones de data de usuario sin escapar.

4. **i18n / readiness Brasil.** Inventario de funciones de render que NO llaman
   `t()` (Mi equipo, Analytics, Por país, landing HQ, tour, bulkbar, cmdk,
   empty-states); inconsistencia LANG-ternario vs `t()`; claves huérfanas en
   `T_PT`. Entregá el mapa de "qué falta traducir para abrir Brasil".

5. **UX / diseño y coherencia.** Recorré las vistas por rol: vocabulario que
   significa cosas distintas en dos lados, redundancia, empty-states que mienten,
   jerarquía de la info, responsive (¿sirve en pantalla chica?), accesibilidad
   básica. Proponé, no sólo señales.

6. **Robustez / edge / performance.** Data vacía, columnas faltantes, fallos de red
   en `google.script.run`, invalidación de cache, fechas/locale (Bogotá TZ,
   deadlines como Date), límites del add-on (30s, 5/15MB), 429 de Gemini, Activity
   sin cota. **¿Qué pasa el día que un país tenga 5.000 tareas?**

7. **Rollout multi-país.** Qué se rompe/queda vacío cuando entra el país N+1:
   Equipos (emails, slackChannel), Feriados por país (SLA en días hábiles),
   data-demo que parece real, el tour, y los conteos/labels que asumen "sólo CO
   tiene data". Entregá el **runbook de "dar de alta un país"**.

---

## Consolidación (la hace el orquestador, no los agentes)

- **VEREDICTO EJECUTIVO** (5–8 líneas): ¿listo para abrir a otros países? Los 3
  riesgos mayores. Un % honesto de "qué tan sólido lo siento".
- **HALLAZGOS P0→P3** deduplicados entre pistas (si dos agentes vieron lo mismo,
  una sola entrada con doble evidencia).
- **LO QUE ESTÁ BIEN — no tocar.**
- **CHECKLIST DE LANZAMIENTO**: migraciones, config por país, data-demo a limpiar.
- **PLAN PRIORIZADO** en olas ejecutables + **LA ÚNICA SIGUIENTE ACCIÓN** de mayor
  leverage.
