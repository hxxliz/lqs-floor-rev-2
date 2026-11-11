# Vapormint — Source-Condition → Recipe Methodology

Distilled from 13 community VapourSynth giffing tutorials (2026-11-11).
This is the reference the "brain" (cf_analysis.py) feeds recipe presets from.
Every recommendation below is a *starting point to eyeball*, not a fixed value —
the community's own rule is "experiment and see what works."

## 1. The universal VS chain (what every tutorial converges on)

Order matters. The de-facto standard pipeline across all 13 sources:

    1. Crop          (frame to the region of interest)
    2. Deinterlace   (only if scanType = Interlaced)  -> QTGMC
    3. Debilinear    (only if soft / low-res upscaled) -> descale.Debilinear
    4. Denoise       (only if noise present)           -> KNLMeansCL / BM3D
    5. Sharpen       (after denoise, never before)     -> Finesharp / VCFreq
    6. Crop/position (final framing, e.g. CropRel)

Key principle: **deinterlace first, debilinear second, denoise before sharpen.**
Sharpening a noisy clip amplifies the noise; denoising after sharpening smears
detail. The chain above is the only order the tutorials agree on.

## 2. Footage-type → settings table

| Source condition            | Deinterlace          | Debilinear | Denoise                  | Sharpen        | Why (per tutorials) |
|-----------------------------|----------------------|------------|--------------------------|----------------|---------------------|
| Interlaced TS/TP (stage, music shows) | **QTGMC Slow** (TFF per field order) | off  | light (KNLMeansCL cl=4, param≈1.8) | FineSharp sstr 0.3–0.5 | "TS/TP files must be deinterlaced before you can clip them." QTGMC Slow = the safe default. |
| Telecine (3:2 pull-down, film-origin) | **QTGMC Quality** (or ITC if pure) | off | light | FineSharp | Higher motion-fidelity; Quality preset for the 24->30 pulldown. |
| Soft / low-res (4K-upscaled, <1080p, pixelated) | off (progressive) | **on — Debilinear** | moderate (KNLMeansCL cl=6 param≈1.2–1.8) | VCFreq 0.3–0.4 | "Debilinear is what makes low-res upscaled footage sit softer instead of outlined." Sharpens look "harsh/outlined" without it. |
| Clean 1080p progressive (WEB-DL) | off | off | off or very light | Natural / none | Good master needs almost nothing. Over-processing is the failure mode. |
| Noisy (low bitrate, heavy grain) | per scanType | off | **KNLMeansCL cl=6–8, param 1.5–2.5** | after denoise | Grain must go before any sharpening. |
| Banding (gradients, HDR-SDR, flat skies) | per scanType | off | off | off + **deband** | Distinct-luma-level banding → deband filter, not denoise. |

### QTGMC preset selection
- **Slow** — the default the community uses for normal interlaced video.
  Balanced speed/quality. `haf.QTGMC(video, Preset="Slow", TFF=True)`.
- **Quality** — when you need maximum motion fidelity (music videos with fast
  motion, performance gifs). Slower to render.
- **TFF/BFF** — from field order. `TFF=True` if top field first.
- **Slower** — a few tutorials use `Preset="Slower"` for TS/TP; same idea as
  Quality, even more conservative.
- **Debilinier after QTGMC** — some chains add `descale.Debilinear` after
  QTGMC when the deinterlaced result is still soft.

### Denoise (KNLMeansCL) reference values
`core.knlm.KNLMeansCL(video, prefilter, luma_spatial, pfilter, param, channels="YUV")`

| param (4th arg) | strength | use |
|-----------------|----------|-----|
| 1.0–1.2 | light | clean masters with just a little grain |
| 1.8     | medium | the most-cited "default" value across tutorials |
| 2.5     | strong | noisy sources; watch for waxy skin |

`channels="YUV"` is universal. luma_spatial 4–6, pfilter 2–4.
BM3D is the alternative ("feel free to use BM3D") — stronger, slower.

### Sharpen (Finesharp / VCFreq) reference values
`fun.FineSharp(video, sstr=0.33)` — the most-cited sstr is **0.33**.
- 0.3–0.5 — normal sharpening.
- VCFreq — for soft low-res instead of Finesharp (frequency-based, less
  overshoot on grain).
- **Never sharpen before denoise.**

## 3. What the brain (cf_analysis.py) tells us → which column to pick

cf_analysis.py already produces the fields that select the row above:

- `scanType` (Progressive / Interlaced / Mixed) + `scanEvidence.confidence`
  - Interlaced + High  → QTGMC row
  - Progressive + High → skip deinterlace entirely
- `frameTiming` (cadence: progressive / 3:2 / 2:2 / constant)
  - 3:2 / 2:2 telecine → QTGMC Quality (or ITC)
  - progressive timing + interlaced scan → QTGMC Slow
  - constant (static) → no motion processing
- `noise` (neighbor-diff mean) → denoise strength
  - low → off/light (param 1.0–1.2)
  - mid → KNLMeansCL param 1.8
  - high → param 2.5 + consider BM3D
- `banding` (distinct luma levels) → deband on/off
  - few distinct levels in gradient regions → deband=true
- `qualitySummary` banding/noise text → human-readable confidence

## 4. Per-scene variation (the "it depends on the shot" rule)

The tutorials are explicit that **one setting is not enough for a whole clip** —
each shot needs its own tuning. Vapormint's model (one recipe per clip, with a
brain-derived *starting* recipe) is a pragmatic compromise:

- Brain gives a **safe, conservative starting recipe** from the clip's
  dominant condition.
- The user overrides per-shot. The "detail treatment requires your eyes"
  guidance item (already in shared.ts) exists exactly for this.
- Never auto-max denoise/sharpen. Conservative defaults + user tuning is the
  community standard. Over-sharpening and over-denoising are the two most
  cited failure modes.

## 5. Sizing / output (context, not brain's job)

From quokki / kdramaladies / shuaberriez:
- 1-col = 540px wide, 2-col = 268px, 3-col = 177px (Tumblr column widths).
- <10MB per gif, <3s per gif typical.
- Source: prefer WEB-DL 1080p; TS/TP for stage; 4K facecams fine.
- Output: Y4M / MOV to PS, or PNG frame sequence.

## 6. Source list (provenance)

minsung, fitzsjames ×2, wonwooridul, tinytowns, shuaberriez, sugurugetos,
userdramas, quokki, kdramaladies, ruanbaijie, chenleyah, bangchanz.
Full extracted text: `Documents/LQ's Cutting Floor/vapormint-source/docs/tutorials-raw.md`
(75KB, 13 sections). Raw fetch: `scratch/tumblr_tutorials.md`.

## 7. P2 implementation note

`shared.ts` already has the recipe surface:
- `deinterlaceChoices = ['Off','Bwdif','Bwdif 2×','QTGMC Balanced','QTGMC Quality','Inverse Telecine']`
- `ClipRecipe.deinterlace`, `.restoration` (incl. 'Debilinear'), `.denoise`,
  `.denoiseStrength`, `.sharpen`, `.sharpenStrength`, `.deband`, `.look`
- `applyLook()` maps 5 StudioLooks onto those fields.

P2 = a `deriveRecipe(analysis)` function that reads the brain's
`SourceAnalysis` fields and returns a **suggested** ClipRecipe (conservative,
per the table above), surfaced as a "Brain suggestion" the user can accept or
edit — not a forced override. Map:

- brain Interlaced + progressive timing  → deinterlace 'QTGMC Balanced'
- brain Interlaced + 3:2/2:2 cadence     → deinterlace 'QTGMC Quality'
- brain soft/low-res + progressive       → restoration 'Debilinear', denoise light
- brain high noise                        → denoise 'Fine detail', strength 1.7, sharpen low
- brain banding present                   → deband true
- brain clean progressive                 → deinterlace Off, denoise Off, sharpen Natural low
