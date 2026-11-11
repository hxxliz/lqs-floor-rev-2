# Source-analysis guidance research

## Scope

This note evaluates which source properties LQ's Cutting Floor can detect reliably and which should remain review prompts. It uses only first-party FFmpeg documentation/source and VapourSynth plugin documentation/source. Recommendations are deliberately conservative: an automatic choice should prevent a known technical error, not guess a preferred look.

## Executive recommendation

Split guidance into three confidence levels:

- **Confirmed:** directly observed decoded timestamps/errors or explicit, internally consistent stream/frame metadata. The app may recommend a matching technical action.
- **Likely:** repeated measurements agree across representative moving sections, but the signal is still heuristic. Recommend a review step and offer a one-click starting recipe; do not apply it silently.
- **Unverified:** tags are missing/conflicting or an image metric is content-dependent. Preserve the source and explain what the user should inspect.

The most important policy change is to stop treating `Natural` denoise and sharpening as a neutral technical default. FFmpeg's no-reference blur/block/noise measurements describe image statistics, but their documentation provides no universal thresholds that distinguish unwanted noise from grain, soft photography, animation, shallow depth of field, or intentional gradients. `Apply Suggested Settings` should therefore leave denoise, sharpen, deband, restoration, and motion interpolation **off** unless the user explicitly selects a look.

## Recommended analysis stages

1. **Metadata probe (fast):** read codec, dimensions, pixel format/bit depth, sample aspect ratio, field order, average frame rate, time base, color range/matrix/transfer/primaries, and HDR side data with `ffprobe`.
2. **Representative decoded samples (moderate):** analyze several moving windows distributed through the source—not only the opening—with `idet`, `scdet`, `freezedetect`, and optional advisory image metrics. Report the number and locations of windows examined.
3. **Timestamp scan (moderate/full):** inspect decoded frame timestamps or BestSource-exported timestamps. Do not infer CFR/VFR from `r_frame_rate` versus `avg_frame_rate` alone.
4. **Decode verification (background/full):** decode the video stream to a null sink while collecting errors. A static opening is a separate observation, never a decode-damage diagnosis.

Suggested sampling for long sources is 8–12 second windows near 5%, 25%, 50%, 75%, and 95%, skipping frames classified as scene changes when aggregating visual-quality metrics. This sampling schedule is an application policy, not a detector guarantee; label its result as sampled and allow a full scan.

## Detection and guidance matrix

| Question | Best available signal | Confidence | Limitation | Conservative guidance |
| --- | --- | --- | --- | --- |
| Is the source interlaced? | Stream/frame field flags plus `idet` multiple-frame results across moving windows | Likely; Confirmed only when metadata and repeated samples agree strongly | Quiet/static material can be undetermined; metadata can be wrong; mixed sources exist | Suggest Bwdif/QTGMC only when corroborated. Otherwise leave Off and ask the user to inspect moving edges. |
| What is the field order? | Stable TFF/BFF majority from `idet`, checked against decoded field metadata | Likely | FFmpeg explicitly warns that announced parity may be untrustworthy; Bwdif `auto` falls back to TFF when unknown | Preselect parity only on agreement. Expose “field order uncertain” when evidence conflicts. |
| Is it telecined? | Repeated-field evidence from `idet`, stable field matching, and a repeatable decimation cycle from VFM/VDecimate dry-run metrics | Likely at best | Repeated fields are only a sign of telecine; mixed edits, true interlace, blends, and duplicates can mimic parts of the pattern | Never select IVTC from frame rate or `idet` alone. Offer it only after a stable cadence is observed in multiple windows. |
| Is it VFR? | Changes in decoded PTS deltas over the full stream (`vfrdet`, frame timestamps, or BestSource `exporttimestamps`) | Confirmed that timestamps vary | Timestamp jitter, discontinuities, and bad timestamps do not explain creative cadence; a sample can miss later changes | Say “irregular frame timestamps detected.” Preserve timestamps/cadence; motion smoothing is not a repair. |
| Is it HDR? | `color_transfer=smpte2084` (PQ) or `arib-std-b67` (HLG), supported by primaries/matrix and optional mastering/content-light side data | Confirmed tag; not confirmed visual correctness | Tags can be absent or incorrect; 10-bit, BT.2020, resolution, or brightness alone do not prove HDR | Suggest the matching PQ/HLG-to-SDR path only when the transfer tag identifies it. Untagged remains Unknown. |
| Is the matrix SD Rec.601? | Explicit `smpte170m`/`bt470bg` matrix/primaries and frame metadata | Confirmed tag | Resolution does not prove matrix; tags may be missing/wrong | Suggest 601→709 only from explicit tags or user confirmation, not SD dimensions alone. |
| Is the image noisy? | `bitplanenoise` and temporal/spatial statistics sampled within comparable scenes | Advisory only | Texture, grain, motion, compression, and bit depth affect the metric; no documented universal recipe threshold | Show “possible noise/compression; inspect shadows.” Do not auto-enable BM3D. |
| Is the image soft? | `blurdetect` percentiles within moving, edge-bearing shots | Advisory only | It is a no-reference edge-width metric; focus, depth of field, animation, scale, and scene content dominate | Show relative outlier frames/segments. Do not auto-enable CAS or Descale. |
| Is it blocky? | `blockdetect` within comparable samples | Advisory only | Metric depends on pixel-grid periods and scene content; it does not identify the codec or prove that denoising will help | Warn about possible blocking; offer preview comparison, not an automatic strength. |
| Is it banded? | No primary-source detector here supports a universal banding verdict | Unverified | Low local variation can be a legitimate gradient; bit depth and compression do not prove visible banding | Never auto-enable debanding. Prompt inspection of skies, walls, and shadows at output size. |
| Is the opening frozen? | `freezedetect` | Confirmed lack of change under the chosen threshold/duration | A title card or intentional hold is indistinguishable from damage | Say “static interval detected,” with times. Never call it decode damage. |
| Is decoding damaged? | Decoder error logs, nonzero strict decode result, corrupt-frame/decode-error flags, missing timestamps/frames | Confirmed when emitted; clean scan is strong evidence, not a universal proof | Error concealment may still output a frame; some decoders report warnings without marking every affected frame | Distinguish warning, recoverable corruption, and fatal decode failure. Never infer damage from visual stillness alone. |

## Deinterlacing and telecine

### What FFmpeg can establish

`idet` classifies each frame as TFF, BFF, progressive, or undetermined and separately tracks repeated top/bottom fields. Its multiple-frame detector incorporates classification history; repeated fields are described as **a sign of telecine**, not proof. FFmpeg's example examines 360 frames, which reinforces that classification is statistical rather than a single-frame property. [FFmpeg `idet` documentation](https://ffmpeg.org/ffmpeg-filters.html#idet)

Stream parity should remain supporting evidence. FFmpeg's `fieldmatch` documentation explicitly says announced stream parity is sometimes not trustworthy. [FFmpeg `fieldmatch` documentation](https://ffmpeg.org/ffmpeg-filters.html#fieldmatch)

### Confidence rules

Use percentages over **determinate** frames (`TFF + BFF + progressive`), and always display the undetermined share.

- **Likely interlaced:** multiple moving windows each have a strong interlaced majority, parity is stable, and metadata does not contradict it.
- **Likely progressive:** multiple moving windows have a strong progressive majority and no meaningful repeated-field cadence.
- **Mixed/uncertain:** parity changes, progressive/interlaced classifications vary by section, or undetermined frames dominate.

No percentage is specified by FFmpeg as a correctness threshold. Any application threshold must be presented as a product heuristic and validated on a corpus. A reasonable initial gate is deliberately strict (for example, at least 90% of determinate frames agreeing in at least three moving windows), but this is an inference, not an FFmpeg guarantee.

### Recipe recommendation

- **Progressive or uncertain:** `Deinterlace: Off`.
- **Likely interlaced, delivery should retain source frame count/rate:** offer Bwdif same-rate. FFmpeg documents `send_frame` as one output frame per input frame. [FFmpeg `bwdif` documentation](https://ffmpeg.org/ffmpeg-filters.html#bwdif)
- **Likely interlaced, motion-preserving/bob output wanted:** offer Bwdif double-rate or QTGMC. FFmpeg documents `send_field` as one output frame per field. The QTempGaussMC source describes its deinterlace/bob modes as interpolating missing fields to reconstruct progressive frames. [FFmpeg `bwdif` documentation](https://ffmpeg.org/ffmpeg-filters.html#bwdif), [QTempGaussMC source](https://github.com/Jaded-Encoding-Thaumaturgy/vs-jetpack/blob/main/vsdeinterlace/qtgmc.py)
- **Unknown parity:** do not silently treat Auto as reliable. FFmpeg Bwdif defaults unknown parity to TFF. Ask for a visual check for backward/jittery motion. [FFmpeg `bwdif` documentation](https://ffmpeg.org/ffmpeg-filters.html#bwdif)

### Telecine gate

VFM reconstructs progressive frames but leaves duplicates; VDecimate chooses a likely duplicate to drop and can expose `VDecimateDrop`, block difference, and total difference in dry-run mode. VFM exposes `_Combed`, its selected match, comb metrics, and scene-change flags. [VIVTC documentation/source](https://github.com/vapoursynth/vivtc)

Only offer `Inverse Telecine` when all of the following hold across several windows:

1. repeated-field evidence is present;
2. VFM produces mostly uncombed matches with stable parity;
3. VDecimate dry-run shows a stable cycle rather than arbitrary duplicate removal;
4. the source is not broadly mixed interlaced/progressive material.

This rule is an inference from the plugin outputs. The plugin documentation also explains that mixed telecined and truly interlaced content needs a deinterlacing fallback before decimation; therefore an automatic binary “telecine” label would be misleading. [FFmpeg `fieldmatch` documentation](https://ffmpeg.org/ffmpeg-filters.html#fieldmatch), [VIVTC documentation/source](https://github.com/vapoursynth/vivtc)

## Variable frame rate and timestamps

Do not use `r_frame_rate != avg_frame_rate` as the VFR detector. FFmpeg defines `avg_frame_rate` as an average and defines `r_frame_rate` as the lowest rate at which all timestamps can be represented, explicitly calling the latter a guess. [FFmpeg `AVStream` reference](https://ffmpeg.org/doxygen/trunk/structAVStream.html)

FFmpeg's `vfrdet` source compares each decoded frame's PTS delta with the preceding delta and counts exact changes. It reports the changed/unchanged ratio plus minimum, maximum, and average changed deltas. This reliably establishes that decoded timestamp spacing varied, but exact comparison means small timestamp jitter can count as variation. [FFmpeg `vfrdet` source](https://ffmpeg.org/doxygen/trunk/vf__vfrdet_8c_source.html)

BestSource can export every frame timestamp and explicitly represents unknown timestamps as `AV_NOPTS_VALUE`; writing timecodes fails if any timestamp is unknown. BestSource also documents poor seeking for VFR H.264 in AVI, so source/container-specific limitations should be surfaced. [BestSource documentation/source](https://github.com/vapoursynth/bestsource/blob/master/README.md)

Recommended labels:

- **Regular decoded timestamps:** full scan found one stable PTS delta. Do not promise the content has no duplicate frames.
- **Irregular decoded timestamps:** more than one PTS delta was observed. Preserve timestamps and validate clip boundaries/audio sync.
- **Timestamp integrity warning:** missing, non-monotonic, or discontinuous timestamps were observed. Treat this as a timing-risk warning, not a reason to enable interpolation.
- **Not fully scanned:** never display “CFR confirmed.”

## HDR and color

FFmpeg identifies SMPTE ST 2084 as PQ and ARIB STD-B67 as HLG in its color-transfer enum. It separately represents color matrix, primaries, transfer, and range; these properties should not be collapsed into one inferred label. [FFmpeg pixel-format/color enums](https://ffmpeg.org/doxygen/trunk/pixfmt_8h.html)

Mastering-display side data describes the mastering display's primaries, white point, and minimum/maximum luminance. Content-light side data can provide MaxCLL and MaxFALL. Their presence strengthens the HDR description; their absence does not turn PQ/HLG into SDR. [FFmpeg mastering-display metadata](https://ffmpeg.org/doxygen/trunk/structAVMasteringDisplayMetadata.html), [FFmpeg tone-map source consuming content-light metadata](https://ffmpeg.org/doxygen/trunk/vf__tonemap__vaapi_8c_source.html)

Recommended guidance:

- PQ tag → “HDR PQ tag detected; for an SDR deliverable, start with PQ→SDR and review highlights/skin tones.”
- HLG tag → equivalent HLG-specific guidance.
- Explicit 601-family matrix → offer 601→709 for an SDR Rec.709 deliverable.
- Unknown/conflicting tags → “Color interpretation unverified.” Do not claim SDR and do not infer from resolution, bit depth, or BT.2020 alone.
- Preserve the source's tags when the user chooses Preserve. When converting, explicitly set input and output matrix/transfer/primaries/range. FFmpeg's `zscale` documentation supports explicit overrides and warns that some gamut mapping on BT.2020 without proper mastering metadata can cause excessive desaturation. [FFmpeg `zscale`/tone-mapping documentation](https://ffmpeg.org/ffmpeg-filters.html#zscale)

## Noise, sharpness, blocking, and banding

These are useful **review aids**, not safe automatic recipe selectors.

- `blurdetect` is a no-reference edge-based blur metric with configurable Canny thresholds and optional block pooling. It emits `lavfi.blur`, but FFmpeg supplies no universal “needs sharpening” threshold. [FFmpeg `blurdetect` documentation](https://ffmpeg.org/ffmpeg-filters.html#blurdetect), [FFmpeg `blurdetect` source](https://ffmpeg.org/doxygen/trunk/vf__blurdetect_8c_source.html)
- `blockdetect` is a no-reference blocking metric over selected grid periods and emits `lavfi.block`. Again, no universal treatment threshold is documented. [FFmpeg `blockdetect` documentation](https://ffmpeg.org/ffmpeg-filters.html#blockdetect), [FFmpeg `blockdetect` source](https://ffmpeg.org/doxygen/trunk/vf__blockdetect_8c_source.html)
- `bitplanenoise` measures a selected bit plane. The result depends directly on the selected plane and sample depth, so it is unsuitable as a cross-source strength scale without calibration. [FFmpeg `bitplanenoise` documentation](https://ffmpeg.org/ffmpeg-filters.html#bitplanenoise), [FFmpeg `bitplanenoise` source](https://ffmpeg.org/doxygen/trunk/vf__bitplanenoise_8c_source.html)
- `signalstats` provides luma/chroma percentiles, inter-frame differences, bit-depth measures, temporal-outlier detection, vertical-line repetition, and broadcast-range checks. `YDIF` is simply average per-sample luma difference from the previous frame, so motion and cuts are confounders, not noise evidence. [FFmpeg `signalstats` documentation](https://ffmpeg.org/ffmpeg-filters.html#signalstats)
- `scdet` emits mean absolute frame difference and a scene score; FFmpeg suggests thresholds in the 8–14% range. Use it to exclude cuts from temporal baselines, not to infer a processing recipe. [FFmpeg `scdet` documentation](https://ffmpeg.org/ffmpeg-filters.html#scdet)
- FFmpeg's `deband` filter decides locally whether pixels are similar enough to replace, but that is the filter's operation, not a validated source-level banding detector. [FFmpeg `deband` documentation](https://ffmpeg.org/ffmpeg-filters.html#deband)

Concrete UI output should be relative and inspectable:

- “This segment is softer than most sampled segments” with a jump-to-time action.
- “Possible blocking pattern in these segments” with still comparisons.
- “Low-level texture/noise varies across scenes” rather than a numeric denoise prescription.
- “Banding not automatically verified; inspect smooth gradients at output size.”

BM3D's plugin documentation exposes `sigma` as a processing parameter and shows that Basic and Final are separate estimates with different profiles. It does not define a source-analysis metric that maps footage directly to a safe sigma. Therefore a BM3D strength must remain a user-reviewed starting value. [VapourSynth-BM3D documentation/source](https://github.com/HomeOfVapourSynthEvolution/VapourSynth-BM3D/blob/master/README.md)

## Freeze and decode damage

`freezedetect` measures mean average absolute component differences against a configurable noise floor and reports start/end/duration after a configured hold. It proves only that little changed under those settings. [FFmpeg `freezedetect` documentation](https://ffmpeg.org/ffmpeg-filters.html#freezedetect)

Decode integrity should use a separate full decode pass. FFmpeg supports `-xerror` to stop and exit on an error, `-max_error_rate` to produce exit code 69 after a configured fraction of decode failures, and decoder `err_detect` modes including CRC, bitstream, buffer, and `explode`. FFmpeg frames can also carry `AV_FRAME_FLAG_CORRUPT` and decoder error flags when output was produced despite errors. [FFmpeg command documentation](https://ffmpeg.org/ffmpeg.html), [FFmpeg codec/error-detection documentation](https://ffmpeg.org/ffmpeg-all.html), [FFmpeg frame flags](https://ffmpeg.org/doxygen/trunk/group__lavu__frame__flags.html)

Recommended severity:

- **Info:** static/frozen interval only.
- **Warning:** decoder logged recoverable errors or emitted corrupt/error-marked frames but completed.
- **Error:** strict decode stopped, timestamps are missing/non-monotonic, or the expected end could not be decoded.

BestSource is designed for frame-accurate access and can expose FFmpeg logging, but it documents format-specific seeking/decoding limitations. A successful BestSource open is not a substitute for a full integrity sweep. [BestSource documentation/source](https://github.com/vapoursynth/bestsource/blob/master/README.md)

## Concrete product changes, prioritized

### P0 — prevent harmful automatic choices

1. Make `Apply Suggested Settings` preserve detail by default: denoise Off, sharpen Off, deband Off, restoration Off, motion Original. Let named Looks opt into aesthetic cleanup.
2. Do not auto-select Bwdif from `field_order` metadata alone. Require corroborating multi-window `idet`; otherwise show a review prompt.
3. Replace frame-rate-tag disagreement with decoded timestamp analysis. Label sampled versus full-scan results.
4. Keep untagged color as Unknown. Only auto-suggest PQ/HLG tone mapping from the corresponding transfer tag, and 601→709 from explicit 601-family metadata.

### P1 — make cadence and damage guidance actionable

5. Analyze several moving windows, report confidence and contradictions, and provide jump-to-sample timestamps.
6. Add an IVTC eligibility check using `idet` repeated fields plus VFM/VDecimate dry-run metrics; never auto-enable IVTC from 29.97 fps alone.
7. Separate static-opening detection from decode integrity. Run or offer a background full decode scan and report recoverable versus fatal errors.

### P2 — add visual-quality review aids

8. Add relative blur/block/noise outlier flags only after per-source calibration and scene-cut exclusion. Never translate them directly into BM3D/CAS/deband strengths.
9. Show a processed still A/B preview at output size before applying detail settings across a project. The detector should direct attention; the user should approve the look.

## What not to claim

- “CFR confirmed” from equal `r_frame_rate` and `avg_frame_rate`.
- “Telecine detected” from 29.97 fps or repeated fields alone.
- “HDR” from 10-bit, BT.2020, resolution, brightness, or codec alone.
- “Needs denoise/sharpen/deband” from bitrate, resolution, or one no-reference metric.
- “Decode damage” from a frozen title card or low-motion opening.
- “Field order confirmed” when parity metadata and sampled analysis disagree.

