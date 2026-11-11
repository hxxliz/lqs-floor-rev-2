# Source guidance research — 2026-09-15

## Applied rules

- Source tags are evidence, not a visual quality score. AviSynth explains why quiet interlaced scenes may show no combing and why chroma conversion depends on field structure. Inspect moving frames, not just a static opening. [AviSynth+ field guide](https://avisynthplus.readthedocs.io/en/latest/avisynthdoc/advancedtopics/interlaced_fieldbased.html)
- The existing three-second opening decode check now runs `idet` too and records its classification counts. FFmpeg describes interlace/progressive and repeated-field detection; a short sample is not proof of whole-source cadence. No automatic inverse telecine or metadata override is added. [FFmpeg idet](https://ffmpeg.org/ffmpeg-filters.html#idet)
- Frame-rate tag disagreement remains a possible-VFR warning, not a timestamp analysis. Agreement no longer claims constant frame spacing. Container bitrate no longer selects stronger denoising: it includes more than video and is not a noise measurement. These are conservative application policies, not detector guarantees.
- Progressive tags can be wrong. VapourSynth resizers use `_FieldBased` and may resize incorrectly when that property is wrong. The guide tells users to verify motion before choosing cadence handling; no unconditional metadata clearing was added. [Resize](https://www.vapoursynth.com/doc/functions/video/resize.html), [SetFieldBased](https://vapoursynth.com/doc/functions/video/setfieldbased.html)
- BM3D strength is filter-specific and sensitive to sigma; its Final stage refines a Basic estimate. The app's existing numeric ranges remain starting suggestions, not universal values. KNLM/FineSharp/Photoshop numbers from community tutorials are not transferable. [BM3D developer guide](https://github.com/HomeOfVapourSynthEvolution/VapourSynth-BM3D)
- MVTools FlowFPS uses motion vectors to produce a target frame rate. It is distinct from changing preview speed or GIF delays. Keep original motion by default; inspect cuts and fast motion when smoothing. [MVTools developer guide](https://github.com/dubhatervapoursynth/vapoursynth-mvtools)
- Descale reverses a modeled earlier resampling operation, rather than being a general detail-restoration switch. Kernel and native dimensions matter; leave it off without evidence. [Descale developer guide, VS and AviSynth+](https://github.com/Irrational-Encoding-Wizardry/descale)

## Community lessons retained

Previously read user-supplied Tumblr tutorials reinforce using the best available source, planning crop/output dimensions before finishing, gentle per-shot cleanup, and checking reused recipes. Examples: [Wonwooridul](https://www.tumblr.com/wonwooridul/696103970355232768/giffing-using-vs-ps), [Shuaberriez](https://www.tumblr.com/shuaberriez/719377661833658368/basic-gif-tutorial), [Quokki](https://www.tumblr.com/quokki/713994273896431616/in-depth-gif-tutorial-%CF%89).

Blanket QTGMC settings, file-extension interlacing rules, fixed cache-size advice, Photoshop compositing, GIF timing, and GIF encoding were not adopted. The app still exports processed video and optional PNGs, not GIFs.

## Scope and verification

Both workspaces regenerate guidance from saved metadata, so legacy recommendations cannot keep presenting obsolete bitrate advice. Existing projects only gain sampled counts when their source is freshly probed. Suggestions require the user's Apply action and do not rewrite other recipes automatically. Original paused playback remains the crop reference, not a processed preview.

Type checking and domain/theme regression checks pass. The bundled FFmpeg successfully runs the combined `idet,freezedetect` filter. A synthetic progressive test pattern received mixed detector classifications, reinforcing why sample counts must not automatically choose deinterlacing. Whole-source VFR, telecine, noise, softness, and field-order validation remain outside this short check.
