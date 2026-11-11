# Theme

## Compact token summary

- Framework: React 19 renderer in Electron Forge/Vite; vanilla CSS.
- Typography: Segoe UI Variable / Segoe UI; Cascadia Mono / Consolas for technical values.
- Dark: ink #f7f5f2, base #050505, surface #0d0e11, panel #121318, cyan #06b6d4, pink #ec4899.
- Light: ink #182238, base #f6f8fc, surface #eef2f8, panel #ffffff, blue #3568f4, violet #9a72e8.
- Radius: 6–12px; thin low-contrast borders; cyan-to-pink or blue-to-violet active states.
- Breakpoints: 1250px homepage stack, 1150px shell compression, 1050px compact headers, 700px compact task card.
- Motion: short transitions and spinner; honors prefers-reduced-motion.

## Full stylesheet

```css
:root {
  color: #f7f5f2;
  background: #050505;
  font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  --ink: #f7f5f2;
  --muted: #a29ea7;
  --quiet: #706c75;
  --line: rgba(255, 255, 255, .10);
  --line-strong: rgba(255, 255, 255, .18);
  --surface: #0d0e11;
  --panel: #121318;
  --panel-2: #1a1c22;
  --acid: #06b6d4;
  --acid-dim: rgba(6, 182, 212, .45);
  --magenta: #ec4899;
  --reviewed: #79d6a3;
  --warning: #f3b766;
  --destructive: #ff6b6b;
}

* { box-sizing: border-box; }
html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
button, input, select { font: inherit; }
button { color: inherit; }
button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--acid); outline-offset: 2px; box-shadow: 0 0 0 4px #ec48994d; }

.app-shell { height: 100%; display: grid; grid-template: 42px 1fr / 214px 1fr; background: radial-gradient(circle at 70% 18%, #121318 0, #08090a 42%, #050505 100%); }
.titlebar { grid-column: 1 / -1; display: flex; align-items: center; border-bottom: 1px solid var(--line); -webkit-app-region: drag; padding: 0 150px 0 16px; }
.wordmark { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 800; letter-spacing: .1em; }
.wordmark .mark { display: grid; place-items: center; width: 27px; height: 27px; color: #050505; background: linear-gradient(135deg, var(--acid), var(--magenta)); letter-spacing: -.08em; }
.wordmark small { color: var(--muted); font-size: 9px; font-weight: 600; }
.project-name { margin-left: auto; font-size: 11px; color: #aeb2ae; letter-spacing: .08em; }
.status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--reviewed); box-shadow: 0 0 9px #79d6a388; margin-right: 8px; }

.sidebar { border-right: 1px solid var(--line); display: flex; flex-direction: column; background: #0d0f10cc; }
.sidebar nav { padding: 16px 10px; display: grid; gap: 6px; }
.sidebar nav button { border: 0; background: transparent; color: #8e9490; padding: 13px 12px; text-align: left; letter-spacing: .09em; font-size: 11px; font-weight: 750; cursor: pointer; }
.sidebar nav button span { display: inline-grid; width: 24px; font-size: 16px; }
.sidebar nav button:hover { color: var(--ink); background: #171a1b; }
.sidebar nav button.active { color: var(--acid); background: #1a1e1c; border-left: 2px solid var(--acid); }
.runtime-card { margin: auto 13px 16px; border: 1px solid var(--line); padding: 12px; }
.runtime-card p, .sidebar-foot { color: #686d69; font-size: 8px; letter-spacing: .14em; font-weight: 800; }
.tool-row { display: grid; grid-template-columns: 9px 1fr auto; align-items: center; gap: 6px; font-size: 9px; margin-top: 9px; color: #a4a9a5; }
.tool-row > span { width: 5px; height: 5px; border-radius: 50%; }
.tool-row .ok { background: var(--acid); }.tool-row .missing { background: #d26152; }
.tool-row b { font-size: 7px; color: #676c68; }
.sidebar-foot { padding: 14px; line-height: 2; border-top: 1px solid var(--line); }
.sidebar-foot b { color: var(--acid); }

main { min-width: 0; min-height: 0; }
.page { height: 100%; overflow: auto; padding: 52px 56px; }
.eyebrow { color: var(--acid); font-size: 9px; font-weight: 800; letter-spacing: .17em; }
h1, h2, h3, p { margin-top: 0; }
h1, h2, h3, .primary, .ghost { letter-spacing: .04em; }
.hero-row { display: flex; justify-content: space-between; align-items: end; margin-top: 18px; }
.hero-row h1 { font-size: clamp(42px, 5vw, 78px); line-height: .9; margin-bottom: 20px; letter-spacing: -.05em; max-width: 750px; }
.hero-row p { max-width: 650px; color: var(--muted); font-size: 14px; line-height: 1.7; }
.primary, .ghost { border: 1px solid var(--acid); padding: 13px 18px; font-size: 10px; font-weight: 800; cursor: pointer; }
.primary { border: 0; background: linear-gradient(90deg, var(--acid), var(--magenta)); color: #050505; }.primary:hover { filter: brightness(1.12); box-shadow: 0 0 20px #06b6d433; }
.ghost { background: transparent; color: var(--ink); border-color: var(--line-strong); }.ghost:hover { background: #ffffff0b; border-color: var(--acid-dim); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--line); margin: 48px 0; }
.stats div { padding: 21px 24px; border-right: 1px solid var(--line); display: flex; align-items: baseline; gap: 12px; }.stats div:last-child { border: 0; }
.stats strong { color: var(--acid); font-size: 32px; }.stats span { color: var(--muted); font-size: 9px; letter-spacing: .14em; font-weight: 800; }
.section-head { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
.section-head h2 { font-size: 12px; letter-spacing: .12em; }.section-head span { color: #696e6b; font-size: 8px; letter-spacing: .12em; }
.source-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.source-card { background: var(--panel); border: 1px solid var(--line); padding: 0; text-align: left; cursor: pointer; }
.source-card:hover { border-color: var(--acid-dim); transform: translateY(-1px); }
.source-frame { aspect-ratio: 16/9; display: flex; align-items: end; justify-content: space-between; padding: 10px; background: repeating-linear-gradient(135deg, #15191a, #15191a 8px, #121516 8px, #121516 16px); color: #777d79; font-size: 8px; }
.source-frame b { color: var(--acid); }.source-card h3 { font-size: 12px; margin: 14px 14px 6px; }.source-card p { color: var(--muted); font-size: 9px; margin: 0 14px 15px; }
.empty-card { min-height: 220px; display: grid; place-content: center; text-align: center; }.empty-card > b { color: var(--acid); font-size: 36px; }

.find-page { height: 100%; display: grid; grid-template-rows: 68px 1fr 30px; }
.source-strip { display: flex; align-items: center; gap: 25px; padding: 0 22px; border-bottom: 1px solid var(--line); background: #0e1112; }
.source-strip > div:first-child { display: grid; gap: 5px; }.source-strip select { background: transparent; border: 0; color: var(--ink); font-size: 13px; font-weight: 700; min-width: 250px; }.source-strip option { background: #151819; }
.source-meta { margin-left: auto; display: flex; gap: 18px; color: #777d79; font-size: 9px; letter-spacing: .08em; }.source-meta b { color: var(--acid); }
.source-strip .ghost { padding: 9px 12px; }
.workbench { min-height: 0; display: flex; }
.viewer-panel { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: stretch; padding: 20px 24px 12px; }
.video-wrap { min-height: 0; flex: 1; background: #020303; position: relative; display: grid; place-items: center; border: 1px solid #222625; overflow: hidden; }
.video-wrap video { width: 100%; height: 100%; object-fit: contain; }.frame-corners { position: absolute; inset: 9px; border: 1px solid #b9e43d22; pointer-events: none; }
.timeline { padding: 14px 0 8px; }.timeline input { width: 100%; accent-color: var(--acid); }.time-row { display: flex; justify-content: space-between; color: #777d79; font-size: 9px; }.time-row b { color: var(--ink); font-variant-numeric: tabular-nums; }
.transport { display: flex; align-items: center; justify-content: center; gap: 7px; }.transport > button, .speed button { background: var(--panel-2); border: 1px solid var(--line); height: 31px; color: #a2a7a3; font-size: 8px; cursor: pointer; }.transport > button { padding: 0 11px; }.transport .play { width: 43px; color: var(--acid); }
.speed { display: flex; margin-left: 12px; }.speed button { width: 32px; }.speed button.active { color: #0b0d0e; background: var(--acid); }
.mark-controls { display: grid; grid-template-columns: 1fr 1fr 1.35fr; gap: 8px; margin-top: 12px; }
.mark-controls button { min-height: 56px; background: #111516; border: 1px solid var(--line); display: flex; align-items: center; gap: 11px; padding: 8px 12px; cursor: pointer; text-align: left; }.mark-controls button:hover { border-color: var(--acid-dim); }
kbd { border: 1px solid #4a504c; color: var(--acid); background: #191d1b; min-width: 25px; padding: 4px 6px; font: 700 9px Consolas, monospace; text-align: center; box-shadow: inset 0 -2px #090b0a; }
.mark-controls span { font-size: 8px; color: #8c928e; letter-spacing: .1em; }.mark-controls strong { display: block; color: var(--ink); margin-top: 5px; font: 11px Consolas, monospace; letter-spacing: 0; }
.mark-controls .enter-clip { justify-content: center; background: var(--acid); color: #0b0d0e; border-color: var(--acid); font-weight: 900; font-size: 11px; letter-spacing: .08em; }.enter-clip kbd { color: #0b0d0e; background: #a5ce32; border-color: #78951f; box-shadow: none; }
.shortcut-line { color: #5f6561; text-align: center; font-size: 7px; letter-spacing: .09em; margin-top: 10px; }.shortcut-line kbd { padding: 1px 4px; margin-left: 9px; color: #919792; }
.clip-queue { flex: 0 0 310px; border-left: 1px solid var(--line); background: #0e1112; min-width: 0; transition: flex-basis .16s ease; }.clip-queue.collapsed { flex-basis: 48px; }
.queue-head { width: 100%; min-height: 56px; border: 0; border-bottom: 1px solid var(--line); background: transparent; display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 11px 15px; cursor: pointer; }.queue-head b, .queue-head small { display: block; }.queue-head b { font-size: 9px; letter-spacing: .12em; }.queue-head small { color: var(--acid); font-size: 7px; margin-top: 5px; }.queue-head i { color: var(--acid); font-style: normal; font-size: 18px; }.collapsed .queue-head { height: 100%; writing-mode: vertical-rl; padding: 14px 10px; justify-content: flex-start; gap: 18px; }.collapsed .queue-head small { display: none; }
.queue-body { padding: 9px; overflow: auto; max-height: calc(100vh - 196px); }.queue-item { display: flex; align-items: center; border: 1px solid var(--line); background: #131617; margin-bottom: 7px; }.queue-open { min-width: 0; flex: 1; display: flex; gap: 10px; align-items: center; background: transparent; border: 0; padding: 11px; text-align: left; cursor: pointer; }.queue-open > span { color: var(--acid); font: 10px Consolas, monospace; }.queue-open div { min-width: 0; }.queue-open b, .queue-open small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.queue-open b { font-size: 9px; }.queue-open small { color: #777d79; font: 8px Consolas, monospace; margin-top: 4px; }.remove { border: 0; background: transparent; color: #636865; cursor: pointer; font-size: 16px; }.remove:hover { color: #e47b69; }.queue-empty { color: #666c68; font-size: 10px; line-height: 1.6; text-align: center; padding: 30px 10px; }
.statusbar { display: flex; align-items: center; padding: 0 12px; border-top: 1px solid var(--line); color: #777d79; background: #0d0f10; font-size: 8px; letter-spacing: .06em; }.statusbar b { margin-left: auto; color: #626763; font-weight: 500; }

.process-page { height: 100%; display: grid; grid-template-columns: 230px 1fr; }
.process-list { min-height: 0; border-right: 1px solid var(--line); padding: 22px 12px; overflow: auto; background: #0e1112; }.process-list .section-head { padding: 0 7px; }.process-list > button { width: 100%; border: 1px solid transparent; border-bottom-color: var(--line); background: transparent; display: flex; gap: 12px; padding: 13px 9px; text-align: left; cursor: pointer; }.process-list > button:disabled, .reorder button:disabled { opacity: .55; cursor: default; }.process-list > button.active { border-color: var(--acid-dim); background: #171b19; }.process-list > button > span { color: var(--acid); font: 10px Consolas, monospace; }.process-list b, .process-list small { display: block; }.process-list b { font-size: 10px; }.process-list small { color: #707672; font-size: 8px; margin-top: 5px; }
.recipe-panel { overflow: auto; padding: 24px clamp(20px, 3vw, 44px); }.recipe-title { display: flex; justify-content: space-between; align-items: end; border-bottom: 1px solid var(--line); padding-bottom: 16px; }.recipe-title h1 { font-size: 31px; margin: 8px 0 0; }.reorder button { border: 1px solid var(--line); background: var(--panel); padding: 9px 12px; font-size: 8px; cursor: pointer; }.reorder button:hover { border-color: var(--acid-dim); }
.crop-editor { display: flex; flex-direction: column; gap: 18px; margin: 18px 0 8px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }.preview-column { width: 100%; }
.crop-preview { position: relative; background: #020303; overflow: hidden; display: grid; place-items: center; width: 100%; max-height: 68vh; min-height: 360px; border: 1px solid #252a27; }.crop-preview video { width: 100%; height: 100%; object-fit: fill; }.crop-mask { position: absolute; border: 2px solid var(--acid); box-shadow: 0 0 0 9999px #050706aa, inset 0 0 0 1px #0b0d0d; pointer-events: none; }
.crop-handle { position: absolute; width: 13px; height: 13px; padding: 0; border: 2px solid #0a0c0b; background: var(--acid); pointer-events: auto; touch-action: none; }.crop-handle.nw { left: -7px; top: -7px; cursor: nwse-resize; }.crop-handle.n { left: calc(50% - 6px); top: -7px; cursor: ns-resize; }.crop-handle.ne { right: -7px; top: -7px; cursor: nesw-resize; }.crop-handle.e { right: -7px; top: calc(50% - 6px); cursor: ew-resize; }.crop-handle.se { right: -7px; bottom: -7px; cursor: nwse-resize; }.crop-handle.s { left: calc(50% - 6px); bottom: -7px; cursor: ns-resize; }.crop-handle.sw { left: -7px; bottom: -7px; cursor: nesw-resize; }.crop-handle.w { left: -7px; top: calc(50% - 6px); cursor: ew-resize; }
.crop-controls { min-width: 0; display: grid; grid-template-columns: minmax(220px, .75fr) minmax(360px, 1.25fr); gap: 12px 24px; }.crop-controls .section-head { grid-column: 1 / -1; margin-bottom: 2px; }.crop-controls .info-tip { grid-column: 1 / -1; }.crop-sliders { display: grid; gap: 9px; margin-top: 0; }.crop-sliders label { display: grid; grid-template-columns: 88px 1fr; align-items: center; color: #777d79; font-size: 8px; }.crop-sliders input { width: 100%; accent-color: var(--acid); }
.number-pair { display: flex; align-items: end; gap: 8px; }.number-pair .ghost { padding: 9px 11px; }.number-input { display: grid; gap: 6px; flex: 1; }.number-input span { color: #777d79; font-size: 7px; font-weight: 800; letter-spacing: .1em; }.number-input input { width: 100%; min-width: 0; background: var(--panel); color: var(--ink); border: 1px solid var(--line); padding: 9px; }
.text-button { border: 0; background: transparent; color: var(--acid); font-size: 8px; font-weight: 800; letter-spacing: .1em; margin-top: 13px; padding: 0; cursor: pointer; }
.recipe-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px 24px; margin-top: 26px; }.field { display: grid; gap: 8px; }.field > span { color: #7c827e; font-size: 8px; font-weight: 800; letter-spacing: .13em; }.field select { width: 100%; background: var(--panel); color: var(--ink); border: 1px solid var(--line); padding: 11px; font-size: 10px; }.field input[type="range"] { width: 100%; accent-color: var(--acid); }
.toggle-row { display: flex; flex-wrap: wrap; gap: 9px; margin: 25px 0; }.toggle-row label { border: 1px solid var(--line); padding: 9px 11px; color: #979c98; font-size: 8px; font-weight: 800; letter-spacing: .08em; }.toggle-row input { accent-color: var(--acid); margin-right: 8px; }
.pipeline-card { border: 1px solid var(--line); border-left: 2px solid var(--acid); background: #111514; padding: 15px; }.pipeline-card span { display: block; color: var(--acid); font-size: 8px; font-weight: 800; letter-spacing: .13em; margin-bottom: 8px; }.pipeline-card code { color: #8b918d; font-size: 10px; }
.frame-options { display: grid; grid-template-columns: 1fr 180px; gap: 18px; margin: 0 0 20px; padding: 14px; border: 1px solid var(--line); background: #101314; }.compatibility-note { margin-top: 14px; padding: 13px; border: 1px solid #ad6e28; color: #b7aaa0; font-size: 9px; line-height: 1.5; }.compatibility-note b { display: block; color: #e49a3b; letter-spacing: .12em; margin-bottom: 5px; }
.analysis-guide, .export-location { display: flex; align-items: center; gap: 16px; padding: 13px 15px; border: 1px solid var(--line); background: #101314; }.analysis-guide > div, .export-location > div { min-width: 0; flex: 1; }.analysis-guide span, .export-location span { display: block; color: var(--acid); font-size: 7px; font-weight: 800; letter-spacing: .12em; }.analysis-guide b, .analysis-guide small, .export-location b { display: block; margin-top: 6px; }.analysis-guide b { font-size: 10px; }.analysis-guide small { color: var(--muted); font-size: 8px; }.export-location { margin-top: 18px; }.export-location b { overflow: hidden; color: #a5aaa6; font: 9px Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
.info-tip { margin: 10px 0 0; padding: 11px 13px; border-left: 2px solid #596331; background: #111413; color: #858b87; font-size: 8px; line-height: 1.6; }.info-tip > span { color: var(--acid); margin-right: 7px; }.info-tip b { color: #aeb3ae; letter-spacing: .08em; }.tip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }.tip-grid .info-tip { height: 100%; }
.export-progress { margin-top: 12px; padding: 14px; border: 1px solid var(--line); background: #0d1010; display: grid; grid-template-columns: 1fr auto; gap: 8px 16px; }.export-progress.active { border-color: var(--acid-dim); box-shadow: inset 0 0 24px #b9e43d0a; }.progress-copy span, .progress-copy b, .progress-copy small { display: block; }.progress-copy span { color: var(--acid); font-size: 7px; font-weight: 800; letter-spacing: .14em; }.progress-copy b { margin-top: 5px; font-size: 10px; }.progress-copy small { margin-top: 4px; color: var(--muted); font: 8px Consolas, monospace; }.export-progress > strong { align-self: center; color: var(--acid); font: 18px Consolas, monospace; }.progress-track { grid-column: 1 / -1; height: 5px; overflow: hidden; background: #242826; }.progress-track i { display: block; height: 100%; background: var(--acid); transition: width .25s linear; }.export-progress.active .progress-track i { box-shadow: 0 0 12px var(--acid); }
.export-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }.export-row > div { margin-right: auto; color: #818783; font-size: 9px; }.export-row button { padding: 12px 18px; }.export-row button:disabled, .export-location button:disabled { opacity: .45; cursor: default; }.status-dot.working { animation: work-pulse 1s infinite alternate; }@keyframes work-pulse { to { box-shadow: 0 0 10px var(--acid); opacity: .5; } }
.empty-page, .loading { width: 100%; height: 100%; display: grid; place-content: center; justify-items: center; text-align: center; }.empty-page h1 { font-size: 32px; }.empty-page p { color: var(--muted); }.empty-symbol { color: var(--acid); font-size: 62px; }.loading { color: var(--acid); letter-spacing: .12em; font-size: 10px; }
.loading::before { content: ''; width: 24px; height: 24px; margin: 0 auto 14px; border: 2px solid var(--line-strong); border-top-color: var(--acid); border-radius: 50%; animation: loading-spin .8s linear infinite; }@keyframes loading-spin { to { transform: rotate(360deg); } }

.hero-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; max-width: 420px; }.download-row, .location-row { display: flex; gap: 9px; }.download-row { margin: 22px 0 36px; }.download-row input, .location-row input { flex: 1; min-width: 0; color: var(--ink); background: var(--panel); border: 1px solid var(--line); padding: 11px 13px; }.download-row button:disabled { opacity: .4; cursor: default; }
.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; margin-bottom: 30px; }.project-card { min-width: 0; display: flex; align-items: center; gap: 12px; text-align: left; padding: 9px; background: var(--panel); border: 1px solid var(--line); cursor: pointer; }.project-card.active { border-color: var(--acid-dim); }.project-card > img, .project-card > span { width: 78px; height: 44px; object-fit: cover; display: grid; place-items: center; color: var(--acid); background: #090b0c; }.project-card div { min-width: 0; }.project-card b, .project-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.project-card b { font-size: 10px; }.project-card small { margin-top: 6px; color: var(--muted); font-size: 7px; }
.source-frame { position: relative; overflow: hidden; }.source-frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .55; }.source-frame span, .source-frame b { position: relative; z-index: 1; }.missing-source { color: #d87968; text-align: center; font-size: 11px; }.missing-source small { color: var(--muted); }
.source-strip { position: relative; }.analysis-popover { position: relative; font-size: 8px; }.analysis-popover summary { color: var(--acid); cursor: pointer; letter-spacing: .1em; }.analysis-popover[open] { position: absolute; right: 150px; top: 55px; width: min(480px, 60vw); z-index: 20; padding: 14px; border: 1px solid var(--acid-dim); background: #101314f5; box-shadow: 0 14px 35px #0009; }.analysis-popover b, .analysis-popover span { display: block; margin-bottom: 8px; }.analysis-popover span, .analysis-popover p { color: var(--muted); line-height: 1.5; }.analysis-popover p { margin: 5px 0; }
.queue-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 9px; }.queue-tools select, .queue-tools button { min-width: 0; padding: 7px; color: #8f9591; background: #151819; border: 1px solid var(--line); font-size: 7px; cursor: pointer; }.queue-item.complete { border-left-color: var(--acid); }.queue-state { border: 0; background: transparent; color: var(--acid); cursor: pointer; }
.preview-tabs, .preview-actions { display: flex; gap: 5px; }.preview-tabs button, .preview-actions button { padding: 8px 10px; color: #858b87; background: var(--panel); border: 1px solid var(--line); font-size: 7px; font-weight: 800; cursor: pointer; }.preview-tabs button.active { color: #0b0d0e; background: var(--acid); }.crop-preview img { width: 100%; height: 100%; object-fit: contain; }.preview-actions { align-items: center; margin-top: 8px; }.preview-actions .speed { margin: 0 auto 0 0; }.task-progress { display: block; margin-top: 8px; color: var(--muted); }.crop-drag { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); border: 0; background: transparent; cursor: move; pointer-events: auto; touch-action: none; }
.settings-page { max-width: 960px; }.settings-page h1 { margin: 16px 0 36px; font-size: 52px; }.settings-page > .field { margin-bottom: 22px; }.expert-toggle { display: flex; gap: 12px; align-items: center; padding: 15px; margin: 26px 0; border: 1px solid var(--line); background: var(--panel); }.expert-toggle input { accent-color: var(--acid); }.expert-toggle b, .expert-toggle small, .settings-note span { display: block; }.expert-toggle b { font-size: 10px; }.expert-toggle small, .settings-note span { margin-top: 5px; color: var(--muted); font-size: 8px; }.settings-note { margin-top: 30px; padding: 16px; border-left: 2px solid var(--acid); background: var(--panel); }.settings-note b { color: var(--acid); font-size: 8px; letter-spacing: .1em; }
.theme-toggle { display: inline-flex; gap: 4px; width: fit-content; padding: 4px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel); }.theme-toggle button { min-width: 94px; padding: 10px 16px; border: 0; border-radius: 6px; color: var(--muted); background: transparent; cursor: pointer; font-size: 12px; font-weight: 700; }.theme-toggle button.active { color: var(--ink); background: linear-gradient(135deg, var(--acid), var(--magenta)); }.settings-help { color: var(--muted); font-size: 12px; }

/* Desktop readability and approved Superdesign palette. */
body { font-size: 14px; line-height: 1.45; }
button, input, select { line-height: 1.25; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 8px; }
.sidebar { background: #0d0f12e8; }
.sidebar nav button { color: #a29ea7; font-size: 12px; }
.sidebar nav button, .runtime-card p, .sidebar-foot, .section-head h2, .section-head span, .source-meta, .mark-controls span, .shortcut-line, .queue-head b, .queue-head small, .statusbar, .field > span, .toggle-row label, .pipeline-card span, .analysis-guide span, .export-location span, .progress-copy span { letter-spacing: .055em; }
.sidebar nav button.active { color: var(--ink); background: linear-gradient(90deg, #06b6d41c, #ec48990b); border-left-color: var(--acid); }
.runtime-card p, .sidebar-foot, .section-head span, .source-frame, .queue-head small, .statusbar, .process-list small, .number-input span, .analysis-guide span, .export-location span, .progress-copy span, .project-card small, .queue-tools select, .queue-tools button, .preview-tabs button, .preview-actions button, .expert-toggle small, .settings-note span, .settings-note b { font-size: 11px; }
.tool-row, .source-card p, .source-meta, .time-row, .transport > button, .speed button, .mark-controls span, .shortcut-line, .queue-open small, .crop-sliders label, .text-button, .field > span, .toggle-row label, .pipeline-card span, .analysis-guide small, .info-tip, .progress-copy small, .analysis-popover { font-size: 12px; }
.tool-row b { font-size: 10px; }
.eyebrow, .queue-head b, .queue-open b, .process-list b, .analysis-guide b, .progress-copy b { font-size: 13px; }
.source-card h3, .field select, .number-input input, .location-row input, .download-row input { font-size: 14px; }
.shortcut-line { color: var(--quiet); line-height: 1.7; }
.source-meta, .time-row, .queue-open small, .process-list small, .crop-sliders label, .number-input span, .field > span, .analysis-guide small, .info-tip, .progress-copy small, .project-card small, .analysis-popover { color: var(--muted); }
.source-strip, .clip-queue, .process-list, .statusbar { background: var(--surface); }
.source-card, .queue-item, .pipeline-card, .analysis-guide, .export-location, .expert-toggle, .settings-note { background: var(--panel); }
.tool-row .ok { background: var(--reviewed); }.tool-row .missing { background: var(--destructive); }
.queue-item.complete { border-left-color: var(--reviewed); }.remove:hover { color: var(--destructive); }
.mark-controls .enter-clip, .speed button.active, .preview-tabs button.active { border: 0; background: linear-gradient(90deg, var(--acid), var(--magenta)); color: #050505; }
.enter-clip kbd { color: #050505; background: #f7f5f2aa; border-color: #ffffff66; }
.frame-corners { border-color: #06b6d433; }
.source-card:hover, .process-list > button.active { border-color: var(--acid-dim); }
.process-list > button.active { background: linear-gradient(90deg, #06b6d418, #ec48990a); }
.crop-mask { border-color: var(--acid); box-shadow: 0 0 0 9999px #050505b8, 0 0 16px #06b6d444, inset 0 0 0 1px #ec489966; }
.crop-handle { background: linear-gradient(135deg, var(--acid), var(--magenta)); }
.info-tip { border-left-color: var(--acid); background: var(--surface); }
.compatibility-note { border-color: #f3b76666; color: #c8b9a6; }.compatibility-note b { color: var(--warning); }
.progress-track i { background: linear-gradient(90deg, var(--acid), var(--magenta)); }
.export-progress.active { box-shadow: inset 0 0 24px #06b6d40e; }
.status-dot.working { background: var(--warning); }
.primary, .ghost, .field select, .number-input input, .location-row input, .download-row input, .queue-item, .source-card, .analysis-guide, .export-location, .info-tip { border-radius: 7px; }
.titlebar { background: #08090a; }
.wordmark small, .stats span, kbd, .mark-controls strong, .queue-open > span, .reorder button, .pipeline-card code, .compatibility-note, .export-row > div, .task-progress { font-size: 11px; }
.tool-row b { font-size: 11px; }
.project-card b { font-size: 13px; }
.analysis-popover[open] { background: #121318f5; }
kbd, .mark-controls strong, .queue-open > span, .queue-open small, .process-list > button > span, .pipeline-card code, .progress-copy small, .export-progress > strong, .export-location b { font-family: "Cascadia Mono", "JetBrains Mono", Consolas, monospace; }

@media (max-width: 1150px) {
  .app-shell { grid-template-columns: 170px 1fr; }
  .clip-queue { flex-basis: 260px; }
  .source-meta { display: none; }
  .page { padding: 38px 32px; }
  .crop-controls { grid-template-columns: 1fr; }.crop-controls .section-head, .crop-controls .info-tip { grid-column: auto; }.tip-grid { grid-template-columns: 1fr; }
}

@media (max-height: 700px) {
  .page { padding-top: 24px; padding-bottom: 24px; }
  .viewer-panel { padding: 12px 20px; }
  .mark-controls { min-height: 88px; }
  .crop-preview { min-height: 280px; }
  .settings-page h1 { margin-bottom: 22px; font-size: 42px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}

/* Homepage hierarchy follows the native studio: start on the left, resume work on the right. */
.page.home-page { padding: 0; overflow: hidden; display: grid; grid-template-columns: minmax(390px, .78fr) minmax(0, 1.22fr); }
.home-intro, .home-library { min-width: 0; overflow: auto; padding: clamp(34px, 4vw, 64px); }
.home-intro { display: flex; flex-direction: column; border-right: 1px solid var(--line); background: radial-gradient(circle at 0 100%, #062126 0, #050505 34%); }
.home-intro h1 { max-width: 560px; margin: 26px 0 22px; font-size: clamp(38px, 3.3vw, 54px); line-height: .96; letter-spacing: -.055em; overflow-wrap: anywhere; }
.home-intro > p { max-width: 590px; color: var(--muted); font-size: 15px; line-height: 1.65; }
.home-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
.home-actions button, .home-intro .download-row button { font-size: 12px; }
.home-actions button:disabled, .download-row input:disabled { opacity: .5; cursor: default; }
.download-label { display: block; margin-top: 28px; color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.home-intro .download-row { margin: 9px 0 0; }
.home-intro .download-row input { font-size: 14px; }
.home-hint { margin-top: auto; padding-top: 36px; color: var(--muted); font-size: 12px; }
.recent-head, .active-project-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.recent-head span, .active-project-head > div:first-child > span { color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.recent-head h2, .active-project-head h2 { margin: 6px 0 0; font-size: clamp(24px, 2.3vw, 38px); line-height: 1.05; letter-spacing: -.025em; overflow-wrap: anywhere; }
.home-library .text-button { flex: 0 0 auto; margin: 0 0 4px; font-size: 11px; }
.home-library .project-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 320px)); gap: 14px; margin-bottom: 42px; }
.home-library .project-card { display: block; padding: 0; overflow: hidden; cursor: default; border-radius: 12px; }
.project-open { width: 100%; min-width: 0; padding: 10px; border: 0; background: transparent; text-align: left; cursor: pointer; }
.project-thumb { position: relative; display: grid; width: 100%; aspect-ratio: 16 / 7; overflow: hidden; place-items: center; border-radius: 8px; color: var(--acid); background: #050505; }
.project-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.project-thumb i { font-size: 36px; font-style: normal; }
.project-copy { display: block; min-width: 0; padding: 12px 2px 5px; }
.project-copy b { display: -webkit-box; min-height: 2.6em; overflow: hidden; font-size: 15px; line-height: 1.3; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.project-copy small { display: block; margin-top: 7px; overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.project-actions { display: flex; justify-content: flex-end; gap: 6px; padding: 9px 10px; border-top: 1px solid var(--line); }
.project-actions button { padding: 6px 9px; border: 0; border-radius: 5px; color: var(--muted); background: transparent; font-size: 11px; cursor: pointer; }
.project-actions button:hover { color: var(--ink); background: #ffffff0c; }
.project-actions .danger:hover { color: var(--destructive); background: #ff6b6b12; }
.active-project-head { align-items: center; padding-top: 24px; border-top: 1px solid var(--line); }
.active-project-head > div:first-child { min-width: 0; }
.active-project-head h2 { max-width: 460px; font-size: clamp(20px, 2vw, 30px); }
.compact-stats { flex: 0 0 auto; display: flex; gap: 16px; }
.compact-stats > div { display: grid; justify-items: end; }
.compact-stats strong { color: var(--acid); font-size: 20px; }
.compact-stats span { color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.home-library .source-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); }
.project-name { min-width: 0; max-width: min(42vw, 520px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-card { min-width: 0; overflow: hidden; }
.source-card h3 { display: -webkit-box; min-height: 2.7em; overflow: hidden; line-height: 1.35; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.source-card p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-strip select { min-width: 0; max-width: min(42vw, 460px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.process-list > button div, .recipe-title > div:first-child { min-width: 0; }
.process-list b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recipe-title h1 { font-size: clamp(22px, 3vw, 31px); overflow-wrap: anywhere; }
.global-task { position: fixed; right: 24px; bottom: 24px; z-index: 100; width: min(520px, calc(100vw - 48px)); display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--acid); border-radius: 10px; background: #121318f5; box-shadow: 0 18px 60px #000b, 0 0 28px #06b6d426; backdrop-filter: blur(12px); }
.global-task-spinner { width: 26px; height: 26px; border: 3px solid var(--line-strong); border-top-color: var(--acid); border-right-color: var(--magenta); border-radius: 50%; animation: loading-spin .8s linear infinite; }
.global-task > div { min-width: 0; }
.global-task span, .global-task b, .global-task small { display: block; }
.global-task > div > span { color: var(--acid); font-size: 11px; font-weight: 800; letter-spacing: .1em; }
.global-task b { margin-top: 4px; overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.global-task small { margin-top: 4px; color: var(--muted); font: 12px "Cascadia Mono", Consolas, monospace; }
.global-task > strong { color: var(--acid); font: 700 20px "Cascadia Mono", Consolas, monospace; }
.global-task .ghost { padding: 9px 11px; font-size: 11px; white-space: nowrap; }
.global-task .progress-track { grid-column: 1 / -1; }
.preview-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.preview-heading small { color: var(--muted); font-size: 11px; }
.preview-transport { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.preview-transport .primary { padding: 10px 16px; }
.preview-transport span { color: var(--muted); font-size: 12px; }
.preview-transport kbd { margin-left: 8px; }
.analysis-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.modal-backdrop { position: fixed; inset: 0; z-index: 110; display: grid; place-items: center; padding: 24px; background: #030405cc; backdrop-filter: blur(8px); }
.download-dialog { width: min(620px, 100%); padding: 28px; border: 1px solid var(--acid-dim); border-radius: 12px; background: var(--panel); box-shadow: 0 24px 80px #000d, 0 0 36px #06b6d41f; }
.download-dialog h2 { margin: 8px 0; font-size: 30px; }
.download-dialog > p { margin: 0 0 24px; color: var(--muted); }
.download-dialog .field { margin-top: 18px; }
.download-dialog .location-row input { min-width: 0; text-overflow: ellipsis; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 26px; }

@media (max-width: 1250px) {
  .page.home-page { display: block; overflow: auto; }
  .home-intro, .home-library { overflow: visible; padding: 38px clamp(28px, 5vw, 52px); }
  .home-intro { min-height: 520px; border-right: 0; border-bottom: 1px solid var(--line); }
  .home-hint { margin-top: 32px; padding-top: 0; }
}

@media (max-width: 1050px) {
  .wordmark small { display: none; }
  .recent-head, .active-project-head { align-items: flex-start; flex-direction: column; }
  .compact-stats { width: 100%; justify-content: space-between; }
  .compact-stats > div { justify-items: start; }
  .home-actions button { flex: 1 1 180px; }
}

@media (max-width: 700px) {
  .global-task { right: 12px; bottom: 12px; width: calc(100vw - 24px); grid-template-columns: auto minmax(0, 1fr) auto; }
  .global-task > strong { display: none; }
  .global-task .ghost { grid-column: 2 / -1; justify-self: end; }
}

/* Reference-inspired bright studio mode. */
.theme-light { color: #182238; background: #f6f8fc; --ink: #182238; --muted: #68758f; --quiet: #8a95a8; --line: #dbe2ee; --line-strong: #c5d0e2; --surface: #eef2f8; --panel: #ffffff; --panel-2: #f2f5fa; --acid: #3568f4; --acid-dim: #6e8ff4; --magenta: #9a72e8; --reviewed: #218a62; --warning: #b66a10; --destructive: #c94055; }
.theme-light .app-shell { background: radial-gradient(circle at 75% 0%, #ffffff 0, #f3f6fb 54%, #e9eef8 100%); }
.theme-light .titlebar { background: #ffffff; }
.theme-light .sidebar { background: #eef2f8; }
.theme-light .sidebar nav button.active { color: var(--ink); background: linear-gradient(90deg, #3568f420, #9a72e818); }
.theme-light .home-intro { background: radial-gradient(circle at 0 100%, #dceaff 0, #f8faff 42%, #ffffff 100%); }
.theme-light .source-card, .theme-light .queue-item, .theme-light .pipeline-card, .theme-light .analysis-guide, .theme-light .export-location, .theme-light .expert-toggle, .theme-light .settings-note, .theme-light .project-card { background: var(--panel); }
.theme-light .crop-preview { background: #dfe6f2; border-color: var(--line-strong); }
.theme-light .crop-mask { box-shadow: 0 0 0 9999px #18223844, 0 0 16px #3568f444, inset 0 0 0 1px #9a72e866; }
.theme-light .source-strip, .theme-light .clip-queue, .theme-light .process-list, .theme-light .statusbar { background: var(--surface); }
.theme-light .info-tip { background: #eef3ff; }
.theme-light .global-task { background: #ffffffee; box-shadow: 0 18px 60px #63708b33, 0 0 28px #3568f426; }

```

## Package context

```json
{
  "name": "lqs-cutting-floor",
  "productName": "LQ's Cutting Floor",
  "version": "0.3.6",
  "author": "LQ",
  "description": "Cross-platform desktop video sifting and VapourSynth processing studio.",
  "main": ".vite/build/main.js",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "typecheck": "tsc --noEmit",
    "check": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types src/domain.selftest.mts"
  },
  "devDependencies": {
    "@electron-forge/cli": "latest",
    "@electron-forge/maker-squirrel": "latest",
    "@electron-forge/plugin-vite": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "electron": "latest",
    "typescript": "latest",
    "vite": "latest"
  },
  "dependencies": {
    "react": "latest",
    "react-dom": "latest"
  }
}

```
