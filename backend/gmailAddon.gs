// ════════════════════════════════════════════════════════════════
// GMAIL ADD-ON · Crear tarea desde un correo
// ════════════════════════════════════════════════════════════════
// Add-on contextual de Gmail: al abrir un correo, aparece una card de
// Legal Tracker con campos pre-llenados (asunto → nombre, remitente +
// link al hilo → notas). El usuario ajusta tipo/prioridad y crea la
// tarea. La tarea aparece en el tracker como cualquier otra.
//
// Arquitectura: el add-on es SOLO UI (CardService). La creación reusa
// addTask() del backend principal — mismo Apps Script project, llamada
// de función directa (sin HTTP). La identidad se resuelve igual que en
// el webapp: Session.getActiveUser() dentro de _getAuthContext(), así
// que los permisos por rol (specialist/manager/head) aplican idénticos.
//
// Manifest (appsscript.json):
//   - oauthScopes: gmail.addons.execute + gmail.addons.current.message.readonly
//   - addOns.gmail.contextualTriggers → onGmailMessageOpen
//
// Activación en Gmail: además del clasp push (sube el código), un head
// debe crear un "Test deployment" del add-on desde el editor de Apps
// Script (Deploy → Test deployments → Install) o publicarlo org-wide.
// Documentado en PENDIENTES.md.
// ════════════════════════════════════════════════════════════════

// Tipos de trabajo de tareas. Debe mantenerse en sync con _CR_TIPOS del
// frontend (Dashboard.js.html). addTask() no valida este enum (acepta
// cualquier string), así que el riesgo de drift es cosmético.
var _GMAIL_TIPOS = ['Contractual', 'Regulatorio', 'Contencioso', 'Privacy', 'Operativo'];

// ── Entry point: trigger contextual al abrir un correo ──────────────
function onGmailMessageOpen(e) {
  var info = { subject: '', notesPrefill: '' };
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var message = GmailApp.getMessageById(e.gmail.messageId);
    var subject = message.getSubject() || '';
    var from = message.getFrom() || '';
    var date = message.getDate();
    var threadId = e.gmail.threadId || message.getThread().getId();
    var dateStr = date ? Utilities.formatDate(date, 'America/Bogota', 'dd/MM/yyyy') : '';
    info.subject = subject;
    info.notesPrefill = 'Desde correo de ' + from
      + (dateStr ? ' · ' + dateStr : '')
      + '\nVer correo: ' + _gmailThreadLink(threadId);
  } catch (err) {
    // Si no podemos leer el correo (token/scope), igual mostramos la card
    // vacía para que el usuario pueda crear una tarea manual.
    info.notesPrefill = '';
  }
  return [_gmailBuildCreateCard(info)];
}

// ── Card de creación ────────────────────────────────────────────────
function _gmailBuildCreateCard(info) {
  var section = CardService.newCardSection();

  section.addWidget(CardService.newTextInput()
    .setFieldName('nombre')
    .setTitle('Nombre de la tarea')
    .setValue(info.subject || ''));

  var tipoInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('tipoTrabajo')
    .setTitle('Tipo de trabajo');
  tipoInput.addItem('— Sin definir —', '', true);
  _GMAIL_TIPOS.forEach(function(tp) { tipoInput.addItem(tp, tp, false); });
  section.addWidget(tipoInput);

  var prioInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('priority')
    .setTitle('Prioridad');
  ['Alta', 'Media', 'Baja'].forEach(function(p) { prioInput.addItem(p, p, p === 'Media'); });
  section.addWidget(prioInput);

  section.addWidget(CardService.newTextInput()
    .setFieldName('notas')
    .setTitle('Notas')
    .setMultiline(true)
    .setValue(info.notesPrefill || ''));

  section.addWidget(CardService.newTextButton()
    .setText('Crear tarea')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction().setFunctionName('gmailCreateTaskFromEmail')));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Crear tarea')
      .setSubtitle('Legal Tracker'))
    .addSection(section)
    .build();
}

// ── Handler: crear la tarea ─────────────────────────────────────────
function gmailCreateTaskFromEmail(e) {
  var nombre = (_gmailFormValue(e, 'nombre') || '').trim();
  if (!nombre) return _gmailNotify('Falta el nombre de la tarea.');

  var taskObj = {
    nombre: nombre,
    tipoTrabajo: _gmailFormValue(e, 'tipoTrabajo') || '',
    priority: _gmailFormValue(e, 'priority') || 'Media',
    notas: _gmailFormValue(e, 'notas') || ''
  };

  // Asignar a quien crea (está creando desde su propia inbox). Esto también
  // satisface el guard de addTask: un specialist solo puede crear tareas
  // asignadas a sí mismo. Manager/head pueden reasignar luego en la app.
  try {
    var ctx = _getAuthContext();
    taskObj.resp = ctx.user.name;
  } catch (err) {
    return _gmailNotify('No estás autorizado en Legal Tracker. Pedile acceso a un head.');
  }

  var res;
  try {
    res = addTask(taskObj);
  } catch (err) {
    return _gmailNotify('Error: ' + ((err && err.message) || err));
  }
  if (res && res.success) {
    return _gmailNotify('✓ Tarea #' + res.id + ' creada y asignada a vos.');
  }
  return _gmailNotify('No se pudo crear: ' + _friendlyGmailError(res));
}

// ── Helpers ─────────────────────────────────────────────────────────

// Permalink al hilo en Gmail (mismo usuario). Sirve para volver al correo
// desde la tarea.
function _gmailThreadLink(threadId) {
  return 'https://mail.google.com/mail/u/0/#all/' + threadId;
}

// Lee el valor de un campo del form de la card, tolerante a los dos formatos
// de event object (nuevo commonEventObject vs legacy formInput).
function _gmailFormValue(e, key) {
  try {
    var fi = e && e.commonEventObject && e.commonEventObject.formInputs;
    if (fi && fi[key] && fi[key].stringInputs && fi[key].stringInputs.value && fi[key].stringInputs.value.length) {
      return fi[key].stringInputs.value[0];
    }
  } catch (err) {}
  try {
    if (e && e.formInput && e.formInput[key] != null) return e.formInput[key];
  } catch (err) {}
  return '';
}

// Notificación efímera (toast) en Gmail.
function _gmailNotify(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}

// Copy corto para el error de addTask en el contexto del add-on.
function _friendlyGmailError(res) {
  if (!res) return 'desconocido';
  var code = res.code || '';
  if (code === 'LOCK_BUSY') return 'el servidor está ocupado, reintentá';
  if (code === 'SHEET_NOT_MIGRATED') return 'la hoja necesita migración';
  return (res.error || 'desconocido');
}
