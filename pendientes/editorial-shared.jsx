// ═══════════════════════════════════════════════════════════════
// EDITORIAL — Shared theme tokens, sidebar, primitives
// Serif (Fraunces) restringido a H1 grandes y números hero.
// El resto Nunito Sans.
// ═══════════════════════════════════════════════════════════════

function edTheme(theme) {
  const dark = theme === 'dark';
  return dark ? {
    dark: true,
    bg: '#111114', paper: '#17181C', paper2: '#1E1F25', paper3: '#262830',
    ink: '#EDEDEE', muted: '#9A9AA2', dim: '#63646C',
    rule: 'rgba(255,255,255,.08)', ruleSoft: 'rgba(255,255,255,.04)', ruleStrong: 'rgba(255,255,255,.14)',
    accent: '#D17247', accentSoft: 'rgba(209,114,71,.16)',
    critical: '#E26259', criticalSoft: 'rgba(226,98,89,.13)',
    warn: '#D9A23F', warnSoft: 'rgba(217,162,63,.13)',
    good: '#6FA88A', goodSoft: 'rgba(111,168,138,.13)',
    info: '#7B96BF', infoSoft: 'rgba(123,150,191,.13)',
  } : {
    dark: false,
    bg: '#FAFAF7', paper: '#FFFFFF', paper2: '#F4F2EC', paper3: '#E9E6DD',
    ink: '#1A1A1A', muted: '#5B5B5B', dim: '#9A998F',
    rule: 'rgba(0,0,0,.09)', ruleSoft: 'rgba(0,0,0,.04)', ruleStrong: 'rgba(0,0,0,.16)',
    accent: '#B8551F', accentSoft: 'rgba(184,85,31,.10)',
    critical: '#C8372D', criticalSoft: 'rgba(200,55,45,.08)',
    warn: '#C68B2B', warnSoft: 'rgba(198,139,43,.10)',
    good: '#4A7C59', goodSoft: 'rgba(74,124,89,.10)',
    info: '#3E5F7A', infoSoft: 'rgba(62,95,122,.08)',
  };
}

// Scope all CSS rules to a unique parent class so artboards don't bleed into each other.
function edScope(scope, css) {
  // Prefix every selector list with `.scope ` (handles comma-separated selectors)
  return css.replace(/(^|\})\s*([^{}@]+)\{/g, (m, brace, sel) => {
    const scoped = sel.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed) return s;
      // Don't scope @-rules or already-scoped or :root
      if (trimmed.startsWith('@') || trimmed.startsWith(':root')) return s;
      return ` .${scope} ${trimmed}`;
    }).join(',');
    return brace + scoped + '{';
  });
}

function edBaseCSS(t) {
  return `
    .ed-root { font-family:'Nunito Sans',system-ui,sans-serif; background:${t.bg}; color:${t.ink}; min-height:100%; display:grid; grid-template-columns:218px 1fr; }
    .ed-side { border-right:1px solid ${t.rule}; padding:24px 18px; position:sticky; top:0; height:100vh; max-height:1400px; display:flex; flex-direction:column; }
    .ed-brand { font-family:'Fraunces',Georgia,serif; font-weight:600; font-size:21px; letter-spacing:-.5px; line-height:1; font-style:italic; }
    .ed-brand-sub { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:700; margin-top:4px; padding-bottom:18px; border-bottom:1px solid ${t.rule}; margin-bottom:24px; }
    .ed-role-pill { font-size:9px; color:${t.accent}; text-transform:uppercase; letter-spacing:1.4px; font-weight:800; margin-top:6px; }
    .ed-nav-section { margin-bottom:20px; }
    .ed-nav-label { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; margin-bottom:8px; padding:0 8px; }
    .ed-nav-item { display:flex; align-items:center; gap:11px; padding:6px 8px; font-size:13px; color:${t.muted}; cursor:pointer; border-radius:4px; font-weight:500; transition:color .12s; }
    .ed-nav-item:hover { color:${t.ink}; }
    .ed-nav-item.active { color:${t.accent}; font-weight:700; position:relative; }
    .ed-nav-item.active::before { content:''; position:absolute; left:-18px; top:50%; transform:translateY(-50%); width:2px; height:14px; background:${t.accent}; }
    .ed-nav-badge { margin-left:auto; font-size:10px; color:${t.dim}; font-family:'JetBrains Mono',monospace; font-weight:600; }
    .ed-nav-item.active .ed-nav-badge { color:${t.accent}; }
    .ed-side-foot { margin-top:auto; padding-top:14px; border-top:1px solid ${t.rule}; display:flex; align-items:center; gap:10px; }
    .ed-foot-name { font-size:12px; font-weight:700; color:${t.ink}; }
    .ed-foot-role { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1px; font-weight:700; }

    .ed-main { padding:40px 48px 60px; max-width:1200px; min-width:0; }
    .ed-head { display:flex; align-items:center; gap:12px; margin-bottom:36px; padding-bottom:18px; border-bottom:1px solid ${t.rule}; }
    .ed-search { flex:1; display:flex; align-items:center; gap:10px; color:${t.dim}; font-size:13px; }
    .ed-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; font-size:12px; font-weight:700; border-radius:4px; border:1px solid ${t.rule}; background:transparent; color:${t.ink}; cursor:pointer; font-family:inherit; }
    .ed-btn.primary { background:${t.ink}; color:${t.bg}; border-color:${t.ink}; }
    .ed-btn.accent { background:${t.accent}; color:#fff; border-color:${t.accent}; }

    .ed-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2px; font-weight:700; margin-bottom:14px; }
    .ed-h1 { font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:38px; line-height:1.08; letter-spacing:-1px; margin-bottom:12px; }
    .ed-h1 em { font-style:italic; color:${t.accent}; }
    .ed-lede { font-size:15px; color:${t.muted}; max-width:720px; line-height:1.55; margin-bottom:36px; }
    .ed-lede b { color:${t.ink}; font-weight:700; }
    .ed-lede .crit { color:${t.critical}; font-weight:700; }
    .ed-lede .good { color:${t.good}; font-weight:700; }
    .ed-lede .warn { color:${t.warn}; font-weight:700; }

    .ed-section { margin-bottom:48px; }
    .ed-h2 { font-size:13px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:700; margin-bottom:18px; display:flex; align-items:center; gap:10px; }
    .ed-h2::after { content:''; flex:1; height:1px; background:${t.rule}; }

    .ed-mono { font-family:'JetBrains Mono',monospace; font-variant-numeric:tabular-nums; }
    .ed-serif { font-family:'Fraunces',Georgia,serif; }

    .ed-pill { display:inline-flex; align-items:center; gap:4px; padding:1px 8px; border-radius:3px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
    .ed-pill.alta { background:${t.criticalSoft}; color:${t.critical}; }
    .ed-pill.media { background:${t.warnSoft}; color:${t.warn}; }
    .ed-pill.baja { background:${t.goodSoft}; color:${t.good}; }
    .ed-pill.curso { background:${t.infoSoft}; color:${t.info}; }
    .ed-pill.revision { background:${t.accentSoft}; color:${t.accent}; }
    .ed-pill.bloqueado { background:${t.criticalSoft}; color:${t.critical}; }
    .ed-pill.pendiente { background:${t.paper3}; color:${t.muted}; }
    .ed-pill.cerrada { background:${t.goodSoft}; color:${t.good}; }

    .ed-dot { width:6px; height:6px; border-radius:50%; display:inline-block; }
    .ed-dot.crit { background:${t.critical}; }
    .ed-dot.warn { background:${t.warn}; }
    .ed-dot.good { background:${t.good}; }
    .ed-dot.info { background:${t.info}; }
  `;
}

function EdSidebar({ t, role, activeItem, onNav }) {
  const nav = ED_NAV_BY_ROLE[role];
  const person = ED_PEOPLE[role];
  return (
    <aside className="ed-side">
      <div>
        <div className="ed-brand">Legal</div>
        <div className="ed-brand-sub">
          Tracker · Rappi
          <div className="ed-role-pill">
            {role === 'specialist' && '· Specialist'}
            {role === 'manager' && '· Manager'}
            {role === 'hq' && '· HQ'}
          </div>
        </div>
      </div>
      {nav.map((sec, i) => (
        <div key={i} className="ed-nav-section">
          <div className="ed-nav-label">{sec.section}</div>
          {sec.items.map(it => (
            <div key={it.id} className={`ed-nav-item ${it.id === activeItem ? 'active' : ''}`} onClick={() => onNav && onNav(it.id)}>
              <span>{it.label}</span>
              {it.badge != null && <span className="ed-nav-badge">{it.badge}</span>}
            </div>
          ))}
        </div>
      ))}
      <div className="ed-side-foot">
        <div style={{width:30,height:30,borderRadius:8,background:person.color,color:'#fff',display:'grid',placeItems:'center',fontWeight:800,fontSize:11}}>{person.avatar}</div>
        <div>
          <div className="ed-foot-name">{person.short || person.name.split(' ')[0]}</div>
          <div className="ed-foot-role">{person.role}</div>
        </div>
      </div>
    </aside>
  );
}

function EdHeader({ t, onCreate }) {
  return (
    <div className="ed-head">
      <div className="ed-search"><Icon name="search" size={14}/> <span>Buscar — ⌘K</span></div>
      <button className="ed-btn">Sem 17 · abr 2026</button>
      <button className="ed-btn accent" onClick={onCreate}><Icon name="plus" size={12}/> Nuevo</button>
    </div>
  );
}

Object.assign(window, { edTheme, edBaseCSS, edScope, EdSidebar, EdHeader });
