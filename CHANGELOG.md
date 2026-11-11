# LQ’s Cutting Floor — Changelog

## 0.3.24 — September 25, 2026

### Fixed

- YouTube’s “Sign in to confirm you’re not a bot” response no longer leaves the user at a raw yt-dlp error.
- Failed authenticated downloads reopen the download setup instead of creating duplicate projects.
- Browser-cookie extraction failures now produce clear recovery instructions.

### Added

- Optional browser sign-in for YouTube and other yt-dlp-supported sites using Edge, Chrome, Firefox, or Brave.
- Browser cookies are read directly by yt-dlp for the requested download; Cutting Floor does not save or export them.
- A Windows update helper that locates the standard installation, verifies the release checksum and version, updates in place, and reopens the app.

### Source guidance

- Analysis now samples multiple locations across a source instead of relying only on its opening seconds.
- Guidance distinguishes metadata from measured cadence, frame-timing, color, freeze, and decode evidence.
- Findings include confidence levels and playback checks.
- Suggested recipes no longer automatically enable denoise, sharpening, restoration, debanding, inverse telecine, or motion interpolation without sufficient evidence.
- Existing projects can reanalyze sources to generate the improved guidance.

### Notes

- Public downloads still depend on the source website and yt-dlp. Authentication, DRM, regional restrictions, expired browser sessions, or website changes can still prevent individual downloads.
- Existing projects, source files, settings, and completed exports are preserved during installation updates.

## 0.3.23 — September 23, 2026

- Introduced distributed source analysis and confidence-based processing guidance.
- Added timestamp-based variable-frame-rate clues and safer color/cadence recommendations.
- Changed new clip recipes to begin without automatic cleanup filters.

