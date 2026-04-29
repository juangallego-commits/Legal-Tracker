// ═══════════════════════════════════════════════════════════════
// DIRECTION 2 — EDITORIAL CALMO
// Neutro (light/dark), acento táctico ámbar, tipografía con carácter,
// insights narrativos en lugar de conteos. Aire generoso.
// ═══════════════════════════════════════════════════════════════

function D2Shell({ theme = 'light' }) {
  const dark = theme === 'dark';
  const t = dark ? {
    bg: '#111114', paper: '#17181C', paper2: '#1E1F25', ink: '#EDEDEE',
    muted: '#9A9AA2', dim: '#63646C', rule: 'rgba(255,255,255,.08)',
    ruleSoft: 'rgba(255,255,255,.04)',
  } : {
    bg: '#FAFAF7', paper: '#FFFFFF', paper2: '#F2F1EC', ink: '#1A1A1A',
    muted: '#5B5B5B', dim: '#9A998F', rule: 'rgba(0,0,0,.09)',
    ruleSoft: 'rgba(0,0,0,.04)',
  };
  const accent = '#B8551F';      // burnt sienna (táctico, no agresivo)
  const accentSoft = dark ? 'rgba(184,85,31,.15)' : 'rgba(184,85,31,.08)';
  const critical = '#C8372D';
  const good = '#4A7C59';
  const warn = '#C68B2B';

  const css = `
    .d2-root { font-family: 'Nunito Sans', system-ui, sans-serif; background: ${t.bg}; color: ${t.ink}; min-height: 100%; display: grid; grid-template-columns: 218px 1fr; }
    .d2-side { border-right: 1px solid ${t.rule}; padding: 28px 20px; position: sticky; top: 0; height: 100vh; max-height: 1200px; }
    .d2-brand { font-family: 'Fraunces', Georgia, serif; font-weight: 600; font-size: 20px; letter-spacing: -.5px; line-height: 1; margin-bottom: 2px; font-style: italic; }
    .d2-brand-sub { font-size: 10px; color: ${t.dim}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid ${t.rule}; }
    .d2-nav-section { margin-bottom: 22px; }
    .d2-nav-label { font-size: 10px; color: ${t.dim}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 10px; padding: 0 8px; }
    .d2-nav-item { display: flex; align-items: center; gap: 11px; padding: 6px 8px; font-size: 13px; color: ${t.muted}; cursor: pointer; border-radius: 4px; transition: all .12s; font-weight: 500; }
    .d2-nav-item:hover { color: ${t.ink}; }
    .d2-nav-item.active { color: ${accent}; font-weight: 700; }
    .d2-nav-item.active::before { content: ''; width: 2px; height: 14px; background: ${accent}; margin-left: -10px; margin-right: 8px; }
    .d2-nav-item.active:not(:has(+ *))::before, .d2-nav-item:not(.active)::before { display: none; }
    .d2-nav-item.active { padding-left: 0; }
    .d2-nav-item.active > .d2-ind { width: 2px; height: 14px; background: ${accent}; display: inline-block; }
    .d2-nav-badge { margin-left: auto; font-size: 10px; color: ${t.dim}; font-family: 'JetBrains Mono', monospace; font-weight: 600; }
    .d2-nav-item.active .d2-nav-badge { color: ${accent}; }

    .d2-main { padding: 48px 56px 80px; max-width: 1180px; min-width: 0; }
    .d2-eye { font-size: 11px; color: ${t.dim}; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 14px; }
    .d2-title { font-family: 'Fraunces', Georgia, serif; font-weight: 400; font-size: 42px; line-height: 1.08; letter-spacing: -1px; margin-bottom: 12px; }
    .d2-title em { font-style: italic; color: ${accent}; }
    .d2-lede { font-size: 15px; color: ${t.muted}; max-width: 720px; line-height: 1.55; margin-bottom: 40px; }
    .d2-lede b { color: ${t.ink}; font-weight: 700; }
    .d2-lede .crit { color: ${critical}; font-weight: 700; }

    .d2-head-row { display: flex; align-items: center; gap: 12px; margin-bottom: 48px; padding-bottom: 20px; border-bottom: 1px solid ${t.rule}; }
    .d2-search { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0; color: ${t.dim}; font-size: 13px; }
    .d2-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; font-size: 12px; font-weight: 700; border-radius: 4px; border: 1px solid ${t.rule}; background: transparent; color: ${t.ink}; cursor: pointer; font-family: inherit; }
    .d2-btn.primary { background: ${t.ink}; color: ${t.bg}; border-color: ${t.ink}; }

    /* ── section ── */
    .d2-section { margin-bottom: 56px; }
    .d2-h2 { font-family: 'Fraunces', Georgia, serif; font-size: 24px; font-weight: 400; letter-spacing: -.4px; margin-bottom: 6px; }
    .d2-h2 em { color: ${accent}; font-style: italic; }
    .d2-kicker { font-size: 12px; color: ${t.dim}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; }
    .d2-kicker::after { content: ''; flex: 1; height: 1px; background: ${t.rule}; }

    /* ── focus list ── */
    .d2-focus { display: flex; flex-direction: column; }
    .d2-focus-row { display: grid; grid-template-columns: 40px 1fr auto; gap: 20px; align-items: baseline; padding: 20px 0; border-bottom: 1px solid ${t.rule}; cursor: pointer; transition: background .12s; }
    .d2-focus-row:hover { background: ${t.ruleSoft}; margin: 0 -16px; padding: 20px 16px; }
    .d2-focus-rank { font-family: 'Fraunces', Georgia, serif; font-size: 32px; color: ${t.dim}; font-weight: 300; font-style: italic; line-height: 1; }
    .d2-focus-rank.crit { color: ${critical}; }
    .d2-focus-body { min-width: 0; }
    .d2-focus-name { font-size: 17px; font-weight: 600; margin-bottom: 6px; letter-spacing: -.2px; color: ${t.ink}; }
    .d2-focus-narr { font-size: 13px; color: ${t.muted}; line-height: 1.55; max-width: 640px; }
    .d2-focus-narr b { color: ${t.ink}; font-weight: 700; }
    .d2-focus-narr .crit { color: ${critical}; font-weight: 700; }
    .d2-focus-narr .accent { color: ${accent}; font-weight: 700; }
    .d2-focus-meta { text-align: right; font-size: 11px; color: ${t.dim}; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; white-space: nowrap; }
    .d2-focus-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${t.dim}; letter-spacing: 0; text-transform: none; margin-bottom: 4px; }

    /* ── team narrative ── */
    .d2-team { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 1px solid ${t.rule}; }
    .d2-team-col { padding: 24px 24px 24px 0; border-right: 1px solid ${t.rule}; }
    .d2-team-col:last-child { border-right: none; padding-right: 0; }
    .d2-team-col:not(:first-child) { padding-left: 24px; }
    .d2-team-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .d2-team-name { font-size: 14px; font-weight: 700; letter-spacing: -.2px; }
    .d2-team-role { font-size: 11px; color: ${t.dim}; }
    .d2-team-verdict { font-family: 'Fraunces', Georgia, serif; font-size: 19px; font-weight: 400; line-height: 1.25; letter-spacing: -.3px; margin-bottom: 10px; color: ${t.ink}; }
    .d2-team-verdict em { font-style: italic; }
    .d2-team-verdict.high em { color: ${critical}; }
    .d2-team-verdict.low em { color: ${good}; }
    .d2-team-verdict.medium em { color: ${warn}; }
    .d2-team-detail { font-size: 12px; color: ${t.muted}; line-height: 1.5; margin-bottom: 14px; }
    .d2-team-load { display: flex; align-items: center; gap: 10px; font-size: 11px; color: ${t.dim}; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .d2-team-load-bar { flex: 1; height: 3px; background: ${t.rule}; position: relative; border-radius: 0; }
    .d2-team-load-bar span { position: absolute; inset: 0; border-radius: 0; }

    /* ── risk projects ── */
    .d2-risk-row { display: grid; grid-template-columns: 1fr auto; gap: 24px; padding: 22px 0; border-bottom: 1px solid ${t.rule}; align-items: center; }
    .d2-risk-row:first-of-type { padding-top: 4px; }
    .d2-risk-name { font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 400; letter-spacing: -.4px; margin-bottom: 6px; line-height: 1.15; }
    .d2-risk-narr { font-size: 13px; color: ${t.muted}; line-height: 1.5; max-width: 580px; }
    .d2-risk-narr .crit { color: ${critical}; font-weight: 700; }
    .d2-risk-narr .warn { color: ${warn}; font-weight: 700; }
    .d2-risk-narr .good { color: ${good}; font-weight: 700; }
    .d2-risk-gauge { text-align: right; }
    .d2-risk-pct { font-family: 'Fraunces', Georgia, serif; font-size: 36px; font-weight: 300; line-height: 1; font-feature-settings: 'tnum'; }
    .d2-risk-pct.high { color: ${critical}; }
    .d2-risk-pct.medium { color: ${warn}; }
    .d2-risk-pct.low { color: ${good}; }
    .d2-risk-ratio { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${t.dim}; margin-top: 4px; }

    /* ── week at a glance ── */
    .d2-week { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 24px; padding-top: 24px; border-top: 1px solid ${t.rule}; }
    .d2-week-cell { padding-right: 20px; border-right: 1px solid ${t.rule}; }
    .d2-week-cell:last-child { border-right: none; }
    .d2-week-cell:not(:first-child) { padding-left: 20px; }
    .d2-week-num { font-family: 'Fraunces', Georgia, serif; font-size: 44px; font-weight: 300; line-height: 1; letter-spacing: -1.5px; margin-bottom: 6px; }
    .d2-week-num.crit { color: ${critical}; }
    .d2-week-label { font-size: 11px; color: ${t.dim}; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-bottom: 4px; }
    .d2-week-ctx { font-size: 12px; color: ${t.muted}; }
    .d2-week-ctx .crit { color: ${critical}; font-weight: 700; }
    .d2-week-ctx .good { color: ${good}; font-weight: 700; }
  `;

  return (
    <div className="d2-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <aside className="d2-side">
        <div className="d2-brand">Legal</div>
        <div className="d2-brand-sub">Tracker · Rappi</div>
        {NAV.map((sec, i) => (
          <div key={i} className="d2-nav-section">
            <div className="d2-nav-label">{sec.section}</div>
            {sec.items.map(it => (
              <div key={it.id} className={`d2-nav-item ${it.id === 'home' ? 'active' : ''}`}>
                <span>{it.label}</span>
                {it.badge != null && <span className="d2-nav-badge">{it.badge}</span>}
              </div>
            ))}
          </div>
        ))}
      </aside>

      <main className="d2-main">
        <div className="d2-head-row">
          <div className="d2-search"><Icon name="search" size={14}/> <span>Buscar —</span></div>
          <button className="d2-btn">Semana 17 · 23 abr</button>
          <button className="d2-btn primary"><Icon name="plus" size={12}/> Nuevo</button>
        </div>

        <div className="d2-eye">Jueves · 10:15 · Resumen de la jornada</div>
        <h1 className="d2-title">Buenos días, Juan Camilo.<br/>Hoy el equipo <em>va detrás</em>.</h1>
        <p className="d2-lede">
          Tienes <b>4 tareas</b> que requieren tu atención antes del cierre del día —
          <span className="crit"> una lleva tres días vencida por un bloqueo externo</span>,
          y otra vence mañana con SLA Alta. El equipo cerró <b>1 tarea esta semana</b>
          —siete menos que la pasada— y <b>Colombia</b> concentra el 93% del atraso global.
        </p>

        {/* FOCUS */}
        <section className="d2-section">
          <div className="d2-kicker">— En tu mesa, por orden de urgencia</div>
          <div className="d2-focus">
            {MY_PRIORITIZED.map((p, i) => (
              <div key={p.task.id} className="d2-focus-row">
                <div className={`d2-focus-rank ${p.urgency === 'critical' ? 'crit' : ''}`}>{String(i+1).padStart(2,'0')}</div>
                <div className="d2-focus-body">
                  <div className="d2-focus-id">{p.task.id} · {p.task.project || 'sin proyecto'}</div>
                  <div className="d2-focus-name">{p.task.name}</div>
                  <div className="d2-focus-narr">
                    {i === 0 && <>Lleva <span className="crit">4 días bloqueada</span> esperando respuesta de RR.HH. sobre el contrato original. Cada día que pasa es un día más en que la audiencia puede aplazarse. <span className="accent">Sugerencia: escalar a Carlos E. hoy.</span></>}
                    {i === 1 && <>Vence <b>mañana</b> y aún estás en revisión de la cláusula 7.2. SLA Alta exige <b>2 días</b> — ya consumiste el 50%. El contrato es con un proveedor crítico de última milla.</>}
                    {i === 2 && <>La política está lista, solo falta la firma del Privacy Officer. <b>Vence hoy.</b> <span className="accent">Un recordatorio directo puede destrabarla.</span></>}
                    {i === 3 && <>Tienes <b>2 días</b> antes del deadline. El memorándum inicial es tu primer entregable — empieza hoy y dejas margen para iteración.</>}
                  </div>
                </div>
                <div className="d2-focus-meta">
                  {fmtDeadline(p.task.deadline).text.toUpperCase()}<br/>
                  <span style={{fontSize:10,color:t.dim,letterSpacing:1}}>SLA {p.task.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TEAM */}
        <section className="d2-section">
          <div className="d2-kicker">— Cómo está el equipo</div>
          <div className="d2-team">
            {BOTTLENECKS.map((b, i) => (
              <div key={i} className="d2-team-col">
                <div className="d2-team-head">
                  <Avatar person={b.person} size={34}/>
                  <div>
                    <div className="d2-team-name">{b.person.name}</div>
                    <div className="d2-team-role">{b.person.role}</div>
                  </div>
                </div>
                <div className={`d2-team-verdict ${b.severity}`}>
                  {i === 0 && <>Está <em>al límite</em>. Dos vencidas y un bloqueo externo.</>}
                  {i === 1 && <>Tiene <em>margen</em> —puede absorber 2 o 3 tareas más.</>}
                  {i === 2 && <>Una vencida <em>desde hace 4 días</em>. La SIC espera respuesta.</>}
                </div>
                <div className="d2-team-detail">{b.detail}</div>
                <div className="d2-team-load">
                  <span>{b.load}/{b.capacity}</span>
                  <div className="d2-team-load-bar"><span style={{width:`${Math.min(100,b.load/b.capacity*100)}%`, background: b.severity === 'high' ? critical : b.severity === 'medium' ? warn : good}}/></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RISK PROJECTS */}
        <section className="d2-section">
          <div className="d2-kicker">— Proyectos que debemos mirar</div>
          {PROJECTS.map(p => (
            <div key={p.id} className="d2-risk-row">
              <div>
                <div className="d2-risk-name">{p.name}</div>
                <div className="d2-risk-narr">
                  {p.risk === 'high' && <><span className="crit">Dos tareas vencidas</span> y el owner bloqueado. Sin movimiento en 6 días. Vence en {p.dueIn} días.</>}
                  {p.risk === 'medium' && <>Una tarea <span className="warn">sin mover en 9 días</span> — el tracker que estás leyendo ahora mismo. Vence en {p.dueIn} días.</>}
                  {p.risk === 'low' && <><span className="good">En ritmo.</span> Tres tareas cerradas esta quincena, cinco en curso sin bloqueos.</>}
                </div>
              </div>
              <div className="d2-risk-gauge">
                <div className={`d2-risk-pct ${p.risk}`}>{Math.round(p.completed/p.tasks*100)}%</div>
                <div className="d2-risk-ratio">{p.completed}/{p.tasks} tareas</div>
              </div>
            </div>
          ))}
        </section>

        {/* WEEK GLANCE */}
        <section className="d2-section">
          <div className="d2-kicker">— Esta semana en números</div>
          <div className="d2-week">
            <div className="d2-week-cell">
              <div className="d2-week-num">20</div>
              <div className="d2-week-label">Activas</div>
              <div className="d2-week-ctx"><span className="good">+3</span> vs. semana pasada</div>
            </div>
            <div className="d2-week-cell">
              <div className="d2-week-num crit">13</div>
              <div className="d2-week-label">Vencidas</div>
              <div className="d2-week-ctx"><span className="crit">+5 hoy</span>, casi todas en CO</div>
            </div>
            <div className="d2-week-cell">
              <div className="d2-week-num" style={{color:warn}}>50<span style={{fontSize:20}}>%</span></div>
              <div className="d2-week-label">On-time 30d</div>
              <div className="d2-week-ctx">Meta 80%, <span className="crit">-12pp</span> el mes</div>
            </div>
            <div className="d2-week-cell">
              <div className="d2-week-num" style={{color:good}}>01</div>
              <div className="d2-week-label">Cerradas</div>
              <div className="d2-week-ctx">8 promedio histórico</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

Object.assign(window, { D2Shell });
