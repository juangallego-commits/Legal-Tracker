# Review Brief — Legal Tracker

Documento para compartir con un revisor externo (humano o agente IA) que vaya a auditar el proyecto.

Pegá la sección "Prompt para Claude chat" en una conversación nueva con Claude (con conector de GitHub habilitado) y dejá que lea los archivos él mismo.

---

## Prompt para Claude chat

```
Voy a darte acceso al repo GitHub juangallego-commits/Legal-Tracker. Antes de
proponer nada, leé los archivos en este orden:

1. README.md — overview del proyecto y stack
2. ARCHITECTURE.md — capas, modelo de datos, decisiones técnicas
3. plan/PRD.md — qué resuelve y para quién
4. backend/codigo.gs — backend completo (~3500 líneas)
5. frontend/Dashboard.js.html — frontend completo (~11400 líneas)
6. frontend/Dashboard.css.html — sistema de diseño (~3000 líneas)
7. backend/SlackModal.gs — integración Slack
8. backend/tests.gs — suite de tests

CONTEXTO RÁPIDO:
- Webapp interna para el equipo Global Legal de Rappi+ (~30 personas en LATAM).
- Tech stack: Google Apps Script + Vanilla JS + Google Sheets como DB.
- Sin frameworks, sin bundler. Un solo HTML servido por HtmlService.
- Tres roles: specialist (su día), manager (su país), head/HQ (LATAM completo).
- Estado: en piloto con ~5 países activos, ~150 tareas activas en steady state.
- Rama de trabajo: claude/review-project-status-fpUFy (squash-mergea a main).

LO QUE QUIERO QUE HAGAS:

Reportame en 3 secciones:

1. **Lo que está SÓLIDO** — patterns, decisiones, código que claramente está
   bien pensado. No me adules, solo lo genuinamente bueno.

2. **Lo que está MAL o FRÁGIL** — bugs, anti-patterns, deuda técnica, riesgos
   de seguridad/escalabilidad. Citá file:line cuando puedas.

3. **5-10 propuestas concretas priorizadas** (P0/P1/P2) con:
   - Qué cambiar (específico, no genérico).
   - Por qué (impacto en UX/perf/seguridad/mantenibilidad).
   - Esfuerzo aproximado (≤1h / 1 día / >1 semana).

Sé estricto. Es para mejorar, no para validar.

NO ESCRIBAS CÓDIGO en el primer round — solo diagnóstico y propuestas. Después
yo decido qué implementamos.
```

---

## Áreas con foco específico (paste 2)

Después del primer reporte, pedí deep-dives en:

### Seguridad
- ¿Las mutations validan permisos en backend (no solo frontend)?
- ¿Se sanitiza input antes de write a Sheets? (`_sanitizeCell` cubre todo?)
- ¿Hay XSS posible en strings que vienen del Sheet y se renderean sin `esc()`?
- ¿Los scopes en `appsscript.json` son mínimos o sobre-amplios?
- ¿`updateTaskFields` chequea ownership en TODOS los caminos?

### Performance
- `getEditorialData()` hace N lecturas de sheets en cada request — ¿cuántas exactamente?
- ¿Hay N+1 queries en el computo de stats por país/persona?
- Cache TTL 30s — ¿es suficiente para evitar thundering herd al refresh?
- Telemetry `_telemetry()` — ¿no agrega overhead significativo?

### Escalabilidad
- ¿Qué se rompe primero a 1k / 5k / 10k tareas activas?
- ¿`Historial` crece sin límite? ¿Plan de archivado?
- ¿`Activity` (audit log) también crece sin pruning?
- ¿`LockService` se vuelve cuello de botella con 30+ usuarios concurrentes?

### Mantenibilidad del frontend
- `Dashboard.js.html` tiene 11400 líneas en un solo archivo. ¿Cómo lo modularizarías sin perder el deploy single-file de Apps Script?
- Convención de nombres: `edFoo`, `paFoo`, `_foo`, `rEdHomeX` — ¿está documentada?
- ¿El diccionario `T_PT` debería moverse a un sheet para que el equipo de Brasil edite sin tocar código?

### UX gaps
- ¿Hay UX paths que no implementamos pero deberían existir?
- Bulk export con filtros aplicados
- Undo last action (mover de Historial de vuelta a Activo)
- Conflict resolution si dos managers editan la misma tarea en paralelo
- Notificaciones push / email cuando alguien me reasigna
- Mobile experience real (no solo responsive del wrapper)

### Tests
- `tests.gs` corre desde el editor de Apps Script. ¿Cobertura real?
- ¿Faltan tests de auth/permisos? (más críticos)
- ¿Cómo testeás el frontend? (hoy no hay nada — ¿vale la pena con vanilla JS?)

### Patterns que probablemente están mal
- Inline styles en el JS aún después de extraer 9 utility classes
- `eval`-like patterns en event delegation (data-act + switch)
- Estado global: `D`, `EDT`, `EDU`, `EDC`, `EDR`, `_NOTIF_RECENT`... ¿se justifica esa cantidad de globals?

---

## Recent work history (`git log --oneline -20 origin/main`)

```
7559a83 feat(design): pasada visual buckets A-D (pills + utilities + responsive + skeleton) (#59)
187d705 fix(i18n): traducir a PT-BR ~75 strings de bulk modals, homes y activity (#58)
a48835d fix(ux): On hold + HQ + audit log + bulk close + 6 mejoras de lógica (#57)
47bf9ef Merge PR #56
3ea23da fix(ux+logic): On hold + HQ seleccionable + Inicio diferenciado + naming
586da80 Merge PR #55
250bf05 feat(i18n): PT-BR expandido a wizard + help + panel + +60 strings
2796448 feat(i18n+polish): PT-BR para equipo Brasil + 4 polish diseño senior
bff811b fix(ux+visual): campos obvios autoasignados + 12 issues diseño senior
8db1f22 fix(audit): bugs P0 backend + UX residual + a11y/contraste WCAG
2f09d03 fix(tour+a11y): Esc cierra tour + deadline validation + mobile demo
41ef579 fix(polish): KPI border accent + tour action bug + cursor default
aaf4e33 fix(audit): 10 issues stress-test E2E + polish visual
43f6d24 fix(visual): clases CSS huerfanas (wizard, help, ua-flow) + polish
2631907 feat(tour+ux): tour interactivo + avatar menu + indicador filtro + polish
21b61ec fix(audit): 14 issues de los agentes UX + bugs (criticos + confunde)
7881a8d fix(P0): Mi desempeño roto + wizard responsable + confidencialidad
73c3520 fix(ux): confirm custom + Cmd/Ctrl detection + mobile panel rail
a116680 fix(panel-tarea): convertido a modal overlay centrado (consistente con Crear)
5810ab2 fix(P1): close/block safeMutation + getTaskComments authz + UX polish
```

## Lo que NO necesita revisión

Estas áreas ya pasaron auditorías recientes — no las priorices a menos que veas algo nuevo:

- **i18n ES/PT-BR** — ~250 strings cubiertos. Si hay gaps son micro.
- **Diseño visual base** — 4 buckets (A: quick wins, B: pills accesibles, C: responsive, D: utility classes) ya aplicados en PR #59.
- **Estados de tarea** — los 5 (Pendiente/En curso/En revisión/On hold/Listo) están con border-left para daltonismo.
- **Onboarding tour** — flujo de 7 pasos cubierto, accesible vía Esc, sin bugs conocidos.
- **Cierre con resumen mandatorio** — política unificada (individual + bulk), no proponer cambiar el contrato.

## Tips para que la revisión sea más útil

1. **Pedí diagnóstico antes que código.** Una propuesta tipo "X está mal porque Y, propongo cambiarlo a Z, esfuerzo: 1h" vale más que un patch.
2. **Priorización honesta.** Si todo es P0, nada es P0. Forzá 60% en P2.
3. **Tradeoffs explícitos.** Si una propuesta tiene downside, que lo diga.
4. **Citá file:line.** Sin referencias concretas la propuesta no es accionable.
