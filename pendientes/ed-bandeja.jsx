// ═══════════════════════════════════════════════════════════════
// EDITORIAL — BANDEJA: Tareas que llegaron de Slack + Gmail
// El bot de Slack y la integración de Gmail crean tareas crudas
// que pasan por triage. La IA pre-llena tipo, prioridad, riesgo,
// proyecto sugerido. Tú aprobás, ajustás o descartás.
// ═══════════════════════════════════════════════════════════════

function EdBandeja({ theme = 'light' }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    /* Toolbar */
    .bn-tabs { display:flex; gap:24px; padding:14px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:32px; align-items:center; }
    .bn-tab { font-size:12px; color:${t.muted}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; cursor:pointer; padding-bottom:2px; border-bottom:2px solid transparent; display:flex; gap:8px; align-items:center; }
    .bn-tab.active { color:${t.ink}; border-color:${t.accent}; }
    .bn-tab .c { font-family:'JetBrains Mono',monospace; color:${t.dim}; font-weight:600; }
    .bn-tab.active .c { color:${t.accent}; }
    .bn-tab-divider { width:1px; height:14px; background:${t.rule}; }
    .bn-actions { margin-left:auto; display:flex; gap:8px; align-items:center; }
    .bn-help { font-size:11px; color:${t.dim}; }

    /* Layout: lista + detalle */
    .bn-grid { display:grid; grid-template-columns:1.05fr 1.4fr; gap:0; border:1px solid ${t.rule}; border-radius:6px; overflow:hidden; background:${t.paper}; }

    /* Lista izquierda */
    .bn-list { border-right:1px solid ${t.rule}; max-height:1180px; overflow-y:auto; }
    .bn-list-h { padding:14px 18px; border-bottom:1px solid ${t.rule}; background:${t.paper2}; display:flex; align-items:center; gap:10px; }
    .bn-list-h-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:800; flex:1; }
    .bn-list-h-c { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.muted}; font-weight:700; }

    .bn-item { padding:14px 18px; border-bottom:1px solid ${t.rule}; cursor:pointer; transition:background .12s; position:relative; }
    .bn-item:hover { background:${t.ruleSoft}; }
    .bn-item.active { background:${t.accentSoft}; }
    .bn-item.active::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:${t.accent}; }
    .bn-item-row1 { display:flex; gap:8px; align-items:center; margin-bottom:6px; }
    .bn-source { display:inline-flex; align-items:center; gap:5px; font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; font-weight:800; padding:2px 7px 2px 4px; border-radius:3px; }
    .bn-source.slack { background:#4A154B; color:#fff; }
    .bn-source.gmail { background:#fff; color:#444; border:1px solid ${t.rule}; }
    .bn-source-dot { width:10px; height:10px; border-radius:50%; display:grid; place-items:center; font-size:7px; }
    .bn-when { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.1px; font-weight:700; margin-left:auto; }
    .bn-from { font-size:11.5px; color:${t.muted}; margin-bottom:4px; }
    .bn-from b { color:${t.ink}; font-weight:700; }
    .bn-summary { font-size:13px; color:${t.ink}; line-height:1.4; font-weight:600; margin-bottom:8px; }
    .bn-pills-mini { display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
    .bn-pill-mini { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; padding:1px 6px; border-radius:2px; }
    .bn-pill-mini.alta { background:${t.criticalSoft}; color:${t.critical}; }
    .bn-pill-mini.media { background:${t.warnSoft}; color:${t.warn}; }
    .bn-pill-mini.baja { background:${t.goodSoft}; color:${t.good}; }
    .bn-pill-mini.tag { background:${t.paper2}; color:${t.muted}; border:1px solid ${t.rule}; }
    .bn-ai-mark { font-size:9px; color:${t.accent}; font-weight:800; margin-left:auto; font-family:'Fraunces',Georgia,serif; font-style:italic; }

    /* Detalle derecha */
    .bn-detail { padding:0; display:flex; flex-direction:column; min-height:600px; }
    .bn-detail-h { padding:20px 24px; border-bottom:1px solid ${t.rule}; }
    .bn-detail-h-row { display:flex; gap:8px; align-items:center; margin-bottom:14px; }
    .bn-detail-id { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.accent}; font-weight:700; }
    .bn-detail-title { font-family:'Fraunces',Georgia,serif; font-size:22px; font-weight:400; line-height:1.3; letter-spacing:-.3px; margin-bottom:6px; }
    .bn-detail-from { font-size:12px; color:${t.muted}; }
    .bn-detail-from b { color:${t.ink}; font-weight:700; }

    /* Origen original */
    .bn-origin { padding:18px 24px; background:${t.paper2}; border-bottom:1px solid ${t.rule}; }
    .bn-origin-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:800; margin-bottom:10px; display:flex; gap:8px; align-items:center; }
    .bn-msg { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; padding:14px; }
    .bn-msg-head { display:flex; gap:10px; align-items:center; margin-bottom:8px; }
    .bn-msg-av { width:28px; height:28px; border-radius:6px; display:grid; place-items:center; color:#fff; font-weight:800; font-size:10px; flex-shrink:0; }
    .bn-msg-name { font-size:13px; font-weight:700; color:${t.ink}; }
    .bn-msg-meta { font-size:10.5px; color:${t.dim}; font-family:'JetBrains Mono',monospace; margin-left:auto; }
    .bn-msg-body { font-size:13px; color:${t.ink}; line-height:1.55; }
    .bn-msg-body i { color:${t.muted}; }
    .bn-msg-body code { background:${t.paper2}; padding:1px 5px; border-radius:3px; font-size:11.5px; color:${t.accent}; }

    /* Triage IA */
    .bn-triage { padding:20px 24px; }
    .bn-triage-eye { font-size:10px; color:${t.accent}; text-transform:uppercase; letter-spacing:1.6px; font-weight:800; margin-bottom:12px; display:flex; gap:8px; align-items:center; }
    .bn-ai-banner { background:${t.accentSoft}; border-left:3px solid ${t.accent}; padding:12px 14px; border-radius:0 4px 4px 0; margin-bottom:18px; display:flex; gap:10px; }
    .bn-ai-mark-big { width:24px; height:24px; border-radius:50%; background:${t.accent}; color:#fff; display:grid; place-items:center; font-weight:800; font-size:11px; flex-shrink:0; font-family:'Fraunces',Georgia,serif; font-style:italic; }
    .bn-ai-text { font-size:12.5px; line-height:1.5; color:${t.ink}; flex:1; }
    .bn-ai-text b { font-weight:700; }

    .bn-fields { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .bn-field { margin-bottom:14px; }
    .bn-field.full { grid-column:1/-1; }
    .bn-flbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-bottom:6px; display:flex; gap:6px; align-items:center; }
    .bn-flbl .ai { font-size:8.5px; color:${t.accent}; padding:1px 5px; background:${t.accentSoft}; border-radius:2px; font-weight:800; }
    .bn-fval { padding:9px 12px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:4px; font-size:13px; color:${t.ink}; font-weight:600; }
    .bn-fval.editable { display:flex; justify-content:space-between; align-items:center; }
    .bn-fval-edit { font-size:10px; color:${t.accent}; cursor:pointer; font-weight:700; text-transform:uppercase; letter-spacing:.8px; }
    .bn-name-input { width:100%; padding:10px 12px; background:${t.paper2}; border:1px solid ${t.rule}; border-radius:4px; font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:400; color:${t.ink}; box-sizing:border-box; letter-spacing:-.2px; }
    .bn-name-input:focus { outline:none; border-color:${t.accent}; }

    /* Foot */
    .bn-foot { margin-top:auto; padding:16px 24px; border-top:1px solid ${t.rule}; display:flex; gap:10px; align-items:center; background:${t.paper2}; }
    .bn-foot-info { font-size:11.5px; color:${t.dim}; flex:1; line-height:1.4; }
    .bn-foot-info b { color:${t.ink}; font-weight:700; }

    /* Stat band */
    .bn-band { display:grid; grid-template-columns:repeat(3,1fr); padding:18px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:32px; }
    .bn-band-cell { padding:0 22px; border-right:1px solid ${t.rule}; }
    .bn-band-cell:first-child { padding-left:0; } .bn-band-cell:last-child { border-right:none; }
    .bn-band-num { font-family:'Fraunces',Georgia,serif; font-size:30px; font-weight:300; line-height:1; letter-spacing:-.8px; font-variant-numeric:tabular-nums; }
    .bn-band-num em { font-style:normal; font-size:14px; color:${t.dim}; font-weight:300; margin-left:3px; }
    .bn-band-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; margin-top:6px; }
    .bn-band-ctx { font-size:11.5px; color:${t.muted}; margin-top:4px; line-height:1.4; }
  `;
  const css = edScope(scope, rawCSS);

  // Items entrantes
  const items = [
    {
      id: 'B-031', source: 'slack', active: true,
      from: 'Sebastián Vélez', fromMeta: 'Comercial · canal #legal-pedidos',
      when: 'hace 12m', via: '/legal del bot',
      summary: 'Necesito revisar contrato con nuevo proveedor de empaques antes del viernes.',
      pills: [{cls:'alta',txt:'IA: Alta'},{cls:'tag',txt:'Contractual'}],
    },
    {
      id: 'B-030', source: 'gmail',
      from: 'sic-respuestas@sic.gov.co', fromMeta: 'gmail · juan.camilo@rappi.com',
      when: 'hace 1h', via: 'forward a legal-tracker@',
      summary: 'Re: Reclamación SIC #2024-0884 — solicitamos respuesta en 5 días hábiles.',
      pills: [{cls:'alta',txt:'IA: Alta'},{cls:'tag',txt:'Regulatorio'}],
    },
    {
      id: 'B-029', source: 'slack',
      from: 'Juliana Páez', fromMeta: 'RappiPay · canal #pay-legal',
      when: 'hace 3h', via: '/legal del bot',
      summary: 'Hay que revisar T&C de la nueva tarjeta antes del lanzamiento (junio).',
      pills: [{cls:'media',txt:'IA: Media'},{cls:'tag',txt:'Contractual'}],
    },
    {
      id: 'B-028', source: 'gmail',
      from: 'andrea.bermudez@rappi.com', fromMeta: 'gmail · forward',
      when: 'hace 5h', via: 'forward',
      summary: 'Pregunta de RR.HH. — ¿podemos pedir certificado médico en proceso de selección?',
      pills: [{cls:'baja',txt:'IA: Baja'},{cls:'tag',txt:'Consulta'}],
    },
    {
      id: 'B-027', source: 'slack',
      from: 'Felipe Correa', fromMeta: 'Comercial · DM',
      when: 'ayer', via: '/legal del bot',
      summary: 'Yango Colombia mandó borrador de partnership, lo necesito revisado para el martes.',
      pills: [{cls:'media',txt:'IA: Media'},{cls:'tag',txt:'Contractual'}],
    },
    {
      id: 'B-026', source: 'gmail',
      from: 'mireguladornoreply@superfinanciera.gov.co', fromMeta: 'gmail · auto',
      when: 'ayer', via: 'auto-routing',
      summary: 'Circular CNBC 047 — actualización metodologías de tasa de usura.',
      pills: [{cls:'media',txt:'IA: Media'},{cls:'tag',txt:'Regulatorio'}],
    },
    {
      id: 'B-025', source: 'slack',
      from: 'Operations BR', fromMeta: 'canal #legal-br',
      when: 'ayer', via: '/legal del bot',
      summary: 'Duda sobre LGPD — ¿podemos tratar datos biométricos del repartidor?',
      pills: [{cls:'alta',txt:'IA: Alta'},{cls:'tag',txt:'Privacy'}],
    },
  ];

  const SourceBadge = ({source}) => (
    source === 'slack'
      ? <span className="bn-source slack"><svg width="10" height="10" viewBox="0 0 60 60"><path fill="#36C5F0" d="M22 36a6 6 0 1 1 0-12h6v6a6 6 0 0 1-6 6z"/><path fill="#2EB67D" d="M24 22a6 6 0 1 1 12 0v6h-6a6 6 0 0 1-6-6z"/><path fill="#ECB22E" d="M38 24a6 6 0 1 1 0 12h-6v-6a6 6 0 0 1 6-6z"/><path fill="#E01E5A" d="M36 38a6 6 0 1 1-12 0v-6h6a6 6 0 0 1 6 6z"/></svg> Slack</span>
      : <span className="bn-source gmail"><svg width="11" height="9" viewBox="0 0 24 18"><path fill="#EA4335" d="M0 18V4l12 9L0 18z"/><path fill="#FBBC04" d="M0 4l12 9L24 4 12 0 0 4z"/><path fill="#34A853" d="M24 18V4L12 13l12 5z"/></svg> Gmail</span>
  );

  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className="ed-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role="specialist" activeItem="bandeja"/>
      <main className="ed-main">
        <EdHeader t={t}/>

        <div className="ed-eye">— Bandeja de entrada · Triage</div>
        <h1 className="ed-h1">Lo que llegó de <em>Slack y Gmail.</em><br/>Sin pasar todavía por el tracker.</h1>
        <p className="ed-lede">
          Cuando alguien escribe <code style={{background:t.paper2,padding:'1px 6px',borderRadius:3,fontSize:13}}>/legal</code> en Slack o reenvía un correo a <b>legal-tracker@rappi.com</b>,
          la IA arma un borrador de tarea con <b>tipo, prioridad, riesgo y proyecto sugerido</b>.
          Vos confirmás, ajustás o descartás. Lleva ~30 segundos por mensaje.
        </p>

        {/* Stat band */}
        <div className="bn-band">
          <div className="bn-band-cell">
            <div className="bn-band-num">07</div>
            <div className="bn-band-lbl">Pendientes de triage</div>
            <div className="bn-band-ctx">3 de Slack, 4 de Gmail · entran en promedio 12/día</div>
          </div>
          <div className="bn-band-cell">
            <div className="bn-band-num">94<em>%</em></div>
            <div className="bn-band-lbl">Acierta la IA</div>
            <div className="bn-band-ctx">Aprendiste a aprobar sin editar en 17 de las últimas 18 tareas.</div>
          </div>
          <div className="bn-band-cell">
            <div className="bn-band-num">28<em>s</em></div>
            <div className="bn-band-lbl">Tiempo promedio</div>
            <div className="bn-band-ctx">Por tarea, contando lectura y aprobación.</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bn-tabs">
          <span className="bn-tab active">Pendientes <span className="c">7</span></span>
          <span className="bn-tab">Hoy <span className="c">3</span></span>
          <div className="bn-tab-divider"/>
          <span className="bn-tab"><SourceBadge source="slack"/><span className="c">3</span></span>
          <span className="bn-tab"><SourceBadge source="gmail"/><span className="c">4</span></span>
          <div className="bn-actions">
            <span className="bn-help">⌘↵ aprobar · ⌘⌫ descartar</span>
            <button className="ed-btn">Auto-aprobar las 5 que tienen 100% confianza</button>
          </div>
        </div>

        {/* Grid */}
        <div className="bn-grid">

          {/* LISTA */}
          <div className="bn-list">
            <div className="bn-list-h">
              <div className="bn-list-h-eye">— En cola</div>
              <div className="bn-list-h-c">07</div>
            </div>
            {items.map(it => (
              <div key={it.id} className={`bn-item ${it.active?'active':''}`}>
                <div className="bn-item-row1">
                  <SourceBadge source={it.source}/>
                  <span className="bn-when">{it.when}</span>
                </div>
                <div className="bn-from"><b>{it.from}</b> · {it.fromMeta}</div>
                <div className="bn-summary">{it.summary}</div>
                <div className="bn-pills-mini">
                  {it.pills.map((p, i) => <span key={i} className={`bn-pill-mini ${p.cls}`}>{p.txt}</span>)}
                  <span className="bn-ai-mark">A · {it.id}</span>
                </div>
              </div>
            ))}
          </div>

          {/* DETALLE */}
          <div className="bn-detail">
            <div className="bn-detail-h">
              <div className="bn-detail-h-row">
                <SourceBadge source="slack"/>
                <span className="bn-detail-id">B-031</span>
                <span style={{fontSize:11,color:t.dim,fontFamily:"'JetBrains Mono',monospace"}}>· hace 12m</span>
              </div>
              <div className="bn-detail-title">Revisión de contrato proveedor empaques — viernes.</div>
              <div className="bn-detail-from">De <b>Sebastián Vélez</b> · Comercial · vía <b>/legal</b> en <b>#legal-pedidos</b></div>
            </div>

            {/* ORIGEN */}
            <div className="bn-origin">
              <div className="bn-origin-eye">
                <SourceBadge source="slack"/>
                <span>— Mensaje original en Slack</span>
              </div>
              <div className="bn-msg">
                <div className="bn-msg-head">
                  <div className="bn-msg-av" style={{background:'#5A7050'}}>SV</div>
                  <div>
                    <div className="bn-msg-name">Sebastián Vélez</div>
                    <div style={{fontSize:10.5,color:t.dim}}>#legal-pedidos · 14:23</div>
                  </div>
                  <div className="bn-msg-meta">/legal</div>
                </div>
                <div className="bn-msg-body">
                  Hola equipo legal 👋 necesito que alguien revise el contrato con <b>EmpaquesYa</b>,
                  el nuevo proveedor de empaques compostables. Lo necesitamos firmado <b>antes del viernes 30 abr</b>
                  porque arrancamos prueba piloto en CO. Adjunto el draft que mandaron.
                  <br/><br/>
                  <i>📎 contrato-empaquesya-v2.docx (1.4 MB)</i><br/>
                  <i>📎 anexo-precios-volumen.xlsx (240 KB)</i>
                </div>
              </div>
            </div>

            {/* TRIAGE */}
            <div className="bn-triage">
              <div className="bn-triage-eye">— Borrador de tarea (la IA ya pre-llenó)</div>

              <div className="bn-ai-banner">
                <div className="bn-ai-mark-big">A</div>
                <div className="bn-ai-text">
                  Lo clasifiqué como <b>contractual de Alta prioridad</b> porque hay fecha de firma en 4 días.
                  Hay <b>3 contratos similares</b> con proveedores de empaques que cerraron en ~4 días.
                  Sugiero asignárselo a <b>Carlos Fernández</b> y vincularlo al proyecto <b>Renegociación flota</b>.
                  Confianza: <b>91%</b>.
                </div>
              </div>

              <div className="bn-field full">
                <div className="bn-flbl">Nombre de la tarea <span className="ai">IA</span></div>
                <input className="bn-name-input" defaultValue="Revisión contrato EmpaquesYa — proveedor empaques compostables CO"/>
              </div>

              <div className="bn-fields">
                <div className="bn-field">
                  <div className="bn-flbl">Tipo <span className="ai">IA</span></div>
                  <div className="bn-fval editable">Contractual <span className="bn-fval-edit">cambiar</span></div>
                </div>
                <div className="bn-field">
                  <div className="bn-flbl">Prioridad <span className="ai">IA</span></div>
                  <div className="bn-fval editable" style={{color:t.critical}}>Alta · vence 30 abr <span className="bn-fval-edit">cambiar</span></div>
                </div>
                <div className="bn-field">
                  <div className="bn-flbl">Riesgo</div>
                  <div className="bn-fval editable">Operativo <span className="bn-fval-edit">cambiar</span></div>
                </div>
                <div className="bn-field">
                  <div className="bn-flbl">SLA <span className="ai">Calculado</span></div>
                  <div className="bn-fval editable">3 días <span className="bn-fval-edit">cambiar</span></div>
                </div>
                <div className="bn-field">
                  <div className="bn-flbl">Responsable <span className="ai">Sugerido</span></div>
                  <div className="bn-fval editable" style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{width:20,height:20,borderRadius:4,background:'#4A6B8A',color:'#fff',display:'grid',placeItems:'center',fontWeight:800,fontSize:9}}>CF</span>
                      Carlos Fernández
                    </span>
                    <span className="bn-fval-edit">cambiar</span>
                  </div>
                </div>
                <div className="bn-field">
                  <div className="bn-flbl">Proyecto <span className="ai">Match 87%</span></div>
                  <div className="bn-fval editable">Renegociación flota Bogotá <span className="bn-fval-edit">cambiar</span></div>
                </div>
                <div className="bn-field full">
                  <div className="bn-flbl">Adjuntos pasados desde Slack</div>
                  <div className="bn-fval" style={{fontSize:12,color:t.muted,fontWeight:500}}>
                    📄 contrato-empaquesya-v2.docx · 📄 anexo-precios-volumen.xlsx
                  </div>
                </div>
              </div>
            </div>

            <div className="bn-foot">
              <div className="bn-foot-info">
                Al aprobar, <b>Sebastián recibe un mensaje en Slack</b> con el ID de la tarea y un link.
                Si descartás, también le avisamos con tu razón.
              </div>
              <button className="ed-btn">Descartar</button>
              <button className="ed-btn">Editar todo</button>
              <button className="ed-btn accent">Aprobar y crear ⌘↵</button>
            </div>

          </div>
        </div>

      </main>
    </div>
    </div>
  );
}

Object.assign(window, { EdBandeja });
