// ═══════════════════════════════════════════════════════════════
// EDITORIAL — ACTUALIZAR ESTADO DE TAREA
// Panel deslizante que se abre desde el tracker. El especialista
// mueve la tarea por el flujo: Pendiente → En curso → En revisión
// → Cerrada. Cada transición pide lo justo y necesario.
// Tres variantes: avanzar, marcar bloqueada, cerrar.
// ═══════════════════════════════════════════════════════════════

function EdActualizar({ theme = 'light', variant = 'cerrar' }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .ua-overlay { position:relative; min-height:100vh; background:${t.bg}; }
    .ua-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.32); backdrop-filter:blur(2px); }
    .ua-panel { position:absolute; right:0; top:0; bottom:0; width:560px; background:${t.paper}; border-left:1px solid ${t.rule}; box-shadow:-30px 0 80px rgba(0,0,0,.18); display:flex; flex-direction:column; }

    .ua-head { padding:24px 28px 18px; border-bottom:1px solid ${t.rule}; }
    .ua-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:800; margin-bottom:6px; }
    .ua-id { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.accent}; font-weight:700; margin-bottom:8px; }
    .ua-title { font-family:'Fraunces',Georgia,serif; font-size:22px; font-weight:400; line-height:1.25; letter-spacing:-.4px; }
    .ua-x { position:absolute; right:24px; top:24px; font-size:22px; color:${t.dim}; cursor:pointer; }

    /* Flow */
    .ua-flow { display:flex; align-items:center; gap:0; padding:18px 28px; background:${t.paper2}; border-bottom:1px solid ${t.rule}; }
    .ua-flow-step { display:flex; flex-direction:column; align-items:center; gap:5px; flex:0 0 auto; }
    .ua-flow-dot { width:10px; height:10px; border-radius:50%; background:${t.paper3}; border:1.5px solid ${t.rule}; }
    .ua-flow-dot.done { background:${t.good}; border-color:${t.good}; }
    .ua-flow-dot.now { background:${t.accent}; border-color:${t.accent}; box-shadow:0 0 0 4px ${t.accentSoft}; }
    .ua-flow-dot.target { background:${t.paper}; border-color:${t.accent}; border-width:2px; }
    .ua-flow-lbl { font-size:9.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; white-space:nowrap; }
    .ua-flow-lbl.now { color:${t.accent}; }
    .ua-flow-lbl.target { color:${t.accent}; font-weight:800; }
    .ua-flow-line { flex:1; height:1px; background:${t.rule}; margin:0 8px; margin-top:-16px; }
    .ua-flow-line.done { background:${t.good}; }
    .ua-flow-line.target { background:${t.accent}; border-top:1px dashed ${t.accent}; height:0; }

    .ua-body { flex:1; overflow-y:auto; padding:24px 28px; }

    /* Action card grande */
    .ua-action { padding:18px; border-radius:6px; margin-bottom:24px; display:flex; gap:14px; align-items:flex-start; }
    .ua-action.cerrar { background:${t.goodSoft}; border-left:3px solid ${t.good}; }
    .ua-action.bloquear { background:${t.criticalSoft}; border-left:3px solid ${t.critical}; }
    .ua-action.avanzar { background:${t.accentSoft}; border-left:3px solid ${t.accent}; }
    .ua-action-mark { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:800; font-size:16px; flex-shrink:0; font-family:'Fraunces',Georgia,serif; font-style:italic; }
    .ua-action.cerrar .ua-action-mark { background:${t.good}; }
    .ua-action.bloquear .ua-action-mark { background:${t.critical}; }
    .ua-action.avanzar .ua-action-mark { background:${t.accent}; }
    .ua-action-h { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:400; line-height:1.3; letter-spacing:-.2px; margin-bottom:4px; }
    .ua-action-sub { font-size:12.5px; color:${t.muted}; line-height:1.5; }
    .ua-action-sub b { color:${t.ink}; font-weight:700; }

    /* Switch entre acciones */
    .ua-options { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:24px; }
    .ua-opt { padding:10px 12px; border:1px solid ${t.rule}; border-radius:4px; background:${t.paper}; cursor:pointer; text-align:center; transition:.12s; }
    .ua-opt:hover { border-color:${t.accent}; }
    .ua-opt.active { border-color:${t.accent}; background:${t.accentSoft}; }
    .ua-opt-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; margin-bottom:3px; }
    .ua-opt.active .ua-opt-lbl { color:${t.accent}; }
    .ua-opt-name { font-size:13px; font-weight:700; color:${t.ink}; }
    .ua-opt.active .ua-opt-name { color:${t.accent}; }

    /* Field */
    .ua-field { margin-bottom:18px; }
    .ua-label { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; margin-bottom:8px; display:flex; gap:8px; align-items:center; }
    .ua-label .opt { color:${t.dim}; font-weight:600; }
    .ua-label .req { color:${t.warn}; }
    .ua-input { width:100%; padding:11px 13px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:4px; font-family:inherit; font-size:13.5px; color:${t.ink}; box-sizing:border-box; line-height:1.5; }
    .ua-input:focus { outline:none; border-color:${t.accent}; }
    .ua-textarea { min-height:90px; resize:vertical; }

    /* AI sugerencia resumen */
    .ua-ai { background:${t.accentSoft}; border-left:3px solid ${t.accent}; padding:12px 14px; border-radius:0 4px 4px 0; margin-bottom:14px; display:flex; gap:10px; align-items:flex-start; }
    .ua-ai-mark { width:22px; height:22px; border-radius:50%; background:${t.accent}; color:#fff; display:grid; place-items:center; font-weight:800; font-size:10px; flex-shrink:0; font-family:'Fraunces',Georgia,serif; font-style:italic; }
    .ua-ai-text { font-size:12px; line-height:1.5; color:${t.ink}; flex:1; }
    .ua-ai-text b { font-weight:700; }
    .ua-ai-actions { margin-top:6px; display:flex; gap:6px; }
    .ua-ai-btn { font-size:10px; padding:4px 8px; background:${t.paper}; border:1px solid ${t.rule}; border-radius:3px; cursor:pointer; font-weight:700; color:${t.ink}; text-transform:uppercase; letter-spacing:.5px; font-family:inherit; }

    /* Pills row */
    .ua-pills { display:flex; gap:6px; flex-wrap:wrap; }
    .ua-pill-btn { padding:7px 12px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:3px; font-size:12px; cursor:pointer; font-weight:600; color:${t.ink}; font-family:inherit; }
    .ua-pill-btn.active { background:${t.ink}; color:${t.bg}; border-color:${t.ink}; }
    .ua-pill-btn.crit.active { background:${t.critical}; border-color:${t.critical}; color:#fff; }

    /* Adjuntos */
    .ua-att-add { display:flex; gap:8px; }
    .ua-att-card { flex:1; border:1px dashed ${t.rule}; border-radius:4px; padding:10px 12px; cursor:pointer; display:flex; gap:10px; align-items:center; transition:.12s; }
    .ua-att-card:hover { border-color:${t.accent}; }
    .ua-att-icon { width:24px; height:24px; border-radius:5px; background:${t.paper2}; display:grid; place-items:center; flex-shrink:0; font-size:10px; font-weight:800; color:#fff; }
    .ua-att-icon.drive { background:#1a73e8; }
    .ua-att-icon.local { background:${t.muted}; }
    .ua-att-name { font-size:12.5px; font-weight:700; color:${t.ink}; }
    .ua-att-sub { font-size:10.5px; color:${t.dim}; margin-top:1px; }

    .ua-att-row { display:flex; gap:10px; padding:8px 12px; border:1px solid ${t.rule}; border-radius:4px; margin-bottom:6px; background:${t.paper2}; align-items:center; }
    .ua-att-row-icon { width:22px; height:22px; border-radius:4px; display:grid; place-items:center; flex-shrink:0; font-size:9px; font-weight:800; color:#fff; }
    .ua-att-row-icon.drive { background:#1a73e8; }
    .ua-att-row-icon.local { background:${t.muted}; }
    .ua-att-row-name { font-size:12px; color:${t.ink}; font-weight:600; flex:1; }
    .ua-att-row-meta { font-size:10px; color:${t.dim}; font-family:'JetBrains Mono',monospace; }
    .ua-att-row-x { color:${t.dim}; cursor:pointer; font-size:14px; }

    /* Notif preview */
    .ua-notif { background:${t.paper2}; border:1px solid ${t.rule}; border-radius:4px; padding:12px 14px; margin-bottom:14px; }
    .ua-notif-eye { font-size:9.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:800; margin-bottom:8px; }
    .ua-notif-row { display:flex; gap:10px; align-items:center; padding:5px 0; }
    .ua-notif-av { width:20px; height:20px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:800; font-size:8px; flex-shrink:0; }
    .ua-notif-name { font-size:12px; color:${t.ink}; font-weight:700; }
    .ua-notif-role { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-left:6px; }
    .ua-notif-tag { margin-left:auto; font-size:9.5px; color:${t.accent}; text-transform:uppercase; letter-spacing:1.1px; font-weight:800; }

    /* Foot */
    .ua-foot { padding:16px 28px; border-top:1px solid ${t.rule}; display:flex; gap:10px; align-items:center; background:${t.paper}; }
    .ua-foot-info { font-size:11px; color:${t.dim}; flex:1; line-height:1.4; }
    .ua-foot-info b { color:${t.ink}; font-weight:700; }
  `;
  const css = edScope(scope, rawCSS);

  // Variant config
  const isCerrar = variant === 'cerrar';
  const isBloquear = variant === 'bloquear';
  const isAvanzar = variant === 'avanzar';

  const flowSteps = [
    { id:'pendiente', lbl:'Pendiente' },
    { id:'curso', lbl:'En curso' },
    { id:'revision', lbl:'En revisión' },
    { id:'cerrada', lbl:'Cerrada' },
  ];
  // Tarea actual está en "En revisión" → según variant, target distinto
  // avanzar: revision → cerrada (igual que cerrar pero más temprano en flujo)
  // cerrar: revision → cerrada (definitivo, formulario completo)
  // bloquear: cualquier → bloqueado (off-flow)
  let nowIdx = 2; // En revisión
  let targetIdx = 3; // Cerrada
  if (isAvanzar) { nowIdx = 1; targetIdx = 2; } // En curso → En revisión

  return (
    <div className={scope} style={{minHeight:'100vh'}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <div className="ua-overlay">
        <style>{css}</style>

        {/* Faded tracker behind */}
        <div style={{position:'absolute',inset:0,opacity:0.18,pointerEvents:'none',padding:'40px 60px',color:t.muted,fontSize:13}}>
          <div style={{borderBottom:`1px solid ${t.rule}`,paddingBottom:14,marginBottom:24,fontSize:11,textTransform:'uppercase',letterSpacing:1.5,fontWeight:700}}>Tracker · Mis tareas</div>
          {ED_TRACKER.slice(0,9).map(r => (
            <div key={r.id} style={{display:'grid',gridTemplateColumns:'80px 1fr 120px 80px 80px 80px',gap:14,padding:'12px 0',borderBottom:`1px solid ${t.rule}`}}>
              <span>{r.id}</span><span>{r.name}</span><span>{r.resp.toUpperCase()}</span><span>{r.priority}</span><span>{r.status}</span><span>—</span>
            </div>
          ))}
        </div>

        <div className="ua-backdrop"/>

        <aside className="ua-panel">
          <span className="ua-x">×</span>

          <div className="ua-head">
            <div className="ua-eye">— Actualizar estado</div>
            <div className="ua-id">T-156 · Compliance GDPR LATAM</div>
            <div className="ua-title">Policy de data retention<br/>— revisión legal</div>
          </div>

          {/* Flow */}
          <div className="ua-flow">
            {flowSteps.map((s, i) => {
              const dotCls = i < nowIdx ? 'done' : i === nowIdx ? 'now' : i === targetIdx ? 'target' : '';
              const lblCls = i === nowIdx ? 'now' : i === targetIdx ? 'target' : '';
              return (
                <React.Fragment key={s.id}>
                  <div className="ua-flow-step">
                    <div className={`ua-flow-dot ${dotCls}`}/>
                    <div className={`ua-flow-lbl ${lblCls}`}>{s.lbl}</div>
                  </div>
                  {i < flowSteps.length - 1 && (
                    <div className={`ua-flow-line ${i < nowIdx ? 'done' : i === nowIdx ? 'target' : ''}`}/>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="ua-body">

            {/* Switch entre acciones disponibles */}
            <div className="ua-options">
              <div className={`ua-opt ${isAvanzar?'active':''}`}>
                <div className="ua-opt-lbl">Avanzar</div>
                <div className="ua-opt-name">→ Cerrada</div>
              </div>
              <div className={`ua-opt ${isCerrar?'active':''}`}>
                <div className="ua-opt-lbl">Cerrar</div>
                <div className="ua-opt-name">Marcar lista</div>
              </div>
              <div className={`ua-opt ${isBloquear?'active':''}`}>
                <div className="ua-opt-lbl">Bloquear</div>
                <div className="ua-opt-name">Por dependencia</div>
              </div>
            </div>

            {/* CERRAR variant */}
            {isCerrar && (
              <>
                <div className="ua-action cerrar">
                  <div className="ua-action-mark">✓</div>
                  <div>
                    <div className="ua-action-h">Estás a punto de cerrar esta tarea.</div>
                    <div className="ua-action-sub">
                      Quedará en historial con un resumen, los adjuntos finales y un registro de quién la cerró.
                      <b> Carlos Fernández</b> y <b>2 personas con acceso</b> recibirán una notificación.
                    </div>
                  </div>
                </div>

                <div className="ua-field">
                  <div className="ua-label">¿Qué se hizo? <span className="req">*</span></div>
                  <div className="ua-ai">
                    <div className="ua-ai-mark">A</div>
                    <div className="ua-ai-text">
                      Armé un borrador a partir de los <b>3 comentarios</b> y los <b>2 adjuntos finales</b>:
                      <i style={{display:'block',marginTop:4,color:t.muted}}>"Política revisada y aprobada por Privacy Officer. Se ajustaron los plazos de retención del art. 4 (de 7 a 5 años) y se incluyó cláusula de eliminación bajo solicitud. Lista para roll-out."</i>
                      <div className="ua-ai-actions">
                        <button className="ua-ai-btn">Usar este resumen</button>
                        <button className="ua-ai-btn">Reescribir</button>
                      </div>
                    </div>
                  </div>
                  <textarea className="ua-input ua-textarea" defaultValue="Política revisada y aprobada por Privacy Officer. Se ajustaron los plazos de retención del art. 4 (de 7 a 5 años) y se incluyó cláusula de eliminación bajo solicitud. Lista para roll-out."/>
                </div>

                <div className="ua-field">
                  <div className="ua-label">Adjuntar versión final <span className="opt">(recomendado)</span></div>
                  <div className="ua-att-row">
                    <div className="ua-att-row-icon drive">D</div>
                    <div className="ua-att-row-name">Data Retention Policy v4 — FINAL.pdf</div>
                    <div className="ua-att-row-meta">drive · 1.8 MB</div>
                    <span className="ua-att-row-x">×</span>
                  </div>
                  <div className="ua-att-add" style={{marginTop:6}}>
                    <div className="ua-att-card">
                      <div className="ua-att-icon drive">D</div>
                      <div>
                        <div className="ua-att-name">Drive</div>
                        <div className="ua-att-sub">Otro archivo</div>
                      </div>
                    </div>
                    <div className="ua-att-card">
                      <div className="ua-att-icon local">↑</div>
                      <div>
                        <div className="ua-att-name">Subir local</div>
                        <div className="ua-att-sub">PDF, Word, Excel</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ua-field">
                  <div className="ua-label">¿Quedó algo aprendido? <span className="opt">(opcional · alimenta la IA para próximas tareas similares)</span></div>
                  <textarea className="ua-input ua-textarea" placeholder="Ej: tener la opinión de Privacy antes de mover el draft acelera 2 días la revisión." style={{minHeight:60}}/>
                </div>

                <div className="ua-notif">
                  <div className="ua-notif-eye">— Avisaremos a 3 personas</div>
                  <div className="ua-notif-row">
                    <div className="ua-notif-av" style={{background:'#4A6B8A'}}>CF</div>
                    <span className="ua-notif-name">Carlos Fernández</span><span className="ua-notif-role">CO Lead</span>
                    <span className="ua-notif-tag">Creador</span>
                  </div>
                  <div className="ua-notif-row">
                    <div className="ua-notif-av" style={{background:'#3D6478'}}>MR</div>
                    <span className="ua-notif-name">María Restrepo</span><span className="ua-notif-role">Privacy</span>
                    <span className="ua-notif-tag" style={{color:t.dim}}>Acceso</span>
                  </div>
                  <div className="ua-notif-row">
                    <div className="ua-notif-av" style={{background:'#3D5A4A'}}>EG</div>
                    <span className="ua-notif-name">Enrique Gonzalez</span><span className="ua-notif-role">Global Head</span>
                    <span className="ua-notif-tag" style={{color:t.dim}}>Acceso</span>
                  </div>
                </div>
              </>
            )}

            {/* BLOQUEAR variant */}
            {isBloquear && (
              <>
                <div className="ua-action bloquear">
                  <div className="ua-action-mark">!</div>
                  <div>
                    <div className="ua-action-h">Marcar tarea como bloqueada.</div>
                    <div className="ua-action-sub">
                      La tarea queda en pausa hasta que se resuelva la dependencia.
                      <b> Carlos Fernández</b> recibe una notificación inmediata para destrabar.
                    </div>
                  </div>
                </div>

                <div className="ua-field">
                  <div className="ua-label">¿Qué te bloquea? <span className="req">*</span></div>
                  <div className="ua-pills">
                    <button className="ua-pill-btn crit active">Esperando respuesta</button>
                    <button className="ua-pill-btn">Falta documento</button>
                    <button className="ua-pill-btn">Decisión externa</button>
                    <button className="ua-pill-btn">Riesgo nuevo</button>
                    <button className="ua-pill-btn">Otro</button>
                  </div>
                </div>

                <div className="ua-field">
                  <div className="ua-label">Detalles <span className="req">*</span></div>
                  <textarea className="ua-input ua-textarea" defaultValue="RR.HH. lleva 4 días sin responder sobre el contrato del demandante. Sin esa información no puedo redactar la respuesta a la demanda laboral."/>
                </div>

                <div className="ua-field">
                  <div className="ua-label">¿Quién puede destrabarte? <span className="req">*</span></div>
                  <div className="ua-att-row">
                    <div className="ua-notif-av" style={{background:'#5A7050'}}>RH</div>
                    <span className="ua-att-row-name">RR.HH. — Andrea Bermúdez</span>
                    <span className="ua-att-row-meta">@a.bermudez</span>
                    <span className="ua-att-row-x">×</span>
                  </div>
                  <div className="ua-att-row">
                    <div className="ua-notif-av" style={{background:'#4A6B8A'}}>CF</div>
                    <span className="ua-att-row-name">Carlos Fernández</span>
                    <span className="ua-att-row-meta">CO Lead</span>
                    <span className="ua-att-row-x">×</span>
                  </div>
                </div>

                <div className="ua-field">
                  <div className="ua-label">Reintentar en</div>
                  <div className="ua-pills">
                    <button className="ua-pill-btn">Mañana</button>
                    <button className="ua-pill-btn active">En 2 días</button>
                    <button className="ua-pill-btn">En 1 semana</button>
                    <button className="ua-pill-btn">Cuando me avisen</button>
                  </div>
                </div>

                <div className="ua-notif">
                  <div className="ua-notif-eye">— El bloqueo aparece en los Homes de</div>
                  <div className="ua-notif-row">
                    <div className="ua-notif-av" style={{background:'#5A7050'}}>RH</div>
                    <span className="ua-notif-name">Andrea (RR.HH.)</span>
                    <span className="ua-notif-tag">Acción requerida</span>
                  </div>
                  <div className="ua-notif-row">
                    <div className="ua-notif-av" style={{background:'#4A6B8A'}}>CF</div>
                    <span className="ua-notif-name">Carlos Fernández</span>
                    <span className="ua-notif-tag">Para destrabar</span>
                  </div>
                </div>
              </>
            )}

            {/* AVANZAR variant */}
            {isAvanzar && (
              <>
                <div className="ua-action avanzar">
                  <div className="ua-action-mark">→</div>
                  <div>
                    <div className="ua-action-h">Mandala a revisión.</div>
                    <div className="ua-action-sub">
                      Pasa a manos del revisor. Vos quedás como autor original; el revisor podrá pedir cambios o aprobar.
                    </div>
                  </div>
                </div>

                <div className="ua-field">
                  <div className="ua-label">Revisor <span className="req">*</span> <span className="opt">(IA sugiere quien revisó casos similares)</span></div>
                  <div className="ua-att-row">
                    <div className="ua-notif-av" style={{background:'#3D6478'}}>MR</div>
                    <span className="ua-att-row-name">María Restrepo</span>
                    <span className="ua-att-row-meta">Privacy · 12 revisiones</span>
                    <span className="ua-att-row-x">×</span>
                  </div>
                </div>

                <div className="ua-field">
                  <div className="ua-label">Nota para el revisor <span className="opt">(opcional)</span></div>
                  <textarea className="ua-input ua-textarea" placeholder="Ej: revisar especialmente los plazos del art. 4. El resto está alineado con el template."/>
                </div>

                <div className="ua-field">
                  <div className="ua-label">¿Cuándo necesitás que esté revisada?</div>
                  <div className="ua-pills">
                    <button className="ua-pill-btn">Hoy</button>
                    <button className="ua-pill-btn active">Mañana</button>
                    <button className="ua-pill-btn">En 2 días</button>
                    <button className="ua-pill-btn">Sin urgencia</button>
                  </div>
                </div>
              </>
            )}

          </div>

          <div className="ua-foot">
            <div className="ua-foot-info">
              {isCerrar && <><b>Al cerrar:</b> queda en historial · alimenta el aprendizaje · libera 1 slot en tu carga.</>}
              {isBloquear && <><b>Al bloquear:</b> la tarea no consume tu capacidad y se reactiva sola al cumplirse el plazo.</>}
              {isAvanzar && <><b>Al avanzar:</b> la tarea pasa a la cola de revisión del responsable elegido.</>}
            </div>
            <button className="ed-btn">Cancelar</button>
            <button className="ed-btn accent">
              {isCerrar && 'Cerrar tarea ✓'}
              {isBloquear && 'Marcar bloqueada'}
              {isAvanzar && 'Mandar a revisión →'}
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { EdActualizar });
