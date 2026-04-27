# Legal Tracker · Contexto del proyecto

App interna del equipo Legal de Rappi para tracking de tareas y proyectos.

## Stack

- **Frontend**: 3 archivos en Apps Script (`Dashboard.html`, `Dashboard.css.html`, `Dashboard.js.html`). Sin build, sin npm, vanilla JS+CSS.
- **Backend**: `codigo.gs` + `SlackModal.gs` (Apps Script). Datos en Google Sheets.
- **Deploy**: Web App pública servida desde Apps Script.

## Cómo se desarrolla (abril 2026)

GitHub es la fuente de verdad. **Ya NO se copia/pega al editor de Apps Script.**

Flujo:
1. Edita archivos en GitHub (web o local).
2. Commit + push a `main`.
3. GitHub Actions corre `.github/workflows/deploy-appsscript.yml` y empuja con `clasp` a Apps Script.
4. ~30 segundos después, los archivos están actualizados en el editor de Apps Script.

Configuración:
- Secrets en GitHub: `CLASPRC_JSON` (credenciales OAuth de clasp) y `SCRIPT_ID`.
- `appsscript.json` está commiteado, contiene scopes y config de webapp.
- `.clasp.json` está en `.gitignore`. Solo existe localmente si trabajas con clasp en tu máquina.

⚠️ **Nunca editar en el editor de Apps Script.** Cualquier cambio se sobrescribe en el siguiente push desde GitHub.

## Deployment a producción (sigue siendo manual)

`clasp` empuja el código automáticamente, pero la URL `/exec` está pinned a una versión congelada del deployment.

- **Para validar durante desarrollo**: usar siempre la URL `/dev` (Test deployments en Apps Script). Esa sí sirve el HEAD del código.
- **Para publicar a `/exec`**: Apps Script → Implementar → Administrar implementaciones → Editar (✏️) → Versión: "Nueva versión" → Implementar.
- **Cache del navegador es agresivo**: validar en incógnito o con DevTools "Disable cache".

(Pendiente futuro: automatizar también `clasp deploy` en el workflow.)

## Convenciones de código

- **Tokens CSS**: nombres legacy preservados (`--rappi`, `--surface`, etc.) con valores cambiados a editorial; aliases semánticos nuevos (`--accent`, `--paper`, `--ink`, `--critical`, `--warn`, `--good`, `--info`, `--rule`).
- **Tema dual**: light por default, dark vía `<html data-theme="dark">`. Helpers `getTok(name)` y `setTheme(theme)` en `Dashboard.js.html`.
- **Charts**: leen colores vía `chartTheme()` (que usa `getTok`), nada hardcoded.
- **Defensividad ante Chart.js no cargando**: ningún uso de `Chart.` al script-load. Cada `new Chart()` con guard `if (typeof Chart === 'undefined') return;`.
- **Build-tag visible**: `console.log('Legal Tracker · build <id>')` al inicio de `Dashboard.js.html` para verificar qué versión se sirve.

## Convenciones de Git

- Trabajar en una rama por feature/fase, nunca directo en `main`.
- Mensajes: `Redesign Editorial · Fase N: <descripción>` o `Fix#N: <descripción>`.
- No mergear a `main` hasta validar el conjunto en `/dev`.

## Estado del rediseño Editorial

**Dirección elegida**: Editorial deliberado (cream `#FAFAF7` + terracota `#B8551F`, Fraunces serif italic en H1/números hero, Nunito Sans para el resto). Rediseño completo, no re-skin. Mobile fuera de alcance hasta validar desktop.

### Fase 0 — Foundations

**Estado: parcial en `main`.** PR#4 mergeó solo el commit base (`9988ebb`) sin los fixes posteriores. Significa que cualquiera que lea desde `main` tiene código que falla cuando Chart.js no carga.

Fixes pendientes (quedaron en la rama vieja `claude/review-frontend-redesign-RfVte`):
- `d406668` — Fix#1: Chart.js defensivo (`typeof` guards en `new Chart`).
- `1e49293` — Fix#2: eliminar referencia a `Chart` en script-load + BUILD-TAG visible.

**Acción al retomar**: mergear estos fixes a `main` antes de empezar Fase 1. Ahora con el deploy automático validarlos es trivial.

### Fases 1-6 (planeadas, no iniciadas)

1. **Fase 1**: Layout shell — sidebar 218px por rol, header con search + botón Nuevo.
2. **Fase 2**: Tracker reescrito — toolbar pill, tabla editorial, panel lateral 440px (`.tk-panel*`) con detalle + timeline. Opcional 2.5: endpoint `getTaskHistory(id)` en `codigo.gs`.
3. **Fase 3**: Home por rol — `vHome` reemplaza `vResumen`. Variantes specialist / manager / hq.
4. **Fase 4**: Vista agrupada por urgencia — buckets vencidas / hoy / esta semana / más adelante / bloqueadas.
5. **Fase 5**: Wizard Crear (2 pasos + IA) — reemplaza modal actual. Endpoint nuevo `suggestTaskAttrs({title, description, type, country})` en `codigo.gs` que devuelve `{priority, suggestedAssignee, sla, similarTasks}`. Heurística sobre histórico del Sheet primero; LLM real (Anthropic API) después con misma firma.
6. **Fase 6**: Limpieza de legacy — eliminar vistas/CSS no usados, auditar `SlackModal.gs` por selectores DOM viejos, verificación por rol.

### Material de referencia

El zip `Legal Tracker-handoff (1).zip` fue eliminado del repo (4.4 MB innecesarios). **Una nueva versión del diseño está en preparación con Claude Design.** Cuando llegue el nuevo handoff:
- NO subirlo al repo, mantenerlo en una carpeta local separada.
- Apuntar a Claude Code a esa ruta para que compare con `Dashboard.*` y proponga plan de migración.

Componentes que veníamos portando a vanilla JS/CSS (referencia mental):
`editorial-shared.jsx` (tokens + sidebar + header), `shared-components.jsx` (SVG icons, Avatar, Sparkline, LoadBar), `editorial-data.jsx` (modelo), `ed-tracker.jsx`, `ed-home-specialist.jsx`, `ed-home-manager-hq.jsx`, `ed-agrupadas.jsx`, `ed-crear.jsx`.

## Backend

`codigo.gs` y `SlackModal.gs` no se tocan salvo lo descrito en Fase 2.5 y Fase 5. Schema de la Sheet cubre todo lo necesario, no se modifica.

## Plan inmediato (mientras llega el nuevo diseño)

1. Decidir si mergear los fixes #1 y #2 de la rama vieja a `main`, o redoarlos limpios. Ahora con el deploy automático tarda minutos.
2. Auditar el repo: ¿queda algo más residual aparte del zip que ya borramos?
3. Cuando llegue el nuevo handoff: rama nueva, plan revisado, empezar Fase 1.
