// ════════════════════════════════════════════════════════════════
// SLACK MODAL INTEGRATION v3.0 — SlackModal.gs
// Event Subscriptions + Interactive Modals
// ────────────────────────────────────────────────────────────────
// INSTRUCCIONES:
// 1. Elimina toda la sección "SLACK INTEGRATION" que está al final
//    de tu Codigo.gs (desde el comentario hasta testDoPost).
// 2. Crea un archivo NUEVO en Apps Script llamado "SlackModal"
//    y pega TODO este contenido ahí.
// 3. Reemplaza SLACK_BOT_TOKEN con tu Bot User OAuth Token (xoxb-...).
// ════════════════════════════════════════════════════════════════

// ── CONFIG ───────────────────────────────────────────────────────
// Bot User OAuth Token — almacenado en Script Properties (no hardcodear aquí)
// Setup: Apps Script Editor → ⚙ Project Settings → Script Properties → Add:
//   Key: SLACK_BOT_TOKEN   Value: xoxb-tu-token-aqui
const SLACK_BOT_TOKEN  = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN') || '';
const SLACK_LOG_SHEET  = 'Slack Log';

// SECURITY: Slack signature verification.
// El webapp Apps Script está deployado ANYONE_ANONYMOUS para que Slack pueda hacer POST.
// Sin verificación de firma cualquiera con la URL podría falsificar payloads y cerrar/bloquear tareas.
// Slack firma cada request con HMAC-SHA256 usando SLACK_SIGNING_SECRET.
//
// Setup: Apps Script Editor → ⚙ Project Settings → Script Properties → Add:
//   Key: SLACK_SIGNING_SECRET   Value: <signing secret de tu Slack app>
//
// LIMITACIÓN: en Apps Script doPost los headers HTTP NO están disponibles en e.parameter
// y solo a veces aparecen en e.headers (depende del modo de deployment y el tipo de request).
// En webapps simples no son accesibles, lo que impide validar la firma de manera estándar.
// Workaround sugerido a futuro: usar una Cloud Function como proxy que sí puede validar la firma,
// y forwardear a Apps Script con un shared secret en el body.
// Por eso dejamos el helper preparado pero con flag _SLACK_SIG_ENFORCED = false hasta poder migrarlo.
const _SLACK_SIG_ENFORCED = false;
const _SLACK_SIG_MAX_AGE_SEC = 60 * 5; // 5 min anti-replay

// Convierte un byte[] (signed) de Apps Script en string hex lowercase.
function _bytesToHex(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex;
}

// Verifica la firma HMAC de Slack. Retorna true si es válida (o si no hay secret seteado, modo dev).
// Si _SLACK_SIG_ENFORCED es false, hace soft-fail (loggea pero permite el request).
// SECURITY: en Apps Script doPost los headers vienen en e.headers PERO en webapps simples no están
// disponibles. Workaround: usar Cloud Functions como proxy.
function _verifySlackSignature(e) {
  var secret = '';
  try { secret = PropertiesService.getScriptProperties().getProperty('SLACK_SIGNING_SECRET') || ''; } catch (err) {}

  if (!secret) {
    // Modo dev: warning pero permitido
    try { console.warn('SLACK_SIGNING_SECRET no seteado — ejecución sin verificación de firma (modo dev)'); } catch(_e) {}
    return true;
  }

  // Intentar leer headers — en Apps Script puede que estén en e.headers o no estén.
  var headers = (e && e.headers) ? e.headers : null;
  var sigHeader = '';
  var tsHeader  = '';
  if (headers) {
    sigHeader = headers['x-slack-signature'] || headers['X-Slack-Signature'] || '';
    tsHeader  = headers['x-slack-request-timestamp'] || headers['X-Slack-Request-Timestamp'] || '';
  }

  if (!sigHeader || !tsHeader) {
    // Apps Script webapp simple no expone headers. No podemos validar.
    try { console.warn('Slack signature headers no disponibles en e.headers — Apps Script webapp limita esto.'); } catch(_e) {}
    return !_SLACK_SIG_ENFORCED;
  }

  // Anti-replay: timestamp no más viejo que 5 min
  var nowSec = Math.floor(Date.now() / 1000);
  var tsNum = parseInt(tsHeader, 10);
  if (isNaN(tsNum) || Math.abs(nowSec - tsNum) > _SLACK_SIG_MAX_AGE_SEC) {
    try { console.warn('Slack signature timestamp fuera de rango (' + tsHeader + ')'); } catch(_e) {}
    return !_SLACK_SIG_ENFORCED;
  }

  // Recompute: sigBase = 'v0:' + ts + ':' + body
  var body = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
  var base = 'v0:' + tsHeader + ':' + body;
  var hmac = Utilities.computeHmacSha256Signature(base, secret);
  var expected = 'v0=' + _bytesToHex(hmac);

  // Comparación constante en tiempo (evita timing attacks)
  if (expected.length !== sigHeader.length) {
    return !_SLACK_SIG_ENFORCED;
  }
  var diff = 0;
  for (var i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
  }
  if (diff !== 0) {
    try { console.warn('Slack signature mismatch'); } catch(_e) {}
    return !_SLACK_SIG_ENFORCED;
  }
  return true;
}

// ── DEDUP de eventos Slack ──────────────────────────────────────
// Slack reintenta cualquier request que no responda 200 en <3s. Como `processEvent`
// crea tareas, sin dedup cada retry duplica la tarea (caso real observado en Slack Log:
// task #3/#4, #5/#6, #7/#8, #11/#12 con mismo nombre + mismo user + ~15s de diferencia).
// Usamos CacheService.getScriptCache() como llave canónica por `event_id` (TTL 5 min,
// que cubre la ventana de retries de Slack: 3 retries con backoff exponencial ~30s total).
// Si `eventId` viene vacío/null retornamos false (no deduplicar) — preferible procesar
// dos veces que perder un evento legítimo.
function _isDuplicateEvent(eventId) {
  if (!eventId) return false;
  try {
    var cache = CacheService.getScriptCache();
    var key = 'slack_evt_' + eventId;
    if (cache.get(key)) return true;
    cache.put(key, '1', 300); // 5 min TTL
    return false;
  } catch (e) {
    // Si el cache falla, no bloqueamos el procesamiento — log y seguimos.
    try { console.warn('_isDuplicateEvent cache error: ' + (e && e.message)); } catch(_e) {}
    return false;
  }
}

// Emojis que disparan acciones
const EMOJI_CREATE = 'scales';              // ⚖️  → crear tarea (con formulario)
const EMOJI_CLOSE  = 'white_check_mark';   // ✅  → cerrar tarea directamente
const EMOJI_BLOCK  = 'no_entry';           // ⛔  → bloquear tarea (con razón)

// ════════════════════════════════════════════════════════════════
// doPost — ÚNICO PUNTO DE ENTRADA
// Maneja: URL verification · Events · Interactions (buttons + modals)
// ════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    // ── SECURITY: validar firma HMAC de Slack antes de procesar nada ──
    // Si el secret no está seteado, permite (modo dev) con warning.
    // Si está seteado pero los headers no están disponibles, soft-fail según _SLACK_SIG_ENFORCED.
    if (!_verifySlackSignature(e)) {
      logSlackError('doPost', { message: 'Slack signature verification failed', stack: '' }, 'doPost');
      return jsonResponse({ error: 'unauthorized' });
    }

    // ── Interactions: botones y modals llegan como form-encoded ──
    if (e.postData.type === 'application/x-www-form-urlencoded') {
      const payload = JSON.parse(e.parameter.payload || '{}');
      return handleInteraction(payload);
    }

    const body = JSON.parse(e.postData.contents || '{}');

    // ── Slack URL Verification (configuración inicial) ───────────
    if (body.type === 'url_verification') {
      return ContentService
        .createTextOutput(body.challenge)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // ── DEDUP de eventos: Slack reintenta si no respondemos 200 en <3s,
    //    y cada retry vuelve a invocar processEvent → tareas duplicadas.
    //    Llave canónica = body.event_id. Header x-slack-retry-num es solo informativo.
    if (body.event_id) {
      if (_isDuplicateEvent(body.event_id)) {
        try {
          var retryNum = '';
          if (e && e.headers) {
            retryNum = e.headers['x-slack-retry-num'] || e.headers['X-Slack-Retry-Num'] || '';
          } else if (e && e.parameter) {
            retryNum = e.parameter['x-slack-retry-num'] || '';
          }
          console.info('Skipped duplicate Slack event: ' + body.event_id + (retryNum ? ' (retry #' + retryNum + ')' : ''));
        } catch (_e) {}
        return jsonResponse({ ok: true, deduped: true });
      }
    }

    // ── Event Callbacks (reacciones, mensajes, etc.) ─────────────
    if (body.type === 'event_callback') {
      // Slack requiere respuesta en < 3s: procesamos y respondemos ya
      processEvent(body);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: true });

  } catch (err) {
    logSlackError('doPost', err, 'doPost');
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ════════════════════════════════════════════════════════════════
// PASO 1 — PROCESAR EVENTO reaction_added
// ════════════════════════════════════════════════════════════════
function processEvent(body) {
  const event = body.event;
  if (!event || event.type !== 'reaction_added') return;

  // Ignorar reacciones de bots para evitar loops
  if (event.item_user === event.user && event.bot_id) return;

  const emoji   = event.reaction;
  const channel = event.item.channel;
  const ts      = event.item.ts;
  const userId  = event.user;

  if (emoji === EMOJI_CREATE) {
    // ⚖️ → Mandar mensaje efímero con botón "Abrir formulario"
    //      (No podemos abrir modal directo desde reaction — necesitamos trigger_id)
    const text = fetchMessageText(channel, ts);
    sendCreatePrompt(userId, channel, ts, text);

  } else if (emoji === EMOJI_CLOSE) {
    // ✅ → Cerrar tarea directamente (fuzzy match en el sheet)
    const text = fetchMessageText(channel, ts);
    quickCloseTask(channel, ts, text, userId);

  } else if (emoji === EMOJI_BLOCK) {
    // ⛔ → Buscar candidatos; si hay ambigüedad, pedir al usuario que elija antes del modal
    const text = fetchMessageText(channel, ts);
    const match = findTaskCandidates(text);
    if (match.confidence === 'none' || match.candidates.length === 0) {
      sendBlockPrompt(userId, channel, ts, text); // flujo legacy: modal genérico
    } else if (match.confidence === 'high') {
      // 1 candidato claro → abrir modal directo con su ID
      sendBlockPromptForTask(userId, channel, ts, match.candidates[0]);
    } else {
      // Varios candidatos → pedir que elija
      sendConfirmPrompt(userId, channel, ts, 'block', match.candidates);
    }
  }
}

// ════════════════════════════════════════════════════════════════
// PASO 2 — MENSAJES EFÍMEROS (visible solo al usuario que reaccionó)
// Sirven para capturar el trigger_id necesario para abrir el modal
// ════════════════════════════════════════════════════════════════

function sendCreatePrompt(userId, channel, ts, prefillText) {
  const preview = truncate(prefillText || 'Sin texto', 80);
  callSlackAPI('chat.postEphemeral', {
    channel : channel,
    user    : userId,
    text    : '¿Crear tarea en Legal Tracker?',
    blocks  : [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*⚖️ Crear tarea legal*\n> ' + preview }
      },
      {
        type       : 'actions',
        block_id   : 'create_prompt',
        elements   : [
          {
            type      : 'button',
            action_id : 'open_create_modal',
            style     : 'primary',
            text      : { type: 'plain_text', text: '📝 Abrir formulario' },
            value     : JSON.stringify({ channel: channel, ts: ts, text: prefillText })
          },
          {
            type      : 'button',
            action_id : 'dismiss_prompt',
            text      : { type: 'plain_text', text: '✕ Cancelar' },
            value     : 'dismiss'
          }
        ]
      }
    ]
  });
}

// Ephemeral específica cuando ya sabemos qué tarea bloquear (alta confianza o confirmada).
// Lleva el taskId al modal para que no vuelva a hacer fuzzy match.
function sendBlockPromptForTask(userId, channel, ts, candidate) {
  callSlackAPI('chat.postEphemeral', {
    channel : channel,
    user    : userId,
    text    : '¿Bloquear tarea #' + candidate.id + '?',
    blocks  : [
      { type: 'section', text: { type: 'mrkdwn', text: '*⛔ Bloquear tarea*\n> #' + candidate.id + ' ' + truncate(candidate.nombre, 80) } },
      {
        type       : 'actions',
        block_id   : 'block_prompt',
        elements   : [
          {
            type      : 'button',
            action_id : 'open_block_modal',
            style     : 'danger',
            text      : { type: 'plain_text', text: '⛔ Agregar razón y bloquear' },
            value     : JSON.stringify({ channel: channel, ts: ts, text: candidate.nombre, taskId: candidate.id })
          },
          {
            type      : 'button',
            action_id : 'dismiss_prompt',
            text      : { type: 'plain_text', text: '✕ Cancelar' },
            value     : 'dismiss'
          }
        ]
      }
    ]
  });
}

function sendBlockPrompt(userId, channel, ts, prefillText) {
  const preview = truncate(prefillText || 'Sin texto', 80);
  callSlackAPI('chat.postEphemeral', {
    channel : channel,
    user    : userId,
    text    : '¿Bloquear tarea en Legal Tracker?',
    blocks  : [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*⛔ Bloquear tarea*\n> ' + preview }
      },
      {
        type       : 'actions',
        block_id   : 'block_prompt',
        elements   : [
          {
            type      : 'button',
            action_id : 'open_block_modal',
            style     : 'danger',
            text      : { type: 'plain_text', text: '⛔ Agregar razón y bloquear' },
            value     : JSON.stringify({ channel: channel, ts: ts, text: prefillText })
          },
          {
            type      : 'button',
            action_id : 'dismiss_prompt',
            text      : { type: 'plain_text', text: '✕ Cancelar' },
            value     : 'dismiss'
          }
        ]
      }
    ]
  });
}

// ════════════════════════════════════════════════════════════════
// PASO 3 — MANEJAR INTERACTIONS (clics en botones y envío de modals)
// ════════════════════════════════════════════════════════════════
function handleInteraction(payload) {
  const type = payload.type;

  // ── Clic en un botón ─────────────────────────────────────────
  if (type === 'block_actions') {
    const action = payload.actions && payload.actions[0];
    if (!action) return jsonResponse({ ok: true });

    if (action.action_id === 'open_create_modal') {
      const meta = JSON.parse(action.value);
      openCreateModal(payload.trigger_id, meta.channel, meta.ts, meta.text);
    }

    if (action.action_id === 'open_block_modal') {
      const meta = JSON.parse(action.value);
      openBlockModal(payload.trigger_id, meta.channel, meta.ts, meta.text, meta.taskId);
    }

    // Confirmación de cierre: botón con action_id = 'confirm_close_<taskId>'
    if (action.action_id && action.action_id.indexOf('confirm_close_') === 0) {
      const meta = JSON.parse(action.value);
      const result = closeTaskById(meta.taskId, payload.user.id);
      postThreadReply(meta.channel, meta.ts, result.success ? '✅ ' + result.message : '❌ ' + result.message);
      logSlackEvent({ action: 'close', task_name: meta.nombre, slack_user: payload.user.id, result: result.success ? 'OK #' + meta.taskId : 'FAILED' });
    }

    // Confirmación de bloqueo: botón con action_id = 'confirm_block_<taskId>' → abre modal con task ya identificada
    if (action.action_id && action.action_id.indexOf('confirm_block_') === 0) {
      const meta = JSON.parse(action.value);
      sendBlockPromptForTask(payload.user.id, meta.channel, meta.ts, {id: meta.taskId, nombre: meta.nombre});
    }

    // dismiss: no hacer nada, el mensaje efímero desaparece solo
    return jsonResponse({ ok: true });
  }

  // ── Envío de modal ────────────────────────────────────────────
  if (type === 'view_submission') {
    const callbackId = payload.view && payload.view.callback_id;
    if (callbackId === 'create_task_modal') return submitCreateTask(payload);
    if (callbackId === 'block_task_modal')  return submitBlockTask(payload);
  }

  return jsonResponse({ ok: true });
}

// ════════════════════════════════════════════════════════════════
// MODALS — CREAR TAREA
// ════════════════════════════════════════════════════════════════
function openCreateModal(triggerId, channel, ts, prefillText) {
  const members = getTeamMembers();
  const memberOptions = members.map(function(m) {
    return { text: { type: 'plain_text', text: m }, value: m };
  });

  const modal = {
    type             : 'modal',
    callback_id      : 'create_task_modal',
    private_metadata : JSON.stringify({ channel: channel, ts: ts }),
    title  : { type: 'plain_text', text: '📝 Nueva tarea legal' },
    submit : { type: 'plain_text', text: 'Crear tarea' },
    close  : { type: 'plain_text', text: 'Cancelar' },
    blocks : [
      // ── Nombre ──────────────────────────────────────────────
      {
        type     : 'input',
        block_id : 'task_name',
        label    : { type: 'plain_text', text: 'Nombre de la tarea' },
        hint     : { type: 'plain_text', text: 'Máximo 60 caracteres' },
        element  : {
          type          : 'plain_text_input',
          action_id     : 'value',
          initial_value : truncate(prefillText || '', 60),
          max_length    : 60
        }
      },
      // ── Responsable ─────────────────────────────────────────
      {
        type     : 'input',
        block_id : 'responsable',
        label    : { type: 'plain_text', text: 'Responsable' },
        element  : {
          type        : 'static_select',
          action_id   : 'value',
          placeholder : { type: 'plain_text', text: 'Seleccionar...' },
          options     : memberOptions
        }
      },
      // ── Prioridad ────────────────────────────────────────────
      {
        type     : 'input',
        block_id : 'priority',
        label    : { type: 'plain_text', text: 'Prioridad' },
        element  : {
          type           : 'static_select',
          action_id      : 'value',
          initial_option : { text: { type: 'plain_text', text: '🟡 Media' }, value: 'Media' },
          options        : [
            { text: { type: 'plain_text', text: '🔴 Alta'  }, value: 'Alta'  },
            { text: { type: 'plain_text', text: '🟡 Media' }, value: 'Media' },
            { text: { type: 'plain_text', text: '🟢 Baja'  }, value: 'Baja'  }
          ]
        }
      },
      // ── Deadline (opcional) ──────────────────────────────────
      {
        type     : 'input',
        block_id : 'deadline',
        optional : true,
        label    : { type: 'plain_text', text: 'Deadline' },
        element  : {
          type        : 'plain_text_input',
          action_id   : 'value',
          placeholder : { type: 'plain_text', text: 'Ej: Esta semana · Fin Q1 · 28 mar' }
        }
      },
      // ── Accionable (opcional) ────────────────────────────────
      {
        type     : 'input',
        block_id : 'accionable',
        optional : true,
        label    : { type: 'plain_text', text: 'Accionable / Siguiente paso' },
        element  : {
          type        : 'plain_text_input',
          action_id   : 'value',
          placeholder : { type: 'plain_text', text: '¿Cuál es el siguiente paso concreto?' }
        }
      }
    ]
  };

  callSlackAPI('views.open', { trigger_id: triggerId, view: modal });
}

// ════════════════════════════════════════════════════════════════
// MODALS — BLOQUEAR TAREA
// ════════════════════════════════════════════════════════════════
function openBlockModal(triggerId, channel, ts, prefillText, taskId) {
  const modal = {
    type             : 'modal',
    callback_id      : 'block_task_modal',
    private_metadata : JSON.stringify({ channel: channel, ts: ts, text: prefillText, taskId: taskId || null }),
    title  : { type: 'plain_text', text: '⛔ Bloquear tarea' },
    submit : { type: 'plain_text', text: 'Confirmar bloqueo' },
    close  : { type: 'plain_text', text: 'Cancelar' },
    blocks : [
      {
        type : 'section',
        text : { type: 'mrkdwn', text: '*Tarea identificada:*\n> ' + truncate(prefillText || '', 80) }
      },
      {
        type     : 'input',
        block_id : 'reason',
        label    : { type: 'plain_text', text: 'Razón del bloqueo' },
        element  : {
          type        : 'plain_text_input',
          action_id   : 'value',
          multiline   : true,
          placeholder : { type: 'plain_text', text: 'Describe por qué está bloqueada...' }
        }
      }
    ]
  };

  callSlackAPI('views.open', { trigger_id: triggerId, view: modal });
}

// ════════════════════════════════════════════════════════════════
// SUBMIT HANDLERS — procesamiento de formularios enviados
// ════════════════════════════════════════════════════════════════

function submitCreateTask(payload) {
  try {
    const vals   = payload.view.state.values;
    const meta   = JSON.parse(payload.view.private_metadata);
    const userId = payload.user.id;
    const userName = (payload.user.name || payload.user.id);

    const nombre    = vals.task_name.value.value || 'Tarea sin nombre';
    const resp      = vals.responsable.value.selected_option.value;
    const priority  = vals.priority.value.selected_option.value;
    const deadline  = (vals.deadline  && vals.deadline.value.value)   || 'Por definir';
    const accionable = (vals.accionable && vals.accionable.value.value) || '';

    // ── Guardar en el Sheet ───────────────────────────────────
    const result = addTask({
      nombre   : nombre,
      resp     : resp,
      acc      : accionable,
      deadline : deadline,
      priority : priority,
      notas    : 'Vía Slack · ' + userName + ' · ' + new Date().toLocaleDateString('es-CO')
    });

    // ── Confirmar en el hilo original ─────────────────────────
    const prioEmoji = { Alta: '🔴', Media: '🟡', Baja: '🟢' }[priority] || '🟡';
    postThreadReply(meta.channel, meta.ts,
      '✅ *Tarea #' + result.id + ' registrada en Legal Tracker*\n' +
      '📝 ' + nombre + '\n' +
      '👤 ' + resp + ' · ' + prioEmoji + ' ' + priority +
      (deadline !== 'Por definir' ? ' · 📅 ' + deadline : '') +
      (accionable ? '\n▶️ ' + accionable : '')
    );

    logSlackEvent({ action: 'create', task_name: nombre, slack_user: userName, result: 'OK #' + result.id });

    // Cerrar el modal limpiamente
    return jsonResponse({ response_action: 'clear' });

  } catch (err) {
    logSlackError('submitCreateTask', err, 'submitCreateTask');
    // Mostrar error inline en el modal
    return jsonResponse({
      response_action : 'errors',
      errors          : { task_name: 'Error al guardar: ' + err.message }
    });
  }
}

function submitBlockTask(payload) {
  try {
    const vals   = payload.view.state.values;
    const meta   = JSON.parse(payload.view.private_metadata);
    const reason = vals.reason.value.value;
    const text   = meta.text || '';
    const slackUser = payload.user.name || payload.user.id;

    let resultObj;
    if (meta.taskId) {
      // Tarea ya identificada (vino de match de alta confianza o confirmada por el usuario)
      resultObj = blockTaskById(meta.taskId, reason, slackUser);
    } else {
      // Fuzzy match con nuevo umbral
      const match = findTaskCandidates(text);
      if (match.confidence === 'high') {
        resultObj = blockTaskById(match.candidates[0].id, reason, slackUser);
      } else {
        resultObj = { success: false, message: 'No encontré una tarea que coincida con seguridad' };
      }
    }

    const msg = resultObj.success
      ? '⛔ *' + resultObj.message + '*\n📝 Razón: ' + reason
      : '❌ ' + resultObj.message + '.\nBúscala en el dashboard y cámbiala manualmente.';

    postThreadReply(meta.channel, meta.ts, msg);
    logSlackEvent({ action: 'block', task_name: text, slack_user: payload.user.id, result: resultObj.success ? 'OK #' + resultObj.id : 'NOT_FOUND' });

    return jsonResponse({ response_action: 'clear' });

  } catch (err) {
    logSlackError('submitBlockTask', err, 'submitBlockTask');
    return jsonResponse({
      response_action : 'errors',
      errors          : { reason: 'Error al bloquear: ' + err.message }
    });
  }
}

// ════════════════════════════════════════════════════════════════
// CIERRE ✅ — alta confianza: cierra directo. Baja: pide confirmación.
// ════════════════════════════════════════════════════════════════
function quickCloseTask(channel, ts, messageText, userId) {
  if (!messageText) return;

  const match = findTaskCandidates(messageText);

  if (match.confidence === 'none' || match.candidates.length === 0) {
    postThreadReply(channel, ts,
      '❌ No encontré ninguna tarea que coincida con este mensaje.\n' +
      'Ciérrala manualmente desde el dashboard.');
    logSlackEvent({ action: 'close', task_name: messageText, slack_user: userId, result: 'NOT_FOUND' });
    return;
  }

  // Alta confianza: cerrar directo
  if (match.confidence === 'high') {
    const result = closeTaskById(match.candidates[0].id, userId);
    postThreadReply(channel, ts, result.success ? '✅ ' + result.message : '❌ ' + result.message);
    logSlackEvent({ action: 'close', task_name: messageText, slack_user: userId, result: result.success ? 'OK #' + result.id : 'FAILED' });
    return;
  }

  // Baja confianza: pedir confirmación con top candidatos (ephemeral)
  sendConfirmPrompt(userId, channel, ts, 'close', match.candidates);
  logSlackEvent({ action: 'close', task_name: messageText, slack_user: userId, result: 'LOW_CONFIDENCE_ASKING' });
}

// Ephemeral con botones para que el usuario elija cuál tarea cerrar/bloquear.
function sendConfirmPrompt(userId, channel, ts, actionType, candidates) {
  const title = actionType === 'close' ? '✅ ¿Cuál tarea quieres cerrar?' : '⛔ ¿Cuál tarea quieres bloquear?';
  const actionPrefix = actionType === 'close' ? 'confirm_close_' : 'confirm_block_';

  const buttons = candidates.map(function(c) {
    return {
      type      : 'button',
      action_id : actionPrefix + c.id,
      text      : { type: 'plain_text', text: '#' + c.id + ' ' + truncate(c.nombre, 40) },
      value     : JSON.stringify({ taskId: c.id, nombre: c.nombre, channel: channel, ts: ts })
    };
  });
  buttons.push({
    type      : 'button',
    action_id : 'dismiss_prompt',
    text      : { type: 'plain_text', text: '✕ Ninguna' },
    value     : 'dismiss'
  });

  callSlackAPI('chat.postEphemeral', {
    channel : channel,
    user    : userId,
    text    : title,
    blocks  : [
      { type: 'section', text: { type: 'mrkdwn', text: '*' + title + '*\nEncontré varias tareas parecidas. Elige la correcta:' } },
      { type: 'actions', block_id: actionPrefix + 'prompt', elements: buttons }
    ]
  });
}

// ════════════════════════════════════════════════════════════════
// HELPERS — Slack API
// ════════════════════════════════════════════════════════════════

function callSlackAPI(method, body) {
  if (!SLACK_BOT_TOKEN) {
    const errMsg = 'SLACK_BOT_TOKEN no configurado en Script Properties (Apps Script → ⚙ Project Settings → Script Properties).';
    logSlackError('Slack API / ' + method, { message: errMsg, stack: '' }, _callerName());
    return { ok: false, error: errMsg };
  }
  // Sanitizar blocks antes de enviar (evita invalid_blocks por section.text >3000, items sin type, etc.)
  if (body && body.blocks) {
    body.blocks = _sanitizeBlocks(body.blocks);
    // Si tras sanitizar quedan vacíos, removemos el campo y dejamos solo `text` como fallback.
    if (!body.blocks || body.blocks.length === 0) {
      delete body.blocks;
    }
  }
  const resp = UrlFetchApp.fetch('https://slack.com/api/' + method, {
    method         : 'post',
    contentType    : 'application/json; charset=utf-8',
    headers        : { 'Authorization': 'Bearer ' + SLACK_BOT_TOKEN },
    payload        : JSON.stringify(body),
    muteHttpExceptions: true
  });
  const data = JSON.parse(resp.getContentText());
  if (!data.ok) {
    var caller = _callerName();
    logSlackError('Slack API / ' + method, { message: data.error, stack: JSON.stringify(body).substring(0, 200) }, caller);
  }
  return data;
}

// Intenta extraer el call site (función que invocó callSlackAPI) parseando un stack trace.
// En Apps Script `new Error().stack` da algo como "at functionName (file:line)".
// Si no se puede determinar, retorna ''.
function _callerName() {
  try {
    var stack = new Error().stack || '';
    var lines = stack.split('\n');
    // Saltar el frame de _callerName y el de callSlackAPI; tomamos el siguiente que tenga "at ".
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('_callerName') >= 0 || line.indexOf('callSlackAPI') >= 0) continue;
      var m = line.match(/at\s+([A-Za-z0-9_$.]+)/);
      if (m && m[1] && m[1] !== 'Error') return m[1];
    }
  } catch (e) {}
  return '';
}

// Sanitiza un array de Slack blocks para prevenir errores `invalid_blocks`:
//  - filtra elementos sin `type` o no-objetos
//  - trunca strings de section.text.text y header.text.text a 2900 chars (límite Slack: 3000)
//  - trunca también context elements de tipo mrkdwn/plain_text a 2900
//  - garantiza que el array no esté vacío (retorna [] si todo se filtró → caller decide qué hacer)
function _sanitizeBlocks(blocks) {
  if (!blocks || !Array.isArray(blocks)) return [];
  var MAX = 2900;
  var clean = [];
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (!b || typeof b !== 'object' || !b.type) continue;
    // section.text.text
    if (b.type === 'section' && b.text && typeof b.text.text === 'string' && b.text.text.length > MAX) {
      b.text.text = b.text.text.substring(0, MAX - 1) + '…';
    }
    // section.fields[].text
    if (b.type === 'section' && Array.isArray(b.fields)) {
      for (var f = 0; f < b.fields.length; f++) {
        if (b.fields[f] && typeof b.fields[f].text === 'string' && b.fields[f].text.length > MAX) {
          b.fields[f].text = b.fields[f].text.substring(0, MAX - 1) + '…';
        }
      }
    }
    // header.text.text (límite real Slack 150, pero usamos MAX como tope superior)
    if (b.type === 'header' && b.text && typeof b.text.text === 'string' && b.text.text.length > MAX) {
      b.text.text = b.text.text.substring(0, MAX - 1) + '…';
    }
    // context.elements[].text
    if (b.type === 'context' && Array.isArray(b.elements)) {
      for (var c = 0; c < b.elements.length; c++) {
        var el = b.elements[c];
        if (el && typeof el.text === 'string' && el.text.length > MAX) {
          el.text = el.text.substring(0, MAX - 1) + '…';
        }
      }
    }
    clean.push(b);
  }
  return clean;
}

/**
 * Obtiene el texto de un mensaje de Slack dado su canal y timestamp.
 * Requiere scope: channels:history (public), groups:history (private),
 *                 mpim:history (group DM), im:history (DM)
 */
function fetchMessageText(channel, ts) {
  try {
    const resp = callSlackAPI('conversations.history', {
      channel   : channel,
      latest    : ts,
      oldest    : ts,
      limit     : 1,
      inclusive : true
    });
    if (resp.ok && resp.messages && resp.messages.length > 0) {
      return resp.messages[0].text || '';
    }
  } catch (e) {
    logSlackError('fetchMessageText', e, 'fetchMessageText');
  }
  return '';
}

/**
 * Resuelve el `thread_ts` correcto para responder en hilo.
 * Si el mensaje (channel, ts) es ya un *reply* dentro de un thread,
 * Slack devuelve `cannot_reply_to_message` cuando intentamos usar SU `ts` como `thread_ts`.
 * En ese caso debemos usar el `thread_ts` del padre (raíz del thread).
 * Retorna el ts a usar como `thread_ts`, o null si no se puede determinar
 * (en cuyo caso el caller debe postear top-level sin thread_ts).
 */
function _resolveThreadTs(channel, ts) {
  try {
    const resp = callSlackAPI('conversations.history', {
      channel   : channel,
      latest    : ts,
      oldest    : ts,
      limit     : 1,
      inclusive : true
    });
    if (resp && resp.ok && resp.messages && resp.messages.length > 0) {
      var msg = resp.messages[0];
      // Si tiene thread_ts y es DISTINTO de ts → es un reply: usar el del padre.
      if (msg.thread_ts && msg.thread_ts !== ts) return msg.thread_ts;
      // Si thread_ts == ts → es la raíz del thread: ts es válido.
      // Si no hay thread_ts → mensaje suelto: ts es válido como root del nuevo thread.
      return ts;
    }
  } catch (e) {
    logSlackError('_resolveThreadTs', e, '_resolveThreadTs');
  }
  // No pudimos verificar — null indica al caller que postee top-level
  return null;
}

/** Responde en el hilo del mensaje original.
 *  Si el mensaje fuente es un reply, usa el thread_ts del padre.
 *  Si no se puede determinar parent válido, postea top-level (sin thread_ts).
 */
function postThreadReply(channel, ts, text) {
  var threadTs = _resolveThreadTs(channel, ts);
  var payload = {
    channel : channel,
    text    : text,
    mrkdwn  : true
  };
  if (threadTs) payload.thread_ts = threadTs;
  callSlackAPI('chat.postMessage', payload);
}

/** Lee la lista de miembros del equipo desde la hoja Config del sheet */
function getTeamMembers() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const config = readConfig(ss);   // función definida en Codigo.gs
    const raw = config['Miembros'] || '';
    const members = raw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (members.length > 0) return members;
  } catch (e) { /* fallback abajo */ }
  // Fallback si la config no está lista
  return ['Carlos Fernández', 'Isabela Zuluaga', 'Nicolás Naranjo', 'Juan Manuel Caicedo'];
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max - 1) + '…' : str;
}

// ════════════════════════════════════════════════════════════════
// LOGGING
// ════════════════════════════════════════════════════════════════
function logSlackEvent(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let ws = ss.getSheetByName(SLACK_LOG_SHEET);
    if (!ws) {
      ws = ss.insertSheet(SLACK_LOG_SHEET);
      ws.appendRow(['Timestamp', 'Action', 'Task Name', 'User', 'Channel', 'Result']);
      ws.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#A78BFA').setFontColor('#FFFFFF');
      ws.setTabColor('#A78BFA');
    }
    ws.appendRow([
      new Date(),
      data.action    || '',
      data.task_name || '',
      data.slack_user || '',
      data.channel   || '',
      data.result    || JSON.stringify(data).substring(0, 300)
    ]);
    const lastRow = ws.getLastRow();
    if (lastRow > 502) ws.deleteRows(2, lastRow - 501);
  } catch (e) {
    console.error('logSlackEvent error:', e);
  }
}

function logSlackError(context, err, callSite) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ws = ss.getSheetByName(SLACK_LOG_SHEET);
    if (ws) {
      // Incluimos el call site (función originaria) en la columna "User" para tener
      // visibilidad sin romper el schema del sheet. El stack queda en la última col.
      var label = 'ERROR: ' + context + (callSite ? ' [from ' + callSite + ']' : '');
      ws.appendRow([new Date(), label, err.message || '', callSite || '', '', err.stack || '']);
    }
  } catch (e) {
    console.error('logSlackError failed:', e);
  }
}

// ════════════════════════════════════════════════════════════════
// TEST — ejecutar manualmente desde el editor para verificar
// ════════════════════════════════════════════════════════════════

/** Simula URL verification de Slack */
function testUrlVerification() {
  const fake = { postData: { type: 'application/json', contents: JSON.stringify({ type: 'url_verification', challenge: 'test-challenge-abc123' }) } };
  const res = doPost(fake);
  Logger.log('Challenge response: ' + res.getContent());
  // Esperado: test-challenge-abc123
}

/** Simula un evento reaction_added con ⚖️ */
function testReactionEvent() {
  const fake = {
    postData: {
      type: 'application/json',
      contents: JSON.stringify({
        type: 'event_callback',
        event: {
          type     : 'reaction_added',
          reaction : 'scales',
          user     : 'U12345TEST',
          item     : { channel: 'C12345TEST', ts: '1710000000.000000' }
        }
      })
    }
  };
  Logger.log('Simulating reaction event — revisa Slack Log en el Sheet');
  // Para testear sin Slack real, comenta la línea callSlackAPI en sendCreatePrompt
  // y verifica que no hay errores en el logger
}
