import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { IPC } from '../shared/api';
import { isModelChoice } from '../shared/model';
import { validQuery } from '../shared/search';
import { emptyOrganize, parseOrganize, type OrganizeData } from '../shared/organize';
import { promptForCwd } from '../shared/projects';
import { savePastedImage } from './attachment-store';
import { saveHandoff } from './handoff-store';
import { createHistoryReader } from './history-reader';
import { loadOrganize, saveOrganize } from './organize-store';
import { pathsExist } from './paths-exist';
import { createRouterChooser, DIRECT, loadRouterEnabled, routerCliPath, saveRouterEnabled, type Launcher } from './router';
import { createSearchIndex } from './search-index';
import { lastResponder, routerLogPath } from './router-log';
import { SessionManager } from './session-manager';
import type { BridgeEvent } from '../shared/events';

/** Copie de organize.json tenue par main : les instructions des projets y sont lues à chaque lancement de claude. */
let organize: OrganizeData = emptyOrganize();

export function registerClaudeIpc(): SessionManager {
  // Routeur ccr (secours Gemini) : choisi juste avant chaque lancement, claude direct s'il ne répond pas.
  const userData = app.getPath('userData');
  let routerEnabled = loadRouterEnabled(userData);
  const cli = routerCliPath();
  const chooseLauncher = createRouterChooser({
    enabled: () => routerEnabled,
    cli,
    startGateway: () =>
      spawn('node', [cli, 'start', '--daemon', '--no-open'], { detached: true, stdio: 'ignore', windowsHide: true })
        .on('error', () => {}) // node absent : on restera en claude direct
        .unref(),
  });
  let launcher: Launcher = DIRECT;
  const prepareLauncher = async () => {
    launcher = await chooseLauncher();
  };
  void prepareLauncher(); // dès l'ouverture : la 1re session n'attend pas le démarrage de ccr

  const send = (event: BridgeEvent) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.event, event);
  };
  const logPath = routerLogPath();
  const manager = new SessionManager(
    (event) => {
      send(event);
      // Via le routeur, le flux garde le nom du modèle demandé : on lit dans le journal ccr qui a répondu.
      // Petit délai : ccr écrit la ligne du journal juste après la fin du flux.
      if (event.type === 'turn-end' && launcher !== DIRECT) {
        setTimeout(() => {
          const who = lastResponder(logPath, event.sessionId);
          if (who) send({ type: 'responder', sessionId: event.sessionId, ...who });
        }, 1000);
      }
    },
    { promptFor: (cwd) => promptForCwd(organize, cwd, existsSync), launcher: () => launcher },
  );

  ipcMain.handle(IPC.start, async (_e, cwd: unknown, resumeId: unknown, model: unknown) => {
    // Le renderer n'est pas digne de confiance : on vérifie ce qu'il envoie.
    if (typeof cwd !== 'string' || !existsSync(cwd)) throw new Error(`Dossier invalide : ${String(cwd)}`);
    if (resumeId !== undefined && typeof resumeId !== 'string') throw new Error('resumeId invalide');
    if (model !== undefined && !isModelChoice(model)) throw new Error('Modèle invalide');
    await prepareLauncher();
    return manager.start(cwd, resumeId, model);
  });

  ipcMain.handle(IPC.routerGet, () => routerEnabled);
  ipcMain.handle(IPC.routerSet, (_e, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Valeur invalide');
    routerEnabled = enabled;
    saveRouterEnabled(userData, enabled);
  });

  ipcMain.on(IPC.send, (_e, sessionId: unknown, text: unknown) => {
    if (typeof sessionId === 'string' && typeof text === 'string') manager.send(sessionId, text);
  });

  ipcMain.handle(IPC.pickFolder, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const options = { title: 'Dossier de travail de la session', properties: ['openDirectory' as const] };
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC.pickFiles, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const options = { title: 'Joindre des fichiers', properties: ['openFile' as const, 'multiSelections' as const] };
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle(IPC.savePasted, (_e, bytes: unknown, ext: unknown) => {
    if (!(bytes instanceof Uint8Array) || typeof ext !== 'string') throw new Error('Image invalide');
    return savePastedImage(join(app.getPath('userData'), 'attachments'), bytes, ext, new Date());
  });

  ipcMain.on(IPC.interrupt,(_e, sessionId: unknown) => {
    if (typeof sessionId === 'string') manager.interrupt(sessionId);
  });

  ipcMain.on(IPC.stop,(_e, sessionId: unknown) => {
    if (typeof sessionId === 'string') manager.stop(sessionId);
  });

  ipcMain.handle(IPC.setModel, async (_e, sessionId: unknown, model: unknown) => {
    if (typeof sessionId !== 'string') throw new Error('sessionId invalide');
    if (model !== undefined && !isModelChoice(model)) throw new Error('Modèle invalide');
    await prepareLauncher();
    manager.restart(sessionId, model);
  });

  return manager;
}

export function registerHistoryIpc(): void {
  const root = join(homedir(), '.claude', 'projects');
  const reader = createHistoryReader(root);
  const index = createSearchIndex(root);

  ipcMain.handle(IPC.historyList, () => reader.listProjects());

  ipcMain.handle(IPC.historyRead, (_e, folder: unknown, id: unknown) => {
    if (typeof folder !== 'string' || typeof id !== 'string') throw new Error('Session invalide');
    return reader.readSession(folder, id); // vérifie aussi que le chemin reste dans le dossier
  });

  ipcMain.handle(IPC.historySearch, (_e, query: unknown) => {
    if (!validQuery(query)) throw new Error('Recherche invalide');
    return index.search(query);
  });
}

export function registerHandoffIpc(): void {
  ipcMain.handle(IPC.handoffSave, (_e, text: unknown, sessionId: unknown) => {
    if (typeof text !== 'string' || typeof sessionId !== 'string') throw new Error('Passation invalide');
    return saveHandoff(join(app.getPath('userData'), 'handoffs'), text, sessionId, new Date());
  });
}

export function registerOrganizeIpc(): void {
  const dir = app.getPath('userData');
  let changed = false;
  // Lecture au démarrage, sans écraser un enregistrement arrivé entre-temps.
  void loadOrganize(dir).then((data) => {
    if (!changed) organize = data;
  });
  ipcMain.handle(IPC.organizeGet, () => loadOrganize(dir));
  ipcMain.handle(IPC.organizeSet, (_e, data: unknown) => {
    // Repassée par parseOrganize : seuls les champs connus et bien typés sont écrits.
    const clean = parseOrganize(JSON.stringify(data ?? null));
    if (!clean) throw new Error('Données de rangement invalides');
    changed = true;
    organize = clean;
    return saveOrganize(dir, clean);
  });
  ipcMain.handle(IPC.pathsExist, (_e, paths: unknown) => pathsExist(paths));
}
