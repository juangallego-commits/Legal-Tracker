// ═══════════════════════════════════════════════════════════════
// EDITORIAL — HOME MANAGER & HOME HQ
// ═══════════════════════════════════════════════════════════════

function EdHomeManager({ theme = 'light', quoteIndex = 1 }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const quote = (window.ED_QUOTES || [{q:'',who:''}])[quoteIndex % (window.ED_QUOTES?.length || 1)];
  const rawCSS = edBaseCSS(t) + `
    .mgr-hero { display:grid; grid-template-columns:repeat(4,1fr); padding:24px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:36px; }
    .mgr-stat { padding:0 22px; border-right:1px solid ${t.rule}; }
    .mgr-stat:first-child { padding-left:0; } .mgr-stat:last-child { border-right:none; }
    .mgr-stat-num { font-family:'Fraunces',Georgia,serif; font-size:46px; font-weight:300; line-height:1; letter-spacing:-1.5px; margin-bottom:6px; font-variant-numeric:tabular-nums; }
    .mgr-stat-num.crit { color:${t.critical}; } .mgr-stat-num.warn { color:${t.warn}; } .mgr-stat-num.good { color:${t.good}; }
    .mgr-stat-lbl { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:6px; }
    .mgr-stat-ctx { font-size:12px; color:${t.muted}; line-height:1.4; }
    .mgr-stat-ctx .crit { color:${t.critical}; font-weight:700; }

    .mgr-team-row { display:grid; grid-template-columns:auto 1.5fr 1fr 1fr 1fr 1fr; gap:18px; align-items:center; padding:16px 0; border-bottom:1px solid ${t.rule}; cursor:pointer; }
    .mgr-team-row:hover { background:${t.ruleSoft}; }
    .mgr-team-row.head { color:${t.dim}; font-size:10px; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; padding:8px 0; cursor:default; }
    .mgr-team-row.head:hover { background:none; }
    .mgr-av { width:34px; height:34px; border-radius:8px; display:grid; place-items:center; color:#fff; font-weight:800; font-size:12px; }
    .mgr-name { font-size:14px; font-weight:700; color:${t.ink}; }
    .mgr-role { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-top:2px; }
    .mgr-num { font-family:'JetBrains Mono',monospace; font-size:14px; color:${t.ink}; font-weight:600; }
    .mgr-num.crit { color:${t.critical}; }
    .mgr-load { display:flex; align-items:center; gap:8px; }
    .mgr-load-bar { flex:1; height:5px; background:${t.paper3}; border-radius:2px; overflow:hidden; }
    .mgr-load-fill { height:100%; background:${t.ink}; }
    .mgr-load-fill.over { background:${t.critical}; }

    .mgr-att-row { display:grid; grid-template-columns:36px 1fr auto auto; gap:18px; align-items:center; padding:14px 0; border-bottom:1px solid ${t.rule}; cursor:pointer; }
    .mgr-att-rank { font-family:'Fraunces',Georgia,serif; font-size:24px; color:${t.dim}; font-weight:300; font-style:italic; line-height:1; font-variant-numeric:tabular-nums; }
    .mgr-att-rank.crit { color:${t.critical}; }
    .mgr-att-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color:${t.dim}; margin-bottom:3px; }
    .mgr-att-name { font-size:14px; font-weight:600; color:${t.ink}; margin-bottom:3px; }
    .mgr-att-narr { font-size:12px; color:${t.muted}; line-height:1.45; max-width:560px; }
    .mgr-att-narr .crit { color:${t.critical}; font-weight:700; }
    .mgr-att-narr b { color:${t.ink}; font-weight:700; }
  `;
  const css = edScope(scope, rawCSS);
  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className="ed-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role="manager" activeItem="home"/>
      <main className="ed-main">
        <EdHeader t={t}/>
        <div className="ed-eye">Jueves 23 abril 2026 · Equipo CO</div>
        <h1 className="ed-h1">Hola Carlos, tu equipo lleva <em>11 tareas</em><br/>activas esta semana.</h1>
        <p className="ed-lede">
          <b>Juan Camilo</b> tiene una carga elevada y le vendría bien apoyo en dos tareas pendientes de cierre.
          <b> Ana Bravo</b> está trabajando una demanda en Medellín que conviene seguir de cerca. La utilización del equipo es del
          <b> 65%</b> — <span className="good">en buen rango</span>.
        </p>

        <div style={{padding:'18px 22px',borderLeft:`2px solid ${t.accent}`,background:t.paper2,marginBottom:32,display:'flex',alignItems:'center',gap:18}}>
          <div style={{fontFamily:'Fraunces,Georgia,serif',fontStyle:'italic',fontSize:18,lineHeight:1.4,color:t.ink,fontWeight:400,flex:1}}>"{quote.q}"</div>
          <div style={{fontSize:10,color:t.dim,textTransform:'uppercase',letterSpacing:1.4,fontWeight:700,whiteSpace:'nowrap'}}>{quote.who}</div>
        </div>

        <div className="mgr-hero">
          <div className="mgr-stat"><div className="mgr-stat-lbl">Necesitan apoyo</div><div className="mgr-stat-num warn">04</div><div className="mgr-stat-ctx">en 3 personas</div></div>
          <div className="mgr-stat"><div className="mgr-stat-lbl">Vencen hoy</div><div className="mgr-stat-num warn">02</div><div className="mgr-stat-ctx">ambas alta · 1 sin owner</div></div>
          <div className="mgr-stat"><div className="mgr-stat-lbl">Carga del equipo</div><div className="mgr-stat-num">65<span style={{fontSize:18,color:t.dim}}>%</span></div><div className="mgr-stat-ctx">11/17 capacidad</div></div>
          <div className="mgr-stat"><div className="mgr-stat-lbl">SLA cumplido</div><div className="mgr-stat-num good">87<span style={{fontSize:18,color:t.dim}}>%</span></div><div className="mgr-stat-ctx">+4pp vs mes pasado</div></div>
        </div>

        <section className="ed-section">
          <div className="ed-h2">— Hoy te conviene mirar esto</div>
          {[
            { rank: 1, id: 'T-142', who: 'Juan Camilo', what: 'Demanda laboral Bogotá', why: <>En espera de RR.HH. desde hace varios días. Buen momento para escalar al director y darle aire a JC.</>, primary: 'Apoyar' },
            { rank: 2, id: 'T-115', who: 'Ana Bravo', what: 'Demanda consumidor Medellín', why: <>Riesgo alto, vence mañana. <b>Falta una declaración del cliente</b> para poder responder.</>, primary: 'Acompañar' },
            { rank: 3, id: 'T-138', who: 'Juan Camilo', what: 'Contrato proveedor delivery', why: <>JC reportó que <b>la cláusula 7.2 necesita acuerdo comercial</b>. Una llamada con Felipe podría destrabarla.</>, primary: 'Conectar' },
            { rank: 4, id: 'T-125', who: 'Juan Manuel', what: 'Respuesta SIC — reclamación', why: <>Sin actualización reciente. Un mensaje a JM para ver cómo va sería oportuno.</>, primary: 'Escribir' },
          ].map(it => (
            <div key={it.id} className="mgr-att-row">
              <div className="mgr-att-rank">{String(it.rank).padStart(2,'0')}</div>
              <div>
                <div className="mgr-att-meta">{it.id} · {it.who}</div>
                <div className="mgr-att-name">{it.what}</div>
                <div className="mgr-att-narr">{it.why}</div>
              </div>
              <button className="ed-btn">Ver detalle</button>
              <button className="ed-btn primary">{it.primary}</button>
            </div>
          ))}
        </section>

        <section className="ed-section">
          <div className="ed-h2">— Tu equipo de un vistazo</div>
          <div className="mgr-team-row head">
            <span></span><span>Persona</span><span>Carga</span><span>Atrasadas</span><span>En espera</span><span>SLA mes</span>
          </div>
          {ED_TEAM.map(p => {
            const pct = (p.load / p.capacity) * 100;
            const over = pct > 80;
            return (
              <div key={p.id} className="mgr-team-row">
                <div className="mgr-av" style={{background:p.color}}>{p.avatar}</div>
                <div><div className="mgr-name">{p.name}</div><div className="mgr-role">{p.role}</div></div>
                <div className="mgr-load">
                  <div className="mgr-load-bar"><div className={`mgr-load-fill ${over?'over':''}`} style={{width:pct+'%'}}/></div>
                  <span className="mgr-num" style={{minWidth:36,textAlign:'right'}}>{p.load}/{p.capacity}</span>
                </div>
                <div className={`mgr-num ${p.overdue>0?'crit':''}`}>{p.overdue}</div>
                <div className={`mgr-num ${p.blocked>0?'crit':''}`}>{p.blocked}</div>
                <div className="mgr-num">{[92,88,95,84][ED_TEAM.indexOf(p)]}%</div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
    </div>
  );
}

function EdHomeHQ({ theme = 'light', quoteIndex = 3 }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const quote = (window.ED_QUOTES || [{q:'',who:''}])[quoteIndex % (window.ED_QUOTES?.length || 1)];
  const rawCSS = edBaseCSS(t) + `
    .hq-hero { display:grid; grid-template-columns:repeat(4,1fr); padding:24px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:36px; }
    .hq-stat { padding:0 22px; border-right:1px solid ${t.rule}; }
    .hq-stat:first-child { padding-left:0; } .hq-stat:last-child { border-right:none; }
    .hq-stat-num { font-family:'Fraunces',Georgia,serif; font-size:44px; font-weight:300; line-height:1; letter-spacing:-1.5px; margin-bottom:6px; font-variant-numeric:tabular-nums; }
    .hq-stat-lbl { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:6px; }
    .hq-stat-ctx { font-size:12px; color:${t.muted}; }
    .hq-country-row { display:grid; grid-template-columns:auto 1fr 1fr 1fr 1fr 1fr; gap:18px; align-items:center; padding:14px 0; border-bottom:1px solid ${t.rule}; cursor:pointer; }
    .hq-country-row.head { color:${t.dim}; font-size:10px; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; padding:8px 0; cursor:default; }
    .hq-flag { width:32px; height:24px; border-radius:3px; background:${t.paper3}; display:grid; place-items:center; font-size:10px; font-weight:800; color:${t.muted}; letter-spacing:1px; }
    .hq-cn { font-size:14px; font-weight:700; color:${t.ink}; }
    .hq-cl { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-top:2px; }
    .hq-num { font-family:'JetBrains Mono',monospace; font-size:14px; color:${t.ink}; font-weight:600; font-variant-numeric:tabular-nums; }
    .hq-num.crit { color:${t.critical}; } .hq-num.good { color:${t.good}; } .hq-num.warn { color:${t.warn}; }
    .hq-spark { display:flex; align-items:flex-end; gap:2px; height:22px; }
    .hq-spark span { width:5px; background:${t.muted}; border-radius:1px; }
  `;
  const css = edScope(scope, rawCSS);
  const countries = [
    { code: 'CO', name: 'Colombia', lead: 'Carlos Fernández', open: 47, overdue: 4, sla: 87, trend: 'up' },
    { code: 'MX', name: 'México', lead: 'Sofía Reyes', open: 38, overdue: 2, sla: 91, trend: 'up' },
    { code: 'BR', name: 'Brasil', lead: 'Marina Silva', open: 52, overdue: 7, sla: 79, trend: 'down' },
    { code: 'AR', name: 'Argentina', lead: 'Diego Paz', open: 22, overdue: 1, sla: 94, trend: 'flat' },
    { code: 'CL', name: 'Chile', lead: 'Andrea Rojas', open: 18, overdue: 0, sla: 96, trend: 'up' },
    { code: 'PE', name: 'Perú', lead: 'Luis Quispe', open: 14, overdue: 1, sla: 88, trend: 'flat' },
    { code: 'EC', name: 'Ecuador', lead: 'Paola Vega', open: 9, overdue: 0, sla: 92, trend: 'up' },
    { code: 'UY', name: 'Uruguay', lead: 'Jorge Pérez', open: 6, overdue: 0, sla: 100, trend: 'flat' },
    { code: 'CR', name: 'Costa Rica', lead: 'Tania Mora', open: 7, overdue: 1, sla: 85, trend: 'down' },
    { code: 'PA', name: 'Panamá', lead: 'Ricardo Lima', open: 4, overdue: 0, sla: 100, trend: 'flat' },
  ];
  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className="ed-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role="hq" activeItem="home"/>
      <main className="ed-main">
        <EdHeader t={t}/>
        <div className="ed-eye">Jueves 23 abril 2026 · Visión global · 10 países</div>
        <h1 className="ed-h1">Operación legal global,<br/><em>en una mirada</em>.</h1>
        <p className="ed-lede">
          <b>Brasil</b> es la operación que más conviene acompañar este mes: 7 tareas con días de retraso y SLA en 79%.
          <b> Colombia y México</b> están en buen ritmo. Total de tareas abiertas: <b>217</b>, con
          <span className="good"> 89% SLA promedio LATAM</span>.
        </p>

        <div style={{padding:'18px 22px',borderLeft:`2px solid ${t.accent}`,background:t.paper2,marginBottom:32,display:'flex',alignItems:'center',gap:18}}>
          <div style={{fontFamily:'Fraunces,Georgia,serif',fontStyle:'italic',fontSize:18,lineHeight:1.4,color:t.ink,fontWeight:400,flex:1}}>"{quote.q}"</div>
          <div style={{fontSize:10,color:t.dim,textTransform:'uppercase',letterSpacing:1.4,fontWeight:700,whiteSpace:'nowrap'}}>{quote.who}</div>
        </div>

        <div className="hq-hero">
          <div className="hq-stat"><div className="hq-stat-lbl">Total abiertas</div><div className="hq-stat-num">217</div><div className="hq-stat-ctx">+12 vs semana pasada</div></div>
          <div className="hq-stat"><div className="hq-stat-lbl">Atrasadas LATAM</div><div className="hq-stat-num" style={{color:t.warn}}>16</div><div className="hq-stat-ctx">7 en BR · 4 en CO</div></div>
          <div className="hq-stat"><div className="hq-stat-lbl">SLA LATAM</div><div className="hq-stat-num" style={{color:t.good}}>89<span style={{fontSize:18,color:t.dim}}>%</span></div><div className="hq-stat-ctx">+1pp mes</div></div>
          <div className="hq-stat"><div className="hq-stat-lbl">Necesitan apoyo</div><div className="hq-stat-num" style={{color:t.warn}}>02</div><div className="hq-stat-ctx">Brasil · Costa Rica</div></div>
        </div>

        <section className="ed-section">
          <div className="ed-h2">— Por país</div>
          <div className="hq-country-row head">
            <span></span><span>País / Líder</span><span>Abiertas</span><span>Atrasadas</span><span>SLA</span><span>Tendencia 30d</span>
          </div>
          {countries.map(c => (
            <div key={c.code} className="hq-country-row">
              <div className="hq-flag">{c.code}</div>
              <div><div className="hq-cn">{c.name}</div><div className="hq-cl">{c.lead}</div></div>
              <div className="hq-num">{c.open}</div>
              <div className={`hq-num ${c.overdue>3?'crit':c.overdue>0?'warn':''}`}>{c.overdue}</div>
              <div className={`hq-num ${c.sla<85?'crit':c.sla>=90?'good':''}`}>{c.sla}%</div>
              <div className="hq-spark">
                {[8,12,10,14,9,13,11,15,12,18,14,20].map((h,i)=>(
                  <span key={i} style={{height:h+'px',background:c.trend==='down'?t.critical:c.trend==='up'?t.good:t.muted}}/>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
    </div>
  );
}

Object.assign(window, { EdHomeManager, EdHomeHQ });
