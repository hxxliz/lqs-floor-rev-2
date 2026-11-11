import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { watch, type FSWatcher } from 'node:fs';
import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { downloadPublicVideo, getRuntimeStatus, prepareSource, probeMedia, processClip, stopMediaProcesses, tunePreview } from './media';
import { buildReceipt, receiptFileName, assertPublicVideoUrl, defaultRecipe, safeFileName, type DownloadBrowser, type ExportRequest, type ProjectCard, type StudioPreferences, type StudioSession, type StudioSource, type WorkspaceState } from './shared';
import { ensurePreferenceFolders } from './storage';

if (squirrelStartup) app.quit();

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const videoExtensions = new Set(['.mp4', '.mov', '.mkv', '.avi', '.m4v', '.webm', '.mts', '.m2ts', '.ts']);
let mainWindow: BrowserWindow | null = null;
let exportController: AbortController | null = null;
let taskController: AbortController | null = null;
let activeSession: StudioSession | null = null;
const watchers = new Map<string, { watcher: FSWatcher; projectId: string }>();
const watchTimers = new Map<string, NodeJS.Timeout>();

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function showFatalError(title: string, error: unknown) {
  const message = `${errorMessage(error)}\n\nYour projects remain saved. Restart the app and try again.`;
  if (app.isReady()) dialog.showErrorBox(title, message);
  else console.error(title, message);
}

function stopBackgroundWork() {
  exportController?.abort();
  taskController?.abort();
  stopMediaProcesses();
  for (const timer of watchTimers.values()) clearTimeout(timer);
  watchTimers.clear();
  for (const { watcher } of watchers.values()) watcher.close();
  watchers.clear();
}

const preferencesPath = () => path.join(app.getPath('userData'), 'preferences.json');
const legacySessionPath = () => path.join(app.getPath('userData'), 'current-session.json');
const defaultPreferences = (): StudioPreferences => ({
  libraryPath: path.join(app.getPath('documents'), "LQ's Cutting Floor", 'Projects'),
  downloadPath: path.join(app.getPath('videos'), "LQ's Cutting Floor", 'Downloaded Masters'),
  exportPath: path.join(app.getPath('videos'), "LQ's Cutting Floor", 'Finished Clips'),
  expertMode: false,
  theme: 'dark',
  onboardingComplete: false,
});
const fallbackPreferences = (): StudioPreferences => {
  const localAppData = process.env.LOCALAPPDATA;
  const root = path.join(localAppData && path.isAbsolute(localAppData) ? localAppData : app.getPath('userData'), "LQ's Cutting Floor");
  return {
    libraryPath: path.join(root, 'Projects'),
    downloadPath: path.join(root, 'Downloaded Masters'),
    exportPath: path.join(root, 'Finished Clips'),
    expertMode: false,
    theme: 'dark',
    onboardingComplete: false,
  };
};

const emptySession = (name = 'Untitled Cutting Floor'): StudioSession => ({
  version: 6, id: crypto.randomUUID(), name, created: new Date().toISOString(), updated: new Date().toISOString(), sources: [], clips: [], watchFolders: [],
});

async function atomicJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporary, file);
}

async function loadPreferences() {
  try { return { ...defaultPreferences(), ...JSON.parse(await readFile(preferencesPath(), 'utf8')) } as StudioPreferences; }
  catch { return defaultPreferences(); }
}

async function persistPreferences(preferences: StudioPreferences, allowFallback = false) {
  const resolved = await ensurePreferenceFolders(preferences, allowFallback ? fallbackPreferences() : undefined);
  await atomicJson(preferencesPath(), resolved);
  return resolved;
}

function normalizeSession(value: Partial<StudioSession>): StudioSession {
  const now = new Date().toISOString();
  return {
    version: 6,
    id: value.id ?? crypto.randomUUID(),
    name: value.name?.trim() || 'Untitled Cutting Floor',
    created: value.created ?? now,
    updated: value.updated ?? value.created ?? now,
    activeSourceId: value.activeSourceId,
    watchFolders: value.watchFolders ?? [],
    sources: (value.sources ?? []).map((source) => ({
      ...source,
      missing: source.missing ?? false,
      sourceAnalysis: {
        ...source.sourceAnalysis,
        format: source.sourceAnalysis.format ?? 'unknown', pixelFormat: source.sourceAnalysis.pixelFormat ?? 'unknown', bitDepth: source.sourceAnalysis.bitDepth ?? 8,
        bitrate: source.sourceAnalysis.bitrate ?? 0, colorTransfer: source.sourceAnalysis.colorTransfer ?? 'unknown', hdr: source.sourceAnalysis.hdr ?? 'Unknown',
        scanType: source.sourceAnalysis.scanType ?? 'Unknown', fieldOrder: source.sourceAnalysis.fieldOrder ?? 'unknown', variableFrameRate: source.sourceAnalysis.variableFrameRate ?? false,
        qualitySummary: source.sourceAnalysis.qualitySummary ?? `${source.sourceAnalysis.width}×${source.sourceAnalysis.height} · ${source.sourceAnalysis.fps.toFixed(3)} fps`,
      },
    })),
    clips: (value.clips ?? []).map((clip) => {
      const legacy = clip.recipe as typeof clip.recipe & { fadeIn?: boolean; fadeOut?: boolean };
      const aspectPreset = ({ '16:9': 'One-column landscape · 540×304', Square: 'One-column square · 540×540', 'Portrait 4:5': 'One-column portrait · 540×675', 'Tall 2:3': 'One-column tall portrait · 540×810', Classic: 'Custom' } as Record<string, typeof legacy.aspectPreset>)[legacy.aspectPreset] ?? legacy.aspectPreset;
      return { ...clip, recipe: { ...defaultRecipe(), ...legacy, aspectPreset, outputFormat: legacy.outputFormat === ('PNG Sequence' as typeof legacy.outputFormat) ? 'ProRes 422' : legacy.outputFormat, denoise: legacy.denoise === ('Quality' as typeof legacy.denoise) ? 'Fine detail' : legacy.denoise, fade: legacy.fade ?? legacy.fadeIn ?? legacy.fadeOut ?? false } };
    }),
  };
}

const projectFolder = (session: StudioSession, preferences: StudioPreferences) => path.join(preferences.libraryPath, session.id);
const sessionFile = (id: string, preferences: StudioPreferences) => path.join(preferences.libraryPath, id, 'session.json');

async function refreshSourceUrls(source: StudioSource) {
  let missing = false;
  try { await access(source.sourcePath); } catch { missing = true; }
  let playbackPath = source.playbackPath;
  if (playbackPath) try { await access(playbackPath); } catch { playbackPath = undefined; }
  let thumbnailUrl: string | undefined;
  if (source.thumbnailPath) try { await access(source.thumbnailPath); thumbnailUrl = pathToFileURL(source.thumbnailPath).href; } catch { /* No cached thumbnail. */ }
  return { ...source, playbackPath, fileUrl: pathToFileURL(playbackPath ?? source.sourcePath).href, thumbnailUrl, missing };
}

async function loadProject(id: string, preferences: StudioPreferences) {
  const session = normalizeSession(JSON.parse(await readFile(sessionFile(id, preferences), 'utf8')) as StudioSession);
  session.sources = await Promise.all(session.sources.map(refreshSourceUrls));
  return session;
}

async function writeProject(session: StudioSession, preferences: StudioPreferences) {
  const saved = { ...session, updated: new Date().toISOString() };
  await atomicJson(sessionFile(saved.id, preferences), saved);
  return saved;
}

async function projectCards(preferences: StudioPreferences): Promise<ProjectCard[]> {
  await mkdir(preferences.libraryPath, { recursive: true });
  const entries = await readdir(preferences.libraryPath, { withFileTypes: true });
  const cards = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      const session = normalizeSession(JSON.parse(await readFile(sessionFile(entry.name, preferences), 'utf8')) as StudioSession);
      const thumbnailPath = session.sources.find((source) => source.thumbnailPath)?.thumbnailPath;
      let thumbnailUrl: string | undefined;
      if (thumbnailPath) try { await access(thumbnailPath); thumbnailUrl = pathToFileURL(thumbnailPath).href; } catch { /* Keep card text-only. */ }
      return { id: session.id, name: session.name, updated: session.updated, thumbnailUrl, sourceCount: session.sources.length, clipCount: session.clips.length, completedCount: session.clips.filter((clip) => clip.completed).length } satisfies ProjectCard;
    } catch { return undefined; }
  }));
  return cards.filter((card): card is Exclude<typeof card, undefined> => card !== undefined).sort((a, b) => b.updated.localeCompare(a.updated));
}

async function workspace(session: StudioSession, preferences: StudioPreferences): Promise<WorkspaceState> {
  return { session, preferences, projects: await projectCards(preferences) };
}

async function loadWorkspace() {
  let firstRun = false;
  try { await access(preferencesPath()); } catch { firstRun = true; }
  let preferences = await persistPreferences(await loadPreferences(), firstRun);
  let cards = await projectCards(preferences);
  let session: StudioSession;
  const selected = cards.find((card) => card.id === preferences.activeProjectId) ?? cards[0];
  if (selected) session = await loadProject(selected.id, preferences);
  else {
    try { session = normalizeSession(JSON.parse(await readFile(legacySessionPath(), 'utf8')) as StudioSession); }
    catch { session = emptySession(); }
    try { await access(legacySessionPath()); session = await writeProject(session, preferences); cards = await projectCards(preferences); } catch { /* Keep the first empty project transient. */ }
  }
  preferences = await persistPreferences({ ...preferences, activeProjectId: cards.length ? session.id : undefined });
  activeSession = session;
  configureWatchers(session, preferences);
  return { session, preferences, projects: cards };
}

async function createProject(name: string) {
  const preferences = await loadPreferences();
  const session = await writeProject(emptySession(name.slice(0, 100).trim() || 'Untitled Cutting Floor'), preferences);
  const nextPreferences = await persistPreferences({ ...preferences, activeProjectId: session.id });
  activeSession = session;
  configureWatchers(session, nextPreferences);
  return workspace(session, nextPreferences);
}

async function openProject(id: string) {
  const preferences = await loadPreferences();
  const session = await loadProject(id, preferences);
  const nextPreferences = await persistPreferences({ ...preferences, activeProjectId: id });
  activeSession = session;
  configureWatchers(session, nextPreferences);
  return workspace(session, nextPreferences);
}

async function renameProject(id: string, name: string) {
  const preferences = await loadPreferences();
  const project = await loadProject(id, preferences);
  const saved = await writeProject({ ...project, name: name.slice(0, 100).trim() || project.name }, preferences);
  if (activeSession?.id === id) activeSession = saved;
  return workspace(activeSession ?? saved, preferences);
}

async function deleteProject(id: string) {
  const preferences = await loadPreferences();
  const project = await loadProject(id, preferences);
  const confirmation = await dialog.showMessageBox(mainWindow!, {
    type: 'warning',
    title: 'Delete project?',
    message: `Delete “${project.name}” from the Cutting Floor library?`,
    detail: 'The session, cached thumbnails, and playback copies will be removed. Original source videos and finished exports will not be deleted.',
    buttons: ['Delete project', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (confirmation.response !== 0) return null;
  const library = path.resolve(preferences.libraryPath);
  const target = path.resolve(library, id);
  if (path.dirname(target).toLowerCase() !== library.toLowerCase()) throw new Error('The selected project path is invalid and was not deleted.');
  await rm(target, { recursive: true, force: true });
  const remaining = await projectCards(preferences);
  if (activeSession?.id !== id) return workspace(activeSession ?? (remaining[0] ? await loadProject(remaining[0].id, preferences) : emptySession()), preferences);
  const next = remaining[0] ? await loadProject(remaining[0].id, preferences) : emptySession();
  const nextPreferences = await persistPreferences({ ...preferences, activeProjectId: remaining.length ? next.id : undefined });
  activeSession = next;
  configureWatchers(next, nextPreferences);
  return workspace(next, nextPreferences);
}

async function saveSession(session: StudioSession) {
  if (session.version !== 6 || !session.id) throw new Error('This project cannot be saved because its session document is invalid.');
  const preferences = await loadPreferences();
  activeSession = await writeProject(session, preferences);
  await persistPreferences({ ...preferences, activeProjectId: session.id });
  configureWatchers(activeSession, preferences);
}

function sourceFiles(folder: string) {
  return readdir(folder, { withFileTypes: true }).then((entries) => entries.filter((entry) => entry.isFile() && videoExtensions.has(path.extname(entry.name).toLowerCase())).map((entry) => path.join(folder, entry.name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
}

function episodeLabel(file: string, index: number, episodic: boolean) {
  const name = path.basename(file, path.extname(file));
  const match = name.match(/s\d{1,2}e\d{1,3}/i);
  return match?.[0].toUpperCase() ?? (episodic ? `S01E${String(index + 1).padStart(2, '0')}` : name);
}

const sendTaskProgress = (progress: { percent: number; message: string }) => mainWindow?.webContents.send('task:progress', progress);

async function importVideos(session: StudioSession, mode: 'files' | 'season' | 'watch') {
  const directory = mode !== 'files';
  const result = await dialog.showOpenDialog(mainWindow!, { title: mode === 'files' ? 'Import source videos' : mode === 'season' ? 'Import season folder' : 'Choose folder to watch', properties: directory ? ['openDirectory'] : ['openFile', 'multiSelections'], filters: directory ? undefined : [{ name: 'Video', extensions: [...videoExtensions].map((extension) => extension.slice(1)) }] });
  if (result.canceled) return { sources: [] };
  const watchFolder = mode === 'watch' ? result.filePaths[0] : undefined;
  const files = directory ? await sourceFiles(result.filePaths[0]) : result.filePaths;
  const known = new Set(session.sources.map((source) => path.resolve(source.sourcePath).toLowerCase()));
  const fresh = files.filter((file) => !known.has(path.resolve(file).toLowerCase()));
  const preferences = await loadPreferences();
  const sources: StudioSource[] = [];
  taskController?.abort();
  const controller = new AbortController();
  taskController = controller;
  try {
    for (const [index, file] of fresh.entries()) sources.push(await prepareSource(file, episodeLabel(file, index, directory), projectFolder(session, preferences), sendTaskProgress, controller.signal));
  } finally {
    if (taskController === controller) taskController = null;
  }
  if (watchFolder) configureWatchers({ ...session, sources: [...session.sources, ...sources], watchFolders: [...new Set([...session.watchFolders, watchFolder])] }, preferences);
  return { sources, watchFolder };
}

async function scanWatchedFolder(folder: string, preferences: StudioPreferences, projectId: string) {
  const startingSession = activeSession?.id === projectId ? activeSession : await loadProject(projectId, preferences);
  if (!startingSession.watchFolders.includes(folder)) return;
  const known = new Set(startingSession.sources.map((source) => path.resolve(source.sourcePath).toLowerCase()));
  const files = (await sourceFiles(folder)).filter((file) => !known.has(path.resolve(file).toLowerCase()));
  if (!files.length) return;
  const sources: StudioSource[] = [];
  for (const [index, file] of files.entries()) sources.push(await prepareSource(file, episodeLabel(file, startingSession.sources.length + index, true), projectFolder(startingSession, preferences), sendTaskProgress));
  const latest = activeSession?.id === projectId ? activeSession : await loadProject(projectId, preferences);
  const existing = new Set(latest.sources.map((source) => path.resolve(source.sourcePath).toLowerCase()));
  const fresh = sources.filter((source) => !existing.has(path.resolve(source.sourcePath).toLowerCase()));
  const saved = await writeProject({ ...latest, sources: [...latest.sources, ...fresh] }, preferences);
  if (activeSession?.id === projectId) {
    activeSession = saved;
    mainWindow?.webContents.send('watch:sources', fresh);
  }
}

function configureWatchers(session: StudioSession, preferences: StudioPreferences) {
  const wanted = new Set(session.watchFolders);
  for (const [folder, active] of watchers) if (!wanted.has(folder) || active.projectId !== session.id) { active.watcher.close(); watchers.delete(folder); }
  for (const folder of wanted) if (!watchers.has(folder)) {
    try {
      const watcher = watch(folder, () => {
        const previous = watchTimers.get(folder);
        if (previous) clearTimeout(previous);
        watchTimers.set(folder, setTimeout(() => void scanWatchedFolder(folder, preferences, session.id).catch((error) => sendTaskProgress({ percent: 0, message: `Watch folder: ${error.message}` })), 1200));
      });
      watcher.on('error', (error) => { watcher.close(); watchers.delete(folder); sendTaskProgress({ percent: 0, message: `Watch folder: ${error.message}` }); });
      watchers.set(folder, { watcher, projectId: session.id });
    } catch (error) { sendTaskProgress({ percent: 0, message: `Could not watch ${folder}: ${error instanceof Error ? error.message : String(error)}` }); }
  }
}

async function downloadVideo(session: StudioSession, url: string, downloadFolder?: string, browser?: DownloadBrowser) {
  const publicUrl = assertPublicVideoUrl(url);
  const preferences = await loadPreferences();
  taskController?.abort();
  const controller = new AbortController();
  taskController = controller;
  try {
    sendTaskProgress({ percent: 1, message: 'Connecting to the public video source' });
    const sourcePath = await downloadPublicVideo(publicUrl, downloadFolder ?? session.downloadPath ?? preferences.downloadPath, controller.signal, (progress) => sendTaskProgress({ percent: Math.max(1, progress.percent * 0.65), message: progress.message }), browser);
    return await prepareSource(sourcePath, path.basename(sourcePath, path.extname(sourcePath)), projectFolder(session, preferences), (progress) => sendTaskProgress({ percent: 65 + progress.percent * 0.35, message: progress.message }), controller.signal);
  } finally {
    if (taskController === controller) taskController = null;
  }
}

async function savePreferences(preferences: StudioPreferences) {
  const saved = await persistPreferences({ ...defaultPreferences(), ...preferences });
  applyWindowTheme(saved.theme);
  if (activeSession) configureWatchers(activeSession, saved);
  return saved;
}

async function changeLibrary(session: StudioSession, libraryPath: string) {
  const preferences = await loadPreferences();
  const source = path.resolve(preferences.libraryPath);
  const target = path.resolve(libraryPath);
  if (source.toLowerCase() === target.toLowerCase()) return workspace(session, preferences);
  await mkdir(target, { recursive: true });
  const confirmation = await dialog.showMessageBox(mainWindow!, {
    type: 'question',
    title: 'Change project library',
    message: 'How should Cutting Floor use the new project library?',
    detail: 'Copy keeps the existing library as a backup. Switch only opens projects already stored in the selected folder.',
    buttons: ['Copy projects and switch', 'Switch without copying', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  if (confirmation.response === 2) return null;
  if (confirmation.response === 0) {
    const relativeTarget = path.relative(source, target);
    if (relativeTarget && !relativeTarget.startsWith(`..${path.sep}`) && relativeTarget !== '..') throw new Error('Choose a folder outside the current project library when copying.');
    if ((await readdir(target)).length) throw new Error('Choose an empty folder when copying the project library. Nothing was moved or overwritten.');
    for (const entry of await readdir(source)) await cp(path.join(source, entry), path.join(target, entry), { recursive: true, force: false, errorOnExist: true });
  }
  const nextPreferences = await persistPreferences({ ...preferences, libraryPath: target });
  const cards = await projectCards(nextPreferences);
  const selected = cards.find((card) => card.id === session.id) ?? cards[0];
  const next = selected ? await loadProject(selected.id, nextPreferences) : emptySession();
  const savedPreferences = await persistPreferences({ ...nextPreferences, activeProjectId: selected?.id });
  activeSession = next;
  configureWatchers(next, savedPreferences);
  return { session: next, preferences: savedPreferences, projects: cards };
}

async function chooseLocation(_kind: 'libraryPath' | 'downloadPath' | 'exportPath', current: string) {
  const titles = { libraryPath: 'Choose project library', downloadPath: 'Choose downloaded master location', exportPath: 'Choose finished clip location' };
  const result = await dialog.showOpenDialog(mainWindow!, { title: titles[_kind], defaultPath: current, properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0];
}

async function uniqueOutput(folder: string, name: string, extension: string) {
  for (let suffix = 0; ; suffix += 1) {
    const candidate = path.join(folder, `${name}${suffix ? ` ${suffix + 1}` : ''}.${extension}`);
    try { await access(candidate); } catch { return candidate; }
  }
}

async function exportClip(request: ExportRequest) {
  try { await access(request.source.sourcePath); } catch { throw new Error(`The source for ${request.clip.name} moved or was deleted. Relink it before exporting.`); }
  const extension = request.clip.recipe.outputFormat === 'MP4' ? 'mp4' : 'mov';
  const folder = path.join(request.exportRoot, safeFileName(request.projectName));
  await mkdir(folder, { recursive: true });
  const outputPath = await uniqueOutput(folder, safeFileName(request.clip.name), extension);
  exportController?.abort();
  const controller = new AbortController();
  exportController = controller;
  let lastPercent = 0;
  try {
    const result = await processClip(request, outputPath, controller.signal, (percent, message) => {
      lastPercent = Math.max(lastPercent, percent);
      mainWindow?.webContents.send('export:progress', { clipId: request.clip.id, percent: lastPercent, message });
    });
    const clipResult = { ...request.clip, completed: true, outputPath, processingEngine: result.engine, fallbackReason: result.fallbackReason, pngFramesPath: result.pngFramesPath, outputWarnings: result.warnings };
    // Persist a render receipt next to the master: the verifiable record of this job
    // (source, recipe, engine, outputs, warnings). Best-effort — a missing receipt
    // must not fail the export.
    try {
      const vapourSynthScriptPath = request.clip.recipe.saveVapourSynthScript ? `${outputPath}.vpy` : undefined;
      const receipt = buildReceipt({ clip: clipResult, source: request.source, outputPath, engine: result.engine, fallbackReason: result.fallbackReason, pngFramesPath: result.pngFramesPath, warnings: result.warnings ?? [], vapourSynthScriptPath });
      const receiptPath = path.join(path.dirname(outputPath), receiptFileName(clipResult));
      await writeFile(receiptPath, JSON.stringify(receipt, null, 2), 'utf8');
      clipResult.receiptPath = receiptPath;
    } catch { /* Receipt is a best-effort audit artifact; never block the master on it. */ }
    return clipResult;
  } finally {
    if (exportController === controller) exportController = null;
  }
}

function windowTheme(theme: StudioPreferences['theme']) {
  return theme === 'light'
    ? { background: '#f6f8fc', overlay: { color: '#ffffff', symbolColor: '#182238', height: 42 } }
    : { background: '#0b0d0f', overlay: { color: '#08090a', symbolColor: '#d5d8d2', height: 42 } };
}

function applyWindowTheme(theme: StudioPreferences['theme']) {
  if (!mainWindow) return;
  const colors = windowTheme(theme);
  mainWindow.setBackgroundColor(colors.background);
  mainWindow.setTitleBarOverlay(colors.overlay);
}

function createWindow(theme: StudioPreferences['theme'] = 'dark') {
  const colors = windowTheme(theme);
  mainWindow = new BrowserWindow({ width: 1500, height: 940, minWidth: 960, minHeight: 620, backgroundColor: colors.background, titleBarStyle: 'hidden', titleBarOverlay: colors.overlay, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('render-process-gone', (_event, details) => { if (details.reason !== 'clean-exit') showFatalError('Cutting Floor renderer stopped', details.reason); });
  const loading = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    : mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  void loading.catch((error) => showFatalError('Cutting Floor could not open', error));
}

process.on('uncaughtException', (error) => { showFatalError('Cutting Floor encountered an unexpected error', error); app.quit(); });
process.on('unhandledRejection', (error) => showFatalError('Cutting Floor could not complete an operation', error));

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
else void app.whenReady().then(async () => {
  ipcMain.handle('workspace:load', loadWorkspace);
  ipcMain.handle('project:create', (_event, name: string) => createProject(name));
  ipcMain.handle('project:open', (_event, id: string) => openProject(id));
  ipcMain.handle('project:rename', (_event, id: string, name: string) => renameProject(id, name));
  ipcMain.handle('project:delete', (_event, id: string) => deleteProject(id));
  ipcMain.handle('session:save', (_event, session: StudioSession) => saveSession(session));
  ipcMain.handle('source:import', (_event, session: StudioSession, mode: 'files' | 'season' | 'watch') => importVideos(session, mode));
  ipcMain.handle('source:reanalyze', async (_event, sourcePath: string) => {
    taskController?.abort();
    const controller = new AbortController();
    taskController = controller;
    try {
      sendTaskProgress({ percent: 5, message: 'Sampling cadence, timing, color, and decode health' });
      const analysis = await probeMedia(sourcePath, controller.signal);
      sendTaskProgress({ percent: 100, message: 'Source guidance updated' });
      return analysis;
    } finally {
      if (taskController === controller) taskController = null;
    }
  });
  ipcMain.handle('source:download', (_event, session: StudioSession, url: string, downloadFolder?: string, browser?: DownloadBrowser) => downloadVideo(session, url, downloadFolder, browser));
  ipcMain.handle('preferences:save', (_event, preferences: StudioPreferences) => savePreferences(preferences));
  ipcMain.handle('library:change', (_event, session: StudioSession, libraryPath: string) => changeLibrary(session, libraryPath));
  ipcMain.handle('location:choose', (_event, kind: 'libraryPath' | 'downloadPath' | 'exportPath', current: string) => chooseLocation(kind, current));
  ipcMain.handle('runtime:status', getRuntimeStatus);
  ipcMain.handle('export:start', (_event, request: ExportRequest) => exportClip(request));
  ipcMain.handle('receipt:read', async (_event, receiptPath: string) => {
    try {
      return JSON.parse(await readFile(receiptPath, 'utf8'));
    } catch {
      return null;
    }
  });
  ipcMain.handle('previewTune', (_event, request: ExportRequest, settings) => tunePreview(request, settings, new AbortController().signal, (percent, message) => { mainWindow?.webContents.send('previewTuneProgress', { percent, message }); }));
  ipcMain.handle('task:cancel', () => { exportController?.abort(); taskController?.abort(); });
  createWindow((await loadPreferences()).theme);
  app.on('second-instance', () => { if (mainWindow?.isMinimized()) mainWindow.restore(); mainWindow?.show(); mainWindow?.focus(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void loadPreferences().then((preferences) => createWindow(preferences.theme)); });
}).catch((error) => showFatalError('Cutting Floor could not start', error));

app.on('before-quit', stopBackgroundWork);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
