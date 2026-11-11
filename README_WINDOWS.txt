LQ'S CUTTING FLOOR — WINDOWS
================================

New users should begin with README_FIRST_USE.txt. This document contains the
full Windows installation, build, and troubleshooting reference.

SYSTEM REQUIREMENTS
-------------------
- Windows 10 version 22H2 or Windows 11, 64-bit (x64).
- 8 GB RAM minimum; 16 GB or more recommended for HD/4K VapourSynth work.
- A current graphics driver and enough free disk space for source masters,
  temporary processing files, finished clips, and optional PNG sequences.

INSTALLATION
------------
1. Run LQ's Cutting Floor.exe. It is the complete Windows installer; the
   RELEASES and .nupkg files are retained only for release/update tooling.
2. No separate Python, FFmpeg, FFprobe, yt-dlp,
   VapourSynth, VSPipe, or plugin installation is required.
3. The app starts muted and stores projects and exports in the locations shown
   under Settings. Each location can be changed there.

WINDOWS SMARTSCREEN
-------------------
Unsigned or newly signed builds can display "Windows protected your PC."
Only continue if this installer came from the trusted Cutting Floor release
and its SHA-256 value matches SHA256SUMS.txt. Choose More info, verify the
publisher/file, then choose Run anyway. Production releases should be signed
with a trusted Windows code-signing certificate to avoid this warning.

BASIC WORKFLOW
--------------
1. Import video files, import a season folder, watch a folder, or paste a
   public video URL to download a source master. If YouTube requires sign-in,
   retry and choose a signed-in browser in the download dialog.
2. In Find Moments, scrub the source and use I for Mark In, O for Mark Out,
   Enter to add a clip, Space to play/pause, Arrow keys for one frame, and
   Shift+Arrow for one second.
3. In Process Clips, set crop, output size, cleanup, motion, color, format,
   and optional processed PNG extraction.
4. Confirm the crop in ready-to-play clip playback, choose the export folder,
   then export.
   The phase, percentage, and elapsed time remain visible. Stop safely removes
   incomplete output while preserving the project and completed work.

UPDATING AN EXISTING INSTALLATION
---------------------------------
Keep LQ's Cutting Floor.exe, update_windows.bat, update_windows.ps1, and
SHA256SUMS.txt together. Save your work and close the app, then double-click
update_windows.bat. It checks the installer hash, locates the standard per-user
installation, runs the Squirrel update, verifies the app, and opens it again.
The updater does not search the entire drive or modify project/session files.

OUTPUTS AND PROJECT SAFETY
--------------------------
- Original source files are never modified.
- Sessions autosave in the selected project library.
- Finished clips are placed in a project-named folder under the selected
  export location. Existing files are not overwritten; a unique name is used.
- Strict VapourSynth mode stops on pipeline failure. Compatibility mode is
  explicitly labeled when FFmpeg substitutions are used.

BUILDING FROM SOURCE
--------------------
Install 64-bit Node.js 22 or newer, then double-click build_windows.bat or run:

  build_windows.bat

The script performs a clean npm install, TypeScript/domain checks, a bundled
runtime/plugin probe, and an Electron Forge Squirrel.Windows build. Artifacts
and SHA-256 checksums are written to dist\.

Optional signing variables:

  WINDOWS_CERTIFICATE_FILE=C:\secure\certificate.pfx
  WINDOWS_CERTIFICATE_PASSWORD=your-certificate-password

Do not commit the certificate or password. The application is asset-heavy, so
the supported production output is the single LQ's Cutting Floor.exe installer,
not a PyInstaller one-file Python executable. Electron
resolves packaged binaries from process.resourcesPath, the direct equivalent
of Python's sys._MEIPASS for this application architecture.

TROUBLESHOOTING
---------------
- A red runtime item in the sidebar means the packaged runtime failed its
  startup probe. Reinstall from an intact release and verify its checksum.
- If a source moved, restore it to its saved path before exporting.
- Processing may be slow for 4K, Fine detail BM3D, QTGMC, or 60 fps motion.
  A changing phase/elapsed timer indicates that work is still active.
- Ensure the export drive has enough free space. PNG sequences can be large.
