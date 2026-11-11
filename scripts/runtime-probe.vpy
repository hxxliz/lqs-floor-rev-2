import vapoursynth as vs
from vsdeinterlace import QTempGaussMC

core = vs.core
required = {
    "BestSource": (core.bs, "VideoSource"),
    "BM3D": (core.bm3d, "Basic"),
    "Bwdif": (core.bwdif, "Bwdif"),
    "CAS": (core.cas, "CAS"),
    "Descale": (core.descale, "Debilinear"),
    "MVTools": (core.mv, "FlowFPS"),
    "MVUtensils": (core.mvu, "Super"),
    "Resize2": (core.resize2, "Bob"),
    "VIVTC": (core.vivtc, "VFM"),
    "ZNEDI3": (core.znedi3, "nnedi3"),
}
missing = [name for name, (plugin, function) in required.items() if not hasattr(plugin, function)]
if missing:
    raise RuntimeError("Missing VapourSynth plugins: " + ", ".join(missing))

clip = core.std.BlankClip(width=64, height=64, length=1, format=vs.YUV420P8)
clip.set_output()
