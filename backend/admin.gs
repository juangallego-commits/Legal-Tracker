// ════════════════════════════════════════════════════════════════
// ADMIN · Operaciones destructivas o de provisioning del sheet
// ════════════════════════════════════════════════════════════════
// Convención: aislamos acá las funciones que (a) escriben a hojas
// enteras, (b) borran data, o (c) crean/modifican columnas/hojas
// del schema. Antes vivían al final de codigo.gs y aparecían en el
// dropdown del editor sin gates → un click accidental podía borrar
// el piloto entero. Ahora:
//
//   - setupSheets() → requiere ser HEAD (email en Config!Heads)
//   - wipeTestData() → requiere HEAD + Script Property WIPE_CONFIRM=YES
//     (la prop se consume al ejecutarse — hay que volver a setearla
//     para correr otra vez. Token de uso único.)
//
// Las constantes SHEET_*, TASK_*, PROJ_*, CACHE_KEY y la función
// readConfig() viven en codigo.gs (Apps Script comparte global scope
// entre todos los .gs del proyecto).

// ── GATES ───────────────────────────────────────────────────────
// Verifica que el ejecutor está en Config!Heads. Tira error si no.
// Returns el email del ejecutor (lowercase) para logging.
function _requireAdminEmail() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) {
    throw new Error('No se pudo identificar tu email. Andá a Apps Script editor logueado con tu cuenta de Google.');
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var config = readConfig(ss);
  var headsRaw = (config && config.Heads) ? config.Heads.toString() : '';
  var heads = headsRaw.toLowerCase().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  if (heads.indexOf(email) < 0) {
    throw new Error('Sin permiso: solo HEAD puede ejecutar funciones de admin. Tu email (' + email + ') no está en Config!Heads.');
  }
  return email;
}

// Consume un token de confirmación one-shot guardado en Script Properties.
// Antes de correr wipeTestData hay que setear manualmente:
//   Apps Script editor → Project Settings → Script Properties
//   Add: key=WIPE_CONFIRM, value=YES
// Se borra al ejecutarse. Para correr de nuevo hay que volver a setearla.
function _requireWipeConfirmation() {
  var props = PropertiesService.getScriptProperties();
  var prop = props.getProperty('WIPE_CONFIRM');
  if (prop !== 'YES') {
    throw new Error(
      'wipeTestData es destructivo. Para correr:\n' +
      '  1. Apps Script editor → Project Settings → Script Properties\n' +
      '  2. Agregar key="WIPE_CONFIRM" value="YES"\n' +
      '  3. Volver acá y correr wipeTestData()\n' +
      'La property se consume al ejecutarse (uso único).'
    );
  }
  props.deleteProperty('WIPE_CONFIRM');
}

// ════════════════════════════════════════════════════════════════
// SETUP · ONE-SHOT SHEET INITIALIZATION
// ════════════════════════════════════════════════════════════════
// Crea/migra todas las hojas y columnas necesarias para activar
// features (digest, biz days, templates, conflict). Idempotente.
//
// Cómo correr: editor de Apps Script → dropdown de funciones →
// setupSheets → Run. Mirá Logger (View → Executions) para el reporte.
//
// Qué hace:
//   1. Crea hoja Feriados (cols pais|fecha|nombre) + 37 filas CO/MX/CR 2026
//   2. Crea hoja Templates (cols tipoTrabajo|checklist) + 3 samples
//   3. Agrega col 19 = 'Contraparte' en Tracking Activo (header row 3)
//   4. Agrega col 17 = 'ContrapartesConflicto' en Proyectos (header row 1)
//   5. Limpia caches (feriados_v1, templates_v1, tracker_data_v1)
//
// No sobreescribe datos existentes — si una hoja ya tiene rows o una
// columna ya tiene header distinto, lo loggea como WARNING y skipea.
function setupSheets() {
  var who = _requireAdminEmail();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var report = [];
  var log = function(msg) { report.push(msg); Logger.log(msg); };
  log('▶ setupSheets ejecutado por ' + who);

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
    tpl.getRange(1, 1, 1, 4).setValues([['tipoTrabajo', 'checklist', 'estado', 'autor']]);
    tpl.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#FF4940').setFontColor('#FFFFFF');
    tpl.setFrozenRows(1);
    tpl.setColumnWidth(1, 200);
    tpl.setColumnWidth(2, 600);
    tpl.setColumnWidth(3, 90);
    tpl.setColumnWidth(4, 160);
    log('✓ Hoja Templates creada (con headers: tipoTrabajo|checklist|estado|autor)');
  } else {
    log('· Hoja Templates ya existía');
  }
  // No se siembran plantillas de ejemplo: la Biblioteca arranca vacía y el
  // equipo crea las suyas desde la UI (Biblioteca → Nueva plantilla). Antes
  // se insertaban 3 samples que en producción se veían como "data inventada".
  log('· Templates: sin seed de ejemplo (la biblioteca arranca vacía)');

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
// Para correr (uso doblemente protegido):
//   1. Setear Script Property WIPE_CONFIRM=YES manualmente
//      (Project Settings → Script Properties → Add)
//   2. Ser HEAD (email en Config!Heads)
//   3. Editor de Apps Script → wipeTestData → Run
//
// La property WIPE_CONFIRM se consume al ejecutarse. Si querés correr
// de nuevo, hay que volver a setearla.
//
// IMPORTANTE: destructivo y SIN deshacer. Antes de correr, hacé una
// copia del sheet (Archivo → Hacer una copia).
function wipeTestData() {
  var who = _requireAdminEmail();
  _requireWipeConfirmation();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var report = [];
  var log = function(msg) { report.push(msg); Logger.log(msg); };
  log('▶ wipeTestData ejecutado por ' + who);

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
