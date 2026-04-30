// ════════════════════════════════════════════════════════════════
// Legal Team Tracker · Smoke Tests · backend/tests.gs
// Corrible desde el editor de Apps Script con el botón Run.
// ────────────────────────────────────────────────────────────────
// Punto de entrada principal: runPilotSmokeTest()
// Auxiliares:                  runDriveFolderCheck() · runSlackTokenCheck()
// ════════════════════════════════════════════════════════════════

// Emails productivos hardcodeados para el smoke test del piloto CO.
// Nota: enrique.gonzalez@rappi.com se usa como caso "HQ-not-in-Heads"
// para documentar el comportamiento cuando un email NO está en
// Config!Heads (debería degradar a specialist o quedar fuera del
// allowlist según cómo esté configurado Equipos).
var PILOT_TEST_EMAILS = [
  { label: 'specialist', email: 'juan.gallego@rappi.com' },
  { label: 'manager',    email: 'eduardo.fernandez@rappi.com' },
  { label: 'head',       email: 'juan.gallego@rappi.com' },
  { label: 'hq-no-head', email: 'enrique.gonzalez@rappi.com' }
];

// ── ASSERT HELPER ───────────────────────────────────────────────
// Loguea ✅ o ❌ con un mensaje. No tira excepción para que el smoke
// test continúe y reporte todos los problemas en una sola corrida.
function _assert(cond, msg) {
  if (cond) {
    Logger.log('✅ ' + msg);
  } else {
    Logger.log('❌ ' + msg);
  }
  return !!cond;
}

// ── SMOKE TEST PRINCIPAL ────────────────────────────────────────
function runPilotSmokeTest() {
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('PILOT SMOKE TEST · ' + new Date().toISOString());
  Logger.log('═══════════════════════════════════════════════════');

  var ss = SpreadsheetApp.openById(SHEET_ID);

  // 1) Equipos & Config — contadores básicos
  var equipos = readEquipos(ss);
  var config  = readConfig(ss);

  var countriesWithMembers = 0;
  equipos.forEach(function(eq) {
    if ((eq.members || []).length > 0) countriesWithMembers++;
  });

  var headsRaw = (config && config.Heads) ? config.Heads.toString() : '';
  var heads = headsRaw.toLowerCase().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  var hasDriveFolder = !!(config && (config.DriveFolder || config.driveFolder));

  Logger.log('— Equipos & Config —');
  Logger.log('  Equipos cargados: ' + equipos.length);
  Logger.log('  Países con miembros: ' + countriesWithMembers);
  Logger.log('  Heads configurados: ' + heads.length + ' (' + heads.join(', ') + ')');
  Logger.log('  Config!DriveFolder presente: ' + hasDriveFolder);

  _assert(equipos.length > 0, 'readEquipos retornó al menos un equipo');
  _assert(countriesWithMembers > 0, 'al menos un país tiene miembros');
  _assert(heads.length > 0, 'Config!Heads tiene al menos un email');
  _assert(hasDriveFolder, 'Config!DriveFolder está presente');

  // 2) Snapshot raw — verificación de shape
  var raw = _cachedRawData();
  _assert(raw != null, '_cachedRawData() no es null');
  _assert(raw && raw.tasks != null, 'raw.tasks no es null/undefined');
  _assert(raw && raw.projects != null, 'raw.projects no es null/undefined');
  _assert(raw && raw.historial != null, 'raw.historial no es null/undefined');
  _assert(raw && raw.equipos != null, 'raw.equipos no es null/undefined');

  Logger.log('— Raw snapshot —');
  Logger.log('  tasks: '     + ((raw && raw.tasks)     ? raw.tasks.length     : 'N/A'));
  Logger.log('  projects: '  + ((raw && raw.projects)  ? raw.projects.length  : 'N/A'));
  Logger.log('  historial: ' + ((raw && raw.historial) ? raw.historial.length : 'N/A'));
  Logger.log('  equipos: '   + ((raw && raw.equipos)   ? raw.equipos.length   : 'N/A'));
  Logger.log('  semana: '    + (raw ? raw.semana : 'N/A'));

  // 3) Resolución por rol — para cada email del pilot test
  var allowlist = buildEmailAllowlist(equipos);
  Logger.log('— Allowlist —');
  Logger.log('  Emails en allowlist: ' + Object.keys(allowlist).length);

  Logger.log('— Resolución por rol —');
  PILOT_TEST_EMAILS.forEach(function(item) {
    var email = (item.email || '').toLowerCase().trim();
    var user = allowlist[email];

    Logger.log('· [' + item.label + '] ' + email);

    if (!user) {
      Logger.log('  ⚠ email NO está en buildEmailAllowlist (no resuelve usuario)');
      // Igualmente probamos determineRole — head sólo depende de Config!Heads
      var roleNoUser = determineRole(email, null, config);
      Logger.log('  rol resuelto (sin user): ' + roleNoUser);
      // Si es head, podemos seguir construyendo la vista con un user dummy
      if (roleNoUser === 'head') {
        var dummyUser = { name: '', code: '', isLeader: false };
        var viewHQ = _buildViewForRole(raw, roleNoUser, dummyUser);
        Logger.log('  tareas visibles: '   + ((viewHQ.tasks)     ? viewHQ.tasks.length     : 0));
        Logger.log('  proyectos visibles: '+ ((viewHQ.projects)  ? viewHQ.projects.length  : 0));
        Logger.log('  countries visibles: '+ ((viewHQ.countries) ? viewHQ.countries.length : 'N/A'));
      } else {
        Logger.log('  → no se construye vista (sin user válido y rol != head)');
      }
      return;
    }

    var role = determineRole(email, user, config);
    var view = _buildViewForRole(raw, role, user);

    var nTasks     = (view.tasks)     ? view.tasks.length     : 0;
    var nProjects  = (view.projects)  ? view.projects.length  : 0;
    var nCountries = (view.countries) ? view.countries.length : 0;

    Logger.log('  user: ' + user.name + ' (' + user.code + ')' + (user.isLeader ? ' [leader]' : ''));
    Logger.log('  rol resuelto: ' + role);
    Logger.log('  tareas visibles: '    + nTasks);
    Logger.log('  proyectos visibles: ' + nProjects);
    Logger.log('  countries visibles: ' + nCountries);

    // Gates esperados por rol
    if (role === 'specialist') {
      var allOwnTasks = (view.tasks || []).every(function(t){ return t.resp === user.name; });
      _assert(allOwnTasks, '[specialist] solo ve tareas con resp === user.name (' + user.name + ')');
    } else if (role === 'manager') {
      var allOwnCountry = (view.tasks || []).every(function(t) {
        var cc = t.pais || getCountryForMember(t.resp, equipos);
        return cc === user.code;
      });
      _assert(allOwnCountry, '[manager] solo ve tareas de su country code (' + user.code + ')');
    } else if (role === 'head') {
      _assert(nTasks === (raw.tasks || []).length, '[head] ve todas las tareas activas (' + nTasks + ' === ' + (raw.tasks || []).length + ')');
    }
  });

  // 4) Calidad de datos — tareas con país vacío después de getCountryForMember
  Logger.log('— Calidad de datos —');
  var tasksWithoutCountry = [];
  (raw.tasks || []).forEach(function(t) {
    var cc = t.pais || getCountryForMember(t.resp, equipos);
    if (!cc) {
      tasksWithoutCountry.push({ id: t.id, resp: t.resp, nombre: t.nombre });
    }
  });
  Logger.log('  Tareas sin país (post getCountryForMember): ' + tasksWithoutCountry.length);
  tasksWithoutCountry.forEach(function(t) {
    Logger.log('   · ' + t.id + ' · resp="' + t.resp + '" · ' + t.nombre);
  });
  _assert(tasksWithoutCountry.length === 0, 'todas las tareas resuelven a un país');

  // 5) Calidad de datos — tareas con responsable que no resuelve a ningún email del allowlist
  // Buscamos el resp (nombre) en allowlist por user.name.
  var allowedNames = {};
  Object.keys(allowlist).forEach(function(em) {
    var u = allowlist[em];
    if (u && u.name) allowedNames[u.name] = 1;
  });
  var tasksOrphanResp = [];
  (raw.tasks || []).forEach(function(t) {
    if (t.resp && !allowedNames[t.resp]) {
      tasksOrphanResp.push({ id: t.id, resp: t.resp, nombre: t.nombre });
    }
  });
  Logger.log('  Tareas con resp sin email en allowlist: ' + tasksOrphanResp.length);
  tasksOrphanResp.forEach(function(t) {
    Logger.log('   · ' + t.id + ' · resp="' + t.resp + '" · ' + t.nombre);
  });
  _assert(tasksOrphanResp.length === 0, 'todos los responsables tienen email en allowlist');

  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('SMOKE TEST FINALIZADO');
  Logger.log('═══════════════════════════════════════════════════');
}

// ── DRIVE FOLDER CHECK ──────────────────────────────────────────
// Verifica que Config!DriveFolder existe y es accesible vía DriveApp.
function runDriveFolderCheck() {
  Logger.log('— DriveFolder check —');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var config = readConfig(ss);
  var cfgValue = config['DriveFolder'] || config['driveFolder'] || '';

  if (!_assert(!!cfgValue, 'Config!DriveFolder está seteado')) {
    Logger.log('  → completá Config!DriveFolder con la URL o ID de la carpeta raíz.');
    return;
  }

  var folderId = _extractDriveId(cfgValue);
  if (!_assert(!!folderId, 'Config!DriveFolder es una URL o ID válido')) {
    Logger.log('  valor recibido: "' + cfgValue + '"');
    return;
  }

  try {
    var folder = DriveApp.getFolderById(folderId);
    var name = folder.getName();
    _assert(true, 'DriveApp.getFolderById accesible — carpeta: "' + name + '"');
  } catch (e) {
    _assert(false, 'DriveApp.getFolderById falló para id=' + folderId + ' — ' + e.message);
  }
}

// ── SLACK TOKEN CHECK ───────────────────────────────────────────
// Verifica que SLACK_BOT_TOKEN está seteado en Script Properties.
// NO imprime el valor del token, sólo si está presente y su prefijo.
function runSlackTokenCheck() {
  Logger.log('— Slack token check —');
  var props = PropertiesService.getScriptProperties();
  var tok = props.getProperty('SLACK_BOT_TOKEN') || '';
  var present = !!tok;
  _assert(present, 'SLACK_BOT_TOKEN está seteado en Script Properties');
  if (present) {
    var prefix = tok.substring(0, 4); // típicamente "xoxb"
    _assert(prefix === 'xoxb', 'SLACK_BOT_TOKEN tiene prefijo "xoxb" (prefijo actual: "' + prefix + '")');
  } else {
    Logger.log('  → seteá SLACK_BOT_TOKEN en Project Settings → Script Properties.');
  }

  // Bonus: signing secret (no es bloqueante mientras _SLACK_SIG_ENFORCED=false).
  var sig = props.getProperty('SLACK_SIGNING_SECRET') || '';
  Logger.log('  SLACK_SIGNING_SECRET presente: ' + !!sig + ' (no bloqueante)');
}
