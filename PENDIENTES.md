# Pendientes manuales · Legal Tracker

Cosas que **no se pueden automatizar desde el código** y hay que hacer a mano
(en el editor de Apps Script, la hoja de Google, o la consola de Slack/Google).
Se va actualizando a medida que avanzamos.

> Para correr funciones admin: editor de Apps Script → dropdown de funciones →
> elegir la función → **Run**. Requieren estar en `Config!Heads`.

## 🔴 Para que funcionen features ya construidas

| # | Qué | Cómo | Por qué |
|---|-----|------|---------|
| 1 | **Borrar las 3 plantillas de ejemplo** | Correr `clearSampleTemplates()` | Eran data sembrada que se ve "inventada". Como specialist no podés borrar aprobadas; esta función las purga. |
| 2 | **Encender el digest diario** | Correr `installDigestTrigger()` | El digest no corría porque faltaba el trigger time-based (se crea a mano). Esto instala el diario ~8am. |
| 3 | **Re-autorizar la app (scope de mail)** | Tras el próximo deploy, correr cualquier función desde el editor y aceptar permisos | Se agregó `script.send_mail` al manifiesto (faltaba). Sin re-auth, `MailApp.sendEmail` del digest sigue fallando. |
| 4 | **Configurar `Config!DriveFolder`** | En la hoja `Config`, key `DriveFolder` = URL/ID de la carpeta raíz de Drive | Necesario para **subir archivos** en Biblioteca → Documentos (y adjuntos de tareas). Los *enlaces* funcionan sin esto. |
| 5 | **Publicar producción** | Editor → Deploy → Manage deployments → New version | El push a `main` actualiza solo la URL `/dev`. La URL `/exec` (prod) requiere "New version" manual. |

## 🟡 Slack (a revisar a fondo en una sesión dedicada)

| # | Qué | Cómo / Nota |
|---|-----|-------------|
| 6 | `SLACK_BOT_TOKEN` | Script Property (xoxb-…). Editor → Project Settings → Script Properties. |
| 7 | `SLACK_SIGNING_SECRET` | Script Property (signing secret de la Slack app). |
| 8 | **Config de la Slack app** | En api.slack.com: slash commands + shortcuts → Request URL = la URL `/exec` del webapp. |
| 9 | **Verificación de firma DESACTIVADA** (`_SLACK_SIG_ENFORCED = false`) | Limitación de Apps Script (no expone headers HTTP en `doPost`). Riesgo: cualquiera con la URL podría crear/cerrar tareas. **Workaround pendiente: proxy en Cloud Function** que valide la firma y reenvíe. |

## 🟢 Workstreams abiertos (próximas sesiones)

- **Slack end-to-end**: revisar el flujo completo y cerrar el gap de firma (#9).
- **Calendar de Google** (decidido: *ver + crear tareas desde eventos*). Plan v1 de la próxima tanda:
  - Manifiesto: agregar scope `calendar.readonly` → **re-autorizar** tras deploy.
  - `Config!CalendarId` = ID del calendario compartido del equipo (manual, como `DriveFolder`). Fallback al primario.
  - Backend: `getUpcomingCalendarEvents()` (lee próximos ~14 días) + `createTaskFromCalendarEvent(eventId)` (arma la tarea: nombre=título, deadline=fecha del evento, notas=descripción, resp=usuario actual; reusa `addTask`).
  - Frontend: ítem "Calendario" en el sidebar + vista que lista eventos próximos con botón "Crear tarea" por evento (one-click, no auto-trigger en v1 para evitar duplicados).
  - v2 (después): import automático vía trigger, parseando un marcador en las notas del evento.
- **Polish de UI**: barrido de pantallas que se ven mal/inconsistentes. Empezado por el buscador (Cmd+K). Siguiente candidato: pills de prioridad ("Media" se ve pesado en dark).

## ✅ Resuelto en código (no requiere acción manual)

- Buscador Cmd+K: foco limpio (sin rectángulo naranja) + hints sin duplicar + empty/section con padding.
