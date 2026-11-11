# Bundled Windows x64 media runtime

This directory is shipped with LQ's Cutting Floor. It contains FFmpeg/FFprobe 9.0.1, yt-dlp 2026.08.19, Python 3.12.10, VapourSynth R79, VSPipe, and the plugin set used by generated recipes. The app resolves this private runtime before `PATH`; users do not install media tools separately.

Runtime licenses remain in their package `.dist-info` directories. FFmpeg's GPLv3 license and yt-dlp's Unlicense are in `licenses/`.
