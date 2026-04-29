// ═══════════════════════════════════════════════════════════════
// EDITORIAL — Confidencialidad
// 2 artboards:
//   <EdConfNiveles />     — el sistema visual: 3 niveles, dónde aparecen
//   <EdConfTracker />     — Tracker con filas bloqueadas + watermark en doc
// ═══════════════════════════════════════════════════════════════

const SCOPE_CONF = 'edcs-conf';

function _confCSS(t) {
  return `
    .ed-conf-wrap { padding:48px 56px 60px; background:${t.bg}; min-height:100%; font-family:'Nunito Sans',system-ui,sans-serif; color:${t.ink}; }
    .ed-conf-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:14px; }
    .ed-conf-h1 { font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:36px; line-height:1.08; letter-spacing:-1px; margin-bottom:10px; }
    .ed-conf-h1 em { font-style:italic; color:${t.accent}; }
    .ed-conf-lede { font-size:14.5px; color:${t.muted}; max-width:760px; line-height:1.55; margin-bottom:30px; }
    .ed-conf-lede b { color:${t.ink}; font-weight:700; }

    /* Three level cards */
    .conf-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:32px; }
    .conf-card { background:${t.paper}; border:1px solid ${t.rule}; border-radius:8px; padding:22px 22px 20px; position:relative; overflow:hidden; }
    .conf-band { height:5px; position:absolute; left:0; right:0; top:0; }
    .conf-card .lvl-row { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
    .conf-card .lvl-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; }
    .conf-card .lvl-name { font-family:'Fraunces',Georgia,serif; font-size:22px; font-weight:500; letter-spacing:-.3px; }
    .conf-card .lvl-desc { font-size:13px; color:${t.muted}; line-height:1.5; margin-bottom:14px; min-height:42px; }
    .conf-card .lvl-rule { height:1px; background:${t.rule}; margin:14px 0; }
    .conf-card .lvl-meta-l { font-size:9.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; margin-bottom:6px; }
    .conf-card ul { list-style:none; padding:0; margin:0; font-size:12.5px; color:${t.ink}; }
    .conf-card li { padding:3px 0; display:flex; align-items:flex-start; gap:8px; line-height:1.45; }
    .conf-card li::before { content:'·'; color:${t.dim}; flex-shrink:0; padding-top:0; }
    .conf-card .lvl-tag { display:inline-block; padding:3px 9px; border-radius:3px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; }

    /* Where it appears */
    .where-h2 { font-size:12.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:700; margin-bottom:18px; display:flex; align-items:center; gap:10px; }
    .where-h2::after { content:''; flex:1; height:1px; background:${t.rule}; }
    .where-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:30px; }
    .where-card { background:${t.paper}; border:1px solid ${t.rule}; border-radius:8px; padding:18px 18px 16px; }
    .where-num { font-family:'Fraunces',Georgia,serif; font-size:14px; color:${t.dim}; font-style:italic; margin-bottom:6px; }
    .where-title { font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:500; letter-spacing:-.2px; margin-bottom:10px; }
    .where-body { font-size:12.5px; color:${t.muted}; line-height:1.5; }
    .where-body b { color:${t.ink}; font-weight:700; }

    /* mini visual examples within where-card */
    .mini-row { display:flex; align-items:center; gap:8px; padding:6px 8px; background:${t.paper2}; border-radius:4px; font-size:11.5px; margin-top:10px; }
    .mini-row .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .mini-row .id { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:${t.dim}; flex-shrink:0; }
    .mini-row .name { color:${t.ink}; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .mini-row.locked .name { color:${t.dim}; font-style:italic; }
    .mini-row.locked { background:repeating-linear-gradient(135deg, ${t.paper2} 0 6px, ${t.paper3} 6px 12px); }

    /* Rules row */
    .rules-row { display:flex; gap:10px; flex-wrap:wrap; padding:14px 18px; background:${t.paper2}; border-radius:6px; font-size:12px; color:${t.muted}; }
    .rules-row b { color:${t.ink}; font-weight:700; }
    .rules-row .sep { color:${t.dim}; }
  `;
}

function EdConfNiveles({ theme = 'light' }) {
  const t = edTheme(theme);
  const L = ED_CONF_LEVELS;
  return (
    <div className="ed-conf-wrap">
      <style>{edScope(SCOPE_CONF, _confCSS(t))}</style>
      <div className={SCOPE_CONF}>
        <div className="ed-conf-eye">Confidencialidad</div>
        <h1 className="ed-conf-h1">Tres niveles, <em>visibles en cada superficie</em>.</h1>
        <p className="ed-conf-lede">
          Toda tarea, proyecto y documento tiene un nivel. <b>Cualquiera del equipo legal</b> puede asignar cualquiera de los tres al crear o editar.
          Lo que ves está marcado; lo que no podés ver, también — para que nadie crea que la lista está incompleta.
        </p>

        {/* Three level cards */}
        <div className="conf-grid">
          {[L.estandar, L.restringido, L.confidencial].map(lv => (
            <div key={lv.id} className="conf-card">
              <div className="conf-band" style={{background:lv.dot}}></div>
              <div className="lvl-row">
                <span className="lvl-dot" style={{background:lv.dot}}></span>
                <span className="lvl-name">{lv.label}</span>
              </div>
              <div className="lvl-desc">{lv.desc}</div>
              <div>
                <span className="lvl-tag" style={{background:lv.band, color:lv.bandInk}}>{lv.short}</span>
              </div>
              <div className="lvl-rule"></div>
              <div className="lvl-meta-l">Quién ve</div>
              <ul>
                {lv.id === 'estandar' && <>
                  <li>Todo el equipo legal del país</li>
                  <li>Manager y HQ con acceso de lectura</li>
                </>}
                {lv.id === 'restringido' && <>
                  <li>Personas asignadas a la tarea</li>
                  <li>Manager del país, lead del proyecto</li>
                  <li>HQ no ve detalle, sí ve agregados</li>
                </>}
                {lv.id === 'confidencial' && <>
                  <li>Sólo personas nombradas explícitamente</li>
                  <li>Manager <b>no entra automáticamente</b></li>
                  <li>Documentos con watermark personal</li>
                  <li>Reportes IA no incluyen contenido</li>
                </>}
              </ul>
            </div>
          ))}
        </div>

        {/* Where it appears */}
        <div className="where-h2">Dónde aparece el nivel</div>
        <div className="where-grid">
          <div className="where-card">
            <div className="where-num">01</div>
            <div className="where-title">En el Tracker</div>
            <div className="where-body">
              Una columna <b>🔒 Nivel</b> con punto de color. Las filas Confidenciales sin acceso aparecen <b>bloqueadas</b> mostrando que existen pero ocultando contenido.
            </div>
            <div className="mini-row"><span className="dot" style={{background:L.estandar.dot}}></span><span className="id">T-138</span><span className="name">Revisar TyC promo</span></div>
            <div className="mini-row"><span className="dot" style={{background:L.restringido.dot}}></span><span className="id">T-141</span><span className="name">NDA con proveedor</span></div>
            <div className="mini-row locked"><span className="dot" style={{background:L.confidencial.dot}}></span><span className="id">T-145</span><span className="name">Confidencial · sin acceso</span></div>
          </div>

          <div className="where-card">
            <div className="where-num">02</div>
            <div className="where-title">En el panel de tarea</div>
            <div className="where-body">
              Banda de color en el header con el nivel. Al expandir, se ve la <b>lista completa de quién tiene acceso</b> y desde cuándo.
            </div>
            <div style={{marginTop:12, border:`1px solid ${t.rule}`, borderRadius:5, overflow:'hidden', background:t.paper}}>
              <div style={{height:4, background:L.confidencial.dot}}></div>
              <div style={{padding:'10px 12px'}}>
                <div style={{fontSize:9.5,color:L.confidencial.bandInk,fontWeight:800,textTransform:'uppercase',letterSpacing:1.2,marginBottom:4}}>● Confidencial</div>
                <div style={{fontSize:12.5,fontFamily:'Fraunces,Georgia,serif',marginBottom:6}}>T-152 · Adquisición Gómez S.A.</div>
                <div style={{fontSize:10.5,color:t.dim}}>Acceso: Carlos F · Ana B · 2 más ▾</div>
              </div>
            </div>
          </div>

          <div className="where-card">
            <div className="where-num">03</div>
            <div className="where-title">En documentos</div>
            <div className="where-body">
              Cada vez que alguien abre un doc Confidencial, se renderiza con <b>watermark diagonal</b> con su nombre, fecha y hora. Hace responsable al que lo comparte.
            </div>
            {/* Mini doc preview */}
            <div style={{marginTop:12, border:`1px solid ${t.rule}`, borderRadius:5, position:'relative', overflow:'hidden', background:'#fff', height:88}}>
              <div style={{padding:'8px 10px'}}>
                <div style={{height:5, width:'45%', background:'#222', marginBottom:6}}></div>
                <div style={{height:3, width:'88%', background:'#bbb', marginBottom:3}}></div>
                <div style={{height:3, width:'92%', background:'#bbb', marginBottom:3}}></div>
                <div style={{height:3, width:'70%', background:'#bbb', marginBottom:3}}></div>
                <div style={{height:3, width:'85%', background:'#bbb'}}></div>
              </div>
              <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none'}}>
                <div style={{transform:'rotate(-22deg)', fontFamily:'Fraunces,Georgia,serif',fontSize:11,color:'rgba(178,58,58,.32)',fontWeight:700,letterSpacing:1.5,textAlign:'center',lineHeight:1.2,whiteSpace:'nowrap'}}>
                  CONFIDENCIAL · JUAN CAMILO<br/>27 ABR 2026 · 14:32
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rules row */}
        <div className="rules-row">
          <span><b>Default al crear:</b> Estándar</span>
          <span className="sep">·</span>
          <span><b>Cambiar nivel:</b> cualquiera con acceso</span>
          <span className="sep">·</span>
          <span><b>Auditoría:</b> quién vio qué y cuándo (sólo Confidencial)</span>
          <span className="sep">·</span>
          <span><b>Slack:</b> el bot pregunta el nivel antes de postear en thread</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Artboard 2 — Tracker con filas bloqueadas + doc con watermark
// ═══════════════════════════════════════════════════════════════

function _confTrackerCSS(t) {
  return `
    .ct-wrap { display:grid; grid-template-columns:218px 1fr; min-height:100%; background:${t.bg}; font-family:'Nunito Sans',system-ui,sans-serif; color:${t.ink}; }
    .ct-main { padding:32px 36px 40px; min-width:0; }
    .ct-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:10px; }
    .ct-h1 { font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:28px; line-height:1.1; letter-spacing:-.6px; margin-bottom:8px; }
    .ct-h1 em { font-style:italic; color:${t.accent}; }
    .ct-lede { font-size:13.5px; color:${t.muted}; line-height:1.5; margin-bottom:22px; max-width:680px; }
    .ct-lede b { color:${t.ink}; font-weight:700; }

    /* Tracker table */
    .ct-tbl { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; overflow:hidden; margin-bottom:24px; }
    .ct-tbl-head { display:grid; grid-template-columns:54px 80px 1fr 80px 120px 90px 100px; padding:10px 14px; background:${t.paper2}; border-bottom:1px solid ${t.rule}; font-size:9.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; }
    .ct-tbl-row { display:grid; grid-template-columns:54px 80px 1fr 80px 120px 90px 100px; padding:11px 14px; border-bottom:1px solid ${t.ruleSoft}; font-size:13px; align-items:center; }
    .ct-tbl-row:last-child { border-bottom:none; }
    .ct-tbl-row .col-id { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.dim}; }
    .ct-tbl-row .col-lock { display:flex; justify-content:center; }
    .ct-tbl-row .lock-dot { width:10px; height:10px; border-radius:50%; }
    .ct-tbl-row .col-name { color:${t.ink}; font-weight:500; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ct-tbl-row .col-prio { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; }
    .ct-tbl-row .col-asig { color:${t.muted}; font-size:11.5px; }
    .ct-tbl-row .col-date { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.muted}; }
    .ct-tbl-row .col-state { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:${t.muted}; }

    .ct-tbl-row.locked { background:repeating-linear-gradient(135deg, ${t.paper} 0 8px, ${t.paper2} 8px 16px); }
    .ct-tbl-row.locked .col-name { color:${t.dim}; font-style:italic; }
    .ct-tbl-row.locked .col-asig,
    .ct-tbl-row.locked .col-date,
    .ct-tbl-row.locked .col-prio { color:${t.dim}; opacity:.6; }
    .ct-tbl-row.locked .col-state { color:${t.dim}; }

    .ct-grid { display:grid; grid-template-columns:1.2fr 1fr; gap:18px; }
    .ct-explain { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; padding:18px 20px; }
    .ct-explain h3 { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:500; margin-bottom:12px; letter-spacing:-.2px; }
    .ct-explain p { font-size:12.5px; color:${t.muted}; line-height:1.55; margin-bottom:10px; }
    .ct-explain p b { color:${t.ink}; font-weight:700; }
    .ct-explain .small { font-size:11px; color:${t.dim}; padding:8px 10px; background:${t.paper2}; border-radius:4px; margin-top:8px; line-height:1.5; }

    /* Document preview with watermark */
    .ct-doc { background:#FFFFFF; border:1px solid ${t.rule}; border-radius:6px; overflow:hidden; position:relative; }
    .ct-doc-head { padding:10px 14px; background:${t.paper2}; border-bottom:1px solid ${t.rule}; display:flex; align-items:center; gap:10px; font-size:11px; }
    .ct-doc-head .name { color:${t.ink}; font-weight:700; }
    .ct-doc-head .lvl { margin-left:auto; padding:2px 8px; background:${ED_CONF_LEVELS.confidencial.band}; color:${ED_CONF_LEVELS.confidencial.bandInk}; border-radius:3px; font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; }
    .ct-doc-body { padding:24px 28px; position:relative; min-height:340px; }
    .ct-doc-body h4 { font-family:'Fraunces',Georgia,serif; font-size:15px; color:#1a1a1a; margin-bottom:8px; }
    .ct-doc-body .ln { height:6px; background:#222; opacity:.85; margin-bottom:5px; }
    .ct-doc-body .ln.short { width:34%; }
    .ct-doc-body .par { margin-bottom:14px; }
    .ct-doc-body .par .ln { height:3px; background:#999; opacity:.55; margin-bottom:4px; }
    .ct-watermark { position:absolute; inset:0; pointer-events:none; display:grid; place-items:center; overflow:hidden; }
    .ct-watermark .stamp { transform:rotate(-22deg); font-family:'Fraunces',Georgia,serif; font-size:34px; color:rgba(178,58,58,.16); font-weight:700; letter-spacing:6px; text-align:center; line-height:1.2; white-space:nowrap; }
    .ct-watermark .stamp small { display:block; font-size:11px; letter-spacing:3px; margin-top:6px; font-weight:600; color:rgba(178,58,58,.25); }
  `;
}

function EdConfTracker({ theme = 'light' }) {
  const t = edTheme(theme);
  const L = ED_CONF_LEVELS;
  // Some rows the Specialist can see, some locked
  const rows = [
    { id:'T-138', lvl:L.estandar,    name:'Revisar TyC promo Cyber',           prio:'Alta',  asig:'JC',         date:'29 abr',  state:'En curso',   prioColor:t.critical, locked:false },
    { id:'T-141', lvl:L.restringido, name:'NDA con proveedor logístico',       prio:'Media', asig:'JC',         date:'02 may',  state:'Pendiente', prioColor:t.warn, locked:false },
    { id:'T-142', lvl:L.estandar,    name:'Política privacidad — actualización', prio:'Media', asig:'AB',       date:'05 may',  state:'Revisión',   prioColor:t.warn, locked:false },
    { id:'T-145', lvl:L.confidencial,name:'Confidencial · sin acceso',          prio:'Alta',  asig:'—',          date:'—',       state:'—',          prioColor:t.dim, locked:true },
    { id:'T-148', lvl:L.estandar,    name:'Renovación contrato Cornershop',     prio:'Alta',  asig:'JC',         date:'30 abr',  state:'En curso',   prioColor:t.critical, locked:false },
    { id:'T-149', lvl:L.confidencial,name:'Confidencial · sin acceso',          prio:'Media', asig:'—',          date:'—',       state:'—',          prioColor:t.dim, locked:true },
    { id:'T-151', lvl:L.restringido, name:'Disputa contractual — proveedor X',  prio:'Alta',  asig:'CF · 1 más', date:'01 may',  state:'Bloqueada',  prioColor:t.critical, locked:false },
  ];

  return (
    <div className="ct-wrap">
      <style>{edScope(SCOPE_CONF + '-2', _confTrackerCSS(t))}</style>
      <div className={SCOPE_CONF + '-2'}>
        <EdSidebar t={t} role="specialist" activeItem="mistareas" />
        <div className="ct-main">
          <div className="ct-eye">Confidencialidad · en uso</div>
          <h1 className="ct-h1">Lo que <em>no podés ver</em>, también está marcado.</h1>
          <p className="ct-lede">
            Vista del Tracker desde Juan Camilo. Hay tareas Confidenciales del país que él <b>no tiene asignadas</b>, y aparecen como filas bloqueadas: sabe que existen, no sabe de qué se trata.
            Cuando abre un documento Confidencial al que sí tiene acceso, ve un <b>watermark con su nombre y la hora</b> — lo hace responsable de cómo lo comparte.
          </p>

          <div className="ct-tbl">
            <div className="ct-tbl-head">
              <span style={{textAlign:'center'}}>🔒</span>
              <span>ID</span>
              <span>Tarea</span>
              <span>Prio</span>
              <span>Asignado</span>
              <span>Vence</span>
              <span>Estado</span>
            </div>
            {rows.map(r => (
              <div key={r.id} className={`ct-tbl-row ${r.locked ? 'locked' : ''}`}>
                <div className="col-lock"><span className="lock-dot" style={{background:r.lvl.dot}} title={r.lvl.label}></span></div>
                <div className="col-id">{r.id}</div>
                <div className="col-name">{r.locked ? '▓▓▓▓▓▓▓▓▓▓▓ Confidencial · sin acceso' : r.name}</div>
                <div className="col-prio" style={{color:r.prioColor}}>{r.locked ? '—' : r.prio}</div>
                <div className="col-asig">{r.asig}</div>
                <div className="col-date">{r.date}</div>
                <div className="col-state">{r.state}</div>
              </div>
            ))}
          </div>

          <div className="ct-grid">
            <div className="ct-explain">
              <h3>Por qué se ve la fila aunque no podás abrirla</h3>
              <p>
                Si la fila desaparece por completo, la lista miente: pareciera que el equipo tiene 11 tareas cuando en realidad tiene 13.
                <b> Mostrar el ítem bloqueado</b> mantiene la cuenta honesta y le dice al specialist <i>"esto existe, no es para vos"</i>.
              </p>
              <p>
                El indicador 🔒 en la cabecera y el <b>punto de color</b> en cada fila funcionan como leyenda silenciosa: te acostumbrás al sistema sin tener que aprenderlo.
              </p>
              <div className="small">
                <b>Permisos:</b> cualquiera del equipo legal puede marcar Confidencial al crear o editar. La lista de acceso se gestiona por persona — no por rol — para que un cambio de manager no abra accesos sin querer.
              </div>
            </div>

            <div className="ct-doc">
              <div className="ct-doc-head">
                <span style={{color:t.dim}}>📄</span>
                <span className="name">contrato-adquisición-gómez-v3.pdf</span>
                <span className="lvl">● Confidencial</span>
              </div>
              <div className="ct-doc-body">
                <h4>Acuerdo de Adquisición — Borrador v3</h4>
                <div className="ln" style={{width:'88%'}}></div>
                <div className="ln" style={{width:'94%'}}></div>
                <div className="ln short"></div>
                <div style={{height:14}}></div>
                <div className="par">
                  <div className="ln"></div>
                  <div className="ln"></div>
                  <div className="ln"></div>
                  <div className="ln" style={{width:'62%'}}></div>
                </div>
                <div className="par">
                  <div className="ln"></div>
                  <div className="ln"></div>
                  <div className="ln" style={{width:'78%'}}></div>
                </div>
                <div className="ct-watermark">
                  <div className="stamp">
                    CONFIDENCIAL · JUAN CAMILO
                    <small>27 ABR 2026 · 14:32 · IP 10.4.22.118</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EdConfNiveles, EdConfTracker });
