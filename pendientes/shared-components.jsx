// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS — Icons, Avatars, Sparklines
// Used across all 3 directions
// ═══════════════════════════════════════════════════════════════

// Icons — minimal line icons (stroke-based, neutral)
function Icon({ name, size = 16, stroke = 1.75, style }) {
  const props = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style,
  };
  const paths = {
    home: <><path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    table: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></>,
    folder: <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 15l4-4 4 4 5-5"/></>,
    pie: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    arrowUp: <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    arrowDown: <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
    flame: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></>,
    alert: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    block: <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    dot: <><circle cx="12" cy="12" r="4" fill="currentColor"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    menu: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    dot3: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
    arrowRight: <><polyline points="9 18 15 12 9 6"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    trend: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  };
  return <svg {...props}>{paths[name] || paths.dot}</svg>;
}

// Avatar — colored initial chip
function Avatar({ person, size = 28, style }) {
  if (!person) return null;
  const s = { width: size, height: size, borderRadius: size * 0.3, background: person.color,
    color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: size * 0.38, flexShrink: 0, letterSpacing: '.5px', ...style };
  return <div style={s}>{person.avatar}</div>;
}

// Sparkline — small inline trend line
function Sparkline({ data, width = 80, height = 24, color = 'currentColor', fill = true, style }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ display: 'block', ...style }}>
      {fill && <polygon points={areaPoints} fill={color} opacity=".15" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Bar meter — workload indicator
function LoadBar({ current, max, height = 6, colorFn }) {
  const pct = Math.min(100, (current / max) * 100);
  const overPct = current > max ? Math.min(100, ((current - max) / max) * 100) : 0;
  const color = colorFn ? colorFn(current, max) : '#2DD4A0';
  return (
    <div style={{ position: 'relative', height, background: 'rgba(255,255,255,.06)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: color, borderRadius: height }}/>
      {overPct > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${overPct}%`, background: '#FF5C5C', borderRadius: height }}/>}
    </div>
  );
}

// Format deadline
function fmtDeadline(days) {
  if (days == null) return { text: '—', tone: 'none' };
  if (days < 0) return { text: `${Math.abs(days)}d vencido`, tone: 'over' };
  if (days === 0) return { text: 'HOY', tone: 'over' };
  if (days === 1) return { text: 'mañana', tone: 'warn' };
  if (days <= 3) return { text: `en ${days}d`, tone: 'warn' };
  return { text: `en ${days}d`, tone: 'ok' };
}

Object.assign(window, { Icon, Avatar, Sparkline, LoadBar, fmtDeadline });
