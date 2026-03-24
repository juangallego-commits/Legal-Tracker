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

// Tasks: 14 cols — ID,Nombre,Resp,Acc,Deadline,Prioridad,Estado,Semana,Creado,Cerrado,Notas,Proyecto(ID),País,Líder
const TASK_COLS = 14;
// Projects: 12 cols — ID,Nombre,País,Líder,Responsable,Deadline,Prioridad,Estado,Descripción,Notas,Creado,Semana
const PROJ_COLS = 12;

const STATUS_ORDER = {'Bloqueado':0,'En curso':1,'Pendiente':2,'En revisión':3,'Listo':4};
const PRIO_ORDER   = {'Alta':0,'Media':1,'Baja':2};
const PROJ_STATUSES = ['Activo','En pausa','Completado','Cancelado'];

// ── WEB APP ─────────────────────────────────────────────────────
function doGet(e) {
  var page = e && e.parameter && e.parameter.page;
  if (page === 'api') return ContentService.createTextOutput(JSON.stringify(getTrackerData())).setMimeType(ContentService.MimeType.JSON);
  var html = HtmlService.createTemplateFromFile('Dashboard');
  html.data = JSON.stringify(getTrackerData());
  return html.evaluate().setTitle('Legal Tracker · Rappi').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport','width=device-width, initial-scale=1');
}
function include(f){return HtmlService.createHtmlOutputFromFile(f).getContent()}

// ════════════════════════════════════════════════════════════════
// GET ALL DATA
// ════════════════════════════════════════════════════════════════
function getTrackerData() {
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
    if (p.statusForced) return; // manually set, don't override
    var s = p.taskStats;
    if (s.total === 0) { /* keep current */ }
    else if (s.listo === s.total) p.status = 'Completado';
    else if (s.bloqueado > 0 && s.enCurso === 0 && s.pendiente === 0 && s.enRevision === 0) p.status = 'En pausa';
    else p.status = 'Activo';
    p.pctDone = s.total > 0 ? Math.round(s.listo / s.total * 100) : 0;
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
      deadline: row[5]||'', priority: row[6]||'Media',
      status: row[7]||'Activo', statusForced: (row[7]||'').toString().trim() === 'Cancelado',
      descripcion: row[8]||'', notas: row[9]||'',
      creado: row[10]? Utilities.formatDate(new Date(row[10]),'America/Bogota','dd/MM/yyyy'):'',
      semana: row[11]||'',
      pctDone: 0, tasks: [], taskStats: {}
    });
  });
  return projects;
}

function addProject(obj) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var ws = ss.getSheetByName(SHEET_PROYECTOS);
  if (!ws) {
    ws = ss.insertSheet(SHEET_PROYECTOS);
    ws.appendRow(['ID','Nombre','País','Líder','Responsable','Deadline','Prioridad','Estado','Descripción','Notas','Creado','Semana']);
    ws.getRange(1,1,1,PROJ_COLS).setFontWeight('bold').setBackground('#FF4940').setFontColor('#FFFFFF');
    ws.setTabColor('#FF4940');
  }
  var lastRow = ws.getLastRow();
  var newId = lastRow >= 2 ? ws.getRange(lastRow, 1).getValue() + 1 : 1;
  var equipos = readEquipos(ss);
  var pais  = obj.pais || getCountryForMember(obj.responsable, equipos);
  var lider = obj.lider || getLeaderForCountry(pais, equipos);
  ws.appendRow([
    newId, obj.nombre||'', pais, lider, obj.responsable||'',
    obj.deadline||'', obj.priority||'Media', obj.status||'Activo',
    obj.descripcion||'', obj.notas||'', new Date(), getCurrentWeekLabel()
  ]);
  return {success:true, id:newId, nombre:obj.nombre||''};
}

function updateProjectField(projId, field, value) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var ws = ss.getSheetByName(SHEET_PROYECTOS);
  if (!ws) return {success:false, error:'No projects sheet'};
  var lastRow = ws.getLastRow();
  if (lastRow < 2) return {success:false, error:'No projects'};
  var data = ws.getRange(2, 1, lastRow - 1, Math.min(ws.getLastColumn(), PROJ_COLS)).getValues();
  var fieldMap = {'nombre':2,'pais':3,'lider':4,'responsable':5,'deadline':6,'priority':7,'status':8,'descripcion':9,'notas':10};
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
      deadline:row[4]||'', priority:row[5]||'Media', status:row[6]||'Pendiente',
      semana:row[7]||'',
      creado:row[8]?Utilities.formatDate(new Date(row[8]),'America/Bogota','dd/MM/yyyy'):'',
      creadoRaw:row[8]?new Date(row[8]).toISOString():null,
      cerrado:row[9]?Utilities.formatDate(new Date(row[9]),'America/Bogota','dd/MM/yyyy'):'',
      notas:row[10]||'',
      proyectoId: isNaN(parseInt(proyVal)) ? '' : parseInt(proyVal),
      proyecto: proyVal, // keep raw for backward compat
      pais:(row[12]||'').toString().trim(),
      lider:(row[13]||'').toString().trim()
    });
  });
  tasks.sort(function(a,b){return (PRIO_ORDER[a.priority]||1)-(PRIO_ORDER[b.priority]||1)||(STATUS_ORDER[a.status]||2)-(STATUS_ORDER[b.status]||2)});
  return tasks;
}

function addTask(taskObj) {
  var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);
  var lastRow=ws.getLastRow();
  var newId=lastRow>=4?ws.getRange(lastRow,1).getValue()+1:1;
  var equipos=readEquipos(ss);
  var pais =taskObj.pais ||getCountryForMember(taskObj.resp,equipos);
  var lider=taskObj.lider||getLeaderForCountry(pais,equipos);
  ws.appendRow([
    newId, taskObj.nombre||'', taskObj.resp||'', taskObj.acc||'',
    taskObj.deadline||'', taskObj.priority||'Media', taskObj.status||'Pendiente',
    taskObj.semana||getCurrentWeekLabel(), new Date(), '', taskObj.notas||'',
    taskObj.proyectoId||taskObj.proyecto||'', pais, lider
  ]);
  return {success:true, id:newId};
}

function updateTaskField(taskId, field, value) {
  var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);
  var lastRow=ws.getLastRow();if(lastRow<4)return{success:false,error:'No tasks'};
  var lastCol=Math.min(ws.getLastColumn(),TASK_COLS);
  var data=ws.getRange(4,1,lastRow-3,lastCol).getValues();
  var fieldMap={'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14};
  var col=fieldMap[field];if(!col)return{success:false,error:'Invalid field: '+field};
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
function moveToHistorial(ss,wsA,row){var wsH=ss.getSheetByName(SHEET_HISTORIAL);var lc=Math.min(wsA.getLastColumn(),TASK_COLS);var rd=wsA.getRange(row,1,1,lc).getValues()[0];while(rd.length<TASK_COLS)rd.push('');var hl=wsH.getLastRow();var nid=hl>=4?wsH.getRange(hl,1).getValue()+1:1;rd[0]=nid;wsH.appendRow(rd);wsA.deleteRow(row);renumberTasks(wsA)}
function renumberTasks(ws){var lr=ws.getLastRow();if(lr<4)return;for(var i=4;i<=lr;i++)ws.getRange(i,1).setValue(i-3)}
function getCurrentWeekLabel(){var now=new Date(),mon=new Date(now);mon.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1));var fri=new Date(mon);fri.setDate(mon.getDate()+4);var m=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return mon.getDate()+'-'+fri.getDate()+' '+m[fri.getMonth()]+' '+fri.getFullYear()}

// ════════════════════════════════════════════════════════════════
// SLACK HELPERS
// ════════════════════════════════════════════════════════════════
function handleCloseTask(params){var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);var lr=ws.getLastRow();if(lr<4)return ContentService.createTextOutput(JSON.stringify({success:false,message:'No hay tareas activas'})).setMimeType(ContentService.MimeType.JSON);var lc=Math.min(ws.getLastColumn(),TASK_COLS);var data=ws.getRange(4,1,lr-3,lc).getValues();var st=(params.task_name||params.message_text||'').toLowerCase();var bm=-1,bs=0;for(var i=0;i<data.length;i++){var n=(data[i][1]||'').toLowerCase();if(!n)continue;var w=st.split(/\s+/),sc=0;w.forEach(function(x){if(x.length>2&&n.indexOf(x)>=0)sc++});if(sc>bs){bs=sc;bm=i}}if(bm>=0&&bs>=1){var row=bm+4,tn=data[bm][1],tid=data[bm][0];ws.getRange(row,7).setValue('Listo');ws.getRange(row,10).setValue(new Date());moveToHistorial(ss,ws,row);return ContentService.createTextOutput(JSON.stringify({success:true,message:'Tarea #'+tid+' "'+tn+'" marcada como Listo y movida a Historial'})).setMimeType(ContentService.MimeType.JSON)}return ContentService.createTextOutput(JSON.stringify({success:false,message:'No encontré una tarea que coincida'})).setMimeType(ContentService.MimeType.JSON)}
function handleBlockTask(params){var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);var lr=ws.getLastRow();if(lr<4)return ContentService.createTextOutput(JSON.stringify({success:false,message:'No hay tareas activas'})).setMimeType(ContentService.MimeType.JSON);var lc=Math.min(ws.getLastColumn(),TASK_COLS);var data=ws.getRange(4,1,lr-3,lc).getValues();var st=(params.task_name||'').toLowerCase();var bm=-1,bs=0;for(var i=0;i<data.length;i++){var n=(data[i][1]||'').toLowerCase();if(!n)continue;var w=st.split(/\s+/),sc=0;w.forEach(function(x){if(x.length>2&&n.indexOf(x)>=0)sc++});if(sc>bs){bs=sc;bm=i}}if(bm>=0&&bs>=1){var row=bm+4,tn=data[bm][1],tid=data[bm][0];ws.getRange(row,7).setValue('Bloqueado');var on=ws.getRange(row,11).getValue()||'';ws.getRange(row,11).setValue((on?on+' | ':'')+'⛔ '+(params.reason||'')+' ('+(params.slack_user||'')+', '+new Date().toLocaleDateString('es-CO')+')');return ContentService.createTextOutput(JSON.stringify({success:true,message:'Tarea bloqueada: #'+tid+' "'+tn+'"'})).setMimeType(ContentService.MimeType.JSON)}return ContentService.createTextOutput(JSON.stringify({success:false,message:'No encontré una tarea que coincida'})).setMimeType(ContentService.MimeType.JSON)}
function testData() {
  var d = getTrackerData();
  Logger.log('Tasks: ' + d.tasks.length);
  Logger.log('Equipos: ' + d.equipos.length);
  Logger.log('Projects: ' + d.projects.length);
  Logger.log('Team: ' + d.team.length);
}
