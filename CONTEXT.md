# Cutting Floor Studio

Cutting Floor is a local video-sifting context: people review source media, preserve promising time ranges, attach processing choices, and render finished masters.

## Language

**Project**:
The whole editing job, containing ordered Sources, Clips, locations, and review state.
_Avoid_: Session, library item

**Session Document**:
The autosaved representation of a Project used to resume work.
_Avoid_: Project file, receipt

**Source**:
An original video or episode reviewed without modification.
_Avoid_: Reel, input, asset

**Playback Copy**:
A lightweight derivative used only when the Source is unsuitable for responsive playback; processing always uses the Source.
_Avoid_: Proxy source, master

**Clip**:
A frame-aligned marked time range from one Source, stored in the Project before or after processing.
_Avoid_: Moment, fragment, cut

**Recipe**:
The crop, sizing, restoration, cleanup, cadence, color, and output choices saved with one Clip.
_Avoid_: Preset, filter stack

**Export**:
A validated finished video rendered from a Clip and its Recipe, optionally accompanied by processed PNG frames and a VapourSynth script.
_Avoid_: Render job, output receipt

**Watch Folder**:
A Project-owned folder monitored for new video files that should become ordered Sources.
_Avoid_: Season library, import folder
