# Page dependency trees

All four workspaces are render branches in the same renderer file.

## Home
- `src/App.tsx` — App shell and Home
  - `src/shared.ts` — project/session models and formatting
  - `src/styles.css` — all layout and theme styles

## Find Moments
- `src/App.tsx` — App shell and FindMoments
  - `src/shared.ts` — clips, time formatting, crop/recipe models
  - `src/styles.css`

## Process Clips
- `src/App.tsx` — App shell, ProcessClips, CropMask, form primitives
  - `src/shared.ts` — recipes, aspect presets, output calculations
  - `src/styles.css`

## Settings
- `src/App.tsx` — App shell and Settings
  - `src/shared.ts` — persisted StudioPreferences
  - `src/styles.css`
