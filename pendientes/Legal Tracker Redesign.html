<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Legal Tracker · Rediseño</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  html, body { margin:0; padding:0; background:#f0eee9; font-family:'Nunito Sans',system-ui,sans-serif; }
  * { box-sizing: border-box; }
  #root { min-height: 100vh; }
  /* Artboard content reset so each direction controls its own scrollbars */
  .ab-host { width:100%; height:100%; overflow:hidden; }
</style>
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
</head>
<body>
<template id="__bundler_thumbnail" data-bg-color="#0C0E14">
  <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="800" fill="#0C0E14"/>
    <rect x="240" y="240" width="120" height="120" rx="28" fill="#FF4940"/>
    <text x="300" y="328" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="800" fill="#fff" text-anchor="middle">⚖</text>
    <rect x="420" y="260" width="540" height="22" rx="6" fill="#F0F2F8"/>
    <rect x="420" y="298" width="380" height="14" rx="4" fill="#5C6480"/>
    <rect x="420" y="326" width="280" height="14" rx="4" fill="#5C6480"/>
    <rect x="240" y="460" width="720" height="80" rx="12" fill="#151820" stroke="#252A3A" stroke-width="1"/>
    <rect x="240" y="556" width="720" height="80" rx="12" fill="#151820" stroke="#252A3A" stroke-width="1"/>
  </svg>
</template>
<div id="root"></div>

<script type="text/babel" src="design-canvas.jsx"></script>
<script type="text/babel" src="tweaks-panel.jsx"></script>
<script type="text/babel" src="shared-data.jsx"></script>
<script type="text/babel" src="shared-components.jsx"></script>
<script type="text/babel" src="direction-1-refined.jsx"></script>
<script type="text/babel" src="direction-2-editorial.jsx"></script>
<script type="text/babel" src="direction-3-dense.jsx"></script>

<script type="text/babel" data-presets="react">
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme_d1": "dark",
  "theme_d2": "light",
  "theme_d3": "dark"
}/*EDITMODE-END*/;

function App() {
  const [tw, setTw] = useTweaks(TWEAK_DEFAULTS);

  // Artboard dimensions — wide enough to see the sidebar + main layout
  const AB_W = 1440;
  const AB_H = 1040;

  const abHostStyle = { width: AB_W, height: AB_H, overflow: 'auto', background: '#fff' };

  return (
    <>
      <DesignCanvas>
        <DCSection id="home" title="Legal Tracker — Home redesign" subtitle="3 direcciones visuales · sidebar-based IA · insights reales">

          <DCArtboard id="d1" label="① Refined Rappi — dark + rojo, aireado, insights con contexto" width={AB_W} height={AB_H}>
            <div className="ab-host" style={abHostStyle}>
              <D1Shell theme={tw.theme_d1}/>
            </div>
          </DCArtboard>

          <DCArtboard id="d2" label="② Editorial calmo — tipografía con carácter, insights narrativos" width={AB_W} height={AB_H}>
            <div className="ab-host" style={abHostStyle}>
              <D2Shell theme={tw.theme_d2}/>
            </div>
          </DCArtboard>

          <DCArtboard id="d3" label="③ Data-dense pro — estilo Linear/Height, keyboard-first" width={AB_W} height={AB_H}>
            <div className="ab-host" style={abHostStyle}>
              <D3Shell theme={tw.theme_d3}/>
            </div>
          </DCArtboard>

        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Tema por dirección">
          <TweakRadio label="① Refined Rappi" value={tw.theme_d1} onChange={v=>setTw({theme_d1:v})}
            options={[{label:'Dark',value:'dark'},{label:'Light',value:'light'}]}/>
          <TweakRadio label="② Editorial" value={tw.theme_d2} onChange={v=>setTw({theme_d2:v})}
            options={[{label:'Dark',value:'dark'},{label:'Light',value:'light'}]}/>
          <TweakRadio label="③ Data-dense" value={tw.theme_d3} onChange={v=>setTw({theme_d3:v})}
            options={[{label:'Dark',value:'dark'},{label:'Light',value:'light'}]}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
</script>
</body>
</html>
