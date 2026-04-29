// ═══════════════════════════════════════════════════════════════
// DIRECTION 1 — REFINED RAPPI
// Dark + rojo Rappi, pero con mucho más aire, insights con contexto,
// jerarquía clara. Mantiene identidad, arregla saturación.
// ═══════════════════════════════════════════════════════════════

function D1Shell({ theme = 'dark' }) {
  const dark = theme === 'dark';
  const t = dark ? {
    bg: '#0C0E14', surface: '#151820', surface2: '#1C2030', surface3: '#252A3A',
    border: 'rgba(255,255,255,.06)', borderLight: 'rgba(255,255,255,.1)',
    text: '#F0F2F8', textMuted: '#9099B0', textDim: '#5C6480',
  } : {
    bg: '#F7F8FA', surface: '#FFFFFF', surface2: '#F1F3F8', surface3: '#E6E9F0',
    border: 'rgba(10,15,30,.08)', borderLight: 'rgba(10,15,30,.12)',
    text: '#0F1220', textMuted: '#4B5168', textDim: '#8A91A8',
  };
  const rappi = '#FF4940';

  const css = `
    .d1-root { font-family: 'Nunito Sans', system-ui, sans-serif; background: ${t.bg}; color: ${t.text}; min-height: 100%; display: grid; grid-template-columns: 232px 1fr; }
    .d1-side { border-right: 1px solid ${t.border}; padding: 20px 14px; position: sticky; top: 0; height: 100vh; max-height: 1200px; overflow-y: auto; }
    .d1-logo { display: flex; align-items: center; gap: 10px; padding: 4px 10px 18px; border-bottom: 1px solid ${t.border}; margin-bottom: 16px; }
    .d1-logo-mark { width: 28px; height: 28px; border-radius: 8px; background: ${rappi}; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 13px; box-shadow: 0 0 18px rgba(255,73,64,.35); }
    .d1-logo-name { font-weight: 800; font-size: 14px; letter-spacing: -.2px; line-height: 1.1; }
    .d1-logo-sub { font-size: 10px; color: ${t.textDim}; letter-spacing: .5px; text-transform: uppercase; margin-top: 2px; }
    .d1-nav-section { margin-bottom: 16px; }
    .d1-nav-label { font-size: 10px; font-weight: 800; color: ${t.textDim}; text-transform: uppercase; letter-spacing: .7px; padding: 4px 10px 6px; }
    .d1-nav-item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; font-size: 13px; font-weight: 600; color: ${t.textMuted}; cursor: pointer; transition: all .15s; }
    .d1-nav-item:hover { background: ${t.surface}; color: ${t.text}; }
    .d1-nav-item.active { background: rgba(255,73,64,.1); color: ${rappi}; }
    .d1-nav-item.active svg { color: ${rappi}; }
    .d1-nav-badge { margin-left: auto; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 100px; background: ${t.surface3}; color: ${t.textMuted}; min-width: 20px; text-align: center; }
    .d1-nav-item.active .d1-nav-badge { background: ${rappi}; color: #fff; }
    .d1-side-foot { border-top: 1px solid ${t.border}; padding: 14px 10px 4px; margin-top: 14px; display: flex; align-items: center; gap: 10px; font-size: 12px; color: ${t.textMuted}; }
    .d1-main { padding: 28px 36px 60px; min-width: 0; }
    .d1-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    .d1-greet-eye { font-size: 11px; color: ${t.textDim}; letter-spacing: .5px; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
    .d1-greet-h { font-size: 26px; font-weight: 800; letter-spacing: -.6px; }
    .d1-greet-h em { font-style: normal; color: ${rappi}; }
    .d1-head-actions { display: flex; align-items: center; gap: 10px; }
    .d1-search { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 10px; color: ${t.textDim}; font-size: 13px; cursor: pointer; min-width: 260px; }
    .d1-search kbd { margin-left: auto; padding: 1px 6px; border-radius: 4px; background: ${t.surface3}; font-size: 10px; font-family: 'JetBrains Mono', monospace; border: 1px solid ${t.border}; }
    .d1-btn-primary { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: ${rappi}; color: #fff; border: none; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; box-shadow: 0 4px 14px rgba(255,73,64,.35); }
    .d1-btn-ghost { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: transparent; color: ${t.textMuted}; border: 1px solid ${t.border}; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; }

    /* ── attention module ── */
    .d1-attention { border: 1px solid ${t.border}; border-radius: 16px; background: linear-gradient(180deg, ${dark ? 'rgba(255,73,64,.04)' : 'rgba(255,73,64,.02)'}, transparent 60%), ${t.surface}; padding: 22px; margin-bottom: 22px; }
    .d1-att-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
    .d1-att-title { font-size: 18px; font-weight: 800; letter-spacing: -.3px; display: flex; align-items: center; gap: 10px; }
    .d1-att-title svg { color: ${rappi}; }
    .d1-att-sub { font-size: 12px; color: ${t.textMuted}; margin-bottom: 16px; }
    .d1-att-list { display: flex; flex-direction: column; gap: 8px; }
    .d1-att-row { display: grid; grid-template-columns: 28px 1fr auto auto; gap: 14px; align-items: center; padding: 12px 14px; border-radius: 10px; background: ${t.surface2}; border: 1px solid ${t.border}; cursor: pointer; transition: all .15s; }
    .d1-att-row:hover { border-color: ${rappi}; transform: translateX(2px); }
    .d1-att-rank { font-size: 11px; font-weight: 800; color: ${t.textDim}; font-family: 'JetBrains Mono', monospace; }
    .d1-att-rank.critical { color: ${rappi}; }
    .d1-att-body { min-width: 0; }
    .d1-att-name { font-size: 14px; font-weight: 700; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d1-att-reason { font-size: 11px; color: ${t.textMuted}; display: flex; align-items: center; gap: 8px; }
    .d1-att-reason .crit { color: ${rappi}; font-weight: 700; }
    .d1-att-action { font-size: 11px; color: ${t.textDim}; max-width: 240px; text-align: right; font-style: italic; }
    .d1-att-jump { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: ${t.surface3}; color: ${t.textMuted}; border: none; cursor: pointer; transition: all .15s; }
    .d1-att-row:hover .d1-att-jump { background: ${rappi}; color: #fff; }

    /* ── grid ── */
    .d1-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px; margin-bottom: 22px; }

    /* ── bottlenecks ── */
    .d1-card { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 16px; padding: 20px; }
    .d1-card h3 { font-size: 14px; font-weight: 800; letter-spacing: -.1px; margin-bottom: 3px; display: flex; align-items: center; gap: 8px; }
    .d1-card-sub { font-size: 11px; color: ${t.textDim}; margin-bottom: 16px; }
    .d1-btl-row { padding: 14px 0; border-top: 1px solid ${t.border}; display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; }
    .d1-btl-row:first-of-type { border-top: none; padding-top: 4px; }
    .d1-btl-meta { min-width: 0; }
    .d1-btl-name { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
    .d1-btl-detail { font-size: 11px; color: ${t.textMuted}; }
    .d1-btl-detail .high { color: ${rappi}; font-weight: 700; }
    .d1-btl-detail .low { color: #2DD4A0; font-weight: 700; }
    .d1-btl-right { text-align: right; min-width: 110px; }
    .d1-btl-load { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; letter-spacing: -.3px; margin-bottom: 4px; }
    .d1-btl-load .max { color: ${t.textDim}; }

    /* ── risk projects ── */
    .d1-risk { display: flex; flex-direction: column; gap: 10px; }
    .d1-risk-item { padding: 12px 14px; border-radius: 10px; border: 1px solid ${t.border}; background: ${t.surface2}; display: grid; grid-template-columns: 4px 1fr auto; gap: 14px; align-items: center; }
    .d1-risk-bar { width: 3px; height: 100%; min-height: 40px; border-radius: 3px; }
    .d1-risk-bar.high { background: ${rappi}; }
    .d1-risk-bar.medium { background: #FFB938; }
    .d1-risk-bar.low { background: #2DD4A0; }
    .d1-risk-name { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
    .d1-risk-why { font-size: 11px; color: ${t.textMuted}; }
    .d1-risk-progress { width: 64px; text-align: right; }
    .d1-risk-pct { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 800; }

    /* ── bottom strip ── */
    .d1-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .d1-strip-cell { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
    .d1-strip-eye { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: ${t.textDim}; font-weight: 800; }
    .d1-strip-main { display: flex; align-items: baseline; gap: 8px; justify-content: space-between; }
    .d1-strip-val { font-size: 26px; font-weight: 800; letter-spacing: -.8px; font-family: 'JetBrains Mono', monospace; }
    .d1-strip-delta { font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 2px; }
    .d1-strip-delta.up { color: #2DD4A0; }
    .d1-strip-delta.down { color: ${rappi}; }
    .d1-strip-foot { font-size: 11px; color: ${t.textMuted}; display: flex; align-items: center; gap: 8px; }
    .d1-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 800; }
    .d1-chip-critical { background: rgba(255,73,64,.12); color: ${rappi}; }
    .d1-chip-warn { background: rgba(255,185,56,.12); color: #FFB938; }
    .d1-chip-ok { background: rgba(45,212,160,.12); color: #2DD4A0; }

    .d1-mono { font-family: 'JetBrains Mono', monospace; }
  `;

  const jc = PEOPLE[0];
  const overdueCount = 13;

  return (
    <div className="d1-root">
      <style>{css}</style>
      <aside className="d1-side">
        <div className="d1-logo">
          <div className="d1-logo-mark">⚖</div>
          <div>
            <div className="d1-logo-name">Legal Tracker</div>
            <div className="d1-logo-sub">Rappi · Sem. 23—27</div>
          </div>
        </div>
        {NAV.map((sec, i) => (
          <div key={i} className="d1-nav-section">
            <div className="d1-nav-label">{sec.section}</div>
            {sec.items.map(it => (
              <div key={it.id} className={`d1-nav-item ${it.id === 'home' ? 'active' : ''}`}>
                <Icon name={it.icon} size={15}/>
                <span>{it.label}</span>
                {it.badge != null && <span className="d1-nav-badge">{it.badge}</span>}
              </div>
            ))}
          </div>
        ))}
        <div className="d1-side-foot">
          <Avatar person={jc} size={28}/>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:t.text}}>{jc.name}</div>
            <div style={{fontSize:10,color:t.textDim}}>{jc.role}</div>
          </div>
        </div>
      </aside>

      <main className="d1-main">
        <header className="d1-head">
          <div>
            <div className="d1-greet-eye">Jueves 23 abril · 10:15</div>
            <h1 className="d1-greet-h">Hola Juan Camilo. Tienes <em>4 focos</em> hoy.</h1>
          </div>
          <div className="d1-head-actions">
            <div className="d1-search">
              <Icon name="search" size={14}/>
              <span>Buscar tareas, proyectos, personas...</span>
              <kbd>⌘K</kbd>
            </div>
            <button className="d1-btn-ghost"><Icon name="bell" size={14}/> {overdueCount}</button>
            <button className="d1-btn-primary"><Icon name="plus" size={14}/> Crear</button>
          </div>
        </header>

        {/* ATTENTION — smart prioritization */}
        <section className="d1-attention">
          <div className="d1-att-top">
            <div className="d1-att-title"><Icon name="target" size={18}/> Lo que pide tu atención</div>
            <button className="d1-btn-ghost" style={{padding:'6px 10px',fontSize:12}}>Ver mis tareas <Icon name="arrowRight" size={12}/></button>
          </div>
          <div className="d1-att-sub">Ordenado por urgencia real — SLA, días de atraso, bloqueos y dependencias.</div>
          <div className="d1-att-list">
            {MY_PRIORITIZED.map((p, i) => (
              <div key={p.task.id} className="d1-att-row">
                <div className={`d1-att-rank ${p.urgency === 'critical' ? 'critical' : ''}`}>#{i+1}</div>
                <div className="d1-att-body">
                  <div className="d1-att-name">{p.task.name}</div>
                  <div className="d1-att-reason">
                    <span className="d1-mono" style={{color:t.textDim}}>{p.task.id}</span>
                    <span>·</span>
                    <span className={p.urgency === 'critical' ? 'crit' : ''}>{p.reason}</span>
                    {p.task.status === 'Bloqueado' && <><span>·</span><span className="crit">Bloqueada por {p.task.blockedBy}</span></>}
                  </div>
                </div>
                <div className="d1-att-action">↳ {p.task.accionable}</div>
                <button className="d1-att-jump"><Icon name="arrowRight" size={14}/></button>
              </div>
            ))}
          </div>
        </section>

        {/* GRID: Bottlenecks + Risk */}
        <section className="d1-grid">
          <div className="d1-card">
            <h3><Icon name="flame" size={15} style={{color:'#FFB938'}}/> Cuellos de botella del equipo</h3>
            <div className="d1-card-sub">Quién está ahogado, con margen, y por qué.</div>
            {BOTTLENECKS.map((b, i) => {
              const color = b.severity === 'high' ? rappi : b.severity === 'medium' ? '#FFB938' : '#2DD4A0';
              return (
                <div key={i} className="d1-btl-row">
                  <Avatar person={b.person} size={36}/>
                  <div className="d1-btl-meta">
                    <div className="d1-btl-name">{b.person.name}</div>
                    <div className="d1-btl-detail">
                      <span className={b.severity === 'high' ? 'high' : b.severity === 'low' ? 'low' : ''}>{b.verdict}</span>
                      <span> · {b.detail}</span>
                    </div>
                  </div>
                  <div className="d1-btl-right">
                    <div className="d1-btl-load">{b.load}<span className="max">/{b.capacity}</span></div>
                    <div style={{width:110}}><LoadBar current={b.load} max={b.capacity} colorFn={()=>color}/></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="d1-card">
            <h3><Icon name="alert" size={15} style={{color:rappi}}/> Proyectos en riesgo</h3>
            <div className="d1-card-sub">No solo conteo — la razón real detrás.</div>
            <div className="d1-risk">
              {PROJECTS.map(p => (
                <div key={p.id} className="d1-risk-item">
                  <div className={`d1-risk-bar ${p.risk}`}/>
                  <div>
                    <div className="d1-risk-name">{p.name}</div>
                    <div className="d1-risk-why">
                      <span className="d1-mono" style={{color:t.textDim}}>{p.id}</span> · {p.riskReason}
                    </div>
                  </div>
                  <div className="d1-risk-progress">
                    <div className="d1-risk-pct">{Math.round(p.completed/p.tasks*100)}%</div>
                    <div style={{fontSize:10,color:t.textDim}}>{p.completed}/{p.tasks}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* STRIP — stats with context */}
        <section className="d1-strip">
          <div className="d1-strip-cell">
            <div className="d1-strip-eye">Activas</div>
            <div className="d1-strip-main">
              <div className="d1-strip-val">20</div>
              <div className="d1-strip-delta up"><Icon name="arrowUp" size={11}/> 3</div>
            </div>
            <div className="d1-strip-foot"><Sparkline data={[15,17,14,16,19,18,17,20]} width={80} height={22} color="#5B9BFF"/></div>
          </div>
          <div className="d1-strip-cell">
            <div className="d1-strip-eye">Vencidas</div>
            <div className="d1-strip-main">
              <div className="d1-strip-val" style={{color:rappi}}>13</div>
              <div className="d1-strip-delta down"><Icon name="arrowUp" size={11}/> 5</div>
            </div>
            <div className="d1-strip-foot"><span className="d1-chip d1-chip-critical">↑ peor que ayer</span></div>
          </div>
          <div className="d1-strip-cell">
            <div className="d1-strip-eye">On-time 30d</div>
            <div className="d1-strip-main">
              <div className="d1-strip-val" style={{color:'#FFB938'}}>50%</div>
              <div className="d1-strip-delta down"><Icon name="arrowDown" size={11}/> 12pp</div>
            </div>
            <div className="d1-strip-foot">Meta: <b style={{color:t.text}}>80%</b></div>
          </div>
          <div className="d1-strip-cell">
            <div className="d1-strip-eye">Cerradas esta sem.</div>
            <div className="d1-strip-main">
              <div className="d1-strip-val" style={{color:'#2DD4A0'}}>1</div>
              <div className="d1-strip-delta down"><Icon name="arrowDown" size={11}/> 7</div>
            </div>
            <div className="d1-strip-foot"><Sparkline data={TREND_8W} width={80} height={22} color="#2DD4A0"/></div>
          </div>
        </section>
      </main>
    </div>
  );
}

Object.assign(window, { D1Shell });
