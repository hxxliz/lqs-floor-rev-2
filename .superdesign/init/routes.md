# Routes

This Electron renderer has no URL router. `src/App.tsx` owns a `ViewName` state and switches four workspaces inside the shared shell:

- `home` — project creation/import/download and recent project library.
- `find` — source playback, timeline marking, keyboard transport, and clip queue.
- `process` — immediate clip playback, crop/recipe controls, automatic processed preview, and export.
- `settings` — library/download/export paths, appearance, and expert mode.

## View model and shared contracts

```ts
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
  hdr: 'SDR' | 'HDR PQ' | 'HDR HLG' | 'Unknown';
  scanType: 'Progressive' | 'Interlaced' | 'Unknown';
  fieldOrder: string;
  variableFrameRate: boolean;
  openingIssue?: string;
  qualitySummary: string;
  recommendations: string[];
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
  watchFolder?: string;
  order: number;
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
  downloadVideo(session: StudioSession, url: string, downloadFolder?: string): Promise<StudioSource>;
  savePreferences(preferences: StudioPreferences): Promise<StudioPreferences>;
  chooseLocation(kind: 'libraryPath' | 'downloadPath' | 'exportPath', current: string): Promise<string | null>;
  previewClip(request: ExportRequest, mode: 'still' | 'video'): Promise<string>;
  exportClip(request: ExportRequest): Promise<SessionClip | null>;
  cancelExport(): Promise<void>;
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
  look: 'Natural',
  deinterlace: 'Off',
  fieldOrder: 'Auto',
  restoration: 'Off',
  rotation: 0,
  motion: 'Original',
  denoise: 'Balanced',
  denoiseStrength: 0.8,
  sharpen: 'Natural',
  sharpenStrength: 0.45,
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

export function suggestedRecipePatch(analysis: SourceAnalysis): Partial<ClipRecipe> {
  return {
    look: 'Natural',
    denoise: 'Balanced',
    denoiseStrength: 0.8,
    sharpen: 'Natural',
    sharpenStrength: 0.45,
    motion: 'Original',
    deinterlace: analysis.scanType === 'Interlaced' ? 'Bwdif' : 'Off',
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

export function applyLook(recipe: ClipRecipe, look: StudioLook): ClipRecipe {
  const next = { ...recipe, look };
  if (look === 'Natural') return { ...next, denoise: 'Balanced', denoiseStrength: 0.8, sharpen: 'Natural', sharpenStrength: 0.45, deband: false };
  if (look === 'Crisp') return { ...next, denoise: 'Balanced', denoiseStrength: 0.45, sharpen: 'Adaptive', sharpenStrength: 0.75, deband: false };
  if (look === 'Soft / noisy source') return { ...next, denoise: 'Fine detail', denoiseStrength: 1.7, sharpen: 'Natural', sharpenStrength: 0.3, deband: true };
  if (look === 'Native VS detail recovery') return { ...next, denoise: 'Off', denoiseStrength: 0, sharpen: 'Off', sharpenStrength: 0, deband: false, restoration: 'Debilinear' };
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
      joined[joined.length - 1] = { ...previous, start: Math.min(previous.start, clip.start), end: Math.max(previous.end, clip.end), completed: false, outputPath: undefined, pngFramesPath: undefined, processingEngine: undefined, fallbackReason: undefined };
    } else joined.push(clip);
  }
  return joined;
}

const evenDimension = (value: number) => Math.max(2, Math.round(value / 2) * 2);

export function outputDimensions(recipe: ClipRecipe, sourceWidth: number, sourceHeight: number) {
  const cropWidth = evenDimension(sourceWidth * Math.max(0.02, 1 - recipe.cropLeft - recipe.cropRight));
  const cropHeight = evenDimension(sourceHeight * Math.max(0.02, 1 - recipe.cropTop - recipe.cropBottom));
  if (recipe.masterSize === 'Source') return { width: cropWidth, height: cropHeight };
  const width = recipe.masterSize === 'Custom' ? evenDimension(recipe.masterWidth || cropWidth) : Number(recipe.masterSize);
  return { width, height: recipe.masterSize === 'Custom' && recipe.masterHeight ? evenDimension(recipe.masterHeight) : evenDimension(width * cropHeight / cropWidth) };
}

```
