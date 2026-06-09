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

// Caps de adjuntos: las acciones de Gmail add-on tienen ~30s de ejecución, y
// subir muchos/grandes archivos (decode base64 + Drive create) puede pasarse.
// Pre-marcamos solo los que entran en estos límites; el resto va desmarcado.
var _GMAIL_ATT_MAX_COUNT = 5;
var _GMAIL_ATT_MAX_TOTAL = 15 * 1024 * 1024; // 15 MB

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
  // Detección de duplicados: si ya existe una tarea (activa o cerrada) con este
  // threadId en notas, ofrecemos abrirla en vez de crear una segunda. El usuario
  // siempre puede forzar "crear igual" desde esa card.
  if (info.threadId) {
    var dup = _gmailFindTaskByThread(ctx.ss, info.threadId);
    if (dup) return [_gmailDuplicateCard(dup, info, ctx, clientes)];
  }
  // AI enrich: Gemini pre-llena todo lo que pueda inferir del correo. Si no hay
  // API key o falla, ai === null y el render cae a la heurística existente.
  var ai = _gmailAIEnrich(info, clientes);
  return [_gmailBuildCreateCard(info, ctx, clientes, ai)];
}

// Lee el correo abierto con el token de mensaje actual (scope angosto). Devuelve
// asunto, remitente, fecha, link al hilo, y un snippet del cuerpo para inferir
// el tipo de trabajo. Tolerante a fallos: si no puede leer, devuelve vacíos.
function _gmailReadMessage(e) {
  var info = { messageId: '', subject: '', from: '', dateStr: '', threadId: '', body: '', bodySnippet: '', notesPrefill: '', attachments: [] };
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    info.messageId = e.gmail.messageId || '';
    var message = GmailApp.getMessageById(e.gmail.messageId);
    info.subject = message.getSubject() || '';
    info.from = message.getFrom() || '';
    var date = message.getDate();
    info.dateStr = date ? Utilities.formatDate(date, 'America/Bogota', 'dd/MM/yyyy') : '';
    info.threadId = e.gmail.threadId || message.getThread().getId();
    // Cuerpo: completo para la IA (truncado al cap de prompt), snippet corto
    // para la heurística (sigue siendo el fallback si IA no anda).
    try {
      info.body = (message.getPlainBody() || '').slice(0, 8000);
      info.bodySnippet = info.body.slice(0, 1000);
    } catch (e2) {}
    // Metadata de adjuntos (sin bytes): excluimos inline (firmas/logos del HTML).
    // El índice acá debe coincidir con la re-lectura al crear → mismas opciones.
    try {
      var atts = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
      info.attachments = atts.map(function(a, idx) {
        return { name: a.getName(), size: a.getSize(), idx: idx };
      });
    } catch (e3) { info.attachments = []; }
    info.notesPrefill = 'Desde correo de ' + info.from
      + (info.dateStr ? ' · ' + info.dateStr : '')
      + '\nVer correo: ' + _gmailThreadLink(info.threadId);
  } catch (err) {
    // Capturamos el error para poder diagnosticar (antes se tragaba en silencio
    // y el síntoma era "(sin asunto)" + IA que no corre).
    info.readError = (err && err.message) || String(err);
    info.gmailFieldPresent = !!(e && e.gmail);
    info.tokenPresent = !!(e && e.gmail && e.gmail.accessToken);
  }
  return info;
}

// ── Card de creación ────────────────────────────────────────────────
function _gmailBuildCreateCard(info, ctx, clientes, ai) {
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
  // Diagnóstico: si no se pudo leer el correo, lo mostramos en vez de tragarlo.
  if (info.readError || !info.subject) {
    var diag = info.readError
      ? ('⚠️ No pude leer el correo: ' + info.readError
         + ' · gmail=' + (info.gmailFieldPresent ? 'sí' : 'no')
         + ' · token=' + (info.tokenPresent ? 'sí' : 'no'))
      : '⚠️ El correo abierto no tiene asunto, o el add-on se abrió sin un correo seleccionado.';
    ctxSection.addWidget(CardService.newDecoratedText().setText(diag).setWrapText(true));
  }

  // Pre-fill por campo: IA primero (cuando trajo un valor válido), heurística
  // por keywords como fallback. Ambas pueden quedar vacías sin romper nada — el
  // usuario llena lo que falta antes de crear.
  var fullText = (info.subject || '') + ' ' + (info.bodySnippet || '');
  var pre = {
    nombre:           (ai && ai.nombre)            || info.subject || '',
    tipoTrabajo:      (ai && ai.tipoTrabajo)       || _gmailInferTipo(fullText),
    priority:         (ai && ai.priority)          || _gmailInferPriority(fullText),
    deadline:         (ai && ai.deadline)          || '',
    areaSolicitante:  (ai && ai.areaSolicitante)   || '',
    confidencialidad: (ai && ai.confidencialidad)  || 'estandar',
    riesgo:           (ai && ai.riesgo)            || '',
    contraparte:      (ai && ai.contraparte)       || '',
    acc:              (ai && ai.acc)               || '',
    notas:            (ai && ai.notas)             || ''
  };

  var form = CardService.newCardSection();

  // Badge cuando la IA aportó pre-fill — pone al usuario en modo "revisar"
  // en vez de "completar de cero".
  if (ai) {
    form.addWidget(CardService.newDecoratedText()
      .setText('✨ <b>Pre-llenado con IA</b> — revisá los campos y ajustá lo que haga falta antes de crear.')
      .setWrapText(true));
  } else if (info.subject || info.body) {
    // El correo se leyó pero la IA no produjo nada: distinguir sin-key vs falló.
    var keyPresent = false;
    try { keyPresent = !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); } catch (e) {}
    form.addWidget(CardService.newDecoratedText()
      .setText(keyPresent
        ? 'ℹ️ La IA no respondió (red/quota). Los campos quedan con la heurística básica.'
        : 'ℹ️ IA desactivada: falta GEMINI_API_KEY en Propiedades del script.')
      .setWrapText(true));
  }

  // Nombre
  form.addWidget(CardService.newTextInput()
    .setFieldName('nombre')
    .setTitle('Nombre de la tarea')
    .setValue(pre.nombre));

  // Tipo de trabajo
  var tipoInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('tipoTrabajo')
    .setTitle('Tipo de trabajo');
  tipoInput.addItem('— Sin definir —', '', pre.tipoTrabajo === '');
  _GMAIL_TIPOS.forEach(function(tp) { tipoInput.addItem(tp, tp, tp === pre.tipoTrabajo); });
  form.addWidget(tipoInput);

  // Prioridad
  var prioInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('priority')
    .setTitle('Prioridad');
  ['Alta', 'Media', 'Baja'].forEach(function(p) { prioInput.addItem(p, p, p === pre.priority); });
  form.addWidget(prioInput);

  // Plazo (DatePicker acepta msSinceEpoch en UTC-midnight del día elegido)
  var datePicker = CardService.newDatePicker()
    .setFieldName('deadline')
    .setTitle('Plazo (opcional)');
  if (pre.deadline) {
    var m = String(pre.deadline).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      var dtMs = Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      datePicker.setValueInMsSinceEpoch(dtMs);
    }
  }
  form.addWidget(datePicker);

  // Cliente / área solicitante
  if (clientes && clientes.length) {
    var cliInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('areaSolicitante')
      .setTitle('Área solicitante (cliente interno)');
    cliInput.addItem('— Sin definir —', '', !pre.areaSolicitante);
    clientes.forEach(function(c) { cliInput.addItem(c, c, c === pre.areaSolicitante); });
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
    confInput.addItem('Normal', 'estandar', pre.confidencialidad === 'estandar');
    confInput.addItem('Confidencial', 'restringido', pre.confidencialidad === 'restringido');
    confInput.addItem('Altamente confidencial', 'confidencial', pre.confidencialidad === 'confidencial');
    form.addWidget(confInput);

    var riesgoInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName('riesgo')
      .setTitle('Nivel de riesgo');
    riesgoInput.addItem('— Sin definir —', '', !pre.riesgo);
    ['Legal', 'Reputacional', 'Negocio'].forEach(function(r) { riesgoInput.addItem(r, r, r === pre.riesgo); });
    form.addWidget(riesgoInput);
  }

  // Contraparte (texto libre). Lo mostramos siempre — la IA lo llena si detecta
  // un actor externo claro; sino el usuario lo deja vacío o escribe a mano.
  form.addWidget(CardService.newTextInput()
    .setFieldName('contraparte')
    .setTitle('Contraparte (opcional)')
    .setValue(pre.contraparte));

  // Próximo paso / acción (el campo "Acción" de la tarea en la app).
  form.addWidget(CardService.newTextInput()
    .setFieldName('acc')
    .setTitle('Próximo paso (opcional)')
    .setMultiline(true)
    .setValue(pre.acc));

  // Adjuntos del correo (opcional). Pre-marcamos los que entran en los caps;
  // los grandes quedan desmarcados para que el usuario decida. Inline ya
  // excluidos en la lectura. Al crear, los marcados se suben a la tarea.
  if (info.attachments && info.attachments.length) {
    var attInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName('attachments')
      .setTitle('Adjuntar al crear');
    var running = 0, count = 0;
    info.attachments.forEach(function(att) {
      var fits = (count < _GMAIL_ATT_MAX_COUNT) && (running + att.size <= _GMAIL_ATT_MAX_TOTAL);
      if (fits) { running += att.size; count++; }
      attInput.addItem(att.name + ' · ' + _gmailFmtSize(att.size), String(att.idx), fits);
    });
    form.addWidget(attInput);
  }

  // Notas. Si la IA generó un resumen, lo ponemos como pre-fill; sino vacío. El
  // contexto del correo (remitente/fecha/link) se concatena server-side desde el
  // parámetro de la acción — no se pierde si el usuario edita.
  form.addWidget(CardService.newTextInput()
    .setFieldName('notas')
    .setTitle(ai && ai.notas ? 'Resumen (editable)' : 'Tu nota (opcional)')
    .setHint('El remitente y el link al correo se guardan solos')
    .setMultiline(true)
    .setValue(pre.notas));

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

// Card cuando ya existe una tarea para este hilo de correo. El "Ver tarea" abre
// el tracker; el "Crear igual" es un escape hatch para casos donde el mismo hilo
// dispara un seguimiento separado (ej. responder, después una nueva acción).
function _gmailDuplicateCard(dup, info, ctx, clientes) {
  var section = CardService.newCardSection();
  section.addWidget(CardService.newDecoratedText()
    .setTopLabel(dup.cerrada ? 'Ya existe (cerrada)' : 'Ya existe una tarea para este correo')
    .setText('#' + dup.id + ' · ' + (dup.nombre || ''))
    .setWrapText(true));
  if (dup.resp) {
    section.addWidget(CardService.newDecoratedText()
      .setTopLabel('Responsable')
      .setText(dup.resp));
  }
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (err) {}
  if (url) {
    section.addWidget(CardService.newTextButton()
      .setText('Abrir Legal Tracker')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOpenLink(CardService.newOpenLink().setUrl(url)));
  }
  section.addWidget(CardService.newTextButton()
    .setText('Crear otra tarea igual')
    .setOnClickAction(CardService.newAction()
      .setFunctionName('gmailForceCreate')
      .setParameters({ messageId: info.messageId || '' })));
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Tarea ya creada').setSubtitle('Legal Tracker'))
    .addSection(section)
    .build();
}

// "Crear otra igual": ignora la detección de duplicados y muestra el form
// normal. Re-procesa AI desde el cache (no re-llama Gemini).
function gmailForceCreate(e) {
  var info = _gmailReadMessage(e);
  var card;
  try {
    var ctx = _getAuthContext();
    var clientes = _gmailClientes(ctx.ss);
    var ai = _gmailAIEnrich(info, clientes);
    card = _gmailBuildCreateCard(info, ctx, clientes, ai);
  } catch (err) {
    card = _gmailUnauthorizedCard();
  }
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

// ── IA · Gemini ─────────────────────────────────────────────────────
// Llama Gemini Flash con el contenido del correo + el vocabulario válido del
// tracker (tipos, prioridades, riesgos, confidencialidad, clientes). Devuelve
// un objeto con los campos extraídos o null si:
//   - no hay GEMINI_API_KEY seteada (Script Properties)
//   - la llamada falla (red, quota, etc.)
//   - el output no parsea como JSON o no tiene los campos esperados
// En cualquier fallo, el caller cae a heurística — el add-on nunca se rompe por
// la IA.
//
// Cacheamos por messageId (UserCache, 5 min) para que reabrir el mismo correo no
// vuelva a gastar la cuota.
function _gmailAIEnrich(info, clientes) {
  var apiKey;
  try { apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); } catch (err) { return null; }
  if (!apiKey) return null;
  if (!info || (!info.subject && !info.body)) return null;

  var cache = null;
  try { cache = CacheService.getUserCache(); } catch (err) {}
  var cacheKey = 'gmail-ai-' + (info.messageId || '');
  if (cache && info.messageId) {
    var hit = cache.get(cacheKey);
    if (hit) {
      try { return JSON.parse(hit); } catch (err) {}
    }
  }

  var prompt = _gmailAIPrompt(info, clientes);
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 1024 }
  };

  var resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log('gmailAI: fetch error · ' + ((err && err.message) || err));
    return null;
  }
  if (resp.getResponseCode() !== 200) {
    Logger.log('gmailAI: HTTP ' + resp.getResponseCode() + ' · ' + resp.getContentText().slice(0, 200));
    return null;
  }
  var json;
  try { json = JSON.parse(resp.getContentText()); } catch (err) { return null; }
  var text = '';
  try { text = json.candidates[0].content.parts[0].text || ''; } catch (err) {}
  if (!text) return null;
  var out;
  try { out = JSON.parse(text); } catch (err) { return null; }

  // Validación contra enums: si la IA inventa valores fuera del dominio, los
  // dropeamos en vez de pasarlos al render (mejor vacío que un valor inválido
  // que después rompe filtros / stats).
  var clean = _gmailAIValidate(out, clientes);
  if (cache && info.messageId) {
    try { cache.put(cacheKey, JSON.stringify(clean), 300); } catch (err) {}
  }
  return clean;
}

// Arma el prompt con todo el contexto que la IA necesita para pre-llenar bien:
// enums válidos del tracker, lista actual de clientes desde Config, y el correo.
function _gmailAIPrompt(info, clientes) {
  var today = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  var clientesList = (clientes && clientes.length) ? clientes.join(', ') : '(ninguno configurado)';
  return ''
    + 'Sos un asistente del equipo legal de Rappi. Analizá el siguiente correo y producí '
    + 'un draft de tarea para el tracker interno. Devolvé JSON estricto (sin markdown ni '
    + 'comentarios) con estos campos exactos:\n\n'
    + '{\n'
    + '  "nombre": "string accionable (máx 80 chars). Verbo + objeto, ej. \\"Revisar NDA con X\\"",\n'
    + '  "tipoTrabajo": "uno de: Contractual | Regulatorio | Contencioso | Privacy | Operativo, o \\"\\"",\n'
    + '  "priority": "Alta | Media | Baja según urgencia real",\n'
    + '  "riesgo": "Legal | Reputacional | Negocio o \\"\\" si no aplica",\n'
    + '  "confidencialidad": "estandar | restringido | confidencial",\n'
    + '  "areaSolicitante": "uno de los clientes válidos exactamente como aparece en la lista, o \\"\\"",\n'
    + '  "contraparte": "nombre de la empresa/parte externa, o \\"\\" si es interno o no aplica",\n'
    + '  "deadline": "yyyy-MM-dd SOLO si hay plazo claro (explícito o inferible). Vacío si dudás.",\n'
    + '  "acc": "próximo paso concreto en 1 línea (qué tengo que hacer apenas abro la tarea)",\n'
    + '  "notas": "resumen ejecutivo en bullets con \\"- \\" (3-5): qué se pide, partes, plazos, contexto clave"\n'
    + '}\n\n'
    + 'Reglas duras:\n'
    + '- No inventes. Si dudás, devolvé "".\n'
    + '- "areaSolicitante" SOLO si la lista de clientes contiene un match claro: ' + clientesList + '.\n'
    + '- "confidencialidad": estandar por default. Subí a restringido si hay info sensible o de negocio; '
    + 'confidencial solo para M&A, estrategia, o asuntos legales críticos.\n'
    + '- "priority": Alta si hay urgencia real (plazo corto, escalado, demanda); Baja si es rutina. Mayoría = Media.\n'
    + '- "contraparte" queda vacío si el correo es interno entre empleados de Rappi.\n'
    + '- "nombre" en español, modo imperativo, sin "Re:" / "Fwd:".\n'
    + '- "notas" en español, bullets con guion ("- "), una idea por bullet.\n\n'
    + 'CORREO A ANALIZAR\n'
    + 'Hoy es: ' + today + '\n'
    + 'De: ' + (info.from || '(desconocido)') + '\n'
    + 'Asunto: ' + (info.subject || '(sin asunto)') + '\n'
    + 'Fecha: ' + (info.dateStr || '') + '\n'
    + (info.attachments && info.attachments.length
        ? 'Adjuntos: ' + info.attachments.map(function(a){ return a.name; }).join(', ') + '\n'
        : '')
    + 'Cuerpo:\n' + (info.body || '(sin cuerpo)');
}

// Valida la salida de la IA contra el vocabulario del tracker. Cualquier valor
// fuera del dominio se reemplaza por "" para que el render no lo muestre como
// pill inválida.
function _gmailAIValidate(out, clientes) {
  if (!out || typeof out !== 'object') return null;
  var clean = {
    nombre:           (out.nombre || '').toString().trim().slice(0, 120),
    tipoTrabajo:      _GMAIL_TIPOS.indexOf(out.tipoTrabajo) >= 0 ? out.tipoTrabajo : '',
    priority:         ['Alta', 'Media', 'Baja'].indexOf(out.priority) >= 0 ? out.priority : 'Media',
    riesgo:           ['Legal', 'Reputacional', 'Negocio'].indexOf(out.riesgo) >= 0 ? out.riesgo : '',
    confidencialidad: ['estandar', 'restringido', 'confidencial'].indexOf(out.confidencialidad) >= 0 ? out.confidencialidad : 'estandar',
    areaSolicitante:  (clientes || []).indexOf(out.areaSolicitante) >= 0 ? out.areaSolicitante : '',
    contraparte:      (out.contraparte || '').toString().trim().slice(0, 120),
    deadline:         /^\d{4}-\d{2}-\d{2}$/.test(out.deadline || '') ? out.deadline : '',
    acc:              (out.acc || '').toString().trim().slice(0, 200),
    notas:            (out.notas || '').toString().trim().slice(0, 1500)
  };
  return clean;
}

// Busca si ya existe una tarea (activa o cerrada) cuya columna Notas contenga
// este threadId. Lectura barata (solo nombre + id + resp + col notas + status).
// Devuelve { id, nombre, resp, cerrada } o null.
function _gmailFindTaskByThread(ss, threadId) {
  if (!ss || !threadId) return null;
  var hit = _gmailScanSheetForThread(ss, SHEET_ACTIVO, threadId, 4 /*headerOffset*/, false);
  if (hit) return hit;
  return _gmailScanSheetForThread(ss, SHEET_HISTORIAL, threadId, 2 /*headerOffset*/, true);
}

function _gmailScanSheetForThread(ss, sheetName, threadId, dataStartRow, cerrada) {
  var ws = ss.getSheetByName(sheetName);
  if (!ws) return null;
  var lr = ws.getLastRow();
  if (lr < dataStartRow) return null;
  var lc = Math.min(ws.getLastColumn(), TASK_COLS);
  var data = ws.getRange(dataStartRow, 1, lr - dataStartRow + 1, lc).getValues();
  for (var i = 0; i < data.length; i++) {
    var notas = (data[i][10] || '').toString(); // col 11 = Notas
    if (notas.indexOf(threadId) >= 0) {
      return { id: data[i][0], nombre: data[i][1], resp: data[i][2], cerrada: cerrada };
    }
  }
  return null;
}

// Card de éxito tras crear: confirma + ofrece abrir la app o crear otra desde
// el mismo correo (sin volver a la inbox).
function _gmailSuccessCard(res, taskObj, ctx, attResult) {
  var section = CardService.newCardSection();
  section.addWidget(CardService.newDecoratedText()
    .setTopLabel('Tarea creada')
    .setText('#' + res.id + ' · ' + (taskObj.nombre || ''))
    .setWrapText(true));
  var who = (taskObj.resp === ctx.user.name) ? 'Asignada a vos' : ('Asignada a ' + taskObj.resp);
  section.addWidget(CardService.newDecoratedText().setText(who).setWrapText(true));

  if (attResult && (attResult.ok || attResult.fail)) {
    var attMsg = attResult.ok + (attResult.ok === 1 ? ' adjunto subido' : ' adjuntos subidos');
    if (attResult.fail) attMsg += ' · ' + attResult.fail + ' no (tipo no soportado o muy grande)';
    section.addWidget(CardService.newDecoratedText().setText('📎 ' + attMsg).setWrapText(true));
  }

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
    contraparte: _gmailFormValue(e, 'contraparte') || '',
    acc: _gmailFormValue(e, 'acc') || '',
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
    // Subir adjuntos marcados (si los hay). La tarea ya existe, así que un fallo
    // parcial no la pierde; el resultado se refleja en la card de éxito.
    var attResult = null;
    var checkedIdx = _gmailFormValues(e, 'attachments');
    if (checkedIdx.length && e.gmail && e.gmail.messageId) {
      attResult = _gmailUploadAttachments(e, res.id, checkedIdx);
    }
    var notifText = '✓ Tarea #' + res.id + ' creada'
      + (attResult && attResult.ok ? ' · ' + attResult.ok + ' adjunto' + (attResult.ok === 1 ? '' : 's') : '');
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(notifText))
      .setNavigation(CardService.newNavigation().updateCard(_gmailSuccessCard(res, taskObj, ctx, attResult)))
      .build();
  }
  return _gmailNotify('No se pudo crear: ' + _friendlyGmailError(res));
}

// Sube los adjuntos marcados a la tarea recién creada. Re-lee el correo con las
// MISMAS opciones que en el render (para que los índices coincidan), reaplica
// los caps por defensa, y reusa uploadDocument() (que valida MIME allowlist +
// tamaño y vincula al Drive correcto). Devuelve {ok, fail}.
function _gmailUploadAttachments(e, taskId, checkedIdx) {
  var ok = 0, fail = 0;
  try {
    GmailApp.setCurrentMessageAccessToken(e.gmail.accessToken);
    var message = GmailApp.getMessageById(e.gmail.messageId);
    var atts = message.getAttachments({ includeInlineImages: false, includeAttachments: true });
    var want = {};
    checkedIdx.forEach(function(s) { want[String(s)] = true; });
    var running = 0, count = 0;
    for (var i = 0; i < atts.length; i++) {
      if (!want[String(i)]) continue;
      var a = atts[i];
      if (count >= _GMAIL_ATT_MAX_COUNT || running + a.getSize() > _GMAIL_ATT_MAX_TOTAL) { fail++; continue; }
      var r = uploadDocument('task', taskId, {
        name: a.getName(),
        mimeType: a.getContentType(),
        data: Utilities.base64Encode(a.getBytes())
      });
      if (r && r.success) { ok++; running += a.getSize(); count++; }
      else fail++;
    }
  } catch (err) {
    // Lectura del correo falló: lo que no se subió queda como fallo silencioso;
    // la tarea ya existe igual.
  }
  return { ok: ok, fail: fail };
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

// Lee un campo multi-valor (checkbox group) como array de strings.
function _gmailFormValues(e, key) {
  try {
    var fi = e && e.commonEventObject && e.commonEventObject.formInputs;
    if (fi && fi[key] && fi[key].stringInputs && fi[key].stringInputs.value) {
      return fi[key].stringInputs.value;
    }
  } catch (err) {}
  try {
    if (e && e.formInputs && e.formInputs[key]) return e.formInputs[key];
  } catch (err) {}
  return [];
}

// Formatea bytes a un tamaño legible (B / KB / MB).
function _gmailFmtSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
