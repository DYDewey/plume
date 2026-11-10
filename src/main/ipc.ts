import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, Notification } from 'electron';
import { notificationBody } from '../shared/notify';
import { ARTIFACT_INSTRUCTIONS, joinPrompts } from '../shared/artifacts';
import { cleanFileName } from '../shared/export';
import { loadSettings, saveSettings } from './settings-store';
import { IPC } from '../shared/api';
import { isPermissionDecision } from '../shared/events';
import { isModelChoice } from '../shared/model';
import { decideRoute, isContinuation, ruleRoute } from '../shared/auto-route';
import { askJudge, askTitle, logRoute } from './judge';
import { titleExcerpt } from '../shared/auto-title';
import { isSessionId } from './claude-args';
import { validQuery } from '../shared/search';
import { emptyOrganize, parseOrganize, type OrganizeData } from '../shared/organize';
import { promptForCwd } from '../shared/projects';
import { savePastedImage } from './attachment-store';
import { saveHandoff } from './handoff-store';
import { createHistoryReader } from './history-reader';
import { loadOrganize, saveOrganize } from './organize-store';
import { pathsExist } from './paths-exist';
import { createRouterChooser, DIRECT, loadRouterEnabled, readRouterToken, routerCliPath, saveRouterEnabled, type Launcher } from './router';
import { createSearchIndex } from './search-index';
import { lastLimits, lastResponder, routerLogPath } from './router-log';
import { SessionManager } from './session-manager';
import type { BridgeEvent } from '../shared/events';

/** Réponse finie pendant qu'on fait autre chose : notification Windows ; un clic ramène la fenêtre sur la session. */
function notifyDone(sessionId: string, result: string | undefined): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isFocused() || !Notification.isSupported()) return;
  const n = new Notification({ title: 'Claude a répondu', body: notificationBody(result), silent: false });
  n.on('click', () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send(IPC.focusSession, sessionId);
  });
  n.show();
}

/** Copie de organize.json tenue par main : les instructions des projets y sont lues à chaque lancement de claude. */
let organize: OrganizeData = emptyOrganize();

export function registerClaudeIpc(): SessionManager {
  // Routeur ccr (secours Gemini) : choisi juste avant chaque lancement, claude direct s'il ne répond pas.
  const userData = app.getPath('userData');
  let routerEnabled = loadRouterEnabled(userData);
  // Réglages : le thème choisi pilote nativeTheme, que le CSS et les boutons Windows suivent tout seuls.
  let settings = loadSettings(userData);
  nativeTheme.themeSource = settings.theme;
  ipcMain.handle(IPC.settingsGet, () => settings);
  ipcMain.handle(IPC.settingsSet, (_e, patch: unknown) => {
    settings = saveSettings(userData, settings, patch);
    nativeTheme.themeSource = settings.theme;
    return settings;
  });
  const cli = routerCliPath();
  const chooseLauncher = createRouterChooser({
    enabled: () => routerEnabled,
    token: () => readRouterToken(),
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
      if (event.type === 'turn-end' && settings.notify) notifyDone(event.sessionId, event.result);
      // Via le routeur, le flux garde le nom du modèle demandé et n'a plus les jauges : on lit tout ça dans le journal ccr.
      // Petit délai : ccr écrit la ligne du journal juste après la fin du flux.
      if (event.type === 'turn-end' && launcher !== DIRECT) {
        setTimeout(() => {
          const who = lastResponder(logPath, event.sessionId);
          if (who) send({ type: 'responder', sessionId: event.sessionId, ...who });
          const limits = lastLimits(logPath);
          if (limits) send({ type: 'rate-limits', sessionId: event.sessionId, ...limits });
        }, 1000);
      }
    },
    {
      promptFor: (cwd) => joinPrompts(promptForCwd(organize, cwd, existsSync), settings.autoArtifacts ? ARTIFACT_INSTRUCTIONS : null),
      launcher: () => launcher,
      permissionMode: () => settings.permissionMode,
    },
  );

  ipcMain.handle(IPC.start, async (_e, cwd: unknown, resumeId: unknown, model: unknown, forkFrom: unknown) => {
    // Le renderer n'est pas digne de confiance : on vérifie ce qu'il envoie.
    if (typeof cwd !== 'string' || !existsSync(cwd)) throw new Error(`Dossier invalide : ${String(cwd)}`);
    if (resumeId !== undefined && typeof resumeId !== 'string') throw new Error('resumeId invalide');
    if (model !== undefined && !isModelChoice(model)) throw new Error('Modèle invalide');
    if (forkFrom !== undefined && !isSessionId(forkFrom)) throw new Error('Session à continuer invalide');
    await prepareLauncher();
    return manager.start(cwd, resumeId, model, forkFrom);
  });

  ipcMain.handle(IPC.routerGet, () => routerEnabled);
  ipcMain.handle(IPC.routerSet, (_e, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Valeur invalide');
    routerEnabled = enabled;
    saveRouterEnabled(userData, enabled);
  });

  // Titre automatique : même juge Gemini gratuit, seulement si ccr est actif (jamais de quota Claude).
  ipcMain.handle(IPC.title, async (_e, userTexts: unknown, lastReply: unknown) => {
    if (!Array.isArray(userTexts) || !userTexts.every((t) => typeof t === 'string') || typeof lastReply !== 'string') {
      throw new Error('Conversation invalide');
    }
    return askTitle(titleExcerpt(userTexts, lastReply), { token: launcher === DIRECT ? null : readRouterToken() });
  });

  // Mode Auto : règles + juge Gemini (via ccr, seulement s'il est actif) → modèle du prochain message.
  const routeLog = join(userData, 'auto-route.jsonl');
  ipcMain.handle(IPC.route, async (_e, text: unknown, current: unknown, contextUsed: unknown) => {
    if (typeof text !== 'string') throw new Error('Message invalide');
    const ctx = {
      current: isModelChoice(current) ? current : undefined,
      contextUsed: typeof contextUsed === 'number' ? contextUsed : undefined,
    };
    const rule = ruleRoute(text);
    // Commande ou simple « vas-y » : le modèle en cours est gardé, inutile de consulter le juge.
    const judge = text.trim().startsWith('/') || (ctx.current && isContinuation(text)) ? null : await askJudge(text, { token: launcher === DIRECT ? null : readRouterToken() });
    const route = decideRoute(text, rule, judge, ctx);
    void logRoute(routeLog, text, rule, judge, route);
    return route;
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

  ipcMain.on(IPC.permission, (_e, sessionId: unknown, requestId: unknown, decision: unknown) => {
    if (typeof sessionId === 'string' && typeof requestId === 'string' && isPermissionDecision(decision)) {
      manager.answerPermission(sessionId, requestId, decision);
    }
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

/** Nom de fichier proposé : sans caractère interdit par Windows, jamais vide. */
function safeName(name: unknown, fallback: string): string {
  const clean = typeof name === 'string' ? cleanFileName(name).slice(0, 120).trim() : '';
  return clean || fallback;
}

const FILTERS: Record<string, { name: string; extensions: string[] }> = {
  md: { name: 'Markdown', extensions: ['md'] },
  html: { name: 'Page HTML', extensions: ['html'] },
  svg: { name: 'Image SVG', extensions: ['svg'] },
  mmd: { name: 'Diagramme Mermaid', extensions: ['mmd'] },
  pdf: { name: 'PDF', extensions: ['pdf'] },
};

async function askSavePath(e: Electron.IpcMainInvokeEvent, name: string): Promise<string | null> {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  const win = BrowserWindow.fromWebContents(e.sender);
  const options = {
    title: 'Enregistrer sous',
    defaultPath: join(app.getPath('documents'), name),
    filters: FILTERS[ext] ? [FILTERS[ext]] : [],
  };
  const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
  return res.canceled || !res.filePath ? null : res.filePath;
}

export function registerExportIpc(artifacts: { put(html: string): string }): void {
  ipcMain.handle(IPC.saveText, async (e, name: unknown, text: unknown) => {
    if (typeof text !== 'string') throw new Error('Texte invalide');
    const path = await askSavePath(e, safeName(name, 'conversation.md'));
    if (path) await writeFile(path, text, 'utf8');
    return path;
  });

  // La feuille @media print de l'app ne garde que la conversation affichée.
  ipcMain.handle(IPC.exportPdf, async (e, name: unknown) => {
    const path = await askSavePath(e, safeName(name, 'conversation.pdf'));
    if (!path) return null;
    const pdf = await e.sender.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 } });
    await writeFile(path, pdf);
    return path;
  });

  ipcMain.handle(IPC.showArtifact, (_e, html: unknown) => {
    if (typeof html !== 'string' || html.length > 5_000_000) throw new Error('Artefact invalide');
    return artifacts.put(html);
  });
}
