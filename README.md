<p align="center">
  <img src="assets/icon-256.png" width="160" height="160" alt="Vapormint" />
</p>

<h1 align="center">Vapormint</h1>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#the-brain">The Brain</a> ·
  <a href="#shortcuts">Shortcuts</a> ·
  <a href="#build-from-source">Build</a> ·
  <a href="#releases">Releases</a>
</p>

<p align="center">
  <b>Cross-platform desktop video sifting &amp; VapourSynth processing studio.</b><br/>
  Open a clip, watch the pixels decide the recipe, export an honest master.
</p>

---

## What it is

Vapormint is a darkroom for video. You point it at footage — a concert TS, a WEB-DL episode, a 4K facecam, a soft 720p upload — and it:

1. **Looks at the actual pixels**, not just the container tags, and tells you what's really there: interlacing, telecine cadence, noise, banding, HDR, softness.
2. **Writes an evidence-based recipe** back into the clip — conservative by design, the way the community's own tutorials say to do it.
3. **Renders it through a bundled VapourSynth runtime** so you can export without installing a single external tool.

No Python to set up. No FFmpeg to install. No plugin hunt. Everything ships inside the installer.

---

## Install

### Windows

1. Download **`VapormintSetup.exe`** from the [latest release](#releases).
2. If Windows SmartScreen warns ("Windows protected your PC"), click **More info** → **Run anyway**. The build is unsigned — that's why.
3. That's it. Python 3.12, FFmpeg, FFprobe, and the VapourSynth core + plugins are all bundled.

<details>
<summary><b>macOS — porting notes (in progress)</b></summary>

Vapormint is cross-platform by design (Electron + a bundled Python/VapourSynth runtime), but the macOS build lags the Windows build. See [`MAC_PORT_INSTRUCTIONS.md`](MAC_PORT_INSTRUCTIONS.md) for the ordered edit list to bring the 2.0 feature set (fonts, CSP, auto-updater, self-tune, source guidance, feedback, diagnostics) onto the Mac build.
</details>

### System requirements (Windows)

- Windows 10 / 11, x64
- ~2 GB free disk (the app + bundled runtime)
- A GPU is **not** required; rendering is CPU-based

---

## Features

### 🎛 Self-Tune (auto-preview)
Open a clip and Vapormint renders a 1-second preview from the current recipe, measures the pixels, and writes evidence-based fixes back into the recipe — automatically. Expand **"Why these settings?"** to see exactly what the analysis found: interlacing evidence, noise level, banding detection, sharpening rationale. **Re-tune** re-runs the analysis whenever you change something by hand.

### 📋 Source Guidance
Plain-language verdicts you can actually act on:
- *"Interlacing confirmed — deinterlacing is enabled."*
- *"Progressive (normal) footage — no deinterlacing needed."*
- *"Cadence not yet confirmed by sampling — self-tune will check the rendered preview for interlacing."*

Plus a **"What to look for"** checklist and a **Video stats** panel with every measured value.

### 🎬 Cinematic Darkroom UI
- **Space Grotesk** (300–600) for all text, **Space Mono** for technical labels & timestamps.
- Near-black canvas (`#080808`) with a single warm **celluloid cream** accent (`#ece4b4`).
- Zero border-radius, zero box-shadows, zero gradients. Depth from value contrast and 1px hairlines.
- A full **light theme**: warm paper (`#f5f2ec`) with a deep gold accent.
- Every color is a CSS custom property — nothing hardcoded.

### 🔄 Batch export queue
Mark multiple clips and render them all in one pass, sequentially, with per-clip progress and a live progress bar in the queue panel. Cancellable mid-batch.

### 📄 Render receipts
Every export writes an **auditable receipt** — the exact recipe, source measurements, engine, output paths, and the generated `.vpy` script — so you can reproduce any master, forever.

### 🚧 Honest pixel callouts
When the container says one thing and the pixels say another (e.g. "tagged progressive but combing detected"), Vapormint tells you in plain language instead of silently picking a side.

### 🔁 Auto-updater, feedback & diagnostics
- **Check for updates** from Settings.
- **Report a bug / suggest a feature** from Settings (saved locally as JSON).
- Every console line and every export/preview-tune failure logged to `diagnostics.log` in the app data folder.

---

<p align="center">
  <img src="docs/ui-review-home-dark-0.3.18-fixes.png" width="900" alt="Vapormint — home, dark theme" />
</p>

---

## The Brain

Every recipe suggestion comes from a measurement pipeline, not a preset. The rules below are distilled from **13 community VapourSynth giffing tutorials** (full provenance in [`docs/methodology.md`](docs/methodology.md)). The one thing all 13 agree on is the **order**:

```
Crop → Deinterlace → Debilinear → Denoise → Sharpen → Crop
         (if interlaced)  (if soft)  (grain first, never after sharpen)
```

| Source condition | Deinterlace | Debilinear | Denoise | Sharpen | Why |
|---|---|---|---|---|---|
| Interlaced TS/TP | **QTGMC Slow** | off | light | FineSharp 0.3–0.5 | "TS/TP must be deinterlaced before you clip it." |
| Telecine 3:2 / 2:2 | **QTGMC Quality** | off | light | FineSharp | Max motion fidelity for 24→30 pull-down. |
| Soft / low-res | off (prog) | **on** | moderate | VCFreq 0.3–0.4 | Debilinear makes upscaled footage sit soft, not outlined. |
| Clean 1080p WEB-DL | off | off | off/light | none | Good masters need almost nothing. Over-processing is the failure mode. |
| Noisy (low bitrate) | per scanType | off | **strong** | after denoise | Grain goes before any sharpening. |
| Banding (gradients, HDR) | per scanType | off | off | off + **deband** | Luma banding → deband, not denoise. |

**The golden rule** (from the tutorials, enforced by the brain): *never sharpen before you denoise, and never auto-max anything.* The brain gives a safe **starting** recipe; your eyes make the final call.

---

## Shortcuts

| Key | Action |
|-----|--------|
| `I` / `O` | Mark In / Out |
| `Enter` | Queue the marked clip |
| `Space` | Play / Pause |
| `←` / `→` | Step one frame (hold `Shift` for one second) |

---

## Build from source

Requires Node.js (the build tested on Node 24) and npm.

```bash
git clone https://github.com/hxxliz/lqs-floor-rev-2.git
cd lqs-floor-rev-2
npm install
npm run check        # domain + sidebar self-tests
npm run typecheck    # tsc --noEmit
npm run make         # produce VapormintSetup.exe (Windows) + packaged app
```

The finished installer lands in `out/make/squirrel.windows/x64/VapormintSetup.exe`.

> **Line endings:** the repo enforces LF via `.gitattributes` (`* text=auto eol=lf`). The self-tests assert on multi-line source strings, so keep the sources LF — a CRLF checkout will break them.

---

## Releases

Releases live on [GitHub](https://github.com/hxxliz/lqs-floor-rev-2/releases). Each release attaches:

| Asset | What it is |
|-------|-----------|
| `VapormintSetup.exe` | Windows installer (Squirrel). Run it, that's the whole install. |
| `Vapormint-<version>-full.nupkg` | The full Squirrel package (what the in-app updater consumes). |

The in-app **Check for updates** reads the Squirrel `RELEASES` metadata from the release you installed from, so updating is "download the next `VapormintSetup.exe` and run it" — your settings, projects, and completed exports are preserved across updates.

### Current version

**2.0.0** — the "cinematic darkroom" redesign: Self-Tune, Source Guidance, Darkroom UI, batch export queue, render receipts, honest pixel callouts, auto-updater, feedback, and diagnostics.

---

## What's in the box

The installer bundles the whole toolchain, so you never touch a terminal:

- **Python 3.12** (Windows x64, embedded layout)
- **FFmpeg + FFprobe** (decode, frame sampling, export)
- **VapourSynth** core + the plugins the recipes use (QTGMC, KNLMeansCL, Finesharp, VCFreq, deband, descale, …)
- The **Vapormint** app itself (Electron + React)

---

## Project layout

| Path | Purpose |
|------|---------|
| `src/shared.ts` | Recipe model, the "brain" (evidence → recipe), receipts, self-tune |
| `src/media.ts` | Decode, sampling, export orchestration against the bundled runtime |
| `src/main.ts` | Electron main: window, IPC, updater, feedback, diagnostics |
| `src/App.tsx` | The UI (darkroom) |
| `src/styles.css` | The design system (all colors are custom properties) |
| `runtime/win32-x64/` | Bundled Python + FFmpeg + VapourSynth |
| `scripts/cf_analysis.py` | The pixel-analysis "brain" the recipes are derived from |
| `docs/methodology.md` | The 13-tutorial → settings table, with provenance |
| `docs/source-guidance-research.md` | How the source-guidance verdicts are decided |

---

## Changelog

### 2.0.0
- Self-Tune auto-preview with evidence-based recipe write-back
- Source Guidance: plain-language verdicts, checklists, video stats
- Cinematic Darkroom UI (Space Grotesk / Space Mono, celluloid cream, light theme)
- Batch export queue with per-clip progress + live progress bar
- Render receipts (auditable export records)
- Honest pixel callouts (tag-vs-pixel reconciliation)
- Auto-updater, feedback reports, `diagnostics.log`
- Bug fixes: `brainPaths()` asar handling, `exportClip`/`previewTune` exportRoot fallback, squirrel startup guard, full rebrand to Vapormint

<details>
<summary><b>0.3.x (LQ's Cutting Floor)</b></summary>

- 0.3.24 — YouTube bot-check recovery, browser-cookie downloads, Windows update helper, distributed source analysis
- 0.3.23 — Distributed source analysis + confidence-based guidance; new clips start with no auto-cleanup
</details>

---

<p align="center"><sub>
Vapormint — <i>the darkroom for video.</i><br/>
Open source. Bundled runtime. Honest pixels.
</sub></p>
