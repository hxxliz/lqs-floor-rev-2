# Extractable components

## AppShell
- Source: `src/App.tsx`
- Category: layout
- Description: Title bar, sidebar navigation, runtime status, and main workspace.
- Extractable props: activeView, projectName, theme.
- Hardcoded: product wordmark, four navigation labels, runtime tool labels.

## ProjectCard
- Source: `src/App.tsx` (Home)
- Category: basic
- Description: Thumbnail, project title, progress metadata, rename/delete actions.
- Extractable props: name, thumbnailUrl, completedCount, clipCount, sourceCount, active.

## SourceCard
- Source: `src/App.tsx` (Home/FindMoments)
- Category: basic
- Description: Source thumbnail with resolution, fps, episode label, codec and review status.
- Extractable props: title, thumbnailUrl, resolution, fps, metadata, reviewed.

## ClipQueue
- Source: `src/App.tsx` (FindMoments/ProcessClips)
- Category: layout
- Description: Selectable project clip list with Ready/Complete states.
- Extractable props: activeClipId, clipCount, collapsed.

## PlaybackSurface
- Source: `src/App.tsx` (FindMoments/ProcessClips)
- Category: layout
- Description: Large video-first surface with transport, crop mask, and preview state.
- Extractable props: mode, playing, speed, cropRatio.
