# Guion del video tutorial · Legal Tracker

Guion estructurado para grabar un video walkthrough de la app, pensado para el piloto interno con Juan (specialist), Carlos (manager) y Anna (HQ).

## Cómo grabarlo

**Herramienta recomendada: [Loom](https://www.loom.com/)** — gratuito hasta 25 videos, graba pantalla + cara + voz, genera link compartible al instante, trims básicos.

Alternativas: OBS Studio (gratis, más potente, requiere export), Zoom (grabar reunión solo conmigo, exportar mp4), QuickTime (Mac, sin webcam overlay).

**Setup antes de grabar:**
- Abrí la app en una ventana limpia (sin tabs distractores)
- Pestaña incógnita o profile separado, logueado con tu cuenta de specialist
- Tené abierta una segunda ventana con el sheet de Google (para mostrar la BD)
- Pausá Slack y notificaciones
- Si grabás con cara, mirá la cámara cuando arranques y cuando cierres

**Duración objetivo: 12-15 minutos.** Más largo que eso y nadie lo ve. Si te pasás, partilo en 3 mini-videos (1 por rol).

---

## Estructura del video

| Minuto | Sección | Audiencia |
|---|---|---|
| 0:00-1:00 | Intro + qué es Legal Tracker | Todos |
| 1:00-5:00 | Day 1 como specialist (Juan) | Juan principalmente |
| 5:00-9:00 | Vista de manager (Carlos) | Carlos principalmente |
| 9:00-12:00 | Vista de HQ (Anna) | Anna principalmente |
| 12:00-14:00 | Features cross-cutting (Cmd+K, comments, docs, digest) | Todos |
| 14:00-15:00 | Cómo reportar bugs + qué esperamos del piloto | Todos |

---

## Min 0:00-1:00 · Intro

**Qué decir:**
> "Hola equipo. Este es Legal Tracker, la herramienta que vamos a usar la próxima semana para hacer seguimiento de nuestras tareas legales. En lugar del Excel compartido que veníamos manejando, ahora tenemos una webapp con auth, roles y métricas reales. La data sigue viviendo en Google Sheets — no hay infra nueva ni licencias — pero ahora la consumimos por una UI."

**Qué mostrar:**
- Abrí la URL `/exec` del app
- Página de login con Google SSO → dale click
- Aterriza en el home

**Bullet a mencionar:**
- 3 roles: specialist (vos, Juan), manager (Carlos), HQ (Anna)
- Cada rol ve cosas distintas pero la data es la misma
- Sin embargo, hay confidentiality: tareas marcadas como `restringido` o `confidencial` solo se ven entre quienes tienen permiso

---

## Min 1:00-5:00 · Day 1 como Specialist (Juan)

### Inicio (1:00-1:45)

**Qué mostrar:**
- El home dice "Hola Juan." con la fecha
- Banner rojo si hay vencidas: "Tenés N tareas que necesitan atención hoy"
- Hero stats: Vencidas / Vencen hoy / Esta semana / Bloqueadas
- "On your plate, by urgency" — top 4 tareas

**Qué decir:**
> "Cuando abrís la app, lo primero que ves es tu agenda del día. Estos números **son clickeables** — si tenés vencidas, hacé click ahí y te lleva directo al detalle."

**Hacer click:**
- En el número de "Vencidas" → navega a "Por urgencia"

### Vista "Por urgencia" / Mis tareas (1:45-2:30)

**Qué mostrar:**
- 4 buckets: Vencidas / Vencen hoy / Esta semana / Después
- Cada bucket tiene narrativa contextual ("X de prioridad alta. Cerrar antes de fin de día.")

**Qué decir:**
> "Acá ves tus tareas agrupadas por urgencia. La idea es que arranques tu día por las vencidas, después las de hoy, y dejes las de la semana para después. La narrativa que ves debajo del título te dice qué te conviene hacer primero."

### Abrir una tarea (2:30-3:30)

**Qué mostrar:**
- Click en una tarea → panel full-screen con detalle
- Eyebrow con ID + país
- Confidentiality band (estandar/restringido/confidencial)
- Pills: prioridad + estado + tipo
- Estado actual (texto contextual)
- Grid de fields: Responsable, Líder, Plazo, SLA, Riesgo, Proyecto, Contraparte
- Notas (auto-resize)
- Historial (timeline)
- **Comentarios** (hilo)
- **Documentos** (upload o link a Drive)
- Acciones: Avanzar → / Cerrar ✓ / Más (Bloquear, Editar detalles, Reasignar)

**Qué decir:**
> "Click en una tarea y se abre el detalle completo. Acá tenés todo: campos editables, notas, historial, hilo de comentarios para coordinar con tu manager, documentos que podés subir a Drive directamente. **Doble click en el título** para renombrarla. Click en cualquier celda — responsable, plazo, riesgo — para editarla inline."

**Demo en vivo:**
- Doble-click en título, editá una letra, Enter
- Click en plazo, cambialo, Enter
- Escribí algo en notas, click afuera (se guarda solo)
- Escribí un comentario, Cmd+Enter para enviar

### Avanzar una tarea (3:30-4:15)

**Qué mostrar:**
- Click "Avanzar →"
- Modal con 3 opciones: Avanzar / Cerrar / Bloquear
- "Avanzar" llevaría a "Listo" en esta tarea — la app te switchea automáticamente a "Cerrar" pidiendo resumen
- Llená el resumen, click "Cerrar tarea ✓"
- Toast verde, panel se cierra, siguiente urgente auto-seleccionada

**Qué decir:**
> "Cuando avanzás una tarea, pasás por sus estados: Pendiente → En curso → En revisión → Listo. Si está en revisión y le das avanzar, te pide un resumen porque va a cerrar. Bloquear es para cuando estás esperando a alguien externo — no consume tu capacidad activa."

### My performance (4:15-5:00)

**Qué mostrar:**
- Sidebar → "Mi desempeño"
- Hero: % en tiempo / Cerradas total / 🔥 Racha actual
- Gráfico de barras "Tareas cerradas, últimas 8 semanas"
- "Lo que más manejás": breakdown por prioridad con SLA promedio

**Qué decir:**
> "Acá ves tu performance personal: cuántas cerraste, qué % cerraste en tiempo, tu racha actual. Es para vos — nadie más ve esto."

---

## Min 5:00-9:00 · Vista de Manager (Carlos)

> Si vas a grabar con tu cuenta de specialist, podés:
> 1. Cerrar sesión y logueate con la cuenta de Carlos para esta sección, **o**
> 2. Grabar esta sección con Carlos en una segunda sesión y editar después, **o**
> 3. Mostrar screenshots y narrar.

### Home de manager (5:00-5:45)

**Qué mostrar:**
- "Tu equipo está cargando X de prioridad alta esta semana"
- Hero stats: Vencidas / Vencen hoy / Carga del equipo / SLA en tiempo
- "Requieren tu atención" — top 4 tareas del equipo
- "Tu equipo en un vistazo" — load bars por miembro

**Qué decir:**
> "Carlos ve su equipo. Si alguien está sobrecargado, lo ve acá en las load bars. Las tareas que requieren atención son las que están vencidas o bloqueadas — para que sepas a quién contactar."

### Tracker del equipo (5:45-7:00)

**Qué mostrar:**
- Sidebar → "Tracker del equipo"
- Toolbar: Todas / Vencidas / Vencen hoy / Bloqueadas + buscador
- Filtro por proyecto
- Tabla con: ID, Tarea, Responsable, Prioridad, Estado, ETA
- Click en un responsable → filtra por esa persona (chip aparece arriba)
- Click en una fila → panel full-screen igual que specialist

**Qué decir:**
> "El tracker del equipo es tu vista operativa. Filtrás por estado, por proyecto, o clickeás un responsable para ver todo lo de esa persona. Misma vista que Juan pero con todo el equipo."

### Bulk actions + reasignar (7:00-7:45)

**Qué mostrar:**
- Seleccionar 3 tareas con checkbox
- Barra sticky arriba: "3 seleccionadas | Avanzar | Bloquear | Reasignar | Cancelar"
- Click "Reasignar" → modal con dropdown de tu equipo
- Confirmar → toast

**Qué decir:**
> "Si querés mover varias tareas de Juan a otra persona porque está saturado, seleccionás múltiples y reasignás de una. Solo podés reasignar dentro de tu equipo."

### Mi equipo + Analítica (7:45-9:00)

**Qué mostrar:**
- "Mi equipo" → load bars detalladas
- "Analítica" → 4 KPIs + distribución por prioridad + top owners + SLA donut + **aging buckets** + **SLA trend 8 semanas**

**Qué decir:**
> "En analítica tenés todo lo del equipo medible. Lo más útil: aging buckets te dice cuántas tareas llevan más de 2 semanas (a veces son las que se olvidan), y SLA trend te muestra cómo viene tu equipo con los tiempos durante las últimas 8 semanas."

---

## Min 9:00-12:00 · Vista de HQ (Anna)

### Inicio global (9:00-9:45)

**Qué mostrar:**
- Home: "Operaciones legales globales de un vistazo"
- "Por país" → grid de cards con cada país
- Cada card: Activas / Vencidas / SLA + sparkline de 12 semanas
- País at-risk con borde rojo

**Qué decir:**
> "Anna ve LATAM completo. Cada card es un país. Los que tienen borde rojo son países en riesgo: más de 3 vencidas o SLA bajo 85%. Click en un país y entrás al detalle."

### Drill-down a país (9:45-10:30)

**Qué mostrar:**
- Click en un país → tracker filtrado a ese país
- Botón "← Volver a países"
- Misma estructura que manager pero del país elegido

**Qué decir:**
> "Drill-down: hacés click en cualquier país y entrás al tracker como si fueras el manager de ese país. Para volver, click en el botón arriba."

### Analítica HQ (10:30-12:00)

**Qué mostrar:**
- Sidebar → "Analítica"
- Comparativa de países (matriz con sparklines)
- Proyectos en riesgo (top 5)
- Aging buckets globales
- SLA trend LATAM

**Qué decir:**
> "Como HQ tenés todo lo del manager más comparativas entre países. Si querés saber qué proyecto está sufriendo más, está en 'Proyectos en riesgo'. Si querés saber qué país está perdiendo SLA, comparativa."

---

## Min 12:00-14:00 · Features cross-cutting

### Cmd+K búsqueda global (12:00-12:30)

**Qué mostrar:**
- Cmd+K (Ctrl+K en Windows) → modal de búsqueda
- Tipear "contrato" → resultados de Tareas + Proyectos + Documentos
- ↓/↑ para navegar, Enter para abrir

**Qué decir:**
> "Cmd+K en cualquier momento abre la búsqueda. Busca tareas, proyectos y documentos. ↓↑ para moverte, Enter para abrir."

### Comentarios + Documentos (12:30-13:15)

**Qué mostrar:**
- Abrí una tarea, sección Comentarios — escribí uno con Cmd+Enter
- Sección Documentos — click "Subir archivo" o "Adjuntar enlace"
- Doc auto-clasificado en Drive por TipoTrabajo / País / Proyecto

**Qué decir:**
> "Cada tarea tiene su hilo de comentarios — útil para coordinar sin mandarte WhatsApps. Y los documentos van directo a una carpeta en Drive con taxonomía automática, no tenés que ordenar nada."

### Email diario (13:15-14:00)

**Qué mostrar:**
- Captura del email diario que recibís a las 8am Bogotá
- Tabla con tus vencidas + hoy + 48h
- Click en un ID → abre la tarea directo

**Qué decir:**
> "Todos los días a las 8am Bogotá vas a recibir un email con lo que necesita atención hoy. Click en cualquier ID y te abre la tarea directo en la app. Si no tenés nada urgente, no te llega email — no spam."

---

## Min 14:00-15:00 · Cierre

**Qué decir:**
> "Esto es lo que tenemos. Para el piloto la próxima semana, vamos a usarla como nuestra única herramienta de tracking. **Lo que necesito de ustedes:**
>
> 1. Carguen sus tareas reales — no inventen, usen casos verdaderos.
> 2. Si encuentran un bug o algo no anda, **mándenme un Slack con screenshot** y el path que clickearon. No tiren la app, mándenme contexto.
> 3. Si algo se sienta raro o no entienden — también es feedback. Esto es para nosotros, no para mí.
>
> En 5 días arrancamos. Cualquier pregunta, Slack. Vamos."

---

## Bonus: si querés grabar 3 mini-videos en vez de uno largo

| Video | Audiencia | Duración | Secciones |
|---|---|---|---|
| 1. Onboarding general | Todos | 4 min | Intro + features cross-cutting + reportar bugs |
| 2. Day-to-day como specialist | Juan | 5 min | Day 1 specialist |
| 3. Vista de manager y HQ | Carlos + Anna | 6 min | Manager + HQ |

Ventaja: cada uno ve solo lo que aplica a su rol. Desventaja: 3 videos a editar/publicar.

---

## Cosas que NO mostrar (todavía)

- **Edit details modal legacy** — sigue funcionando pero los wizards nuevos lo reemplazan
- **Slack integration** — modal de Slack y slash commands existen pero no se documentaron acá, mejor hacer un video aparte si llegamos a integrarlo
- **Templates** — la hoja `Templates` puede pre-llenar notas con checklists pero requiere setup manual de templates por tipo
- **Días hábiles con feriados** — el cálculo de ETA usa feriados de la hoja `Feriados` pero es interno, no UI

---

## Checklist antes de mandarles el video

- [ ] Grabaste con la URL `/exec` correcta (no `/dev`)
- [ ] Mostraste cómo loguearse (Google SSO)
- [ ] Quedó claro qué hace cada rol
- [ ] Mostraste cómo reportar bugs (Slack contigo)
- [ ] Subiste el video a Loom / Drive con permisos para los 3 usuarios
- [ ] Mensaje de acompañamiento con el link + 1 párrafo de contexto

---

## Tips de grabación

- **No leas el guion textual.** Usá esto como esqueleto pero hablale como hablás vos en Slack.
- **Errores en vivo son OK.** Si tipeás mal, no cortes — eso es realismo.
- **Mostrá el sheet detrás.** Cuando hablás de "la data sigue en sheets", alt-tab al sheet y mostralos. Refuerza confianza.
- **Pausá entre secciones.** 1 segundo de silencio para que el espectador procese.
- **Cerrá con cara a cámara** si grabás con webcam. Genera cercanía.
