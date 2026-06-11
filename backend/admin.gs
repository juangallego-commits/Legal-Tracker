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
// CLEAR SAMPLE TEMPLATES · one-shot
// ════════════════════════════════════════════════════════════════
// Borra las 3 plantillas de ejemplo que el setupSheets viejo sembraba
// (Revisión NDA / Revisión contractual / Derecho de petición) y que en
// producción se ven como "data inventada". Gated por HEAD. Idempotente:
// correrla de nuevo no hace nada si ya no están.
// Cómo correr: editor de Apps Script → dropdown → clearSampleTemplates → Run.
function clearSampleTemplates() {
  var who = _requireAdminEmail();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var ws = ss.getSheetByName(SHEET_TEMPLATES);
  if (!ws) { Logger.log('clearSampleTemplates: no existe la hoja Templates.'); return; }
  var samples = ['Revisión NDA', 'Revisión contractual', 'Derecho de petición'];
  var lr = ws.getLastRow();
  if (lr < 2) { Logger.log('clearSampleTemplates: Templates vacía, nada que borrar.'); return; }
  var data = ws.getRange(2, 1, lr - 1, 1).getValues();
  var removed = 0;
  for (var i = data.length - 1; i >= 0; i--) { // bottom-up para no desplazar índices
    if (samples.indexOf((data[i][0] || '').toString().trim()) >= 0) { ws.deleteRow(i + 2); removed++; }
  }
  try { CacheService.getScriptCache().remove('templates_v1'); } catch (e) {}
  Logger.log('clearSampleTemplates por ' + who + ': ' + removed + ' fila(s) de ejemplo borradas.');
}

// ════════════════════════════════════════════════════════════════
// INSTALL DIGEST TRIGGER · one-shot
// ════════════════════════════════════════════════════════════════
// El digest "no funcionaba" porque (a) faltaba declarar el scope de envío de
// mail (ya agregado en appsscript.json) y (b) el trigger time-based hay que
// crearlo a mano. Esto crea/reinstala el trigger diario a las 8am (hora del
// proyecto, America/Bogota). Gated por HEAD. Idempotente: borra triggers
// previos de sendDailyDigest para no duplicar.
// IMPORTANTE: tras el deploy con el nuevo scope, hay que RE-AUTORIZAR la app
// (correr cualquier función desde el editor dispara el prompt de permisos).
function installDigestTrigger() {
  var who = _requireAdminEmail();
  var removed = 0;
  // Remover triggers de AMBOS sistemas de digest (sendDailyDigest = este;
  // sendDailyDigests = el de "Tu día"). Evita que coexistan dos triggers y cada
  // persona reciba dos emails distintos. Solo debe haber UN digest diario activo.
  ScriptApp.getProjectTriggers().forEach(function(tg) {
    var h = tg.getHandlerFunction();
    if (h === 'sendDailyDigest' || h === 'sendDailyDigests') { ScriptApp.deleteTrigger(tg); removed++; }
  });
  ScriptApp.newTrigger('sendDailyDigests').timeBased().everyDays(1).atHour(8).create();
  Logger.log('installDigestTrigger por ' + who + ': ' + removed + ' trigger(s) viejo(s) borrado(s) · 1 nuevo: sendDailyDigests (diario ~8am).');
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

  // ── 3b. Tracking Activo: col 20 = AreaSolicitante (cliente interno, header row 3) ──
  if (tk) {
    var lastColAs = tk.getLastColumn();
    var hdrAs = lastColAs >= TASK_AREASOL_COL ? tk.getRange(3, TASK_AREASOL_COL).getValue() : '';
    if (!hdrAs) {
      tk.getRange(3, TASK_AREASOL_COL).setValue('AreaSolicitante');
      tk.getRange(3, TASK_AREASOL_COL).setFontWeight('bold');
      log('✓ Tracking Activo: agregada columna ' + TASK_AREASOL_COL + ' = AreaSolicitante (row 3)');
    } else if (hdrAs === 'AreaSolicitante') {
      log('· Tracking Activo ya tenía columna AreaSolicitante');
    } else {
      log('⚠ Tracking Activo col ' + TASK_AREASOL_COL + ' tiene "' + hdrAs + '" — revisión manual');
    }
  }

  // ── 3c. Tracking Activo: col 21 = Colaboradores (JSON [{name,role}], header row 3) ──
  if (tk) {
    var lastColCb = tk.getLastColumn();
    var hdrCb = lastColCb >= TASK_COLAB_COL ? tk.getRange(3, TASK_COLAB_COL).getValue() : '';
    if (!hdrCb) {
      tk.getRange(3, TASK_COLAB_COL).setValue('Colaboradores');
      tk.getRange(3, TASK_COLAB_COL).setFontWeight('bold');
      log('✓ Tracking Activo: agregada columna ' + TASK_COLAB_COL + ' = Colaboradores (row 3)');
    } else if (hdrCb === 'Colaboradores') {
      log('· Tracking Activo ya tenía columna Colaboradores');
    } else {
      log('⚠ Tracking Activo col ' + TASK_COLAB_COL + ' tiene "' + hdrCb + '" — revisión manual');
    }
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

// ════════════════════════════════════════════════════════════════
// MIGRAR RECURSOS · FASE B (hub Recursos R0)
// ════════════════════════════════════════════════════════════════
// Migración de schema del hub Recursos. Idempotente. Gated por HEAD.
//
// Cómo correr: editor de Apps Script → dropdown → migrarRecursosFaseB
// → Run. Mirá Logger (View → Executions) para el reporte.
//
// Qué hace:
//   1. Recursos: extiende el header de 8 → 14 cols (agrega tipo, tags,
//      destacado, clicks, area, requierePago). Para las filas de data
//      existentes setea defaults en BATCH (tags hereda el valor de la
//      col 4 = categoria). Si ya tiene 14+ cols → skip.
//   2. Crea hoja Favoritos (cols email|recursoId|fecha) si no existe.
//
// Auto-contenida: solo usa SpreadsheetApp, SHEET_RECURSOS y
// _requireAdminEmail — no llama helpers de Recursos de codigo.gs.
function migrarRecursosFaseB() {
  var who = _requireAdminEmail();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var report = [];
  var log = function(msg) { report.push(msg); Logger.log(msg); };
  log('▶ migrarRecursosFaseB ejecutado por ' + who);

  // ── 1. Recursos: extender header 8 → 14 cols ────────────────────
  var TARGET_HDR = ['id', 'titulo', 'url', 'categoria', 'descripcion', 'autor', 'autorEmail', 'fecha', 'tipo', 'tags', 'destacado', 'clicks', 'area', 'requierePago'];
  var rec = ss.getSheetByName(SHEET_RECURSOS);
  if (!rec) {
    log('⚠ Hoja Recursos no encontrada — skip migración de columnas');
  } else {
    var lastCol = rec.getLastColumn();
    var curHdr = lastCol > 0 ? rec.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    if (curHdr.length >= TARGET_HDR.length) {
      log('· Recursos: ya migrado (' + curHdr.length + ' cols), skip');
    } else {
      var firstNew = curHdr.length; // índice 0-based de la primera col faltante
      var missing = TARGET_HDR.slice(firstNew);
      // Agregar los headers faltantes AL FINAL (fila 1, un solo setValues).
      rec.getRange(1, firstNew + 1, 1, missing.length).setValues([missing]);
      rec.getRange(1, firstNew + 1, 1, missing.length).setFontWeight('bold');
      log('✓ Recursos: agregados ' + missing.length + ' headers [' + missing.join(', ') + ']');

      // Defaults para las filas de data existentes, en BATCH.
      var lastRow = rec.getLastRow();
      if (lastRow >= 2) {
        var numRows = lastRow - 1;
        // Necesitamos la col 4 (categoria) de cada fila para poblar tags.
        var cats = rec.getRange(2, 4, numRows, 1).getValues();
        // Plantilla de defaults indexada por nombre de columna, para respetar
        // el orden exacto incluso si firstNew no fuese 8.
        var defByName = { tipo: '', tags: '', destacado: false, clicks: 0, area: '', requierePago: false };
        var fill = [];
        for (var r = 0; r < numRows; r++) {
          var rowVals = [];
          for (var c = 0; c < missing.length; c++) {
            var name = missing[c];
            rowVals.push(name === 'tags' ? cats[r][0] : defByName[name]);
          }
          fill.push(rowVals);
        }
        rec.getRange(2, firstNew + 1, numRows, missing.length).setValues(fill);
        log('✓ Recursos: defaults seteados en ' + numRows + ' fila(s) (tags ← categoria)');
      } else {
        log('· Recursos: sin filas de data, solo headers');
      }
    }
  }

  // ── 2. Favoritos: crear hoja si no existe ───────────────────────
  var fav = ss.getSheetByName('Favoritos');
  if (!fav) {
    fav = ss.insertSheet('Favoritos');
    fav.getRange(1, 1, 1, 3).setValues([['email', 'recursoId', 'fecha']]);
    fav.getRange(1, 1, 1, 3).setFontWeight('bold');
    fav.setFrozenRows(1);
    log('✓ Hoja Favoritos creada (headers: email|recursoId|fecha)');
  } else {
    log('· Hoja Favoritos ya existía — skip');
  }

  log('—— migrarRecursosFaseB terminó ——');
  return report;
}

// ════════════════════════════════════════════════════════════════
// MIGRAR COLABORADORES · col 21 en Tracking Activo (Fase 1)
// ════════════════════════════════════════════════════════════════
// Agrega la columna 21 = 'Colaboradores' (JSON [{name,role}]) a Tracking Activo.
// Idempotente. Gated por HEAD. Las celdas existentes quedan vacías → readTasks
// defaultea a [] (sin colaboradores). El CRUD (setTaskColaboradores) avisa si la
// columna falta; esto la crea.
//
// Cómo correr: editor de Apps Script → dropdown → migrarColaboradores → Run.
// Mirá Logger (View → Executions) para el reporte.
//
// El header de Tracking Activo va en la FILA 3 (igual que Contraparte col 19 y
// AreaSolicitante col 20 — ver setupSheets). Auto-contenida: solo usa
// SpreadsheetApp, SHEET_ACTIVO, TASK_COLAB_COL y _requireAdminEmail.
function migrarColaboradores() {
  var who = _requireAdminEmail();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var report = [];
  var log = function(msg) { report.push(msg); Logger.log(msg); };
  log('▶ migrarColaboradores ejecutado por ' + who);

  var tk = ss.getSheetByName(SHEET_ACTIVO);
  if (!tk) {
    log('⚠ Hoja Tracking Activo no encontrada — nada que migrar');
    log('—— migrarColaboradores terminó ——');
    return report;
  }

  var lastCol = tk.getLastColumn();
  // Idempotente: si ya tiene >=21 cols, leer el header existente y decidir.
  var hdr = lastCol >= TASK_COLAB_COL ? (tk.getRange(3, TASK_COLAB_COL).getValue() || '').toString().trim() : '';
  if (!hdr) {
    tk.getRange(3, TASK_COLAB_COL).setValue('Colaboradores');
    tk.getRange(3, TASK_COLAB_COL).setFontWeight('bold');
    log('✓ Tracking Activo: agregada columna ' + TASK_COLAB_COL + ' = Colaboradores (row 3). Celdas existentes quedan vacías → [].');
  } else if (hdr === 'Colaboradores') {
    log('· Tracking Activo ya tenía columna Colaboradores (col ' + TASK_COLAB_COL + ') — skip');
  } else {
    log('⚠ Tracking Activo col ' + TASK_COLAB_COL + ' tiene "' + hdr + '" — revisión manual (NO se sobreescribe)');
  }

  // Flush cache para que el siguiente lector vea la columna nueva.
  try {
    CacheService.getScriptCache().remove(CACHE_KEY);
    log('✓ Cache invalidada (' + CACHE_KEY + ')');
  } catch (e) {
    log('⚠ Cache flush falló: ' + e.message);
  }

  log('—— migrarColaboradores terminó ——');
  return report;
}

// ════════════════════════════════════════════════════════════════
// TIDY SHEETS · ordena el spreadsheet para humanos
// ════════════════════════════════════════════════════════════════
// El spreadsheet acumuló ~15 hojas y la mayoría son TABLAS INTERNAS de la
// app (auto-creadas, leídas/escritas por código) que nadie debería tocar a
// mano. No se pueden fusionar sin reescribir la app (cada una es una tabla
// de la "DB"), pero sí se pueden OCULTAR: getSheetByName() las sigue
// encontrando igual. Esta función deja visible solo lo que se gestiona a
// mano y ordena las visibles en orden de uso. Idempotente y reversible
// (clic derecho → Mostrar hoja, o volver a correrla tras crear hojas nuevas).
// Gated por HEAD. NO borra ninguna hoja ni toca data.
function tidySheets() {
  var who = _requireAdminEmail();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  // Visibles, en este orden: las que un humano consulta/edita.
  var VISIBLE_ORDER = [
    SHEET_ACTIVO,      // la operación diaria
    SHEET_HISTORIAL,   // cerradas (consulta)
    SHEET_PROYECTOS,   // proyectos (consulta)
    SHEET_EQUIPOS,     // roster + allowlist (se edita a mano)
    SHEET_CONFIG,      // configuración (se edita a mano)
    SHEET_FERIADOS     // feriados por país (se edita a mano)
  ];
  // Técnicas/auto-gestionadas: la app las administra; ocultas no molestan.
  var HIDE = [
    SHEET_COMMENTS, SHEET_ACTIVITY, SHEET_TEMPLATES, SHEET_BIBLIO_DOCS,
    SHEET_RECURSOS, SHEET_INTEGRACIONES, '_Embeddings', 'Feedback', 'Telemetry'
  ];
  var report = [];
  HIDE.forEach(function(name) {
    var ws = ss.getSheetByName(name);
    if (!ws) { report.push('· ' + name + ': no existe — skip'); return; }
    if (ws.isSheetHidden()) { report.push('· ' + name + ': ya oculta'); return; }
    try { ws.hideSheet(); report.push('✓ ' + name + ': oculta'); }
    catch (e) { report.push('⚠ ' + name + ': no se pudo ocultar (' + e.message + ')'); }
  });
  // Mostrar + ordenar las core al frente (posiciones 1..n).
  VISIBLE_ORDER.forEach(function(name, i) {
    var ws = ss.getSheetByName(name);
    if (!ws) { report.push('⚠ ' + name + ': no existe'); return; }
    try {
      if (ws.isSheetHidden()) ws.showSheet();
      ss.setActiveSheet(ws);
      ss.moveActiveSheet(i + 1);
      report.push('✓ ' + name + ': visible en posición ' + (i + 1));
    } catch (e) { report.push('⚠ ' + name + ': ' + e.message); }
  });
  var out = 'tidySheets por ' + who + ':\n' + report.join('\n');
  Logger.log(out);
  return out;
}

// ════════════════════════════════════════════════════════════════
// MIGRAR BLOCKED-SINCE · col 22 de Tracking Activo (one-shot, idempotente)
// ════════════════════════════════════════════════════════════════
// Agrega el header 'BlockedSince' (col 22, fila 3 — mismo layout que
// Colaboradores) y rellena el sello de las tareas YA bloqueadas buscando su
// último cambio a 'Bloqueado' en la hoja Activity. Si una bloqueada no tiene
// evento en Activity, queda vacía (la UI muestra ⏸ sin antigüedad — no
// inventamos fechas). Gated por HEAD. Re-correrla no pisa sellos existentes.
function migrarBlockedSince() {
  var who = _requireAdminEmail();
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var report = [];
  function log(m) { report.push(m); Logger.log(m); }
  var tk = ss.getSheetByName(SHEET_ACTIVO);
  if (!tk) throw new Error('No existe la hoja ' + SHEET_ACTIVO);

  // 1) Header col 22 (fila 3, como las demás columnas opcionales).
  var hdr = (tk.getRange(3, TASK_BLOCKED_COL).getValue() || '').toString().trim();
  if (!hdr) {
    tk.getRange(3, TASK_BLOCKED_COL).setValue('BlockedSince');
    tk.getRange(3, TASK_BLOCKED_COL).setFontWeight('bold');
    log('✓ Tracking Activo: agregada columna ' + TASK_BLOCKED_COL + ' = BlockedSince (row 3).');
  } else if (hdr === 'BlockedSince') {
    log('· Columna BlockedSince ya existía — skip header');
  } else {
    throw new Error('La col ' + TASK_BLOCKED_COL + ' tiene "' + hdr + '" — revisión manual, NO se sobreescribe.');
  }

  // 2) Backfill: último cambio a 'Bloqueado' por tarea, desde Activity.
  var lastBlock = {};
  var act = ss.getSheetByName(SHEET_ACTIVITY);
  if (act && act.getLastRow() >= 2) {
    // cols: id, ts, task_id, author_email, author_name, action, field, old, new
    var rows = act.getRange(2, 1, act.getLastRow() - 1, 9).getValues();
    rows.forEach(function(r) {
      if ((r[8] || '').toString().trim() !== 'Bloqueado') return;
      var ts = r[1] instanceof Date ? r[1] : new Date(r[1]);
      if (isNaN(ts.getTime())) return;
      var tid = String(r[2]);
      if (!lastBlock[tid] || ts > lastBlock[tid]) lastBlock[tid] = ts;
    });
  } else {
    log('· Hoja Activity vacía o inexistente — sin backfill');
  }

  var lr = tk.getLastRow();
  var sellados = 0, sinEvento = 0;
  if (lr >= 4) {
    var data = tk.getRange(4, 1, lr - 3, TASK_BLOCKED_COL).getValues();
    var lock = LockService.getScriptLock();
    try { lock.waitLock(10000); } catch (e) { throw new Error('Servidor ocupado, reintentá.'); }
    try {
      for (var i = 0; i < data.length; i++) {
        if ((data[i][6] || '').toString().trim() !== 'Bloqueado') continue; // col 7 = status
        if (data[i][TASK_BLOCKED_COL - 1]) continue; // ya sellada — idempotente
        var hit = lastBlock[String(data[i][0])];
        if (hit) { tk.getRange(i + 4, TASK_BLOCKED_COL).setValue(hit); sellados++; }
        else sinEvento++;
      }
    } finally { lock.releaseLock(); }
  }
  log('✓ Backfill: ' + sellados + ' bloqueada(s) selladas desde Activity; ' + sinEvento + ' sin evento (quedan sin antigüedad).');
  try { CacheService.getScriptCache().remove(CACHE_KEY); log('✓ Cache invalidada'); } catch (e) {}
  log('—— migrarBlockedSince terminó (por ' + who + ') ——');
  return report.join('\n');
}
