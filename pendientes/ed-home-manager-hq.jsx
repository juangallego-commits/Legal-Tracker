// ═══════════════════════════════════════════════════════════════
// EDITORIAL — CREAR TAREA (paso 1 vacío + paso 2 con sugerencias IA)
// ═══════════════════════════════════════════════════════════════

function EdCrear({ theme = 'light', step = 1 }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .cr-overlay { position:relative; padding:0; min-height:100vh; background:${t.bg}; }
    .cr-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.32); backdrop-filter:blur(2px); }
    .cr-modal { position:relative; background:${t.paper}; max-width:780px; margin:60px auto; border:1px solid ${t.rule}; border-radius:6px; box-shadow:0 30px 80px rgba(0,0,0,.18); }
    .cr-head { padding:24px 32px; border-bottom:1px solid ${t.rule}; display:flex; align-items:center; gap:14px; }
    .cr-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; }
    .cr-title { font-family:'Fraunces',Georgia,serif; font-size:24px; font-weight:400; letter-spacing:-.5px; }
    .cr-x { margin-left:auto; color:${t.dim}; cursor:pointer; font-size:20px; }
    .cr-body { padding:32px; }

    .cr-steps { display:flex; gap:0; padding:0 32px; border-bottom:1px solid ${t.rule}; }
    .cr-step { padding:12px 0; margin-right:28px; font-size:11px; color:${t.muted}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; border-bottom:2px solid transparent; margin-bottom:-1px; display:flex; gap:8px; align-items:center; }
    .cr-step.active { color:${t.ink}; border-color:${t.accent}; }
    .cr-step.done { color:${t.good}; }
    .cr-step-num { font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:300; font-size:18px; line-height:1; }

    .cr-field { margin-bottom:22px; }
    .cr-label { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:8px; }
    .cr-label .req { color:${t.critical}; }
    .cr-label .ai { font-size:9px; color:${t.accent}; padding:2px 6px; background:${t.accentSoft}; border-radius:3px; font-weight:800; letter-spacing:.5px; }
    .cr-input { width:100%; padding:11px 14px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:4px; font-family:inherit; font-size:14px; color:${t.ink}; box-sizing:border-box; }
    .cr-input:focus { outline:none; border-color:${t.accent}; }
    .cr-input.title { font-family:'Fraunces',Georgia,serif; font-size:20px; font-weight:400; letter-spacing:-.3px; padding:14px 16px; }
    .cr-textarea { min-height:90px; resize:vertical; font-family:inherit; line-height:1.5; }

    .cr-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .cr-grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }

    /* AI suggestion strip */
    .cr-ai { background:${t.accentSoft}; border-left:3px solid ${t.accent}; padding:14px 16px; border-radius:0 4px 4px 0; margin-bottom:22px; display:flex; gap:12px; align-items:flex-start; }
    .cr-ai-mark { width:24px; height:24px; border-radius:50%; background:${t.accent}; color:#fff; display:grid; place-items:center; font-weight:800; font-size:11px; flex-shrink:0; font-family:'Fraunces',Georgia,serif; font-style:italic; }
    .cr-ai-text { font-size:12.5px; line-height:1.5; color:${t.ink}; flex:1; }
    .cr-ai-text b { font-weight:700; }
    .cr-ai-text .crit { color:${t.critical}; font-weight:700; }
    .cr-ai-actions { display:flex; gap:8px; margin-top:8px; }
    .cr-ai-btn { font-size:10.5px; padding:5px 10px; background:${t.paper}; border:1px solid ${t.rule}; border-radius:3px; cursor:pointer; font-weight:700; color:${t.ink}; text-transform:uppercase; letter-spacing:.6px; font-family:inherit; }
    .cr-ai-btn.primary { background:${t.accent}; color:#fff; border-color:${t.accent}; }

    .cr-pills-row { display:flex; gap:6px; flex-wrap:wrap; }
    .cr-pill-btn { padding:7px 12px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:3px; font-size:12px; cursor:pointer; font-weight:600; color:${t.ink}; font-family:inherit; }
    .cr-pill-btn.active { background:${t.ink}; color:${t.bg}; border-color:${t.ink}; }
    .cr-pill-btn.alta.active { background:${t.critical}; border-color:${t.critical}; color:#fff; }
    .cr-pill-btn.media.active { background:${t.warn}; border-color:${t.warn}; color:#fff; }
    .cr-pill-btn.baja.active { background:${t.good}; border-color:${t.good}; color:#fff; }

    .cr-foot { padding:20px 32px; border-top:1px solid ${t.rule}; display:flex; gap:10px; align-items:center; }
    .cr-foot-info { font-size:11.5px; color:${t.dim}; flex:1; }
    .cr-foot-info b { color:${t.ink}; font-weight:700; }

    .cr-summary { background:${t.paper2}; padding:18px 20px; border-radius:4px; margin-bottom:22px; }
    .cr-summary-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:8px; }
    .cr-summary-title { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:400; line-height:1.3; margin-bottom:10px; }
    .cr-summary-meta { display:flex; gap:6px; flex-wrap:wrap; }

    .cr-mini-row { display:flex; gap:14px; padding:10px 0; border-bottom:1px solid ${t.rule}; align-items:center; font-size:13px; }
    .cr-mini-row:last-child { border-bottom:none; }
    .cr-mini-lbl { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; min-width:120px; }
    .cr-mini-val { color:${t.ink}; font-weight:600; flex:1; }
  `;
  const css = edScope(scope, rawCSS);

  return (
    <div className={scope} style={{minHeight:'100vh',background:t.bg,fontFamily:"'Nunito Sans',sans-serif",position:'relative'}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <style>{css}</style>
      {/* Faded tracker behind */}
      <div style={{position:'absolute',inset:0,opacity:0.25,pointerEvents:'none',padding:'40px 60px',color:t.muted,fontSize:13}}>
        <div style={{borderBottom:`1px solid ${t.rule}`,paddingBottom:14,marginBottom:24,fontSize:11,textTransform:'uppercase',letterSpacing:1.5,fontWeight:700}}>Tracker · Equipo CO</div>
        {ED_TRACKER.slice(0,8).map(r => (
          <div key={r.id} style={{display:'grid',gridTemplateColumns:'80px 1fr 120px 80px 80px 80px',gap:14,padding:'12px 0',borderBottom:`1px solid ${t.rule}`}}>
            <span>{r.id}</span><span>{r.name}</span><span>{r.resp.toUpperCase()}</span><span>{r.priority}</span><span>{r.status}</span><span>—</span>
          </div>
        ))}
      </div>

      <div className="cr-backdrop"/>
      <div className="cr-modal">
        <div className="cr-head">
          <div>
            <div className="cr-eye">Crear nueva tarea</div>
            <div className="cr-title">{step === 1 ? 'Empecemos por lo esencial' : 'Revisá y publicá'}</div>
          </div>
          <span className="cr-x">×</span>
        </div>

        <div className="cr-steps">
          <div className={`cr-step ${step >= 1 ? (step === 1 ? 'active' : 'done') : ''}`}>
            <span className="cr-step-num">01</span> Esencial
          </div>
          <div className={`cr-step ${step === 2 ? 'active' : ''}`}>
            <span className="cr-step-num">02</span> Detalles + sugerencias
          </div>
          <div className="cr-step">
            <span className="cr-step-num">03</span> Confirmar
          </div>
        </div>

        <div className="cr-body">
          {step === 1 ? (
            <>
              <div className="cr-field">
                <div className="cr-label">Título de la tarea <span className="req">*</span></div>
                <input className="cr-input title" defaultValue="Revisar contrato proveedor logística — Bogotá" />
              </div>

              <div className="cr-field">
                <div className="cr-label">Descripción / contexto</div>
                <textarea className="cr-input cr-textarea" defaultValue="Contrato framework con nuevo partner de logística para última milla en Bogotá. Cláusulas de penalidad y exclusividad necesitan revisión legal completa antes de firma del 30 abril."/>
              </div>

              <div className="cr-grid2">
                <div className="cr-field">
                  <div className="cr-label">Tipo</div>
                  <div className="cr-pills-row">
                    <button className="cr-pill-btn active">Contractual</button>
                    <button className="cr-pill-btn">Regulatorio</button>
                    <button className="cr-pill-btn">Contencioso</button>
                    <button className="cr-pill-btn">Privacy</button>
                  </div>
                </div>
                <div className="cr-field">
                  <div className="cr-label">País</div>
                  <div className="cr-pills-row">
                    <button className="cr-pill-btn active">Colombia</button>
                    <button className="cr-pill-btn">México</button>
                    <button className="cr-pill-btn">Brasil</button>
                    <button className="cr-pill-btn">+ otros</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="cr-summary">
                <div className="cr-summary-eye">Tarea</div>
                <div className="cr-summary-title">Revisar contrato proveedor logística — Bogotá</div>
                <div className="cr-summary-meta">
                  <span className="ed-pill curso">Contractual</span>
                  <span className="ed-pill curso">Colombia</span>
                </div>
              </div>

              <div className="cr-ai">
                <div className="cr-ai-mark">A</div>
                <div className="cr-ai-text">
                  <b>Sugerencia basada en tareas similares cerradas:</b><br/>
                  Tareas contractuales de revisión de contrato framework en CO se cerraron en
                  promedio en <b>5.2 días</b> con prioridad Media. Recomiendo asignar a <b>Carlos Fernández</b> (3 contratos similares cerrados a tiempo).
                  <span className="crit"> Si el contrato es para firma antes del 30 abril, marcalo como Alta.</span>
                  <div className="cr-ai-actions">
                    <button className="cr-ai-btn primary">Aplicar sugerencias</button>
                    <button className="cr-ai-btn">Ignorar</button>
                  </div>
                </div>
              </div>

              <div className="cr-grid3">
                <div className="cr-field">
                  <div className="cr-label">Prioridad <span className="ai">Sugerido: Alta</span></div>
                  <div className="cr-pills-row">
                    <button className="cr-pill-btn alta active">Alta</button>
                    <button className="cr-pill-btn media">Media</button>
                    <button className="cr-pill-btn baja">Baja</button>
                  </div>
                </div>
                <div className="cr-field">
                  <div className="cr-label">Riesgo</div>
                  <div className="cr-pills-row">
                    <button className="cr-pill-btn">Legal alto</button>
                    <button className="cr-pill-btn active">Operativo</button>
                    <button className="cr-pill-btn">Reputacional</button>
                  </div>
                </div>
                <div className="cr-field">
                  <div className="cr-label">SLA <span className="ai">Calculado: 2d</span></div>
                  <input className="cr-input" defaultValue="2 días" />
                </div>
              </div>

              <div className="cr-grid2">
                <div className="cr-field">
                  <div className="cr-label">Responsable <span className="ai">Sugerido: Carlos F.</span></div>
                  <input className="cr-input" defaultValue="Carlos E. Fernández (CO Lead)"/>
                </div>
                <div className="cr-field">
                  <div className="cr-label">Deadline <span className="req">*</span></div>
                  <input className="cr-input" defaultValue="30 abril 2025"/>
                </div>
              </div>

              <div className="cr-field">
                <div className="cr-label">Vincular a proyecto <span className="ai">Match: 92%</span></div>
                <div className="cr-pills-row">
                  <button className="cr-pill-btn active">Legal Tracker</button>
                  <button className="cr-pill-btn">+ Ninguno</button>
                  <button className="cr-pill-btn">+ Crear nuevo</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="cr-foot">
          <div className="cr-foot-info">
            {step === 1 ? <>Próximo paso: <b>la IA va a sugerir</b> prioridad, responsable y SLA según tu descripción.</> : <>Al publicar, <b>Carlos Fernández</b> recibirá notificación y la tarea aparecerá en su tracker.</>}
          </div>
          <button className="ed-btn">Cancelar</button>
          {step === 1 ? <button className="ed-btn accent">Continuar →</button> : <><button className="ed-btn">← Volver</button><button className="ed-btn accent">Publicar tarea</button></>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EdCrear });
