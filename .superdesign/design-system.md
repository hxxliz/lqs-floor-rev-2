# LQ's Cutting Floor — Cross-Platform Studio Design System

## Product

LQ's Cutting Floor is a desktop video-sifting and VapourSynth-processing studio. The UI supports four persistent workspaces: Home, Find Moments, Process Clips, and Settings. The product must feel native on macOS and Windows while sharing one clear information architecture.

## Direction

Use the supplied music-library screenshot as structural inspiration: a calm desktop canvas, slim left navigation, spacious central media workspace, dense but legible cards, a distinct queue rail, and persistent playback controls. Do not reproduce its branding or music-specific content. Keep LQ's identity and video-editing terminology.

## Layout

- Desktop canvas: 1440×960 target, usable down to 960×620.
- Slim 184–208px navigation rail with icon + label rows.
- Main workspace uses generous 24–40px padding and clear section bands.
- Find Moments: source header, dominant 16:9 video, timeline and transport directly below, collapsible clip queue on the right.
- Process Clips: dominant playback/crop canvas, play/pause directly beneath it, recipe controls below, compact project clips rail.
- Settings is a settings-only workspace with no playback surface. Use a spacious preferences canvas with grouped cards or a two-column preferences layout.
- Settings includes a segmented Dark / Light appearance control.

## Typography

- macOS: SF Pro Display/Text first; fallback Segoe UI Variable and system sans-serif.
- Technical timecodes and pipeline values: SF Mono / Cascadia Mono / monospace.
- Body 13–15px, labels 11–12px, section titles 18–24px, primary page titles 32–48px.
- Avoid tiny condensed labels and excessive letter spacing.

## Light theme

- Canvas: #F5F7FB
- Primary surface: #FFFFFF
- Secondary surface/sidebar: #EDF2F8
- Raised/selected surface: #E4EBFA
- Primary text: #182238
- Secondary text: #59667C
- Hairline: #D8E0ED
- Primary accent: #3568F4
- Secondary accent: #9A72E8
- Success: #218A62; warning: #B66A10; destructive: #C94055

## Dark theme

- Canvas: #080A10
- Primary surface: #121621
- Secondary surface/sidebar: #0E121B
- Raised/selected surface: #1B2232
- Primary text: #F5F7FB
- Secondary text: #C7D0DE
- Tertiary/help text: #ACB8CB
- Placeholder and disabled text: #8F9CB2
- Decorative divider: #303B50
- Interactive control boundary: #63728C
- Primary accent/link/focus: #8EAAFF
- Secondary accent: #C5A7FF
- Success: #74DDA8; warning: #F4BD72; destructive: #FF8FA1
- On dark surfaces, primary, secondary, tertiary, and placeholder text all exceed 5:1. Do not lower informative text contrast with opacity; reserve dimmer treatment for disabled controls only.

## Components

- Cards use 8–12px radius, one-pixel hairlines, restrained shadows in light mode, and raised tonal surfaces in dark mode.
- Primary buttons use a blue-to-violet gradient sparingly; secondary buttons are quiet outlined controls.
- Active navigation uses a filled blue/violet-tinted row plus a narrow accent marker.
- Video canvases remain near-black in both themes for color judgment.
- Clip queue rows show index, clip name, duration, and Ready/Complete state at a glance.
- Playback transport remains outside the crop overlay and always visible.
- Progress uses determinate bars, percentage, phase, and elapsed time.
- The actual supplied LQ's Cutting Floor logo must appear in every logo position; never substitute initials, emoji, generic symbols, invented SVG marks, or text alone.

## Motion and accessibility

- 120–180ms transitions for hover, selection, queue collapse, and theme change.
- Honor reduced motion.
- Minimum 4.5:1 text contrast and 40px interactive target height for primary controls.
- Target at least 5:1 for standard text, 7:1 for primary and secondary reading text, and 3:1 for essential control boundaries, icons, focus, and selected states.
- Do not rely on hue alone for Ready, Complete, warning, selected, or download/export states; pair color with labels, icons, shape, or weight.
- Visible keyboard focus rings in both themes.

## Handoff requirement

The mock must show the same Process Clips screen in paired light and dark modes. Preserve all functional labels: Project Clips, Clip Playback, Clip + Crop, Processed Still, Processed Playback, composition ratio, master size, recipe controls, Apply Recipe to Other Clips, export destination, export progress, and Export Clip.
