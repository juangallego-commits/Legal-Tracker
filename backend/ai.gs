// ════════════════════════════════════════════════════════════════
// AI · Inteligencia sobre documentos (Gemini)
// ════════════════════════════════════════════════════════════════
// Módulo compartido de IA para features que van más allá del add-on de Gmail:
//   - Contract Intelligence: lee un PDF de contrato y extrae metadata
//     estructurada (partes, vigencia, vencimiento, penalidades, riesgos…).
//   - Recordatorios de vencimiento: crea una tarea de renovación a partir de
//     las fechas detectadas (con el notice period del contrato).
//   - Embeddings: vectores para búsqueda semántica en la Biblioteca (ver
//     funciones _aiEmbed* más abajo).
//
// Todo depende de Script Property GEMINI_API_KEY. Sin ella, las funciones
// devuelven un error accionable (NO_AI) y el resto de la app sigue intacta.
//
// Apps Script comparte global scope entre .gs: addTask, _getAuthContext,
// _readDocsFor, _authorizeTaskWrite, _telemetry, _err, SHEET_ID viven en
// codigo.gs y se usan acá directamente.
// ════════════════════════════════════════════════════════════════

var _AI_MODEL = 'gemini-2.5-flash';
var _AI_EMBED_MODEL = 'text-embedding-004';
var _AI_INSIGHTS_SHEET = 'ContractInsights';
var _AI_CONTRACT_MAX_BYTES = 15 * 1024 * 1024; // 15 MB de PDF para análisis inline

// ── Gemini · llamadas base ──────────────────────────────────────────
function _aiApiKey() {
  try { return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || ''; }
  catch (e) { return ''; }
}

// generateContent con responseMimeType JSON. `parts` es el array de partes
// (texto y/o inline_data). Devuelve el objeto parseado o null ante cualquier
// fallo (red, quota, HTTP !=200, JSON inválido) — el caller decide el fallback.
function _aiGenerateJSON(parts, gcfg) {
  var apiKey = _aiApiKey();
  if (!apiKey) return null;
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + _AI_MODEL
          + ':generateContent?key=' + encodeURIComponent(apiKey);
  var generationConfig = { responseMimeType: 'application/json' };
  if (gcfg) { for (var k in gcfg) { if (gcfg.hasOwnProperty(k)) generationConfig[k] = gcfg[k]; } }
  var resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ contents: [{ parts: parts }], generationConfig: generationConfig }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log('ai: fetch error · ' + ((e && e.message) || e)); return null; }
  if (resp.getResponseCode() !== 200) {
    Logger.log('ai: HTTP ' + resp.getResponseCode() + ' · ' + resp.getContentText().slice(0, 300));
    return null;
  }
  var json; try { json = JSON.parse(resp.getContentText()); } catch (e) { return null; }
  var text = ''; try { text = json.candidates[0].content.parts[0].text || ''; } catch (e) {}
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

// ── Contract Intelligence ───────────────────────────────────────────
// Lee un PDF ya subido (vinculado a una tarea/proyecto), lo manda a Gemini y
// guarda los insights estructurados. Reusa _readDocsFor para localizar el doc y
// _authorizeTaskWrite/_authorizeProjectWrite para el permiso por rol.
function analyzeContractDoc(kind, itemId, docId) {
  return _telemetry('analyzeContractDoc', function() {
    var ctx = _getAuthContext();
    var info = _readDocsFor(kind, itemId);
    if (!info) return _err('NOT_FOUND', (kind === 'project' ? 'Proyecto' : 'Tarea') + ' no encontrado.');
    if (kind === 'task') _authorizeTaskWrite(ctx, info.target);
    else _authorizeProjectWrite(ctx, info.target);

    if (!_aiApiKey()) return _err('NO_AI', 'Falta configurar GEMINI_API_KEY para usar la IA.');

    var doc = _aiFindDoc(info.docs, docId);
    if (!doc || !doc.id) return _err('NOT_FOUND', 'Documento no encontrado, o es un enlace externo (solo analizo PDFs subidos a Drive).');

    var file;
    try { file = DriveApp.getFileById(doc.id); } catch (e) { return _err('NOT_FOUND', 'No pude abrir el archivo en Drive.'); }
    if (file.getMimeType() !== 'application/pdf') {
      return _err('VALIDATION', 'Por ahora solo analizo PDFs. Este archivo es ' + file.getMimeType() + '.');
    }
    var bytes = file.getBlob().getBytes();
    if (bytes.length > _AI_CONTRACT_MAX_BYTES) {
      return _err('VALIDATION', 'El PDF es muy grande para análisis inline (máx. 15 MB).');
    }

    var out = _aiGenerateJSON([
      { text: _aiContractPrompt() },
      { inline_data: { mime_type: 'application/pdf', data: Utilities.base64Encode(bytes) } }
    ], { temperature: 0.1, maxOutputTokens: 2048 });
    if (!out) return _err('AI_FAIL', 'La IA no pudo analizar el documento. Reintentá en un momento.');

    var clean = _aiValidateContract(out);
    _aiStoreInsights(ctx, kind, itemId, doc, clean);
    return { success: true, insights: clean, docId: doc.id, docName: doc.name };
  }, { kind: kind, itemId: itemId });
}

function _aiFindDoc(docs, docId) {
  docs = docs || [];
  for (var i = 0; i < docs.length; i++) {
    if (String(docs[i].id) === String(docId)) return docs[i];
    if (docs[i].url && String(docs[i].url).indexOf(docId) >= 0) return docs[i];
  }
  return null;
}

function _aiContractPrompt() {
  var today = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  return ''
    + 'Sos un abogado senior del equipo legal de Rappi. Analizá el contrato adjunto (PDF) y '
    + 'extraé su información clave. Devolvé JSON estricto (sin markdown) con estos campos:\n\n'
    + '{\n'
    + '  "tipoContrato": "ej. NDA bilateral, contrato de prestación de servicios, MOU…",\n'
    + '  "partes": ["nombre de cada parte, ej. Rappi LATAM, McDonald\'s Brasil"],\n'
    + '  "objeto": "1 frase: de qué se trata el contrato",\n'
    + '  "vigenciaTexto": "vigencia tal como aparece, ej. 24 meses desde la firma",\n'
    + '  "fechaInicio": "yyyy-MM-dd o \\"\\" si no es claro",\n'
    + '  "fechaVencimiento": "yyyy-MM-dd o \\"\\" si no es claro o es indefinido",\n'
    + '  "autoRenovacion": true|false,\n'
    + '  "noticePeriodDias": número de días de pre-aviso para no renovar, o null,\n'
    + '  "jurisdiccion": "ley aplicable / foro, o \\"\\"",\n'
    + '  "penalidades": "multas/cláusula penal relevante, o \\"\\"",\n'
    + '  "exclusividad": true|false,\n'
    + '  "montos": "valores económicos clave mencionados, o \\"\\"",\n'
    + '  "obligacionesClave": ["obligaciones principales de Rappi (máx 4)"],\n'
    + '  "riesgos": ["banderas rojas para el equipo legal, cada una empezando con un riesgo concreto (máx 4)"],\n'
    + '  "resumen": "2-3 frases ejecutivas en español"\n'
    + '}\n\n'
    + 'Reglas:\n'
    + '- No inventes. Si un dato no está, devolvé "" / null / [].\n'
    + '- Fechas en yyyy-MM-dd. Si el contrato dice "vence a los 24 meses de la firma" y hay fecha de firma, calculá fechaVencimiento.\n'
    + '- Hoy es ' + today + ' (para resolver fechas relativas).\n'
    + '- "riesgos": pensá como abogado — auto-renovación sin aviso, falta de cap de indemnización, exclusividad amplia, jurisdicción desfavorable, etc.\n'
    + '- Todo el texto en español.';
}

function _aiValidateContract(out) {
  if (!out || typeof out !== 'object') return null;
  function str(v, n) { return (v == null ? '' : v.toString()).trim().slice(0, n || 300); }
  function arr(v, n) {
    if (!Array.isArray(v)) return [];
    return v.map(function(x) { return str(x, 200); }).filter(Boolean).slice(0, n || 6);
  }
  var iso = /^\d{4}-\d{2}-\d{2}$/;
  var notice = parseInt(out.noticePeriodDias, 10);
  return {
    tipoContrato:     str(out.tipoContrato, 120),
    partes:           arr(out.partes, 6),
    objeto:           str(out.objeto, 300),
    vigenciaTexto:    str(out.vigenciaTexto, 200),
    fechaInicio:      iso.test(out.fechaInicio || '') ? out.fechaInicio : '',
    fechaVencimiento: iso.test(out.fechaVencimiento || '') ? out.fechaVencimiento : '',
    autoRenovacion:   out.autoRenovacion === true,
    noticePeriodDias: isNaN(notice) ? null : notice,
    jurisdiccion:     str(out.jurisdiccion, 120),
    penalidades:      str(out.penalidades, 300),
    exclusividad:     out.exclusividad === true,
    montos:           str(out.montos, 200),
    obligacionesClave: arr(out.obligacionesClave, 4),
    riesgos:          arr(out.riesgos, 4),
    resumen:          str(out.resumen, 600)
  };
}

// ── Persistencia de insights ────────────────────────────────────────
function _aiInsightsSheet(ss) {
  var ws = ss.getSheetByName(_AI_INSIGHTS_SHEET);
  if (!ws) {
    ws = ss.insertSheet(_AI_INSIGHTS_SHEET);
    ws.getRange(1, 1, 1, 8).setValues([['itemKind', 'itemId', 'docId', 'docName', 'vencimiento', 'analyzedBy', 'analyzedAt', 'json']]);
    ws.getRange(1, 1, 1, 8).setFontWeight('bold');
    ws.setFrozenRows(1);
  }
  return ws;
}

// Upsert por (itemId, docId): re-analizar un doc reemplaza su fila.
function _aiStoreInsights(ctx, kind, itemId, doc, clean) {
  var ws = _aiInsightsSheet(ctx.ss);
  var lr = ws.getLastRow();
  var rowIdx = -1;
  if (lr >= 2) {
    var keys = ws.getRange(2, 2, lr - 1, 2).getValues(); // itemId, docId
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(itemId) && String(keys[i][1]) === String(doc.id)) { rowIdx = i + 2; break; }
    }
  }
  var row = [kind, itemId, doc.id, doc.name || '', clean.fechaVencimiento || '',
             (ctx.user && ctx.user.name) || ctx.email || '', new Date().toISOString(), JSON.stringify(clean)];
  if (rowIdx > 0) ws.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  else ws.appendRow(row);
}

// Lee los insights guardados de un item (para mostrar en el panel sin re-analizar).
function getContractInsights(kind, itemId) {
  return _telemetry('getContractInsights', function() {
    var ctx = _getAuthContext();
    var ws = ctx.ss.getSheetByName(_AI_INSIGHTS_SHEET);
    if (!ws) return { items: [] };
    var lr = ws.getLastRow();
    if (lr < 2) return { items: [] };
    var data = ws.getRange(2, 1, lr - 1, 8).getValues();
    var out = [];
    data.forEach(function(r) {
      if (String(r[1]) !== String(itemId)) return;
      var parsed = null; try { parsed = JSON.parse(r[7]); } catch (e) {}
      if (parsed) out.push({ docId: r[2], docName: r[3], analyzedBy: r[5], analyzedAt: r[6], insights: parsed });
    });
    return { items: out };
  }, { itemId: itemId });
}

// ── Recordatorios de vencimiento (Sprint 2) ─────────────────────────
// Crea una tarea de renovación a partir del vencimiento detectado por la IA.
// El deadline del recordatorio = vencimiento − noticePeriod (default 30 días),
// con piso en hoy (no creamos recordatorios en el pasado).
function createRenewalReminder(kind, itemId, docId) {
  return _telemetry('createRenewalReminder', function() {
    var ctx = _getAuthContext();
    var ws = ctx.ss.getSheetByName(_AI_INSIGHTS_SHEET);
    if (!ws) return _err('NOT_FOUND', 'No hay análisis guardado para este documento.');
    var lr = ws.getLastRow();
    if (lr < 2) return _err('NOT_FOUND', 'No hay análisis guardado.');
    var data = ws.getRange(2, 1, lr - 1, 8).getValues();
    var clean = null, docName = '';
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][1]) === String(itemId) && String(data[i][2]) === String(docId)) {
        try { clean = JSON.parse(data[i][7]); } catch (e) {}
        docName = data[i][3];
        break;
      }
    }
    if (!clean) return _err('NOT_FOUND', 'Análisis no encontrado para ese documento.');
    if (!clean.fechaVencimiento) return _err('VALIDATION', 'El contrato no tiene fecha de vencimiento detectada.');

    var notice = (typeof clean.noticePeriodDias === 'number' && clean.noticePeriodDias > 0) ? clean.noticePeriodDias : 30;
    var venc = new Date(clean.fechaVencimiento + 'T00:00:00Z');
    var remind = new Date(venc.getTime() - notice * 24 * 60 * 60 * 1000);
    var todayUtc = new Date(Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd') + 'T00:00:00Z');
    if (remind.getTime() < todayUtc.getTime()) remind = todayUtc;
    var remindStr = Utilities.formatDate(remind, 'GMT', 'yyyy-MM-dd');

    var partesTxt = (clean.partes && clean.partes.length) ? clean.partes.join(' / ') : (docName || 'contrato');
    var nombre = 'Vencimiento/renovación: ' + partesTxt;
    var notas = 'Recordatorio auto-generado por análisis de contrato.\n'
      + '- Documento: ' + (docName || '') + '\n'
      + '- Vence: ' + clean.fechaVencimiento + (clean.autoRenovacion ? ' (auto-renovación)' : '') + '\n'
      + '- Pre-aviso: ' + notice + ' días\n'
      + (clean.resumen ? '- Resumen: ' + clean.resumen : '');

    var res = addTask({
      nombre: nombre.slice(0, 120),
      deadline: remindStr,
      priority: 'Alta',
      tipoTrabajo: 'Contractual',
      riesgo: 'Legal',
      resp: ctx.user.name,
      notas: notas
    });
    if (res && res.success) return { success: true, id: res.id, deadline: remindStr };
    return res || _err('BACKEND_ERROR', 'No se pudo crear el recordatorio.');
  }, { kind: kind, itemId: itemId });
}
