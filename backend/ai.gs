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

// Motivo del último fallo de IA (para devolverlo en el error en vez de tragarlo).
var _AI_LAST_ERROR = '';

// ── Gemini · llamadas base ──────────────────────────────────────────
function _aiApiKey() {
  try { return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || ''; }
  catch (e) { return ''; }
}

// generateContent con responseMimeType JSON. `parts` es el array de partes
// (texto y/o inline_data). Devuelve el objeto parseado o null ante cualquier
// fallo (red, quota, HTTP !=200, JSON inválido) — el caller decide el fallback.
function _aiGenerateJSON(parts, gcfg) {
  _AI_LAST_ERROR = '';
  var apiKey = _aiApiKey();
  if (!apiKey) { _AI_LAST_ERROR = 'sin GEMINI_API_KEY'; return null; }
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + _AI_MODEL
          + ':generateContent?key=' + encodeURIComponent(apiKey);
  var generationConfig = { responseMimeType: 'application/json' };
  if (gcfg) { for (var k in gcfg) { if (gcfg.hasOwnProperty(k)) generationConfig[k] = gcfg[k]; } }
  // Reintentos con backoff para errores transitorios (503 sobrecarga / 429 rate
  // limit / 500). Los 4xx de key/modelo no se reintentan.
  var resp = null, code = 0, body = JSON.stringify({ contents: [{ parts: parts }], generationConfig: generationConfig });
  var delays = [0, 1000, 2500];
  for (var attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) Utilities.sleep(delays[attempt]);
    try {
      resp = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: body, muteHttpExceptions: true });
    } catch (e) { _AI_LAST_ERROR = 'fetch: ' + ((e && e.message) || e); Logger.log('ai: ' + _AI_LAST_ERROR); return null; }
    code = resp.getResponseCode();
    if (code === 200) break;
    // Reintentamos solo 503/500 (transitorios de servidor). El 429 (cuota/rate
    // del free tier) no se resuelve en segundos → fallar rápido con mensaje claro.
    if (code !== 503 && code !== 500) break;
  }
  if (code !== 200) {
    _AI_LAST_ERROR = (code === 429)
      ? 'cuota de Gemini agotada (free tier) — esperá unos minutos o revisá tu plan en ai.google.dev · HTTP 429'
      : 'HTTP ' + code + ' · ' + resp.getContentText().slice(0, 200)
        + (code === 503 ? ' (sobrecarga temporal, reintentá)' : '');
    Logger.log('ai: ' + _AI_LAST_ERROR);
    return null;
  }
  var json; try { json = JSON.parse(resp.getContentText()); } catch (e) { _AI_LAST_ERROR = 'respuesta no-JSON'; return null; }
  var cand = (json.candidates && json.candidates[0]) || {};
  var text = ''; try { text = cand.content.parts[0].text || ''; } catch (e) {}
  if (!text) { _AI_LAST_ERROR = 'sin texto (finishReason: ' + (cand.finishReason || '?') + ')'; return null; }
  // Tolera fences ```json ... ``` o texto alrededor; último recurso, primer {...}.
  var s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(s); } catch (e) {}
  var m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
  _AI_LAST_ERROR = 'JSON inválido (finishReason: ' + (cand.finishReason || '?') + '): ' + text.slice(0, 100);
  return null;
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
    ], { temperature: 0.1, maxOutputTokens: 4096 });
    if (!out) return _err('AI_FAIL', 'La IA no pudo analizar: ' + (_AI_LAST_ERROR || 'motivo desconocido'));

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

// ── Embeddings · búsqueda semántica en Biblioteca (Sprint 3) ────────
// Generamos un vector por documento (de su metadata) y lo guardamos en la hoja
// oculta _Embeddings. Al buscar, embeddeamos el query y rankeamos por similitud
// coseno. Todo best-effort: sin API key, los hooks no hacen nada y la búsqueda
// por texto (substring) sigue funcionando.

var _AI_EMBED_SHEET = '_Embeddings';

// Texto representativo de un doc de biblioteca para embeddear.
function _aiBiblioText(d) {
  return [d.nombre, d.tags, d.notas, d.tipoDocumento, d.areaTrabajo, d.areaSolicitante, d.pais]
    .filter(Boolean).join(' · ');
}

function _aiEmbed(text) {
  if (!_aiApiKey() || !text) return null;
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + _AI_EMBED_MODEL
          + ':embedContent?key=' + encodeURIComponent(_aiApiKey());
  var resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ model: 'models/' + _AI_EMBED_MODEL, content: { parts: [{ text: String(text).slice(0, 8000) }] } }),
      muteHttpExceptions: true
    });
  } catch (e) { Logger.log('embed: fetch error · ' + e); return null; }
  if (resp.getResponseCode() !== 200) { Logger.log('embed: HTTP ' + resp.getResponseCode() + ' · ' + resp.getContentText().slice(0, 200)); return null; }
  var json; try { json = JSON.parse(resp.getContentText()); } catch (e) { return null; }
  try { return json.embedding.values; } catch (e) { return null; }
}

function _aiEmbedSheet(ss) {
  var ws = ss.getSheetByName(_AI_EMBED_SHEET);
  if (!ws) {
    ws = ss.insertSheet(_AI_EMBED_SHEET);
    ws.getRange(1, 1, 1, 3).setValues([['docId', 'text', 'vector']]);
    ws.getRange(1, 1, 1, 3).setFontWeight('bold');
    try { ws.hideSheet(); } catch (e) {}
  }
  return ws;
}

// Embeddea y guarda (upsert por docId). Best-effort: nunca tira.
function _aiUpsertEmbedding(ss, docId, text) {
  try {
    var vec = _aiEmbed(text);
    if (!vec) return false;
    var ws = _aiEmbedSheet(ss);
    var lr = ws.getLastRow();
    var rowIdx = -1;
    if (lr >= 2) {
      var ids = ws.getRange(2, 1, lr - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) { if (String(ids[i][0]) === String(docId)) { rowIdx = i + 2; break; } }
    }
    var row = [docId, String(text).slice(0, 2000), JSON.stringify(vec)];
    if (rowIdx > 0) ws.getRange(rowIdx, 1, 1, 3).setValues([row]);
    else ws.appendRow(row);
    return true;
  } catch (e) { Logger.log('upsertEmbedding: ' + e); return false; }
}

function _aiCosine(a, b) {
  var dot = 0, na = 0, nb = 0, n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Búsqueda semántica: devuelve docIds rankeados por relevancia al query.
function semanticSearchBiblioteca(query) {
  return _telemetry('semanticSearchBiblioteca', function() {
    _getAuthContext(); // valida acceso
    if (!_aiApiKey()) return _err('NO_AI', 'Falta configurar GEMINI_API_KEY para búsqueda semántica.');
    var q = (query || '').toString().trim();
    if (!q) return { ids: [] };
    var qv = _aiEmbed(q);
    if (!qv) return _err('AI_FAIL', 'No pude procesar la búsqueda. Reintentá.');
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var ws = ss.getSheetByName(_AI_EMBED_SHEET);
    if (!ws) return { ids: [] };
    var lr = ws.getLastRow();
    if (lr < 2) return { ids: [] };
    var data = ws.getRange(2, 1, lr - 1, 3).getValues();
    var scored = [];
    data.forEach(function(r) {
      var vec = null; try { vec = JSON.parse(r[2]); } catch (e) {}
      if (vec) scored.push({ id: String(r[0]), score: _aiCosine(qv, vec) });
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    var top = scored.filter(function(s) { return s.score > 0.45; }).slice(0, 25);
    // Filtro server-side por rol/confidencialidad: la hoja de embeddings cubre
    // TODOS los docs, así que sin esta intersección el endpoint le enumeraba a
    // cualquier usuario los ids (con ranking) de documentos que
    // getBibliotecaDocs jamás le mostraría. El frontend ya intersectaba con su
    // cache filtrado, pero la regla de confidencialidad debe vivir acá.
    var visible = {};
    var res = getBibliotecaDocs();
    (((res && res.items) || [])).forEach(function(d) { visible[String(d.id)] = 1; });
    return { ids: top.map(function(s) { return s.id; }).filter(function(id) { return visible[id] === 1; }) };
  }, {});
}

// Backfill one-shot (correr desde el editor, head). Embeddea los docs de
// biblioteca que aún no tengan vector. Idempotente.
function backfillBiblioEmbeddings() {
  var ctx = _getAuthContext();
  if (ctx.role !== 'head') throw new Error('Solo un head puede correr el backfill de embeddings.');
  if (!_aiApiKey()) throw new Error('Falta GEMINI_API_KEY en Script Properties.');
  var res = getBibliotecaDocs();
  var docs = (res && res.items) || [];
  var ws = _aiEmbedSheet(ctx.ss);
  var existing = {};
  var lr = ws.getLastRow();
  if (lr >= 2) { ws.getRange(2, 1, lr - 1, 1).getValues().forEach(function(r) { existing[String(r[0])] = 1; }); }
  var done = 0;
  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];
    if (existing[String(d.id)]) continue;
    if (_aiUpsertEmbedding(ctx.ss, d.id, _aiBiblioText(d))) done++;
    Utilities.sleep(200); // respeto del rate limit de la API
  }
  return 'Embeddings generados: ' + done + ' nuevos (de ' + docs.length + ' docs).';
}
