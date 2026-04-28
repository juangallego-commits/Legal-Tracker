# Legal Tracker

Web app del equipo Global Legal de Rappi+ para hacer seguimiento de tareas y proyectos legales por país, líder, prioridad y estado. Construida sobre Google Apps Script con Google Sheets como base de datos.

## Stack

- **Backend**: Google Apps Script (`.gs`)
- **Frontend**: HTML + CSS + JS servidos vía `HtmlService` (templates de Apps Script)
- **Datos**: Google Sheets (`Tracking Activo`, `Historial`, `Config`, `Equipos`, `Proyectos`)
- **Auth**: Google SSO + allowlist en la hoja `Equipos`
- **Integraciones**: Slack (modal de creación/edición), Drive (documentos por tarea/proyecto)
- **Deploy**: [clasp](https://github.com/google/clasp) + GitHub Actions (push a `main` → push automático a Apps Script)

## Estructura

```
.
├── appsscript.json          Manifiesto de Apps Script (debe quedarse en raíz)
├── backend/
│   ├── codigo.gs            Lógica principal (auth, CRUD, cache, render)
│   └── SlackModal.gs        Integración con Slack
├── frontend/
│   ├── Dashboard.html       Shell HTML del dashboard
│   ├── Dashboard.css.html   Estilos
│   └── Dashboard.js.html    Lógica del cliente
├── pendientes/              Cosas sin implementar todavía (handoffs, drafts)
├── .github/workflows/
│   └── deploy-appsscript.yml   CI que despliega a Apps Script en cada push a main
└── .clasp.json.example      Plantilla para tu .clasp.json local
```

> Nota: en el editor de Apps Script los archivos aparecen con el path completo (ej. `frontend/Dashboard`) porque así es como clasp publica las subcarpetas. Es esperado.

## Roles de usuarios

Determinados por la hoja `Config` y la allowlist de `Equipos`:

- **head**: ve resumen ejecutivo de todos los equipos
- **manager** / líder: ve y gestiona su equipo
- **specialist**: ve sus tareas + las de su equipo

Si un email no está en la hoja `Equipos`, se le muestra una página de "acceso denegado".

## Desarrollo local

### Requisitos

- Node 20+
- [`clasp`](https://github.com/google/clasp) instalado: `npm install -g @google/clasp`
- Login: `clasp login`

### Setup

1. Copia `.clasp.json.example` a `.clasp.json` y reemplaza `PEGA_AQUI_TU_SCRIPT_ID` por el script ID del proyecto en Apps Script.
2. `clasp pull` para traer la última versión desde Apps Script (opcional si ya tienes el repo al día).
3. Edita los `.gs` y `.html` localmente.
4. `clasp push` para empujar tus cambios al editor de Apps Script y probar.

> Nunca subas `.clasp.json` ni `.clasprc.json` al repo (ya están en `.gitignore`).

## Deploy a producción

El workflow `.github/workflows/deploy-appsscript.yml` se dispara automáticamente con cada push a `main` y hace `clasp push -f` usando estos secrets del repo:

- `CLASPRC_JSON`: contenido completo de `~/.clasprc.json` (credenciales de clasp)
- `SCRIPT_ID`: el script ID del proyecto

Flujo recomendado:

1. Crear rama desde `main` → `git checkout -b feature/lo-que-sea`
2. Commitear cambios
3. `git push -u origin feature/lo-que-sea`
4. Abrir Pull Request hacia `main`
5. Mergear → el deploy se ejecuta solo

## Cache

`codigo.gs` cachea el snapshot completo de datos por 30s vía `CacheService`. Cualquier escritura llama a `invalidateCache()` para que el siguiente lector vea los datos frescos.
