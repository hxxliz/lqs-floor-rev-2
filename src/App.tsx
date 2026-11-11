import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import appIcon from '../assets/icon.png';
import {
  aspectPresets,
  aspectRatio,
  applyLook,
  assertPublicVideoUrl,
  createClip,
  deinterlaceChoices,
  formatTime,
  fitCropToAspect,
  joinTouchingClips,
  looks,
  masterSizes,
  moveCrop,
  outputDimensions,
  outputFormats,
  orientedSourceDimensions,
  pixelAdvice,
  previewSettingsForEvidence,
  previewSettingsToRecipePatch,
  runPreviewLoop,
  evidenceFromPreviewAnalysis,
  readyWithRecipe,
  setCropEdge,
  suggestedRecipePatch,
  suggestedRecipes,
  sourceGuidance,
  sourceGuidanceItems,
  sourceVerdict,
  type ClipRecipe,
  type DownloadBrowser,
  type ExportProgress,
  type ProjectCard,
  type PreviewSettings,
  type RuntimeStatus,
  type RenderReceipt,
  type SessionClip,
  type StudioSession,
  type StudioSource,
  type StudioLook,
  type StudioPreferences,
  type TaskProgress,
  type ViewName,
} from './shared';

const nav: Array<[ViewName, string]> = [
  ['home', 'Home'],
  ['find', 'Find moments'],
  ['process', 'Process clips'],
  ['settings', 'Settings'],
];

const welcomeSteps = [
  { eyebrow: 'WELCOME TO THE CUTTING FLOOR', title: 'Find the moments worth keeping.', symbol: '◇', body: 'Import a video, a season folder, or a public video link. Your original source files stay untouched while the project remembers every decision.', note: 'Everything runs locally with the bundled media tools.' },
  { eyebrow: '1 · FIND MOMENTS', title: 'Review first. Cut precisely.', symbol: '⌕', body: 'Playback is the focus. Scrub the timeline, move frame by frame, set Mark In and Mark Out, then add the range to the project queue.', note: 'Space plays · ← → moves a frame · Shift + ← → moves a second · I / O mark · Enter queues.' },
  { eyebrow: '2 · PROCESS CLIPS', title: 'Frame it, then choose the finish.', symbol: '▱', body: 'Each queued clip is ready to play without a render step. Adjust the crop and output size, apply conservative source guidance, or copy one recipe to the remaining clips.', note: 'Playback starts paused. Crop shape and exported pixel size are separate choices.' },
  { eyebrow: '3 · EXPORT', title: 'See every phase until it is done.', symbol: '↗', body: 'Choose the finished-product folder and export through VapourSynth. Progress, elapsed time, and the active processing phase stay visible, and Stop safely removes incomplete work.', note: 'Strict mode never substitutes a compatibility export. Optional PNGs come from the processed master.' },
] as const;

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
type SaveState = 'saving' | 'saved' | 'error';

function useElapsed(startedAt?: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return elapsed;
}

export default function App() {
  const [session, setSession] = useState<StudioSession>();
  const [view, setView] = useState<ViewName>('home');
  const [markIn, setMarkIn] = useState<number>();
  const [markOut, setMarkOut] = useState<number>();
  const [playhead, setPlayhead] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(true);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [queueFilter, setQueueFilter] = useState<'all' | 'ready' | 'completed'>('all');
  const [selectedClipId, setSelectedClipId] = useState<string>();
  const [status, setStatus] = useState('Ready');
  const [progress, setProgress] = useState<ExportProgress>();
  const [taskProgress, setTaskProgress] = useState<TaskProgress>();
  const [runtime, setRuntime] = useState<RuntimeStatus>({ ffmpeg: false, ffprobe: false, vspipe: false, ytDlp: false, vapourSynthPlugins: false });
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [preferences, setPreferences] = useState<StudioPreferences>();
  const [exportRootOverride, setExportRootOverride] = useState<string>();
  const [exportStartedAt, setExportStartedAt] = useState<number>();
  const [tuning, setTuning] = useState(false);
  const [tuneStatus, setTuneStatus] = useState('');
  const [taskStartedAt, setTaskStartedAt] = useState<number>();
  const [taskKind, setTaskKind] = useState<'download' | 'import'>();
  const [downloadSetup, setDownloadSetup] = useState<{ url: string; name: string; downloadPath: string; exportPath: string; browser: DownloadBrowser; projectId?: string }>();
  const [projectDialog, setProjectDialog] = useState<{ mode: 'create' | 'rename'; id?: string; name: string }>();
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const [loadingError, setLoadingError] = useState<string>();
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; message: string }>();
  const [undo, setUndo] = useState<{ session: StudioSession; selectedClipId?: string }>();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const video = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<StudioSession | undefined>(undefined);
  const modal = useRef<HTMLElement | null>(null);
  const modalReturnFocus = useRef<HTMLElement | null>(null);
  const loaded = useRef(false);
  const exportElapsed = useElapsed(exportStartedAt);
  const taskElapsed = useElapsed(taskStartedAt);
  const busy = Boolean(exportStartedAt || taskStartedAt);
  sessionRef.current = session;

  const reportError = useCallback((error: unknown) => {
    const message = errorMessage(error);
    setStatus(message);
    setUndo(undefined);
    setNotice({ kind: 'error', message });
  }, []);

  useEffect(() => {
    Promise.all([window.cuttingFloor.loadWorkspace(), window.cuttingFloor.runtimeStatus()]).then(([workspace, tools]) => {
      setSession(workspace.session);
      setProjects(workspace.projects);
      setPreferences(workspace.preferences);
      setShowWelcome(!workspace.preferences.onboardingComplete);
      setRuntime(tools);
      setSelectedClipId(workspace.session.clips[0]?.id);
      loaded.current = true;
    }).catch((error: Error) => { setLoadingError(error.message); reportError(error); });
    const stopExport = window.cuttingFloor.onExportProgress(setProgress);
    const stopTask = window.cuttingFloor.onTaskProgress((next) => { setTaskProgress(next); setStatus(next.message); });
    const stopWatch = window.cuttingFloor.onWatchSources((sources) => setSession((current) => current ? { ...current, sources: [...current.sources, ...sources.filter((source) => !current.sources.some((item) => item.sourcePath === source.sourcePath))] } : current));
    return () => { stopExport(); stopTask(); stopWatch(); };
  }, [reportError]);

  useEffect(() => {
    if (!session || !loaded.current || (!projects.length && !session.sources.length && !session.clips.length && session.name === 'Untitled Cutting Floor')) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => window.cuttingFloor.saveSession(session).then(() => setProjects((current) => {
      const card: ProjectCard = { id: session.id, name: session.name, updated: new Date().toISOString(), thumbnailUrl: session.sources.find((source) => source.thumbnailUrl)?.thumbnailUrl, sourceCount: session.sources.length, clipCount: session.clips.length, completedCount: session.clips.filter((clip) => clip.completed).length };
      setSaveState('saved');
      return [card, ...current.filter((item) => item.id !== card.id)];
    })).catch((error) => { setSaveState('error'); reportError(error); }), 250);
    return () => window.clearTimeout(timer);
  }, [projects.length, reportError, session]);

  const activeSource = useMemo(
    () => session?.sources.find((source) => source.id === session.activeSourceId) ?? session?.sources[0],
    [session],
  );
  const selectedClip = session?.clips.find((clip) => clip.id === selectedClipId) ?? session?.clips[0];
  const selectedSource = session?.sources.find((source) => source.id === selectedClip?.sourceId);
  const duration = activeSource?.sourceAnalysis.duration ?? 0;
  const fps = activeSource?.sourceAnalysis.fps || 30;

  useEffect(() => {
    setMarkIn(undefined);
    setMarkOut(undefined);
    setPlayhead(0);
  }, [activeSource?.id, duration]);

  useEffect(() => { setExportRootOverride(undefined); }, [session?.id]);

  const seek = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(duration, seconds));
    if (video.current) video.current.currentTime = next;
    setPlayhead(next);
  }, [duration]);

  const queueClip = useCallback(() => {
    if (!session || !activeSource) return;
    if (markIn === undefined || markOut === undefined) {
      setStatus('Set both Mark In and Mark Out before entering a clip.');
      return;
    }
    const clip = createClip(activeSource, markIn, markOut, session.clips.length + 1);
    setSession({ ...session, clips: [...session.clips, clip] });
    setSelectedClipId(clip.id);
    setStatus(`${clip.name} entered into the queue`);
    setQueueCollapsed(false);
    setMarkIn(undefined);
    setMarkOut(undefined);
  }, [activeSource, markIn, markOut, session]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== 'find' || !activeSource) return;
      const target = event.target as HTMLElement;
      const isEditing = target.matches('input:not([type="range"]), select, textarea, [contenteditable="true"]');
      if (isEditing) return;
      if (event.code === 'KeyI') { event.preventDefault(); if (target.matches('button')) target.blur(); setMarkIn(playhead); setStatus(`Mark In set at ${formatTime(playhead)}`); }
      else if (event.code === 'KeyO') { event.preventDefault(); if (target.matches('button')) target.blur(); setMarkOut(playhead); setStatus(`Mark Out set at ${formatTime(playhead)}`); }
      else if (event.code === 'Enter') {
        if (target.matches('button, summary, a') && !target.closest('.mark-controls')) return;
        event.preventDefault();
        queueClip();
      }
      else if (event.ctrlKey && (event.code === 'ArrowLeft' || event.code === 'ArrowRight') && session) {
        event.preventDefault();
        const index = session.sources.findIndex((source) => source.id === activeSource.id);
        const next = Math.max(0, Math.min(session.sources.length - 1, index + (event.code === 'ArrowLeft' ? -1 : 1)));
        setSession({ ...session, activeSourceId: session.sources[next]?.id });
      } else if (event.ctrlKey && (event.code === 'ArrowUp' || event.code === 'ArrowDown') && session && session.clips.length) {
        event.preventDefault();
        const index = Math.max(0, session.clips.findIndex((clip) => clip.id === selectedClipId));
        const next = Math.max(0, Math.min(session.clips.length - 1, index + (event.code === 'ArrowUp' ? -1 : 1)));
        setSelectedClipId(session.clips[next].id);
      }
      else if (event.code === 'Space') {
        if (target.matches('button, summary, a')) return;
        event.preventDefault();
        if (video.current?.paused) void video.current.play(); else video.current?.pause();
      } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        if (target.matches('button')) target.blur();
        seek(playhead + (event.code === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 1 / fps));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSource, fps, playhead, queueClip, seek, selectedClipId, session, view]);

  const importVideos = async (mode: 'files' | 'season' | 'watch' = 'files') => {
    if (!session || busy) return;
    setTaskKind('import');
    setTaskStartedAt(Date.now());
    setTaskProgress({ percent: 0, message: mode === 'watch' ? 'Choosing a watched folder' : 'Choosing source video' });
    try {
      setStatus('Inspecting source metadata…');
      const { sources, watchFolder } = await window.cuttingFloor.importVideos(session, mode);
      if (!sources.length && !watchFolder) return setStatus('Import cancelled');
      setSession((current) => current?.id === session.id ? { ...current, sources: [...current.sources, ...sources], activeSourceId: current.activeSourceId ?? sources[0]?.id, watchFolders: watchFolder ? [...new Set([...current.watchFolders, watchFolder])] : current.watchFolders } : current);
      if (sources.length) setView('find');
      setStatus(sources.length ? `${sources.length} source${sources.length === 1 ? '' : 's'} imported` : 'Watch folder enabled');
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) reportError(error);
      else setStatus('Import cancelled; original files were not changed.');
    } finally { setTaskStartedAt(undefined); setTaskKind(undefined); }
  };

  const reanalyzeActiveSource = async () => {
    if (!session || !activeSource || busy) return;
    setTaskKind('import');
    setTaskStartedAt(Date.now());
    setTaskProgress({ percent: 0, message: 'Preparing distributed source analysis' });
    try {
      const sourceAnalysis = await window.cuttingFloor.reanalyzeSource(activeSource.sourcePath);
      setSession((current) => current?.id === session.id ? { ...current, sources: current.sources.map((source) => source.id === activeSource.id ? { ...source, sourceAnalysis } : source) } : current);
      setStatus('Source guidance updated');
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) reportError(error);
      else setStatus('Source analysis cancelled. Existing guidance was preserved.');
    } finally { setTaskStartedAt(undefined); setTaskKind(undefined); }
  };

  const prepareDownload = (url: string) => {
    if (!preferences || busy) return false;
    try {
      const publicUrl = assertPublicVideoUrl(url);
      setDownloadSetup({ url: publicUrl, name: 'Downloaded Video', downloadPath: preferences.downloadPath, exportPath: preferences.exportPath, browser: 'none' });
      return true;
    } catch (error) { reportError(error); return false; }
  };

  const chooseDownloadFolder = async (kind: 'downloadPath' | 'exportPath') => {
    if (!downloadSetup) return;
    try {
      const path = await window.cuttingFloor.chooseLocation(kind, downloadSetup[kind]);
      if (path) setDownloadSetup((current) => current && { ...current, [kind]: path });
    } catch (error) { reportError(error); }
  };

  const downloadVideo = async () => {
    if (!downloadSetup || !downloadSetup.name.trim()) return;
    const setup = downloadSetup;
    const { url, name, downloadPath, exportPath, browser, projectId } = setup;
    setDownloadSetup(undefined);
    setTaskProgress({ percent: 0, message: 'Preparing download' });
    setTaskKind('download');
    setTaskStartedAt(Date.now());
    let project = projectId && session?.id === projectId ? { ...session, downloadPath, exportPath } : undefined;
    try {
      if (!project) {
        const workspace = await window.cuttingFloor.createProject(name.trim());
        project = { ...workspace.session, downloadPath, exportPath };
        setProjects(workspace.projects);
        setPreferences(workspace.preferences);
      }
      setSession(project);
      await window.cuttingFloor.saveSession(project);
      setTaskProgress({ percent: 0, message: 'Preparing download' });
      setStatus('Starting source download…');
      const source = await window.cuttingFloor.downloadVideo(project, url, downloadPath, browser);
      setSession({ ...project, sources: [source], activeSourceId: source.id });
      setView('find');
      setStatus(`${source.displayName} downloaded and imported`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') setStatus('Download cancelled; the new project remains available.');
      else {
        const message = errorMessage(error);
        if (/browser sign-in|sign-in could not be read/i.test(message)) {
          setDownloadSetup({ ...setup, projectId: project?.id });
          setStatus('Download needs browser sign-in');
          setUndo(undefined);
          setNotice({ kind: 'info', message: message.replace(/^.*?Error:\s*/i, '') });
        } else reportError(error);
      }
    } finally { setTaskStartedAt(undefined); setTaskKind(undefined); }
  };

  const applyWorkspace = (workspace: Awaited<ReturnType<typeof window.cuttingFloor.loadWorkspace>>) => {
    setUndo(undefined); setNotice(undefined); setSession(workspace.session); setProjects(workspace.projects); setPreferences(workspace.preferences); setSelectedClipId(workspace.session.clips.find((clip) => !clip.completed)?.id ?? workspace.session.clips[0]?.id); setView('home');
  };

  const createProject = async (name: string) => {
    try { applyWorkspace(await window.cuttingFloor.createProject(name)); }
    catch (error) { reportError(error); }
  };

  const openProject = async (id: string) => {
    try {
      const workspace = await window.cuttingFloor.openProject(id);
      applyWorkspace(workspace);
      setView(workspace.session.sources.length ? 'find' : 'home');
    }
    catch (error) { reportError(error); }
  };

  const renameProject = async (id: string, name: string) => {
    try { applyWorkspace(await window.cuttingFloor.renameProject(id, name.trim())); }
    catch (error) { reportError(error); }
  };

  const deleteProject = async (id: string) => {
    try {
      const workspace = await window.cuttingFloor.deleteProject(id);
      if (workspace) applyWorkspace(workspace);
    } catch (error) { reportError(error); }
  };

  const updateClip = (clipId: string, patch: Partial<SessionClip>) => {
    if (!session) return;
    setSession((current) => current ? { ...current, clips: current.clips.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip) } : current);
  };

  const updateRecipe = (patch: Partial<ClipRecipe>) => {
    if (!selectedClip) return;
    const clipId = selectedClip.id;
    setSession((current) => current ? { ...current, clips: current.clips.map((clip) => clip.id === clipId ? readyWithRecipe(clip, { ...clip.recipe, ...patch }) : clip) } : current);
  };

  const applyRecipeToOtherClips = () => {
    if (!session || !selectedClip) return;
    const count = session.clips.filter((clip) => clip.id !== selectedClip.id && !clip.completed).length;
    if (!count) return;
    setUndo({ session, selectedClipId });
    setSession({ ...session, clips: session.clips.map((clip) => clip.id === selectedClip.id || clip.completed ? clip : readyWithRecipe(clip, { ...selectedClip.recipe })) });
    setNotice({ kind: 'info', message: `Recipe copied to ${count} unfinished clip${count === 1 ? '' : 's'}.` });
    setStatus(`Recipe copied to ${count} unfinished clip${count === 1 ? '' : 's'}`);
  };

  const removeClip = (clipId: string) => {
    if (!session || busy) return;
    const clips = session.clips.filter((clip) => clip.id !== clipId);
    setUndo({ session, selectedClipId });
    setSession({ ...session, clips });
    setSelectedClipId(clips[0]?.id);
    setNotice({ kind: 'info', message: 'Clip removed from the project queue.' });
  };

  const moveClip = (clipId: string, delta: number) => {
    if (!session || busy) return;
    const clips = [...session.clips];
    const from = clips.findIndex((clip) => clip.id === clipId);
    const to = Math.max(0, Math.min(clips.length - 1, from + delta));
    if (from === to) return;
    [clips[from], clips[to]] = [clips[to], clips[from]];
    setSession((current) => current?.id === session.id ? { ...current, clips } : current);
  };

  const markUnfinished = (clipId: string) => { if (!session || busy) return; setUndo({ session, selectedClipId }); updateClip(clipId, { completed: false, outputPath: undefined, pngFramesPath: undefined, processingEngine: undefined, fallbackReason: undefined, outputWarnings: undefined }); setNotice({ kind: 'info', message: 'Clip returned to Ready; previous exports remain on disk.' }); setStatus('Clip returned to Ready; previous exports remain on disk.'); };
  const resetCompleted = () => { if (!session || busy) return; setUndo({ session, selectedClipId }); setSession({ ...session, clips: session.clips.map((clip) => clip.completed ? { ...clip, completed: false, outputPath: undefined, pngFramesPath: undefined, processingEngine: undefined, fallbackReason: undefined, outputWarnings: undefined } : clip) }); setNotice({ kind: 'info', message: 'Completed clips returned to Ready; previous exports remain on disk.' }); };
  const clearUnfinished = () => {
    if (!session || busy) return;
    const clips = session.clips.filter((clip) => clip.completed);
    if (clips.length === session.clips.length) return;
    setUndo({ session, selectedClipId });
    setSession({ ...session, clips });
    if (!clips.some((clip) => clip.id === selectedClipId)) setSelectedClipId(clips[0]?.id);
    setNotice({ kind: 'info', message: 'Ready clips cleared from the project queue.' });
  };
  const joinRanges = () => {
    if (!session || busy) return;
    const clips = joinTouchingClips(session.clips, (sourceId) => 1 / (session.sources.find((source) => source.id === sourceId)?.sourceAnalysis.fps || 30));
    if (clips.length === session.clips.length) return setStatus('No touching clips to join.');
    setUndo({ session, selectedClipId });
    setSession({ ...session, clips });
    if (!clips.some((clip) => clip.id === selectedClipId)) setSelectedClipId(clips[0]?.id);
    setNotice({ kind: 'info', message: 'Touching clips joined.' });
  };

  const exportSelected = async () => {
    if (!selectedClip || !preferences || !session || busy) return;
    const source = session?.sources.find((item) => item.id === selectedClip.sourceId);
    if (!source) return setStatus('The source for this clip is unavailable.');
    const projectId = session.id;
    const clipId = selectedClip.id;
    const exportedRecipe = selectedClip.recipe;
    try {
      setProgress({ clipId: selectedClip.id, percent: 0, message: 'Preparing export' });
      setExportStartedAt(Date.now());
      setStatus('Starting VapourSynth…');
      const completed = await window.cuttingFloor.exportClip({ source, clip: selectedClip, projectName: session.name, exportRoot: exportRootOverride ?? session.exportPath ?? preferences.exportPath });
      if (completed) {
        const latestClip = sessionRef.current?.id === projectId ? sessionRef.current.clips.find((clip) => clip.id === clipId) : undefined;
        const recipeChanged = Boolean(latestClip && JSON.stringify(latestClip.recipe) !== JSON.stringify(exportedRecipe));
        setSession((current) => {
          if (!current || current.id !== projectId) return current;
          return { ...current, clips: current.clips.map((clip) => {
            if (clip.id !== clipId) return clip;
            return { ...clip, completed: !recipeChanged, outputPath: completed.outputPath, processingEngine: completed.processingEngine, fallbackReason: completed.fallbackReason, pngFramesPath: completed.pngFramesPath, outputWarnings: completed.outputWarnings };
          }) };
        });
        setExportRootOverride(undefined);
        const warning = completed.outputWarnings?.[0];
        setStatus(recipeChanged ? `Exported ${completed.name} with the previous recipe; current changes remain Ready.` : warning ?? `Exported ${completed.name}`);
        if (warning) { setUndo(undefined); setNotice({ kind: 'info', message: warning }); }
        const index = session.clips.findIndex((clip) => clip.id === completed.id);
        const next = [...session.clips.slice(index + 1), ...session.clips.slice(0, index)].find((clip) => !clip.completed);
        if (next) setSelectedClipId(next.id);
      } else setStatus('Export cancelled');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') setStatus('Export cancelled; incomplete output removed and completed work preserved.');
      else reportError(error);
    } finally { setExportStartedAt(undefined); }
  };

  const tuneSelected = async () => {
    if (!selectedClip || !preferences || !session || busy || tuning) return;
    const source = session?.sources.find((item) => item.id === selectedClip.sourceId);
    if (!source) return setStatus('The source for this clip is unavailable.');
    const projectId = session.id;
    try {
      setTuning(true);
      setTuneStatus('Rendering first preview');
      const stop = window.cuttingFloor.onPreviewTuneProgress((prog) => setTuneStatus(prog.message));
      let round = 0;
      const renderAndAnalyze = async (settings: PreviewSettings) => {
        round += 1;
        setTuneStatus(`Round ${round} · rendering preview`);
        return window.cuttingFloor.tunePreview({ source, clip: selectedClip, projectName: session.name, exportRoot: exportRootOverride ?? session.exportPath ?? preferences.exportPath }, settings);
      };
      const initialEvidence = evidenceFromPreviewAnalysis(source.sourceAnalysis);
      const result = await runPreviewLoop(previewSettingsForEvidence(initialEvidence), 5, renderAndAnalyze);
      stop();
      const patch = previewSettingsToRecipePatch(result.settings);
      updateRecipe(patch);
      const fixes = Object.entries({ deinterlace: result.settings.deinterlace, deband: result.settings.deband, denoise: result.settings.denoise, sharpen: result.settings.sharpen }).filter(([, on]) => on).map(([k]) => k);
      setTuneStatus(result.converged ? `Converged after ${result.rounds.length} round${result.rounds.length === 1 ? '' : 's'}` : `Stopped after ${result.rounds.length} rounds (no further improvement)`);
      setStatus(fixes.length ? `Self-tune applied: ${fixes.join(', ')}. Review the recipe, then export.` : 'Self-tune found no fix needed — the preview already measured clean.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') setTuneStatus('Self-tune cancelled');
      else reportError(error);
    } finally { setTuning(false); setTuneStatus(''); }
  };

  const chooseExportFolder = async () => {
    if (!preferences) return;
    try {
    const folder = await window.cuttingFloor.chooseLocation('exportPath', exportRootOverride ?? session?.exportPath ?? preferences.exportPath);
      if (folder) setExportRootOverride(folder);
    } catch (error) { reportError(error); }
  };

  const savePreferences = async (next: StudioPreferences) => {
    setSaveState('saving');
    try { setPreferences(await window.cuttingFloor.savePreferences(next)); setSaveState('saved'); }
    catch (error) { setSaveState('error'); reportError(error); }
  };

  const closeWelcome = () => {
    setShowWelcome(false);
    setWelcomeStep(0);
    void savePreferences({ ...preferences!, onboardingComplete: true });
  };

  const submitProjectDialog = async () => {
    if (!projectDialog?.name.trim()) return;
    const dialog = projectDialog;
    setProjectDialog(undefined);
    if (dialog.mode === 'create') await createProject(dialog.name.trim());
    else if (dialog.id) await renameProject(dialog.id, dialog.name.trim());
  };

  const modalKey = showWelcome ? 'welcome' : downloadSetup ? 'download' : projectDialog ? 'project' : undefined;

  useEffect(() => {
    if (!modalKey) return;
    modalReturnFocus.current = document.activeElement as HTMLElement;
    window.setTimeout(() => modal.current?.querySelector<HTMLElement>('[autofocus], input, button, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showWelcome) closeWelcome();
        else if (downloadSetup) setDownloadSetup(undefined);
        else setProjectDialog(undefined);
        return;
      }
      if (event.key !== 'Tab' || !modal.current) return;
      const focusable = [...modal.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); modalReturnFocus.current?.focus(); };
  }, [modalKey]);

  if (loadingError) return <div className="startup-error" role="alert"><img src={appIcon} alt="" /><h1>Cutting Floor could not open</h1><p>{loadingError}</p><button className="primary" onClick={() => window.location.reload()}>Try again</button><small>Your projects remain saved.</small></div>;
  if (!session || !preferences) return <div className="loading" role="status" aria-live="polite">Opening the cutting floor…</div>;
  const modalOpen = Boolean(modalKey);

  return <div className={`app-shell theme-${preferences.theme ?? 'dark'}`}>
    <header className="titlebar" aria-hidden={modalOpen} inert={modalOpen ? true : undefined}>
      <div className="wordmark"><img src={appIcon} alt="" /><span>LQ'S CUTTING FLOOR</span></div>
      <div className="project-name"><span className="status-dot" />{session.name}</div>
      <div className="title-theme" role="group" aria-label="Appearance"><button aria-pressed={preferences.theme === 'light'} className={preferences.theme === 'light' ? 'active' : ''} onClick={() => void savePreferences({ ...preferences, theme: 'light' })}>Light</button><button aria-pressed={preferences.theme !== 'light'} className={preferences.theme !== 'light' ? 'active' : ''} onClick={() => void savePreferences({ ...preferences, theme: 'dark' })}>Dark</button></div>
    </header>

    <aside className="sidebar" aria-hidden={modalOpen} inert={modalOpen ? true : undefined}>
      <img className="rail-logo" src={appIcon} alt="LQ's Cutting Floor" />
      <nav>{nav.map(([name, label]) => <button disabled={busy} title={busy ? 'Finish or stop the active task before changing workspaces.' : label} aria-label={label} aria-current={view === name ? 'page' : undefined} key={name} className={view === name ? 'active' : ''} onClick={() => setView(name)}><NavIcon name={name} /></button>)}</nav>
      <div className="runtime-rail" title={runtime.error ?? 'Bundled local pipeline ready'} aria-label={`Bundled pipeline: ${runtime.error ?? 'all required tools ready'}`}>{[runtime.ffmpeg, runtime.ffprobe, runtime.vspipe, runtime.ytDlp, runtime.vapourSynthPlugins].map((ok, index) => <span key={index} className={ok ? 'ok' : 'missing'} />)}</div>
    </aside>

    <main aria-hidden={modalOpen} inert={modalOpen ? true : undefined}>
      {view === 'home' && <Home session={session} projects={projects} busy={busy} onNewProject={() => setProjectDialog({ mode: 'create', name: 'Untitled Cutting Floor' })} onOpenProject={openProject} onRenameProject={(id) => { const project = projects.find((item) => item.id === id); setProjectDialog({ mode: 'rename', id, name: project?.name ?? 'Untitled Cutting Floor' }); }} onDeleteProject={deleteProject} onImport={() => importVideos('files')} onSeason={() => importVideos('season')} onWatch={() => importVideos('watch')} onDownload={prepareDownload} onOpenSource={(id) => { setSession({ ...session, activeSourceId: id }); setView('find'); }} />}
      {view === 'find' && <FindMoments
        session={session} activeSource={activeSource} video={video} playhead={playhead} markIn={markIn} markOut={markOut}
        speed={speed} muted={muted} queueCollapsed={queueCollapsed} queueFilter={queueFilter} status={status} onImport={() => importVideos('files')} onSeek={seek}
        onTime={(value) => { setPlayhead(value); const progressValue = duration ? value / duration : 0; if (Math.abs((activeSource?.progress ?? 0) - progressValue) > 0.002) setSession({ ...session, sources: session.sources.map((source) => source.id === activeSource?.id ? { ...source, progress: progressValue } : source) }); }} onMarkIn={() => { setMarkIn(playhead); setStatus(`Mark In set at ${formatTime(playhead)}`); }} onMarkOut={() => { setMarkOut(playhead); setStatus(`Mark Out set at ${formatTime(playhead)}`); }} onQueue={queueClip}
        onSpeed={(next) => { setSpeed(next); if (video.current) video.current.playbackRate = next; }}
        onToggleMute={() => setMuted((value) => !value)} onFilter={setQueueFilter} onJoin={joinRanges} onResetCompleted={resetCompleted} onClearUnfinished={clearUnfinished} onMarkUnfinished={markUnfinished}
        onToggleReviewed={() => setSession({ ...session, sources: session.sources.map((source) => source.id === activeSource?.id ? { ...source, finished: !source.finished } : source) })}
        onReanalyze={() => void reanalyzeActiveSource()}
        onToggleQueue={() => setQueueCollapsed((value) => !value)} onSelectSource={(id) => setSession({ ...session, activeSourceId: id })}
        onRemove={removeClip} onSelectClip={(id) => { setSelectedClipId(id); setView('process'); }}
      />}
      {view === 'process' && <ProcessClips
        session={session} source={selectedSource} clip={selectedClip} progress={progress} status={status} onSelect={setSelectedClipId}
        onRecipe={updateRecipe} onExport={exportSelected} onCancel={() => window.cuttingFloor.cancelTask()}
        onMove={moveClip} onRemove={removeClip} expertMode={preferences.expertMode}
        exportRoot={exportRootOverride ?? session.exportPath ?? preferences.exportPath} exporting={Boolean(exportStartedAt)} exportElapsed={exportElapsed} onChooseExportFolder={chooseExportFolder}
        onApplyRecipeToOtherClips={applyRecipeToOtherClips}
        onFind={() => setView('find')}
        onTune={tuneSelected} tuning={tuning} tuneStatus={tuneStatus}
        onLook={(look) => selectedClip && updateRecipe(applyLook(selectedClip.recipe, look, selectedSource?.sourceAnalysis))}
        onAspect={(aspectPreset) => { if (!selectedClip || !selectedSource) return; const oriented = orientedSourceDimensions(selectedSource.sourceAnalysis.width, selectedSource.sourceAnalysis.height, selectedClip.recipe.rotation); updateRecipe(fitCropToAspect({ ...selectedClip.recipe, aspectPreset }, oriented.width, oriented.height)); }}
        onCrop={(edge, value) => { if (!selectedClip || !selectedSource) return; const oriented = orientedSourceDimensions(selectedSource.sourceAnalysis.width, selectedSource.sourceAnalysis.height, selectedClip.recipe.rotation); updateRecipe(setCropEdge(selectedClip.recipe, edge, value, oriented.width, oriented.height)); }}
      />}
      {view === 'settings' && <Settings session={session} preferences={preferences} runtime={runtime} saveState={saveState} onSession={setSession} onWorkspace={applyWorkspace} onPreferences={savePreferences} onError={reportError} onNotice={(message) => { setUndo(undefined); setNotice({ kind: 'info', message }); }} onShowWelcome={() => { setWelcomeStep(0); setShowWelcome(true); }} />}
    </main>
    {downloadSetup && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDownloadSetup(undefined); }}>
      <form ref={(node) => { modal.current = node; }} className="download-dialog" role="dialog" aria-modal="true" aria-labelledby="download-dialog-title" onSubmit={(event) => { event.preventDefault(); void downloadVideo(); }}>
        <span className="eyebrow">PUBLIC VIDEO LINK</span><h2 id="download-dialog-title">New download project</h2><p>The app will show live download and processing progress after you start.</p>
        <label className="field"><span>PROJECT NAME</span><input autoFocus maxLength={100} value={downloadSetup.name} onChange={(event) => setDownloadSetup({ ...downloadSetup, name: event.target.value })} /></label>
        <label className="field"><span>YOUTUBE ACCESS</span><select value={downloadSetup.browser} onChange={(event) => setDownloadSetup({ ...downloadSetup, browser: event.target.value as DownloadBrowser })}><option value="none">Public link only</option><option value="edge">Use Microsoft Edge sign-in</option><option value="chrome">Use Google Chrome sign-in</option><option value="firefox">Use Firefox sign-in</option><option value="brave">Use Brave sign-in</option></select><small>Only choose a browser if YouTube requests sign-in. yt-dlp reads its local cookies for this download; they are not stored by Cutting Floor.</small></label>
        <label className="field"><span>DOWNLOADED SOURCE MASTER</span><div className="location-row"><input readOnly title={downloadSetup.downloadPath} value={downloadSetup.downloadPath} /><button type="button" className="ghost" onClick={() => void chooseDownloadFolder('downloadPath')}>Choose</button></div></label>
        <label className="field"><span>FINISHED CLIPS + PNG FRAMES</span><div className="location-row"><input readOnly title={downloadSetup.exportPath} value={downloadSetup.exportPath} /><button type="button" className="ghost" onClick={() => void chooseDownloadFolder('exportPath')}>Choose</button></div></label>
        <div className="dialog-actions"><button type="button" className="ghost" onClick={() => setDownloadSetup(undefined)}>Cancel</button><button className="primary" disabled={!downloadSetup.name.trim()}>Start download</button></div>
      </form>
    </div>}
    {projectDialog && <div className="modal-backdrop" role="presentation">
      <form ref={(node) => { modal.current = node; }} className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" onSubmit={(event) => { event.preventDefault(); void submitProjectDialog(); }}>
        <span className="eyebrow">PROJECT LIBRARY</span><h2 id="project-dialog-title">{projectDialog.mode === 'create' ? 'Create a new project' : 'Rename project'}</h2>
        <label className="field"><span>PROJECT NAME</span><input autoFocus maxLength={100} value={projectDialog.name} onChange={(event) => setProjectDialog({ ...projectDialog, name: event.target.value })} /></label>
        <div className="dialog-actions"><button type="button" className="ghost" onClick={() => setProjectDialog(undefined)}>Cancel</button><button className="primary" disabled={!projectDialog.name.trim()}>{projectDialog.mode === 'create' ? 'Create project' : 'Save name'}</button></div>
      </form>
    </div>}
    {taskStartedAt && <aside className="global-task" aria-busy="true" aria-live="polite">
      <span className="global-task-spinner" aria-hidden="true" />
      <div><span>{taskKind === 'download' ? 'DOWNLOADING VIDEO' : 'PREPARING SOURCE'}</span><b>{taskProgress?.message ?? 'Preparing safely'}</b><small>{Math.round(taskProgress?.percent ?? 0)}% · {Math.floor(taskElapsed / 60)}:{String(taskElapsed % 60).padStart(2, '0')} elapsed</small></div>
      <strong>{Math.round(taskProgress?.percent ?? 0)}%</strong>
      <button className="ghost" onClick={() => window.cuttingFloor.cancelTask()}>Stop safely</button>
      <div className="progress-track" role="progressbar" aria-label={taskKind === 'download' ? 'Video download progress' : 'Source preparation progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(taskProgress?.percent ?? 0)}><i style={{ width: `${taskProgress?.percent ?? 0}%` }} /></div>
    </aside>}
    {showWelcome && <div className="modal-backdrop welcome-backdrop">
      <section ref={(node) => { modal.current = node; }} className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-body">
        <div className="welcome-brand"><img src={appIcon} alt="" /><span>LQ'S CUTTING FLOOR</span><button autoFocus aria-label="Close welcome guide" title="Close guide" onClick={closeWelcome}>×</button></div>
        <div className="welcome-copy"><span className="welcome-symbol" aria-hidden="true">{welcomeSteps[welcomeStep].symbol}</span><div><span className="eyebrow">{welcomeSteps[welcomeStep].eyebrow}</span><h2 id="welcome-title">{welcomeSteps[welcomeStep].title}</h2><p id="welcome-body">{welcomeSteps[welcomeStep].body}</p><small>{welcomeSteps[welcomeStep].note}</small></div></div>
        <div className="welcome-footer"><div className="welcome-progress" aria-label={`Step ${welcomeStep + 1} of ${welcomeSteps.length}`}>{welcomeSteps.map((step, index) => <span key={step.eyebrow} className={index === welcomeStep ? 'active' : index < welcomeStep ? 'complete' : ''} />)}</div><button className="text-button" onClick={closeWelcome}>Skip guide</button>{welcomeStep > 0 && <button className="ghost" onClick={() => setWelcomeStep((step) => step - 1)}>Back</button>}<button className="primary" onClick={() => welcomeStep === welcomeSteps.length - 1 ? closeWelcome() : setWelcomeStep((step) => step + 1)}>{welcomeStep === welcomeSteps.length - 1 ? 'Enter the cutting floor' : 'Next'}</button></div>
      </section>
    </div>}
    {notice && <aside className={`app-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{notice.kind === 'error' ? 'Something needs attention' : 'Project updated'}</span><p>{notice.message}</p><div className="notice-actions">{undo && notice.kind === 'info' && <button className="notice-undo" onClick={() => { setSession(undo.session); setSelectedClipId(undo.selectedClipId); setUndo(undefined); setNotice(undefined); setStatus('Last project change undone.'); }}>Undo</button>}<button aria-label="Dismiss message" onClick={() => { setUndo(undefined); setNotice(undefined); }}>×</button></div></aside>}
  </div>;
}

function NavIcon({ name }: { name: ViewName }) {
  const paths: Record<ViewName, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></>,
    find: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></>,
    process: <><path d="m12 3-9 5 9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Home({ session, projects, busy, onNewProject, onOpenProject, onRenameProject, onDeleteProject, onImport, onSeason, onWatch, onDownload, onOpenSource }: { session: StudioSession; projects: ProjectCard[]; busy: boolean; onNewProject(): void; onOpenProject(id: string): void; onRenameProject(id: string): void; onDeleteProject(id: string): void; onImport(): void; onSeason(): void; onWatch(): void; onDownload(url: string): boolean; onOpenSource(id: string): void }) {
  const [url, setUrl] = useState('');
  return <section className="page home-page">
    <div className="home-intro">
      <div className="eyebrow">LQ'S CUTTING FLOOR</div>
      <h1>Your next great moment is in here.</h1>
      <p>Move through a season, keep every source in context, and turn the moments you love into polished clips.</p>
      <div className="home-actions"><button className="primary" disabled={busy} onClick={onSeason}>▣ Add season folder</button><button className="ghost" disabled={busy} onClick={onImport}>▣ Add video files</button><button className="ghost" disabled={busy} onClick={onWatch}>Watch folder</button></div>
      <label className="download-label" htmlFor="public-video-url">PUBLIC VIDEO LINK</label>
      <div className="download-row"><input id="public-video-url" placeholder="Paste a public video link" disabled={busy} value={url} onChange={(event) => setUrl(event.target.value)} /><button className="ghost" disabled={busy || !url.trim()} onClick={() => { if (onDownload(url.trim())) setUrl(''); }}>{busy ? 'Working…' : 'Download'}</button></div>
      <small className="home-hint">Imports are added to the active project. Choose New project first when starting a separate job; every public-link download creates its own project.</small>
    </div>
    <div className="home-library">
      <div className="recent-head"><div><span>RECENT PROJECTS</span><h2>Pick up where you left off</h2></div><button disabled={busy} className="text-button" onClick={onNewProject}>＋ New project</button></div>
      <div className="project-grid">{projects.map((project) => <article key={project.id} className={`project-card ${project.id === session.id ? 'active' : ''}`}>
        <button disabled={busy} className="project-open" onClick={() => onOpenProject(project.id)}><span className="project-thumb"><i>{project.name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'LQ'}</i>{project.thumbnailUrl && <img src={project.thumbnailUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</span><span className="project-copy"><b>{project.name}</b><small>{project.completedCount} / {project.clipCount} clips finished · {project.sourceCount} source{project.sourceCount === 1 ? '' : 's'}</small></span></button>
        <div className="project-actions"><button disabled={busy} onClick={() => onRenameProject(project.id)}>Rename</button><button disabled={busy} className="danger" onClick={() => onDeleteProject(project.id)}>Delete</button></div>
      </article>)}</div>
      <div className="active-project-head"><div><span>ACTIVE PROJECT</span><h2 title={session.name}>{session.name}</h2></div><div className="compact-stats"><Metric value={session.sources.length} label="SOURCES" /><Metric value={session.clips.length} label="CLIPS" /><Metric value={session.clips.filter((clip) => clip.completed).length} label="DONE" /></div></div>
      <div className="source-grid">
        {session.sources.map((source) => <button disabled={busy} className="source-card" key={source.id} onClick={() => onOpenSource(source.id)}>
          <div className="source-frame">{source.thumbnailUrl && <img src={source.thumbnailUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}<span>{source.sourceAnalysis.width} × {source.sourceAnalysis.height}</span><b>{source.sourceAnalysis.fps.toFixed(3)} FPS</b></div>
          <h3 title={source.episodeLabel}>{source.episodeLabel}{source.finished ? ' ✓' : ''}</h3><p>{source.missing ? 'SOURCE MISSING' : `${source.sourceAnalysis.codec.toUpperCase()} · ${formatTime(source.sourceAnalysis.duration)} · ${Math.round(source.progress * 100)}% REVIEWED`}</p>
        </button>)}
        {!session.sources.length && <button disabled={busy} className="source-card empty-card" onClick={onImport}><b>＋</b><h3>ADD YOUR FIRST SOURCE</h3><p>MP4, MOV, MKV, AVI, MTS, WEBM</p></button>}
      </div>
    </div>
  </section>;
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>;
}

interface FindProps {
  session: StudioSession;
  activeSource?: StudioSession['sources'][number];
  video: React.RefObject<HTMLVideoElement | null>;
  playhead: number;
  markIn?: number;
  markOut?: number;
  speed: number;
  muted: boolean;
  queueCollapsed: boolean;
  queueFilter: 'all' | 'ready' | 'completed';
  status: string;
  onImport(): void;
  onSeek(value: number): void;
  onTime(value: number): void;
  onMarkIn(): void;
  onMarkOut(): void;
  onQueue(): void;
  onSpeed(value: number): void;
  onToggleMute(): void;
  onFilter(value: 'all' | 'ready' | 'completed'): void;
  onJoin(): void;
  onResetCompleted(): void;
  onClearUnfinished(): void;
  onMarkUnfinished(id: string): void;
  onToggleReviewed(): void;
  onReanalyze(): void;
  onToggleQueue(): void;
  onSelectSource(id: string): void;
  onRemove(id: string): void;
  onSelectClip(id: string): void;
}

function FindMoments(props: FindProps) {
  const { session, activeSource, video, playhead, markIn, markOut, speed, muted, queueCollapsed, queueFilter } = props;
  const workspace = useRef<HTMLElement>(null);
  useEffect(() => { workspace.current?.focus(); }, [activeSource?.id]);
  if (!activeSource) return <EmptyPage title="NO SOURCE ON THE DECK" action="IMPORT VIDEO" onAction={props.onImport} />;
  const duration = activeSource.sourceAnalysis.duration;
  const frameDuration = 1 / (activeSource.sourceAnalysis.fps || 30);
  return <section ref={workspace} tabIndex={-1} className="find-page">
    <div className="source-strip">
      <div><span className="eyebrow">ACTIVE REEL</span><select value={activeSource.id} onChange={(event) => props.onSelectSource(event.target.value)}>{session.sources.map((source) => <option key={source.id} value={source.id}>{source.episodeLabel}</option>)}</select></div>
      <div className="source-meta">{activeSource.sourceAnalysis.width}×{activeSource.sourceAnalysis.height}<b>{activeSource.sourceAnalysis.fps.toFixed(3)} FPS</b>{activeSource.sourceAnalysis.hdr} · {activeSource.sourceAnalysis.scanType}</div>
      <details className="analysis-popover"><summary title="Technical source clues and conservative processing recommendations.">Analysis</summary><b>{activeSource.sourceAnalysis.qualitySummary}</b><span>{activeSource.sourceAnalysis.codec} · {activeSource.sourceAnalysis.format} · {activeSource.sourceAnalysis.pixelFormat} · {activeSource.sourceAnalysis.bitDepth}-bit · {activeSource.sourceAnalysis.bitrate ? `${(activeSource.sourceAnalysis.bitrate / 1_000_000).toFixed(1)} Mbps` : 'bitrate unknown'}</span>{sourceGuidance(activeSource.sourceAnalysis).map((item) => <p key={item}>{item}</p>)}<InfoTip>Resolution, bitrate, bit depth, HDR, interlacing, variable frame rate, and freezes are technical clues—not a promise that every frame will look good.</InfoTip><button className="ghost" onClick={props.onReanalyze}>Reanalyze distributed samples</button></details>
      <button className="ghost" onClick={props.onToggleReviewed}>{activeSource.finished ? '✓ Reviewed' : 'Mark reviewed'}</button>
      <button className="ghost" onClick={props.onImport}>＋ Add source</button>
    </div>
    <div className="workbench">
      <div className="viewer-panel">
        <div className="video-wrap">{activeSource.missing ? <div className="missing-source">SOURCE MOVED OR DELETED<br /><small>{activeSource.sourcePath}</small></div> : <video ref={video} key={activeSource.id} src={activeSource.fileUrl} muted={muted} playsInline onTimeUpdate={(event) => props.onTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => { event.currentTarget.playbackRate = speed; }} />}<div className="frame-corners" /></div>
        <div className="timeline">
          <input title="Drag directly to scrub through the source." aria-label="Playhead" type="range" min="0" max={duration || 1} step={1 / (activeSource.sourceAnalysis.fps || 30)} value={playhead} onChange={(event) => props.onSeek(Number(event.target.value))} />
          <div className="time-row"><b>{formatTime(playhead)}</b><span>IN {markIn === undefined ? '—' : formatTime(markIn)} · OUT {markOut === undefined ? '—' : formatTime(markOut)}</span><b>{formatTime(duration)}</b></div>
        </div>
        <div className="transport">
          <button aria-keyshortcuts="Shift+ArrowLeft" title="Move one second backward. Shift + Left Arrow also works." onClick={() => props.onSeek(playhead - 1)}>−1s</button><button aria-keyshortcuts="ArrowLeft" title="Move exactly one frame backward." onClick={() => props.onSeek(playhead - frameDuration)}>‹ FRAME</button>
          <button aria-label="Play or pause" aria-keyshortcuts="Space" title="Play or pause. Space also works." className="play" onClick={() => video.current?.paused ? void video.current.play() : video.current?.pause()}>▶</button>
          <button aria-keyshortcuts="ArrowRight" title="Move exactly one frame forward." onClick={() => props.onSeek(playhead + frameDuration)}>FRAME ›</button><button aria-keyshortcuts="Shift+ArrowRight" title="Move one second forward. Shift + Right Arrow also works." onClick={() => props.onSeek(playhead + 1)}>+1s</button>
          <button title="Audio starts muted and can be restored here." onClick={props.onToggleMute}>{muted ? 'UNMUTE' : 'MUTE'}</button>
          <div className="speed">{[1, 2, 3].map((value) => <button title={`${value}× affects preview playback only.`} key={value} className={speed === value ? 'active' : ''} onClick={() => props.onSpeed(value)}>{value}×</button>)}</div>
        </div>
        <div className="mark-controls">
          <button aria-keyshortcuts="I" onClick={props.onMarkIn}><kbd>I</kbd><span>MARK IN<strong>{markIn === undefined ? 'NOT SET' : formatTime(markIn)}</strong></span></button>
          <button aria-keyshortcuts="O" onClick={props.onMarkOut}><kbd>O</kbd><span>MARK OUT<strong>{markOut === undefined ? 'NOT SET' : formatTime(markOut)}</strong></span></button>
          <button aria-keyshortcuts="Enter" className="enter-clip" disabled={markIn === undefined || markOut === undefined} title={markIn === undefined || markOut === undefined ? 'Set both I and O before entering the clip.' : 'Add the marked range to the project queue.'} onClick={props.onQueue}>ENTER CLIP <kbd>ENTER</kbd></button>
        </div>
        <div className="shortcut-line"><kbd>SPACE</kbd> PLAY / PAUSE <kbd>← →</kbd> FRAME <kbd>SHIFT + ← →</kbd> SECOND <kbd>I</kbd> IN <kbd>O</kbd> OUT <kbd>ENTER</kbd> QUEUE</div>
      </div>
      <aside className={`clip-queue ${queueCollapsed ? 'collapsed' : ''}`}>
        <button title="Hide the queue to give the player more room." className="queue-head" onClick={props.onToggleQueue} aria-expanded={!queueCollapsed}><span><b>PROJECT CLIP QUEUE</b><small>{session.clips.length} MOMENTS</small></span><i>{queueCollapsed ? '‹' : '›'}</i></button>
        {!queueCollapsed && <div className="queue-body"><div className="queue-tools"><select title="Filter the queue by Ready or Completed state." value={queueFilter} onChange={(event) => props.onFilter(event.target.value as typeof queueFilter)}><option value="all">All clips</option><option value="ready">Ready</option><option value="completed">Completed</option></select><button title="Merge overlapping or frame-adjacent ranges from the same source." onClick={props.onJoin}>Join touching</button><button title="Return every completed clip to Ready without deleting exports from disk." onClick={props.onResetCompleted}>Reset completed</button><button title="Remove all unfinished clips from this project." onClick={props.onClearUnfinished}>Clear ready</button></div>{session.clips.filter((clip) => queueFilter === 'all' || (queueFilter === 'ready' ? !clip.completed : clip.completed)).map((clip, index) => <div className={`queue-item ${clip.completed ? 'complete' : ''}`} key={clip.id}>
          <button className="queue-open" onClick={() => props.onSelectClip(clip.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{clip.name}</b><small>{formatTime(clip.start)} — {formatTime(clip.end)}</small></div></button>
          {clip.completed && <button title="Return this clip to Ready without deleting its previous export from disk." className="queue-state" aria-label={`Mark ${clip.name} unfinished`} onClick={() => props.onMarkUnfinished(clip.id)}>↺</button>}
          <button className="remove" aria-label={`Remove ${clip.name}`} onClick={() => props.onRemove(clip.id)}>×</button>
        </div>)}{!session.clips.length && <p className="queue-empty">Set I and O points, then press Enter.</p>}</div>}
      </aside>
    </div>
    <footer className="statusbar"><span className="status-dot" />{props.status}<b>{activeSource.displayName}</b></footer>
  </section>;
}

interface ProcessProps {
  session: StudioSession;
  source?: StudioSource;
  clip?: SessionClip;
  progress?: ExportProgress;
  status: string;
  expertMode: boolean;
  exportRoot: string;
  exporting: boolean;
  exportElapsed: number;
  onSelect(id: string): void;
  onRecipe(patch: Partial<ClipRecipe>): void;
  onExport(): void;
  onCancel(): void;
  onMove(id: string, delta: number): void;
  onRemove(id: string): void;
  onLook(look: StudioLook): void;
  onAspect(aspect: ClipRecipe['aspectPreset']): void;
  onCrop(edge: 'cropLeft' | 'cropRight' | 'cropTop' | 'cropBottom', value: number): void;
  onChooseExportFolder(): void;
  onApplyRecipeToOtherClips(): void;
  onFind(): void;
  onTune(): void;
  tuning: boolean;
  tuneStatus: string;
}

function ReceiptModal({ receipt, onClose }: { receipt: RenderReceipt; onClose(): void }) {
  const fmt = (n?: number) => n === undefined ? '—' : String(n);
  return <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label={`Render receipt for ${receipt.clipName}`} onClick={onClose}>
    <div className="receipt-modal" onClick={(event) => event.stopPropagation()}>
      <div className="receipt-head"><div><span className="eyebrow">RENDER RECEIPT</span><h2 title={receipt.clipName}>{receipt.clipName}</h2></div><button className="ghost" aria-label="Close receipt" onClick={onClose}>×</button></div>
      <dl className="receipt-grid">
        <div><dt>RENDERED</dt><dd>{new Date(receipt.rendered).toLocaleString()}</dd></div>
        <div><dt>ENGINE</dt><dd>{receipt.engine}</dd>{receipt.fallbackReason && <dd className="receipt-fallback">{receipt.fallbackReason}</dd>}</div>
        <div><dt>CLIP RANGE</dt><dd>{formatTime(receipt.clipRange.start)} — {formatTime(receipt.clipRange.end)}</dd></div>
        <div><dt>OUTPUT FORMAT</dt><dd>{receipt.recipe.outputFormat}</dd></div>
      </dl>
      <div className="receipt-section"><h3>SOURCE</h3><dl className="receipt-grid">
        <div><dt>LABEL</dt><dd>{receipt.sourceLabel}</dd></div>
        <div><dt>PATH</dt><dd className="receipt-path" title={receipt.sourcePath}>{receipt.sourcePath}</dd></div>
        <div><dt>RESOLUTION</dt><dd>{receipt.source.width}×{receipt.source.height}</dd></div>
        <div><dt>FPS</dt><dd>{receipt.source.fps}</dd></div>
        <div><dt>DURATION</dt><dd>{formatTime(receipt.source.duration)}</dd></div>
        <div><dt>CODEC</dt><dd>{receipt.source.codec}</dd></div>
        <div><dt>PIXEL FORMAT</dt><dd>{receipt.source.pixelFormat} · {receipt.source.bitDepth}-bit</dd></div>
        <div><dt>COLOR</dt><dd>{receipt.source.hdr}</dd></div>
        <div><dt>CADENCE</dt><dd>{receipt.source.scanType} · {receipt.source.fieldOrder}</dd></div>
        {receipt.source.banding !== undefined && <div><dt>BANDING</dt><dd>{fmt(receipt.source.banding)}</dd></div>}
        {receipt.source.noise !== undefined && <div><dt>NOISE</dt><dd>{fmt(receipt.source.noise)}</dd></div>}
      </dl></div>
      <div className="receipt-section"><h3>OUTPUTS</h3><dl className="receipt-grid">
        <div><dt>MASTER</dt><dd className="receipt-path" title={receipt.outputs.masterPath}>{receipt.outputs.masterPath}</dd></div>
        {receipt.outputs.vapourSynthScript && <div><dt>VAPOURSYNTH SCRIPT</dt><dd className="receipt-path" title={receipt.outputs.vapourSynthScript}>{receipt.outputs.vapourSynthScript}</dd></div>}
        {receipt.outputs.pngFramesFolder && <div><dt>PNG FRAMES</dt><dd className="receipt-path" title={receipt.outputs.pngFramesFolder}>{receipt.outputs.pngFramesFolder}</dd></div>}
      </dl></div>
      {receipt.warnings.length > 0 && <div className="receipt-section"><h3>NOTES</h3><ul className="receipt-notes">{receipt.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}
      <p className="receipt-foot">This receipt is the auditable record of the export: the exact source, recipe, engine, and outputs. It is stored as JSON next to the master file.</p>
    </div>
  </div>;
}

function ProcessClips(props: ProcessProps) {
  const [previewSpeed, setPreviewSpeed] = useState(1);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [recipeIndex, setRecipeIndex] = useState(0);
  const [receipt, setReceipt] = useState<RenderReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const previewVideo = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    setRecipeIndex(0);
  }, [props.clip?.id]);
  useEffect(() => {
    const element = previewVideo.current;
    if (!element || !props.clip) return;
    element.pause();
    element.currentTime = props.clip.start;
    setPreviewPosition(props.clip.start);
    setIsPreviewPlaying(false);
  }, [props.clip?.id, props.clip?.start]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code !== 'Space' || target.matches('input, select, textarea, button, [contenteditable="true"]')) return;
      event.preventDefault();
      if (previewVideo.current?.paused) void previewVideo.current.play(); else previewVideo.current?.pause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!props.clip || !props.source) return <EmptyPage title="THE QUEUE IS EMPTY" action="FIND MOMENTS FIRST" onAction={props.onFind} />;
  const { clip, source } = props;
  const recipe = clip.recipe;
  const analysis = source.sourceAnalysis;
  const suggested = suggestedRecipePatch(analysis);
  const recipes = suggestedRecipes(analysis);
  const guidanceItems = sourceGuidanceItems(analysis);
  const honestNotes = pixelAdvice(analysis);
  const dimensions = outputDimensions(recipe, source.sourceAnalysis.width, source.sourceAnalysis.height);
  const oriented = orientedSourceDimensions(source.sourceAnalysis.width, source.sourceAnalysis.height, recipe.rotation);
  const sourceAspect = source.sourceAnalysis.width / Math.max(1, source.sourceAnalysis.height);
  const rotated = recipe.rotation === 90 || recipe.rotation === 270;
  const videoStyle = rotated ? { width: `${sourceAspect * 100}%`, height: `${100 / sourceAspect}%`, transform: `rotate(${recipe.rotation}deg)` } : recipe.rotation === 180 ? { transform: 'rotate(180deg)' } : undefined;
  const clipProgress = props.progress?.clipId === clip.id ? props.progress : undefined;
  const previewFrame = 1 / Math.max(1, analysis.fps);
  const unfinishedOtherCount = props.session.clips.filter((item) => item.id !== clip.id && !item.completed).length;
  const elapsed = `${Math.floor(props.exportElapsed / 60)}:${String(props.exportElapsed % 60).padStart(2, '0')}`;
  const slowWarning = dimensions.width >= 3840 && recipe.denoise === 'Fine detail';
  const manual = (patch: Partial<ClipRecipe>) => props.onRecipe({ ...patch, look: 'Custom' });
  const togglePreview = () => {
    if (!previewVideo.current) return;
    if (previewVideo.current.paused) void previewVideo.current.play(); else previewVideo.current.pause();
  };
  const seekPreview = (value: number) => {
    const next = Math.max(clip.start, Math.min(clip.end, value));
    if (previewVideo.current) previewVideo.current.currentTime = next;
    setPreviewPosition(next);
  };
  const openReceipt = async (path: string) => {
    setReceiptLoading(true);
    try {
      setReceipt(await window.cuttingFloor.readReceipt(path));
    } catch {
      setReceipt(null);
    } finally {
      setReceiptLoading(false);
    }
  };
  return <section className={`process-page ${queueCollapsed ? 'queue-collapsed' : ''}`}>
    <div className="recipe-panel">
      <div className="recipe-title"><div><span className="eyebrow">ACTIVE RECIPE</span><h1>{clip.name}</h1></div>{props.exporting ? <div className="process-export-strip" aria-live="polite"><div><b>{clipProgress?.message ?? 'Preparing export'}</b><small>{Math.round(clipProgress?.percent ?? 0)}% · {elapsed} elapsed</small><span><i style={{ width: `${clipProgress?.percent ?? 0}%` }} /></span></div><button className="ghost" onClick={props.onCancel}>Stop safely</button></div> : <div className="reorder"><button aria-label="Move clip earlier" onClick={() => props.onMove(clip.id, -1)}>↑</button><button aria-label="Move clip later" onClick={() => props.onMove(clip.id, 1)}>↓</button><button onClick={() => props.onRemove(clip.id)}>Remove</button></div>}</div>
      <div className="crop-editor">
        <div className="preview-column"><div className="preview-heading"><span className="eyebrow">CLIP PLAYBACK</span><small>{isPreviewPlaying ? 'Playing · loops the marked range' : 'Paused · press Play when ready'}</small></div><div className="crop-preview" title="Drag inside the crop box to move it; drag an edge or corner to resize it." style={{ aspectRatio: `${oriented.width}/${oriented.height}`, maxWidth: `${oriented.width / Math.max(1, oriented.height) * 64}vh` }}>
          <video ref={previewVideo} style={videoStyle} src={source.fileUrl} poster={source.thumbnailUrl} muted preload="auto" playsInline onPlay={() => setIsPreviewPlaying(true)} onPause={() => setIsPreviewPlaying(false)} onLoadedMetadata={(event) => { event.currentTarget.currentTime = clip.start; event.currentTarget.playbackRate = previewSpeed; event.currentTarget.pause(); setPreviewPosition(clip.start); }} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= clip.end) { event.currentTarget.currentTime = clip.start; setPreviewPosition(clip.start); if (!event.currentTarget.paused) void event.currentTarget.play(); } else setPreviewPosition(event.currentTarget.currentTime); }} /><CropMask recipe={recipe} source={source} onChange={props.onRecipe} />
        </div><div className="preview-timeline"><input aria-label="Clip playhead" title="Scrub within the marked clip." type="range" min={clip.start} max={clip.end} step={previewFrame} value={previewPosition} onChange={(event) => seekPreview(Number(event.target.value))} /><div><span>{formatTime(previewPosition)}</span><span>{formatTime(clip.end)}</span></div></div><div className="preview-transport"><button className="frame-step" aria-label="Move one frame backward" title="Move one frame backward." onClick={() => seekPreview(previewPosition - previewFrame)}>‹</button><button aria-keyshortcuts="Space" className="primary" onClick={togglePreview}>{isPreviewPlaying ? 'Pause clip' : 'Play clip'} <kbd>Space</kbd></button><button className="frame-step" aria-label="Move one frame forward" title="Move one frame forward." onClick={() => seekPreview(previewPosition + previewFrame)}>›</button><span>{formatTime(clip.start)}–{formatTime(clip.end)} · loops inside the marked range</span><div className="speed">{[1, 2, 3].map((value) => <button title={`${value}× changes playback only.`} key={value} className={previewSpeed === value ? 'active' : ''} onClick={() => { setPreviewSpeed(value); if (previewVideo.current) previewVideo.current.playbackRate = value; }}>{value}×</button>)}</div></div></div>
      </div>
      <div className="recipe-inspector"><fieldset className="recipe-fields" disabled={props.exporting}>
        <div className="crop-controls"><div className="section-head"><h2>COMPOSITION CROP</h2><span>{aspectRatio(recipe) ? 'RATIO LOCKED' : 'FREE CROP'} · {dimensions.width}×{dimensions.height} OUTPUT</span></div>
          <Field label="COMPOSITION RATIO"><select title="The selected ratio remains fixed while crop edges or corners are resized." value={recipe.aspectPreset} onChange={(event) => props.onAspect(event.target.value as ClipRecipe['aspectPreset'])}>{aspectPresets.map((value) => <option key={value}>{value}</option>)}</select></Field>
          {recipe.aspectPreset === 'Custom' && <div className="number-pair"><NumberInput label="RATIO WIDTH" value={recipe.customRatioWidth} onChange={(value) => props.onRecipe({ customRatioWidth: value })} /><NumberInput label="RATIO HEIGHT" value={recipe.customRatioHeight} onChange={(value) => props.onRecipe({ customRatioHeight: value })} /><button className="ghost" onClick={() => props.onAspect('Custom')}>APPLY</button></div>}
          <div className="crop-sliders"><CropField label="LEFT" value={recipe.cropLeft} onChange={(value) => props.onCrop('cropLeft', value)} /><CropField label="RIGHT" value={recipe.cropRight} onChange={(value) => props.onCrop('cropRight', value)} /><CropField label="TOP" value={recipe.cropTop} onChange={(value) => props.onCrop('cropTop', value)} /><CropField label="BOTTOM" value={recipe.cropBottom} onChange={(value) => props.onCrop('cropBottom', value)} /></div>
          <button className="text-button" onClick={() => props.onRecipe({ cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, aspectPreset: 'Free' })}>Reset crop</button>
          <InfoTip>The crop ratio sets the shape; Master Size sets the exported pixels. VapourSynth prepares 4:4:4, performs crop-aware resize, and keeps 16-bit 4:4:4 through cleanup. A blank custom height is derived without stretching.</InfoTip>
        </div>
      <div className="analysis-guide"><div className="guidance-copy"><span>SOURCE GUIDANCE</span><b>{sourceVerdict(analysis)}</b>{honestNotes.length > 0 && <ul className="honest-notes" aria-label="What the decoded pixels actually show">{honestNotes.map((note) => <li key={note}>{note}</li>)}</ul>}<div className="guidance-signals"><i>{analysis.codec.toUpperCase()}</i><i>{analysis.pixelFormat} · {analysis.bitDepth}-bit</i><i>{analysis.scanEvidence ? `${analysis.scanEvidence.confidence} cadence confidence` : 'Cadence not resampled'}</i><i>{analysis.hdr}</i><i>{analysis.frameTiming?.kind ?? 'Timing not resampled'}</i>{Boolean(analysis.bitrate) && <i>{(analysis.bitrate / 1_000_000).toFixed(1)} Mbps · container only</i>}</div><details><summary>Review the evidence</summary><div className="guidance-cards">{guidanceItems.map((item) => <article key={`${item.title}-${item.evidence}`}><header><b>{item.title}</b><i className={`confidence-${item.confidence.toLowerCase()}`}>{item.confidence} confidence</i></header><p><strong>Evidence</strong>{item.evidence}</p><p><strong>Recommendation</strong>{item.recommendation}</p><p><strong>Check in playback</strong>{item.check}</p></article>)}</div></details><small>Apply Suggested Settings keeps subjective cleanup off, preserves original motion, and only enables cadence or color conversion when the stored evidence supports it.</small></div><div className="analysis-actions"><button className="ghost" onClick={() => props.onRecipe(suggested)}>Apply conservative settings</button>{recipes.length > 1 && (<div className="recipe-alternatives"><label className="recipe-alternatives-label"><span>RECIPE ALTERNATIVES</span><select value={Math.min(recipeIndex, recipes.length - 1)} onChange={(event) => setRecipeIndex(Number(event.target.value))}>{recipes.map((alt, index) => <option key={alt.name} value={index}>{alt.name} · {alt.confidence}</option>)}</select></label><p className="recipe-alternatives-why">{recipes[Math.min(recipeIndex, recipes.length - 1)]?.why ?? ''}</p><button className="ghost" onClick={() => { const alt = recipes[Math.min(recipeIndex, recipes.length - 1)]; if (alt) props.onRecipe(alt.patch); }}>Apply selected</button></div>)}<button className="ghost" disabled={!unfinishedOtherCount} onClick={props.onApplyRecipeToOtherClips}>Apply to {unfinishedOtherCount} unfinished clip{unfinishedOtherCount === 1 ? '' : 's'}</button></div></div>
      <div className="recipe-settings-grid">
        <article className="recipe-section"><div className="recipe-section-head"><div><span>OUTPUT</span><h3>Master file</h3></div><p>Choose the delivered format and actual exported pixel size.</p></div><div className="recipe-section-fields">
          <Field label="OUTPUT FORMAT"><select value={recipe.outputFormat} onChange={(event) => props.onRecipe({ outputFormat: event.target.value as ClipRecipe['outputFormat'] })}>{outputFormats.map((value) => <option key={value} value={value}>{value === 'MP4' ? 'High-quality MP4 · H.264 CRF 12' : value === 'ProRes 422' ? 'Photoshop MOV · ProRes 422 HQ' : 'Photoshop MOV · ProRes 4444'}</option>)}</select></Field>
          <Field label="MASTER SIZE"><select value={recipe.masterSize} onChange={(event) => props.onRecipe({ masterSize: event.target.value as ClipRecipe['masterSize'] })}>{masterSizes.map((value) => <option key={value}>{value}</option>)}</select></Field>
          {recipe.masterSize === 'Custom' && <Field label="CUSTOM MASTER"><div className="number-pair"><NumberInput label="WIDTH" value={recipe.masterWidth} onChange={(value) => props.onRecipe({ masterWidth: value })} /><NumberInput label="HEIGHT · OPTIONAL" value={recipe.masterHeight ?? ''} onChange={(value) => props.onRecipe({ masterHeight: value || undefined })} /></div></Field>}
        </div></article>
        <article className="recipe-section"><div className="recipe-section-head"><div><span>DETAIL</span><h3>Clean and sharpen</h3></div><p>Start with a look, then adjust only what the shot needs.</p></div><div className="recipe-section-fields two-column">
          <Field label="STARTING LOOK"><select value={recipe.look} onChange={(event) => props.onLook(event.target.value as StudioLook)}>{looks.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="RESTORATION"><select value={recipe.restoration} onChange={(event) => manual({ restoration: event.target.value as ClipRecipe['restoration'] })}>{['Off', 'Debilinear', 'Debicubic'].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="DENOISE METHOD"><select value={recipe.denoise} onChange={(event) => manual({ denoise: event.target.value as ClipRecipe['denoise'] })}>{['Off', 'Balanced', 'Fine detail'].map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label={`DENOISE STRENGTH · ${recipe.denoiseStrength.toFixed(2)}`}><input title="0 is off; 0.5–1.0 is gentle; 1.2–2.0 targets visible noise; above 2 can smear fine detail." type="range" min="0" max="3" step="0.05" value={recipe.denoiseStrength} onChange={(event) => manual({ denoiseStrength: Number(event.target.value) })} /></Field>
          <Field label="SHARPEN METHOD"><select value={recipe.sharpen} onChange={(event) => manual({ sharpen: event.target.value as ClipRecipe['sharpen'] })}>{['Off', 'Natural', 'Adaptive'].map((value) => <option key={value}>{value === 'Natural' ? 'Natural lines' : value === 'Adaptive' ? 'Adaptive crisp' : value}</option>)}</select></Field>
          <Field label={`SHARPEN STRENGTH · ${recipe.sharpenStrength.toFixed(2)}`}><input title="0.3–0.6 is subtle; 0.7–1.0 is visibly crisp and may reveal halos on difficult footage." type="range" min="0" max="1" step="0.05" value={recipe.sharpenStrength} onChange={(event) => manual({ sharpenStrength: Number(event.target.value) })} /></Field>
        </div></article>
        <article className="recipe-section"><div className="recipe-section-head"><div><span>MOTION</span><h3>Cadence and playback</h3></div><p>Preserve original motion unless the source visibly needs intervention.</p></div><div className="recipe-section-fields two-column">
          <Field label="DEINTERLACE / CADENCE"><select value={recipe.deinterlace} onChange={(event) => props.onRecipe({ deinterlace: event.target.value as ClipRecipe['deinterlace'] })}>{deinterlaceChoices.map((value) => <option key={value} value={value}>{value === 'Bwdif' ? 'Bwdif · same-rate' : value === 'Bwdif 2×' ? 'Bwdif · double-rate' : value === 'QTGMC Quality' ? 'QTGMC · maximum quality' : value}</option>)}</select></Field>
          <Field label="MOTION"><select value={recipe.motion} onChange={(event) => props.onRecipe({ motion: event.target.value as ClipRecipe['motion'] })}>{['Original', '30 fps', '60 fps'].map((value) => <option key={value}>{value}</option>)}</select></Field>
          {props.expertMode && <Field label="FIELD ORDER"><select value={recipe.fieldOrder} onChange={(event) => props.onRecipe({ fieldOrder: event.target.value as ClipRecipe['fieldOrder'] })}>{['Auto', 'Top first', 'Bottom first'].map((value) => <option key={value}>{value}</option>)}</select></Field>}
          {props.expertMode && <Field label="ROTATION"><select value={recipe.rotation} onChange={(event) => props.onRecipe({ rotation: Number(event.target.value) as ClipRecipe['rotation'] })}>{[0, 90, 180, 270].map((value) => <option key={value} value={value}>{value}°</option>)}</select></Field>}
        </div></article>
        <article className="recipe-section"><div className="recipe-section-head"><div><span>FINISHING</span><h3>Color and extras</h3></div><p>Optional finishing operations and inspectable pipeline output.</p></div><div className="recipe-section-fields two-column">
          {props.expertMode && <Field label="COLOR MANAGEMENT"><select value={recipe.colorManagement} onChange={(event) => props.onRecipe({ colorManagement: event.target.value as ClipRecipe['colorManagement'] })}>{['Auto', 'SDR Rec.709', 'Convert 601 to 709', 'HDR PQ to SDR', 'HDR HLG to SDR', 'Preserve'].map((value) => <option key={value}>{value}</option>)}</select></Field>}
          {props.expertMode && <Field label="ENGINE POLICY"><select value={recipe.fallbackMode} onChange={(event) => props.onRecipe({ fallbackMode: event.target.value as ClipRecipe['fallbackMode'] })}><option>Strict VapourSynth</option><option>Allow FFmpeg fallback</option></select></Field>}
        </div><div className="toggle-row">{([['deband', 'DEBAND GRADIENTS'], ['reverse', 'REVERSE VIDEO + AUDIO'], ['fade', 'SHORT FADE'], ['extractFrames', 'EXTRACT PROCESSED PNGS'], ['saveVapourSynthScript', 'SAVE .VPY']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={recipe[key]} onChange={(event) => key === 'deband' ? manual({ deband: event.target.checked }) : props.onRecipe({ [key]: event.target.checked })} />{label}</label>)}</div>
          {recipe.extractFrames && <div className="frame-options"><Field label="PNG EXTRACTION"><select value={recipe.frameExtraction} onChange={(event) => props.onRecipe({ frameExtraction: event.target.value as ClipRecipe['frameExtraction'] })}><option>Every processed frame</option><option>Custom frame rate</option></select></Field>{recipe.frameExtraction === 'Custom frame rate' && <NumberInput label="PNG FPS" value={recipe.frameFps} onChange={(value) => props.onRecipe({ frameFps: Math.max(0.01, value) })} />}</div>}
        </article>
      </div>
      <details className="recipe-guidance"><summary>Why these settings?</summary><div className="tip-grid"><InfoTip><b>LOOK + DETAIL</b> Start gently; use Crisp only for visibly soft edges and denoise only unwanted noise. Off preserves grain. Balanced is the faster BM3D option; Fine detail adds refinement but may soften texture. Inspect faces, hair, text, and shadows at output size.</InfoTip><InfoTip><b>FILTER STRENGTH</b> These are app-specific BM3D/CAS controls—not KNLM, FineSharp, or Photoshop values. Try denoise 0.5–1.0 first; stronger cleanup can smear detail. Sharpen 0.3–0.6 is subtle; watch for halos as strength rises.</InfoTip><InfoTip><b>CADENCE + MOTION</b> Off preserves progressive footage. Bwdif same-rate keeps the frame rate; double-rate and QTGMC produce more frames from fields. Wrong field order can jitter. Inverse telecine is only for confirmed telecined film—not every 30 fps source. MVTools smoothing creates intermediate frames; check cuts, occlusions, and fast motion for artifacts.</InfoTip><InfoTip><b>RESTORATION + REVIEW</b> Descale attempts to undo a matching earlier upscale; it is not general-purpose detail enhancement. Keep it Off without evidence. Enlarging the master cannot recover lost detail. Playback here is the original framing reference, not a promise of the processed look. Reuse recipes only across comparable sources, then check each crop.</InfoTip></div></details>
      <div className="pipeline-card"><span>VAPOURSYNTH PRIMARY PIPELINE</span><code>BestSource → cadence → trim → crop → restore → BM3D → CAS → MVTools → output</code></div>
      <details className="recipe-guidance"><summary>Engine and output details</summary><div className="tip-grid"><InfoTip><b>ENGINE + COLOR</b> Strict mode stops on VapourSynth failure; Compatibility creates a clearly labeled substitute. Auto maps HDR PQ/HLG and SD Rec.601 to SDR Rec.709, with a conservative Rec.709 fallback for untagged video.</InfoTip><InfoTip><b>OUTPUTS</b> ProRes 422 HQ is the practical Photoshop master, 4444 keeps maximum chroma at much larger size, and MP4 is compact 4:2:0. PNGs come from the processed export; saved .vpy files record the actual recipe.</InfoTip></div></details>
      {clip.processingEngine === 'FFmpeg compatibility' && <div className="compatibility-note"><b>COMPATIBILITY EXPORT</b>{clip.fallbackReason}</div>}
      {clip.outputWarnings?.map((warning) => <div className="compatibility-note" key={warning}><b>OUTPUT NOTE</b>{warning}</div>)}
      {slowWarning && <div className="compatibility-note"><b>LONG EXPORT EXPECTED</b>4K with Fine detail BM3D can be substantially slower. Phase and elapsed time below will continue updating.</div>}
      </fieldset>
      <div className="export-location"><div title={`${props.exportRoot}\\${props.session.name}`}><span>EXPORT LOCATION</span><b>{props.exportRoot}\{props.session.name}</b></div><button title="Choose a destination for this export only. The Settings default will not change." className="ghost" disabled={props.exporting} onClick={props.onChooseExportFolder}>Choose folder</button></div>
      {(clipProgress || props.exporting) && <div className={`export-progress ${props.exporting ? 'active' : ''}`} aria-busy={props.exporting} aria-live="polite"><div className="progress-copy"><span>EXPORT PROGRESS</span><b>{clipProgress?.message ?? 'Preparing export'}</b><small>{props.exporting ? `Active · ${elapsed} elapsed` : clipProgress?.percent === 100 ? `Completed in ${elapsed}` : 'Stopped'}</small></div><strong>{Math.round(clipProgress?.percent ?? 0)}%</strong><div className="progress-track" role="progressbar" aria-label="Clip export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clipProgress?.percent ?? 0)}><i style={{ width: `${clipProgress?.percent ?? 0}%` }} /></div></div>}
      {props.tuning && <div className="export-progress active" aria-busy="true" aria-live="polite"><div className="progress-copy"><span>SELF-TUNE PREVIEW</span><b>{props.tuneStatus || 'Tuning…'}</b><small>Measuring a short preview each round</small></div></div>}
      <div className="export-row"><div><span className={`status-dot ${props.exporting ? 'working' : ''}`} />{props.status}</div>{props.exporting && <button className="ghost" onClick={props.onCancel}>Stop safely</button>}{clip.completed && clip.receiptPath && <button className="ghost" disabled={receiptLoading} title="Open the render receipt — the auditable record of this export." onClick={() => openReceipt(clip.receiptPath as string)}>{receiptLoading ? 'Loading…' : 'Receipt'}</button>}<button className="ghost" disabled={props.tuning || props.exporting} title="Self-tuning preview: renders short previews with candidate fixes and re-measures the pixels each round until the preview stops improving. Applies the converged recipe." onClick={props.onTune}>{props.tuning ? 'Tuning…' : 'Self-tune preview'}</button><button className="primary" disabled={props.exporting} onClick={props.onExport}>{props.exporting ? 'Exporting…' : 'Export clip →'}</button></div>
      </div>
    </div>
    <aside className={`process-list ${queueCollapsed ? 'collapsed' : ''}`}><button className="process-queue-head" title={queueCollapsed ? 'Show project clips' : 'Hide project clips'} onClick={() => setQueueCollapsed((value) => !value)}><span><b>PROJECT CLIPS</b><small>{props.session.clips.length} clips</small></span><i>{queueCollapsed ? '‹' : '›'}</i></button>{!queueCollapsed && props.session.clips.map((item, index) => <button disabled={props.exporting} key={item.id} className={item.id === clip.id ? 'active' : ''} onClick={() => props.onSelect(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{item.name}</b><small>{formatTime(item.end - item.start)} · {item.completed ? 'COMPLETE' : 'READY'}</small></div></button>)}</aside>
    {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
  </section>;
}

function Settings({ session, preferences, runtime, saveState, onSession, onWorkspace, onPreferences, onError, onNotice, onShowWelcome }: { session: StudioSession; preferences: StudioPreferences; runtime: RuntimeStatus; saveState: SaveState; onSession(session: StudioSession): void; onWorkspace(workspace: Awaited<ReturnType<typeof window.cuttingFloor.loadWorkspace>>): void; onPreferences(preferences: StudioPreferences): Promise<void>; onError(error: unknown): void; onNotice(message: string): void; onShowWelcome(): void }) {
  const choose = async (kind: 'libraryPath' | 'downloadPath' | 'exportPath') => {
    try {
      const folder = await window.cuttingFloor.chooseLocation(kind, preferences[kind]);
      if (!folder) return;
      if (kind === 'libraryPath') {
        const workspace = await window.cuttingFloor.changeLibrary(session, folder);
        if (workspace) onWorkspace(workspace);
      } else await onPreferences({ ...preferences, [kind]: folder });
    } catch (error) { onError(error); }
  };
  const copyDiagnostics = async () => {
    try { await navigator.clipboard.writeText(runtime.error ?? JSON.stringify(runtime, null, 2)); onNotice('Pipeline diagnostics copied to the clipboard.'); }
    catch (error) { onError(error); }
  };
  const tools = [['FFmpeg', runtime.ffmpeg], ['FFprobe', runtime.ffprobe], ['VSPipe', runtime.vspipe], ['yt-dlp', runtime.ytDlp], ['VapourSynth plugins', runtime.vapourSynthPlugins]] as const;
  return <section className="page settings-page">
    <header className="settings-head"><div><span className="eyebrow">SETTINGS · WORKSPACE PREFERENCES</span><h1>Settings</h1></div><span>{session.sources.length} sources · {session.sources.filter((source) => source.finished).length} reviewed · LOCAL SESSION</span></header>
    <div className="settings-intro"><div><span className="eyebrow">THE CUTTING FLOOR, YOUR WAY</span><h2>Keep every workspace choice close at hand.</h2><p>Originals remain untouched while project locations, watched folders, and processing preferences save locally.</p></div><span className={`settings-saved ${saveState}`} role="status">{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Couldn’t save' : '✓ Saved'}</span></div>
    <div className="settings-grid">
      <article className="settings-card"><div className="settings-card-head"><div><h3>Appearance</h3><p>Choose the workspace treatment that suits your session.</p></div><span>☼</span></div><div className="theme-toggle" role="group" aria-label="Appearance"><button aria-pressed={preferences.theme === 'light'} className={preferences.theme === 'light' ? 'active' : ''} onClick={() => void onPreferences({ ...preferences, theme: 'light' })}>Light</button><button aria-pressed={preferences.theme !== 'light'} className={preferences.theme !== 'light' ? 'active' : ''} onClick={() => void onPreferences({ ...preferences, theme: 'dark' })}>Dark</button></div><button className="ghost show-welcome" onClick={onShowWelcome}>Show welcome guide</button><InfoTip>Dark is the first-launch default. Your selection applies app-wide and is restored before the next session appears.</InfoTip></article>
      <article className="settings-card"><div className="settings-card-head"><div><h3>Watched folders</h3><p>Control where newly obtained episodes enter this project.</p></div><span>⌕</span></div><div className="settings-note">{session.watchFolders.length ? session.watchFolders.map((folder) => <span title={folder} key={folder}>{folder}</span>) : <span>None configured for this project.</span>}</div><InfoTip>Use Watch folder from Home to add a season location. New sources retain their episode identity.</InfoTip></article>
      <article className="settings-card wide"><div className="settings-card-head"><div><h3>Project locations</h3><p>Separate session data, downloaded masters, and finished products without moving originals.</p></div><span>▣</span></div><div className="settings-locations"><Field label="PROJECT / SESSION LIBRARY"><div className="location-row"><input readOnly title={preferences.libraryPath} value={preferences.libraryPath} /><button className="ghost" onClick={() => choose('libraryPath')}>Choose</button></div></Field><Field label="DOWNLOADED SOURCE MASTERS"><div className="location-row"><input readOnly title={preferences.downloadPath} value={preferences.downloadPath} /><button className="ghost" onClick={() => choose('downloadPath')}>Choose</button></div></Field><Field label="FINISHED CLIPS + PNG FRAMES"><div className="location-row"><input readOnly title={preferences.exportPath} value={preferences.exportPath} /><button className="ghost" onClick={() => choose('exportPath')}>Choose</button></div></Field></div></article>
      <article className="settings-card"><div className="settings-card-head"><div><h3>Project and processing</h3><p>Name this session and choose how much recipe detail to expose.</p></div><span>⌘</span></div><Field label="PROJECT NAME"><div className="location-row"><input value={session.name} maxLength={100} onChange={(event) => onSession({ ...session, name: event.target.value })} /></div></Field><label className="expert-toggle"><input type="checkbox" checked={preferences.expertMode} onChange={(event) => void onPreferences({ ...preferences, expertMode: event.target.checked })} /><span><b>EXPERT MODE</b><small>Show field order, rotation, color management, and compatibility controls.</small></span></label></article>
      <article className="settings-card"><div className="settings-card-head"><div><h3>Local pipeline</h3><p>The bundled tools used for downloads, analysis, previews, and exports.</p></div><span>↯</span></div><div className="settings-runtime">{tools.map(([name, ok]) => <div key={name}><i className={ok ? 'ok' : 'missing'} /><span>{name}</span><b>{ok ? 'READY' : 'MISSING'}</b></div>)}</div>{runtime.error && <div className="runtime-error" role="alert"><b>Pipeline check details</b><p>{runtime.error}</p><button className="ghost" onClick={() => void copyDiagnostics()}>Copy diagnostics</button></div>}</article>
    </div>
  </section>;
}

function CropField({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return <label><span>{label} · {Math.round(value * 100)}%</span><input type="range" min="0" max="0.8" step="0.001" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function CropMask({ recipe, source, onChange }: { recipe: ClipRecipe; source: StudioSource; onChange(recipe: ClipRecipe): void }) {
  const drag = useRef<{ x: number; y: number; recipe: ClipRecipe } | undefined>(undefined);
  const oriented = orientedSourceDimensions(source.sourceAnalysis.width, source.sourceAnalysis.height, recipe.rotation);
  const move = (event: React.PointerEvent<HTMLButtonElement>, edges: Array<'cropLeft' | 'cropRight' | 'cropTop' | 'cropBottom'>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.closest('.crop-preview')!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    let next = recipe;
    for (const edge of edges) next = setCropEdge(next, edge, edge === 'cropLeft' ? x : edge === 'cropRight' ? 1 - x : edge === 'cropTop' ? y : 1 - y, oriented.width, oriented.height);
    onChange(next);
  };
  const handles: Array<[string, Array<'cropLeft' | 'cropRight' | 'cropTop' | 'cropBottom'>]> = [
    ['nw', ['cropLeft', 'cropTop']], ['n', ['cropTop']], ['ne', ['cropRight', 'cropTop']],
    ['e', ['cropRight']], ['se', ['cropRight', 'cropBottom']], ['s', ['cropBottom']],
    ['sw', ['cropLeft', 'cropBottom']], ['w', ['cropLeft']],
  ];
  return <div className="crop-mask" style={{ left: `${recipe.cropLeft * 100}%`, right: `${recipe.cropRight * 100}%`, top: `${recipe.cropTop * 100}%`, bottom: `${recipe.cropBottom * 100}%` }}>
    <button title="Drag inside the crop box to move it." className="crop-drag" aria-label="Move crop" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, recipe }; }} onPointerMove={(event) => { if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const bounds = event.currentTarget.closest('.crop-preview')!.getBoundingClientRect(); onChange(moveCrop(drag.current.recipe, (event.clientX - drag.current.x) / bounds.width, (event.clientY - drag.current.y) / bounds.height)); }} />
    {handles.map(([position, edges]) => <button title="Drag to resize; the selected composition ratio stays locked." key={position} aria-label={`Resize crop ${position}`} className={`crop-handle ${position}`} onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={(event) => move(event, edges)} />)}
  </div>;
}

function NumberInput({ label, value, onChange }: { label: string; value: number | ''; onChange(value: number): void }) {
  return <label className="number-input"><span>{label}</span><input type="number" min="1" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Field({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function InfoTip({ children }: React.PropsWithChildren) {
  return <p className="info-tip"><span aria-hidden="true">ⓘ</span>{children}</p>;
}

function EmptyPage({ title, action, onAction }: { title: string; action: string; onAction?(): void }) {
  return <section className="empty-page"><div className="empty-symbol">◇</div><h1>{title}</h1><p>Import a source and mark the moments you want to keep.</p>{onAction && <button className="primary" onClick={onAction}>{action}</button>}</section>;
}
