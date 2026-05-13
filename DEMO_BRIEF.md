# Legal Tracker — Demo Brief

> Doc para preparar el demo a stakeholders. Incluye estado del producto, tour de features, script de 15 min, wow moments, weak spots y Q&A. Para usar con Claude.ai en sesión de review.

---

## 1. TL;DR para el demo

**Producto**: Legal Tracker es la herramienta interna del equipo Global Legal de Rappi+ para hacer seguimiento de tareas legales por país, líder y prioridad. Reemplaza spreadsheets manuales por una webapp con auth, roles, analytics y workflow.

**Audiencia del demo**: probablemente VP Legal, Head de Tax/Compliance, o stakeholder operativo. Tienen 15 min y quieren ver:
1. Que el equipo va a usarlo (no es otro tool muerto)
2. Que aporta visibility real (puedo medir cosas que antes no podía)
3. Que escala (Rappi+ tiene equipos en CO, MX, BR, AR, CL, PE...)
4. Que cuesta lo que cuesta hacer

**One-liner que cierra**: *"Un specialist abre la app a las 9 am y ya sabe qué cerrar hoy. Un manager ve cómo viene su equipo en 10 segundos. Un VP ve LATAM en un vistazo. Todo conectado a Slack, sin que nadie tenga que tocar Excel."*

---

## 2. Estado actual (v3.6 · Collaboration & Polish)

**Pre-piloto / validación interna**: equipo core en Colombia usando la app desde 4/5/2026 para validar flujo y data; rollout amplio (más países, más roles) aún no decidido. Web app interna con auth Google SSO, deployada vía clasp + GitHub Actions (cero touch para shippear).

**Stack invisible a usuarios**: Google Apps Script + Sheets como BD. Por qué importa al stakeholder: **sin infra extra, sin licencias, sin servidores**. Costo operativo cercano a cero. Toda la data vive en el spreadsheet del equipo.

**Roles soportados**:
- **Specialist** (operativo, ej. Juan en Bogotá) — el que ejecuta tareas
- **Manager** (líder de país, ej. María en MX) — coordina el equipo
- **HQ / Head** (VP o líder LATAM) — visión global

**Features highlight v3.6**:
1. Cmd+K búsqueda global (tasks + projects + **documents**)
2. Hilo de **comentarios** por tarea (audit trail + colaboración)
3. **Documents** auto-clasificados en Drive por TipoTrabajo / País / Proyecto
4. **Confidentiality levels** con filtrado server-side por rol
5. Analytics por rol (specialist scorecard, manager team health, HQ countries comparison)
6. **Full-screen task detail** con edit inline + bulk actions + reassign modal
7. UI completamente en inglés (data en sheet sigue en español, capa de display layer)
8. Atajos de teclado documentados (`?` muestra el modal de shortcuts)
9. Responsive (desktop / tablet collapsed sidebar / mobile drawer)
10. Persistent filters (sobreviven reload)

---

## 3. Feature tour por rol

### 👤 Specialist Juan (típico día)

1. Abre la app → home con "Hi Juan." y banner rojo si hay vencidas
2. **Hero stats clickeables**: "Overdue: 3" → drill a By urgency view
3. Mira **My tasks** ordenada por urgencia
4. Click en una tarea → panel full-screen con:
   - Edit inline de fields (click en el value)
   - Notes con auto-resize
   - History timeline
   - **Comments thread** (colabora con su manager)
   - Documents (sube PDFs, pega Drive links)
   - Actions: Advance → / Close ✓ / More (Block, Edit details, Reassign)
5. Cierra una tarea → resumen requerido → toast verde → siguiente urgente auto-seleccionada
6. **My performance** → ve su on-time rate, streak, breakdown por priority

### 🟢 Manager María (vista semanal)

1. Home → "Your team is carrying 12 high-priority tasks this week"
2. **Hero stats clickeables**: "Overdue: 8" → tracker filtrado a overdue de su país
3. **Team tracker**:
   - Filter chips: status + project + owner + confidentiality
   - Click en cualquier responsable → filter por esa persona
   - Bulk select 3+ → "Reassign" → modal con dropdown de su team
4. **My team** view → load bars por miembro
5. **Analytics** → distribution, top owners, SLA donut, **aging buckets** (>14d / 7-14d / <3d), **SLA trend last 8 weeks**

### 🌎 HQ — VP Legal LATAM (estratégico)

1. Home → "Global · 4 countries" con stats LATAM
2. **Global tracker** → **countries-first grid**:
   - Cada país como card: Active / Overdue / SLA + sparkline throughput 12w
   - Países "at-risk" destacados con border crit
   - Click drill al país, "← Back to countries"
3. **By country** → tabla detallada con projects at risk
4. **Analytics**:
   - Countries comparison matrix con sparklines
   - Top 5 projects at risk
   - Aging buckets globales
   - SLA trend LATAM-wide
5. **Demo switcher** "View as Specialist/Manager/HQ" — para ver la app como un specialist real

---

## 4. Demo script de 15 min

### Min 0–2 · Setup + One-liner
- "Antes Legal usaba un Excel compartido. Cada país una pestaña. Sin visibility cross-country, sin métricas, sin notifications."
- "Hoy: 3 roles, mismo dato, vistas distintas, deploy automático."

### Min 2–5 · Specialist (Juan)
- Abrir la app, mostrar el home con greeting + urgency banner
- "Estos números no son decoración" → click en Overdue → drill
- Abrir una tarea → panel full-screen
- "Cada tarea es colaborativa" → mostrar comments thread (escribir uno en vivo)
- "Y todo está conectado a Drive" → upload de un doc → mostrar que va a la carpeta auto-clasificada
- Cerrar con resumen → "siguiente urgente seleccionada automáticamente"

### Min 5–9 · Manager (cambiar con demo switcher)
- "Misma app, pero María ve su equipo"
- Mostrar team tracker
- Bulk reassign: seleccionar 3 tareas → "Reassign" → mostrar modal con dropdown del team
- Mi equipo → "ve carga por persona, sabe si alguien está sobrecargado"
- Analytics → **mostrar el SLA trend de 8 semanas** (esto IMPRESIONA)
- "Antes esto requería bajar el Excel, hacer pivot tables. Ahora es un click."

### Min 9–13 · HQ (cambiar otra vez)
- "Ahora el VP. Mismo dato, abstracción más alta."
- Global tracker → countries-first grid → "Acá veo en 5 segundos qué país necesita ayuda"
- Click en el peor país → drill al detalle
- Volver → Analytics → countries comparison matrix
- Projects at risk → "Top 5 proyectos donde se está perdiendo SLA"
- "El VP toma decisión de reasignar headcount con esto"

### Min 13–15 · Cierre + Q&A setup
- "Cmd+K busca todo, incluido documentos" → demostrar
- `?` → mostrar atajos de teclado (signal de polish + power user friendly)
- "Todo esto deploya solo con git push. Sin servidores. Sin licencias adicionales. La data vive en el sheet que ya tienen."
- "Próximo paso: notifications automáticos por Slack + calendar view + onboarding tour."
- Abrir preguntas.

---

## 5. Wow moments (5 cosas que destacar)

1. **Cmd+K search** — busca en tasks + projects + documents simultaneously, con highlight visual. Hace sentir "esto es Linear / Notion-level polish".

2. **Countries-first HQ landing** — el grid de países con sparklines es visualmente único. Conecta inmediato con stakeholders ejecutivos que aman dashboards.

3. **Bulk reassign con picker visual** — antes era prompt feo, ahora modal con team filtering por rol. "Esto se nota que pensaron en el manager."

4. **Full-screen task detail con comments thread** — cuando demuestres comments en vivo, mostrá que persiste con autor + timestamp. Audit trail real, no notas borradas.

5. **Demo switcher "View as Specialist"** — siempre genera "ohhhh" porque muestra empatía con UX. "Construyeron pensando en cada rol".

---

## 6. Weak spots — no mostrar en vivo

| Área | Por qué evitar | Si te preguntan |
|---|---|---|
| **Telemetry sheet** | Sigue en español, lookea unpolished | "Es para el log interno, no para usuarios" |
| **Modal legacy "Edit details"** | Ya está en inglés pero diseño viejo | Mostrá solo el panel inline edit; si te preguntan por "all fields" en vivo, abrilo pero rápido |
| **Mobile en tablet 1024px** | Hover-expand del sidebar es raro en touch | No demostrar en tablet; usar laptop o resolución >1280px |
| **Speed con muchas tareas** | Apps Script puede ralentizar con 500+ historial | Demo con sheet de 50-100 tareas, no de prod completo |
| **`getEditorialData` primer load** | Toma 1-2s la primera vez | Empezá el demo con la app YA abierta (pre-cargada) |
| **Notifications inexistentes** | No hay alerts automáticos todavía | Es el #1 del backlog, mencionar como "siguiente fase" |
| **Comments — first run crea la sheet** | La primera vez tarda ~3s para crear la sheet Comments | Pre-tirá un comment de prueba ANTES del demo para que la sheet exista |

---

## 7. Hard questions + respuestas armadas

### "¿Cuánto costó construir esto?"
- "Cero infra. La data vive en un Google Sheet del equipo, el código en Apps Script, el deploy en GitHub Actions free tier. Costo recurrente: $0. El costo es el tiempo invertido en construirlo, que es lo que estamos pidiendo financiar para seguir desarrollando."

### "¿Cómo escala a 10K tareas?"
- "El cache TTL 30s y el pre-bucketing reduce las queries críticas a <500ms con miles de filas. Para escalar a 10K+ activas: migrar de Sheets a un backend real (Firestore o Postgres) manteniendo la misma UI. La capa de presentación está ya separada del modelo de datos."
- Mostrá el `_getEditorialDataImpl` optimizado de O(team×histo) a O(team+histo) como evidencia.

### "¿Y si Google cambia Apps Script?"
- "Es un riesgo real pero acotado: el frontend (HTML/CSS/JS vanilla) es portable a cualquier hosting. Solo el backend tendría que reescribirse. Estimado: 2-3 semanas de un dev senior si fuera necesario."

### "¿Cómo manejan confidencialidad legal real (NDAs, M&A)?"
- "3 niveles: standard / restricted / confidential. Server-side filtering antes de mandar al cliente. Un specialist no recibe ni el ID de una tarea confidencial. Audit trail en sheet Comments. **Limitación**: no hay encryption at-rest todavía; es Google's default."

### "¿Quién puede borrar data?"
- "Hoy nadie desde la UI. Solo desde el spreadsheet directo (admin del sheet). Tareas cerradas van a Historial automáticamente. Todo cambio queda registrado en Telemetry (sheet auto-creada) con timestamp + email del actor."

### "¿Por qué inglés si el equipo es latino?"
- "Decisión deliberada — equipo legal global trabaja con counterparts en US/EU. El sheet sigue en español por compatibilidad con la data histórica, pero la UI es inglesa. Switcheable a español con 2 horas de trabajo si lo prefieren."

### "¿Mobile?"
- "Funciona, pero está optimizado para desktop. Specialist hace su trabajo en escritorio, manager también. HQ podría querer mobile — está en el backlog hacer touch-first para tablets."

### "¿Slack integration funciona ya?"
- "Sí, parcial: notificaciones cuando se crea/cierra una tarea van al canal. **Lo que falta y está priorizado**: DMs personales ('te asignaron X', 'tu tarea vence mañana') y slash command para crear desde Slack."

### "¿Cuál es el ROI?"
- Métricas a tener listas:
  - "Antes el manager pasaba ~30 min/día actualizando el Excel. Ahora 5 min."
  - "Visibility cross-country: imposible antes, instantánea ahora"
  - "Compliance: cada tarea tiene audit trail completo (creación, cambios, cierre)"
  - "On-time rate medible: antes nadie sabía. Ahora dashboard"

### "¿Por qué no usaron Asana / Linear / Jira?"
- "Costo (licencias por user × N countries × tiempo), integración con la data legal existente (sheets, drive folders organizados), y customization (NDAs, confidencialidad legal, audit trail) habrían sido más caras de configurar que construir esto. Plus: el equipo legal NO quiere aprender otra tool."

### "¿Cómo testean?"
- "Smoke tests en `tests.gs` para los 3 roles. Validación manual por el equipo CO en la fase pre-piloto actual. **Limitación honesta**: no hay test suite automatizado todavía. Está en el backlog."

---

## 8. Si tenés tiempo extra (15+ min)

Demos opcionales si hay tiempo o curiosidad:
- **Comments thread** con tu compañero conectado en vivo (mostrar real-time-ish)
- **HQ analytics → countries comparison** con sparklines
- **Bulk operations** sobre 5+ tareas a la vez
- **Search docs con Cmd+K** filtrando por nombre
- **Mobile responsive** (resize browser → mostrar hamburguesa)
- **Dark mode toggle** (en el sidebar footer)

---

## 9. Cómo cerrar el demo

**Si están convencidos**:
- "El equipo core CO ya está usando la app (pre-piloto / validación interna desde 4/5/2026). Para pasar a piloto formal necesito definir con ustedes las métricas de éxito del mes 1."
- "¿Qué país siguiente?" (MX típicamente es el natural)

**Si están escépticos**:
- "Démosle 4 semanas más de validación interna con el equipo CO antes de declarar piloto formal. Métricas: % tasks closed on-time, # cross-country reassignments, NPS del equipo."
- "Si no cumple, mato el proyecto. Si cumple, escalamos."

**Si quieren features específicos**:
- Mostrá el backlog priorizado del ARCHITECTURE.md
- "Decime qué de esos sumás, qué sacás, qué agregás"

---

## 10. Material de apoyo

- `ARCHITECTURE.md` — para devs / técnicos
- `README.md` — overview de 1 página
- `plan/PRD.md` — product requirements original
- `plan/PILOT-RUNBOOK.md` — playbook del piloto CO
- Demo URL: `/exec` para mostrar al equipo, `/dev` para testing previo

---

## 11. Checklist pre-demo (30 min antes)

- [ ] Hard refresh de `/dev` para que cargue lo último
- [ ] Crear un comment de prueba en una tarea (para que la sheet `Comments` ya exista)
- [ ] Cerrar el demo switcher antes de empezar (limpio)
- [ ] Crear una tarea de demo con todos los campos llenos (para mostrar panel completo)
- [ ] Limpiar localStorage si los filtros previos confunden
- [ ] Cerrar otras pestañas para no distraer
- [ ] Tener el ARCHITECTURE.md abierto en otra ventana para preguntas técnicas
- [ ] Cargar `?` modal una vez para verificar que funciona
- [ ] Verificar internet estable (Apps Script es susceptible a latencia)
