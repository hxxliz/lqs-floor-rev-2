# Bundled Windows x64 media runtime

This directory is shipped with LQ's Cutting Floor. It contains FFmpeg/FFprobe 9.0.1, yt-dlp 2026.08.19, Python 3.12.10, VapourSynth R79, VSPipe, and the plugin set used by generated recipes. The app resolves this private runtime before `PATH`; users do not install media tools separately.

## Versions & updates

The exact, pinned versions of everything bundled here are recorded in **[`runtime/lock.json`](../lock.json)** (the auditable source of truth — this directory itself is gitignored). To confirm the on-disk runtime still matches the manifest:

```
node scripts/verify-runtime-lock.cjs   # also runs as part of `npm run check`
```

To update a tool (e.g. bump yt-dlp or add a plugin): edit `lock.json`, re-assemble the runtime from that manifest, re-run the verifier, then `npm run make` — the new installer carries the new toolchain, and the in-app release-page update flow delivers it to users.

Runtime licenses remain in their package `.dist-info` directories. FFmpeg's GPLv3 license and yt-dlp's Unlicense are in `licenses/`.
