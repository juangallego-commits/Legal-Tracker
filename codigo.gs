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
