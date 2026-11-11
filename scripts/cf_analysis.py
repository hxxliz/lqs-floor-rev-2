#!/usr/bin/env python3
"""cf_analysis.py — source analysis brain for Vapormint (LQ's Cutting Floor 2.0).

Faithful port of the Rust `cf-analysis` crate (pixels.rs + timing.rs) into the
bundled Python runtime. Pure stdlib only: NO numpy, NO OpenCV. Luma frames are
decoded by ffmpeg as raw `gray` (one byte per pixel) and the pixel math runs on
`bytes` objects so indexing stays fast enough inside the bundled 3.12
interpreter.

Two decode passes, exactly like the Rust original:
  * A *spread* pass samples a capped number of luma frames across the timeline
    (or the current clip) and scores comb pixels, distinct luma levels
    (banding), and neighbor-diff (noise) — reporting each as a median.
  * A *cadence* pass decodes up to 60 consecutive luma frames from the clip
    start and measures duplicate pairs (mean-abs-diff < 2.0), held-run variety,
    and period-2 / period-5 fits, which together classify progressive vs
    2:2 / 3:2 telecine (static content does not lock onto the pulldown
    periods).

CLI
  python cf_analysis.py --input FILE \
      --probe '{"duration":123.4,"fps":24,"clipStart":0,"clipSeconds":0}' \
      --ffmpeg C:\\path\\to\\ffmpeg.exe
  Emits one JSON object on stdout:
    { "ok": true, "analysis": {...} }   on success
    { "ok": false, "error": "..." }     on failure
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

# ---------------------------------------------------------------------------
# Sampling constants (mirror pixels.rs / timing.rs)
# ---------------------------------------------------------------------------
MIN_SAMPLES = 8
MAX_SAMPLES = 32             # spread-pass frame cap (kept low: Python math)
COMB_THRESHOLD = 40          # pixels differing from BOTH vertical neighbours
TC_SAMPLE = 30               # consecutive frames for cadence
TC_DUP_EPS = 2.0             # mean-abs-diff below this = a held/duplicate pair
Y_ANALYSIS_W = 640           # spread-pass luma width (keeps the loops fast)
FREEZE_MAD = 1.0             # first-frame mean-abs-diff below this = frozen


# ---------------------------------------------------------------------------
# ffmpeg decode
# ---------------------------------------------------------------------------
class DecodeError(RuntimeError):
    pass


def _ffprobe_bin(ffmpeg: str) -> str:
    base = os.path.basename(ffmpeg).replace("ffmpeg", "ffprobe")
    return os.path.join(os.path.dirname(ffmpeg) or ".", base)


def _run(cmd: List[str], timeout_s: float) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, timeout=timeout_s)
    except subprocess.TimeoutExpired as exc:
        raise DecodeError("decode timeout") from exc


def probe_dims(ffprobe_bin: str, path: str) -> Tuple[int, int]:
    out = _run([ffprobe_bin, "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height", "-of", "json", path], 30.0)
    d = json.loads(out.stdout.decode())
    st = d["streams"][0]
    return int(st["width"]), int(st["height"])


def _decode_luma(ffmpeg: str, path: str, start_s: float, duration_s: float,
                 frames: int, scale_w: int,
                 select: Optional[str] = None) -> Tuple[bytes, int, int, float]:
    """Decode up to `frames` luma frames starting at `start_s`, capped by
    `duration_s` (0 = whole file), scaled to width `scale_w`. An optional
    `select` filter (e.g. "not(mod(n,3))") thins which frames are emitted so a
    capped decode can sample ACROSS a long timeline instead of the first N
    frames. Returns (raw_luma_bytes, out_w, out_h, scale)."""
    ffprobe_bin = _ffprobe_bin(ffmpeg)
    ow, oh = probe_dims(ffprobe_bin, path)
    scale = scale_w / ow
    W = scale_w
    H = max(2, int(round(oh * scale)))
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-an"]
    if start_s > 0:
        cmd += ["-ss", f"{start_s:.3f}"]
    cmd += ["-i", path]
    if duration_s > 0:
        cmd += ["-t", f"{duration_s:.3f}"]
    if select:
        cmd += ["-vf", f"select='{select}',scale={W}:{H},format=gray"]
    else:
        cmd += ["-vf", f"scale={W}:{H},format=gray"]
    if frames:
        cmd += ["-frames:v", str(frames)]
    cmd += ["-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"]
    proc = _run(cmd, 180.0)
    if proc.returncode != 0:
        raise DecodeError(proc.stderr.decode("utf-8", "replace").strip()[:400])
    return proc.stdout, W, H, scale


# ---------------------------------------------------------------------------
# Pixel metrics (pure functions on luma bytes; mirror pixels.rs exactly)
# ---------------------------------------------------------------------------
def comb_pixels(frame: bytes, w: int, h: int) -> int:
    """Luma pixels differing from BOTH vertical neighbours by > COMB_THRESHOLD
    — the interlace comb-edge signal. Interlacing -> thousands; progressive
    stays near its fine-detail floor."""
    if h < 3:
        return 0
    thr = COMB_THRESHOLD
    n = 0
    for y in range(1, h - 1):
        up = (y - 1) * w
        mid = y * w
        dn = (y + 1) * w
        for x in range(w):
            m = frame[mid + x]
            if abs(m - frame[up + x]) > thr and abs(m - frame[dn + x]) > thr:
                n += 1
    return n


def distinct_luma_levels(frame: bytes) -> int:
    """Distinct luma byte levels present (banding: a collapsed palette yields
    few; real video uses nearly all 256)."""
    present = bytearray(256)
    for b in frame:
        present[b] = 1
    return sum(present)


def neighbor_diff(frame: bytes, w: int, h: int) -> float:
    """Mean absolute difference between horizontally and vertically adjacent
    luma pixels (high-frequency energy). High = noise; low = soft."""
    total = 0
    n = 0
    if w >= 2:
        for y in range(h):
            row = y * w
            for x in range(w - 1):
                total += abs(frame[row + x] - frame[row + x + 1])
                n += 1
    if h >= 2:
        for y in range(h - 1):
            a = y * w
            b = (y + 1) * w
            for x in range(w):
                total += abs(frame[a + x] - frame[b + x])
                n += 1
    return total / n if n else 0.0


def frame_mad(a: bytes, b: bytes) -> float:
    """Mean absolute difference between two same-size luma frames (0 =
    identical)."""
    n = min(len(a), len(b))
    if n == 0:
        return 0.0
    total = 0
    for i in range(n):
        total += abs(a[i] - b[i])
    return total / n


# ---------------------------------------------------------------------------
# Cadence math (pure functions; mirror the timing.rs unit-tested math)
# ---------------------------------------------------------------------------
def dup_fraction_of(dups: List[bool]) -> float:
    if not dups:
        return 0.0
    return sum(1 for d in dups if d) / len(dups)


def run_variety_of(dups: List[bool]) -> int:
    """1 when held-run lengths are mixed (1+2 -> 3:2), 0 when uniform
    (all-1 progressive, all-2 -> 2:2)."""
    runs: List[int] = []
    cur = 1
    for d in dups:
        if d:
            cur += 1
        else:
            runs.append(cur)
            cur = 1
    runs.append(cur)
    return 1 if len(set(runs)) > 1 else 0


def period_fit_of(dups: List[bool], period: int) -> float:
    """Fraction of positions i (i >= period) where dups[i] == dups[i-period].
    A real 2:2 pulldown is period 2 (fit ~1.0); a real 3:2 pulldown is period 5
    (fit ~1.0). Static content and ordinary motion/noise do not lock on
    (fit ~0.5 or 0.0)."""
    n = len(dups)
    if n <= period:
        return 0.0
    hits = sum(1 for i in range(period, n) if dups[i] == dups[i - period])
    return hits / (n - period)


@dataclass
class Cadence:
    frames: int = 0
    dup_fraction: float = 0.0
    run_variety: int = 0
    period2_fit: float = 0.0
    period5_fit: float = 0.0
    kind: str = "Unknown"
    confidence: str = "Low"
    detail: str = ""


def _classify_cadence(dup_frac: float, variety: int, p2: float, p5: float) -> Tuple[str, str, str]:
    if dup_frac >= 0.95:
        return "Constant sample", "High", f"static/frozen content (dup fraction {dup_frac:.2f})"
    if p5 >= 0.85 and dup_frac >= 0.18:
        return "Variable sample", "High", f"3:2 pull-up (period-5 fit {p5:.2f})"
    if p2 >= 0.85 and dup_frac >= 0.40:
        return "Variable sample", "High", f"2:2 / euro pulse (period-2 fit {p2:.2f})"
    if dup_frac <= 0.05:
        return "Constant sample", "High", f"progressive (dup fraction {dup_frac:.2f})"
    if dup_frac > 0.2:
        return "Variable sample", "Low", f"holds present (dup {dup_frac:.2f}) but no pulldown period lock"
    return "Unknown", "Medium", f"ambiguous (dup {dup_frac:.2f}, period2 {p2:.2f}, period5 {p5:.2f})"


@dataclass
class Frame:
    raw: bytes
    w: int
    h: int
    comb: int = 0
    levels: int = 0
    ndiff: float = 0.0


# ---------------------------------------------------------------------------
# Decode + analyze
# ---------------------------------------------------------------------------
def _frames_from(raw: bytes, w: int, h: int) -> List[Frame]:
    stride = w * h
    n = len(raw) // stride
    out: List[Frame] = []
    for i in range(n):
        s = i * stride
        out.append(Frame(raw[s:s + stride], w, h))
    return out


def analyze(ffmpeg: str, path: str, duration_s: float, fps: float,
            clip_start: float = 0.0, clip_seconds: float = 0.0) -> dict:
    ow, oh = probe_dims(_ffprobe_bin(ffmpeg), path)
    total_frames = int(round(max(duration_s, 0.0) * max(fps, 1.0)))

    # ---- spread pass (comb / banding / noise medians) ----
    target = max(MIN_SAMPLES, min(total_frames, MAX_SAMPLES)) if total_frames else MIN_SAMPLES
    spread_seconds = clip_seconds if clip_seconds > 0 else 0.0
    # Thin the sampled frames across the (clip or whole-file) timeline: decode
    # only 1 in `k` frames so a 1-hour clip still costs ~MAX_SAMPLES frames of
    # Python math instead of the first N.
    available = int(round(spread_seconds * max(fps, 1.0))) if spread_seconds > 0 else total_frames
    k = max(1, (available // target) if (available and target) else 1)
    select = f"not(mod(n,{k}))" if k > 1 else None
    try:
        raw, W, H, _scale = _decode_luma(ffmpeg, path, clip_start, spread_seconds,
                                         target, Y_ANALYSIS_W, select)
        frames = _frames_from(raw, W, H)
    except DecodeError:
        frames = []
    if not frames:
        raise DecodeError("no luma frames decoded for the spread pass")
    for f in frames:
        f.comb = comb_pixels(f.raw, f.w, f.h)
        f.levels = distinct_luma_levels(f.raw)
        f.ndiff = neighbor_diff(f.raw, f.w, f.h)
    comb_med = statistics.median(f.comb for f in frames)
    levels_med = statistics.median(f.levels for f in frames)
    ndiff_med = statistics.median(f.ndiff for f in frames)

    # ---- cadence pass (consecutive frames from clip/file start) ----
    cad = Cadence()
    try:
        raw, W, H, _ = _decode_luma(ffmpeg, path, clip_start, clip_seconds,
                                    TC_SAMPLE, Y_ANALYSIS_W)
        f2 = _frames_from(raw, W, H)
    except DecodeError:
        f2 = []
    if len(f2) >= 2:
        dups: List[bool] = []
        for i in range(1, len(f2)):
            dups.append(frame_mad(f2[i - 1].raw, f2[i].raw) < TC_DUP_EPS)
        cad.frames = len(f2)
        cad.dup_fraction = dup_fraction_of(dups)
        cad.run_variety = run_variety_of(dups)
        cad.period2_fit = period_fit_of(dups, 2)
        cad.period5_fit = period_fit_of(dups, 5)
        cad.kind, cad.confidence, cad.detail = _classify_cadence(
            cad.dup_fraction, cad.run_variety, cad.period2_fit, cad.period5_fit)

    # ---- opening / freeze (first consecutive pair) ----
    if len(f2) >= 2:
        freeze_mad = frame_mad(f2[0].raw, f2[1].raw)
    else:
        freeze_mad = frame_mad(frames[0].raw, frames[1].raw) if len(frames) >= 2 else 0.0
    opening_issue = ("Opening frames look static/frozen." if freeze_mad < FREEZE_MAD else None)

    # ---- banding verdict from distinct levels ----
    # Emits a 0-255 "palette-collapse" score (0 = healthy full palette, 255 =
    # fully collapsed) so the TS recipe/guidance thresholds (>=20 strong,
    # >=8 mild) read in 8-bit units.
    if levels_med < 32:
        banding = int(round((1.0 - levels_med / 32.0) * 255))
        banding_note = "severe banding (collapsed luma palette)"
    elif levels_med < 96:
        banding = int(round((96 - levels_med) / 96.0 * 127))
        banding_note = "mild banding / limited palette"
    else:
        banding = 0
        banding_note = None

    scan_kind = "Interlaced" if comb_med >= 400 else "Progressive"
    analysis = {
        "scanType": scan_kind,
        "scanEvidence": {
            "sampledFrames": len(frames),
            "sampledSeconds": round(spread_seconds or duration_s, 2),
            "combPixelsMedian": int(comb_med),
            "distinctLumaLevelsMedian": int(levels_med),
            "neighborDiffMedian": round(ndiff_med, 3),
            "classification": scan_kind,
            "confidence": ("High" if comb_med >= 400 else "Medium"),
        },
        "frameTiming": {
            "sampledFrames": cad.frames,
            "dupFraction": round(cad.dup_fraction, 4),
            "runVariety": cad.run_variety,
            "period2Fit": round(cad.period2_fit, 3),
            "period5Fit": round(cad.period5_fit, 3),
            "kind": cad.kind,
            "confidence": cad.confidence,
            "detail": cad.detail or "not enough consecutive frames for cadence",
        },
        "banding": banding,
        "bandingNote": banding_note,
        "noise": round(ndiff_med, 3),
        "openingIssue": opening_issue,
        "qualitySummary": (
            f"scan={'Interlaced' if comb_med >= 400 else 'Progressive'}, "
            f"timing={cad.kind or 'Unknown'}, banding={banding}, noise={ndiff_med:.1f}"
        ),
    }
    return analysis


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--probe", default="{}")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    args = ap.parse_args(argv)
    probe = json.loads(args.probe)
    duration_s = float(probe.get("duration", 0) or 0)
    fps = float(probe.get("fps", 24) or 24)
    clip_start = float(probe.get("clipStart", 0) or 0)
    clip_seconds = float(probe.get("clipSeconds", 0) or 0)
    try:
        out = analyze(args.ffmpeg, args.input, duration_s, fps, clip_start, clip_seconds)
        print(json.dumps({"ok": True, "analysis": out}))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
