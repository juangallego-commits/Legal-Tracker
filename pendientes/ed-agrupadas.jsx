// ═══════════════════════════════════════════════════════════════
// EDITORIAL — VISTA INTERMEDIA "Tus tareas agrupadas"
// Antes de entrar al tracker denso, un mapa por prioridad/proyecto/tipo
// ═══════════════════════════════════════════════════════════════

function EdAgrupadas({ theme = 'light' }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .ag-tabs { display:flex; gap:0; margin-bottom:36px; border-bottom:1px solid ${t.rule}; }
    .ag-tab { padding:10px 18px; font-size:12px; font-weight:700; color:${t.muted}; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; text-transform:uppercase; letter-spacing:1px; }
    .ag-tab.active { color:${t.ink}; border-color:${t.accent}; }

    .ag-bucket { margin-bottom:48px; }
    .ag-bhead { display:flex; align-items:baseline; gap:14px; margin-bottom:18px; padding-bottom:10px; border-bottom:1px solid ${t.rule}; }
    .ag-btitle { font-family:'Fraunces',Georgia,serif; font-size:24px; font-weight:400; letter-spacing:-.5px; }
    .ag-btitle.crit { color:${t.critical}; }
    .ag-btitle.warn { color:${t.warn}; }
    .ag-bcount { font-family:'JetBrains Mono',monospace; font-size:13px; color:${t.dim}; font-weight:600; }
    .ag-bnarr { font-size:13px; color:${t.muted}; flex:1; line-height:1.5; }
    .ag-bnarr b { color:${t.ink}; font-weight:700; }
    .ag-bnarr .crit { color:${t.critical}; font-weight:700; }

    .ag-cards { display:grid; grid-template-columns:repeat(2,1fr); gap:0; border-top:1px solid ${t.rule}; border-left:1px solid ${t.rule}; }
    .ag-card { padding:16px 18px; border-bottom:1px solid ${t.rule}; border-right:1px solid ${t.rule}; cursor:pointer; transition:background .12s; }
    .ag-card:hover { background:${t.ruleSoft}; }
    .ag-card-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color:${t.dim}; margin-bottom:6px; letter-spacing:.5px; display:flex; gap:8px; align-items:center; }
    .ag-card-meta .sep { color:${t.ruleStrong}; }
    .ag-card-name { font-size:13.5px; font-weight:700; color:${t.ink}; margin-bottom:6px; line-height:1.3; }
    .ag-card-action { font-size:12px; color:${t.muted}; line-height:1.45; margin-bottom:12px; min-height:34px; }
    .ag-card-action .warn { color:${t.warn}; font-weight:700; }
    .ag-card-foot { display:flex; align-items:center; gap:6px; }
    .ag-card-eta { margin-left:auto; font-size:11px; font-weight:700; color:${t.dim}; text-transform:uppercase; letter-spacing:1px; }
    .ag-card-eta.crit { color:${t.critical}; }
    .ag-card-eta.warn { color:${t.warn}; }
  `;
  const css = edScope(scope, rawCSS);

  const buckets = [
    {
      key: 'overdue', tone: 'warn', title: 'Pendientes de cierre',
      narr: <>Tareas que venían con prioridad alta y se pasaron del SLA. Una está esperando a RR.HH., otra ya en curso. <b>Acción sugerida: hacer un seguimiento o escalar amablemente.</b></>,
      tasks: ED_BUCKETS_MINE.overdue,
    },
    {
      key: 'today', tone: 'warn', title: 'Vencen hoy',
      narr: <>Una sola, pero clave: <b>policy de data retention</b>, esperando firma del Privacy Officer. Vale la pena un mensaje recordatorio.</>,
      tasks: ED_BUCKETS_MINE.today,
    },
    {
      key: 'week', tone: '', title: 'Esta semana',
      narr: <>3 tareas con buen margen. Te conviene empezar por la <b>opinión regulatoria de método de pago</b> — es la de mayor alcance.</>,
      tasks: ED_BUCKETS_MINE.thisWeek,
    },
    {
      key: 'later', tone: '', title: 'Más adelante',
      narr: <>2 tareas con SLA holgado. <b>No te apures hoy</b>; podrás atenderlas con tiempo.</>,
      tasks: ED_BUCKETS_MINE.later,
    },
  ];

  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className="ed-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role="specialist" activeItem="agrupadas"/>
      <main className="ed-main">
        <EdHeader t={t}/>
        <div className="ed-eye">Mis tareas — agrupadas por prioridad</div>
        <h1 className="ed-h1">Siete tareas, cuatro <em>franjas</em><br/>de tiempo distintas.</h1>
        <p className="ed-lede">
          Antes de meterte a la tabla densa, esta es la lectura rápida: dónde está cada cosa y qué te conviene atender
          primero. Empezá por las pendientes de cierre, las de "más adelante" pueden esperar tranquilas.
        </p>

        <div className="ag-tabs">
          <div className="ag-tab active">Por prioridad</div>
          <div className="ag-tab">Por proyecto</div>
          <div className="ag-tab">Por tipo</div>
          <div className="ag-tab">Por riesgo</div>
        </div>

        {buckets.map(b => (
          <div key={b.key} className="ag-bucket">
            <div className="ag-bhead">
              <div className={`ag-btitle ${b.tone}`}>— {b.title}</div>
              <div className="ag-bcount">{String(b.tasks.length).padStart(2,'0')}</div>
              <div className="ag-bnarr">{b.narr}</div>
            </div>
            <div className="ag-cards">
              {b.tasks.map(task => {
                const tone = task.deadline < 0 ? 'crit' : task.deadline === 0 ? 'crit' : task.deadline === 1 ? 'warn' : '';
                const statusClass = task.status === 'En curso' ? 'curso' : task.status === 'En revisión' ? 'revision' : task.status === 'Bloqueado' ? 'bloqueado' : 'pendiente';
                return (
                  <div key={task.id} className="ag-card">
                    <div className="ag-card-meta">
                      <span>{task.id}</span>
                      <span className="sep">·</span>
                      <span>{task.project || 'Sin proyecto'}</span>
                      <span className="sep">·</span>
                      <span>SLA {task.sla}</span>
                    </div>
                    <div className="ag-card-name">{task.name}</div>
                    <div className="ag-card-action">
                      {task.blocked ? <><span className="warn">En espera de {task.blocked}.</span> {task.accionable}</> : task.accionable}
                    </div>
                    <div className="ag-card-foot">
                      <span className={`ed-pill ${task.priority.toLowerCase()}`}>{task.priority}</span>
                      <span className={`ed-pill ${statusClass}`}>{task.status}</span>
                      <span className={`ag-card-eta ${tone}`}>{task.eta}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
    </div>
  );
}

Object.assign(window, { EdAgrupadas });
