// ═══════════════════════════════════════════════════════════════
// EDITORIAL — ÍNDICE DE PROYECTOS
// Vista que aparece cuando alguien tiene varios proyectos.
// Lista editorial con métricas, rol, foco y un destacado en card.
// ═══════════════════════════════════════════════════════════════

function EdProyectosIndex({ theme = 'light' }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .pi-toolbar { display:flex; align-items:center; gap:14px; padding:14px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:36px; }
    .pi-tabs { display:flex; gap:24px; }
    .pi-tab { font-size:12px; color:${t.muted}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; cursor:pointer; padding-bottom:2px; border-bottom:2px solid transparent; }
    .pi-tab.active { color:${t.ink}; border-color:${t.accent}; }
    .pi-tab .pi-tab-c { font-family:'JetBrains Mono',monospace; color:${t.dim}; margin-left:6px; font-weight:600; }
    .pi-tab.active .pi-tab-c { color:${t.accent}; }
    .pi-search { margin-left:auto; font-size:12px; color:${t.dim}; }
    .pi-sort { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; }

    /* HERO featured project */
    .pi-hero { display:grid; grid-template-columns:1.6fr 1fr; gap:36px; padding:28px 0 32px; border-bottom:1px solid ${t.rule}; margin-bottom:36px; }
    .pi-hero-eye { font-size:10px; color:${t.accent}; text-transform:uppercase; letter-spacing:1.8px; font-weight:800; margin-bottom:10px; }
    .pi-hero-name { font-family:'Fraunces',Georgia,serif; font-size:34px; font-weight:400; line-height:1.1; letter-spacing:-.8px; margin-bottom:10px; }
    .pi-hero-name em { font-style:italic; color:${t.accent}; }
    .pi-hero-lede { font-size:14px; color:${t.muted}; line-height:1.55; margin-bottom:18px; max-width:540px; }
    .pi-hero-lede b { color:${t.ink}; }
    .pi-hero-meta { display:flex; gap:24px; flex-wrap:wrap; padding-top:14px; border-top:1px solid ${t.rule}; }
    .pi-hero-stat { }
    .pi-hero-stat-num { font-family:'Fraunces',Georgia,serif; font-size:28px; font-weight:300; line-height:1; letter-spacing:-.6px; font-variant-numeric:tabular-nums; }
    .pi-hero-stat-num.warn { color:${t.warn}; }
    .pi-hero-stat-num.crit { color:${t.critical}; }
    .pi-hero-stat-num em { font-style:normal; font-size:13px; color:${t.dim}; font-weight:400; margin-left:2px; }
    .pi-hero-stat-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-top:4px; }
    .pi-hero-card { background:${t.paper}; border:1px solid ${t.rule}; border-radius:6px; padding:22px; }
    .pi-hero-card-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:12px; }
    .pi-hero-card-h { font-size:14px; font-weight:700; margin-bottom:14px; line-height:1.35; }
    .pi-hero-card-h b { color:${t.critical}; }
    .pi-mini-task { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid ${t.rule}; align-items:center; }
    .pi-mini-task:last-child { border-bottom:none; padding-bottom:0; }
    .pi-mini-id { font-family:'JetBrains Mono',monospace; font-size:10px; color:${t.dim}; }
    .pi-mini-name { font-size:12.5px; color:${t.ink}; font-weight:600; flex:1; line-height:1.3; }
    .pi-mini-eta { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.1px; font-weight:700; white-space:nowrap; }
    .pi-mini-eta.crit { color:${t.critical}; }
    .pi-mini-eta.warn { color:${t.warn}; }

    /* ROW projects */
    .pi-row { display:grid; grid-template-columns:auto 1fr 1fr 1fr 1fr auto; gap:24px; align-items:center; padding:22px 0; border-bottom:1px solid ${t.rule}; cursor:pointer; transition:background .12s; }
    .pi-row:hover { background:${t.ruleSoft}; margin:0 -16px; padding:22px 16px; }
    .pi-rank { font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:300; font-size:24px; color:${t.dim}; line-height:1; font-variant-numeric:tabular-nums; min-width:30px; }
    .pi-name-block { min-width:0; }
    .pi-name-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-bottom:5px; display:flex; gap:8px; align-items:center; }
    .pi-name-eye .role { color:${t.accent}; }
    .pi-name-eye .role.muted { color:${t.dim}; }
    .pi-name { font-family:'Fraunces',Georgia,serif; font-size:20px; font-weight:400; line-height:1.2; letter-spacing:-.3px; margin-bottom:5px; }
    .pi-name em { font-style:italic; color:${t.accent}; }
    .pi-sub { font-size:12px; color:${t.muted}; line-height:1.4; }
    .pi-stat-cell { }
    .pi-stat-num { font-family:'Fraunces',Georgia,serif; font-size:22px; font-weight:300; line-height:1; letter-spacing:-.4px; font-variant-numeric:tabular-nums; }
    .pi-stat-num.warn { color:${t.warn}; }
    .pi-stat-num.crit { color:${t.critical}; }
    .pi-stat-num.good { color:${t.good}; }
    .pi-stat-num em { font-style:normal; font-size:11px; color:${t.dim}; font-weight:400; margin-left:2px; }
    .pi-stat-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-top:4px; }

    .pi-prog { width:100%; height:4px; background:${t.paper3}; border-radius:2px; overflow:hidden; display:flex; margin-bottom:6px; }
    .pi-prog-seg.done { background:${t.good}; }
    .pi-prog-seg.curso { background:${t.info}; }
    .pi-prog-seg.crit { background:${t.critical}; }
    .pi-prog-pct { font-size:11px; color:${t.muted}; font-family:'JetBrains Mono',monospace; }
    .pi-prog-pct b { color:${t.ink}; font-weight:700; }

    .pi-people { display:flex; }
    .pi-person { width:24px; height:24px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:800; font-size:9px; border:2px solid ${t.bg}; margin-left:-6px; }
    .pi-person:first-child { margin-left:0; }
    .pi-person.more { background:${t.paper3}; color:${t.muted}; }

    .pi-arrow { color:${t.dim}; font-size:18px; }

    /* Footer */
    .pi-foot { padding:24px 0; margin-top:18px; display:flex; gap:14px; align-items:center; }
    .pi-foot-info { font-size:12px; color:${t.muted}; flex:1; }
    .pi-foot-info b { color:${t.ink}; font-weight:700; }
  `;
  const css = edScope(scope, rawCSS);

  // Featured: Legal Tracker (el más urgente)
  const featured = {
    name: 'Legal Tracker', emName: 'renovación', tail: 'de contratos críticos.',
    role: 'Owner', country: 'CO',
    lede: <>Renegociar y modernizar los <b>42 contratos activos</b> del marketplace. Llevamos <b>3 cerrados</b> y vencen en <b>14 días</b>.</>,
    stats: [
      { num: '07', sub: 'tareas activas', cls: '' },
      { num: '01', sub: 'atrasada', cls: 'crit' },
      { num: '04', sub: 'equipo', cls: '' },
      { num: '14', em: 'd', sub: 'al cierre', cls: 'warn' },
    ],
    nextSteps: [
      { id:'T-138', name:'Revisar contrato proveedor delivery', eta:'venció ayer', cls:'crit' },
      { id:'T-115', name:'Demanda consumidor — Medellín', eta:'mañana', cls:'warn' },
      { id:'T-161', name:'Opinión regulatoria — método de pago', eta:'mañana', cls:'warn' },
    ],
  };

  // El resto de proyectos
  const projects = [
    {
      role: 'Participante', tag: 'Lidera Ana Bravo (HQ)',
      name: 'Mapping litigio', em: 'Colombia', tail: '2025',
      sub: 'Cartografía de litigios activos por tipo, monto y exposición. Base de datos para reporting trimestral.',
      tasks: 8, mine: 1, overdue: 0, deadlineDays: 21,
      progress: { done: 25, curso: 50, crit: 0, total: 100 },
      pctNum: 25,
      people: [
        {a:'AB',c:'#6B4D7A'}, {a:'JC',c:'#B8551F'}, {a:'JM',c:'#A57F2C'}, {a:'CF',c:'#4A6B8A'}, {a:'+2',c:null},
      ],
    },
    {
      role: 'Participante', tag: 'Lidera María R. (Privacy)',
      name: 'Compliance', em: 'GDPR', tail: 'LATAM',
      sub: 'Adecuación de tratamiento de datos a GDPR + leyes locales (Habeas Data CO, LGPD BR, LFPDPPP MX).',
      tasks: 12, mine: 1, overdue: 0, deadlineDays: 45,
      progress: { done: 40, curso: 35, crit: 8, total: 100 },
      pctNum: 40,
      people: [
        {a:'MR',c:'#3D6478'}, {a:'JC',c:'#B8551F'}, {a:'AB',c:'#6B4D7A'}, {a:'+2',c:null},
      ],
    },
    {
      role: 'Observador', tag: 'Lidera Carlos F. (CO)',
      name: 'Renegociación', em: 'flota', tail: 'Bogotá.',
      sub: 'Revisión integral de contratos con socios de última milla en Bogotá. Bloqueado a la espera de comercial.',
      tasks: 5, mine: 0, overdue: 2, deadlineDays: 8,
      progress: { done: 20, curso: 30, crit: 40, total: 100 },
      pctNum: 20,
      people: [
        {a:'CF',c:'#4A6B8A'}, {a:'JC',c:'#B8551F'}, {a:'FC',c:'#5A7050'},
      ],
    },
    {
      role: 'Owner', tag: '',
      name: 'Términos y', em: 'condiciones', tail: 'v4 — release.',
      sub: 'Actualización mayor de T&C tras cambios regulatorios SIC. Roll-out a 3 países.',
      tasks: 4, mine: 2, overdue: 0, deadlineDays: 32,
      progress: { done: 60, curso: 25, crit: 0, total: 100 },
      pctNum: 60,
      people: [
        {a:'JC',c:'#B8551F'}, {a:'AB',c:'#6B4D7A'},
      ],
    },
  ];

  const Person = ({a,c}) => (
    <div className={`pi-person ${c===null?'more':''}`} style={{background: c || undefined}}>{a}</div>
  );

  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className="ed-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role="specialist" activeItem="proyectos"/>
      <main className="ed-main">
        <EdHeader t={t}/>

        <div className="ed-eye">Mis proyectos</div>
        <h1 className="ed-h1">Cinco frentes abiertos. <em>Dos te pertenecen,</em><br/>tres los acompañas.</h1>
        <p className="ed-lede">
          Estás en <b>5 proyectos activos</b>. Sos owner de <b>2</b> y participante o observador de <b>3</b>.
          Sumadas, son <b>4 tareas tuyas</b> repartidas entre ellos. Empezamos por el que vence primero.
        </p>

        {/* Toolbar */}
        <div className="pi-toolbar">
          <div className="pi-tabs">
            <span className="pi-tab active">Activos<span className="pi-tab-c">5</span></span>
            <span className="pi-tab">Donde participas<span className="pi-tab-c">3</span></span>
            <span className="pi-tab">Que lideras<span className="pi-tab-c">2</span></span>
            <span className="pi-tab">Cerrados<span className="pi-tab-c">11</span></span>
          </div>
          <div className="pi-sort">Orden: por urgencia ↓</div>
        </div>

        {/* Featured project */}
        <div className="pi-hero">
          <div>
            <div className="pi-hero-eye">— Más urgente · vence en 14 días</div>
            <div className="pi-hero-name">{featured.name} — <em>{featured.emName}</em><br/>{featured.tail}</div>
            <p className="pi-hero-lede">{featured.lede}</p>
            <div className="pi-hero-meta">
              {featured.stats.map((s, i) => (
                <div key={i} className="pi-hero-stat">
                  <div className={`pi-hero-stat-num ${s.cls}`}>{s.num}{s.em && <em>{s.em}</em>}</div>
                  <div className="pi-hero-stat-lbl">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pi-hero-card">
            <div className="pi-hero-card-eye">— Próximas 3 tareas tuyas</div>
            <div className="pi-hero-card-h">Hay <b>1 atrasada</b> y 2 vencen mañana. <span style={{color:t.muted,fontWeight:600}}>Después podés volver al resto.</span></div>
            {featured.nextSteps.map(s => (
              <div key={s.id} className="pi-mini-task">
                <span className="pi-mini-id">{s.id}</span>
                <span className="pi-mini-name">{s.name}</span>
                <span className={`pi-mini-eta ${s.cls}`}>{s.eta}</span>
              </div>
            ))}
            <div style={{marginTop:14}}>
              <button className="ed-btn primary">Abrir proyecto →</button>
            </div>
          </div>
        </div>

        {/* Resto de proyectos */}
        <section className="ed-section" style={{marginBottom:0}}>
          <div className="ed-h2">— Otros proyectos donde estás</div>
          {projects.map((p, i) => {
            const dl = p.deadlineDays;
            const dlCls = dl <= 14 ? 'warn' : '';
            const isOwner = p.role === 'Owner';
            return (
              <div key={i} className="pi-row">
                <div className="pi-rank">{String(i+2).padStart(2,'0')}</div>
                <div className="pi-name-block">
                  <div className="pi-name-eye">
                    <span className={`role ${isOwner?'':'muted'}`}>{p.role}</span>
                    {p.tag && <><span style={{color:t.dim}}>·</span><span>{p.tag}</span></>}
                  </div>
                  <div className="pi-name">{p.name} <em>{p.em}</em> {p.tail}</div>
                  <div className="pi-sub">{p.sub}</div>
                </div>
                <div className="pi-stat-cell">
                  <div className="pi-stat-num">{String(p.tasks).padStart(2,'0')}</div>
                  <div className="pi-stat-lbl">tareas · {p.mine} tuya{p.mine===1?'':'s'}</div>
                </div>
                <div className="pi-stat-cell">
                  <div className="pi-prog">
                    <div className="pi-prog-seg done" style={{width:`${p.progress.done}%`}}/>
                    <div className="pi-prog-seg curso" style={{width:`${p.progress.curso}%`}}/>
                    <div className="pi-prog-seg crit" style={{width:`${p.progress.crit}%`}}/>
                  </div>
                  <div className="pi-prog-pct"><b>{p.pctNum}%</b> · {p.overdue>0 && <span style={{color:t.critical,fontWeight:700}}>{p.overdue} atrasada{p.overdue===1?'':'s'}</span>}{p.overdue===0 && 'al día'}</div>
                </div>
                <div className="pi-stat-cell">
                  <div className={`pi-stat-num ${dlCls}`}>{dl}<em>d</em></div>
                  <div className="pi-stat-lbl">al cierre</div>
                </div>
                <div className="pi-people">
                  {p.people.map((p, j) => <Person key={j} {...p}/>)}
                </div>
              </div>
            );
          })}
        </section>

        <div className="pi-foot">
          <div className="pi-foot-info">
            <b>5 proyectos activos · 11 cerrados este trimestre.</b> Los proyectos cerrados quedan en historial y se pueden re-abrir si vuelve a aparecer una tarea relacionada.
          </div>
          <button className="ed-btn">Ver historial</button>
          <button className="ed-btn accent">+ Nuevo proyecto</button>
        </div>

      </main>
    </div>
    </div>
  );
}

Object.assign(window, { EdProyectosIndex });
