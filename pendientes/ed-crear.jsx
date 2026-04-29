// ═══════════════════════════════════════════════════════════════
// EDITORIAL — CREAR TAREA
// Paso 1 esencial · Paso 2 sugerencias IA + visibilidad + adjuntos · Paso 3 confirmación
// ═══════════════════════════════════════════════════════════════

const ED_VISIBILITY_PEOPLE = [
  { id: 'cf', name: 'Carlos Fernández', role: 'CO Lead', color: '#4A6B8A', avatar: 'CF', selected: true },
  { id: 'jc', name: 'Juan Camilo Ruiz', role: 'Specialist', color: '#B8551F', avatar: 'JC', selected: true },
  { id: 'ab', name: 'Ana Bravo', role: 'HQ Legal', color: '#6B4D7A', avatar: 'AB', selected: false },
  { id: 'mr', name: 'María Restrepo', role: 'Privacy Officer', color: '#3D6478', avatar: 'MR', selected: true },
  { id: 'jm', name: 'Juan Manuel López', role: 'Specialist', color: '#A57F2C', avatar: 'JM', selected: false },
  { id: 'fc', name: 'Felipe Correa', role: 'Comercial', color: '#5A7050', avatar: 'FC', selected: false },
];

function EdCrear({ theme = 'light', step = 1 }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .cr-overlay { position:relative; padding:0; min-height:100vh; background:${t.bg}; }
    .cr-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.32); backdrop-filter:blur(2px); }
    .cr-modal { position:relative; background:${t.paper}; max-width:820px; margin:60px auto; border:1px solid ${t.rule}; border-radius:6px; box-shadow:0 30px 80px rgba(0,0,0,.18); }
    .cr-head { padding:24px 32px; border-bottom:1px solid ${t.rule}; display:flex; align-items:center; gap:14px; }
    .cr-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; }
    .cr-title { font-family:'Fraunces',Georgia,serif; font-size:24px; font-weight:400; letter-spacing:-.5px; }
    .cr-x { margin-left:auto; color:${t.dim}; cursor:pointer; font-size:20px; }
    .cr-body { padding:28px 32px; }

    .cr-steps { display:flex; gap:0; padding:0 32px; border-bottom:1px solid ${t.rule}; }
    .cr-step { padding:12px 0; margin-right:28px; font-size:11px; color:${t.muted}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; border-bottom:2px solid transparent; margin-bottom:-1px; display:flex; gap:8px; align-items:center; }
    .cr-step.active { color:${t.ink}; border-color:${t.accent}; }
    .cr-step.done { color:${t.good}; }
    .cr-step-num { font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:300; font-size:18px; line-height:1; }

    .cr-field { margin-bottom:20px; }
    .cr-label { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:8px; }
    .cr-label .req { color:${t.warn}; }
    .cr-label .ai { font-size:9px; color:${t.accent}; padding:2px 6px; background:${t.accentSoft}; border-radius:3px; font-weight:800; letter-spacing:.5px; }
    .cr-input { width:100%; padding:11px 14px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:4px; font-family:inherit; font-size:14px; color:${t.ink}; box-sizing:border-box; }
    .cr-input:focus { outline:none; border-color:${t.accent}; }
    .cr-input.title { font-family:'Fraunces',Georgia,serif; font-size:20px; font-weight:400; letter-spacing:-.3px; padding:14px 16px; }
    .cr-textarea { min-height:84px; resize:vertical; font-family:inherit; line-height:1.5; }

    .cr-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .cr-grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }

    .cr-ai { background:${t.accentSoft}; border-left:3px solid ${t.accent}; padding:14px 16px; border-radius:0 4px 4px 0; margin-bottom:22px; display:flex; gap:12px; align-items:flex-start; }
    .cr-ai-mark { width:24px; height:24px; border-radius:50%; background:${t.accent}; color:#fff; display:grid; place-items:center; font-weight:800; font-size:11px; flex-shrink:0; font-family:'Fraunces',Georgia,serif; font-style:italic; }
    .cr-ai-text { font-size:12.5px; line-height:1.5; color:${t.ink}; flex:1; }
    .cr-ai-text b { font-weight:700; }
    .cr-ai-actions { display:flex; gap:8px; margin-top:8px; }
    .cr-ai-btn { font-size:10.5px; padding:5px 10px; background:${t.paper}; border:1px solid ${t.rule}; border-radius:3px; cursor:pointer; font-weight:700; color:${t.ink}; text-transform:uppercase; letter-spacing:.6px; font-family:inherit; }
    .cr-ai-btn.primary { background:${t.accent}; color:#fff; border-color:${t.accent}; }

    .cr-pills-row { display:flex; gap:6px; flex-wrap:wrap; }
    .cr-pill-btn { padding:7px 12px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:3px; font-size:12px; cursor:pointer; font-weight:600; color:${t.ink}; font-family:inherit; }
    .cr-pill-btn.active { background:${t.ink}; color:${t.bg}; border-color:${t.ink}; }
    .cr-pill-btn.alta.active { background:${t.critical}; border-color:${t.critical}; color:#fff; }
    .cr-pill-btn.media.active { background:${t.warn}; border-color:${t.warn}; color:#fff; }
    .cr-pill-btn.baja.active { background:${t.good}; border-color:${t.good}; color:#fff; }

    .cr-foot { padding:18px 32px; border-top:1px solid ${t.rule}; display:flex; gap:10px; align-items:center; }
    .cr-foot-info { font-size:11.5px; color:${t.dim}; flex:1; line-height:1.45; }
    .cr-foot-info b { color:${t.ink}; font-weight:700; }

    /* Visibility */
    .cr-vis-list { border:1px solid ${t.rule}; border-radius:4px; max-height:170px; overflow-y:auto; }
    .cr-vis-row { display:flex; align-items:center; gap:12px; padding:9px 12px; border-bottom:1px solid ${t.rule}; cursor:pointer; }
    .cr-vis-row:last-child { border-bottom:none; }
    .cr-vis-row:hover { background:${t.ruleSoft}; }
    .cr-vis-check { width:16px; height:16px; border:1.5px solid ${t.muted}; border-radius:3px; display:grid; place-items:center; flex-shrink:0; }
    .cr-vis-check.on { background:${t.accent}; border-color:${t.accent}; color:#fff; font-size:11px; font-weight:800; }
    .cr-vis-av { width:26px; height:26px; border-radius:6px; display:grid; place-items:center; color:#fff; font-weight:800; font-size:10px; flex-shrink:0; }
    .cr-vis-name { font-size:13px; font-weight:700; color:${t.ink}; }
    .cr-vis-role { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1px; font-weight:700; }
    .cr-vis-add { font-size:12px; color:${t.accent}; padding:8px 12px; cursor:pointer; font-weight:700; }
    .cr-vis-note { font-size:11.5px; color:${t.muted}; margin-top:8px; line-height:1.4; padding:8px 12px; background:${t.paper2}; border-radius:3px; }
    .cr-vis-note b { color:${t.ink}; font-weight:700; }

    /* Attachments */
    .cr-att-options { display:flex; gap:8px; }
    .cr-att-card { flex:1; border:1px dashed ${t.rule}; border-radius:4px; padding:14px; display:flex; align-items:center; gap:12px; cursor:pointer; transition:.12s; }
    .cr-att-card:hover { border-color:${t.accent}; background:${t.accentSoft}; }
    .cr-att-icon { width:32px; height:32px; border-radius:6px; background:${t.paper2}; display:grid; place-items:center; flex-shrink:0; }
    .cr-att-name { font-size:13px; font-weight:700; color:${t.ink}; }
    .cr-att-sub { font-size:11px; color:${t.dim}; margin-top:1px; }

    .cr-att-list { margin-top:10px; }
    .cr-att-row { display:flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid ${t.rule}; border-radius:4px; margin-bottom:6px; background:${t.paper2}; }
    .cr-att-row-icon { width:24px; height:24px; border-radius:4px; display:grid; place-items:center; flex-shrink:0; font-size:10px; font-weight:800; color:#fff; }
    .cr-att-row-icon.drive { background:#1a73e8; }
    .cr-att-row-icon.local { background:${t.muted}; }
    .cr-att-row-name { font-size:12.5px; color:${t.ink}; font-weight:600; flex:1; }
    .cr-att-row-meta { font-size:10.5px; color:${t.dim}; font-family:'JetBrains Mono',monospace; }
    .cr-att-row-x { color:${t.dim}; cursor:pointer; font-size:14px; }

    /* Sugerencias de nombre */
    .cr-name-suggest { margin-top:14px; padding:14px 0 4px; border-top:1px solid ${t.rule}; }
    .cr-name-suggest-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; margin-bottom:10px; }
    .cr-name-chip { display:flex; align-items:center; justify-content:space-between; gap:14px; width:100%; padding:9px 12px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:4px; margin-bottom:6px; cursor:pointer; font-family:inherit; text-align:left; transition:.12s; }
    .cr-name-chip:hover { border-color:${t.accent}; background:${t.accentSoft}; }
    .cr-name-chip-txt { font-size:13px; color:${t.ink}; font-weight:600; line-height:1.3; }
    .cr-name-chip-meta { font-size:10.5px; color:${t.dim}; font-family:'JetBrains Mono',monospace; white-space:nowrap; flex-shrink:0; }

    .cr-ai-list { margin:6px 0 0 0; padding-left:16px; font-size:12.5px; line-height:1.6; }
    .cr-ai-list li { margin-bottom:2px; }

    /* Step 3 confirm */
    .cr-conf { padding:0; }
    .cr-conf-banner { background:${t.goodSoft||'rgba(74,124,89,.10)'}; border-left:3px solid ${t.good}; padding:14px 16px; margin-bottom:24px; display:flex; gap:12px; align-items:center; border-radius:0 4px 4px 0; }
    .cr-conf-mark { width:30px; height:30px; border-radius:50%; background:${t.good}; color:#fff; display:grid; place-items:center; font-weight:800; flex-shrink:0; font-size:14px; }
    .cr-conf-msg { font-size:13.5px; color:${t.ink}; line-height:1.45; }
    .cr-conf-msg b { font-weight:700; }
    .cr-conf-title { font-family:'Fraunces',Georgia,serif; font-size:22px; font-weight:400; line-height:1.3; margin-bottom:14px; letter-spacing:-.3px; }
    .cr-conf-pills { display:flex; gap:6px; margin-bottom:24px; flex-wrap:wrap; }
    .cr-conf-grid { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:${t.rule}; border:1px solid ${t.rule}; margin-bottom:22px; }
    .cr-conf-cell { background:${t.paper}; padding:12px 14px; }
    .cr-conf-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-bottom:4px; }
    .cr-conf-val { font-size:13px; color:${t.ink}; font-weight:600; }
    .cr-conf-section { margin-bottom:20px; }
    .cr-conf-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:10px; }
    .cr-conf-people { display:flex; flex-wrap:wrap; gap:8px; }
    .cr-conf-person { display:flex; align-items:center; gap:8px; padding:6px 10px 6px 6px; background:${t.paper2}; border-radius:20px; }
    .cr-conf-pav { width:22px; height:22px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:800; font-size:9px; }
    .cr-conf-pname { font-size:12px; color:${t.ink}; font-weight:700; }
  `;
  const css = edScope(scope, rawCSS);

  const selectedPeople = ED_VISIBILITY_PEOPLE.filter(p => p.selected);

  return (
    <div className={scope} style={{minHeight:'100vh',background:t.bg,fontFamily:"'Nunito Sans',sans-serif",position:'relative'}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <style>{css}</style>
      {/* Faded tracker behind */}
      <div style={{position:'absolute',inset:0,opacity:0.22,pointerEvents:'none',padding:'40px 60px',color:t.muted,fontSize:13}}>
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
            <div className="cr-title">
              {step === 1 && 'Empecemos por lo esencial'}
              {step === 2 && 'Detalles, equipo y adjuntos'}
              {step === 3 && 'Listo para publicar'}
            </div>
          </div>
          <span className="cr-x">×</span>
        </div>

        <div className="cr-steps">
          <div className={`cr-step ${step >= 2 ? 'done' : step === 1 ? 'active' : ''}`}><span className="cr-step-num">01</span> Esencial</div>
          <div className={`cr-step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}><span className="cr-step-num">02</span> Detalles</div>
          <div className={`cr-step ${step === 3 ? 'active' : ''}`}><span className="cr-step-num">03</span> Confirmar</div>
        </div>

        <div className="cr-body">
          {step === 1 && (
            <>
              <div className="cr-field">
                <div className="cr-label">Título de la tarea <span className="req">*</span> <span className="ai">3 sugerencias</span></div>
                <input className="cr-input title" defaultValue="Revisar contrato proveedor logística — Bogotá" />
                <div className="cr-name-suggest">
                  <div className="cr-name-suggest-eye">Tareas similares en tu equipo se llamaron así —</div>
                  <button className="cr-name-chip">
                    <span className="cr-name-chip-txt">Revisión contrato framework — proveedor logística CO</span>
                    <span className="cr-name-chip-meta">5 tareas · cierre 5.2d</span>
                  </button>
                  <button className="cr-name-chip">
                    <span className="cr-name-chip-txt">Contrato última milla — cláusulas penalidad y exclusividad</span>
                    <span className="cr-name-chip-meta">3 tareas · cierre 6.0d</span>
                  </button>
                  <button className="cr-name-chip">
                    <span className="cr-name-chip-txt">Revisión legal contrato proveedor delivery — Bogotá</span>
                    <span className="cr-name-chip-meta">2 tareas · cierre 4.8d</span>
                  </button>
                </div>
              </div>
              <div className="cr-field">
                <div className="cr-label">Descripción / contexto</div>
                <textarea className="cr-input cr-textarea" defaultValue="Contrato framework con nuevo partner de logística para última milla en Bogotá. Las cláusulas de penalidad y exclusividad necesitan revisión legal antes de firma del 30 abril."/>
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
          )}

          {step === 2 && (
            <>
              <div className="cr-ai">
                <div className="cr-ai-mark">A</div>
                <div className="cr-ai-text">
                  <b>Lo que aprendimos de tareas similares anteriores —</b>
                  <ul className="cr-ai-list">
                    <li><b>Cierran en ~5 días.</b> Pre-cargamos SLA de 2d y deadline al 30 abr.</li>
                    <li><b>Carlos Fernández</b> es quien más las cerró a tiempo (3 de 3). Lo ponemos como responsable.</li>
                    <li>Por la fecha de firma (30 abr), te sugerimos prioridad <b>Alta</b>.</li>
                  </ul>
                  <div className="cr-ai-actions">
                    <button className="cr-ai-btn primary">Aplicar las 3</button>
                    <button className="cr-ai-btn">Editar</button>
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
                  <div className="cr-label">Nivel de riesgo</div>
                  <div className="cr-pills-row">
                    <button className="cr-pill-btn alta active">Alto</button>
                    <button className="cr-pill-btn media">Medio</button>
                    <button className="cr-pill-btn baja">Bajo</button>
                  </div>
                </div>
                <div className="cr-field">
                  <div className="cr-label">SLA <span className="ai">Calculado: 2d</span></div>
                  <input className="cr-input" defaultValue="2 días" />
                </div>
              </div>

              <div className="cr-grid2">
                <div className="cr-field">
                  <div className="cr-label">Responsable <span className="ai">Sugerido</span></div>
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
                  <button className="cr-pill-btn">Mapping litigio CO</button>
                  <button className="cr-pill-btn">+ Crear nuevo</button>
                </div>
              </div>

              {/* CONFIDENCIALIDAD */}
              <div className="cr-field">
                <div className="cr-label">Nivel de confidencialidad</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {[ED_CONF_LEVELS.estandar, ED_CONF_LEVELS.restringido, ED_CONF_LEVELS.confidencial].map((lv, i) => (
                    <div key={lv.id} style={{
                      padding:'12px 14px',
                      border:`1px solid ${i === 0 ? lv.dot : t.rule}`,
                      background:i === 0 ? lv.band : t.paper2,
                      borderRadius:5,
                      cursor:'pointer',
                    }}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                        <span style={{width:10,height:10,borderRadius:'50%',background:lv.dot}}></span>
                        <span style={{fontWeight:800,fontSize:12,color:i === 0 ? lv.bandInk : t.ink,textTransform:'uppercase',letterSpacing:.5}}>{lv.label}</span>
                        {i === 0 && <span style={{marginLeft:'auto',fontSize:9,color:lv.bandInk,fontWeight:800,letterSpacing:.6}}>SELECCIONADO</span>}
                      </div>
                      <div style={{fontSize:11,color:t.muted,lineHeight:1.45}}>{lv.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11.5,color:t.dim,marginTop:8,lineHeight:1.5}}>
                  <b style={{color:t.ink}}>Default: Estándar.</b> Cualquiera del equipo puede cambiar el nivel después. Confidencial añade watermark a documentos.
                </div>
              </div>

              {/* VISIBILIDAD */}
              <div className="cr-field">
                <div className="cr-label">Quién más puede ver y comentar esta tarea</div>
                <div className="cr-vis-list">
                  {ED_VISIBILITY_PEOPLE.map(p => (
                    <div key={p.id} className="cr-vis-row">
                      <div className={`cr-vis-check ${p.selected?'on':''}`}>{p.selected?'✓':''}</div>
                      <div className="cr-vis-av" style={{background:p.color}}>{p.avatar}</div>
                      <div style={{flex:1}}>
                        <div className="cr-vis-name">{p.name}</div>
                        <div className="cr-vis-role">{p.role}</div>
                      </div>
                    </div>
                  ))}
                  <div className="cr-vis-add">+ Agregar más personas…</div>
                </div>
                <div className="cr-vis-note">
                  <b>Las personas que selecciones</b> recibirán una notificación de que tienen acceso (cc) a esta tarea
                  y podrán seguir su avance.
                </div>
              </div>

              {/* ADJUNTOS */}
              <div className="cr-field">
                <div className="cr-label">Adjuntar documentos</div>
                <div className="cr-att-options">
                  <div className="cr-att-card">
                    <div className="cr-att-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M7 16l3-5h7l-3 5H7z" fill="#1a73e8"/>
                        <path d="M11 5l-4 6 3 5 4-6-3-5z" fill="#fbbc04"/>
                        <path d="M17 11l-3 5h-7l3 5h7l3-5-3-5z" fill="#34a853"/>
                      </svg>
                    </div>
                    <div>
                      <div className="cr-att-name">Google Drive</div>
                      <div className="cr-att-sub">Elegí archivos del workspace</div>
                    </div>
                  </div>
                  <div className="cr-att-card">
                    <div className="cr-att-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <div>
                      <div className="cr-att-name">Subir archivo local</div>
                      <div className="cr-att-sub">PDF, Word, Excel · hasta 25 MB</div>
                    </div>
                  </div>
                </div>

                <div className="cr-att-list">
                  <div className="cr-att-row">
                    <div className="cr-att-row-icon drive">D</div>
                    <div className="cr-att-row-name">Contrato framework — Logística Express v3.docx</div>
                    <div className="cr-att-row-meta">drive · 1.2 MB</div>
                    <span className="cr-att-row-x">×</span>
                  </div>
                  <div className="cr-att-row">
                    <div className="cr-att-row-icon drive">D</div>
                    <div className="cr-att-row-name">Anexo — Penalidades y SLA.pdf</div>
                    <div className="cr-att-row-meta">drive · 480 KB</div>
                    <span className="cr-att-row-x">×</span>
                  </div>
                  <div className="cr-att-row">
                    <div className="cr-att-row-icon local">↑</div>
                    <div className="cr-att-row-name">notas-revision-comercial.pdf</div>
                    <div className="cr-att-row-meta">local · 312 KB</div>
                    <span className="cr-att-row-x">×</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="cr-conf">
              <div className="cr-conf-banner">
                <div className="cr-conf-mark">✓</div>
                <div className="cr-conf-msg">
                  Todo listo para publicar. Una vez confirmes, <b>Carlos Fernández</b> recibirá la tarea
                  y las personas con acceso (cc) recibirán una notificación.
                </div>
              </div>

              <div className="cr-conf-section">
                <div className="cr-conf-eye">— Resumen</div>
                <div className="cr-conf-title">Revisar contrato proveedor logística — Bogotá</div>
                <div className="cr-conf-pills">
                  <span className="ed-pill alta">Prioridad alta</span>
                  <span className="ed-pill alta">Riesgo alto</span>
                  <span className="ed-pill curso">Contractual</span>
                  <span className="ed-pill curso">Colombia</span>
                  <span className="ed-pill curso">Legal Tracker</span>
                </div>
                <div className="cr-conf-grid">
                  <div className="cr-conf-cell"><div className="cr-conf-lbl">Responsable</div><div className="cr-conf-val">Carlos E. Fernández (CO Lead)</div></div>
                  <div className="cr-conf-cell"><div className="cr-conf-lbl">Creada por</div><div className="cr-conf-val">Juan Camilo (vos)</div></div>
                  <div className="cr-conf-cell"><div className="cr-conf-lbl">Deadline</div><div className="cr-conf-val">30 abril 2025</div></div>
                  <div className="cr-conf-cell"><div className="cr-conf-lbl">SLA</div><div className="cr-conf-val">2 días</div></div>
                </div>
              </div>

              <div className="cr-conf-section">
                <div className="cr-conf-eye">— Visibilidad ({selectedPeople.length} personas con acceso)</div>
                <div className="cr-conf-people">
                  {selectedPeople.map(p => (
                    <div key={p.id} className="cr-conf-person">
                      <div className="cr-conf-pav" style={{background:p.color}}>{p.avatar}</div>
                      <div className="cr-conf-pname">{p.name}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:11.5,color:t.muted,marginTop:8}}>
                  Recibirán una notificación de que tienen cc en este proyecto.
                </div>
              </div>

              <div className="cr-conf-section">
                <div className="cr-conf-eye">— Documentos adjuntos (3)</div>
                <div className="cr-att-list" style={{marginTop:0}}>
                  <div className="cr-att-row">
                    <div className="cr-att-row-icon drive">D</div>
                    <div className="cr-att-row-name">Contrato framework — Logística Express v3.docx</div>
                    <div className="cr-att-row-meta">drive · 1.2 MB</div>
                  </div>
                  <div className="cr-att-row">
                    <div className="cr-att-row-icon drive">D</div>
                    <div className="cr-att-row-name">Anexo — Penalidades y SLA.pdf</div>
                    <div className="cr-att-row-meta">drive · 480 KB</div>
                  </div>
                  <div className="cr-att-row">
                    <div className="cr-att-row-icon local">↑</div>
                    <div className="cr-att-row-name">notas-revision-comercial.pdf</div>
                    <div className="cr-att-row-meta">local · 312 KB</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="cr-foot">
          <div className="cr-foot-info">
            {step === 1 && <>Próximo paso: <b>la IA va a sugerir</b> prioridad, responsable y SLA según tu descripción.</>}
            {step === 2 && <>Definí quién acompaña la tarea y adjuntá el contexto. Después podrás revisar antes de publicar.</>}
            {step === 3 && <>Última revisión. Cuando confirmes, la tarea se crea y las notificaciones salen.</>}
          </div>
          <button className="ed-btn">Cancelar</button>
          {step === 1 && <button className="ed-btn accent">Continuar →</button>}
          {step === 2 && <><button className="ed-btn">← Volver</button><button className="ed-btn accent">Revisar y publicar →</button></>}
          {step === 3 && <><button className="ed-btn">← Editar</button><button className="ed-btn accent">Publicar tarea</button></>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EdCrear });
