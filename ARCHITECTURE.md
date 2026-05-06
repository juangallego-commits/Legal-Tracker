# Legal Tracker — Architecture Brief

> Documento resumen para cargar como contexto único en Claude.ai cuando el repo completo excede el límite. Última actualización: 2026-05-06.

---

## 1. Qué es

Web app interna del equipo Global Legal de Rappi+ para hacer seguimiento de tareas y proyectos legales por país, líder, prioridad y estado. **Pre-producción**: piloto Colombia previsto 4/5/2026.

---

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Google Apps Script (`.gs`) |
| Frontend | HTML + CSS + JS vanilla servido por `HtmlService` |
| BD | Google Sheets (5 hojas) |
| Auth | Google SSO + allowlist en hoja `Equipos` |
| Integraciones | Slack (modales, slash commands), Google Drive (adjuntos) |
| Deploy | `clasp` vía GitHub Actions en push a `main` |
| Timezone | `America/Bogota` (hardcoded en `appsscript.json`) |

**OAuth scopes**: `spreadsheets`, `drive`, `script.external_request` (Slack), `userinfo.email`, `script.container.ui`.

---

## 3. Estructura de carpetas

```
/
├── backend/            # Apps Script (.gs)
│   ├── codigo.gs           # 1633 LOC — engine principal (auth, CRUD, cache, render)
│   ├── SlackModal.gs       # 928 LOC  — integración Slack
│   └── tests.gs            # 221 LOC  — smoke tests
├── frontend/           # Templates HtmlService
│   ├── Dashboard.html      # 366 LOC  — shell
│   ├── Dashboard.css.html  # 3070 LOC — estilos (tokens, dark mode)
│   ├── Dashboard.js.html   # 5967 LOC — render imperativo, eventos, modales
│   └── StandaloneDemo.html # 179 LOC  — demo standalone
├── plan/               # Docs vivas
│   ├── PRD.md
│   ├── IMPLEMENTATION-PLAN.md
│   ├── PILOT-RUNBOOK.md
│   └── analysis/
│       ├── CURRENT-STATE-AUDIT.md
│       └── PROPOSAL-MAPPING.md
├── pendientes/         # ⚠️ 3.7 MB de drafts JSX/HTML (rediseño editorial — no producción)
├── .github/workflows/deploy-appsscript.yml
├── appsscript.json
├── .clasp.json.example
└── README.md
```

---

## 4. Backend — funciones clave (`backend/codigo.gs`)

```
doGet(e)                    // Web app entry; auth + render Dashboard
getTrackerData()            // Endpoint lectura único; snapshot JSON; cache 30s
getEditorialData()          // Extiende getTrackerData con campos derivados (rediseño)
addTask() / updateTaskFields() / blockTaskById() / closeTaskById()
addProject() / updateProjectFields()
uploadDocument() / attachDocumentLink() / removeDocument()
resolveVisitor()            // Auth contra hoja Equipos
determineRole()             // head | manager | specialist
readEquipos() / readConfig()
invalidateCache()           // Limpia snapshot tras writes
```

**Shape de `getTrackerData()`**: `{ tasks, historial, projects, kpi, sla, teamGrid, countries, config, _role, _user }`.

**Cache**: TTL 30s. Invalidación manual tras cada write — riesgo si un dev olvida llamarla.

---

## 5. Modelo de datos (Google Sheets)

| Hoja | Rol |
|------|-----|
| `Tracking Activo` | Tareas vivas |
| `Historial` | Tareas cerradas/bloqueadas |
| `Config` | Países, prioridades, tipos de tarea, SLAs |
| `Equipos` | Allowlist usuarios + rol (head/manager/specialist) + país |
| `Proyectos` | Proyectos (agrupan tareas) |

---

## 6. Frontend — vistas principales (`Dashboard.js.html`)

- `rTrackerView()` — tabla tareas + filtros
- `rKPIView()` — dashboard ejecutivo (head/manager)
- `rProjectsView()` — listado proyectos
- `rModalCreate()` — crear tarea (wizard)
- `rModalBlockTask()` — bloquear con razón
- `sendToSlack()` — disparar notificación

Estado global en variables JS, render con `innerHTML`. **No hay framework**.

---

## 7. Roles y autorización

| Rol | Capacidad |
|-----|-----------|
| `head` (HQ) | Ve todos los países; reasigna; KPIs globales |
| `manager` | Ve su país; gestiona su equipo |
| `specialist` | Ve sus tareas asignadas |

Resolución en `resolveVisitor()` → `determineRole()` consultando hoja `Equipos` (first-wins en allowlist tras fix `a038820`).

---

## 8. Integración Slack (`backend/SlackModal.gs`)

- Verificación de firma HMAC
- Deduplicación de eventos por hash (fix `0f5ce7a`)
- Slash commands + shortcuts → modal de creación/edición
- Notifica a canal cuando se crea/cierra/bloquea tarea

---

## 9. CI/CD (`.github/workflows/deploy-appsscript.yml`)

Trigger: push a `main` o dispatch manual.
Pasos: checkout → Node 20 → `npm i -g @google/clasp` → escribe `~/.clasprc.json` desde secret `CLASPRC_JSON` y `.clasp.json` con `SCRIPT_ID` → `clasp push -f`.

**Secrets requeridos en GitHub**: `CLASPRC_JSON`, `SCRIPT_ID`.

---

## 10. Deuda técnica detectada

| # | Ítem | Impacto | Acción sugerida |
|---|------|---------|-----------------|
| 1 | 2 archivos `.xlsx` en raíz (`legal_tracker_config (2).xlsx`, `Legal_Team_Tracker_v2 (5).xlsx`) | Bajo | Mover a Drive, borrar del repo |
| 2 | `pendientes/` = 3.7 MB de JSX/HTML de diseño | Medio (ruido, infla repo) | Mover a rama `design/*` o carpeta fuera del repo |
| 3 | `pendientes/uploads/` con artefactos de iteración (CSS/JS versionados, screenshots pegados) | Medio | Limpiar |
| 4 | Cache invalidation manual — depende de que el dev recuerde `invalidateCache()` post-write | Alto (riesgo prod) | Wrapper único para writes que invalide automáticamente |
| 5 | Mezcla `snake_case` / `camelCase` en `codigo.gs` | Bajo | Estandarizar (post-piloto) |
| 6 | `_funcionPrivada` por convención débil (no hay módulos) | Bajo | Aceptable para Apps Script |
| 7 | TODO en `codigo.gs` sobre X-Frame-Options para embed Notion/Confluence | Bajo | Diferir |
| 8 | `Dashboard.js.html` = 5967 LOC en un solo archivo | Medio | Aceptable mientras no haya bundler; documentar secciones |

---

## 11. Estado de git

- Rama actual: `claude/audit-and-roadmap-fdNpp`
- Working tree: clean
- Últimos 5 commits relevantes:
  - `a038820` fix(allowlist,docs): first-wins en buildEmailAllowlist + safeMutation
  - `1e41444` fix(cache): mover `invalidateCache()` post-write
  - `0f5ce7a` fix: dedup Slack events + matching robusto en specialist auth
  - `3d10930` fix(slack,equipos): preparar piloto CO con fixes y smoke tests
  - `40046cc` feat(tracker): filtro por país desde HQ + acción Reasignar

**Dirección actual**: estabilización pre-piloto Colombia + rediseño editorial en paralelo.

---

## 12. Lo que falta para versión final (gaps conocidos)

1. **Cleanup repo**: borrar `.xlsx`, mover/eliminar `pendientes/`.
2. **Refactor cache**: wrapper de writes que invalide automáticamente.
3. **Integración rediseño editorial**: los drafts en `pendientes/` deben portarse a `Dashboard.*.html` (ver `plan/IMPLEMENTATION-PLAN.md` — 5 agentes paralelos).
4. **Smoke tests**: ampliar `tests.gs` para cubrir los 3 roles y el path Slack.
5. **Runbook piloto**: validar `plan/PILOT-RUNBOOK.md` antes del 4/5/2026.
6. **Documentación deploy**: secrets GitHub + permisos Drive del usuario que ejecuta `clasp`.

---

## 13. Cómo pedirle a Claude que ayude

Cuando subas este archivo a Claude.ai, incluye también:
- `README.md`
- `plan/PRD.md`
- `plan/IMPLEMENTATION-PLAN.md`
- `backend/codigo.gs` (si cabe) o las primeras 200 líneas

Y formula peticiones atómicas. Ejemplos:
- *"Genera el wrapper `safeMutation()` que envuelve todo write y llama `invalidateCache()` al final. Aplícalo a `addTask`, `updateTaskFields`, `blockTaskById`, `closeTaskById`."*
- *"Diseña la migración del componente `ed-tracker.jsx` (en `pendientes/`) a `Dashboard.js.html`, manteniendo la API actual de `getTrackerData()`."*
- *"Amplía `tests.gs` con un smoke test por rol (head, manager, specialist) que valide visibilidad de tareas según país."*
