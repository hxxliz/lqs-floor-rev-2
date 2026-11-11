# LQ's Cutting Floor

## Latest app and backup: 0.3.24

- [Download the app and bundled files](https://github.com/hxxliz/lqs-floor-rev-2/releases/tag/v0.3.24).
- [First-use guide](README_FIRST_USE.txt) and [full Windows guide](README_WINDOWS.txt).
- For installation, download `LQsCuttingFloorSetup.exe` (the original installer, renamed for GitHub downloads). To use the update helper, rename it back to `LQ's Cutting Floor.exe` and keep it with the release's `update_windows.bat`, `update_windows.ps1`, and `SHA256SUMS.txt`.
- The portable ZIP contains the complete packaged app. Extract the whole ZIP before opening `LQsCuttingFloor.exe`.
- This repository contains the source, build configuration, documentation, and saved design context. The release includes the original installer, update package, portable app ZIP, and bundled runtime ZIP. Generated caches and duplicate build output are omitted.

To rebuild from a fresh checkout, download `runtime-win32-x64-0.3.24.zip` from the release and extract it into this checkout's `runtime/` folder. The resulting path must be `runtime/win32-x64/python.exe`. Then run `build_windows.bat` with 64-bit Node.js 22 or newer installed.

Windows-first Electron port of the macOS cutting-floor workflow. It imports local videos, probes metadata with FFprobe, provides frame-aligned I/O marking and a shared clip queue, persists version-6 sessions atomically, and exports through VapourSynth piped into FFmpeg. GIF output is intentionally absent.

## Run

```powershell
npm install
npm start
```

The Windows package includes its own FFmpeg, FFprobe, Python, VapourSynth, VSPipe, and recipe plugins. The sidebar verifies the executables and the complete plugin graph when the app starts; no separate media-tool installation is required.

## Find Moments shortcuts

- `I`: mark in
- `O`: mark out
- `Enter`: enter the marked clip into the project queue
- `Space`: play/pause
- `Left` / `Right`: one frame; hold `Shift` for one second

The project queue collapses from its header. Originals are never modified.

## Build a Windows package

```powershell
npm run check
npm run typecheck
npm run make
```
