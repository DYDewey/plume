import { app, BrowserWindow, Menu, nativeTheme, protocol, shell } from 'electron';
import { ARTIFACT_CSP } from '../shared/artifacts';
import { createArtifactStore } from './artifact-store';
import { join } from 'node:path';
import { registerClaudeIpc, registerExportIpc, registerHandoffIpc, registerHistoryIpc, registerOrganizeIpc } from './ipc';

/** Hauteur de la barre de titre maison (doit égaler --titlebar-h dans styles.css). */
const TITLEBAR_H = 40;

/** Couleurs des boutons Windows (réduire / agrandir / fermer) selon le thème. */
function overlayColors(): { color: string; symbolColor: string; height: number } {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#232220', symbolColor: '#a29e95', height: TITLEBAR_H }
    : { color: '#f3f1ea', symbolColor: '#6f6b60', height: TITLEBAR_H };
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 720,
    minHeight: 480,
    title: 'Mon-Claude',
    // Pas de barre Windows ni de menu : on dessine notre barre, Windows garde ses 3 boutons.
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayColors(),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1b19' : '#faf9f5',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Affiche la fenêtre une fois prête : pas de flash blanc au démarrage.
  win.once('ready-to-show', () => win.show());
  // Les boutons Windows suivent le thème clair / sombre en direct.
  const onTheme = (): void => win.setTitleBarOverlay(overlayColors());
  nativeTheme.on('updated', onTheme);
  win.on('closed', () => nativeTheme.off('updated', onTheme));

  // Sans menu, F12 ouvre encore les outils de développement, mais seulement en dev.
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    });
  }

  // Un fichier lâché hors de la zone de saisie ne doit pas remplacer l'app par son contenu.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // Liens « nouvelle fenêtre » (artefacts, réponses) : ouverts dans le navigateur, jamais dans l'app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // En dev, electron-vite fournit l'URL du serveur Vite ; en build, on charge le fichier.
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Plus de menu « File / Edit / View / Window » (copier-coller marche sans lui sous Windows).
Menu.setApplicationMenu(null);
// Même identifiant que le raccourci de l'installeur : sans lui, Windows n'affiche pas les notifications.
app.setAppUserModelId('fr.moi.mon-claude');

// Artefacts : servis par artifact://, avec leur propre CSP (une iframe srcdoc hériterait de celle de l'app).
protocol.registerSchemesAsPrivileged([{ scheme: 'artifact', privileges: { standard: true, secure: true } }]);
const artifacts = createArtifactStore();

app.whenReady().then(() => {
  protocol.handle('artifact', (req) => {
    const html = artifacts.get(req.url);
    if (html === undefined) return new Response('Artefact introuvable', { status: 404 });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': ARTIFACT_CSP } });
  });
  registerExportIpc(artifacts);
  const sessions = registerClaudeIpc();
  registerHistoryIpc();
  registerHandoffIpc();
  registerOrganizeIpc();
  // Aucun processus claude ne doit survivre à l'app.
  app.on('before-quit', () => sessions.stopAll());
  createWindow();
});

app.on('window-all-closed', () => app.quit());
