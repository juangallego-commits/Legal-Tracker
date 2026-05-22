#!/usr/bin/env node
/**
 * check-i18n.js · Detecta strings en español que se renderean en la UI
 * pero no tienen entrada en T_PT (el diccionario PT-BR del cliente).
 *
 * Lee frontend/Dashboard.js.html y:
 *   1) extrae todas las llamadas a t('...') o t("...")
 *   2) extrae las keys del objeto T_PT
 *   3) reporta diferencias en ambas direcciones:
 *      - Strings llamadas a t() que NO están en T_PT (= se quedan en ES en PT)
 *      - Keys de T_PT que NO se llaman desde t() (= traducciones huérfanas)
 *
 * Uso:
 *   node scripts/check-i18n.js                    # output a stdout, exit 1 si hay missing
 *   node scripts/check-i18n.js --quiet            # solo cuenta + exit code
 *   node scripts/check-i18n.js --no-orphans       # ignora orphans en T_PT
 *
 * En CI: usado por .github/workflows/check-i18n.yml para bloquear merges
 * que introduzcan strings sin traducir.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const QUIET = args.includes('--quiet');
const NO_ORPHANS = args.includes('--no-orphans');

// El módulo i18n (T_PT + t()) vive en I18n.js.html, pero hay 47 llamadas a
// t() repartidas en Dashboard.js.html. Leemos ambos archivos y los
// concatenamos para que la auditoría no le importe cómo está modularizado.
const FILES = [
  path.join(__dirname, '..', 'frontend', 'I18n.js.html'),
  path.join(__dirname, '..', 'frontend', 'Dashboard.js.html')
];

const sources = FILES.map(f => {
  if (!fs.existsSync(f)) {
    console.error('No encontré ' + f);
    process.exit(2);
  }
  return fs.readFileSync(f, 'utf8');
});
const src = sources.join('\n');

// ── 1) Extraer keys de T_PT ──────────────────────────────────────
// El bloque va desde "var T_PT = {" hasta el "};" balanceado.
// Cada entry es "key": "value" en una línea (con posible comma trailing).
function extractTPTKeys(s) {
  const startMatch = s.match(/var T_PT = \{/);
  if (!startMatch) {
    console.error('No encontré "var T_PT = {" en Dashboard.js.html');
    process.exit(2);
  }
  const start = startMatch.index + startMatch[0].length;
  // Buscar el "};\nfunction t(es) {" que cierra el dict
  const endMatch = s.slice(start).match(/\n\};\s*\nfunction t\(es\)/);
  if (!endMatch) {
    console.error('No encontré el cierre "};\\nfunction t(es)" del dict T_PT');
    process.exit(2);
  }
  const block = s.slice(start, start + endMatch.index);

  // Regex captura keys de string literals. Acepta '...' o "..."
  // (escape de quote interno opcional). Solo el primer string de cada entry.
  const keys = new Set();
  const reEntry = /^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm;
  let m;
  while ((m = reEntry.exec(block)) !== null) {
    // Unescape básico (\\ \' \" \n)
    const raw = m[2].replace(/\\(['"\\nrt])/g, (_, ch) => {
      if (ch === 'n') return '\n';
      if (ch === 'r') return '\r';
      if (ch === 't') return '\t';
      return ch;
    });
    keys.add(raw);
  }
  return keys;
}

// ── 2) Extraer llamadas a t('...') o t("...") ────────────────────
// Aproximación: matchea t( seguido inmediatamente por una string literal
// (single o double quote) seguida de ) o un operador. Skip casos como
// t.foo, .t( (method call), o concat más complejas (no son detectables
// estáticamente). Subreporta — ese es el trade-off.
function extractTCalls(s) {
  const calls = new Set();
  // Lookbehind para asegurar que es t( y no Xt( o algo similar.
  // \b para start of identifier.
  const re = /(?<![\w.])t\((['"])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = m[2].replace(/\\(['"\\nrt])/g, (_, ch) => {
      if (ch === 'n') return '\n';
      if (ch === 'r') return '\r';
      if (ch === 't') return '\t';
      return ch;
    });
    // Skip strings vacíos o que parecen plumbing
    if (!raw) continue;
    calls.add(raw);
  }
  return calls;
}

const keys = extractTPTKeys(src);
const calls = extractTCalls(src);

const missing = [];
calls.forEach(c => { if (!keys.has(c)) missing.push(c); });

const orphans = [];
if (!NO_ORPHANS) {
  keys.forEach(k => { if (!calls.has(k)) orphans.push(k); });
}

// ── 3) Reportar ──────────────────────────────────────────────────
function trunc(s, n) {
  s = String(s).replace(/\n/g, '\\n');
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

if (QUIET) {
  console.log(`i18n: ${calls.size} t() calls, ${keys.size} T_PT keys, ${missing.length} missing, ${orphans.length} orphans`);
} else {
  console.log('═══ i18n audit · frontend/Dashboard.js.html ═══');
  console.log(`Total t() calls:     ${calls.size}`);
  console.log(`Total T_PT keys:     ${keys.size}`);
  console.log(`Missing in T_PT:     ${missing.length}`);
  if (!NO_ORPHANS) console.log(`Orphan T_PT keys:    ${orphans.length}`);
  console.log('');

  if (missing.length) {
    console.log('── Missing (strings llamadas con t() que no están en T_PT):');
    // Sort por longitud, los cortos suelen ser palabras sueltas / ruido
    missing.sort((a, b) => a.length - b.length || a.localeCompare(b));
    missing.forEach(m => console.log('  ' + JSON.stringify(trunc(m, 100))));
    console.log('');
  }

  if (!NO_ORPHANS && orphans.length) {
    console.log('── Orphans (entries en T_PT que nadie llama):');
    orphans.sort((a, b) => a.length - b.length || a.localeCompare(b));
    // Cap en 30 para no flood. Los orphans son menos críticos (solo ruido).
    const cap = 30;
    orphans.slice(0, cap).forEach(o => console.log('  ' + JSON.stringify(trunc(o, 100))));
    if (orphans.length > cap) console.log(`  ... y ${orphans.length - cap} más`);
    console.log('');
  }
}

// Exit code: 1 si hay missing (rompe CI). Orphans NO rompen CI (son ruido).
process.exit(missing.length > 0 ? 1 : 0);
