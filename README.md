# Vapormint

Cross-platform desktop video sifting and VapourSynth processing studio.
Version 2.0.0 — the "cinematic darkroom" redesign.

## What's new in 2.0

### Self-Tune (auto-preview)
- When you open a clip, Vapormint automatically renders a 1-second preview from the current recipe, measures the pixels (interlacing, noise, banding, sharpness), and writes evidence-based fixes back into the recipe.
- You can see exactly what the analysis found under "Why these settings?" — interlacing evidence, noise level, banding detection, and sharpening rationale.
- Hover any recipe field for a plain-language tooltip.
- "Re-tune this clip" re-runs the analysis if you change settings manually.

### Source Guidance
- Plain-language verdicts: "Interlacing confirmed", "Progressive (normal) footage", "Cadence not yet confirmed by sampling".
- "What to look for" checklist with actionable steps.
- "Video stats" details section with all measured values.

### Cinematic Darkroom UI
- **Space Grotesk** (300–600) for all text, **Space Mono** for technical labels and timestamps.
- Near-black canvas (#080808) with **celluloid cream** (#ece4b4) as the single warm accent.
- Zero border-radius, zero box-shadows, zero gradients. Depth from value contrast and 1px hairlines.
- Light theme: warm paper (#f5f2ec) with deep gold accent.
- All hardcoded colors replaced with CSS custom properties.

### Updated Onboarding
- 4-step welcome guide with cinematic language.
- Step counter in Space Mono.
- Flat, angular layout matching the new design system.

### Auto-Updater
- Built-in update check via electron-updater.
- "Check for updates" in Settings.

### Feedback
- Report a bug or suggest a feature from Settings.
- Saved locally as JSON in the app data folder.

### Diagnostics
- All console output logged to `diagnostics.log` in the app data folder.
- Export and preview-tune failures logged with full context.

### Bug Fixes
- `brainPaths()` — handles packaged builds where `import.meta.url` is unavailable (asar).
- `exportClip` — falls back to saved preferences when `exportRoot` is missing.
- `previewTune` — same fallback for auto-tune preview.
- `squirrelStartup` import — properly wrapped to prevent crash on missing module.
- All user-facing strings: "LQ's Cutting Floor" → "Vapormint".

## Install (Windows)
1. Run `VapormintSetup.exe`.
2. If SmartScreen warns, click **More info** → **Run anyway** (unsigned build).
3. No separate Python, FFmpeg, VapourSynth, or plugin install needed — all bundled.

## Shortcuts
| Key | Action |
|-----|--------|
| `I` / `O` | Mark In / Out |
| `Enter` | Queue marked clip |
| `Space` | Play / Pause |
| `←` / `→` | One frame (hold `Shift` for one second) |

## Build from source
```powershell
npm install
npm run check
npm run typecheck
npm run make
```

## Files
| Path | Purpose |
|------|---------|
| `VapormintSetup.exe` | Windows installer (Squirrel) |
| `README.md` | This file |
| `MAC_PORT_INSTRUCTIONS.md` | Ordered edit list for porting to macOS |
