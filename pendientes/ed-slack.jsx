// ═══════════════════════════════════════════════════════════════
// EDITORIAL — Slack como interfaz operativa
// 2 artboards:
//   <EdSlackThread />     — un thread real con reacciones que crean tarea
//   <EdSlackEmojis />     — tabla de emojis, qué hacen, quién puede
//
// El equipo legal NO abre la app para tareas chicas. Operan en Slack
// con reacciones emoji. La app sólo registra.
// ═══════════════════════════════════════════════════════════════

const SCOPE_SLK = 'edcs-slk';

function _slkCSS(t) {
  return `
    .slk-wrap { padding:36px 44px 50px; background:${t.bg}; min-height:100%; font-family:'Nunito Sans',system-ui,sans-serif; color:${t.ink}; }
    .slk-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:10px; }
    .slk-h1 { font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:32px; line-height:1.1; letter-spacing:-.7px; margin-bottom:8px; }
    .slk-h1 em { font-style:italic; color:${t.accent}; }
    .slk-lede { font-size:14px; color:${t.muted}; line-height:1.55; max-width:760px; margin-bottom:26px; }
    .slk-lede b { color:${t.ink}; font-weight:700; }

    .slk-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:18px; }

    /* Slack window mock */
    .slk-win { background:#fff; border:1px solid ${t.rule}; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .slk-titlebar { display:flex; align-items:center; gap:8px; padding:8px 12px; background:#f3f0ec; border-bottom:1px solid ${t.rule}; }
    .slk-titlebar .dots { display:flex; gap:5px; }
    .slk-titlebar .dot { width:10px; height:10px; border-radius:50%; }
    .slk-titlebar .name { font-size:11px; color:#666; font-weight:600; margin-left:6px; }
    .slk-channel { padding:10px 16px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:8px; }
    .slk-channel .hash { color:#1d1c1d; font-weight:700; font-size:14px; }
    .slk-channel .ch-name { color:#1d1c1d; font-weight:700; font-size:14.5px; }
    .slk-channel .ch-meta { color:#616061; font-size:11.5px; margin-left:10px; }

    .slk-msgs { padding:14px 16px 18px; }
    .slk-msg { display:flex; gap:10px; padding:6px 0; }
    .slk-msg .av { width:34px; height:34px; border-radius:6px; flex-shrink:0; display:grid; place-items:center; color:#fff; font-weight:800; font-size:13px; }
    .slk-msg .body { flex:1; min-width:0; }
    .slk-msg .head { display:flex; align-items:baseline; gap:8px; margin-bottom:2px; }
    .slk-msg .who { color:#1d1c1d; font-weight:800; font-size:13.5px; }
    .slk-msg .time { color:#616061; font-size:10.5px; }
    .slk-msg .txt { color:#1d1c1d; font-size:13.5px; line-height:1.45; }
    .slk-msg .txt .mention { color:#1264a3; background:#e8f5fa; padding:0 3px; border-radius:2px; font-weight:600; }
    .slk-msg .txt .link { color:#1264a3; text-decoration:underline; }
    .slk-attach { margin-top:6px; padding:8px 10px; border:1px solid #ddd; border-left:4px solid #4a154b; border-radius:4px; display:flex; align-items:center; gap:8px; background:#fafafa; max-width:340px; }
    .slk-attach .ic { font-size:18px; }
    .slk-attach .nm { font-size:12.5px; color:#1d1c1d; font-weight:600; }
    .slk-attach .sub { font-size:11px; color:#616061; }

    .slk-reax { display:flex; gap:5px; margin-top:6px; flex-wrap:wrap; }
    .slk-reax .rx { display:inline-flex; align-items:center; gap:4px; padding:2px 7px; background:#e8f5fa; border:1px solid #1264a3; border-radius:12px; font-size:11.5px; color:#1264a3; font-weight:700; }
    .slk-reax .rx.add { background:#fff; border:1px solid #ddd; color:#616061; padding:2px 7px; }
    .slk-reax .rx em { font-style:normal; font-size:13px; }

    /* Bot card */
    .slk-bot { margin-top:8px; border-left:3px solid #B8551F; padding:10px 12px; background:#fff7f1; border-radius:4px; }
    .slk-bot .bot-head { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
    .slk-bot .bot-name { font-weight:800; font-size:12px; color:#1d1c1d; }
    .slk-bot .bot-app { font-size:9.5px; padding:1px 6px; background:#1d1c1d; color:#fff; border-radius:3px; font-weight:700; letter-spacing:.4px; }
    .slk-bot .bot-time { font-size:10.5px; color:#616061; margin-left:auto; }
    .slk-bot-card { background:#fff; border:1px solid #e0e0e0; border-radius:6px; padding:12px 14px; }
    .slk-bot-card .row1 { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
    .slk-bot-card .tid { font-family:'JetBrains Mono',monospace; font-size:11px; color:#616061; font-weight:700; }
    .slk-bot-card .tname { font-family:'Fraunces',Georgia,serif; font-size:15px; font-weight:500; color:#1d1c1d; }
    .slk-bot-card .row2 { display:flex; gap:14px; font-size:11px; color:#616061; margin-bottom:8px; flex-wrap:wrap; }
    .slk-bot-card .row2 b { color:#1d1c1d; font-weight:700; }
    .slk-bot-card .row3 { display:flex; gap:6px; }
    .slk-bot-card .btn { padding:5px 11px; font-size:11px; font-weight:700; border-radius:4px; border:1px solid #007a5a; color:#007a5a; background:#fff; cursor:pointer; }
    .slk-bot-card .btn.primary { background:#007a5a; color:#fff; }

    /* Right column: callouts */
    .slk-call { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; padding:18px 20px; }
    .slk-call h3 { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:500; margin-bottom:10px; letter-spacing:-.2px; }
    .slk-call p { font-size:12.5px; color:${t.muted}; line-height:1.55; margin-bottom:10px; }
    .slk-call p b { color:${t.ink}; font-weight:700; }
    .slk-call ul { padding:0; margin:0 0 6px; list-style:none; font-size:12.5px; }
    .slk-call li { padding:5px 0; display:flex; gap:10px; align-items:flex-start; line-height:1.45; border-bottom:1px solid ${t.ruleSoft}; }
    .slk-call li:last-child { border-bottom:none; }
    .slk-call li .em { font-size:18px; flex-shrink:0; line-height:1; padding-top:1px; width:22px; text-align:center; }
    .slk-call li .label { font-weight:700; color:${t.ink}; }
    .slk-call li .desc { color:${t.muted}; font-size:11.5px; display:block; margin-top:1px; }

    .slk-disclaimer { margin-top:14px; padding:10px 12px; background:${t.paper2}; border-radius:5px; font-size:11.5px; color:${t.muted}; line-height:1.5; }
    .slk-disclaimer b { color:${t.ink}; font-weight:700; }
  `;
}

function EdSlackThread({ theme = 'light' }) {
  const t = edTheme(theme);
  return (
    <div className="slk-wrap">
      <style>{edScope(SCOPE_SLK, _slkCSS(t))}</style>
      <div className={SCOPE_SLK}>
        <div className="slk-eye">Slack como interfaz operativa</div>
        <h1 className="slk-h1">Reaccionar con un emoji <em>crea, cierra o bloquea</em> una tarea.</h1>
        <p className="slk-lede">
          El equipo legal vive en Slack. Cuando aparece algo que requiere acción, <b>no abren la app</b>: reaccionan al mensaje con un emoji y el bot hace el trabajo.
          La app sólo <b>registra y consolida</b>. Esta pantalla muestra Slack — no es nuestra UI — para que se entienda dónde pasa la acción.
        </p>

        <div className="slk-grid">
          {/* LEFT: Slack thread mock */}
          <div className="slk-win">
            <div className="slk-titlebar">
              <div className="dots">
                <span className="dot" style={{background:'#FF5F57'}}></span>
                <span className="dot" style={{background:'#FEBC2E'}}></span>
                <span className="dot" style={{background:'#28C840'}}></span>
              </div>
              <span className="name">Slack · Rappi · #legal-co</span>
            </div>
            <div className="slk-channel">
              <span className="hash">#</span>
              <span className="ch-name">legal-co</span>
              <span className="ch-meta">· Equipo legal Colombia · 38 miembros</span>
            </div>
            <div className="slk-msgs">
              {/* Originating message — from operations team */}
              <div className="slk-msg">
                <div className="av" style={{background:'#5e3a8a'}}>MR</div>
                <div className="body">
                  <div className="head">
                    <span className="who">María Ruiz</span>
                    <span className="time">hoy a las 9:42</span>
                  </div>
                  <div className="txt">
                    <span className="mention">@legal-co</span> hola equipo, necesito que revisen el contrato con <b>Cornershop</b> para la integración de delivery. Vence el <b>15 de mayo</b> y el equipo de Operations quiere firmar antes. Adjunto el borrador que nos mandaron 👇
                  </div>
                  <div className="slk-attach">
                    <span className="ic">📄</span>
                    <div>
                      <div className="nm">contrato-cornershop-integration-v2.pdf</div>
                      <div className="sub">PDF · 1.4 MB · 12 páginas</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* JC reaction — adds the legal emoji */}
              <div className="slk-msg" style={{paddingLeft:44}}>
                <div className="body">
                  <div className="slk-reax">
                    <span className="rx"><em>⚖️</em>1</span>
                    <span className="rx add">+</span>
                  </div>
                </div>
              </div>

              {/* Bot response */}
              <div className="slk-msg">
                <div className="av" style={{background:'#B8551F'}}>L</div>
                <div className="body">
                  <div className="head">
                    <span className="who">Legal Tracker</span>
                    <span className="time" style={{padding:'1px 5px',background:'#1d1c1d',color:'#fff',borderRadius:2,fontSize:9,fontWeight:800,letterSpacing:.4}}>BOT</span>
                    <span className="time">9:43</span>
                  </div>
                  <div className="txt" style={{color:'#616061',fontSize:12.5,marginBottom:8}}>
                    Juan Camilo reaccionó con <b>⚖️</b> — creé una tarea desde el thread:
                  </div>
                  <div className="slk-bot-card">
                    <div className="row1">
                      <span className="tid">T-149</span>
                      <span className="tname">Revisar contrato Cornershop — integración delivery</span>
                    </div>
                    <div className="row2">
                      <span><b>Asignada a:</b> Juan Camilo</span>
                      <span><b>Prioridad sugerida:</b> Alta</span>
                      <span><b>Vence:</b> 14 may (1 día antes)</span>
                      <span><b>Nivel:</b> ◐ Restringido</span>
                    </div>
                    <div style={{fontSize:11.5,color:'#616061',marginBottom:10,padding:'8px 10px',background:'#fafafa',borderRadius:4,lineHeight:1.5}}>
                      <b style={{color:'#1d1c1d'}}>Resumen IA del thread:</b> Cornershop necesita revisión de contrato de integración delivery antes del 15 may. Borrador adjunto (12 pp). Solicitante: María Ruiz (Operations).
                    </div>
                    <div className="row3">
                      <button className="btn primary">Confirmar</button>
                      <button className="btn">Editar</button>
                      <button className="btn">No es tarea</button>
                    </div>
                  </div>
                  <div className="txt" style={{fontSize:11.5,color:'#616061',marginTop:6}}>
                    📄 Adjunto guardado · 🔗 <span className="link">Ver en Legal Tracker</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: callouts */}
          <div>
            <div className="slk-call">
              <h3>Lo que pasa sin abrir la app</h3>
              <p>
                Juan reaccionó con <b>⚖️</b> al mensaje de María. El bot leyó el thread completo (mensaje + adjunto + contexto del canal), generó un <b>resumen y sugerencias</b>, y creó la tarea auto-asignándose a quien reaccionó.
              </p>
              <p>
                <b>3 botones</b> en el thread: confirmar (un click y queda), editar (ajustar prioridad/nivel/asignado por DM) o descartar.
              </p>
              <div className="slk-disclaimer">
                <b>Por qué importa:</b> los specialists no quieren cambiar de contexto para registrar una tarea. Si el costo es <i>"reaccionar con un emoji"</i>, no hay fricción — y todo queda registrado.
              </div>
            </div>

            <div style={{height:14}}></div>

            <div className="slk-call">
              <h3>Otras reacciones disponibles</h3>
              <ul>
                <li>
                  <span className="em">⚖️</span>
                  <div><span className="label">Crear tarea</span><span className="desc">Cualquiera del equipo legal. Auto-asigna al que reaccionó.</span></div>
                </li>
                <li>
                  <span className="em">✅</span>
                  <div><span className="label">Cerrar</span><span className="desc">Sólo asignado o lead. El bot pide confirmación por DM.</span></div>
                </li>
                <li>
                  <span className="em">🚧</span>
                  <div><span className="label">Bloquear</span><span className="desc">El bot pregunta qué bloquea y a quién avisa.</span></div>
                </li>
                <li>
                  <span className="em">👀</span>
                  <div><span className="label">Mandar a revisión</span><span className="desc">Sugiere revisor según el proyecto.</span></div>
                </li>
                <li>
                  <span className="em">📌</span>
                  <div><span className="label">Subir prioridad</span><span className="desc">Manager o HQ. Escala a Alta y notifica al equipo.</span></div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Artboard 2 — Tabla completa de emojis + permisos
// ═══════════════════════════════════════════════════════════════

function _slkTblCSS(t) {
  return `
    .ste-wrap { padding:48px 56px 60px; background:${t.bg}; min-height:100%; font-family:'Nunito Sans',system-ui,sans-serif; color:${t.ink}; }
    .ste-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:10px; }
    .ste-h1 { font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:34px; line-height:1.1; letter-spacing:-.8px; margin-bottom:10px; }
    .ste-h1 em { font-style:italic; color:${t.accent}; }
    .ste-lede { font-size:14px; color:${t.muted}; line-height:1.55; max-width:780px; margin-bottom:30px; }
    .ste-lede b { color:${t.ink}; font-weight:700; }

    .ste-table { background:${t.paper}; border:1px solid ${t.rule}; border-radius:8px; overflow:hidden; margin-bottom:28px; }
    .ste-thead { display:grid; grid-template-columns:80px 1.1fr 2fr 1.3fr 1fr; padding:14px 18px; background:${t.paper2}; border-bottom:1px solid ${t.rule}; font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; }
    .ste-trow { display:grid; grid-template-columns:80px 1.1fr 2fr 1.3fr 1fr; padding:18px; border-bottom:1px solid ${t.ruleSoft}; align-items:center; font-size:13px; }
    .ste-trow:last-child { border-bottom:none; }
    .ste-trow .em { font-size:34px; line-height:1; }
    .ste-trow .nm { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:500; letter-spacing:-.2px; }
    .ste-trow .nm code { display:block; font-family:'JetBrains Mono',monospace; font-size:10.5px; color:${t.dim}; font-weight:600; margin-top:3px; }
    .ste-trow .desc { color:${t.muted}; line-height:1.5; font-size:12.5px; }
    .ste-trow .desc b { color:${t.ink}; font-weight:700; }
    .ste-trow .who { font-size:12px; color:${t.ink}; line-height:1.45; }
    .ste-trow .who b { font-weight:700; }
    .ste-trow .what { font-size:11.5px; color:${t.muted}; line-height:1.45; }
    .ste-trow .what b { color:${t.ink}; font-weight:700; }

    .ste-bottom { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
    .ste-card { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; padding:18px 20px; }
    .ste-card h4 { font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:500; margin-bottom:8px; letter-spacing:-.2px; }
    .ste-card p { font-size:12px; color:${t.muted}; line-height:1.55; }
    .ste-card p b { color:${t.ink}; font-weight:700; }
    .ste-card .num { font-family:'Fraunces',Georgia,serif; font-style:italic; font-size:13px; color:${t.dim}; margin-bottom:4px; }
  `;
}

function EdSlackEmojis({ theme = 'light' }) {
  const t = edTheme(theme);
  const rows = [
    { em:'⚖️', name:'Crear tarea', code:':legal:', desc:'IA lee el thread + adjuntos, genera título, contexto y prioridad sugerida.', who:<><b>Cualquiera</b> del equipo legal</>, what:<>Auto-asigna al que reaccionó. <b>Pregunta nivel de confidencialidad</b> por DM antes de postear.</> },
    { em:'✅', name:'Cerrar', code:':white_check_mark:', desc:'IA arma resumen del thread como nota de cierre y adjunta lo que se decidió.', who:<>Sólo <b>asignado</b> o <b>lead del proyecto</b></>, what:<>Pide <b>confirmación por DM</b>: "¿cerrás T-149?". Click y se cierra.</> },
    { em:'🚧', name:'Bloquear', code:':construction:', desc:'Marca la tarea como bloqueada y registra el thread como contexto.', who:<>Sólo <b>asignado</b></>, what:<>El bot pregunta por DM <b>qué bloquea, quién destraba, cuándo reintentar</b>.</> },
    { em:'👀', name:'Mandar a revisión', code:':eyes:', desc:'Cambia estado a "En revisión" y sugiere revisor según el proyecto.', who:<>Sólo <b>asignado</b></>, what:<>Sugerencia <b>basada en historial</b> del proyecto. Confirmás por DM y se asigna.</> },
    { em:'📌', name:'Subir prioridad', code:':pushpin:', desc:'Escala la tarea a prioridad Alta y notifica al equipo en el thread.', who:<><b>Manager</b> o <b>HQ</b></>, what:<>Reacción de specialist <b>no escala</b> — se pide al manager con un ping automático.</> },
  ];
  return (
    <div className="ste-wrap">
      <style>{edScope(SCOPE_SLK + '-tbl', _slkTblCSS(t))}</style>
      <div className={SCOPE_SLK + '-tbl'}>
        <div className="ste-eye">Slack · tabla de reacciones</div>
        <h1 className="ste-h1">Cinco emojis. <em>Permisos por reacción</em>, no por menú.</h1>
        <p className="ste-lede">
          El equipo legal no aprende un nuevo lenguaje. Aprende <b>cinco emojis</b>. Los permisos se aplican silenciosamente: si reaccionás y no podés, el bot te avisa por DM y nada queda registrado en el canal.
        </p>

        <div className="ste-table">
          <div className="ste-thead">
            <span></span>
            <span>Acción</span>
            <span>Qué hace</span>
            <span>Quién puede</span>
            <span>Cómo confirma</span>
          </div>
          {rows.map((r,i) => (
            <div key={i} className="ste-trow">
              <div><span className="em">{r.em}</span></div>
              <div className="nm">{r.name}<code>{r.code}</code></div>
              <div className="desc">{r.desc}</div>
              <div className="who">{r.who}</div>
              <div className="what">{r.what}</div>
            </div>
          ))}
        </div>

        <div className="ste-bottom">
          <div className="ste-card">
            <div className="num">01</div>
            <h4>Auditable de origen</h4>
            <p>Cada tarea creada en Slack guarda <b>link al mensaje original</b>. Si después hay duda de qué se pidió, el thread está a un click.</p>
          </div>
          <div className="ste-card">
            <div className="num">02</div>
            <h4>Confidencialidad first</h4>
            <p>Antes de postear el bot card en un canal público, el bot <b>pregunta el nivel por DM</b>. Si decís Confidencial, no aparece nada en el thread — la tarea queda en la app y al solicitante le llega un DM.</p>
          </div>
          <div className="ste-card">
            <div className="num">03</div>
            <h4>Reversible siempre</h4>
            <p>Quitar la reacción <b>deshace</b> la acción dentro de 5 minutos. Después de eso, hay que ir a la app para revertir.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EdSlackThread, EdSlackEmojis });
