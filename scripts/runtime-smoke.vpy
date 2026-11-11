import vapoursynth as vs
from vsdeinterlace import QTempGaussMC

core = vs.core
clip = core.bs.VideoSource(source=source, cachemode=0)
clip = clip[:12]
source_420 = core.resize.Spline36(clip, format=vs.YUV420P8)
source_float = core.resize.Spline36(clip, width=128, height=72, format=vs.YUV444PS)
source_16 = core.resize.Spline36(source_float, format=vs.YUV444P16)

checks = [
    core.bwdif.Bwdif(source_420, field=1),
    QTempGaussMC(prefilter_tr=1, analyze_refine=0, basic_tr=1, final_tr=0).deinterlace(source_420, tff=True),
    core.vivtc.VDecimate(core.vivtc.VFM(source_420, order=1, field=2, mode=1, clip2=source_420)),
    core.descale.Debilinear(source_float, width=96, height=54),
]
for check in checks:
    check.get_frame(0)

clip = core.bm3d.Basic(source_16, profile="fast", sigma=[1.6, 0.8, 0.8])
clip = core.cas.CAS(clip, sharpness=0.25)
super_clip = core.mv.Super(clip, pel=2)
backward = core.mv.Analyse(super_clip, isb=True, delta=1, overlap=4)
forward = core.mv.Analyse(super_clip, isb=False, delta=1, overlap=4)
clip = core.mv.FlowFPS(clip, super_clip, backward, forward, num=30, den=1, blend=True)
core.resize.Spline36(clip, format=vs.YUV420P8).set_output()
