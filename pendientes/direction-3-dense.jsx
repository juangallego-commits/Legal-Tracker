// ═══════════════════════════════════════════════════════════════
// DIRECTION 3 — DATA-DENSE PRO
// Linear/Height style: compacto, legible, keyboard-first feel.
// Más información por pixel, pero con jerarquía impecable.
// ═══════════════════════════════════════════════════════════════

function D3Shell({ theme = 'dark' }) {
  const dark = theme === 'dark';
  const t = dark ? {
    bg: '#0A0A0C', panel: '#111114', panel2: '#17171B', panel3: '#1E1E24',
    ink: '#E8E8EC', muted: '#8C8D98', dim: '#56575F',
    rule: 'rgba(255,255,255,.05)', ruleLight: 'rgba(255,255,255,.08)',
  } : {
    bg: '#FFFFFF', panel: '#FAFBFC', panel2: '#F1F3F5', panel3: '#E7E9ED',
    ink: '#0D0E10', muted: '#5E6370', dim: '#9199A6',
    rule: 'rgba(10,10,20,.07)', ruleLight: 'rgba(10,10,20,.12)',
  };
  const indigo = '#7B8CFF';      // primary accent — calm, not Rappi-red
  const red = '#F06060';
  const amber = '#E8B339';
  const green = '#5CC896';
  const violet = '#A78BFA';

  const css = `
    .d3-root { font-family: 'Inter', 'Nunito Sans', system-ui, sans-serif; background: ${t.bg}; color: ${t.ink}; min-height: 100%; display: grid; grid-template-columns: 200px 1fr; font-size: 13px; line-height: 1.4; letter-spacing: -.01em; font-feature-settings: 'cv11','ss01','ss03'; }
    .d3-side { border-right: 1px solid ${t.rule}; padding: 12px 8px; position: sticky; top: 0; height: 100vh; max-height: 1200px; display: flex; flex-direction: column; }
    .d3-work { display: flex; align-items: center; gap: 8px; padding: 6px 8px 10px; border-bottom: 1px solid ${t.rule}; margin-bottom: 8px; cursor: pointer; }
    .d3-work-ic { width: 22px; height: 22px; border-radius: 5px; background: linear-gradient(135deg, ${indigo}, ${violet}); display: grid; place-items: center; color: #fff; font-size: 11px; font-weight: 800; }
    .d3-work-name { font-size: 13px; font-weight: 700; letter-spacing: -.2px; }
    .d3-work-sub { font-size: 10px; color: ${t.dim}; }
    .d3-search { display: flex; align-items: center; gap: 8px; padding: 5px 8px; margin-bottom: 14px; border-radius: 5px; background: ${t.panel}; border: 1px solid ${t.rule}; color: ${t.dim}; font-size: 12px; cursor: pointer; }
    .d3-search kbd { margin-left: auto; font-size: 10px; padding: 0 4px; border-radius: 3px; background: ${t.panel3}; font-family: 'JetBrains Mono', monospace; color: ${t.muted}; }
    .d3-nav-section { margin-bottom: 10px; }
    .d3-nav-label { font-size: 10px; color: ${t.dim}; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; padding: 4px 8px 4px; }
    .d3-nav-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 5px; font-size: 12.5px; color: ${t.muted}; cursor: pointer; font-weight: 500; }
    .d3-nav-item:hover { background: ${t.panel}; color: ${t.ink}; }
    .d3-nav-item.active { background: ${t.panel2}; color: ${t.ink}; font-weight: 600; }
    .d3-nav-item svg { flex-shrink: 0; color: ${t.dim}; }
    .d3-nav-item.active svg { color: ${indigo}; }
    .d3-nav-badge { margin-left: auto; font-size: 10px; color: ${t.dim}; font-family: 'JetBrains Mono', monospace; font-weight: 600; }
    .d3-nav-item.active .d3-nav-badge { color: ${t.muted}; }
    .d3-side-foot { margin-top: auto; padding-top: 10px; border-top: 1px solid ${t.rule}; display: flex; align-items: center; gap: 8px; padding: 10px 8px 4px; }
    .d3-side-foot-name { font-size: 12px; font-weight: 600; }
    .d3-side-foot-sub { font-size: 10px; color: ${t.dim}; }

    .d3-main { min-width: 0; display: flex; flex-direction: column; }
    .d3-topbar { display: flex; align-items: center; gap: 0; padding: 0 18px; height: 40px; border-bottom: 1px solid ${t.rule}; font-size: 12px; }
    .d3-crumb { color: ${t.muted}; }
    .d3-crumb b { color: ${t.ink}; font-weight: 700; }
    .d3-crumb-sep { padding: 0 8px; color: ${t.dim}; }
    .d3-topbar-right { margin-left: auto; display: flex; align-items: center; gap: 4px; }
    .d3-icon-btn { width: 26px; height: 26px; border-radius: 5px; display: grid; place-items: center; background: transparent; border: none; color: ${t.muted}; cursor: pointer; }
    .d3-icon-btn:hover { background: ${t.panel}; color: ${t.ink}; }
    .d3-btn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 5px; border: 1px solid ${t.rule}; background: ${t.panel}; color: ${t.ink}; cursor: pointer; font-family: inherit; }
    .d3-btn.primary { background: ${indigo}; color: #fff; border-color: ${indigo}; }

    .d3-page { padding: 20px 20px 40px; max-width: 1320px; }
    .d3-page-head { margin-bottom: 18px; display: flex; align-items: flex-end; justify-content: space-between; }
    .d3-page-title { font-size: 18px; font-weight: 700; letter-spacing: -.3px; margin-bottom: 2px; }
    .d3-page-sub { font-size: 12px; color: ${t.muted}; }
    .d3-page-sub .crit { color: ${red}; font-weight: 600; }

    /* ── stat row ── */
    .d3-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px; background: ${t.rule}; border: 1px solid ${t.rule}; border-radius: 6px; overflow: hidden; margin-bottom: 18px; }
    .d3-stat { background: ${t.panel}; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px; }
    .d3-stat-lbl { font-size: 10px; color: ${t.dim}; text-transform: uppercase; letter-spacing: .6px; font-weight: 600; }
    .d3-stat-val { display: flex; align-items: baseline; gap: 6px; }
    .d3-stat-num { font-size: 18px; font-weight: 700; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
    .d3-stat-delta { font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .d3-stat-delta.up { color: ${green}; }
    .d3-stat-delta.down { color: ${red}; }
    .d3-stat-delta.flat { color: ${t.dim}; }

    /* ── grid ── */
    .d3-grid { display: grid; grid-template-columns: 1.45fr 1fr; gap: 14px; margin-bottom: 18px; }

    /* ── attention table ── */
    .d3-panel { background: ${t.panel}; border: 1px solid ${t.rule}; border-radius: 6px; overflow: hidden; }
    .d3-panel-head { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid ${t.rule}; gap: 10px; }
    .d3-panel-title { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
    .d3-panel-title svg { color: ${indigo}; }
    .d3-panel-tag { font-size: 10px; color: ${t.dim}; background: ${t.panel2}; padding: 1px 6px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; }
    .d3-panel-actions { margin-left: auto; display: flex; gap: 2px; }

    .d3-attn-row { display: grid; grid-template-columns: 24px 48px 1fr 120px 100px 80px; gap: 10px; align-items: center; padding: 6px 12px; border-top: 1px solid ${t.rule}; cursor: pointer; transition: background .1s; font-size: 12.5px; }
    .d3-attn-row:hover { background: ${t.panel2}; }
    .d3-attn-rank { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${t.dim}; font-weight: 600; }
    .d3-attn-rank.crit { color: ${red}; }
    .d3-attn-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: ${t.dim}; }
    .d3-attn-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d3-attn-why { font-size: 11px; color: ${t.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d3-attn-why .crit { color: ${red}; font-weight: 600; }
    .d3-attn-why .warn { color: ${amber}; font-weight: 600; }
    .d3-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 7px; border-radius: 3px; font-size: 10.5px; font-weight: 600; }
    .d3-pill.alta { background: ${dark?'rgba(240,96,96,.12)':'rgba(240,96,96,.15)'}; color: ${red}; }
    .d3-pill.media { background: ${dark?'rgba(232,179,57,.12)':'rgba(232,179,57,.18)'}; color: ${amber}; }
    .d3-pill.baja { background: ${dark?'rgba(92,200,150,.12)':'rgba(92,200,150,.18)'}; color: ${green}; }
    .d3-pill.curso { background: ${dark?'rgba(123,140,255,.12)':'rgba(123,140,255,.15)'}; color: ${indigo}; }
    .d3-pill.revision { background: ${dark?'rgba(167,139,250,.12)':'rgba(167,139,250,.15)'}; color: ${violet}; }
    .d3-pill.bloqueado { background: ${dark?'rgba(240,96,96,.12)':'rgba(240,96,96,.15)'}; color: ${red}; }
    .d3-pill.pendiente { background: ${t.panel3}; color: ${t.muted}; }
    .d3-dl { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .d3-dl.over { color: ${red}; }
    .d3-dl.warn { color: ${amber}; }
    .d3-dl.ok { color: ${t.muted}; }

    /* ── bottleneck panel ── */
    .d3-btl-row { display: grid; grid-template-columns: 24px 1fr 60px 72px; gap: 10px; align-items: center; padding: 8px 12px; border-top: 1px solid ${t.rule}; font-size: 12.5px; }
    .d3-btl-row:hover { background: ${t.panel2}; }
    .d3-btl-name { font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .d3-btl-verdict { font-size: 10.5px; font-weight: 600; }
    .d3-btl-verdict.high { color: ${red}; }
    .d3-btl-verdict.medium { color: ${amber}; }
    .d3-btl-verdict.low { color: ${green}; }
    .d3-btl-detail { font-size: 11px; color: ${t.muted}; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d3-btl-load-bar { height: 4px; background: ${t.panel3}; border-radius: 2px; position: relative; overflow: hidden; }
    .d3-btl-load-bar span { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; }
    .d3-btl-load-txt { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }

    /* ── risk ── */
    .d3-risk-row { display: grid; grid-template-columns: 2px 1fr auto auto; gap: 10px; align-items: center; padding: 8px 12px; border-top: 1px solid ${t.rule}; font-size: 12.5px; cursor: pointer; }
    .d3-risk-row:hover { background: ${t.panel2}; }
    .d3-risk-bar { width: 2px; height: 24px; border-radius: 2px; }
    .d3-risk-bar.high { background: ${red}; }
    .d3-risk-bar.medium { background: ${amber}; }
    .d3-risk-bar.low { background: ${green}; }
    .d3-risk-name { font-weight: 600; }
    .d3-risk-why { font-size: 11px; color: ${t.muted}; margin-top: 1px; }
    .d3-risk-why .crit { color: ${red}; }
    .d3-risk-why .warn { color: ${amber}; }
    .d3-risk-pct { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }

    /* ── country table ── */
    .d3-ctable { width: 100%; border-collapse: collapse; font-size: 12px; }
    .d3-ctable th { text-align: left; padding: 7px 12px; font-size: 10px; font-weight: 700; color: ${t.dim}; text-transform: uppercase; letter-spacing: .5px; border-top: 1px solid ${t.rule}; background: ${t.panel2}; }
    .d3-ctable td { padding: 6px 12px; border-top: 1px solid ${t.rule}; font-variant-numeric: tabular-nums; }
    .d3-ctable tr:hover td { background: ${t.panel2}; }
    .d3-ctable .num { text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; }
    .d3-ctable .crit { color: ${red}; }
    .d3-ctable .good { color: ${green}; }
    .d3-ctable .muted { color: ${t.dim}; }
    .d3-ctable .country { display: flex; align-items: center; gap: 8px; }
    .d3-country-flag { width: 18px; height: 12px; border-radius: 2px; background: ${t.panel3}; font-size: 9px; font-weight: 800; color: ${t.ink}; display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; }
    .d3-health-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .d3-health-dot.critical { background: ${red}; box-shadow: 0 0 0 2px ${dark?'rgba(240,96,96,.12)':'rgba(240,96,96,.15)'}; }
    .d3-health-dot.risk { background: ${amber}; box-shadow: 0 0 0 2px ${dark?'rgba(232,179,57,.12)':'rgba(232,179,57,.18)'}; }
    .d3-health-dot.good { background: ${green}; }
    .d3-health-dot.idle { background: ${t.panel3}; }
  `;

  return (
    <div className="d3-root">
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"/>
      <aside className="d3-side">
        <div className="d3-work">
          <div className="d3-work-ic">LT</div>
          <div>
            <div className="d3-work-name">Legal Tracker</div>
            <div className="d3-work-sub">Rappi · W17</div>
          </div>
        </div>
        <div className="d3-search">
          <Icon name="search" size={12}/>
          <span>Buscar...</span>
          <kbd>⌘K</kbd>
        </div>
        {NAV.map((sec, i) => (
          <div key={i} className="d3-nav-section">
            <div className="d3-nav-label">{sec.section}</div>
            {sec.items.map(it => (
              <div key={it.id} className={`d3-nav-item ${it.id === 'home' ? 'active' : ''}`}>
                <Icon name={it.icon} size={13} stroke={1.8}/>
                <span>{it.label}</span>
                {it.badge != null && <span className="d3-nav-badge">{it.badge}</span>}
              </div>
            ))}
          </div>
        ))}
        <div className="d3-side-foot">
          <Avatar person={PEOPLE[0]} size={24}/>
          <div>
            <div className="d3-side-foot-name">Juan Camilo</div>
            <div className="d3-side-foot-sub">Legal Ops · CO</div>
          </div>
        </div>
      </aside>

      <div className="d3-main">
        <div className="d3-topbar">
          <span className="d3-crumb">Legal Tracker</span>
          <span className="d3-crumb-sep">/</span>
          <span className="d3-crumb"><b>Home</b></span>
          <span className="d3-crumb-sep">·</span>
          <span className="d3-crumb" style={{color:t.dim}}>Jue 23 abr · 10:15</span>
          <div className="d3-topbar-right">
            <button className="d3-icon-btn" title="Filtros"><Icon name="filter" size={13}/></button>
            <button className="d3-icon-btn" title="Notifs"><Icon name="bell" size={13}/></button>
            <button className="d3-btn primary"><Icon name="plus" size={11}/> Crear <kbd style={{fontSize:9,opacity:.7,marginLeft:4,fontFamily:'JetBrains Mono'}}>C</kbd></button>
          </div>
        </div>

        <div className="d3-page">
          <div className="d3-page-head">
            <div>
              <div className="d3-page-title">Buenos días, Juan Camilo</div>
              <div className="d3-page-sub">4 focos hoy · <span className="crit">13 vencidas globales</span> · Colombia concentra 93% del atraso</div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="d3-btn">Vista: Home</button>
              <button className="d3-btn">Rango: 30d</button>
            </div>
          </div>

          {/* STATS */}
          <div className="d3-stats">
            <div className="d3-stat">
              <div className="d3-stat-lbl">Activas</div>
              <div className="d3-stat-val"><div className="d3-stat-num">20</div><div className="d3-stat-delta up">+3</div></div>
            </div>
            <div className="d3-stat">
              <div className="d3-stat-lbl">Vencidas</div>
              <div className="d3-stat-val"><div className="d3-stat-num" style={{color:red}}>13</div><div className="d3-stat-delta down">+5</div></div>
            </div>
            <div className="d3-stat">
              <div className="d3-stat-lbl">En riesgo</div>
              <div className="d3-stat-val"><div className="d3-stat-num" style={{color:amber}}>4</div><div className="d3-stat-delta flat">=</div></div>
            </div>
            <div className="d3-stat">
              <div className="d3-stat-lbl">On-time 30d</div>
              <div className="d3-stat-val"><div className="d3-stat-num" style={{color:amber}}>50%</div><div className="d3-stat-delta down">-12pp</div></div>
            </div>
            <div className="d3-stat">
              <div className="d3-stat-lbl">Cerradas (sem)</div>
              <div className="d3-stat-val"><div className="d3-stat-num" style={{color:green}}>1</div><div className="d3-stat-delta down">-7</div></div>
            </div>
            <div className="d3-stat">
              <div className="d3-stat-lbl">Throughput</div>
              <div className="d3-stat-val"><Sparkline data={TREND_8W} width={90} height={24} color={indigo}/></div>
            </div>
          </div>

          {/* GRID */}
          <div className="d3-grid">
            <div className="d3-panel">
              <div className="d3-panel-head">
                <div className="d3-panel-title"><Icon name="target" size={13}/> Lo que pide tu atención</div>
                <span className="d3-panel-tag">ranked · 4</span>
                <div className="d3-panel-actions">
                  <button className="d3-icon-btn"><Icon name="dot3" size={13}/></button>
                </div>
              </div>
              {MY_PRIORITIZED.map((p, i) => {
                const dl = fmtDeadline(p.task.deadline);
                const statusClass = p.task.status.toLowerCase().replace(' ','').replace('ó','o').replace('í','i');
                return (
                  <div key={p.task.id} className="d3-attn-row">
                    <div className={`d3-attn-rank ${p.urgency === 'critical' ? 'crit' : ''}`}>{i+1}</div>
                    <div className="d3-attn-id">{p.task.id}</div>
                    <div style={{minWidth:0}}>
                      <div className="d3-attn-name">{p.task.name}</div>
                      <div className="d3-attn-why">
                        {p.urgency === 'critical' ? <span className="crit">● </span> : <span className="warn">● </span>}
                        {p.reason}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      <span className={`d3-pill ${p.task.priority.toLowerCase()}`}>{p.task.priority}</span>
                      <span className={`d3-pill ${statusClass === 'encurso' ? 'curso' : statusClass === 'enrevision' ? 'revision' : statusClass}`}>{p.task.status}</span>
                    </div>
                    <div className={`d3-dl ${dl.tone}`}>{dl.text}</div>
                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                      <Avatar person={p.task.responsible === 'jc' ? PEOPLE[0] : PEOPLE[1]} size={22}/>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="d3-panel">
              <div className="d3-panel-head">
                <div className="d3-panel-title"><Icon name="flame" size={13} style={{color:amber}}/> Carga del equipo</div>
                <span className="d3-panel-tag">3 personas</span>
              </div>
              {BOTTLENECKS.map((b, i) => {
                const color = b.severity === 'high' ? red : b.severity === 'medium' ? amber : green;
                return (
                  <div key={i} className="d3-btl-row">
                    <Avatar person={b.person} size={22}/>
                    <div style={{minWidth:0}}>
                      <div className="d3-btl-name">{b.person.name.split(' ').slice(0,2).join(' ')} <span className={`d3-btl-verdict ${b.severity}`}>· {b.verdict}</span></div>
                      <div className="d3-btl-detail">{b.detail}</div>
                    </div>
                    <div className="d3-btl-load-bar"><span style={{width:`${Math.min(100,b.load/b.capacity*100)}%`, background: color}}/></div>
                    <div className="d3-btl-load-txt" style={{color}}>{b.load}<span style={{color:t.dim}}>/{b.capacity}</span></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RISK + COUNTRIES */}
          <div className="d3-grid" style={{gridTemplateColumns:'1fr 1.45fr'}}>
            <div className="d3-panel">
              <div className="d3-panel-head">
                <div className="d3-panel-title"><Icon name="alert" size={13} style={{color:red}}/> Proyectos en riesgo</div>
                <span className="d3-panel-tag">{PROJECTS.length}</span>
              </div>
              {PROJECTS.map(p => (
                <div key={p.id} className="d3-risk-row">
                  <div className={`d3-risk-bar ${p.risk}`}/>
                  <div style={{minWidth:0}}>
                    <div className="d3-risk-name">{p.name}</div>
                    <div className="d3-risk-why">
                      {p.risk === 'high' && <span className="crit">{p.riskReason}</span>}
                      {p.risk === 'medium' && <span className="warn">{p.riskReason}</span>}
                      {p.risk === 'low' && <span>{p.riskReason}</span>}
                      <span style={{color:t.dim}}> · {p.country}</span>
                    </div>
                  </div>
                  <div className="d3-risk-pct">{Math.round(p.completed/p.tasks*100)}%</div>
                  <div style={{fontSize:11,color:t.dim,fontFamily:'JetBrains Mono'}}>{p.completed}/{p.tasks}</div>
                </div>
              ))}
            </div>

            <div className="d3-panel">
              <div className="d3-panel-head">
                <div className="d3-panel-title"><Icon name="chart" size={13}/> Países con actividad</div>
                <span className="d3-panel-tag">3 activos · 7 idle</span>
              </div>
              <table className="d3-ctable">
                <thead>
                  <tr>
                    <th>País</th><th>Líder</th>
                    <th className="num">Activas</th>
                    <th className="num">Vencidas</th>
                    <th className="num">On-time</th>
                    <th className="num">Proy.</th>
                  </tr>
                </thead>
                <tbody>
                  {COUNTRIES.filter(c => c.active > 0 || c.projects > 0).map(c => (
                    <tr key={c.code}>
                      <td>
                        <div className="country">
                          <span className={`d3-health-dot ${c.health}`}/>
                          <span className="d3-country-flag">{c.code}</span>
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td className="muted">{c.lead}</td>
                      <td className="num">{c.active}</td>
                      <td className={`num ${c.overdue > 0 ? 'crit' : 'muted'}`}>{c.overdue || '—'}</td>
                      <td className={`num ${c.onTime && c.onTime < 70 ? 'crit' : c.onTime ? 'good' : 'muted'}`}>{c.onTime != null ? c.onTime + '%' : '—'}</td>
                      <td className="num muted">{c.projects}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { D3Shell });
