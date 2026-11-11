# Layouts

## Application shell

- Source: `src/App.tsx`
- Description: Electron desktop shell with custom title bar, persistent left navigation, runtime status, and one main workspace switching between Home, Find Moments, Process Clips, and Settings.

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  aspectPresets,
  applyLook,
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
  setCropEdge,
  suggestedRecipePatch,
  type ClipRecipe,
  type ExportProgress,
  type ProjectCard,
  type RuntimeStatus,
  type SessionClip,
  type StudioSession,
  type StudioSource,
  type StudioLook,
  type StudioPreferences,
  type TaskProgress,
  type ViewName,
} from './shared';

const nav: Array<[ViewName, string, string]> = [
  ['home', '⌂', 'HOME'],
  ['find', '⌕', 'FIND MOMENTS'],
  ['process', '◇', 'PROCESS CLIPS'],
  ['settings', '⚙', 'SETTINGS'],
];

export default function App() {
  const [session, setSession] = useState<StudioSession>();
  const [view, setView] = useState<ViewName>('home');
  const [markIn, setMarkIn] = useState(0);
  const [markOut, setMarkOut] = useState(0);
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
  const [previewMode, setPreviewMode] = useState<'original' | 'still' | 'video'>('original');
  const [previewUrls, setPreviewUrls] = useState<Partial<Record<'still' | 'video', string>>>({});
  const [exportRootOverride, setExportRootOverride] = useState<string>();
  const [exportStartedAt, setExportStartedAt] = useState<number>();
  const [exportElapsed, setExportElapsed] = useState(0);
  const [downloadStartedAt, setDownloadStartedAt] = useState<number>();
  const [downloadElapsed, setDownloadElapsed] = useState(0);
  const [downloadSetup, setDownloadSetup] = useState<{ url: string; name: string; downloadPath: string; exportPath: string }>();
  const video = useRef<HTMLVideoElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([window.cuttingFloor.loadWorkspace(), window.cuttingFloor.runtimeStatus()]).then(([workspace, tools]) => {
      setSession(workspace.session);
      setProjects(workspace.projects);
      setPreferences(workspace.preferences);
      setRuntime(tools);
      setSelectedClipId(workspace.session.clips[0]?.id);
      loaded.current = true;
    }).catch((error: Error) => setStatus(error.message));
    const stopExport = window.cuttingFloor.onExportProgress(setProgress);
    const stopTask = window.cuttingFloor.onTaskProgress((next) => { setTaskProgress(next); setStatus(next.message); });
    const stopWatch = window.cuttingFloor.onWatchSources((sources) => setSession((current) => current ? { ...current, sources: [...current.sources, ...sources.filter((source) => !current.sources.some((item) => item.sourcePath === source.sourcePath))] } : current));
    return () => { stopExport(); stopTask(); stopWatch(); };
  }, []);

  useEffect(() => {
    if (!session || !loaded.current) return;
    const timer = window.setTimeout(() => window.cuttingFloor.saveSession(session).then(() => setProjects((current) => {
      const card: ProjectCard = { id: session.id, name: session.name, updated: new Date().toISOString(), thumbnailUrl: session.sources.find((source) => source.thumbnailUrl)?.thumbnailUrl, sourceCount: session.sources.length, clipCount: session.clips.length, completedCount: session.clips.filter((clip) => clip.completed).length };
      return [card, ...current.filter((item) => item.id !== card.id)];
    })).catch((error: Error) => setStatus(error.message)), 250);
    return () => window.clearTimeout(timer);
  }, [session]);

  const activeSource = useMemo(
    () => session?.sources.find((source) => source.id === session.activeSourceId) ?? session?.sources[0],
    [session],
  );
  const selectedClip = session?.clips.find((clip) => clip.id === selectedClipId) ?? session?.clips[0];
  const selectedSource = session?.sources.find((source) => source.id === selectedClip?.sourceId);
  const duration = activeSource?.sourceAnalysis.duration ?? 0;
  const fps = activeSource?.sourceAnalysis.fps || 30;

  useEffect(() => {
    setMarkIn(0);
    setMarkOut(Math.min(duration, 5));
    setPlayhead(0);
  }, [activeSource?.id, duration]);

  useEffect(() => { setPreviewMode('original'); setPreviewUrls({}); }, [selectedClipId]);
  useEffect(() => { setExportRootOverride(undefined); }, [session?.id]);
  useEffect(() => {
    if (!exportStartedAt) return;
    const update = () => setExportElapsed(Math.floor((Date.now() - exportStartedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [exportStartedAt]);
  useEffect(() => {
    if (!downloadStartedAt) return;
    const update = () => setDownloadElapsed(Math.floor((Date.now() - downloadStartedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [downloadStartedAt]);

  const seek = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(duration, seconds));
    if (video.current) video.current.currentTime = next;
    setPlayhead(next);
  }, [duration]);

  const queueClip = useCallback(() => {
    if (!session || !activeSource) return;
    const clip = createClip(activeSource, markIn, markOut, session.clips.length + 1);
    setSession({ ...session, clips: [...session.clips, clip] });
    setSelectedClipId(clip.id);
    setStatus(`${clip.name} entered into the queue`);
    setQueueCollapsed(false);
  }, [activeSource, markIn, markOut, session]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== 'find' || !activeSource) return;
      const target = event.target as HTMLElement;
      if (target.matches('input, select, textarea, button, [contenteditable="true"]')) return;
      if (event.code === 'KeyI') setMarkIn(playhead);
      else if (event.code === 'KeyO') setMarkOut(playhead);
      else if (event.code === 'Enter') queueClip();
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
        event.preventDefault();
        if (video.current?.paused) void video.current.play(); else video.current?.pause();
      } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        seek(playhead + (event.code === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 1 / fps));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSource, fps, playhead, queueClip, seek, selectedClipId, session, view]);

  const importVideos = async (mode: 'files' | 'season' | 'watch' = 'files') => {
    try {
      setStatus('Inspecting source metadata…');
      if (!session) return;
      const { sources, watchFolder } = await window.cuttingFloor.importVideos(session, mode);
      if (!sources.length && !watchFolder) return setStatus('Import cancelled');
      const next = sources.map((source, index) => ({ ...source, order: session.sources.length + index }));
      setSession({ ...session, sources: [...session.sources, ...next], activeSourceId: session.activeSourceId ?? next[0]?.id, watchFolders: watchFolder ? [...new Set([...session.watchFolders, watchFolder])] : session.watchFolders });
      if (sources.length) setView('find');
      setStatus(sources.length ? `${sources.length} source${sources.length === 1 ? '' : 's'} imported` : 'Watch folder enabled');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const prepareDownload = (url: string) => preferences && setDownloadSetup({ url, name: 'Downloaded Video', downloadPath: preferences.downloadPath, exportPath: preferences.exportPath });

  const chooseDownloadFolder = async (kind: 'downloadPath' | 'exportPath') => {
    if (!downloadSetup) return;
    try {
      const path = await window.cuttingFloor.chooseLocation(kind, downloadSetup[kind]);
      if (path) setDownloadSetup((current) => current && { ...current, [kind]: path });
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const downloadVideo = async () => {
    if (!downloadSetup || !downloadSetup.name.trim()) return;
    const { url, name, downloadPath, exportPath } = downloadSetup;
    setDownloadSetup(undefined);
    setTaskProgress({ percent: 0, message: 'Preparing download' });
    setDownloadElapsed(0);
    setDownloadStartedAt(Date.now());
    try {
      const workspace = await window.cuttingFloor.createProject(name.trim());
      const project = { ...workspace.session, downloadPath, exportPath };
      setSession(project);
      setProjects(workspace.projects);
      setPreferences(workspace.preferences);
      await window.cuttingFloor.saveSession(project);
      setTaskProgress({ percent: 0, message: 'Preparing download' });
      setStatus('Starting source download…');
      const source = await window.cuttingFloor.downloadVideo(project, url, downloadPath);
      setSession({ ...project, sources: [source], activeSourceId: source.id });
      setView('find');
      setStatus(`${source.displayName} downloaded and imported`);
    } catch (error) {
      setStatus(error instanceof Error && error.name === 'AbortError' ? 'Download cancelled; the new project remains available.' : error instanceof Error ? error.message : String(error));
    } finally { setDownloadStartedAt(undefined); }
  };

  const applyWorkspace = (workspace: Awaited<ReturnType<typeof window.cuttingFloor.loadWorkspace>>) => {
    setSession(workspace.session); setProjects(workspace.projects); setPreferences(workspace.preferences); setSelectedClipId(workspace.session.clips.find((clip) => !clip.completed)?.id ?? workspace.session.clips[0]?.id); setView('home');
  };

  const createProject = async () => {
    const name = window.prompt('Project name', 'Untitled Cutting Floor');
    if (!name) return;
    try { applyWorkspace(await window.cuttingFloor.createProject(name)); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const openProject = async (id: string) => {
    try { applyWorkspace(await window.cuttingFloor.openProject(id)); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const renameProject = async (id: string) => {
    const project = projects.find((item) => item.id === id);
    const name = window.prompt('Rename project', project?.name ?? 'Untitled Cutting Floor');
    if (!name?.trim() || name.trim() === project?.name) return;
    try { applyWorkspace(await window.cuttingFloor.renameProject(id, name.trim())); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const deleteProject = async (id: string) => {
    try {
      const workspace = await window.cuttingFloor.deleteProject(id);
      if (workspace) applyWorkspace(workspace);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const updateClip = (clipId: string, patch: Partial<SessionClip>) => {
    if (!session) return;
    setSession({ ...session, clips: session.clips.map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip) });
  };

  const updateRecipe = (patch: Partial<ClipRecipe>) => {
    if (selectedClip) updateClip(selectedClip.id, { recipe: { ...selectedClip.recipe, ...patch } });
  };

  const applyRecipeToOtherClips = () => {
    if (!session || !selectedClip) return;
    setSession({ ...session, clips: session.clips.map((clip) => clip.id === selectedClip.id ? clip : { ...clip, recipe: { ...selectedClip.recipe } }) });
    setStatus(`Recipe copied to ${Math.max(0, session.clips.length - 1)} other clip${session.clips.length === 2 ? '' : 's'}`);
  };

  const removeClip = (clipId: string) => {
    if (!session) return;
    const clips = session.clips.filter((clip) => clip.id !== clipId);
    setSession({ ...session, clips });
    setSelectedClipId(clips[0]?.id);
  };

  const moveClip = (clipId: string, delta: number) => {
    if (!session) return;
    const clips = [...session.clips];
    const from = clips.findIndex((clip) => clip.id === clipId);
    const to = Math.max(0, Math.min(clips.length - 1, from + delta));
    if (from === to) return;
    [clips[from], clips[to]] = [clips[to], clips[from]];
    setSession({ ...session, clips });
  };

  const markUnfinished = (clipId: string) => { updateClip(clipId, { completed: false, outputPath: undefined, pngFramesPath: undefined, processingEngine: undefined, fallbackReason: undefined }); setStatus('Clip returned to Ready; previous exports remain on disk.'); };
  const resetCompleted = () => session && setSession({ ...session, clips: session.clips.map((clip) => clip.completed ? { ...clip, completed: false, outputPath: undefined, pngFramesPath: undefined, processingEngine: undefined, fallbackReason: undefined } : clip) });
  const clearUnfinished = () => {
    if (!session) return;
    const clips = session.clips.filter((clip) => clip.completed);
    setSession({ ...session, clips });
    if (!clips.some((clip) => clip.id === selectedClipId)) setSelectedClipId(clips[0]?.id);
  };
  const joinRanges = () => {
    if (!session) return;
    const clips = joinTouchingClips(session.clips, (sourceId) => 1 / (session.sources.find((source) => source.id === sourceId)?.sourceAnalysis.fps || 30));
    setSession({ ...session, clips });
    if (!clips.some((clip) => clip.id === selectedClipId)) setSelectedClipId(clips[0]?.id);
  };

  const exportSelected = async () => {
    if (!selectedClip || !preferences || !session) return;
    const source = session?.sources.find((item) => item.id === selectedClip.sourceId);
    if (!source) return setStatus('The source for this clip is unavailable.');
    try {
      setProgress({ clipId: selectedClip.id, percent: 0, message: 'Preparing export' });
      setExportElapsed(0);
      setExportStartedAt(Date.now());
      setStatus('Starting VapourSynth…');
      const completed = await window.cuttingFloor.exportClip({ source, clip: selectedClip, projectName: session.name, exportRoot: exportRootOverride ?? session.exportPath ?? preferences.exportPath });
      if (completed) {
        updateClip(completed.id, completed);
        setExportRootOverride(undefined);
        setStatus(`Exported ${completed.name}`);
        const index = session.clips.findIndex((clip) => clip.id === completed.id);
        const next = [...session.clips.slice(index + 1), ...session.clips.slice(0, index)].find((clip) => !clip.completed);
        if (next) setSelectedClipId(next.id);
      } else setStatus('Export cancelled');
    } catch (error) {
      setStatus(error instanceof Error && error.name === 'AbortError' ? 'Export cancelled; incomplete output removed and completed work preserved.' : error instanceof Error ? error.message : String(error));
    } finally { setExportStartedAt(undefined); }
  };

  const chooseExportFolder = async () => {
    if (!preferences) return;
    try {
    const folder = await window.cuttingFloor.chooseLocation('exportPath', exportRootOverride ?? session?.exportPath ?? preferences.exportPath);
      if (folder) setExportRootOverride(folder);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const renderPreview = async (mode: 'still' | 'video') => {
    if (!selectedClip || !selectedSource || !preferences || !session) return;
    try {
      setStatus(`Rendering processed ${mode} preview…`);
      const url = await window.cuttingFloor.previewClip({ source: selectedSource, clip: selectedClip, projectName: session.name, exportRoot: session.exportPath ?? preferences.exportPath }, mode);
      setPreviewUrls((current) => ({ ...current, [mode]: url })); setPreviewMode(mode); setStatus(`Processed ${mode} preview ready`);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  };

  const previewRecipeKey = selectedClip ? JSON.stringify(selectedClip.recipe) : '';
  useEffect(() => {
    if (view !== 'process' || !selectedClip || !selectedSource) return;
    const timer = window.setTimeout(() => void renderPreview('video'), 450);
    return () => window.clearTimeout(timer);
  }, [view, selectedClipId, selectedSource?.id, previewRecipeKey]);

  if (!session || !preferences) return <div className="loading" role="status" aria-live="polite">Opening the cutting floor…</div>;

  return <div className={`app-shell theme-${preferences.theme ?? 'dark'}`}>
    <header className="titlebar">
      <div className="wordmark"><span className="mark">LQ</span><span>LQ'S CUTTING FLOOR</span><small>DESKTOP STUDIO</small></div>
      <div className="project-name"><span className="status-dot" />{session.name}</div>
    </header>

    <aside className="sidebar">
      <nav>{nav.map(([name, icon, label]) => <button key={name} className={view === name ? 'active' : ''} onClick={() => setView(name)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="runtime-card">
        <p>LOCAL PIPELINE</p>
        <Tool name="FFMPEG" ok={runtime.ffmpeg} />
        <Tool name="FFPROBE" ok={runtime.ffprobe} />
        <Tool name="VSPIPE" ok={runtime.vspipe} />
        <Tool name="YT-DLP" ok={runtime.ytDlp} />
        <Tool name="VS PLUGINS" ok={runtime.vapourSynthPlugins} />
      </div>
      <div className="sidebar-foot">SESSION FORMAT <b>V6</b><br />ORIGINALS STAY UNTOUCHED</div>
    </aside>

    <main>
      {view === 'home' && <Home session={session} projects={projects} downloading={Boolean(downloadStartedAt)} onNewProject={createProject} onOpenProject={openProject} onRenameProject={renameProject} onDeleteProject={deleteProject} onImport={() => importVideos('files')} onSeason={() => importVideos('season')} onWatch={() => importVideos('watch')} onDownload={prepareDownload} onOpenSource={(id) => { setSession({ ...session, activeSourceId: id }); setView('find'); }} />}
      {view === 'find' && <FindMoments
        session={session} activeSource={activeSource} video={video} playhead={playhead} markIn={markIn} markOut={markOut}
        speed={speed} muted={muted} queueCollapsed={queueCollapsed} queueFilter={queueFilter} status={status} onImport={() => importVideos('files')} onSeek={seek}
        onTime={(value) => { setPlayhead(value); const progressValue = duration ? value / duration : 0; if (Math.abs((activeSource?.progress ?? 0) - progressValue) > 0.002) setSession({ ...session, sources: session.sources.map((source) => source.id === activeSource?.id ? { ...source, progress: progressValue } : source) }); }} onMarkIn={() => setMarkIn(playhead)} onMarkOut={() => setMarkOut(playhead)} onQueue={queueClip}
        onSpeed={(next) => { setSpeed(next); if (video.current) video.current.playbackRate = next; }}
        onToggleMute={() => setMuted((value) => !value)} onFilter={setQueueFilter} onJoin={joinRanges} onResetCompleted={resetCompleted} onClearUnfinished={clearUnfinished} onMarkUnfinished={markUnfinished}
        onToggleReviewed={() => setSession({ ...session, sources: session.sources.map((source) => source.id === activeSource?.id ? { ...source, finished: !source.finished } : source) })}
        onToggleQueue={() => setQueueCollapsed((value) => !value)} onSelectSource={(id) => setSession({ ...session, activeSourceId: id })}
        onRemove={removeClip} onSelectClip={(id) => { setSelectedClipId(id); setView('process'); }}
      />}
      {view === 'process' && <ProcessClips
        session={session} source={selectedSource} clip={selectedClip} progress={progress} status={status} onSelect={setSelectedClipId}
        onRecipe={updateRecipe} onExport={exportSelected} onCancel={() => window.cuttingFloor.cancelExport()}
        onMove={moveClip} onRemove={removeClip} expertMode={preferences.expertMode} previewMode={previewMode} previewUrls={previewUrls} taskProgress={taskProgress} onPreview={renderPreview} onPreviewMode={setPreviewMode}
        exportRoot={exportRootOverride ?? session.exportPath ?? preferences.exportPath} exporting={Boolean(exportStartedAt)} exportElapsed={exportElapsed} onChooseExportFolder={chooseExportFolder}
        onApplyRecipeToOtherClips={applyRecipeToOtherClips}
        onLook={(look) => selectedClip && updateClip(selectedClip.id, { recipe: applyLook(selectedClip.recipe, look) })}
        onAspect={(aspectPreset) => selectedClip && selectedSource && updateClip(selectedClip.id, { recipe: fitCropToAspect({ ...selectedClip.recipe, aspectPreset }, selectedSource.sourceAnalysis.width, selectedSource.sourceAnalysis.height) })}
        onCrop={(edge, value) => selectedClip && selectedSource && updateClip(selectedClip.id, { recipe: setCropEdge(selectedClip.recipe, edge, value, selectedSource.sourceAnalysis.width, selectedSource.sourceAnalysis.height) })}
      />}
      {view === 'settings' && <Settings session={session} preferences={preferences} onSession={setSession} onPreferences={async (next) => {
        try { setPreferences(await window.cuttingFloor.savePreferences(next)); }
        catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
      }} />}
    </main>
    {downloadSetup && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDownloadSetup(undefined); }}>
      <form className="download-dialog" role="dialog" aria-modal="true" aria-labelledby="download-dialog-title" onSubmit={(event) => { event.preventDefault(); void downloadVideo(); }}>
        <span className="eyebrow">PUBLIC VIDEO LINK</span><h2 id="download-dialog-title">New download project</h2><p>The app will show live download and processing progress after you start.</p>
        <label className="field"><span>PROJECT NAME</span><input autoFocus maxLength={100} value={downloadSetup.name} onChange={(event) => setDownloadSetup({ ...downloadSetup, name: event.target.value })} /></label>
        <label className="field"><span>DOWNLOADED SOURCE MASTER</span><div className="location-row"><input readOnly title={downloadSetup.downloadPath} value={downloadSetup.downloadPath} /><button type="button" className="ghost" onClick={() => void chooseDownloadFolder('downloadPath')}>Choose</button></div></label>
        <label className="field"><span>FINISHED CLIPS + PNG FRAMES</span><div className="location-row"><input readOnly title={downloadSetup.exportPath} value={downloadSetup.exportPath} /><button type="button" className="ghost" onClick={() => void chooseDownloadFolder('exportPath')}>Choose</button></div></label>
        <div className="dialog-actions"><button type="button" className="ghost" onClick={() => setDownloadSetup(undefined)}>Cancel</button><button className="primary" disabled={!downloadSetup.name.trim()}>Start download</button></div>
      </form>
    </div>}
    {downloadStartedAt && <aside className="global-task" aria-busy="true" aria-live="assertive">
      <span className="global-task-spinner" aria-hidden="true" />
      <div><span>DOWNLOADING VIDEO</span><b>{taskProgress?.message ?? 'Preparing download'}</b><small>{Math.round(taskProgress?.percent ?? 0)}% · {Math.floor(downloadElapsed / 60)}:{String(downloadElapsed % 60).padStart(2, '0')} elapsed</small></div>
      <strong>{Math.round(taskProgress?.percent ?? 0)}%</strong>
      <button className="ghost" onClick={() => window.cuttingFloor.cancelExport()}>Stop safely</button>
      <div className="progress-track" role="progressbar" aria-label="Video download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(taskProgress?.percent ?? 0)}><i style={{ width: `${taskProgress?.percent ?? 0}%` }} /></div>
    </aside>}
  </div>;
}

function Tool({ name, ok }: { name: string; ok: boolean }) {
  return <div className="tool-row"><span className={ok ? 'ok' : 'missing'} />{name}<b>{ok ? 'READY' : 'MISSING'}</b></div>;
}

function Home({ session, projects, downloading, onNewProject, onOpenProject, onRenameProject, onDeleteProject, onImport, onSeason, onWatch, onDownload, onOpenSource }: { session: StudioSession; projects: ProjectCard[]; downloading: boolean; onNewProject(): void; onOpenProject(id: string): void; onRenameProject(id: string): void; onDeleteProject(id: string): void; onImport(): void; onSeason(): void; onWatch(): void; onDownload(url: string): void; onOpenSource(id: string): void }) {
  const [url, setUrl] = useState('');
  return <section className="page home-page">
    <div className="home-intro">
      <div className="eyebrow">LQ'S CUTTING FLOOR</div>
      <h1>Your next great moment is in here.</h1>
      <p>Move through a season, keep every source in context, and turn the moments you love into polished clips.</p>
      <div className="home-actions"><button className="primary" disabled={downloading} onClick={onSeason}>▣ Import a season folder</button><button className="ghost" disabled={downloading} onClick={onImport}>▣ Video files</button><button className="ghost" disabled={downloading} onClick={onWatch}>Watch folder</button></div>
      <label className="download-label" htmlFor="public-video-url">PUBLIC VIDEO LINK</label>
      <div className="download-row"><input id="public-video-url" placeholder="Paste a public video link" disabled={downloading} value={url} onChange={(event) => setUrl(event.target.value)} /><button className="ghost" disabled={downloading || !url.trim()} onClick={() => { onDownload(url.trim()); setUrl(''); }}>{downloading ? 'Downloading…' : 'Download'}</button></div>
      <small className="home-hint">Start a project with one video, a whole season folder, or a public link.</small>
    </div>
    <div className="home-library">
      <div className="recent-head"><div><span>RECENT PROJECTS</span><h2>Pick up where you left off</h2></div><button className="text-button" onClick={onNewProject}>＋ New project</button></div>
      <div className="project-grid">{projects.map((project) => <article key={project.id} className={`project-card ${project.id === session.id ? 'active' : ''}`}>
        <button className="project-open" onClick={() => onOpenProject(project.id)}><span className="project-thumb"><i>◇</i>{project.thumbnailUrl && <img src={project.thumbnailUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</span><span className="project-copy"><b>{project.name}</b><small>{project.completedCount} / {project.clipCount} clips finished · {project.sourceCount} source{project.sourceCount === 1 ? '' : 's'}</small></span></button>
        <div className="project-actions"><button onClick={() => onRenameProject(project.id)}>Rename</button><button className="danger" onClick={() => onDeleteProject(project.id)}>Delete</button></div>
      </article>)}</div>
      <div className="active-project-head"><div><span>ACTIVE PROJECT</span><h2 title={session.name}>{session.name}</h2></div><div className="compact-stats"><Metric value={session.sources.length} label="SOURCES" /><Metric value={session.clips.length} label="CLIPS" /><Metric value={session.clips.filter((clip) => clip.completed).length} label="DONE" /></div></div>
      <div className="source-grid">
        {session.sources.map((source) => <button className="source-card" key={source.id} onClick={() => onOpenSource(source.id)}>
          <div className="source-frame">{source.thumbnailUrl && <img src={source.thumbnailUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}<span>{source.sourceAnalysis.width} × {source.sourceAnalysis.height}</span><b>{source.sourceAnalysis.fps.toFixed(3)} FPS</b></div>
          <h3 title={source.episodeLabel}>{source.episodeLabel}{source.finished ? ' ✓' : ''}</h3><p>{source.missing ? 'SOURCE MISSING' : `${source.sourceAnalysis.codec.toUpperCase()} · ${formatTime(source.sourceAnalysis.duration)} · ${Math.round(source.progress * 100)}% REVIEWED`}</p>
        </button>)}
        {!session.sources.length && <button className="source-card empty-card" onClick={onImport}><b>＋</b><h3>ADD YOUR FIRST SOURCE</h3><p>MP4, MOV, MKV, AVI, MTS, WEBM</p></button>}
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
  markIn: number;
  markOut: number;
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
  onToggleQueue(): void;
  onSelectSource(id: string): void;
  onRemove(id: string): void;
  onSelectClip(id: string): void;
}

function FindMoments(props: FindProps) {
  const { session, activeSource, video, playhead, markIn, markOut, speed, muted, queueCollapsed, queueFilter } = props;
  if (!activeSource) return <EmptyPage title="NO SOURCE ON THE DECK" action="IMPORT VIDEO" onAction={props.onImport} />;
  const duration = activeSource.sourceAnalysis.duration;
  return <section className="find-page">
    <div className="source-strip">
      <div><span className="eyebrow">ACTIVE REEL</span><select value={activeSource.id} onChange={(event) => props.onSelectSource(event.target.value)}>{session.sources.map((source) => <option key={source.id} value={source.id}>{source.episodeLabel}</option>)}</select></div>
      <div className="source-meta">{activeSource.sourceAnalysis.width}×{activeSource.sourceAnalysis.height}<b>{activeSource.sourceAnalysis.fps.toFixed(3)} FPS</b>{activeSource.sourceAnalysis.hdr} · {activeSource.sourceAnalysis.scanType}</div>
      <details className="analysis-popover"><summary title="Technical source clues and conservative processing recommendations.">Analysis</summary><b>{activeSource.sourceAnalysis.qualitySummary}</b><span>{activeSource.sourceAnalysis.codec} · {activeSource.sourceAnalysis.format} · {activeSource.sourceAnalysis.pixelFormat} · {activeSource.sourceAnalysis.bitDepth}-bit · {activeSource.sourceAnalysis.bitrate ? `${(activeSource.sourceAnalysis.bitrate / 1_000_000).toFixed(1)} Mbps` : 'bitrate unknown'}</span>{activeSource.sourceAnalysis.recommendations.map((item) => <p key={item}>{item}</p>)}<InfoTip>Resolution, bitrate, bit depth, HDR, interlacing, variable frame rate, and opening freezes are technical clues—not a promise that every frame will look good. Apply Suggested Settings from Process Clips for a conservative starting recipe.</InfoTip></details>
      <button className="ghost" onClick={props.onToggleReviewed}>{activeSource.finished ? '✓ Reviewed' : 'Mark reviewed'}</button>
      <button className="ghost" onClick={props.onImport}>＋ Add source</button>
    </div>
    <div className="workbench">
      <div className="viewer-panel">
        <div className="video-wrap">{activeSource.missing ? <div className="missing-source">SOURCE MOVED OR DELETED<br /><small>{activeSource.sourcePath}</small></div> : <video ref={video} key={activeSource.id} src={activeSource.fileUrl} muted={muted} playsInline onTimeUpdate={(event) => props.onTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => { event.currentTarget.playbackRate = speed; }} />}<div className="frame-corners" /></div>
        <div className="timeline">
          <input title="Drag directly to scrub through the source." aria-label="Playhead" type="range" min="0" max={duration || 1} step={1 / (activeSource.sourceAnalysis.fps || 30)} value={playhead} onChange={(event) => props.onSeek(Number(event.target.value))} />
          <div className="time-row"><b>{formatTime(playhead)}</b><span>IN {formatTime(markIn)} · OUT {formatTime(markOut)}</span><b>{formatTime(duration)}</b></div>
        </div>
        <div className="transport">
          <button title="Move one second backward. Shift + Left Arrow also works." onClick={() => props.onSeek(playhead - 1)}>−1s</button><button title="Move exactly one frame backward." onClick={() => props.onSeek(playhead - 1 / activeSource.sourceAnalysis.fps)}>‹ FRAME</button>
          <button title="Play or pause. Space also works." className="play" onClick={() => video.current?.paused ? void video.current.play() : video.current?.pause()}>▶</button>
          <button title="Move exactly one frame forward." onClick={() => props.onSeek(playhead + 1 / activeSource.sourceAnalysis.fps)}>FRAME ›</button><button title="Move one second forward. Shift + Right Arrow also works." onClick={() => props.onSeek(playhead + 1)}>+1s</button>
          <button title="Audio starts muted and can be restored here." onClick={props.onToggleMute}>{muted ? 'UNMUTE' : 'MUTE'}</button>
          <div className="speed">{[1, 2, 3].map((value) => <button title={`${value}× affects preview playback only.`} key={value} className={speed === value ? 'active' : ''} onClick={() => props.onSpeed(value)}>{value}×</button>)}</div>
        </div>
        <div className="mark-controls">
          <button onClick={props.onMarkIn}><kbd>I</kbd><span>MARK IN<strong>{formatTime(markIn)}</strong></span></button>
          <button onClick={props.onMarkOut}><kbd>O</kbd><span>MARK OUT<strong>{formatTime(markOut)}</strong></span></button>
          <button className="enter-clip" onClick={props.onQueue}>ENTER CLIP <kbd>ENTER</kbd></button>
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
  previewMode: 'original' | 'still' | 'video';
  previewUrls: Partial<Record<'still' | 'video', string>>;
  taskProgress?: TaskProgress;
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
  onPreview(mode: 'still' | 'video'): void;
  onPreviewMode(mode: 'original' | 'still' | 'video'): void;
  onChooseExportFolder(): void;
  onApplyRecipeToOtherClips(): void;
}

function ProcessClips(props: ProcessProps) {
  const [previewSpeed, setPreviewSpeed] = useState(1);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(true);
  const previewVideo = useRef<HTMLVideoElement>(null);
  if (!props.clip || !props.source) return <EmptyPage title="THE QUEUE IS EMPTY" action="FIND MOMENTS FIRST" />;
  const { clip, source } = props;
  const recipe = clip.recipe;
  const dimensions = outputDimensions(recipe, source.sourceAnalysis.width, source.sourceAnalysis.height);
  const clipProgress = props.progress?.clipId === clip.id ? props.progress : undefined;
  const elapsed = `${Math.floor(props.exportElapsed / 60)}:${String(props.exportElapsed % 60).padStart(2, '0')}`;
  const slowWarning = dimensions.width >= 3840 && recipe.denoise === 'Fine detail';
  const manual = (patch: Partial<ClipRecipe>) => props.onRecipe({ ...patch, look: 'Custom' });
  const togglePreview = () => {
    if (!previewVideo.current) return;
    if (previewVideo.current.paused) void previewVideo.current.play(); else previewVideo.current.pause();
  };
  return <section className="process-page">
    <div className="process-list"><div className="section-head"><h2>PROJECT CLIPS</h2><span>{props.session.clips.length}</span></div>{props.session.clips.map((item, index) => <button disabled={props.exporting} key={item.id} className={item.id === clip.id ? 'active' : ''} onClick={() => props.onSelect(item.id)}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{item.name}</b><small>{formatTime(item.end - item.start)} · {item.completed ? 'COMPLETE' : 'READY'}</small></div></button>)}</div>
    <div className="recipe-panel">
      <div className="recipe-title"><div><span className="eyebrow">ACTIVE RECIPE</span><h1>{clip.name}</h1></div><div className="reorder"><button aria-label="Move clip earlier" disabled={props.exporting} onClick={() => props.onMove(clip.id, -1)}>↑</button><button aria-label="Move clip later" disabled={props.exporting} onClick={() => props.onMove(clip.id, 1)}>↓</button><button disabled={props.exporting} onClick={() => props.onRemove(clip.id)}>Remove</button></div></div>
      <div className="crop-editor">
        <div className="preview-column"><div className="preview-heading"><span className="eyebrow">CLIP PLAYBACK</span><small>Ready immediately · loops the marked range</small></div><div className="preview-tabs"><button title="Play the clip with the interactive crop overlay. This is the default framing view." className={props.previewMode === 'original' ? 'active' : ''} onClick={() => props.onPreviewMode('original')}>Clip + crop</button><button title="Render one processed frame using the current recipe." className={props.previewMode === 'still' ? 'active' : ''} onClick={() => props.previewUrls.still ? props.onPreviewMode('still') : props.onPreview('still')}>Processed still</button><button title="Render a processed playback preview using the current recipe." className={props.previewMode === 'video' ? 'active' : ''} onClick={() => props.previewUrls.video ? props.onPreviewMode('video') : props.onPreview('video')}>Processed playback</button></div><div className="crop-preview" title="Drag inside the crop box to move it; drag an edge or corner to resize it." style={{ aspectRatio: `${source.sourceAnalysis.width}/${source.sourceAnalysis.height}` }}>
          {props.previewMode === 'original' && <><video ref={previewVideo} src={source.fileUrl} muted autoPlay playsInline controls loop onPlay={() => setIsPreviewPlaying(true)} onPause={() => setIsPreviewPlaying(false)} onLoadedMetadata={(event) => { event.currentTarget.currentTime = clip.start; event.currentTarget.playbackRate = previewSpeed; }} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= clip.end) event.currentTarget.currentTime = clip.start; }} /><CropMask recipe={recipe} source={source} onChange={props.onRecipe} /></>}
          {props.previewMode === 'still' && props.previewUrls.still && <img src={props.previewUrls.still} alt="Processed still preview" />}
          {props.previewMode === 'video' && props.previewUrls.video && <video ref={previewVideo} src={props.previewUrls.video} muted controls loop autoPlay onPlay={() => setIsPreviewPlaying(true)} onPause={() => setIsPreviewPlaying(false)} onLoadedMetadata={(event) => { event.currentTarget.playbackRate = previewSpeed; }} />}
        </div><div className="preview-transport"><button className="primary" disabled={props.previewMode === 'still'} onClick={togglePreview}>{isPreviewPlaying ? 'Pause clip' : 'Play clip'} <kbd>Space</kbd></button><span>{props.previewMode === 'still' ? 'Still preview selected' : 'Playback controls'}</span></div><div className="preview-actions"><div className="speed">{[1, 2, 3].map((value) => <button title={`${value}× changes preview playback only.`} key={value} className={previewSpeed === value ? 'active' : ''} onClick={() => setPreviewSpeed(value)}>{value}×</button>)}</div><button title="Render one frame through the processing pipeline." className="ghost" onClick={() => props.onPreview('still')}>Render still</button><button title="Render this clip through the processing pipeline for inspection." className="ghost" onClick={() => props.onPreview('video')}>Render processed playback</button></div><InfoTip>The clip is already playable here. Use the crop overlay on the looping clip to verify framing; processed playback is optional when you want to inspect the full recipe.</InfoTip>{props.taskProgress && <small className="task-progress">{Math.round(props.taskProgress.percent)}% · {props.taskProgress.message}</small>}</div>
        <div className="crop-controls"><div className="section-head"><h2>COMPOSITION CROP</h2><span>LOCKED · {dimensions.width}×{dimensions.height} OUTPUT</span></div>
          <Field label="COMPOSITION RATIO"><select title="The selected ratio remains fixed while crop edges or corners are resized." value={recipe.aspectPreset} onChange={(event) => props.onAspect(event.target.value as ClipRecipe['aspectPreset'])}>{aspectPresets.map((value) => <option key={value}>{value}</option>)}</select></Field>
          {recipe.aspectPreset === 'Custom' && <div className="number-pair"><NumberInput label="RATIO WIDTH" value={recipe.customRatioWidth} onChange={(value) => props.onRecipe({ customRatioWidth: value })} /><NumberInput label="RATIO HEIGHT" value={recipe.customRatioHeight} onChange={(value) => props.onRecipe({ customRatioHeight: value })} /><button className="ghost" onClick={() => props.onAspect('Custom')}>APPLY</button></div>}
          <div className="crop-sliders"><CropField label="LEFT" value={recipe.cropLeft} onChange={(value) => props.onCrop('cropLeft', value)} /><CropField label="RIGHT" value={recipe.cropRight} onChange={(value) => props.onCrop('cropRight', value)} /><CropField label="TOP" value={recipe.cropTop} onChange={(value) => props.onCrop('cropTop', value)} /><CropField label="BOTTOM" value={recipe.cropBottom} onChange={(value) => props.onCrop('cropBottom', value)} /></div>
          <button className="text-button" onClick={() => props.onRecipe({ cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, aspectPreset: 'Free' })}>Reset crop</button>
          <InfoTip>The crop ratio sets the shape; Master Size sets the exported pixels. VapourSynth prepares 4:4:4, performs crop-aware resize, and keeps 16-bit 4:4:4 through cleanup. A blank custom height is derived without stretching.</InfoTip>
        </div>
      </div>
      <div className="analysis-guide"><div><span>SOURCE GUIDANCE</span><b>{source.sourceAnalysis.qualitySummary}</b><small>Technical clues are a conservative starting point, not a guarantee for every shot.</small></div><div className="analysis-actions"><button className="ghost" onClick={() => props.onRecipe(suggestedRecipePatch(source.sourceAnalysis))}>Apply suggested settings</button><button className="ghost" onClick={props.onApplyRecipeToOtherClips}>Apply recipe to other clips</button></div></div>
      <div className="recipe-grid">
        <Field label="STARTING LOOK"><select value={recipe.look} onChange={(event) => props.onLook(event.target.value as StudioLook)}>{looks.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="OUTPUT FORMAT"><select value={recipe.outputFormat} onChange={(event) => props.onRecipe({ outputFormat: event.target.value as ClipRecipe['outputFormat'] })}>{outputFormats.map((value) => <option key={value} value={value}>{value === 'MP4' ? 'High-quality MP4 · H.264 CRF 12' : value === 'ProRes 422' ? 'Photoshop MOV · ProRes 422 HQ' : 'Photoshop MOV · ProRes 4444'}</option>)}</select></Field>
        <Field label="MASTER SIZE"><select value={recipe.masterSize} onChange={(event) => props.onRecipe({ masterSize: event.target.value as ClipRecipe['masterSize'] })}>{masterSizes.map((value) => <option key={value}>{value}</option>)}</select></Field>
        {recipe.masterSize === 'Custom' && <Field label="CUSTOM MASTER"><div className="number-pair"><NumberInput label="WIDTH" value={recipe.masterWidth} onChange={(value) => props.onRecipe({ masterWidth: value })} /><NumberInput label="HEIGHT · OPTIONAL" value={recipe.masterHeight ?? ''} onChange={(value) => props.onRecipe({ masterHeight: value || undefined })} /></div></Field>}
        <Field label="DEINTERLACE / CADENCE"><select value={recipe.deinterlace} onChange={(event) => props.onRecipe({ deinterlace: event.target.value as ClipRecipe['deinterlace'] })}>{deinterlaceChoices.map((value) => <option key={value} value={value}>{value === 'Bwdif' ? 'Bwdif · same-rate' : value === 'Bwdif 2×' ? 'Bwdif · double-rate' : value === 'QTGMC Quality' ? 'QTGMC · maximum quality' : value}</option>)}</select></Field>
        {props.expertMode && <Field label="FIELD ORDER"><select value={recipe.fieldOrder} onChange={(event) => props.onRecipe({ fieldOrder: event.target.value as ClipRecipe['fieldOrder'] })}>{['Auto', 'Top first', 'Bottom first'].map((value) => <option key={value}>{value}</option>)}</select></Field>}
        <Field label="RESTORATION"><select value={recipe.restoration} onChange={(event) => manual({ restoration: event.target.value as ClipRecipe['restoration'] })}>{['Off', 'Debilinear', 'Debicubic'].map((value) => <option key={value}>{value}</option>)}</select></Field>
        {props.expertMode && <Field label="ROTATION"><select value={recipe.rotation} onChange={(event) => props.onRecipe({ rotation: Number(event.target.value) as ClipRecipe['rotation'] })}>{[0, 90, 180, 270].map((value) => <option key={value} value={value}>{value}°</option>)}</select></Field>}
        <Field label="MOTION"><select value={recipe.motion} onChange={(event) => props.onRecipe({ motion: event.target.value as ClipRecipe['motion'] })}>{['Original', '30 fps', '60 fps'].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="DENOISE METHOD"><select value={recipe.denoise} onChange={(event) => manual({ denoise: event.target.value as ClipRecipe['denoise'] })}>{['Off', 'Balanced', 'Fine detail'].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label={`DENOISE STRENGTH · ${recipe.denoiseStrength.toFixed(2)}`}><input title="0 is off; 0.5–1.0 is gentle; 1.2–2.0 targets visible noise; above 2 can smear fine detail." type="range" min="0" max="3" step="0.05" value={recipe.denoiseStrength} onChange={(event) => manual({ denoiseStrength: Number(event.target.value) })} /></Field>
        <Field label="SHARPEN METHOD"><select value={recipe.sharpen} onChange={(event) => manual({ sharpen: event.target.value as ClipRecipe['sharpen'] })}>{['Off', 'Natural', 'Adaptive'].map((value) => <option key={value}>{value === 'Natural' ? 'Natural lines' : value === 'Adaptive' ? 'Adaptive crisp' : value}</option>)}</select></Field>
        <Field label={`SHARPEN STRENGTH · ${recipe.sharpenStrength.toFixed(2)}`}><input title="0.3–0.6 is subtle; 0.7–1.0 is visibly crisp and may reveal halos on difficult footage." type="range" min="0" max="1" step="0.05" value={recipe.sharpenStrength} onChange={(event) => manual({ sharpenStrength: Number(event.target.value) })} /></Field>
        {props.expertMode && <Field label="COLOR MANAGEMENT"><select value={recipe.colorManagement} onChange={(event) => props.onRecipe({ colorManagement: event.target.value as ClipRecipe['colorManagement'] })}>{['Auto', 'SDR Rec.709', 'Convert 601 to 709', 'HDR PQ to SDR', 'HDR HLG to SDR', 'Preserve'].map((value) => <option key={value}>{value}</option>)}</select></Field>}
        {props.expertMode && <Field label="ENGINE POLICY"><select value={recipe.fallbackMode} onChange={(event) => props.onRecipe({ fallbackMode: event.target.value as ClipRecipe['fallbackMode'] })}><option>Strict VapourSynth</option><option>Allow FFmpeg fallback</option></select></Field>}
      </div>
      <div className="tip-grid"><InfoTip><b>LOOK + MOTION</b> Natural suits clean footage; Crisp helps softness; Soft/noisy targets grain and compression. Keep original motion unless cadence looks choppy, and deinterlace only visible combing.</InfoTip><InfoTip><b>DENOISE + SHARPEN</b> Denoise 0.5–1.0 is gentle, 1.2–2.0 suits visible noise, and higher risks waxy detail. Sharpen 0.3–0.6 is subtle; 0.7–1.0 is crisp and higher risks halos.</InfoTip></div>
      <div className="toggle-row">{([['deband', 'DEBAND GRADIENTS'], ['reverse', 'REVERSE VIDEO + AUDIO'], ['fade', 'SHORT FADE'], ['extractFrames', 'EXTRACT PROCESSED PNGS'], ['saveVapourSynthScript', 'SAVE .VPY']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={recipe[key]} onChange={(event) => key === 'deband' ? manual({ deband: event.target.checked }) : props.onRecipe({ [key]: event.target.checked })} />{label}</label>)}</div>
      {recipe.extractFrames && <div className="frame-options"><Field label="PNG EXTRACTION"><select value={recipe.frameExtraction} onChange={(event) => props.onRecipe({ frameExtraction: event.target.value as ClipRecipe['frameExtraction'] })}><option>Every processed frame</option><option>Custom frame rate</option></select></Field>{recipe.frameExtraction === 'Custom frame rate' && <NumberInput label="PNG FPS" value={recipe.frameFps} onChange={(value) => props.onRecipe({ frameFps: Math.max(0.01, value) })} />}</div>}
      <div className="pipeline-card"><span>VAPOURSYNTH PRIMARY PIPELINE</span><code>BestSource → cadence → trim → crop → restore → BM3D → CAS → MVTools → output</code></div>
      <div className="tip-grid"><InfoTip><b>ENGINE + COLOR</b> Strict mode stops on VapourSynth failure; Compatibility creates a clearly labeled substitute. Auto maps HDR PQ/HLG and SD Rec.601 to SDR Rec.709, with a conservative Rec.709 fallback for untagged video.</InfoTip><InfoTip><b>OUTPUTS</b> ProRes 422 HQ is the practical Photoshop master, 4444 keeps maximum chroma at much larger size, and MP4 is compact 4:2:0. PNGs come from the processed export; saved .vpy files record the actual recipe.</InfoTip></div>
      {clip.processingEngine === 'FFmpeg compatibility' && <div className="compatibility-note"><b>COMPATIBILITY EXPORT</b>{clip.fallbackReason}</div>}
      {slowWarning && <div className="compatibility-note"><b>LONG EXPORT EXPECTED</b>4K with Fine detail BM3D can be substantially slower. Phase and elapsed time below will continue updating.</div>}
      <div className="export-location"><div title={`${props.exportRoot}\\${props.session.name}`}><span>EXPORT LOCATION</span><b>{props.exportRoot}\{props.session.name}</b></div><button title="Choose a destination for this export only. The Settings default will not change." className="ghost" disabled={props.exporting} onClick={props.onChooseExportFolder}>Choose folder</button></div>
      {(clipProgress || props.exporting) && <div className={`export-progress ${props.exporting ? 'active' : ''}`} aria-busy={props.exporting} aria-live="polite"><div className="progress-copy"><span>EXPORT PROGRESS</span><b>{clipProgress?.message ?? 'Preparing export'}</b><small>{props.exporting ? `Active · ${elapsed} elapsed` : clipProgress?.percent === 100 ? `Completed in ${elapsed}` : 'Stopped'}</small></div><strong>{Math.round(clipProgress?.percent ?? 0)}%</strong><div className="progress-track" role="progressbar" aria-label="Clip export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clipProgress?.percent ?? 0)}><i style={{ width: `${clipProgress?.percent ?? 0}%` }} /></div></div>}
      <div className="export-row"><div><span className={`status-dot ${props.exporting ? 'working' : ''}`} />{props.status}</div>{props.exporting && <button className="ghost" onClick={props.onCancel}>Stop safely</button>}<button className="primary" disabled={props.exporting} onClick={props.onExport}>{props.exporting ? 'Exporting…' : 'Export clip →'}</button></div>
    </div>
  </section>;
}

function Settings({ session, preferences, onSession, onPreferences }: { session: StudioSession; preferences: StudioPreferences; onSession(session: StudioSession): void; onPreferences(preferences: StudioPreferences): Promise<void> }) {
  const choose = async (kind: 'libraryPath' | 'downloadPath' | 'exportPath') => {
    const folder = await window.cuttingFloor.chooseLocation(kind, preferences[kind]);
    if (!folder) return;
    await onPreferences({ ...preferences, [kind]: folder });
    if (kind === 'libraryPath') onSession({ ...session });
  };
  return <section className="page settings-page"><div className="eyebrow">WORKSPACE PREFERENCES</div><h1>SETTINGS</h1>
    <Field label="APPEARANCE"><div className="theme-toggle" role="group" aria-label="Appearance"><button className={preferences.theme !== 'light' ? 'active' : ''} onClick={() => void onPreferences({ ...preferences, theme: 'dark' })}>Dark</button><button className={preferences.theme === 'light' ? 'active' : ''} onClick={() => void onPreferences({ ...preferences, theme: 'light' })}>Light</button></div><small className="settings-help">Switch between the Cutting Floor darkroom and a bright studio workspace.</small></Field>
    <Field label="PROJECT / SESSION LIBRARY"><div className="location-row"><input readOnly value={preferences.libraryPath} /><button className="ghost" onClick={() => choose('libraryPath')}>Choose</button></div></Field>
    <Field label="DOWNLOADED SOURCE MASTERS"><div className="location-row"><input readOnly value={preferences.downloadPath} /><button className="ghost" onClick={() => choose('downloadPath')}>Choose</button></div></Field>
    <Field label="FINISHED CLIPS + PNG FRAMES"><div className="location-row"><input readOnly value={preferences.exportPath} /><button className="ghost" onClick={() => choose('exportPath')}>Choose</button></div></Field>
    <label className="expert-toggle"><input type="checkbox" checked={preferences.expertMode} onChange={(event) => onPreferences({ ...preferences, expertMode: event.target.checked })} /><span><b>EXPERT MODE</b><small>Shows field order, rotation, color-management, and compatibility-engine controls.</small></span></label>
    <Field label="PROJECT NAME"><div className="location-row"><input value={session.name} maxLength={100} onChange={(event) => onSession({ ...session, name: event.target.value })} /></div></Field>
    <div className="settings-note"><b>WATCHED FOLDERS</b>{session.watchFolders.length ? session.watchFolders.map((folder) => <span key={folder}>{folder}</span>) : <span>None configured for this project.</span>}</div>
  </section>;
}

function CropField({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return <label><span>{label} · {Math.round(value * 100)}%</span><input type="range" min="0" max="0.8" step="0.001" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function CropMask({ recipe, source, onChange }: { recipe: ClipRecipe; source: StudioSource; onChange(recipe: ClipRecipe): void }) {
  const drag = useRef<{ x: number; y: number; recipe: ClipRecipe } | undefined>(undefined);
  const move = (event: React.PointerEvent<HTMLButtonElement>, edges: Array<'cropLeft' | 'cropRight' | 'cropTop' | 'cropBottom'>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.closest('.crop-preview')!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    let next = recipe;
    for (const edge of edges) next = setCropEdge(next, edge, edge === 'cropLeft' ? x : edge === 'cropRight' ? 1 - x : edge === 'cropTop' ? y : 1 - y, source.sourceAnalysis.width, source.sourceAnalysis.height);
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

```
