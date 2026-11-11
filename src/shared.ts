export const deinterlaceChoices = ['Off', 'Bwdif', 'Bwdif 2×', 'QTGMC Balanced', 'QTGMC Quality', 'Inverse Telecine'] as const;
export const outputFormats = ['MP4', 'ProRes 422', 'ProRes 4444'] as const;
export const aspectPresets = [
  'Free',
  'One-column landscape · 540×304',
  'One-column square · 540×540',
  'One-column portrait · 540×675',
  'One-column tall portrait · 540×810',
  'Two-column landscape · 268×151',
  'Two-column square · 268×268',
  'Two-column portrait · 268×350',
  'Two-column tall portrait · 268×400',
  'Three-column landscape · 177×100',
  'Three-column square · 177×177',
  'Three-column portrait · 177×250',
  'Custom',
] as const;
export const masterSizes = ['Source', '1920', '2560', '3840', 'Custom'] as const;
export const looks = ['Natural', 'Crisp', 'Soft / noisy source', 'Native VS detail recovery', 'Custom'] as const;

export type DeinterlaceChoice = typeof deinterlaceChoices[number];
export type OutputFormat = typeof outputFormats[number];
export type AspectPreset = typeof aspectPresets[number];
export type MasterSize = typeof masterSizes[number];
export type StudioLook = typeof looks[number];
export type ViewName = 'home' | 'find' | 'process' | 'settings';
export type DownloadBrowser = 'none' | 'edge' | 'chrome' | 'firefox' | 'brave';

export type GuidanceConfidence = 'High' | 'Medium' | 'Low';

export interface ScanEvidence {
  sampledWindows: number;
  sampledSeconds: number;
  topFirst: number;
  bottomFirst: number;
  progressive: number;
  uncertain: number;
  repeatedFields: number;
  classification: 'Progressive' | 'Interlaced' | 'Mixed or uncertain';
  confidence: GuidanceConfidence;
}

export interface FrameTimingEvidence {
  sampledWindows: number;
  frames: number;
  kind: 'Constant sample' | 'Variable sample' | 'Unknown';
  confidence: GuidanceConfidence;
  detail: string;
}

export interface SourceGuidanceItem {
  title: string;
  confidence: GuidanceConfidence;
  evidence: string;
  recommendation: string;
  check: string;
}

export interface SourceAnalysis {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  format: string;
  pixelFormat: string;
  bitDepth: number;
  bitrate: number;
  colorSpace: string;
  colorTransfer: string;
  colorPrimaries?: string;
  colorRange?: string;
  chromaLocation?: string;
  hdr: 'SDR' | 'HDR PQ' | 'HDR HLG' | 'Unknown';
  scanType: 'Progressive' | 'Interlaced' | 'Unknown';
  fieldOrder: string;
  variableFrameRate: boolean;
  scanEvidence?: ScanEvidence;
  frameTiming?: FrameTimingEvidence;
  scanSample?: string;
  decodeIssue?: string;
  openingIssue?: string;
  freezeSample?: string;
  banding?: number;
  bandingNote?: string;
  noise?: number;
  qualitySummary: string;
}

export interface StudioSource {
  id: string;
  sourcePath: string;
  playbackPath?: string;
  thumbnailPath?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  displayName: string;
  episodeLabel: string;
  progress: number;
  finished: boolean;
  missing: boolean;
  sourceAnalysis: SourceAnalysis;
}

export interface ClipRecipe {
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  aspectPreset: AspectPreset;
  customRatioWidth: number;
  customRatioHeight: number;
  masterSize: MasterSize;
  masterWidth: number;
  masterHeight?: number;
  look: StudioLook;
  deinterlace: DeinterlaceChoice;
  fieldOrder: 'Auto' | 'Top first' | 'Bottom first';
  restoration: 'Off' | 'Debilinear' | 'Debicubic';
  rotation: 0 | 90 | 180 | 270;
  motion: 'Original' | '30 fps' | '60 fps';
  denoise: 'Off' | 'Balanced' | 'Fine detail';
  denoiseStrength: number;
  sharpen: 'Off' | 'Natural' | 'Adaptive';
  sharpenStrength: number;
  deband: boolean;
  reverse: boolean;
  fade: boolean;
  extractFrames: boolean;
  frameExtraction: 'Every processed frame' | 'Custom frame rate';
  frameFps: number;
  outputFormat: OutputFormat;
  saveVapourSynthScript: boolean;
  fallbackMode: 'Strict VapourSynth' | 'Allow FFmpeg fallback';
  colorManagement: 'Auto' | 'SDR Rec.709' | 'Convert 601 to 709' | 'HDR PQ to SDR' | 'HDR HLG to SDR' | 'Preserve';
}

export interface SessionClip {
  id: string;
  sourceId: string;
  name: string;
  start: number;
  end: number;
  completed: boolean;
  outputPath?: string;
  processingEngine?: string;
  fallbackReason?: string;
  outputWarnings?: string[];
  pngFramesPath?: string;
  recipe: ClipRecipe;
}

export interface StudioSession {
  version: 6;
  id: string;
  name: string;
  created: string;
  updated: string;
  sources: StudioSource[];
  activeSourceId?: string;
  clips: SessionClip[];
  watchFolders: string[];
  downloadPath?: string;
  exportPath?: string;
}

export interface ProjectCard {
  id: string;
  name: string;
  updated: string;
  thumbnailUrl?: string;
  sourceCount: number;
  clipCount: number;
  completedCount: number;
}

export interface StudioPreferences {
  libraryPath: string;
  downloadPath: string;
  exportPath: string;
  expertMode: boolean;
  theme?: 'dark' | 'light';
  onboardingComplete?: boolean;
  activeProjectId?: string;
}

export interface WorkspaceState {
  session: StudioSession;
  projects: ProjectCard[];
  preferences: StudioPreferences;
}

export interface ExportProgress {
  clipId: string;
  percent: number;
  message: string;
}

export interface ExportRequest {
  source: StudioSource;
  clip: SessionClip;
  projectName: string;
  exportRoot: string;
}

export interface TaskProgress {
  percent: number;
  message: string;
}

export interface RuntimeStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  vspipe: boolean;
  ytDlp: boolean;
  vapourSynthPlugins: boolean;
  error?: string;
}

export const runtimeVersionArguments = (name: 'ffmpeg' | 'ffprobe' | 'vspipe' | 'yt-dlp') => [name === 'ffmpeg' || name === 'ffprobe' ? '-version' : '--version'];

export function downloadCookieArguments(browser: DownloadBrowser = 'none') {
  if (!['none', 'edge', 'chrome', 'firefox', 'brave'].includes(browser)) throw new Error('That browser is not supported for video sign-in.');
  return browser === 'none' ? [] : ['--cookies-from-browser', browser];
}

export function downloadFailureMessage(stderr: string, browser: DownloadBrowser = 'none') {
  if (/sign in to confirm you.{0,8}re not a bot|use --cookies-from-browser|authentication.*cookies/i.test(stderr)) return browser === 'none'
    ? 'YouTube requires browser sign-in for this video. Retry and choose a browser where you are signed into YouTube.'
    : `YouTube did not accept the ${browser} sign-in. Confirm YouTube is signed in there, close the browser, and retry or choose another browser.`;
  if (/could not copy chrome cookie database|failed to decrypt|could not find.*cookies|cookie.*database.*locked/i.test(stderr)) return `The ${browser} sign-in could not be read. Close the browser completely and retry, or choose another signed-in browser.`;
  const detail = stderr.split(/\r?\n/).map((line) => line.trim()).reverse().find((line) => /^ERROR:/i.test(line))?.replace(/^ERROR:\s*/i, '');
  return `Download failed. ${detail || 'Check the public link and try again.'}`;
}

export function assertPublicVideoUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('That is not a valid public video URL.'); }
  const host = url.hostname.toLowerCase();
  const privateHost = host === 'localhost' || host.endsWith('.local') || host === '::1' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^(fc|fd|fe80):/i.test(host);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || privateHost) throw new Error('Only public HTTP or HTTPS video links can be downloaded.');
  return url.href;
}

export interface DesktopApi {
  loadWorkspace(): Promise<WorkspaceState>;
  createProject(name: string): Promise<WorkspaceState>;
  openProject(id: string): Promise<WorkspaceState>;
  renameProject(id: string, name: string): Promise<WorkspaceState>;
  deleteProject(id: string): Promise<WorkspaceState | null>;
  saveSession(session: StudioSession): Promise<void>;
  importVideos(session: StudioSession, mode: 'files' | 'season' | 'watch'): Promise<{ sources: StudioSource[]; watchFolder?: string }>;
  reanalyzeSource(sourcePath: string): Promise<SourceAnalysis>;
  downloadVideo(session: StudioSession, url: string, downloadFolder?: string, browser?: DownloadBrowser): Promise<StudioSource>;
  savePreferences(preferences: StudioPreferences): Promise<StudioPreferences>;
  changeLibrary(session: StudioSession, libraryPath: string): Promise<WorkspaceState | null>;
  chooseLocation(kind: 'libraryPath' | 'downloadPath' | 'exportPath', current: string): Promise<string | null>;
  exportClip(request: ExportRequest): Promise<SessionClip | null>;
  cancelTask(): Promise<void>;
  runtimeStatus(): Promise<RuntimeStatus>;
  onExportProgress(callback: (progress: ExportProgress) => void): () => void;
  onTaskProgress(callback: (progress: TaskProgress) => void): () => void;
  onWatchSources(callback: (sources: StudioSource[]) => void): () => void;
}

export const defaultRecipe = (): ClipRecipe => ({
  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0,
  aspectPreset: 'Free',
  customRatioWidth: 540,
  customRatioHeight: 400,
  masterSize: 'Source',
  masterWidth: 1920,
  masterHeight: undefined,
  look: 'Custom',
  deinterlace: 'Off',
  fieldOrder: 'Auto',
  restoration: 'Off',
  rotation: 0,
  motion: 'Original',
  denoise: 'Off',
  denoiseStrength: 0,
  sharpen: 'Off',
  sharpenStrength: 0,
  deband: false,
  reverse: false,
  fade: false,
  extractFrames: true,
  frameExtraction: 'Every processed frame',
  frameFps: 30,
  outputFormat: 'ProRes 422',
  saveVapourSynthScript: true,
  fallbackMode: 'Strict VapourSynth',
  colorManagement: 'Auto',
});

export function scanEvidenceFromSamples(samples: string[], sampledSeconds = samples.length * 3): ScanEvidence | undefined {
  const parsed = samples.map((stderr) => [...stderr.matchAll(/Multi frame detection:\s*TFF:\s*(\d+)\s*BFF:\s*(\d+)\s*Progressive:\s*(\d+)\s*Undetermined:\s*(\d+)/g)].at(-1)).filter(Boolean);
  if (!parsed.length) return undefined;
  const totals = parsed.reduce((sum, match) => sum.map((value, index) => value + Number(match?.[index + 1] ?? 0)), [0, 0, 0, 0]);
  const repeatedFields = samples.reduce((sum, stderr) => {
    const match = [...stderr.matchAll(/Repeated Fields:\s*Neither:\s*(\d+)\s*Top:\s*(\d+)\s*Bottom:\s*(\d+)/g)].at(-1);
    return sum + (match ? Number(match[2]) + Number(match[3]) : 0);
  }, 0);
  const [topFirst, bottomFirst, progressive, uncertain] = totals;
  const total = topFirst + bottomFirst + progressive + uncertain;
  if (!total) return undefined;
  const interlaced = topFirst + bottomFirst;
  const dominant = Math.max(interlaced, progressive) / total;
  const classification = dominant < 0.65 ? 'Mixed or uncertain' : interlaced > progressive ? 'Interlaced' : 'Progressive';
  const confidence: GuidanceConfidence = total >= 120 && dominant >= 0.85 && uncertain / total <= 0.15 ? 'High' : total >= 45 && dominant >= 0.65 ? 'Medium' : 'Low';
  return { sampledWindows: parsed.length, sampledSeconds, topFirst, bottomFirst, progressive, uncertain, repeatedFields, classification, confidence };
}

export function frameTimingEvidence(samples: number[][]): FrameTimingEvidence {
  const deltas = samples.flatMap((timestamps) => timestamps.slice(1).map((time, index) => time - timestamps[index]).filter((delta) => delta > 0 && delta < 1));
  if (deltas.length < 12) return { sampledWindows: samples.length, frames: deltas.length + samples.length, kind: 'Unknown', confidence: 'Low', detail: 'Too few decoded timestamps were available to classify frame spacing.' };
  const ordered = [...deltas].sort((a, b) => a - b);
  const median = ordered[Math.floor(ordered.length / 2)];
  const tolerance = Math.max(0.0005, median * 0.02);
  const varying = deltas.filter((delta) => Math.abs(delta - median) > tolerance).length;
  const ratio = varying / deltas.length;
  const kind = ratio > 0.05 ? 'Variable sample' : 'Constant sample';
  const confidence: GuidanceConfidence = deltas.length >= 120 ? 'High' : deltas.length >= 45 ? 'Medium' : 'Low';
  return { sampledWindows: samples.length, frames: deltas.length + samples.length, kind, confidence, detail: `${varying} of ${deltas.length} sampled frame intervals differed from the ${median.toFixed(6)}s median by more than ${tolerance.toFixed(6)}s.` };
}

export function sourceGuidanceItems(analysis: SourceAnalysis): SourceGuidanceItem[] {
  const scan = analysis.scanEvidence;
  const metadataScan = analysis.scanType === 'Unknown' ? `Field-order metadata is unknown.` : `Field-order metadata says ${analysis.scanType.toLowerCase()} (${analysis.fieldOrder}).`;
  const scanEvidence = scan ? `${metadataScan} ${scan.sampledWindows} windows / ${scan.sampledSeconds}s measured ${scan.topFirst + scan.bottomFirst} interlaced, ${scan.progressive} progressive, and ${scan.uncertain} uncertain frames.` : `${metadataScan} ${analysis.scanSample ?? 'No distributed cadence sample is stored for this source.'}`;
  const cadenceAgrees = Boolean(scan && scan.classification === analysis.scanType && scan.confidence === 'High');
  const cadenceRecommendation = cadenceAgrees && analysis.scanType === 'Interlaced' ? 'Bwdif is a conservative starting point; use QTGMC only after visual comparison.' : 'Leave cadence processing off until moving edges confirm combing or a repeated-field cadence.';
  const items: SourceGuidanceItem[] = [{ title: scan?.classification === 'Mixed or uncertain' ? 'Cadence needs review' : `${scan?.classification ?? analysis.scanType} cadence`, confidence: scan?.confidence ?? 'Low', evidence: scanEvidence, recommendation: cadenceRecommendation, check: 'Inspect motion, diagonal edges, and scene changes for combing, judder, or cadence shifts.' }];
  if (scan?.repeatedFields) items.push({ title: 'Possible repeated-field cadence', confidence: 'Low', evidence: `${scan.repeatedFields} repeated fields appeared in sampled windows. This alone does not confirm telecine.`, recommendation: 'Keep inverse telecine off unless a dedicated VFM/VDecimate check and playback both show a stable film cadence.', check: 'Step through motion and cuts; look for a consistent repeated-frame pattern rather than isolated duplicates.' });
  const timing = analysis.frameTiming;
  items.push({ title: timing?.kind ?? (analysis.variableFrameRate ? 'Possible variable timing' : 'Frame timing not verified'), confidence: timing?.confidence ?? 'Low', evidence: timing?.detail ?? 'This older analysis only compared nominal and average frame-rate tags.', recommendation: timing?.kind === 'Variable sample' ? 'Preserve original timing and verify mark/export sync; motion interpolation is not a VFR repair.' : 'Preserve original motion unless playback shows a problem.', check: 'Check lip sync, cuts, and the exact in/out frames after export.' });
  const colorTags = `Transfer ${analysis.colorTransfer || 'unknown'}; primaries ${analysis.colorPrimaries || 'unknown'}; matrix ${analysis.colorSpace || 'unknown'}; range ${analysis.colorRange || 'unknown'}; chroma ${analysis.chromaLocation || 'unknown'}.`;
  items.push({ title: analysis.hdr === 'Unknown' ? 'Color tags incomplete' : analysis.hdr, confidence: analysis.hdr === 'Unknown' ? 'Low' : 'High', evidence: colorTags, recommendation: analysis.hdr === 'HDR PQ' || analysis.hdr === 'HDR HLG' ? `Use ${analysis.hdr} tone mapping for an SDR master.` : /601|smpte170m/i.test(analysis.colorSpace) ? 'Convert explicit Rec.601 matrix tags to Rec.709 for an HD SDR master.' : analysis.hdr === 'Unknown' ? 'Keep color treatment conservative and verify rather than assuming Rec.709.' : 'Keep SDR color unless the image visibly indicates bad or missing tags.', check: 'Review skin tones, neutral grays, shadows, and highlight roll-off.' });
  if (analysis.decodeIssue) items.push({ title: 'Sample decode warning', confidence: 'High', evidence: analysis.decodeIssue, recommendation: 'Do not treat freeze detection as corruption. Recheck the source or run a full decode-integrity scan before export.', check: 'Visit the reported regions and look for corruption, stalls, or missing frames.' });
  const freeze = analysis.freezeSample || analysis.openingIssue;
  if (freeze) items.push({ title: 'Low-motion section found', confidence: 'Medium', evidence: analysis.freezeSample ?? analysis.openingIssue ?? '', recommendation: 'Treat this as a review marker; intentional stills and title cards are common.', check: 'Play through the sampled region and confirm whether it is intentionally static.' });
  if (analysis.banding !== undefined || analysis.noise !== undefined) {
    const measured = [
      analysis.noise !== undefined ? `noise ${analysis.noise}` : '',
      analysis.banding !== undefined ? `banding ${analysis.banding}` : '',
    ].filter(Boolean).join(', ');
    const recommendation = analysis.banding !== undefined && analysis.banding >= 20 ? 'Strong banding was measured: enable Deband in the recipe.' : analysis.banding !== undefined && analysis.banding >= 8 ? 'Mild banding was measured: enable Deband and confirm against the source.' : analysis.noise !== undefined && analysis.noise >= 12 ? 'High noise was measured: enable Denoise (Balanced).' : analysis.noise !== undefined && analysis.noise >= 8 ? 'Moderate noise was measured: enable Denoise (Fine detail).' : 'The measured noise and banding are low: leave cleanup off and let your eyes decide.';
    items.push({ title: 'Detail treatment measured', confidence: 'Medium', evidence: `${measured} ${analysis.bandingNote ? `(${analysis.bandingNote})` : ''} from a distributed decode of ${analysis.width}x${analysis.height} frames.`, recommendation, check: 'Inspect faces, hair, text, gradients, and fast motion at 100% before enabling cleanup.' });
  } else {
    items.push({ title: 'Detail treatment requires your eyes', confidence: 'High', evidence: 'Resolution and container bitrate do not measure noise, sharpness, blocking, or banding reliably across different scenes.', recommendation: 'Denoise, sharpen, deband, Descale, and motion smoothing stay off until the shot visibly needs them.', check: 'Inspect faces, hair, text, gradients, and fast motion at 100% before enabling cleanup.' });
  }
  return items;
}

export function sourceGuidance(analysis: SourceAnalysis): string[] {
  return sourceGuidanceItems(analysis).map((item) => `${item.confidence} confidence — ${item.title}: ${item.recommendation} Evidence: ${item.evidence} Check: ${item.check}`);
}

export function sourceVerdict(analysis: SourceAnalysis) {
  const scan = analysis.scanEvidence;
  const cadence = scan?.classification === 'Interlaced' && scan.confidence === 'High' && analysis.scanType === 'Interlaced' ? 'Interlacing has strong sampled and metadata evidence.' : scan?.classification === 'Progressive' && scan.confidence === 'High' && analysis.scanType === 'Progressive' ? 'Progressive cadence has strong sampled and metadata evidence.' : 'Cadence needs visual confirmation; no repair will be enabled automatically.';
  const color = analysis.hdr === 'HDR PQ' || analysis.hdr === 'HDR HLG' ? `${analysis.hdr} transfer is explicitly tagged.` : analysis.hdr === 'Unknown' ? 'Color tags are incomplete; verify the image.' : 'Source is tagged SDR.';
  return `${cadence} ${color}`;
}

// Honest, plain-language callouts that reconcile the *container tag* with what the
// decoded pixels actually show. Ported from the Rust rebuild's cf-advisor `pixel_advice`.
// Each item is conservative: it states what was measured, not a command, and it only
// fires when there is a real disagreement or a high-confidence reading worth surfacing.
export function pixelAdvice(analysis: SourceAnalysis): string[] {
  const notes: string[] = [];
  const scan = analysis.scanEvidence;
  const classification = scan?.classification ?? analysis.scanType;
  const highConfidence = scan?.confidence === 'High' || scan?.confidence === 'Medium';
  // 1. Container cadence tag vs. what the decoded frames actually look like.
  if (analysis.scanType === 'Interlaced' && classification === 'Progressive' && highConfidence) {
    notes.push(`Tagged interlaced, but the sampled frames look progressive. ${scan ? `${scan.progressive} of ${scan.progressive + scan.topFirst + scan.bottomFirst} sampled windows were progressive.` : ''} You may not need deinterlacing — verify in playback.`);
  } else if (analysis.scanType === 'Progressive' && classification === 'Interlaced' && scan?.confidence === 'High') {
    notes.push('Tagged progressive, but the decoded pixels show interlacing. Combing is likely present; a same-rate deinterlace is worth trying.');
  } else if (classification === 'Mixed or uncertain' && scan) {
    notes.push('The cadence mixes interlaced and progressive windows. Treat it as a review, not a defect: a conservative same-rate Bwdif is the safe starting point if playback shows combing.');
  }
  // 2. Banding measured in the pixels.
  if (analysis.banding !== undefined && analysis.banding >= 20) {
    notes.push(`Strong banding was measured in decoded gradients (${analysis.banding} on a 0–100 scale). Enabling Deband should help smooth sky, skin, and matte areas.`);
  } else if (analysis.banding !== undefined && analysis.banding >= 8) {
    notes.push(`Mild banding was measured (${analysis.banding}). It may be subtle in playback; enable Deband only if you can see it at full size.`);
  }
  // 3. Noise measured in the pixels.
  if (analysis.noise !== undefined && analysis.noise >= 12) {
    notes.push(`Moderate-to-high noise was measured (${analysis.noise}). A light Denoise (Balanced) should tidy shadows and grain without smearing detail.`);
  } else if (analysis.noise !== undefined && analysis.noise >= 8) {
    notes.push(`Mild noise was measured (${analysis.noise}). Fine-detail denoise is optional; inspect grain at output size first.`);
  }
  // 4. HDR tag vs. safe assumption.
  if (analysis.hdr === 'HDR PQ' || analysis.hdr === 'HDR HLG') {
    notes.push(`${analysis.hdr} is explicitly tagged. Convert it to SDR for an SDR master, or keep the HDR signal if your target is HDR.`);
  }
  // 5. A freeze/opening issue the decoder flagged — review marker, not corruption.
  if (analysis.openingIssue || analysis.freezeSample) {
    notes.push('The decoder flagged a low-motion region. That is a review marker, not a defect: intentional stills and title cards are common. Play the region to confirm.');
  }
  return notes;
}

export interface SuggestedRecipe {
  name: string;
  confidence: 'High' | 'Medium';
  why: string;
  patch: Partial<ClipRecipe>;
  recommended?: boolean;
}

// Ranked recipe alternatives. Ported from the Rust rebuild's cf-advisor `suggest_recipes`.
// Honest, never random: the recommended plan comes from the measured evidence, and each
// alternative is a *genuinely different* strategy the editor might prefer:
//   * The recommended plan (evidence-based) is always first.
//   * A deinterlace alternative is offered only for a genuinely interlaced source —
//     the Electron model has no Weave, so the honest "hold-rate" option is Bwdif, and the
//     quality/interpolation option is QTGMC Quality. We offer whichever differs from the
//     recommended pick, so the two are never the same recipe in a different name.
//   * An "As-is (no cleanup)" alternative is offered only when the recommended plan
//     applies at least one fix — the editor may want the untouched source.
export function suggestedRecipes(analysis: SourceAnalysis | undefined): SuggestedRecipe[] {
  if (!analysis) {
    return [{ name: 'Recommended', confidence: 'High', why: 'No source analysis available yet — run the source check to get evidence-based suggestions.', patch: {}, recommended: true }];
  }
  const primary: SuggestedRecipe = {
    name: 'Recommended',
    confidence: 'High',
    why: 'Derived from the measured cadence, banding, and noise evidence.',
    patch: suggestedRecipePatch(analysis),
    recommended: true,
  };
  const out = [primary];

  // A source is "genuinely interlaced" when the container tag and a high/medium
  // confidence decoded-pixel reading agree on interlacing.
  const scan = analysis.scanEvidence;
  const classification = scan?.classification ?? analysis.scanType;
  const genuinelyInterlaced = analysis.scanType === 'Interlaced' && classification === 'Interlaced' && scan?.confidence !== 'Low';

  const recommendedDeinterlace = (primary.patch.deinterlace ?? 'Off') as DeinterlaceChoice;
  if (genuinelyInterlaced && recommendedDeinterlace !== 'Off') {
    // Offer the alternative deinterlace that is genuinely different from the pick.
    const alt: DeinterlaceChoice = recommendedDeinterlace === 'Bwdif' ? 'QTGMC Quality' : 'Bwdif';
    const altWhy = alt === 'QTGMC Quality'
      ? 'Interpolates motion for a smoother result; use when you want a progressive, high-quality master and the extra CPU cost is fine.'
      : 'Same-rate, conservative deinterlace — no motion interpolation. The safe starting point when the source rate should be preserved.';
    out.push({ name: alt === 'QTGMC Quality' ? 'QTGMC Quality' : 'Bwdif (hold rate)', confidence: 'High', why: altWhy, patch: { deinterlace: alt } });
  }

  // The recommended plan "applies a fix" when it enables any cleanup beyond the load.
  const p = primary.patch;
  const appliesAFix = p.deinterlace !== undefined && p.deinterlace !== 'Off'
    || p.denoise !== undefined && p.denoise !== 'Off'
    || (p.sharpen !== undefined && p.sharpen !== 'Off')
    || p.deband === true
    || (p.colorManagement !== undefined && p.colorManagement !== 'Auto');
  if (appliesAFix) {
    out.push({ name: 'As-is (no cleanup)', confidence: 'Medium', why: 'Load and play the source exactly as tagged — skip the recommended cleanup if you want the untouched source.', patch: { deinterlace: 'Off', denoise: 'Off', denoiseStrength: 0, sharpen: 'Off', sharpenStrength: 0, deband: false, motion: 'Original', colorManagement: 'Preserve' } });
  }

  return out;
}

export function suggestedRecipePatch(analysis: SourceAnalysis): Partial<ClipRecipe> {
  const confirmedInterlace = analysis.scanType === 'Interlaced' && analysis.scanEvidence?.classification === 'Interlaced' && analysis.scanEvidence.confidence === 'High';
  const banding = analysis.banding ?? 0;
  // Methodology (from the 13 footage-type tutorials): cleanup is only auto-enabled when the
  // brain's distributed decode measured the defect, so the auto recipe is evidence-based and
  // never over-processes a clean source.
  const deband = banding >= 20;
  const denoise = analysis.noise && analysis.noise >= 12 ? 'Balanced' : analysis.noise && analysis.noise >= 8 ? 'Fine detail' : 'Off';
  const sharpen = (banding >= 8 && banding < 20) || (analysis.noise && analysis.noise >= 8) ? 'Natural' : 'Off';
  return {
    look: 'Custom',
    denoise,
    denoiseStrength: denoise === 'Fine detail' ? 0.9 : denoise === 'Balanced' ? 0.8 : 0,
    sharpen,
    sharpenStrength: sharpen === 'Natural' ? 0.5 : 0,
    restoration: 'Off',
    deband,
    motion: 'Original',
    deinterlace: confirmedInterlace ? 'Bwdif' : 'Off',
    fieldOrder: /tt|tb/i.test(analysis.fieldOrder) ? 'Top first' : /bb|bt/i.test(analysis.fieldOrder) ? 'Bottom first' : 'Auto',
    colorManagement: analysis.hdr === 'HDR PQ' ? 'HDR PQ to SDR' : analysis.hdr === 'HDR HLG' ? 'HDR HLG to SDR' : /601|smpte170m/i.test(analysis.colorSpace) ? 'Convert 601 to 709' : 'Auto',
  };
}

export function normalizeClipRange(markIn: number, markOut: number, duration: number, fps: number) {
  const frame = 1 / Math.max(1, fps);
  const start = Math.max(0, Math.min(markIn, markOut, Math.max(0, duration - frame)));
  const end = Math.max(start + frame, Math.min(Math.max(markIn, markOut), duration));
  return { start: Math.round(start / frame) * frame, end: Math.round(end / frame) * frame };
}

export function createClip(source: StudioSource, markIn: number, markOut: number, number: number): SessionClip {
  const { start, end } = normalizeClipRange(markIn, markOut, source.sourceAnalysis.duration, source.sourceAnalysis.fps);
  return {
    id: crypto.randomUUID(),
    sourceId: source.id,
    name: `${source.episodeLabel || source.displayName} — Clip ${String(number).padStart(2, '0')}`,
    start,
    end,
    completed: false,
    recipe: defaultRecipe(),
  };
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, '0')}:${(safe % 60).toFixed(2).padStart(5, '0')}`;
}

export function applyLook(recipe: ClipRecipe, look: StudioLook, analysis?: SourceAnalysis): ClipRecipe {
  const next = { ...recipe, look };
  // Evidence-aware deband: a preset that *wants* deband (deband: true) only turns
  // it on if the brain actually measured banding (palette collapse >= 20). A preset
  // that intentionally skips deband (deband: false) is preserved as-is. When no
  // analysis is available (e.g. brain never ran), fall back to the preset's intent.
  const banding = analysis?.banding;
  const hasEvidence = typeof banding === 'number';
  const wantDeband = (patch: { deband?: boolean }) => (patch.deband === true && hasEvidence ? banding >= 20 : patch.deband ?? false);
  if (look === 'Natural') return { ...next, denoise: 'Balanced', denoiseStrength: 0.8, sharpen: 'Natural', sharpenStrength: 0.45, deband: wantDeband({ deband: false }) };
  if (look === 'Crisp') return { ...next, denoise: 'Balanced', denoiseStrength: 0.45, sharpen: 'Adaptive', sharpenStrength: 0.75, deband: wantDeband({ deband: false }) };
  if (look === 'Soft / noisy source') return { ...next, denoise: 'Fine detail', denoiseStrength: 1.7, sharpen: 'Natural', sharpenStrength: 0.3, deband: wantDeband({ deband: true }) };
  if (look === 'Native VS detail recovery') return { ...next, denoise: 'Off', denoiseStrength: 0, sharpen: 'Off', sharpenStrength: 0, deband: wantDeband({ deband: false }), restoration: 'Debilinear' };
  return next;
}

export function aspectRatio(recipe: ClipRecipe) {
  if (recipe.aspectPreset === 'Custom') return recipe.customRatioWidth > 0 && recipe.customRatioHeight > 0 ? recipe.customRatioWidth / recipe.customRatioHeight : undefined;
  const size = recipe.aspectPreset.match(/(\d+)×(\d+)$/);
  return size ? Number(size[1]) / Number(size[2]) : undefined;
}

export function fitCropToAspect(recipe: ClipRecipe, sourceWidth: number, sourceHeight: number): ClipRecipe {
  const ratio = aspectRatio(recipe);
  if (!ratio) return recipe;
  const sourceAspect = Math.max(1, sourceWidth) / Math.max(1, sourceHeight);
  const width = Math.max(0.02, 1 - recipe.cropLeft - recipe.cropRight);
  const height = Math.max(0.02, 1 - recipe.cropTop - recipe.cropBottom);
  const centerX = recipe.cropLeft + width / 2;
  const centerY = recipe.cropTop + height / 2;
  const nextWidth = sourceAspect * width / height > ratio ? height * ratio / sourceAspect : width;
  const nextHeight = sourceAspect * width / height > ratio ? height : width * sourceAspect / ratio;
  const left = Math.min(Math.max(0, centerX - nextWidth / 2), 1 - nextWidth);
  const top = Math.min(Math.max(0, centerY - nextHeight / 2), 1 - nextHeight);
  const presetSize = recipe.aspectPreset.match(/(\d+)×(\d+)$/);
  const pixels = presetSize ? [Number(presetSize[1]), Number(presetSize[2])] : [recipe.customRatioWidth, recipe.customRatioHeight];
  return {
    ...recipe,
    cropLeft: left,
    cropRight: Math.max(0, 1 - left - nextWidth),
    cropTop: top,
    cropBottom: Math.max(0, 1 - top - nextHeight),
    masterSize: 'Custom',
    masterWidth: pixels[0],
    masterHeight: pixels[1],
  };
}

export function setCropEdge(recipe: ClipRecipe, edge: 'cropLeft' | 'cropRight' | 'cropTop' | 'cropBottom', inset: number, sourceWidth: number, sourceHeight: number): ClipRecipe {
  const next = { ...recipe, [edge]: Math.max(0, Math.min(0.98, inset)), look: 'Custom' as const };
  if (next.cropLeft + next.cropRight > 0.98) next[edge === 'cropLeft' ? 'cropRight' : 'cropLeft'] = 0.98 - next[edge];
  if (next.cropTop + next.cropBottom > 0.98) next[edge === 'cropTop' ? 'cropBottom' : 'cropTop'] = 0.98 - next[edge];
  const ratio = aspectRatio(next);
  if (!ratio) return next;
  const sourceAspect = Math.max(1, sourceWidth) / Math.max(1, sourceHeight);
  let width = 1 - next.cropLeft - next.cropRight;
  let height = 1 - next.cropTop - next.cropBottom;
  if (edge === 'cropLeft' || edge === 'cropRight') {
    const maxWidth = Math.min(1, ratio / sourceAspect);
    if (width > maxWidth) {
      width = maxWidth;
      if (edge === 'cropLeft') next.cropLeft = Math.max(0, 1 - next.cropRight - width);
      else next.cropRight = Math.max(0, 1 - next.cropLeft - width);
    }
    height = width * sourceAspect / ratio;
    const center = (next.cropTop + 1 - next.cropBottom) / 2;
    next.cropTop = Math.max(0, center - height / 2);
    next.cropBottom = Math.max(0, 1 - next.cropTop - height);
  } else {
    const maxHeight = Math.min(1, sourceAspect / ratio);
    if (height > maxHeight) {
      height = maxHeight;
      if (edge === 'cropTop') next.cropTop = Math.max(0, 1 - next.cropBottom - height);
      else next.cropBottom = Math.max(0, 1 - next.cropTop - height);
    }
    width = height * ratio / sourceAspect;
    const center = (next.cropLeft + 1 - next.cropRight) / 2;
    next.cropLeft = Math.max(0, center - width / 2);
    next.cropRight = Math.max(0, 1 - next.cropLeft - width);
  }
  return next;
}

export function moveCrop(recipe: ClipRecipe, deltaX: number, deltaY: number): ClipRecipe {
  const width = 1 - recipe.cropLeft - recipe.cropRight;
  const height = 1 - recipe.cropTop - recipe.cropBottom;
  const left = Math.max(0, Math.min(1 - width, recipe.cropLeft + deltaX));
  const top = Math.max(0, Math.min(1 - height, recipe.cropTop + deltaY));
  return { ...recipe, cropLeft: left, cropRight: 1 - left - width, cropTop: top, cropBottom: 1 - top - height, look: 'Custom' };
}

export function joinTouchingClips(clips: SessionClip[], frameTolerance: (sourceId: string) => number) {
  const joined: SessionClip[] = [];
  for (const clip of clips) {
    const previous = joined.at(-1);
    if (previous && previous.sourceId === clip.sourceId && clip.start <= previous.end + frameTolerance(clip.sourceId) && clip.end >= previous.start - frameTolerance(clip.sourceId)) {
      joined[joined.length - 1] = { ...previous, start: Math.min(previous.start, clip.start), end: Math.max(previous.end, clip.end), completed: false, outputPath: undefined, pngFramesPath: undefined, processingEngine: undefined, fallbackReason: undefined, outputWarnings: undefined };
    } else joined.push(clip);
  }
  return joined;
}

const evenDimension = (value: number) => Math.max(2, Math.round(value / 2) * 2);

export function outputDimensions(recipe: ClipRecipe, sourceWidth: number, sourceHeight: number) {
  const oriented = orientedSourceDimensions(sourceWidth, sourceHeight, recipe.rotation);
  const cropWidth = evenDimension(oriented.width * Math.max(0.02, 1 - recipe.cropLeft - recipe.cropRight));
  const cropHeight = evenDimension(oriented.height * Math.max(0.02, 1 - recipe.cropTop - recipe.cropBottom));
  if (recipe.masterSize === 'Source') return { width: cropWidth, height: cropHeight };
  const width = recipe.masterSize === 'Custom' ? evenDimension(recipe.masterWidth || cropWidth) : Number(recipe.masterSize);
  return { width, height: recipe.masterSize === 'Custom' && recipe.masterHeight ? evenDimension(recipe.masterHeight) : evenDimension(width * cropHeight / cropWidth) };
}

export function orientedSourceDimensions(width: number, height: number, rotation: ClipRecipe['rotation']) {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

export function readyWithRecipe(clip: SessionClip, recipe: ClipRecipe): SessionClip {
  if (JSON.stringify(clip.recipe) === JSON.stringify(recipe)) return clip;
  return { ...clip, recipe, completed: false, outputPath: undefined, pngFramesPath: undefined, processingEngine: undefined, fallbackReason: undefined, outputWarnings: undefined };
}

export function safeFileName(name: string) {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').trim() || 'clip';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned) ? `_${cleaned}` : cleaned;
}
