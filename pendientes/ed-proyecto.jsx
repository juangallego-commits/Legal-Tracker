// ═══════════════════════════════════════════════════════════════
// EDITORIAL — DETALLE DE PROYECTO
// La vista que se abre cuando hacés click en "Legal Tracker" desde
// "Proyectos donde participas". Mismo lenguaje editorial, foco en
// el proyecto como contenedor de tareas + personas + decisiones.
// ═══════════════════════════════════════════════════════════════

function EdProyecto({ theme = 'light' }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .pr-meta { display:grid; grid-template-columns:repeat(4,1fr); padding:24px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:36px; }
    .pr-meta-cell { padding:0 22px; border-right:1px solid ${t.rule}; }
    .pr-meta-cell:first-child { padding-left:0; } .pr-meta-cell:last-child { border-right:none; }
    .pr-meta-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:800; margin-bottom:8px; }
    .pr-meta-num { font-family:'Fraunces',Georgia,serif; font-size:42px; font-weight:300; line-height:1; letter-spacing:-1.4px; font-variant-numeric:tabular-nums; }
    .pr-meta-num.warn { color:${t.warn}; } .pr-meta-num.good { color:${t.good}; }
    .pr-meta-num em { font-style:normal; font-size:18px; color:${t.dim}; font-weight:300; margin-left:2px; }
    .pr-meta-ctx { font-size:12px; color:${t.muted}; margin-top:6px; line-height:1.4; }

    .pr-progress { padding:24px 0; border-bottom:1px solid ${t.rule}; margin-bottom:36px; }
    .pr-prog-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:14px; }
    .pr-prog-title { font-size:14px; font-weight:700; color:${t.ink}; }
    .pr-prog-pct { font-family:'Fraunces',Georgia,serif; font-size:32px; font-weight:300; letter-spacing:-1px; font-variant-numeric:tabular-nums; }
    .pr-prog-pct em { font-style:normal; font-size:14px; color:${t.dim}; font-weight:400; }
    .pr-bar { height:6px; background:${t.paper3}; border-radius:3px; overflow:hidden; display:flex; }
    .pr-bar-seg.done { background:${t.good}; }
    .pr-bar-seg.curso { background:${t.info}; }
    .pr-bar-seg.warn { background:${t.warn}; }
    .pr-bar-seg.crit { background:${t.critical}; }
    .pr-bar-legend { display:flex; gap:24px; margin-top:14px; font-size:12px; color:${t.muted}; }
    .pr-bar-legend span { display:flex; align-items:center; gap:8px; }
    .pr-bar-legend .dot { width:8px; height:8px; border-radius:2px; }

    /* Layout 2 columnas: tareas (1.4) + side rail (1) */
    .pr-grid { display:grid; grid-template-columns:1.5fr 1fr; gap:48px; }

    /* Tareas del proyecto */
    .pr-task-row { display:grid; grid-template-columns:auto 1fr auto auto; gap:14px; align-items:center; padding:14px 0; border-bottom:1px solid ${t.rule}; cursor:pointer; transition:background .12s; }
    .pr-task-row:hover { background:${t.ruleSoft}; margin:0 -10px; padding:14px 10px; }
    .pr-task-rank { font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:300; font-size:18px; color:${t.dim}; line-height:1; font-variant-numeric:tabular-nums; min-width:24px; }
    .pr-task-rank.crit { color:${t.critical}; }
    .pr-task-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color:${t.dim}; letter-spacing:.5px; margin-bottom:3px; }
    .pr-task-name { font-size:13.5px; font-weight:600; color:${t.ink}; line-height:1.3; margin-bottom:3px; }
    .pr-task-resp { font-size:11.5px; color:${t.muted}; }
    .pr-task-resp b { color:${t.ink}; font-weight:700; }
    .pr-task-eta { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.1px; font-weight:700; white-space:nowrap; text-align:right; }
    .pr-task-eta.crit { color:${t.critical}; } .pr-task-eta.warn { color:${t.warn}; }
    .pr-task-pill { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:1px 8px; border-radius:3px; }

    /* Side rail */
    .pr-rail-section { margin-bottom:36px; }
    .pr-rail-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:800; margin-bottom:14px; padding-bottom:8px; border-bottom:1px solid ${t.rule}; }

    .pr-people-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid ${t.rule}; }
    .pr-av { width:32px; height:32px; border-radius:8px; display:grid; place-items:center; color:#fff; font-weight:800; font-size:11px; flex:0 0 32px; }
    .pr-pn-name { font-size:13px; font-weight:700; color:${t.ink}; }
    .pr-pn-role { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-top:1px; }
    .pr-pn-tag { margin-left:auto; font-size:9.5px; color:${t.accent}; text-transform:uppercase; letter-spacing:1.2px; font-weight:800; padding:2px 7px; border:1px solid ${t.accent}; border-radius:3px; }
    .pr-pn-tag.muted { color:${t.dim}; border-color:${t.rule}; }

    .pr-mile-row { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:start; padding:12px 0; border-bottom:1px solid ${t.rule}; }
    .pr-mile-marker { width:10px; height:10px; border-radius:50%; margin-top:4px; flex:0 0 10px; }
    .pr-mile-marker.done { background:${t.good}; }
    .pr-mile-marker.now { background:${t.accent}; box-shadow:0 0 0 4px ${t.accentSoft}; }
    .pr-mile-marker.next { background:${t.paper3}; border:1px solid ${t.rule}; }
    .pr-mile-name { font-size:13px; font-weight:600; color:${t.ink}; line-height:1.3; }
    .pr-mile-name.muted { color:${t.dim}; font-weight:500; }
    .pr-mile-sub { font-size:11.5px; color:${t.muted}; margin-top:3px; line-height:1.4; }
    .pr-mile-when { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.1px; font-weight:700; white-space:nowrap; padding-top:2px; }

    .pr-act-row { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid ${t.rule}; }
    .pr-act-dot { width:6px; height:6px; border-radius:50%; background:${t.muted}; margin-top:7px; flex:0 0 6px; }
    .pr-act-text { font-size:12.5px; color:${t.ink}; line-height:1.45; }
    .pr-act-text b { font-weight:700; }
    .pr-act-when { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.1px; font-weight:700; margin-top:3px; }
  `;
  const css = edScope(scope, rawCSS);

  // Tareas del proyecto Legal Tracker
  const projectTasks = [
    { id: 'T-138', name: 'Revisar contrato proveedor delivery', resp: 'Juan Camilo', priority: 'Alta', status: 'En curso', deadline: -1, eta: 'venció ayer', tone: 'crit' },
    { id: 'T-115', name: 'Demanda consumidor — Medellín', resp: 'Ana Bravo', priority: 'Alta', status: 'En curso', deadline: 1, eta: 'mañana', tone: 'warn' },
    { id: 'T-161', name: 'Opinión regulatoria — método de pago', resp: 'Juan Camilo', priority: 'Media', status: 'En curso', deadline: 1, eta: 'mañana', tone: 'warn' },
    { id: 'T-118', name: 'Contrato framework RappiPay', resp: 'Carlos Fernández', priority: 'Media', status: 'En revisión', deadline: 3, eta: 'en 3 días', tone: '' },
    { id: 'T-189', name: 'Revisión privacidad onboarding repartidores', resp: 'María Restrepo', priority: 'Media', status: 'Pendiente', deadline: 6, eta: 'en 6 días', tone: '' },
    { id: 'T-201', name: 'Términos partnership Yango Colombia', resp: 'Carlos Fernández', priority: 'Baja', status: 'Pendiente', deadline: 9, eta: 'en 9 días', tone: '' },
    { id: 'T-088', name: 'NDA con incubadora Rappi Ventures', resp: 'Carlos Fernández', priority: 'Baja', status: 'Cerrada', deadline: 0, eta: 'cerrada', tone: 'done' },
  ];

  const people = [
    { id:'cf', name:'Carlos Fernández', role:'Country Lead CO', avatar:'CF', color:'#4A6B8A', tag:'Líder', muted:false },
    { id:'jc', name:'Juan Camilo', role:'Legal Ops', avatar:'JC', color:'#B8551F', tag:'2 tareas', muted:false },
    { id:'ab', name:'Ana Bravo', role:'HQ Legal', avatar:'AB', color:'#6B4D7A', tag:'1 tarea', muted:false },
    { id:'mr', name:'María Restrepo', role:'Privacy', avatar:'MR', color:'#3D6478', tag:'1 tarea', muted:true },
  ];

  const milestones = [
    { state:'done', name:'Kick-off del proyecto', sub:'Alineación inicial y mapeo de stakeholders.', when:'12 mar' },
    { state:'done', name:'Mapeo de contratos vigentes', sub:'42 contratos catalogados y priorizados por riesgo.', when:'02 abr' },
    { state:'now', name:'Renegociación de contratos críticos', sub:'8 contratos en revisión, 3 ya cerrados.', when:'Esta sem' },
    { state:'next', name:'Implementación template v4', sub:'Roll-out a 3 países piloto.', when:'Sem 18' },
    { state:'next', name:'Cierre y handoff a operación', sub:'Entrega final con métricas y aprendizajes.', when:'07 may' },
  ];

  const activity = [
    { text: <><b>Juan Camilo</b> agregó un comentario en T-138 — "cláusula 7.2 lista para firma".</>, when:'hace 2h' },
    { text: <><b>Carlos Fernández</b> reasignó T-189 a María Restrepo.</>, when:'hace 4h' },
    { text: <><b>Ana Bravo</b> cerró T-094 — "Revisión NDA partner logística".</>, when:'hace 1d' },
    { text: <><b>Sistema</b> generó el reporte semanal del proyecto.</>, when:'hace 2d' },
    { text: <><b>Carlos Fernández</b> creó la tarea T-201 — "Términos Yango Colombia".</>, when:'hace 3d' },
  ];

  // Progress: 7 tareas total, 1 cerrada, 4 en curso/revisión, 1 atrasada, 1 pendiente
  const total = projectTasks.length;
  const done = projectTasks.filter(t => t.status==='Cerrada').length;
  const curso = projectTasks.filter(t => t.status==='En curso' || t.status==='En revisión').length;
  const overdue = projectTasks.filter(t => t.deadline < 0 && t.status !== 'Cerrada').length;
  const pending = projectTasks.filter(t => t.status==='Pendiente').length;

  const pct = (n) => `${(n/total*100).toFixed(1)}%`;
  const pctNum = Math.round(((done) / total) * 100);

  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className="ed-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role="specialist" activeItem="proyectos"/>
      <main className="ed-main">
        <EdHeader t={t}/>

        <div className="ed-eye">Proyecto · Legal Ops · CO</div>
        <h1 className="ed-h1">Legal Tracker — <em>renovación</em><br/>de contratos críticos.</h1>
        <p className="ed-lede">
          Liderado por <b>Carlos Fernández</b>, este proyecto busca renegociar y modernizar los 42 contratos
          activos del marketplace. Llevamos <b>3 cerrados</b>, <b>4 en curso</b>, y vence en <b>14 días</b>.
          Te toca acompañar las dos tareas de tu nombre.
        </p>

        {/* META */}
        <div className="pr-meta">
          <div className="pr-meta-cell">
            <div className="pr-meta-lbl">Tareas activas</div>
            <div className="pr-meta-num">06</div>
            <div className="pr-meta-ctx">de 7 totales · 1 ya cerrada</div>
          </div>
          <div className="pr-meta-cell">
            <div className="pr-meta-lbl">Atrasadas</div>
            <div className="pr-meta-num warn">01</div>
            <div className="pr-meta-ctx">T-138 · 1 día de retraso</div>
          </div>
          <div className="pr-meta-cell">
            <div className="pr-meta-lbl">Equipo</div>
            <div className="pr-meta-num">04</div>
            <div className="pr-meta-ctx">1 líder · 3 contribuyentes</div>
          </div>
          <div className="pr-meta-cell">
            <div className="pr-meta-lbl">Vence en</div>
            <div className="pr-meta-num">14<em>d</em></div>
            <div className="pr-meta-ctx">07 may · 2 semanas</div>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="pr-progress">
          <div className="pr-prog-head">
            <div className="pr-prog-title">Avance global</div>
            <div className="pr-prog-pct">{pctNum}<em>%</em></div>
          </div>
          <div className="pr-bar">
            <div className="pr-bar-seg done" style={{width: pct(done)}}/>
            <div className="pr-bar-seg curso" style={{width: pct(curso)}}/>
            <div className="pr-bar-seg crit" style={{width: pct(overdue)}}/>
            <div className="pr-bar-seg" style={{width: pct(pending - overdue), background: t.paper3}}/>
          </div>
          <div className="pr-bar-legend">
            <span><span className="dot" style={{background:t.good}}/>{done} cerradas</span>
            <span><span className="dot" style={{background:t.info}}/>{curso} en curso</span>
            <span><span className="dot" style={{background:t.critical}}/>{overdue} atrasada</span>
            <span><span className="dot" style={{background:t.paper3,border:`1px solid ${t.rule}`}}/>{pending - overdue} pendientes</span>
          </div>
        </div>

        {/* GRID */}
        <div className="pr-grid">

          {/* TASKS */}
          <section className="ed-section" style={{marginBottom:0}}>
            <div className="ed-h2">— Tareas del proyecto</div>
            {projectTasks.map((task, i) => {
              const statusClass = task.status === 'En curso' ? 'curso' : task.status === 'En revisión' ? 'revision' : task.status === 'Bloqueado' ? 'bloqueado' : task.status === 'Cerrada' ? 'cerrada' : 'pendiente';
              const opacity = task.status === 'Cerrada' ? 0.55 : 1;
              return (
                <div key={task.id} className="pr-task-row" style={{opacity}}>
                  <div className={`pr-task-rank ${task.tone}`}>{String(i+1).padStart(2,'0')}</div>
                  <div>
                    <div className="pr-task-meta">{task.id} · SLA · {task.priority}</div>
                    <div className="pr-task-name">{task.name}</div>
                    <div className="pr-task-resp">Responsable: <b>{task.resp}</b></div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                    <span className={`ed-pill ${task.priority.toLowerCase()}`}>{task.priority}</span>
                    <span className={`ed-pill ${statusClass}`}>{task.status}</span>
                  </div>
                  <div className={`pr-task-eta ${task.tone === 'done' ? '' : task.tone}`}>{task.eta}</div>
                </div>
              );
            })}
            <div style={{paddingTop:16}}>
              <button className="ed-btn">Abrir en tracker →</button>
            </div>
          </section>

          {/* SIDE RAIL */}
          <aside>

            <div className="pr-rail-section">
              <div className="pr-rail-eye">— Equipo</div>
              {people.map(p => (
                <div key={p.id} className="pr-people-row">
                  <div className="pr-av" style={{background:p.color}}>{p.avatar}</div>
                  <div>
                    <div className="pr-pn-name">{p.name}</div>
                    <div className="pr-pn-role">{p.role}</div>
                  </div>
                  <span className={`pr-pn-tag ${p.muted?'muted':''}`}>{p.tag}</span>
                </div>
              ))}
            </div>

            <div className="pr-rail-section">
              <div className="pr-rail-eye">— Hitos</div>
              {milestones.map((m, i) => (
                <div key={i} className="pr-mile-row">
                  <div className={`pr-mile-marker ${m.state}`}/>
                  <div>
                    <div className={`pr-mile-name ${m.state==='next'?'muted':''}`}>{m.name}</div>
                    <div className="pr-mile-sub">{m.sub}</div>
                  </div>
                  <div className="pr-mile-when">{m.when}</div>
                </div>
              ))}
            </div>

            <div className="pr-rail-section">
              <div className="pr-rail-eye">— Actividad reciente</div>
              {activity.map((a, i) => (
                <div key={i} className="pr-act-row">
                  <div className="pr-act-dot"/>
                  <div style={{flex:1}}>
                    <div className="pr-act-text">{a.text}</div>
                    <div className="pr-act-when">{a.when}</div>
                  </div>
                </div>
              ))}
            </div>

          </aside>

        </div>

      </main>
    </div>
    </div>
  );
}

Object.assign(window, { EdProyecto });
