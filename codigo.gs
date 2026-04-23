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

// Tasks: 17 cols — ID,Nombre,Resp,Acc,Deadline,Prioridad,Estado,Semana,Creado,Cerrado,Notas,Proyecto(ID),País,Líder,TipoTrabajo,Riesgo,Documentos
const TASK_COLS = 17;
const TASK_DOCS_COL = 17; // 1-indexed
// Projects: 16 cols — ID,Nombre,País,Líder,Responsable,Deadline,Prioridad,Estado,Descripción,Notas,Creado,Semana,Participantes,TipoTrabajo,Riesgo,Documentos
const PROJ_COLS = 16;
const PROJ_DOCS_COL = 16; // 1-indexed

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
  var config = readConfig(ss);
  var authResult = resolveVisitor(equipos);

  if (!authResult.ok) {
    return renderAccessDenied(authResult);
  }

  // 2) Determinar rol (head / manager / specialist) contra hoja Config
  var realRole = determineRole(authResult.email, authResult.user, config);

  // 2b) View-as: solo heads pueden impersonar read-only la vista de otro email.
  //     Si el target no existe o el caller no es head, ignoramos silenciosamente.
  var viewAsEmail = (e && e.parameter && e.parameter.as || '').toString().toLowerCase().trim();
  var effectiveUser = authResult.user;
  var effectiveEmail = authResult.email;
  var effectiveRole = realRole;
  var viewAs = null;
  if (viewAsEmail && realRole === 'head' && viewAsEmail !== authResult.email) {
    var allow = buildEmailAllowlist(equipos);
    var targetUser = allow[viewAsEmail];
    if (targetUser) {
      effectiveUser = targetUser;
      effectiveEmail = viewAsEmail;
      effectiveRole = determineRole(viewAsEmail, targetUser, config);
      viewAs = { email: viewAsEmail, name: targetUser.name, role: effectiveRole, code: targetUser.code };
    }
  }

  // 3) Render. `currentUser` refleja el rol EFECTIVO (lo que ve el frontend).
  //    `realUser` preserva el email real para auditoría y para "volver a mi vista".
  //    Escrituras del backend siguen usando Session.getActiveUser() (email real).
  var html = HtmlService.createTemplateFromFile('Dashboard');
  html.data = JSON.stringify(_buildDataForUser(effectiveRole, effectiveUser));
  html.currentUser = JSON.stringify({
    email: effectiveEmail,
    name:  effectiveUser.name,
    code:  effectiveUser.code,
    isLeader: !!effectiveUser.isLeader,
    role: effectiveRole
  });
  html.realUser = JSON.stringify({
    email: authResult.email,
    name:  authResult.user.name,
    role:  realRole
  });
  html.viewAs = JSON.stringify(viewAs); // null si no está en modo view-as
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
// Entry point que resuelve al visitante, determina su rol y devuelve la data
// filtrada según lo que debe ver. Delega reads caros a _buildRawData()
// (cacheado) y calcula stats en memoria sobre el subset visible.
function getTrackerData(viewAsEmail) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var equipos = readEquipos(ss);
  var config = readConfig(ss);
  var auth = resolveVisitor(equipos);
  if (!auth.ok) throw new Error('No autorizado: ' + auth.message);
  var realRole = determineRole(auth.email, auth.user, config);

  // View-as solo válido para heads; si no aplica, usa el email real.
  var role = realRole;
  var user = auth.user;
  if (viewAsEmail && realRole === 'head') {
    var target = buildEmailAllowlist(equipos)[viewAsEmail.toString().toLowerCase().trim()];
    if (target) {
      user = target;
      role = determineRole(viewAsEmail, target, config);
    }
  }
  return _buildDataForUser(role, user);
}

// Compone la vista (tasks/projects filtrados + stats) para un {role, user} dado.
// Se usa tanto desde doGet como desde getTrackerData(viewAsEmail).
function _buildDataForUser(role, user) {
  var raw = _cachedRawData();
  return _buildViewForRole(raw, role, user);
}

// Devuelve la lista de usuarios entre los que un head puede elegir para
// "Ver como". Solo heads pueden invocar esta función; si no, retorna [].
function listViewAsOptions() {
  var ctx;
  try { ctx = _getAuthContext(); } catch(e) { return []; }
  if (ctx.role !== 'head') return [];
  var config = readConfig(ctx.ss);
  var allow = buildEmailAllowlist(ctx.equipos);
  var opts = [];
  Object.keys(allow).forEach(function(email) {
    var u = allow[email];
    opts.push({
      email: email,
      name:  u.name,
      code:  u.code,
      role:  determineRole(email, u, config)
    });
  });
  // head primero, luego manager, luego specialist, luego alfabético.
  var order = { head: 0, manager: 1, specialist: 2 };
  opts.sort(function(a, b) {
    var oa = order[a.role] != null ? order[a.role] : 3;
    var ob = order[b.role] != null ? order[b.role] : 3;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
  return opts;
}

// Cache solo la parte cara: lecturas del sheet. Los cálculos de stats se
// recalculan por rol (barato) porque filtramos por usuario.
function _cachedRawData() {
  try {
    var cached = CacheService.getScriptCache().get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch(e) {}
  var raw = _buildRawData();
  try { CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(raw), CACHE_TTL_SEC); } catch(e) {}
  return raw;
}

// Lee del sheet todo lo que necesitamos para construir una vista, sin
// calcular stats. El caller filtra y calcula después.
function _buildRawData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var activeTasks = readTasks(ss.getSheetByName(SHEET_ACTIVO));
  var histTasks   = readTasks(ss.getSheetByName(SHEET_HISTORIAL));
  var config  = readConfig(ss);
  var equipos = readEquipos(ss);
  var projects = readProjects(ss);
  return {
    tasks: activeTasks,
    historial: histTasks,
    projects: projects,
    equipos: equipos,
    config: config,
    semana: activeTasks.length > 0 ? activeTasks[0].semana : getCurrentWeekLabel(),
    generated: Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm')
  };
}

// ── ROLE-BASED FILTERING ─────────────────────────────────────────
// Determina el rol del visitante:
//   head       → email en config.Heads (csv, case-insensitive)
//   manager    → es líder de algún equipo (user.isLeader del allowlist)
//   specialist → resto
function determineRole(email, user, config) {
  var headsRaw = (config && config.Heads) ? config.Heads.toString() : '';
  var heads = headsRaw.toLowerCase().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  if (heads.indexOf((email || '').toLowerCase()) >= 0) return 'head';
  if (user && user.isLeader) return 'manager';
  return 'specialist';
}

// Filtra tareas según el rol del usuario.
//   head      → todas
//   manager   → las de su país (pais === user.code, o resp en ese equipo)
//   specialist→ solo donde resp === user.name
function filterTasksForRole(tasks, role, user, equipos) {
  if (role === 'head') return tasks;
  if (role === 'manager') {
    return tasks.filter(function(t) {
      var cc = t.pais || getCountryForMember(t.resp, equipos);
      return cc === user.code;
    });
  }
  return tasks.filter(function(t){ return t.resp === user.name; });
}

// Filtra proyectos según el rol.
//   head      → todos
//   manager   → los de su país (pais === user.code)
//   specialist→ donde responsable === user.name o está en participantes
function filterProjectsForRole(projects, role, user) {
  if (role === 'head') return projects;
  if (role === 'manager') {
    return projects.filter(function(p){ return p.pais === user.code; });
  }
  return projects.filter(function(p) {
    if (p.responsable === user.name) return true;
    if (p.participantes && p.participantes.indexOf(user.name) >= 0) return true;
    return false;
  });
}

// Construye la vista completa (tasks filtradas, projects filtrados, stats
// recalculadas, KPIs, SLA, team grid, countries) para un rol+usuario dado.
function _buildViewForRole(raw, role, user) {
  var equipos = raw.equipos;
  var allTasks = raw.tasks;
  var allHist  = raw.historial;
  var allProjects = raw.projects;

  var tasks = filterTasksForRole(allTasks, role, user, equipos);
  var historial = filterTasksForRole(allHist, role, user, equipos);
  var projects = filterProjectsForRole(allProjects, role, user);

  // Enrich cada proyecto con sus tareas visibles y stats derivadas.
  var projMap = {};
  projects.forEach(function(p) {
    p.tasks = [];
    p.taskStats = { total:0, pendiente:0, enCurso:0, enRevision:0, bloqueado:0, listo:0, alta:0, media:0, baja:0 };
    projMap[p.id] = p;
  });
  tasks.forEach(function(t) {
    var pid = t.proyectoId;
    if (!pid || !projMap[pid]) return;
    projMap[pid].tasks.push(t);
    var s = projMap[pid].taskStats;
    s.total++;
    if (t.status === 'Pendiente')    s.pendiente++;
    if (t.status === 'En curso')     s.enCurso++;
    if (t.status === 'En revisión')  s.enRevision++;
    if (t.status === 'Bloqueado')    s.bloqueado++;
    if (t.status === 'Listo')        s.listo++;
    if (t.priority === 'Alta')       s.alta++;
    if (t.priority === 'Media')      s.media++;
    if (t.priority === 'Baja')       s.baja++;
  });
  historial.forEach(function(t) {
    var pid = t.proyectoId;
    if (!pid || !projMap[pid]) return;
    var s = projMap[pid].taskStats;
    s.total++; s.listo++;
  });
  // Auto-status de proyectos (misma lógica que antes)
  projects.forEach(function(p) {
    var s = p.taskStats;
    p.pctDone = s.total > 0 ? Math.round(s.listo / s.total * 100) : 0;
    if (p.status === 'Cancelado') return;
    if (s.total > 0 && s.listo === s.total) { p.status = 'Completado'; return; }
    if (p.statusForced) return;
    if (s.total === 0) return;
    if (s.bloqueado > 0 && s.enCurso === 0 && s.pendiente === 0 && s.enRevision === 0) p.status = 'En pausa';
    else p.status = 'Activo';
  });

  // KPIs globales sobre el subset visible
  var kpi = { total: tasks.length, alta:0, media:0, baja:0, pendiente:0, enCurso:0, bloqueado:0, enRevision:0, listo:0 };
  tasks.forEach(function(t) {
    if (t.priority === 'Alta')  kpi.alta++;
    if (t.priority === 'Media') kpi.media++;
    if (t.priority === 'Baja')  kpi.baja++;
    if (t.status === 'Pendiente')    kpi.pendiente++;
    if (t.status === 'En curso')     kpi.enCurso++;
    if (t.status === 'Bloqueado')    kpi.bloqueado++;
    if (t.status === 'En revisión')  kpi.enRevision++;
    if (t.status === 'Listo')        kpi.listo++;
  });

  // Per-person stats: construidas solo a partir de responsables visibles en tasks
  var teamMap = {};
  tasks.forEach(function(t) {
    if (!t.resp) return;
    if (!teamMap[t.resp]) teamMap[t.resp] = { total:0, alta:0, media:0, baja:0, pendiente:0, enCurso:0, bloqueado:0, enRevision:0, listo:0 };
    var p = teamMap[t.resp];
    p.total++;
    if (t.priority === 'Alta')  p.alta++;
    if (t.priority === 'Media') p.media++;
    if (t.priority === 'Baja')  p.baja++;
    if (t.status === 'Pendiente')    p.pendiente++;
    if (t.status === 'En curso')     p.enCurso++;
    if (t.status === 'Bloqueado')    p.bloqueado++;
    if (t.status === 'En revisión')  p.enRevision++;
    if (t.status === 'Listo')        p.listo++;
  });
  var team = Object.keys(teamMap).sort().map(function(name) {
    var m = teamMap[name];
    return {
      name: name,
      initials: name.split(' ').slice(0, 2).map(function(w){ return w[0]; }).join('').toUpperCase(),
      country: getCountryForMember(name, equipos),
      total: m.total, alta: m.alta, media: m.media, baja: m.baja,
      pendiente: m.pendiente, enCurso: m.enCurso, bloqueado: m.bloqueado,
      enRevision: m.enRevision, listo: m.listo,
      pctDone: m.total > 0 ? Math.round(m.listo / m.total * 100) : 0
    };
  });

  // Per-country stats: solo países que tienen al menos una tarea visible
  var countryMap = {};
  tasks.forEach(function(t) {
    var cc = t.pais || getCountryForMember(t.resp, equipos);
    if (!cc) return;
    if (!countryMap[cc]) {
      var eq = equipos.find(function(e){ return e.code === cc; });
      countryMap[cc] = { code: cc, name: eq ? eq.country : cc, leader: eq ? eq.leader : '', total:0, alta:0, media:0, baja:0 };
    }
    var c = countryMap[cc];
    c.total++;
    if (t.priority === 'Alta')  c.alta++;
    if (t.priority === 'Media') c.media++;
    if (t.priority === 'Baja')  c.baja++;
  });

  // SLA
  var now = new Date();
  var slaLimits = { Alta: 2, Media: 5, Baja: 7 };
  var sla = { onTime: 0, atRisk: 0, overdue: 0 };
  tasks.forEach(function(t) {
    if (t.status === 'Listo') return;
    if (!t.creadoRaw) { sla.onTime++; return; }
    var bizDays = countBizDays(new Date(t.creadoRaw), now);
    var limit = slaLimits[t.priority] || 5;
    if (bizDays > limit) sla.overdue++;
    else if (bizDays >= limit - 1) sla.atRisk++;
    else sla.onTime++;
  });

  // Lista de proyectos para dropdowns (solo activos + en pausa)
  var projectList = projects
    .filter(function(p){ return p.status !== 'Completado' && p.status !== 'Cancelado'; })
    .map(function(p){ return { id: p.id, nombre: p.nombre }; });

  return {
    tasks: tasks,
    historial: historial,
    kpi: kpi,
    sla: sla,
    team: team,
    countries: Object.values(countryMap),
    equipos: equipos,
    projects: projects,
    projectList: projectList,
    semana: raw.semana,
    generated: raw.generated,
    config: raw.config,
    _role: role,
    _user: { name: user.name, code: user.code, isLeader: !!user.isLeader }
  };
}

// ════════════════════════════════════════════════════════════════
// WRITE AUTHORIZATION
// ════════════════════════════════════════════════════════════════
// Convierte throws en {success:false, error} para que el frontend reciba
// siempre el mismo contrato (failureHandler deja la UI en estado raro).
function _safeMutation(fn) {
  try {
    return fn();
  } catch (e) {
    return { success: false, error: (e && e.message) || String(e) };
  }
}

// Contexto actual del visitante + su rol. Se usa en cada mutation.
function _getAuthContext() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var equipos = readEquipos(ss);
  var config = readConfig(ss);
  var auth = resolveVisitor(equipos);
  if (!auth.ok) throw new Error('No autorizado: ' + auth.message);
  var role = determineRole(auth.email, auth.user, config);
  return { email: auth.email, user: auth.user, role: role, equipos: equipos, ss: ss };
}

// Valida que el visitante pueda modificar una tarea específica.
// target = {resp, pais} (al menos estos campos). Lanza si no puede.
function _authorizeTaskWrite(ctx, target) {
  if (ctx.role === 'head') return;
  if (ctx.role === 'manager') {
    var cc = (target && target.pais) || (target ? getCountryForMember(target.resp, ctx.equipos) : '');
    if (cc && cc !== ctx.user.code) {
      throw new Error('Sin permiso: tarea de otro país (' + cc + ')');
    }
    return;
  }
  // specialist: solo sus propias tareas
  if (!target || target.resp !== ctx.user.name) {
    throw new Error('Sin permiso: solo puedes modificar tus tareas');
  }
}

// Valida que el visitante pueda modificar un proyecto específico.
// target = {responsable, pais, participantes}
function _authorizeProjectWrite(ctx, target) {
  if (ctx.role === 'head') return;
  if (ctx.role === 'manager') {
    if (target && target.pais && target.pais !== ctx.user.code) {
      throw new Error('Sin permiso: proyecto de otro país (' + target.pais + ')');
    }
    return;
  }
  // specialist: responsable o participante
  if (!target) throw new Error('Sin permiso');
  if (target.responsable === ctx.user.name) return;
  if (target.participantes && target.participantes.indexOf(ctx.user.name) >= 0) return;
  throw new Error('Sin permiso: solo puedes modificar proyectos donde participas');
}

// Lee el estado actual de una tarea desde el sheet (para validar antes de escribir).
function _readTaskById(ss, taskId) {
  var ws = ss.getSheetByName(SHEET_ACTIVO);
  var lr = ws.getLastRow();
  if (lr < 4) return null;
  var data = ws.getRange(4, 1, lr - 3, Math.min(ws.getLastColumn(), TASK_COLS)).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == taskId) {
      return { row: i + 4, resp: data[i][2], pais: (data[i][12] || '').toString().trim() };
    }
  }
  return null;
}

function _readProjectById(ss, projId) {
  var ws = ss.getSheetByName(SHEET_PROYECTOS);
  if (!ws) return null;
  var lr = ws.getLastRow();
  if (lr < 2) return null;
  var data = ws.getRange(2, 1, lr - 1, Math.min(ws.getLastColumn(), PROJ_COLS)).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == projId) {
      return {
        row: i + 2,
        pais: (data[i][2] || '').toString().trim(),
        responsable: (data[i][4] || '').toString().trim(),
        participantes: (data[i][12] || '').toString().split(',').map(function(s){ return s.trim(); }).filter(Boolean)
      };
    }
  }
  return null;
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
      documentos: _parseDocs(row[15]),
      pctDone: 0, tasks: [], taskStats: {}
    });
  });
  return projects;
}

function addProject(obj) { return _safeMutation(function() { return _addProjectImpl(obj); }); }
function _addProjectImpl(obj) {
  var ctx = _getAuthContext();
  // Validar que pueda crear en este país / como este responsable
  _authorizeProjectWrite(ctx, {
    pais: obj.pais || '',
    responsable: obj.responsable || ctx.user.name,
    participantes: (obj.participantes || '').toString().split(',').map(function(s){ return s.trim(); }).filter(Boolean)
  });
  invalidateCache();
  var ss = ctx.ss;
  var ws = ss.getSheetByName(SHEET_PROYECTOS);
  if (!ws) {
    ws = ss.insertSheet(SHEET_PROYECTOS);
    ws.appendRow(['ID','Nombre','País','Líder','Responsable','Deadline','Prioridad','Estado','Descripción','Notas','Creado','Semana','Participantes','TipoTrabajo','Riesgo','Documentos']);
    ws.getRange(1,1,1,PROJ_COLS).setFontWeight('bold').setBackground('#FF4940').setFontColor('#FFFFFF');
    ws.setTabColor('#FF4940');
  }
  // Lock para evitar colisión de IDs entre addProject concurrentes
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    var lastRow = ws.getLastRow();
    // max(IDs existentes) + 1 — resiste borrados y mantiene IDs únicos.
    var newId = 1;
    if (lastRow >= 2) {
      var ids = ws.getRange(2, 1, lastRow - 1, 1).getValues();
      ids.forEach(function(r){ var v = parseInt(r[0], 10); if (!isNaN(v) && v >= newId) newId = v + 1; });
    }
    var equipos = readEquipos(ss);
    var pais  = obj.pais || getCountryForMember(obj.responsable, equipos);
    var lider = obj.lider || getLeaderForCountry(pais, equipos);
    ws.appendRow([
      newId, obj.nombre||'', pais, lider, obj.responsable||'',
      obj.deadline||'', obj.priority||'Media', obj.status||'Activo',
      obj.descripcion||'', obj.notas||'', new Date(), getCurrentWeekLabel(), obj.participantes||'',
      obj.tipoTrabajo||'', obj.riesgo||'', ''
    ]);
    return {success:true, id:newId, nombre:obj.nombre||''};
  } finally {
    lock.releaseLock();
  }
}

function updateProjectField(projId, field, value) { return _safeMutation(function() { return _updateProjectFieldImpl(projId, field, value); }); }
function _updateProjectFieldImpl(projId, field, value) {
  var ctx = _getAuthContext();
  var current = _readProjectById(ctx.ss, projId);
  if (!current) return { success: false, error: 'Project #' + projId + ' not found' };
  _authorizeProjectWrite(ctx, current);
  invalidateCache();
  var ws = ctx.ss.getSheetByName(SHEET_PROYECTOS);
  var fieldMap = {'nombre':2,'pais':3,'lider':4,'responsable':5,'deadline':6,'priority':7,'status':8,'descripcion':9,'notas':10,'participantes':13,'tipoTrabajo':14,'riesgo':15};
  var col = fieldMap[field];
  if (!col) return { success: false, error: 'Invalid field: ' + field };
  ws.getRange(current.row, col).setValue(value);
  return { success: true };
}

// Batch update de proyectos: aplica varios campos en una sola llamada.
// Valida permisos contra el estado actual antes de cualquier escritura.
function updateProjectFields(projId, fields) { return _safeMutation(function() { return _updateProjectFieldsImpl(projId, fields); }); }
function _updateProjectFieldsImpl(projId, fields) {
  if (!fields || typeof fields !== 'object') return { success: false, error: 'Invalid fields' };
  var ctx = _getAuthContext();
  var current = _readProjectById(ctx.ss, projId);
  if (!current) return { success: false, error: 'Project #' + projId + ' not found' };
  _authorizeProjectWrite(ctx, current);

  // Manager no puede mover el proyecto a otro país; specialist no puede
  // transferir responsabilidad ni cambiar país.
  if (ctx.role === 'manager' && fields.pais !== undefined && fields.pais !== ctx.user.code) {
    throw new Error('Sin permiso: no puedes mover el proyecto a otro país');
  }
  if (ctx.role === 'specialist') {
    if (fields.responsable !== undefined && fields.responsable !== ctx.user.name) {
      throw new Error('Sin permiso: no puedes transferir el proyecto');
    }
    if (fields.pais !== undefined && fields.pais !== current.pais) {
      throw new Error('Sin permiso: no puedes cambiar el país del proyecto');
    }
  }

  invalidateCache();
  var ws = ctx.ss.getSheetByName(SHEET_PROYECTOS);
  var fieldMap = {'nombre':2,'pais':3,'lider':4,'responsable':5,'deadline':6,'priority':7,'status':8,'descripcion':9,'notas':10,'participantes':13,'tipoTrabajo':14,'riesgo':15};
  var row = current.row;

  Object.keys(fields).forEach(function(k) {
    var col = fieldMap[k];
    if (!col) return;
    var v = fields[k];
    // participantes puede llegar como array o string csv
    if (k === 'participantes' && Array.isArray(v)) v = v.join(', ');
    ws.getRange(row, col).setValue(v);
  });
  return { success: true };
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
      proyectoId: isNaN(parseInt(proyVal, 10)) ? '' : parseInt(proyVal, 10),
      proyecto: proyVal, // keep raw for backward compat
      pais:(row[12]||'').toString().trim(),
      lider:(row[13]||'').toString().trim(),
      tipoTrabajo:(row[14]||'').toString().trim(),
      riesgo:(row[15]||'').toString().trim(),
      documentos: _parseDocs(row[16])
    });
  });
  tasks.sort(function(a,b){return (PRIO_ORDER[a.priority]||1)-(PRIO_ORDER[b.priority]||1)||(STATUS_ORDER[a.status]||2)-(STATUS_ORDER[b.status]||2)});
  return tasks;
}

function addTask(taskObj) { return _safeMutation(function() { return _addTaskImpl(taskObj); }); }
function _addTaskImpl(taskObj) {
  var ctx = _getAuthContext();
  var equipos = ctx.equipos;
  var proposedResp = taskObj.resp || '';
  var proposedPais = taskObj.pais || getCountryForMember(proposedResp, equipos);
  // Validar permisos antes de escribir. Specialist solo puede asignarse a sí mismo;
  // manager solo dentro de su país; head sin restricción.
  _authorizeTaskWrite(ctx, { resp: proposedResp, pais: proposedPais });

  invalidateCache();
  var ss = ctx.ss, ws = ss.getSheetByName(SHEET_ACTIVO);
  // Lock para que nextTaskId + appendRow sean atómicos frente a creaciones concurrentes.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    var newId = nextTaskId(ss);
    var pais  = proposedPais;
    var lider = taskObj.lider || getLeaderForCountry(pais, equipos);
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
  } finally {
    lock.releaseLock();
  }
}

function updateTaskField(taskId, field, value) { return _safeMutation(function() { return _updateTaskFieldImpl(taskId, field, value); }); }
function _updateTaskFieldImpl(taskId, field, value) {
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return { success: false, error: 'Task #' + taskId + ' not found' };
  _authorizeTaskWrite(ctx, current);

  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16};
  var col = fieldMap[field];
  if (!col) return { success: false, error: 'Invalid field: ' + field };

  // Specialist no puede reasignar resp (sacarse la tarea de encima); manager
  // sí puede reasignar dentro de su país. Chequeo extra solo si field==='resp'.
  if (field === 'resp' && ctx.role === 'specialist' && value !== ctx.user.name) {
    throw new Error('Sin permiso: no puedes reasignar tareas');
  }
  if (field === 'pais' && ctx.role === 'manager' && value !== ctx.user.code) {
    throw new Error('Sin permiso: no puedes mover tareas a otro país');
  }

  invalidateCache();
  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  // Normalizar proyectoId a entero (o vacío)
  if (field === 'proyectoId' || field === 'proyecto') {
    var n = parseInt(value, 10);
    value = isNaN(n) ? '' : n;
  }
  ws.getRange(current.row, col).setValue(value);
  if (field === 'status' && value === 'Listo') {
    ws.getRange(current.row, 10).setValue(new Date());
    moveToHistorial(ctx.ss, ws, current.row);
    return { success: true, moved: true, message: 'Tarea movida a Historial' };
  }
  return { success: true };
}
function updateTaskStatus(taskId, newStatus) { return updateTaskField(taskId, 'status', newStatus); }

// Batch update: aplica varios campos en una sola llamada.
// Si `status` es 'Listo', se aplica al final y dispara el move a Historial (los demás campos ya quedaron escritos).
function updateTaskFields(taskId, fields) { return _safeMutation(function() { return _updateTaskFieldsImpl(taskId, fields); }); }
function _updateTaskFieldsImpl(taskId, fields) {
  if (!fields || typeof fields !== 'object') return { success: false, error: 'Invalid fields' };
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return { success: false, error: 'Task #' + taskId + ' not found' };
  _authorizeTaskWrite(ctx, current);

  // Chequeos extra para reasignaciones no permitidas
  if (ctx.role === 'specialist' && fields.resp !== undefined && fields.resp !== ctx.user.name) {
    throw new Error('Sin permiso: no puedes reasignar tareas');
  }
  if (ctx.role === 'manager' && fields.pais !== undefined && fields.pais !== ctx.user.code) {
    throw new Error('Sin permiso: no puedes mover tareas a otro país');
  }

  invalidateCache();
  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16};
  var row = current.row;

  // 1) Aplicar todos los campos menos status
  Object.keys(fields).forEach(function(k) {
    if (k === 'status') return;
    var col = fieldMap[k];
    if (!col) return;
    var v = fields[k];
    if (k === 'proyectoId' || k === 'proyecto') {
      var n = parseInt(v, 10);
      v = isNaN(n) ? '' : n;
    }
    ws.getRange(row, col).setValue(v);
  });

  // 2) Status al final (puede disparar move a Historial)
  if (fields.status !== undefined) {
    ws.getRange(row, 7).setValue(fields.status);
    if (fields.status === 'Listo') {
      ws.getRange(row, 10).setValue(new Date());
      moveToHistorial(ctx.ss, ws, row);
      return { success: true, moved: true, message: 'Tarea movida a Historial' };
    }
  }
  return { success: true };
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
// Lock para que read+append+delete sean atómicos: sin lock, dos cierres concurrentes pueden
// borrar filas incorrectas (el deleteRow corre contra el sheet ya mutado por otro usuario).
function moveToHistorial(ss, wsA, row) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    var wsH = ss.getSheetByName(SHEET_HISTORIAL);
    var lc = Math.min(wsA.getLastColumn(), TASK_COLS);
    var rd = wsA.getRange(row, 1, 1, lc).getValues()[0];
    while (rd.length < TASK_COLS) rd.push('');
    // Preserva el ID original — NO reasignar. Así las referencias (notas, Slack, humanas) siguen válidas.
    wsH.appendRow(rd);
    wsA.deleteRow(row);
  } finally {
    lock.releaseLock();
  }
}

// Calcula el próximo ID único entre activos + historial (evita colisiones tras mover tareas).
function nextTaskId(ss) {
  var maxId = 0;
  ['Tracking Activo','Historial'].forEach(function(name){
    var ws = ss.getSheetByName(name); if (!ws) return;
    var lr = ws.getLastRow(); if (lr < 4) return;
    var ids = ws.getRange(4, 1, lr - 3, 1).getValues();
    ids.forEach(function(r){ var v = parseInt(r[0], 10); if (!isNaN(v) && v > maxId) maxId = v; });
  });
  return maxId + 1;
}
function getCurrentWeekLabel(){var now=new Date(),mon=new Date(now);mon.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1));var fri=new Date(mon);fri.setDate(mon.getDate()+4);var m=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return mon.getDate()+'-'+fri.getDate()+' '+m[fri.getMonth()]+' '+fri.getFullYear()}

// ════════════════════════════════════════════════════════════════
// DOCUMENTS (Drive integration)
// ════════════════════════════════════════════════════════════════
// Cada task/project tiene columna "Documentos" con JSON [{name, url, id}].
// Subidas nuevas se clasifican en subcarpetas automáticas bajo la raíz
// configurada en Config!DriveFolder.

function _parseDocs(cellValue) {
  if (!cellValue) return [];
  var s = cellValue.toString().trim();
  if (!s) return [];
  try {
    var arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function _serializeDocs(docs) {
  if (!docs || !docs.length) return '';
  return JSON.stringify(docs);
}

// Extrae el ID de Drive de una URL o retorna el valor tal cual si ya parece ID.
function _extractDriveId(urlOrId) {
  if (!urlOrId) return '';
  var s = urlOrId.toString().trim();
  // URL típica: /folders/XXX  o  /d/XXX  o  ?id=XXX
  var m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
          s.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
          s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Si ya parece un ID crudo (solo chars válidos)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return '';
}

// Resuelve la carpeta raíz configurada en Config!DriveFolder. Lanza si no
// está configurada o no es accesible.
function _getRootFolder() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var config = readConfig(ss);
  var cfgValue = config['DriveFolder'] || config['driveFolder'] || '';
  if (!cfgValue) {
    throw new Error('Configura la carpeta raíz en Config!DriveFolder (pega la URL o el ID de una carpeta de Drive).');
  }
  var folderId = _extractDriveId(cfgValue);
  if (!folderId) {
    throw new Error('El valor de Config!DriveFolder no es una URL o ID de Drive válidos.');
  }
  try {
    return DriveApp.getFolderById(folderId);
  } catch (e) {
    throw new Error('No puedo acceder a la carpeta de Drive. Verifica permisos del owner del webapp sobre ' + folderId + '.');
  }
}

// Retorna (o crea) una subcarpeta por nombre dentro de parent.
// DriveApp no tiene unicidad por nombre; si dos uploads concurrentes no
// encuentran la carpeta, ambos la crean (duplicada). Usamos lock corto para
// serializar la creación. El get es idempotente, el createFolder no.
function _ensureSubfolder(parent, name) {
  var clean = (name || '').toString().trim() || 'Sin clasificar';
  var it = parent.getFoldersByName(clean);
  if (it.hasNext()) return it.next();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch(e) {
    // Si no pudimos tomar el lock, hacemos el check una vez más y creamos.
    it = parent.getFoldersByName(clean);
    if (it.hasNext()) return it.next();
    return parent.createFolder(clean);
  }
  try {
    // Re-check adentro del lock: otra invocación pudo haberla creado.
    it = parent.getFoldersByName(clean);
    if (it.hasNext()) return it.next();
    return parent.createFolder(clean);
  } finally {
    lock.releaseLock();
  }
}

// Resuelve la carpeta final donde debe ir un archivo según la taxonomía:
//   TipoTrabajo / País / (NombreProyecto | "Tareas sueltas")
function _resolveTargetFolder(kind, itemId) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var root = _getRootFolder();
  var tipo = '', pais = '', projName = '';

  if (kind === 'task') {
    var ws = ss.getSheetByName(SHEET_ACTIVO);
    var lr = ws.getLastRow();
    var data = ws.getRange(4, 1, Math.max(0, lr - 3), TASK_COLS).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] == itemId) {
        pais = (data[i][12] || '').toString().trim();
        tipo = (data[i][14] || '').toString().trim();
        var pid = parseInt((data[i][11] || '').toString().trim(), 10);
        if (!isNaN(pid)) {
          var projRow = _readProjectById(ss, pid);
          if (projRow) {
            var pws = ss.getSheetByName(SHEET_PROYECTOS);
            projName = (pws.getRange(projRow.row, 2).getValue() || '').toString().trim();
          }
        }
        break;
      }
    }
  } else if (kind === 'project') {
    var pws = ss.getSheetByName(SHEET_PROYECTOS);
    var plr = pws.getLastRow();
    var pdata = pws.getRange(2, 1, Math.max(0, plr - 1), PROJ_COLS).getValues();
    for (var j = 0; j < pdata.length; j++) {
      if (pdata[j][0] == itemId) {
        pais = (pdata[j][2] || '').toString().trim();
        tipo = (pdata[j][13] || '').toString().trim();
        projName = (pdata[j][1] || '').toString().trim();
        break;
      }
    }
  }

  var tipoFolder = _ensureSubfolder(root, tipo || 'Sin clasificar');
  var paisFolder = _ensureSubfolder(tipoFolder, pais || 'Sin país');
  var finalName = kind === 'project'
    ? (projName || 'Sin nombre')
    : (projName || 'Tareas sueltas');
  return _ensureSubfolder(paisFolder, finalName);
}

// Lee los docs actuales del item + la posición en el sheet + la columna.
function _readDocsFor(kind, itemId) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (kind === 'task') {
    var ws = ss.getSheetByName(SHEET_ACTIVO);
    var lr = ws.getLastRow();
    if (lr < 4) return null;
    var data = ws.getRange(4, 1, lr - 3, TASK_COLS).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] == itemId) {
        return { ss: ss, ws: ws, row: i + 4, col: TASK_DOCS_COL, docs: _parseDocs(data[i][TASK_DOCS_COL - 1]),
                 target: { resp: data[i][2], pais: (data[i][12] || '').toString().trim() } };
      }
    }
  } else if (kind === 'project') {
    var pws = ss.getSheetByName(SHEET_PROYECTOS);
    var plr = pws.getLastRow();
    if (plr < 2) return null;
    var pdata = pws.getRange(2, 1, plr - 1, PROJ_COLS).getValues();
    for (var j = 0; j < pdata.length; j++) {
      if (pdata[j][0] == itemId) {
        var parts = (pdata[j][12] || '').toString().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        return { ss: ss, ws: pws, row: j + 2, col: PROJ_DOCS_COL, docs: _parseDocs(pdata[j][PROJ_DOCS_COL - 1]),
                 target: { responsable: (pdata[j][4] || '').toString().trim(),
                           pais: (pdata[j][2] || '').toString().trim(),
                           participantes: parts } };
      }
    }
  }
  return null;
}

// Sube un archivo (base64) a Drive y lo vincula al item. Retorna el doc descriptor.
// Lock para que upload + read + append + write al sheet sean atómicos (evita
// perder docs cuando hay uploads concurrentes al mismo item).
// Si la escritura al sheet falla, se borra el archivo de Drive para no dejar huérfanos.
function uploadDocument(kind, itemId, fileData) { return _safeMutation(function() { return _uploadDocumentImpl(kind, itemId, fileData); }); }
function _uploadDocumentImpl(kind, itemId, fileData) {
  if (!fileData || !fileData.data || !fileData.name) {
    return { success: false, error: 'Datos de archivo inválidos' };
  }
  var ctx = _getAuthContext();
  var info = _readDocsFor(kind, itemId);
  if (!info) return { success: false, error: (kind === 'project' ? 'Proyecto' : 'Tarea') + ' #' + itemId + ' no encontrado' };
  if (kind === 'task') _authorizeTaskWrite(ctx, info.target);
  else _authorizeProjectWrite(ctx, info.target);

  var folder = _resolveTargetFolder(kind, itemId);
  var bytes = Utilities.base64Decode(fileData.data);
  var blob = Utilities.newBlob(bytes, fileData.mimeType || 'application/octet-stream', fileData.name);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  var file = null;
  try {
    // Re-leer docs bajo el lock para no pisar otra escritura concurrente.
    var fresh = _readDocsFor(kind, itemId);
    if (!fresh) return { success: false, error: 'Item desapareció mientras se subía' };
    file = folder.createFile(blob);
    var doc = { name: file.getName(), url: file.getUrl(), id: file.getId(),
                uploadedBy: ctx.user.name, uploadedAt: new Date().toISOString() };
    var docs = fresh.docs.concat([doc]);
    try {
      fresh.ws.getRange(fresh.row, fresh.col).setValue(_serializeDocs(docs));
    } catch (writeErr) {
      // Rollback: borra el archivo recién subido para no dejarlo huérfano.
      try { file.setTrashed(true); } catch (e) {}
      throw writeErr;
    }
    invalidateCache();
    return { success: true, doc: doc };
  } finally {
    lock.releaseLock();
  }
}

// Vincula un link existente de Drive (no mueve el archivo).
function attachDocumentLink(kind, itemId, link) { return _safeMutation(function() { return _attachDocumentLinkImpl(kind, itemId, link); }); }
function _attachDocumentLinkImpl(kind, itemId, link) {
  if (!link || !link.url) return { success: false, error: 'URL requerida' };
  var ctx = _getAuthContext();
  var info = _readDocsFor(kind, itemId);
  if (!info) return { success: false, error: (kind === 'project' ? 'Proyecto' : 'Tarea') + ' #' + itemId + ' no encontrado' };
  if (kind === 'task') _authorizeTaskWrite(ctx, info.target);
  else _authorizeProjectWrite(ctx, info.target);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    var fresh = _readDocsFor(kind, itemId);
    if (!fresh) return { success: false, error: 'Item desapareció' };
    var doc = {
      name: (link.name || '').toString().trim() || link.url,
      url: link.url.toString().trim(),
      id: _extractDriveId(link.url) || '',
      external: true,
      uploadedBy: ctx.user.name,
      uploadedAt: new Date().toISOString()
    };
    var docs = fresh.docs.concat([doc]);
    fresh.ws.getRange(fresh.row, fresh.col).setValue(_serializeDocs(docs));
    invalidateCache();
    return { success: true, doc: doc };
  } finally {
    lock.releaseLock();
  }
}

// Quita la referencia del tracker (NO borra el archivo en Drive).
function removeDocument(kind, itemId, docIndex) { return _safeMutation(function() { return _removeDocumentImpl(kind, itemId, docIndex); }); }
function _removeDocumentImpl(kind, itemId, docIndex) {
  var ctx = _getAuthContext();
  var info = _readDocsFor(kind, itemId);
  if (!info) return { success: false, error: 'No encontrado' };
  if (kind === 'task') _authorizeTaskWrite(ctx, info.target);
  else _authorizeProjectWrite(ctx, info.target);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    // Re-leer bajo el lock: el índice puede haber cambiado si otro agregó/quitó docs.
    var fresh = _readDocsFor(kind, itemId);
    if (!fresh) return { success: false, error: 'No encontrado' };
    var idx = parseInt(docIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= fresh.docs.length) return { success: false, error: 'Índice inválido' };
    fresh.docs.splice(idx, 1);
    fresh.ws.getRange(fresh.row, fresh.col).setValue(_serializeDocs(fresh.docs));
    invalidateCache();
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

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

// Cierra una tarea por ID (desde Slack o tras confirmación). Valida permiso:
// desde Slack, Session=owner (head) así que pasa; desde el webapp, el usuario
// debe tener permiso sobre la tarea según su rol.
function closeTaskById(taskId, slackUser) {
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return { success: false, message: 'Tarea #' + taskId + ' no encontrada' };
  _authorizeTaskWrite(ctx, current);

  invalidateCache();
  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  var tn = ws.getRange(current.row, 2).getValue();
  ws.getRange(current.row, 7).setValue('Listo');
  ws.getRange(current.row, 10).setValue(new Date());
  moveToHistorial(ctx.ss, ws, current.row);
  return { success: true, id: taskId, nombre: tn, message: 'Tarea #' + taskId + ' "' + tn + '" cerrada y movida a Historial' };
}

// Bloquea una tarea por ID. Mismas validaciones que closeTaskById.
function blockTaskById(taskId, reason, slackUser) {
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return { success: false, message: 'Tarea #' + taskId + ' no encontrada' };
  _authorizeTaskWrite(ctx, current);

  invalidateCache();
  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  var tn = ws.getRange(current.row, 2).getValue();
  ws.getRange(current.row, 7).setValue('Bloqueado');
  var prevNotes = ws.getRange(current.row, 11).getValue() || '';
  var stamp = '⛔ ' + (reason || '') + ' (' + (slackUser || '') + ', ' + new Date().toLocaleDateString('es-CO') + ')';
  ws.getRange(current.row, 11).setValue((prevNotes ? prevNotes + ' | ' : '') + stamp);
  return { success: true, id: taskId, nombre: tn, message: 'Tarea bloqueada: #' + taskId + ' "' + tn + '"' };
}
function testData() {
  var d = getTrackerData();
  Logger.log('Tasks: ' + d.tasks.length);
  Logger.log('Equipos: ' + d.equipos.length);
  Logger.log('Projects: ' + d.projects.length);
  Logger.log('Team: ' + d.team.length);
}
