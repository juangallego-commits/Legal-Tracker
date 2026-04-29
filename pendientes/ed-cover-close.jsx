// ═══════════════════════════════════════════════════════════════
// EDITORIAL — Cover (intro al deep-dive) + Close (cierre)
// Ambos editoriales, full-bleed, pensados para presentar.
// ═══════════════════════════════════════════════════════════════

function EdCover({ theme = 'light' }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = `
    .cv-root { font-family:'Nunito Sans',system-ui,sans-serif; background:${t.bg}; color:${t.ink}; min-height:100%; padding:64px 80px 64px; }
    .cv-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2.5px; font-weight:800; margin-bottom:24px; display:flex; align-items:center; gap:14px; }
    .cv-eye::after { content:''; flex:0 0 80px; height:1px; background:${t.ruleStrong}; }
    .cv-rule { display:inline-block; width:42px; height:1px; background:${t.accent}; vertical-align:middle; margin-right:14px; }

    .cv-h1 { font-family:'Fraunces',Georgia,serif; font-weight:300; font-size:78px; line-height:1; letter-spacing:-2.5px; margin:0 0 28px; max-width:1100px; }
    .cv-h1 em { font-style:italic; color:${t.accent}; font-weight:400; }
    .cv-lede { font-size:18px; color:${t.muted}; max-width:760px; line-height:1.5; margin-bottom:56px; font-weight:400; }
    .cv-lede b { color:${t.ink}; font-weight:700; }

    .cv-meta { display:grid; grid-template-columns:repeat(4,1fr); gap:0; padding:24px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:64px; }
    .cv-meta-cell { padding:0 22px; border-right:1px solid ${t.rule}; }
    .cv-meta-cell:first-child { padding-left:0; }
    .cv-meta-cell:last-child { border-right:none; }
    .cv-meta-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:800; margin-bottom:8px; }
    .cv-meta-val { font-size:15px; color:${t.ink}; font-weight:700; line-height:1.35; }
    .cv-meta-sub { font-size:12px; color:${t.muted}; margin-top:4px; }

    .cv-sec-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.8px; font-weight:800; margin-bottom:22px; }

    /* Roles */
    .cv-roles { display:grid; grid-template-columns:repeat(3,1fr); gap:32px; margin-bottom:64px; }
    .cv-role { padding-top:18px; border-top:2px solid ${t.ink}; }
    .cv-role-num { font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:300; font-size:14px; color:${t.dim}; margin-bottom:8px; letter-spacing:.5px; }
    .cv-role-name { font-family:'Fraunces',Georgia,serif; font-weight:400; font-size:32px; letter-spacing:-1px; margin-bottom:6px; line-height:1.05; }
    .cv-role-name em { font-style:italic; color:${t.accent}; }
    .cv-role-who { font-size:12.5px; color:${t.muted}; margin-bottom:14px; line-height:1.5; }
    .cv-role-who b { color:${t.ink}; font-weight:700; }
    .cv-role-list { list-style:none; padding:0; margin:0; }
    .cv-role-list li { font-size:13px; color:${t.muted}; padding:7px 0; border-bottom:1px solid ${t.rule}; line-height:1.4; display:flex; gap:10px; align-items:baseline; }
    .cv-role-list li::before { content:''; flex:0 0 5px; width:5px; height:5px; border-radius:50%; background:${t.accent}; transform:translateY(-1px); }

    /* Flow */
    .cv-flow { padding:32px 0; border-top:1px solid ${t.rule}; }
    .cv-flow-row { display:grid; grid-template-columns:60px 1fr 2fr; gap:24px; padding:18px 0; border-bottom:1px solid ${t.rule}; align-items:start; }
    .cv-flow-num { font-family:'Fraunces',Georgia,serif; font-weight:300; font-size:34px; color:${t.dim}; line-height:1; font-variant-numeric:tabular-nums; padding-top:2px; }
    .cv-flow-name { font-family:'Fraunces',Georgia,serif; font-size:21px; font-weight:400; letter-spacing:-.4px; line-height:1.15; }
    .cv-flow-desc { font-size:13px; color:${t.muted}; line-height:1.55; padding-top:4px; }
    .cv-flow-desc b { color:${t.ink}; font-weight:700; }

    .cv-foot { margin-top:48px; padding-top:24px; border-top:1px solid ${t.rule}; display:flex; justify-content:space-between; align-items:flex-end; gap:24px; }
    .cv-foot-left { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:700; line-height:1.5; }
    .cv-foot-right { font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:300; font-size:16px; color:${t.muted}; max-width:380px; text-align:right; line-height:1.5; }
  `;
  const css = edScope(scope, rawCSS);

  return (
    <div className={scope} style={{minHeight:'100%'}}>
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&display=swap"/>
      <div className="cv-root">
        <div className="cv-eye"><span className="cv-rule"/>Legal Tracker · Rediseño · Abril 2026</div>

        <h1 className="cv-h1">
          Una herramienta legal<br/>
          que <em>entiende</em> a quien<br/>
          la usa.
        </h1>

        <p className="cv-lede">
          El tracker actual trata a todos por igual: <b>tabla densa, sin contexto, sin tono</b>.
          Esta propuesta separa tres miradas — el especialista, el manager de país, el head global —
          y le da a cada una su propia entrada al producto. Mismo dato, lecturas distintas.
        </p>

        <div className="cv-meta">
          <div className="cv-meta-cell">
            <div className="cv-meta-lbl">Alcance</div>
            <div className="cv-meta-val">3 roles · 4 vistas</div>
            <div className="cv-meta-sub">Home, Agrupadas, Tracker, Crear</div>
          </div>
          <div className="cv-meta-cell">
            <div className="cv-meta-lbl">Personajes</div>
            <div className="cv-meta-val">Juan Camilo · Carlos · Enrique</div>
            <div className="cv-meta-sub">Specialist, Manager, HQ</div>
          </div>
          <div className="cv-meta-cell">
            <div className="cv-meta-lbl">Lenguaje</div>
            <div className="cv-meta-val">Editorial, calmo</div>
            <div className="cv-meta-sub">Serif para títulos · Mono para datos</div>
          </div>
          <div className="cv-meta-cell">
            <div className="cv-meta-lbl">Estado</div>
            <div className="cv-meta-val">Hi-fi · navegable</div>
            <div className="cv-meta-sub">Para validación con equipo Legal</div>
          </div>
        </div>

        {/* ROLES */}
        <div className="cv-sec-eye">— Tres miradas, una sola fuente de verdad</div>
        <div className="cv-roles">
          <div className="cv-role">
            <div className="cv-role-num">— I.</div>
            <div className="cv-role-name"><em>Specialist</em></div>
            <div className="cv-role-who"><b>Juan Camilo</b> · Legal Ops, Bogotá<br/>Lleva 4 tareas activas</div>
            <ul className="cv-role-list">
              <li>Lo suyo, ordenado por urgencia</li>
              <li>Racha, SLA por prioridad, métricas personales</li>
              <li>Donde participa como invitado</li>
            </ul>
          </div>
          <div className="cv-role">
            <div className="cv-role-num">— II.</div>
            <div className="cv-role-name"><em>Manager</em></div>
            <div className="cv-role-who"><b>Carlos Fernández</b> · Country Lead Colombia<br/>Cuida 4 personas y 11 tareas activas</div>
            <ul className="cv-role-list">
              <li>Carga del equipo y atrasos por persona</li>
              <li>"Hoy te conviene mirar esto" — atención sugerida</li>
              <li>SLA del país y tendencia</li>
            </ul>
          </div>
          <div className="cv-role">
            <div className="cv-role-num">— III.</div>
            <div className="cv-role-name"><em>HQ</em></div>
            <div className="cv-role-who"><b>Enrique González</b> · Global Legal Head<br/>10 países, 217 tareas abiertas</div>
            <ul className="cv-role-list">
              <li>Visión LATAM, país por país</li>
              <li>Riesgo concentrado, tendencias 30d</li>
              <li>Quién necesita apoyo este mes</li>
            </ul>
          </div>
        </div>

        {/* FLOW */}
        <div className="cv-sec-eye">— Cómo se recorre la propuesta</div>
        <div className="cv-flow">
          <div className="cv-flow-row">
            <div className="cv-flow-num">01</div>
            <div className="cv-flow-name">Home — por tipo de usuario</div>
            <div className="cv-flow-desc">Tres entradas distintas al mismo producto. <b>Specialist</b> ve sólo lo suyo, <b>Manager</b> ve a su equipo, <b>HQ</b> ve los 10 países. La estructura de información y el tono cambian con el rol.</div>
          </div>
          <div className="cv-flow-row">
            <div className="cv-flow-num">02</div>
            <div className="cv-flow-name">Tus tareas agrupadas</div>
            <div className="cv-flow-desc">Vista intermedia. Antes de bajar a la tabla densa, un mapa por <b>prioridad / proyecto / tipo / riesgo</b> con narrativa. Reduce la fricción cognitiva entre el alto nivel del Home y el detalle del Tracker.</div>
          </div>
          <div className="cv-flow-row">
            <div className="cv-flow-num">03</div>
            <div className="cv-flow-name">Tracker</div>
            <div className="cv-flow-desc">La tabla, pero clickeable. Cualquier fila abre un panel lateral con <b>estado, historial y acciones</b> sin perder el contexto de la tabla. Specialist ve sus tareas, Manager ve las del equipo.</div>
          </div>
          <div className="cv-flow-row">
            <div className="cv-flow-num">04</div>
            <div className="cv-flow-name">Crear tarea</div>
            <div className="cv-flow-desc">Tres pasos. Primero lo esencial (título, descripción, tipo, país). Después la <b>IA sugiere</b> prioridad, responsable y SLA según el histórico. Por último, confirmás visibilidad y publicás.</div>
          </div>
        </div>

        <div className="cv-foot">
          <div className="cv-foot-left">
            Diseño · Legal Ops × Producto<br/>
            Versión Editorial Deep · v1
          </div>
          <div className="cv-foot-right">
            "Una herramienta calma no es una herramienta lenta. Es una herramienta que sabe qué pedirte y cuándo."
          </div>
        </div>
      </div>
    </div>
  );
}


function EdClose({ theme = 'light' }) {
  const t = edTheme(theme);
  const scope = 'sc-' + React.useId().replace(/[:]/g, '');
  const rawCSS = `
    .cl-root { font-family:'Nunito Sans',system-ui,sans-serif; background:${t.bg}; color:${t.ink}; min-height:100%; padding:64px 80px; }
    .cl-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:2.5px; font-weight:800; margin-bottom:24px; display:flex; align-items:center; gap:14px; }
    .cl-eye::after { content:''; flex:0 0 80px; height:1px; background:${t.ruleStrong}; }
    .cl-rule { display:inline-block; width:42px; height:1px; background:${t.accent}; vertical-align:middle; margin-right:14px; }

    .cl-h1 { font-family:'Fraunces',Georgia,serif; font-weight:300; font-size:64px; line-height:1.02; letter-spacing:-2px; margin:0 0 24px; max-width:980px; }
    .cl-h1 em { font-style:italic; color:${t.accent}; font-weight:400; }
    .cl-lede { font-size:17px; color:${t.muted}; max-width:780px; line-height:1.55; margin-bottom:56px; }
    .cl-lede b { color:${t.ink}; font-weight:700; }

    .cl-sec-eye { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.8px; font-weight:800; margin-bottom:18px; }

    /* Cambios antes/después */
    .cl-changes { display:grid; grid-template-columns:1fr 1fr; gap:0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:64px; }
    .cl-change-row { display:contents; }
    .cl-cell { padding:22px 24px; border-bottom:1px solid ${t.rule}; }
    .cl-cell.before { background:${t.paper2}; border-right:1px solid ${t.rule}; }
    .cl-cell.head { padding:14px 24px; background:transparent; border-bottom:1px solid ${t.ruleStrong}; }
    .cl-cell.head .cl-tag { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:800; }
    .cl-tag { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:800; margin-bottom:8px; }
    .cl-cell.before .cl-text { color:${t.muted}; font-size:14px; line-height:1.5; }
    .cl-cell.after .cl-text { color:${t.ink}; font-size:14px; font-weight:600; line-height:1.5; }
    .cl-cell.after .cl-text em { font-style:normal; color:${t.accent}; font-weight:700; }

    /* Métricas */
    .cl-metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:0; padding:28px 0; border-top:1px solid ${t.rule}; border-bottom:1px solid ${t.rule}; margin-bottom:64px; }
    .cl-metric { padding:0 24px; border-right:1px solid ${t.rule}; }
    .cl-metric:first-child { padding-left:0; } .cl-metric:last-child { border-right:none; }
    .cl-metric-lbl { font-size:10px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.6px; font-weight:800; margin-bottom:10px; }
    .cl-metric-from { font-family:'JetBrains Mono',monospace; font-size:13px; color:${t.dim}; font-weight:600; margin-bottom:4px; }
    .cl-metric-arrow { font-size:14px; color:${t.dim}; margin:0 6px; }
    .cl-metric-num { font-family:'Fraunces',Georgia,serif; font-size:42px; font-weight:300; line-height:1; letter-spacing:-1.2px; color:${t.good}; font-variant-numeric:tabular-nums; }
    .cl-metric-num em { font-style:normal; font-size:18px; color:${t.dim}; font-weight:300; margin-left:2px; }
    .cl-metric-ctx { font-size:12px; color:${t.muted}; margin-top:8px; line-height:1.45; }

    /* Próximos pasos */
    .cl-next { display:grid; grid-template-columns:60px 1fr; gap:24px; padding:18px 0; border-bottom:1px solid ${t.rule}; align-items:start; }
    .cl-next-num { font-family:'Fraunces',Georgia,serif; font-weight:300; font-size:30px; color:${t.dim}; line-height:1; font-variant-numeric:tabular-nums; padding-top:4px; }
    .cl-next-row { display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:24px; align-items:baseline; }
    .cl-next-name { font-family:'Fraunces',Georgia,serif; font-size:20px; font-weight:400; letter-spacing:-.4px; line-height:1.2; }
    .cl-next-name em { font-style:italic; color:${t.accent}; }
    .cl-next-when { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.4px; font-weight:800; }
    .cl-next-who { font-size:13px; color:${t.muted}; }
    .cl-next-who b { color:${t.ink}; font-weight:700; }

    .cl-foot { margin-top:64px; padding-top:24px; border-top:1px solid ${t.ruleStrong}; display:flex; justify-content:space-between; align-items:flex-end; gap:32px; }
    .cl-foot-quote { font-family:'Fraunces',Georgia,serif; font-style:italic; font-weight:300; font-size:22px; color:${t.ink}; max-width:680px; line-height:1.35; letter-spacing:-.3px; }
    .cl-foot-attr { font-size:11px; color:${t.dim}; text-transform:uppercase; letter-spacing:1.5px; font-weight:800; white-space:nowrap; padding-bottom:6px; }
  `;
  const css = edScope(scope, rawCSS);

  const changes = [
    { before: 'Una sola tabla densa para todos los roles. Specialist y HQ ven lo mismo.', after: <>Tres entradas distintas al mismo dato. Cada rol ve <em>lo que necesita decidir</em>.</> },
    { before: 'Estado de tarea = etiqueta seca ("Bloqueado"). Sin razón ni acción sugerida.', after: <>Cada tarea tiene una <em>frase accionable</em>: por qué está donde está y qué falta.</> },
    { before: 'Crear tarea: 14 campos en una pantalla. Carga cognitiva alta.', after: <>3 pasos. Primero lo esencial; la <em>IA sugiere</em> prioridad, owner y SLA.</> },
    { before: 'Tabla → click → cambio de página. Se pierde el contexto.', after: <>Tabla totalmente clickeable, panel lateral con detalle. <em>Sin perder la tabla</em>.</> },
  ];

  const metrics = [
    { lbl: 'Tareas atrasadas', from: '16 LATAM', val: '−40%', ctx: 'Atención ranked y SLA visible por persona' },
    { lbl: 'Tiempo en crear', from: '4 min', val: '90s', ctx: 'Sugerencias IA en paso 2', em: true },
    { lbl: 'SLA cumplido', from: '89%', val: '+5pp', ctx: 'Frase accionable y bloqueos visibles' },
    { lbl: 'Adopción semanal', from: '60%', val: '85%', ctx: 'Vista intermedia + nav por rol' },
  ];

  const nextSteps = [
    { name: <>Validación con <em>especialistas</em></>, when: 'Sem 18', who: <>Sesiones 1:1 con <b>JC, JM, MR, AB</b> · 30min c/u</> },
    { name: <>Test con <em>managers</em> de CO/MX/BR</>, when: 'Sem 19', who: <>Walk-through del Home Manager + tracker. <b>3 sesiones</b>.</> },
    { name: <>Prototipo navegable en <em>Figma</em></>, when: 'Sem 19–20', who: <>Para handoff a Eng. Cubre los 8 artboards y los estados clave.</> },
    { name: <>Beta cerrada en <em>Colombia</em></>, when: 'Sem 22', who: <>4 personas del equipo CO durante 2 semanas. Métricas vs hoy.</> },
  ];

  return (
    <div className={scope} style={{minHeight:'100%'}}>
      <style>{css}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&display=swap"/>
      <div className="cl-root">
        <div className="cl-eye"><span className="cl-rule"/>Cierre · Qué cambia · Qué medimos · Qué sigue</div>

        <h1 className="cl-h1">
          Lo que cambia,<br/>
          y por qué <em>vale la pena</em>.
        </h1>

        <p className="cl-lede">
          El tracker actual es funcional pero plano: trata todas las tareas igual, todos los roles igual,
          y no acompaña al equipo en la decisión. Esta propuesta apunta a <b>una herramienta que entiende</b>:
          ordena por contexto, sugiere lo siguiente, y se adapta al rol que la usa.
        </p>

        {/* CHANGES */}
        <div className="cl-sec-eye">— Antes / después</div>
        <div className="cl-changes">
          <div className="cl-cell head"><span className="cl-tag">Hoy</span></div>
          <div className="cl-cell head"><span className="cl-tag">Propuesta</span></div>
          {changes.map((c, i) => (
            <React.Fragment key={i}>
              <div className="cl-cell before"><div className="cl-text">{c.before}</div></div>
              <div className="cl-cell after"><div className="cl-text">{c.after}</div></div>
            </React.Fragment>
          ))}
        </div>

        {/* METRICS */}
        <div className="cl-sec-eye">— Cómo lo medimos</div>
        <div className="cl-metrics">
          {metrics.map(m => (
            <div key={m.lbl} className="cl-metric">
              <div className="cl-metric-lbl">{m.lbl}</div>
              <div className="cl-metric-from">de {m.from}</div>
              <div className="cl-metric-num">{m.val}</div>
              <div className="cl-metric-ctx">{m.ctx}</div>
            </div>
          ))}
        </div>

        {/* NEXT */}
        <div className="cl-sec-eye">— Qué sigue</div>
        {nextSteps.map((s, i) => (
          <div key={i} className="cl-next">
            <div className="cl-next-num">{String(i+1).padStart(2,'0')}</div>
            <div className="cl-next-row">
              <div className="cl-next-name">{s.name}</div>
              <div className="cl-next-when">{s.when}</div>
              <div className="cl-next-who">{s.who}</div>
            </div>
          </div>
        ))}

        <div className="cl-foot">
          <div className="cl-foot-quote">
            "El mejor producto legal no es el que tiene más features. Es el que te deja salir a tiempo del trabajo."
          </div>
          <div className="cl-foot-attr">— Equipo Legal Ops<br/>Rappi · 2026</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EdCover, EdClose });
