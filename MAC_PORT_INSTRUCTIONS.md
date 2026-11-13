# Mac Port Instructions — Vapormint 2.0

Ordered list of edits to port all improvements from the Windows v2.0.0 build
into the macOS version of the app. Apply in sequence.

---

## 1. `index.html` — Fonts + CSP + Title

**Before:**
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' file: data:; media-src 'self' file: blob:; connect-src 'self' ws://localhost:* http://localhost:*; object-src 'none'; base-uri 'self'; form-action 'self'" />
<title>LQ's Cutting Floor</title>
```

**After:**
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' file: data:; media-src 'self' file: blob:; connect-src 'self' ws://localhost:* http://localhost:*; object-src 'none'; base-uri 'self'; form-action 'self'" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<title>Vapormint</title>
```

Changes:
- CSP: added `https://fonts.googleapis.com` to `style-src`, added `font-src https://fonts.gstatic.com`.
- Preconnect hints for both font origins.
- Google Fonts stylesheet: Space Grotesk (300, 400, 500, 600) + Space Mono (400, 700).
- Title: "LQ's Cutting Floor" → "Vapormint".

---

## 2. `package.json` — Product name, version, updater, files

```json
{
  "productName": "Vapormint",
  "version": "2.0.0",
  "files": ["scripts/**/*"],
  "dependencies": {
    "electron-updater": "^6.8.11",
    ...
  }
}
```

- `productName`: "LQ's Cutting Floor" → "Vapormint".
- `version`: bump to "2.0.0".
- Add `"files": ["scripts/**/*"]` so `scripts/cf_analysis.py` is packaged.
- Add `electron-updater` dependency.
- **Mac note:** On macOS, `electron-updater` uses Sparkle (or the built-in
  generic provider) instead of Squirrel. You may need to configure
  `extraMetadata` or a `yml` update feed. Squirrel-specific
  `electron-squirrel-startup` can be removed on Mac (it's a no-op on darwin,
  but the import should be guarded).

---

## 3. `forge.config.ts` — Executable name, extra resources

**Windows (reference):**
```ts
executableName: 'Vapormint',
extraResource: ['./runtime', './scripts'],
makers: [new MakerSquirrel({ name: 'Vapormint', setupExe: 'VapormintSetup.exe', ... })]
```

**Mac target:**
```ts
executableName: 'Vapormint',
extraResource: ['./runtime', './scripts'],
makers: [
  new MakerDmg({
    name: 'Vapormint',
    icon: 'assets/icon.icns',
  }),
  new MakerZIP({}, true),  // for generic auto-update
]
```

- `executableName`: "LQsCuttingFloor" → "Vapormint".
- `extraResource`: add `'./scripts'` alongside `'./runtime'`.
- Replace `MakerSquirrel` with `MakerDmg` + `MakerZIP`.
- `icon`: use `.icns` on Mac instead of `.ico`.
- The `runtime/` folder must contain the macOS Python + FFmpeg + VapourSynth
  binaries (see step 9).

---

## 4. `src/main.ts` — Diagnostics, branding, auto-updater, feedback, export fix

### 4a. Imports
```ts
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { autoUpdater } from 'electron-updater';
import { watch, type FSWatcher, createWriteStream } from 'node:fs';
// ...existing fs/promises, path, url imports...
import { downloadPublicVideo, getRuntimeStatus, prepareSource, probeMedia, processClip, stopMediaProcesses, tunePreview } from './media';
import { buildReceipt, receiptFileName, assertPublicVideoUrl, defaultRecipe, safeFileName, type DownloadBrowser, type ExportRequest, type FeedbackReport, type ProjectCard, type StudioPreferences, type StudioSession, type StudioSource, type UpdateInfo, type WorkspaceState } from './shared';
```

- Add `shell` to the electron import.
- Add `autoUpdater` from `electron-updater`.
- Add `createWriteStream` to the `node:fs` import.
- Add `FeedbackReport`, `UpdateInfo` to the `./shared` type imports.

### 4b. Diagnostics log (add after `if (squirrelStartup) app.quit();`)
```ts
const diagLogPath = path.join(app.getPath('userData'), 'diagnostics.log');
const diagStream = createWriteStream(diagLogPath, { flags: 'a' });
const origLog = console.log.bind(console);
const origErr = console.error.bind(console);
const origWarn = console.warn.bind(console);
console.log = (...args: unknown[]) => { origLog(...args); diagStream.write(new Date().toISOString() + ' [LOG] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n'); };
console.error = (...args: unknown[]) => { origErr(...args); diagStream.write(new Date().toISOString() + ' [ERR] ' + args.map(a => typeof a === 'object' ? (a instanceof Error ? a.stack ?? a.message : JSON.stringify(a)) : String(a)).join(' ') + '\n'); };
console.warn = (...args: unknown[]) => { origWarn(...args); diagStream.write(new Date().toISOString() + ' [WRN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n'); };
```

- On Mac, `app.getPath('userData')` resolves to
  `~/Library/Application Support/Vapormint/`.

### 4c. Branding replacements (search-and-replace throughout main.ts)
| From | To |
|------|----|
| `LQ's Cutting Floor` (in path strings) | `Vapormint` |
| `Untitled Cutting Floor` | `Untitled Vapormint` |
| `Cutting Floor` (in dialog/error strings) | `Vapormint` |

Specific locations:
- `defaultPreferences()`: libraryPath, downloadPath, exportPath folder names.
- `fallbackPreferences()`: root folder name.
- `emptySession()`: default name.
- `normalizeSession()`: fallback name.
- `createProject()`: fallback name.
- `deleteProject()`: dialog message.
- `changeLibrary()`: dialog message.
- `createWindow()`: error strings.
- `process.on('uncaughtException')`: error string.
- `process.on('unhandledRejection')`: error string.
- Final `.catch()`: error string.

### 4d. Export fix in `exportClip()`
```ts
async function exportClip(request: ExportRequest) {
  try { await access(request.source.sourcePath); }
  catch { throw new Error(`The source for ${request.clip.name} moved or was deleted. Relink it before exporting.`); }
  const extension = request.clip.recipe.outputFormat === 'MP4' ? 'mp4' : 'mov';
  const prefs = await loadPreferences();
  const exportRoot = request.exportRoot || prefs.exportPath;
  console.log('[exportClip] exportRoot=', JSON.stringify(exportRoot), 'sourcePath=', JSON.stringify(request.source?.sourcePath), 'projectName=', JSON.stringify(request.projectName));
  const folder = path.join(exportRoot, safeFileName(request.projectName));
  await mkdir(folder, { recursive: true });
  // ...rest unchanged...
}
```

### 4e. Preview-tune fix in IPC handler
```ts
ipcMain.handle('previewTune', async (_event, request: ExportRequest, settings) => {
  const prefs = await loadPreferences();
  const safeRequest = request.exportRoot ? request : { ...request, exportRoot: prefs.exportPath };
  console.log('[previewTune] exportRoot=', JSON.stringify(safeRequest.exportRoot), 'sourcePath=', JSON.stringify(safeRequest.source?.sourcePath));
  try {
    return await tunePreview(safeRequest, settings, new AbortController().signal, (percent, message) => { mainWindow?.webContents.send('previewTuneProgress', { percent, message }); });
  } catch (e) { console.error('[previewTune] FAILED', e); throw e; }
});
```

### 4f. Export IPC handler — add error logging
```ts
ipcMain.handle('export:start', async (_event, request: ExportRequest) => {
  try { return await exportClip(request); }
  catch (e) { console.error('[export:start] FAILED', e); throw e; }
});
```

### 4g. Auto-updater block (add before `createWindow(...)`)
```ts
const sendUpdate = (info: UpdateInfo) => mainWindow?.webContents.send('update:progress', info);
autoUpdater.on('checking-for-update', () => sendUpdate({ status: 'downloading', version: app.getVersion(), message: 'Checking for updates…', percent: 0 }));
autoUpdater.on('update-available', (info) => sendUpdate({ status: 'available', version: info.version, message: `Version ${info.version} is available`, percent: 0 }));
autoUpdater.on('update-not-available', () => sendUpdate({ status: 'current', version: app.getVersion(), message: `You are on the latest version (${app.getVersion()})`, percent: 0 }));
autoUpdater.on('error', () => sendUpdate({ status: 'error', version: app.getVersion(), message: 'Update check failed', percent: 0 }));
autoUpdater.on('download-progress', (p) => sendUpdate({ status: 'downloading', version: app.getVersion(), message: `Downloading update… ${Math.round(p.percent)}%`, percent: p.percent }));
autoUpdater.on('update-downloaded', (info) => sendUpdate({ status: 'downloaded', version: info.version, message: `Version ${info.version} is ready — restart to install`, percent: 100 }));

ipcMain.handle('update:check', async () => {
  try {
    await autoUpdater.checkForUpdatesAndNotify();
    return { status: 'current', version: app.getVersion(), message: 'Checked' };
  } catch (e) {
    return { status: 'error', version: app.getVersion(), message: String(e) };
  }
});
ipcMain.handle('update:apply', () => {
  autoUpdater.quitAndInstall();
});
```

**Mac note:** `electron-updater` on macOS uses the generic provider or
Sparkle. You'll need a `latest-mac.yml` feed or configure
`autoUpdater.setFeedURL()`. The Squirrel `electron-squirrel-startup` import
should be guarded:
```ts
import squirrelStartup from 'electron-squirrel-startup';
if (squirrelStartup && process.platform === 'win32') app.quit();
```

### 4h. Feedback handlers (add after updater block)
```ts
ipcMain.handle('feedback:submit', async (_event, report: FeedbackReport) => {
  try {
    const dir = app.getPath('userData');
    const file = path.join(dir, `feedback-${report.createdAt.replace(/[:.]/g, '-')}.json`);
    await writeFile(file, JSON.stringify(report, null, 2), 'utf8');
    return { ok: true, message: 'Feedback saved. Thank you!' };
  } catch (e) {
    return { ok: false, message: `Could not save feedback: ${String(e)}` };
  }
});
ipcMain.handle('feedback:open', async (_event, url: string) => {
  await shell.openExternal(url);
});
```

---

## 5. `src/preload.ts` — New IPC bridges

Add to the `DesktopApi` type in `shared.ts` (see step 6) and to the `api`
object in `preload.ts`:

```ts
checkForUpdates: () => ipcRenderer.invoke('update:check'),
applyUpdate: () => ipcRenderer.invoke('update:apply'),
onUpdateProgress: (callback) => {
  const listener = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => callback(info);
  ipcRenderer.on('update:progress', listener);
  return () => { ipcRenderer.removeListener('update:progress', listener); };
},
submitFeedback: (report: FeedbackReport) => ipcRenderer.invoke('feedback:submit', report),
openIssue: (url: string) => ipcRenderer.invoke('feedback:open', url),
```

Also add `FeedbackReport` and `UpdateInfo` to the type imports from `./shared`.

---

## 6. `src/shared.ts` — New types + cadence strings

### 6a. New interfaces (append at bottom)
```ts
export interface UpdateInfo {
  status: 'current' | 'available' | 'downloading' | 'downloaded' | 'error';
  version: string;
  message: string;
  percent: number;
}

export interface FeedbackReport {
  kind: 'bug' | 'feature';
  title: string;
  details: string;
  email: string;
  version: string;
  platform: string;
  createdAt: string;
}
```

### 6b. DesktopApi — add 5 methods
```ts
checkForUpdates(): Promise<UpdateInfo>;
applyUpdate(): Promise<void>;
onUpdateProgress(callback: (info: UpdateInfo) => void): () => void;
submitFeedback(report: FeedbackReport): Promise<{ ok: boolean; message: string }>;
openIssue(url: string): Promise<void>;
```

### 6c. Cadence strings in `sourceVerdict()`
Replace the three cadence strings:

| Old | New |
|-----|-----|
| `Interlacing has strong sampled and metadata evidence.` | `Interlacing confirmed — deinterlacing is enabled.` |
| `Progressive cadence has strong sampled and metadata evidence.` | `Progressive (normal) footage — no deinterlacing needed.` |
| `Cadence needs visual confirmation; no repair will be enabled automatically.` | `Cadence not yet confirmed by sampling — self-tune will check the rendered preview for interlacing.` |

---

## 7. `src/media.ts` — brainPaths fix + branding

### 7a. `brainPaths()` — handle asar packaging
```ts
function brainPaths() {
  const candidates = [
    path.join(process.resourcesPath, 'scripts', 'cf_analysis.py'),
    path.join(app.getAppPath(), 'scripts', 'cf_analysis.py'),
  ];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.unshift(path.join(here, '..', 'scripts', 'cf_analysis.py'), path.join(here, 'scripts', 'cf_analysis.py'));
  } catch { /* import.meta.url unavailable — rely on resourcesPath/appPath */ }
  for (const candidate of candidates) { try { if (existsSync(candidate)) return candidate; } catch { /* keep searching */ } }
  return candidates[0];
}
```

### 7b. Branding
- `mkdtemp(path.join(tmpdir(), 'cutting-floor-runtime-'))` → `'vapormint-runtime-'`
- `mkdtemp(path.join(tmpdir(), 'lq-cutting-floor-'))` → `'vapormint-'`
- VapourSynth script header comment: `"# LQ's Cutting Floor — generated VapourSynth recipe"` → `"# Vapormint — generated VapourSynth recipe"`

---

## 8. `src/App.tsx` — UX polish + welcome guide

### 8a. Welcome steps (replace `welcomeSteps` array)
```ts
const welcomeSteps = [
  { eyebrow: 'WELCOME', title: 'The moments worth keeping.', symbol: '◇', body: 'Vapormint is a local video processor. Import a file, a folder, or a link. Your originals are never touched — every edit lives in the project.', note: 'All processing runs locally with the bundled VapourSynth toolchain.' },
  { eyebrow: 'STEP 1 · FIND', title: 'Review, then cut.', symbol: '⌕', body: 'Play the source. Scrub the timeline, step frame by frame, set In and Out points, and add the range to the queue.', note: 'Space play · ← → frame · Shift+← → second · I / O mark · Enter queue' },
  { eyebrow: 'STEP 2 · PROCESS', title: 'Frame it. Self-tune runs automatically.', symbol: '▱', body: 'Select a clip and Vapormint measures the source, renders a short preview, and writes evidence-based fixes into the recipe. Review the results, adjust anything that looks off, then export.', note: 'Deinterlacing, denoise, and sharpen are set from what the pixels actually need. Hover any setting for an explanation.' },
  { eyebrow: 'STEP 3 · EXPORT', title: 'One click. Watch it render.', symbol: '↗', body: 'Pick the output folder and export. Progress, elapsed time, and the active phase stay visible. Stop removes incomplete work without touching finished files.', note: 'Strict mode never silently swaps a codec. Optional PNG extraction comes from the processed master.' },
] as const;
```

### 8b. Welcome dialog JSX
- Remove the `<img src={appIcon} />` from `welcome-brand`.
- Add `<span className="welcome-step">{welcomeStep + 1} / {welcomeSteps.length}</span>` between the brand name and the close button.
- Change "Skip guide" button text to "Skip".

### 8c. Codec labels (in recipe field rendering)
| Old | New |
|-----|-----|
| `AV1` | `AV1 (efficient)` |
| `H.264` | `H.264 (compatible)` |

### 8d. Color verdict strings (in source guidance pills)
| Old | New |
|-----|-----|
| `SDR color confirmed` | `✓ Standard color (SDR)` |
| `Color metadata missing` | `⚠ Color not tagged — verify in playback` |

### 8e. Self-tune status text
| Old | New |
|-----|-----|
| `Self-tune preview` button (manual) | Removed — auto-tune fires on clip selection |
| `Re-tune` | `↻ Re-tune this clip` |
| `Apply suggested settings` | Removed |

### 8f. Section reorder in Process Clips
The process view should render in this order:
1. Self-tune progress bar (when tuning)
2. "✦ Why these settings?" prominent panel (tune-result)
3. "Tune the recipe" section (auto-tune status + re-tune button)
4. Source Guidance (verdict, signal pills, checklist, video stats)
5. Recipe grid (MOTION → DETAIL → OUTPUT → FINISHING) with tooltips
6. Pipeline card, engine details, compatibility notes
7. Export location, progress, export row

### 8g. Tooltips on recipe fields
Every recipe `<select>` and `<input>` should have a `title` attribute with
a plain-language explanation. Examples:
- Motion: "How the app handles interlaced video. 'Auto' lets self-tune decide."
- Denoise: "Removes grain. Higher values smooth more but can soften detail."
- Sharpen: "Adds edge definition. Higher values make edges crisper but can
  halos around fine detail."
- Output format: "AV1 is the most efficient codec. H.264 works everywhere."

### 8h. "Video stats" rename
The `<details>` element for source analysis should be labeled "Video stats"
(not "Source analysis" or similar).

---

## 9. `src/styles.css` — Full cinematic darkroom redesign

This is the largest change. Replace the entire `:root` variable block and
apply the design rules below throughout.

### 9a. CSS custom properties (`:root`)
```css
:root {
  --font: "Space Grotesk", "Segoe UI Variable", "Segoe UI", sans-serif;
  --mono: "Space Mono", Consolas, monospace;
  --ink: #f0ece4;
  --muted: #a09a8e;
  --quiet: #7a756c;
  --line: #1e1e1c;
  --line-strong: #3a3834;
  --surface: #0c0c0b;
  --panel: #111110;
  --panel-2: #181816;
  --acid: #ece4b4;       /* celluloid cream — single warm accent */
  --warning: #d4a843;
  --destructive: #c45c5c;
}
```

### 9b. Body
```css
body { font-family: var(--font); color: var(--ink); background: #080808; }
```

### 9c. Global rules
- **All `border-radius`:** set to `0`. No exceptions — cards, buttons, inputs,
  selects, dialogs, tags, progress bars, everything.
- **All `box-shadow`:** remove. No glows, no depth shadows, no inset shadows.
- **All `linear-gradient` / `radial-gradient`:** replace with flat colors.
- **All `backdrop-filter: blur(...)`:** remove.
- **`::selection`:** use `var(--acid)` background, `#080808` text.
- **`::-webkit-scrollbar`:** width 8px, thumb `var(--line-strong)`, track `var(--surface)`.

### 9d. Typography
- `h1, h2, h3`: `letter-spacing: -0.02em; font-weight: 600;`
- `.eyebrow`: `font-size: 10px; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase;`
- Buttons (`.primary`, `.ghost`): `font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;`
- `.field select`: `font-size: 11px;`
- `.field label`: `letter-spacing: 0.14em;`
- `.section-head h3`: `letter-spacing: 0.14em;`
- `.enter-clip`: `font-weight: 600;` (was 900)
- `.speed-btn.active`: `color: var(--acid);`

### 9e. Light theme (`[data-theme="light"]`)
```css
[data-theme="light"] {
  --ink: #2a2825;
  --muted: #6b6559;
  --quiet: #9a9488;
  --line: #e0dccf;
  --line-strong: #c5bfb0;
  --surface: #f5f2ec;
  --panel: #efead9;
  --panel-2: #e8e2d2;
  --acid: #8a7a3a;
  --warning: #a07828;
  --destructive: #a04040;
}
```
- `app-shell`, `home-intro`, `sidebar`, `process-list`, `global-task`,
  `analysis-popover`, `source-frame`, `crop-mask`: all use flat `var()`
  references, no gradients.
- Sidebar active state: `background: var(--acid); color: var(--surface);`

### 9f. Specific component rules
- `.welcome-progress span`: `background: var(--line-strong);` active: `var(--acid)`. No gradient.
- `.progress-track`: `background: var(--line);` fill: `var(--acid)`. No glow.
- `.crop-handle`: `background: var(--acid);` (was gradient). No box-shadow.
- `.crop-mask`: `border: 1px solid var(--acid);` No inset glow.
- `.global-task-spinner`: `border: 2px solid var(--line-strong); border-top-color: var(--acid);` No second color.
- `.loading::before`: `border: 2px solid var(--line); border-top-color: var(--acid);`
- `.frame-corners`: `border-color: var(--line);`
- `.batch-progress`: `border: 1px solid var(--acid); background: var(--panel);`
- `.tune-cta:hover`: `background: var(--surface);` (was semi-transparent)
- `.compatibility-note`: `border: 1px solid var(--warning); color: var(--muted); font-size: 10px;`
- `.focus-visible`: `outline: 1px solid var(--acid); outline-offset: 2px;` No glow.
- `.status-dot.working`: no pulse animation. `background: var(--acid);`
- `.welcome-step`: `font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: 0.12em;`

### 9g. Spacing
- Base unit: 4px.
- Section gap: 48–80px.
- Card padding: 12–20px.
- Full-bleed feel: text anchored to edges, minimal centering.

---

## 10. `scripts/cf_analysis.py` — Ensure it's in the repo

The Python analysis script must be at `scripts/cf_analysis.py` in the repo
root. It's packaged via `extraResource: ['./scripts']` in forge config and
referenced by `brainPaths()` in `media.ts`.

On Mac, the runtime Python must be the macOS build (not Windows). The
`runtime/` folder structure for Mac:
```
runtime/
  darwin-arm64/          (or darwin-x64 for Intel)
    python/
      python3
    ffmpeg
    ffprobe
    vapoursynth/
      vspipe
      python/
        vapoursynth/
        vapoursynth-plugins/
          ...
```

---

## 11. Mac-specific packaging notes

### Squirrel → Sparkle / generic provider
- Remove `MakerSquirrel` from `forge.config.ts`.
- Add `MakerDmg` for the `.dmg` installer.
- Add `MakerZIP` for the generic auto-update ZIP.
- `electron-updater` on Mac uses the generic provider by default.
  Configure the feed URL:
  ```ts
  autoUpdater.setFeedURL('https://your-cdn.com/updates/mac');
  ```
  The feed must serve `latest-mac.yml` + the ZIP.

### Code signing
- macOS requires code signing for distribution.
- Option A: Ad-hoc signing (free, works on your own machine):
  ```ts
  packagerConfig: {
    osxSign: { identity: '-' },
  }
  ```
- Option B: Apple Developer ID (paid, required for distribution):
  ```ts
  packagerConfig: {
    osxSign: { identity: 'Developer ID Application: Your Name' },
    osxNotarize: { teamId: 'YOUR_TEAM_ID', appleId: 'you@email.com', appleIdPassword: 'APP_PASSWORD' }
  }
  ```
- Without signing, Gatekeeper will block the app. The user must right-click
  → Open, or run `xattr -cr /Applications/Vapormint.app`.

### App bundle structure
- The Mac app is a `.app` bundle, not an `.exe`.
- `process.resourcesPath` on Mac resolves to
  `Vapormint.app/Contents/Resources/`.
- `app.getPath('userData')` resolves to
  `~/Library/Application Support/Vapormint/`.
- The `extraResource` files land in `Contents/Resources/`.

### Python path
- `getRuntimeStatus()` and `brainPaths()` must look for the macOS Python
  binary at `Contents/Resources/runtime/darwin-arm64/python/python3`
  (adjust for Intel: `darwin-x64`).
- The `platform` check in `media.ts` should use `process.platform === 'darwin'`
  to select the correct runtime subfolder.

### Icon
- Use `assets/icon.icns` (not `.ico`).
- Forge config: `icon: 'assets/icon.icns'` for the packager,
  `icon: 'assets/icon.icns'` for the DMG maker.

### Menu bar
- On Mac, the app gets a native menu bar. Add a minimal menu if needed:
  ```ts
  import { Menu } from 'electron';
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu', label: 'Vapormint' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]);
  Menu.setApplicationMenu(menu);
  ```

### `window-all-closed` behavior
- The existing guard `if (process.platform !== 'darwin') app.quit();` is
  correct for Mac (app stays alive when all windows close, standard Mac
  behavior).

---

## 12. Verification checklist

After applying all edits, run:

```bash
npm install
npm run typecheck    # npx tsc --noEmit
npm run make         # npx electron-forge make
```

Then verify:
- [ ] App launches without crashes
- [ ] Space Grotesk font renders (not falling back to system font)
- [ ] Zero border-radius on all elements
- [ ] No box-shadows or gradients visible
- [ ] Single warm accent color (celluloid cream / deep gold)
- [ ] Welcome guide shows 4 steps with correct copy
- [ ] Self-tune fires automatically on clip selection
- [ ] "Why these settings?" panel shows evidence
- [ ] Recipe fields have tooltips on hover
- [ ] Export works (test with a short clip)
- [ ] Diagnostics log appears in `~/Library/Application Support/Vapormint/diagnostics.log`
- [ ] Check for updates works (or fails gracefully with "Update check failed")
- [ ] Feedback form saves a JSON file in the app data folder
