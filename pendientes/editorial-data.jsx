// ═══════════════════════════════════════════════════════════════
// EDITORIAL — TRACKER tabla totalmente clickeable + panel lateral
// ═══════════════════════════════════════════════════════════════

function EdTracker({ theme = 'light', role = 'manager', selectedId = null }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = edBaseCSS(t) + `
    .ed-root.with-panel { grid-template-columns:218px 1fr 440px; }
    .tk-toolbar { display:flex; gap:0; align-items:center; margin-bottom:24px; padding:0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; }
    .tk-filter { padding:11px 16px; font-size:11px; color:${t.muted}; text-transform:uppercase; letter-spacing:1.2px; font-weight:700; border-right:1px solid ${t.rule}; cursor:pointer; display:flex; align-items:center; gap:6px; }
    .tk-filter:hover { color:${t.ink}; }
    .tk-filter.active { color:${t.accent}; background:${t.accentSoft}; }
    .tk-filter .count { font-family:'JetBrains Mono',monospace; font-size:11px; }
    .tk-search { flex:1; padding:11px 16px; font-size:12px; color:${t.dim}; }

    .tk-table { width:100%; border-collapse:collapse; font-size:13px; }
    .tk-table th { text-align:left; padding:10px 14px 10px 0; border-bottom:1px solid ${t.rule}; font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:700; white-space:nowrap; }
    .tk-table th:first-child { padding-left:14px; }
    .tk-table td { padding:14px 14px 14px 0; border-bottom:1px solid ${t.rule}; vertical-align:middle; }
    .tk-table td:first-child { padding-left:14px; }
    .tk-row { cursor:pointer; transition:background .12s; }
    .tk-row:hover { background:${t.ruleSoft}; }
    .tk-row.selected { background:${t.accentSoft}; }
    .tk-row.selected td:first-child { box-shadow:inset 3px 0 0 ${t.accent}; }
    .tk-id { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.dim}; font-weight:600; }
    .tk-name { font-size:13.5px; font-weight:600; color:${t.ink}; line-height:1.3; max-width:320px; }
    .tk-name-meta { font-size:10.5px; color:${t.dim}; text-transform:uppercase; letter-spacing:.8px; font-weight:700; margin-top:3px; }
    .tk-av { width:24px; height:24px; border-radius:6px; display:inline-grid; place-items:center; color:#fff; font-weight:800; font-size:9px; vertical-align:middle; margin-right:8px; }
    .tk-resp { font-size:12px; color:${t.ink}; font-weight:600; }
    .tk-eta { font-family:'JetBrains Mono',monospace; font-size:11.5px; font-weight:700; white-space:nowrap; }
    .tk-eta.crit { color:${t.critical}; }
    .tk-eta.warn { color:${t.warn}; }
    .tk-eta.dim { color:${t.muted}; }

    /* DETAIL PANEL */
    .tk-panel { background:${t.paper}; border-left:1px solid ${t.rule}; padding:32px; height:100vh; overflow-y:auto; position:sticky; top:0; }
    .tk-panel-head { display:flex; align-items:center; gap:8px; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid ${t.rule}; }
    .tk-panel-id { font-family:'JetBrains Mono',monospace; font-size:11px; color:${t.dim}; font-weight:700; }
    .tk-panel-x { margin-left:auto; cursor:pointer; color:${t.dim}; font-size:18px; }
    .tk-panel-title { font-family:'Fraunces',Georgia,serif; font-size:24px; line-height:1.2; font-weight:400; letter-spacing:-.5px; margin-bottom:18px; }
    .tk-panel-pills { display:flex; gap:6px; margin-bottom:24px; flex-wrap:wrap; }
    .tk-panel-section { margin-bottom:24px; }
    .tk-panel-eye { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:10px; }
    .tk-panel-grid { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:${t.rule}; border:1px solid ${t.rule}; }
    .tk-panel-cell { background:${t.paper}; padding:12px 14px; }
    .tk-panel-cell-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.3px; font-weight:700; margin-bottom:4px; }
    .tk-panel-cell-val { font-size:13px; color:${t.ink}; font-weight:600; }
    .tk-panel-cell-val.crit { color:${t.critical}; }
    .tk-panel-block { padding:14px; background:${t.paper2}; border-left:3px solid ${t.accent}; font-size:13px; color:${t.ink}; line-height:1.55; }
    .tk-panel-block.crit { border-color:${t.critical}; background:${t.criticalSoft}; color:${t.ink}; }
    .tk-panel-block b { font-weight:700; }
    .tk-timeline { position:relative; padding-left:24px; }
    .tk-timeline::before { content:''; position:absolute; left:6px; top:6px; bottom:6px; width:1px; background:${t.rule}; }
    .tk-tl-item { position:relative; margin-bottom:16px; padding-bottom:16px; }
    .tk-tl-item:last-child { margin-bottom:0; padding-bottom:0; }
    .tk-tl-dot { position:absolute; left:-22px; top:5px; width:9px; height:9px; border-radius:50%; background:${t.muted}; border:2px solid ${t.paper}; }
    .tk-tl-dot.crit { background:${t.critical}; }
    .tk-tl-dot.good { background:${t.good}; }
    .tk-tl-when { font-family:'JetBrains Mono',monospace; font-size:10px; color:${t.dim}; font-weight:700; text-transform:uppercase; letter-spacing:.8px; margin-bottom:3px; }
    .tk-tl-what { font-size:12.5px; color:${t.ink}; line-height:1.45; }
    .tk-tl-what b { font-weight:700; }
    .tk-actions { display:flex; flex-direction:column; gap:8px; padding-top:18px; border-top:1px solid ${t.rule}; }
    .tk-actions .ed-btn { justify-content:center; width:100%; padding:10px 14px; font-size:12px; }
  `;
  const css = edScope(scope, rawCSS);

  // Demo: row T-142 selected by default
  const sel = ED_TRACKER.find(r => r.id === (selectedId || 'T-142'));
  const visibleTasks = role === 'specialist'
    ? ED_TRACKER.filter(r => r.resp === 'jc')
    : ED_TRACKER;

  const respMap = { jc: { name: 'Juan Camilo', avatar: 'JC', color: '#B8551F' }, jm: { name: 'Juan Manuel', avatar: 'JM', color: '#A57F2C' }, mr: { name: 'María R.', avatar: 'MR', color: '#3D6478' }, ab: { name: 'Ana Bravo', avatar: 'AB', color: '#6B4D7A' }, cf: { name: 'Carlos F.', avatar: 'CF', color: '#4A6B8A' } };

  const fmtEta = (d) => {
    if (d < 0) return { text: `vencida ${Math.abs(d)}d`, cls: 'crit' };
    if (d === 0) return { text: 'vence hoy', cls: 'crit' };
    if (d === 1) return { text: 'mañana', cls: 'warn' };
    if (d <= 3) return { text: `en ${d}d`, cls: 'warn' };
    return { text: `en ${d}d`, cls: 'dim' };
  };

  return (
    <div className={scope} style={{minHeight:'100%'}}>
    <div className={`ed-root ${sel ? 'with-panel' : ''}`}>
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"/>
      <EdSidebar t={t} role={role} activeItem="tracker"/>
      <main className="ed-main">
        <EdHeader t={t}/>
        <div className="ed-eye">Tracker {role === 'hq' ? '· Global' : role === 'manager' ? '· Equipo CO' : '· Mis tareas'}</div>
        <h1 className="ed-h1" style={{marginBottom:8}}>Tracker</h1>
        <p className="ed-lede" style={{marginBottom:28}}>
          {role === 'specialist' && <>Tus 7 tareas activas. Cliquea cualquiera para ver detalle, historial y siguiente acción.</>}
          {role === 'manager' && <>11 tareas activas en tu equipo CO. Cliquea cualquier fila para ver detalle, historial y reasignar.</>}
          {role === 'hq' && <>20 tareas activas en LATAM. Filtrá por país o líder para reducir la vista.</>}
        </p>

        <div className="tk-toolbar">
          <div className="tk-filter active">Todas <span className="count">{visibleTasks.length}</span></div>
          <div className="tk-filter">Vencidas <span className="count" style={{color:t.critical}}>{visibleTasks.filter(t=>t.deadline<0).length}</span></div>
          <div className="tk-filter">Hoy <span className="count">{visibleTasks.filter(t=>t.deadline===0).length}</span></div>
          <div className="tk-filter">Bloqueadas <span className="count">{visibleTasks.filter(t=>t.status==='Bloqueado').length}</span></div>
          <div className="tk-search">⌘F filtrar por proyecto, persona, tipo…</div>
        </div>

        <table className="tk-table">
          <thead>
            <tr>
              <th>ID</th><th>Tarea</th><th>{role==='specialist'?'Proyecto':'Responsable'}</th><th>Prioridad</th><th>Estado</th><th>ETA</th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.map(r => {
              const eta = fmtEta(r.deadline);
              const statusClass = r.status === 'En curso' ? 'curso' : r.status === 'En revisión' ? 'revision' : r.status === 'Bloqueado' ? 'bloqueado' : 'pendiente';
              const resp = respMap[r.resp];
              return (
                <tr key={r.id} className={`tk-row ${r.id===sel?.id?'selected':''}`}>
                  <td><span className="tk-id">{r.id}</span></td>
                  <td>
                    <div className="tk-name">{r.name}</div>
                    <div className="tk-name-meta">{r.type} · {r.project || 'Sin proyecto'} · {r.country}</div>
                  </td>
                  <td>
                    {role === 'specialist' ? (
                      <span className="tk-resp">{r.project || '—'}</span>
                    ) : (
                      <><span className="tk-av" style={{background:resp.color}}>{resp.avatar}</span><span className="tk-resp">{resp.name}</span></>
                    )}
                  </td>
                  <td><span className={`ed-pill ${r.priority.toLowerCase()}`}>{r.priority}</span></td>
                  <td><span className={`ed-pill ${statusClass}`}>{r.status}</span></td>
                  <td><span className={`tk-eta ${eta.cls}`}>{eta.text}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>

      {sel && (
        <aside className="tk-panel">
          <div className="tk-panel-head">
            <span className="tk-panel-id">{sel.id}</span>
            <span style={{color:t.dim,fontSize:11}}>·</span>
            <span style={{fontSize:11,color:t.dim,textTransform:'uppercase',letterSpacing:1.2,fontWeight:700}}>{sel.country}</span>
            <span className="tk-panel-x">×</span>
          </div>
          <h2 className="tk-panel-title">{sel.name}</h2>
          <div className="tk-panel-pills">
            <span className={`ed-pill ${sel.priority.toLowerCase()}`}>{sel.priority}</span>
            <span className={`ed-pill ${sel.status === 'Bloqueado' ? 'bloqueado' : 'curso'}`}>{sel.status}</span>
            <span className="ed-pill curso">{sel.type}</span>
          </div>

          <div className="tk-panel-section">
            <div className="tk-panel-eye">— Estado actual</div>
            <div className="tk-panel-block crit">
              <b>Bloqueada hace 4 días.</b> Esperando respuesta de RR.HH. sobre el contrato del demandante.
              JC contactó dos veces (16 abr, 19 abr) sin respuesta.<br/><br/>
              <b>Próxima acción sugerida:</b> escalar a Director de RR.HH. o pedir reasignación al manager.
            </div>
          </div>

          <div className="tk-panel-section">
            <div className="tk-panel-grid">
              <div className="tk-panel-cell"><div className="tk-panel-cell-lbl">Responsable</div><div className="tk-panel-cell-val">Juan Camilo</div></div>
              <div className="tk-panel-cell"><div className="tk-panel-cell-lbl">Creada por</div><div className="tk-panel-cell-val">Carlos Fernández</div></div>
              <div className="tk-panel-cell"><div className="tk-panel-cell-lbl">Deadline</div><div className="tk-panel-cell-val crit">20 abr (vencida 3d)</div></div>
              <div className="tk-panel-cell"><div className="tk-panel-cell-lbl">SLA</div><div className="tk-panel-cell-val">2 días</div></div>
              <div className="tk-panel-cell"><div className="tk-panel-cell-lbl">Riesgo</div><div className="tk-panel-cell-val crit">Legal alto</div></div>
              <div className="tk-panel-cell"><div className="tk-panel-cell-lbl">Proyecto</div><div className="tk-panel-cell-val">Mapping litigio CO</div></div>
            </div>
          </div>

          <div className="tk-panel-section">
            <div className="tk-panel-eye">— Historial</div>
            <div className="tk-timeline">
              <div className="tk-tl-item">
                <div className="tk-tl-dot crit"/>
                <div className="tk-tl-when">Hoy · 09:14</div>
                <div className="tk-tl-what">Sistema marcó <b>vencida</b>. Sin movimiento en 4 días.</div>
              </div>
              <div className="tk-tl-item">
                <div className="tk-tl-dot"/>
                <div className="tk-tl-when">19 abr · 16:30</div>
                <div className="tk-tl-what"><b>Juan Camilo:</b> "Reenvío email a RR.HH., sin respuesta del primer pedido."</div>
              </div>
              <div className="tk-tl-item">
                <div className="tk-tl-dot"/>
                <div className="tk-tl-when">16 abr · 11:02</div>
                <div className="tk-tl-what">Estado cambió a <b>Bloqueado</b> · razón: dependencia externa RR.HH.</div>
              </div>
              <div className="tk-tl-item">
                <div className="tk-tl-dot good"/>
                <div className="tk-tl-when">15 abr · 09:00</div>
                <div className="tk-tl-what">Tarea creada por <b>Carlos Fernández</b> · asignada a Juan Camilo.</div>
              </div>
            </div>
          </div>

          <div className="tk-actions">
            <button className="ed-btn primary">Escalar a Director RR.HH.</button>
            <button className="ed-btn">Reasignar tarea</button>
            <button className="ed-btn">Comentar</button>
          </div>
        </aside>
      )}
    </div>
    </div>
  );
}

Object.assign(window, { EdTracker });
