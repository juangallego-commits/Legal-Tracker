# Publicar el Gmail Add-on para todo el equipo Legal (Workspace Marketplace)

Runbook para distribuir el complemento de Gmail de **Legal Tracker** a todo el
equipo, vía **Google Workspace Marketplace como app privada** (Opción B). Es la
única forma soportada de instalar el add-on en el Gmail de muchas personas sin
darles acceso al proyecto de Apps Script.

> **El código ya está listo** (`backend/gmailAddon.gs`, manifiesto en
> `appsscript.json`). Esto es 100% trabajo de despliegue y permisos — no hay nada
> que programar.

---

## Quién hace qué (accesos necesarios)

| Rol | Para qué | Pasos |
|-----|----------|-------|
| **Head / dev** (vos) | Apps Script + (idealmente) el proyecto GCP | 1, 2, 3, 4, 5, 6, "Mantener actualizado" |
| **Owner/Editor del proyecto GCP** | Crear/configurar GCP + Marketplace SDK | 1, 2, 3, 5 (puede ser vos o IT) |
| **Workspace super admin (IT)** | Instalar la app org-wide para Legal | 7 |

---

## Prerrequisitos

- **Código desplegado**: el CI ya hace `clasp push` en cada merge a `main`. No hay
  que tocar nada del add-on.
- **Scopes** (ya en `appsscript.json`): `gmail.addons.execute`,
  `gmail.addons.current.message.readonly`, más los del proyecto (Sheets, Drive,
  Calendar read-only, send_mail, external_request).
- **`Config!DriveFolder`** (PENDIENTES #8): necesario solo si querés que el add-on
  suba los **adjuntos** del correo a la tarea. Sin esto la tarea se crea igual,
  pero los adjuntos fallan (la card lo avisa).
- **`GEMINI_API_KEY`** (PENDIENTES #13): opcional, habilita el super-fill con IA.
  Sin la key cae a heurística por keywords.

---

## Parte 1 — Vincular Apps Script a un proyecto GCP estándar

El proyecto GCP por defecto que crea Apps Script **no** sirve para publicar en
Marketplace. Hay que usar uno estándar.

1. En [console.cloud.google.com](https://console.cloud.google.com) creá (o reusá)
   un proyecto GCP. Anotá su **número de proyecto** (no el ID).
2. En el editor de Apps Script: **⚙ Configuración del proyecto** → sección
   *Proyecto de Google Cloud Platform (GCP)* → **Cambiar proyecto** → pegá el
   número → **Establecer proyecto**.

## Parte 2 — Pantalla de consentimiento OAuth = **Internal**

En el proyecto GCP → **APIs y servicios → Pantalla de consentimiento de OAuth**:

1. **Tipo de usuario: Internal** (solo cuentas `@rappi.com`). Esto evita la
   verificación/revisión de seguridad de Google — clave: por ser interno, **no hay
   proceso de aprobación de Google**.
2. Completá nombre de la app (`Legal Tracker`), correo de asistencia, dominio
   autorizado (`rappi.com`) y correo del desarrollador. Logo opcional.
3. Los scopes que listés acá deben **coincidir** con los de `appsscript.json`.

## Parte 3 — Habilitar el Marketplace SDK

En el GCP → **APIs y servicios → Biblioteca** → buscá
**"Google Workspace Marketplace SDK"** → **Habilitar**.

## Parte 4 — Crear el deployment del add-on

En el editor de Apps Script → **Implementar (Deploy) → Nueva implementación** →
tipo **Complemento (Add-on)** → **Implementar**.

➡️ **Copiá el ID de implementación (Deployment ID).** Lo vas a usar en la Parte 5
y como secret de CI ("Mantener actualizado").

## Parte 5 — Configurar el Marketplace SDK

En el GCP → **Google Workspace Marketplace SDK**:

**App Configuration (Configuración de la app):**
- **Visibilidad: Privada** (solo mi dominio).
- **Instalación: por administrador** (recomendado — IT controla quién la recibe).
- **Integración de la app** → *Extensiones de Google Workspace* → **Gmail add-on**
  → origen **Apps Script** → pegá el **Deployment ID** de la Parte 4.
- **Scopes de OAuth**: listá los del add-on (deben coincidir con `appsscript.json`).

**Store Listing (Ficha):**
- Nombre, descripción corta y larga, **ícono** (p. ej. 120×120), al menos **1
  captura de pantalla**, categoría, idioma, y URLs de soporte/privacidad/términos
  (pueden ser enlaces internos).

## Parte 6 — Publicar

Publicá la ficha. Al ser **privada/interna**, queda disponible para el dominio
**sin revisión de Google**.

## Parte 7 — Instalar org-wide (IT / Workspace super admin)

En [admin.google.com](https://admin.google.com) → **Aplicaciones → Apps de Google
Workspace Marketplace → Lista de apps → Agregar app**:

1. Buscá la app privada (o entrá por su link).
2. **Instalar (admin)** → elegí una **OU o grupo** (el de **Legal**), **no** toda
   la organización.
3. Aceptá el acceso a datos (los scopes).
4. Opcional: marcá que se **instale automáticamente** para esos usuarios (así les
   aparece sin que cada uno la instale).

## Parte 8 — Por usuario (autorización + allowlist)

- El ícono de Legal Tracker aparece en la **barra derecha de Gmail**. La primera
  vez, la persona **consiente los permisos** (interno → sin revisión).
- Para **crear tareas**, su email `@rappi.com` debe estar en la hoja **`Equipos`**.
  Si no, ve la card *"No estás autorizado… pedile a un head que te agregue"*
  (mismo allowlist que la web app — quien ya usa la app, ya está).

---

## Mantener el add-on actualizado (importante)

El CI hace `clasp push` (código HEAD) + redeploy **de la web app**. El add-on
tiene su **propia** implementación, así que sus cambios **no** llegan solos.

➡️ Seteá el secret de repo **`ADDON_DEPLOYMENT_ID`** = el Deployment ID de la
Parte 4. El workflow `deploy-appsscript.yml` ya tiene un paso que, si ese secret
existe, hace `clasp deploy --deploymentId` del add-on en cada merge a `main`
(misma implementación, versión nueva → los cambios llegan a los usuarios sin
re-publicar ni re-instalar).

> ⚠️ Si **cambian los scopes** en `appsscript.json`, los usuarios (y a veces el
> admin en la consola) deben **re-consentir**. Cambios solo de código no.

---

## Verificación (smoke test)

1. **Vos**: abrí un correo → ícono Legal Tracker → "Crear tarea" → se crea en el
   tracker.
2. **Alguien de Legal (en `Equipos`)**: idem.
3. **Alguien fuera de `Equipos`**: debe ver "No estás autorizado".

## Troubleshooting

| Síntoma | Causa probable / fix |
|---------|----------------------|
| No aparece el ícono | El admin no instaló, o no es la OU correcta, o falta refrescar Gmail (esperá unos minutos y recargá). |
| "No estás autorizado" | Falta el email en la hoja `Equipos` (columna de email). |
| "No pude leer el correo / no permission" | Falta consentir el scope de lectura del mensaje → reinstalar/reautorizar. |
| Los adjuntos fallan | Falta `Config!DriveFolder` (#8). La tarea igual se crea. |
| La IA no pre-llena | Falta `GEMINI_API_KEY`, o 429 por cuota. Cae a heurística. |

## Checklist

- [ ] Proyecto GCP estándar vinculado (Parte 1)
- [ ] Pantalla de consentimiento OAuth = **Internal** (Parte 2)
- [ ] Marketplace SDK habilitado (Parte 3)
- [ ] Deployment del add-on creado · **Deployment ID** anotado (Parte 4)
- [ ] App Configuration + Store Listing **privada** publicada (Partes 5-6)
- [ ] Admin instaló para la OU/grupo de **Legal** (Parte 7)
- [ ] Secret `ADDON_DEPLOYMENT_ID` seteado en el repo (Mantener actualizado)
- [ ] Miembros del equipo en la hoja `Equipos` (Parte 8)
- [ ] Smoke test OK
