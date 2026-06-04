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
  var info = _gmailReadMessage(e);
  // Auth + config para poblar dropdowns role-aware. Si el visitante no está
  // autorizado en Legal Tracker, mostramos una card clara en vez de un form
  // que igual va a fallar al enviar.
  var ctx = null, clientes = [];
  try {
    ctx = _getAuthContext();
    clientes = _gmailClientes(ctx.ss);
  } catch (err) {
    return [_gmailUnauthorizedCard()];
  }
  return [_gmailBuildCreateCard(info, ctx, clientes)];
}

// Lee el correo abierto con el token de mensaje actual (scope angosto). Devuelve
// asunto, remitente, fecha, link al hilo, y un snippet del cuerpo para inferir
// el tipo de trabajo. Tolerante a fallos: si no puede leer, devuelve vacíos.
function _gmailReadMessage(e) {
  var info = { subject: '', from: '', dateStr: '', threadId: '', bodySnippet: '', notesPrefill: '' };
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var message = GmailApp.getMessageById(e.gmail.messageId);
    info.subject = message.getSubject() || '';
    info.from = message.getFrom() || '';
    var date = message.getDate();
    info.dateStr = date ? Utilities.formatDate(date, 'America/Bogota', 'dd/MM/yyyy') : '';
    info.threadId = e.gmail.threadId || message.getThread().getId();
    try { info.bodySnippet = (message.getPlainBody() || '').slice(0, 1000); } catch (e2) {}
    info.notesPrefill = 'Desde correo de ' + info.from
      + (info.dateStr ? ' · ' + info.dateStr : '')
      + '\nVer correo: ' + _gmailThreadLink(info.threadId);
  } catch (err) {}
  return info;
}

// ── Card de creación ────────────────────────────────────────────────
function _gmailBuildCreateCard(info, ctx, clientes) {
  var canAssignOthers = ctx && (ctx.role === 'manager' || ctx.role === 'head');
  var section = CardService.newCardSection();

  // Nombre (del asunto)
  section.addWidget(CardService.newTextInput()
    .setFieldName('nombre')
    .setTitle('Nombre de la tarea')
    .setValue(info.subject || ''));

  // Tipo de trabajo — pre-seleccionado por inferencia de keywords del correo.
  var inferred = _gmailInferTipo((info.subject || '') + ' ' + (info.bodySnippet || ''));
  var tipoInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('tipoTrabajo')
    .setTitle('Tipo de trabajo');
  tipoInput.addItem('— Sin definir —', '', inferred === '');
  _GMAIL_TIPOS.forEach(function(tp) { tipoInput.addItem(tp, tp, tp === inferred); });
  section.addWidget(tipoInput);

  // Prioridad
  var prioInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('priority')
    .setTitle('Prioridad');
  ['Alta', 'Media', 'Baja'].forEach(function(p) { prioInput.addItem(p, p, p === 'Media'); });
  section.addWidget(prioInput);

  // Plazo (opcional)
  section.addWidget(CardService.newDatePicker()
    .setFieldName('deadline')
    .setTitle('Plazo (opcional)'));

  // Cliente / área solicitante (de Config.ClientesInternos)
  if (clientes && clientes.length) {
    var cliInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('areaSolicitante')
      .setTitle('Área solicitante (cliente interno)');
    cliInput.addItem('— Sin definir —', '', true);
    clientes.forEach(function(c) { cliInput.addItem(c, c, false); });
    section.addWidget(cliInput);
  }

  // Responsable — solo manager/head pueden asignar a otros. El specialist queda
  // implícito (self) sin mostrar selector. Self siempre primero + pre-seleccionado.
  if (canAssignOthers) {
    var selfName = ctx.user.name;
    var list = [selfName];
    _gmailAssignableMembers(ctx).forEach(function(m) { if (m && list.indexOf(m) < 0) list.push(m); });
    var respInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('resp')
      .setTitle('Responsable');
    list.forEach(function(m) { respInput.addItem(m + (m === selfName ? ' (vos)' : ''), m, m === selfName); });
    section.addWidget(respInput);

    // Confidencialidad — solo manager/head (consistente con el backend, que
    // fuerza 'estandar' para specialist). Labels alineadas con la app.
    var confInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('confidencialidad')
      .setTitle('Confidencialidad');
    confInput.addItem('Normal', 'estandar', true);
    confInput.addItem('Confidencial', 'restringido', false);
    confInput.addItem('Altamente confidencial', 'confidencial', false);
    section.addWidget(confInput);
  }

  // Notas (contexto del correo, editable)
  section.addWidget(CardService.newTextInput()
    .setFieldName('notas')
    .setTitle('Notas')
    .setMultiline(true)
    .setValue(info.notesPrefill || ''));

  // Crear
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

// Card para visitante no autorizado en Legal Tracker.
function _gmailUnauthorizedCard() {
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph()
    .setText('No estás autorizado en Legal Tracker.\n\nPedile a un head que te agregue al equipo (hoja Equipos) para crear tareas desde el correo.'));
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Legal Tracker'))
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
    deadline: _gmailDateValue(e, 'deadline') || '',
    areaSolicitante: _gmailFormValue(e, 'areaSolicitante') || '',
    confidencialidad: _gmailFormValue(e, 'confidencialidad') || 'estandar',
    notas: _gmailFormValue(e, 'notas') || ''
  };

  // Responsable: el selector (manager/head) o, si no hay selector, el propio
  // usuario. Default a self satisface el guard de specialist y es lo natural al
  // crear desde la propia inbox. addTask valida server-side el permiso por rol.
  var pickedResp = _gmailFormValue(e, 'resp');
  var ctx;
  try {
    ctx = _getAuthContext();
  } catch (err) {
    return _gmailNotify('No estás autorizado en Legal Tracker. Pedile acceso a un head.');
  }
  taskObj.resp = pickedResp || ctx.user.name;

  var res;
  try {
    res = addTask(taskObj);
  } catch (err) {
    return _gmailNotify('Error: ' + ((err && err.message) || err));
  }
  if (res && res.success) {
    var who = (taskObj.resp === ctx.user.name) ? 'asignada a vos' : ('asignada a ' + taskObj.resp);
    return _gmailNotify('✓ Tarea #' + res.id + ' creada · ' + who + '.');
  }
  return _gmailNotify('No se pudo crear: ' + _friendlyGmailError(res));
}

// ── Helpers ─────────────────────────────────────────────────────────

// Permalink al hilo en Gmail (mismo usuario). Sirve para volver al correo
// desde la tarea.
function _gmailThreadLink(threadId) {
  return 'https://mail.google.com/mail/u/0/#all/' + threadId;
}

// Infiere el tipo de trabajo desde el texto del correo (asunto + snippet).
// Best-effort: si nada matchea devuelve '' (el usuario elige). El orden importa
// — chequeamos lo más específico (Contencioso/Privacy) antes que lo genérico
// (Contractual/Regulatorio), que tienen keywords más ambiguas.
function _gmailInferTipo(text) {
  var t = (text || '').toLowerCase();
  function has(words) {
    for (var i = 0; i < words.length; i++) { if (t.indexOf(words[i]) >= 0) return true; }
    return false;
  }
  if (has(['demanda', 'litig', 'juzgado', 'tutela', 'proceso judicial', 'fiscal', 'penal', 'laudo', 'arbitraje', 'notificación judicial', 'notificacion judicial'])) return 'Contencioso';
  if (has(['dato personal', 'datos personales', 'privacidad', 'habeas data', 'gdpr', 'tratamiento de datos', 'protección de datos', 'proteccion de datos', 'política de privacidad', 'politica de privacidad'])) return 'Privacy';
  if (has(['nda', 'contrato', 'acuerdo', 'convenio', 'cláusula', 'clausula', 'términos', 'terminos', 'contractual', 'minuta', 'adenda', 'otrosí', 'otrosi'])) return 'Contractual';
  if (has(['regulaci', 'regulatori', 'compliance', 'superintendencia', 'licencia', 'permiso', 'sanción', 'sancion', 'normativ'])) return 'Regulatorio';
  return '';
}

// Lista de clientes internos (área solicitante) desde Config.ClientesInternos,
// con el mismo fallback que el frontend / getBibliotecaConfig.
function _gmailClientes(ss) {
  var cfg = readConfig(ss);
  return (cfg.ClientesInternos || 'Restaurantes, Finanzas, Tesorería, Monetization')
    .toString().split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

// Miembros a los que el usuario puede asignar: manager → su país; head → todos.
// (El backend revalida en addTask; esto solo arma el dropdown.)
function _gmailAssignableMembers(ctx) {
  var out = [];
  (ctx.equipos || []).forEach(function(eq) {
    if (ctx.role === 'manager' && eq.code !== ctx.user.code) return;
    (eq.members || []).forEach(function(m) { if (m && out.indexOf(m) < 0) out.push(m); });
  });
  out.sort(function(a, b) { return a.localeCompare(b); });
  return out;
}

// Extrae el valor de un DatePicker como yyyy-MM-dd. El widget devuelve
// msSinceEpoch en UTC-midnight del día elegido; formateamos en GMT para no
// correr la fecha un día (formatear en America/Bogota la retrocedería).
function _gmailDateValue(e, key) {
  var ms = null;
  try {
    var fi = e && e.commonEventObject && e.commonEventObject.formInputs;
    if (fi && fi[key] && fi[key].dateInput && fi[key].dateInput.msSinceEpoch != null) {
      ms = Number(fi[key].dateInput.msSinceEpoch);
    }
  } catch (err) {}
  if (ms == null) {
    try {
      if (e && e.formInput && e.formInput[key] != null && !isNaN(Number(e.formInput[key]))) {
        ms = Number(e.formInput[key]);
      }
    } catch (err) {}
  }
  if (ms == null || isNaN(ms)) return '';
  return Utilities.formatDate(new Date(ms), 'GMT', 'yyyy-MM-dd');
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
