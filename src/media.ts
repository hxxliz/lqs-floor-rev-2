import { app } from 'electron';
import { access, mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { constants, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { assertPublicVideoUrl, downloadCookieArguments, downloadFailureMessage, frameTimingEvidence, outputDimensions, runtimeVersionArguments, scanEvidenceFromSamples, type ClipRecipe, type DownloadBrowser, type ExportRequest, type FrameTimingEvidence, type GuidanceConfidence, type RuntimeStatus, type SourceAnalysis, type StudioSource, type TaskProgress } from './shared';

export interface ProcessingResult {
  engine: 'VapourSynth' | 'FFmpeg compatibility';
  fallbackReason?: string;
  pngFramesPath?: string;
  warnings?: string[];
}

const children = new Set<ReturnType<typeof spawn>>();

function stopChild(child: ReturnType<typeof spawn>) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false }).unref();
  else child.kill();
}

function spawnTool(command: string, args: string[], signal?: AbortSignal) {
  const child = spawn(command, args, { windowsHide: true, shell: false, signal, env: environmentFor(command) });
  const stop = () => stopChild(child);
  children.add(child);
  signal?.addEventListener('abort', stop, { once: true });
  child.once('close', () => { children.delete(child); signal?.removeEventListener('abort', stop); });
  return child;
}

export function stopMediaProcesses() {
  for (const child of children) stopChild(child);
  children.clear();
}

const executableName = (name: string) => process.platform === 'win32' ? `${name}.exe` : name;

async function executable(name: string) {
  const file = executableName(name);
  const roots = [
    path.join(process.resourcesPath, 'runtime', `${process.platform}-${process.arch}`),
    path.join(app.getAppPath(), 'runtime', `${process.platform}-${process.arch}`),
  ];
  const candidates = roots.flatMap((root) => name === 'vspipe'
    ? [path.join(root, 'Lib', 'site-packages', 'vapoursynth', file), path.join(root, file)]
    : [path.join(root, file)]);
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch { /* Try the next packaged location. */ }
  }
  return file;
}

function environmentFor(command: string) {
  const folder = path.dirname(command);
  if (folder === '.') return process.env;
  const marker = `${path.sep}lib${path.sep}site-packages${path.sep}vapoursynth`;
  const markerIndex = command.toLowerCase().indexOf(marker);
  if (markerIndex < 0) return { ...process.env, PATH: `${folder}${path.delimiter}${process.env.PATH ?? ''}` };
  const root = command.slice(0, markerIndex);
  return { ...process.env, PATH: [folder, root, process.env.PATH ?? ''].join(path.delimiter), PYTHONHOME: root, PYTHONPATH: path.join(root, 'Lib', 'site-packages') };
}

function capture(command: string, args: string[], signal?: AbortSignal) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawnTool(command, args, signal);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}`)));
  });
}

const pluginProbe = `import vapoursynth as vs
from vsdeinterlace import QTempGaussMC
core = vs.core
required = {"BestSource": (core.bs, "VideoSource"), "BM3D": (core.bm3d, "Basic"), "Bwdif": (core.bwdif, "Bwdif"), "CAS": (core.cas, "CAS"), "Descale": (core.descale, "Debilinear"), "MVTools": (core.mv, "FlowFPS"), "MVUtensils": (core.mvu, "Super"), "Resize2": (core.resize2, "Bob"), "VIVTC": (core.vivtc, "VFM"), "ZNEDI3": (core.znedi3, "nnedi3")}
missing = [name for name, (plugin, function) in required.items() if not hasattr(plugin, function)]
if missing: raise RuntimeError("Missing VapourSynth plugins: " + ", ".join(missing))
core.std.BlankClip(width=64, height=64, length=1, format=vs.YUV420P8).set_output()
`;

async function verifyPlugins(vspipe: string) {
  const folder = await mkdtemp(path.join(tmpdir(), 'cutting-floor-runtime-'));
  const script = path.join(folder, 'probe.vpy');
  try {
    await writeFile(script, pluginProbe, 'utf8');
    await capture(vspipe, ['--info', script, '-']);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

// Locate the bundled ffprobe + the cf_analysis.py brain script. The brain lives
// next to the app source (scripts/cf_analysis.py) in dev and is copied into
// resources/ at build time (see package.json "files").
function brainPaths() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '..', 'scripts', 'cf_analysis.py'),
    path.join(here, 'scripts', 'cf_analysis.py'),
    path.join(process.resourcesPath, 'scripts', 'cf_analysis.py'),
    path.join(app.getAppPath(), 'scripts', 'cf_analysis.py'),
  ];
  for (const candidate of candidates) { try { if (existsSync(candidate)) return candidate; } catch { /* keep searching */ } }
  return candidates[0];
}

interface BrainResult {
  scanType?: 'Interlaced' | 'Progressive';
  scanEvidence?: Record<string, unknown>;
  frameTiming?: Record<string, unknown>;
  banding?: number;
  bandingNote?: string;
  noise?: number;
  openingIssue?: string;
}

// Run the pure-Python pixel-analysis brain (scripts/cf_analysis.py) against the
// source. It decodes luma frames with ffmpeg and measures interlace comb, luma
// banding, sensor noise, and telecine cadence — richer than the idet/freezedetect
// probe — and returns the parts probeMedia should let override its fallback.
// Best-effort: any failure (missing runtime/python/ffmpeg) returns {} so the
// ffprobe+idet analysis still stands on its own.
async function runBrain(sourcePath: string, probe: Record<string, unknown>, signal?: AbortSignal): Promise<BrainResult> {
  const script = brainPaths();
  if (!existsSync(script)) return {}; // brain script not present; use the classic probe.
  try {
    const { stdout } = await capture('python', [script, '--input', sourcePath, '--probe', JSON.stringify(probe), '--ffmpeg', await executable('ffmpeg')], signal);
    const parsed = JSON.parse(stdout) as { ok: boolean; error?: string; analysis?: BrainResult };
    if (!parsed.ok || !parsed.analysis) return {};
    return parsed.analysis;
  } catch (error) {
    if (signal?.aborted) throw error;
    return {}; // brain is an enhancement, never a hard dependency.
  }
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const tools = [['ffmpeg', 'ffmpeg'], ['ffprobe', 'ffprobe'], ['vspipe', 'vspipe'], ['ytDlp', 'yt-dlp']] as const;
  const entries = await Promise.all(tools.map(async ([key, name]) => {
    try {
      await capture(await executable(name), runtimeVersionArguments(name));
      return [key, true] as const;
    } catch {
      return [key, false] as const;
    }
  }));
  const status = Object.fromEntries(entries) as Pick<RuntimeStatus, 'ffmpeg' | 'ffprobe' | 'vspipe' | 'ytDlp'>;
  try {
    if (!status.vspipe) throw new Error('VSPipe is unavailable.');
    await verifyPlugins(await executable('vspipe'));
    return { ...status, vapourSynthPlugins: true };
  } catch (error) {
    return { ...status, vapourSynthPlugins: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function probeMedia(sourcePath: string, signal?: AbortSignal): Promise<SourceAnalysis> {
  const { stdout } = await capture(await executable('ffprobe'), [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'format=duration,bit_rate,format_name:stream=width,height,avg_frame_rate,r_frame_rate,codec_name,pix_fmt,bits_per_raw_sample,bits_per_sample,color_space,color_transfer,color_primaries,color_range,chroma_location,field_order',
    '-of', 'json', sourcePath,
  ], signal);
  const result = JSON.parse(stdout) as { format?: Record<string, string>; streams?: Array<Record<string, string | number>> };
  const stream = result.streams?.[0] ?? {};
  const rate = (value: unknown) => { const [n, d] = String(value ?? '0/1').split('/').map(Number); return d ? n / d : 0; };
  const fps = rate(stream.avg_frame_rate);
  const duration = Number(result.format?.duration ?? 0);
  const pixelFormat = String(stream.pix_fmt ?? 'unknown');
  const colorTransfer = String(stream.color_transfer ?? 'unknown');
  const fieldOrder = String(stream.field_order ?? 'unknown');
  const bitDepth = Number(stream.bits_per_raw_sample || stream.bits_per_sample || pixelFormat.match(/(?:p|yuv)\D*(10|12|16)/i)?.[1] || 8);
  const hdr = /smpte2084|pq/i.test(colorTransfer) ? 'HDR PQ' : /arib-std-b67|hlg/i.test(colorTransfer) ? 'HDR HLG' : colorTransfer === 'unknown' ? 'Unknown' : 'SDR';
  const scanType = /^(tt|bb|tb|bt)$/i.test(fieldOrder) ? 'Interlaced' : fieldOrder === 'progressive' ? 'Progressive' : 'Unknown';
  const starts = [...new Set([0, Math.max(0, duration / 2 - 1.5), Math.max(0, duration - 3)].map((value) => Number(value.toFixed(3))))].filter((value) => value < Math.max(duration, 0.001));
  const scanOutputs: string[] = [];
  const timestampSamples: number[][] = [];
  let failedSamples = 0;
  let frozenSamples = 0;
  for (const start of starts) {
    try {
      const scan = await capture(await executable('ffmpeg'), ['-hide_banner', '-v', 'info', '-ss', String(start), '-t', '3', '-i', sourcePath, '-map', '0:v:0', '-vf', 'idet,freezedetect=n=-50dB:d=1,showinfo', '-an', '-f', 'null', '-'], signal);
      scanOutputs.push(scan.stderr);
      if (/freeze_start:/i.test(scan.stderr)) frozenSamples += 1;
      timestampSamples.push([...scan.stderr.matchAll(/\bpts_time:([\d.-]+)/g)].map((match) => Number(match[1])).filter(Number.isFinite));
    } catch (error) {
      if (signal?.aborted) throw error;
      failedSamples += 1;
    }
  }
  const scanEvidence = scanEvidenceFromSamples(scanOutputs, scanOutputs.length * 3);
  const frameTiming = frameTimingEvidence(timestampSamples);
  const analysis: SourceAnalysis = {
    duration,
    width: Number(stream.width ?? 0),
    height: Number(stream.height ?? 0),
    fps,
    codec: String(stream.codec_name ?? 'unknown'),
    format: String(result.format?.format_name ?? 'unknown'),
    pixelFormat,
    bitDepth,
    bitrate: Number(result.format?.bit_rate ?? 0),
    colorSpace: String(stream.color_space ?? 'unknown'),
    colorTransfer,
    colorPrimaries: String(stream.color_primaries ?? 'unknown'),
    colorRange: String(stream.color_range ?? 'unknown'),
    chromaLocation: String(stream.chroma_location ?? 'unknown'),
    hdr,
    scanType,
    fieldOrder,
    variableFrameRate: frameTiming.kind === 'Variable sample',
    frameTiming,
    scanEvidence,
    decodeIssue: failedSamples ? `${failedSamples} of ${starts.length} distributed sample decodes failed.` : undefined,
    freezeSample: frozenSamples ? `${frozenSamples} of ${scanOutputs.length} sampled windows contained at least one low-motion interval.` : undefined,
    qualitySummary: '',
  };
  // Run the pure-Python pixel-analysis brain: it measures interlace comb,
  // luma banding, sensor noise, and telecine cadence directly from decoded
  // luma frames — richer than the idet/freezedetect probe above. Strong
  // evidence overrides the metadata-only scan type and upgrades frame timing;
  // any failure degrades gracefully to the idet/ffprobe analysis.
  const brain = await runBrain(sourcePath, { duration, fps }, signal);
  const brainTiming = brain.frameTiming as FrameTimingEvidence | undefined;
  const brainConfidence = (brain.scanEvidence as Record<string, unknown> | undefined)?.confidence as GuidanceConfidence | undefined;
  if (brain.scanType === 'Interlaced' && brainConfidence === 'High') {
    analysis.scanType = 'Interlaced';
  } else if (brain.scanType === 'Progressive' && brainConfidence === 'High' && analysis.scanType !== 'Interlaced') {
    analysis.scanType = 'Progressive';
  }
  // Frame timing is its own high-confidence signal — merge it independently of
  // the scan-type verdict (cadence evidence applies even when the scan type
  // stays as the metadata already reported).
  if (brainTiming && brainTiming.confidence === 'High') {
    analysis.frameTiming = brainTiming;
  }
  // Carry the brain's measured luma defects onto the analysis so the evidence
  // recipe (suggestedRecipePatch) and the renderer can act on them. banding is
  // a 0-255 palette-collapse score, noise a neighbor-diff median.
  if (typeof brain.banding === 'number') analysis.banding = brain.banding;
  if (typeof brain.noise === 'number') analysis.noise = brain.noise;
  if (brain.bandingNote) analysis.bandingNote = brain.bandingNote;
  const details = [`${analysis.width}×${analysis.height}`, `${analysis.fps.toFixed(3)} fps`, `${analysis.bitDepth}-bit ${analysis.pixelFormat}`, analysis.hdr, analysis.scanType, `banding ${brain.banding ?? 'n/a'}`, `noise ${brain.noise ?? 'n/a'}`];
  analysis.qualitySummary = details.join(' · ');
  return analysis;
}

function needsPlaybackCopy(sourcePath: string, analysis: SourceAnalysis) {
  return !['h264', 'vp8', 'vp9', 'av1'].includes(analysis.codec.toLowerCase()) || !['.mp4', '.m4v', '.mov', '.webm'].includes(path.extname(sourcePath).toLowerCase()) || analysis.width > 3840;
}

export async function prepareSource(sourcePath: string, episodeLabel: string, projectFolder: string, onProgress: (progress: TaskProgress) => void = () => {}, signal?: AbortSignal) {
  await access(sourcePath, constants.R_OK);
  onProgress({ percent: 5, message: `Analyzing ${path.basename(sourcePath)}` });
  const sourceAnalysis = await probeMedia(sourcePath, signal);
  const id = crypto.randomUUID();
  const thumbnails = path.join(projectFolder, 'Thumbnails');
  const playback = path.join(projectFolder, 'Playback Copies');
  await mkdir(thumbnails, { recursive: true });
  const thumbnailPath = path.join(thumbnails, `${id}.jpg`);
  let thumbnailUrl: string | undefined;
  try {
    await capture(await executable('ffmpeg'), ['-hide_banner', '-v', 'error', '-y', '-ss', Math.min(30, sourceAnalysis.duration / 3).toFixed(3), '-i', sourcePath, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', thumbnailPath], signal);
    thumbnailUrl = pathToFileURL(thumbnailPath).href;
  } catch (error) {
    if (signal?.aborted) throw error;
    /* A missing thumbnail must not block source import. */
  }
  let playbackPath: string | undefined;
  if (needsPlaybackCopy(sourcePath, sourceAnalysis)) {
    await mkdir(playback, { recursive: true });
    playbackPath = path.join(playback, `${id}.mp4`);
    onProgress({ percent: 35, message: `Creating playback copy for ${path.basename(sourcePath)}` });
    try {
      await runFfmpeg(await executable('ffmpeg'), ['-hide_banner', '-y', '-i', sourcePath, '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'scale=w=min(1920\\,iw):h=-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-progress', 'pipe:2', playbackPath], sourceAnalysis.duration, signal ?? new AbortController().signal, (percent, message) => onProgress({ percent: 35 + percent * 0.6, message }), 'Creating playback copy');
    } catch (error) {
      if (signal?.aborted) throw error;
      await rm(playbackPath, { force: true });
      throw new Error(`A playback copy could not be created for ${path.basename(sourcePath)}. The original is safe. Check available disk space and try importing it again. ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  onProgress({ percent: 100, message: `Ready: ${episodeLabel}` });
  return {
    id, sourcePath, playbackPath, thumbnailPath, fileUrl: pathToFileURL(playbackPath ?? sourcePath).href,
    thumbnailUrl, displayName: path.basename(sourcePath, path.extname(sourcePath)),
    episodeLabel, progress: 0, finished: false, missing: false, sourceAnalysis,
  } satisfies StudioSource;
}

export async function downloadPublicVideo(value: string, downloadFolder: string, signal: AbortSignal, onProgress: (progress: TaskProgress) => void, browser: DownloadBrowser = 'none') {
  const url = assertPublicVideoUrl(value);
  await mkdir(downloadFolder, { recursive: true });
  const command = await executable('yt-dlp');
  const ffmpegFolder = path.dirname(await executable('ffmpeg'));
  const args = ['--no-playlist', '--newline', '--restrict-filenames', '--no-overwrites', '--continue', '--ffmpeg-location', ffmpegFolder, ...downloadCookieArguments(browser), '-f', 'bv*+ba/b', '--merge-output-format', 'mkv', '-P', downloadFolder, '-o', '%(title).180B [%(id)s].%(ext)s', '--print', 'after_move:filepath', url];
  return new Promise<string>((resolve, reject) => {
    const child = spawnTool(command, args, signal);
    let output = '';
    let errors = '';
    const collect = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      errors = `${errors}${text}`.slice(-12000);
      const percent = Number(text.match(/\[download\]\s+([\d.]+)%/)?.[1]);
      if (Number.isFinite(percent)) onProgress({ percent, message: 'Downloading source master' });
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', async (code) => {
      if (code !== 0) return reject(new Error(downloadFailureMessage(errors, browser)));
      const candidates = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse();
      for (const candidate of candidates) {
        try { if ((await stat(candidate)).isFile()) return resolve(candidate); } catch { /* Keep searching output lines. */ }
      }
      reject(new Error('The download finished but the source master could not be located.'));
    });
  });
}

const py = (value: string) => JSON.stringify(value);

function resolvedColor(recipe: ClipRecipe, sourceColor: string) {
  if (recipe.colorManagement !== 'Auto') return recipe.colorManagement;
  if (/pq|smpte2084/i.test(sourceColor)) return 'HDR PQ to SDR';
  if (/hlg|arib-std-b67/i.test(sourceColor)) return 'HDR HLG to SDR';
  if (/601|170m/i.test(sourceColor)) return 'Convert 601 to 709';
  return 'SDR Rec.709';
}

function colorFilters(recipe: ClipRecipe, sourceColor: string) {
  const choice = resolvedColor(recipe, sourceColor);
  if (choice === 'Preserve') {
    if (/pq|smpte2084/i.test(sourceColor)) return ['setparams=colorspace=bt2020nc:color_primaries=bt2020:color_trc=smpte2084:range=limited'];
    if (/hlg|arib-std-b67/i.test(sourceColor)) return ['setparams=colorspace=bt2020nc:color_primaries=bt2020:color_trc=arib-std-b67:range=limited'];
    if (/601|170m/i.test(sourceColor)) return ['setparams=colorspace=smpte170m:color_primaries=smpte170m:color_trc=bt709:range=limited'];
    if (/709/i.test(sourceColor)) return ['setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=limited'];
    return [];
  }
  if (choice === 'Convert 601 to 709') return ['zscale=matrixin=smpte170m:transferin=bt709:primariesin=smpte170m:rangein=limited:matrix=bt709:transfer=bt709:primaries=bt709:range=limited:dither=error_diffusion'];
  if (choice === 'HDR PQ to SDR') return ['zscale=matrixin=bt2020nc:transferin=smpte2084:primariesin=bt2020:rangein=limited:matrix=gbr:transfer=linear:primaries=bt2020:npl=100', 'format=gbrpf32le', 'tonemap=hable:desat=2', 'zscale=matrix=bt709:transfer=bt709:primaries=bt709:range=limited:dither=error_diffusion'];
  if (choice === 'HDR HLG to SDR') return ['zscale=matrixin=bt2020nc:transferin=arib-std-b67:primariesin=bt2020:rangein=limited:matrix=gbr:transfer=linear:primaries=bt2020:npl=100', 'format=gbrpf32le', 'tonemap=hable:desat=2', 'zscale=matrix=bt709:transfer=bt709:primaries=bt709:range=limited:dither=error_diffusion'];
  return ['setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=limited'];
}

function colorEncodingArguments(recipe: ClipRecipe, sourceColor: string) {
  const choice = resolvedColor(recipe, sourceColor);
  if (choice === 'Preserve') {
    if (/pq|smpte2084/i.test(sourceColor)) return ['-color_primaries', 'bt2020', '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc', '-color_range', 'tv'];
    if (/hlg|arib-std-b67/i.test(sourceColor)) return ['-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc', '-color_range', 'tv'];
    if (/601|170m/i.test(sourceColor)) return ['-color_primaries', 'smpte170m', '-color_trc', 'bt709', '-colorspace', 'smpte170m', '-color_range', 'tv'];
  }
  return ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];
}

export function compileVapourSynthScript(request: ExportRequest) {
  const { source, clip } = request;
  const recipe = clip.recipe;
  const analysis = source.sourceAnalysis;
  const size = outputDimensions(recipe, analysis.width, analysis.height);
  const matrix = analysis.hdr === 'HDR PQ' || analysis.hdr === 'HDR HLG' || /2020/i.test(analysis.colorSpace) ? '2020ncl' : /601|170m/i.test(analysis.colorSpace) ? '170m' : '709';
  const topField = recipe.fieldOrder !== 'Bottom first';
  const widthRatio = Math.max(0.02, 1 - recipe.cropLeft - recipe.cropRight);
  const heightRatio = Math.max(0.02, 1 - recipe.cropTop - recipe.cropBottom);
  const lines = [
    "# LQ's Cutting Floor — generated VapourSynth recipe",
    '# Plugins: BestSource, QTGMC, VIVTC, BM3D, Bwdif, CAS, MVTools, Descale, core.resize',
    'import vapoursynth as vs',
  ];
  if (recipe.deinterlace.startsWith('QTGMC')) lines.push('from vsdeinterlace import QTempGaussMC');
  lines.push('core = vs.core', `clip = core.bs.VideoSource(source=${py(source.sourcePath)}, cachemode=0)`, 'if clip.format.color_family == vs.RGB:', `    clip = core.resize.Spline36(clip, format=vs.YUV444P16, matrix_s=${py(matrix)})`, '# Cadence/deinterlace runs before trimming so neighboring frames remain available.');
  if (recipe.deinterlace === 'Off') lines.push('# Progressive workflow: deinterlacing is disabled.');
  if (recipe.deinterlace === 'Bwdif') lines.push(`clip = core.bwdif.Bwdif(clip, field=${topField ? 1 : 0})`);
  if (recipe.deinterlace === 'Bwdif 2×') lines.push(`clip = core.bwdif.Bwdif(clip, field=${topField ? 3 : 2})`);
  if (recipe.deinterlace === 'QTGMC Balanced') lines.push(`clip = QTempGaussMC(prefilter_tr=1, analyze_refine=0, basic_tr=1, final_tr=0).deinterlace(clip, tff=${topField ? 'True' : 'False'})`);
  if (recipe.deinterlace === 'QTGMC Quality') lines.push(`clip = QTempGaussMC().deinterlace(clip, tff=${topField ? 'True' : 'False'})`);
  if (recipe.deinterlace === 'Inverse Telecine') lines.push('original = clip', 'match_input = core.resize.Bicubic(original, format=vs.YUV420P8)', `matched = core.vivtc.VFM(match_input, order=${topField ? 1 : 0}, field=2, mode=1, clip2=original)`, 'clip = core.vivtc.VDecimate(matched)');
  if (recipe.rotation === 90) lines.push('clip = core.std.Transpose(clip)', 'clip = core.std.FlipHorizontal(clip)');
  if (recipe.rotation === 180) lines.push('clip = core.std.FlipVertical(core.std.FlipHorizontal(clip))');
  if (recipe.rotation === 270) lines.push('clip = core.std.Transpose(clip)', 'clip = core.std.FlipVertical(clip)');
  lines.push(
    'fps = clip.fps_num / clip.fps_den',
    `first = max(0, int(round(${clip.start.toFixed(9)} * fps)))`,
    `last = min(clip.num_frames, max(first + 1, int(round(${clip.end.toFixed(9)} * fps))))`,
    'clip = clip[first:last]',
    'clip = core.resize.Spline36(clip, format=vs.YUV444PS)',
    `crop_left = clip.width * ${recipe.cropLeft.toFixed(9)}`,
    `crop_top = clip.height * ${recipe.cropTop.toFixed(9)}`,
    `crop_width = max(2, int(round(clip.width * ${widthRatio.toFixed(9)})) // 2 * 2)`,
    `crop_height = max(2, int(round(clip.height * ${heightRatio.toFixed(9)})) // 2 * 2)`,
    `target_width = ${size.width}`,
    `target_height = ${size.height}`,
  );
  if (recipe.restoration === 'Off') lines.push('clip = core.resize.Lanczos(clip, width=target_width, height=target_height, src_left=crop_left, src_top=crop_top, src_width=crop_width, src_height=crop_height)');
  else lines.push(
    'if target_width <= crop_width and target_height <= crop_height:',
    `    descale_width = max(target_width, int(round(target_width / max(0.02, ${widthRatio.toFixed(9)}))))`,
    `    descale_height = max(target_height, int(round(target_height / max(0.02, ${heightRatio.toFixed(9)}))))`,
    `    clip = core.descale.${recipe.restoration}(clip, width=descale_width, height=descale_height${recipe.restoration === 'Debicubic' ? ', b=0.0, c=0.5' : ''})`,
    `    crop_left_px = max(0, int(round(clip.width * ${recipe.cropLeft.toFixed(9)})))`,
    `    crop_top_px = max(0, int(round(clip.height * ${recipe.cropTop.toFixed(9)})))`,
    '    crop_right_px = max(0, clip.width - crop_left_px - target_width)',
    '    crop_bottom_px = max(0, clip.height - crop_top_px - target_height)',
    '    clip = core.std.CropRel(clip, left=crop_left_px, top=crop_top_px, right=crop_right_px, bottom=crop_bottom_px)',
    'else:',
    '    clip = core.resize.Lanczos(clip, width=target_width, height=target_height, src_left=crop_left, src_top=crop_top, src_width=crop_width, src_height=crop_height)',
  );
  lines.push('clip = core.resize.Spline36(clip, format=vs.YUV444P16)');
  if (recipe.denoise !== 'Off' && recipe.denoiseStrength > 0.01) {
    const luma = Math.max(0.1, recipe.denoiseStrength * 2);
    const chroma = Math.max(0.05, recipe.denoiseStrength);
    lines.push(`basic = core.bm3d.Basic(clip, profile="fast", sigma=[${luma.toFixed(3)}, ${chroma.toFixed(3)}, ${chroma.toFixed(3)}])`, recipe.denoise === 'Fine detail' ? `clip = core.bm3d.Final(clip, ref=basic, profile="fast", sigma=[${luma.toFixed(3)}, ${chroma.toFixed(3)}, ${chroma.toFixed(3)}])` : 'clip = basic');
  } else lines.push('# BM3D disabled for this recipe.');
  if (recipe.sharpen !== 'Off' && recipe.sharpenStrength > 0.01) lines.push(`clip = core.cas.CAS(clip, sharpness=${Math.min(1, recipe.sharpenStrength * (recipe.sharpen === 'Natural' ? 0.55 : 1)).toFixed(3)})`);
  else lines.push('# CAS sharpening disabled for this recipe.');
  if (recipe.motion !== 'Original') {
    const fps = recipe.motion === '60 fps' ? 60 : 30;
    lines.push('super_clip = core.mv.Super(clip, pel=2)', 'backward = core.mv.Analyse(super_clip, isb=True, delta=1, overlap=4)', 'forward = core.mv.Analyse(super_clip, isb=False, delta=1, overlap=4)', `clip = core.mv.FlowFPS(clip, super_clip, backward, forward, num=${fps}, den=1, blend=True)`);
  }
  if (recipe.reverse) lines.push('clip = clip[::-1]');
  const format = recipe.outputFormat === 'MP4' ? 'vs.YUV420P8' : recipe.outputFormat === 'ProRes 422' ? 'vs.YUV422P10' : 'vs.YUV444P10';
  lines.push(`clip = core.resize.Lanczos(clip, format=${format})`, 'clip.set_output()', '');
  return lines.join('\n');
}

function codecArguments(recipe: ClipRecipe) {
  if (recipe.outputFormat === 'MP4') return ['-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart'];
  if (recipe.outputFormat === 'ProRes 4444') return ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuv444p10le', '-c:a', 'pcm_s16le'];
  return ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le'];
}

function vapourSynthFfmpegArguments(request: ExportRequest, outputPath: string) {
  const { clip, source } = request;
  const filters = [...colorFilters(clip.recipe, source.sourceAnalysis.colorSpace)];
  if (clip.recipe.deband) filters.push('deband=1thr=0.02:2thr=0.02:3thr=0.02:4thr=0.02:range=16:blur=1');
  if (clip.recipe.fade) filters.push('fade=t=in:st=0:d=0.20', `fade=t=out:st=${Math.max(0, clip.end - clip.start - 0.25).toFixed(3)}:d=0.25`);
  const args = ['-hide_banner', '-y', '-f', 'yuv4mpegpipe', '-i', 'pipe:0', '-ss', clip.start.toFixed(6), '-t', (clip.end - clip.start).toFixed(6), '-i', source.sourcePath, '-map', '0:v:0', '-map', '1:a:0?'];
  if (filters.length) args.push('-vf', filters.join(','));
  if (clip.recipe.reverse) args.push('-af', 'areverse');
  args.push(...codecArguments(clip.recipe), ...colorEncodingArguments(clip.recipe, source.sourceAnalysis.colorSpace), '-shortest', '-progress', 'pipe:2', outputPath);
  return args;
}

function compatibilityFilters(request: ExportRequest) {
  const { recipe } = request.clip;
  const { width, height, colorSpace } = request.source.sourceAnalysis;
  const filters: string[] = [];
  const cropWidth = Math.max(0.02, 1 - recipe.cropLeft - recipe.cropRight);
  const cropHeight = Math.max(0.02, 1 - recipe.cropTop - recipe.cropBottom);
  if (cropWidth < 0.999 || cropHeight < 0.999) filters.push(`crop=trunc(iw*${cropWidth.toFixed(5)}/2)*2:trunc(ih*${cropHeight.toFixed(5)}/2)*2:trunc(iw*${recipe.cropLeft.toFixed(5)}/2)*2:trunc(ih*${recipe.cropTop.toFixed(5)}/2)*2`);
  const parity = recipe.fieldOrder === 'Bottom first' ? 'bff' : recipe.fieldOrder === 'Top first' ? 'tff' : 'auto';
  if (recipe.deinterlace === 'Bwdif') filters.push(`bwdif=mode=send_frame:parity=${parity}:deint=all`);
  if (['Bwdif 2×', 'QTGMC Balanced', 'QTGMC Quality'].includes(recipe.deinterlace)) filters.push(`bwdif=mode=send_field:parity=${parity}:deint=all`);
  if (recipe.deinterlace === 'Inverse Telecine') filters.push(`fieldmatch=order=${parity === 'bff' ? 'bff' : 'tff'}`, 'decimate');
  const size = outputDimensions(recipe, width, height);
  filters.push(`scale=${size.width}:${size.height}:flags=lanczos`);
  if (recipe.denoise === 'Balanced' && recipe.denoiseStrength > 0.01) filters.push(`hqdn3d=${recipe.denoiseStrength.toFixed(2)}:${recipe.denoiseStrength.toFixed(2)}:${(recipe.denoiseStrength * 4).toFixed(2)}:${(recipe.denoiseStrength * 4).toFixed(2)}`);
  if (recipe.denoise === 'Fine detail' && recipe.denoiseStrength > 0.01) filters.push(`nlmeans=s=${Math.max(1, recipe.denoiseStrength * 2.4).toFixed(2)}:p=5:r=9`);
  if (recipe.sharpen === 'Natural' && recipe.sharpenStrength > 0.01) filters.push(`unsharp=5:5:${recipe.sharpenStrength.toFixed(2)}:5:5:0`);
  if (recipe.sharpen === 'Adaptive' && recipe.sharpenStrength > 0.01) filters.push(`cas=${Math.min(1, recipe.sharpenStrength).toFixed(2)}`);
  filters.push(...colorFilters(recipe, colorSpace));
  if (recipe.deband) filters.push('deband=1thr=0.02:2thr=0.02:3thr=0.02:4thr=0.02:range=16:blur=1');
  if (recipe.motion !== 'Original') filters.push(`minterpolate=fps=${recipe.motion === '60 fps' ? 60 : 30}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`);
  if (recipe.fade) filters.push('fade=t=in:st=0:d=0.20', `fade=t=out:st=${Math.max(0, request.clip.end - request.clip.start - 0.25).toFixed(3)}:d=0.25`);
  if (recipe.reverse) filters.push('reverse');
  return filters;
}

function compatibilityArguments(request: ExportRequest, outputPath: string) {
  const { clip, source } = request;
  const args = ['-hide_banner', '-y', '-ss', clip.start.toFixed(6), '-t', (clip.end - clip.start).toFixed(6), '-i', source.sourcePath, '-vf', compatibilityFilters(request).join(',')];
  if (clip.recipe.reverse) args.push('-af', 'areverse');
  args.push(...codecArguments(clip.recipe), ...colorEncodingArguments(clip.recipe, source.sourceAnalysis.colorSpace), '-progress', 'pipe:2', outputPath);
  return args;
}

function compatibilityReason(recipe: ClipRecipe, failure: string) {
  const substitutions = [failure];
  if (recipe.deinterlace.startsWith('QTGMC')) substitutions.push('QTGMC was replaced by FFmpeg Bwdif at double field rate.');
  if (recipe.deinterlace === 'Inverse Telecine') substitutions.push('VFM/VDecimate was replaced by fieldmatch/decimate.');
  if (recipe.restoration !== 'Off') substitutions.push('Descale restoration was replaced by Lanczos.');
  if (recipe.denoise !== 'Off') substitutions.push('BM3D was replaced by HQDN3D/NLMeans.');
  if (recipe.sharpen !== 'Off') substitutions.push('VapourSynth CAS was replaced by FFmpeg sharpening.');
  if (recipe.motion !== 'Original') substitutions.push('MVTools FlowFPS was replaced by minterpolate.');
  return substitutions.join(' ');
}

function runFfmpeg(command: string, args: string[], duration: number, signal: AbortSignal, onProgress: (percent: number, message: string) => void, message: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawnTool(command, args, signal);
    let errors = '';
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      errors = `${errors}${text}`.slice(-16000);
      const matches = [...text.matchAll(/out_time_ms=(\d+)/g)];
      const elapsed = Number(matches.at(-1)?.[1] ?? 0);
      if (elapsed) onProgress(Math.min(99, elapsed / 10_000 / Math.max(0.01, duration)), message);
    });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(errors.trim() || `ffmpeg exited with code ${code}`)));
  });
}

async function runVapourSynth(request: ExportRequest, scriptPath: string, outputPath: string, signal: AbortSignal, onProgress: (percent: number, message: string) => void) {
  const vspipeCommand = await executable('vspipe');
  const ffmpegCommand = await executable('ffmpeg');
  const vspipe = spawnTool(vspipeCommand, ['-c', 'y4m', '--progress', scriptPath, '-'], signal);
  const ffmpeg = spawnTool(ffmpegCommand, vapourSynthFfmpegArguments(request, outputPath), signal);
  let errors = '';
  vspipe.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdin.on('error', (error: NodeJS.ErrnoException) => { if (error.code !== 'EPIPE') errors = `${errors}${error.message}`.slice(-16000); });
  const collect = (chunk: Buffer, message: string) => {
    const text = chunk.toString();
    errors = `${errors}${text}`.slice(-16000);
    const matches = [...text.matchAll(/out_time_ms=(\d+)/g)];
    const elapsed = Number(matches.at(-1)?.[1] ?? 0);
    const frames = text.match(/Frame:\s*(\d+)\/(\d+)/i);
    if (elapsed) onProgress(Math.min(99, elapsed / 10_000 / Math.max(0.01, request.clip.end - request.clip.start)), message);
    else if (frames) onProgress(Math.min(99, Number(frames[1]) / Math.max(1, Number(frames[2])) * 100), message);
  };
  vspipe.stderr.on('data', (chunk: Buffer) => collect(chunk, 'VapourSynth is filtering'));
  ffmpeg.stderr.on('data', (chunk: Buffer) => collect(chunk, 'FFmpeg is encoding'));
  const wait = (child: ReturnType<typeof spawn>, name: string) => new Promise<void>((resolve, reject) => {
    child.once('error', (error) => { stopChild(vspipe); stopChild(ffmpeg); reject(error); });
    child.once('close', (code) => {
      if (code === 0) resolve();
      else { stopChild(vspipe); stopChild(ffmpeg); reject(new Error(errors || `${name} exited with code ${code}`)); }
    });
  });
  await Promise.all([wait(vspipe, 'vspipe'), wait(ffmpeg, 'ffmpeg')]);
}

async function validateVideo(outputPath: string, expectedDuration: number, signal: AbortSignal) {
  if ((await stat(outputPath)).size <= 1024) throw new Error('The encoder produced an empty or incomplete output.');
  const analysis = await probeMedia(outputPath, signal);
  const tolerance = Math.max(0.35, Math.min(1, expectedDuration * 0.15));
  if (!analysis.width || !analysis.height || Math.abs(analysis.duration - expectedDuration) > tolerance) throw new Error('The encoded file failed duration or dimension validation.');
  await capture(await executable('ffmpeg'), ['-v', 'error', '-sseof', '-0.25', '-i', outputPath, '-frames:v', '1', '-f', 'null', '-'], signal);
}

async function uniqueFrameFolder(outputPath: string) {
  const base = path.join(path.dirname(outputPath), `${path.basename(outputPath, path.extname(outputPath))} PNG Frames`);
  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix ? `${base} ${suffix + 1}` : base;
    try { await access(candidate); } catch { await mkdir(candidate, { recursive: true }); return candidate; }
  }
}

async function extractFrames(request: ExportRequest, outputPath: string, signal: AbortSignal, onProgress: (percent: number, message: string) => void) {
  const folder = await uniqueFrameFolder(outputPath);
  const args = ['-hide_banner', '-y', '-i', outputPath, '-map', '0:v:0'];
  if (request.clip.recipe.frameExtraction === 'Custom frame rate') args.push('-vf', `fps=${Math.max(0.01, request.clip.recipe.frameFps).toFixed(3)}`);
  else args.push('-fps_mode', 'passthrough');
  args.push('-progress', 'pipe:2', path.join(folder, 'frame-%06d.png'));
  try {
    await runFfmpeg(await executable('ffmpeg'), args, request.clip.end - request.clip.start, signal, onProgress, 'Extracting processed PNG frames');
    if (!(await readdir(folder)).some((name) => name.toLowerCase().endsWith('.png'))) throw new Error('PNG extraction completed without producing frames.');
    return folder;
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

export async function processClip(request: ExportRequest, outputPath: string, signal: AbortSignal, onProgress: (percent: number, message: string) => void): Promise<ProcessingResult> {
  onProgress(1, 'Preparing export workspace');
  const work = await mkdtemp(path.join(tmpdir(), 'lq-cutting-floor-'));
  const script = compileVapourSynthScript(request);
  const scriptPath = path.join(work, `${request.clip.id}.vpy`);
  const extension = path.extname(outputPath);
  const partialPath = path.join(path.dirname(outputPath), `${path.basename(outputPath, extension)}.partial-${request.clip.id}${extension}`);
  await writeFile(scriptPath, script, 'utf8');
  let engine: ProcessingResult['engine'] = 'VapourSynth';
  let fallbackReason: string | undefined;
  try {
    try {
      onProgress(4, 'Starting VapourSynth pipeline');
      await runVapourSynth(request, scriptPath, partialPath, signal, (percent, message) => onProgress(4 + percent * 0.74, message));
    } catch (error) {
      if (signal.aborted) throw error;
      const failure = error instanceof Error ? error.message : String(error);
      if (request.clip.recipe.fallbackMode === 'Strict VapourSynth') throw new Error(`Strict VapourSynth export stopped: ${failure} No compatibility file was substituted.`);
      await rm(partialPath, { force: true });
      engine = 'FFmpeg compatibility';
      fallbackReason = compatibilityReason(request.clip.recipe, failure);
      onProgress(4, 'VapourSynth failed; running labeled compatibility export');
      await runFfmpeg(await executable('ffmpeg'), compatibilityArguments(request, partialPath), request.clip.end - request.clip.start, signal, (percent, message) => onProgress(4 + percent * 0.74, message), 'Compatibility export');
    }
    onProgress(80, 'Validating completed video');
    await validateVideo(partialPath, request.clip.end - request.clip.start, signal);
    onProgress(84, 'Finalizing output file');
    await rename(partialPath, outputPath);
    const warnings: string[] = [];
    if (request.clip.recipe.saveVapourSynthScript) try {
      await writeFile(path.join(path.dirname(outputPath), `${path.basename(outputPath, extension)}.vpy`), script, 'utf8');
    } catch (error) {
      warnings.push(`The master was saved, but its VapourSynth script could not be written: ${error instanceof Error ? error.message : String(error)}`);
    }
    let pngFramesPath: string | undefined;
    if (request.clip.recipe.extractFrames) try {
      pngFramesPath = await extractFrames(request, outputPath, signal, (percent, message) => onProgress(86 + percent * 0.13, message));
    } catch (error) {
      warnings.push(signal.aborted ? 'The master was saved; PNG extraction was cancelled and partial frames were removed.' : `The master was saved, but PNG extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const completeMessage = engine === 'VapourSynth' ? 'VapourSynth export complete' : 'Compatibility export complete';
    onProgress(100, warnings.length ? `${completeMessage} with a warning` : completeMessage);
    return { engine, fallbackReason, pngFramesPath, warnings };
  } finally {
    await rm(partialPath, { force: true });
    await rm(work, { recursive: true, force: true });
  }
}
