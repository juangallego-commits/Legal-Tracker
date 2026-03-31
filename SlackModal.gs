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
const SLACK_BOT_TOKEN  = XXX // Bot User OAuth Token
const SLACK_LOG_SHEET  = 'Slack Log';

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

    // ── Event Callbacks (reacciones, mensajes, etc.) ─────────────
    if (body.type === 'event_callback') {
      // Slack requiere respuesta en < 3s: procesamos y respondemos ya
      processEvent(body);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: true });

  } catch (err) {
    logSlackError('doPost', err);
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
    // ⛔ → Mandar mensaje efímero con botón "Bloquear con razón"
    const text = fetchMessageText(channel, ts);
    sendBlockPrompt(userId, channel, ts, text);
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
      openBlockModal(payload.trigger_id, meta.channel, meta.ts, meta.text);
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
function openBlockModal(triggerId, channel, ts, prefillText) {
  const modal = {
    type             : 'modal',
    callback_id      : 'block_task_modal',
    private_metadata : JSON.stringify({ channel: channel, ts: ts, text: prefillText }),
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
    logSlackError('submitCreateTask', err);
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

    // Reutilizar handleBlockTask que ya existe en Codigo.gs
    const resultRaw = handleBlockTask({
      task_name  : text,
      reason     : reason,
      slack_user : payload.user.name || payload.user.id
    });
    const resultObj = JSON.parse(resultRaw.getContent());

    const msg = resultObj.success
      ? '⛔ *Tarea bloqueada:* ' + resultObj.message.replace('Tarea bloqueada: ', '') + '\n📝 Razón: ' + reason
      : '❌ No encontré la tarea en el tracker.\nBúscala en el dashboard y cámbiala manualmente.';

    postThreadReply(meta.channel, meta.ts, msg);
    logSlackEvent({ action: 'block', task_name: text, slack_user: payload.user.id, result: resultObj.success ? 'OK' : 'NOT_FOUND' });

    return jsonResponse({ response_action: 'clear' });

  } catch (err) {
    logSlackError('submitBlockTask', err);
    return jsonResponse({
      response_action : 'errors',
      errors          : { reason: 'Error al bloquear: ' + err.message }
    });
  }
}

// ════════════════════════════════════════════════════════════════
// CIERRE DIRECTO ✅ — sin formulario, fuzzy match en el sheet
// ════════════════════════════════════════════════════════════════
function quickCloseTask(channel, ts, messageText, userId) {
  if (!messageText) return;

  // Reutilizar handleCloseTask que ya existe en Codigo.gs
  const resultRaw = handleCloseTask({
    task_name    : messageText,
    message_text : messageText,
    slack_user   : userId
  });
  const obj = JSON.parse(resultRaw.getContent());

  const msg = obj.success
    ? '✅ ' + obj.message
    : '❌ No encontré esa tarea en el tracker.\nPuede que el texto del mensaje no coincida con el nombre exacto. Ciérrala manualmente desde el dashboard.';

  postThreadReply(channel, ts, msg);
  logSlackEvent({ action: 'close', task_name: messageText, slack_user: userId, result: obj.success ? 'OK' : 'NOT_FOUND' });
}

// ════════════════════════════════════════════════════════════════
// HELPERS — Slack API
// ════════════════════════════════════════════════════════════════

function callSlackAPI(method, body) {
  const resp = UrlFetchApp.fetch('https://slack.com/api/' + method, {
    method         : 'post',
    contentType    : 'application/json; charset=utf-8',
    headers        : { 'Authorization': 'Bearer ' + SLACK_BOT_TOKEN },
    payload        : JSON.stringify(body),
    muteHttpExceptions: true
  });
  const data = JSON.parse(resp.getContentText());
  if (!data.ok) logSlackError('Slack API / ' + method, { message: data.error, stack: JSON.stringify(body).substring(0, 200) });
  return data;
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
    logSlackError('fetchMessageText', e);
  }
  return '';
}

/** Responde en el hilo del mensaje original */
function postThreadReply(channel, ts, text) {
  callSlackAPI('chat.postMessage', {
    channel   : channel,
    thread_ts : ts,
    text      : text,
    mrkdwn    : true
  });
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

function logSlackError(context, err) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ws = ss.getSheetByName(SLACK_LOG_SHEET);
    if (ws) {
      ws.appendRow([new Date(), 'ERROR: ' + context, err.message || '', '', '', err.stack || '']);
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
