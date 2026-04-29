// ═══════════════════════════════════════════════════════════════
// EDITORIAL — HOME SPECIALIST
// Foco: ETAs a vencer, vencidas, prioridades, métricas personales
// ═══════════════════════════════════════════════════════════════

// Compartido: rotación de frases inspiradoras (autores reconocidos)
const ED_QUOTES = [
  { q: "The only way to do great work is to love what you do.", who: "— Steve Jobs" },
  { q: "Someone's sitting in the shade today because someone planted a tree a long time ago.", who: "— Warren Buffett" },
  { q: "Whether you think you can or you think you can't, you're right.", who: "— Henry Ford" },
  { q: "It always seems impossible until it's done.", who: "— Nelson Mandela" },
  { q: "The secret of getting ahead is getting started.", who: "— Mark Twain" },
  { q: "Quality is not an act, it is a habit.", who: "— Aristotle" },
  { q: "Well done is better than well said.", who: "— Benjamin Franklin" },
  { q: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", who: "— Will Durant" },
];
const SPEC_QUOTES = ED_QUOTES;
window.ED_QUOTES = ED_QUOTES;

function EdHomeSpecialist({ theme = 'light', quoteIndex = 0 }) {
  const t = edTheme(theme);
  const quote = SPEC_QUOTES[quoteIndex % SPEC_QUOTES.length];
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .esp-quote { padding:18px 22px; border-left:2px solid ${t.accent}; background:${t.paper2}; margin-bottom:32px; display:flex; align-items:center; gap:18px; }
    .esp-quote-text { font-family:'Fraunces',Georgia,serif; font-style:italic; font-size:18px; line-height:1.4; color:${t.ink}; font-weight:400; flex:1; }
    .esp-quote-who { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; white-space:nowrap; }
    .esp-quote-dots { display:flex; gap:5px; align-items:center; }
    .esp-quote-dots span { width:5px; height:5px; border-radius:50%; background:${t.rule}; }
    .esp-quote-dots span.on { background:${t.accent}; }
    .esp-hero { display:grid; grid-template-columns:repeat(4,1fr); gap:0; margin-bottom:36px; padding:24px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; }
    .esp-stat { padding:0 22px; border-right:1px solid ${t.rule}; }
    .esp-stat:last-child { border-right:none; }
    .esp-stat:first-child { padding-left:0; }
    .esp-stat-num { font-family:'Fraunces',Georgia,serif; font-size:46px; font-weight:300; line-height:1; letter-spacing:-1.5px; margin-bottom:6px; font-variant-numeric:tabular-nums; }
    .esp-stat-num.crit { color:${t.critical}; }
    .esp-stat-num.warn { color:${t.warn}; }
    .esp-stat-num.good { color:${t.good}; }
    .esp-stat-lbl { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:6px; }
    .esp-stat-ctx { font-size:12px; color:${t.muted}; line-height:1.4; }
    .esp-stat-ctx .crit { color:${t.critical}; font-weight:700; }
    .esp-stat-ctx .good { color:${t.good}; font-weight:700; }

    .esp-task-row { display:grid; grid-template-columns:36px 1fr auto auto; gap:18px; align-items:center; padding:14px 0; border-bottom:1px solid ${t.rule}; cursor:pointer; transition:background .12s; }
    .esp-task-row:hover { background:${t.ruleSoft}; margin:0 -14px; padding:14px 14px; }
    .esp-task-rank { font-family:'Fraunces',Georgia,serif; font-size:24px; color:${t.dim}; font-weight:300; font-style:italic; line-height:1; font-variant-numeric:tabular-nums; }
    .esp-task-rank.crit { color:${t.critical}; }
    .esp-task-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color:${t.dim}; margin-bottom:3px; letter-spacing:.5px; }
    .esp-task-name { font-size:14px; font-weight:600; color:${t.ink}; margin-bottom:3px; letter-spacing:-.1px; }
    .esp-task-action { font-size:12px; color:${t.muted}; line-height:1.4; max-width:540px; }
    .esp-task-action .crit { color:${t.critical}; font-weight:700; }
    .esp-task-eta { text-align:right; font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; white-space:nowrap; }
    .esp-task-eta.crit { color:${t.critical}; }
    .esp-task-eta.warn { color:${t.warn}; }
    .esp-task-pills { display:flex; gap:5px; flex-direction:column; align-items:flex-end; }

    .esp-perf { display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; gap:0; padding:24px 0; border-top:1px solid ${t.rule}; }
    .esp-perf-cell { padding:0 24px; border-right:1px solid ${t.rule}; }
    .esp-perf-cell:first-child { padding-left:0; }
    .esp-perf-cell:last-child { border-right:none; }
    .esp-perf-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:8px; }
    .esp-perf-num { font-family:'Fraunces',Georgia,serif; font-size:36px; font-weight:300; line-height:1; letter-spacing:-1px; }
    .esp-perf-sub { font-size:11px; color:${t.muted}; margin-top:6px; }

    .esp-proj-row { display:grid; grid-template-columns:auto 1fr auto auto; gap:18px; align-items:center; padding:14px 0; border-bottom:1px solid ${t.rule}; }
    .esp-proj-name { font-size:14px; font-weight:700; color:${t.ink}; }
    .esp-proj-role { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; padding:2px 8px; border:1px solid ${t.rule}; border-radius:3px; }
    .esp-proj-progress { font-family:'JetBrains Mono',monospace; font-size:12px; color:${t.muted}; font-weight:600; }
  `;
  const css = edScope(scope, rawCSS);

  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className="ed-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role="specialist" activeItem="home"/>
      <main className="ed-main">
        <EdHeader t={t}/>

        <div className="ed-eye">Jueves 23 abril 2026 · 10:15</div>
        <h1 className="ed-h1">Buenos días, Juan Camilo.<br/>Hoy tienes <em>3 prioridades</em> para resolver.</h1>
        <p className="ed-lede">
          Dos esperan tu seguimiento desde hace unos días y una vence hoy con la firma del Privacy Officer pendiente.
          Llevas <b className="good">7 cierres a tiempo</b> seguidos — vas con buen ritmo.
        </p>

        <div className="esp-quote">
          <div className="esp-quote-text">"{quote.q}"</div>
          <div>
            <div className="esp-quote-who">{quote.who}</div>
            <div className="esp-quote-dots" style={{marginTop:6,justifyContent:'flex-end'}}>
              {SPEC_QUOTES.map((_,i) => <span key={i} className={i===(quoteIndex%SPEC_QUOTES.length)?'on':''}/>)}
            </div>
          </div>
        </div>

        {/* HERO STATS — qué hago AHORA */}
        <div className="esp-hero">
          <div className="esp-stat">
            <div className="esp-stat-lbl">Pendientes de cierre</div>
            <div className="esp-stat-num warn">02</div>
            <div className="esp-stat-ctx">esperando seguimiento</div>
          </div>
          <div className="esp-stat">
            <div className="esp-stat-lbl">Vencen hoy</div>
            <div className="esp-stat-num warn">01</div>
            <div className="esp-stat-ctx">prioridad alta · firma en curso</div>
          </div>
          <div className="esp-stat">
            <div className="esp-stat-lbl">Esta semana</div>
            <div className="esp-stat-num">04</div>
            <div className="esp-stat-ctx">2 alta · 2 media</div>
          </div>
          <div className="esp-stat">
            <div className="esp-stat-lbl">En espera externa</div>
            <div className="esp-stat-num">01</div>
            <div className="esp-stat-ctx">RR.HH. · seguimiento sugerido</div>
          </div>
        </div>

        {/* WHAT TO DO NOW */}
        <section className="ed-section">
          <div className="ed-h2">— En tu mesa, por prioridad</div>
          {ED_TASKS_MINE.slice(0,4).map((task, i) => {
            const tone = task.deadline < 0 ? 'crit' : task.deadline === 0 ? 'crit' : task.deadline === 1 ? 'warn' : '';
            const statusClass = task.status === 'En curso' ? 'curso' : task.status === 'En revisión' ? 'revision' : task.status === 'Bloqueado' ? 'bloqueado' : 'pendiente';
            return (
              <div key={task.id} className="esp-task-row">
                <div className={`esp-task-rank ${tone}`}>{String(i+1).padStart(2,'0')}</div>
                <div>
                  <div className="esp-task-meta">{task.id} · {task.project || 'Sin proyecto'} · SLA {task.sla}</div>
                  <div className="esp-task-name">{task.name}</div>
                  <div className="esp-task-action">
                    {task.blocked ? <><span className="warn">En espera de {task.blocked}.</span> {task.accionable}</> : <>{task.accionable}</>}
                  </div>
                </div>
                <div className={`esp-task-eta ${tone}`}>{task.eta}</div>
                <div className="esp-task-pills">
                  <span className={`ed-pill ${task.priority.toLowerCase()}`}>{task.priority}</span>
                  <span className={`ed-pill ${statusClass}`}>{task.status}</span>
                </div>
              </div>
            );
          })}
          <div style={{paddingTop:14}}>
            <button className="ed-btn">Ver todas mis 7 tareas →</button>
          </div>
        </section>

        {/* PERFORMANCE */}
        <section className="ed-section">
          <div className="ed-h2">— Tu desempeño este mes</div>
          <div className="esp-perf">
            <div className="esp-perf-cell">
              <div className="esp-perf-eye">Racha on-time</div>
              <div className="esp-perf-num" style={{color:t.good}}>07</div>
              <div className="esp-perf-sub">tareas seguidas a tiempo</div>
            </div>
            <div className="esp-perf-cell">
              <div className="esp-perf-eye">Cierre Alta</div>
              <div className="esp-perf-num">1.8<span style={{fontSize:18,color:t.dim}}>d</span></div>
              <div className="esp-perf-sub">SLA 2d · margen 0.2</div>
            </div>
            <div className="esp-perf-cell">
              <div className="esp-perf-eye">Cierre Media</div>
              <div className="esp-perf-num">3.2<span style={{fontSize:18,color:t.dim}}>d</span></div>
              <div className="esp-perf-sub">SLA 5d · margen 1.8</div>
            </div>
            <div className="esp-perf-cell">
              <div className="esp-perf-eye">Cierre Baja</div>
              <div className="esp-perf-num">4.5<span style={{fontSize:18,color:t.dim}}>d</span></div>
              <div className="esp-perf-sub">SLA 7d · margen 2.5</div>
            </div>
          </div>
        </section>

        {/* PROJECTS WHERE I PARTICIPATE */}
        <section className="ed-section">
          <div className="ed-h2">— Proyectos donde participas</div>
          {ED_PROJECTS_MINE.map(p => (
            <div key={p.id} className="esp-proj-row">
              <span className="esp-proj-role">{p.role}</span>
              <div>
                <div className="esp-proj-name">{p.name}</div>
                <div style={{fontSize:11,color:t.dim,marginTop:2}}>Líder: {p.lead} · {p.participants} participantes</div>
              </div>
              <div className="esp-proj-progress">{p.completed}/{p.tasks}</div>
              <div style={{fontSize:11,color:t.dim,textTransform:'uppercase',letterSpacing:1.2,fontWeight:700}}>en {p.deadline}d</div>
            </div>
          ))}
        </section>
      </main>
    </div>
    </div>
  );
}

Object.assign(window, { EdHomeSpecialist });
