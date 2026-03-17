// ════════════════════════════════════════════════════════════════
// Legal Team Tracker · Google Apps Script · Web App
// RappiPlus Colombia · v2.1
// ════════════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────────────
const SHEET_ID = '19eR-pXzVLTSEdCADeBZ8fsd5x4f2t0GowUJiJm2X6ms';
const SHEET_ACTIVO = 'Tracking Activo';
const SHEET_HISTORIAL = 'Historial';
const SHEET_CONFIG = 'Config';

// ── WEB APP ENTRY POINT ─────────────────────────────────────────
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  if (page === 'api') {
    return ContentService
      .createTextOutput(JSON.stringify(getTrackerData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const html = HtmlService.createTemplateFromFile('Dashboard');
  html.data = JSON.stringify(getTrackerData());
  return html.evaluate()
    .setTitle('Legal Tracker · RappiPlus CO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ── INCLUDE HTML PARTIALS ───────────────────────────────────────
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── READ ALL TRACKER DATA ───────────────────────────────────────
function getTrackerData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const wsActive = ss.getSheetByName(SHEET_ACTIVO);
  const activeTasks = readTasks(wsActive);
  const wsHist = ss.getSheetByName(SHEET_HISTORIAL);
  const histTasks = readTasks(wsHist);
  const config = readConfig(ss);
  
  // Team members from Config
  const membersRaw = config['Miembros'] || '';
  const membersList = membersRaw.split(',').map(s => s.trim()).filter(Boolean);
  
  // KPIs
  const total = activeTasks.length;
  const alta = activeTasks.filter(t => t.priority === 'Alta').length;
  const media = activeTasks.filter(t => t.priority === 'Media').length;
  const baja = activeTasks.filter(t => t.priority === 'Baja').length;
  const pendiente = activeTasks.filter(t => t.status === 'Pendiente').length;
  const enCurso = activeTasks.filter(t => t.status === 'En curso').length;
  const bloqueado = activeTasks.filter(t => t.status === 'Bloqueado').length;
  const listo = activeTasks.filter(t => t.status === 'Listo').length;
  
  // Per-person stats — seed from Config
  const teamMap = {};
  membersList.forEach(name => {
    teamMap[name] = { total:0, alta:0, media:0, baja:0, pendiente:0, enCurso:0, bloqueado:0, listo:0 };
  });
  activeTasks.forEach(t => {
    if (!teamMap[t.resp]) {
      teamMap[t.resp] = { total:0, alta:0, media:0, baja:0, pendiente:0, enCurso:0, bloqueado:0, listo:0 };
    }
    const p = teamMap[t.resp];
    p.total++;
    if (t.priority === 'Alta') p.alta++;
    if (t.priority === 'Media') p.media++;
    if (t.priority === 'Baja') p.baja++;
    if (t.status === 'Pendiente') p.pendiente++;
    if (t.status === 'En curso') p.enCurso++;
    if (t.status === 'Bloqueado') p.bloqueado++;
    if (t.status === 'Listo') p.listo++;
  });
  
  const team = Object.keys(teamMap).sort().map(name => ({
    name: name,
    initials: name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase(),
    ...teamMap[name],
    pctDone: teamMap[name].total > 0 ? Math.round(teamMap[name].listo / teamMap[name].total * 100) : 0
  }));
  
  const semana = activeTasks.length > 0 ? activeTasks[0].semana : 'Sin datos';
  
  // SLA calculation (days since creation)
  const now = new Date();
  const slaData = { onTime: 0, atRisk: 0, overdue: 0 };
  const slaLimits = { Alta: 2, Media: 5, Baja: 7 };
  activeTasks.forEach(t => {
    if (t.status === 'Listo') return;
    if (!t.creadoRaw) { slaData.onTime++; return; }
    const created = new Date(t.creadoRaw);
    const bizDays = countBizDays(created, now);
    const limit = slaLimits[t.priority] || 5;
    if (bizDays > limit) slaData.overdue++;
    else if (bizDays >= limit - 1) slaData.atRisk++;
    else slaData.onTime++;
  });
  
  return {
    tasks: activeTasks,
    historial: histTasks,
    kpi: { total, alta, media, baja, pendiente, enCurso, bloqueado, listo },
    sla: slaData,
    team: team,
    semana: semana,
    generated: Utilities.formatDate(new Date(), 'America/Bogota', "dd/MM/yyyy HH:mm"),
    config: config
  };
}

// ── COUNT BUSINESS DAYS ─────────────────────────────────────────
function countBizDays(start, end) {
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// ── READ TASKS FROM SHEET ───────────────────────────────────────
function readTasks(ws) {
  if (!ws) return [];
  const lastRow = ws.getLastRow();
  if (lastRow < 4) return [];
  const data = ws.getRange(4, 1, lastRow - 3, 11).getValues();
  const tasks = [];
  data.forEach(row => {
    if (!row[1]) return;
    tasks.push({
      id: row[0],
      nombre: row[1] || '',
      resp: row[2] || '',
      acc: row[3] || '',
      deadline: row[4] || '',
      priority: row[5] || 'Media',
      status: row[6] || 'Pendiente',
      semana: row[7] || '',
      creado: row[8] ? Utilities.formatDate(new Date(row[8]), 'America/Bogota', 'dd/MM/yyyy') : '',
      creadoRaw: row[8] ? new Date(row[8]).toISOString() : null,
      cerrado: row[9] ? Utilities.formatDate(new Date(row[9]), 'America/Bogota', 'dd/MM/yyyy') : '',
      notas: row[10] || ''
    });
  });
  const prioOrder = { 'Alta': 0, 'Media': 1, 'Baja': 2 };
  const statusOrder = { 'Bloqueado': 0, 'En curso': 1, 'Pendiente': 2, 'Listo': 3 };
  tasks.sort((a, b) => (prioOrder[a.priority] || 1) - (prioOrder[b.priority] || 1)
    || (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2));
  return tasks;
}

// ── READ CONFIG ─────────────────────────────────────────────────
function readConfig(ss) {
  const ws = ss.getSheetByName(SHEET_CONFIG);
  if (!ws) return {};
  const lastRow = ws.getLastRow();
  if (lastRow < 3) return {};
  const data = ws.getRange(3, 1, lastRow - 2, 2).getValues();
  const config = {};
  data.forEach(row => { if (row[0]) config[row[0]] = row[1]; });
  return config;
}

// ── ADD NEW TASK ────────────────────────────────────────────────
function addTask(taskObj) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ws = ss.getSheetByName(SHEET_ACTIVO);
  const lastRow = ws.getLastRow();
  const newId = lastRow >= 4 ? ws.getRange(lastRow, 1).getValue() + 1 : 1;
  ws.appendRow([
    newId,
    taskObj.nombre || '',
    taskObj.resp || '',
    taskObj.acc || '',
    taskObj.deadline || 'Por definir',
    taskObj.priority || 'Media',
    taskObj.status || 'Pendiente',
    taskObj.semana || getCurrentWeekLabel(),
    new Date(),
    '',
    taskObj.notas || ''
  ]);
  return { success: true, id: newId };
}

// ── UPDATE ANY TASK FIELD (for inline editing) ──────────────────
function updateTaskField(taskId, field, value) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ws = ss.getSheetByName(SHEET_ACTIVO);
  const lastRow = ws.getLastRow();
  if (lastRow < 4) return { success: false, error: 'No tasks' };
  
  const data = ws.getRange(4, 1, lastRow - 3, 11).getValues();
  const fieldMap = {
    'nombre': 2, 'resp': 3, 'acc': 4, 'deadline': 5,
    'priority': 6, 'status': 7, 'notas': 11
  };
  const col = fieldMap[field];
  if (!col) return { success: false, error: 'Invalid field: ' + field };
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] == taskId) {
      const row = i + 4;
      ws.getRange(row, col).setValue(value);
      
      // If marking as Listo, set close date and move to Historial
      if (field === 'status' && value === 'Listo') {
        ws.getRange(row, 10).setValue(new Date());
        moveToHistorial(ss, ws, row);
        return { success: true, moved: true, message: 'Tarea movida a Historial' };
      }
      
      return { success: true };
    }
  }
  return { success: false, error: 'Task #' + taskId + ' not found' };
}

// ── UPDATE TASK STATUS (legacy, still used by Slack) ────────────
function updateTaskStatus(taskId, newStatus) {
  return updateTaskField(taskId, 'status', newStatus);
}

// ── MOVE COMPLETED TASK TO HISTORIAL ────────────────────────────
function moveToHistorial(ss, wsActive, row) {
  const wsHist = ss.getSheetByName(SHEET_HISTORIAL);
  const rowData = wsActive.getRange(row, 1, 1, 11).getValues()[0];
  const histLast = wsHist.getLastRow();
  const newHistId = histLast >= 4 ? wsHist.getRange(histLast, 1).getValue() + 1 : 1;
  rowData[0] = newHistId;
  wsHist.appendRow(rowData);
  wsActive.deleteRow(row);
  renumberTasks(wsActive);
}

// ── RE-NUMBER TASKS ─────────────────────────────────────────────
function renumberTasks(ws) {
  const lastRow = ws.getLastRow();
  if (lastRow < 4) return;
  for (let i = 4; i <= lastRow; i++) {
    ws.getRange(i, 1).setValue(i - 3);
  }
}

// ── HELPER: Current week label ──────────────────────────────────
function getCurrentWeekLabel() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return monday.getDate() + '-' + friday.getDate() + ' ' + months[friday.getMonth()] + ' ' + friday.getFullYear();
}
// ════════════════════════════════════════════════════════════════
// SLACK INTEGRATION — Agregar al final de tu Codigo.gs actual
// ════════════════════════════════════════════════════════════════

// ── SLACK CONFIG ────────────────────────────────────────────────
// Canal donde el bot confirma las tareas creadas (opcional)
const SLACK_WEBHOOK_URL = 'TU_SLACK_WEBHOOK_URL_AQUI'; // Incoming webhook para confirmaciones
const SLACK_LOG_SHEET = 'Slack Log'; // Hoja de auditoría

// ── doPost: RECIBE WEBHOOKS DE SLACK WORKFLOW BUILDER ───────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    
    // Log every incoming request for debugging
    logSlackEvent(payload);
    
    // Route based on action type
    const action = (payload.action || '').toLowerCase();
    
    if (action === 'create' || action === 'crear') {
      return handleCreateTask(payload);
    } else if (action === 'close' || action === 'cerrar') {
      return handleCloseTask(payload);
    } else if (action === 'block' || action === 'bloquear') {
      return handleBlockTask(payload);
    } else {
      // Default: treat as create
      return handleCreateTask(payload);
    }
    
  } catch (err) {
    logError('doPost', err);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ── HANDLE: CREATE TASK FROM SLACK ──────────────────────────────
function handleCreateTask(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ws = ss.getSheetByName(SHEET_ACTIVO);
  const lastRow = ws.getLastRow();
  const newId = lastRow >= 4 ? ws.getRange(lastRow, 1).getValue() + 1 : 1;
  
  // Extract fields from Slack Workflow variables
  // These map to the variables you configure in Workflow Builder
  const nombre = payload.task_name || payload.message_text || 'Tarea desde Slack';
  const resp = payload.responsable || payload.assigned_to || '';
  const acc = payload.accionable || payload.next_step || '';
  const deadline = payload.deadline || 'Por definir';
  const priority = normalizePriority(payload.priority || 'Media');
  const notas = buildSlackNotes(payload);
  
  ws.appendRow([
    newId,
    truncate(nombre, 60),
    resp,
    acc,
    deadline,
    priority,
    'Pendiente',
    getCurrentWeekLabel(),
    new Date(),
    '',
    notas
  ]);
  
  // Optional: send confirmation back to Slack
  if (SLACK_WEBHOOK_URL && SLACK_WEBHOOK_URL !== 'TU_SLACK_WEBHOOK_URL_AQUI') {
    sendSlackConfirmation(nombre, resp, priority, newId);
  }
  
  return jsonResponse({ 
    success: true, 
    id: newId, 
    message: 'Tarea #' + newId + ' creada: ' + nombre 
  });
}

// ── HANDLE: CLOSE TASK FROM SLACK (✅ reaction) ─────────────────
function handleCloseTask(payload) {
  const taskName = payload.task_name || payload.message_text || '';
  if (!taskName) {
    return jsonResponse({ success: false, error: 'No task name provided' });
  }
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ws = ss.getSheetByName(SHEET_ACTIVO);
  const lastRow = ws.getLastRow();
  if (lastRow < 4) return jsonResponse({ success: false, error: 'No active tasks' });
  
  const data = ws.getRange(4, 1, lastRow - 3, 11).getValues();
  
  // Fuzzy match: find task by partial name match
  let matchIdx = -1;
  const searchTerm = taskName.toLowerCase().trim();
  
  for (let i = 0; i < data.length; i++) {
    const name = (data[i][1] || '').toLowerCase();
    if (name === searchTerm || name.includes(searchTerm) || searchTerm.includes(name)) {
      matchIdx = i;
      break;
    }
  }
  
  if (matchIdx === -1) {
    return jsonResponse({ success: false, error: 'Task not found: ' + taskName });
  }
  
  const row = matchIdx + 4;
  const taskId = data[matchIdx][0];
  ws.getRange(row, 7).setValue('Listo');
  ws.getRange(row, 10).setValue(new Date());
  moveToHistorial(ss, ws, row);
  
  return jsonResponse({ 
    success: true, 
    message: 'Tarea #' + taskId + ' marcada como Listo y movida a Historial' 
  });
}

// ── HANDLE: BLOCK TASK FROM SLACK ───────────────────────────────
function handleBlockTask(payload) {
  const taskName = payload.task_name || payload.message_text || '';
  if (!taskName) {
    return jsonResponse({ success: false, error: 'No task name provided' });
  }
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ws = ss.getSheetByName(SHEET_ACTIVO);
  const lastRow = ws.getLastRow();
  if (lastRow < 4) return jsonResponse({ success: false, error: 'No active tasks' });
  
  const data = ws.getRange(4, 1, lastRow - 3, 11).getValues();
  const searchTerm = taskName.toLowerCase().trim();
  
  for (let i = 0; i < data.length; i++) {
    const name = (data[i][1] || '').toLowerCase();
    if (name === searchTerm || name.includes(searchTerm) || searchTerm.includes(name)) {
      const row = i + 4;
      ws.getRange(row, 7).setValue('Bloqueado');
      const reason = payload.reason || payload.notas || '';
      if (reason) {
        const existing = ws.getRange(row, 11).getValue() || '';
        ws.getRange(row, 11).setValue(
          (existing ? existing + ' | ' : '') + '⛔ ' + reason + ' (' + new Date().toLocaleDateString('es-CO') + ')'
        );
      }
      return jsonResponse({ success: true, message: 'Tarea bloqueada: ' + data[i][1] });
    }
  }
  
  return jsonResponse({ success: false, error: 'Task not found: ' + taskName });
}

// ── HELPERS ─────────────────────────────────────────────────────

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizePriority(input) {
  const p = (input || '').toLowerCase().trim();
  if (p.includes('alta') || p.includes('high') || p.includes('🔴')) return 'Alta';
  if (p.includes('baja') || p.includes('low') || p.includes('🟢')) return 'Baja';
  return 'Media';
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max - 1) + '…' : str;
}

function buildSlackNotes(payload) {
  const parts = [];
  if (payload.slack_channel) parts.push('Canal: #' + payload.slack_channel);
  if (payload.slack_user) parts.push('Creado por: ' + payload.slack_user);
  if (payload.slack_link) parts.push('Msg: ' + payload.slack_link);
  if (payload.notas) parts.push(payload.notas);
  parts.push('Vía Slack · ' + new Date().toLocaleDateString('es-CO'));
  return parts.join(' | ');
}

function sendSlackConfirmation(nombre, resp, priority, id) {
  const emoji = { Alta: '🔴', Media: '🟡', Baja: '🟢' };
  const msg = {
    text: '✅ *Tarea #' + id + ' registrada en el Legal Tracker*\n' +
          '📝 ' + nombre + '\n' +
          '👤 ' + (resp || 'Sin asignar') + ' · ' + (emoji[priority] || '🟡') + ' ' + priority
  };
  
  try {
    UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(msg)
    });
  } catch(e) {
    logError('sendSlackConfirmation', e);
  }
}

// ── LOGGING ─────────────────────────────────────────────────────
function logSlackEvent(payload) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let ws = ss.getSheetByName(SLACK_LOG_SHEET);
    
    // Create log sheet if it doesn't exist
    if (!ws) {
      ws = ss.insertSheet(SLACK_LOG_SHEET);
      ws.appendRow(['Timestamp', 'Action', 'Task Name', 'User', 'Channel', 'Raw JSON']);
      ws.getRange(1, 1, 1, 6).setFontWeight('bold');
      ws.setTabColor('#A78BFA');
    }
    
    ws.appendRow([
      new Date(),
      payload.action || 'unknown',
      payload.task_name || payload.message_text || '',
      payload.slack_user || '',
      payload.slack_channel || '',
      JSON.stringify(payload).substring(0, 500)
    ]);
    
    // Keep only last 500 logs
    const lastRow = ws.getLastRow();
    if (lastRow > 502) {
      ws.deleteRows(2, lastRow - 501);
    }
  } catch(e) {
    // Silent fail on logging — don't break main flow
    console.error('logSlackEvent error:', e);
  }
}

function logError(context, err) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let ws = ss.getSheetByName(SLACK_LOG_SHEET);
    if (ws) {
      ws.appendRow([new Date(), 'ERROR: ' + context, err.message, '', '', err.stack || '']);
    }
  } catch(e) {
    console.error('logError failed:', e);
  }
}

// ── TEST FUNCTION (run manually to verify setup) ────────────────
function testDoPost() {
  // Simulates a Slack webhook creating a task
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'create',
        task_name: 'TEST — Tarea de prueba desde Slack',
        responsable: 'Carlos Fernández',
        accionable: 'Verificar que la integración funciona',
        deadline: 'Hoy',
        priority: 'Alta',
        slack_user: 'carlos.fernandez',
        slack_channel: 'legal-team',
        notas: 'Esta es una prueba, puedes borrarla'
      })
    }
  };
  
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
