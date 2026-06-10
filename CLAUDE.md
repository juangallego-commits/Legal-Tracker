# CLAUDE.md — guía operativa

Contexto para trabajar en **MyDash / Legal Tracker** (web app del equipo Global Legal de Rappi+).
Detalle completo en `README.md` y `ARCHITECTURE.md`; backlog en `PENDIENTES.md`. Este archivo es lo
mínimo que conviene tener presente en cada sesión.

## Qué es

Google Apps Script (`backend/*.gs`, runtime V8) + Google Sheets como DB, sirviendo un único HTML
por `HtmlService` (vanilla JS, sin bundler). Tres roles: **specialist / manager / head**. Deploy por
`clasp` + GitHub Actions al pushear a `main`.

Archivos núcleo: `backend/codigo.gs` (auth, CRUD, cache, digest), `frontend/Dashboard.js.html` (toda
la UI), `frontend/I18n.js.html` (t() + diccionario `T_PT`), `frontend/Dashboard.css.html`.

## ⚠ Dos gotchas que muerden seguido

1. **`backend/codigo.gs` tiene un caracter de control** → `grep`/ripgrep (incluida la herramienta
   Grep) lo tratan como **binario** y devuelven "No matches" falsos. Para buscar adentro usá
   `grep -a`, la herramienta **Read**, o Python con `open(path, errors='replace')`.

2. **El working tree se desincroniza solo** (HEAD vuelve a un commit viejo, p. ej. `dad1833`).
   **Antes de leer/editar y antes de commitear**, verificá: `git log -1` y que un símbolo reciente
   exista en el archivo (p. ej. `grep -c _deadlineParts backend/codigo.gs`). Si se desincronizó:
   `git fetch origin && git reset --hard origin/main`. **Todo el trabajo real está en el remoto** —
   nada se pierde, pero NO commitees sobre un tree viejo.

## Gates antes de cada commit (obligatorio)

```bash
cp backend/codigo.gs /tmp/c.js && node --check /tmp/c.js          # backend
sed '1d;$d' frontend/Dashboard.js.html > /tmp/d.js && node --check /tmp/d.js
sed '1d;$d' frontend/I18n.js.html     > /tmp/i.js && node --check /tmp/i.js
node scripts/check-i18n.js            # DEBE imprimir "Missing in T_PT: 0"
```

`node --check` rechaza `.gs`/`.html` por extensión → copiá a `.js` (y sacá el wrapper `<script>` del
HTML con `sed '1d;$d'`). El gate de i18n corre también en CI (`check-i18n.yml`) y bloquea el merge.

## Convenciones

- **i18n**: cada `t('texto')` nuevo necesita `'texto': '<pt-br>'` en `T_PT` (`frontend/I18n.js.html`),
  carácter por carácter, o el CI falla. **No** envuelvas en `t()` valores de data (status/prioridad/
  enums, payloads al backend, keys de CSS) — solo labels/botones/UI estática visible.
- **Mutaciones**: toda escritura va por `_safeMutation()` (lock + invalida cache + envelope
  `{success}`). Sanitizá celdas con `_sanitizeRow`/`_sanitizeCell`. Autorizá server-side con
  `_authorizeTaskWrite` / `_authorizeProjectWrite` / `_authorizeColaboradoresWrite` y **espejá esa
  regla en la UI** (no muestres botones que el backend va a rechazar).
- **SLA/ETA**: límites centralizados en `SLA_LIMITS` (server) → `data.slaLimits` → `_slaLimit()`
  (cliente). En días hábiles, con los feriados de cada país.
- **Demo-switcher** ("Ver app como…", solo head): es filtrado **cosmético del lado del cliente** — el
  browser ya tiene toda la data confidencial cargada. No es un control de seguridad.
- **Columnas opcionales** (tareas col 17–21, proyectos 16–17): el backend solo las escribe si la hoja
  ya las tiene (`if (lc >= TASK_*_COL)`). Col 21 `Colaboradores` requiere correr `migrarColaboradores()`
  una vez desde el editor de Apps Script.

## Flujo de trabajo

1. Desarrollá en una branch de feature (no en `main`).
2. Corré los gates de arriba.
3. Commit → push → PR a `main`.
4. **Squash-merge** → dispara el deploy automático (misma URL `/exec`).
5. Cada merge cambia los números de línea de `codigo.gs`/`Dashboard.js.html`: ubicá por nombre de
   función, no por línea.

**Commits**: terminá el mensaje con `https://claude.ai/code/session_01DtVa8T1C86h6jY2jqweXb3`.
No incluyas el identificador del modelo en commits, PRs, ni código.
