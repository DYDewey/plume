import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC, type ClaudeApi, type UpdateEvent } from '../shared/api';
import type { BridgeEvent } from '../shared/events';

const api: ClaudeApi = {
  startSession: (cwd, opts) => ipcRenderer.invoke(IPC.start, cwd, opts?.resumeId, opts?.model, opts?.forkFrom, opts?.resumeAt),
  sendMessage: (sessionId, text) => ipcRenderer.send(IPC.send, sessionId, text),
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  pickFiles: () => ipcRenderer.invoke(IPC.pickFiles),
  // File.path n'existe plus dans Electron récent : webUtils le remplace.
  pathForFile: (file) => webUtils.getPathForFile(file),
  savePastedImage: (bytes, ext) => ipcRenderer.invoke(IPC.savePasted, bytes, ext),
  answerPermission: (sessionId, requestId, decision) => ipcRenderer.send(IPC.permission, sessionId, requestId, decision),
  interrupt: (sessionId) => ipcRenderer.send(IPC.interrupt, sessionId),
  stopSession: (sessionId) => ipcRenderer.send(IPC.stop, sessionId),
  setModel: (sessionId, model) => ipcRenderer.invoke(IPC.setModel, sessionId, model),
  routeMessage: (text, current, contextUsed) => ipcRenderer.invoke(IPC.route, text, current, contextUsed),
  titleSession: (userTexts, lastReply) => ipcRenderer.invoke(IPC.title, userTexts, lastReply),
  onEvent: (cb) => {
    const listener = (_e: IpcRendererEvent, event: BridgeEvent) => cb(event);
    ipcRenderer.on(IPC.event, listener);
    return () => ipcRenderer.removeListener(IPC.event, listener);
  },
  listHistory: () => ipcRenderer.invoke(IPC.historyList),
  readHistory: (folder, id) => ipcRenderer.invoke(IPC.historyRead, folder, id),
  searchHistory: (query) => ipcRenderer.invoke(IPC.historySearch, query),
  saveHandoff: (text, sessionId) => ipcRenderer.invoke(IPC.handoffSave, text, sessionId),
  getOrganize: () => ipcRenderer.invoke(IPC.organizeGet),
  setOrganize: (data) => ipcRenderer.invoke(IPC.organizeSet, data),
  pathsExist: (paths) => ipcRenderer.invoke(IPC.pathsExist, paths),
  getRouter: () => ipcRenderer.invoke(IPC.routerGet),
  setRouter: (enabled) => ipcRenderer.invoke(IPC.routerSet, enabled),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  onFocusSession: (cb) => {
    const listener = (_e: IpcRendererEvent, sessionId: string) => cb(sessionId);
    ipcRenderer.on(IPC.focusSession, listener);
    return () => ipcRenderer.removeListener(IPC.focusSession, listener);
  },
  saveText: (defaultName, text) => ipcRenderer.invoke(IPC.saveText, defaultName, text),
  exportPdf: (defaultName) => ipcRenderer.invoke(IPC.exportPdf, defaultName),
  showArtifact: (html) => ipcRenderer.invoke(IPC.showArtifact, html),
  chatFolder: () => ipcRenderer.invoke(IPC.chatFolder),
  thumbnail: (path) => ipcRenderer.invoke(IPC.thumbnail, path),
  appVersion: () => ipcRenderer.invoke(IPC.appVersion),
  checkUpdate: () => ipcRenderer.invoke(IPC.updateCheck),
  installUpdate: () => ipcRenderer.invoke(IPC.updateInstall),
  onUpdate: (cb) => {
    const listener = (_e: IpcRendererEvent, event: UpdateEvent) => cb(event);
    ipcRenderer.on(IPC.updateEvent, listener);
    return () => ipcRenderer.removeListener(IPC.updateEvent, listener);
  },
};

contextBridge.exposeInMainWorld('claude', api);
