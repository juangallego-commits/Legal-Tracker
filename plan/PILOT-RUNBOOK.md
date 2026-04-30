# Pilot Runbook — CO (lunes 4 may 2026)

Webapp: Legal Team Tracker · Owner: Legal Ops · Cache TTL: 30s

## Antes del lunes
- **Equipos sheet:** verificar que cada miembro CO tiene su email en columna F (`emails`), alineado por índice con `members` (col E). Sin email no entra al allowlist.
- **Config sheet:** confirmar `Heads` (emails separados por coma), `DriveFolder` (URL o ID de la carpeta raíz), y los SLAs por prioridad/tipo de trabajo.
- **Smoke test:** abrir el editor de Apps Script → archivo `backend/tests.gs` → seleccionar `runPilotSmokeTest` → Run. Revisar logs (View → Logs). Todos los gates deben dar ✅.
- **Drive & Slack:** correr `runDriveFolderCheck` y `runSlackTokenCheck`. Ambos en ✅ antes del piloto.
- **Deploy:** confirmar que la última versión está publicada como webapp (Execute as: Me · Access: Anyone within rappi.com). Compartir el link `/exec` con el equipo CO.

## El día de la prueba
- **Compartir:** mandar el link del webapp por el canal Slack del equipo CO + recordatorio de que deben loguear con su cuenta @rappi.com.
- **Demo guiado (15 min):**
  1. Crear tarea desde la web (botón "+ Nueva tarea", asignar a un specialist CO).
  2. Crear tarea desde Slack (slash command / shortcut → modal). Confirmar que aparece en el dashboard tras 30s o forzando reload.
  3. Cerrar una tarea (cambiar estado a `Listo`) y verificar que pasa a Historial.
  4. Recorrer dashboard: KPIs, SLA, team grid, filtros por país (los managers solo ven CO; specialists solo sus tareas; head ve todo).

## Si algo falla
- **Datos viejos en pantalla:** el cache es de 30s. Esperar o ejecutar `invalidateCache()` desde el editor.
- **"Acceso denegado":** el email del usuario no está en Equipos. Agregarlo en col F (alineado al nombre en col E) y reintentar tras `invalidateCache()`.
- **Tarea sin país en dashboard:** el `resp` de la tarea no matchea exactamente con ningún `members` ni `leader` en Equipos. Corregir el nombre en la hoja Equipos o en la tarea (es match exacto, sensible a tildes/espacios).
- **Error de Slack (modal no abre, mensaje no llega):** revisar hoja `Slack Log` para ver el último error; verificar `SLACK_BOT_TOKEN` en Script Properties con `runSlackTokenCheck`.
- **Permiso Drive / adjuntos rotos:** `runDriveFolderCheck` debe pasar. Si falla, el owner del webapp necesita permisos sobre la carpeta de `Config!DriveFolder`.

## Después de la prueba
- **Feedback a recoger:** tiempos para crear tarea (web vs Slack), claridad del dashboard por rol, casos en que el rol/país no resolvió bien, bugs visuales, métricas que faltan.
- **Dónde dejarlo:** archivo `pendientes/` del repo (un md por sesión: `pilot-co-feedback-YYYY-MM-DD.md`) + thread en el canal Slack del equipo. Si hay bug con repro clara, abrir issue en GitHub con label `pilot-co`.
