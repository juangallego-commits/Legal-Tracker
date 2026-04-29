// ═══════════════════════════════════════════════════════════════
// EDITORIAL — Pantallas de soporte y narrativa
//   <EdComoLeer />        — slide 02: leyenda del deck para Carlos+Ana
//   <EdActividad />       — feed de Slack reflejado en la app
//   <EdBandejaIntake />   — bandeja redefinida: sólo intake de no-legales
//   <EdDecisiones />      — slide final: preguntas abiertas para resolver
// ═══════════════════════════════════════════════════════════════

const SCOPE_SUP = 'edcs-sup';

function _supCSS(t) {
  return `
    .sup-wrap { padding:48px 56px 60px; background:${t.bg}; min-height:100%; font-family:'Nunito Sans',system-ui,sans-serif; color:${t.ink}; }
    .sup-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:12px; }
    .sup-h1 { font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:36px; line-height:1.08; letter-spacing:-1px; margin-bottom:10px; }
    .sup-h1 em { font-style:italic; color:${t.accent}; }
    .sup-lede { font-size:14.5px; color:${t.muted}; line-height:1.55; max-width:780px; margin-bottom:32px; }
    .sup-lede b { color:${t.ink}; font-weight:700; }
    .sup-h2 { font-size:12.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:700; margin-bottom:18px; display:flex; align-items:center; gap:10px; }
    .sup-h2::after { content:''; flex:1; height:1px; background:${t.rule}; }
    .card { background:${t.paper}; border:1px solid ${t.rule}; border-radius:8px; padding:22px 24px; }
    .num { font-family:'Fraunces',Georgia,serif; font-style:italic; font-size:14px; color:${t.dim}; margin-bottom:6px; }
    .ttl { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:500; letter-spacing:-.2px; margin-bottom:8px; }
    .body { font-size:13px; color:${t.muted}; line-height:1.55; }
    .body b { color:${t.ink}; font-weight:700; }
  `;
}

// ─── Cómo leer esto (slide 02) ─────────────────────────────────
function EdComoLeer({ theme = 'light' }) {
  const t = edTheme(theme);
  const L = ED_CONF_LEVELS;
  return (
    <div className="sup-wrap">
      <style>{edScope(SCOPE_SUP + '-cl', _supCSS(t))}</style>
      <div className={SCOPE_SUP + '-cl'}>
        <div className="sup-eye">Antes de empezar</div>
        <h1 className="sup-h1">Cómo leer este <em>walkthrough</em>.</h1>
        <p className="sup-lede">
          Lo que sigue son <b>23 pantallas propuestas</b> para Legal Tracker — cada una mostrando un rol, un flujo o una decisión. La idea es revisarlas juntos, marcar lo que cambiamos, y salir con luz verde para producción.
          <br/><br/>
          <b>Lo que pido de ustedes:</b> miren cada slide pensando en su rol. Si algo no representa cómo trabaja el equipo, decilo. Si falta algo, mejor.
        </p>

        <div className="sup-h2">Tres roles, una herramienta</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:36}}>
          {[
            { name:'Juan Camilo', role:'Specialist · Colombia', color:'#B8551F', does:'Ejecuta tareas día a día. Vive en Slack y entra a la app cuando hay algo que requiere foco.' },
            { name:'Carlos Fernández', role:'Manager · Colombia', color:'#4A6B8A', does:'Lidera al equipo de su país. Mira el Tracker para ver carga, asignar y desbloquear.' },
            { name:'Ana Bravo', role:'HQ Legal · Global', color:'#5e3a8a', does:'Mira los 10 países en agregado. Define proyectos transversales y prioridades macro.' },
          ].map((p,i) => (
            <div key={i} className="card">
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                <div style={{width:42,height:42,borderRadius:8,background:p.color,color:'#fff',display:'grid',placeItems:'center',fontWeight:800,fontSize:14}}>{p.name.split(' ').map(s=>s[0]).join('').slice(0,2)}</div>
                <div>
                  <div style={{fontFamily:'Fraunces,Georgia,serif',fontSize:18,fontWeight:500,letterSpacing:-.2}}>{p.name}</div>
                  <div style={{fontSize:10,color:t.dim,textTransform:'uppercase',letterSpacing:1.2,fontWeight:700,marginTop:2}}>{p.role}</div>
                </div>
              </div>
              <div className="body">{p.does}</div>
            </div>
          ))}
        </div>

        <div className="sup-h2">Convenciones visuales</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:30}}>
          <div className="card">
            <div className="ttl">Prioridad</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:6}}>
              <span style={{padding:'3px 9px',borderRadius:3,background:t.criticalSoft,color:t.critical,fontSize:10.5,fontWeight:800,textTransform:'uppercase',letterSpacing:.6}}>Alta</span>
              <span style={{padding:'3px 9px',borderRadius:3,background:t.warnSoft,color:t.warn,fontSize:10.5,fontWeight:800,textTransform:'uppercase',letterSpacing:.6}}>Media</span>
              <span style={{padding:'3px 9px',borderRadius:3,background:t.goodSoft,color:t.good,fontSize:10.5,fontWeight:800,textTransform:'uppercase',letterSpacing:.6}}>Baja</span>
            </div>
            <div className="body" style={{marginTop:12,fontSize:12}}>Color por urgencia. <b>Alta</b> es lo que vence pronto o tiene impacto operativo.</div>
          </div>
          <div className="card">
            <div className="ttl">Confidencialidad</div>
            <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:6}}>
              {[L.estandar,L.restringido,L.confidencial].map(lv => (
                <div key={lv.id} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:t.ink,fontWeight:600}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:lv.dot}}></span>
                  {lv.label}
                </div>
              ))}
            </div>
            <div className="body" style={{marginTop:12,fontSize:12}}>Punto de color en tareas y filas. <b>Confidencial</b> incluye watermark en docs.</div>
          </div>
        </div>

        <div className="sup-h2">Lo que les pido</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          <div className="card"><div className="num">01</div><div className="ttl">Comenten lo que no encaja</div><div className="body">Si una pantalla no representa cómo trabajan, decilo. Es para encontrar eso.</div></div>
          <div className="card"><div className="num">02</div><div className="ttl">Marquen lo que falta</div><div className="body">Si hay un caso de uso que no cubrimos, lo agregamos antes de prod.</div></div>
          <div className="card"><div className="num">03</div><div className="ttl">Aprueben lo que sí</div><div className="body">Lo aprobado pasa directo al backlog de desarrollo.</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── Actividad feed ────────────────────────────────────────────
function EdActividad({ theme = 'light' }) {
  const t = edTheme(theme);
  const L = ED_CONF_LEVELS;
  const items = [
    { time:'Hoy 14:32', who:'Juan Camilo', avatar:'JC', color:'#B8551F', action:'cerró', tid:'T-138', tname:'Revisar TyC promo Cyber', via:'⚖️ Slack · #legal-co', extra:'Cerrada en 1d 4h · resumen IA listo', lvl:L.estandar },
    { time:'Hoy 13:15', who:'Carlos Fernández', avatar:'CF', color:'#4A6B8A', action:'creó', tid:'T-149', tname:'Revisar contrato Cornershop', via:'⚖️ Slack · #legal-co', extra:'Asignada a Juan Camilo · Alta', lvl:L.restringido },
    { time:'Hoy 11:48', who:'Sofía Vargas', avatar:'SV', color:'#7C4F2A', action:'bloqueó', tid:'T-141', tname:'NDA con proveedor logístico', via:'🚧 Slack · #legal-co', extra:'Esperando respuesta de procurement', lvl:L.estandar },
    { time:'Hoy 10:22', who:'Juan Camilo', avatar:'JC', color:'#B8551F', action:'mandó a revisión', tid:'T-142', tname:'Política privacidad — actualización', via:'👀 Slack · #legal-co', extra:'Revisor sugerido: Carlos F.', lvl:L.estandar },
    { time:'Ayer 17:09', who:'Ana Bravo', avatar:'AB', color:'#5e3a8a', action:'subió prioridad', tid:'T-148', tname:'Renovación contrato Cornershop', via:'📌 Slack · #legal-global', extra:'Media → Alta', lvl:L.estandar },
    { time:'Ayer 16:34', who:'Carlos Fernández', avatar:'CF', color:'#4A6B8A', action:'creó', tid:'T-147', tname:'NDA partnership con MercadoLibre', via:'⚖️ Slack · #legal-co', extra:'Auto-asignada a sí mismo', lvl:L.confidencial },
    { time:'Ayer 14:51', who:'Juan Camilo', avatar:'JC', color:'#B8551F', action:'cerró', tid:'T-135', tname:'Revisión cláusula penal — Rappi Pay', via:'app', extra:'Cerrada en 3d · 2 iteraciones', lvl:L.restringido },
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'218px 1fr',minHeight:'100%',background:t.bg,fontFamily:"'Nunito Sans',system-ui,sans-serif",color:t.ink}}>
      <EdSidebar t={t} role="manager" activeItem="actividad" />
      <div style={{padding:'32px 40px 50px'}}>
        <style>{edScope(SCOPE_SUP + '-act', _supCSS(t) + `
          .act-list { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; overflow:hidden; }
          .act-row { display:grid; grid-template-columns:120px 36px 1fr 130px; gap:14px; padding:16px 20px; border-bottom:1px solid ${t.ruleSoft}; align-items:center; font-size:13px; }
          .act-row:last-child { border-bottom:none; }
          .act-row .time { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:${t.dim}; font-weight:600; text-transform:uppercase; letter-spacing:1px; }
          .act-row .av { width:30px; height:30px; border-radius:6px; color:#fff; display:grid; place-items:center; font-weight:800; font-size:11px; }
          .act-row .what { line-height:1.5; }
          .act-row .what .who { font-weight:700; color:${t.ink}; }
          .act-row .what .verb { color:${t.muted}; }
          .act-row .what .tid { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.dim}; margin:0 4px; }
          .act-row .what .tname { color:${t.ink}; font-weight:500; }
          .act-row .meta { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:5px; font-size:11.5px; color:${t.muted}; }
          .act-row .meta .lvl-d { width:7px; height:7px; border-radius:50%; }
          .act-row .meta .via { font-weight:600; }
          .act-row .meta .extra { color:${t.dim}; }
          .act-row .link { font-size:11px; color:${t.accent}; font-weight:700; text-align:right; cursor:pointer; }
          .act-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
          .act-stat { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; padding:14px 16px; }
          .act-stat .n { font-family:'Fraunces',Georgia,serif; font-size:28px; font-weight:500; line-height:1; }
          .act-stat .l { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-top:6px; }
          .act-stat .d { font-size:11px; color:${t.muted}; margin-top:4px; }
        `)}</style>
        <div className={SCOPE_SUP + '-act'}>
          <div className="sup-eye">Actividad · últimas 24h</div>
          <h1 className="sup-h1">El pulso del equipo, <em>sin abrir Slack</em>.</h1>
          <p className="sup-lede" style={{marginBottom:24}}>
            Feed read-only de lo que pasó vía Slack y app. Para Carlos, es ver quién está moviendo qué. Para Ana, es el reporte ejecutivo automático sin tener que pedirlo. Click en cualquier ítem abre la tarea o el thread original.
          </p>

          <div className="act-stats">
            <div className="act-stat"><div className="n">14</div><div className="l">Tareas creadas</div><div className="d">11 desde Slack · 3 desde app</div></div>
            <div className="act-stat"><div className="n">9</div><div className="l">Tareas cerradas</div><div className="d">Tiempo promedio: 1.6d</div></div>
            <div className="act-stat"><div className="n">2</div><div className="l">Bloqueadas activas</div><div className="d">Necesitan acción de procurement</div></div>
            <div className="act-stat"><div className="n">94%</div><div className="l">IA acierto</div><div className="d">Resúmenes y prioridad sugerida</div></div>
          </div>

          <div className="sup-h2">Hoy y ayer</div>
          <div className="act-list">
            {items.map((it,i) => (
              <div key={i} className="act-row">
                <div className="time">{it.time}</div>
                <div className="av" style={{background:it.color}}>{it.avatar}</div>
                <div>
                  <div className="what">
                    <span className="who">{it.who}</span> <span className="verb">{it.action}</span>
                    <span className="tid">{it.tid}</span>
                    <span className="tname">{it.tname}</span>
                  </div>
                  <div className="meta">
                    <span className="lvl-d" style={{background:it.lvl.dot}}></span>
                    <span style={{color:it.lvl.bandInk,fontWeight:700,fontSize:10.5,textTransform:'uppercase',letterSpacing:.5}}>{it.lvl.short}</span>
                    <span style={{color:t.dim}}>·</span>
                    <span className="via">{it.via}</span>
                    <span style={{color:t.dim}}>·</span>
                    <span className="extra">{it.extra}</span>
                  </div>
                </div>
                <div className="link">Ver thread →</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bandeja como intake puro ──────────────────────────────────
function EdBandejaIntake({ theme = 'light' }) {
  const t = edTheme(theme);
  const L = ED_CONF_LEVELS;
  const items = [
    { time:'09:14', src:'gmail', from:'maría.ruiz@rappi.com', team:'Operations', subj:'Necesito revisar contrato con proveedor de embalaje', summ:'Vence el 10 de mayo. Adjuntaron borrador del proveedor.', sugg:{prio:'Alta', area:'Contratos', asig:'Juan Camilo', lvl:'Restringido'} },
    { time:'08:42', src:'form', from:'Form interno', team:'Marketing', subj:'TyC nueva campaña Cyber Monday', summ:'Lanza el 5 may. Necesitan TyC + política de devoluciones revisadas.', sugg:{prio:'Media', area:'Compliance', asig:'Sofía V.', lvl:'Estándar'} },
    { time:'Ayer', src:'gmail', from:'roberto.tovar@rappi.com', team:'RappiPay', subj:'Cláusulas SLA con bancos partner', summ:'Renovación anual de 3 contratos. Fechas escalonadas.', sugg:{prio:'Alta', area:'Contratos', asig:'Carlos F.', lvl:'Confidencial'} },
    { time:'Ayer', src:'form', from:'Form interno', team:'People', subj:'Revisión política licencias parentales', summ:'Cambio normativo en Colombia. Aplica a 2.300 empleados del país.', sugg:{prio:'Media', area:'Laboral', asig:'Ana B.', lvl:'Estándar'} },
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'218px 1fr',minHeight:'100%',background:t.bg,fontFamily:"'Nunito Sans',system-ui,sans-serif",color:t.ink}}>
      <EdSidebar t={t} role="manager" activeItem="bandeja" />
      <div style={{padding:'32px 40px 50px'}}>
        <style>{edScope(SCOPE_SUP + '-bj', _supCSS(t) + `
          .bj-list { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; overflow:hidden; }
          .bj-item { display:grid; grid-template-columns:90px 1fr 320px; gap:18px; padding:18px 22px; border-bottom:1px solid ${t.ruleSoft}; align-items:flex-start; }
          .bj-item:last-child { border-bottom:none; }
          .bj-item .src { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; }
          .bj-item .src .ic { display:inline-flex; width:22px; height:22px; border-radius:5px; align-items:center; justify-content:center; margin-bottom:5px; font-size:11px; font-weight:800; }
          .bj-item .src .ic.gmail { background:#fce8e6; color:#c5221f; }
          .bj-item .src .ic.form { background:${t.paper2}; color:${t.muted}; }
          .bj-item .src .tm { font-family:'JetBrains Mono',monospace; font-size:10px; color:${t.dim}; margin-top:4px; font-weight:600; }
          .bj-item .body .from { font-size:11px; color:${t.dim}; margin-bottom:4px; }
          .bj-item .body .from b { color:${t.ink}; font-weight:700; }
          .bj-item .body .subj { font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:500; letter-spacing:-.2px; margin-bottom:6px; }
          .bj-item .body .summ { font-size:12.5px; color:${t.muted}; line-height:1.5; }
          .bj-item .sugg { background:${t.paper2}; border-radius:5px; padding:12px 14px; }
          .bj-item .sugg .label { font-size:9.5px; color:${t.accent}; text-transform:uppercase; letter-spacing:1.4px; font-weight:800; margin-bottom:8px; }
          .bj-item .sugg .row { display:flex; justify-content:space-between; gap:10px; padding:3px 0; font-size:11.5px; }
          .bj-item .sugg .row .k { color:${t.dim}; }
          .bj-item .sugg .row .v { color:${t.ink}; font-weight:700; }
          .bj-item .actions { display:flex; gap:6px; margin-top:10px; }
          .bj-item .actions .b { padding:5px 11px; font-size:11px; font-weight:700; border-radius:4px; cursor:pointer; }
          .bj-item .actions .b.primary { background:${t.ink}; color:${t.bg}; border:1px solid ${t.ink}; }
          .bj-item .actions .b.ghost { background:transparent; color:${t.muted}; border:1px solid ${t.rule}; }
          .bj-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:24px; }
          .bj-stat { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; padding:14px 16px; }
          .bj-stat .n { font-family:'Fraunces',Georgia,serif; font-size:26px; font-weight:500; line-height:1; }
          .bj-stat .l { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-top:6px; }
        `)}</style>
        <div className={SCOPE_SUP + '-bj'}>
          <div className="sup-eye">Bandeja · pedidos de clientes internos</div>
          <h1 className="sup-h1">Lo que <em>nos piden</em>, antes de que sea tarea.</h1>
          <p className="sup-lede" style={{marginBottom:22}}>
            Operations, Marketing, RappiPay y otros equipos escriben a <b>legal-tracker@rappi.com</b> o llenan un form. La IA lee el pedido y <b>pre-llena un borrador de tarea</b>: prioridad, área, asignado, nivel.
            Vos confirmás, editás o descartás. <b>No es un canal para legales</b> — para eso está Slack.
          </p>

          <div className="bj-stats">
            <div className="bj-stat"><div className="n">7</div><div className="l">Pendientes hoy</div></div>
            <div className="bj-stat"><div className="n">28s</div><div className="l">Tiempo promedio decisión</div></div>
            <div className="bj-stat"><div className="n">94%</div><div className="l">IA acierta sugerencia</div></div>
          </div>

          <div className="sup-h2">Cola</div>
          <div className="bj-list">
            {items.map((it,i) => (
              <div key={i} className="bj-item">
                <div className="src">
                  <div className={`ic ${it.src}`}>{it.src === 'gmail' ? '✉' : '⊞'}</div>
                  <div>{it.src === 'gmail' ? 'Email' : 'Form'}</div>
                  <div className="tm">{it.time}</div>
                </div>
                <div className="body">
                  <div className="from">de <b>{it.from}</b> · equipo <b>{it.team}</b></div>
                  <div className="subj">{it.subj}</div>
                  <div className="summ">{it.summ}</div>
                  <div className="actions">
                    <button className="b primary">Crear tarea</button>
                    <button className="b ghost">Editar antes</button>
                    <button className="b ghost">No aplica</button>
                  </div>
                </div>
                <div className="sugg">
                  <div className="label">Sugerencia IA</div>
                  <div className="row"><span className="k">Prioridad</span><span className="v">{it.sugg.prio}</span></div>
                  <div className="row"><span className="k">Área</span><span className="v">{it.sugg.area}</span></div>
                  <div className="row"><span className="k">Asignar a</span><span className="v">{it.sugg.asig}</span></div>
                  <div className="row"><span className="k">Confidencialidad</span>
                    <span className="v" style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:L[it.sugg.lvl.toLowerCase()].dot}}></span>
                      {it.sugg.lvl}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Decisiones pendientes (slide final) ───────────────────────
function EdDecisiones({ theme = 'light' }) {
  const t = edTheme(theme);
  const decisions = [
    { num:'01', q:'¿Confirmamos los 3 niveles de confidencialidad?', ctx:'O sumamos un cuarto tipo "Sólo HQ" / "Externo (counsel)"?', tag:'Confidencialidad' },
    { num:'02', q:'¿Default de visibilidad al crear tarea?', ctx:'Estándar (todo el equipo del país) o Restringido (solo asignados). Tradeoff: transparencia vs cuidado por defecto.', tag:'Confidencialidad' },
    { num:'03', q:'¿Bandeja y Actividad son tabs separados o uno solo con filtro?', ctx:'Hoy en sidebar son dos. ¿Vale la pena la separación o conviene unificar?', tag:'Navegación' },
    { num:'04', q:'¿`:eyes:` en Slack manda directo a revisión o pide confirmación?', ctx:'Tradeoff: rapidez vs reversibilidad. Mi voto: confirmación por DM.', tag:'Slack' },
    { num:'05', q:'¿Quién aprueba subir prioridad con `:pushpin:`?', ctx:'Hoy lo limito a manager y HQ. ¿Specialist también, con auto-aviso al manager?', tag:'Slack' },
    { num:'06', q:'¿La sugerencia de nombre de tarea (Crear paso 1) es suficiente?', ctx:'Hoy son 3 chips basados en tareas previas. ¿Suma valor o es ruido?', tag:'IA' },
    { num:'07', q:'¿Watermark en docs es siempre o sólo en confidencial?', ctx:'Mi propuesta es sólo en Confidencial. Si lo extendemos a todo, hay que coordinar con el equipo de docs.', tag:'Confidencialidad' },
    { num:'08', q:'¿Qué falta?', ctx:'Casos de uso o pantallas que no cubrimos y deberíamos tener antes de prod.', tag:'Open' },
  ];
  return (
    <div className="sup-wrap">
      <style>{edScope(SCOPE_SUP + '-dec', _supCSS(t) + `
        .dec-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .dec { background:${t.paper}; border:1px solid ${t.rule}; border-radius:8px; padding:22px 24px; position:relative; }
        .dec .num { font-family:'Fraunces',Georgia,serif; font-style:italic; font-size:13px; color:${t.dim}; margin-bottom:8px; }
        .dec .q { font-family:'Fraunces',Georgia,serif; font-size:19px; font-weight:500; letter-spacing:-.3px; margin-bottom:10px; line-height:1.25; }
        .dec .ctx { font-size:12.5px; color:${t.muted}; line-height:1.55; margin-bottom:14px; }
        .dec .tag { font-size:9.5px; color:${t.accent}; text-transform:uppercase; letter-spacing:1.4px; font-weight:800; }
        .dec .footer { display:flex; align-items:center; gap:8px; padding-top:10px; border-top:1px solid ${t.rule}; }
        .dec .vote { font-size:11px; color:${t.dim}; }
        .dec .vote-actions { margin-left:auto; display:flex; gap:5px; }
        .dec .vote-actions .v { padding:3px 9px; font-size:10.5px; font-weight:700; border-radius:3px; border:1px solid ${t.rule}; color:${t.muted}; }
      `)}</style>
      <div className={SCOPE_SUP + '-dec'}>
        <div className="sup-eye">Para resolver hoy</div>
        <h1 className="sup-h1">Lo que <em>todavía no decidimos</em>.</h1>
        <p className="sup-lede">
          No es un cierre — es la lista de preguntas abiertas para resolver entre los tres. Cada una tiene mi propuesta y el tradeoff. Lo que aprobemos pasa al backlog. Lo que no, lo discutimos.
        </p>

        <div className="dec-grid">
          {decisions.map(d => (
            <div key={d.num} className="dec">
              <div className="num">{d.num}</div>
              <div className="q">{d.q}</div>
              <div className="ctx">{d.ctx}</div>
              <div className="footer">
                <span className="tag">{d.tag}</span>
                <div className="vote-actions">
                  <span className="v">Aprobar</span>
                  <span className="v">Discutir</span>
                  <span className="v">Postergar</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{marginTop:32,padding:'18px 22px',background:t.paper2,borderRadius:6,fontSize:13,color:t.muted,lineHeight:1.55}}>
          <b style={{color:t.ink}}>Próximos pasos:</b> con esto resuelto, el equipo de desarrollo arranca. Estimación inicial — <b style={{color:t.ink}}>4 semanas</b> para MVP en Colombia, +2 para abrir a los otros 9 países.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EdComoLeer, EdActividad, EdBandejaIntake, EdDecisiones });
