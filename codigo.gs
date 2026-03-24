// ════════════════════════════════════════════════════════════════
// Legal Team Tracker · Google Apps Script · Web App
// RappiPlus · Global Legal · v3.0
// ════════════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────────────
const SHEET_ID = '19eR-pXzVLTSEdCADeBZ8fsd5x4f2t0GowUJiJm2X6ms';
const SHEET_ACTIVO    = 'Tracking Activo';
const SHEET_HISTORIAL = 'Historial';
const SHEET_CONFIG    = 'Config';
const SHEET_EQUIPOS   = 'Equipos';

// ── COLUMN MAP (1-indexed) ──────────────────────────────────────
// Sheet headers (row 3):
//  1:ID  2:Nombre  3:Responsable  4:Accionable  5:Deadline
//  6:Prioridad  7:Estado  8:Semana  9:Creado  10:Cerrado
//  11:Notas  12:Proyecto  13:País  14:Líder
const TOTAL_COLS = 14;

const STATUS_ORDER = { 'Bloqueado':0, 'En curso':1, 'Pendiente':2, 'En revisión':3, 'Listo':4 };
const PRIO_ORDER   = { 'Alta':0, 'Media':1, 'Baja':2 };

// ── WEB APP ENTRY ───────────────────────────────────────────────
function doGet(e) {
  var page = e && e.parameter && e.parameter.page;
  if (page === 'api') {
    return ContentService.createTextOutput(JSON.stringify(getTrackerData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var html = HtmlService.createTemplateFromFile('Dashboard');
  html.data = JSON.stringify(getTrackerData());
  return html.evaluate()
    .setTitle('Legal Tracker · RappiPlus')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ════════════════════════════════════════════════════════════════
// READ ALL TRACKER DATA
// ════════════════════════════════════════════════════════════════
function getTrackerData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var activeTasks  = readTasks(ss.getSheetByName(SHEET_ACTIVO));
  var histTasks    = readTasks(ss.getSheetByName(SHEET_HISTORIAL));
  var config  = readConfig(ss);
  var equipos = readEquipos(ss);

  // ── KPIs
  var total=activeTasks.length, alta=0, media=0, baja=0, pendiente=0, enCurso=0, bloqueado=0, enRevision=0, listo=0;
  activeTasks.forEach(function(t){
    if(t.priority==='Alta')alta++;if(t.priority==='Media')media++;if(t.priority==='Baja')baja++;
    if(t.status==='Pendiente')pendiente++;if(t.status==='En curso')enCurso++;
    if(t.status==='Bloqueado')bloqueado++;if(t.status==='En revisión')enRevision++;
    if(t.status==='Listo')listo++;
  });

  // ── Per-person stats
  var allMembers = getAllMembers(equipos);
  var teamMap = {};
  allMembers.forEach(function(n){ teamMap[n]={total:0,alta:0,media:0,baja:0,pendiente:0,enCurso:0,bloqueado:0,enRevision:0,listo:0}; });
  activeTasks.forEach(function(t){
    if(!teamMap[t.resp]) teamMap[t.resp]={total:0,alta:0,media:0,baja:0,pendiente:0,enCurso:0,bloqueado:0,enRevision:0,listo:0};
    var p=teamMap[t.resp]; p.total++;
    if(t.priority==='Alta')p.alta++;if(t.priority==='Media')p.media++;if(t.priority==='Baja')p.baja++;
    if(t.status==='Pendiente')p.pendiente++;if(t.status==='En curso')p.enCurso++;
    if(t.status==='Bloqueado')p.bloqueado++;if(t.status==='En revisión')p.enRevision++;
    if(t.status==='Listo')p.listo++;
  });
  var team = Object.keys(teamMap).sort().map(function(name){
    return {
      name:name, initials:name.split(' ').slice(0,2).map(function(w){return w[0]}).join('').toUpperCase(),
      country:getCountryForMember(name,equipos),
      total:teamMap[name].total, alta:teamMap[name].alta, media:teamMap[name].media, baja:teamMap[name].baja,
      pendiente:teamMap[name].pendiente, enCurso:teamMap[name].enCurso, bloqueado:teamMap[name].bloqueado,
      enRevision:teamMap[name].enRevision, listo:teamMap[name].listo,
      pctDone:teamMap[name].total>0?Math.round(teamMap[name].listo/teamMap[name].total*100):0
    };
  });

  // ── Per-country stats
  var countryStats = {};
  equipos.forEach(function(eq){
    countryStats[eq.code]={code:eq.code,name:eq.country,leader:eq.leader,total:0,alta:0,media:0,baja:0,pendiente:0,enCurso:0,bloqueado:0,enRevision:0,listo:0};
  });
  activeTasks.forEach(function(t){
    var cc=t.pais||getCountryForMember(t.resp,equipos);
    if(cc&&countryStats[cc]){var c=countryStats[cc];c.total++;
      if(t.priority==='Alta')c.alta++;if(t.priority==='Media')c.media++;if(t.priority==='Baja')c.baja++;
      if(t.status==='Pendiente')c.pendiente++;if(t.status==='En curso')c.enCurso++;
      if(t.status==='Bloqueado')c.bloqueado++;if(t.status==='En revisión')c.enRevision++;
      if(t.status==='Listo')c.listo++;
    }
  });

  // ── Per-project stats
  var projectMap = {};
  activeTasks.forEach(function(t){
    var proj=t.proyecto||'Sin proyecto';
    if(!projectMap[proj])projectMap[proj]={name:proj,total:0,alta:0,media:0,baja:0};
    var p=projectMap[proj];p.total++;
    if(t.priority==='Alta')p.alta++;if(t.priority==='Media')p.media++;if(t.priority==='Baja')p.baja++;
  });
  var projects=Object.values(projectMap).sort(function(a,b){return b.total-a.total});

  // ── SLA
  var now=new Date(), slaData={onTime:0,atRisk:0,overdue:0}, slaLimits={Alta:2,Media:5,Baja:7};
  activeTasks.forEach(function(t){
    if(t.status==='Listo')return;
    if(!t.creadoRaw){slaData.onTime++;return;}
    var bizDays=countBizDays(new Date(t.creadoRaw),now);
    var limit=slaLimits[t.priority]||5;
    if(bizDays>limit)slaData.overdue++;else if(bizDays>=limit-1)slaData.atRisk++;else slaData.onTime++;
  });

  var semana=activeTasks.length>0?activeTasks[0].semana:getCurrentWeekLabel();

  return {
    tasks:activeTasks, historial:histTasks,
    kpi:{total:total,alta:alta,media:media,baja:baja,pendiente:pendiente,enCurso:enCurso,bloqueado:bloqueado,enRevision:enRevision,listo:listo},
    sla:slaData, team:team,
    countries:Object.values(countryStats), equipos:equipos, projects:projects,
    semana:semana,
    generated:Utilities.formatDate(new Date(),'America/Bogota','dd/MM/yyyy HH:mm'),
    config:config
  };
}

// ════════════════════════════════════════════════════════════════
// READ EQUIPOS
// ════════════════════════════════════════════════════════════════
function readEquipos(ss) {
  var ws = ss.getSheetByName(SHEET_EQUIPOS);
  if (!ws) return getDefaultEquipos();
  var lastRow = ws.getLastRow();
  if (lastRow < 2) return getDefaultEquipos();
  var data = ws.getRange(2, 1, lastRow - 1, 8).getValues();
  var equipos = [];
  data.forEach(function(row) {
    var code = (row[0]||'').toString().trim();
    if (!code) return;
    equipos.push({
      code: code,
      country: (row[1]||'').toString().trim(),
      leader:  (row[2]||'').toString().trim().replace(/\n/g,''),
      leaderEmail: (row[3]||'').toString().trim(),
      members: (row[4]||'').toString().split(',').map(function(s){return s.trim()}).filter(Boolean),
      emails:  (row[5]||'').toString().split(',').map(function(s){return s.trim()}).filter(Boolean),
      slackChannel: (row[6]||'').toString().trim(),
      notes: (row[7]||'').toString().trim()
    });
  });
  return equipos.length > 0 ? equipos : getDefaultEquipos();
}

function getDefaultEquipos() {
  return [
    {code:'CO',country:'Colombia',leader:'Carlos Eduardo Fernández',leaderEmail:'',members:['Isabela Zuluaga','Nicolás Naranjo','Juan Manuel Caicedo','Juan Camilo Gallego','Valeria Rangel','David Gaviria'],emails:[],slackChannel:'',notes:''},
    {code:'MX',country:'Mexico',leader:'Paulina Martinez',leaderEmail:'',members:[],emails:[],slackChannel:'',notes:''},
    {code:'BR',country:'Brasil',leader:'Michele Volpe',leaderEmail:'',members:[],emails:[],slackChannel:'',notes:''}
  ];
}

function getAllMembers(equipos) {
  var names = {};
  equipos.forEach(function(eq){ if(eq.leader)names[eq.leader]=1; eq.members.forEach(function(m){names[m]=1}); });
  return Object.keys(names).sort();
}

function getCountryForMember(name, equipos) {
  if(!name) return '';
  for(var i=0;i<equipos.length;i++){
    if(equipos[i].leader===name) return equipos[i].code;
    if(equipos[i].members.indexOf(name)>=0) return equipos[i].code;
  }
  return '';
}

function getLeaderForCountry(code, equipos) {
  for(var i=0;i<equipos.length;i++){ if(equipos[i].code===code) return equipos[i].leader; }
  return '';
}

// ════════════════════════════════════════════════════════════════
// COUNT BUSINESS DAYS
// ════════════════════════════════════════════════════════════════
function countBizDays(start, end) {
  var count=0, cur=new Date(start);
  while(cur<end){ cur.setDate(cur.getDate()+1); var day=cur.getDay(); if(day!==0&&day!==6)count++; }
  return count;
}

// ════════════════════════════════════════════════════════════════
// READ TASKS FROM SHEET
// ════════════════════════════════════════════════════════════════
function readTasks(ws) {
  if (!ws) return [];
  var lastRow = ws.getLastRow();
  if (lastRow < 4) return [];
  var lastCol = Math.min(ws.getLastColumn(), TOTAL_COLS);
  var data = ws.getRange(4, 1, lastRow - 3, lastCol).getValues();
  var tasks = [];
  data.forEach(function(row) {
    if (!row[1]) return;
    tasks.push({
      id:row[0], nombre:row[1]||'', resp:row[2]||'', acc:row[3]||'',
      deadline:row[4]||'', priority:row[5]||'Media', status:row[6]||'Pendiente',
      semana:row[7]||'',
      creado:row[8]?Utilities.formatDate(new Date(row[8]),'America/Bogota','dd/MM/yyyy'):'',
      creadoRaw:row[8]?new Date(row[8]).toISOString():null,
      cerrado:row[9]?Utilities.formatDate(new Date(row[9]),'America/Bogota','dd/MM/yyyy'):'',
      notas:row[10]||'',
      proyecto:(row[11]||'').toString().trim(),
      pais:(row[12]||'').toString().trim(),
      lider:(row[13]||'').toString().trim()
    });
  });
  tasks.sort(function(a,b){
    return (PRIO_ORDER[a.priority]||1)-(PRIO_ORDER[b.priority]||1) || (STATUS_ORDER[a.status]||2)-(STATUS_ORDER[b.status]||2);
  });
  return tasks;
}

// ════════════════════════════════════════════════════════════════
// READ CONFIG
// ════════════════════════════════════════════════════════════════
function readConfig(ss) {
  var ws=ss.getSheetByName(SHEET_CONFIG); if(!ws)return {};
  var lastRow=ws.getLastRow(); if(lastRow<3)return {};
  var data=ws.getRange(3,1,lastRow-2,2).getValues(), config={};
  data.forEach(function(row){if(row[0])config[row[0]]=row[1];}); return config;
}

// ════════════════════════════════════════════════════════════════
// ADD NEW TASK
// ════════════════════════════════════════════════════════════════
function addTask(taskObj) {
  var ss=SpreadsheetApp.openById(SHEET_ID), ws=ss.getSheetByName(SHEET_ACTIVO);
  var lastRow=ws.getLastRow();
  var newId=lastRow>=4?ws.getRange(lastRow,1).getValue()+1:1;
  var equipos=readEquipos(ss);
  var pais =taskObj.pais ||getCountryForMember(taskObj.resp,equipos);
  var lider=taskObj.lider||getLeaderForCountry(pais,equipos);
  ws.appendRow([
    newId, taskObj.nombre||'', taskObj.resp||'', taskObj.acc||'',
    taskObj.deadline||'', taskObj.priority||'Media', taskObj.status||'Pendiente',
    taskObj.semana||getCurrentWeekLabel(), new Date(), '', taskObj.notas||'',
    taskObj.proyecto||'', pais, lider
  ]);
  return {success:true, id:newId};
}

// ════════════════════════════════════════════════════════════════
// UPDATE TASK FIELD
// ════════════════════════════════════════════════════════════════
function updateTaskField(taskId, field, value) {
  var ss=SpreadsheetApp.openById(SHEET_ID), ws=ss.getSheetByName(SHEET_ACTIVO);
  var lastRow=ws.getLastRow();
  if(lastRow<4)return{success:false,error:'No tasks'};
  var lastCol=Math.min(ws.getLastColumn(),TOTAL_COLS);
  var data=ws.getRange(4,1,lastRow-3,lastCol).getValues();
  var fieldMap={'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'pais':13,'lider':14};
  var col=fieldMap[field]; if(!col)return{success:false,error:'Invalid field: '+field};
  for(var i=0;i<data.length;i++){
    if(data[i][0]==taskId){
      var row=i+4; ws.getRange(row,col).setValue(value);
      if(field==='status'&&value==='Listo'){
        ws.getRange(row,10).setValue(new Date());
        moveToHistorial(ss,ws,row);
        return{success:true,moved:true,message:'Tarea movida a Historial'};
      }
      return{success:true};
    }
  }
  return{success:false,error:'Task #'+taskId+' not found'};
}

function updateTaskStatus(taskId,newStatus){return updateTaskField(taskId,'status',newStatus);}

// ════════════════════════════════════════════════════════════════
// MOVE TO HISTORIAL
// ════════════════════════════════════════════════════════════════
function moveToHistorial(ss, wsActive, row) {
  var wsHist=ss.getSheetByName(SHEET_HISTORIAL);
  var lastCol=Math.min(wsActive.getLastColumn(),TOTAL_COLS);
  var rowData=wsActive.getRange(row,1,1,lastCol).getValues()[0];
  while(rowData.length<TOTAL_COLS)rowData.push('');
  var histLast=wsHist.getLastRow();
  var newHistId=histLast>=4?wsHist.getRange(histLast,1).getValue()+1:1;
  rowData[0]=newHistId;
  wsHist.appendRow(rowData);
  wsActive.deleteRow(row);
  renumberTasks(wsActive);
}

function renumberTasks(ws){var lastRow=ws.getLastRow();if(lastRow<4)return;for(var i=4;i<=lastRow;i++)ws.getRange(i,1).setValue(i-3);}

function getCurrentWeekLabel(){
  var now=new Date(),monday=new Date(now);
  monday.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1));
  var friday=new Date(monday);friday.setDate(monday.getDate()+4);
  var months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return monday.getDate()+'-'+friday.getDate()+' '+months[friday.getMonth()]+' '+friday.getFullYear();
}

// ════════════════════════════════════════════════════════════════
// SLACK HELPERS (used by SlackModal.gs)
// ════════════════════════════════════════════════════════════════
function handleCloseTask(params){
  var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);
  var lastRow=ws.getLastRow();
  if(lastRow<4)return ContentService.createTextOutput(JSON.stringify({success:false,message:'No hay tareas activas'})).setMimeType(ContentService.MimeType.JSON);
  var lastCol=Math.min(ws.getLastColumn(),TOTAL_COLS);
  var data=ws.getRange(4,1,lastRow-3,lastCol).getValues();
  var searchText=(params.task_name||params.message_text||'').toLowerCase();
  var bestMatch=-1,bestScore=0;
  for(var i=0;i<data.length;i++){
    var nombre=(data[i][1]||'').toLowerCase();if(!nombre)continue;
    var words=searchText.split(/\s+/),score=0;
    words.forEach(function(w){if(w.length>2&&nombre.indexOf(w)>=0)score++});
    if(score>bestScore){bestScore=score;bestMatch=i;}
  }
  if(bestMatch>=0&&bestScore>=1){
    var row=bestMatch+4,taskName=data[bestMatch][1],taskId=data[bestMatch][0];
    ws.getRange(row,7).setValue('Listo');ws.getRange(row,10).setValue(new Date());
    moveToHistorial(ss,ws,row);
    return ContentService.createTextOutput(JSON.stringify({success:true,message:'Tarea #'+taskId+' "'+taskName+'" marcada como Listo y movida a Historial'})).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({success:false,message:'No encontré una tarea que coincida'})).setMimeType(ContentService.MimeType.JSON);
}

function handleBlockTask(params){
  var ss=SpreadsheetApp.openById(SHEET_ID),ws=ss.getSheetByName(SHEET_ACTIVO);
  var lastRow=ws.getLastRow();
  if(lastRow<4)return ContentService.createTextOutput(JSON.stringify({success:false,message:'No hay tareas activas'})).setMimeType(ContentService.MimeType.JSON);
  var lastCol=Math.min(ws.getLastColumn(),TOTAL_COLS);
  var data=ws.getRange(4,1,lastRow-3,lastCol).getValues();
  var searchText=(params.task_name||'').toLowerCase();
  var bestMatch=-1,bestScore=0;
  for(var i=0;i<data.length;i++){
    var nombre=(data[i][1]||'').toLowerCase();if(!nombre)continue;
    var words=searchText.split(/\s+/),score=0;
    words.forEach(function(w){if(w.length>2&&nombre.indexOf(w)>=0)score++});
    if(score>bestScore){bestScore=score;bestMatch=i;}
  }
  if(bestMatch>=0&&bestScore>=1){
    var row=bestMatch+4,taskName=data[bestMatch][1],taskId=data[bestMatch][0];
    ws.getRange(row,7).setValue('Bloqueado');
    var oldNotas=ws.getRange(row,11).getValue()||'';
    ws.getRange(row,11).setValue((oldNotas?oldNotas+' | ':'')+'⛔ '+(params.reason||'')+' ('+(params.slack_user||'')+', '+new Date().toLocaleDateString('es-CO')+')');
    return ContentService.createTextOutput(JSON.stringify({success:true,message:'Tarea bloqueada: #'+taskId+' "'+taskName+'"'})).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({success:false,message:'No encontré una tarea que coincida'})).setMimeType(ContentService.MimeType.JSON);
}
