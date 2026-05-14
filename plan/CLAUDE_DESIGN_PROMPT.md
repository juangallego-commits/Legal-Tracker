# Brief para Claude Design · Rediseño Legal Tracker

> Cómo usarlo: copiá TODO el bloque "Prompt para Claude Design" de abajo y pegalo en https://claude.ai/design. Cuando Claude Design pida código, copiá las secciones de "Archivos a compartir" al final.

---

## Prompt para Claude Design

```
# Rediseño visual · Legal Tracker (Rappi+ Global Legal)

Soy product owner de una webapp interna del equipo Global Legal de Rappi+. La uso yo y dos compañeros (Carlos y Anna) para hacer seguimiento de tareas legales por país, líder, prioridad y estado. Reemplaza un Excel compartido viejo.

Necesito que me armes **2 propuestas visuales distintas** para refrescar el diseño. La versión actual usa una tipografía editorial con Fraunces serif estilo periódico que ya no me hace sentido — quiero algo más moderno, herramienta de productividad real.

## Stack técnico (importante: condiciona qué podés entregarme)

- Backend: Google Apps Script (no Node, no Next)
- Frontend: HTML + CSS + JavaScript vanilla servido por `HtmlService`
- **NO uso React, NO uso un bundler.** Cualquier componente que dibujes lo porto a vanilla JS imperativo.
- CSS con variables (`var(--token)`) — eso sí lo puedo aprovechar 1:1.
- Fonts vía Google Fonts CDN.
- Sin Tailwind en runtime, pero podés usarlo para diseñar y yo después extraigo los tokens a CSS plano.

Por eso lo que necesito de vos es:
1. **Tokens** (colores, tipografía, spacing, radii, shadows) listos para pegar como CSS variables.
2. **Mockups** de las vistas clave con HTML estructural que pueda entender y portar.
3. **Componentes core** definidos como bloques reutilizables (sidebar, header, card, pill, table row, etc).

NO necesito que generes React components ni archivos para Next. Si la herramienta default a eso, dame el resultado en HTML semántico + CSS variables.

## Las 2 propuestas que quiero

**Propuesta A — "Productividad densa" (vibe Linear)**
- Sans-serif compacto, tipografía Inter o Geist
- Sidebar oscuro fijo a la izquierda
- Tabla densa, mucha info por pantalla, rows compactas (44-48px)
- Monocromático: gris + un solo accent color (proponé cuál)
- Pills sutiles, sin colores saturados
- Dark mode primario, light como secundario
- Vibe: serio, profesional, "todo bajo control"

**Propuesta B — "Aérea y friendly" (vibe Notion / Stripe Dashboard)**
- Sans-serif, Inter o Geist
- Sidebar claro o flotante (no oscuro)
- Más espacio en blanco, rows más altas (56-64px), padding generoso
- Acentos de color para prioridad/estado más expresivos pero todavía profesionales
- Light mode primario, dark como secundario
- Cards con soft shadows
- Vibe: accesible, calmo, "te ayudo a pensar"

Para cada propuesta, generame:
1. Token set completo (light + dark)
2. Mockup de las 3 vistas más importantes (ver lista abajo)
3. Componentes definidos: Sidebar, Header, KPI card, Filter chip, Pill (priority/status/confidentiality), Table row, Task panel (full screen), Modal shell, Toast, Empty state

## Roles del producto (3)

- **Specialist** (Juan, ejecutor). Ve sus tareas. No reasigna. Vista personal y operativa.
- **Manager** (Carlos, líder de país). Ve su equipo entero. Reasigna dentro de su país. Métricas de equipo.
- **HQ / Head** (Anna, líder LATAM). Ve todo LATAM. Comparativas entre países. Estratégico.

Cada rol tiene su propio "home" — el specialist ve su agenda personal, el manager ve health del equipo, el HQ ve LATAM en un grid.

## Vistas a diseñar (priorizadas)

### TIER 1 — Críticas, diseñar primero

1. **Sidebar + Header (shell del app)** — visible en todas las vistas. Sidebar tiene secciones agrupadas por rol (ej. specialist tiene "Mi día", "Donde trabajo", "Análisis"). Header tiene Cmd+K search + botón "?" de ayuda + botón "+ Nueva tarea" + avatar.

2. **Home Specialist** — saludo "Hola Juan", banner rojo si hay vencidas, 4 hero stats clickeables (Vencidas / Vencen hoy / Esta semana / Bloqueadas), sección "En tu agenda, por urgencia" con top 4 tareas, sección "Tu mes hasta ahora" (racha + cierres promedio por prioridad), sección "Proyectos en los que estás".

3. **Home Manager** — saludo orientado a equipo ("Tu equipo está cargando X de prioridad alta"), 4 hero stats (Vencidas / Vencen hoy / Carga del equipo / SLA), sección "Requieren tu atención" (top 4 tareas del equipo), sección "Tu equipo en un vistazo" (tabla con load bars por persona).

4. **Home HQ** — "Operaciones legales globales", 4 hero stats LATAM, sección "Por país" (tabla con cada país + sparkline de tendencia 12 semanas), sección de actividad reciente.

5. **Tracker** (la vista más usada) — toolbar de filtros tipo chips (Todas / Vencidas / Vencen hoy / Bloqueadas) con counts, search input, dropdown de proyecto, botón Exportar (solo manager/head). Tabla con columnas: checkbox, confidentiality dot, ID, Tarea (nombre + meta), Responsable, Prioridad, Estado, ETA. Hover preview tras 400ms.

6. **Panel de detalle de tarea (full-screen)** — se abre al click. Eyebrow con ID + país, título editable, banda de confidencialidad, pills de prioridad/estado/tipo, bloque "Estado actual" con narrativa, grid 2x4 de fields editables (Responsable, Líder, Plazo, SLA, Riesgo, Proyecto, Contraparte), notas (textarea auto-resize), historial (timeline), comentarios (hilo con input al final), documentos (chips + botones subir/adjuntar), barra de acciones inferior (Avanzar → / Cerrar ✓ / Más).

7. **Modal de Crear Tarea** — wizard de 3 pasos. Paso 1: título + descripción + tipo + país. Paso 2: prioridad + riesgo + responsable + plazo + proyecto + confidencialidad. Paso 3: resumen para confirmar.

### TIER 2 — Importantes, después de las T1

8. **Mis tareas (specialist)** — hero stats + tabla densa con sus tareas activas.
9. **Por urgencia** — 4 buckets verticales (Vencidas / Vencen hoy / Esta semana / Después) con narrativa contextual por bucket y tareas listadas debajo.
10. **Mi equipo (manager/HQ)** — tabla con miembros, load bars, vencidas, bloqueadas, SLA del mes.
11. **Cmd+K Search modal** — input al top, secciones (Tareas / Proyectos / Documentos) con resultados navegables por teclado.
12. **Help modal** — atajos de teclado en grupos (Navegación / Tracker / Panel / Crear).

### TIER 3 — Que hereden tokens, sin necesidad de mockup específico

13. Analytics (gráficos donut + barras)
14. Por país (HQ)
15. Proyectos
16. Historial

## Features cross-cutting (deben quedar contempladas en el diseño)

- **Dark mode toggle** en el sidebar footer (botón sol/luna).
- **Niveles de confidencialidad** con dot indicador en cada tarea: `estandar` (gris neutro), `restringido` (ámbar suave), `confidencial` (rojo suave). El dot va antes del ID en la tabla.
- **Bulk actions**: cuando el usuario selecciona ≥1 tarea con checkbox, aparece una barra sticky arriba con: "N seleccionadas | Avanzar | Bloquear | Reasignar | Cancelar".
- **Empty states contextuales** con icono + frase ("No tenés tareas activas en tu agenda" vs "No hay tareas que coincidan con tu búsqueda").
- **Hover preview** sobre rows del tracker (tooltip flotante con Resp/Plazo/Acción).
- **Notificaciones (toasts)** abajo a la derecha — success/error/info.
- **Responsive**: desktop 1280+ es el target, sidebar colapsa a 1024, drawer hamburguesa a 768.

## Constraints y decisiones tomadas

- **Idioma**: TODO en español (es la versión que estamos rolando).
- **Tipografía**: descartamos Fraunces serif. Una sola sans-serif moderno (proponé: Inter, Geist o Plus Jakarta Sans). Monospace solo para IDs (`#T-001`) y números/ETA en celdas. NADA de display serif.
- **Acentos**: necesito tokens para `critical` (rojo, vencidas), `warn` (ámbar, hoy/atención), `good` (verde, on-time), `info` (azul opcional), `dim` (gris muted).
- **Prioridades**: Alta / Media / Baja → cada una con su color (rojo / ámbar / verde).
- **Estados** (orden de flujo): Pendiente → En curso → En revisión → Listo. + Bloqueado y Cancelado como ramas.
- **Pills**: redondeadas (radius ~6-8px), no totalmente pill (radius full). Sutiles, no gritar.
- **Tabla**: borders horizontales muy soft, rows hover con bg-change leve, selected con borde-izquierda accent.
- **Cards**: radius 8-12px, shadow muy sutil o nada (depende de la propuesta).

## Tipos de trabajo (categorías de tarea, para que sepas qué labels van)

Contencioso, Regulatorio, Contractual, Privacy, Operativo.

## Países en LATAM activos

CO (Colombia), MX (México), CR (Costa Rica). A futuro: AR, BR, CL, PE.

## Lo que NO quiero

- Tipografía editorial serif (lo que tengo hoy).
- Glow/neon/shadows muy llamativas.
- Gradientes saturados (tipo dashboard 2018).
- "Glassmorphism" agresivo (solo si Propuesta B lo pide muy sutil).
- Iconos infantiles o emoji excesivos. Sí permitido: 1-2 emojis funcionales puntuales (🔥 racha, ✅ on-time).
- Branding de Rappi específico (no quiero que se note que es de Rappi visualmente — es interno).

## Entregable concreto

Por cada propuesta (A y B), quiero:

1. **Token sheet** como bloque de CSS variables (`:root` + `[data-theme="dark"]`).
2. **Mockup de las 7 vistas TIER 1** (HTML estructural + CSS scoped, o capturas si la herramienta los renderiza).
3. **Componentes** mostrados aislados: sidebar item, KPI card, table row con todos sus estados (default/hover/selected/checked), pill de cada tipo (prioridad/estado/confidencialidad), modal shell.
4. **Estados especiales**: empty state, loading state, error toast.
5. **Notas de diseño**: 3-5 bullets explicando las decisiones clave (por qué este accent, por qué esta densidad, etc).

Empezá por Propuesta A. Cuando termines me la mostrás y arrancás Propuesta B.

¿Tenés dudas antes de empezar? Si no, dale.
```

---

## Archivos a compartir con Claude Design (si los pide)

Cuando Claude Design pida ejemplos del código actual para entender estructura, copiá uno o más de estos:

### 1. Función que renderiza el sidebar actual

Buscá en `frontend/Dashboard.js.html` la función `renderEdSide()`. Copiá esa función y el bloque `ED_NAV_BY_ROLE` arriba. Eso le da la estructura de navegación.

### 2. Función que renderiza el Home Specialist

`rEdHomeSpecialist(D)` en `Dashboard.js.html`. Es ~150 líneas y muestra todos los bloques (hero, urgency banner, tareas, perf, proyectos).

### 3. Función del Tracker

`rEdTracker(D)` y `_rEdTrackerHQCountries(D, v)` en `Dashboard.js.html`. Le da estructura de toolbar + tabla + panel.

### 4. Tokens CSS actuales

Pegale el bloque entre líneas ~1380-1500 de `frontend/Dashboard.css.html` (los `:root` tokens actuales). Le sirve para ver qué reemplazar.

### 5. Captura de pantalla del estado actual

Lo más útil: tomá 4-5 capturas (home specialist, tracker, panel abierto, modal de crear) y subilas. Una imagen vale más que 100 líneas de código.

---

## Follow-up prompt (después de que Claude Design entregue las 2 propuestas)

Cuando ya tengas las propuestas, pegá esto para refinar:

```
Excelente. Ahora necesito 3 cosas:

1. **Mostrame el sidebar en estado colapsado** (1024px). Solo iconos visibles, hover muestra label.

2. **Mostrame el modal de Reasignar masivo** (cuando manager selecciona 3 tareas y le da "Reasignar"). Header + dropdown del equipo + footer con cancelar/confirmar.

3. **Mostrame el email diario que recibe el specialist** — es HTML estilo Mailchimp básico (sin JS), con tabla de tareas Vencidas / Vencen hoy / Vencen en 48h. Tiene que verse bien en Gmail mobile y desktop.
```

---

## Cuando elijas propuesta, pasame esto y arrancamos a implementar

Una vez que decidiste cuál propuesta querés, pasame:

- El bloque de CSS variables (tokens) — light + dark
- Los mockups HTML de las 7 vistas TIER 1
- Lista de fonts a cargar (URLs de Google Fonts)
- Cualquier decisión específica que Claude Design haya tomado y quieras conservar

Con eso armo:
- Reemplazo de `frontend/Dashboard.css.html` con los nuevos tokens + componentes
- Update de las funciones `r*` y `rEd*` en `Dashboard.js.html` para usar las nuevas classes
- Tipografía: agrego el `<link>` de Google Fonts al `Dashboard.html`

**Plan de implementación realista en 2 horas:**

- 30 min: pegar tokens nuevos + ajustar font stack en CSS + cargar fonts
- 45 min: portar sidebar + header + home specialist
- 30 min: portar tracker + panel detalle
- 15 min: smoke test (crear tarea, avanzar, cerrar)
- Buffer: 0 min — todo lo demás (Mis tareas, Mi equipo, Analytics, modales) va a heredar tokens automáticamente con cosas raras visualmente que arreglamos después del piloto.

Si en 2h no llegamos a todo, el deal es:
- **Lo que SÍ** queda nuevo: sidebar, header, home, tracker, panel.
- **Lo que NO** queda nuevo: modales viejos (legacy), edit modal, algunos analytics.

Eso es lo que ven los pilotos. El resto lo refinamos en semana 2 del piloto con feedback real.

🚀
