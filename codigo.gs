// ════════════════════════════════════════════════════════════════
// Legal Team Tracker · Google Apps Script · Web App
// RappiPlus · Global Legal · v3.2 (Projects)
// ════════════════════════════════════════════════════════════════

const SHEET_ID        = '19eR-pXzVLTSEdCADeBZ8fsd5x4f2t0GowUJiJm2X6ms';
const SHEET_ACTIVO    = 'Tracking Activo';
const SHEET_HISTORIAL = 'Historial';
const SHEET_CONFIG    = 'Config';
const SHEET_EQUIPOS   = 'Equipos';
const SHEET_PROYECTOS = 'Proyectos';

// Tasks: 16 cols — ID,Nombre,Resp,Acc,Deadline,Prioridad,Estado,Semana,Creado,Cerrado,Notas,Proyecto(ID),País,Líder,TipoTrabajo,Riesgo
const TASK_COLS = 16;
// Projects: 15 cols — ID,Nombre,País,Líder,Responsable,Deadline,Prioridad,Estado,Descripción,Notas,Creado,Semana,Participantes,TipoTrabajo,Riesgo
const PROJ_COLS = 15;

const STATUS_ORDER = {'Bloqueado':0,'En curso':1,'Pendiente':2,'En revisión':3,'Listo':4};
const PRIO_ORDER   = {'Alta':0,'Media':1,'Baja':2};
const PROJ_STATUSES = ['Activo','En pausa','Completado','Cancelado'];

// ── CACHE ───────────────────────────────────────────────────────
// Cacheamos el snapshot completo por 30s. Cualquier escritura llama a invalidateCache().
const CACHE_KEY = 'tracker_data_v1';
const CACHE_TTL_SEC = 30;
function invalidateCache() { try { CacheService.getScriptCache().remove(CACHE_KEY); } catch(e) {} }

// ── WEB APP ─────────────────────────────────────────────────────
// doGet valida que el visitante esté en la allowlist de la hoja Equipos antes de
// renderizar el dashboard. La allowlist combina leaderEmail + emails de cada equipo.
// Requisitos de deployment:
//   - Execute as: Me (owner)
//   - Who has access: Anyone within <dominio> (o Anyone with Google account)
// Así Session.getActiveUser().getEmail() retorna el email verificado del visitante.
function doGet(e) {
  var page = e && e.parameter && e.parameter.page;

  // Endpoint /api?page=api sigue abierto para scripts internos (cambia si necesitas
  // protegerlo también; típicamente se restringe con execute-as y acceso limitado).
  if (page === 'api') {
    return ContentService.createTextOutput(JSON.stringify(getTrackerData()))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 1) Autenticación: resolver el usuario visitante contra la allowlist
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var equipos = readEquipos(ss);
  var authResult = resolveVisitor(equipos);

  if (!authResult.ok) {
    return renderAccessDenied(authResult);
  }

  // 2) Render normal, con el usuario ya resuelto
  var html = HtmlService.createTemplateFromFile('Dashboard');
  html.data = JSON.stringify(getTrackerData());
  html.currentUser = JSON.stringify({
    email: authResult.email,
    name:  authResult.user.name,
    code:  authResult.user.code,
    isLeader: !!authResult.user.isLeader
  });
  return html.evaluate()
    .setTitle('Legal Tracker · Rappi')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function include(f){ return HtmlService.createHtmlOutputFromFile(f).getContent(); }

// ── AUTH HELPERS ────────────────────────────────────────────────
// Arma un mapa (email lowercase) → {name, code, isLeader} a partir de la hoja Equipos.
// - leaderEmail se mapea a leader
// - emails[i] se asume paralelo a members[i] (mismo orden)
function buildEmailAllowlist(equipos) {
  var map = {};
  equipos.forEach(function(eq) {
    if (eq.leaderEmail) {
      map[eq.leaderEmail.toString().toLowerCase().trim()] = { name: eq.leader, code: eq.code, isLeader: true };
    }
    for (var i = 0; i < (eq.members || []).length; i++) {
      var email = (eq.emails || [])[i];
      if (email) {
        map[email.toString().toLowerCase().trim()] = { name: eq.members[i], code: eq.code, isLeader: false };
      }
    }
  });
  return map;
}

// Retorna {ok:true, email, user} si el visitante tiene acceso; caso contrario
// {ok:false, reason, email} para mostrar el motivo en la página de denegado.
function resolveVisitor(equipos) {
  var email = '';
  try { email = (Session.getActiveUser().getEmail() || '').toLowerCase().trim(); } catch(e) {}
  if (!email) {
    return { ok: false, reason: 'no_session',
      message: 'No pudimos identificar tu cuenta. Asegúrate de estar logueado en Google con tu correo corporativo.' };
  }
  var allow = buildEmailAllowlist(equipos);
  var user = allow[email];
  if (!user) {
    return { ok: false, reason: 'not_allowlisted', email: email,
      message: 'Tu correo (' + email + ') no está registrado en el tracker. Pide a tu líder de equipo que lo agregue en la hoja "Equipos".' };
  }
  return { ok: true, email: email, user: user };
}

// Renderiza una página simple de "acceso denegado" con el mismo look del tracker.
function renderAccessDenied(authResult) {
  var safeMsg = (authResult.message || 'Acceso denegado').replace(/</g, '&lt;');
  var body = ''
    + '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Legal Tracker · Sin acceso</title>'
    + '<style>'
    +   'body{background:#0C0E14;color:#F0F2F8;font-family:system-ui,sans-serif;'
    +        'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}'
    +   '.box{max-width:420px;background:#151820;border:1px solid rgba(255,255,255,.08);'
    +        'border-radius:16px;padding:40px;text-align:center}'
    +   '.logo{width:56px;height:56px;border-radius:16px;background:#FF4940;display:flex;'
    +         'align-items:center;justify-content:center;font-size:26px;margin:0 auto 20px}'
    +   'h1{font-size:20px;font-weight:800;margin:0 0 12px}'
    +   'p{color:#9099B0;font-size:13px;line-height:1.55;margin:0}'
    +   '.email{font-family:ui-monospace,monospace;color:#FFB938;word-break:break-all}'
    + '</style></head><body>'
    + '<div class="box">'
    +   '<div class="logo">🔒</div>'
    +   '<h1>Sin acceso al Legal Tracker</h1>'
    +   '<p>' + safeMsg + '</p>'
    + '</div></body></html>';
  return HtmlService.createHtmlOutput(body)
    .setTitle('Legal Tracker · Sin acceso')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ════════════════════════════════════════════════════════════════
// GET ALL DATA
// ════════════════════════════════════════════════════════════════
function getTrackerData() {
  // Cache check — hits dentro de CACHE_TTL_SEC devuelven sin tocar el Sheet.
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch(e) { /* si el cache falla, seguimos y leemos del Sheet */ }
  var result = _buildTrackerData();
  // CacheService tiene límite de 100KB por key — si se excede, put() lanza y lo ignoramos.
  try { CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(result), CACHE_TTL_SEC); } catch(e) {}
  return result;
}

function _buildTrackerData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var activeTasks = readTasks(ss.getSheetByName(SHEET_ACTIVO));
  var histTasks   = readTasks(ss.getSheetByName(SHEET_HISTORIAL));
  var config  = readConfig(ss);
  var equipos = readEquipos(ss);
  var projects = readProjects(ss);

  // ── Enrich projects with task stats ─────────────────────────
  projects.forEach(function(p) {
    p.tasks = []; p.taskStats = {total:0,pendiente:0,enCurso:0,enRevision:0,bloqueado:0,listo:0,alta:0,media:0,baja:0};
  });
  var projMap = {};
  projects.forEach(function(p){ projMap[p.id] = p; });

  activeTasks.forEach(function(t) {
    var pid = t.proyectoId;
    if (pid && projMap[pid]) {
      projMap[pid].tasks.push(t);
      var s = projMap[pid].taskStats; s.total++;
      if(t.status==='Pendiente')s.pendiente++;if(t.status==='En curso')s.enCurso++;
      if(t.status==='En revisión')s.enRevision++;if(t.status==='Bloqueado')s.bloqueado++;
      if(t.status==='Listo')s.listo++;
      if(t.priority==='Alta')s.alta++;if(t.priority==='Media')s.media++;if(t.priority==='Baja')s.baja++;
    }
  });
// Count completed tasks from historial toward project stats
  histTasks.forEach(function(t) {
    var pid = t.proyectoId;
    if (pid && projMap[pid]) {
      var s = projMap[pid].taskStats; s.total++; s.listo++;
    }
  });
  // Auto-calculate project status (if not manually forced)
  projects.forEach(function(p) {
    var s = p.taskStats;
    p.pctDone = s.total > 0 ? Math.round(s.listo / s.total * 100) : 0;
    // Si el usuario puso un status manual, respetarlo SALVO 'Cancelado' (siempre respetado)
    // y salvo que todas las tareas estén listas (entonces sí auto-promover a Completado).
    if (p.status === 'Cancelado') return;
    if (s.total > 0 && s.listo === s.total) { p.status = 'Completado'; return; }
    if (p.statusForced) return; // otros estados manuales (En pausa, Completado sin tareas) se respetan
    if (s.total === 0) return; // sin tareas, no tocar
    if (s.bloqueado > 0 && s.enCurso === 0 && s.pendiente === 0 && s.enRevision === 0) p.status = 'En pausa';
    else p.status = 'Activo';
  });

  // ── KPIs ────────────────────────────────────────────────────
  var total=activeTasks.length,alta=0,media=0,baja=0,pendiente=0,enCurso=0,bloqueado=0,enRevision=0,listo=0;
  activeTasks.forEach(function(t){
    if(t.priority==='Alta')alta++;if(t.priority==='Media')media++;if(t.priority==='Baja')baja++;
    if(t.status==='Pendiente')pendiente++;if(t.status==='En curso')enCurso++;
    if(t.status==='Bloqueado')bloqueado++;if(t.status==='En revisión')enRevision++;if(t.status==='Listo')listo++;
  });

  // ── Per-person stats ────────────────────────────────────────
  var allMembers = getAllMembers(equipos);
  var teamMap = {};
  allMembers.forEach(function(n){teamMap[n]={total:0,alta:0,media:0,baja:0,pendiente:0,enCurso:0,bloqueado:0,enRevision:0,listo:0}});
  activeTasks.forEach(function(t){
    if(!teamMap[t.resp])teamMap[t.resp]={total:0,alta:0,media:0,baja:0,pendiente:0,enCurso:0,bloqueado:0,enRevision:0,listo:0};
    var p=teamMap[t.resp];p.total++;
    if(t.priority==='Alta')p.alta++;if(t.priority==='Media')p.media++;if(t.priority==='Baja')p.baja++;
    if(t.status==='Pendiente')p.pendiente++;if(t.status==='En curso')p.enCurso++;
    if(t.status==='Bloqueado')p.bloqueado++;if(t.status==='En revisión')p.enRevision++;if(t.status==='Listo')p.listo++;
  });
  var team = Object.keys(teamMap).sort().map(function(name){
    return {name:name,initials:name.split(' ').slice(0,2).map(function(w){return w[0]}).join('').toUpperCase(),
      country:getCountryForMember(name,equipos),total:teamMap[name].total,alta:teamMap[name].alta,media:teamMap[name].media,
      baja:teamMap[name].baja,pendiente:teamMap[name].pendiente,enCurso:teamMap[name].enCurso,bloqueado:teamMap[name].bloqueado,
      enRevision:teamMap[name].enRevision,listo:teamMap[name].listo,
      pctDone:teamMap[name].total>0?Math.round(teamMap[name].listo/teamMap[name].total*100):0};
  });

  // ── Per-country stats ───────────────────────────────────────
  var countryStats = {};
  equipos.forEach(function(eq){countryStats[eq.code]={code:eq.code,name:eq.country,leader:eq.leader,total:0,alta:0,media:0,baja:0}});
  activeTasks.forEach(function(t){var cc=t.pais||getCountryForMember(t.resp,equipos);if(cc&&countryStats[cc]){var c=countryStats[cc];c.total++;if(t.priority==='Alta')c.alta++;if(t.priority==='Media')c.media++;if(t.priority==='Baja')c.baja++}});

  // ── SLA ─────────────────────────────────────────────────────
  var now=new Date(),slaData={onTime:0,atRisk:0,overdue:0},slaLimits={Alta:2,Media:5,Baja:7};
  activeTasks.forEach(function(t){
    if(t.status==='Listo')return;if(!t.creadoRaw){slaData.onTime++;return}
    var bizDays=countBizDays(new Date(t.creadoRaw),now),limit=slaLimits[t.priority]||5;
    if(bizDays>limit)slaData.overdue++;else if(bizDays>=limit-1)slaData.atRisk++;else slaData.onTime++;
  });

  // ── Project list for dropdowns (id + name) ──────────────────
  var projectList = projects.filter(function(p){return p.status!=='Completado'&&p.status!=='Cancelado'}).map(function(p){return {id:p.id,nombre:p.nombre}});

  return {
    tasks:activeTasks, historial:histTasks,
    kpi:{total:total,alta:alta,media:media,baja:baja,pendiente:pendiente,enCurso:enCurso,bloqueado:bloqueado,enRevision:enRevision,listo:listo},
    sla:slaData, team:team, countries:Object.values(countryStats),
    equipos:equipos, projects:projects, projectList:projectList,
    semana:activeTasks.length>0?activeTasks[0].semana:getCurrentWeekLabel(),
    generated:Utilities.formatDate(new Date(),'America/Bogota','dd/MM/yyyy HH:mm'), config:config
  };
}

// ════════════════════════════════════════════════════════════════
// PROJECTS CRUD
// ════════════════════════════════════════════════════════════════
function readProjects(ss) {
  var ws = ss.getSheetByName(SHEET_PROYECTOS);
  if (!ws) return [];
  var lastRow = ws.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = Math.min(ws.getLastColumn(), PROJ_COLS);
  var data = ws.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var projects = [];
  data.forEach(function(row) {
    if (!row[1]) return;
    projects.push({
      id: row[0], nombre: row[1]||'', pais: (row[2]||'').toString().trim(),
      lider: (row[3]||'').toString().trim(), responsable: (row[4]||'').toString().trim(),
      deadline: row[5]?(row[5] instanceof Date?Utilities.formatDate(row[5],'America/Bogota','dd/MM/yyyy'):row[5].toString()):'',
      deadlineISO: row[5]?(row[5] instanceof Date?Utilities.formatDate(row[5],'America/Bogota','yyyy-MM-dd'):''):'', priority: row[6]||'Media',
      status: row[7]||'Activo',
      // Cualquier estado distinto del default 'Activo' se considera puesto manualmente y se respeta.
      statusForced: (function(){ var s=(row[7]||'').toString().trim(); return s!=='' && s!=='Activo'; })(),
      descripcion: row[8]||'', notas: row[9]||'',
      creado: row[10]? Utilities.formatDate(new Date(row[10]),'America/Bogota','dd/MM/yyyy'):'',
      semana: row[11]||'',
      participantes: (row[12]||'').toString().split(',').map(function(s){return s.trim()}).filter(Boolean),
      tipoTrabajo: (row[13]||'').toString().trim(),
      riesgo: (row[14]||'').toString().trim(),
      pctDone: 0, tasks: [], taskStats: {}
    });
  });
  return projects;
}

function addProject(obj) {
  invalidateCache();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var ws = ss.getSheetByName(SHEET_PROYECTOS);
  if (!ws) {
    ws = ss.insertSheet(SHEET_PROYECTOS);
    ws.appendRow(['ID','Nombre','País','Líder','Responsable','Deadline','Prioridad','Estado','Descripción','Notas','Creado','Semana']);
    ws.getRange(1,1,1,PROJ_COLS).setFontWeight('bold').setBackground('#FF4940').setFontColor('#FFFFFF');
    ws.setTabColor('#FF4940');
  }
  var lastRow = ws.getLastRow();
  // max(IDs existentes) + 1 — resiste borrados y mantiene IDs únicos.
  var newId = 1;
  if (lastRow >= 2) {
    var ids = ws.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(r){ var v = parseInt(r[0]); if (!isNaN(v) && v >= newId) newId = v + 1; });
  }
  var equipos = readEquipos(ss);
  var pais  = obj.pais || getCountryForMember(obj.responsable, equipos);
  var lider = obj.lider || getLeaderForCountry(pais, equipos);
  ws.appendRow([
    newId, obj.nombre||'', pais, lider, obj.responsable||'',
    obj.deadline||'', obj.priority||'Media', obj.status||'Activo',
    obj.descripcion||'', obj.notas||'', new Date(), getCurrentWeekLabel(), obj.participantes||'',
    obj.tipoTrabajo||'', obj.riesgo||''
  ]);
  return {success:true, id:newId, nombre:obj.nombre||''};
}

function updateProjectField(projId, field, value) {
  invalidateCache();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var ws = ss.getSheetByName(SHEET_PROYECTOS);
  if (!ws) return {success:false, error:'No projects sheet'};
  var lastRow = ws.getLastRow();
  if (lastRow < 2) return {success:false, error:'No projects'};
  var data = ws.getRange(2, 1, lastRow - 1, Math.min(ws.getLastColumn(), PROJ_COLS)).getValues();
  var fieldMap = {'nombre':2,'pais':3,'lider':4,'responsable':5,'deadline':6,'priority':7,'status':8,'descripcion':9,'notas':10,'participantes':13,'tipoTrabajo':14,'riesgo':15};
  var col = fieldMap[field];
  if (!col) return {success:false, error:'Invalid field: '+field};
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == projId) {
      ws.getRange(i + 2, col).setValue(value);
      return {success:true};
    }
  }
  return {success:false, error:'Project #'+projId+' not found'};
}

// ════════════════════════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════════════════════════
function readTasks(ws) {
  if (!ws) return [];
  var lastRow = ws.getLastRow(); if (lastRow < 4) return [];
  var lastCol = Math.min(ws.getLastColumn(), TASK_COLS);
  var data = ws.getRange(4, 1, lastRow - 3, lastCol).getValues();
  var tasks = [];
  data.forEach(function(row) {
    if (!row[1]) return;
    var proyVal = (row[11]||'').toString().trim();
    tasks.push({
      id:row[0], nombre:row[1]||'', resp:row[2]||'', acc:row[3]||'',
      deadline:row[4]?(row[4] instanceof Date?Utilities.formatDate(row[4],'America/Bogota','dd/MM/yyyy'):row[4].toString()):'',
      deadlineISO:row[4]?(row[4] instanceof Date?Utilities.formatDate(row[4],'America/Bogota','yyyy-MM-dd'):''):'', priority:row[5]||'Media', status:row[6]||'Pendiente',
      semana:row[7]||'',
      creado:row[8]?Utilities.formatDate(new Date(row[8]),'America/Bogota','dd/MM/yyyy'):'',
      creadoRaw:row[8]?new Date(row[8]).toISOString():null,
      cerrado:row[9]?Utilities.formatDate(new Date(row[9]),'America/Bogota','dd/MM/yyyy'):'',
      notas:row[10]||'',
      proyectoId: isNaN(parseInt(proyVal)) ? '' : parseInt(proyVal),
      proyecto: proyVal, // keep raw for backward compat
      pais:(row[12]||'').toString().trim(),
      lider:(row[13]||'').toString().trim(),
      tipoTrabajo:(row[14]||'').toString().trim(),
      riesgo:(row[15]||'').toString().trim()
    });
  });
  tasks.sort(function(a,b){return (PRIO_ORDER[a.priority]||1)-(PRIO_ORDER[b.priority]||1)||(STATUS_ORDER[a.status]||2)-(STATUS_ORDER[b.status]||2)});
  return tasks;
}

function addTask(taskObj) {
  invalidateCache();
  var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);
  var newId=nextTaskId(ss);
  var equipos=readEquipos(ss);
  var pais =taskObj.pais ||getCountryForMember(taskObj.resp,equipos);
  var lider=taskObj.lider||getLeaderForCountry(pais,equipos);
  // Normalizar proyectoId a entero; si no es válido, celda vacía.
  var pid = taskObj.proyectoId || taskObj.proyecto || '';
  var pidNum = parseInt(pid, 10);
  var pidCell = isNaN(pidNum) ? '' : pidNum;
  ws.appendRow([
    newId, taskObj.nombre||'', taskObj.resp||'', taskObj.acc||'',
    taskObj.deadline||'', taskObj.priority||'Media', taskObj.status||'Pendiente',
    taskObj.semana||getCurrentWeekLabel(), new Date(), '', taskObj.notas||'',
    pidCell, pais, lider,
    taskObj.tipoTrabajo||'', taskObj.riesgo||''
  ]);
  return {success:true, id:newId};
}

function updateTaskField(taskId, field, value) {
  invalidateCache();
  var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);
  var lastRow=ws.getLastRow();if(lastRow<4)return{success:false,error:'No tasks'};
  var lastCol=Math.min(ws.getLastColumn(),TASK_COLS);
  var data=ws.getRange(4,1,lastRow-3,lastCol).getValues();
  var fieldMap={'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16};
  var col=fieldMap[field];if(!col)return{success:false,error:'Invalid field: '+field};
  // Normalizar proyectoId a entero (o vacío)
  if(field==='proyectoId'||field==='proyecto'){var n=parseInt(value,10);value=isNaN(n)?'':n}
  for(var i=0;i<data.length;i++){
    if(data[i][0]==taskId){
      var row=i+4;ws.getRange(row,col).setValue(value);
      if(field==='status'&&value==='Listo'){ws.getRange(row,10).setValue(new Date());moveToHistorial(ss,ws,row);return{success:true,moved:true,message:'Tarea movida a Historial'}}
      return{success:true};
    }
  }
  return{success:false,error:'Task #'+taskId+' not found'};
}
function updateTaskStatus(taskId,newStatus){return updateTaskField(taskId,'status',newStatus)}

// Batch update: aplica varios campos en una sola llamada.
// Si `status` es 'Listo', se aplica al final y dispara el move a Historial (los demás campos ya quedaron escritos).
function updateTaskFields(taskId, fields) {
  invalidateCache();
  if (!fields || typeof fields !== 'object') return {success:false, error:'Invalid fields'};
  var ss = SpreadsheetApp.openById(SHEET_ID), ws = ss.getSheetByName(SHEET_ACTIVO);
  var lastRow = ws.getLastRow(); if (lastRow < 4) return {success:false, error:'No tasks'};
  var lastCol = Math.min(ws.getLastColumn(), TASK_COLS);
  var data = ws.getRange(4, 1, lastRow - 3, lastCol).getValues();
  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16};
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == taskId) {
      var row = i + 4;
      // 1) Aplicar todos los campos menos status
      Object.keys(fields).forEach(function(k) {
        if (k === 'status') return;
        var col = fieldMap[k];
        if (!col) return;
        var v = fields[k];
        // Normalizar proyectoId a entero (o vacío) — el HTML siempre envía string
        if (k === 'proyectoId' || k === 'proyecto') { var n = parseInt(v, 10); v = isNaN(n) ? '' : n; }
        ws.getRange(row, col).setValue(v);
      });
      // 2) Status al final (puede disparar move a Historial)
      if (fields.status !== undefined) {
        ws.getRange(row, 7).setValue(fields.status);
        if (fields.status === 'Listo') {
          ws.getRange(row, 10).setValue(new Date());
          moveToHistorial(ss, ws, row);
          return {success:true, moved:true, message:'Tarea movida a Historial'};
        }
      }
      return {success:true};
    }
  }
  return {success:false, error:'Task #' + taskId + ' not found'};
}

// ════════════════════════════════════════════════════════════════
// EQUIPOS / CONFIG / HELPERS
// ════════════════════════════════════════════════════════════════
function readEquipos(ss){var ws=ss.getSheetByName(SHEET_EQUIPOS);if(!ws)return getDefaultEquipos();var lr=ws.getLastRow();if(lr<2)return getDefaultEquipos();var data=ws.getRange(2,1,lr-1,8).getValues();var eq=[];data.forEach(function(r){var c=(r[0]||'').toString().trim();if(!c)return;eq.push({code:c,country:(r[1]||'').toString().trim(),leader:(r[2]||'').toString().trim().replace(/\n/g,''),leaderEmail:(r[3]||'').toString().trim(),members:(r[4]||'').toString().split(',').map(function(s){return s.trim()}).filter(Boolean),emails:(r[5]||'').toString().split(',').map(function(s){return s.trim()}).filter(Boolean),slackChannel:(r[6]||'').toString().trim(),notes:(r[7]||'').toString().trim()})});return eq.length>0?eq:getDefaultEquipos()}
function getDefaultEquipos(){return [{code:'CO',country:'Colombia',leader:'Carlos Eduardo Fernández',leaderEmail:'',members:['Isabela Zuluaga','Nicolás Naranjo','Juan Manuel Caicedo','Juan Camilo Gallego','Valeria Rangel','David Gaviria'],emails:[],slackChannel:'',notes:''}]}
function getAllMembers(eq){var n={};eq.forEach(function(e){if(e.leader)n[e.leader]=1;e.members.forEach(function(m){n[m]=1})});return Object.keys(n).sort()}
function getCountryForMember(name,eq){if(!name)return '';for(var i=0;i<eq.length;i++){if(eq[i].leader===name)return eq[i].code;if(eq[i].members.indexOf(name)>=0)return eq[i].code}return ''}
function getLeaderForCountry(code,eq){for(var i=0;i<eq.length;i++){if(eq[i].code===code)return eq[i].leader}return ''}
function readConfig(ss){var ws=ss.getSheetByName(SHEET_CONFIG);if(!ws)return {};var lr=ws.getLastRow();if(lr<3)return {};var data=ws.getRange(3,1,lr-2,2).getValues(),c={};data.forEach(function(r){if(r[0])c[r[0]]=r[1]});return c}
function countBizDays(start,end){var count=0,cur=new Date(start);while(cur<end){cur.setDate(cur.getDate()+1);var d=cur.getDay();if(d!==0&&d!==6)count++}return count}
// Mueve una tarea al Historial preservando su ID original.
// Ya NO renumera las tareas restantes: los IDs son persistentes (pueden quedar huecos 1,3,7,...).
function moveToHistorial(ss, wsA, row) {
  var wsH = ss.getSheetByName(SHEET_HISTORIAL);
  var lc = Math.min(wsA.getLastColumn(), TASK_COLS);
  var rd = wsA.getRange(row, 1, 1, lc).getValues()[0];
  while (rd.length < TASK_COLS) rd.push('');
  // Preserva el ID original — NO reasignar. Así las referencias (notas, Slack, humanas) siguen válidas.
  wsH.appendRow(rd);
  wsA.deleteRow(row);
}

// Calcula el próximo ID único entre activos + historial (evita colisiones tras mover tareas).
function nextTaskId(ss) {
  var maxId = 0;
  ['Tracking Activo','Historial'].forEach(function(name){
    var ws = ss.getSheetByName(name); if (!ws) return;
    var lr = ws.getLastRow(); if (lr < 4) return;
    var ids = ws.getRange(4, 1, lr - 3, 1).getValues();
    ids.forEach(function(r){ var v = parseInt(r[0]); if (!isNaN(v) && v > maxId) maxId = v; });
  });
  return maxId + 1;
}
function getCurrentWeekLabel(){var now=new Date(),mon=new Date(now);mon.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1));var fri=new Date(mon);fri.setDate(mon.getDate()+4);var m=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return mon.getDate()+'-'+fri.getDate()+' '+m[fri.getMonth()]+' '+fri.getFullYear()}

// ════════════════════════════════════════════════════════════════
// SLACK HELPERS
// ════════════════════════════════════════════════════════════════
// ── Busca candidatos por fuzzy match. Retorna top 3 ordenados por score.
// Cada candidato: {id, nombre, row, score, ratio, confidence: 'high'|'low'|'none'}
// high: ≥3 matches y ratio ≥0.5   low: ≥1 match   none: sin coincidencia útil
function findTaskCandidates(text) {
  var ss = SpreadsheetApp.openById(SHEET_ID), ws = ss.getSheetByName(SHEET_ACTIVO);
  var lr = ws.getLastRow();
  if (lr < 4) return {candidates: [], confidence: 'none'};
  var lc = Math.min(ws.getLastColumn(), TASK_COLS);
  var data = ws.getRange(4, 1, lr - 3, lc).getValues();
  var st = (text || '').toLowerCase();
  var words = st.split(/\s+/).filter(function(w){return w.length > 2});
  if (words.length === 0) return {candidates: [], confidence: 'none'};

  var scored = [];
  for (var i = 0; i < data.length; i++) {
    var n = (data[i][1] || '').toLowerCase(); if (!n) continue;
    var nameWords = n.split(/\s+/).filter(function(w){return w.length > 2});
    if (nameWords.length === 0) continue;
    var sc = 0;
    words.forEach(function(x){ if (n.indexOf(x) >= 0) sc++; });
    if (sc === 0) continue;
    // ratio: matches / (palabras relevantes del nombre) — penaliza matches triviales en nombres largos
    var ratio = sc / Math.max(nameWords.length, 1);
    scored.push({id: data[i][0], nombre: data[i][1], row: i + 4, score: sc, ratio: ratio});
  }
  scored.sort(function(a, b){ return (b.score - a.score) || (b.ratio - a.ratio); });
  var top = scored.slice(0, 3);
  var confidence = 'none';
  if (top.length > 0) {
    var best = top[0];
    if (best.score >= 3 && best.ratio >= 0.5) confidence = 'high';
    else if (best.score >= 1) confidence = 'low';
  }
  return {candidates: top, confidence: confidence};
}

// Cierra una tarea por ID directamente (sin fuzzy match). Usado tras confirmación.
function closeTaskById(taskId, slackUser) {
  invalidateCache();
  var ss = SpreadsheetApp.openById(SHEET_ID), ws = ss.getSheetByName(SHEET_ACTIVO);
  var lr = ws.getLastRow(); if (lr < 4) return {success: false, message: 'No hay tareas'};
  var data = ws.getRange(4, 1, lr - 3, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == taskId) {
      var row = i + 4;
      var tn = ws.getRange(row, 2).getValue();
      ws.getRange(row, 7).setValue('Listo');
      ws.getRange(row, 10).setValue(new Date());
      moveToHistorial(ss, ws, row);
      return {success: true, id: taskId, nombre: tn, message: 'Tarea #' + taskId + ' "' + tn + '" cerrada y movida a Historial'};
    }
  }
  return {success: false, message: 'Tarea #' + taskId + ' no encontrada'};
}

// Bloquea una tarea por ID directamente.
function blockTaskById(taskId, reason, slackUser) {
  invalidateCache();
  var ss = SpreadsheetApp.openById(SHEET_ID), ws = ss.getSheetByName(SHEET_ACTIVO);
  var lr = ws.getLastRow(); if (lr < 4) return {success: false, message: 'No hay tareas'};
  var data = ws.getRange(4, 1, lr - 3, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == taskId) {
      var row = i + 4;
      var tn = ws.getRange(row, 2).getValue();
      ws.getRange(row, 7).setValue('Bloqueado');
      var on = ws.getRange(row, 11).getValue() || '';
      ws.getRange(row, 11).setValue((on ? on + ' | ' : '') + '⛔ ' + (reason || '') + ' (' + (slackUser || '') + ', ' + new Date().toLocaleDateString('es-CO') + ')');
      return {success: true, id: taskId, nombre: tn, message: 'Tarea bloqueada: #' + taskId + ' "' + tn + '"'};
    }
  }
  return {success: false, message: 'Tarea #' + taskId + ' no encontrada'};
}
function testData() {
  var d = getTrackerData();
  Logger.log('Tasks: ' + d.tasks.length);
  Logger.log('Equipos: ' + d.equipos.length);
  Logger.log('Projects: ' + d.projects.length);
  Logger.log('Team: ' + d.team.length);
}
