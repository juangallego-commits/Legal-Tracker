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

// ── Homepage: card que se ve al abrir el add-on sin un correo seleccionado ──
// Mejora descubribilidad: sin esto, el add-on solo muestra algo al abrir un
// correo, lo que confunde ("instalé y no veo nada"). Acá explicamos el flujo.
function onGmailHomepage(e) {
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph()
    .setText('Abrí un correo y tocá <b>Crear tarea</b> para registrarlo en Legal Tracker.\n\nEl asunto se usa como nombre y el remitente/fecha/link quedan en las notas.'));
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (err) {}
  if (url) {
    section.addWidget(CardService.newTextButton()
      .setText('Abrir Legal Tracker')
      .setOpenLink(CardService.newOpenLink().setUrl(url)));
  }
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Legal Tracker')
      .setSubtitle('Crear tareas desde el correo'))
    .addSection(section)
    .build();
}

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

  // Sección de contexto del correo (read-only): el usuario ve qué está
  // registrando. El link al hilo viaja aparte (parámetro de la acción), así no
  // se pierde si edita el campo de nota.
  var ctxSection = CardService.newCardSection();
  ctxSection.addWidget(CardService.newDecoratedText()
    .setTopLabel('Correo')
    .setText(info.subject || '(sin asunto)')
    .setWrapText(true));
  if (info.from) {
    ctxSection.addWidget(CardService.newDecoratedText()
      .setTopLabel('De')
      .setText(info.from + (info.dateStr ? ' · ' + info.dateStr : ''))
      .setWrapText(true));
  }

  var form = CardService.newCardSection();
  var fullText = (info.subject || '') + ' ' + (info.bodySnippet || '');

  // Nombre (del asunto)
  form.addWidget(CardService.newTextInput()
    .setFieldName('nombre')
    .setTitle('Nombre de la tarea')
    .setValue(info.subject || ''));

  // Tipo de trabajo — pre-seleccionado por inferencia de keywords del correo.
  var inferredTipo = _gmailInferTipo(fullText);
  var tipoInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('tipoTrabajo')
    .setTitle('Tipo de trabajo');
  tipoInput.addItem('— Sin definir —', '', inferredTipo === '');
  _GMAIL_TIPOS.forEach(function(tp) { tipoInput.addItem(tp, tp, tp === inferredTipo); });
  form.addWidget(tipoInput);

  // Prioridad — Alta si el correo suena urgente; sino Media.
  var inferredPrio = _gmailInferPriority(fullText);
  var prioInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('priority')
    .setTitle('Prioridad');
  ['Alta', 'Media', 'Baja'].forEach(function(p) { prioInput.addItem(p, p, p === inferredPrio); });
  form.addWidget(prioInput);

  // Plazo (opcional)
  form.addWidget(CardService.newDatePicker()
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
    form.addWidget(cliInput);
  }

  // Manager/head: responsable + confidencialidad + riesgo.
  if (canAssignOthers) {
    var selfName = ctx.user.name;
    var list = [selfName];
    _gmailAssignableMembers(ctx).forEach(function(m) { if (m && list.indexOf(m) < 0) list.push(m); });
    var respInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('resp')
      .setTitle('Responsable');
    list.forEach(function(m) { respInput.addItem(m + (m === selfName ? ' (vos)' : ''), m, m === selfName); });
    form.addWidget(respInput);

    var confInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('confidencialidad')
      .setTitle('Confidencialidad');
    confInput.addItem('Normal', 'estandar', true);
    confInput.addItem('Confidencial', 'restringido', false);
    confInput.addItem('Altamente confidencial', 'confidencial', false);
    form.addWidget(confInput);

    var riesgoInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('riesgo')
      .setTitle('Nivel de riesgo');
    riesgoInput.addItem('— Sin definir —', '', true);
    ['Legal', 'Reputacional', 'Negocio'].forEach(function(r) { riesgoInput.addItem(r, r, false); });
    form.addWidget(riesgoInput);
  }

  // Nota del usuario. El contexto del correo (remitente/fecha/link) se guarda
  // automáticamente vía parámetro de la acción — no se pierde si editan acá.
  form.addWidget(CardService.newTextInput()
    .setFieldName('notas')
    .setTitle('Tu nota (opcional)')
    .setHint('El remitente y el link al correo se guardan solos')
    .setMultiline(true));

  // Crear — el contexto del correo viaja como parámetro para reconstruir las
  // notas server-side sin depender de que el usuario no lo borre.
  var createAction = CardService.newAction()
    .setFunctionName('gmailCreateTaskFromEmail')
    .setParameters({ emailNote: info.notesPrefill || '' });
  form.addWidget(CardService.newTextButton()
    .setText('Crear tarea')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(createAction));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Crear tarea')
      .setSubtitle('Legal Tracker'))
    .addSection(ctxSection)
    .addSection(form)
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

// Card de éxito tras crear: confirma + ofrece abrir la app o crear otra desde
// el mismo correo (sin volver a la inbox).
function _gmailSuccessCard(res, taskObj, ctx) {
  var section = CardService.newCardSection();
  section.addWidget(CardService.newDecoratedText()
    .setTopLabel('Tarea creada')
    .setText('#' + res.id + ' · ' + (taskObj.nombre || ''))
    .setWrapText(true));
  var who = (taskObj.resp === ctx.user.name) ? 'Asignada a vos' : ('Asignada a ' + taskObj.resp);
  section.addWidget(CardService.newDecoratedText().setText(who).setWrapText(true));

  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (err) {}
  if (url) {
    section.addWidget(CardService.newTextButton()
      .setText('Abrir Legal Tracker')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOpenLink(CardService.newOpenLink().setUrl(url)));
  }
  section.addWidget(CardService.newTextButton()
    .setText('Crear otra desde este correo')
    .setOnClickAction(CardService.newAction().setFunctionName('gmailCreateAnother')));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('✓ Listo').setSubtitle('Legal Tracker'))
    .addSection(section)
    .build();
}

// "Crear otra": re-renderiza el form contextual del mismo correo en el lugar.
function gmailCreateAnother(e) {
  var info = _gmailReadMessage(e);
  var card;
  try {
    var ctx = _getAuthContext();
    card = _gmailBuildCreateCard(info, ctx, _gmailClientes(ctx.ss));
  } catch (err) {
    card = _gmailUnauthorizedCard();
  }
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

// ── Handler: crear la tarea ─────────────────────────────────────────
function gmailCreateTaskFromEmail(e) {
  var nombre = (_gmailFormValue(e, 'nombre') || '').trim();
  if (!nombre) return _gmailNotify('Falta el nombre de la tarea.');

  // Notas = contexto del correo (parámetro, siempre preservado) + nota del user.
  var emailNote = _gmailParam(e, 'emailNote') || '';
  var userNote = (_gmailFormValue(e, 'notas') || '').trim();
  var notas = emailNote + (userNote ? (emailNote ? '\n\n' : '') + userNote : '');

  var taskObj = {
    nombre: nombre,
    tipoTrabajo: _gmailFormValue(e, 'tipoTrabajo') || '',
    priority: _gmailFormValue(e, 'priority') || 'Media',
    deadline: _gmailDateValue(e, 'deadline') || '',
    areaSolicitante: _gmailFormValue(e, 'areaSolicitante') || '',
    confidencialidad: _gmailFormValue(e, 'confidencialidad') || 'estandar',
    riesgo: _gmailFormValue(e, 'riesgo') || '',
    notas: notas
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
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('✓ Tarea #' + res.id + ' creada'))
      .setNavigation(CardService.newNavigation().updateCard(_gmailSuccessCard(res, taskObj, ctx)))
      .build();
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

// Sugiere prioridad Alta si el correo transmite urgencia; sino Media. El usuario
// siempre puede cambiarla en el dropdown.
function _gmailInferPriority(text) {
  var t = (text || '').toLowerCase();
  function has(words) {
    for (var i = 0; i < words.length; i++) { if (t.indexOf(words[i]) >= 0) return true; }
    return false;
  }
  if (has(['urgente', 'urgent', 'asap', 'inmediato', 'inmediata', 'cuanto antes',
           'lo antes posible', 'crítico', 'critico', 'prioridad alta', 'hoy mismo',
           'para hoy', 'perentorio', 'improrrogable', 'time-sensitive'])) return 'Alta';
  return 'Media';
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

// Lee un parámetro de la acción (set vía setParameters), tolerante a ambos
// formatos de event object. Usado para pasar el contexto del correo al handler.
function _gmailParam(e, key) {
  try {
    if (e && e.commonEventObject && e.commonEventObject.parameters && e.commonEventObject.parameters[key] != null) {
      return e.commonEventObject.parameters[key];
    }
  } catch (err) {}
  try {
    if (e && e.parameters && e.parameters[key] != null) return e.parameters[key];
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
