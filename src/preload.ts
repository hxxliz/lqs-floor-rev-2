import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, ExportProgress, ExportRequest, FeedbackReport, PixelEvidence, PreviewSettings, StudioPreferences, StudioSession, StudioSource, TaskProgress, UpdateInfo } from './shared';

const api: DesktopApi = {
  loadWorkspace: () => ipcRenderer.invoke('workspace:load'),
  createProject: (name: string) => ipcRenderer.invoke('project:create', name),
  openProject: (id: string) => ipcRenderer.invoke('project:open', id),
  renameProject: (id: string, name: string) => ipcRenderer.invoke('project:rename', id, name),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),
  saveSession: (session: StudioSession) => ipcRenderer.invoke('session:save', session),
  importVideos: (session, mode) => ipcRenderer.invoke('source:import', session, mode),
  reanalyzeSource: (sourcePath) => ipcRenderer.invoke('source:reanalyze', sourcePath),
  downloadVideo: (session, url, downloadFolder, browser) => ipcRenderer.invoke('source:download', session, url, downloadFolder, browser),
  savePreferences: (preferences: StudioPreferences) => ipcRenderer.invoke('preferences:save', preferences),
  changeLibrary: (session, libraryPath) => ipcRenderer.invoke('library:change', session, libraryPath),
  chooseLocation: (kind, current) => ipcRenderer.invoke('location:choose', kind, current),
  exportClip: (request: ExportRequest) => ipcRenderer.invoke('export:start', request),
  readReceipt: (receiptPath: string) => ipcRenderer.invoke('receipt:read', receiptPath),
  tunePreview: (request: ExportRequest, settings: PreviewSettings) => ipcRenderer.invoke('previewTune', request, settings),
  onPreviewTuneProgress: (callback: (prog: { percent: number; message: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, prog: { percent: number; message: string }) => callback(prog);
    ipcRenderer.on('previewTuneProgress', listener);
    return () => { ipcRenderer.removeListener('previewTuneProgress', listener); };
  },
  cancelTask: () => ipcRenderer.invoke('task:cancel'),
  runtimeStatus: () => ipcRenderer.invoke('runtime:status'),
  onExportProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ExportProgress) => callback(progress);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.removeListener('export:progress', listener);
  },
  onTaskProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: TaskProgress) => callback(progress);
    ipcRenderer.on('task:progress', listener);
    return () => ipcRenderer.removeListener('task:progress', listener);
  },
  onWatchSources: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, sources: StudioSource[]) => callback(sources);
    ipcRenderer.on('watch:sources', listener);
    return () => { ipcRenderer.removeListener('watch:sources', listener); };
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  onUpdateProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => callback(info);
    ipcRenderer.on('update:progress', listener);
    return () => { ipcRenderer.removeListener('update:progress', listener); };
  },
  checkToolUpdates: () => ipcRenderer.invoke('tools:check'),
  updateTool: (name: string) => ipcRenderer.invoke('tools:update', name),
  submitFeedback: (report: FeedbackReport) => ipcRenderer.invoke('feedback:submit', report),
  openIssue: (url: string) => ipcRenderer.invoke('feedback:open', url),
};

contextBridge.exposeInMainWorld('cuttingFloor', api);
