LQ'S CUTTING FLOOR — FIRST USE
================================

WELCOME
-------
LQ's Cutting Floor helps you review source videos, mark precise moments,
prepare them with VapourSynth, and export polished video masters or optional
PNG frames. Processing runs locally, and your original source files are never
modified.

INSTALL
-------
1. Run LQ's Cutting Floor.exe.
2. Windows SmartScreen may say "Windows protected your PC" because this test
   build is not yet code-signed. If you received it from a trusted source,
   choose More info, confirm the filename, then choose Run anyway.
3. No separate FFmpeg, Python, yt-dlp, VapourSynth, or plugin installation is
   required. Everything needed is bundled.

FIRST LAUNCH
------------
The welcome guide appears automatically. You can close it with Escape and
open it again later from Settings > Show welcome guide.

THE WORKFLOW
------------
1. HOME
   Import one video, import a season folder, watch a folder, or paste a public
   video link. Downloads become new projects and show live progress.

2. FIND MOMENTS
   Review the source, scrub the timeline, mark a range, and add it to the
   project clip queue.

   Space             Play or pause
   Left / Right      Move one frame
   Shift + Arrow     Move one second
   I                 Set Mark In
   O                 Set Mark Out
   Enter             Add the marked clip to the queue

3. PROCESS CLIPS
   Select a queued clip and press Play when ready. Adjust the crop, composition
   ratio, output size, and processing recipe. Playback does not autoplay.
   Suggested settings are conservative technical starting points—inspect each
   shot before exporting. A recipe can be copied to the other project clips.

4. EXPORT
   Confirm or choose the finished-product folder, then select Export clip.
   Phase, percentage, and elapsed time remain visible. Stop safely cancels the
   active task and removes incomplete temporary output while preserving the
   project and completed work.

PROJECTS AND FILE LOCATIONS
---------------------------
Settings provides separate locations for:

- Project and session files
- Downloaded source masters
- Finished clips and optional PNG frames

Projects autosave. Existing export filenames are never silently overwritten.

PROCESSING NOTES
----------------
- Strict VapourSynth stops if the genuine pipeline fails.
- Compatibility mode may use clearly labeled FFmpeg substitutes.
- 4K, QTGMC, Fine detail BM3D, 60 fps motion, and PNG extraction can take
  substantial time and disk space.
- Public-video downloads require internet access. Normal processing does not.
- If YouTube asks you to sign in or confirm you are not a bot, retry the download and choose a browser where you are already signed into YouTube. Cutting Floor passes that browser directly to yt-dlp; it does not save or export the browser cookies. Close the selected browser first if Windows reports that its cookie database is locked.

SYSTEM REQUIREMENTS
-------------------
- Windows 10 22H2 or Windows 11, 64-bit x64
- 8 GB RAM minimum; 16 GB or more recommended
- Adequate free space for source masters, temporary files, and exports

IF SOMETHING GOES WRONG
-----------------------
- A red Local pipeline indicator means a bundled component failed its check.
- If a source was moved or deleted, restore it to its original saved path.
- If an export fails, the project remains safe. Check available disk space and
  try a simpler recipe.
- When requesting help, include the app version, source format, selected
  recipe, and the complete status or error message shown in the app.
